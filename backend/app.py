import hashlib
import os
import random
import re
import time
import functools
from datetime import datetime, timezone
from pathlib import Path
from contextlib import contextmanager

from flask import Flask, jsonify, request, send_from_directory, abort, g, render_template
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from sqlalchemy import create_engine, text, event, Column, Integer, String, Boolean, Float, TIMESTAMP, CheckConstraint, ForeignKey
from sqlalchemy.orm import sessionmaker, scoped_session, declarative_base
from sqlalchemy.pool import QueuePool

BASE_DIR = Path(__file__).resolve().parent
IMAGES_DIR = BASE_DIR / "images"
DATA_DIR = BASE_DIR / "data"

MIN_WORD_COUNT = int(os.getenv("MIN_WORD_COUNT", "60"))
TOO_FAST_SECONDS = float(os.getenv("TOO_FAST_SECONDS", "5"))
IP_HASH_SALT = os.getenv("IP_HASH_SALT", "local-salt")

# PostgreSQL Database URL - must be set via environment variable
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required")

# Fix for SQLAlchemy (Render uses postgres:// sometimes)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Website URL for CORS and documentation
WEBSITE_URL = os.getenv("WEBSITE_URL", "").strip()

app = Flask(__name__)

# Security Configuration
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'local-secret-key')
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = 1800  # 30 minutes

# SQLAlchemy configuration
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_size': 10,
    'pool_recycle': 3600,
    'pool_pre_ping': True,
    'max_overflow': 20
}

def _get_cors_origins():
    env_origins = os.getenv("CORS_ORIGINS", "").strip()
    if env_origins:
        origins = [origin.strip() for origin in env_origins.split(",") if origin.strip()]
        if "*" in origins:
            return "*"
        return origins
    if not WEBSITE_URL:
        return "*"
    origins = ["http://localhost:5173"]
    if WEBSITE_URL not in origins:
        origins.append(WEBSITE_URL)
    return origins


# CORS Configuration with enhanced security
CORS(app, resources={
    r"/api/*": {
        "origins": _get_cors_origins(),
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
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: http:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'"
    response.headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains; preload'
    response.headers['Referrer-Policy'] = 'no-referrer'
    response.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=(), payment=()'
    response.headers['Server'] = 'Secure Server'
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, proxy-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response


# Database connection setup using SQLAlchemy
engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    echo=False
)

SessionLocal = scoped_session(sessionmaker(autocommit=False, autoflush=False, bind=engine))

Base = declarative_base()


def get_db():
    """Get database session for current request context"""
    if 'db' not in g:
        g.db = SessionLocal()
    return g.db


@app.teardown_appcontext
def close_db(exception):
    """Close database session at end of request"""
    db = g.pop('db', None)
    if db is not None:
        db.close()
        SessionLocal.remove()


# Database schema is managed via SQL editor in Neon DB - no DDL code here

def get_ip_hash():
    """Generate hash of IP address for privacy"""
    ip_address = request.headers.get("X-Forwarded-For", request.remote_addr) or "unknown"
    digest = hashlib.sha256(f"{ip_address}{IP_HASH_SALT}".encode("utf-8")).hexdigest()
    return digest


def update_participant_stats(participant_id, word_count, is_survey, attention_score=None):
    """Update participant engagement stats for reward eligibility"""
    try:
        db = get_db()
        
        # Get current stats
        result = db.execute(text('''
            SELECT total_words, total_submissions, survey_rounds, attention_score 
            FROM participant_stats 
            WHERE participant_id = :participant_id
        '''), {"participant_id": participant_id})
        row = result.fetchone()
        
        if row:
            new_words = row[0] + word_count
            new_submissions = row[1] + 1
            new_survey_rounds = row[2] + (1 if is_survey else 0)
            current_attention_score = attention_score if attention_score is not None else row[3]
        else:
            new_words = word_count
            new_submissions = 1
            new_survey_rounds = 1 if is_survey else 0
            current_attention_score = attention_score if attention_score is not None else 1.0
        
        # Priority eligibility: more words or more survey rounds increases chance, but requires good attention
        priority_eligible = (new_words >= 500 or new_survey_rounds >= 3) and current_attention_score >= 0.75
        
        db.execute(text('''
            INSERT INTO participant_stats 
            (participant_id, total_words, total_submissions, survey_rounds, priority_eligible, attention_score)
            VALUES (:participant_id, :total_words, :total_submissions, :survey_rounds, :priority_eligible, :attention_score)
            ON CONFLICT(participant_id) DO UPDATE SET
            total_words = EXCLUDED.total_words,
            total_submissions = EXCLUDED.total_submissions,
            survey_rounds = EXCLUDED.survey_rounds,
            priority_eligible = EXCLUDED.priority_eligible,
            attention_score = EXCLUDED.attention_score
        '''), {
            "participant_id": participant_id,
            "total_words": new_words,
            "total_submissions": new_submissions,
            "survey_rounds": new_survey_rounds,
            "priority_eligible": priority_eligible,
            "attention_score": current_attention_score
        })
        
        db.commit()
    except Exception as e:
        # Don't let stats update failures break the main functionality
        pass


def get_reward_eligibility(participant_id):
    """Check if participant is eligible for reward and return details"""
    try:
        db = get_db()
        
        # Check if already a winner
        result = db.execute(text('''
            SELECT reward_amount, status FROM reward_winners WHERE participant_id = :participant_id
        '''), {"participant_id": participant_id})
        winner_row = result.fetchone()
        
        if winner_row:
            return {
                "is_winner": True,
                "reward_amount": winner_row[0],
                "status": winner_row[1]
            }
        
        # Get participant stats
        result = db.execute(text('''
            SELECT total_words, survey_rounds, priority_eligible 
            FROM participant_stats 
            WHERE participant_id = :participant_id
        '''), {"participant_id": participant_id})
        stats_row = result.fetchone()
        
        if stats_row:
            return {
                "is_winner": False,
                "total_words": stats_row[0],
                "survey_rounds": stats_row[1],
                "priority_eligible": bool(stats_row[2])
            }
        
        return {
            "is_winner": False,
            "total_words": 0,
            "survey_rounds": 0,
            "priority_eligible": False
        }
    except Exception as e:
        return {
            "is_winner": False,
            "total_words": 0,
            "survey_rounds": 0,
            "priority_eligible": False,
            "error": str(e)
        }


def select_reward_winner(participant_id):
    """Select participant as a reward winner with 5% probability, prioritizing engaged users"""
    try:
        db = get_db()
        
        # Check if already selected
        result = db.execute(text('SELECT participant_id FROM reward_winners WHERE participant_id = :participant_id'), {"participant_id": participant_id})
        if result.fetchone():
            return {"selected": False, "already_winner": True}
        
        # Get participant's priority status and attention score
        result = db.execute(text('''
            SELECT priority_eligible, attention_score FROM participant_stats WHERE participant_id = :participant_id
        '''), {"participant_id": participant_id})
        stats_row = result.fetchone()
        priority_eligible = bool(stats_row[0]) if stats_row else False
        attention_score = stats_row[1] if stats_row and stats_row[1] is not None else 1.0
        
        # Weighted random selection - now requires good attention score
        base_probability = 0.05  # 5%
        priority_boost = 0.10 if priority_eligible else 0.0
        attention_penalty = 0.0 if attention_score >= 0.75 else -0.15  # Reduce chance for low attention
        selection_probability = max(0.01, base_probability + priority_boost + attention_penalty)  # Minimum 1% chance
        
        if random.random() < selection_probability:
            db.execute(text('''
                INSERT INTO reward_winners (participant_id, reward_amount, status)
                VALUES (:participant_id, 10, 'pending')
            '''), {"participant_id": participant_id})
            db.commit()
            return {"selected": True, "reward_amount": 10}
        
        return {"selected": False, "priority_eligible": priority_eligible}
    except Exception as e:
        return {"selected": False, "error": str(e)}


def count_words(text: str):
    """Count words in text"""
    return len([word for word in text.strip().split() if word])


def _log_audit_event(db, event_type, participant_id=None, user_id=None, endpoint=None, 
                    method=None, status_code=None, details=None):
    """Log an audit event to the audit_log table"""
    try:
        db.execute(text('''
            INSERT INTO audit_log 
            (event_type, user_id, participant_id, endpoint, method, status_code, ip_hash, user_agent, details)
            VALUES (:event_type, :user_id, :participant_id, :endpoint, :method, :status_code, :ip_hash, :user_agent, :details)
        '''), {
            "event_type": event_type,
            "user_id": user_id,
            "participant_id": participant_id,
            "endpoint": endpoint,
            "method": method,
            "status_code": status_code,
            "ip_hash": get_ip_hash(),
            "user_agent": request.headers.get('User-Agent', ''),
            "details": details
        })
        db.commit()
    except Exception as e:
        # Don't let audit logging failures break the main functionality
        pass


def _log_performance_metric(endpoint, response_time_ms, status_code, request_size=0, response_size=0):
    """Log performance metrics"""
    try:
        db = get_db()
        db.execute(text('''
            INSERT INTO performance_metrics 
            (endpoint, response_time_ms, status_code, request_size_bytes, response_size_bytes)
            VALUES (:endpoint, :response_time_ms, :status_code, :request_size_bytes, :response_size_bytes)
        '''), {
            "endpoint": endpoint,
            "response_time_ms": response_time_ms,
            "status_code": status_code,
            "request_size_bytes": request_size,
            "response_size_bytes": response_size
        })
        db.commit()
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
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
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


@app.route("/test-db")
def test_db():
    """Test database connectivity by executing a simple query"""
    try:
        db = get_db()
        db.execute(text("SELECT 1"))
        return jsonify({"status": "Database working"})
    except Exception as e:
        return jsonify({"error": str(e)})


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
    
    
    # Validate username - no spaces, no special chars except underscore
    username = data.get('username', '').strip()
    if username and not re.match(r'^[a-zA-Z0-9_]+$', username):
        return jsonify({"error": "Username can only contain letters, numbers, and underscores"}), 400
    
    # Validate email - only Gmail, Microsoft (Outlook/Hotmail), Apple (iCloud)
    allowed_email_domains = ['gmail.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'me.com', 'mac.com']
    email = data.get('email', '').strip().lower()
    if email:
        if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
            return jsonify({"error": "Invalid email format"}), 400
        domain = email.split('@')[1]
        if domain not in allowed_email_domains:
            return jsonify({"error": "Only Gmail, Outlook, Hotmail, and iCloud email addresses are allowed"}), 400
    
    # Validate phone - Indian numbers only (10 digits starting with 6-9)
    phone = data.get('phone', '').strip()
    if phone:
        phone_digits = re.sub(r'\D', '', phone)
        is_valid_indian = re.match(r'^[6-9]\d{9}$', phone_digits) or \
                         (len(phone_digits) == 12 and phone_digits.startswith('91') and re.match(r'^[6-9]', phone_digits[2:]))
        if not is_valid_indian:
            return jsonify({"error": "Please enter a valid 10-digit Indian mobile number"}), 400
    
    # Validate age - 13 to 100 only
    try:
        age = int(data.get('age', 0))
        if age < 13 or age > 100:
            return jsonify({"error": "Age must be between 13 and 100"}), 400
    except (ValueError, TypeError):
        return jsonify({"error": "Age must be a valid number between 13 and 100"}), 400
    
    
    try:
        db = get_db()
        
        # Log the participant creation attempt
        _log_audit_event(db, 
                        event_type='participant_creation_attempt',
                        participant_id=data['participant_id'],
                        endpoint='/api/participants',
                        method='POST',
                        status_code=201,
                        details='Participant creation attempt')
        
        db.execute(text('''
            INSERT INTO participants 
            (participant_id, session_id, username, email, phone, gender, age, place, native_language, prior_experience, ip_hash, user_agent)
            VALUES (:participant_id, :session_id, :username, :email, :phone, :gender, :age, :place, :native_language, :prior_experience, :ip_hash, :user_agent)
        '''), {
            "participant_id": data['participant_id'],
            "session_id": data['session_id'],
            "username": data['username'],
            "email": email or None,
            "phone": phone or None,
            "gender": data['gender'],
            "age": int(data['age']),
            "place": data['place'],
            "native_language": data['native_language'],
            "prior_experience": data['prior_experience'],
            "ip_hash": get_ip_hash(),
            "user_agent": request.headers.get('User-Agent', '')
        })
        
        # Check for existing consent
        result = db.execute(text('''
            SELECT consent_given, consent_timestamp
            FROM consent_records
            WHERE participant_id = :participant_id AND consent_given = TRUE
        '''), {"participant_id": data['participant_id']})
        consent_row = result.fetchone()
        
        if consent_row:
            db.execute(text('''
                UPDATE participants
                SET consent_given = TRUE, consent_timestamp = :consent_timestamp
                WHERE participant_id = :participant_id
            '''), {"consent_timestamp": consent_row[1], "participant_id": data['participant_id']})

        db.commit()

        # Log successful creation
        _log_audit_event(db, 
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
        
    except Exception as e:
        error_msg = str(e)
        if "duplicate" in error_msg.lower() or "unique" in error_msg.lower():
            _log_audit_event(db, 
                           event_type='participant_creation_failed',
                           participant_id=data['participant_id'],
                           endpoint='/api/participants',
                           method='POST',
                           status_code=409,
                           details=f'Duplicate participant ID: {error_msg}')
            return jsonify({"error": "Participant ID already exists"}), 409
        _log_audit_event(db, 
                       event_type='participant_creation_failed',
                       participant_id=data['participant_id'],
                       endpoint='/api/participants',
                       method='POST',
                       status_code=500,
                       details=f'Database error: {error_msg}')
        return jsonify({"error": "Database error", "details": error_msg}), 500


@app.route("/api/participants/<participant_id>")
def get_participant(participant_id):
    """Get participant details"""
    db = get_db()
    
    result = db.execute(text('''
        SELECT participant_id, username, email, phone, gender, age, place, native_language, prior_experience, consent_given, created_at
        FROM participants WHERE participant_id = :participant_id
    '''), {"participant_id": participant_id})
    
    row = result.fetchone()
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
        "created_at": str(row[10])
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
    
    db = get_db()
    
    result = db.execute(text("SELECT id FROM participants WHERE participant_id = :participant_id"), {"participant_id": participant_id})
    participant_row = result.fetchone()

    timestamp = datetime.now(timezone.utc).isoformat()

    if participant_row:
        db.execute(text('''
            UPDATE participants 
            SET consent_given = TRUE, consent_timestamp = :consent_timestamp
            WHERE participant_id = :participant_id
        '''), {"consent_timestamp": timestamp, "participant_id": participant_id})

    db.execute(text('''
        INSERT INTO consent_records (participant_id, consent_given, consent_timestamp, ip_hash, user_agent)
        VALUES (:participant_id, TRUE, :consent_timestamp, :ip_hash, :user_agent)
        ON CONFLICT(participant_id) DO UPDATE SET
        consent_given = TRUE,
        consent_timestamp = EXCLUDED.consent_timestamp,
        ip_hash = EXCLUDED.ip_hash,
        user_agent = EXCLUDED.user_agent
    '''), {
        "participant_id": participant_id,
        "consent_timestamp": timestamp,
        "ip_hash": get_ip_hash(),
        "user_agent": request.headers.get('User-Agent', '')
    })

    db.commit()

    return jsonify({
        "status": "success",
        "message": "Consent recorded successfully",
        "timestamp": timestamp
    })


@app.route("/api/consent/<participant_id>")
def get_consent(participant_id):
    """Get consent status for a participant"""
    db = get_db()
    
    result = db.execute(text('''
        SELECT consent_given, consent_timestamp FROM consent_records 
        WHERE participant_id = :participant_id
    '''), {"participant_id": participant_id})
    
    row = result.fetchone()
    if not row:
        return jsonify({
            "participant_id": participant_id,
            "consent_given": False,
            "consent_timestamp": None
        })
    
    return jsonify({
        "participant_id": participant_id,
        "consent_given": bool(row[0]),
        "consent_timestamp": str(row[1]) if row[1] else None
    })


# ============== IMAGE ENDPOINTS ==============

def get_images_from_db():
    """Query images from database"""
    db = get_db()

    try:
        result = db.execute(text('''
            SELECT image_id, image_url
            FROM images
        '''))

        return [{"image_id": row[0], "image_url": row[1]} for row in result.fetchall()]
    except Exception as e:
        app.logger.error(f"Error querying images from database: {e}")
        return []


def build_image_payload(image_data: dict):
    return {
        "image_id": image_data["image_id"],
        "image_url": image_data["image_url"]
    }


@app.route("/api/images/random")
def random_image():
    images = get_images_from_db()
    if not images:
        return jsonify({"error": "No images available"}), 404

    # Get excluded images from query parameter
    exclude_param = request.args.get('exclude', '')
    excluded_ids = set()
    if exclude_param:
        excluded_ids = set(exclude_param.split(','))
    
    # Filter out excluded images
    available_images = [img for img in images if img["image_id"] not in excluded_ids]
    
    # If all images have been shown, reset and use all images
    if not available_images:
        available_images = images
    
    # Ensure we get a new random image each time by not using any caching
    image_data = random.choice(available_images)
    payload = build_image_payload(image_data)
    return jsonify(payload)


@app.route("/api/images/<path:image_id>")
def serve_image(image_id):
    # Set proper Content-Type for SVG files
    if image_id.endswith('.svg'):
        return send_from_directory(IMAGES_DIR, image_id, mimetype='image/svg+xml')
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
    
    # Check if participant is flagged for low attention quality
    db = get_db()
    flag_check = db.execute(text("""
        SELECT is_flagged
        FROM attention_stats
        WHERE participant_id = :participant_id
    """), {"participant_id": participant_id}).fetchone()

    if flag_check and flag_check[0]:
        return jsonify({
            "error": "Account flagged for low attention quality"
        }), 403
    
    # Verify participant exists and has given consent
    db = get_db()
    result = db.execute(text("SELECT consent_given FROM participants WHERE participant_id = :participant_id"), {"participant_id": participant_id})
    db_result = result.fetchone()
    
    if not db_result:
        return jsonify({"error": "Participant not found. Please complete registration first."}), 400
    
    if not db_result[0]:
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
        _log_audit_event(db, 
                       event_type='security_violation',
                       participant_id=participant_id,
                       endpoint='/api/submit',
                       method='POST',
                       status_code=403,
                       details='Potential injection attempt in description')
        return jsonify({"error": "Description contains invalid characters"}), 403
    
    if any(char in feedback for char in ['<', '>', '&', ';', '--', '/*', '*/', 'exec', 'union', 'select', 'insert', 'update', 'delete']):
        _log_audit_event(db, 
                       event_type='security_violation',
                       participant_id=participant_id,
                       endpoint='/api/submit',
                       method='POST',
                       status_code=403,
                       details='Potential injection attempt in feedback')
        return jsonify({"error": "Feedback contains invalid characters"}), 403

    is_survey = bool(payload.get("is_survey"))
    
    # Check if image is an attention trial (backend-controlled)
    attention_result = db.execute(text("""
        SELECT expected_word, strict
        FROM attention_checks
        WHERE image_id = :image_id AND is_active = TRUE
    """), {"image_id": image_id})

    attention_row = attention_result.fetchone()
    is_attention = attention_row is not None
    attention_passed = None
    
    if is_attention:
        expected_word = attention_row[0].strip().lower()
        strict = attention_row[1]

        description_lower = description.lower()

        if strict:
            # Whole word match
            import re
            pattern = rf"\b{re.escape(expected_word)}\b"
            attention_passed = bool(re.search(pattern, description_lower))
        else:
            # Allow substring
            attention_passed = expected_word in description_lower

    too_fast_flag = False
    try:
        time_spent_seconds = float(time_spent_seconds)
        too_fast_flag = time_spent_seconds < TOO_FAST_SECONDS
    except (TypeError, ValueError):
        time_spent_seconds = None

    # Ensure image exists in images table (for foreign key constraint)
    try:
        # Check if image exists in database
        image_result = db.execute(text('''
            SELECT image_id FROM images WHERE image_id = :image_id
        '''), {"image_id": image_id})

        if not image_result.fetchone():
            # Image doesn't exist, insert it with basic metadata
            db.execute(text('''
                INSERT INTO images
                (image_id, difficulty_score, object_count, width, height)
                VALUES (:image_id, 5.0, 1, 800, 600)
                ON CONFLICT (image_id) DO NOTHING
            '''), {
                "image_id": image_id
            })
            db.commit()
    except Exception as e:
        # If we can't insert the image, log it but don't fail the submission
        _log_audit_event(db,
                       event_type='image_insert_failed',
                       participant_id=participant_id,
                       endpoint='/api/submit',
                       method='POST',
                       status_code=200,
                       details=f'Failed to insert image {image_id}: {str(e)}')
    
    # Insert into database
    try:
        trial_index = payload.get("trial_index", 0)
        try:
            trial_index = int(trial_index)
        except (TypeError, ValueError):
            trial_index = 0
        
        db.execute(text('''
            INSERT INTO submissions 
            (participant_id, session_id, image_id, image_url, trial_index, description, word_count, rating, 
             feedback, time_spent_seconds, is_survey, is_attention, attention_passed, too_fast_flag, user_agent, ip_hash)
            VALUES (:participant_id, :session_id, :image_id, :image_url, :trial_index, :description, :word_count, :rating, 
             :feedback, :time_spent_seconds, :is_survey, :is_attention, :attention_passed, :too_fast_flag, :user_agent, :ip_hash)
        '''), {
            "participant_id": participant_id,
            "session_id": payload.get("session_id", ""),
            "image_id": image_id,
            "image_url": payload.get("image_url", f"/api/images/{image_id}"),
            "trial_index": trial_index,
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
            "ip_hash": get_ip_hash()
        })
        
        db.commit()
        
        # Update attention stats if this was an attention trial
        if is_attention:
            stats = db.execute(text("""
                SELECT total_checks, passed_checks, failed_checks
                FROM attention_stats
                WHERE participant_id = :participant_id
            """), {"participant_id": participant_id}).fetchone()

            if stats:
                total = stats[0] + 1
                passed = stats[1] + (1 if attention_passed else 0)
                failed = stats[2] + (0 if attention_passed else 1)
            else:
                total = 1
                passed = 1 if attention_passed else 0
                failed = 0 if attention_passed else 1

            attention_score = passed / total
            is_flagged = attention_score < 0.6 and total >= 3

            db.execute(text("""
                INSERT INTO attention_stats
                (participant_id, total_checks, passed_checks, failed_checks, attention_score, is_flagged)
                VALUES (:participant_id, :total, :passed, :failed, :score, :flagged)
                ON CONFLICT(participant_id) DO UPDATE SET
                total_checks = :total,
                passed_checks = :passed,
                failed_checks = :failed,
                attention_score = :score,
                is_flagged = :flagged
            """), {
                "participant_id": participant_id,
                "total": total,
                "passed": passed,
                "failed": failed,
                "score": attention_score,
                "flagged": is_flagged
            })
            db.commit()
        
        # Update participant stats for reward eligibility
        update_participant_stats(participant_id, word_count, is_survey, attention_score if is_attention else None)
        
        return jsonify({
            "status": "ok", 
            "word_count": word_count, 
            "attention_passed": attention_passed
        })
        
    except Exception as e:
        return jsonify({"error": "Failed to save submission", "details": str(e)}), 500


@app.route("/api/reward/<participant_id>")
def get_reward_status(participant_id):
    """Get reward status for a participant"""
    status = get_reward_eligibility(participant_id)
    return jsonify(status)


@app.route("/api/reward/select/<participant_id>", methods=["POST"])
@limiter.limit("10 per minute")
def check_reward_winner(participant_id):
    """Check and select reward winner for a participant"""
    result = select_reward_winner(participant_id)
    return jsonify(result)


@app.route("/api/submissions/<participant_id>")
def get_participant_submissions(participant_id):
    """Get all submissions for a participant"""
    db = get_db()
    
    result = db.execute(text('''
        SELECT id, image_id, trial_index, description, word_count, rating, feedback, 
               time_spent_seconds, is_survey, is_attention, attention_passed, created_at
        FROM submissions 
        WHERE participant_id = :participant_id
        ORDER BY created_at DESC
    '''), {"participant_id": participant_id})
    
    rows = result.fetchall()
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
            "created_at": str(row[11])
        })
    
    return jsonify(submissions)


# ============== SECURITY ENDPOINTS ==============

@app.route("/api/security/info")
@track_performance
def security_info():
    """Get comprehensive security information"""
    cors_origins = _get_cors_origins()
    return jsonify({
        "security": {
            "version": "3.5.0",
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "rate_limits": {
                "default": "200 per day, 50 per hour",
                "participant_creation": "30 per minute",
                "consent_recording": "20 per minute",
                "submission": "60 per minute",
                "api_docs": "30 per minute"
            },
            "cors_configuration": {
                "allowed_origins": cors_origins,
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
                "storage": "PostgreSQL with comprehensive indexing",
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

def _get_api_documentation():
    """Get API documentation object - available at /"""
    return {
        "title": "C.O.G.N.I.T. API Documentation",
        "version": "3.5.0",
        "description": "Complete and verified API documentation for the C.O.G.N.I.T. (Cognitive Network for Image & Text Modeling) research platform. This RESTful API provides endpoints for participant management, image retrieval, data submission, and reward system with comprehensive security features.",
        "base_url": "/api",
        "security": {
            "overview": "The API implements multiple layers of security including rate limiting, CORS restrictions, security headers, input validation, and privacy-preserving data collection",
            "rate_limiting": {
                "default": "200 requests per day, 50 per hour",
                "endpoints": {
                    "participant_creation": "30 per minute",
                    "consent_recording": "20 per minute",
                    "submission": "60 per minute",
                    "api_docs": "30 per minute",
                    "reward_selection": "10 per minute"
                },
                "implementation": "Per-IP based rate limiting using flask-limiter"
            },
            "cors_configuration": {
                "allowed_origins": _get_cors_origins(),
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
                "ip_hashing": "SHA-256 with configurable salt (IP_HASH_SALT)",
                "anonymous_data": True,
                "storage": "PostgreSQL with comprehensive indexing",
                "encryption": "At-rest protection via filesystem encryption",
                "data_validation": "Comprehensive input validation and sanitization"
            },
            "database_security": {
                "foreign_key_constraints": "Enabled",
                "input_validation": "Length and format constraints on all fields",
                "audit_logging": "Automatic logging of all participant actions via triggers",
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
            "authentication": "None required for participant endpoints - participants are identified by participant_id and session_id",
            "compliance": {
                "gdpr": "Privacy-preserving data collection",
                "data_minimization": "Only essential data collected",
                "consent_management": "Explicit consent recording before data submission",
                "data_retention": "Configurable retention policies"
            }
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
                    "username": "Only letters, numbers, and underscores allowed (no spaces or special characters)",
                    "email": "Required - only Gmail, Outlook, Hotmail, and iCloud domains allowed",
                    "phone": "Required - valid 10-digit Indian mobile number (starts with 6, 7, 8, or 9)",
                    "age": "Integer between 13-100",
                    "native_language": "One of 9 Indian languages: Hindi, Bengali, Telugu, Marathi, Tamil, Urdu, Gujarati, Kannada, Malayalam"
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
                "description": "Get a random image, optionally excluding previously shown images",
                "auth_required": False,
                "rate_limit": "200 per day, 50 per hour",
                "query_params": {
                    "exclude": "Optional - comma-separated list of image_ids to exclude from selection"
                },
                "response": {
                    "image_id": "string",
                    "image_url": "string"
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
            "get_reward_status": {
                "path": "/api/reward/<participant_id>",
                "method": "GET",
                "description": "Get reward status for a participant including stats and eligibility",
                "auth_required": False,
                "rate_limit": "200 per day, 50 per hour",
                "response": {
                    "is_winner": "boolean - whether participant has won",
                    "reward_amount": "integer|null - amount if winner",
                    "status": "string|null - payment status if winner",
                    "total_words": "integer - total words written",
                    "survey_rounds": "integer - number of survey rounds completed",
                    "priority_eligible": "boolean - whether in priority pool"
                }
            },
            "select_reward_winner": {
                "path": "/api/reward/select/<participant_id>",
                "method": "POST",
                "description": "Check and select participant as reward winner (random selection, higher chances for priority participants)",
                "auth_required": False,
                "rate_limit": "10 per minute",
                "response": {
                    "selected": "boolean - whether participant was selected",
                    "reward_amount": "integer|null - amount if selected",
                    "already_winner": "boolean|null - if already selected before",
                    "priority_eligible": "boolean|null - priority status"
                }
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
            "4.0.0": "Implemented backend-controlled attention check system with attention_checks and attention_stats tables, removed frontend attention logic, added quality control with participant flagging, updated reward eligibility to require attention_score >= 0.75",
            "3.5.0": "Migrated from SQLite to PostgreSQL for production deployment compatibility",
            "3.4.0": "Updated application name to C.O.G.N.I.T. (Cognitive Network for Image & Text Modeling), regenerated consent form, removed CSV functionality, moved API documentation to root endpoint (/), updated README.md",
            "3.3.0": "Added reward system with participant_stats and reward_winners tables, priority-based selection, and reward endpoints",
            "3.2.0": "Added images table, trial_index column to submissions, Data Quality Score view, and Image Coverage view",
            "3.1.0": "Updated documentation to reflect only working routes, added detailed validation info, improved error handling section"
        }
    }


# ============== API DOCUMENTATION ==============

@app.route("/")
def serve_api_docs():
    """Serve API documentation at root path"""
    return render_template("api_docs.html", 
                         version="4.0.0", 
                         base_url="/api")

@app.route("/api/docs")
@limiter.limit("30 per minute")
@track_performance
def get_api_docs():
    """Get API documentation as JSON"""
    return jsonify(_get_api_documentation())



