-- PostgreSQL Schema for CRM Database

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    team TEXT,
    password TEXT,
    role TEXT DEFAULT '상담사',
    status TEXT DEFAULT 'active'
);

-- Chats table
CREATE TABLE chats (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    creator TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL
);

-- Chat participants table
CREATE TABLE chat_participants (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    UNIQUE(chat_id, username)
);

-- Messages table
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    file_path TEXT,
    file_name TEXT,
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

-- Message reads table
CREATE TABLE message_reads (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    UNIQUE(message_id, username)
);

-- Promotions table
CREATE TABLE promotions (
    id SERIAL PRIMARY KEY,
    category TEXT NOT NULL,
    product_name TEXT NOT NULL,
    channel TEXT NOT NULL,
    promotion_name TEXT NOT NULL,
    promotion_code TEXT,
    content TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    created_by TEXT NOT NULL,
    discount_amount TEXT,
    session_exemption TEXT
);

-- Promotion subscription types table
CREATE TABLE promotion_subscription_types (
    id SERIAL PRIMARY KEY,
    promotion_id INTEGER NOT NULL,
    subscription_type TEXT NOT NULL,
    FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE
);

-- Tasks table
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    assigned_to TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    status TEXT NOT NULL DEFAULT '대기중',
    assigned_at TIMESTAMP,
    updated_at TIMESTAMP,
    completed_at TIMESTAMP,
    team TEXT
);

-- Reminders table
CREATE TABLE reminders (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    scheduled_date TEXT NOT NULL,
    scheduled_time TEXT NOT NULL,
    is_completed INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notified_30min INTEGER DEFAULT 0
);

-- Create indexes
CREATE INDEX idx_messages_chat ON messages(chat_id);
CREATE INDEX idx_promotions_dates ON promotions(start_date, end_date);
CREATE INDEX idx_chat_participants ON chat_participants(chat_id);
CREATE INDEX idx_message_reads_message ON message_reads(message_id);
CREATE INDEX idx_promotions_category ON promotions(category);
CREATE INDEX idx_promotions_channel ON promotions(channel);
CREATE INDEX idx_messages_timestamp ON messages(timestamp);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_users_team ON users(team);
CREATE INDEX idx_tasks_team ON tasks(team);
CREATE INDEX idx_reminders_user ON reminders(user_id);
CREATE INDEX idx_reminders_date ON reminders(scheduled_date);
CREATE INDEX idx_reminders_completed ON reminders(is_completed);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
