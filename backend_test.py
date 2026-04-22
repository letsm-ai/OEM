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

def main():
    """Run all backend tests"""
    print("🚀 Starting Backend API Tests for Omani Entrepreneur Majles")
    print(f"Base URL: {BASE_URL}")
    print(f"API Base: {API_BASE}")
    print("=" * 60)
    
    # Test 1: API Health Check
    health_ok = test_api_health()
    
    # Test 2: User Signup
    created_user = test_signup()
    
    # Test 3: NextAuth Login
    if created_user:
        authenticated_session = test_nextauth_login(created_user["email"], "password123")
        
        # Test 4: Wrong Password
        test_wrong_password_login(created_user["email"])
        
        # Test 5: /api/me endpoint
        test_me_endpoint(authenticated_session)
    else:
        print("⚠️  Skipping login and /api/me tests due to signup failure")
    
    print("=" * 60)
    print("🏁 Backend API Tests Complete")

if __name__ == "__main__":
    main()