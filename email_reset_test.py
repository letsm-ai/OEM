#!/usr/bin/env python3
"""
Email + Password Reset Flow Testing Script for Omani Entrepreneur Majles
Tests the new email + password reset functionality according to review requirements.
"""

import requests
import json
import time
import os
import secrets
import hashlib
from datetime import datetime, timedelta
from pymongo import MongoClient

# Configuration
BASE_URL = os.environ.get('NEXT_PUBLIC_BASE_URL', 'https://6f3dfdf5-cfdd-488c-a9a0-63f293d4ee0d.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'majles')

# MongoDB connection
client = MongoClient(MONGO_URL)
db = client[DB_NAME]
password_reset_tokens_coll = db['passwordresettokens']
users_coll = db['users']

def print_test_result(test_name, success, details=""):
    """Print formatted test results"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"   Details: {details}")
    print()

def sha256_hash(s):
    """Create SHA256 hash of string"""
    return hashlib.sha256(str(s).encode()).hexdigest()

def test_regression_signup():
    """Test regression - signup still works"""
    print("=== REGRESSION TEST: Signup Still Works ===")
    
    # Generate unique email using timestamp
    timestamp = int(time.time())
    test_user = {
        "name": "فاطمة أحمد",
        "email": f"fatima.test.{timestamp}@example.com",
        "password": "password123"
    }
    
    try:
        response = requests.post(
            f"{API_BASE}/signup",
            json=test_user,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if (data.get("success") and 
                data.get("user") and 
                data["user"].get("id") and
                data["user"].get("role") == "MEMBER" and
                data["user"].get("membershipTier") == "FREE" and
                "password" not in data["user"]):
                print_test_result("Regression: Valid signup", True, f"User created: {data['user']['email']}")
                return data["user"]
            else:
                print_test_result("Regression: Valid signup", False, f"Invalid response structure: {data}")
                return None
        else:
            print_test_result("Regression: Valid signup", False, f"Status: {response.status_code}, Body: {response.text}")
            return None
            
    except Exception as e:
        print_test_result("Regression: Valid signup", False, f"Exception: {str(e)}")
        return None

def test_regression_membership_subscribe(user_email, user_password):
    """Test regression - membership subscribe still works"""
    print("=== REGRESSION TEST: Membership Subscribe Still Works ===")
    
    if not user_email or not user_password:
        print_test_result("Regression: Membership subscribe", False, "No user credentials available")
        return None
    
    # Login first
    session = requests.Session()
    
    try:
        # Get CSRF token
        csrf_response = session.get(f"{BASE_URL}/api/auth/csrf", timeout=10)
        if csrf_response.status_code != 200:
            print_test_result("Regression: Login for membership", False, f"CSRF Status: {csrf_response.status_code}")
            return None
            
        csrf_token = csrf_response.json().get("csrfToken")
        
        # Login
        login_data = {
            "email": user_email,
            "password": user_password,
            "csrfToken": csrf_token,
            "callbackUrl": f"{BASE_URL}/dashboard",
            "json": "true"
        }
        
        login_response = session.post(
            f"{BASE_URL}/api/auth/callback/credentials",
            data=login_data,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "X-Requested-With": "XMLHttpRequest"
            },
            timeout=10,
            allow_redirects=False
        )
        
        # Check if login was successful
        if login_response.status_code not in [200, 302]:
            print_test_result("Regression: Login for membership", False, f"Login Status: {login_response.status_code}")
            return None
        
        # Check session cookies
        session_cookies = [cookie for cookie in session.cookies if 'next-auth' in cookie.name]
        if not session_cookies:
            print_test_result("Regression: Login for membership", False, "No session cookies found")
            return None
        
        # Now test membership subscribe
        response = session.post(
            f"{API_BASE}/membership/subscribe",
            json={"tier": "BASIC"},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            membership = data.get("membership", {})
            user = data.get("user", {})
            
            if (data.get("success") and 
                membership.get("amountPaid") == 50 and
                membership.get("paymentStatus") == "PAID" and
                user.get("membershipTier") == "BASIC"):
                print_test_result("Regression: Membership subscribe", True, "BASIC subscription successful")
                
                # Verify GET /api/me reflects tier=BASIC and membershipExpiry set
                me_response = session.get(f"{API_BASE}/me", timeout=10)
                if me_response.status_code == 200:
                    me_data = me_response.json()
                    if (me_data.get("membershipTier") == "BASIC" and 
                        me_data.get("membershipExpiry")):
                        print_test_result("Regression: GET /api/me after subscribe", True, f"Tier: {me_data['membershipTier']}")
                        return session
                    else:
                        print_test_result("Regression: GET /api/me after subscribe", False, f"Tier: {me_data.get('membershipTier')}, Expiry: {me_data.get('membershipExpiry')}")
                        return session
                else:
                    print_test_result("Regression: GET /api/me after subscribe", False, f"Status: {me_response.status_code}")
                    return session
            else:
                print_test_result("Regression: Membership subscribe", False, f"Invalid response: {data}")
                return None
        else:
            print_test_result("Regression: Membership subscribe", False, f"Status: {response.status_code}, Body: {response.text}")
            return None
            
    except Exception as e:
        print_test_result("Regression: Membership subscribe", False, f"Exception: {str(e)}")
        return None

def test_forgot_password(test_user_email):
    """Test POST /api/forgot-password endpoint"""
    print("=== Testing POST /api/forgot-password ===")
    
    # Test 1: No body / no email
    try:
        response = requests.post(
            f"{API_BASE}/forgot-password",
            json={},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 400:
            data = response.json()
            if "البريد الإلكتروني مطلوب" in data.get("error", ""):
                print_test_result("Forgot password: No email", True, "400 with Arabic error")
            else:
                print_test_result("Forgot password: No email", True, f"400 status (error: {data.get('error', 'N/A')})")
        else:
            print_test_result("Forgot password: No email", False, f"Expected 400, got {response.status_code}")
    except Exception as e:
        print_test_result("Forgot password: No email", False, f"Exception: {str(e)}")
    
    # Test 2: Unknown email (anti-enumeration)
    try:
        response = requests.post(
            f"{API_BASE}/forgot-password",
            json={"email": "unknown.user@example.com"},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if (data.get("success") == True and 
                "إذا كان" in data.get("message", "")):
                print_test_result("Forgot password: Unknown email", True, "200 with anti-enumeration message")
            else:
                print_test_result("Forgot password: Unknown email", False, f"Unexpected response: {data}")
        else:
            print_test_result("Forgot password: Unknown email", False, f"Expected 200, got {response.status_code}")
    except Exception as e:
        print_test_result("Forgot password: Unknown email", False, f"Exception: {str(e)}")
    
    # Test 3: Known email (should create token)
    if not test_user_email:
        print_test_result("Forgot password: Known email", False, "No test user email available")
        return None
    
    try:
        # Clear any existing tokens for this user first
        user_doc = users_coll.find_one({"email": test_user_email})
        if user_doc:
            password_reset_tokens_coll.delete_many({"userId": user_doc["_id"]})
        
        response = requests.post(
            f"{API_BASE}/forgot-password",
            json={"email": test_user_email},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if (data.get("success") == True and 
                "إذا كان" in data.get("message", "")):
                print_test_result("Forgot password: Known email", True, "200 with anti-enumeration message")
                
                # Test 4: DB check - verify token was created
                if user_doc:
                    token_doc = password_reset_tokens_coll.find_one({"userId": user_doc["_id"]})
                    if token_doc:
                        checks = []
                        checks.append(("userId matches", token_doc.get("userId") == user_doc["_id"]))
                        checks.append(("tokenHash is 64-char hex", len(token_doc.get("tokenHash", "")) == 64))
                        checks.append(("usedAt is null", token_doc.get("usedAt") is None))
                        
                        # Check expiresAt is roughly now + 1 hour (±5 min)
                        expires_at = token_doc.get("expiresAt")
                        if expires_at:
                            now = datetime.utcnow()
                            expected_expiry = now + timedelta(hours=1)
                            diff_minutes = abs((expires_at - expected_expiry).total_seconds() / 60)
                            checks.append(("expiresAt within ±5 min", diff_minutes <= 5))
                        else:
                            checks.append(("expiresAt exists", False))
                        
                        all_passed = all(check[1] for check in checks)
                        failed_checks = [check[0] for check in checks if not check[1]]
                        
                        if all_passed:
                            print_test_result("DB check: Token created correctly", True, "All validations passed")
                        else:
                            print_test_result("DB check: Token created correctly", False, f"Failed checks: {failed_checks}")
                        
                        return user_doc["_id"]  # Return user ID for further tests
                    else:
                        print_test_result("DB check: Token created", False, "No token found in database")
                        return None
                else:
                    print_test_result("DB check: Token created", False, "User not found in database")
                    return None
            else:
                print_test_result("Forgot password: Known email", False, f"Unexpected response: {data}")
                return None
        else:
            print_test_result("Forgot password: Known email", False, f"Expected 200, got {response.status_code}")
            return None
    except Exception as e:
        print_test_result("Forgot password: Known email", False, f"Exception: {str(e)}")
        return None

def test_forgot_password_invalidation(test_user_email, user_id):
    """Test that calling forgot-password again invalidates previous token"""
    print("=== Testing Forgot Password Token Invalidation ===")
    
    if not test_user_email or not user_id:
        print_test_result("Token invalidation test", False, "Missing user email or ID")
        return
    
    try:
        # Get the current active token
        current_token = password_reset_tokens_coll.find_one({
            "userId": user_id,
            "usedAt": None,
            "expiresAt": {"$gt": datetime.utcnow()}
        })
        
        if not current_token:
            print_test_result("Token invalidation: Current token check", False, "No active token found")
            return
        
        # Call forgot-password again
        response = requests.post(
            f"{API_BASE}/forgot-password",
            json={"email": test_user_email},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            # Check that previous token is now invalidated (usedAt set)
            old_token = password_reset_tokens_coll.find_one({"_id": current_token["_id"]})
            if old_token and old_token.get("usedAt") is not None:
                print_test_result("Token invalidation: Previous token invalidated", True, "usedAt field set")
                
                # Check that new active token exists
                new_token = password_reset_tokens_coll.find_one({
                    "userId": user_id,
                    "usedAt": None,
                    "expiresAt": {"$gt": datetime.utcnow()},
                    "_id": {"$ne": current_token["_id"]}
                })
                
                if new_token:
                    print_test_result("Token invalidation: New token created", True, "New active token found")
                else:
                    print_test_result("Token invalidation: New token created", False, "No new active token found")
            else:
                print_test_result("Token invalidation: Previous token invalidated", False, "Previous token still active")
        else:
            print_test_result("Token invalidation: API call", False, f"Status: {response.status_code}")
    except Exception as e:
        print_test_result("Token invalidation test", False, f"Exception: {str(e)}")

def test_reset_password(user_id, test_user_email, original_password):
    """Test POST /api/reset-password endpoint"""
    print("=== Testing POST /api/reset-password ===")
    
    # Test 1: Missing token or password
    try:
        response = requests.post(
            f"{API_BASE}/reset-password",
            json={"token": "sometoken"},  # Missing password
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 400:
            data = response.json()
            if "الرابط وكلمة المرور مطلوبة" in data.get("error", ""):
                print_test_result("Reset password: Missing fields", True, "400 with Arabic error")
            else:
                print_test_result("Reset password: Missing fields", True, f"400 status (error: {data.get('error', 'N/A')})")
        else:
            print_test_result("Reset password: Missing fields", False, f"Expected 400, got {response.status_code}")
    except Exception as e:
        print_test_result("Reset password: Missing fields", False, f"Exception: {str(e)}")
    
    # Test 2: Password too short
    try:
        response = requests.post(
            f"{API_BASE}/reset-password",
            json={"token": "sometoken", "password": "123"},  # Too short
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 400:
            data = response.json()
            if "يجب أن تكون كلمة المرور 6 أحرف على الأقل" in data.get("error", ""):
                print_test_result("Reset password: Short password", True, "400 with Arabic error")
            else:
                print_test_result("Reset password: Short password", True, f"400 status (error: {data.get('error', 'N/A')})")
        else:
            print_test_result("Reset password: Short password", False, f"Expected 400, got {response.status_code}")
    except Exception as e:
        print_test_result("Reset password: Short password", False, f"Exception: {str(e)}")
    
    # Test 3: Invalid token
    try:
        response = requests.post(
            f"{API_BASE}/reset-password",
            json={"token": "invalidtoken123", "password": "newpassword123"},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 400:
            data = response.json()
            if "الرابط غير صالح أو منتهي الصلاحية" in data.get("error", ""):
                print_test_result("Reset password: Invalid token", True, "400 with Arabic error")
            else:
                print_test_result("Reset password: Invalid token", True, f"400 status (error: {data.get('error', 'N/A')})")
        else:
            print_test_result("Reset password: Invalid token", False, f"Expected 400, got {response.status_code}")
    except Exception as e:
        print_test_result("Reset password: Invalid token", False, f"Exception: {str(e)}")
    
    # Test 4: Valid token flow (synthesize token directly in DB)
    if not user_id:
        print_test_result("Reset password: Valid token flow", False, "No user ID available")
        return False
    
    try:
        # Generate raw token and hash
        raw_token = secrets.token_hex(32)
        token_hash = sha256_hash(raw_token)
        
        # Insert token document directly
        token_doc = {
            "_id": secrets.token_hex(16),  # UUID-like
            "userId": user_id,
            "tokenHash": token_hash,
            "expiresAt": datetime.utcnow() + timedelta(minutes=30),
            "usedAt": None,
            "createdAt": datetime.utcnow()
        }
        
        password_reset_tokens_coll.insert_one(token_doc)
        
        # Test reset with valid token
        new_password = "newSecret123"
        response = requests.post(
            f"{API_BASE}/reset-password",
            json={"token": raw_token, "password": new_password},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if (data.get("success") == True and 
                "تم تحديث كلمة المرور بنجاح" in data.get("message", "")):
                print_test_result("Reset password: Valid token", True, "200 with success message")
                
                # Verify token is now marked as used
                used_token = password_reset_tokens_coll.find_one({"_id": token_doc["_id"]})
                if used_token and used_token.get("usedAt") is not None:
                    print_test_result("Reset password: Token marked used", True, "usedAt field set")
                else:
                    print_test_result("Reset password: Token marked used", False, "usedAt field not set")
                
                # Test login with new password
                if test_user_email:
                    login_success = test_login_with_new_password(test_user_email, new_password)
                    if login_success:
                        print_test_result("Reset password: Login with new password", True, "Login successful")
                        
                        # Test that old password no longer works
                        old_login_success = test_login_with_old_password(test_user_email, original_password)
                        if not old_login_success:
                            print_test_result("Reset password: Old password rejected", True, "Old password no longer works")
                        else:
                            print_test_result("Reset password: Old password rejected", False, "Old password still works")
                    else:
                        print_test_result("Reset password: Login with new password", False, "Login failed")
                
                # Test 5: Reuse same token (should fail)
                reuse_response = requests.post(
                    f"{API_BASE}/reset-password",
                    json={"token": raw_token, "password": "anotherpassword123"},
                    headers={"Content-Type": "application/json"},
                    timeout=10
                )
                
                if reuse_response.status_code == 400:
                    print_test_result("Reset password: Token reuse rejected", True, "400 status returned")
                else:
                    print_test_result("Reset password: Token reuse rejected", False, f"Expected 400, got {reuse_response.status_code}")
                
                return True
            else:
                print_test_result("Reset password: Valid token", False, f"Unexpected response: {data}")
                return False
        else:
            print_test_result("Reset password: Valid token", False, f"Status: {response.status_code}, Body: {response.text}")
            return False
    except Exception as e:
        print_test_result("Reset password: Valid token flow", False, f"Exception: {str(e)}")
        return False

def test_expired_token(user_id):
    """Test reset with expired token"""
    print("=== Testing Expired Token ===")
    
    if not user_id:
        print_test_result("Expired token test", False, "No user ID available")
        return
    
    try:
        # Generate expired token
        raw_token = secrets.token_hex(32)
        token_hash = sha256_hash(raw_token)
        
        # Insert expired token document
        expired_token_doc = {
            "_id": secrets.token_hex(16),
            "userId": user_id,
            "tokenHash": token_hash,
            "expiresAt": datetime.utcnow() - timedelta(minutes=1),  # Expired 1 minute ago
            "usedAt": None,
            "createdAt": datetime.utcnow() - timedelta(minutes=2)
        }
        
        password_reset_tokens_coll.insert_one(expired_token_doc)
        
        # Try to reset with expired token
        response = requests.post(
            f"{API_BASE}/reset-password",
            json={"token": raw_token, "password": "newpassword123"},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 400:
            data = response.json()
            if "الرابط غير صالح أو منتهي الصلاحية" in data.get("error", ""):
                print_test_result("Reset password: Expired token", True, "400 with Arabic error")
            else:
                print_test_result("Reset password: Expired token", True, f"400 status (error: {data.get('error', 'N/A')})")
        else:
            print_test_result("Reset password: Expired token", False, f"Expected 400, got {response.status_code}")
    except Exception as e:
        print_test_result("Reset password: Expired token", False, f"Exception: {str(e)}")

def test_login_with_new_password(email, password):
    """Test login with new password"""
    session = requests.Session()
    
    try:
        # Get CSRF token
        csrf_response = session.get(f"{BASE_URL}/api/auth/csrf", timeout=10)
        if csrf_response.status_code != 200:
            return False
            
        csrf_token = csrf_response.json().get("csrfToken")
        
        # Attempt login
        login_data = {
            "email": email,
            "password": password,
            "csrfToken": csrf_token,
            "callbackUrl": f"{BASE_URL}/dashboard",
            "json": "true"
        }
        
        login_response = session.post(
            f"{BASE_URL}/api/auth/callback/credentials",
            data=login_data,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "X-Requested-With": "XMLHttpRequest"
            },
            timeout=10,
            allow_redirects=False
        )
        
        # Check if login was successful
        if login_response.status_code in [200, 302]:
            session_cookies = [cookie for cookie in session.cookies if 'next-auth' in cookie.name]
            return len(session_cookies) > 0
        
        return False
    except Exception:
        return False

def test_login_with_old_password(email, password):
    """Test login with old password (should fail)"""
    return test_login_with_new_password(email, password)

def test_regression_api_endpoints():
    """Test regression - basic API endpoints still work"""
    print("=== REGRESSION TEST: Basic API Endpoints ===")
    
    # Test GET /api/
    try:
        response = requests.get(f"{API_BASE}/", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("message") == "Majles API is running":
                print_test_result("Regression: GET /api/", True, f"Response: {data}")
            else:
                print_test_result("Regression: GET /api/", False, f"Unexpected response: {data}")
        else:
            print_test_result("Regression: GET /api/", False, f"Status: {response.status_code}")
    except Exception as e:
        print_test_result("Regression: GET /api/", False, f"Exception: {str(e)}")
    
    # Test /api/me without session
    try:
        response = requests.get(f"{API_BASE}/me", timeout=10)
        
        if response.status_code == 401:
            print_test_result("Regression: GET /api/me without session", True, "401 status returned")
        else:
            print_test_result("Regression: GET /api/me without session", False, f"Expected 401, got {response.status_code}")
    except Exception as e:
        print_test_result("Regression: GET /api/me without session", False, f"Exception: {str(e)}")

def main():
    """Run all email + password reset tests"""
    print("🚀 Starting Email + Password Reset Flow Tests for Omani Entrepreneur Majles")
    print(f"Base URL: {BASE_URL}")
    print(f"API Base: {API_BASE}")
    print(f"MongoDB: {MONGO_URL}/{DB_NAME}")
    print("=" * 80)
    
    # Test 1: Regression - signup still works
    created_user = test_regression_signup()
    
    if not created_user:
        print("⚠️  Skipping remaining tests due to signup failure")
        return
    
    user_email = created_user["email"]
    original_password = "password123"
    
    # Test 2: Regression - membership subscribe still works
    authenticated_session = test_regression_membership_subscribe(user_email, original_password)
    
    # Test 3: POST /api/forgot-password
    user_id = test_forgot_password(user_email)
    
    # Test 4: Forgot password invalidation
    if user_id:
        test_forgot_password_invalidation(user_email, user_id)
    
    # Test 5: POST /api/reset-password
    reset_success = test_reset_password(user_id, user_email, original_password)
    
    # Test 6: Expired token scenario
    if user_id:
        test_expired_token(user_id)
    
    # Test 7: Regression - basic API endpoints
    test_regression_api_endpoints()
    
    # Test 8: /api/me with session (if we have authenticated session)
    if authenticated_session:
        try:
            response = authenticated_session.get(f"{API_BASE}/me", timeout=10)
            if response.status_code == 200:
                data = response.json()
                print_test_result("Regression: GET /api/me with session", True, f"User: {data.get('email')}")
            else:
                print_test_result("Regression: GET /api/me with session", False, f"Status: {response.status_code}")
        except Exception as e:
            print_test_result("Regression: GET /api/me with session", False, f"Exception: {str(e)}")
    
    print("=" * 80)
    print("🏁 Email + Password Reset Flow Tests Complete")
    print("\nIMPORTANT: Resend is in test mode - email delivery errors in server logs are EXPECTED")
    print("and do not indicate failure. API responses should still be 200.")

if __name__ == "__main__":
    main()