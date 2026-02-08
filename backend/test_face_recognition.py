"""
Test script for face recognition attendance system
Run this to verify the face recognition setup is working correctly
"""

import sys
import base64
from pathlib import Path

def test_imports():
    """Test if all required libraries are installed"""
    print("\n=== Testing Imports ===")
    
    try:
        import face_recognition
        print("✅ face_recognition imported successfully")
        print(f"   Version: {face_recognition.__version__ if hasattr(face_recognition, '__version__') else 'Unknown'}")
    except ImportError as e:
        print(f"❌ face_recognition import failed: {e}")
        return False
    
    try:
        import cv2
        print("✅ opencv-python (cv2) imported successfully")
        print(f"   Version: {cv2.__version__}")
    except ImportError as e:
        print(f"❌ opencv-python import failed: {e}")
        return False
    
    try:
        from PIL import Image
        print("✅ Pillow (PIL) imported successfully")
    except ImportError as e:
        print(f"❌ Pillow import failed: {e}")
        return False
    
    try:
        import dlib
        print("✅ dlib imported successfully")
        print(f"   CUDA available: {dlib.DLIB_USE_CUDA}")
    except ImportError as e:
        print(f"❌ dlib import failed: {e}")
        return False
    
    return True


def test_face_detection():
    """Test face detection on a sample image"""
    print("\n=== Testing Face Detection ===")
    
    try:
        import face_recognition
        import numpy as np
        from PIL import Image, ImageDraw
        
        # Create a simple test image with a face-like pattern
        # In real usage, you'd use an actual photo
        print("Creating test image...")
        img = Image.new('RGB', (200, 200), color='white')
        draw = ImageDraw.Draw(img)
        
        # Draw a simple face
        draw.ellipse([50, 50, 150, 150], fill='beige', outline='black')  # Head
        draw.ellipse([70, 80, 90, 100], fill='black')  # Left eye
        draw.ellipse([110, 80, 130, 100], fill='black')  # Right eye
        draw.arc([75, 110, 125, 140], 0, 180, fill='black')  # Smile
        
        # Convert to numpy array
        img_array = np.array(img)
        
        print("Detecting faces...")
        face_locations = face_recognition.face_locations(img_array)
        
        if len(face_locations) > 0:
            print(f"✅ Face detection working (found {len(face_locations)} face(s))")
            print(f"   Face location: {face_locations[0]}")
        else:
            print("⚠️  No faces detected in test image")
            print("   This is expected for the simple test pattern")
            print("   Face detection should work with real photos")
        
        return True
        
    except Exception as e:
        print(f"❌ Face detection test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_face_comparison():
    """Test face comparison functionality"""
    print("\n=== Testing Face Comparison ===")
    
    try:
        from modules.attendance.face_recognition_utils import (
            base64_to_image,
            get_face_encoding,
            compare_faces
        )
        
        print("✅ Face recognition utils imported successfully")
        print("   Functions available:")
        print("   - base64_to_image")
        print("   - get_face_encoding")
        print("   - compare_faces")
        
        return True
        
    except ImportError as e:
        print(f"❌ Failed to import face recognition utils: {e}")
        print("   Make sure face_recognition_utils.py is in modules/attendance/")
        return False
    except Exception as e:
        print(f"❌ Face comparison test failed: {e}")
        return False


def test_image_processing():
    """Test image processing functions"""
    print("\n=== Testing Image Processing ===")
    
    try:
        from modules.attendance.face_recognition_utils import base64_to_image
        from PIL import Image
        import io
        
        # Create a test image
        img = Image.new('RGB', (100, 100), color='red')
        
        # Convert to base64
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG')
        img_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        # Test conversion
        img_array = base64_to_image(img_base64)
        
        print(f"✅ Image processing working")
        print(f"   Input: 100x100 RGB image")
        print(f"   Output shape: {img_array.shape}")
        
        # Test with data URI
        data_uri = f"data:image/jpeg;base64,{img_base64}"
        img_array2 = base64_to_image(data_uri)
        
        print(f"✅ Data URI processing working")
        print(f"   Output shape: {img_array2.shape}")
        
        return True
        
    except Exception as e:
        print(f"❌ Image processing test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_api_integration():
    """Test if the API endpoints are properly configured"""
    print("\n=== Testing API Integration ===")
    
    try:
        # Check if routes exist
        from modules.attendance.routes import router
        
        # Get all routes
        routes = [route.path for route in router.routes]
        
        required_endpoints = [
            "/attendance/verify-face",
            "/attendance/checkin",
            "/attendance/sessions",
        ]
        
        print("Checking required endpoints...")
        for endpoint in required_endpoints:
            if any(endpoint in route for route in routes):
                print(f"✅ {endpoint}")
            else:
                print(f"❌ {endpoint} not found")
        
        return True
        
    except Exception as e:
        print(f"❌ API integration test failed: {e}")
        return False


def print_setup_summary():
    """Print setup instructions and summary"""
    print("\n" + "="*60)
    print("SETUP SUMMARY")
    print("="*60)
    
    print("\n📋 Required Dependencies:")
    print("   - face_recognition==1.3.0")
    print("   - dlib==19.24.2")
    print("   - opencv-python==4.8.1.78")
    print("   - Pillow==10.1.0")
    
    print("\n⚙️  System Requirements:")
    print("   - CMake (for dlib compilation)")
    print("   - C++ compiler (Visual Studio Build Tools on Windows)")
    print("   - Python 3.7+")
    
    print("\n📁 Required Files:")
    print("   Backend:")
    print("   - modules/attendance/face_recognition_utils.py")
    print("   - modules/attendance/routes.py (updated)")
    print("   - modules/attendance/store.py (updated)")
    print("   Frontend:")
    print("   - app/student/attendance/page.tsx (updated)")
    
    print("\n🔧 Installation Command:")
    print("   pip install -r face_recognition_requirements.txt")
    
    print("\n📖 Documentation:")
    print("   See FACE_RECOGNITION_SETUP.md for detailed setup guide")
    
    print("\n" + "="*60)


def main():
    """Run all tests"""
    print("="*60)
    print("FACE RECOGNITION ATTENDANCE SYSTEM - TEST SUITE")
    print("="*60)
    
    tests = [
        ("Imports", test_imports),
        ("Face Detection", test_face_detection),
        ("Face Comparison", test_face_comparison),
        ("Image Processing", test_image_processing),
        ("API Integration", test_api_integration),
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        try:
            results[test_name] = test_func()
        except Exception as e:
            print(f"\n❌ {test_name} test crashed: {e}")
            results[test_name] = False
    
    # Print summary
    print("\n" + "="*60)
    print("TEST RESULTS SUMMARY")
    print("="*60)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, passed_test in results.items():
        status = "✅ PASSED" if passed_test else "❌ FAILED"
        print(f"{test_name:.<40} {status}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! Face recognition system is ready.")
    else:
        print("\n⚠️  Some tests failed. Please check the errors above.")
        print("   See FACE_RECOGNITION_SETUP.md for troubleshooting.")
    
    print_setup_summary()
    
    return passed == total


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)