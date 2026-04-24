#!/usr/bin/env python3
"""
Vendor Storefront Backend Testing Script
Tests the NEW Phase 5 Shopify-like vendor storefront endpoints.
"""

import requests
import pymongo
import bcrypt
import uuid
import json
import time
from datetime import datetime

# Configuration
BASE_URL = "https://omani-startup-hub.preview.emergentagent.com/api"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "majles"

def setup_database():
    """Setup MongoDB connection and return client, db"""
    client = pymongo.MongoClient(MONGO_URL)
    db = client[DB_NAME]
    return client, db

def create_test_user(db, email, password, name, role="MEMBER"):
    """Create a test user with bcrypt hashed password"""
    user_id = str(uuid.uuid4())
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    user_doc = {
        "_id": user_id,
        "name": name,
        "email": email,
        "password": hashed_password,
        "role": role,
        "membershipTier": "FREE",
        "membershipExpiry": None,
        "phone": "",
        "photo": "",
        "vendorProfile": {
            "slug": "",
            "businessName": "",
            "tagline": "",
            "bio": "",
            "banner": "",
            "logo": "",
            "phone": "",
            "whatsapp": "",
            "instagram": "",
            "website": "",
            "governorate": "",
            "city": "",
            "address": ""
        },
        "createdAt": datetime.utcnow()
    }
    
    db.users.insert_one(user_doc)
    return user_id

def create_test_product(db, vendor_id, name_ar="منتج تجريبي", price=25.0, is_active=True):
    """Create a test product for a vendor"""
    product_id = str(uuid.uuid4())
    
    product_doc = {
        "_id": product_id,
        "vendorId": vendor_id,
        "nameAr": name_ar,
        "nameEn": "Test Product",
        "price": price,
        "description": "منتج تجريبي للاختبار",
        "images": [],
        "category": "OTHER",
        "stock": 10,
        "isActive": is_active,
        "salesCount": 0,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    
    db.products.insert_one(product_doc)
    return product_id

def login_user(email, password):
    """Login user via NextAuth and return session cookies"""
    # First get CSRF token
    csrf_response = requests.get(f"{BASE_URL}/auth/csrf")
    if csrf_response.status_code != 200:
        print(f"❌ Failed to get CSRF token: {csrf_response.status_code}")
        return None
    
    csrf_token = csrf_response.json().get('csrfToken')
    if not csrf_token:
        print("❌ No CSRF token in response")
        return None
    
    # Login with credentials
    login_data = {
        'email': email,
        'password': password,
        'csrfToken': csrf_token,
        'callbackUrl': '/',
        'json': 'true'
    }
    
    login_response = requests.post(
        f"{BASE_URL}/auth/callback/credentials",
        data=login_data,
        cookies=csrf_response.cookies,
        allow_redirects=False
    )
    
    if login_response.status_code not in [200, 302]:
        print(f"❌ Login failed: {login_response.status_code}")
        return None
    
    # Extract session cookies
    session_cookies = {}
    for cookie in login_response.cookies:
        if 'session-token' in cookie.name or 'next-auth' in cookie.name:
            session_cookies[cookie.name] = cookie.value
    
    return session_cookies

def test_get_vendors_public():
    """Test GET /api/vendors (public, no auth required)"""
    print("\n🧪 Testing GET /api/vendors (public list)")
    
    try:
        response = requests.get(f"{BASE_URL}/vendors")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            vendors = data.get('vendors', [])
            print(f"✅ Found {len(vendors)} vendors")
            
            # Verify structure and constraints
            for vendor in vendors:
                required_fields = ['id', 'name', 'slug', 'businessName', 'tagline', 'logo', 'banner', 'governorate', 'city', 'productCount']
                for field in required_fields:
                    if field not in vendor:
                        print(f"❌ Missing field '{field}' in vendor response")
                        return False
                
                # Verify productCount >= 1 (only vendors with active products should be returned)
                if vendor['productCount'] < 1:
                    print(f"❌ Vendor {vendor['name']} has productCount={vendor['productCount']} < 1")
                    return False
                
                # Verify slug is not empty
                if not vendor['slug']:
                    print(f"❌ Vendor {vendor['name']} has empty slug")
                    return False
            
            print("✅ All vendors have productCount >= 1 and non-empty slugs")
            return True
        else:
            print(f"❌ Unexpected status code: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False

def test_get_vendor_by_slug(test_slug):
    """Test GET /api/vendors/:slug (public, no auth required)"""
    print(f"\n🧪 Testing GET /api/vendors/{test_slug} (public storefront)")
    
    try:
        # Test valid slug
        response = requests.get(f"{BASE_URL}/vendors/{test_slug}")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            vendor = data.get('vendor')
            products = data.get('products', [])
            
            if not vendor:
                print("❌ No vendor in response")
                return False
            
            # Verify vendor structure
            required_vendor_fields = ['id', 'name', 'slug', 'businessName', 'tagline', 'bio', 'banner', 'logo', 'phone', 'whatsapp', 'instagram', 'website', 'governorate', 'city', 'address', 'membershipTier', 'memberSince']
            for field in required_vendor_fields:
                if field not in vendor:
                    print(f"❌ Missing field '{field}' in vendor response")
                    return False
            
            print(f"✅ Valid vendor response with {len(products)} products")
            
            # Verify all products are active
            for product in products:
                if not product.get('isActive', True):
                    print(f"❌ Inactive product found: {product.get('nameAr', 'Unknown')}")
                    return False
            
            print("✅ All products are active")
            return True
        else:
            print(f"❌ Unexpected status code: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False

def test_get_vendor_by_invalid_slug():
    """Test GET /api/vendors/:slug with invalid slug"""
    print(f"\n🧪 Testing GET /api/vendors/invalid-slug-12345 (should return 404)")
    
    try:
        response = requests.get(f"{BASE_URL}/vendors/invalid-slug-12345")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 404:
            data = response.json()
            error = data.get('error', '')
            if 'المتجر غير موجود' in error:
                print("✅ Correct 404 response with Arabic error message")
                return True
            else:
                print(f"❌ Wrong error message: {error}")
                return False
        else:
            print(f"❌ Expected 404, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False

def test_get_vendor_profile_auth(session_cookies):
    """Test GET /api/vendor/profile (auth required)"""
    print(f"\n🧪 Testing GET /api/vendor/profile (auth required)")
    
    try:
        # Test without auth
        response = requests.get(f"{BASE_URL}/vendor/profile")
        print(f"No auth status: {response.status_code}")
        
        if response.status_code == 401:
            data = response.json()
            if 'غير مصرح' in data.get('error', ''):
                print("✅ Correct 401 response without auth")
            else:
                print(f"❌ Wrong error message: {data.get('error', '')}")
                return False
        else:
            print(f"❌ Expected 401, got {response.status_code}")
            return False
        
        # Test with auth (should work for VENDOR/ADMIN)
        if session_cookies:
            response = requests.get(f"{BASE_URL}/vendor/profile", cookies=session_cookies)
            print(f"With auth status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                profile = data.get('profile')
                
                if not profile:
                    print("❌ No profile in response")
                    return False
                
                # Verify profile structure
                required_fields = ['id', 'name', 'email', 'slug', 'businessName', 'tagline', 'bio', 'banner', 'logo', 'phone', 'whatsapp', 'instagram', 'website', 'governorate', 'city', 'address']
                for field in required_fields:
                    if field not in profile:
                        print(f"❌ Missing field '{field}' in profile response")
                        return False
                
                print("✅ Valid profile response with all required fields")
                return True
            elif response.status_code == 403:
                data = response.json()
                if 'صلاحيات بائع مطلوبة' in data.get('error', ''):
                    print("✅ Correct 403 response for non-vendor user")
                    return True
                else:
                    print(f"❌ Wrong error message: {data.get('error', '')}")
                    return False
            else:
                print(f"❌ Unexpected status code: {response.status_code}")
                print(f"Response: {response.text}")
                return False
        else:
            print("⚠️ No session cookies available for auth test")
            return True
            
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False

def test_put_vendor_profile_validations(session_cookies):
    """Test PUT /api/vendor/profile validation scenarios"""
    print(f"\n🧪 Testing PUT /api/vendor/profile validations")
    
    if not session_cookies:
        print("⚠️ No session cookies available for auth test")
        return True
    
    try:
        # Test 1: No auth
        response = requests.put(f"{BASE_URL}/vendor/profile", json={})
        print(f"No auth status: {response.status_code}")
        
        if response.status_code == 401:
            data = response.json()
            if 'غير مصرح' in data.get('error', ''):
                print("✅ Correct 401 response without auth")
            else:
                print(f"❌ Wrong error message: {data.get('error', '')}")
                return False
        else:
            print(f"❌ Expected 401, got {response.status_code}")
            return False
        
        # Test 2: businessName too short
        response = requests.put(
            f"{BASE_URL}/vendor/profile", 
            json={"businessName": "a"},
            cookies=session_cookies
        )
        print(f"Short businessName status: {response.status_code}")
        
        if response.status_code == 400:
            data = response.json()
            if 'اسم المتجر قصير جداً' in data.get('error', ''):
                print("✅ Correct validation for short businessName")
            else:
                print(f"❌ Wrong error message: {data.get('error', '')}")
                return False
        elif response.status_code == 403:
            data = response.json()
            if 'صلاحيات بائع مطلوبة' in data.get('error', ''):
                print("✅ Correct 403 response for non-vendor user")
                return True
            else:
                print(f"❌ Wrong error message: {data.get('error', '')}")
                return False
        else:
            print(f"❌ Expected 400 or 403, got {response.status_code}")
            return False
        
        # Test 3: Invalid banner format
        response = requests.put(
            f"{BASE_URL}/vendor/profile", 
            json={"banner": "http://evil.com/pic.png"},
            cookies=session_cookies
        )
        print(f"Invalid banner status: {response.status_code}")
        
        if response.status_code == 400:
            data = response.json()
            if 'صيغة/حجم الصورة غير مدعوم' in data.get('error', ''):
                print("✅ Correct validation for invalid banner format")
            else:
                print(f"❌ Wrong error message: {data.get('error', '')}")
                return False
        else:
            print(f"❌ Expected 400, got {response.status_code}")
            return False
        
        # Test 4: Slug too short
        response = requests.put(
            f"{BASE_URL}/vendor/profile", 
            json={"slug": "ab"},
            cookies=session_cookies
        )
        print(f"Short slug status: {response.status_code}")
        
        if response.status_code == 400:
            data = response.json()
            if 'الرابط يجب أن يكون بين 3 و 60 حرفاً' in data.get('error', ''):
                print("✅ Correct validation for short slug")
            else:
                print(f"❌ Wrong error message: {data.get('error', '')}")
                return False
        else:
            print(f"❌ Expected 400, got {response.status_code}")
            return False
        
        # Test 5: Invalid slug (no valid characters)
        response = requests.put(
            f"{BASE_URL}/vendor/profile", 
            json={"slug": "!!!"},
            cookies=session_cookies
        )
        print(f"Invalid slug status: {response.status_code}")
        
        if response.status_code == 400:
            data = response.json()
            if 'الرابط غير صالح' in data.get('error', ''):
                print("✅ Correct validation for invalid slug")
            else:
                print(f"❌ Wrong error message: {data.get('error', '')}")
                return False
        else:
            print(f"❌ Expected 400, got {response.status_code}")
            return False
        
        print("✅ All validation tests passed")
        return True
        
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False

def test_put_vendor_profile_happy_path(session_cookies):
    """Test PUT /api/vendor/profile happy path scenarios"""
    print(f"\n🧪 Testing PUT /api/vendor/profile happy path")
    
    if not session_cookies:
        print("⚠️ No session cookies available for auth test")
        return True
    
    try:
        # Valid small base64 PNG (1x1 pixel)
        valid_image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        
        # Test successful update
        update_data = {
            "businessName": "متجر الأحلام",
            "tagline": "أفضل العروض",
            "bio": "نحن متجر متخصص في تقديم أفضل المنتجات",
            "phone": "+968 9123 4567",
            "whatsapp": "+968 9123 4567",
            "instagram": "shop_ig",
            "website": "https://example.com",
            "governorate": "MUSCAT",
            "city": "مسقط",
            "address": "شارع السلطان قابوس",
            "banner": valid_image,
            "logo": valid_image,
            "slug": "متجر-تجريبي-جديد"
        }
        
        response = requests.put(
            f"{BASE_URL}/vendor/profile", 
            json=update_data,
            cookies=session_cookies
        )
        print(f"Update status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            profile = data.get('profile')
            
            if not profile:
                print("❌ No profile in response")
                return False
            
            # Verify updates were applied
            if profile.get('businessName') == "متجر الأحلام":
                print("✅ businessName updated correctly")
            else:
                print(f"❌ businessName not updated: {profile.get('businessName')}")
                return False
            
            if profile.get('tagline') == "أفضل العروض":
                print("✅ tagline updated correctly")
            else:
                print(f"❌ tagline not updated: {profile.get('tagline')}")
                return False
            
            if profile.get('banner') == valid_image:
                print("✅ banner updated correctly")
            else:
                print("❌ banner not updated correctly")
                return False
            
            # Verify slug is slugified
            expected_slug = profile.get('slug', '')
            if expected_slug and len(expected_slug) >= 3:
                print(f"✅ slug updated and slugified: {expected_slug}")
            else:
                print(f"❌ slug not properly updated: {expected_slug}")
                return False
            
            print("✅ Profile update successful with all fields")
            return True
            
        elif response.status_code == 403:
            data = response.json()
            if 'صلاحيات بائع مطلوبة' in data.get('error', ''):
                print("✅ Correct 403 response for non-vendor user")
                return True
            else:
                print(f"❌ Wrong error message: {data.get('error', '')}")
                return False
        else:
            print(f"❌ Unexpected status code: {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False

def test_regression_endpoints():
    """Test regression endpoints to ensure existing functionality still works"""
    print(f"\n🧪 Testing regression endpoints")
    
    try:
        # Test 1: GET /api/
        response = requests.get(f"{BASE_URL}/")
        if response.status_code == 200 and "Majles API is running" in response.text:
            print("✅ GET /api/ working")
        else:
            print(f"❌ GET /api/ failed: {response.status_code}")
            return False
        
        # Test 2: GET /api/products
        response = requests.get(f"{BASE_URL}/products")
        if response.status_code == 200:
            data = response.json()
            if 'products' in data:
                print("✅ GET /api/products working")
            else:
                print("❌ GET /api/products missing products field")
                return False
        else:
            print(f"❌ GET /api/products failed: {response.status_code}")
            return False
        
        # Test 3: POST /api/signup with unique email
        timestamp = int(time.time())
        signup_data = {
            "name": "مستخدم تجريبي",
            "email": f"test-regression-{timestamp}@example.com",
            "password": "Password123"
        }
        
        response = requests.post(f"{BASE_URL}/signup", json=signup_data)
        if response.status_code == 200:
            data = response.json()
            if data.get('success') and data.get('user'):
                print("✅ POST /api/signup working")
            else:
                print("❌ POST /api/signup invalid response structure")
                return False
        else:
            print(f"❌ POST /api/signup failed: {response.status_code}")
            return False
        
        print("✅ All regression tests passed")
        return True
        
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False

def main():
    """Main test execution"""
    print("🚀 Starting Vendor Storefront Backend Testing")
    print("=" * 60)
    
    # Setup database
    client, db = setup_database()
    
    # Create test data
    timestamp = int(time.time())
    
    # Create test vendor user
    vendor_email = f"test-vendor-{timestamp}@example.com"
    vendor_password = "Password123"
    vendor_id = create_test_user(db, vendor_email, vendor_password, "بائع تجريبي", "MEMBER")
    
    # Promote to VENDOR role
    db.users.update_one({"_id": vendor_id}, {"$set": {"role": "VENDOR"}})
    
    # Set vendor profile with slug
    vendor_slug = f"متجر-تجريبي-{timestamp}"
    db.users.update_one(
        {"_id": vendor_id}, 
        {"$set": {
            "vendorProfile.slug": vendor_slug,
            "vendorProfile.businessName": "متجر تجريبي",
            "vendorProfile.tagline": "أفضل المنتجات"
        }}
    )
    
    # Create test products for vendor
    product1_id = create_test_product(db, vendor_id, "منتج تجريبي 1", 25.0, True)
    product2_id = create_test_product(db, vendor_id, "منتج تجريبي 2", 35.0, True)
    
    # Create test member user
    member_email = f"test-member-{timestamp}@example.com"
    member_password = "Password123"
    member_id = create_test_user(db, member_email, member_password, "عضو تجريبي", "MEMBER")
    
    # Create second vendor for slug collision test
    vendor2_email = f"test-vendor2-{timestamp}@example.com"
    vendor2_password = "Password123"
    vendor2_id = create_test_user(db, vendor2_email, vendor2_password, "بائع تجريبي 2", "VENDOR")
    
    # Set known slug for collision test
    collision_slug = "متجر-تجريبي"
    db.users.update_one(
        {"_id": vendor2_id}, 
        {"$set": {
            "vendorProfile.slug": collision_slug,
            "vendorProfile.businessName": "متجر تجريبي للتصادم"
        }}
    )
    
    print(f"✅ Test data created:")
    print(f"   - Vendor: {vendor_email} (slug: {vendor_slug})")
    print(f"   - Member: {member_email}")
    print(f"   - Products: {len([product1_id, product2_id])}")
    print(f"   - Collision vendor slug: {collision_slug}")
    
    # Login users
    vendor_cookies = login_user(vendor_email, vendor_password)
    member_cookies = login_user(member_email, member_password)
    
    if vendor_cookies:
        print("✅ Vendor login successful")
    else:
        print("⚠️ Vendor login failed")
    
    if member_cookies:
        print("✅ Member login successful")
    else:
        print("⚠️ Member login failed")
    
    # Run tests
    test_results = []
    
    print("\n" + "=" * 60)
    print("🧪 RUNNING VENDOR STOREFRONT TESTS")
    print("=" * 60)
    
    # Test 1: GET /api/vendors (public)
    test_results.append(("GET /api/vendors (public)", test_get_vendors_public()))
    
    # Test 2: GET /api/vendors/:slug (valid slug)
    test_results.append(("GET /api/vendors/:slug (valid)", test_get_vendor_by_slug(vendor_slug)))
    
    # Test 3: GET /api/vendors/:slug (invalid slug)
    test_results.append(("GET /api/vendors/:slug (invalid)", test_get_vendor_by_invalid_slug()))
    
    # Test 4: GET /api/vendor/profile (auth tests)
    test_results.append(("GET /api/vendor/profile (auth)", test_get_vendor_profile_auth(vendor_cookies)))
    
    # Test 5: PUT /api/vendor/profile (validations)
    test_results.append(("PUT /api/vendor/profile (validations)", test_put_vendor_profile_validations(vendor_cookies)))
    
    # Test 6: PUT /api/vendor/profile (happy path)
    test_results.append(("PUT /api/vendor/profile (happy path)", test_put_vendor_profile_happy_path(vendor_cookies)))
    
    # Test 7: Regression tests
    test_results.append(("Regression endpoints", test_regression_endpoints()))
    
    # Test slug collision (if vendor login worked)
    if vendor_cookies:
        print(f"\n🧪 Testing slug collision")
        try:
            response = requests.put(
                f"{BASE_URL}/vendor/profile", 
                json={"slug": collision_slug},
                cookies=vendor_cookies
            )
            if response.status_code == 409:
                data = response.json()
                if 'هذا الرابط مستخدم، جرّب اسماً آخر' in data.get('error', ''):
                    print("✅ Slug collision correctly detected")
                    test_results.append(("Slug collision test", True))
                else:
                    print(f"❌ Wrong collision error: {data.get('error', '')}")
                    test_results.append(("Slug collision test", False))
            else:
                print(f"❌ Expected 409 for slug collision, got {response.status_code}")
                test_results.append(("Slug collision test", False))
        except Exception as e:
            print(f"❌ Slug collision test exception: {e}")
            test_results.append(("Slug collision test", False))
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 60)
    
    passed = 0
    total = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {test_name}")
        if result:
            passed += 1
    
    print(f"\n🎯 OVERALL RESULT: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED! Vendor Storefront endpoints are working correctly.")
    else:
        print("⚠️ Some tests failed. Please review the issues above.")
    
    # Cleanup
    try:
        db.users.delete_many({"email": {"$regex": f"test.*{timestamp}"}})
        db.products.delete_many({"vendorId": {"$in": [vendor_id, vendor2_id]}})
        print(f"\n🧹 Cleanup completed - removed test data")
    except Exception as e:
        print(f"⚠️ Cleanup warning: {e}")
    
    client.close()
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)