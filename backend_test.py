#!/usr/bin/env python3
"""
Backend API Testing for Omani Entrepreneur Majles
Tests membership trial and subscribe endpoints with enhanced error diagnostics
"""

import requests
import json
import time
import os
from datetime import datetime, timedelta
from pymongo import MongoClient
import bcrypt

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://omani-startup-hub.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017/majles')
DB_NAME = os.getenv('DB_NAME', 'majles')

# Test credentials
ADMIN_EMAIL = "mazin298@gmail.com"
ADMIN_PASSWORD = "Password123"

# MongoDB connection
mongo_client = MongoClient(MONGO_URL)
db = mongo_client[DB_NAME]

print("=" * 80)
print("MEMBERSHIP TRIAL + SUBSCRIBE ENHANCED ERROR DIAGNOSTICS TESTING")
print("=" * 80)
print(f"API Base URL: {API_BASE}")
print(f"MongoDB: {MONGO_URL}/{DB_NAME}")
print(f"Test started at: {datetime.now().isoformat()}")
print("=" * 80)

# Helper functions
def login(email, password):
    """Login and return session cookies"""
    session = requests.Session()
    
    # Get CSRF token
    csrf_resp = session.get(f"{BASE_URL}/api/auth/csrf")
    csrf_token = csrf_resp.json().get('csrfToken')
    
    # Login
    login_resp = session.post(
        f"{BASE_URL}/api/auth/callback/credentials",
        data={
            'email': email,
            'password': password,
            'csrfToken': csrf_token,
            'json': 'true'
        },
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
        allow_redirects=False
    )
    
    # Return the session object which maintains cookies
    return session

def create_test_user(email, password, name="Test User"):
    """Create a test user via signup API"""
    resp = requests.post(
        f"{API_BASE}/signup",
        json={
            'name': name,
            'email': email,
            'password': password
        }
    )
    return resp

def cleanup_test_user(email):
    """Delete test user and related data from database"""
    try:
        user = db.users.find_one({'email': email})
        if user:
            user_id = user['_id']
            # Delete memberships
            db.memberships.delete_many({'userId': user_id})
            # Delete user
            db.users.delete_one({'_id': user_id})
            print(f"✓ Cleaned up test user: {email}")
    except Exception as e:
        print(f"✗ Cleanup error for {email}: {e}")

# Test counters
total_tests = 0
passed_tests = 0
failed_tests = 0

def test_result(name, passed, details=""):
    global total_tests, passed_tests, failed_tests
    total_tests += 1
    if passed:
        passed_tests += 1
        print(f"✅ TEST {total_tests}: {name}")
    else:
        failed_tests += 1
        print(f"❌ TEST {total_tests}: {name}")
    if details:
        print(f"   {details}")
    print()

# =============================================================================
# TEST 1: GET /api/membership/trial-status (public, no auth)
# =============================================================================
print("\n" + "=" * 80)
print("TEST 1: GET /api/membership/trial-status (public, no auth)")
print("=" * 80)

try:
    resp = requests.get(f"{API_BASE}/membership/trial-status")
    data = resp.json()
    
    if resp.status_code == 200:
        required_fields = ['loggedIn', 'enabled', 'durationDays', 'allowedTier']
        has_all_fields = all(field in data for field in required_fields)
        
        if has_all_fields and data['loggedIn'] == False:
            test_result(
                "Public trial-status endpoint",
                True,
                f"Response: loggedIn={data['loggedIn']}, enabled={data['enabled']}, durationDays={data['durationDays']}, allowedTier={data.get('allowedTier', '')}"
            )
        else:
            test_result(
                "Public trial-status endpoint",
                False,
                f"Missing fields or loggedIn not False. Data: {data}"
            )
    else:
        test_result(
            "Public trial-status endpoint",
            False,
            f"Expected 200, got {resp.status_code}: {data}"
        )
except Exception as e:
    test_result("Public trial-status endpoint", False, f"Exception: {e}")

# =============================================================================
# TEST 2: GET /api/membership/trial-status (authenticated)
# =============================================================================
print("\n" + "=" * 80)
print("TEST 2: GET /api/membership/trial-status (authenticated)")
print("=" * 80)

try:
    # Login as admin
    admin_session = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    
    resp = admin_session.get(
        f"{API_BASE}/membership/trial-status"
    )
    data = resp.json()
    
    if resp.status_code == 200:
        required_fields = ['loggedIn', 'enabled', 'durationDays', 'allowedTier', 'trialUsed', 'trialTier', 'trialStart', 'trialEnd']
        has_all_fields = all(field in data for field in required_fields)
        
        if has_all_fields and data['loggedIn'] == True:
            test_result(
                "Authenticated trial-status endpoint",
                True,
                f"Response: loggedIn={data['loggedIn']}, trialUsed={data['trialUsed']}, trialTier={data.get('trialTier', '')}"
            )
        else:
            test_result(
                "Authenticated trial-status endpoint",
                False,
                f"Missing fields or loggedIn not True. Data: {data}"
            )
    else:
        test_result(
            "Authenticated trial-status endpoint",
            False,
            f"Expected 200, got {resp.status_code}: {data}"
        )
except Exception as e:
    test_result("Authenticated trial-status endpoint", False, f"Exception: {e}")

# =============================================================================
# TEST 3: POST /api/membership/start-trial (full flow)
# =============================================================================
print("\n" + "=" * 80)
print("TEST 3: POST /api/membership/start-trial (full flow)")
print("=" * 80)

# Create a fresh test user
test_email = f"trial_test_{int(time.time())}@example.com"
test_password = "TestPass123"
test_name = "Trial Test User"

print(f"Creating fresh test user: {test_email}")

try:
    # Create user
    signup_resp = create_test_user(test_email, test_password, test_name)
    
    if signup_resp.status_code == 200:
        print(f"✓ Test user created: {test_email}")
        
        # Login as test user
        test_session = login(test_email, test_password)
        
        # Verify user is FREE tier with trialUsed=false
        user_doc = db.users.find_one({'email': test_email})
        if user_doc:
            print(f"✓ User doc found: membershipTier={user_doc.get('membershipTier', 'FREE')}, trialUsed={user_doc.get('trialUsed', False)}")
        
        # Start trial
        trial_resp = test_session.post(
            f"{API_BASE}/membership/start-trial",
            json={'tier': 'BASIC'}
        )
        trial_data = trial_resp.json()
        
        if trial_resp.status_code == 200:
            # Verify response structure
            required_fields = ['success', 'trial', 'user']
            has_all_fields = all(field in trial_data for field in required_fields)
            
            if has_all_fields and trial_data['success'] == True:
                trial_info = trial_data['trial']
                user_info = trial_data['user']
                
                # Verify trial info
                trial_valid = (
                    trial_info.get('tier') == 'BASIC' and
                    'start' in trial_info and
                    'end' in trial_info and
                    trial_info.get('durationDays') == 30
                )
                
                # Verify user info
                user_valid = (
                    user_info.get('membershipTier') == 'BASIC' and
                    user_info.get('trialUsed') == True
                )
                
                if trial_valid and user_valid:
                    # Verify database update
                    updated_user = db.users.find_one({'email': test_email})
                    db_valid = (
                        updated_user.get('membershipTier') == 'BASIC' and
                        updated_user.get('trialUsed') == True and
                        updated_user.get('trialEnd') is not None
                    )
                    
                    # Verify Membership record created
                    membership = db.memberships.find_one({'userId': updated_user['_id']})
                    membership_valid = (
                        membership is not None and
                        membership.get('tier') == 'BASIC' and
                        membership.get('amountPaid') == 0 and
                        membership.get('paymentStatus') == 'PAID'
                    )
                    
                    if db_valid and membership_valid:
                        test_result(
                            "Start trial - Success path",
                            True,
                            f"Trial started: tier=BASIC, durationDays=30, user updated, membership created"
                        )
                    else:
                        test_result(
                            "Start trial - Success path",
                            False,
                            f"DB validation failed. db_valid={db_valid}, membership_valid={membership_valid}"
                        )
                else:
                    test_result(
                        "Start trial - Success path",
                        False,
                        f"Response validation failed. trial_valid={trial_valid}, user_valid={user_valid}"
                    )
            else:
                test_result(
                    "Start trial - Success path",
                    False,
                    f"Missing fields or success not True. Data: {trial_data}"
                )
        else:
            test_result(
                "Start trial - Success path",
                False,
                f"Expected 200, got {trial_resp.status_code}: {trial_data}"
            )
        
        # TEST 3b: Second trial attempt should fail
        print("\nTesting duplicate trial prevention...")
        trial2_resp = test_session.post(
            f"{API_BASE}/membership/start-trial",
            json={'tier': 'BASIC'}
        )
        trial2_data = trial2_resp.json()
        
        if trial2_resp.status_code == 400 and 'لقد استخدمت تجربتك المجانية مسبقاً' in trial2_data.get('error', ''):
            test_result(
                "Start trial - Duplicate prevention",
                True,
                f"Correctly rejected second trial: {trial2_data.get('error')}"
            )
        else:
            test_result(
                "Start trial - Duplicate prevention",
                False,
                f"Expected 400 with Arabic error, got {trial2_resp.status_code}: {trial2_data}"
            )
        
        # Cleanup test user
        cleanup_test_user(test_email)
        
    else:
        test_result(
            "Start trial - User creation",
            False,
            f"Failed to create test user: {signup_resp.status_code}"
        )
        
except Exception as e:
    test_result("Start trial flow", False, f"Exception: {e}")
    cleanup_test_user(test_email)

# =============================================================================
# TEST 4: POST /api/membership/subscribe (enhanced error diagnostics)
# =============================================================================
print("\n" + "=" * 80)
print("TEST 4: POST /api/membership/subscribe (enhanced error diagnostics)")
print("=" * 80)

# Login as admin
admin_session = login(ADMIN_EMAIL, ADMIN_PASSWORD)

# TEST 4a: Valid tier with Thawani configured
print("\nTEST 4a: Valid tier with Thawani configured")
try:
    resp = admin_session.post(
        f"{API_BASE}/membership/subscribe",
        json={'tier': 'BASIC'}
    )
    data = resp.json()
    
    if resp.status_code == 200:
        # Check for requiresPayment response
        if data.get('requiresPayment') == True:
            required_fields = ['redirectUrl', 'sessionId', 'membershipId']
            has_all_fields = all(field in data for field in required_fields)
            
            if has_all_fields:
                redirect_url = data['redirectUrl']
                if redirect_url.startswith('https://checkout.thawani.om/pay/'):
                    test_result(
                        "Subscribe - Valid tier (Thawani)",
                        True,
                        f"Thawani session created: sessionId={data['sessionId']}, redirectUrl starts with checkout.thawani.om"
                    )
                    
                    # Cleanup: delete the PENDING membership
                    membership_id = data['membershipId']
                    db.memberships.delete_one({'_id': membership_id})
                    print(f"✓ Cleaned up PENDING membership: {membership_id}")
                else:
                    test_result(
                        "Subscribe - Valid tier (Thawani)",
                        False,
                        f"Redirect URL doesn't start with expected domain: {redirect_url}"
                    )
            else:
                test_result(
                    "Subscribe - Valid tier (Thawani)",
                    False,
                    f"Missing required fields. Data: {data}"
                )
        elif data.get('freeMode') == True:
            # Free mode response
            test_result(
                "Subscribe - Valid tier (Free mode)",
                True,
                f"Free mode activated: {data}"
            )
        else:
            test_result(
                "Subscribe - Valid tier",
                False,
                f"Unexpected response structure: {data}"
            )
    elif resp.status_code == 503:
        # Thawani not configured - verify enhanced error shape
        if 'code' in data and data['code'] == 'THAWANI_NOT_CONFIGURED':
            test_result(
                "Subscribe - Thawani not configured (enhanced error)",
                True,
                f"Enhanced error response: code={data['code']}, error={data.get('error')}, missing={data.get('missing')}"
            )
        else:
            test_result(
                "Subscribe - Enhanced error shape",
                False,
                f"503 but missing 'code' field. Data: {data}"
            )
    elif resp.status_code == 502:
        # Thawani session creation failed - verify enhanced error shape
        if 'code' in data and data['code'] == 'THAWANI_CREATE_SESSION_FAILED':
            test_result(
                "Subscribe - Thawani session failed (enhanced error)",
                True,
                f"Enhanced error response: code={data['code']}, error={data.get('error')}, providerStatus={data.get('providerStatus')}"
            )
        else:
            test_result(
                "Subscribe - Enhanced error shape",
                False,
                f"502 but missing 'code' field. Data: {data}"
            )
    else:
        test_result(
            "Subscribe - Valid tier",
            False,
            f"Unexpected status {resp.status_code}: {data}"
        )
except Exception as e:
    test_result("Subscribe - Valid tier", False, f"Exception: {e}")

# TEST 4b: Invalid tier
print("\nTEST 4b: Invalid tier")
try:
    resp = admin_session.post(
        f"{API_BASE}/membership/subscribe",
        json={'tier': 'BAD'}
    )
    data = resp.json()
    
    if resp.status_code == 400 and 'باقة غير صحيحة' in data.get('error', ''):
        test_result(
            "Subscribe - Invalid tier",
            True,
            f"Correctly rejected: {data.get('error')}"
        )
    else:
        test_result(
            "Subscribe - Invalid tier",
            False,
            f"Expected 400 with Arabic error, got {resp.status_code}: {data}"
        )
except Exception as e:
    test_result("Subscribe - Invalid tier", False, f"Exception: {e}")

# TEST 4c: FREE tier
print("\nTEST 4c: FREE tier")
try:
    resp = admin_session.post(
        f"{API_BASE}/membership/subscribe",
        json={'tier': 'FREE'}
    )
    data = resp.json()
    
    if resp.status_code == 400 and 'الباقة المجانية مفعلة تلقائياً' in data.get('error', ''):
        test_result(
            "Subscribe - FREE tier",
            True,
            f"Correctly rejected: {data.get('error')}"
        )
    else:
        test_result(
            "Subscribe - FREE tier",
            False,
            f"Expected 400 with Arabic error, got {resp.status_code}: {data}"
        )
except Exception as e:
    test_result("Subscribe - FREE tier", False, f"Exception: {e}")

# TEST 4d: Unauthenticated
print("\nTEST 4d: Unauthenticated")
try:
    resp = requests.post(
        f"{API_BASE}/membership/subscribe",
        json={'tier': 'BASIC'}
    )
    data = resp.json()
    
    if resp.status_code == 401 and 'غير مصرح' in data.get('error', ''):
        test_result(
            "Subscribe - Unauthenticated",
            True,
            f"Correctly rejected: {data.get('error')}"
        )
    else:
        test_result(
            "Subscribe - Unauthenticated",
            False,
            f"Expected 401 with Arabic error, got {resp.status_code}: {data}"
        )
except Exception as e:
    test_result("Subscribe - Unauthenticated", False, f"Exception: {e}")

# =============================================================================
# SUMMARY
# =============================================================================
print("\n" + "=" * 80)
print("TEST SUMMARY")
print("=" * 80)
print(f"Total Tests: {total_tests}")
print(f"Passed: {passed_tests} ✅")
print(f"Failed: {failed_tests} ❌")
print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
print("=" * 80)

if failed_tests == 0:
    print("\n🎉 ALL TESTS PASSED!")
else:
    print(f"\n⚠️  {failed_tests} TEST(S) FAILED")

print(f"\nTest completed at: {datetime.now().isoformat()}")
