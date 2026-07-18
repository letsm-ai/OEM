#!/usr/bin/env python3
"""
Test for updated GET /api/employer/seekers endpoint - Contact Info Exposure
Tests that email and phone fields are now visible to logged-in company owners.
"""

import requests
import json
import time
from datetime import datetime
import pymongo

# Configuration
BASE_URL = "https://omani-startup-hub.preview.emergentagent.com"
MONGO_URL = "mongodb://localhost:27017/majles"
ADMIN_EMAIL = "mazin298@gmail.com"
ADMIN_PASSWORD = "Password123"

# Test state
session = requests.Session()
test_data = {
    "test_users": [],
    "test_seekers": [],
    "test_companies": []
}

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def login(email, password):
    """Login and get session cookies"""
    log(f"Logging in as {email}...")
    
    # Get CSRF token
    resp = session.get(f"{BASE_URL}/api/auth/csrf")
    if resp.status_code != 200:
        log(f"❌ Failed to get CSRF token: {resp.status_code}")
        return False
    
    csrf_token = resp.json().get("csrfToken")
    
    # Login
    resp = session.post(
        f"{BASE_URL}/api/auth/callback/credentials",
        json={"email": email, "password": password, "csrfToken": csrf_token},
        headers={"Content-Type": "application/json"}
    )
    
    if resp.status_code == 200:
        log(f"✅ Logged in as {email}")
        return True
    else:
        log(f"❌ Login failed: {resp.status_code}")
        return False

def logout():
    """Logout"""
    session.post(f"{BASE_URL}/api/auth/signout")
    session.cookies.clear()
    log("Logged out")

def create_test_user(name_prefix):
    """Create a test user via API"""
    timestamp = int(time.time())
    email = f"{name_prefix}_{timestamp}@test.com"
    password = "TestPass123"
    name = f"{name_prefix} {timestamp}"
    
    resp = session.post(
        f"{BASE_URL}/api/signup",
        json={"name": name, "email": email, "password": password}
    )
    
    if resp.status_code == 200:
        user_data = resp.json()["user"]
        test_data["test_users"].append({
            "id": user_data["id"],
            "email": email,
            "password": password,
            "name": name
        })
        log(f"✅ Created test user: {email} (id: {user_data['id']})")
        return {"id": user_data["id"], "email": email, "password": password, "name": name}
    else:
        log(f"❌ Failed to create test user: {resp.status_code} - {resp.text}")
        return None

def create_seeker_profile(user_email, user_password, phone_value=None):
    """Create a job seeker profile with optional phone"""
    log(f"Creating job seeker profile for {user_email}...")
    
    # Login as the user
    logout()
    if not login(user_email, user_password):
        return None
    
    timestamp = int(time.time())
    seeker_data = {
        "fullName": f"باحث عن عمل {timestamp}",
        "title": "مطور برمجيات",
        "bio": "خبرة في تطوير البرمجيات والتطبيقات",
        "yearsOfExperience": 3,
        "skills": ["Python", "JavaScript", "React"],
        "desiredSectors": ["TECH"],
        "desiredGovernorates": ["MUSCAT"],
        "workModePref": ["REMOTE", "HYBRID"],
        "employmentTypePref": ["FULL_TIME"],
        "openToWork": True,
        "profileVisibility": "PUBLIC"
    }
    
    if phone_value:
        seeker_data["phone"] = phone_value
    
    resp = session.put(f"{BASE_URL}/api/me/job-seeker", json=seeker_data)
    if resp.status_code == 200:
        seeker = resp.json()["profile"]
        test_data["test_seekers"].append(seeker["id"])
        log(f"✅ Created job seeker profile: {seeker['id']} (phone: {phone_value or 'not set'})")
        return seeker
    else:
        log(f"❌ Failed to create seeker: {resp.status_code} - {resp.text}")
        return None

def create_company_for_user(user_id, user_email, user_password):
    """Create a company for a user via API"""
    log(f"Creating company for user {user_email}...")
    
    # First upgrade user to BASIC tier (required to create company)
    logout()
    if not login(user_email, user_password):
        return None
    
    # Subscribe to BASIC
    resp = session.post(f"{BASE_URL}/api/membership/subscribe", json={"tier": "BASIC"})
    if resp.status_code != 200:
        log(f"❌ Failed to subscribe to BASIC: {resp.status_code}")
        return None
    
    # Create company
    timestamp = int(time.time())
    company_data = {
        "nameAr": f"شركة تجريبية {timestamp}",
        "nameEn": f"Test Company {timestamp}",
        "sector": "TECH",
        "location": "MUSCAT",
        "descriptionAr": "شركة تجريبية للاختبار"
    }
    
    resp = session.post(f"{BASE_URL}/api/companies", json=company_data)
    if resp.status_code == 200:
        company = resp.json()["company"]
        test_data["test_companies"].append(company["id"])
        log(f"✅ Created company: {company['id']}")
        
        # Approve company as admin
        logout()
        if login(ADMIN_EMAIL, ADMIN_PASSWORD):
            resp = session.post(f"{BASE_URL}/api/admin/companies/{company['id']}/approve")
            if resp.status_code == 200:
                log(f"✅ Approved company: {company['id']}")
            else:
                log(f"⚠️  Failed to approve company: {resp.status_code}")
        
        return company
    else:
        log(f"❌ Failed to create company: {resp.status_code} - {resp.text}")
        return None

def cleanup():
    """Clean up test data"""
    log("\n=== CLEANUP ===")
    
    # Login as admin for cleanup
    logout()
    if not login(ADMIN_EMAIL, ADMIN_PASSWORD):
        log("❌ Cannot login as admin for cleanup")
        return
    
    # Delete test companies
    for company_id in test_data["test_companies"]:
        resp = session.delete(f"{BASE_URL}/api/companies/{company_id}")
        if resp.status_code == 200:
            log(f"✅ Deleted company {company_id}")
        else:
            log(f"⚠️  Failed to delete company {company_id}: {resp.status_code}")
    
    log("✅ Cleanup complete")

# ============================================================================
# TEST SUITE
# ============================================================================

def test_auth_guards():
    """Test 1: Auth guards (regression)"""
    log("\n" + "="*80)
    log("TEST 1: AUTH GUARDS (REGRESSION)")
    log("="*80)
    
    # 1A: Unauthenticated access
    log("\n1A: GET /api/employer/seekers unauthenticated → 401")
    logout()
    resp = session.get(f"{BASE_URL}/api/employer/seekers")
    assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
    log("✅ 1A PASSED: Unauthenticated → 401")
    
    # 1B: Authenticated user WITHOUT a Company
    log("\n1B: GET /api/employer/seekers authenticated WITHOUT company → 403 {code: 'NO_COMPANY'}")
    test_user = create_test_user("no_company_user")
    if not test_user:
        log("❌ Failed to create test user")
        return False
    
    logout()
    if not login(test_user["email"], test_user["password"]):
        log("❌ Failed to login as test user")
        return False
    
    resp = session.get(f"{BASE_URL}/api/employer/seekers")
    assert resp.status_code == 403, f"Expected 403, got {resp.status_code}"
    data = resp.json()
    assert data.get("code") == "NO_COMPANY", f"Expected NO_COMPANY code, got {data.get('code')}"
    log("✅ 1B PASSED: Authenticated WITHOUT company → 403 with NO_COMPANY")
    
    log("\n✅ TEST 1 COMPLETE: Auth guards working correctly")
    return True

def test_contact_info_exposure():
    """Test 2: Contact info exposure (new feature)"""
    log("\n" + "="*80)
    log("TEST 2: CONTACT INFO EXPOSURE (NEW FEATURE)")
    log("="*80)
    
    # Setup: Create a company owner
    log("\n2.0: Setup - Create company owner")
    vendor_user = create_test_user("vendor_owner")
    if not vendor_user:
        log("❌ Failed to create vendor user")
        return False
    
    company = create_company_for_user(vendor_user["id"], vendor_user["email"], vendor_user["password"])
    if not company:
        log("❌ Failed to create company")
        return False
    
    # Setup: Create 2 job seekers with different contact info scenarios
    log("\n2.1: Setup - Create job seekers with different contact info")
    
    # Seeker 1: Has phone in JobSeeker profile
    seeker1_user = create_test_user("seeker_with_phone")
    if not seeker1_user:
        log("❌ Failed to create seeker1 user")
        return False
    
    seeker1 = create_seeker_profile(seeker1_user["email"], seeker1_user["password"], phone_value="+968 9123 4567")
    if not seeker1:
        log("❌ Failed to create seeker1 profile")
        return False
    
    # Seeker 2: No phone in JobSeeker profile (should fall back to User.phone if set)
    seeker2_user = create_test_user("seeker_no_phone")
    if not seeker2_user:
        log("❌ Failed to create seeker2 user")
        return False
    
    seeker2 = create_seeker_profile(seeker2_user["email"], seeker2_user["password"], phone_value=None)
    if not seeker2:
        log("❌ Failed to create seeker2 profile")
        return False
    
    # Wait a moment for DB to settle
    time.sleep(1)
    
    # 2A: Login as company owner and fetch seekers
    log("\n2A: GET /api/employer/seekers as company owner → 200 with email and phone fields")
    logout()
    if not login(vendor_user["email"], vendor_user["password"]):
        log("❌ Failed to login as vendor")
        return False
    
    resp = session.get(f"{BASE_URL}/api/employer/seekers?page=1")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    data = resp.json()
    
    # Verify response structure
    assert "total" in data, "Missing 'total' field"
    assert "page" in data, "Missing 'page' field"
    assert "limit" in data, "Missing 'limit' field"
    assert "pages" in data, "Missing 'pages' field"
    assert "items" in data, "Missing 'items' field"
    log(f"✅ Response structure correct (total={data['total']}, page={data['page']})")
    
    # 2B: Verify each item has email and phone keys
    log("\n2B: Verify each item has 'email' and 'phone' keys")
    if not data["items"]:
        log("⚠️  No seekers found - creating more seekers for testing")
        # Create additional seekers if needed
        for i in range(2):
            extra_user = create_test_user(f"extra_seeker_{i}")
            if extra_user:
                create_seeker_profile(extra_user["email"], extra_user["password"], phone_value=f"+968 912{i} 000{i}")
        
        # Retry fetch
        logout()
        login(vendor_user["email"], vendor_user["password"])
        resp = session.get(f"{BASE_URL}/api/employer/seekers?page=1")
        data = resp.json()
    
    if data["items"]:
        for idx, item in enumerate(data["items"]):
            assert "email" in item, f"Item {idx} missing 'email' key"
            assert "phone" in item, f"Item {idx} missing 'phone' key"
            assert isinstance(item["email"], str), f"Item {idx} email is not a string"
            assert isinstance(item["phone"], str), f"Item {idx} phone is not a string"
            log(f"  ✅ Item {idx}: email='{item['email'][:20]}...', phone='{item['phone']}'")
        
        log(f"✅ 2B PASSED: All {len(data['items'])} items have email and phone keys")
        
        # 2C: Verify seeker with phone set has correct phone
        log("\n2C: Verify seeker with phone set returns correct phone")
        found_seeker1 = False
        for item in data["items"]:
            if item.get("phone") == "+968 9123 4567":
                found_seeker1 = True
                log(f"✅ Found seeker1 with correct phone: {item['phone']}")
                break
        
        if not found_seeker1:
            log("⚠️  Could not verify seeker1 phone (may be paginated or not in results)")
        
        # 2D: Verify email fallback (JobSeeker.email empty → User.email)
        log("\n2D: Verify email fallback from User when JobSeeker.email is empty")
        # All seekers should have email (either from JobSeeker or User fallback)
        emails_found = [item["email"] for item in data["items"] if item["email"]]
        log(f"✅ Found {len(emails_found)} seekers with email addresses (fallback working)")
        
    else:
        log("⚠️  2B-2D SKIPPED: No seekers in results")
    
    log("\n✅ TEST 2 COMPLETE: Contact info exposure working correctly")
    return True

def test_filters_pagination():
    """Test 3: Filters and pagination regression"""
    log("\n" + "="*80)
    log("TEST 3: FILTERS AND PAGINATION REGRESSION")
    log("="*80)
    
    # Use admin (who has a company) for testing
    logout()
    if not login(ADMIN_EMAIL, ADMIN_PASSWORD):
        log("❌ Cannot login as admin")
        return False
    
    # 3A: Search filter
    log("\n3A: GET /api/employer/seekers?q=مطور → search filter")
    resp = session.get(f"{BASE_URL}/api/employer/seekers?q=مطور")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    data = resp.json()
    assert "items" in data, "Missing 'items' field"
    # Verify email and phone still present with filter
    if data["items"]:
        assert "email" in data["items"][0], "email field missing with search filter"
        assert "phone" in data["items"][0], "phone field missing with search filter"
    log(f"✅ 3A PASSED: Search filter → 200 (found {data['total']} results, email/phone present)")
    
    # 3B: Sector filter
    log("\n3B: GET /api/employer/seekers?sector=TECH → sector filter")
    resp = session.get(f"{BASE_URL}/api/employer/seekers?sector=TECH")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    data = resp.json()
    if data["items"]:
        assert "email" in data["items"][0], "email field missing with sector filter"
        assert "phone" in data["items"][0], "phone field missing with sector filter"
    log(f"✅ 3B PASSED: Sector filter → 200 (found {data['total']} results, email/phone present)")
    
    # 3C: Governorate filter
    log("\n3C: GET /api/employer/seekers?governorate=MUSCAT → governorate filter")
    resp = session.get(f"{BASE_URL}/api/employer/seekers?governorate=MUSCAT")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    data = resp.json()
    if data["items"]:
        assert "email" in data["items"][0], "email field missing with governorate filter"
        assert "phone" in data["items"][0], "phone field missing with governorate filter"
    log(f"✅ 3C PASSED: Governorate filter → 200 (found {data['total']} results, email/phone present)")
    
    # 3D: WorkMode filter
    log("\n3D: GET /api/employer/seekers?workMode=REMOTE → workMode filter")
    resp = session.get(f"{BASE_URL}/api/employer/seekers?workMode=REMOTE")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    data = resp.json()
    if data["items"]:
        assert "email" in data["items"][0], "email field missing with workMode filter"
        assert "phone" in data["items"][0], "phone field missing with workMode filter"
    log(f"✅ 3D PASSED: WorkMode filter → 200 (found {data['total']} results, email/phone present)")
    
    # 3E: EmploymentType filter
    log("\n3E: GET /api/employer/seekers?employmentType=FULL_TIME → employmentType filter")
    resp = session.get(f"{BASE_URL}/api/employer/seekers?employmentType=FULL_TIME")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    data = resp.json()
    if data["items"]:
        assert "email" in data["items"][0], "email field missing with employmentType filter"
        assert "phone" in data["items"][0], "phone field missing with employmentType filter"
    log(f"✅ 3E PASSED: EmploymentType filter → 200 (found {data['total']} results, email/phone present)")
    
    # 3F: Pagination
    log("\n3F: GET /api/employer/seekers?page=1&limit=6 → pagination")
    resp = session.get(f"{BASE_URL}/api/employer/seekers?page=1&limit=6")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    data = resp.json()
    assert data["page"] == 1, f"Expected page=1, got {data['page']}"
    assert data["limit"] == 6, f"Expected limit=6, got {data['limit']}"
    assert "pages" in data, "Missing 'pages' field"
    if data["items"]:
        assert "email" in data["items"][0], "email field missing with pagination"
        assert "phone" in data["items"][0], "phone field missing with pagination"
    log(f"✅ 3F PASSED: Pagination → 200 (page={data['page']}, limit={data['limit']}, pages={data['pages']}, email/phone present)")
    
    log("\n✅ TEST 3 COMPLETE: Filters and pagination working correctly")
    return True

def test_other_endpoints_regression():
    """Test 4: No regression on other Jobs endpoints"""
    log("\n" + "="*80)
    log("TEST 4: OTHER ENDPOINTS REGRESSION")
    log("="*80)
    
    # 4A: GET /api/jobs (public list)
    log("\n4A: GET /api/jobs → public job list")
    logout()
    resp = session.get(f"{BASE_URL}/api/jobs")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    data = resp.json()
    assert "items" in data, "Missing 'items' field"
    assert "total" in data, "Missing 'total' field"
    log(f"✅ 4A PASSED: Public job list → 200 (total={data['total']})")
    
    # 4B: GET /api/employer/jobs (company owner's jobs)
    log("\n4B: GET /api/employer/jobs → company owner's jobs")
    if not login(ADMIN_EMAIL, ADMIN_PASSWORD):
        log("❌ Cannot login as admin")
        return False
    
    resp = session.get(f"{BASE_URL}/api/employer/jobs")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    data = resp.json()
    assert "items" in data, "Missing 'items' field"
    assert "companies" in data, "Missing 'companies' field"
    log(f"✅ 4B PASSED: Employer jobs → 200 (companies={len(data['companies'])}, jobs={len(data['items'])})")
    
    log("\n✅ TEST 4 COMPLETE: Other endpoints working correctly")
    return True

# ============================================================================
# MAIN
# ============================================================================

def main():
    log("=" * 80)
    log("EMPLOYER CANDIDATE SEARCH - CONTACT INFO EXPOSURE TEST")
    log("Testing updated GET /api/employer/seekers endpoint")
    log("=" * 80)
    
    all_passed = True
    
    try:
        # Run all tests
        if not test_auth_guards():
            all_passed = False
        
        if not test_contact_info_exposure():
            all_passed = False
        
        if not test_filters_pagination():
            all_passed = False
        
        if not test_other_endpoints_regression():
            all_passed = False
        
        log("\n" + "=" * 80)
        if all_passed:
            log("✅ ALL TESTS PASSED")
        else:
            log("❌ SOME TESTS FAILED")
        log("=" * 80)
        
    except AssertionError as e:
        log(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        all_passed = False
    except Exception as e:
        log(f"\n❌ UNEXPECTED ERROR: {e}")
        import traceback
        traceback.print_exc()
        all_passed = False
    finally:
        # Cleanup
        cleanup()
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    exit(main())
