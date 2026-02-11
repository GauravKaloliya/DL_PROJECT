#!/usr/bin/env python3
"""
C.O.G.N.I.T. Feature Verification Tests
Tests all pages, database integration, API integration and routes
"""

import unittest
import requests
import json
import sqlite3
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = BASE_DIR / "backend"
DB_PATH = BACKEND_DIR / "COGNIT.db"

BASE_URL = "http://localhost:5000"
FRONTEND_URL = "http://localhost:5173"


class TestBackendAPI(unittest.TestCase):
    """Test all backend API endpoints"""

    @classmethod
    def setUpClass(cls):
        import time
        cls.test_participant_id = f"test-participant-{int(time.time())}"
        cls.test_session_id = f"test-session-{int(time.time())}"

    def test_health_endpoint(self):
        """Test health check endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertIn("database", data["services"])
        self.assertIn("images", data["services"])
        self.assertEqual(data["services"]["database"], "connected")
        self.assertEqual(data["services"]["images"], "accessible")

    def test_api_docs_endpoint(self):
        """Test API documentation endpoint"""
        response = requests.get(f"{BASE_URL}/api/docs")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("endpoints", data)
        self.assertIn("title", data)

    def test_security_info_endpoint(self):
        """Test security info endpoint"""
        response = requests.get(f"{BASE_URL}/api/security/info")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("security", data)
        self.assertIn("rate_limits", data["security"])

    def test_create_participant(self):
        """Test participant creation"""
        payload = {
            "participant_id": self.test_participant_id,
            "session_id": self.test_session_id,
            "username": "testuser",
            "gender": "male",
            "age": 25,
            "place": "New York",
            "native_language": "English",
            "prior_experience": "Photography"
        }
        response = requests.post(f"{BASE_URL}/api/participants", json=payload)
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["participant_id"], self.test_participant_id)

    def test_get_participant(self):
        """Test getting participant details"""
        response = requests.get(f"{BASE_URL}/api/participants/{self.test_participant_id}")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["participant_id"], self.test_participant_id)
        self.assertEqual(data["username"], "testuser")

    def test_record_consent(self):
        """Test consent recording"""
        payload = {
            "participant_id": self.test_participant_id,
            "consent_given": True
        }
        response = requests.post(f"{BASE_URL}/api/consent", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")

    def test_get_consent(self):
        """Test getting consent status"""
        response = requests.get(f"{BASE_URL}/api/consent/{self.test_participant_id}")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["participant_id"], self.test_participant_id)
        self.assertIn("consent_given", data)

    def test_random_image_normal(self):
        """Test random normal image endpoint"""
        response = requests.get(f"{BASE_URL}/api/images/random?type=normal")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("image_id", data)
        self.assertIn("image_url", data)
        self.assertFalse(data["is_survey"])
        self.assertFalse(data["is_attention"])

    def test_random_image_survey(self):
        """Test random survey image endpoint"""
        response = requests.get(f"{BASE_URL}/api/images/random?type=survey")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("image_id", data)
        self.assertTrue(data["is_survey"])
        self.assertFalse(data["is_attention"])

    def test_random_image_attention(self):
        """Test random attention image endpoint"""
        response = requests.get(f"{BASE_URL}/api/images/random?type=attention")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("image_id", data)
        self.assertFalse(data["is_survey"])
        self.assertTrue(data["is_attention"])

    def test_serve_image(self):
        """Test image serving"""
        response = requests.get(f"{BASE_URL}/api/images/normal/aurora-lake.svg")
        self.assertEqual(response.status_code, 200)
        self.assertIn("image/svg+xml", response.headers["Content-Type"])

    def test_submit_description(self):
        """Test submission endpoint"""
        payload = {
            "participant_id": self.test_participant_id,
            "session_id": self.test_session_id,
            "image_id": "normal/test-image.svg",
            "image_url": "/api/images/normal/test-image.svg",
            "description": "This is a beautiful scene with mountains and lakes showing natural beauty with clouds in the sky and trees in the foreground. The colors are vibrant and the composition is excellent for this nature scene.",
            "rating": 8,
            "feedback": "Great image!",
            "time_spent_seconds": 45,
            "is_survey": False,
            "is_attention": False
        }
        response = requests.post(f"{BASE_URL}/api/submit", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ok")
        self.assertGreaterEqual(data["word_count"], 30)

    def test_get_submissions(self):
        """Test getting participant submissions"""
        response = requests.get(f"{BASE_URL}/api/submissions/{self.test_participant_id}")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data, list)


class TestDatabaseIntegration(unittest.TestCase):
    """Test database integration"""

    def test_database_exists(self):
        """Test database file exists"""
        self.assertTrue(DB_PATH.exists(), f"Database file {DB_PATH} does not exist")

    def test_tables_exist(self):
        """Test all required tables exist"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        
        self.assertIn("participants", tables)
        self.assertIn("submissions", tables)
        self.assertIn("consent_records", tables)
        
        conn.close()

    def test_participants_table_schema(self):
        """Test participants table has correct columns"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("PRAGMA table_info(participants)")
        columns = [row[1] for row in cursor.fetchall()]
        
        required_columns = [
            "id", "participant_id", "session_id", "username", 
            "email", "phone", "gender", "age", "place",
            "native_language", "prior_experience", "consent_given",
            "consent_timestamp", "ip_hash", "user_agent", "created_at"
        ]
        
        for col in required_columns:
            self.assertIn(col, columns, f"Missing column: {col}")
        
        conn.close()

    def test_submissions_table_schema(self):
        """Test submissions table has correct columns"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("PRAGMA table_info(submissions)")
        columns = [row[1] for row in cursor.fetchall()]
        
        required_columns = [
            "id", "participant_id", "session_id", "image_id",
            "image_url", "description", "word_count", "rating",
            "feedback", "time_spent_seconds", "is_survey", "is_attention",
            "attention_passed", "too_fast_flag", "user_agent", "ip_hash", "created_at"
        ]
        
        for col in required_columns:
            self.assertIn(col, columns, f"Missing column: {col}")
        
        conn.close()

    def test_indexes_exist(self):
        """Test performance indexes exist"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='index'")
        indexes = [row[0] for row in cursor.fetchall()]
        
        required_indexes = [
            "idx_participants_id",
            "idx_participants_session",
            "idx_submissions_participant",
            "idx_submissions_session"
        ]
        
        for idx in required_indexes:
            self.assertIn(idx, indexes, f"Missing index: {idx}")
        
        conn.close()


class TestFrontendRoutes(unittest.TestCase):
    """Test frontend routes"""

    def test_main_page(self):
        """Test main page loads"""
        response = requests.get(FRONTEND_URL)
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/html", response.headers["Content-Type"])

    def test_api_docs_page(self):
        """Test API docs page loads (returns JSON from backend via proxy)"""
        response = requests.get(f"{FRONTEND_URL}/api/docs")
        self.assertEqual(response.status_code, 200)
        # Via proxy, this returns JSON from the backend
        self.assertIn("application/json", response.headers["Content-Type"])

    def test_404_page(self):
        """Test 404 page (SPA fallback)"""
        response = requests.get(f"{FRONTEND_URL}/nonexistent")
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/html", response.headers["Content-Type"])


class TestImageInventory(unittest.TestCase):
    """Test image files are present"""

    def test_normal_images_exist(self):
        """Test normal images directory has files"""
        images_dir = BACKEND_DIR / "images" / "normal"
        files = list(images_dir.glob("*.svg"))
        self.assertGreater(len(files), 0, "No normal images found")

    def test_survey_images_exist(self):
        """Test survey images directory has files"""
        images_dir = BACKEND_DIR / "images" / "survey"
        files = list(images_dir.glob("*.svg"))
        self.assertGreater(len(files), 0, "No survey images found")

    def test_attention_images_exist(self):
        """Test attention images directory has files"""
        images_dir = BACKEND_DIR / "images" / "attention"
        files = list(images_dir.glob("*.svg"))
        self.assertGreater(len(files), 0, "No attention images found")


class TestValidationFeatures(unittest.TestCase):
    """Test validation features"""

    @classmethod
    def setUpClass(cls):
        cls.participant_id = "validation-test-user"
        cls.session_id = "validation-test-session"
        
        # Create participant and consent
        payload = {
            "participant_id": cls.participant_id,
            "session_id": cls.session_id,
            "username": "validationuser",
            "gender": "male",
            "age": 25,
            "place": "Test City",
            "native_language": "English",
            "prior_experience": "None"
        }
        requests.post(f"{BASE_URL}/api/participants", json=payload)
        requests.post(f"{BASE_URL}/api/consent", json={
            "participant_id": cls.participant_id,
            "consent_given": True
        })

    def test_word_count_validation(self):
        """Test minimum word count validation"""
        payload = {
            "participant_id": self.participant_id,
            "session_id": self.session_id,
            "image_id": "normal/test.svg",
            "description": "Too short",
            "rating": 5,
            "feedback": "Test",
            "time_spent_seconds": 10
        }
        response = requests.post(f"{BASE_URL}/api/submit", json=payload)
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn("error", data)

    def test_rating_validation(self):
        """Test rating validation (1-10)"""
        payload = {
            "participant_id": self.participant_id,
            "session_id": self.session_id,
            "image_id": "normal/test.svg",
            "description": "This description has enough words to pass the validation check for word count requirements in the test.",
            "rating": 15,
            "feedback": "Test feedback",
            "time_spent_seconds": 10
        }
        response = requests.post(f"{BASE_URL}/api/submit", json=payload)
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn("error", data)

    def test_consent_required(self):
        """Test consent is required for submission"""
        # Create a participant without consent
        no_consent_id = "no-consent-user"
        payload = {
            "participant_id": no_consent_id,
            "session_id": "test-session",
            "username": "noconsent",
            "gender": "male",
            "age": 25,
            "place": "Test",
            "native_language": "English",
            "prior_experience": "None"
        }
        requests.post(f"{BASE_URL}/api/participants", json=payload)
        
        # Try to submit without consent
        submit_payload = {
            "participant_id": no_consent_id,
            "session_id": "test-session",
            "image_id": "normal/test.svg",
            "description": "This description has enough words to pass the validation check for word count requirements in the test.",
            "rating": 5,
            "feedback": "Test feedback",
            "time_spent_seconds": 10
        }
        response = requests.post(f"{BASE_URL}/api/submit", json=submit_payload)
        self.assertEqual(response.status_code, 403)


if __name__ == "__main__":
    unittest.main(verbosity=2)
