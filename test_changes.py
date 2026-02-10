#!/usr/bin/env python3

"""
Test script to verify the changes made to the COGNIT application.
This script tests the key functionality changes.
"""

import sys
import os
import sqlite3
from pathlib import Path

# Add the backend directory to the path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

def test_database_initialization():
    """Test that the SQLite database is properly initialized"""
    print("🔍 Testing database initialization...")
    
    db_path = Path(__file__).parent / "backend" / "COGNIT.db"
    
    # Check if database file exists
    if not db_path.exists():
        print("❌ Database file does not exist")
        return False
    
    # Connect to database and check tables
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if admin_users table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='admin_users'")
        if not cursor.fetchone():
            print("❌ admin_users table does not exist")
            return False
        
        # Check if admin_sessions table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='admin_sessions'")
        if not cursor.fetchone():
            print("❌ admin_sessions table does not exist")
            return False
        
        # Check if admin_audit_log table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='admin_audit_log'")
        if not cursor.fetchone():
            print("❌ admin_audit_log table does not exist")
            return False
        
        # Check if default admin user exists
        cursor.execute("SELECT COUNT(*) FROM admin_users WHERE username = 'admin'")
        if cursor.fetchone()[0] == 0:
            print("❌ Default admin user does not exist")
            return False
        
        print("✅ Database initialization test passed")
        return True
        
    except Exception as e:
        print(f"❌ Database test failed with error: {e}")
        return False
    finally:
        conn.close()

def test_csv_headers():
    """Test that CSV headers include the new demographic fields"""
    print("🔍 Testing CSV headers...")
    
    # Import the CSV_HEADERS from app.py
    try:
        from app import CSV_HEADERS
        
        required_fields = ["age_group", "native_language", "prior_experience"]
        missing_fields = []
        
        for field in required_fields:
            if field not in CSV_HEADERS:
                missing_fields.append(field)
        
        if missing_fields:
            print(f"❌ Missing CSV headers: {missing_fields}")
            return False
        
        print("✅ CSV headers test passed")
        return True
        
    except Exception as e:
        print(f"❌ CSV headers test failed with error: {e}")
        return False

def test_api_documentation():
    """Test that API documentation endpoint exists"""
    print("🔍 Testing API documentation...")
    
    try:
        from app import app
        
        # Check if the /api/docs route exists
        with app.test_client() as client:
            response = client.get('/api/docs')
            
            if response.status_code != 200:
                print(f"❌ API docs endpoint returned status {response.status_code}")
                return False
            
            data = response.get_json()
            if not data:
                print("❌ API docs endpoint did not return JSON")
                return False
            
            # Check for expected fields
            expected_fields = ["title", "version", "endpoints", "data_structures"]
            missing_fields = []
            
            for field in expected_fields:
                if field not in data:
                    missing_fields.append(field)
            
            if missing_fields:
                print(f"❌ Missing fields in API docs: {missing_fields}")
                return False
            
            print("✅ API documentation test passed")
            return True
            
    except Exception as e:
        print(f"❌ API documentation test failed with error: {e}")
        return False

def test_admin_authentication():
    """Test admin authentication functions"""
    print("🔍 Testing admin authentication...")
    
    try:
        from app import ADMIN_API_KEY
        
        # Test legacy API key (this doesn't require request context)
        if ADMIN_API_KEY != "changeme":
            print("❌ Legacy API key is not the expected default")
            return False
        
        # Test that we can import the authentication function
        from app import authenticate_admin
        
        print("✅ Admin authentication test passed (basic checks)")
        return True
        
    except Exception as e:
        print(f"❌ Admin authentication test failed with error: {e}")
        return False

def main():
    """Run all tests"""
    print("🧪 Running COGNIT application tests...\n")
    
    tests = [
        test_database_initialization,
        test_csv_headers,
        test_api_documentation,
        test_admin_authentication
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
        print()
    
    print(f"📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! The application changes are working correctly.")
        return 0
    else:
        print("❌ Some tests failed. Please check the errors above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())