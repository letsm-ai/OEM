#!/usr/bin/env python3
"""
Phase B Refactoring Testing - Backend API Endpoints
Testing 4 extracted modules for functional parity:
1. vendor-application.js
2. payouts.js  
3. admin-users.js
4. vendor-profile.js
"""

import requests
import json
import uuid
import time
from datetime import datetime, timedelta
import os

# Get base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://omani-startup-hub.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

def print_test_result(test_name, success, details=""):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {test_name}")
    if details:
        print(f"   {details}")

def test_endpoint(method, endpoint, data=None, headers=None, expected_status=200):
    """Test an API endpoint and return response"""
    url = f"{API_BASE}{endpoint}"
    try:
        if method == 'GET':
            response = requests.get(url, headers=headers, timeout=10)
        elif method == 'POST':
            response = requests.post(url, json=data, headers=headers, timeout=10)
        elif method == 'PUT':
            response = requests.put(url, json=data, headers=headers, timeout=10)
        elif method == 'PATCH':
            response = requests.patch(url, json=data, headers=headers, timeout=10)
        elif method == 'DELETE':
            response = requests.delete(url, headers=headers, timeout=10)
        
        success = response.status_code == expected_status
        return success, response
    except Exception as e:
        return False, str(e)

def get_auth_session():
    """Get authenticated session using NextAuth credentials"""
    session = requests.Session()
    
    # Get CSRF token
    csrf_response = session.get(f"{API_BASE}/auth/csrf")
    if csrf_response.status_code != 200:
        return None, "Failed to get CSRF token"
    
    csrf_token = csrf_response.json().get('csrfToken')
    if not csrf_token:
        return None, "No CSRF token in response"
    
    # Create test user first
    timestamp = int(time.time())
    test_email = f"phaseb_test_{timestamp}@x.com"
    test_password = "Password123"
    
    signup_data = {
        "name": f"Phase B Test User {timestamp}",
        "email": test_email,
        "password": test_password
    }
    
    signup_response = session.post(f"{API_BASE}/signup", json=signup_data)
    if signup_response.status_code != 200:
        return None, f"Failed to create test user: {signup_response.status_code}"
    
    # Login with credentials
    login_data = {
        'email': test_email,
        'password': test_password,
        'csrfToken': csrf_token,
        'callbackUrl': BASE_URL,
        'json': 'true'
    }
    
    login_response = session.post(
        f"{API_BASE}/auth/callback/credentials",
        data=login_data,  # Form data, not JSON
        headers={'Content-Type': 'application/x-www-form-urlencoded'}
    )
    
    # Verify session
    me_response = session.get(f"{API_BASE}/me")
    if me_response.status_code == 200:
        user_data = me_response.json()
        return session, user_data
    
    return None, f"Authentication failed: {me_response.status_code}"

def promote_user_to_admin(session, user_id):
    """Promote user to admin using direct database update"""
    try:
        import pymongo
        from bson import ObjectId
        
        # Connect to MongoDB
        mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017/majles')
        client = pymongo.MongoClient(mongo_url)
        db = client.get_default_database()
        
        # Update user role to ADMIN
        result = db.users.update_one(
            {"_id": user_id},
            {"$set": {"role": "ADMIN"}}
        )
        
        return result.modified_count > 0
    except Exception as e:
        print(f"Failed to promote user to admin: {e}")
        return False

def create_test_vendor_application(session):
    """Create a test vendor application"""
    app_data = {
        "businessName": f"Test Business {int(time.time())}",
        "businessDescription": "Test business description for Phase B testing",
        "phone": "+968 9123 4567"
    }
    
    response = session.post(f"{API_BASE}/vendor/apply", json=app_data)
    if response.status_code == 200:
        return response.json().get('application', {}).get('id')
    return None

def test_vendor_application_endpoints():
    """Test vendor application endpoints from vendor-application.js"""
    print("\n🧪 TESTING VENDOR APPLICATION ENDPOINTS")
    
    # Test 1: GET /api/vendor/application (auth required)
    success, response = test_endpoint('GET', '/vendor/application', expected_status=401)
    print_test_result("GET /vendor/application (no auth)", success, "Returns 401 as expected")
    
    # Get authenticated session
    session, user_data = get_auth_session()
    if not session:
        print("❌ Failed to get authenticated session for vendor application tests")
        return
    
    # Test 2: GET /api/vendor/application (authenticated)
    response = session.get(f"{API_BASE}/vendor/application")
    success = response.status_code == 200
    print_test_result("GET /vendor/application (authenticated)", success, 
                     f"Status: {response.status_code}")
    
    # Test 3: POST /api/vendor/apply (create application)
    app_data = {
        "businessName": f"Phase B Test Business {int(time.time())}",
        "businessDescription": "Test business for Phase B refactoring validation",
        "phone": "+968 9876 5432"
    }
    
    response = session.post(f"{API_BASE}/vendor/apply", json=app_data)
    success = response.status_code == 200
    app_id = None
    if success and response.json().get('application'):
        app_id = response.json()['application']['id']
    print_test_result("POST /vendor/apply", success, 
                     f"Status: {response.status_code}, App ID: {app_id}")
    
    # Test 4: POST /api/vendor/apply (duplicate application)
    response = session.post(f"{API_BASE}/vendor/apply", json=app_data)
    success = response.status_code == 409  # Should be conflict
    print_test_result("POST /vendor/apply (duplicate)", success, 
                     f"Status: {response.status_code} (expected 409)")
    
    # Test 5: GET /api/admin/vendor-applications (no auth)
    success, response = test_endpoint('GET', '/admin/vendor-applications', expected_status=401)
    print_test_result("GET /admin/vendor-applications (no auth)", success, "Returns 401 as expected")
    
    # Promote user to admin for admin tests
    if user_data and promote_user_to_admin(session, user_data['id']):
        print("   📝 User promoted to ADMIN for admin endpoint testing")
        
        # Test 6: GET /api/admin/vendor-applications (admin)
        response = session.get(f"{API_BASE}/admin/vendor-applications")
        success = response.status_code == 200
        print_test_result("GET /admin/vendor-applications (admin)", success, 
                         f"Status: {response.status_code}")
        
        # Test 7: POST /api/admin/vendor-applications/:id/approve (admin)
        if app_id:
            approve_data = {"note": "Approved for Phase B testing"}
            response = session.post(f"{API_BASE}/admin/vendor-applications/{app_id}/approve", 
                                  json=approve_data)
            success = response.status_code == 200
            print_test_result("POST /admin/vendor-applications/:id/approve", success, 
                             f"Status: {response.status_code}")

def test_payouts_endpoints():
    """Test payout endpoints from payouts.js"""
    print("\n🧪 TESTING PAYOUTS ENDPOINTS")
    
    # Test 1: GET /api/vendor/payouts (no auth)
    success, response = test_endpoint('GET', '/vendor/payouts', expected_status=401)
    print_test_result("GET /vendor/payouts (no auth)", success, "Returns 401 as expected")
    
    # Get authenticated session
    session, user_data = get_auth_session()
    if not session:
        print("❌ Failed to get authenticated session for payouts tests")
        return
    
    # Promote to vendor/admin for payout access
    if user_data and promote_user_to_admin(session, user_data['id']):
        print("   📝 User promoted to ADMIN for payout endpoint testing")
        
        # Test 2: GET /api/vendor/payouts (vendor/admin)
        response = session.get(f"{API_BASE}/vendor/payouts")
        success = response.status_code == 200
        print_test_result("GET /vendor/payouts (vendor/admin)", success, 
                         f"Status: {response.status_code}")
        
        # Test 3: POST /api/vendor/payouts (invalid amount)
        payout_data = {
            "amount": 5,  # Below minimum
            "bankDetails": {
                "accountHolderName": "Test User",
                "bankName": "Test Bank",
                "iban": "OM12345678901234567890"
            }
        }
        response = session.post(f"{API_BASE}/vendor/payouts", json=payout_data)
        success = response.status_code == 400  # Should fail due to minimum amount
        print_test_result("POST /vendor/payouts (below minimum)", success, 
                         f"Status: {response.status_code} (expected 400)")
        
        # Test 4: POST /api/vendor/payouts (invalid IBAN)
        payout_data["amount"] = 50
        payout_data["bankDetails"]["iban"] = "INVALID_IBAN"
        response = session.post(f"{API_BASE}/vendor/payouts", json=payout_data)
        success = response.status_code == 400  # Should fail due to invalid IBAN
        print_test_result("POST /vendor/payouts (invalid IBAN)", success, 
                         f"Status: {response.status_code} (expected 400)")
        
        # Test 5: GET /api/admin/payouts (admin)
        response = session.get(f"{API_BASE}/admin/payouts")
        success = response.status_code == 200
        print_test_result("GET /admin/payouts (admin)", success, 
                         f"Status: {response.status_code}")

def test_admin_users_endpoints():
    """Test admin user management endpoints from admin-users.js"""
    print("\n🧪 TESTING ADMIN USERS ENDPOINTS")
    
    # Test 1: GET /api/admin/users (no auth)
    success, response = test_endpoint('GET', '/admin/users', expected_status=401)
    print_test_result("GET /admin/users (no auth)", success, "Returns 401 as expected")
    
    # Get authenticated session
    session, user_data = get_auth_session()
    if not session:
        print("❌ Failed to get authenticated session for admin users tests")
        return
    
    # Test 2: GET /api/admin/users (non-admin)
    response = session.get(f"{API_BASE}/admin/users")
    success = response.status_code == 403  # Should be forbidden for non-admin
    print_test_result("GET /admin/users (non-admin)", success, 
                     f"Status: {response.status_code} (expected 403)")
    
    # Promote to admin
    if user_data and promote_user_to_admin(session, user_data['id']):
        print("   📝 User promoted to ADMIN for admin users endpoint testing")
        
        # Test 3: GET /api/admin/users (admin)
        response = session.get(f"{API_BASE}/admin/users")
        success = response.status_code == 200
        result_data = None
        if success:
            result_data = response.json()
        print_test_result("GET /admin/users (admin)", success, 
                         f"Status: {response.status_code}")
        
        # Test 4: GET /api/admin/users with filters
        response = session.get(f"{API_BASE}/admin/users?role=ADMIN&page=1&limit=5")
        success = response.status_code == 200
        print_test_result("GET /admin/users (with filters)", success, 
                         f"Status: {response.status_code}")
        
        # Test 5: PATCH /api/admin/users/:id (modify user)
        if result_data and result_data.get('users'):
            # Find a non-admin user to modify
            target_user = None
            for user in result_data['users']:
                if user['role'] != 'ADMIN' and user['id'] != user_data['id']:
                    target_user = user
                    break
            
            if target_user:
                patch_data = {"membershipTier": "GOLD"}
                response = session.patch(f"{API_BASE}/admin/users/{target_user['id']}", 
                                       json=patch_data)
                success = response.status_code == 200
                print_test_result("PATCH /admin/users/:id", success, 
                                 f"Status: {response.status_code}")
        
        # Test 6: GET /api/admin/approvals/summary
        response = session.get(f"{API_BASE}/admin/approvals/summary")
        success = response.status_code == 200
        print_test_result("GET /admin/approvals/summary", success, 
                         f"Status: {response.status_code}")

def test_vendor_profile_endpoints():
    """Test vendor profile endpoints from vendor-profile.js"""
    print("\n🧪 TESTING VENDOR PROFILE ENDPOINTS")
    
    # Test 1: GET /api/vendors (public)
    success, response = test_endpoint('GET', '/vendors', expected_status=200)
    print_test_result("GET /vendors (public)", success, f"Status: {response.status_code}")
    
    # Test 2: GET /api/vendor/profile (no auth)
    success, response = test_endpoint('GET', '/vendor/profile', expected_status=401)
    print_test_result("GET /vendor/profile (no auth)", success, "Returns 401 as expected")
    
    # Get authenticated session
    session, user_data = get_auth_session()
    if not session:
        print("❌ Failed to get authenticated session for vendor profile tests")
        return
    
    # Test 3: GET /api/vendor/profile (non-vendor)
    response = session.get(f"{API_BASE}/vendor/profile")
    success = response.status_code == 403  # Should be forbidden for non-vendor
    print_test_result("GET /vendor/profile (non-vendor)", success, 
                     f"Status: {response.status_code} (expected 403)")
    
    # Promote to vendor/admin
    if user_data and promote_user_to_admin(session, user_data['id']):
        print("   📝 User promoted to ADMIN for vendor profile endpoint testing")
        
        # Test 4: GET /api/vendor/profile (vendor/admin)
        response = session.get(f"{API_BASE}/vendor/profile")
        success = response.status_code == 200
        print_test_result("GET /vendor/profile (vendor/admin)", success, 
                         f"Status: {response.status_code}")
        
        # Test 5: PUT /api/vendor/profile (update profile)
        profile_data = {
            "businessName": f"Phase B Test Store {int(time.time())}",
            "tagline": "Testing Phase B refactoring",
            "bio": "This is a test vendor profile for Phase B validation",
            "phone": "+968 9999 8888",
            "governorate": "MUSCAT",
            "city": "Muscat",
            "vendorAbsorbsShipping": True
        }
        response = session.put(f"{API_BASE}/vendor/profile", json=profile_data)
        success = response.status_code == 200
        print_test_result("PUT /vendor/profile", success, 
                         f"Status: {response.status_code}")
        
        # Test 6: PUT /api/vendor/profile (slug validation)
        profile_data["slug"] = "test-phase-b-vendor"
        response = session.put(f"{API_BASE}/vendor/profile", json=profile_data)
        success = response.status_code == 200
        vendor_slug = None
        if success:
            result = response.json()
            vendor_slug = result.get('profile', {}).get('slug')
        print_test_result("PUT /vendor/profile (with slug)", success, 
                         f"Status: {response.status_code}, Slug: {vendor_slug}")
        
        # Test 7: GET /api/vendors/:slug (public storefront)
        if vendor_slug:
            success, response = test_endpoint('GET', f'/vendors/{vendor_slug}', expected_status=200)
            print_test_result("GET /vendors/:slug (public storefront)", success, 
                             f"Status: {response.status_code}")

def test_regression_endpoints():
    """Test key regression endpoints to ensure no breaking changes"""
    print("\n🧪 TESTING REGRESSION ENDPOINTS")
    
    # Test 1: GET /api/ (health check)
    success, response = test_endpoint('GET', '/', expected_status=200)
    print_test_result("GET /api/ (health check)", success, f"Status: {response.status_code}")
    
    # Test 2: POST /api/signup (user creation)
    timestamp = int(time.time())
    signup_data = {
        "name": f"Regression Test User {timestamp}",
        "email": f"regression_{timestamp}@x.com",
        "password": "Password123"
    }
    success, response = test_endpoint('POST', '/signup', data=signup_data, expected_status=200)
    print_test_result("POST /api/signup", success, f"Status: {response.status_code}")
    
    # Test 3: GET /api/products (marketplace)
    success, response = test_endpoint('GET', '/products', expected_status=200)
    print_test_result("GET /api/products", success, f"Status: {response.status_code}")

def main():
    """Run all Phase B refactoring tests"""
    print("🚀 PHASE B REFACTORING TESTING - Backend API Endpoints")
    print("=" * 60)
    print("Testing 4 extracted modules for functional parity:")
    print("1. vendor-application.js")
    print("2. payouts.js")
    print("3. admin-users.js") 
    print("4. vendor-profile.js")
    print("=" * 60)
    
    start_time = time.time()
    
    # Test all endpoint groups
    test_vendor_application_endpoints()
    test_payouts_endpoints()
    test_admin_users_endpoints()
    test_vendor_profile_endpoints()
    test_regression_endpoints()
    
    end_time = time.time()
    duration = end_time - start_time
    
    print("\n" + "=" * 60)
    print(f"🎯 PHASE B TESTING COMPLETE")
    print(f"⏱️  Total Duration: {duration:.2f} seconds")
    print(f"🌐 Base URL: {BASE_URL}")
    print("=" * 60)

if __name__ == "__main__":
    main()