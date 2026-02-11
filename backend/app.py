import csv
import hashlib
import os
import random
import sqlite3
import secrets
import hmac
import re
from datetime import datetime, timezone, timedelta
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

MIN_WORD_COUNT = int(os.getenv("MIN_WORD_COUNT", "30"))
TOO_FAST_SECONDS = float(os.getenv("TOO_FAST_SECONDS", "5"))
IP_HASH_SALT = os.getenv("IP_HASH_SALT", "local-salt")

app = Flask(__name__)

# Security Configuration
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', secrets.token_hex(32))
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = 1800  # 30 minutes

# CORS Configuration
CORS(app, resources={
    r"/api/*": {"origins": ["http://localhost:5173", "https://your-production-domain.com"]},
    r"/admin/*": {"origins": ["http://localhost:5173", "https://your-production-domain.com"]}
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
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:"
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
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
    """Initialize the SQLite database with all required schemas"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create admin users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS admin_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            email TEXT UNIQUE,
            email_verified BOOLEAN DEFAULT 1,
            role TEXT DEFAULT 'admin',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP,
            is_active BOOLEAN DEFAULT 1
        )
    ''')
    
    # Create admin sessions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS admin_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            session_token TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP,
            ip_address TEXT,
            user_agent TEXT,
            FOREIGN KEY (user_id) REFERENCES admin_users (id) ON DELETE CASCADE
        )
    ''')
    
    # Create admin audit log table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS admin_audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT NOT NULL,
            details TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ip_address TEXT,
            FOREIGN KEY (user_id) REFERENCES admin_users (id) ON DELETE SET NULL
        )
    ''')
    
    # Create participants table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS participants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            participant_id TEXT UNIQUE NOT NULL,
            session_id TEXT NOT NULL,
            username TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            gender TEXT,
            age INTEGER,
            place TEXT,
            native_language TEXT,
            prior_experience TEXT,
            consent_given BOOLEAN DEFAULT 0,
            consent_timestamp TIMESTAMP,
            ip_hash TEXT,
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create submissions table (replaces CSV)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS submissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            participant_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            image_id TEXT NOT NULL,
            image_url TEXT,
            description TEXT NOT NULL,
            word_count INTEGER,
            rating INTEGER,
            feedback TEXT,
            time_spent_seconds REAL,
            is_survey BOOLEAN DEFAULT 0,
            is_attention BOOLEAN DEFAULT 0,
            attention_passed BOOLEAN,
            too_fast_flag BOOLEAN DEFAULT 0,
            user_agent TEXT,
            ip_hash TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (participant_id) REFERENCES participants (participant_id) ON DELETE CASCADE
        )
    ''')
    
    # Create consent records table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS consent_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            participant_id TEXT UNIQUE NOT NULL,
            consent_given BOOLEAN DEFAULT 0,
            consent_timestamp TIMESTAMP,
            ip_hash TEXT,
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (participant_id) REFERENCES participants (participant_id) ON DELETE CASCADE
        )
    ''')
    
    conn.commit()
    
    # Create indexes for performance
    _create_indexes(cursor)
    
    # Create default admin user
    _create_default_admin_user(cursor)
    
    conn.commit()
    conn.close()


def _create_indexes(cursor):
    """Create database indexes for performance optimization"""
    indexes = [
        ("idx_participants_id", "participants", "participant_id"),
        ("idx_participants_session", "participants", "session_id"),
        ("idx_participants_created", "participants", "created_at"),
        ("idx_submissions_participant", "submissions", "participant_id"),
        ("idx_submissions_session", "submissions", "session_id"),
        ("idx_submissions_created", "submissions", "created_at"),
        ("idx_submissions_image", "submissions", "image_id"),
        ("idx_admin_sessions_token", "admin_sessions", "session_token"),
        ("idx_admin_sessions_user", "admin_sessions", "user_id"),
        ("idx_admin_audit_user", "admin_audit_log", "user_id"),
        ("idx_admin_audit_timestamp", "admin_audit_log", "timestamp"),
        ("idx_consent_participant", "consent_records", "participant_id"),
    ]
    
    for idx_name, table, column in indexes:
        try:
            cursor.execute(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {table}({column})")
        except sqlite3.OperationalError:
            pass  # Index might already exist


def _create_default_admin_user(cursor):
    """Create default admin user if it doesn't exist"""
    cursor.execute("SELECT id FROM admin_users WHERE username = ?", ("Gaurav",))
    if cursor.fetchone():
        return
    
    default_password_hash = hash_password("Gaurav@0809")
    cursor.execute(
        """INSERT INTO admin_users 
           (username, password_hash, email, email_verified, is_active) 
           VALUES (?, ?, ?, 1, 1)""",
        ("Gaurav", default_password_hash, "gaurav@admin.com")
    )
    
    cursor.execute(
        "INSERT INTO admin_audit_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)",
        (cursor.lastrowid, 'system_create', 'Default admin user created', 'system')
    )


def hash_password(password):
    """Hash password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()


def get_ip_hash():
    """Generate hash of IP address for privacy"""
    ip_address = request.headers.get("X-Forwarded-For", request.remote_addr) or "unknown"
    digest = hashlib.sha256(f"{ip_address}{IP_HASH_SALT}".encode("utf-8")).hexdigest()
    return digest


def count_words(text: str):
    """Count words in text"""
    return len([word for word in text.strip().split() if word])


def validate_session(session_token):
    """Validate session token and return user info"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute(
        """SELECT u.id, u.username, u.role, u.is_active 
           FROM admin_users u 
           JOIN admin_sessions s ON u.id = s.user_id 
           WHERE s.session_token = ? AND s.expires_at > ? AND u.is_active = 1""",
        (session_token, datetime.now(timezone.utc).isoformat())
    )
    user = cursor.fetchone()
    
    if user:
        return {
            "id": user[0],
            "username": user[1],
            "role": user[2],
            "is_active": user[3]
        }
    return None


def require_auth():
    """Check if user is authenticated via session token"""
    session_token = request.headers.get("X-SESSION-TOKEN")
    if not session_token:
        return False
    return validate_session(session_token)


# ============== HEALTH & SYSTEM ENDPOINTS ==============

@app.route("/api/health")
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
        
        conn.commit()
        
        return jsonify({
            "status": "success",
            "participant_id": data['participant_id'],
            "message": "Participant created successfully"
        }), 201
        
    except sqlite3.IntegrityError as e:
        if "participant_id" in str(e).lower():
            return jsonify({"error": "Participant ID already exists"}), 409
        return jsonify({"error": "Database error", "details": str(e)}), 500
    except Exception as e:
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
    
    # Check if participant exists
    cursor.execute("SELECT id FROM participants WHERE participant_id = ?", (participant_id,))
    if not cursor.fetchone():
        return jsonify({"error": "Participant not found"}), 404
    
    timestamp = datetime.now(timezone.utc).isoformat()
    
    # Update participant consent status
    cursor.execute('''
        UPDATE participants 
        SET consent_given = 1, consent_timestamp = ?
        WHERE participant_id = ?
    ''', (timestamp, participant_id))
    
    # Insert or update consent record
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
        cursor.execute('''
            INSERT INTO submissions 
            (participant_id, session_id, image_id, image_url, description, word_count, rating, 
             feedback, time_spent_seconds, is_survey, is_attention, attention_passed, too_fast_flag, user_agent, ip_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            participant_id,
            payload.get("session_id", ""),
            image_id,
            payload.get("image_url", f"/api/images/{image_id}"),
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
        SELECT id, image_id, description, word_count, rating, feedback, 
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
            "description": row[2],
            "word_count": row[3],
            "rating": row[4],
            "feedback": row[5],
            "time_spent_seconds": row[6],
            "is_survey": bool(row[7]),
            "is_attention": bool(row[8]),
            "attention_passed": row[9],
            "created_at": row[10]
        })
    
    return jsonify(submissions)


# ============== ADMIN ENDPOINTS ==============

@app.route("/api/admin/login", methods=["POST"])
@limiter.limit("10 per minute")
def admin_login():
    """Admin login endpoint"""
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    
    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute(
        "SELECT id, password_hash, email_verified, role, is_active FROM admin_users WHERE username = ?",
        (username,)
    )
    user = cursor.fetchone()
    
    if not user:
        return jsonify({"error": "Invalid credentials"}), 401
    
    user_id, stored_password_hash, email_verified, role, is_active = user
    
    if not is_active:
        return jsonify({"error": "Account is deactivated"}), 401
    
    if hash_password(password) != stored_password_hash:
        ip_address = request.headers.get("X-Forwarded-For", request.remote_addr) or "unknown"
        cursor.execute(
            "INSERT INTO admin_audit_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)",
            (user_id, 'login_failed', 'Invalid password', ip_address)
        )
        conn.commit()
        return jsonify({"error": "Invalid credentials"}), 401
    
    # Generate session token
    session_token = secrets.token_hex(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    ip_address = request.headers.get("X-Forwarded-For", request.remote_addr) or "unknown"
    user_agent = request.headers.get("User-Agent", "")
    
    cursor.execute(
        "INSERT INTO admin_sessions (user_id, session_token, expires_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)",
        (user_id, session_token, expires_at.isoformat(), ip_address, user_agent)
    )
    
    cursor.execute(
        "UPDATE admin_users SET last_login = ? WHERE id = ?",
        (datetime.now(timezone.utc).isoformat(), user_id)
    )
    
    cursor.execute(
        "INSERT INTO admin_audit_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)",
        (user_id, 'login_success', 'User logged in', ip_address)
    )
    
    conn.commit()
    
    return jsonify({
        "status": "success",
        "session_token": session_token,
        "user": {
            "username": username,
            "role": role
        }
    })


@app.route("/api/admin/logout", methods=["POST"])
def admin_logout():
    """Admin logout endpoint"""
    session_token = request.headers.get("X-SESSION-TOKEN")
    
    if session_token:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM admin_sessions WHERE session_token = ?", (session_token,))
        conn.commit()
    
    return jsonify({"status": "success", "message": "Logged out successfully"})


@app.route("/api/admin/me")
def admin_me():
    """Get current admin user info"""
    session_token = request.headers.get("X-SESSION-TOKEN")
    
    if not session_token:
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute(
        """SELECT u.username, u.role, u.email, u.created_at, u.last_login 
           FROM admin_users u 
           JOIN admin_sessions s ON u.id = s.user_id 
           WHERE s.session_token = ? AND s.expires_at > ? AND u.is_active = 1""",
        (session_token, datetime.now(timezone.utc).isoformat())
    )
    
    user = cursor.fetchone()
    if user:
        return jsonify({
            "username": user[0],
            "role": user[1],
            "email": user[2],
            "created_at": user[3],
            "last_login": user[4],
            "auth_method": "session"
        })
    
    return jsonify({"error": "Unauthorized"}), 401


@app.route("/api/admin/change-password", methods=["POST"])
@limiter.limit("5 per minute")
def change_password():
    """Change admin user password"""
    session_token = request.headers.get("X-SESSION-TOKEN")
    
    if not session_token:
        return jsonify({"error": "Unauthorized"}), 401
    
    user = validate_session(session_token)
    if not user:
        return jsonify({"error": "Invalid or expired session"}), 401
    
    data = request.get_json(silent=True) or {}
    current_password = data.get("current_password", "").strip()
    new_password = data.get("new_password", "").strip()
    
    if not current_password or not new_password:
        return jsonify({"error": "Current password and new password are required"}), 400
    
    if len(new_password) < 6:
        return jsonify({"error": "New password must be at least 6 characters long"}), 400
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute(
        "SELECT password_hash FROM admin_users WHERE id = ?",
        (user["id"],)
    )
    result = cursor.fetchone()
    
    if not result:
        return jsonify({"error": "User not found"}), 404
    
    if hash_password(current_password) != result[0]:
        return jsonify({"error": "Current password is incorrect"}), 401
    
    new_hash = hash_password(new_password)
    cursor.execute(
        "UPDATE admin_users SET password_hash = ? WHERE id = ?",
        (new_hash, user["id"])
    )
    
    ip_address = request.headers.get("X-Forwarded-For", request.remote_addr) or "unknown"
    cursor.execute(
        "INSERT INTO admin_audit_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)",
        (user["id"], 'password_change', 'Password changed successfully', ip_address)
    )
    
    conn.commit()
    
    return jsonify({
        "status": "success",
        "message": "Password changed successfully"
    })


# ============== STATS & DATA ENDPOINTS ==============

@app.route("/api/stats")
def stats():
    """Get statistics about submissions"""
    user = require_auth()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_db()
    cursor = conn.cursor()
    
    # Total submissions
    cursor.execute("SELECT COUNT(*) FROM submissions")
    total = cursor.fetchone()[0]
    
    # Average word count
    cursor.execute("SELECT AVG(word_count) FROM submissions")
    avg_word_count = cursor.fetchone()[0] or 0
    
    # Attention check statistics
    cursor.execute("SELECT COUNT(*) FROM submissions WHERE is_attention = 1")
    attention_total = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM submissions WHERE is_attention = 1 AND attention_passed = 0")
    attention_failed = cursor.fetchone()[0]
    
    attention_fail_rate = (attention_failed / attention_total) if attention_total > 0 else 0
    
    return jsonify({
        "total_submissions": total,
        "avg_word_count": avg_word_count,
        "attention_fail_rate": attention_fail_rate,
    })


@app.route("/admin/csv-data")
@limiter.limit("10 per minute")
def get_csv_data():
    """Get submission data as JSON for admin panel"""
    user = require_auth()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT s.*, p.username, p.gender, p.age, p.place, p.native_language, p.prior_experience
        FROM submissions s
        LEFT JOIN participants p ON s.participant_id = p.participant_id
        ORDER BY s.created_at DESC
    ''')
    
    rows = cursor.fetchall()
    columns = [description[0] for description in cursor.description]
    
    data = []
    for row in rows:
        row_dict = {}
        for col, val in zip(columns, row):
            # Convert boolean values
            if col in ['is_survey', 'is_attention', 'attention_passed', 'too_fast_flag']:
                row_dict[col] = bool(val) if val is not None else None
            else:
                row_dict[col] = val
        data.append(row_dict)
    
    return jsonify(data)


@app.route("/admin/download")
def download_csv():
    """Download submissions as CSV file"""
    user = require_auth()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT s.*, p.username, p.gender, p.age, p.place, p.native_language, p.prior_experience
        FROM submissions s
        LEFT JOIN participants p ON s.participant_id = p.participant_id
        ORDER BY s.created_at DESC
    ''')
    
    rows = cursor.fetchall()
    columns = [description[0] for description in cursor.description]
    
    # Ensure data directory exists
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    # Write to CSV
    import csv
    with open(CSV_PATH, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(columns)
        for row in rows:
            writer.writerow(row)
    
    return send_from_directory(DATA_DIR, CSV_PATH.name, as_attachment=True)


@app.route("/admin/settings/csv-delete", methods=["DELETE"])
@limiter.limit("5 per minute")
def delete_csv_data():
    """Delete all data from submissions table (admin only)"""
    user = require_auth()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Delete all submissions
    cursor.execute("DELETE FROM submissions")
    
    # Also delete participants and consent records
    cursor.execute("DELETE FROM consent_records")
    cursor.execute("DELETE FROM participants")
    
    conn.commit()
    
    return jsonify({
        "status": "success",
        "message": "All data has been deleted successfully"
    })


# ============== SECURITY ENDPOINTS ==============

@app.route("/api/security/info")
def security_info():
    """Get security information"""
    return jsonify({
        "security": {
            "rate_limits": {
                "default": "200 per day, 50 per hour",
                "admin_endpoints": "10 per minute"
            },
            "cors_allowed_origins": ["http://localhost:5173", "https://your-production-domain.com"],
            "security_headers": [
                "X-Content-Type-Options: nosniff",
                "X-Frame-Options: SAMEORIGIN",
                "X-XSS-Protection: 1; mode=block",
                "Content-Security-Policy: default-src 'self'",
                "Strict-Transport-Security: max-age=31536000",
                "Referrer-Policy: strict-origin-when-cross-origin"
            ],
            "data_protection": {
                "ip_hashing": "SHA-256 with salt",
                "anonymous_data": True,
                "storage": "SQLite with indexed columns"
            }
        }
    })


@app.route("/admin/security/audit")
@limiter.limit("5 per minute")
def security_audit():
    """Admin security audit endpoint"""
    user = require_auth()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Get counts for audit
    cursor.execute("SELECT COUNT(*) FROM admin_users")
    admin_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM admin_sessions WHERE expires_at > ?", 
                   (datetime.now(timezone.utc).isoformat(),))
    active_sessions = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM participants")
    participant_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM submissions")
    submission_count = cursor.fetchone()[0]
    
    return jsonify({
        "security_audit": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "ok",
            "counts": {
                "admin_users": admin_count,
                "active_sessions": active_sessions,
                "participants": participant_count,
                "submissions": submission_count
            },
            "checks": {
                "password_validation": "enabled",
                "rate_limiting": "enabled",
                "cors_restrictions": "enabled",
                "security_headers": "enabled",
                "data_encryption": "enabled (IP hashing)",
                "database_indexes": "enabled"
            },
            "recommendations": [
                "Change password regularly",
                "Monitor failed login attempts",
                "Review CORS origins in production",
                "Enable HTTPS in production",
                "Regular database backups recommended"
            ]
        }
    })


# ============== API DOCUMENTATION ==============

@app.route("/api/docs")
@limiter.limit("30 per minute")
def api_docs():
    """Comprehensive API documentation"""
    return jsonify({
        "title": "C.O.G.N.I.T. API Documentation",
        "version": "3.0.0",
        "description": "Complete API documentation for the C.O.G.N.I.T. research platform with database integration",
        "base_url": "/api",
        "authentication": {
            "type": "Session Token",
            "description": "Admin endpoints require a session token. Login with username/password to obtain a token.",
            "methods": ["X-SESSION-TOKEN header"],
            "login_endpoint": "/api/admin/login",
            "token_ttl_hours": 24
        },
        "endpoints": {
            "system": {
                "routes": [
                    {
                        "path": "/api/health",
                        "method": "GET",
                        "description": "Health check endpoint to verify system connectivity",
                        "auth": False
                    },
                    {
                        "path": "/api/security/info",
                        "method": "GET",
                        "description": "Get security configuration information",
                        "auth": False
                    }
                ]
            },
            "participants": {
                "routes": [
                    {
                        "path": "/api/participants",
                        "method": "POST",
                        "description": "Create a new participant record",
                        "auth": False,
                        "body": ["participant_id", "session_id", "username", "gender", "age", "place", "native_language", "prior_experience", "email", "phone"]
                    },
                    {
                        "path": "/api/participants/<id>",
                        "method": "GET",
                        "description": "Get participant details",
                        "auth": False
                    }
                ]
            },
            "consent": {
                "routes": [
                    {
                        "path": "/api/consent",
                        "method": "POST",
                        "description": "Record participant consent",
                        "auth": False,
                        "body": ["participant_id", "consent_given"]
                    },
                    {
                        "path": "/api/consent/<participant_id>",
                        "method": "GET",
                        "description": "Get consent status for a participant",
                        "auth": False
                    }
                ]
            },
            "images": {
                "routes": [
                    {
                        "path": "/api/images/random",
                        "method": "GET",
                        "description": "Get a random image",
                        "auth": False,
                        "params": ["type: normal|survey|attention"]
                    },
                    {
                        "path": "/api/images/<image_id>",
                        "method": "GET",
                        "description": "Get a specific image file",
                        "auth": False
                    }
                ]
            },
            "submissions": {
                "routes": [
                    {
                        "path": "/api/submit",
                        "method": "POST",
                        "description": "Submit a description/rating",
                        "auth": False,
                        "body": ["participant_id", "session_id", "image_id", "description", "rating", "feedback", "time_spent_seconds"]
                    },
                    {
                        "path": "/api/submissions/<participant_id>",
                        "method": "GET",
                        "description": "Get all submissions for a participant",
                        "auth": False
                    }
                ]
            },
            "admin": {
                "routes": [
                    {
                        "path": "/api/admin/login",
                        "method": "POST",
                        "description": "Admin login",
                        "auth": False
                    },
                    {
                        "path": "/api/admin/logout",
                        "method": "POST",
                        "description": "Admin logout",
                        "auth": True
                    },
                    {
                        "path": "/api/admin/me",
                        "method": "GET",
                        "description": "Get current admin info",
                        "auth": True
                    },
                    {
                        "path": "/api/admin/change-password",
                        "method": "POST",
                        "description": "Change admin password",
                        "auth": True
                    },
                    {
                        "path": "/api/stats",
                        "method": "GET",
                        "description": "Get submission statistics",
                        "auth": True
                    },
                    {
                        "path": "/admin/csv-data",
                        "method": "GET",
                        "description": "Get all submission data as JSON",
                        "auth": True
                    },
                    {
                        "path": "/admin/download",
                        "method": "GET",
                        "description": "Download submissions as CSV",
                        "auth": True
                    },
                    {
                        "path": "/admin/settings/csv-delete",
                        "method": "DELETE",
                        "description": "Delete all data",
                        "auth": True
                    },
                    {
                        "path": "/admin/security/audit",
                        "method": "GET",
                        "description": "Run security audit",
                        "auth": True
                    }
                ]
            }
        }
    })


if __name__ == "__main__":
    init_db()
    print("Starting C.O.G.N.I.T. backend server...")
    print("API Documentation available at: http://localhost:5000/api/docs")
    print("API available at: http://localhost:5000/api/")
    app.run(debug=True, host='0.0.0.0', port=5000)
