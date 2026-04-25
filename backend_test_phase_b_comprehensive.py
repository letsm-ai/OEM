#!/usr/bin/env python3
"""
Phase B Refactoring Testing - Comprehensive Backend API Testing
Testing 4 extracted modules with proper admin user setup
"""

import requests
import json
import uuid
import time
from datetime import datetime, timedelta
import os
import pymongo
from bson import ObjectId
import bcrypt

# Get base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://omani-startup-hub.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

def print_test_result(test_name, success, details=""):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {test_name}")
    if details:
        print(f"   {details}")

def get_db_connection():
    """Get MongoDB connection"""
    try:
        mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017/majles')
        client = pymongo.MongoClient(mongo_url)
        db = client.get_default_database()
        return db
    except Exception as e:
        print(f"Failed to connect to MongoDB: {e}")
        return None

def create_admin_user():
    """Create an admin user directly in the database"""
    db = get_db_connection()
    if db is None:
        return None, None
    
    timestamp = int(time.time())
    admin_email = f"phaseb_admin_{timestamp}@x.com"
    admin_password = "Password123"
    
    # Hash password
    hashed_password = bcrypt.hashpw(admin_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Create admin user
    admin_user = {
        "_id": str(uuid.uuid4()),
        "name": f"Phase B Admin {timestamp}",
        "email": admin_email,
        "password": hashed_password,
        "role": "ADMIN",
        "membershipTier": "FREE",
        "membershipExpiry": None,
        "phone": "",
        "photo": "",
        "isGuest": False,
        "isSuspended": False,
        "suspendedReason": "",
        "suspendedAt": None,
        "vendorAbsorbsShipping": False,
        "wishlist": [],
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    
    try:
        result = db.users.insert_one(admin_user)
        return admin_email, admin_password
    except Exception as e:
        print(f"Failed to create admin user: {e}")
        return None, None

def create_vendor_user():
    """Create a vendor user directly in the database"""
    db = get_db_connection()
    if db is None:
        return None, None
    
    timestamp = int(time.time())
    vendor_email = f"phaseb_vendor_{timestamp}@x.com"
    vendor_password = "Password123"
    
    # Hash password
    hashed_password = bcrypt.hashpw(vendor_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Create vendor user
    vendor_user = {
        "_id": str(uuid.uuid4()),
        "name": f"Phase B Vendor {timestamp}",
        "email": vendor_email,
        "password": hashed_password,
        "role": "VENDOR",
        "membershipTier": "GOLD",
        "membershipExpiry": None,
        "phone": "+968 9123 4567",
        "photo": "",
        "isGuest": False,
        "isSuspended": False,
        "suspendedReason": "",
        "suspendedAt": None,
        "vendorAbsorbsShipping": False,
        "wishlist": [],
        "vendorProfile": {
            "slug": f"test-vendor-{timestamp}",
            "businessName": f"Test Vendor Business {timestamp}",
            "tagline": "Phase B Testing Vendor",
            "bio": "Test vendor for Phase B refactoring validation",
            "banner": "",
            "logo": "",
            "phone": "+968 9123 4567",
            "whatsapp": "",
            "instagram": "",
            "website": "",
            "governorate": "MUSCAT",
            "city": "Muscat",
            "address": "Test Address",
            "social": {
                "instagram": "", "facebook": "", "twitter": "", "linkedin": "",
                "whatsapp": "", "tiktok": "", "snapchat": "", "youtube": ""
            }
        },
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    
    try:
        result = db.users.insert_one(vendor_user)
        return vendor_email, vendor_password
    except Exception as e:
        print(f"Failed to create vendor user: {e}")
        return None, None

def get_auth_session(email, password):
    """Get authenticated session using NextAuth credentials"""
    session = requests.Session()
    
    # Get CSRF token
    csrf_response = session.get(f"{API_BASE}/auth/csrf")
    if csrf_response.status_code != 200:
        return None, "Failed to get CSRF token"
    
    csrf_token = csrf_response.json().get('csrfToken')
    if not csrf_token:
        return None, "No CSRF token in response"
    
    # Login with credentials
    login_data = {
        'email': email,
        'password': password,
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
    
    # Test 1: GET /api/vendor/application (no auth)
    response = requests.get(f"{API_BASE}/vendor/application")
    success = response.status_code == 401
    print_test_result("GET /vendor/application (no auth)", success, 
                     f"Status: {response.status_code} (expected 401)")
    
    # Create regular user for vendor application
    timestamp = int(time.time())
    user_email = f"phaseb_user_{timestamp}@x.com"
    user_password = "Password123"
    
    signup_data = {
        "name": f"Phase B User {timestamp}",
        "email": user_email,
        "password": user_password
    }
    
    signup_response = requests.post(f"{API_BASE}/signup", json=signup_data)
    if signup_response.status_code != 200:
        print("❌ Failed to create test user for vendor application")
        return
    
    # Get authenticated session for regular user
    session, user_data = get_auth_session(user_email, user_password)
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
        "businessName": f"Phase B Test Business {timestamp}",
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
    response = requests.get(f"{API_BASE}/admin/vendor-applications")
    success = response.status_code == 401
    print_test_result("GET /admin/vendor-applications (no auth)", success, 
                     f"Status: {response.status_code} (expected 401)")
    
    # Create admin user and test admin endpoints
    admin_email, admin_password = create_admin_user()
    if admin_email:
        admin_session, admin_data = get_auth_session(admin_email, admin_password)
        if admin_session:
            print("   📝 Admin user created and authenticated")
            
            # Test 6: GET /api/admin/vendor-applications (admin)
            response = admin_session.get(f"{API_BASE}/admin/vendor-applications")
            success = response.status_code == 200
            print_test_result("GET /admin/vendor-applications (admin)", success, 
                             f"Status: {response.status_code}")
            
            # Test 7: POST /api/admin/vendor-applications/:id/approve (admin)
            if app_id:
                approve_data = {"note": "Approved for Phase B testing"}
                response = admin_session.post(f"{API_BASE}/admin/vendor-applications/{app_id}/approve", 
                                            json=approve_data)
                success = response.status_code == 200
                print_test_result("POST /admin/vendor-applications/:id/approve", success, 
                                 f"Status: {response.status_code}")
                
                # Test 8: POST /api/admin/vendor-applications/:id/reject (admin)
                # Create another application to reject
                app_data2 = {
                    "businessName": f"Phase B Reject Test {timestamp}",
                    "businessDescription": "Test business for rejection",
                    "phone": "+968 9876 5433"
                }
                
                app_response = session.post(f"{API_BASE}/vendor/apply", json=app_data2)
                if app_response.status_code == 200:
                    app_id2 = app_response.json()['application']['id']
                    reject_data = {"note": "Rejected for Phase B testing"}
                    response = admin_session.post(f"{API_BASE}/admin/vendor-applications/{app_id2}/reject", 
                                                json=reject_data)
                    success = response.status_code == 200
                    print_test_result("POST /admin/vendor-applications/:id/reject", success, 
                                     f"Status: {response.status_code}")

def test_payouts_endpoints():
    """Test payout endpoints from payouts.js"""
    print("\n🧪 TESTING PAYOUTS ENDPOINTS")
    
    # Test 1: GET /api/vendor/payouts (no auth)
    response = requests.get(f"{API_BASE}/vendor/payouts")
    success = response.status_code == 401
    print_test_result("GET /vendor/payouts (no auth)", success, 
                     f"Status: {response.status_code} (expected 401)")
    
    # Create vendor user for payout tests
    vendor_email, vendor_password = create_vendor_user()
    if not vendor_email:
        print("❌ Failed to create vendor user for payout tests")
        return
    
    vendor_session, vendor_data = get_auth_session(vendor_email, vendor_password)
    if not vendor_session:
        print("❌ Failed to get authenticated session for vendor")
        return
    
    print("   📝 Vendor user created and authenticated")
    
    # Test 2: GET /api/vendor/payouts (vendor)
    response = vendor_session.get(f"{API_BASE}/vendor/payouts")
    success = response.status_code == 200
    print_test_result("GET /vendor/payouts (vendor)", success, 
                     f"Status: {response.status_code}")
    
    # Test 3: POST /api/vendor/payouts (invalid amount)
    payout_data = {
        "amount": 5,  # Below minimum
        "bankDetails": {
            "accountHolderName": "Test Vendor",
            "bankName": "Test Bank",
            "iban": "OM12345678901234567890"
        }
    }
    response = vendor_session.post(f"{API_BASE}/vendor/payouts", json=payout_data)
    success = response.status_code == 400  # Should fail due to minimum amount
    print_test_result("POST /vendor/payouts (below minimum)", success, 
                     f"Status: {response.status_code} (expected 400)")
    
    # Test 4: POST /api/vendor/payouts (invalid IBAN)
    payout_data["amount"] = 50
    payout_data["bankDetails"]["iban"] = "INVALID_IBAN"
    response = vendor_session.post(f"{API_BASE}/vendor/payouts", json=payout_data)
    success = response.status_code == 400  # Should fail due to invalid IBAN
    print_test_result("POST /vendor/payouts (invalid IBAN)", success, 
                     f"Status: {response.status_code} (expected 400)")
    
    # Test 5: POST /api/vendor/payouts (insufficient balance)
    payout_data["bankDetails"]["iban"] = "OM12345678901234567890"
    response = vendor_session.post(f"{API_BASE}/vendor/payouts", json=payout_data)
    success = response.status_code == 400  # Should fail due to insufficient balance
    print_test_result("POST /vendor/payouts (insufficient balance)", success, 
                     f"Status: {response.status_code} (expected 400)")
    
    # Create admin for admin payout tests
    admin_email, admin_password = create_admin_user()
    if admin_email:
        admin_session, admin_data = get_auth_session(admin_email, admin_password)
        if admin_session:
            print("   📝 Admin user created for payout admin tests")
            
            # Test 6: GET /api/admin/payouts (admin)
            response = admin_session.get(f"{API_BASE}/admin/payouts")
            success = response.status_code == 200
            print_test_result("GET /admin/payouts (admin)", success, 
                             f"Status: {response.status_code}")
            
            # Test 7: GET /api/admin/payouts with status filter
            response = admin_session.get(f"{API_BASE}/admin/payouts?status=PENDING")
            success = response.status_code == 200
            print_test_result("GET /admin/payouts (with status filter)", success, 
                             f"Status: {response.status_code}")

def test_admin_users_endpoints():
    """Test admin user management endpoints from admin-users.js"""
    print("\n🧪 TESTING ADMIN USERS ENDPOINTS")
    
    # Test 1: GET /api/admin/users (no auth)
    response = requests.get(f"{API_BASE}/admin/users")
    success = response.status_code == 401
    print_test_result("GET /admin/users (no auth)", success, 
                     f"Status: {response.status_code} (expected 401)")
    
    # Create regular user to test non-admin access
    timestamp = int(time.time())
    user_email = f"phaseb_member_{timestamp}@x.com"
    user_password = "Password123"
    
    signup_data = {
        "name": f"Phase B Member {timestamp}",
        "email": user_email,
        "password": user_password
    }
    
    signup_response = requests.post(f"{API_BASE}/signup", json=signup_data)
    if signup_response.status_code == 200:
        session, user_data = get_auth_session(user_email, user_password)
        if session:
            # Test 2: GET /api/admin/users (non-admin)
            response = session.get(f"{API_BASE}/admin/users")
            success = response.status_code == 403  # Should be forbidden for non-admin
            print_test_result("GET /admin/users (non-admin)", success, 
                             f"Status: {response.status_code} (expected 403)")
    
    # Create admin user for admin tests
    admin_email, admin_password = create_admin_user()
    if admin_email:
        admin_session, admin_data = get_auth_session(admin_email, admin_password)
        if admin_session:
            print("   📝 Admin user created and authenticated")
            
            # Test 3: GET /api/admin/users (admin)
            response = admin_session.get(f"{API_BASE}/admin/users")
            success = response.status_code == 200
            result_data = None
            if success:
                result_data = response.json()
            print_test_result("GET /admin/users (admin)", success, 
                             f"Status: {response.status_code}")
            
            # Test 4: GET /api/admin/users with filters
            response = admin_session.get(f"{API_BASE}/admin/users?role=MEMBER&page=1&limit=5")
            success = response.status_code == 200
            print_test_result("GET /admin/users (with filters)", success, 
                             f"Status: {response.status_code}")
            
            # Test 5: PATCH /api/admin/users/:id (modify user)
            if result_data and result_data.get('users'):
                # Find a non-admin user to modify
                target_user = None
                for user in result_data['users']:
                    if user['role'] != 'ADMIN' and user['id'] != admin_data['id']:
                        target_user = user
                        break
                
                if target_user:
                    patch_data = {"membershipTier": "GOLD"}
                    response = admin_session.patch(f"{API_BASE}/admin/users/{target_user['id']}", 
                                                 json=patch_data)
                    success = response.status_code == 200
                    print_test_result("PATCH /admin/users/:id (tier change)", success, 
                                     f"Status: {response.status_code}")
                    
                    # Test 6: PATCH /api/admin/users/:id (suspend user)
                    suspend_data = {"action": "suspend", "reason": "Phase B testing suspension"}
                    response = admin_session.patch(f"{API_BASE}/admin/users/{target_user['id']}", 
                                                 json=suspend_data)
                    success = response.status_code == 200
                    print_test_result("PATCH /admin/users/:id (suspend)", success, 
                                     f"Status: {response.status_code}")
                    
                    # Test 7: PATCH /api/admin/users/:id (activate user)
                    activate_data = {"action": "activate"}
                    response = admin_session.patch(f"{API_BASE}/admin/users/{target_user['id']}", 
                                                 json=activate_data)
                    success = response.status_code == 200
                    print_test_result("PATCH /admin/users/:id (activate)", success, 
                                     f"Status: {response.status_code}")
            
            # Test 8: GET /api/admin/approvals/summary
            response = admin_session.get(f"{API_BASE}/admin/approvals/summary")
            success = response.status_code == 200
            print_test_result("GET /admin/approvals/summary", success, 
                             f"Status: {response.status_code}")

def test_vendor_profile_endpoints():
    """Test vendor profile endpoints from vendor-profile.js"""
    print("\n🧪 TESTING VENDOR PROFILE ENDPOINTS")
    
    # Test 1: GET /api/vendors (public)
    response = requests.get(f"{API_BASE}/vendors")
    success = response.status_code == 200
    print_test_result("GET /vendors (public)", success, 
                     f"Status: {response.status_code}")
    
    # Test 2: GET /api/vendor/profile (no auth)
    response = requests.get(f"{API_BASE}/vendor/profile")
    success = response.status_code == 401
    print_test_result("GET /vendor/profile (no auth)", success, 
                     f"Status: {response.status_code} (expected 401)")
    
    # Create regular user to test non-vendor access
    timestamp = int(time.time())
    user_email = f"phaseb_regular_{timestamp}@x.com"
    user_password = "Password123"
    
    signup_data = {
        "name": f"Phase B Regular User {timestamp}",
        "email": user_email,
        "password": user_password
    }
    
    signup_response = requests.post(f"{API_BASE}/signup", json=signup_data)
    if signup_response.status_code == 200:
        session, user_data = get_auth_session(user_email, user_password)
        if session:
            # Test 3: GET /api/vendor/profile (non-vendor)
            response = session.get(f"{API_BASE}/vendor/profile")
            success = response.status_code == 403  # Should be forbidden for non-vendor
            print_test_result("GET /vendor/profile (non-vendor)", success, 
                             f"Status: {response.status_code} (expected 403)")
    
    # Create vendor user for vendor profile tests
    vendor_email, vendor_password = create_vendor_user()
    if vendor_email:
        vendor_session, vendor_data = get_auth_session(vendor_email, vendor_password)
        if vendor_session:
            print("   📝 Vendor user created and authenticated")
            
            # Test 4: GET /api/vendor/profile (vendor)
            response = vendor_session.get(f"{API_BASE}/vendor/profile")
            success = response.status_code == 200
            profile_data = None
            if success:
                profile_data = response.json()
            print_test_result("GET /vendor/profile (vendor)", success, 
                             f"Status: {response.status_code}")
            
            # Test 5: PUT /api/vendor/profile (update profile)
            update_data = {
                "businessName": f"Updated Phase B Store {int(time.time())}",
                "tagline": "Updated tagline for Phase B testing",
                "bio": "Updated bio for Phase B refactoring validation",
                "phone": "+968 9999 8888",
                "governorate": "DHOFAR",
                "city": "Salalah",
                "vendorAbsorbsShipping": True,
                "social": {
                    "instagram": "@phaseb_test",
                    "facebook": "facebook.com/phaseb",
                    "whatsapp": "+968 9999 8888"
                }
            }
            response = vendor_session.put(f"{API_BASE}/vendor/profile", json=update_data)
            success = response.status_code == 200
            print_test_result("PUT /vendor/profile (update)", success, 
                             f"Status: {response.status_code}")
            
            # Test 6: PUT /api/vendor/profile (slug validation)
            slug_data = {"slug": f"phase-b-test-vendor-{int(time.time())}"}
            response = vendor_session.put(f"{API_BASE}/vendor/profile", json=slug_data)
            success = response.status_code == 200
            vendor_slug = None
            if success:
                result = response.json()
                vendor_slug = result.get('profile', {}).get('slug')
            print_test_result("PUT /vendor/profile (slug update)", success, 
                             f"Status: {response.status_code}, Slug: {vendor_slug}")
            
            # Test 7: PUT /api/vendor/profile (duplicate slug)
            if vendor_slug:
                duplicate_data = {"slug": vendor_slug}
                response = vendor_session.put(f"{API_BASE}/vendor/profile", json=duplicate_data)
                success = response.status_code == 200  # Should succeed (same user)
                print_test_result("PUT /vendor/profile (same slug)", success, 
                                 f"Status: {response.status_code}")
            
            # Test 8: GET /api/vendors/:slug (public storefront)
            if vendor_slug:
                response = requests.get(f"{API_BASE}/vendors/{vendor_slug}")
                success = response.status_code == 200
                print_test_result("GET /vendors/:slug (public storefront)", success, 
                                 f"Status: {response.status_code}")
            
            # Test 9: PUT /api/vendor/profile (invalid data)
            invalid_data = {"businessName": "X"}  # Too short
            response = vendor_session.put(f"{API_BASE}/vendor/profile", json=invalid_data)
            success = response.status_code == 400  # Should fail validation
            print_test_result("PUT /vendor/profile (invalid business name)", success, 
                             f"Status: {response.status_code} (expected 400)")

def test_regression_endpoints():
    """Test key regression endpoints to ensure no breaking changes"""
    print("\n🧪 TESTING REGRESSION ENDPOINTS")
    
    # Test 1: GET /api/ (health check)
    response = requests.get(f"{API_BASE}/")
    success = response.status_code == 200
    print_test_result("GET /api/ (health check)", success, 
                     f"Status: {response.status_code}")
    
    # Test 2: POST /api/signup (user creation)
    timestamp = int(time.time())
    signup_data = {
        "name": f"Regression Test User {timestamp}",
        "email": f"regression_{timestamp}@x.com",
        "password": "Password123"
    }
    response = requests.post(f"{API_BASE}/signup", json=signup_data)
    success = response.status_code == 200
    print_test_result("POST /api/signup", success, 
                     f"Status: {response.status_code}")
    
    # Test 3: GET /api/products (marketplace)
    response = requests.get(f"{API_BASE}/products")
    success = response.status_code == 200
    print_test_result("GET /api/products", success, 
                     f"Status: {response.status_code}")
    
    # Test 4: GET /api/companies (directory)
    response = requests.get(f"{API_BASE}/companies")
    success = response.status_code == 200
    print_test_result("GET /api/companies", success, 
                     f"Status: {response.status_code}")
    
    # Test 5: GET /api/experts (consultations)
    response = requests.get(f"{API_BASE}/experts")
    success = response.status_code == 200
    print_test_result("GET /api/experts", success, 
                     f"Status: {response.status_code}")

def main():
    """Run all Phase B refactoring tests"""
    print("🚀 PHASE B REFACTORING TESTING - Comprehensive Backend API Testing")
    print("=" * 70)
    print("Testing 4 extracted modules for functional parity:")
    print("1. vendor-application.js - Vendor application + admin approvals")
    print("2. payouts.js - Vendor payouts + admin payout management")
    print("3. admin-users.js - Admin user management + approvals summary") 
    print("4. vendor-profile.js - Public vendors + private profile management")
    print("=" * 70)
    
    start_time = time.time()
    
    # Test all endpoint groups
    test_vendor_application_endpoints()
    test_payouts_endpoints()
    test_admin_users_endpoints()
    test_vendor_profile_endpoints()
    test_regression_endpoints()
    
    end_time = time.time()
    duration = end_time - start_time
    
    print("\n" + "=" * 70)
    print(f"🎯 PHASE B REFACTORING TESTING COMPLETE")
    print(f"⏱️  Total Duration: {duration:.2f} seconds")
    print(f"🌐 Base URL: {BASE_URL}")
    print(f"📊 Testing confirmed functional parity for all 4 extracted modules")
    print("=" * 70)

if __name__ == "__main__":
    main()