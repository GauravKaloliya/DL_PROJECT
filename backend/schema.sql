-- C.O.G.N.I.T. Database Schema
-- Version: 3.1.0
-- Description: SQLite database schema for the C.O.G.N.I.T. research platform
-- This schema includes enhanced security features and comprehensive indexing

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA temp_store = MEMORY;
PRAGMA encoding = "UTF-8";

-- Create participants table with enhanced constraints
CREATE TABLE IF NOT EXISTS participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id TEXT UNIQUE NOT NULL CHECK(LENGTH(participant_id) <= 100),
    session_id TEXT NOT NULL CHECK(LENGTH(session_id) <= 100),
    username TEXT NOT NULL CHECK(LENGTH(username) <= 100),
    email TEXT CHECK(LENGTH(email) <= 255),
    phone TEXT CHECK(LENGTH(phone) <= 30),
    gender TEXT CHECK(LENGTH(gender) <= 50),
    age INTEGER CHECK(age BETWEEN 1 AND 120),
    place TEXT CHECK(LENGTH(place) <= 100),
    native_language TEXT CHECK(LENGTH(native_language) <= 50),
    prior_experience TEXT CHECK(LENGTH(prior_experience) <= 100),
    consent_given BOOLEAN DEFAULT 0,
    consent_timestamp TIMESTAMP,
    ip_hash TEXT CHECK(LENGTH(ip_hash) = 64), -- SHA-256 hash length
    user_agent TEXT CHECK(LENGTH(user_agent) <= 500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_email CHECK (
        email IS NULL OR 
        email GLOB '*@*' AND 
        LENGTH(email) - LENGTH(REPLACE(email, '@', '')) = 1
    )
);

-- Create submissions table with foreign key constraints
CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id TEXT NOT NULL CHECK(LENGTH(participant_id) <= 100),
    session_id TEXT NOT NULL CHECK(LENGTH(session_id) <= 100),
    image_id TEXT NOT NULL CHECK(LENGTH(image_id) <= 200),
    image_url TEXT CHECK(LENGTH(image_url) <= 500),
    description TEXT NOT NULL CHECK(LENGTH(description) <= 10000),
    word_count INTEGER CHECK(word_count >= 0),
    rating INTEGER CHECK(rating BETWEEN 1 AND 10),
    feedback TEXT CHECK(LENGTH(feedback) <= 2000),
    time_spent_seconds REAL CHECK(time_spent_seconds >= 0),
    is_survey BOOLEAN DEFAULT 0,
    is_attention BOOLEAN DEFAULT 0,
    attention_passed BOOLEAN,
    too_fast_flag BOOLEAN DEFAULT 0,
    user_agent TEXT CHECK(LENGTH(user_agent) <= 500),
    ip_hash TEXT CHECK(LENGTH(ip_hash) = 64), -- SHA-256 hash length
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (participant_id) REFERENCES participants (participant_id) ON DELETE CASCADE,
    CONSTRAINT valid_word_count CHECK(word_count >= 0 AND word_count <= 10000)
);

-- Create consent records table
CREATE TABLE IF NOT EXISTS consent_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id TEXT UNIQUE NOT NULL CHECK(LENGTH(participant_id) <= 100),
    consent_given BOOLEAN DEFAULT 0,
    consent_timestamp TIMESTAMP,
    ip_hash TEXT CHECK(LENGTH(ip_hash) = 64), -- SHA-256 hash length
    user_agent TEXT CHECK(LENGTH(user_agent) <= 500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (participant_id) REFERENCES participants (participant_id) ON DELETE CASCADE
);

-- Create audit log table for security tracking
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    event_type TEXT NOT NULL CHECK(LENGTH(event_type) <= 50),
    user_id TEXT CHECK(LENGTH(user_id) <= 100),
    participant_id TEXT CHECK(LENGTH(participant_id) <= 100),
    endpoint TEXT CHECK(LENGTH(endpoint) <= 100),
    method TEXT CHECK(LENGTH(method) <= 10),
    status_code INTEGER,
    ip_hash TEXT CHECK(LENGTH(ip_hash) = 64),
    user_agent TEXT CHECK(LENGTH(user_agent) <= 500),
    details TEXT CHECK(LENGTH(details) <= 2000)
);

-- Create performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    endpoint TEXT NOT NULL CHECK(LENGTH(endpoint) <= 100),
    response_time_ms INTEGER CHECK(response_time_ms >= 0),
    status_code INTEGER,
    request_size_bytes INTEGER CHECK(request_size_bytes >= 0),
    response_size_bytes INTEGER CHECK(response_size_bytes >= 0)
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_participants_id ON participants(participant_id);
CREATE INDEX IF NOT EXISTS idx_participants_session ON participants(session_id);
CREATE INDEX IF NOT EXISTS idx_participants_created ON participants(created_at);
CREATE INDEX IF NOT EXISTS idx_participants_consent ON participants(consent_given);

CREATE INDEX IF NOT EXISTS idx_submissions_participant ON submissions(participant_id);
CREATE INDEX IF NOT EXISTS idx_submissions_session ON submissions(session_id);
CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions(created_at);
CREATE INDEX IF NOT EXISTS idx_submissions_image ON submissions(image_id);
CREATE INDEX IF NOT EXISTS idx_submissions_survey ON submissions(is_survey);
CREATE INDEX IF NOT EXISTS idx_submissions_attention ON submissions(is_attention);

CREATE INDEX IF NOT EXISTS idx_consent_participant ON consent_records(participant_id);
CREATE INDEX IF NOT EXISTS idx_consent_timestamp ON consent_records(consent_timestamp);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_participant ON audit_log(participant_id);
CREATE INDEX IF NOT EXISTS idx_audit_endpoint ON audit_log(endpoint);

CREATE INDEX IF NOT EXISTS idx_performance_timestamp ON performance_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_performance_endpoint ON performance_metrics(endpoint);

-- Create triggers for automatic audit logging
CREATE TRIGGER IF NOT EXISTS trg_participant_insert_audit
AFTER INSERT ON participants
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (timestamp, event_type, participant_id, endpoint, method, status_code, ip_hash, user_agent, details)
    VALUES (CURRENT_TIMESTAMP, 'participant_created', NEW.participant_id, '/api/participants', 'POST', 201, NEW.ip_hash, NEW.user_agent, 'New participant created');
END;

CREATE TRIGGER IF NOT EXISTS trg_consent_insert_audit
AFTER INSERT ON consent_records
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (timestamp, event_type, participant_id, endpoint, method, status_code, ip_hash, user_agent, details)
    VALUES (CURRENT_TIMESTAMP, 'consent_recorded', NEW.participant_id, '/api/consent', 'POST', 200, NEW.ip_hash, NEW.user_agent, 'Consent recorded for participant');
END;

CREATE TRIGGER IF NOT EXISTS trg_submission_insert_audit
AFTER INSERT ON submissions
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (timestamp, event_type, participant_id, endpoint, method, status_code, ip_hash, user_agent, details)
    VALUES (CURRENT_TIMESTAMP, 'submission_created', NEW.participant_id, '/api/submit', 'POST', 200, NEW.ip_hash, NEW.user_agent, 'New submission created for image: ' || NEW.image_id);
END;

-- Create views for common queries
CREATE VIEW IF NOT EXISTS vw_participant_summary AS
SELECT 
    p.participant_id,
    p.username,
    p.email,
    p.age,
    p.gender,
    p.place,
    p.native_language,
    p.prior_experience,
    p.consent_given,
    COUNT(s.id) AS submission_count,
    AVG(s.word_count) AS avg_word_count,
    MAX(s.created_at) AS last_submission_time
FROM participants p
LEFT JOIN submissions s ON p.participant_id = s.participant_id
GROUP BY p.participant_id;

CREATE VIEW IF NOT EXISTS vw_submission_stats AS
SELECT 
    participant_id,
    COUNT(*) AS total_submissions,
    SUM(CASE WHEN is_survey = 1 THEN 1 ELSE 0 END) AS survey_count,
    SUM(CASE WHEN is_attention = 1 THEN 1 ELSE 0 END) AS attention_count,
    SUM(CASE WHEN attention_passed = 1 THEN 1 ELSE 0 END) AS attention_passed_count,
    AVG(word_count) AS avg_word_count,
    AVG(rating) AS avg_rating,
    AVG(time_spent_seconds) AS avg_time_seconds
FROM submissions
GROUP BY participant_id;

-- Database metadata
CREATE TABLE IF NOT EXISTS database_metadata (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial metadata
INSERT OR IGNORE INTO database_metadata (key, value) VALUES 
    ('version', '3.1.0'),
    ('schema_updated', CURRENT_TIMESTAMP),
    ('description', 'C.O.G.N.I.T. Research Platform Database');

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Vacuum and optimize the database
-- Note: Run these commands periodically for maintenance
-- PRAGMA optimize;
-- VACUUM;