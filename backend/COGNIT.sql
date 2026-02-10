-- COGNIT Admin Database Schema
-- This file contains the database schema for admin user management

-- Create admin users table
CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email TEXT UNIQUE,
    role TEXT DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT 1
);

-- Create admin sessions table
CREATE TABLE IF NOT EXISTS admin_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES admin_users (id)
);

-- Create admin audit log table
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    details TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    FOREIGN KEY (user_id) REFERENCES admin_users (id)
);

-- Insert default admin user (for development only)
-- Password: admin123 (hashed with SHA-256)
-- WARNING: In production, use proper password hashing and never store plaintext passwords
INSERT OR IGNORE INTO admin_users (username, password_hash, email, role) VALUES 
('admin', 'a9046c73e00331af68917d3804f70655a8275d5b3c21cf2163b771a01fba0e5f', 'admin@cognit.local', 'superadmin');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user_id ON admin_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_user_id ON admin_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_timestamp ON admin_audit_log(timestamp);