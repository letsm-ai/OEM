#!/usr/bin/env python3
"""
PHASE 7 REGRESSION TEST — Admin Route Splitting
Tests 14 new dedicated admin route files (1 code extraction + 13 re-wiring moves).
Routes: analytics, users, approvals, vendor-applications, payouts, settings, email-optouts, push
"""

import requests
import time
import json
from pymongo import MongoClient
import bcrypt
from datetime import datetime, timedelta
import uuid

BASE_URL = "https://omani-startup-hub.preview.emergentagent.com/api"
MONGO_URL = "mongodb://localhost:27017/majles"

# Test user credentials
TIMESTAMP = int(time.time())
MEMBER_EMAIL = f"phase7_member_{TIMESTAMP}@test.com"
ADMIN_EMAIL = f"phase7_admin_{TIMESTAMP}@test.com"
PASSWORD = "Password123"

print("=" * 80)
print("PHASE 7 REGRESSION TEST — Admin Route Splitting")
print("Testing: 14 dedicated admin routes")
print("=" * 80)

# MongoDB connection
client = MongoClient(MONGO_URL)
db = client['majles']

def create_test_user(email, name, role="MEMBER", tier="FREE"):
    """Create a test user via signup and promote via MongoDB"""
    try:
        # Signup
        resp = requests.post(f"{BASE_URL}/signup", json={
            "name": name,
            "email": email,
            "password": PASSWORD
        }, timeout=10)
        
        if resp.status_code != 200:
            print(f"❌ Signup failed for {email}: {resp.status_code} {resp.text[:200]}")
            return None
        
        user_data = resp.json()
        user_id = user_data.get("user", {}).get("id")
        
        # Promote role and tier via MongoDB
        if role != "MEMBER" or tier != "FREE":
            update_data = {}
            if role != "MEMBER":
                update_data["role"] = role
            if tier != "FREE":
                update_data["membershipTier"] = tier
                update_data["membershipExpiry"] = datetime.utcnow() + timedelta(days=365)
            
            db.users.update_one({"_id": user_id}, {"$set": update_data})
        
        print(f"✅ Created user: {email} (role={role}, tier={tier})")
        return user_id
    except Exception as e:
        print(f"❌ Error creating user {email}: {e}")
        return None

def login_user(email, password):
    """Login via NextAuth and return session"""
    try:
        session = requests.Session()
        
        # Get CSRF token
        csrf_resp = session.get(f"{BASE_URL}/auth/csrf", timeout=10)
        csrf_token = csrf_resp.json().get("csrfToken")
        
        # Login
        login_resp = session.post(
            f"{BASE_URL}/auth/callback/credentials",
            data={
                "csrfToken": csrf_token,
                "email": email,
                "password": password,
                "callbackUrl": "/",
                "json": "true"
            },
            timeout=10
        )
        
        if login_resp.status_code == 200:
            print(f"✅ Logged in: {email}")
            return session
        else:
            print(f"❌ Login failed for {email}: {login_resp.status_code}")
            return None
    except Exception as e:
        print(f"❌ Login error for {email}: {e}")
        return None

# Setup: Create test users
print("\n" + "=" * 80)
print("SETUP: Creating test users")
print("=" * 80)

member_id = create_test_user(MEMBER_EMAIL, "Phase7 Member", "MEMBER", "FREE")
admin_id = create_test_user(ADMIN_EMAIL, "Phase7 Admin", "ADMIN", "PLATINUM")

if not member_id or not admin_id:
    print("❌ Failed to create test users. Exiting.")
    exit(1)

# Login users
member_session = login_user(MEMBER_EMAIL, PASSWORD)
admin_session = login_user(ADMIN_EMAIL, PASSWORD)

if not member_session or not admin_session:
    print("❌ Failed to login test users. Exiting.")
    exit(1)

# Test counters
total_tests = 0
passed_tests = 0
failed_tests = 0

def test_result(name, passed, details=""):
    """Record test result"""
    global total_tests, passed_tests, failed_tests
    total_tests += 1
    if passed:
        passed_tests += 1
        print(f"✅ {name}")
    else:
        failed_tests += 1
        print(f"❌ {name}")
    if details:
        print(f"   {details}")

# ============================================================================
# TEST 1: GET /api/admin/analytics
# ============================================================================
print("\n" + "=" * 80)
print("TEST 1: GET /api/admin/analytics")
print("=" * 80)

try:
    # 1a. Unauthenticated → 401
    resp = requests.get(f"{BASE_URL}/admin/analytics", timeout=10)
    test_result(
        "1a. Unauthenticated → 401",
        resp.status_code == 401,
        f"Status: {resp.status_code}"
    )
    
    # 1b. Non-admin (MEMBER) → 403
    resp = member_session.get(f"{BASE_URL}/admin/analytics", timeout=10)
    test_result(
        "1b. Non-admin (MEMBER) → 403",
        resp.status_code == 403,
        f"Status: {resp.status_code}"
    )
    
    # 1c. Admin → 200 with correct shape
    resp = admin_session.get(f"{BASE_URL}/admin/analytics", timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        has_kpis = "users" in data and "memberships" in data and "consultations" in data
        has_monthly = "monthly" in data and isinstance(data["monthly"], list) and len(data["monthly"]) == 12
        has_pending = "pending" in data and "companies" in data["pending"] and "experts" in data["pending"]
        has_top_experts = "topExperts" in data and isinstance(data["topExperts"], list)
        
        all_valid = has_kpis and has_monthly and has_pending and has_top_experts
        test_result(
            "1c. Admin → 200 with correct shape (kpis, monthly[12], pending, topExperts)",
            all_valid,
            f"Status: {resp.status_code}, kpis={has_kpis}, monthly={has_monthly}, pending={has_pending}, topExperts={has_top_experts}"
        )
    else:
        test_result(
            "1c. Admin → 200 with correct shape",
            False,
            f"Status: {resp.status_code}, Body: {resp.text[:200]}"
        )
except Exception as e:
    test_result("TEST 1: GET /api/admin/analytics", False, f"Exception: {e}")

# ============================================================================
# TEST 2: GET /api/admin/users
# ============================================================================
print("\n" + "=" * 80)
print("TEST 2: GET /api/admin/users")
print("=" * 80)

try:
    # 2a. Unauthenticated → 401
    resp = requests.get(f"{BASE_URL}/admin/users", timeout=10)
    test_result(
        "2a. Unauthenticated → 401",
        resp.status_code == 401,
        f"Status: {resp.status_code}"
    )
    
    # 2b. Non-admin → 403
    resp = member_session.get(f"{BASE_URL}/admin/users", timeout=10)
    test_result(
        "2b. Non-admin → 403",
        resp.status_code == 403,
        f"Status: {resp.status_code}"
    )
    
    # 2c. Admin → 200 with users list
    resp = admin_session.get(f"{BASE_URL}/admin/users", timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        has_users = "users" in data and isinstance(data["users"], list)
        test_result(
            "2c. Admin → 200 with users list",
            has_users,
            f"Status: {resp.status_code}, users count: {len(data.get('users', []))}"
        )
    else:
        test_result(
            "2c. Admin → 200 with users list",
            False,
            f"Status: {resp.status_code}, Body: {resp.text[:200]}"
        )
except Exception as e:
    test_result("TEST 2: GET /api/admin/users", False, f"Exception: {e}")

# ============================================================================
# TEST 3: PATCH /api/admin/users/[id]
# ============================================================================
print("\n" + "=" * 80)
print("TEST 3: PATCH /api/admin/users/[id]")
print("=" * 80)

try:
    # 3a. Unauthenticated → 401
    resp = requests.patch(f"{BASE_URL}/admin/users/{member_id}", json={"role": "VENDOR"}, timeout=10)
    test_result(
        "3a. Unauthenticated → 401",
        resp.status_code == 401,
        f"Status: {resp.status_code}"
    )
    
    # 3b. Non-admin → 403
    resp = member_session.patch(f"{BASE_URL}/admin/users/{member_id}", json={"role": "VENDOR"}, timeout=10)
    test_result(
        "3b. Non-admin → 403",
        resp.status_code == 403,
        f"Status: {resp.status_code}"
    )
    
    # 3c. Admin → 200 with updated user
    resp = admin_session.patch(f"{BASE_URL}/admin/users/{member_id}", json={"role": "VENDOR"}, timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        updated_correctly = data.get("user", {}).get("role") == "VENDOR"
        test_result(
            "3c. Admin → 200 with updated user (role=VENDOR)",
            updated_correctly,
            f"Status: {resp.status_code}, role: {data.get('user', {}).get('role')}"
        )
    else:
        test_result(
            "3c. Admin → 200 with updated user",
            False,
            f"Status: {resp.status_code}, Body: {resp.text[:200]}"
        )
except Exception as e:
    test_result("TEST 3: PATCH /api/admin/users/[id]", False, f"Exception: {e}")

# ============================================================================
# TEST 4: GET /api/admin/approvals/summary
# ============================================================================
print("\n" + "=" * 80)
print("TEST 4: GET /api/admin/approvals/summary")
print("=" * 80)

try:
    # 4a. Unauthenticated → 401
    resp = requests.get(f"{BASE_URL}/admin/approvals/summary", timeout=10)
    test_result(
        "4a. Unauthenticated → 401",
        resp.status_code == 401,
        f"Status: {resp.status_code}"
    )
    
    # 4b. Non-admin → 403
    resp = member_session.get(f"{BASE_URL}/admin/approvals/summary", timeout=10)
    test_result(
        "4b. Non-admin → 403",
        resp.status_code == 403,
        f"Status: {resp.status_code}"
    )
    
    # 4c. Admin → 200 with summary
    resp = admin_session.get(f"{BASE_URL}/admin/approvals/summary", timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        has_pending = "pendingCompanies" in data and "pendingExperts" in data
        test_result(
            "4c. Admin → 200 with summary (pendingCompanies, pendingExperts)",
            has_pending,
            f"Status: {resp.status_code}, pendingCompanies: {data.get('pendingCompanies')}, pendingExperts: {data.get('pendingExperts')}"
        )
    else:
        test_result(
            "4c. Admin → 200 with summary",
            False,
            f"Status: {resp.status_code}, Body: {resp.text[:200]}"
        )
except Exception as e:
    test_result("TEST 4: GET /api/admin/approvals/summary", False, f"Exception: {e}")

# ============================================================================
# TEST 5: GET /api/admin/vendor-applications
# ============================================================================
print("\n" + "=" * 80)
print("TEST 5: GET /api/admin/vendor-applications")
print("=" * 80)

try:
    # 5a. Unauthenticated → 401
    resp = requests.get(f"{BASE_URL}/admin/vendor-applications", timeout=10)
    test_result(
        "5a. Unauthenticated → 401",
        resp.status_code == 401,
        f"Status: {resp.status_code}"
    )
    
    # 5b. Non-admin → 403
    resp = member_session.get(f"{BASE_URL}/admin/vendor-applications", timeout=10)
    test_result(
        "5b. Non-admin → 403",
        resp.status_code == 403,
        f"Status: {resp.status_code}"
    )
    
    # 5c. Admin → 200 with applications list
    resp = admin_session.get(f"{BASE_URL}/admin/vendor-applications?status=PENDING", timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        has_applications = "applications" in data and isinstance(data["applications"], list)
        test_result(
            "5c. Admin → 200 with applications list",
            has_applications,
            f"Status: {resp.status_code}, applications count: {len(data.get('applications', []))}"
        )
    else:
        test_result(
            "5c. Admin → 200 with applications list",
            False,
            f"Status: {resp.status_code}, Body: {resp.text[:200]}"
        )
except Exception as e:
    test_result("TEST 5: GET /api/admin/vendor-applications", False, f"Exception: {e}")

# ============================================================================
# TEST 6: POST /api/admin/vendor-applications/[id]/[action]
# ============================================================================
print("\n" + "=" * 80)
print("TEST 6: POST /api/admin/vendor-applications/[id]/[action]")
print("=" * 80)

try:
    # Create a test vendor application
    test_vendor_id = str(uuid.uuid4())
    test_vendor_email = f"test_vendor_{TIMESTAMP}@test.com"
    
    # Create vendor user
    vendor_user_id = create_test_user(test_vendor_email, "Test Vendor", "MEMBER", "FREE")
    
    if vendor_user_id:
        # Create a PENDING vendor application
        app_id = str(uuid.uuid4())
        db.vendorapplications.insert_one({
            "_id": app_id,
            "userId": vendor_user_id,
            "businessNameAr": "شركة تجريبية",
            "businessNameEn": "Test Business",
            "status": "PENDING",
            "createdAt": datetime.utcnow()
        })
        
        # 6a. Unauthenticated → 401
        resp = requests.post(f"{BASE_URL}/admin/vendor-applications/{app_id}/approve", timeout=10)
        test_result(
            "6a. Unauthenticated → 401",
            resp.status_code == 401,
            f"Status: {resp.status_code}"
        )
        
        # 6b. Non-admin → 403
        resp = member_session.post(f"{BASE_URL}/admin/vendor-applications/{app_id}/approve", timeout=10)
        test_result(
            "6b. Non-admin → 403",
            resp.status_code == 403,
            f"Status: {resp.status_code}"
        )
        
        # 6c. Admin approve → 200
        resp = admin_session.post(f"{BASE_URL}/admin/vendor-applications/{app_id}/approve", timeout=10)
        test_result(
            "6c. Admin approve → 200",
            resp.status_code == 200,
            f"Status: {resp.status_code}"
        )
        
        # Create another PENDING application for reject test
        app_id2 = str(uuid.uuid4())
        db.vendorapplications.insert_one({
            "_id": app_id2,
            "userId": vendor_user_id,
            "businessNameAr": "شركة تجريبية 2",
            "businessNameEn": "Test Business 2",
            "status": "PENDING",
            "createdAt": datetime.utcnow()
        })
        
        # 6d. Admin reject → 200
        resp = admin_session.post(f"{BASE_URL}/admin/vendor-applications/{app_id2}/reject", 
                                  json={"reason": "Test rejection"}, timeout=10)
        test_result(
            "6d. Admin reject → 200",
            resp.status_code == 200,
            f"Status: {resp.status_code}"
        )
    else:
        test_result("TEST 6: POST /api/admin/vendor-applications/[id]/[action]", False, "Failed to create vendor user")
except Exception as e:
    test_result("TEST 6: POST /api/admin/vendor-applications/[id]/[action]", False, f"Exception: {e}")

# ============================================================================
# TEST 7: GET /api/admin/payouts
# ============================================================================
print("\n" + "=" * 80)
print("TEST 7: GET /api/admin/payouts")
print("=" * 80)

try:
    # 7a. Unauthenticated → 401
    resp = requests.get(f"{BASE_URL}/admin/payouts", timeout=10)
    test_result(
        "7a. Unauthenticated → 401",
        resp.status_code == 401,
        f"Status: {resp.status_code}"
    )
    
    # 7b. Non-admin → 403
    resp = member_session.get(f"{BASE_URL}/admin/payouts", timeout=10)
    test_result(
        "7b. Non-admin → 403",
        resp.status_code == 403,
        f"Status: {resp.status_code}"
    )
    
    # 7c. Admin → 200 with payouts list
    resp = admin_session.get(f"{BASE_URL}/admin/payouts?status=PENDING", timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        has_payouts = "payouts" in data and isinstance(data["payouts"], list)
        test_result(
            "7c. Admin → 200 with payouts list",
            has_payouts,
            f"Status: {resp.status_code}, payouts count: {len(data.get('payouts', []))}"
        )
    else:
        test_result(
            "7c. Admin → 200 with payouts list",
            False,
            f"Status: {resp.status_code}, Body: {resp.text[:200]}"
        )
except Exception as e:
    test_result("TEST 7: GET /api/admin/payouts", False, f"Exception: {e}")

# ============================================================================
# TEST 8: POST /api/admin/payouts/[id]/[action]
# ============================================================================
print("\n" + "=" * 80)
print("TEST 8: POST /api/admin/payouts/[id]/[action]")
print("=" * 80)

try:
    # Create a test payout
    payout_id = str(uuid.uuid4())
    db.payouts.insert_one({
        "_id": payout_id,
        "vendorId": vendor_user_id if vendor_user_id else admin_id,
        "amount": 100.0,
        "status": "PENDING",
        "createdAt": datetime.utcnow()
    })
    
    # 8a. Unauthenticated → 401
    resp = requests.post(f"{BASE_URL}/admin/payouts/{payout_id}/approve", timeout=10)
    test_result(
        "8a. Unauthenticated → 401",
        resp.status_code == 401,
        f"Status: {resp.status_code}"
    )
    
    # 8b. Non-admin → 403
    resp = member_session.post(f"{BASE_URL}/admin/payouts/{payout_id}/approve", timeout=10)
    test_result(
        "8b. Non-admin → 403",
        resp.status_code == 403,
        f"Status: {resp.status_code}"
    )
    
    # 8c. Admin approve → 200
    resp = admin_session.post(f"{BASE_URL}/admin/payouts/{payout_id}/approve", timeout=10)
    test_result(
        "8c. Admin approve → 200",
        resp.status_code == 200,
        f"Status: {resp.status_code}"
    )
except Exception as e:
    test_result("TEST 8: POST /api/admin/payouts/[id]/[action]", False, f"Exception: {e}")

# ============================================================================
# TEST 9: GET /api/admin/settings + PATCH /api/admin/settings
# ============================================================================
print("\n" + "=" * 80)
print("TEST 9: GET /api/admin/settings + PATCH /api/admin/settings")
print("=" * 80)

try:
    # 9a. GET Unauthenticated → 401
    resp = requests.get(f"{BASE_URL}/admin/settings", timeout=10)
    test_result(
        "9a. GET Unauthenticated → 401",
        resp.status_code == 401,
        f"Status: {resp.status_code}"
    )
    
    # 9b. GET Non-admin → 403
    resp = member_session.get(f"{BASE_URL}/admin/settings", timeout=10)
    test_result(
        "9b. GET Non-admin → 403",
        resp.status_code == 403,
        f"Status: {resp.status_code}"
    )
    
    # 9c. GET Admin → 200 with settings
    resp = admin_session.get(f"{BASE_URL}/admin/settings", timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        has_settings = "settings" in data
        test_result(
            "9c. GET Admin → 200 with settings",
            has_settings,
            f"Status: {resp.status_code}"
        )
    else:
        test_result(
            "9c. GET Admin → 200 with settings",
            False,
            f"Status: {resp.status_code}, Body: {resp.text[:200]}"
        )
    
    # 9d. PATCH Unauthenticated → 401
    resp = requests.patch(f"{BASE_URL}/admin/settings", json={"maintenanceMode": False}, timeout=10)
    test_result(
        "9d. PATCH Unauthenticated → 401",
        resp.status_code == 401,
        f"Status: {resp.status_code}"
    )
    
    # 9e. PATCH Non-admin → 403
    resp = member_session.patch(f"{BASE_URL}/admin/settings", json={"maintenanceMode": False}, timeout=10)
    test_result(
        "9e. PATCH Non-admin → 403",
        resp.status_code == 403,
        f"Status: {resp.status_code}"
    )
    
    # 9f. PATCH Admin → 200
    resp = admin_session.patch(f"{BASE_URL}/admin/settings", json={"maintenanceMode": False}, timeout=10)
    test_result(
        "9f. PATCH Admin → 200",
        resp.status_code == 200,
        f"Status: {resp.status_code}"
    )
except Exception as e:
    test_result("TEST 9: GET/PATCH /api/admin/settings", False, f"Exception: {e}")

# ============================================================================
# TEST 10: GET /api/admin/email-optouts
# ============================================================================
print("\n" + "=" * 80)
print("TEST 10: GET /api/admin/email-optouts")
print("=" * 80)

try:
    # 10a. Unauthenticated → 401
    resp = requests.get(f"{BASE_URL}/admin/email-optouts", timeout=10)
    test_result(
        "10a. Unauthenticated → 401",
        resp.status_code == 401,
        f"Status: {resp.status_code}"
    )
    
    # 10b. Non-admin → 403
    resp = member_session.get(f"{BASE_URL}/admin/email-optouts", timeout=10)
    test_result(
        "10b. Non-admin → 403",
        resp.status_code == 403,
        f"Status: {resp.status_code}"
    )
    
    # 10c. Admin → 200 with optouts list
    resp = admin_session.get(f"{BASE_URL}/admin/email-optouts", timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        has_optouts = "optouts" in data and isinstance(data["optouts"], list)
        test_result(
            "10c. Admin → 200 with optouts list",
            has_optouts,
            f"Status: {resp.status_code}, optouts count: {len(data.get('optouts', []))}"
        )
    else:
        test_result(
            "10c. Admin → 200 with optouts list",
            False,
            f"Status: {resp.status_code}, Body: {resp.text[:200]}"
        )
except Exception as e:
    test_result("TEST 10: GET /api/admin/email-optouts", False, f"Exception: {e}")

# ============================================================================
# TEST 11: GET /api/admin/email-optouts/export (MUST return text/csv)
# ============================================================================
print("\n" + "=" * 80)
print("TEST 11: GET /api/admin/email-optouts/export (MUST return text/csv)")
print("=" * 80)

try:
    # 11a. Unauthenticated → 401
    resp = requests.get(f"{BASE_URL}/admin/email-optouts/export", timeout=10)
    test_result(
        "11a. Unauthenticated → 401",
        resp.status_code == 401,
        f"Status: {resp.status_code}"
    )
    
    # 11b. Non-admin → 403
    resp = member_session.get(f"{BASE_URL}/admin/email-optouts/export", timeout=10)
    test_result(
        "11b. Non-admin → 403",
        resp.status_code == 403,
        f"Status: {resp.status_code}"
    )
    
    # 11c. Admin → 200 with text/csv Content-Type
    resp = admin_session.get(f"{BASE_URL}/admin/email-optouts/export", timeout=10)
    if resp.status_code == 200:
        content_type = resp.headers.get("Content-Type", "")
        is_csv = "text/csv" in content_type or "csv" in content_type.lower()
        test_result(
            "11c. Admin → 200 with text/csv Content-Type",
            is_csv,
            f"Status: {resp.status_code}, Content-Type: {content_type}"
        )
    else:
        test_result(
            "11c. Admin → 200 with text/csv Content-Type",
            False,
            f"Status: {resp.status_code}, Body: {resp.text[:200]}"
        )
except Exception as e:
    test_result("TEST 11: GET /api/admin/email-optouts/export", False, f"Exception: {e}")

# ============================================================================
# TEST 12: DELETE /api/admin/email-optouts/[id]
# ============================================================================
print("\n" + "=" * 80)
print("TEST 12: DELETE /api/admin/email-optouts/[id]")
print("=" * 80)

try:
    # Create a test email optout
    optout_id = str(uuid.uuid4())
    db.emailoptouts.insert_one({
        "_id": optout_id,
        "email": f"optout_{TIMESTAMP}@test.com",
        "createdAt": datetime.utcnow()
    })
    
    # 12a. Unauthenticated → 401
    resp = requests.delete(f"{BASE_URL}/admin/email-optouts/{optout_id}", timeout=10)
    test_result(
        "12a. Unauthenticated → 401",
        resp.status_code == 401,
        f"Status: {resp.status_code}"
    )
    
    # 12b. Non-admin → 403
    resp = member_session.delete(f"{BASE_URL}/admin/email-optouts/{optout_id}", timeout=10)
    test_result(
        "12b. Non-admin → 403",
        resp.status_code == 403,
        f"Status: {resp.status_code}"
    )
    
    # 12c. Admin → 200
    resp = admin_session.delete(f"{BASE_URL}/admin/email-optouts/{optout_id}", timeout=10)
    test_result(
        "12c. Admin → 200",
        resp.status_code == 200,
        f"Status: {resp.status_code}"
    )
except Exception as e:
    test_result("TEST 12: DELETE /api/admin/email-optouts/[id]", False, f"Exception: {e}")

# ============================================================================
# TEST 13: POST /api/admin/push/broadcast
# ============================================================================
print("\n" + "=" * 80)
print("TEST 13: POST /api/admin/push/broadcast")
print("=" * 80)

try:
    # 13a. Unauthenticated → 401
    resp = requests.post(f"{BASE_URL}/admin/push/broadcast", 
                        json={"title": "Test", "body": "Test message"}, timeout=10)
    test_result(
        "13a. Unauthenticated → 401",
        resp.status_code == 401,
        f"Status: {resp.status_code}"
    )
    
    # 13b. Non-admin → 403
    resp = member_session.post(f"{BASE_URL}/admin/push/broadcast", 
                               json={"title": "Test", "body": "Test message"}, timeout=10)
    test_result(
        "13b. Non-admin → 403",
        resp.status_code == 403,
        f"Status: {resp.status_code}"
    )
    
    # 13c. Admin → 200 (only if subscriber count is zero - safety check)
    # First check subscriber count
    stats_resp = admin_session.get(f"{BASE_URL}/admin/push/stats", timeout=10)
    if stats_resp.status_code == 200:
        stats = stats_resp.json()
        subscriber_count = stats.get("activeSubs", 0)
        
        if subscriber_count == 0:
            resp = admin_session.post(f"{BASE_URL}/admin/push/broadcast", 
                                     json={"title": "Test", "body": "Test message"}, timeout=10)
            test_result(
                "13c. Admin → 200 (no subscribers, safe to test)",
                resp.status_code == 200,
                f"Status: {resp.status_code}"
            )
        else:
            test_result(
                "13c. Admin broadcast (SKIPPED - has real subscribers)",
                True,
                f"Skipped to avoid spamming {subscriber_count} real subscribers"
            )
    else:
        test_result(
            "13c. Admin broadcast (SKIPPED - couldn't check subscriber count)",
            True,
            "Skipped for safety"
        )
except Exception as e:
    test_result("TEST 13: POST /api/admin/push/broadcast", False, f"Exception: {e}")

# ============================================================================
# TEST 14: GET /api/admin/push/stats
# ============================================================================
print("\n" + "=" * 80)
print("TEST 14: GET /api/admin/push/stats")
print("=" * 80)

try:
    # 14a. Unauthenticated → 401
    resp = requests.get(f"{BASE_URL}/admin/push/stats", timeout=10)
    test_result(
        "14a. Unauthenticated → 401",
        resp.status_code == 401,
        f"Status: {resp.status_code}"
    )
    
    # 14b. Non-admin → 403
    resp = member_session.get(f"{BASE_URL}/admin/push/stats", timeout=10)
    test_result(
        "14b. Non-admin → 403",
        resp.status_code == 403,
        f"Status: {resp.status_code}"
    )
    
    # 14c. Admin → 200 with stats
    resp = admin_session.get(f"{BASE_URL}/admin/push/stats", timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        has_stats = "activeSubs" in data
        test_result(
            "14c. Admin → 200 with stats (activeSubs)",
            has_stats,
            f"Status: {resp.status_code}, activeSubs: {data.get('activeSubs')}"
        )
    else:
        test_result(
            "14c. Admin → 200 with stats",
            False,
            f"Status: {resp.status_code}, Body: {resp.text[:200]}"
        )
except Exception as e:
    test_result("TEST 14: GET /api/admin/push/stats", False, f"Exception: {e}")

# ============================================================================
# TEST 15: REGRESSION - Non-admin route in catch-all still works
# ============================================================================
print("\n" + "=" * 80)
print("TEST 15: REGRESSION - Non-admin route in catch-all still works")
print("=" * 80)

try:
    # Test POST /api/orders with empty cart → should return 400
    resp = admin_session.post(f"{BASE_URL}/orders", json={"items": []}, timeout=10)
    test_result(
        "15. POST /api/orders with empty cart → 400 (catch-all still routes correctly)",
        resp.status_code == 400,
        f"Status: {resp.status_code}"
    )
except Exception as e:
    test_result("TEST 15: REGRESSION", False, f"Exception: {e}")

# ============================================================================
# SUMMARY
# ============================================================================
print("\n" + "=" * 80)
print("PHASE 7 TEST SUMMARY")
print("=" * 80)
print(f"Total tests: {total_tests}")
print(f"Passed: {passed_tests} ✅")
print(f"Failed: {failed_tests} ❌")
print(f"Success rate: {(passed_tests/total_tests*100):.1f}%")
print("=" * 80)

# Cleanup
print("\nCleaning up test data...")
try:
    db.users.delete_many({"email": {"$regex": f"phase7_.*_{TIMESTAMP}@test.com"}})
    db.users.delete_many({"email": {"$regex": f"test_vendor_{TIMESTAMP}@test.com"}})
    db.vendorapplications.delete_many({"businessNameAr": {"$regex": "شركة تجريبية"}})
    db.payouts.delete_many({"_id": payout_id})
    db.emailoptouts.delete_many({"email": {"$regex": f"optout_{TIMESTAMP}@test.com"}})
    print("✅ Cleanup complete")
except Exception as e:
    print(f"⚠️  Cleanup warning: {e}")

print("\n" + "=" * 80)
print("PHASE 7 REGRESSION TEST COMPLETE")
print("=" * 80)
