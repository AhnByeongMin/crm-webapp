"""
Stage 3: Advanced Caching Manager
- In-memory LRU cache with TTL (Time-To-Live)
- Cache invalidation triggers
- ETag generation for conditional requests
- Performance monitoring
"""
import hashlib
import json
import time
from functools import wraps
from collections import OrderedDict
from threading import Lock

class LRUCache:
    """Thread-safe LRU Cache with TTL support"""

    def __init__(self, max_size=1000):
        self.cache = OrderedDict()
        self.max_size = max_size
        self.lock = Lock()
        self.hits = 0
        self.misses = 0

    def get(self, key):
        """Get cached value if exists and not expired"""
        with self.lock:
            if key not in self.cache:
                self.misses += 1
                return None

            value, expiry = self.cache[key]

            # Check if expired
            if expiry and time.time() > expiry:
                del self.cache[key]
                self.misses += 1
                return None

            # Move to end (most recently used)
            self.cache.move_to_end(key)
            self.hits += 1
            return value

    def set(self, key, value, ttl=None):
        """Set cache value with optional TTL (in seconds)"""
        with self.lock:
            expiry = time.time() + ttl if ttl else None

            if key in self.cache:
                # Update existing
                self.cache[key] = (value, expiry)
                self.cache.move_to_end(key)
            else:
                # Add new
                if len(self.cache) >= self.max_size:
                    # Remove least recently used
                    self.cache.popitem(last=False)
                self.cache[key] = (value, expiry)

    def invalidate(self, pattern=None):
        """Invalidate cache entries matching pattern (prefix match)"""
        with self.lock:
            if pattern is None:
                # Clear all
                self.cache.clear()
            else:
                # Remove entries with keys starting with pattern
                keys_to_delete = [k for k in self.cache.keys() if k.startswith(pattern)]
                for key in keys_to_delete:
                    del self.cache[key]

    def get_stats(self):
        """Get cache statistics"""
        with self.lock:
            total_requests = self.hits + self.misses
            hit_rate = (self.hits / total_requests * 100) if total_requests > 0 else 0
            return {
                'hits': self.hits,
                'misses': self.misses,
                'hit_rate': f'{hit_rate:.2f}%',
                'size': len(self.cache),
                'max_size': self.max_size
            }

# Global cache instance
app_cache = LRUCache(max_size=1000)

def cached(ttl=60, key_prefix=''):
    """
    Cache decorator with TTL support

    Args:
        ttl: Time-to-live in seconds (default: 60)
        key_prefix: Prefix for cache key (for easy invalidation)

    Usage:
        @cached(ttl=300, key_prefix='nav_counts')
        def get_nav_counts(username):
            return calculate_counts(username)
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key from function name and arguments
            key_parts = [key_prefix or func.__name__]

            # Add positional arguments
            for arg in args:
                if isinstance(arg, (str, int, float, bool)):
                    key_parts.append(str(arg))

            # Add keyword arguments
            for k, v in sorted(kwargs.items()):
                if isinstance(v, (str, int, float, bool)):
                    key_parts.append(f'{k}={v}')

            cache_key = ':'.join(key_parts)

            # Try to get from cache
            cached_value = app_cache.get(cache_key)
            if cached_value is not None:
                return cached_value

            # Cache miss - compute value
            result = func(*args, **kwargs)

            # Store in cache
            app_cache.set(cache_key, result, ttl=ttl)

            return result

        return wrapper
    return decorator

def invalidate_cache(pattern=None):
    """
    Invalidate cache entries matching pattern

    Args:
        pattern: Prefix to match (None = clear all)

    Examples:
        invalidate_cache('nav_counts')  # Clear all nav counts
        invalidate_cache('nav_counts:john')  # Clear specific user
        invalidate_cache()  # Clear entire cache
    """
    app_cache.invalidate(pattern)

def generate_etag(data):
    """
    Generate ETag hash for data

    Args:
        data: String or dict to hash

    Returns:
        ETag string (MD5 hash)
    """
    if isinstance(data, dict):
        data = json.dumps(data, sort_keys=True)
    elif not isinstance(data, str):
        data = str(data)

    return hashlib.md5(data.encode()).hexdigest()

def get_cache_stats():
    """Get current cache statistics"""
    return app_cache.get_stats()

# Cache invalidation triggers (to be called when data changes)

def on_task_modified(task_id=None, assigned_to=None):
    """Invalidate cache when task is modified"""
    if assigned_to:
        invalidate_cache(f'nav_counts:{assigned_to}')
    else:
        # If we don't know who, invalidate all nav_counts
        invalidate_cache('nav_counts')

def on_reminder_modified(user_id):
    """Invalidate cache when reminder is modified"""
    invalidate_cache(f'nav_counts:{user_id}')
    invalidate_cache(f'banner_check:{user_id}')
    invalidate_cache(f'reminders:{user_id}')

def on_chat_message(chat_id, participants):
    """Invalidate cache when chat message is sent"""
    # Invalidate nav counts for all participants
    for username in participants:
        invalidate_cache(f'nav_counts:{username}')
    # Invalidate chat list
    for username in participants:
        invalidate_cache(f'chats:{username}')

def on_promotion_modified():
    """Invalidate cache when promotion is modified"""
    invalidate_cache('promotions')
    invalidate_cache('promotion_filters')

def on_user_modified():
    """Invalidate cache when user data is modified"""
    invalidate_cache('teams')
    invalidate_cache('users')
