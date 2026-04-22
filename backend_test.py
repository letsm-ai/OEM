#!/usr/bin/env python3
"""
Backend API Testing Script for Omani Entrepreneur Majles
Tests all backend endpoints according to the review requirements.
"""

import requests
import json
import time
from datetime import datetime

# Configuration
BASE_URL = "https://6f3dfdf5-cfdd-488c-a9a0-63f293d4ee0d.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

def print_test_result(test_name, success, details=""):
    """Print formatted test results"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"   Details: {details}")
    print()

def test_api_health():
    """Test GET /api/ endpoint"""
    print("=== Testing API Health Check ===")
    try:
        response = requests.get(f"{API_BASE}/", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("message") == "Majles API is running":
                print_test_result("GET /api/ health check", True, f"Response: {data}")
                return True
            else:
                print_test_result("GET /api/ health check", False, f"Unexpected response: {data}")
                return False
        else:
            print_test_result("GET /api/ health check", False, f"Status: {response.status_code}, Body: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("GET /api/ health check", False, f"Exception: {str(e)}")
        return False

def test_signup():
    """Test POST /api/signup endpoint"""
    print("=== Testing User Signup ===")
    
    # Generate unique email using timestamp
    timestamp = int(time.time())
    test_user = {
        "name": "أحمد محمد",
        "email": f"ahmed.test.{timestamp}@example.com",
        "password": "password123"
    }
    
    try:
        # Test valid signup
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
                print_test_result("Valid signup", True, f"User created: {data['user']['email']}")
                signup_success = True
                created_user = data["user"]
            else:
                print_test_result("Valid signup", False, f"Invalid response structure: {data}")
                signup_success = False
                created_user = None
        else:
            print_test_result("Valid signup", False, f"Status: {response.status_code}, Body: {response.text}")
            signup_success = False
            created_user = None
            
    except Exception as e:
        print_test_result("Valid signup", False, f"Exception: {str(e)}")
        signup_success = False
        created_user = None
    
    # Test duplicate email
    if signup_success:
        try:
            response = requests.post(
                f"{API_BASE}/signup",
                json=test_user,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            if response.status_code == 409:
                print_test_result("Duplicate email rejection", True, "409 status returned")
            else:
                print_test_result("Duplicate email rejection", False, f"Expected 409, got {response.status_code}")
                
        except Exception as e:
            print_test_result("Duplicate email rejection", False, f"Exception: {str(e)}")
    
    # Test missing fields
    try:
        response = requests.post(
            f"{API_BASE}/signup",
            json={"name": "Test", "email": "test@example.com"},  # Missing password
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 400:
            print_test_result("Missing fields validation", True, "400 status returned")
        else:
            print_test_result("Missing fields validation", False, f"Expected 400, got {response.status_code}")
            
    except Exception as e:
        print_test_result("Missing fields validation", False, f"Exception: {str(e)}")
    
    # Test short password
    try:
        response = requests.post(
            f"{API_BASE}/signup",
            json={"name": "Test", "email": "test2@example.com", "password": "123"},  # Too short
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 400:
            print_test_result("Short password validation", True, "400 status returned")
        else:
            print_test_result("Short password validation", False, f"Expected 400, got {response.status_code}")
            
    except Exception as e:
        print_test_result("Short password validation", False, f"Exception: {str(e)}")
    
    return created_user if signup_success else None

def test_nextauth_login(user_email, user_password):
    """Test NextAuth credentials login"""
    print("=== Testing NextAuth Login ===")
    
    if not user_email or not user_password:
        print_test_result("NextAuth login", False, "No user credentials available")
        return None
    
    # Create a session to maintain cookies
    session = requests.Session()
    
    try:
        # First, get CSRF token
        csrf_response = session.get(f"{BASE_URL}/api/auth/csrf", timeout=10)
        if csrf_response.status_code != 200:
            print_test_result("CSRF token retrieval", False, f"Status: {csrf_response.status_code}")
            return None
            
        csrf_token = csrf_response.json().get("csrfToken")
        if not csrf_token:
            print_test_result("CSRF token retrieval", False, "No CSRF token in response")
            return None
            
        print_test_result("CSRF token retrieval", True, "CSRF token obtained")
        
        # Attempt login
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
        
        # Check if login was successful (NextAuth returns different status codes)
        if login_response.status_code in [200, 302]:
            # Check if we have session cookies
            session_cookies = [cookie for cookie in session.cookies if 'next-auth' in cookie.name]
            if session_cookies:
                print_test_result("NextAuth login", True, f"Session cookies: {[c.name for c in session_cookies]}")
                return session
            else:
                print_test_result("NextAuth login", False, "No session cookies found")
                return None
        else:
            print_test_result("NextAuth login", False, f"Status: {login_response.status_code}, Body: {login_response.text[:200]}")
            return None
            
    except Exception as e:
        print_test_result("NextAuth login", False, f"Exception: {str(e)}")
        return None

def test_wrong_password_login(user_email):
    """Test login with wrong password"""
    print("=== Testing Wrong Password Login ===")
    
    if not user_email:
        print_test_result("Wrong password login", False, "No user email available")
        return
    
    session = requests.Session()
    
    try:
        # Get CSRF token
        csrf_response = session.get(f"{BASE_URL}/api/auth/csrf", timeout=10)
        csrf_token = csrf_response.json().get("csrfToken")
        
        # Attempt login with wrong password
        login_data = {
            "email": user_email,
            "password": "wrongpassword123",
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
        
        # Check if login failed properly (401 status and no valid session)
        if login_response.status_code == 401:
            # Verify that /api/me returns 401 with these cookies
            me_response = session.get(f"{API_BASE}/me", timeout=10)
            if me_response.status_code == 401:
                print_test_result("Wrong password rejection", True, "401 status and /api/me returns 401")
            else:
                print_test_result("Wrong password rejection", False, f"/api/me returned {me_response.status_code} with wrong password")
        else:
            print_test_result("Wrong password rejection", False, f"Expected 401, got {login_response.status_code}")
            
    except Exception as e:
        print_test_result("Wrong password rejection", False, f"Exception: {str(e)}")

def test_me_endpoint(authenticated_session, unauthenticated_session=None):
    """Test GET /api/me endpoint"""
    print("=== Testing /api/me Endpoint ===")
    
    # Test without authentication
    if unauthenticated_session is None:
        unauthenticated_session = requests.Session()
    
    try:
        response = unauthenticated_session.get(f"{API_BASE}/me", timeout=10)
        
        if response.status_code == 401:
            print_test_result("Unauthenticated /api/me", True, "401 status returned")
        else:
            print_test_result("Unauthenticated /api/me", False, f"Expected 401, got {response.status_code}")
            
    except Exception as e:
        print_test_result("Unauthenticated /api/me", False, f"Exception: {str(e)}")
    
    # Test with authentication
    if authenticated_session:
        try:
            response = authenticated_session.get(f"{API_BASE}/me", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if (data.get("id") and 
                    data.get("email") and 
                    data.get("role") == "MEMBER" and
                    data.get("membershipTier") == "FREE" and
                    "password" not in data and
                    data.get("createdAt")):
                    print_test_result("Authenticated /api/me", True, f"User data: {data['email']}, role: {data['role']}")
                else:
                    print_test_result("Authenticated /api/me", False, f"Invalid response structure: {data}")
            else:
                print_test_result("Authenticated /api/me", False, f"Status: {response.status_code}, Body: {response.text}")
                
        except Exception as e:
            print_test_result("Authenticated /api/me", False, f"Exception: {str(e)}")
    else:
        print_test_result("Authenticated /api/me", False, "No authenticated session available")

def test_membership_subscribe(authenticated_session):
    """Test POST /api/membership/subscribe endpoint"""
    print("=== Testing Membership Subscribe ===")
    
    if not authenticated_session:
        print_test_result("Membership subscribe tests", False, "No authenticated session available")
        return
    
    # Test 1: No session cookie (using unauthenticated session)
    try:
        unauthenticated_session = requests.Session()
        response = unauthenticated_session.post(
            f"{API_BASE}/membership/subscribe",
            json={"tier": "BASIC"},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 401:
            data = response.json()
            if "يجب تسجيل الدخول أولاً" in data.get("error", ""):
                print_test_result("Subscribe without session", True, "401 with Arabic error message")
            else:
                print_test_result("Subscribe without session", True, f"401 status (error: {data.get('error', 'N/A')})")
        else:
            print_test_result("Subscribe without session", False, f"Expected 401, got {response.status_code}")
    except Exception as e:
        print_test_result("Subscribe without session", False, f"Exception: {str(e)}")
    
    # Test 2: Invalid tier
    try:
        response = authenticated_session.post(
            f"{API_BASE}/membership/subscribe",
            json={"tier": "INVALID"},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 400:
            print_test_result("Subscribe with invalid tier", True, "400 status returned")
        else:
            print_test_result("Subscribe with invalid tier", False, f"Expected 400, got {response.status_code}")
    except Exception as e:
        print_test_result("Subscribe with invalid tier", False, f"Exception: {str(e)}")
    
    # Test 3: FREE tier (should be rejected)
    try:
        response = authenticated_session.post(
            f"{API_BASE}/membership/subscribe",
            json={"tier": "FREE"},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 400:
            data = response.json()
            if "الباقة المجانية مفعلة تلقائياً" in data.get("error", ""):
                print_test_result("Subscribe to FREE tier", True, "400 with Arabic error message")
            else:
                print_test_result("Subscribe to FREE tier", True, f"400 status (error: {data.get('error', 'N/A')})")
        else:
            print_test_result("Subscribe to FREE tier", False, f"Expected 400, got {response.status_code}")
    except Exception as e:
        print_test_result("Subscribe to FREE tier", False, f"Exception: {str(e)}")
    
    # Test 4: Valid subscription to BASIC
    try:
        response = authenticated_session.post(
            f"{API_BASE}/membership/subscribe",
            json={"tier": "BASIC"},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            membership = data.get("membership", {})
            user = data.get("user", {})
            
            # Verify response structure and values
            checks = []
            checks.append(("success field", data.get("success") == True))
            checks.append(("membership.amountPaid", membership.get("amountPaid") == 50))
            checks.append(("membership.paymentStatus", membership.get("paymentStatus") == "PAID"))
            checks.append(("user.membershipTier", user.get("membershipTier") == "BASIC"))
            
            # Check endDate is approximately 1 year from now (tolerance ± 2 days)
            end_date = membership.get("endDate")
            if end_date:
                from datetime import datetime, timedelta
                end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                now = datetime.now(end_dt.tzinfo)
                expected_end = now + timedelta(days=365)
                diff_days = abs((end_dt - expected_end).days)
                checks.append(("membership.endDate within ±2 days", diff_days <= 2))
            else:
                checks.append(("membership.endDate exists", False))
            
            # Check user.membershipExpiry matches endDate
            user_expiry = user.get("membershipExpiry")
            checks.append(("user.membershipExpiry matches endDate", user_expiry == end_date))
            
            all_passed = all(check[1] for check in checks)
            failed_checks = [check[0] for check in checks if not check[1]]
            
            if all_passed:
                print_test_result("Subscribe to BASIC tier", True, f"All validations passed")
            else:
                print_test_result("Subscribe to BASIC tier", False, f"Failed checks: {failed_checks}")
        else:
            print_test_result("Subscribe to BASIC tier", False, f"Status: {response.status_code}, Body: {response.text}")
    except Exception as e:
        print_test_result("Subscribe to BASIC tier", False, f"Exception: {str(e)}")
    
    # Test 5: Verify /api/me reflects new tier
    try:
        response = authenticated_session.get(f"{API_BASE}/me", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if (data.get("membershipTier") == "BASIC" and 
                data.get("membershipExpiry")):
                print_test_result("GET /api/me after BASIC subscribe", True, f"Tier: {data['membershipTier']}")
            else:
                print_test_result("GET /api/me after BASIC subscribe", False, f"Tier: {data.get('membershipTier')}, Expiry: {data.get('membershipExpiry')}")
        else:
            print_test_result("GET /api/me after BASIC subscribe", False, f"Status: {response.status_code}")
    except Exception as e:
        print_test_result("GET /api/me after BASIC subscribe", False, f"Exception: {str(e)}")
    
    # Test 6: Subscribe to GOLD (upgrade)
    try:
        response = authenticated_session.post(
            f"{API_BASE}/membership/subscribe",
            json={"tier": "GOLD"},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            membership = data.get("membership", {})
            user = data.get("user", {})
            
            checks = []
            checks.append(("membership.amountPaid", membership.get("amountPaid") == 100))
            checks.append(("membership.paymentStatus", membership.get("paymentStatus") == "PAID"))
            checks.append(("user.membershipTier", user.get("membershipTier") == "GOLD"))
            
            all_passed = all(check[1] for check in checks)
            failed_checks = [check[0] for check in checks if not check[1]]
            
            if all_passed:
                print_test_result("Subscribe to GOLD tier (upgrade)", True, "All validations passed")
            else:
                print_test_result("Subscribe to GOLD tier (upgrade)", False, f"Failed checks: {failed_checks}")
        else:
            print_test_result("Subscribe to GOLD tier (upgrade)", False, f"Status: {response.status_code}, Body: {response.text}")
    except Exception as e:
        print_test_result("Subscribe to GOLD tier (upgrade)", False, f"Exception: {str(e)}")

def test_membership_history(authenticated_session):
    """Test GET /api/membership/history endpoint"""
    print("=== Testing Membership History ===")
    
    if not authenticated_session:
        print_test_result("Membership history tests", False, "No authenticated session available")
        return
    
    # Test 1: No session
    try:
        unauthenticated_session = requests.Session()
        response = unauthenticated_session.get(f"{API_BASE}/membership/history", timeout=10)
        
        if response.status_code == 401:
            print_test_result("History without session", True, "401 status returned")
        else:
            print_test_result("History without session", False, f"Expected 401, got {response.status_code}")
    except Exception as e:
        print_test_result("History without session", False, f"Exception: {str(e)}")
    
    # Test 2: With session (after subscribes)
    try:
        response = authenticated_session.get(f"{API_BASE}/membership/history", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            history = data.get("history", [])
            
            # Should have at least 2 entries (BASIC then GOLD from previous tests)
            if len(history) >= 2:
                # Check if sorted desc by startDate (first should be GOLD)
                first_entry = history[0]
                if first_entry.get("tier") == "GOLD":
                    print_test_result("Membership history with session", True, f"Found {len(history)} entries, latest is GOLD")
                else:
                    print_test_result("Membership history with session", False, f"Latest entry tier: {first_entry.get('tier')}, expected GOLD")
            else:
                print_test_result("Membership history with session", False, f"Expected ≥2 entries, got {len(history)}")
        else:
            print_test_result("Membership history with session", False, f"Status: {response.status_code}, Body: {response.text}")
    except Exception as e:
        print_test_result("Membership history with session", False, f"Exception: {str(e)}")

def test_membership_discount(authenticated_session):
    """Test POST /api/membership/discount endpoint"""
    print("=== Testing Membership Discount ===")
    
    # Test 1: No session (should treat as FREE)
    try:
        unauthenticated_session = requests.Session()
        response = unauthenticated_session.post(
            f"{API_BASE}/membership/discount",
            json={"price": 100},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            expected = {
                "tier": "FREE",
                "originalPrice": 100,
                "discountPercent": 0,
                "discountAmount": 0,
                "finalPrice": 100
            }
            
            checks = []
            for key, expected_value in expected.items():
                checks.append((f"{key}", data.get(key) == expected_value))
            
            all_passed = all(check[1] for check in checks)
            failed_checks = [check[0] for check in checks if not check[1]]
            
            if all_passed:
                print_test_result("Discount without session (FREE)", True, "All validations passed")
            else:
                print_test_result("Discount without session (FREE)", False, f"Failed checks: {failed_checks}, Data: {data}")
        else:
            print_test_result("Discount without session (FREE)", False, f"Status: {response.status_code}, Body: {response.text}")
    except Exception as e:
        print_test_result("Discount without session (FREE)", False, f"Exception: {str(e)}")
    
    if not authenticated_session:
        print_test_result("Authenticated discount tests", False, "No authenticated session available")
        return
    
    # Test 2: As GOLD user (from previous subscribe test)
    try:
        response = authenticated_session.post(
            f"{API_BASE}/membership/discount",
            json={"price": 100},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            expected = {
                "tier": "GOLD",
                "originalPrice": 100,
                "discountPercent": 20,
                "discountAmount": 20,
                "finalPrice": 80
            }
            
            checks = []
            for key, expected_value in expected.items():
                checks.append((f"{key}", data.get(key) == expected_value))
            
            all_passed = all(check[1] for check in checks)
            failed_checks = [check[0] for check in checks if not check[1]]
            
            if all_passed:
                print_test_result("Discount as GOLD user", True, "20% discount applied correctly")
            else:
                print_test_result("Discount as GOLD user", False, f"Failed checks: {failed_checks}, Data: {data}")
        else:
            print_test_result("Discount as GOLD user", False, f"Status: {response.status_code}, Body: {response.text}")
    except Exception as e:
        print_test_result("Discount as GOLD user", False, f"Exception: {str(e)}")
    
    # Test 3: Invalid price (negative)
    try:
        response = authenticated_session.post(
            f"{API_BASE}/membership/discount",
            json={"price": -50},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 400:
            data = response.json()
            if "السعر غير صحيح" in data.get("error", ""):
                print_test_result("Discount with invalid price", True, "400 with Arabic error message")
            else:
                print_test_result("Discount with invalid price", True, f"400 status (error: {data.get('error', 'N/A')})")
        else:
            print_test_result("Discount with invalid price", False, f"Expected 400, got {response.status_code}")
    except Exception as e:
        print_test_result("Discount with invalid price", False, f"Exception: {str(e)}")
    
    # Test 4: Invalid price (non-number)
    try:
        response = authenticated_session.post(
            f"{API_BASE}/membership/discount",
            json={"price": "invalid"},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 400:
            print_test_result("Discount with non-number price", True, "400 status returned")
        else:
            print_test_result("Discount with non-number price", False, f"Expected 400, got {response.status_code}")
    except Exception as e:
        print_test_result("Discount with non-number price", False, f"Exception: {str(e)}")

def test_platinum_subscription_and_discount(authenticated_session):
    """Test PLATINUM subscription and its 30% discount"""
    print("=== Testing PLATINUM Subscription and Discount ===")
    
    if not authenticated_session:
        print_test_result("PLATINUM tests", False, "No authenticated session available")
        return
    
    # Subscribe to PLATINUM
    try:
        response = authenticated_session.post(
            f"{API_BASE}/membership/subscribe",
            json={"tier": "PLATINUM"},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            membership = data.get("membership", {})
            user = data.get("user", {})
            
            checks = []
            checks.append(("membership.amountPaid", membership.get("amountPaid") == 200))
            checks.append(("membership.paymentStatus", membership.get("paymentStatus") == "PAID"))
            checks.append(("user.membershipTier", user.get("membershipTier") == "PLATINUM"))
            
            all_passed = all(check[1] for check in checks)
            failed_checks = [check[0] for check in checks if not check[1]]
            
            if all_passed:
                print_test_result("Subscribe to PLATINUM tier", True, "All validations passed")
            else:
                print_test_result("Subscribe to PLATINUM tier", False, f"Failed checks: {failed_checks}")
        else:
            print_test_result("Subscribe to PLATINUM tier", False, f"Status: {response.status_code}, Body: {response.text}")
    except Exception as e:
        print_test_result("Subscribe to PLATINUM tier", False, f"Exception: {str(e)}")
    
    # Test PLATINUM discount (30%)
    try:
        response = authenticated_session.post(
            f"{API_BASE}/membership/discount",
            json={"price": 100},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            expected = {
                "tier": "PLATINUM",
                "originalPrice": 100,
                "discountPercent": 30,
                "discountAmount": 30,
                "finalPrice": 70
            }
            
            checks = []
            for key, expected_value in expected.items():
                checks.append((f"{key}", data.get(key) == expected_value))
            
            all_passed = all(check[1] for check in checks)
            failed_checks = [check[0] for check in checks if not check[1]]
            
            if all_passed:
                print_test_result("Discount as PLATINUM user", True, "30% discount applied correctly")
            else:
                print_test_result("Discount as PLATINUM user", False, f"Failed checks: {failed_checks}, Data: {data}")
        else:
            print_test_result("Discount as PLATINUM user", False, f"Status: {response.status_code}, Body: {response.text}")
    except Exception as e:
        print_test_result("Discount as PLATINUM user", False, f"Exception: {str(e)}")

def main():
    """Run all backend tests"""
    print("🚀 Starting Backend API Tests for Omani Entrepreneur Majles - Phase 2 (Membership)")
    print(f"Base URL: {BASE_URL}")
    print(f"API Base: {API_BASE}")
    print("=" * 60)
    
    # Test 1: API Health Check
    health_ok = test_api_health()
    
    # Test 2: User Signup (create fresh user for Phase 2 testing)
    created_user = test_signup()
    
    # Test 3: NextAuth Login
    if created_user:
        authenticated_session = test_nextauth_login(created_user["email"], "password123")
        
        if authenticated_session:
            # Phase 2 Membership Tests
            print("\n" + "=" * 60)
            print("🔥 PHASE 2 MEMBERSHIP TESTS")
            print("=" * 60)
            
            # Test membership endpoints
            test_membership_subscribe(authenticated_session)
            test_membership_history(authenticated_session)
            test_membership_discount(authenticated_session)
            test_platinum_subscription_and_discount(authenticated_session)
            
            # Final verification: Check /api/me shows membershipExpiry
            print("=== Final Verification ===")
            try:
                response = authenticated_session.get(f"{API_BASE}/me", timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    if data.get("membershipExpiry"):
                        print_test_result("GET /api/me exposes membershipExpiry", True, f"Expiry: {data['membershipExpiry']}")
                    else:
                        print_test_result("GET /api/me exposes membershipExpiry", False, "membershipExpiry field missing")
                else:
                    print_test_result("GET /api/me exposes membershipExpiry", False, f"Status: {response.status_code}")
            except Exception as e:
                print_test_result("GET /api/me exposes membershipExpiry", False, f"Exception: {str(e)}")
        else:
            print("⚠️  Skipping Phase 2 tests due to authentication failure")
    else:
        print("⚠️  Skipping all tests due to signup failure")
    
    print("=" * 60)
    print("🏁 Backend API Tests Complete")

if __name__ == "__main__":
    main()