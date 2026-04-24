#!/usr/bin/env python3
"""
Backend Testing for Phase 6 Admin Dashboard Endpoints
Tests the new admin user management and approvals summary endpoints
"""

import requests
import json
import time
import uuid
from datetime import datetime, timedelta
import pymongo
import bcrypt

# Configuration
BASE_URL = "https://omani-startup-hub.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# MongoDB connection for direct DB operations
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "majles"

def get_mongo_client():
    """Get MongoDB client for direct database operations"""
    client = pymongo.MongoClient(MONGO_URL)
    return client[DB_NAME]

def create_test_user(name, email, password="Password123", role="MEMBER", tier="FREE", is_suspended=False):
    """Create a test user directly in MongoDB"""
    db = get_mongo_client()
    
    # Hash password
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    user_data = {
        "_id": str(uuid.uuid4()),
        "name": name,
        "email": email,
        "password": hashed_password,
        "role": role,
        "membershipTier": tier,
        "phone": "",
        "photo": "",
        "membershipExpiry": None,
        "isSuspended": is_suspended,
        "suspendedReason": "Test suspension" if is_suspended else "",
        "suspendedAt": datetime.utcnow() if is_suspended else None,
        "isGuest": False,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    
    try:
        db.users.insert_one(user_data)
        print(f"✅ Created test user: {email} (role: {role}, tier: {tier})")
        return user_data["_id"]
    except Exception as e:
        print(f"❌ Failed to create user {email}: {e}")
        return None

def create_test_company(user_id, status="PENDING"):
    """Create a test company for approvals testing"""
    db = get_mongo_client()
    
    company_data = {
        "_id": str(uuid.uuid4()),
        "nameAr": "شركة تجريبية للاختبار",
        "nameEn": "Test Company",
        "description": "شركة تجريبية لاختبار النظام",
        "sector": "TECH",
        "governorate": "MUSCAT",
        "userId": user_id,
        "status": status,
        "isApproved": status == "APPROVED",
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    
    try:
        db.companies.insert_one(company_data)
        print(f"✅ Created test company with status: {status}")
        return company_data["_id"]
    except Exception as e:
        print(f"❌ Failed to create company: {e}")
        return None

def create_test_expert(user_id, status="PENDING"):
    """Create a test expert for approvals testing"""
    db = get_mongo_client()
    
    expert_data = {
        "_id": str(uuid.uuid4()),
        "userId": user_id,
        "specialtyAr": "استشارات قانونية",
        "specialty": "LEGAL",
        "hourlyRate": 25,
        "bio": "خبير قانوني تجريبي",
        "status": status,
        "rating": 0,
        "totalSessions": 0,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    
    try:
        db.experts.insert_one(expert_data)
        print(f"✅ Created test expert with status: {status}")
        return expert_data["_id"]
    except Exception as e:
        print(f"❌ Failed to create expert: {e}")
        return None

def login_user(email, password="Password123"):
    """Login user and return session for API calls"""
    session = requests.Session()
    
    try:
        # Get CSRF token
        csrf_response = session.get(f"{API_BASE}/auth/csrf")
        csrf_token = csrf_response.json().get('csrfToken')
        
        # Login
        login_data = {
            'csrfToken': csrf_token,
            'email': email,
            'password': password,
            'callbackUrl': BASE_URL,
            'json': 'true'
        }
        
        login_response = session.post(
            f"{API_BASE}/auth/callback/credentials",
            data=login_data,
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )
        
        if login_response.status_code == 200:
            print(f"✅ Login successful for {email}")
            return session
        else:
            print(f"❌ Login failed for {email}: {login_response.status_code}")
            return None
            
    except Exception as e:
        print(f"❌ Login error for {email}: {e}")
        return None

def cleanup_test_data():
    """Clean up test data from database"""
    db = get_mongo_client()
    
    try:
        # Remove test users
        db.users.delete_many({"email": {"$regex": "admin_test_.*@example.com"}})
        db.users.delete_many({"email": {"$regex": "test_user_.*@example.com"}})
        db.users.delete_many({"email": {"$regex": "vendor_var_.*@example.com"}})
        db.users.delete_many({"email": {"$regex": "test_modify_.*@example.com"}})
        db.users.delete_many({"email": {"$regex": "test_approval_.*@example.com"}})
        
        # Remove test companies and experts
        db.companies.delete_many({"nameAr": {"$regex": "شركة تجريبية"}})
        db.experts.delete_many({"bio": {"$regex": "خبير.*تجريبي"}})
        
        print("✅ Cleaned up test data")
    except Exception as e:
        print(f"❌ Cleanup error: {e}")

def test_admin_users_endpoint():
    """Test GET /api/admin/users endpoint"""
    print("\n🧪 TESTING GET /api/admin/users")
    
    # Create test users with different roles and tiers
    timestamp = int(time.time())
    
    # Create test users
    member_id = create_test_user(f"Test Member {timestamp}", f"test_user_member_{timestamp}@example.com", role="MEMBER", tier="FREE")
    vendor_id = create_test_user(f"Test Vendor {timestamp}", f"test_user_vendor_{timestamp}@example.com", role="VENDOR", tier="BASIC")
    expert_id = create_test_user(f"Test Expert {timestamp}", f"test_user_expert_{timestamp}@example.com", role="EXPERT", tier="GOLD")
    suspended_id = create_test_user(f"Test Suspended {timestamp}", f"test_user_suspended_{timestamp}@example.com", role="MEMBER", tier="FREE", is_suspended=True)
    
    # Test with admin credentials
    admin_session = login_user("mazin298@gmail.com")
    if not admin_session:
        print("❌ Cannot test admin endpoints - admin login failed")
        return False
    
    # Test 1: Unauthenticated request
    print("\n📋 Test 1: Unauthenticated request")
    try:
        response = requests.get(f"{API_BASE}/admin/users")
        if response.status_code == 401:
            print("✅ Unauthenticated request correctly returns 401")
        else:
            print(f"❌ Expected 401, got {response.status_code}")
    except Exception as e:
        print(f"❌ Test 1 error: {e}")
    
    # Test 2: Non-admin user
    print("\n📋 Test 2: Non-admin user access")
    if member_id:
        member_session = login_user(f"test_user_member_{timestamp}@example.com")
        if member_session:
            try:
                response = member_session.get(f"{API_BASE}/admin/users")
                if response.status_code == 403:
                    print("✅ Non-admin user correctly blocked with 403")
                else:
                    print(f"❌ Expected 403, got {response.status_code}")
            except Exception as e:
                print(f"❌ Test 2 error: {e}")
    
    # Test 3: Admin access with basic query
    print("\n📋 Test 3: Admin access - basic query")
    try:
        response = admin_session.get(f"{API_BASE}/admin/users")
        if response.status_code == 200:
            data = response.json()
            if 'users' in data and 'pagination' in data and 'totals' in data:
                print("✅ Admin access successful with correct response structure")
                print(f"   Total users: {data['totals']['total']}")
                print(f"   Admins: {data['totals']['admins']}")
                print(f"   Members: {data['totals']['members']}")
                print(f"   Vendors: {data['totals']['vendors']}")
                print(f"   Experts: {data['totals']['experts']}")
                print(f"   Suspended: {data['totals']['suspended']}")
                
                # Verify guests are excluded
                guest_found = any(user.get('isGuest') for user in data['users'])
                if not guest_found:
                    print("✅ Guests correctly excluded from results")
                else:
                    print("❌ Found guest users in results")
            else:
                print(f"❌ Missing required fields in response: {data.keys()}")
        else:
            print(f"❌ Admin access failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Test 3 error: {e}")
    
    # Test 4: Role filter
    print("\n📋 Test 4: Role filter")
    try:
        response = admin_session.get(f"{API_BASE}/admin/users?role=ADMIN")
        if response.status_code == 200:
            data = response.json()
            admin_users = [u for u in data['users'] if u['role'] == 'ADMIN']
            if len(admin_users) == len(data['users']) and len(admin_users) > 0:
                print("✅ Role filter working correctly")
            else:
                print(f"❌ Role filter issue: {len(admin_users)} admins out of {len(data['users'])} users")
        else:
            print(f"❌ Role filter test failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Test 4 error: {e}")
    
    # Test 5: Tier filter
    print("\n📋 Test 5: Tier filter")
    try:
        response = admin_session.get(f"{API_BASE}/admin/users?tier=FREE")
        if response.status_code == 200:
            data = response.json()
            free_users = [u for u in data['users'] if u['membershipTier'] == 'FREE']
            if len(free_users) == len(data['users']) and len(free_users) > 0:
                print("✅ Tier filter working correctly")
            else:
                print(f"❌ Tier filter issue: {len(free_users)} FREE users out of {len(data['users'])} users")
        else:
            print(f"❌ Tier filter test failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Test 5 error: {e}")
    
    # Test 6: Suspended filter
    print("\n📋 Test 6: Suspended filter")
    try:
        response = admin_session.get(f"{API_BASE}/admin/users?suspended=1")
        if response.status_code == 200:
            data = response.json()
            suspended_users = [u for u in data['users'] if u.get('isSuspended')]
            if len(suspended_users) == len(data['users']) and len(suspended_users) > 0:
                print("✅ Suspended filter working correctly")
            else:
                print(f"❌ Suspended filter issue: {len(suspended_users)} suspended out of {len(data['users'])} users")
        else:
            print(f"❌ Suspended filter test failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Test 6 error: {e}")
    
    # Test 7: Search filter
    print("\n📋 Test 7: Search filter")
    try:
        response = admin_session.get(f"{API_BASE}/admin/users?search=Test Member")
        if response.status_code == 200:
            data = response.json()
            matching_users = [u for u in data['users'] if 'Test Member' in u['name']]
            if len(matching_users) > 0:
                print("✅ Search filter working correctly")
            else:
                print(f"❌ Search filter issue: no matching users found")
        else:
            print(f"❌ Search filter test failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Test 7 error: {e}")
    
    # Test 8: Pagination
    print("\n📋 Test 8: Pagination")
    try:
        response = admin_session.get(f"{API_BASE}/admin/users?page=1&limit=5")
        if response.status_code == 200:
            data = response.json()
            if data['pagination']['page'] == 1 and data['pagination']['limit'] == 5:
                print("✅ Pagination working correctly")
            else:
                print(f"❌ Pagination issue: {data['pagination']}")
        else:
            print(f"❌ Pagination test failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Test 8 error: {e}")
    
    return True

def test_admin_user_modification():
    """Test PATCH /api/admin/users/:id endpoint"""
    print("\n🧪 TESTING PATCH /api/admin/users/:id")
    
    timestamp = int(time.time())
    
    # Create test user for modification
    test_user_id = create_test_user(f"Test Modify User {timestamp}", f"test_modify_{timestamp}@example.com", role="MEMBER", tier="FREE")
    
    if not test_user_id:
        print("❌ Cannot test user modification - test user creation failed")
        return False
    
    # Test with admin credentials
    admin_session = login_user("mazin298@gmail.com")
    if not admin_session:
        print("❌ Cannot test admin endpoints - admin login failed")
        return False
    
    # Test 1: Unauthenticated request
    print("\n📋 Test 1: Unauthenticated request")
    try:
        response = requests.patch(f"{API_BASE}/admin/users/{test_user_id}", json={"role": "EXPERT"})
        if response.status_code == 401:
            print("✅ Unauthenticated request correctly returns 401")
        else:
            print(f"❌ Expected 401, got {response.status_code}")
    except Exception as e:
        print(f"❌ Test 1 error: {e}")
    
    # Test 2: Non-admin user
    print("\n📋 Test 2: Non-admin user access")
    member_session = login_user(f"test_modify_{timestamp}@example.com")
    if member_session:
        try:
            response = member_session.patch(f"{API_BASE}/admin/users/{test_user_id}", json={"role": "EXPERT"})
            if response.status_code == 403:
                print("✅ Non-admin user correctly blocked with 403")
            else:
                print(f"❌ Expected 403, got {response.status_code}")
        except Exception as e:
            print(f"❌ Test 2 error: {e}")
    
    # Test 3: Non-existent user
    print("\n📋 Test 3: Non-existent user")
    try:
        fake_id = str(uuid.uuid4())
        response = admin_session.patch(f"{API_BASE}/admin/users/{fake_id}", json={"role": "EXPERT"})
        if response.status_code == 404:
            print("✅ Non-existent user correctly returns 404")
        else:
            print(f"❌ Expected 404, got {response.status_code}")
    except Exception as e:
        print(f"❌ Test 3 error: {e}")
    
    # Test 4: Self-modification protection
    print("\n📋 Test 4: Self-modification protection")
    try:
        # Get admin user ID
        me_response = admin_session.get(f"{API_BASE}/me")
        if me_response.status_code == 200:
            admin_id = me_response.json()['id']
            response = admin_session.patch(f"{API_BASE}/admin/users/{admin_id}", json={"action": "suspend", "reason": "test"})
            if response.status_code == 400 and 'لا يمكنك تعديل حسابك الإداري' in response.json().get('error', ''):
                print("✅ Self-modification protection working")
            else:
                print(f"❌ Self-modification protection failed: {response.status_code}")
        else:
            print("❌ Cannot get admin ID for self-modification test")
    except Exception as e:
        print(f"❌ Test 4 error: {e}")
    
    # Test 5: Role change
    print("\n📋 Test 5: Role change")
    try:
        response = admin_session.patch(f"{API_BASE}/admin/users/{test_user_id}", json={"role": "EXPERT"})
        if response.status_code == 200:
            data = response.json()
            if data['user']['role'] == 'EXPERT':
                print("✅ Role change successful")
            else:
                print(f"❌ Role not updated: {data['user']['role']}")
        else:
            print(f"❌ Role change failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Test 5 error: {e}")
    
    # Test 6: Tier change
    print("\n📋 Test 6: Tier change")
    try:
        response = admin_session.patch(f"{API_BASE}/admin/users/{test_user_id}", json={"membershipTier": "GOLD"})
        if response.status_code == 200:
            data = response.json()
            if data['user']['membershipTier'] == 'GOLD':
                print("✅ Tier change successful")
            else:
                print(f"❌ Tier not updated: {data['user']['membershipTier']}")
        else:
            print(f"❌ Tier change failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Test 6 error: {e}")
    
    # Test 7: Suspend user
    print("\n📋 Test 7: Suspend user")
    try:
        response = admin_session.patch(f"{API_BASE}/admin/users/{test_user_id}", json={"action": "suspend", "reason": "Test suspension"})
        if response.status_code == 200:
            data = response.json()
            if data['user'].get('isSuspended'):
                print("✅ User suspension successful")
            else:
                print(f"❌ User not suspended: {data['user']}")
        else:
            print(f"❌ User suspension failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Test 7 error: {e}")
    
    # Test 8: Activate user
    print("\n📋 Test 8: Activate user")
    try:
        response = admin_session.patch(f"{API_BASE}/admin/users/{test_user_id}", json={"action": "activate"})
        if response.status_code == 200:
            data = response.json()
            if not data['user'].get('isSuspended'):
                print("✅ User activation successful")
            else:
                print(f"❌ User still suspended: {data['user']}")
        else:
            print(f"❌ User activation failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Test 8 error: {e}")
    
    # Test 9: Empty body
    print("\n📋 Test 9: Empty body")
    try:
        response = admin_session.patch(f"{API_BASE}/admin/users/{test_user_id}", json={})
        if response.status_code == 400 and 'لا توجد تغييرات' in response.json().get('error', ''):
            print("✅ Empty body correctly rejected")
        else:
            print(f"❌ Empty body handling failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Test 9 error: {e}")
    
    return True

def test_admin_approvals_summary():
    """Test GET /api/admin/approvals/summary endpoint"""
    print("\n🧪 TESTING GET /api/admin/approvals/summary")
    
    timestamp = int(time.time())
    
    # Create test data for approvals
    test_user_id = create_test_user(f"Test Approval User {timestamp}", f"test_approval_{timestamp}@example.com", role="MEMBER", tier="BASIC")
    
    if test_user_id:
        # Create pending items
        create_test_company(test_user_id, status="PENDING")
        create_test_expert(test_user_id, status="PENDING")
    
    # Test with admin credentials
    admin_session = login_user("mazin298@gmail.com")
    if not admin_session:
        print("❌ Cannot test admin endpoints - admin login failed")
        return False
    
    # Test 1: Unauthenticated request
    print("\n📋 Test 1: Unauthenticated request")
    try:
        response = requests.get(f"{API_BASE}/admin/approvals/summary")
        if response.status_code == 401:
            print("✅ Unauthenticated request correctly returns 401")
        else:
            print(f"❌ Expected 401, got {response.status_code}")
    except Exception as e:
        print(f"❌ Test 1 error: {e}")
    
    # Test 2: Non-admin user
    print("\n📋 Test 2: Non-admin user access")
    if test_user_id:
        member_session = login_user(f"test_approval_{timestamp}@example.com")
        if member_session:
            try:
                response = member_session.get(f"{API_BASE}/admin/approvals/summary")
                if response.status_code == 403:
                    print("✅ Non-admin user correctly blocked with 403")
                else:
                    print(f"❌ Expected 403, got {response.status_code}")
            except Exception as e:
                print(f"❌ Test 2 error: {e}")
    
    # Test 3: Admin access
    print("\n📋 Test 3: Admin access")
    try:
        response = admin_session.get(f"{API_BASE}/admin/approvals/summary")
        if response.status_code == 200:
            data = response.json()
            required_fields = ['companies', 'experts', 'vendors', 'payouts', 'total']
            if all(field in data for field in required_fields):
                print("✅ Admin access successful with correct response structure")
                print(f"   Pending companies: {data['companies']}")
                print(f"   Pending experts: {data['experts']}")
                print(f"   Pending vendors: {data['vendors']}")
                print(f"   Pending payouts: {data['payouts']}")
                print(f"   Total pending: {data['total']}")
                
                # Verify total calculation
                calculated_total = data['companies'] + data['experts'] + data['vendors'] + data['payouts']
                if data['total'] == calculated_total:
                    print("✅ Total calculation correct")
                else:
                    print(f"❌ Total calculation wrong: {data['total']} != {calculated_total}")
                
                # Verify all counts are non-negative integers
                all_valid = all(isinstance(data[field], int) and data[field] >= 0 for field in required_fields)
                if all_valid:
                    print("✅ All counts are valid non-negative integers")
                else:
                    print("❌ Invalid count values found")
                    
            else:
                print(f"❌ Missing required fields in response: {data.keys()}")
        else:
            print(f"❌ Admin access failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Test 3 error: {e}")
    
    return True

def test_integration_sanity():
    """Quick smoke test on existing endpoints to ensure no regression"""
    print("\n🧪 INTEGRATION SANITY TESTS")
    
    # Test existing admin analytics endpoint
    admin_session = login_user("mazin298@gmail.com")
    if not admin_session:
        print("❌ Cannot test integration - admin login failed")
        return False
    
    # Test 1: Login still works
    print("\n📋 Test 1: Login functionality")
    try:
        response = admin_session.get(f"{API_BASE}/me")
        if response.status_code == 200 and response.json().get('role') == 'ADMIN':
            print("✅ Login and session management working")
        else:
            print(f"❌ Login issue: {response.status_code}")
    except Exception as e:
        print(f"❌ Test 1 error: {e}")
    
    # Test 2: Existing admin analytics endpoint
    print("\n📋 Test 2: Existing admin analytics endpoint")
    try:
        response = admin_session.get(f"{API_BASE}/admin/analytics")
        if response.status_code == 200:
            print("✅ Admin analytics endpoint still working")
        else:
            print(f"❌ Admin analytics issue: {response.status_code}")
    except Exception as e:
        print(f"❌ Test 2 error: {e}")
    
    # Test 3: Existing admin companies endpoint
    print("\n📋 Test 3: Existing admin companies endpoint")
    try:
        response = admin_session.get(f"{API_BASE}/admin/companies?status=PENDING")
        if response.status_code == 200:
            print("✅ Admin companies endpoint still working")
        else:
            print(f"❌ Admin companies issue: {response.status_code}")
    except Exception as e:
        print(f"❌ Test 3 error: {e}")
    
    return True

def main():
    """Main test execution"""
    print("🚀 STARTING PHASE 6 ADMIN DASHBOARD BACKEND TESTING")
    print("=" * 60)
    
    # Clean up any existing test data
    cleanup_test_data()
    
    # Run tests
    tests_passed = 0
    total_tests = 4
    
    try:
        if test_admin_users_endpoint():
            tests_passed += 1
            
        if test_admin_user_modification():
            tests_passed += 1
            
        if test_admin_approvals_summary():
            tests_passed += 1
            
        if test_integration_sanity():
            tests_passed += 1
            
    except Exception as e:
        print(f"❌ Test execution error: {e}")
    
    finally:
        # Clean up test data
        cleanup_test_data()
    
    # Summary
    print("\n" + "=" * 60)
    print(f"🎯 TESTING COMPLETE: {tests_passed}/{total_tests} test suites passed")
    
    if tests_passed == total_tests:
        print("✅ ALL PHASE 6 ADMIN DASHBOARD ENDPOINTS WORKING CORRECTLY")
        return True
    else:
        print("❌ SOME TESTS FAILED - CHECK LOGS ABOVE")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)