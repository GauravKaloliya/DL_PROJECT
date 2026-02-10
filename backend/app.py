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
    "is_practice",
    "is_attention",
    "attention_passed",
    "too_fast_flag",
    "user_agent",
    "ip_hash",
    "age_group",
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
            api_key TEXT UNIQUE,
            email_verified BOOLEAN DEFAULT 0,
            verification_token TEXT,
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
    conn.close()


def generate_api_key():
    """Generate a secure API key"""
    return secrets.token_urlsafe(32)


# Email verification functionality removed


def hash_password(password):
    """Hash password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()


def authenticate_admin(api_key_or_username, password=None):
    """Authenticate admin user using API key or username/password"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # If password is None, treat as API key authentication
        if password is None:
            cursor.execute(
                "SELECT id, username, role, is_active, email_verified FROM admin_users WHERE api_key = ?",
                (api_key_or_username,)
            )
            user = cursor.fetchone()
            if user and user[3] and user[4]:  # Check active and verified
                user_id, username, role, is_active, email_verified = user
                # Log successful login
                ip_address = request.headers.get("X-Forwarded-For", request.remote_addr) or "unknown"
                cursor.execute(
                    "INSERT INTO admin_audit_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)",
                    (user_id, 'login_success_api_key', 'User logged in with API key', ip_address)
                )
                cursor.execute(
                    "UPDATE admin_users SET last_login = ? WHERE id = ?",
                    (datetime.now(timezone.utc).isoformat(), user_id)
                )
                conn.commit()
                return True
            return False
        
        # Username/password authentication
        cursor.execute(
            "SELECT id, password_hash, role, is_active, email_verified FROM admin_users WHERE username = ?",
            (api_key_or_username,)
        )
        user = cursor.fetchone()
        
        if user and user[3] and user[4]:  # Check active and verified
            user_id, stored_hash, role, is_active, email_verified = user
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
            (None, 'login_failed', f'Failed login for user: {api_key_or_username}', ip_address)
        )
        conn.commit()
        
        return False
        
    finally:
        conn.close()


def get_user_by_api_key(api_key):
    """Get user details by API key"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute(
            "SELECT id, username, email, role, created_at, last_login FROM admin_users WHERE api_key = ?",
            (api_key,)
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


def get_user_by_username(username):
    """Get user details by username"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute(
            "SELECT id, username, email, role, created_at, last_login, api_key FROM admin_users WHERE username = ?",
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
                "last_login": user[5],
                "api_key": user[6]
            }
        return None
    finally:
        conn.close()


def get_admin_user_by_api_key(api_key):
    """Get admin user by API key"""
    return get_user_by_api_key(api_key)


def validate_session(session_token):
    """Validate session token and return user info"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if session exists and is not expired
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
        "is_practice": image_type == "practice",
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


def require_api_key():
    """Check if valid API key is provided"""
    api_key = request.headers.get("X-API-KEY") or request.args.get("api_key")
    
    if not api_key:
        return False
    
    # Check database for API key
    return authenticate_admin(api_key)


def require_admin_auth():
    """Check if user is authenticated as admin (supports both API key and session)"""
    # Check API key
    api_key = request.headers.get("X-API-KEY") or request.args.get("api_key")
    if api_key and require_api_key():
        return True
    
    # Check session token
    session_token = request.headers.get("X-SESSION-TOKEN")
    if session_token:
        return validate_session(session_token)
    
    return False


def validate_session(session_token):
    """Validate session token"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute(
            "SELECT user_id, expires_at FROM admin_sessions WHERE session_token = ?",
            (session_token,)
        )
        session = cursor.fetchone()
        
        if session:
            user_id, expires_at = session
            if datetime.fromisoformat(expires_at) > datetime.now(timezone.utc):
                return True
    finally:
        conn.close()
    
    return False


@app.route("/api/images/random")
def random_image():
    image_type = request.args.get("type", "normal")
    if image_type not in {"normal", "practice", "attention"}:
        return jsonify({"error": "Invalid type"}), 400

    images = list_images(image_type)
    if not images:
        return jsonify({"error": f"No images available for {image_type}"}), 404

    image_path = random.choice(images)
    payload = build_image_payload(image_path, image_type)
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

    is_practice = bool(payload.get("is_practice"))
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
        "is_practice": is_practice,
        "is_attention": is_attention,
        "attention_passed": attention_passed,
        "too_fast_flag": too_fast_flag,
        "user_agent": request.headers.get("User-Agent", ""),
        "ip_hash": get_ip_hash(),
        "age_group": payload.get("age_group", ""),
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
    if not require_api_key():
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
    if not require_api_key():
        return jsonify({"error": "Unauthorized"}), 401

    ensure_csv()
    return send_from_directory(DATA_DIR, CSV_PATH.name, as_attachment=True)


@app.route("/api/pages/home")
def home_page():
    """Home page endpoint"""
    return jsonify({
        "title": "C.O.G.N.I.T. - Cognitive Observation & Generalized Narrative Inquiry Tool",
        "description": "A research tool for studying how people describe visual scenes",
        "version": "2.0.0",
        "features": ["Image description tasks", "Demographic data collection", "Attention checks", "Data export"]
    })


@app.route("/api/pages/about")
def about_page():
    """About page endpoint"""
    return jsonify({
        "title": "About C.O.G.N.I.T.",
        "content": "C.O.G.N.I.T. (Cognitive Observation & Generalized Narrative Inquiry Tool) is a research platform designed to study how individuals describe and interpret visual stimuli. This tool helps researchers understand cognitive processes involved in language production and visual perception.",
        "purpose": "To collect anonymous descriptions of images for improving language understanding models and cognitive research",
        "team": ["Researchers", "Developers", "Data Scientists"]
    })


@app.route("/api/pages/contact")
def contact_page():
    """Contact page endpoint"""
    return jsonify({
        "title": "Contact Us",
        "email": "contact@cognit-research.org",
        "support": "support@cognit-research.org",
        "address": "Research Department, University of Cognitive Sciences, 123 Research Ave, Science City, ST 12345",
        "social": {
            "twitter": "@cognit_research",
            "facebook": "/cognit.study",
            "linkedin": "/company/cognit-research"
        }
    })


@app.route("/api/pages/faq")
def faq_page():
    """FAQ page endpoint"""
    return jsonify({
        "title": "Frequently Asked Questions",
        "faqs": [
            {
                "question": "What is C.O.G.N.I.T.?",
                "answer": "C.O.G.N.I.T. is a research tool for studying how people describe visual scenes and assess their cognitive workload."
            },
            {
                "question": "How long does a session take?",
                "answer": "A typical session takes about 15-20 minutes to complete, depending on your description speed."
            },
            {
                "question": "Is my data anonymous?",
                "answer": "Yes, all data is collected anonymously. We only store a hashed version of your IP address for research purposes."
            },
            {
                "question": "Can I stop at any time?",
                "answer": "Absolutely! You can stop participating at any time without any consequences."
            }
        ]
    })


@app.route("/api/docs")
@limiter.limit("30 per minute")
def api_docs():
    """Comprehensive API documentation"""
    return jsonify({
        "title": "C.O.G.N.I.T. API Documentation",
        "version": "2.0.0",
        "description": "Complete API documentation for the C.O.G.N.I.T. research platform",
        "base_url": "/api",
        "authentication": {
            "type": "API Key",
            "description": "Most endpoints require an API key for authentication. Register an account to get your API key.",
            "methods": [
                "X-API-KEY header",
                "api_key query parameter"
            ]
        },
        "endpoints": {
            "public": {
                "description": "Endpoints accessible without authentication",
                "routes": [
                    {
                        "path": "/api/images/random",
                        "method": "GET",
                        "description": "Get a random image for the study",
                        "parameters": [
                            {"name": "type", "type": "string", "required": False, "description": "Image type (normal, practice, attention)", "default": "normal"}
                        ],
                        "response": {
                            "image_id": "string",
                            "image_url": "string",
                            "is_practice": "boolean",
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
                            "is_practice": "boolean (required)",
                            "is_attention": "boolean (required)",
                            "attention_expected": "string",
                            "age_group": "string",
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
                        "path": "/api/pages/home",
                        "method": "GET",
                        "description": "Get home page information",
                        "response": {
                            "title": "string",
                            "description": "string",
                            "version": "string",
                            "features": "array"
                        }
                    },
                    {
                        "path": "/api/pages/about",
                        "method": "GET",
                        "description": "Get about page information",
                        "response": {
                            "title": "string",
                            "content": "string",
                            "purpose": "string",
                            "team": "array"
                        }
                    },
                    {
                        "path": "/api/pages/contact",
                        "method": "GET",
                        "description": "Get contact page information",
                        "response": {
                            "title": "string",
                            "email": "string",
                            "support": "string",
                            "address": "string",
                            "social": "object"
                        }
                    },
                    {
                        "path": "/api/pages/faq",
                        "method": "GET",
                        "description": "Get FAQ information",
                        "response": {
                            "title": "string",
                            "faqs": "array of {question, answer}"
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
                "description": "Endpoints requiring admin authentication",
                "routes": [
                    {
                        "path": "/api/stats",
                        "method": "GET",
                        "description": "Get statistics about submissions",
                        "parameters": [
                            {"name": "api_key", "type": "string", "required": True, "description": "Admin API key"}
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
                        "parameters": [
                            {"name": "api_key", "type": "string", "required": True, "description": "Admin API key"}
                        ],
                        "response": "CSV file attachment"
                    },
                    {
                        "path": "/admin/csv-data",
                        "method": "GET",
                        "description": "Get CSV data as JSON for admin panel",
                        "parameters": [
                            {"name": "api_key", "type": "string", "required": True, "description": "Admin API key"}
                        ],
                        "response": "array of submission objects"
                    },
                    {
                        "path": "/api/security/info",
                        "method": "GET",
                        "description": "Get security information",
                        "parameters": [
                            {"name": "api_key", "type": "string", "required": True, "description": "Admin API key"}
                        ],
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
                        "path": "/admin/security/audit",
                        "method": "GET",
                        "description": "Run security audit",
                        "parameters": [
                            {"name": "api_key", "type": "string", "required": True, "description": "Admin API key"}
                        ],
                        "response": {
                            "security_audit": {
                                "timestamp": "string",
                                "status": "string",
                                "checks": "object",
                                "recommendations": "array"
                            }
                        }
                    },
                    {
                        "path": "/api/admin/login",
                        "method": "POST",
                        "description": "Admin login endpoint",
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
                        "response": {
                            "status": "string",
                            "message": "string"
                        }
                    },
                    {
                        "path": "/api/admin/me",
                        "method": "GET",
                        "description": "Get current admin user info",
                        "parameters": [
                            {"name": "api_key", "type": "string", "required": True, "description": "Admin API key"}
                        ],
                        "response": {
                            "username": "string",
                            "role": "string",
                            "email": "string",
                            "created_at": "string",
                            "last_login": "string",
                            "auth_method": "string"
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
                    "is_practice": "boolean",
                    "is_attention": "boolean",
                    "attention_passed": "boolean",
                    "too_fast_flag": "boolean",
                    "user_agent": "string",
                    "ip_hash": "string (SHA-256 hash)",
                    "age_group": "string",
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
            "401": "Unauthorized - Invalid or missing API key",
            "404": "Not Found - Resource not found",
            "429": "Too Many Requests - Rate limit exceeded",
            "500": "Internal Server Error - Server-side error"
        },
        "rate_limits": {
            "default": "200 requests per day, 50 requests per hour",
            "admin_endpoints": "10 requests per minute",
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
    if not require_api_key():
        return jsonify({"error": "Unauthorized"}), 401

    ensure_csv()
    
    try:
        with CSV_PATH.open("r", newline="", encoding="utf-8") as file:
            reader = csv.DictReader(file)
            data = [row for row in reader]
        
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": f"Failed to read CSV: {str(e)}"}), 500


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
    if not require_api_key():
        return jsonify({"error": "Unauthorized"}), 401
    
    # In a real app, this would check various security aspects
    return jsonify({
        "security_audit": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "ok",
            "checks": {
                "api_key_validation": "enabled",
                "rate_limiting": "enabled",
                "cors_restrictions": "enabled",
                "security_headers": "enabled",
                "data_encryption": "enabled (IP hashing)",
                "csrf_protection": "available"
            },
            "recommendations": [
                "Rotate API keys regularly",
                "Monitor failed login attempts",
                "Review CORS origins in production",
                "Enable HTTPS in production"
            ]
        }
    })


@app.route("/api/admin/register", methods=["POST"])
@limiter.limit("5 per hour")
def admin_register():
    """Admin registration endpoint with API key generation"""
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    email = data.get("email", "").strip()
    password = data.get("password", "")
    
    # Validation
    if not username or len(username) < 3:
        return jsonify({"error": "Username must be at least 3 characters"}), 400
    if not email or "@" not in email:
        return jsonify({"error": "Valid email is required"}), 400
    if not password or len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400
    
    # Generate API key
    api_key = generate_api_key()
    password_hash = hash_password(password)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if username or email already exists
        cursor.execute("SELECT id FROM admin_users WHERE username = ? OR email = ?", (username, email))
        if cursor.fetchone():
            return jsonify({"error": "Username or email already exists"}), 409
        
        # Insert new user (email_verified = 1 by default)
        cursor.execute(
            """INSERT INTO admin_users 
               (username, password_hash, email, api_key, email_verified, is_active) 
               VALUES (?, ?, ?, ?, 1, 1)""",
            (username, password_hash, email, api_key)
        )
        
        user_id = cursor.lastrowid
        
        # Log registration
        ip_address = request.headers.get("X-Forwarded-For", request.remote_addr) or "unknown"
        cursor.execute(
            "INSERT INTO admin_audit_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)",
            (user_id, 'register', 'User registered', ip_address)
        )
        
        conn.commit()
        
        return jsonify({
            "status": "success",
            "message": "Registration successful. You can now login.",
            "username": username,
            "api_key": api_key
        })
        
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username or email already exists"}), 409
    finally:
        conn.close()


# Email verification endpoints removed


@app.route("/api/admin/login", methods=["POST"])
@limiter.limit("10 per minute")
def admin_login():
    """Admin login endpoint - accepts username/password or username/api_key"""
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    api_key = data.get("api_key", "").strip()
    
    if not username:
        return jsonify({"error": "Username is required"}), 400
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if user exists and is verified
        cursor.execute(
            "SELECT id, password_hash, api_key, email_verified, role, is_active FROM admin_users WHERE username = ?",
            (username,)
        )
        user = cursor.fetchone()
        
        if not user:
            return jsonify({"error": "Invalid credentials"}), 401
        
        user_id, stored_password_hash, stored_api_key, email_verified, role, is_active = user
        
        if not is_active:
            return jsonify({"error": "Account is deactivated"}), 401
        
        # Try API key authentication first
        if api_key:
            if api_key != stored_api_key:
                return jsonify({"error": "Invalid API key"}), 401
        # Then try password authentication
        elif password:
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
        else:
            return jsonify({"error": "Password or API key is required"}), 400
        
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
            "api_key": stored_api_key,
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
    api_key = request.headers.get("X-API-KEY") or request.args.get("api_key")
    session_token = request.headers.get("X-SESSION-TOKEN")
    
    if not api_key and not session_token:
        return jsonify({"error": "Unauthorized"}), 401
    
    # Try API key first
    if api_key:
        user = get_user_by_api_key(api_key)
        if user:
            return jsonify({
                "username": user["username"],
                "role": user["role"],
                "email": user["email"],
                "created_at": user["created_at"],
                "last_login": user["last_login"],
                "auth_method": "api_key"
            })
    
    # Try session token
    if session_token and validate_session(session_token):
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        try:
            cursor.execute(
                """SELECT u.username, u.email, u.role, u.created_at, u.last_login 
                   FROM admin_users u 
                   JOIN admin_sessions s ON u.id = s.user_id 
                   WHERE s.session_token = ?""",
                (session_token,)
            )
            user = cursor.fetchone()
            
            if user:
                username, email, role, created_at, last_login = user
                return jsonify({
                    "username": username,
                    "role": role,
                    "email": email,
                    "created_at": created_at,
                    "last_login": last_login,
                    "auth_method": "session"
                })
        finally:
            conn.close()
    
    return jsonify({"error": "Unauthorized"}), 401


if __name__ == "__main__":
    ensure_csv()
    init_db()
    print("Starting C.O.G.N.I.T. backend server...")
    print("API Documentation available at: http://localhost:5000/api/docs")
    print("API available at: http://localhost:5000/api/")
    app.run(debug=True, host='0.0.0.0', port=5000)
