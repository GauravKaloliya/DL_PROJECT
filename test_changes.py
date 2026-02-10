#!/usr/bin/env python3
"""
Test script to verify the changes made to the C.O.G.N.I.T. application.

This script tests:
1. Admin credentials update (username: Gaurav, password: Gaurav@0809)
2. Image loading validation
3. Survey completion buttons functionality
"""

import hashlib
import sqlite3
import os
from pathlib import Path

def test_admin_credentials():
    """Test that admin credentials are correctly updated"""
    print("🔐 Testing admin credentials...")
    
    # Path to the database
    db_path = Path(__file__).parent / "backend" / "COGNIT.db"
    
    # Expected password hash for "Gaurav@0809"
    expected_password = "Gaurav@0809"
    expected_hash = hashlib.sha256(expected_password.encode()).hexdigest()
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if admin user exists
        cursor.execute("SELECT username, password_hash FROM admin_users WHERE username = ?", ("Gaurav",))
        result = cursor.fetchone()
        
        if result:
            username, stored_hash = result
            if username == "Gaurav" and stored_hash == expected_hash:
                print("✅ Admin credentials are correct!")
                print(f"   Username: {username}")
                print(f"   Password hash matches: {stored_hash == expected_hash}")
                return True
            else:
                print("❌ Admin credentials are incorrect!")
                print(f"   Expected username: Gaurav, got: {username}")
                print(f"   Password hash matches: {stored_hash == expected_hash}")
                return False
        else:
            print("❌ Admin user 'Gaurav' not found!")
            return False
            
    except Exception as e:
        print(f"❌ Error testing admin credentials: {e}")
        return False
    finally:
        if 'conn' in locals():
            conn.close()

def test_image_directories():
    """Test that image directories exist and contain images"""
    print("\n🖼️  Testing image directories...")
    
    images_dir = Path(__file__).parent / "backend" / "images"
    
    required_dirs = ["normal", "survey", "attention"]
    all_ok = True
    
    for dir_name in required_dirs:
        dir_path = images_dir / dir_name
        if dir_path.exists() and dir_path.is_dir():
            images = list(dir_path.glob("*.*"))
            image_count = len([f for f in images if f.is_file()])
            print(f"✅ {dir_name}: {image_count} images found")
        else:
            print(f"❌ {dir_name}: Directory not found")
            all_ok = False
    
    return all_ok

def test_backend_file_changes():
    """Test that backend file contains the expected changes"""
    print("\n📁 Testing backend file changes...")
    
    backend_file = Path(__file__).parent / "backend" / "app.py"
    
    try:
        with open(backend_file, 'r') as f:
            content = f.read()
        
        # Check for the updated password hash
        if 'hash_password("Gaurav@0809")' in content:
            print("✅ Backend file contains updated admin password")
            return True
        else:
            print("❌ Backend file does not contain updated admin password")
            return False
            
    except Exception as e:
        print(f"❌ Error reading backend file: {e}")
        return False

def test_frontend_file_changes():
    """Test that frontend file contains the expected changes"""
    print("\n📱 Testing frontend file changes...")
    
    frontend_file = Path(__file__).parent / "frontend" / "src" / "App.jsx"
    
    try:
        with open(frontend_file, 'r') as f:
            content = f.read()
        
        # Check for Finish Survey button
        if 'Finish Survey' in content:
            print("✅ Frontend file contains Finish Survey button")
        else:
            print("❌ Frontend file does not contain Finish Survey button")
            return False
        
        # Check for image loading validation
        if 'imageLoaded' in content and 'imageError' in content:
            print("✅ Frontend file contains image loading validation")
        else:
            print("❌ Frontend file does not contain image loading validation")
            return False
            
        return True
            
    except Exception as e:
        print(f"❌ Error reading frontend file: {e}")
        return False

def main():
    """Run all tests"""
    print("🧪 Running C.O.G.N.I.T. application tests...\n")
    
    tests = [
        test_admin_credentials,
        test_image_directories,
        test_backend_file_changes,
        test_frontend_file_changes
    ]
    
    results = []
    for test in tests:
        try:
            result = test()
            results.append(result)
        except Exception as e:
            print(f"❌ Test {test.__name__} failed with exception: {e}")
            results.append(False)
    
    print(f"\n📊 Test Results:")
    print(f"   Passed: {sum(results)}/{len(results)}")
    
    if all(results):
        print("\n🎉 All tests passed! The changes have been successfully implemented.")
        return 0
    else:
        print("\n⚠️  Some tests failed. Please review the implementation.")
        return 1

if __name__ == "__main__":
    exit(main())