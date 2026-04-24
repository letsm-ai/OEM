#!/usr/bin/env python3
"""
Simple authentication test for debugging
"""

import os
import sys
import json
import requests
import pymongo
import bcrypt
import uuid
from datetime import datetime, timedelta

# Read environment variables
def load_env():
    env_vars = {}
    try:
        with open('/app/.env', 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key] = value
    except FileNotFoundError:
        print("❌ /app/.env file not found")
        sys.exit(1)
    return env_vars

ENV = load_env()
BASE_URL = ENV.get('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000') + '/api'
MONGO_URL = ENV.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = ENV.get('DB_NAME', 'majles')

print(f"🌐 Base URL: {BASE_URL}")
print(f"🗄️ MongoDB: {MONGO_URL}/{DB_NAME}")

# MongoDB connection
try:
    mongo_client = pymongo.MongoClient(MONGO_URL)
    db = mongo_client[DB_NAME]
    print("✅ MongoDB connection established")
except Exception as e:
    print(f"❌ MongoDB connection failed: {e}")
    sys.exit(1)

def make_request(method, endpoint, data=None, headers=None, cookies=None):
    """Make HTTP request with error handling"""
    url = f"{BASE_URL}{endpoint}"
    print(f"🔗 {method} {url}")
    if cookies:
        print(f"   Cookies: {list(cookies.keys())}")
    try:
        if method == 'GET':
            response = requests.get(url, headers=headers, cookies=cookies, timeout=30)
        elif method == 'POST':
            response = requests.post(url, json=data, headers=headers, cookies=cookies, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        print(f"   Response: {response.status_code}")
        if response.status_code != 200:
            print(f"   Error: {response.text[:200]}")
        return response
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return None

def create_test_user():
    """Create a test user directly in MongoDB with bcrypt password"""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    email = f"test_auth_{timestamp}@test.com"
    password = "testpass123"
    
    # Hash password with bcrypt
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    user_doc = {
        '_id': str(uuid.uuid4()),
        'name': f'Test Auth User',
        'email': email,
        'password': hashed_password,
        'role': 'MEMBER',
        'membershipTier': 'FREE',
        'phone': '',
        'photo': '',
        'wishlist': [],
        'vendorProfile': {
            'slug': '',
            'businessName': '',
            'tagline': '',
            'bio': '',
            'banner': '',
            'logo': '',
            'phone': '',
            'whatsapp': '',
            'instagram': '',
            'website': '',
            'governorate': '',
            'city': '',
            'address': ''
        },
        'createdAt': datetime.utcnow()
    }
    
    try:
        db.users.insert_one(user_doc)
        print(f"✅ Created user: {email}")
        return {
            'id': user_doc['_id'],
            'email': email,
            'password': password,
            'name': user_doc['name']
        }
    except Exception as e:
        print(f"❌ Failed to create user: {e}")
        return None

def test_auth():
    """Test authentication flow"""
    print("\n🔐 TESTING AUTHENTICATION FLOW")
    
    # Create test user via signup endpoint instead of direct DB insertion
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    email = f"test_auth_{timestamp}@test.com"
    password = "testpass123"
    name = "Test Auth User"
    
    print(f"\n1. Creating user via signup endpoint...")
    signup_data = {
        'name': name,
        'email': email,
        'password': password
    }
    
    signup_response = make_request('POST', '/signup', data=signup_data)
    if not signup_response or signup_response.status_code != 200:
        print("❌ Failed to create user via signup")
        return False
    
    signup_result = signup_response.json()
    print(f"✅ User created: {signup_result.get('user', {}).get('email')}")
    
    # Test 2: Get CSRF token
    print("\n2. Getting CSRF token...")
    csrf_response = make_request('GET', '/auth/csrf')
    if not csrf_response or csrf_response.status_code != 200:
        print("❌ Failed to get CSRF token")
        return False
    
    csrf_data = csrf_response.json()
    csrf_token = csrf_data.get('csrfToken')
    print(f"✅ CSRF token: {csrf_token[:20]}...")
    
    # Test 3: Login
    print("\n3. Attempting login...")
    login_data = {
        'email': email,
        'password': password,
        'csrfToken': csrf_token,
        'callbackUrl': f"{BASE_URL.replace('/api', '')}/dashboard",
        'json': 'true'
    }
    
    login_response = make_request('POST', '/auth/callback/credentials', data=login_data)
    if not login_response or login_response.status_code != 200:
        print("❌ Login failed")
        return False
    
    print(f"Login response body: {login_response.text[:500]}")
    
    # Extract cookies
    cookies = {}
    for cookie in login_response.cookies:
        cookies[cookie.name] = cookie.value
        print(f"   Cookie: {cookie.name} = {cookie.value[:50]}...")
    
    if not cookies:
        print("❌ No cookies received")
        return False
    
    # Check if we got a session token
    session_cookies = [name for name in cookies.keys() if 'session' in name.lower()]
    if not session_cookies:
        print("⚠️ No session token found in cookies")
        # Try to get session via /auth/session
        print("   Trying to get session via /auth/session...")
        session_response = make_request('GET', '/auth/session', cookies=cookies)
        if session_response and session_response.status_code == 200:
            session_data = session_response.json()
            print(f"   Session data: {session_data}")
            if session_data.get('user'):
                print("✅ Session found via /auth/session")
            else:
                print("❌ No user in session")
                return False
        else:
            print("❌ Failed to get session")
            return False
    
    print("✅ Login successful")
    
    # Test 4: Test authenticated endpoint
    print("\n4. Testing authenticated endpoint...")
    me_response = make_request('GET', '/me', cookies=cookies)
    if not me_response or me_response.status_code != 200:
        print("❌ Authenticated request failed")
        return False
    
    me_data = me_response.json()
    print(f"✅ Authenticated request successful: {me_data.get('name')}")
    
    # Test 5: Test wishlist endpoint
    print("\n5. Testing wishlist endpoint...")
    wishlist_response = make_request('GET', '/wishlist', cookies=cookies)
    if not wishlist_response:
        print("❌ Wishlist request failed")
        return False
    
    print(f"   Wishlist response: {wishlist_response.status_code}")
    if wishlist_response.status_code == 200:
        wishlist_data = wishlist_response.json()
        print(f"✅ Wishlist request successful: {wishlist_data}")
    else:
        print(f"❌ Wishlist request failed: {wishlist_response.text[:200]}")
    
    return True

if __name__ == "__main__":
    success = test_auth()
    mongo_client.close()
    sys.exit(0 if success else 1)