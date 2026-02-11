import csv
import hashlib
import os
import random
import sqlite3
from datetime import datetime, timezone, timedelta
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory, abort
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import secrets
import hashlib
import hmac
import time

BASE_DIR = Path(__file__).resolve().parent
IMAGES_DIR = BASE_DIR / "images"
DATA_DIR = BASE_DIR / "data"
CSV_PATH = DATA_DIR / "submissions.csv"
DB_PATH = BASE_DIR / "COGNIT.db"

MIN_WORD_COUNT = int(os.getenv("MIN_WORD_COUNT", "30"))
TOO_FAST_SECONDS = float(os.getenv("TOO_FAST_SECONDS", "5"))
IP_HASH_SALT = os.getenv("IP_HASH_SALT", "local-salt")

CSV_HEADERS = [
    "timestamp",
    "participant_id",
    "session_id",
    "image_id",
    "image_url",
    "description",
    "word_count",
    "rating",
    "feedback",
    "time_spent_seconds",
    "is_survey",
    "is_attention",
    "attention_passed",
    "too_fast_flag",
    "user_agent",
    "ip_hash",
    "username",
    "gender",
    "age",
    "place",
    "native_language",
    "prior_experience",
]

# Email configuration (for development, using console output)
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "noreply@cognit-research.org")

app = Flask(__name__)

# Security Configuration
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', secrets.token_hex(32))
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = 1800  # 30 minutes

# CORS Configuration - restrict to specific origins in production
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

def ensure_csv():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not CSV_PATH.exists():
        with CSV_PATH.open("w", newline="", encoding="utf-8") as file:
            writer = csv.writer(file)
            writer.writerow(CSV_HEADERS)


def init_db():
    """Initialize the SQLite database"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create admin users table with API key support
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS admin_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            email TEXT UNIQUE,
            email_verified BOOLEAN DEFAULT 1,
            api_key TEXT UNIQUE,
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
            FOREIGN KEY (user_id) REFERENCES admin_users (id)
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
            FOREIGN KEY (user_id) REFERENCES admin_users (id)
        )
    ''')
    
    conn.commit()
    
    # Run migrations to add missing columns if they don't exist
    _migrate_admin_users_table(cursor)
    
    # Create default admin user if it doesn't exist
    _create_default_admin_user(cursor)
    
    conn.commit()
    conn.close()


def _migrate_admin_users_table(cursor):
    """Add missing columns to admin_users table if they don't exist"""
    # Get existing columns
    cursor.execute("PRAGMA table_info(admin_users)")
    existing_columns = {row[1] for row in cursor.fetchall()}
    
    # Define columns that should exist
    required_columns = {
        "email_verified": "BOOLEAN DEFAULT 1"
    }
    
    # Add missing columns
    for col_name, col_def in required_columns.items():
        if col_name not in existing_columns:
            try:
                cursor.execute(f"ALTER TABLE admin_users ADD COLUMN {col_name} {col_def}")
            except sqlite3.OperationalError:
                # Column might already exist or there's another issue
                pass


def _create_default_admin_user(cursor):
    """Create default admin user if it doesn't exist"""
    # Check if default user already exists
    cursor.execute("SELECT id FROM admin_users WHERE username = ?", ("Gaurav",))
    if cursor.fetchone():
        return  # User already exists
    
    # Create default admin user with password-based authentication
    default_password_hash = hash_password("Gaurav@0809")
    
    cursor.execute(
        """INSERT INTO admin_users 
           (username, password_hash, email, email_verified, is_active) 
           VALUES (?, ?, ?, 1, 1)""",
        ("Gaurav", default_password_hash, "gaurav@admin.com")
    )
    
    # Log the creation
    cursor.execute(
        "INSERT INTO admin_audit_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)",
        (cursor.lastrowid, 'system_create', 'Default admin user created', 'system')
    )

def hash_password(password):
    """Hash password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()


def authenticate_admin(username, password):
    """Authenticate admin user using username/password"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Username/password authentication
        cursor.execute(
            "SELECT id, password_hash, role, is_active FROM admin_users WHERE username = ?",
            (username,)
        )
        user = cursor.fetchone()
        
        if user and user[3]:  # Check active status
            user_id, stored_hash, role, is_active = user
            # Verify password
            input_hash = hash_password(password)
            if input_hash == stored_hash:
                # Log successful login
                ip_address = request.headers.get("X-Forwarded-For", request.remote_addr) or "unknown"
                cursor.execute(
                    "INSERT INTO admin_audit_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)",
                    (user_id, 'login_success', 'User logged in', ip_address)
                )
                cursor.execute(
                    "UPDATE admin_users SET last_login = ? WHERE id = ?",
                    (datetime.now(timezone.utc).isoformat(), user_id)
                )
                conn.commit()
                return True
        
        # Log failed login attempt
        ip_address = request.headers.get("X-Forwarded-For", request.remote_addr) or "unknown"
        cursor.execute(
            "INSERT INTO admin_audit_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)",
            (None, 'login_failed', f'Failed login for user: {username}', ip_address)
        )
        conn.commit()
        
        return False
        
    finally:
        conn.close()


def get_user_by_username(username):
    """Get user details by username"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute(
            "SELECT id, username, email, role, created_at, last_login FROM admin_users WHERE username = ?",
            (username,)
        )
        user = cursor.fetchone()
        if user:
            return {
                "id": user[0],
                "username": user[1],
                "email": user[2],
                "role": user[3],
                "created_at": user[4],
                "last_login": user[5]
            }
        return None
    finally:
        conn.close()


def get_user_by_id(user_id):
    """Get user details by ID"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute(
            "SELECT id, username, email, role, created_at, last_login FROM admin_users WHERE id = ?",
            (user_id,)
        )
        user = cursor.fetchone()
        if user:
            return {
                "id": user[0],
                "username": user[1],
                "email": user[2],
                "role": user[3],
                "created_at": user[4],
                "last_login": user[5]
            }
        return None
    finally:
        conn.close()


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


def get_ip_hash():
    ip_address = request.headers.get("X-Forwarded-For", request.remote_addr) or "unknown"
    digest = hashlib.sha256(f"{ip_address}{IP_HASH_SALT}".encode("utf-8")).hexdigest()
    return digest


def validate_request():
    """Validate incoming requests for security"""
    # Check content type for POST requests
    if request.method == "POST" and not request.is_json:
        if 'Content-Type' not in request.headers or 'application/json' not in request.headers['Content-Type']:
            abort(415, description="Unsupported Media Type: Please use application/json")
    
    # Check for suspicious headers
    suspicious_headers = ['x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto']
    for header in suspicious_headers:
        if header in request.headers and len(request.headers[header]) > 255:
            abort(400, description="Invalid header length")
    
    # Rate limiting check
    if hasattr(request, 'limit') and request.limit:
        return True
    
    return True


def generate_csrf_token():
    """Generate CSRF token for forms"""
    if 'csrf_token' not in request.cookies:
        token = secrets.token_hex(16)
        # In a real app, you would set this in the response cookies
        return token
    return request.cookies['csrf_token']


def verify_csrf_token(token):
    """Verify CSRF token"""
    if 'csrf_token' not in request.cookies:
        return False
    return hmac.compare_digest(token, request.cookies['csrf_token'])


def count_words(text: str):
    return len([word for word in text.strip().split() if word])


def require_auth():
    """Check if user is authenticated via session token"""
    session_token = request.headers.get("X-SESSION-TOKEN")
    if not session_token:
        return False
    
    return validate_session(session_token)


def get_user_from_session(session_token):
    """Get user info from session token"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute(
            """SELECT u.id, u.username, u.email, u.role, u.created_at, u.last_login 
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
                "email": user[2],
                "role": user[3],
                "created_at": user[4],
                "last_login": user[5]
            }
        return None
    finally:
        conn.close()


def validate_session(session_token):
    """Validate session token and return user info"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute(
            """SELECT u.id, u.username, u.role, u.is_active 
               FROM admin_users u 
               JOIN admin_sessions s ON u.id = s.user_id 
               WHERE s.session_token = ? AND s.expires_at > ? AND u.is_active = 1""",
            (session_token, datetime.now(timezone.utc).isoformat())
        )
        user = cursor.fetchone()
        
        if user:
            user_id, username, role, is_active = user
            return {
                "id": user_id,
                "username": username,
                "role": role,
                "is_active": is_active
            }
        return None
        
    finally:
        conn.close()


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
    
    # Check CSV/data directory
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        test_file = DATA_DIR / ".health_check"
        test_file.write_text("test")
        test_file.unlink()
        status["services"]["data_storage"] = "accessible"
    except Exception as e:
        status["services"]["data_storage"] = f"error: {str(e)}"
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


@app.route("/api/submit", methods=["POST"])
def submit():
    ensure_csv()
    payload = request.get_json(silent=True) or {}
    description = (payload.get("description") or "").strip()
    image_id = payload.get("image_id")
    image_url = payload.get("image_url") or f"/api/images/{image_id}" if image_id else ""

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

    timestamp = datetime.now(timezone.utc).isoformat()
    row = {
        "timestamp": timestamp,
        "participant_id": payload.get("participant_id", ""),
        "session_id": payload.get("session_id", ""),
        "image_id": image_id,
        "image_url": image_url,
        "description": description,
        "word_count": word_count,
        "rating": rating,
        "feedback": feedback,
        "time_spent_seconds": time_spent_seconds,
        "is_survey": is_survey,
        "is_attention": is_attention,
        "attention_passed": attention_passed,
        "too_fast_flag": too_fast_flag,
        "user_agent": request.headers.get("User-Agent", ""),
        "ip_hash": get_ip_hash(),
        "username": payload.get("username", ""),
        "gender": payload.get("gender", ""),
        "age": payload.get("age", ""),
        "place": payload.get("place", ""),
        "native_language": payload.get("native_language", ""),
        "prior_experience": payload.get("prior_experience", ""),
    }

    with CSV_PATH.open("a", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=CSV_HEADERS)
        writer.writerow(row)

    return jsonify({"status": "ok", "word_count": word_count, "attention_passed": attention_passed})


@app.route("/api/stats")
def stats():
    user = require_auth()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    ensure_csv()
    total = 0
    total_words = 0
    attention_total = 0
    attention_failed = 0

    with CSV_PATH.open("r", newline="", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        for row in reader:
            total += 1
            try:
                total_words += int(row.get("word_count") or 0)
            except ValueError:
                pass
            if row.get("is_attention") in {"True", "true", True}:
                attention_total += 1
                if row.get("attention_passed") in {"False", "false", "", None}:
                    attention_failed += 1

    avg_word_count = (total_words / total) if total else 0
    attention_fail_rate = (attention_failed / attention_total) if attention_total else 0

    return jsonify(
        {
            "total_submissions": total,
            "avg_word_count": avg_word_count,
            "attention_fail_rate": attention_fail_rate,
        }
    )


@app.route("/admin/download")
def download_csv():
    user = require_auth()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    ensure_csv()
    return send_from_directory(DATA_DIR, CSV_PATH.name, as_attachment=True)


@app.route("/api/docs")
@limiter.limit("30 per minute")
def api_docs():
    """Comprehensive API documentation"""
    return jsonify({
        "title": "C.O.G.N.I.T. API Documentation",
        "version": "2.1.0",
        "description": "Complete API documentation for the C.O.G.N.I.T. research platform",
        "base_url": "/api",
        "authentication": {
            "type": "Session Token",
            "description": "Admin endpoints require a session token. Login with username/password to obtain a token.",
            "methods": [
                "X-SESSION-TOKEN header"
            ],
            "login_endpoint": "/api/admin/login",
            "token_ttl_hours": 24
        },
        "endpoints": {
            "public": {
                "description": "Endpoints accessible without authentication",
                "routes": [
                    {
                        "path": "/api/health",
                        "method": "GET",
                        "description": "Health check endpoint to verify system connectivity",
                        "response": {
                            "status": "string (healthy/degraded)",
                            "timestamp": "ISO format timestamp",
                            "services": {
                                "database": "string",
                                "data_storage": "string",
                                "images": "string"
                            }
                        }
                    },
                    {
                        "path": "/api/images/random",
                        "method": "GET",
                        "description": "Get a random image for the study",
                        "parameters": [
                            {"name": "type", "type": "string", "required": False, "description": "Image type (normal, survey, attention)", "default": "normal"}
                        ],
                        "response": {
                            "image_id": "string",
                            "image_url": "string",
                            "is_survey": "boolean",
                            "is_attention": "boolean"
                        }
                    },
                    {
                        "path": "/api/images/<image_id>",
                        "method": "GET",
                        "description": "Get a specific image file",
                        "response": "image file"
                    },
                    {
                        "path": "/api/submit",
                        "method": "POST",
                        "description": "Submit participant data",
                        "request_body": {
                            "participant_id": "string (required)",
                            "session_id": "string (required)",
                            "image_id": "string (required)",
                            "description": "string (required, min 30 words)",
                            "rating": "integer (required, 1-10)",
                            "feedback": "string (required, min 5 chars)",
                            "time_spent_seconds": "number (required)",
                            "is_survey": "boolean (required)",
                            "is_attention": "boolean (required)",
                            "attention_expected": "string",
                            "username": "string",
                            "gender": "string",
                            "age": "string",
                            "place": "string",
                            "native_language": "string",
                            "prior_experience": "string"
                        },
                        "response": {
                            "status": "string",
                            "word_count": "integer",
                            "attention_passed": "boolean"
                        }
                    },
                    {
                        "path": "/api/security/info",
                        "method": "GET",
                        "description": "Get security configuration information",
                        "response": {
                            "security": {
                                "rate_limits": "object",
                                "cors_allowed_origins": "array",
                                "security_headers": "array",
                                "data_protection": "object"
                            }
                        }
                    },
                    {
                        "path": "/api/docs",
                        "method": "GET",
                        "description": "Get API documentation (this endpoint)",
                        "response": "this documentation"
                    }
                ]
            },
            "admin": {
                "description": "Endpoints requiring admin authentication (X-SESSION-TOKEN header required unless noted)",
                "routes": [
                    {
                        "path": "/api/admin/login",
                        "method": "POST",
                        "description": "Admin login endpoint (no token required)",
                        "request_body": {
                            "username": "string (required)",
                            "password": "string (required)"
                        },
                        "response": {
                            "status": "string",
                            "session_token": "string",
                            "user": "object"
                        }
                    },
                    {
                        "path": "/api/admin/logout",
                        "method": "POST",
                        "description": "Admin logout endpoint",
                        "headers": [
                            {"name": "X-SESSION-TOKEN", "type": "string", "required": False, "description": "Session token to invalidate"}
                        ],
                        "response": {
                            "status": "string",
                            "message": "string"
                        }
                    },
                    {
                        "path": "/api/admin/me",
                        "method": "GET",
                        "description": "Get current admin user info",
                        "headers": [
                            {"name": "X-SESSION-TOKEN", "type": "string", "required": True, "description": "Session token from login"}
                        ],
                        "response": {
                            "username": "string",
                            "role": "string",
                            "email": "string",
                            "created_at": "string",
                            "last_login": "string",
                            "auth_method": "string"
                        }
                    },
                    {
                        "path": "/api/stats",
                        "method": "GET",
                        "description": "Get statistics about submissions",
                        "headers": [
                            {"name": "X-SESSION-TOKEN", "type": "string", "required": True, "description": "Session token from login"}
                        ],
                        "response": {
                            "total_submissions": "integer",
                            "avg_word_count": "number",
                            "attention_fail_rate": "number"
                        }
                    },
                    {
                        "path": "/admin/download",
                        "method": "GET",
                        "description": "Download CSV file with all submissions",
                        "headers": [
                            {"name": "X-SESSION-TOKEN", "type": "string", "required": True, "description": "Session token from login"}
                        ],
                        "response": "CSV file attachment"
                    },
                    {
                        "path": "/admin/csv-data",
                        "method": "GET",
                        "description": "Get CSV data as JSON for admin panel",
                        "headers": [
                            {"name": "X-SESSION-TOKEN", "type": "string", "required": True, "description": "Session token from login"}
                        ],
                        "response": "array of submission objects"
                    },
                    {
                        "path": "/admin/settings/csv-delete",
                        "method": "DELETE",
                        "description": "Delete all data from CSV file",
                        "headers": [
                            {"name": "X-SESSION-TOKEN", "type": "string", "required": True, "description": "Session token from login"}
                        ],
                        "response": {
                            "status": "string",
                            "message": "string"
                        }
                    },
                    {
                        "path": "/admin/security/audit",
                        "method": "GET",
                        "description": "Run security audit",
                        "headers": [
                            {"name": "X-SESSION-TOKEN", "type": "string", "required": True, "description": "Session token from login"}
                        ],
                        "response": {
                            "security_audit": {
                                "timestamp": "string",
                                "status": "string",
                                "checks": "object",
                                "recommendations": "array"
                            }
                        }
                    }
                ]
            }
        },
        "data_structures": {
            "submission": {
                "description": "Structure of a submission record",
                "fields": {
                    "timestamp": "ISO format timestamp",
                    "participant_id": "UUID string",
                    "session_id": "UUID string",
                    "image_id": "string (path to image)",
                    "image_url": "string (URL to image)",
                    "description": "string (participant description)",
                    "word_count": "integer",
                    "rating": "integer (1-10)",
                    "feedback": "string (participant comments)",
                    "time_spent_seconds": "number",
                    "is_survey": "boolean",
                    "is_attention": "boolean",
                    "attention_passed": "boolean",
                    "too_fast_flag": "boolean",
                    "user_agent": "string",
                    "ip_hash": "string (SHA-256 hash)",
                    "username": "string",
                    "gender": "string",
                    "age": "string",
                    "place": "string",
                    "native_language": "string",
                    "prior_experience": "string"
                }
            }
        },
        "error_codes": {
            "400": "Bad Request - Invalid parameters or missing required fields",
            "401": "Unauthorized - Invalid or missing session token",
            "404": "Not Found - Resource not found",
            "415": "Unsupported Media Type - JSON required for POST",
            "429": "Too Many Requests - Rate limit exceeded",
            "500": "Internal Server Error - Server-side error"
        },
        "rate_limits": {
            "default": "200 requests per day, 50 requests per hour",
            "api_docs": "30 requests per minute",
            "admin_login": "10 requests per minute",
            "admin_change_password": "5 requests per minute",
            "admin_csv_data": "10 requests per minute",
            "admin_csv_delete": "5 requests per minute",
            "security_audit": "5 requests per minute"
        },
        "security": {
            "cors": "Cross-Origin Resource Sharing is restricted to specific origins",
            "headers": "Security headers are applied to all responses",
            "ip_hashing": "IP addresses are hashed with SHA-256 and salt for privacy",
            "data_storage": "Data is stored in CSV format with restricted access"
        },
        "changelog": [
            {
                "version": "2.1.0",
                "date": "2024",
                "changes": [
                    "Expanded image catalog",
                    "Refreshed API documentation to reflect all routes",
                    "Aligned admin schema with email verification flag"
                ]
            },
            {
                "version": "2.0.0",
                "date": "2024",
                "changes": [
                    "Added SQLite database for admin user management",
                    "Enhanced admin authentication system",
                    "Added comprehensive API documentation",
                    "Improved admin dashboard with charts and filters",
                    "Fixed data explorer search functionality",
                    "Added demographic data collection",
                    "Removed NASA-TLX workload assessment",
                    "Added gender, age, and place fields to demographics"
                ]
            },
            {
                "version": "1.0.0",
                "date": "2023",
                "changes": [
                    "Initial release of C.O.G.N.I.T. platform",
                    "Basic participant workflow",
                    "Admin panel with statistics",
                    "CSV data export functionality"
                ]
            }
        ]
    })


@app.route("/admin/csv-data")
@limiter.limit("10 per minute")
def get_csv_data():
    """Get CSV data as JSON for admin panel"""
    user = require_auth()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    ensure_csv()
    
    try:
        with CSV_PATH.open("r", newline="", encoding="utf-8") as file:
            reader = csv.DictReader(file)
            data = [row for row in reader]
        
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": f"Failed to read CSV: {str(e)}"}), 500


@app.route("/admin/settings/csv-delete", methods=["DELETE"])
@limiter.limit("5 per minute")
def delete_csv_data():
    """Delete all data from CSV file (admin only)"""
    user = require_auth()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        # Re-create the CSV file with just the headers
        with CSV_PATH.open("w", newline="", encoding="utf-8") as file:
            writer = csv.writer(file)
            writer.writerow(CSV_HEADERS)
        
        return jsonify({
            "status": "success",
            "message": "All CSV data has been deleted successfully"
        })
    except Exception as e:
        return jsonify({"error": f"Failed to delete CSV data: {str(e)}"}), 500


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
                "storage": "CSV with restricted access"
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
    
    # In a real app, this would check various security aspects
    return jsonify({
        "security_audit": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "ok",
            "checks": {
                "password_validation": "enabled",
                "rate_limiting": "enabled",
                "cors_restrictions": "enabled",
                "security_headers": "enabled",
                "data_encryption": "enabled (IP hashing)",
                "csrf_protection": "available"
            },
            "recommendations": [
                "Change password regularly",
                "Monitor failed login attempts",
                "Review CORS origins in production",
                "Enable HTTPS in production"
            ]
        }
    })

@app.route("/api/admin/login", methods=["POST"])
@limiter.limit("10 per minute")
def admin_login():
    """Admin login endpoint - accepts username/password"""
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    
    if not username:
        return jsonify({"error": "Username is required"}), 400
    
    if not password:
        return jsonify({"error": "Password is required"}), 400
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if user exists and is verified
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
        
        # Verify password
        input_hash = hash_password(password)
        if input_hash != stored_password_hash:
            # Log failed attempt
            ip_address = request.headers.get("X-Forwarded-For", request.remote_addr) or "unknown"
            cursor.execute(
                "INSERT INTO admin_audit_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)",
                (user_id, 'login_failed', 'Invalid password', ip_address)
            )
            conn.commit()
            return jsonify({"error": "Invalid credentials"}), 401
        
        # Generate session token
        session_token = secrets.token_hex(32)
        
        # Store session
        ip_address = request.headers.get("X-Forwarded-For", request.remote_addr) or "unknown"
        user_agent = request.headers.get("User-Agent", "")
        expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
        
        cursor.execute(
            "INSERT INTO admin_sessions (user_id, session_token, expires_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)",
            (user_id, session_token, expires_at.isoformat(), ip_address, user_agent)
        )
        
        # Update last login time
        cursor.execute(
            "UPDATE admin_users SET last_login = ? WHERE id = ?",
            (datetime.now(timezone.utc).isoformat(), user_id)
        )
        
        # Log successful login
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
        
    finally:
        conn.close()


@app.route("/api/admin/logout", methods=["POST"])
def admin_logout():
    """Admin logout endpoint"""
    session_token = request.headers.get("X-SESSION-TOKEN")
    
    if session_token:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        try:
            cursor.execute("DELETE FROM admin_sessions WHERE session_token = ?", (session_token,))
            conn.commit()
        finally:
            conn.close()
    
    return jsonify({"status": "success", "message": "Logged out successfully"})


@app.route("/api/admin/me")
def admin_me():
    """Get current admin user info"""
    session_token = request.headers.get("X-SESSION-TOKEN")
    
    if not session_token:
        return jsonify({"error": "Unauthorized"}), 401
    
    # Try session token
    user = get_user_from_session(session_token)
    if user:
        return jsonify({
            "username": user["username"],
            "role": user["role"],
            "email": user["email"],
            "created_at": user["created_at"],
            "last_login": user["last_login"],
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
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Get current password hash
        cursor.execute(
            "SELECT password_hash FROM admin_users WHERE id = ?",
            (user["id"],)
        )
        result = cursor.fetchone()
        
        if not result:
            return jsonify({"error": "User not found"}), 404
        
        stored_hash = result[0]
        
        # Verify current password
        if hash_password(current_password) != stored_hash:
            return jsonify({"error": "Current password is incorrect"}), 401
        
        # Update password
        new_hash = hash_password(new_password)
        cursor.execute(
            "UPDATE admin_users SET password_hash = ? WHERE id = ?",
            (new_hash, user["id"])
        )
        
        # Log password change
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
        
    finally:
        conn.close()


if __name__ == "__main__":
    ensure_csv()
    init_db()
    print("Starting C.O.G.N.I.T. backend server...")
    print("API Documentation available at: http://localhost:5000/api/docs")
    print("API available at: http://localhost:5000/api/")
    app.run(debug=True, host='0.0.0.0', port=5001)
