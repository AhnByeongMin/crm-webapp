#!/usr/bin/env python3
"""
Frontend Asset Build Script
Extracts and minifies CSS/JS from HTML templates
"""
import re
import os
import hashlib
from pathlib import Path

# Simple CSS minifier
def minify_css(css):
    """Remove comments, whitespace, and optimize CSS"""
    # Remove comments
    css = re.sub(r'/\*[\s\S]*?\*/', '', css)
    # Remove extra whitespace
    css = re.sub(r'\s+', ' ', css)
    # Remove space around special chars
    css = re.sub(r'\s*([{}:;,>+~])\s*', r'\1', css)
    # Remove trailing semicolons
    css = re.sub(r';}', '}', css)
    return css.strip()

# Simple JS minifier
def minify_js(js):
    """Remove comments and excessive whitespace from JS"""
    # Remove single-line comments (but preserve URLs)
    js = re.sub(r'(?<!:)//.*?$', '', js, flags=re.MULTILINE)
    # Remove multi-line comments
    js = re.sub(r'/\*[\s\S]*?\*/', '', js)
    # Remove extra whitespace (but keep necessary spacing)
    js = re.sub(r'\n\s*\n', '\n', js)
    js = re.sub(r'  +', ' ', js)
    return js.strip()

def extract_styles_from_html(html_path):
    """Extract all <style> blocks from HTML file"""
    with open(html_path, 'r', encoding='utf-8') as f:
        content = f.read()

    styles = re.findall(r'<style>(.*?)</style>', content, re.DOTALL)
    return '\n'.join(styles)

def extract_scripts_from_html(html_path):
    """Extract all inline <script> blocks from HTML file"""
    with open(html_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Only inline scripts, not src scripts
    scripts = re.findall(r'<script>(?!.*src=)(.*?)</script>', content, re.DOTALL)
    return '\n'.join(scripts)

def generate_file_hash(content):
    """Generate short hash for cache busting"""
    return hashlib.md5(content.encode()).hexdigest()[:8]

def build_common_css():
    """Build common CSS from all templates"""
    templates_dir = Path('/svc/was/crm/crm-webapp/templates')
    css_parts = []

    # Common CSS patterns found in all files
    common_css = """
    /* Reset & Base */
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        background: #f5f5f5;
        line-height: 1.6;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }

    /* Buttons */
    button, .btn {
        padding: 10px 20px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
    }
    button:hover, .btn:hover { background: #0056b3; }
    button.delete { background: #dc3545; }
    button.delete:hover { background: #c82333; }
    button.edit { background: #28a745; }
    button.edit:hover { background: #218838; }
    button.secondary { background: #6c757d; }
    button.secondary:hover { background: #5a6268; }

    /* Forms */
    .form-group { margin-bottom: 15px; }
    label { display: block; margin-bottom: 5px; font-weight: bold; color: #555; }
    input, textarea, select {
        width: 100%;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
    }
    textarea { min-height: 80px; resize: vertical; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; margin-top: 20px; background: white; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f8f9fa; font-weight: bold; color: #333; }
    tr:hover { background: #f8f9fa; }

    /* Toast Notifications */
    .toast-container {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-width: 350px;
    }
    .toast {
        background: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        cursor: pointer;
        transform: translateX(400px);
        animation: slideIn 0.3s forwards;
        border-left: 4px solid #667eea;
        display: flex;
        align-items: center;
        gap: 12px;
    }
    .toast:hover {
        box-shadow: 0 6px 16px rgba(0,0,0,0.4);
        transform: translateY(-2px);
    }
    .toast.slide-out { animation: slideOut 0.3s forwards; }
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }

    /* Banner */
    #reminderBanner {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 12px 20px;
        text-align: center;
        font-weight: 500;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        z-index: 1000;
        display: none;
        cursor: pointer;
        transition: all 0.3s ease;
    }
    #reminderBanner.show {
        display: block;
        animation: slideDown 0.3s ease-out;
    }
    #reminderBanner:hover {
        background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
    body.has-banner { padding-top: 48px; }
    @keyframes slideDown {
        from { transform: translateY(-100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }

    /* Header */
    header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 15px 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        position: sticky;
        top: 0;
        z-index: 999;
    }
    nav {
        display: flex;
        justify-content: space-between;
        align-items: center;
        max-width: 1200px;
        margin: 0 auto;
    }
    nav a {
        color: white;
        text-decoration: none;
        padding: 8px 16px;
        border-radius: 4px;
        transition: background 0.2s;
        position: relative;
    }
    nav a:hover { background: rgba(255,255,255,0.2); }
    .badge {
        background: #dc3545;
        color: white;
        border-radius: 10px;
        padding: 2px 6px;
        font-size: 11px;
        font-weight: bold;
        position: absolute;
        top: 0;
        right: 0;
        min-width: 18px;
        text-align: center;
    }

    /* Utility */
    .hidden { display: none !important; }
    .text-center { text-align: center; }
    .mt-20 { margin-top: 20px; }
    .mb-20 { margin-bottom: 20px; }
    """

    minified = minify_css(common_css)
    output_path = Path('/svc/was/crm/crm-webapp/static/css/common.min.css')
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(minified)

    file_hash = generate_file_hash(minified)
    print(f"✓ Built common.min.css ({len(minified)} bytes, hash: {file_hash})")
    return file_hash

def build_page_specific_css():
    """Build page-specific CSS bundles"""
    templates_dir = Path('/svc/was/crm/crm-webapp/templates')
    hashes = {}

    # Pages with significant custom CSS
    pages = {
        'admin': 'admin.html',
        'promotions': 'promotions.html',
        'chat': 'chat_room.html',
        'reminders': 'reminders.html',
    }

    for name, filename in pages.items():
        html_path = templates_dir / filename
        if not html_path.exists():
            continue

        css = extract_styles_from_html(html_path)
        minified = minify_css(css)

        output_path = Path(f'/svc/was/crm/crm-webapp/static/css/{name}.min.css')
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(minified)

        file_hash = generate_file_hash(minified)
        hashes[name] = file_hash
        print(f"✓ Built {name}.min.css ({len(minified)} bytes, hash: {file_hash})")

    return hashes

def main():
    print("🔨 Building frontend assets...")
    print()

    # Build CSS
    print("📦 Building CSS...")
    common_hash = build_common_css()
    page_hashes = build_page_specific_css()
    print()

    # Generate version manifest
    manifest = {
        'common_css': common_hash,
        **page_hashes
    }

    manifest_path = Path('/svc/was/crm/crm-webapp/static/asset_manifest.json')
    import json
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)

    print(f"✓ Asset manifest generated: {manifest_path}")
    print()
    print("✅ Build complete!")

if __name__ == '__main__':
    main()
