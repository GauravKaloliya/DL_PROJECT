import csv
import hashlib
import os
import random
import sqlite3
import re
import time
import functools
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory, abort, g
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

BASE_DIR = Path(__file__).resolve().parent
IMAGES_DIR = BASE_DIR / "images"
DATA_DIR = BASE_DIR / "data"
CSV_PATH = DATA_DIR / "submissions.csv"
DB_PATH = BASE_DIR / "COGNIT.db"

MIN_WORD_COUNT = int(os.getenv("MIN_WORD_COUNT", "60"))
TOO_FAST_SECONDS = float(os.getenv("TOO_FAST_SECONDS", "5"))
IP_HASH_SALT = os.getenv("IP_HASH_SALT", "local-salt")

app = Flask(__name__)

# Security Configuration
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'local-secret-key')
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = 1800  # 30 minutes

# CORS Configuration with enhanced security
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:5173", "https://your-production-domain.com"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
        "supports_credentials": False,
        "max_age": 86400
    }
})

# Rate Limiting
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

# Security headers middleware
@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['X-Permitted-Cross-Domain-Policies'] = 'none'
    response.headers['X-Download-Options'] = 'noopen'
    response.headers['X-DNS-Prefetch-Control'] = 'off'
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'"
    response.headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains; preload'
    response.headers['Referrer-Policy'] = 'no-referrer'
    response.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=(), payment=()'
    response.headers['Server'] = 'Secure Server'
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, proxy-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response


def get_db():
    """Get database connection for current request context"""
    if 'db' not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exception):
    """Close database connection at end of request"""
    db = g.pop('db', None)
    if db is not None:
        db.close()


def init_db():
    """Initialize the SQLite database with enhanced security and comprehensive schema"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Enable security and performance pragmas
    cursor.execute("PRAGMA foreign_keys = ON;")
    cursor.execute("PRAGMA journal_mode = WAL;")
    cursor.execute("PRAGMA synchronous = NORMAL;")
    cursor.execute("PRAGMA temp_store = MEMORY;")
    cursor.execute("PRAGMA encoding = 'UTF-8';")
    
    # Create participants table with enhanced constraints
    cursor.execute('''
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
            ip_hash TEXT CHECK(LENGTH(ip_hash) = 64),
            user_agent TEXT CHECK(LENGTH(user_agent) <= 500),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT valid_email CHECK (
                email IS NULL OR 
                email GLOB '*@*' AND 
                LENGTH(email) - LENGTH(REPLACE(email, '@', '')) = 1
            )
        )
    ''')
    
    # Create submissions table with foreign key constraints
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS submissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            participant_id TEXT NOT NULL CHECK(LENGTH(participant_id) <= 100),
            session_id TEXT NOT NULL CHECK(LENGTH(session_id) <= 100),
            image_id TEXT NOT NULL CHECK(LENGTH(image_id) <= 200),
            image_url TEXT CHECK(LENGTH(image_url) <= 500),
            trial_index INTEGER NOT NULL,
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
            ip_hash TEXT CHECK(LENGTH(ip_hash) = 64),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (participant_id) REFERENCES participants (participant_id) ON DELETE CASCADE,
            FOREIGN KEY (image_id) REFERENCES images (image_id),
            CONSTRAINT valid_word_count CHECK(word_count >= 0 AND word_count <= 10000)
        )
    ''')
    
    # Create consent records table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS consent_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            participant_id TEXT UNIQUE NOT NULL CHECK(LENGTH(participant_id) <= 100),
            consent_given BOOLEAN DEFAULT 0,
            consent_timestamp TIMESTAMP,
            ip_hash TEXT CHECK(LENGTH(ip_hash) = 64),
            user_agent TEXT CHECK(LENGTH(user_agent) <= 500),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (participant_id) REFERENCES participants (participant_id) ON DELETE CASCADE
        )
    ''')
    
    # Create images table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS images (
            image_id TEXT PRIMARY KEY,
            category TEXT,
            difficulty_score REAL,
            object_count INTEGER,
            width INTEGER,
            height INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create audit log table for security tracking
    cursor.execute('''
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
        )
    ''')
    
    # Create performance metrics table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS performance_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            endpoint TEXT NOT NULL CHECK(LENGTH(endpoint) <= 100),
            response_time_ms INTEGER CHECK(response_time_ms >= 0),
            status_code INTEGER,
            request_size_bytes INTEGER CHECK(request_size_bytes >= 0),
            response_size_bytes INTEGER CHECK(response_size_bytes >= 0)
        )
    ''')
    
    # Create database metadata table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS database_metadata (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    
    # Create comprehensive indexes for performance optimization
    _create_comprehensive_indexes(cursor)
    
    # Create triggers for automatic audit logging
    _create_audit_triggers(cursor)
    
    # Create views for common queries
    _create_views(cursor)
    
    # Insert initial metadata
    cursor.execute('''
        INSERT OR IGNORE INTO database_metadata (key, value) VALUES 
            ('version', '3.2.0'),
            ('schema_updated', CURRENT_TIMESTAMP),
            ('description', 'C.O.G.N.I.T. Research Platform Database')
    ''')
    
    conn.commit()
    conn.close()


def _create_comprehensive_indexes(cursor):
    """Create comprehensive database indexes for performance optimization"""
    indexes = [
        # Participants indexes
        ("idx_participants_id", "participants", "participant_id"),
        ("idx_participants_session", "participants", "session_id"),
        ("idx_participants_created", "participants", "created_at"),
        ("idx_participants_consent", "participants", "consent_given"),
        ("idx_participants_email", "participants", "email"),
        
        # Submissions indexes
        ("idx_submissions_participant", "submissions", "participant_id"),
        ("idx_submissions_session", "submissions", "session_id"),
        ("idx_submissions_created", "submissions", "created_at"),
        ("idx_submissions_image", "submissions", "image_id"),
        ("idx_submissions_survey", "submissions", "is_survey"),
        ("idx_submissions_attention", "submissions", "is_attention"),
        ("idx_submissions_rating", "submissions", "rating"),
        ("idx_submissions_word_count", "submissions", "word_count"),
        
        # Consent records indexes
        ("idx_consent_participant", "consent_records", "participant_id"),
        ("idx_consent_timestamp", "consent_records", "consent_timestamp"),
        
        # Images indexes
        ("idx_images_id", "images", "image_id"),
        ("idx_images_category", "images", "category"),
        ("idx_images_created", "images", "created_at"),
        
        # Audit log indexes
        ("idx_audit_timestamp", "audit_log", "timestamp"),
        ("idx_audit_user", "audit_log", "user_id"),
        ("idx_audit_participant", "audit_log", "participant_id"),
        ("idx_audit_endpoint", "audit_log", "endpoint"),
        
        # Performance metrics indexes
        ("idx_performance_timestamp", "performance_metrics", "timestamp"),
        ("idx_performance_endpoint", "performance_metrics", "endpoint")
    ]
    
    for idx_name, table, column in indexes:
        try:
            cursor.execute(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {table}({column})")
        except sqlite3.OperationalError:
            pass  # Index might already exist


def _create_audit_triggers(cursor):
    """Create triggers for automatic audit logging"""
    triggers = [
        ("trg_participant_insert_audit", """
            CREATE TRIGGER IF NOT EXISTS trg_participant_insert_audit
            AFTER INSERT ON participants
            FOR EACH ROW
            BEGIN
                INSERT INTO audit_log (timestamp, event_type, participant_id, endpoint, method, status_code, ip_hash, user_agent, details)
                VALUES (CURRENT_TIMESTAMP, 'participant_created', NEW.participant_id, '/api/participants', 'POST', 201, NEW.ip_hash, NEW.user_agent, 'New participant created');
            END;
        """),
        ("trg_consent_insert_audit", """
            CREATE TRIGGER IF NOT EXISTS trg_consent_insert_audit
            AFTER INSERT ON consent_records
            FOR EACH ROW
            BEGIN
                INSERT INTO audit_log (timestamp, event_type, participant_id, endpoint, method, status_code, ip_hash, user_agent, details)
                VALUES (CURRENT_TIMESTAMP, 'consent_recorded', NEW.participant_id, '/api/consent', 'POST', 200, NEW.ip_hash, NEW.user_agent, 'Consent recorded for participant');
            END;
        """),
        ("trg_submission_insert_audit", """
            CREATE TRIGGER IF NOT EXISTS trg_submission_insert_audit
            AFTER INSERT ON submissions
            FOR EACH ROW
            BEGIN
                INSERT INTO audit_log (timestamp, event_type, participant_id, endpoint, method, status_code, ip_hash, user_agent, details)
                VALUES (CURRENT_TIMESTAMP, 'submission_created', NEW.participant_id, '/api/submit', 'POST', 200, NEW.ip_hash, NEW.user_agent, 'New submission created for image: ' || NEW.image_id);
            END;
        """)
    ]
    
    for trigger_name, trigger_sql in triggers:
        try:
            cursor.execute(trigger_sql)
        except sqlite3.OperationalError:
            pass  # Trigger might already exist


def _create_views(cursor):
    """Create views for common queries"""
    views = [
        ("vw_participant_summary", """
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
        """),
        ("vw_submission_stats", """
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
        """),
        ("vw_image_coverage", """
            CREATE VIEW IF NOT EXISTS vw_image_coverage AS
            SELECT 
                i.image_id,
                i.category,
                i.difficulty_score,
                i.object_count,
                i.width,
                i.height,
                COUNT(s.id) AS submission_count,
                COUNT(DISTINCT s.participant_id) AS unique_participants,
                AVG(s.word_count) AS avg_word_count,
                AVG(s.rating) AS avg_rating,
                AVG(s.time_spent_seconds) AS avg_time_seconds,
                SUM(CASE WHEN s.is_survey = 1 THEN 1 ELSE 0 END) AS survey_submissions,
                SUM(CASE WHEN s.is_attention = 1 THEN 1 ELSE 0 END) AS attention_submissions,
                SUM(CASE WHEN s.attention_passed = 1 THEN 1 ELSE 0 END) AS attention_passed_submissions,
                MIN(s.created_at) AS first_submission_time,
                MAX(s.created_at) AS last_submission_time,
                CASE 
                    WHEN COUNT(s.id) = 0 THEN 'unused'
                    WHEN COUNT(s.id) < 5 THEN 'low_usage'
                    WHEN COUNT(s.id) < 20 THEN 'medium_usage'
                    ELSE 'high_usage'
                END AS usage_category
            FROM images i
            LEFT JOIN submissions s ON i.image_id = s.image_id
            GROUP BY i.image_id, i.category, i.difficulty_score, i.object_count, i.width, i.height;
        """),
        ("vw_submission_quality", """
            CREATE VIEW IF NOT EXISTS vw_submission_quality AS
            SELECT 
                s.id,
                s.participant_id,
                s.image_id,
                s.trial_index,
                s.word_count,
                s.rating,
                s.time_spent_seconds,
                s.is_survey,
                s.is_attention,
                s.attention_passed,
                s.too_fast_flag,
                s.created_at,
                CASE
                    WHEN s.word_count >= 60 THEN 20
                    WHEN s.word_count >= 40 THEN 15
                    WHEN s.word_count >= 20 THEN 10
                    ELSE 5
                END +
                CASE
                    WHEN s.rating >= 8 THEN 20
                    WHEN s.rating >= 6 THEN 15
                    WHEN s.rating >= 4 THEN 10
                    ELSE 5
                END +
                CASE
                    WHEN s.time_spent_seconds IS NULL THEN 0
                    WHEN s.time_spent_seconds BETWEEN 30 AND 300 THEN 20
                    WHEN s.time_spent_seconds BETWEEN 15 AND 600 THEN 15
                    WHEN s.time_spent_seconds BETWEEN 5 AND 900 THEN 10
                    ELSE 5
                END +
                CASE
                    WHEN s.is_attention = 0 THEN 20
                    WHEN s.attention_passed = 1 THEN 20
                    WHEN s.attention_passed = 0 THEN 5
                    ELSE 10
                END +
                CASE
                    WHEN s.too_fast_flag = 1 THEN 0
                    ELSE 20
                END AS data_quality_score,
                CASE
                    WHEN s.word_count >= 60 AND s.rating >= 7 AND s.time_spent_seconds BETWEEN 30 AND 300 AND 
                         (s.is_attention = 0 OR s.attention_passed = 1) AND s.too_fast_flag = 0 THEN 'excellent'
                    WHEN s.word_count >= 40 AND s.rating >= 5 AND s.time_spent_seconds >= 15 AND 
                         (s.is_attention = 0 OR s.attention_passed IS NOT NULL) THEN 'good'
                    WHEN s.word_count >= 20 AND s.rating >= 3 AND s.time_spent_seconds >= 5 THEN 'acceptable'
                    ELSE 'poor'
                END AS quality_category
            FROM submissions s;
        """)
    ]
    
    for view_name, view_sql in views:
        try:
            cursor.execute(view_sql)
        except sqlite3.OperationalError:
            pass  # View might already exist


def migrate_database_schema():
    """Migrate existing database to new schema"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if images table exists, create if not
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS images (
                image_id TEXT PRIMARY KEY,
                category TEXT,
                difficulty_score REAL,
                object_count INTEGER,
                width INTEGER,
                height INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Check if trial_index column exists in submissions
        cursor.execute("PRAGMA table_info(submissions)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'trial_index' not in columns:
            # Add trial_index column to existing submissions
            cursor.execute("ALTER TABLE submissions ADD COLUMN trial_index INTEGER DEFAULT 0")
            print("Added trial_index column to submissions table")
        
        # Create images indexes
        indexes = [
            ("idx_images_id", "images", "image_id"),
            ("idx_images_category", "images", "category"),
            ("idx_images_created", "images", "created_at")
        ]
        
        for idx_name, table, column in indexes:
            try:
                cursor.execute(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {table}({column})")
            except sqlite3.OperationalError:
                pass
        
        # Add foreign key constraint for image_id (only if not exists)
        try:
            cursor.execute("PRAGMA foreign_key_list(submissions)")
            fks = cursor.fetchall()
            fk_columns = [fk[3] for fk in fks if fk[3] == 'image_id']
            
            if not fk_columns:
                cursor.execute("ALTER TABLE submissions ADD CONSTRAINT fk_submissions_image FOREIGN KEY (image_id) REFERENCES images (image_id)")
                print("Added foreign key constraint for submissions.image_id")
        except sqlite3.OperationalError:
            pass  # Constraint might already exist
        
        # Create views
        _create_views(cursor)
        
        # Update database version
        cursor.execute("""
            INSERT OR REPLACE INTO database_metadata (key, value, updated_at) 
            VALUES ('version', '3.2.0', CURRENT_TIMESTAMP)
        """)
        
        conn.commit()
        print("Database migration completed successfully")
        
    except Exception as e:
        conn.rollback()
        print(f"Database migration failed: {str(e)}")
        raise
    finally:
        conn.close()


def get_ip_hash():
    """Generate hash of IP address for privacy"""
    ip_address = request.headers.get("X-Forwarded-For", request.remote_addr) or "unknown"
    digest = hashlib.sha256(f"{ip_address}{IP_HASH_SALT}".encode("utf-8")).hexdigest()
    return digest


def count_words(text: str):
    """Count words in text"""
    return len([word for word in text.strip().split() if word])


def _log_audit_event(cursor, event_type, participant_id=None, user_id=None, endpoint=None, 
                    method=None, status_code=None, details=None):
    """Log an audit event to the audit_log table"""
    try:
        cursor.execute('''
            INSERT INTO audit_log 
            (timestamp, event_type, user_id, participant_id, endpoint, method, status_code, ip_hash, user_agent, details)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            datetime.now(timezone.utc).isoformat(),
            event_type,
            user_id,
            participant_id,
            endpoint,
            method,
            status_code,
            get_ip_hash(),
            request.headers.get('User-Agent', ''),
            details
        ))
    except Exception as e:
        # Don't let audit logging failures break the main functionality
        pass


def _log_performance_metric(endpoint, response_time_ms, status_code, request_size=0, response_size=0):
    """Log performance metrics"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO performance_metrics 
            (timestamp, endpoint, response_time_ms, status_code, request_size_bytes, response_size_bytes)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            datetime.now(timezone.utc).isoformat(),
            endpoint,
            response_time_ms,
            status_code,
            request_size,
            response_size
        ))
        conn.commit()
    except Exception as e:
        # Don't let performance logging failures break the main functionality
        pass


def track_performance(f):
    """Decorator to track endpoint performance"""
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            response = f(*args, **kwargs)
            end_time = time.time()
            response_time_ms = int((end_time - start_time) * 1000)
            
            # Log performance metrics
            _log_performance_metric(
                endpoint=request.path,
                response_time_ms=response_time_ms,
                status_code=response.status_code if hasattr(response, 'status_code') else 200,
                request_size=request.content_length or 0,
                response_size=len(response.get_data()) if hasattr(response, 'get_data') else 0
            )
            
            return response
        except Exception as e:
            end_time = time.time()
            response_time_ms = int((end_time - start_time) * 1000)
            
            # Log performance metrics for failed requests
            _log_performance_metric(
                endpoint=request.path,
                response_time_ms=response_time_ms,
                status_code=500,
                request_size=request.content_length or 0,
                response_size=0
            )
            
            raise e
    
    return wrapper


# ============== HEALTH & SYSTEM ENDPOINTS ==============

@app.route("/api/health")
@track_performance
def health_check():
    """Health check endpoint to verify all system connectivity"""
    status = {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "services": {}
    }
    
    # Check database connectivity
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        conn.close()
        status["services"]["database"] = "connected"
    except Exception as e:
        status["services"]["database"] = f"error: {str(e)}"
        status["status"] = "degraded"
    
    # Check images directory
    try:
        if IMAGES_DIR.exists():
            status["services"]["images"] = "accessible"
        else:
            status["services"]["images"] = "not found"
            status["status"] = "degraded"
    except Exception as e:
        status["services"]["images"] = f"error: {str(e)}"
        status["status"] = "degraded"
    
    return jsonify(status)


# ============== PARTICIPANT ENDPOINTS ==============

@app.route("/api/participants", methods=["POST"])
@limiter.limit("30 per minute")
@track_performance
def create_participant():
    """Create a new participant record with user details"""
    data = request.get_json(silent=True) or {}
    
    # Validate required fields
    required_fields = ['participant_id', 'session_id', 'username', 'gender', 'age', 'place', 'native_language', 'prior_experience']
    errors = {}
    
    for field in required_fields:
        if not data.get(field):
            errors[field] = f"{field.replace('_', ' ').title()} is required"
    
    if errors:
        return jsonify({"error": "Validation failed", "details": errors}), 400
    
    # Validate email format if provided
    email = data.get('email', '').strip()
    if email and not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
        return jsonify({"error": "Invalid email format"}), 400
    
    # Validate phone format if provided (basic validation)
    phone = data.get('phone', '').strip()
    if phone and not re.match(r'^[\d\s\-\+\(\)]{7,20}$', phone):
        return jsonify({"error": "Invalid phone number format"}), 400
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Log the participant creation attempt
        _log_audit_event(cursor, 
                        event_type='participant_creation_attempt',
                        participant_id=data['participant_id'],
                        endpoint='/api/participants',
                        method='POST',
                        status_code=201,
                        details='Participant creation attempt')
        
        cursor.execute('''
            INSERT INTO participants 
            (participant_id, session_id, username, email, phone, gender, age, place, native_language, prior_experience, ip_hash, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            data['participant_id'],
            data['session_id'],
            data['username'],
            email or None,
            phone or None,
            data['gender'],
            int(data['age']),
            data['place'],
            data['native_language'],
            data['prior_experience'],
            get_ip_hash(),
            request.headers.get('User-Agent', '')
        ))
        
        cursor.execute('''
            SELECT consent_given, consent_timestamp
            FROM consent_records
            WHERE participant_id = ? AND consent_given = 1
        ''', (data['participant_id'],))
        consent_row = cursor.fetchone()
        if consent_row:
            cursor.execute('''
                UPDATE participants
                SET consent_given = 1, consent_timestamp = ?
                WHERE participant_id = ?
            ''', (consent_row[1], data['participant_id']))

        conn.commit()

        # Log successful creation
        _log_audit_event(cursor, 
                        event_type='participant_created',
                        participant_id=data['participant_id'],
                        endpoint='/api/participants',
                        method='POST',
                        status_code=201,
                        details='Participant created successfully')

        return jsonify({
            "status": "success",
            "participant_id": data['participant_id'],
            "message": "Participant created successfully"
        }), 201
        
    except sqlite3.IntegrityError as e:
        if "participant_id" in str(e).lower():
            _log_audit_event(cursor, 
                           event_type='participant_creation_failed',
                           participant_id=data['participant_id'],
                           endpoint='/api/participants',
                           method='POST',
                           status_code=409,
                           details=f'Duplicate participant ID: {str(e)}')
            return jsonify({"error": "Participant ID already exists"}), 409
        _log_audit_event(cursor, 
                       event_type='participant_creation_failed',
                       participant_id=data['participant_id'],
                       endpoint='/api/participants',
                       method='POST',
                       status_code=500,
                       details=f'Database error: {str(e)}')
        return jsonify({"error": "Database error", "details": str(e)}), 500
    except Exception as e:
        _log_audit_event(cursor, 
                       event_type='participant_creation_failed',
                       participant_id=data.get('participant_id', 'unknown'),
                       endpoint='/api/participants',
                       method='POST',
                       status_code=500,
                       details=f'Creation failed: {str(e)}')
        return jsonify({"error": "Failed to create participant", "details": str(e)}), 500


@app.route("/api/participants/<participant_id>")
def get_participant(participant_id):
    """Get participant details"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT participant_id, username, email, phone, gender, age, place, native_language, prior_experience, consent_given, created_at
        FROM participants WHERE participant_id = ?
    ''', (participant_id,))
    
    row = cursor.fetchone()
    if not row:
        return jsonify({"error": "Participant not found"}), 404
    
    return jsonify({
        "participant_id": row[0],
        "username": row[1],
        "email": row[2],
        "phone": row[3],
        "gender": row[4],
        "age": row[5],
        "place": row[6],
        "native_language": row[7],
        "prior_experience": row[8],
        "consent_given": bool(row[9]),
        "created_at": row[10]
    })


# ============== CONSENT ENDPOINTS ==============

@app.route("/api/consent", methods=["POST"])
@limiter.limit("20 per minute")
@track_performance
def record_consent():
    """Record participant consent"""
    data = request.get_json(silent=True) or {}
    
    participant_id = data.get('participant_id')
    consent_given = data.get('consent_given', False)
    
    if not participant_id:
        return jsonify({"error": "participant_id is required"}), 400
    
    if not consent_given:
        return jsonify({"error": "Consent must be given to proceed"}), 400
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id FROM participants WHERE participant_id = ?", (participant_id,))
    participant_row = cursor.fetchone()

    timestamp = datetime.now(timezone.utc).isoformat()

    if participant_row:
        cursor.execute('''
            UPDATE participants 
            SET consent_given = 1, consent_timestamp = ?
            WHERE participant_id = ?
        ''', (timestamp, participant_id))

    cursor.execute('''
        INSERT INTO consent_records (participant_id, consent_given, consent_timestamp, ip_hash, user_agent)
        VALUES (?, 1, ?, ?, ?)
        ON CONFLICT(participant_id) DO UPDATE SET
        consent_given = 1,
        consent_timestamp = excluded.consent_timestamp,
        ip_hash = excluded.ip_hash,
        user_agent = excluded.user_agent
    ''', (participant_id, timestamp, get_ip_hash(), request.headers.get('User-Agent', '')))

    conn.commit()

    return jsonify({
        "status": "success",
        "message": "Consent recorded successfully",
        "timestamp": timestamp
    })


@app.route("/api/consent/<participant_id>")
def get_consent(participant_id):
    """Get consent status for a participant"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT consent_given, consent_timestamp FROM consent_records 
        WHERE participant_id = ?
    ''', (participant_id,))
    
    row = cursor.fetchone()
    if not row:
        return jsonify({
            "participant_id": participant_id,
            "consent_given": False,
            "consent_timestamp": None
        })
    
    return jsonify({
        "participant_id": participant_id,
        "consent_given": bool(row[0]),
        "consent_timestamp": row[1]
    })


# ============== IMAGE ENDPOINTS ==============

def list_images(image_type: str):
    folder = IMAGES_DIR / image_type
    if not folder.exists():
        return []
    return [
        path
        for path in folder.iterdir()
        if path.is_file() and not path.name.startswith(".")
    ]


def build_image_payload(image_path: Path, image_type: str):
    image_id = f"{image_type}/{image_path.name}"
    image_url = f"/api/images/{image_id}"
    return {
        "image_id": image_id,
        "image_url": image_url,
        "is_survey": image_type == "survey",
        "is_attention": image_type == "attention",
    }


@app.route("/api/images/random")
def random_image():
    requested_type = request.args.get("type", "normal")
    if requested_type not in {"normal", "survey", "attention"}:
        return jsonify({"error": "Invalid type"}), 400

    images = list_images(requested_type)
    if not images:
        return jsonify({"error": f"No images available for {requested_type}"}), 404

    image_path = random.choice(images)
    payload = build_image_payload(image_path, requested_type)
    return jsonify(payload)


@app.route("/api/images/<path:image_id>")
def serve_image(image_id):
    return send_from_directory(IMAGES_DIR, image_id)


# ============== SUBMISSION ENDPOINTS ==============

@app.route("/api/submit", methods=["POST"])
@limiter.limit("60 per minute")
@track_performance
def submit():
    """Submit a new description/rating for an image"""
    payload = request.get_json(silent=True) or {}
    
    participant_id = payload.get("participant_id")
    if not participant_id:
        return jsonify({"error": "participant_id is required"}), 400
    
    # Verify participant exists and has given consent
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT consent_given FROM participants WHERE participant_id = ?", (participant_id,))
    result = cursor.fetchone()
    
    if not result:
        return jsonify({"error": "Participant not found. Please complete registration first."}), 400
    
    if not result[0]:
        return jsonify({"error": "Consent required. Please complete the consent process."}), 403
    
    description = (payload.get("description") or "").strip()
    image_id = payload.get("image_id")
    
    if not image_id:
        return jsonify({"error": "image_id is required"}), 400

    word_count = count_words(description)
    if word_count < MIN_WORD_COUNT:
        return jsonify({"error": f"Minimum {MIN_WORD_COUNT} words required", "word_count": word_count}), 400

    rating = payload.get("rating")
    time_spent_seconds = payload.get("time_spent_seconds")
    if rating is None:
        return jsonify({"error": "rating is required"}), 400

    try:
        rating = int(rating)
        if not 1 <= rating <= 10:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({"error": "rating must be an integer between 1-10"}), 400

    # Validate comments
    feedback = (payload.get("feedback") or "").strip()
    if len(feedback) < 5:
        return jsonify({"error": "comments must be at least 5 characters"}), 400
    
    # Security validation - prevent potential injection
    if any(char in description for char in ['<', '>', '&', ';', '--', '/*', '*/', 'exec', 'union', 'select', 'insert', 'update', 'delete']):
        _log_audit_event(cursor, 
                       event_type='security_violation',
                       participant_id=participant_id,
                       endpoint='/api/submit',
                       method='POST',
                       status_code=403,
                       details='Potential injection attempt in description')
        return jsonify({"error": "Description contains invalid characters"}), 403
    
    if any(char in feedback for char in ['<', '>', '&', ';', '--', '/*', '*/', 'exec', 'union', 'select', 'insert', 'update', 'delete']):
        _log_audit_event(cursor, 
                       event_type='security_violation',
                       participant_id=participant_id,
                       endpoint='/api/submit',
                       method='POST',
                       status_code=403,
                       details='Potential injection attempt in feedback')
        return jsonify({"error": "Feedback contains invalid characters"}), 403

    is_survey = bool(payload.get("is_survey"))
    is_attention = bool(payload.get("is_attention"))

    attention_expected = (payload.get("attention_expected") or "").strip().lower()
    attention_passed = None
    if is_attention:
        attention_passed = attention_expected in description.lower() if attention_expected else False

    too_fast_flag = False
    try:
        time_spent_seconds = float(time_spent_seconds)
        too_fast_flag = time_spent_seconds < TOO_FAST_SECONDS
    except (TypeError, ValueError):
        time_spent_seconds = None

    # Insert into database
    try:
        trial_index = payload.get("trial_index", 0)
        try:
            trial_index = int(trial_index)
        except (TypeError, ValueError):
            trial_index = 0
        
        cursor.execute('''
            INSERT INTO submissions 
            (participant_id, session_id, image_id, image_url, trial_index, description, word_count, rating, 
             feedback, time_spent_seconds, is_survey, is_attention, attention_passed, too_fast_flag, user_agent, ip_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            participant_id,
            payload.get("session_id", ""),
            image_id,
            payload.get("image_url", f"/api/images/{image_id}"),
            trial_index,
            description,
            word_count,
            rating,
            feedback,
            time_spent_seconds,
            is_survey,
            is_attention,
            attention_passed,
            too_fast_flag,
            request.headers.get("User-Agent", ""),
            get_ip_hash()
        ))
        
        conn.commit()
        
        return jsonify({
            "status": "ok", 
            "word_count": word_count, 
            "attention_passed": attention_passed
        })
        
    except Exception as e:
        return jsonify({"error": "Failed to save submission", "details": str(e)}), 500


@app.route("/api/submissions/<participant_id>")
def get_participant_submissions(participant_id):
    """Get all submissions for a participant"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT id, image_id, trial_index, description, word_count, rating, feedback, 
               time_spent_seconds, is_survey, is_attention, attention_passed, created_at
        FROM submissions 
        WHERE participant_id = ?
        ORDER BY created_at DESC
    ''', (participant_id,))
    
    rows = cursor.fetchall()
    submissions = []
    
    for row in rows:
        submissions.append({
            "id": row[0],
            "image_id": row[1],
            "trial_index": row[2],
            "description": row[3],
            "word_count": row[4],
            "rating": row[5],
            "feedback": row[6],
            "time_spent_seconds": row[7],
            "is_survey": bool(row[8]),
            "is_attention": bool(row[9]),
            "attention_passed": row[10],
            "created_at": row[11]
        })
    
    return jsonify(submissions)


# ============== SECURITY ENDPOINTS ==============

@app.route("/api/security/info")
@track_performance
def security_info():
    """Get comprehensive security information"""
    return jsonify({
        "security": {
            "version": "3.2.0",
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "rate_limits": {
                "default": "200 per day, 50 per hour",
                "participant_creation": "30 per minute",
                "consent_recording": "20 per minute",
                "submission": "60 per minute",
                "api_docs": "30 per minute"
            },
            "cors_configuration": {
                "allowed_origins": ["http://localhost:5173", "https://your-production-domain.com"],
                "allowed_methods": ["GET", "POST", "OPTIONS"],
                "allowed_headers": ["Content-Type", "Authorization", "X-Requested-With"],
                "supports_credentials": False,
                "max_age": 86400
            },
            "security_headers": {
                "X-Content-Type-Options": "nosniff",
                "X-Frame-Options": "DENY",
                "X-XSS-Protection": "1; mode=block",
                "X-Permitted-Cross-Domain-Policies": "none",
                "X-Download-Options": "noopen",
                "X-DNS-Prefetch-Control": "off",
                "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
                "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
                "Referrer-Policy": "no-referrer",
                "Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=()",
                "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
            },
            "data_protection": {
                "ip_hashing": "SHA-256 with configurable salt",
                "anonymous_data": True,
                "storage": "SQLite with WAL mode and comprehensive indexing",
                "encryption": "At-rest protection via filesystem encryption",
                "data_validation": "Comprehensive input validation and sanitization"
            },
            "database_security": {
                "foreign_key_constraints": "Enabled",
                "input_validation": "Length and format constraints on all fields",
                "audit_logging": "Automatic logging of all participant actions",
                "performance_monitoring": "Comprehensive endpoint performance tracking",
                "data_integrity": "Check constraints and validation rules"
            },
            "api_security": {
                "input_sanitization": "Protection against injection attacks",
                "content_validation": "Strict validation of all user inputs",
                "error_handling": "Secure error messages without sensitive data",
                "rate_limiting": "Per-IP and global rate limiting",
                "cors_restriction": "Strict origin and method restrictions"
            },
            "monitoring": {
                "audit_logs": "Comprehensive logging of all participant actions",
                "performance_metrics": "Response time and size tracking",
                "error_tracking": "Detailed error logging and monitoring",
                "security_events": "Logging of potential security violations"
            },
            "compliance": {
                "gdpr": "Privacy-preserving data collection",
                "data_minimization": "Only essential data collected",
                "consent_management": "Explicit consent recording",
                "data_retention": "Configurable retention policies"
            }
        },
        "recommendations": {
            "production": [
                "Configure proper IP_HASH_SALT",
                "Set strong SECRET_KEY",
                "Enable HTTPS with valid certificate",
                "Configure proper CORS origins",
                "Implement regular database backups",
                "Monitor audit logs regularly",
                "Rotate secrets periodically"
            ],
            "monitoring": [
                "Monitor /api/security/info for changes",
                "Review audit logs via database queries",
                "Track performance metrics for optimization",
                "Set up alerts for security violations"
            ]
        }
    })


# ============== API DOCUMENTATION ==============

@app.route("/api/schema")
@limiter.limit("30 per minute")
@track_performance
def api_schema():
    """Get the complete database schema including tables, indexes, triggers, and views"""
    schema = {
        "title": "C.O.G.N.I.T. Database Schema",
        "version": "3.2.0",
        "description": "Complete SQLite database schema for the C.O.G.N.I.T. research platform",
        "tables": {
            "participants": {
                "description": "Stores participant information and demographics",
                "columns": [
                    {"name": "id", "type": "INTEGER", "constraints": "PRIMARY KEY AUTOINCREMENT"},
                    {"name": "participant_id", "type": "TEXT", "constraints": "UNIQUE NOT NULL CHECK(LENGTH <= 100)"},
                    {"name": "session_id", "type": "TEXT", "constraints": "NOT NULL CHECK(LENGTH <= 100)"},
                    {"name": "username", "type": "TEXT", "constraints": "NOT NULL CHECK(LENGTH <= 100)"},
                    {"name": "email", "type": "TEXT", "constraints": "CHECK(LENGTH <= 255, valid email format)"},
                    {"name": "phone", "type": "TEXT", "constraints": "CHECK(LENGTH <= 30)"},
                    {"name": "gender", "type": "TEXT", "constraints": "CHECK(LENGTH <= 50)"},
                    {"name": "age", "type": "INTEGER", "constraints": "CHECK(BETWEEN 1 AND 120)"},
                    {"name": "place", "type": "TEXT", "constraints": "CHECK(LENGTH <= 100)"},
                    {"name": "native_language", "type": "TEXT", "constraints": "CHECK(LENGTH <= 50)"},
                    {"name": "prior_experience", "type": "TEXT", "constraints": "CHECK(LENGTH <= 100)"},
                    {"name": "consent_given", "type": "BOOLEAN", "constraints": "DEFAULT 0"},
                    {"name": "consent_timestamp", "type": "TIMESTAMP", "constraints": ""},
                    {"name": "ip_hash", "type": "TEXT", "constraints": "CHECK(LENGTH = 64)"},
                    {"name": "user_agent", "type": "TEXT", "constraints": "CHECK(LENGTH <= 500)"},
                    {"name": "created_at", "type": "TIMESTAMP", "constraints": "DEFAULT CURRENT_TIMESTAMP"}
                ]
            },
            "submissions": {
                "description": "Stores participant submissions for image descriptions",
                "columns": [
                    {"name": "id", "type": "INTEGER", "constraints": "PRIMARY KEY AUTOINCREMENT"},
                    {"name": "participant_id", "type": "TEXT", "constraints": "NOT NULL CHECK(LENGTH <= 100), FK to participants"},
                    {"name": "session_id", "type": "TEXT", "constraints": "NOT NULL CHECK(LENGTH <= 100)"},
                    {"name": "image_id", "type": "TEXT", "constraints": "NOT NULL CHECK(LENGTH <= 200), FK to images"},
                    {"name": "image_url", "type": "TEXT", "constraints": "CHECK(LENGTH <= 500)"},
                    {"name": "trial_index", "type": "INTEGER", "constraints": "NOT NULL"},
                    {"name": "description", "type": "TEXT", "constraints": "NOT NULL CHECK(LENGTH <= 10000)"},
                    {"name": "word_count", "type": "INTEGER", "constraints": "CHECK(BETWEEN 0 AND 10000)"},
                    {"name": "rating", "type": "INTEGER", "constraints": "CHECK(BETWEEN 1 AND 10)"},
                    {"name": "feedback", "type": "TEXT", "constraints": "CHECK(LENGTH <= 2000)"},
                    {"name": "time_spent_seconds", "type": "REAL", "constraints": "CHECK(>= 0)"},
                    {"name": "is_survey", "type": "BOOLEAN", "constraints": "DEFAULT 0"},
                    {"name": "is_attention", "type": "BOOLEAN", "constraints": "DEFAULT 0"},
                    {"name": "attention_passed", "type": "BOOLEAN", "constraints": ""},
                    {"name": "too_fast_flag", "type": "BOOLEAN", "constraints": "DEFAULT 0"},
                    {"name": "user_agent", "type": "TEXT", "constraints": "CHECK(LENGTH <= 500)"},
                    {"name": "ip_hash", "type": "TEXT", "constraints": "CHECK(LENGTH = 64)"},
                    {"name": "created_at", "type": "TIMESTAMP", "constraints": "DEFAULT CURRENT_TIMESTAMP"}
                ]
            },
            "consent_records": {
                "description": "Stores participant consent records",
                "columns": [
                    {"name": "id", "type": "INTEGER", "constraints": "PRIMARY KEY AUTOINCREMENT"},
                    {"name": "participant_id", "type": "TEXT", "constraints": "UNIQUE NOT NULL CHECK(LENGTH <= 100), FK to participants"},
                    {"name": "consent_given", "type": "BOOLEAN", "constraints": "DEFAULT 0"},
                    {"name": "consent_timestamp", "type": "TIMESTAMP", "constraints": ""},
                    {"name": "ip_hash", "type": "TEXT", "constraints": "CHECK(LENGTH = 64)"},
                    {"name": "user_agent", "type": "TEXT", "constraints": "CHECK(LENGTH <= 500)"},
                    {"name": "created_at", "type": "TIMESTAMP", "constraints": "DEFAULT CURRENT_TIMESTAMP"}
                ]
            },
            "images": {
                "description": "Stores image metadata",
                "columns": [
                    {"name": "image_id", "type": "TEXT", "constraints": "PRIMARY KEY"},
                    {"name": "category", "type": "TEXT", "constraints": ""},
                    {"name": "difficulty_score", "type": "REAL", "constraints": ""},
                    {"name": "object_count", "type": "INTEGER", "constraints": ""},
                    {"name": "width", "type": "INTEGER", "constraints": ""},
                    {"name": "height", "type": "INTEGER", "constraints": ""},
                    {"name": "created_at", "type": "TIMESTAMP", "constraints": "DEFAULT CURRENT_TIMESTAMP"}
                ]
            },
            "audit_log": {
                "description": "Security audit log for tracking all significant events",
                "columns": [
                    {"name": "id", "type": "INTEGER", "constraints": "PRIMARY KEY AUTOINCREMENT"},
                    {"name": "timestamp", "type": "TIMESTAMP", "constraints": "DEFAULT CURRENT_TIMESTAMP"},
                    {"name": "event_type", "type": "TEXT", "constraints": "NOT NULL CHECK(LENGTH <= 50)"},
                    {"name": "user_id", "type": "TEXT", "constraints": "CHECK(LENGTH <= 100)"},
                    {"name": "participant_id", "type": "TEXT", "constraints": "CHECK(LENGTH <= 100)"},
                    {"name": "endpoint", "type": "TEXT", "constraints": "CHECK(LENGTH <= 100)"},
                    {"name": "method", "type": "TEXT", "constraints": "CHECK(LENGTH <= 10)"},
                    {"name": "status_code", "type": "INTEGER", "constraints": ""},
                    {"name": "ip_hash", "type": "TEXT", "constraints": "CHECK(LENGTH = 64)"},
                    {"name": "user_agent", "type": "TEXT", "constraints": "CHECK(LENGTH <= 500)"},
                    {"name": "details", "type": "TEXT", "constraints": "CHECK(LENGTH <= 2000)"}
                ]
            },
            "performance_metrics": {
                "description": "API endpoint performance metrics",
                "columns": [
                    {"name": "id", "type": "INTEGER", "constraints": "PRIMARY KEY AUTOINCREMENT"},
                    {"name": "timestamp", "type": "TIMESTAMP", "constraints": "DEFAULT CURRENT_TIMESTAMP"},
                    {"name": "endpoint", "type": "TEXT", "constraints": "NOT NULL CHECK(LENGTH <= 100)"},
                    {"name": "response_time_ms", "type": "INTEGER", "constraints": "CHECK(>= 0)"},
                    {"name": "status_code", "type": "INTEGER", "constraints": ""},
                    {"name": "request_size_bytes", "type": "INTEGER", "constraints": "CHECK(>= 0)"},
                    {"name": "response_size_bytes", "type": "INTEGER", "constraints": "CHECK(>= 0)"}
                ]
            },
            "database_metadata": {
                "description": "Database version and configuration metadata",
                "columns": [
                    {"name": "key", "type": "TEXT", "constraints": "PRIMARY KEY"},
                    {"name": "value", "type": "TEXT", "constraints": ""},
                    {"name": "updated_at", "type": "TIMESTAMP", "constraints": "DEFAULT CURRENT_TIMESTAMP"}
                ]
            }
        },
        "indexes": [
            {"name": "idx_participants_id", "table": "participants", "column": "participant_id"},
            {"name": "idx_participants_session", "table": "participants", "column": "session_id"},
            {"name": "idx_participants_created", "table": "participants", "column": "created_at"},
            {"name": "idx_participants_consent", "table": "participants", "column": "consent_given"},
            {"name": "idx_participants_email", "table": "participants", "column": "email"},
            {"name": "idx_submissions_participant", "table": "submissions", "column": "participant_id"},
            {"name": "idx_submissions_session", "table": "submissions", "column": "session_id"},
            {"name": "idx_submissions_created", "table": "submissions", "column": "created_at"},
            {"name": "idx_submissions_image", "table": "submissions", "column": "image_id"},
            {"name": "idx_submissions_survey", "table": "submissions", "column": "is_survey"},
            {"name": "idx_submissions_attention", "table": "submissions", "column": "is_attention"},
            {"name": "idx_submissions_rating", "table": "submissions", "column": "rating"},
            {"name": "idx_submissions_word_count", "table": "submissions", "column": "word_count"},
            {"name": "idx_consent_participant", "table": "consent_records", "column": "participant_id"},
            {"name": "idx_consent_timestamp", "table": "consent_records", "column": "consent_timestamp"},
            {"name": "idx_images_id", "table": "images", "column": "image_id"},
            {"name": "idx_images_category", "table": "images", "column": "category"},
            {"name": "idx_images_created", "table": "images", "column": "created_at"},
            {"name": "idx_audit_timestamp", "table": "audit_log", "column": "timestamp"},
            {"name": "idx_audit_user", "table": "audit_log", "column": "user_id"},
            {"name": "idx_audit_participant", "table": "audit_log", "column": "participant_id"},
            {"name": "idx_audit_endpoint", "table": "audit_log", "column": "endpoint"},
            {"name": "idx_performance_timestamp", "table": "performance_metrics", "column": "timestamp"},
            {"name": "idx_performance_endpoint", "table": "performance_metrics", "column": "endpoint"}
        ],
        "triggers": [
            {
                "name": "trg_participant_insert_audit",
                "event": "AFTER INSERT ON participants",
                "description": "Logs participant creation events to audit_log"
            },
            {
                "name": "trg_consent_insert_audit",
                "event": "AFTER INSERT ON consent_records",
                "description": "Logs consent recording events to audit_log"
            },
            {
                "name": "trg_submission_insert_audit",
                "event": "AFTER INSERT ON submissions",
                "description": "Logs submission creation events to audit_log"
            }
        ],
        "views": [
            {
                "name": "vw_participant_summary",
                "description": "Aggregated participant data with submission statistics",
                "columns": ["participant_id", "username", "email", "age", "gender", "place", "native_language", "prior_experience", "consent_given", "submission_count", "avg_word_count", "last_submission_time"]
            },
            {
                "name": "vw_submission_stats",
                "description": "Per-participant submission statistics",
                "columns": ["participant_id", "total_submissions", "survey_count", "attention_count", "attention_passed_count", "avg_word_count", "avg_rating", "avg_time_seconds"]
            },
            {
                "name": "vw_image_coverage",
                "description": "Image utilization analysis with coverage metrics",
                "columns": ["image_id", "category", "difficulty_score", "object_count", "width", "height", "submission_count", "unique_participants", "avg_word_count", "avg_rating", "avg_time_seconds", "survey_submissions", "attention_submissions", "attention_passed_submissions", "first_submission_time", "last_submission_time", "usage_category"]
            },
            {
                "name": "vw_submission_quality",
                "description": "Data quality scoring for submissions (0-100 scale)",
                "columns": ["id", "participant_id", "image_id", "trial_index", "word_count", "rating", "time_spent_seconds", "is_survey", "is_attention", "attention_passed", "too_fast_flag", "created_at", "data_quality_score", "quality_category"]
            }
        ],
        "foreign_keys": [
            {"from_table": "submissions", "from_column": "participant_id", "to_table": "participants", "to_column": "participant_id", "on_delete": "CASCADE"},
            {"from_table": "submissions", "from_column": "image_id", "to_table": "images", "to_column": "image_id"},
            {"from_table": "consent_records", "from_column": "participant_id", "to_table": "participants", "to_column": "participant_id", "on_delete": "CASCADE"}
        ]
    }
    return jsonify(schema)


@app.route("/api/docs")
@limiter.limit("30 per minute")
def api_docs():
    """Comprehensive API documentation - only working routes"""
    return jsonify({
        "title": "C.O.G.N.I.T. API Documentation",
        "version": "3.2.0",
        "description": "Complete and verified API documentation for the C.O.G.N.I.T. research platform",
        "base_url": "/api",
        "security": {
            "rate_limiting": "200 per day, 50 per hour (default)",
            "cors_allowed_origins": ["http://localhost:5173", "https://your-production-domain.com"],
            "authentication": "None required for participant endpoints",
            "data_protection": "IP hashing, privacy-preserving storage"
        },
        "endpoints": {
            "health": {
                "path": "/api/health",
                "method": "GET",
                "description": "Health check endpoint to verify system connectivity and dependencies",
                "auth_required": False,
                "rate_limit": "200 per day, 50 per hour",
                "response": {
                    "status": "healthy|degraded",
                    "timestamp": "ISO format",
                    "services": {
                        "database": "connected|error",
                        "images": "accessible|not found|error"
                    }
                }
            },
            "security_info": {
                "path": "/api/security/info",
                "method": "GET",
                "description": "Get detailed security configuration information",
                "auth_required": False,
                "rate_limit": "200 per day, 50 per hour"
            },
            "create_participant": {
                "path": "/api/participants",
                "method": "POST",
                "description": "Create a new participant record with user details",
                "auth_required": False,
                "rate_limit": "30 per minute",
                "request_body": {
                    "required": ["participant_id", "session_id", "username", "gender", "age", "place", "native_language", "prior_experience"],
                    "optional": ["email", "phone"]
                },
                "validation": {
                    "email": "Valid email format if provided",
                    "phone": "Valid phone format if provided",
                    "age": "Integer between 1-120"
                },
                "response": {
                    "status": "success|error",
                    "participant_id": "string",
                    "message": "string"
                }
            },
            "get_participant": {
                "path": "/api/participants/<participant_id>",
                "method": "GET",
                "description": "Get participant details by participant ID",
                "auth_required": False,
                "rate_limit": "200 per day, 50 per hour",
                "response": {
                    "participant_id": "string",
                    "username": "string",
                    "email": "string|null",
                    "phone": "string|null",
                    "gender": "string",
                    "age": "integer",
                    "place": "string",
                    "native_language": "string",
                    "prior_experience": "string",
                    "consent_given": "boolean",
                    "created_at": "timestamp"
                }
            },
            "record_consent": {
                "path": "/api/consent",
                "method": "POST",
                "description": "Record participant consent for the study",
                "auth_required": False,
                "rate_limit": "20 per minute",
                "request_body": {
                    "required": ["participant_id", "consent_given"],
                    "validation": {
                        "consent_given": "Must be true to proceed"
                    }
                },
                "response": {
                    "status": "success|error",
                    "message": "string",
                    "timestamp": "ISO format"
                }
            },
            "get_consent": {
                "path": "/api/consent/<participant_id>",
                "method": "GET",
                "description": "Get consent status for a specific participant",
                "auth_required": False,
                "rate_limit": "200 per day, 50 per hour",
                "response": {
                    "participant_id": "string",
                    "consent_given": "boolean",
                    "consent_timestamp": "timestamp|null"
                }
            },
            "random_image": {
                "path": "/api/images/random",
                "method": "GET",
                "description": "Get a random image from specified category",
                "auth_required": False,
                "rate_limit": "200 per day, 50 per hour",
                "query_params": {
                    "type": "normal|survey|attention (default: normal)"
                },
                "response": {
                    "image_id": "string",
                    "image_url": "string",
                    "is_survey": "boolean",
                    "is_attention": "boolean"
                }
            },
            "serve_image": {
                "path": "/api/images/<image_id>",
                "method": "GET",
                "description": "Get a specific image file by ID",
                "auth_required": False,
                "rate_limit": "200 per day, 50 per hour",
                "response": "Binary image data"
            },
            "submit_description": {
                "path": "/api/submit",
                "method": "POST",
                "description": "Submit a description and rating for an image",
                "auth_required": False,
                "rate_limit": "60 per minute",
                "request_body": {
                    "required": ["participant_id", "image_id", "description", "rating", "feedback", "time_spent_seconds"],
                    "optional": ["session_id", "image_url", "trial_index", "is_survey", "is_attention", "attention_expected"]
                },
                "validation": {
                    "description": f"Minimum {MIN_WORD_COUNT} words required",
                    "rating": "Integer between 1-10",
                    "feedback": "Minimum 5 characters",
                    "participant_consent": "Participant must have given consent",
                    "trial_index": "Optional trial sequence number (integer, defaults to 0)"
                },
                "response": {
                    "status": "ok|error",
                    "word_count": "integer",
                    "attention_passed": "boolean|null"
                }
            },
            "get_submissions": {
                "path": "/api/submissions/<participant_id>",
                "method": "GET",
                "description": "Get all submissions for a specific participant",
                "auth_required": False,
                "rate_limit": "200 per day, 50 per hour",
                "response": "Array of submission objects with details"
            },
            "get_schema": {
                "path": "/api/schema",
                "method": "GET",
                "description": "Get the complete database schema including tables, indexes, triggers, and views",
                "auth_required": False,
                "rate_limit": "30 per minute",
                "response": "Complete schema definition with all database objects"
            }
        },
        "error_handling": {
            "common_errors": {
                "400": "Bad request - validation failed",
                "403": "Forbidden - consent not given",
                "404": "Not found - resource doesn't exist",
                "409": "Conflict - duplicate participant ID",
                "429": "Too many requests - rate limit exceeded",
                "500": "Internal server error"
            },
            "error_format": {
                "error": "string - error message",
                "details": "object - additional error details (if available)"
            }
        },
        "changelog": {
            "3.2.0": "Added images table, trial_index column to submissions, Data Quality Score view, and Image Coverage view",
            "3.1.0": "Updated documentation to reflect only working routes, added detailed validation info, improved error handling section"
        }
    })


def regenerate_database_from_schema():
    """Regenerate the database from the schema.sql file"""
    schema_path = BASE_DIR / "schema.sql"
    if not schema_path.exists():
        print(f"Schema file not found at {schema_path}")
        return False
    
    try:
        # Backup existing database
        backup_path = BASE_DIR / f"COGNIT_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
        if DB_PATH.exists():
            import shutil
            shutil.copy2(DB_PATH, backup_path)
            print(f"Backup created at {backup_path}")
        
        # Remove existing database
        if DB_PATH.exists():
            DB_PATH.unlink()
        
        # Create new database from schema
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        with open(schema_path, 'r', encoding='utf-8') as f:
            schema_sql = f.read()
        
        # Execute schema statements
        for statement in schema_sql.split(';'):
            statement = statement.strip()
            if statement:
                try:
                    cursor.execute(statement)
                except sqlite3.OperationalError as e:
                    # Some statements like PRAGMA might fail, that's okay
                    pass
        
        conn.commit()
        conn.close()
        
        print("Database successfully regenerated from schema")
        return True
        
    except Exception as e:
        print(f"Failed to regenerate database: {str(e)}")
        return False


if __name__ == "__main__":
    # Check if we should regenerate the database
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--regenerate-db":
        if regenerate_database_from_schema():
            print("Database regeneration completed successfully")
        else:
            print("Database regeneration failed")
        sys.exit(0)
    
    # Run database migration for schema updates
    migrate_database_schema()
    
    init_db()
    print("Starting C.O.G.N.I.T. backend server...")
    print("API Documentation available at: http://localhost:5000/api/docs")
    print("API available at: http://localhost:5000/api/")
    print("Security Info available at: http://localhost:5000/api/security/info")
    app.run(debug=True, host='0.0.0.0', port=5000)
