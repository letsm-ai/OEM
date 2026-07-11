#!/usr/bin/env python3
"""
ROUTE SPLIT REGRESSION TEST — Phase 2 & 3
Tests 24 API routes moved from catch-all to dedicated files.
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
MEMBER_EMAIL = f"route_test_member_{TIMESTAMP}@test.com"
ADMIN_EMAIL = f"route_test_admin_{TIMESTAMP}@test.com"
GOLD_EMAIL = f"route_test_gold_{TIMESTAMP}@test.com"
PASSWORD = "Password123"

print("=" * 80)
print("ROUTE SPLIT REGRESSION TEST — 24 Routes")
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

member_id = create_test_user(MEMBER_EMAIL, "Test Member", "MEMBER", "FREE")
admin_id = create_test_user(ADMIN_EMAIL, "Test Admin", "ADMIN", "PLATINUM")
gold_id = create_test_user(GOLD_EMAIL, "Test Gold User", "MEMBER", "GOLD")

if not all([member_id, admin_id, gold_id]):
    print("❌ Failed to create test users. Exiting.")
    exit(1)

# Login sessions
member_session = login_user(MEMBER_EMAIL, PASSWORD)
admin_session = login_user(ADMIN_EMAIL, PASSWORD)
gold_session = login_user(GOLD_EMAIL, PASSWORD)

if not all([member_session, admin_session, gold_session]):
    print("❌ Failed to login test users. Exiting.")
    exit(1)

# Test counters
total_tests = 0
passed_tests = 0
failed_tests = 0

def test_endpoint(name, method, path, session=None, expected_status=None, body=None, description=""):
    """Test an endpoint and track results"""
    global total_tests, passed_tests, failed_tests
    total_tests += 1
    
    try:
        url = f"{BASE_URL}{path}"
        
        if method == "GET":
            resp = session.get(url, timeout=10) if session else requests.get(url, timeout=10)
        elif method == "POST":
            resp = session.post(url, json=body, timeout=10) if session else requests.post(url, json=body, timeout=10)
        elif method == "PUT":
            resp = session.put(url, json=body, timeout=10) if session else requests.put(url, json=body, timeout=10)
        elif method == "DELETE":
            resp = session.delete(url, timeout=10) if session else requests.delete(url, timeout=10)
        else:
            print(f"❌ {name}: Unknown method {method}")
            failed_tests += 1
            return None
        
        if expected_status and resp.status_code != expected_status:
            print(f"❌ {name}: Expected {expected_status}, got {resp.status_code} - {description}")
            print(f"   Response: {resp.text[:200]}")
            failed_tests += 1
            return None
        
        print(f"✅ {name}: {resp.status_code} - {description}")
        passed_tests += 1
        return resp
    except Exception as e:
        print(f"❌ {name}: Exception - {e}")
        failed_tests += 1
        return None

# ============================================================================
# MEMBERSHIP ROUTES (6)
# ============================================================================
print("\n" + "=" * 80)
print("MEMBERSHIP ROUTES (6)")
print("=" * 80)

# 1. POST /api/membership/subscribe
test_endpoint(
    "M1-Auth", "POST", "/membership/subscribe",
    session=None, expected_status=401,
    body={"tier": "BASIC"},
    description="Unauthenticated → 401"
)

test_endpoint(
    "M1-Valid", "POST", "/membership/subscribe",
    session=member_session, expected_status=200,
    body={"tier": "BASIC"},
    description="Valid subscription"
)

# 2. POST /api/membership/verify
test_endpoint(
    "M2-Auth", "POST", "/membership/verify",
    session=None, expected_status=401,
    body={"membershipId": "test"},
    description="Unauthenticated → 401"
)

# 3. GET /api/membership/history
test_endpoint(
    "M3-Auth", "GET", "/membership/history",
    session=None, expected_status=401,
    description="Unauthenticated → 401"
)

test_endpoint(
    "M3-Valid", "GET", "/membership/history",
    session=member_session, expected_status=200,
    description="Valid history retrieval"
)

# 4. POST /api/membership/discount
test_endpoint(
    "M4-Auth", "POST", "/membership/discount",
    session=None, expected_status=200,
    body={"price": 100},
    description="No auth → FREE tier discount (0%)"
)

test_endpoint(
    "M4-Valid", "POST", "/membership/discount",
    session=admin_session, expected_status=200,
    body={"price": 100},
    description="PLATINUM tier discount (30%)"
)

# 5. POST /api/membership/start-trial
test_endpoint(
    "M5-Auth", "POST", "/membership/start-trial",
    session=None, expected_status=401,
    description="Unauthenticated → 401"
)

# 6. GET /api/membership/trial-status (public endpoint)
test_endpoint(
    "M6-NoAuth", "GET", "/membership/trial-status",
    session=None, expected_status=200,
    description="Public access → 200 (loggedIn: false)"
)

test_endpoint(
    "M6-Valid", "GET", "/membership/trial-status",
    session=member_session, expected_status=200,
    description="Authenticated → 200 (loggedIn: true)"
)

# ============================================================================
# COMPANIES ROUTES (6)
# ============================================================================
print("\n" + "=" * 80)
print("COMPANIES ROUTES (6)")
print("=" * 80)

# Create test company for admin
test_company_id = str(uuid.uuid4())
db.companies.insert_one({
    "_id": test_company_id,
    "userId": admin_id,
    "nameAr": "شركة اختبار",
    "nameEn": "Test Company",
    "description": "وصف الشركة",
    "sector": "TECH",
    "governorate": "MUSCAT",
    "status": "PENDING",
    "isApproved": False,
    "createdAt": datetime.utcnow()
})
print(f"✅ Created test company: {test_company_id}")

# 1. GET /api/companies (public)
test_endpoint(
    "C1-Public", "GET", "/companies",
    session=None, expected_status=200,
    description="Public list (no auth required)"
)

# 2. POST /api/companies (auth + BASIC+)
test_endpoint(
    "C2-Auth", "POST", "/companies",
    session=None, expected_status=401,
    body={"nameAr": "شركة", "sector": "TECH"},
    description="Unauthenticated → 401"
)

test_endpoint(
    "C2-Tier", "POST", "/companies",
    session=member_session, expected_status=403,
    body={"nameAr": "شركة اختبار", "sector": "TECH"},
    description="FREE tier → 403"
)

# 3. GET /api/companies/:id (public if APPROVED)
test_endpoint(
    "C3-Pending", "GET", f"/companies/{test_company_id}",
    session=None, expected_status=404,
    description="PENDING company without auth → 404"
)

test_endpoint(
    "C3-Owner", "GET", f"/companies/{test_company_id}",
    session=admin_session, expected_status=200,
    description="Owner can access PENDING company"
)

# 4. PUT /api/companies/:id (owner or admin)
test_endpoint(
    "C4-Auth", "PUT", f"/companies/{test_company_id}",
    session=None, expected_status=401,
    body={"description": "تحديث"},
    description="Unauthenticated → 401"
)

test_endpoint(
    "C4-Valid", "PUT", f"/companies/{test_company_id}",
    session=admin_session, expected_status=200,
    body={"description": "تحديث الوصف"},
    description="Owner update"
)

# 5. GET /api/my-companies (auth)
test_endpoint(
    "C5-Auth", "GET", "/my-companies",
    session=None, expected_status=401,
    description="Unauthenticated → 401"
)

test_endpoint(
    "C5-Valid", "GET", "/my-companies",
    session=admin_session, expected_status=200,
    description="Valid my-companies list"
)

# 6. GET /api/admin/companies (ADMIN only)
test_endpoint(
    "C6-Auth", "GET", "/admin/companies",
    session=None, expected_status=401,
    description="Unauthenticated → 401"
)

test_endpoint(
    "C6-Role", "GET", "/admin/companies",
    session=member_session, expected_status=403,
    description="MEMBER → 403"
)

test_endpoint(
    "C6-Valid", "GET", "/admin/companies",
    session=admin_session, expected_status=200,
    description="ADMIN access"
)

# 7. POST /api/admin/companies/:id/approve (ADMIN only)
test_endpoint(
    "C7-Auth", "POST", f"/admin/companies/{test_company_id}/approve",
    session=None, expected_status=401,
    description="Unauthenticated → 401"
)

test_endpoint(
    "C7-Role", "POST", f"/admin/companies/{test_company_id}/approve",
    session=member_session, expected_status=403,
    description="MEMBER → 403"
)

test_endpoint(
    "C7-Valid", "POST", f"/admin/companies/{test_company_id}/approve",
    session=admin_session, expected_status=200,
    description="ADMIN approve"
)

# 8. POST /api/admin/companies/:id/reject (ADMIN only)
# Create another test company for rejection
test_company_id_2 = str(uuid.uuid4())
db.companies.insert_one({
    "_id": test_company_id_2,
    "userId": admin_id,
    "nameAr": "شركة اختبار 2",
    "nameEn": "Test Company 2",
    "description": "وصف",
    "sector": "TECH",
    "governorate": "MUSCAT",
    "status": "PENDING",
    "isApproved": False,
    "createdAt": datetime.utcnow()
})

test_endpoint(
    "C8-Auth", "POST", f"/admin/companies/{test_company_id_2}/reject",
    session=None, expected_status=401,
    body={"reason": "سبب الرفض"},
    description="Unauthenticated → 401"
)

test_endpoint(
    "C8-Role", "POST", f"/admin/companies/{test_company_id_2}/reject",
    session=member_session, expected_status=403,
    body={"reason": "سبب الرفض"},
    description="MEMBER → 403"
)

test_endpoint(
    "C8-Valid", "POST", f"/admin/companies/{test_company_id_2}/reject",
    session=admin_session, expected_status=200,
    body={"reason": "سبب الرفض"},
    description="ADMIN reject"
)

# 9. DELETE /api/companies/:id (owner or admin)
test_endpoint(
    "C9-Auth", "DELETE", f"/companies/{test_company_id_2}",
    session=None, expected_status=401,
    description="Unauthenticated → 401"
)

test_endpoint(
    "C9-Valid", "DELETE", f"/companies/{test_company_id_2}",
    session=admin_session, expected_status=200,
    description="Owner delete"
)

# ============================================================================
# EXPERTS ROUTES (12)
# ============================================================================
print("\n" + "=" * 80)
print("EXPERTS ROUTES (12)")
print("=" * 80)

# Create test expert for admin
test_expert_id = str(uuid.uuid4())
db.experts.insert_one({
    "_id": test_expert_id,
    "userId": admin_id,
    "specialty": "LEGAL",
    "specialtyAr": "استشارات قانونية",
    "hourlyRate": 25,
    "bio": "خبير قانوني",
    "status": "PENDING",
    "isApproved": False,
    "rating": 0,
    "totalSessions": 0,
    "createdAt": datetime.utcnow()
})
print(f"✅ Created test expert: {test_expert_id}")

# 1. GET /api/experts (public)
test_endpoint(
    "E1-Public", "GET", "/experts",
    session=None, expected_status=200,
    description="Public list (no auth required)"
)

# 2. POST /api/experts/apply (auth + GOLD+)
test_endpoint(
    "E2-Auth", "POST", "/experts/apply",
    session=None, expected_status=401,
    body={"specialty": "LEGAL", "hourlyRate": 25},
    description="Unauthenticated → 401"
)

test_endpoint(
    "E2-Tier", "POST", "/experts/apply",
    session=member_session, expected_status=403,
    body={"specialty": "LEGAL", "hourlyRate": 25},
    description="FREE/BASIC tier → 403"
)

# 3. GET /api/experts/me (auth)
test_endpoint(
    "E3-Auth", "GET", "/experts/me",
    session=None, expected_status=401,
    description="Unauthenticated → 401"
)

test_endpoint(
    "E3-Valid", "GET", "/experts/me",
    session=admin_session, expected_status=200,
    description="Valid expert profile"
)

# 4. PUT /api/experts/me (auth + expert)
test_endpoint(
    "E4-Auth", "PUT", "/experts/me",
    session=None, expected_status=401,
    body={"bio": "تحديث"},
    description="Unauthenticated → 401"
)

# 5. GET /api/experts/me/earnings (auth + expert)
test_endpoint(
    "E5-Auth", "GET", "/experts/me/earnings",
    session=None, expected_status=401,
    description="Unauthenticated → 401"
)

# 6. PUT /api/experts/me/availability (auth + expert)
test_endpoint(
    "E6-Auth", "PUT", "/experts/me/availability",
    session=None, expected_status=401,
    body={"availability": []},
    description="Unauthenticated → 401"
)

# 7. GET /api/experts/:id (public if APPROVED)
test_endpoint(
    "E7-Pending", "GET", f"/experts/{test_expert_id}",
    session=None, expected_status=404,
    description="PENDING expert without auth → 404"
)

test_endpoint(
    "E7-Owner", "GET", f"/experts/{test_expert_id}",
    session=admin_session, expected_status=200,
    description="Owner can access PENDING expert"
)

# 8. GET /api/experts/:id/reviews (public)
test_endpoint(
    "E8-Public", "GET", f"/experts/{test_expert_id}/reviews",
    session=None, expected_status=200,
    description="Public reviews (no auth required)"
)

# 9. GET /api/experts/:id/availability (public)
test_endpoint(
    "E9-Public", "GET", f"/experts/{test_expert_id}/availability",
    session=None, expected_status=200,
    description="Public availability (no auth required)"
)

# 10. GET /api/experts/:id/slots (public)
test_endpoint(
    "E10-Public", "GET", f"/experts/{test_expert_id}/slots?date=2026-05-01",
    session=None, expected_status=200,
    description="Public slots (no auth required)"
)

# 11. GET /api/admin/experts (ADMIN only)
test_endpoint(
    "E11-Auth", "GET", "/admin/experts",
    session=None, expected_status=401,
    description="Unauthenticated → 401"
)

test_endpoint(
    "E11-Role", "GET", "/admin/experts",
    session=member_session, expected_status=403,
    description="MEMBER → 403"
)

test_endpoint(
    "E11-Valid", "GET", "/admin/experts",
    session=admin_session, expected_status=200,
    description="ADMIN access"
)

# 12. POST /api/admin/experts/:id/approve (ADMIN only)
test_endpoint(
    "E12-Auth", "POST", f"/admin/experts/{test_expert_id}/approve",
    session=None, expected_status=401,
    description="Unauthenticated → 401"
)

test_endpoint(
    "E12-Role", "POST", f"/admin/experts/{test_expert_id}/approve",
    session=member_session, expected_status=403,
    description="MEMBER → 403"
)

test_endpoint(
    "E12-Valid", "POST", f"/admin/experts/{test_expert_id}/approve",
    session=admin_session, expected_status=200,
    description="ADMIN approve"
)

# 13. POST /api/admin/experts/:id/reject (ADMIN only)
# Create another test expert for rejection
test_expert_id_2 = str(uuid.uuid4())
db.experts.insert_one({
    "_id": test_expert_id_2,
    "userId": gold_id,
    "specialty": "LEGAL",
    "specialtyAr": "استشارات قانونية",
    "hourlyRate": 25,
    "bio": "خبير",
    "status": "PENDING",
    "isApproved": False,
    "rating": 0,
    "totalSessions": 0,
    "createdAt": datetime.utcnow()
})

test_endpoint(
    "E13-Auth", "POST", f"/admin/experts/{test_expert_id_2}/reject",
    session=None, expected_status=401,
    body={"reason": "سبب الرفض"},
    description="Unauthenticated → 401"
)

test_endpoint(
    "E13-Role", "POST", f"/admin/experts/{test_expert_id_2}/reject",
    session=member_session, expected_status=403,
    body={"reason": "سبب الرفض"},
    description="MEMBER → 403"
)

test_endpoint(
    "E13-Valid", "POST", f"/admin/experts/{test_expert_id_2}/reject",
    session=admin_session, expected_status=200,
    body={"reason": "سبب الرفض"},
    description="ADMIN reject"
)

# ============================================================================
# REGRESSION CHECK: Test endpoint NOT moved
# ============================================================================
print("\n" + "=" * 80)
print("REGRESSION CHECK: Catch-all still works")
print("=" * 80)

test_endpoint(
    "R1-CatchAll", "GET", "/",
    session=None, expected_status=200,
    description="GET /api/ still works (catch-all)"
)

test_endpoint(
    "R2-Me", "GET", "/me",
    session=admin_session, expected_status=200,
    description="GET /api/me still works (catch-all)"
)

# ============================================================================
# SUMMARY
# ============================================================================
print("\n" + "=" * 80)
print("TEST SUMMARY")
print("=" * 80)
print(f"Total tests: {total_tests}")
print(f"✅ Passed: {passed_tests}")
print(f"❌ Failed: {failed_tests}")
print(f"Success rate: {(passed_tests/total_tests*100):.1f}%")
print("=" * 80)

if failed_tests == 0:
    print("🎉 ALL TESTS PASSED!")
else:
    print(f"⚠️  {failed_tests} test(s) failed. Review output above.")

# Cleanup
print("\n" + "=" * 80)
print("CLEANUP: Removing test data")
print("=" * 80)
db.users.delete_many({"email": {"$in": [MEMBER_EMAIL, ADMIN_EMAIL, GOLD_EMAIL]}})
db.companies.delete_many({"_id": {"$in": [test_company_id, test_company_id_2]}})
db.experts.delete_many({"_id": {"$in": [test_expert_id, test_expert_id_2]}})
print("✅ Cleanup complete")
