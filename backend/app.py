import csv
import hashlib
import os
import random
import sqlite3
import re
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

MIN_WORD_COUNT = int(os.getenv("MIN_WORD_COUNT", "30"))
TOO_FAST_SECONDS = float(os.getenv("TOO_FAST_SECONDS", "5"))
IP_HASH_SALT = os.getenv("IP_HASH_SALT", "local-salt")

app = Flask(__name__)

# Security Configuration
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'local-secret-key')
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = 1800  # 30 minutes

# CORS Configuration
CORS(app, resources={
    r"/api/*": {"origins": ["http://localhost:5173", "https://your-production-domain.com"]}
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
    
    # Create submissions table
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
        ("idx_consent_participant", "consent_records", "participant_id"),
    ]
    
    for idx_name, table, column in indexes:
        try:
            cursor.execute(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {table}({column})")
        except sqlite3.OperationalError:
            pass  # Index might already exist


def get_ip_hash():
    """Generate hash of IP address for privacy"""
    ip_address = request.headers.get("X-Forwarded-For", request.remote_addr) or "unknown"
    digest = hashlib.sha256(f"{ip_address}{IP_HASH_SALT}".encode("utf-8")).hexdigest()
    return digest


def count_words(text: str):
    """Count words in text"""
    return len([word for word in text.strip().split() if word])


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


# ============== SECURITY ENDPOINTS ==============

@app.route("/api/security/info")
def security_info():
    """Get security information"""
    return jsonify({
        "security": {
            "rate_limits": {
                "default": "200 per day, 50 per hour"
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


# ============== API DOCUMENTATION ==============

@app.route("/api/docs")
@limiter.limit("30 per minute")
def api_docs():
    """Comprehensive API documentation"""
    return jsonify({
        "title": "C.O.G.N.I.T. API Documentation",
        "version": "3.0.0",
        "description": "Complete API documentation for the C.O.G.N.I.T. research platform",
        "base_url": "/api",
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
            }
        }
    })


if __name__ == "__main__":
    init_db()
    print("Starting C.O.G.N.I.T. backend server...")
    print("API Documentation available at: http://localhost:5000/api/docs")
    print("API available at: http://localhost:5000/api/")
    app.run(debug=True, host='0.0.0.0', port=5000)
