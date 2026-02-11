#!/usr/bin/env python3
"""
Repository Change Verification Tests
Verifies that the repository changes are correct
"""

import unittest
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent


class TestRepositoryStructure(unittest.TestCase):
    """Test repository structure is correct"""

    def test_backend_directory_exists(self):
        """Test backend directory exists"""
        backend_dir = BASE_DIR / "backend"
        self.assertTrue(backend_dir.exists())

    def test_frontend_directory_exists(self):
        """Test frontend directory exists"""
        frontend_dir = BASE_DIR / "frontend"
        self.assertTrue(frontend_dir.exists())

    def test_backend_app_exists(self):
        """Test backend app.py exists"""
        app_file = BASE_DIR / "backend" / "app.py"
        self.assertTrue(app_file.exists())

    def test_frontend_src_exists(self):
        """Test frontend src directory exists"""
        src_dir = BASE_DIR / "frontend" / "src"
        self.assertTrue(src_dir.exists())

    def test_frontend_pages_exist(self):
        """Test frontend pages exist"""
        pages_dir = BASE_DIR / "frontend" / "src" / "pages"
        self.assertTrue(pages_dir.exists())

    def test_frontend_components_exist(self):
        """Test frontend components exist"""
        components_dir = BASE_DIR / "frontend" / "src" / "components"
        self.assertTrue(components_dir.exists())


class TestBackendFeatures(unittest.TestCase):
    """Test backend features are present"""

    def test_flask_app_imports(self):
        """Test Flask app can be imported"""
        sys.path.insert(0, str(BASE_DIR / "backend"))
        try:
            import app
            self.assertTrue(hasattr(app, 'app'))
        except ImportError as e:
            self.fail(f"Could not import app: {e}")

    def test_database_initialization(self):
        """Test database initialization function exists"""
        sys.path.insert(0, str(BASE_DIR / "backend"))
        try:
            import app
            self.assertTrue(hasattr(app, 'init_db'))
        except ImportError as e:
            self.fail(f"Could not import app: {e}")


class TestFrontendFeatures(unittest.TestCase):
    """Test frontend features are present"""

    def test_main_app_exists(self):
        """Test main App.jsx exists"""
        app_file = BASE_DIR / "frontend" / "src" / "App.jsx"
        self.assertTrue(app_file.exists())

    def test_main_app_jsx_exists(self):
        """Test MainApp.jsx exists"""
        main_app_file = BASE_DIR / "frontend" / "src" / "MainApp.jsx"
        self.assertTrue(main_app_file.exists())

    def test_pages_exist(self):
        """Test all pages exist"""
        pages = [
            "ConsentPage.jsx",
            "UserDetailsPage.jsx",
            "PaymentPage.jsx",
            "TrialPage.jsx",
            "FinishedPage.jsx"
        ]
        pages_dir = BASE_DIR / "frontend" / "src" / "pages"
        for page in pages:
            page_file = pages_dir / page
            self.assertTrue(page_file.exists(), f"Missing page: {page}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
