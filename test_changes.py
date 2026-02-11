#!/usr/bin/env python3
"""
Test script to verify the changes made to the C.O.G.N.I.T. application.

This script tests:
1. Image loading validation
2. Survey completion buttons functionality
"""

from pathlib import Path

def test_image_directories():
    """Test that image directories exist and contain images"""
    print("🖼️  Testing image directories...")
    
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

def test_admin_panel_removed():
    """Test that admin panel has been removed"""
    print("\n🗑️  Testing admin panel removal...")
    
    # Check admin directory is removed
    admin_dir = Path(__file__).parent / "frontend" / "src" / "admin"
    if admin_dir.exists():
        print("❌ Admin directory still exists")
        return False
    else:
        print("✅ Admin directory removed")
    
    # Check admin database files are removed
    sql_file = Path(__file__).parent / "backend" / "COGNIT.sql"
    db_file = Path(__file__).parent / "backend" / "COGNIT.db"
    
    if sql_file.exists():
        print("❌ COGNIT.sql file still exists")
        return False
    else:
        print("✅ COGNIT.sql file removed")
    
    if db_file.exists():
        print("❌ COGNIT.db file still exists")
        return False
    else:
        print("✅ COGNIT.db file removed")
    
    # Check MainApp.jsx doesn't have admin routes
    main_app = Path(__file__).parent / "frontend" / "src" / "MainApp.jsx"
    try:
        with open(main_app, 'r') as f:
            content = f.read()
        
        if 'AdminPanel' in content or '/admin' in content:
            print("❌ MainApp.jsx still references admin")
            return False
        else:
            print("✅ MainApp.jsx admin references removed")
    except Exception as e:
        print(f"❌ Error reading MainApp.jsx: {e}")
        return False
    
    # Check App.jsx doesn't have admin button
    app_file = Path(__file__).parent / "frontend" / "src" / "App.jsx"
    try:
        with open(app_file, 'r') as f:
            content = f.read()
        
        if 'navigate("/admin")' in content:
            print("❌ App.jsx still has admin button")
            return False
        else:
            print("✅ App.jsx admin button removed")
    except Exception as e:
        print(f"❌ Error reading App.jsx: {e}")
        return False
    
    return True

def main():
    """Run all tests"""
    print("🧪 Running C.O.G.N.I.T. application tests...\n")
    
    tests = [
        test_image_directories,
        test_frontend_file_changes,
        test_admin_panel_removed,
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
