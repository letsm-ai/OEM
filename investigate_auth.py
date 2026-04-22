#!/usr/bin/env python3
"""
Detailed investigation of NextAuth login behavior
"""

import requests
import json

BASE_URL = "https://6f3dfdf5-cfdd-488c-a9a0-63f293d4ee0d.preview.emergentagent.com"

def investigate_wrong_password():
    """Investigate what happens with wrong password in detail"""
    print("=== Detailed Investigation: Wrong Password Login ===")
    
    # Use a known email from previous test
    test_email = "ahmed.test.1776854958@example.com"
    
    session = requests.Session()
    
    try:
        # Get CSRF token
        csrf_response = session.get(f"{BASE_URL}/api/auth/csrf", timeout=10)
        csrf_token = csrf_response.json().get("csrfToken")
        print(f"CSRF Token: {csrf_token}")
        
        # Attempt login with wrong password
        login_data = {
            "email": test_email,
            "password": "wrongpassword123",
            "csrfToken": csrf_token,
            "callbackUrl": f"{BASE_URL}/dashboard",
            "json": "true"
        }
        
        print(f"Attempting login with wrong password for: {test_email}")
        
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
        
        print(f"Login response status: {login_response.status_code}")
        print(f"Login response headers: {dict(login_response.headers)}")
        print(f"Login response body: {login_response.text[:500]}")
        
        # Check cookies
        print(f"All cookies: {[f'{c.name}={c.value}' for c in session.cookies]}")
        
        # Now test if we can access /api/me with these cookies
        me_response = session.get(f"{BASE_URL}/api/me", timeout=10)
        print(f"/api/me response status: {me_response.status_code}")
        print(f"/api/me response body: {me_response.text}")
        
        if me_response.status_code == 401:
            print("✅ GOOD: Even with cookies, /api/me returns 401 - authentication failed")
            return True
        else:
            print("❌ BAD: /api/me returned success with wrong password")
            return False
            
    except Exception as e:
        print(f"Exception: {str(e)}")
        return False

if __name__ == "__main__":
    investigate_wrong_password()