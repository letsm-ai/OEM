#!/usr/bin/env python3
"""
Comprehensive backend testing with proper session handling
"""

import requests
import json
import time
import os
from datetime import datetime, timedelta
import pymongo
from pymongo import MongoClient

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://6f3dfdf5-cfdd-488c-a9a0-63f293d4ee0d.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'majles')

print(f"🔧 Testing against: {API_BASE}")

# MongoDB connection
try:
    mongo_client = MongoClient(MONGO_URL)
    db = mongo_client[DB_NAME]
    print("✅ MongoDB connection established")
except Exception as e:
    print(f"❌ MongoDB connection failed: {e}")
    db = None

def create_timestamped_email():
    """Generate unique timestamped email"""
    timestamp = int(time.time() * 1000)
    return f"test_{timestamp}@example.com"

def get_session_cookies(email, password):
    """Login and get session cookies using NextAuth"""
    try:
        # Create a session to maintain cookies
        session = requests.Session()
        
        # Get CSRF token
        csrf_response = session.get(f"{API_BASE}/auth/csrf", timeout=10)
        if csrf_response.status_code != 200:
            print(f"❌ CSRF failed: {csrf_response.status_code}")
            return None
        
        csrf_token = csrf_response.json().get('csrfToken')
        if not csrf_token:
            print("❌ No CSRF token")
            return None
        
        # Login with credentials
        login_data = {
            'email': email,
            'password': password,
            'csrfToken': csrf_token,
            'callbackUrl': f'{BASE_URL}/dashboard',
            'json': 'true'
        }
        
        login_response = session.post(f"{API_BASE}/auth/callback/credentials", data=login_data, timeout=10)
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.status_code}")
            return None
        
        # Return the session object which maintains cookies
        return session
        
    except Exception as e:
        print(f"❌ Session error: {e}")
        return None

def promote_user_to_gold(user_id):
    """Promote user to GOLD tier directly in database"""
    if not db:
        return False
    try:
        result = db.users.update_one(
            {'_id': user_id},
            {'$set': {'membershipTier': 'GOLD'}}
        )
        return result.modified_count > 0
    except Exception as e:
        print(f"❌ Failed to promote user to GOLD: {e}")
        return False

def set_expert_approved_and_add_availability(user_id):
    """Set expert status to APPROVED and add availability"""
    if not db:
        return False
    try:
        # Find expert by userId
        expert = db.experts.find_one({'userId': user_id})
        if not expert:
            print(f"❌ No expert found for user {user_id}")
            return False
        
        expert_id = expert['_id']
        
        # Update expert status to APPROVED
        db.experts.update_one(
            {'_id': expert_id},
            {'$set': {'status': 'APPROVED', 'isApproved': True}}
        )
        
        # Add availability for Sunday (dayOfWeek=0) 09:00-12:00
        db.availabilities.delete_many({'expertId': expert_id})  # Clear existing
        db.availabilities.insert_one({
            '_id': f"avail_{int(time.time())}",
            'expertId': expert_id,
            'dayOfWeek': 0,  # Sunday
            'startTime': '09:00',
            'endTime': '12:00'
        })
        
        print(f"✅ Expert {expert_id} approved and availability set")
        return expert_id
    except Exception as e:
        print(f"❌ Failed to set expert approved: {e}")
        return False

def run_comprehensive_tests():
    """Run comprehensive backend tests"""
    print("\n" + "="*60)
    print("🚀 COMPREHENSIVE BACKEND TESTS")
    print("="*60)
    
    results = []
    
    # A) REGRESSION TESTS
    print("\n📋 A) REGRESSION TESTS")
    print("-" * 30)
    
    # Test 1: Health check
    print("\n1️⃣ Testing API health check...")
    try:
        response = requests.get(f"{API_BASE}/", timeout=10)
        if response.status_code == 200 and response.json().get('message') == 'Majles API is running':
            print("✅ API health check passed")
            results.append("✅ GET /api/ → 200 'Majles API is running'")
        else:
            print(f"❌ Health check failed: {response.status_code}")
            results.append("❌ GET /api/ → Failed")
    except Exception as e:
        print(f"❌ Health check error: {e}")
        results.append("❌ GET /api/ → Error")
    
    # Test 2: Signup
    print("\n2️⃣ Testing user signup...")
    signup_email = create_timestamped_email()
    signup_password = "testpass123"
    user_id = None
    try:
        signup_data = {
            'name': 'Test User',
            'email': signup_email,
            'password': signup_password
        }
        response = requests.post(f"{API_BASE}/signup", json=signup_data, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('success') and data.get('user'):
                user_id = data['user']['id']
                print(f"✅ Signup successful, user ID: {user_id}")
                results.append("✅ POST /api/signup → 200 with user created")
            else:
                print(f"❌ Signup response invalid: {data}")
                results.append("❌ POST /api/signup → Invalid response")
        else:
            print(f"❌ Signup failed: {response.status_code}")
            results.append("❌ POST /api/signup → Failed")
    except Exception as e:
        print(f"❌ Signup error: {e}")
        results.append("❌ POST /api/signup → Error")
    
    # Test 3: NextAuth login
    print("\n3️⃣ Testing NextAuth login...")
    user_session = None
    try:
        user_session = get_session_cookies(signup_email, signup_password)
        if user_session:
            print("✅ NextAuth login successful, session obtained")
            results.append("✅ NextAuth credentials login → Session obtained")
        else:
            print("❌ NextAuth login failed")
            results.append("❌ NextAuth credentials login → Failed")
    except Exception as e:
        print(f"❌ NextAuth login error: {e}")
        results.append("❌ NextAuth credentials login → Error")
    
    # Test 4: Membership subscription
    print("\n4️⃣ Testing membership subscription...")
    try:
        if user_session:
            subscribe_data = {'tier': 'BASIC'}
            response = user_session.post(f"{API_BASE}/membership/subscribe", json=subscribe_data, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and data.get('user', {}).get('membershipTier') == 'BASIC':
                    print("✅ Membership subscription successful")
                    results.append("✅ POST /api/membership/subscribe → 200, user tier updated")
                else:
                    print(f"❌ Subscription response invalid: {data}")
                    results.append("❌ POST /api/membership/subscribe → Invalid response")
            else:
                print(f"❌ Subscription failed: {response.status_code}")
                results.append(f"❌ POST /api/membership/subscribe → {response.status_code}")
        else:
            print("❌ Skipping subscription test - no session")
            results.append("❌ POST /api/membership/subscribe → Skipped (no session)")
    except Exception as e:
        print(f"❌ Subscription error: {e}")
        results.append("❌ POST /api/membership/subscribe → Error")
    
    # Test 5: Company creation
    print("\n5️⃣ Testing company creation...")
    try:
        if user_session:
            company_data = {
                'nameAr': 'شركة اختبار',
                'sector': 'TECH',
                'description': 'شركة تقنية للاختبار'
            }
            response = user_session.post(f"{API_BASE}/companies", json=company_data, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and data.get('company'):
                    print("✅ Company creation successful")
                    results.append("✅ POST /api/companies → 200, company created")
                else:
                    print(f"❌ Company creation response invalid: {data}")
                    results.append("❌ POST /api/companies → Invalid response")
            else:
                print(f"❌ Company creation failed: {response.status_code}")
                results.append(f"❌ POST /api/companies → {response.status_code}")
        else:
            print("❌ Skipping company test - no session")
            results.append("❌ POST /api/companies → Skipped (no session)")
    except Exception as e:
        print(f"❌ Company creation error: {e}")
        results.append("❌ POST /api/companies → Error")
    
    # Test 6: Expert application
    print("\n6️⃣ Testing expert application...")
    try:
        if user_session and user_id:
            # Promote user to GOLD tier
            if promote_user_to_gold(user_id):
                print("✅ User promoted to GOLD tier")
                
                expert_data = {
                    'specialty': 'TECH',
                    'specialtyAr': 'تقنية المعلومات',
                    'bio': 'خبير في التقنية',
                    'experienceYears': 5,
                    'hourlyRate': 25
                }
                response = user_session.post(f"{API_BASE}/experts/apply", json=expert_data, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    if data.get('success') and data.get('expert'):
                        print("✅ Expert application successful")
                        results.append("✅ POST /api/experts/apply → 200, expert application created")
                    else:
                        print(f"❌ Expert application response invalid: {data}")
                        results.append("❌ POST /api/experts/apply → Invalid response")
                else:
                    print(f"❌ Expert application failed: {response.status_code}")
                    results.append(f"❌ POST /api/experts/apply → {response.status_code}")
            else:
                print("❌ Failed to promote user to GOLD")
                results.append("❌ POST /api/experts/apply → Failed (tier promotion)")
        else:
            print("❌ Skipping expert test - no session or user ID")
            results.append("❌ POST /api/experts/apply → Skipped (no session)")
    except Exception as e:
        print(f"❌ Expert application error: {e}")
        results.append("❌ POST /api/experts/apply → Error")
    
    # C) WEBHOOK TESTS
    print("\n🔗 C) WEBHOOK TESTS")
    print("-" * 30)
    
    # Test 10: Webhook without body
    print("\n🔟 Testing webhook without body...")
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
    
    # Test 11: Webhook with JSON body
    print("\n1️⃣1️⃣ Testing webhook with JSON body...")
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
    
    # Test 12: GET webhook (wrong method)
    print("\n1️⃣2️⃣ Testing GET webhook...")
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
    
    # E) EMAIL REGRESSION TESTS
    print("\n📬 E) EMAIL REGRESSION TESTS")
    print("-" * 30)
    
    # Test 14: Signup welcome email
    print("\n1️⃣4️⃣ Testing signup welcome email...")
    try:
        welcome_email = create_timestamped_email()
        welcome_signup = {
            'name': 'Welcome Test User',
            'email': welcome_email,
            'password': 'welcomepass123'
        }
        response = requests.post(f"{API_BASE}/signup", json=welcome_signup, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print("✅ Signup successful, welcome email attempted")
                results.append("✅ POST /api/signup → 200, welcome email attempted")
            else:
                print(f"❌ Signup response invalid: {data}")
                results.append("❌ POST /api/signup → Invalid response")
        else:
            print(f"❌ Signup failed: {response.status_code}")
            results.append(f"❌ POST /api/signup → {response.status_code}")
    except Exception as e:
        print(f"❌ Signup welcome email test error: {e}")
        results.append("❌ POST /api/signup → Error")
    
    # Test 15: Forgot password with unknown email
    print("\n1️⃣5️⃣ Testing forgot password with unknown email...")
    try:
        unknown_email = create_timestamped_email()
        forgot_data = {'email': unknown_email}
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
    
    # Test 16: Reset password with invalid token
    print("\n1️⃣6️⃣ Testing reset password with invalid token...")
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
    
    # SUMMARY
    print("\n" + "="*60)
    print("📊 TEST RESULTS SUMMARY")
    print("="*60)
    
    passed_tests = [result for result in results if result.startswith("✅")]
    failed_tests = [result for result in results if result.startswith("❌")]
    
    print(f"\n✅ PASSED: {len(passed_tests)}")
    for test in passed_tests:
        print(f"  {test}")
    
    print(f"\n❌ FAILED: {len(failed_tests)}")
    for test in failed_tests:
        print(f"  {test}")
    
    print(f"\n📈 TOTAL: {len(passed_tests)}/{len(results)} tests passed")
    
    return results

if __name__ == "__main__":
    try:
        results = run_comprehensive_tests()
        passed_count = len([r for r in results if r.startswith('✅')])
        total_count = len(results)
        print(f"\n🏁 Testing completed. Results: {passed_count}/{total_count} passed")
    except KeyboardInterrupt:
        print("\n⚠️ Testing interrupted by user")
    except Exception as e:
        print(f"\n💥 Testing failed with error: {e}")
    finally:
        if 'mongo_client' in locals():
            mongo_client.close()
            print("🔌 MongoDB connection closed")