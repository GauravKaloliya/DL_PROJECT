import csv
import hashlib
import os
import random
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

BASE_DIR = Path(__file__).resolve().parent
IMAGES_DIR = BASE_DIR / "images"
DATA_DIR = BASE_DIR / "data"
CSV_PATH = DATA_DIR / "submissions.csv"

MIN_WORD_COUNT = int(os.getenv("MIN_WORD_COUNT", "20"))
TOO_FAST_SECONDS = float(os.getenv("TOO_FAST_SECONDS", "5"))
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "changeme")
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
    "nasa_mental",
    "nasa_physical",
    "nasa_temporal",
    "nasa_performance",
    "nasa_effort",
    "nasa_frustration",
]

app = Flask(__name__)
CORS(app)


def ensure_csv():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not CSV_PATH.exists():
        with CSV_PATH.open("w", newline="", encoding="utf-8") as file:
            writer = csv.writer(file)
            writer.writerow(CSV_HEADERS)


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


def count_words(text: str):
    return len([word for word in text.strip().split() if word])


def require_api_key():
    api_key = request.headers.get("X-API-KEY") or request.args.get("api_key")
    if api_key != ADMIN_API_KEY:
        return False
    return True


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
    except (TypeError, ValueError):
        return jsonify({"error": "rating must be an integer"}), 400

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
        "feedback": payload.get("feedback", ""),
        "time_spent_seconds": time_spent_seconds,
        "is_practice": is_practice,
        "is_attention": is_attention,
        "attention_passed": attention_passed,
        "too_fast_flag": too_fast_flag,
        "user_agent": request.headers.get("User-Agent", ""),
        "ip_hash": get_ip_hash(),
        "nasa_mental": payload.get("nasa_mental", ""),
        "nasa_physical": payload.get("nasa_physical", ""),
        "nasa_temporal": payload.get("nasa_temporal", ""),
        "nasa_performance": payload.get("nasa_performance", ""),
        "nasa_effort": payload.get("nasa_effort", ""),
        "nasa_frustration": payload.get("nasa_frustration", ""),
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


if __name__ == "__main__":
    ensure_csv()
    app.run(debug=True)
