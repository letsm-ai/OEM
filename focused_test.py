#!/usr/bin/env python3
"""
Focused backend testing for critical endpoints
"""

import requests
import json
import time
import os

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://6f3dfdf5-cfdd-488c-a9a0-63f293d4ee0d.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

print(f"🔧 Testing against: {API_BASE}")

def test_basic_endpoints():
    """Test basic endpoints that should work"""
    results = []
    
    # Test 1: Health check
    print("\n1️⃣ Testing API health check...")
    try:
        response = requests.get(f"{API_BASE}/", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('message') == 'Majles API is running':
                print("✅ API health check passed")
                results.append("✅ GET /api/ → 200 'Majles API is running'")
            else:
                print(f"❌ Wrong message: {data}")
                results.append("❌ GET /api/ → Wrong message")
        else:
            print(f"❌ Status: {response.status_code}")
            results.append(f"❌ GET /api/ → {response.status_code}")
    except Exception as e:
        print(f"❌ Error: {e}")
        results.append("❌ GET /api/ → Error")
    
    # Test 2: Signup
    print("\n2️⃣ Testing signup...")
    try:
        timestamp = int(time.time() * 1000)
        signup_data = {
            'name': 'Test User',
            'email': f'test_{timestamp}@example.com',
            'password': 'testpass123'
        }
        response = requests.post(f"{API_BASE}/signup", json=signup_data, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print("✅ Signup successful")
                results.append("✅ POST /api/signup → 200 with user created")
                return data['user']['id'], signup_data['email'], signup_data['password']
            else:
                print(f"❌ Invalid response: {data}")
                results.append("❌ POST /api/signup → Invalid response")
        else:
            print(f"❌ Status: {response.status_code}")
            results.append(f"❌ POST /api/signup → {response.status_code}")
    except Exception as e:
        print(f"❌ Error: {e}")
        results.append("❌ POST /api/signup → Error")
    
    return None, None, None

def test_webhook_endpoints():
    """Test webhook endpoints"""
    results = []
    
    # Test webhook without body
    print("\n3️⃣ Testing webhook without body...")
    try:
        response = requests.post(f"{API_BASE}/payments/webhook", timeout=10)
        if response.status_code == 400:
            data = response.json()
            if data.get('received') == False:
                print("✅ Webhook without body returns 400 with received:false")
                results.append("✅ POST /api/payments/webhook (no body) → 400 {received:false}")
            else:
                print(f"❌ Wrong response: {data}")
                results.append("❌ POST /api/payments/webhook (no body) → Wrong response")
        else:
            print(f"❌ Status: {response.status_code}")
            results.append(f"❌ POST /api/payments/webhook (no body) → {response.status_code}")
    except Exception as e:
        print(f"❌ Error: {e}")
        results.append("❌ POST /api/payments/webhook (no body) → Error")
    
    # Test webhook with JSON body
    print("\n4️⃣ Testing webhook with JSON body...")
    try:
        webhook_data = {'test': 'data', 'sessionId': 'test123'}
        response = requests.post(f"{API_BASE}/payments/webhook", json=webhook_data, timeout=10)
        if response.status_code == 400:
            data = response.json()
            if data.get('received') == False:
                print("✅ Webhook with JSON body returns 400 with received:false")
                results.append("✅ POST /api/payments/webhook (JSON body) → 400 {received:false}")
            else:
                print(f"❌ Wrong response: {data}")
                results.append("❌ POST /api/payments/webhook (JSON body) → Wrong response")
        else:
            print(f"❌ Status: {response.status_code}")
            results.append(f"❌ POST /api/payments/webhook (JSON body) → {response.status_code}")
    except Exception as e:
        print(f"❌ Error: {e}")
        results.append("❌ POST /api/payments/webhook (JSON body) → Error")
    
    # Test GET webhook (wrong method)
    print("\n5️⃣ Testing GET webhook...")
    try:
        response = requests.get(f"{API_BASE}/payments/webhook", timeout=10)
        if response.status_code in [404, 405]:
            print(f"✅ GET webhook returns {response.status_code} (wrong method)")
            results.append(f"✅ GET /api/payments/webhook → {response.status_code} (wrong method)")
        else:
            print(f"❌ Status: {response.status_code}")
            results.append(f"❌ GET /api/payments/webhook → {response.status_code}")
    except Exception as e:
        print(f"❌ Error: {e}")
        results.append("❌ GET /api/payments/webhook → Error")
    
    return results

def test_password_reset():
    """Test password reset endpoints"""
    results = []
    
    # Test forgot password with unknown email
    print("\n6️⃣ Testing forgot password...")
    try:
        timestamp = int(time.time() * 1000)
        forgot_data = {'email': f'unknown_{timestamp}@example.com'}
        response = requests.post(f"{API_BASE}/forgot-password", json=forgot_data, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('success') and 'إذا كان' in data.get('message', ''):
                print("✅ Forgot password returns anti-enumeration message")
                results.append("✅ POST /api/forgot-password (unknown email) → 200 anti-enumeration")
            else:
                print(f"❌ Wrong response: {data}")
                results.append("❌ POST /api/forgot-password (unknown email) → Wrong response")
        else:
            print(f"❌ Status: {response.status_code}")
            results.append(f"❌ POST /api/forgot-password (unknown email) → {response.status_code}")
    except Exception as e:
        print(f"❌ Error: {e}")
        results.append("❌ POST /api/forgot-password (unknown email) → Error")
    
    # Test reset password with invalid token
    print("\n7️⃣ Testing reset password with invalid token...")
    try:
        reset_data = {
            'token': 'invalid_token_12345',
            'password': 'newpassword123'
        }
        response = requests.post(f"{API_BASE}/reset-password", json=reset_data, timeout=10)
        if response.status_code == 400:
            data = response.json()
            if 'غير صالح' in data.get('error', ''):
                print("✅ Reset password with invalid token returns 400 with Arabic error")
                results.append("✅ POST /api/reset-password (invalid token) → 400 Arabic error")
            else:
                print(f"❌ Wrong response: {data}")
                results.append("❌ POST /api/reset-password (invalid token) → Wrong response")
        else:
            print(f"❌ Status: {response.status_code}")
            results.append(f"❌ POST /api/reset-password (invalid token) → {response.status_code}")
    except Exception as e:
        print(f"❌ Error: {e}")
        results.append("❌ POST /api/reset-password (invalid token) → Error")
    
    return results

if __name__ == "__main__":
    print("🚀 FOCUSED BACKEND TESTING")
    print("=" * 40)
    
    all_results = []
    
    # Basic tests
    user_id, email, password = test_basic_endpoints()
    
    # Webhook tests
    webhook_results = test_webhook_endpoints()
    all_results.extend(webhook_results)
    
    # Password reset tests
    password_results = test_password_reset()
    all_results.extend(password_results)
    
    # Summary
    print("\n" + "="*40)
    print("📊 SUMMARY")
    print("="*40)
    
    passed = [r for r in all_results if r.startswith("✅")]
    failed = [r for r in all_results if r.startswith("❌")]
    
    print(f"\n✅ PASSED: {len(passed)}")
    for test in passed:
        print(f"  {test}")
    
    print(f"\n❌ FAILED: {len(failed)}")
    for test in failed:
        print(f"  {test}")
    
    print(f"\n📈 TOTAL: {len(passed)}/{len(all_results)} tests passed")