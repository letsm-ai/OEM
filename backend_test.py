#!/usr/bin/env python3
"""
Backend test for Admin Analytics endpoint
Tests the GET /api/admin/analytics endpoint with comprehensive validation
"""

import requests
import json
import pymongo
import bcrypt
import uuid
from datetime import datetime, timedelta
import os
from urllib.parse import urljoin

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://omani-startup-hub.preview.emergentagent.com')
API_BASE = urljoin(BASE_URL, '/api')
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'majles')

print(f"🔧 Configuration:")
print(f"   BASE_URL: {BASE_URL}")
print(f"   API_BASE: {API_BASE}")
print(f"   MONGO_URL: {MONGO_URL}")
print(f"   DB_NAME: {DB_NAME}")

def generate_uuid():
    """Generate a UUID string"""
    return str(uuid.uuid4())

def hash_password(password):
    """Hash password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def get_mongo_client():
    """Get MongoDB client"""
    return pymongo.MongoClient(MONGO_URL)

def create_test_user(client, name, email, password, role='MEMBER', tier='FREE'):
    """Create a test user in MongoDB"""
    db = client[DB_NAME]
    user_id = generate_uuid()
    hashed_pw = hash_password(password)
    
    user_doc = {
        '_id': user_id,
        'name': name,
        'email': email.lower(),
        'password': hashed_pw,
        'role': role,
        'membershipTier': tier,
        'membershipExpiry': None,
        'phone': '',
        'photo': '',
        'createdAt': datetime.utcnow()
    }
    
    db.users.insert_one(user_doc)
    return user_id

def login_user(email, password):
    """Login user via NextAuth credentials and return session cookies"""
    # First get CSRF token
    csrf_response = requests.get(f"{API_BASE}/auth/csrf")
    if csrf_response.status_code != 200:
        raise Exception(f"Failed to get CSRF token: {csrf_response.status_code}")
    
    csrf_token = csrf_response.json().get('csrfToken')
    if not csrf_token:
        raise Exception("No CSRF token in response")
    
    # Login with credentials
    login_data = {
        'email': email,
        'password': password,
        'csrfToken': csrf_token,
        'callbackUrl': f"{BASE_URL}/dashboard",
        'json': 'true'
    }
    
    login_response = requests.post(
        f"{API_BASE}/auth/callback/credentials",
        data=login_data,
        cookies=csrf_response.cookies,
        allow_redirects=False
    )
    
    if login_response.status_code not in [200, 302]:
        raise Exception(f"Login failed: {login_response.status_code}")
    
    # Extract session cookies
    session_cookies = {}
    for cookie in login_response.cookies:
        if 'session-token' in cookie.name or 'next-auth' in cookie.name:
            session_cookies[cookie.name] = cookie.value
    
    return session_cookies

def test_admin_analytics():
    """Test the Admin Analytics endpoint comprehensively"""
    print("\n🧪 TESTING ADMIN ANALYTICS ENDPOINT")
    print("=" * 60)
    
    client = get_mongo_client()
    
    try:
        # Test 1: No session → 401
        print("\n📋 TEST 1: No session authentication")
        response = requests.get(f"{API_BASE}/admin/analytics")
        print(f"   Status: {response.status_code}")
        if response.status_code == 401:
            data = response.json()
            if data.get('error') == 'غير مصرح':
                print("   ✅ Correct 401 response with Arabic error")
            else:
                print(f"   ❌ Wrong error message: {data.get('error')}")
        else:
            print(f"   ❌ Expected 401, got {response.status_code}")
        
        # Test 2: Create MEMBER user and test 403
        print("\n📋 TEST 2: Non-admin user (MEMBER) → 403")
        member_email = f"member-{generate_uuid()[:8]}@test.com"
        member_password = "testpass123"
        member_id = create_test_user(client, "عضو تجريبي", member_email, member_password, "MEMBER")
        
        member_cookies = login_user(member_email, member_password)
        response = requests.get(f"{API_BASE}/admin/analytics", cookies=member_cookies)
        print(f"   Status: {response.status_code}")
        if response.status_code == 403:
            data = response.json()
            if data.get('error') == 'صلاحيات مسؤول مطلوبة':
                print("   ✅ Correct 403 response with Arabic error")
            else:
                print(f"   ❌ Wrong error message: {data.get('error')}")
        else:
            print(f"   ❌ Expected 403, got {response.status_code}")
        
        # Test 3: Create ADMIN user and test successful response
        print("\n📋 TEST 3: Admin user → 200 with analytics payload")
        admin_email = f"admin-{generate_uuid()[:8]}@test.com"
        admin_password = "adminpass123"
        admin_id = create_test_user(client, "مسؤول تجريبي", admin_email, admin_password, "ADMIN")
        
        admin_cookies = login_user(admin_email, admin_password)
        response = requests.get(f"{API_BASE}/admin/analytics", cookies=admin_cookies)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            print("   ✅ Successful 200 response")
            data = response.json()
            
            # Validate payload structure
            print("\n🔍 PAYLOAD STRUCTURE VALIDATION:")
            
            # Check generatedAt
            if 'generatedAt' in data and isinstance(data['generatedAt'], str):
                print("   ✅ generatedAt: ISO8601 string present")
            else:
                print("   ❌ generatedAt: Missing or not string")
            
            # Check users object
            if 'users' in data:
                users = data['users']
                required_user_fields = ['total', 'last30Days', 'byRole', 'byTier']
                missing_fields = [f for f in required_user_fields if f not in users]
                if not missing_fields:
                    print("   ✅ users: All required fields present")
                    
                    # Validate types
                    if isinstance(users['total'], int) and users['total'] >= 1:
                        print(f"   ✅ users.total: {users['total']} (>= 1, includes admin)")
                    else:
                        print(f"   ❌ users.total: {users['total']} (should be >= 1)")
                    
                    if isinstance(users['byRole'], dict) and users['byRole'].get('ADMIN', 0) >= 1:
                        print(f"   ✅ users.byRole.ADMIN: {users['byRole'].get('ADMIN')} (>= 1)")
                    else:
                        print(f"   ❌ users.byRole.ADMIN: {users['byRole'].get('ADMIN')} (should be >= 1)")
                        
                else:
                    print(f"   ❌ users: Missing fields {missing_fields}")
            else:
                print("   ❌ users: Object missing")
            
            # Check memberships object
            if 'memberships' in data:
                memberships = data['memberships']
                required_membership_fields = ['totalSold', 'totalRevenue', 'byTier']
                missing_fields = [f for f in required_membership_fields if f not in memberships]
                if not missing_fields:
                    print("   ✅ memberships: All required fields present")
                    
                    if isinstance(memberships['totalSold'], int):
                        print(f"   ✅ memberships.totalSold: {memberships['totalSold']} (numeric)")
                    else:
                        print(f"   ❌ memberships.totalSold: {memberships['totalSold']} (not numeric)")
                        
                    if isinstance(memberships['totalRevenue'], (int, float)):
                        print(f"   ✅ memberships.totalRevenue: {memberships['totalRevenue']} (numeric)")
                    else:
                        print(f"   ❌ memberships.totalRevenue: {memberships['totalRevenue']} (not numeric)")
                        
                else:
                    print(f"   ❌ memberships: Missing fields {missing_fields}")
            else:
                print("   ❌ memberships: Object missing")
            
            # Check consultations object
            if 'consultations' in data:
                consultations = data['consultations']
                required_consultation_fields = ['completedCount', 'completedRevenue', 'confirmedCount', 'confirmedRevenue', 'totalRevenue']
                missing_fields = [f for f in required_consultation_fields if f not in consultations]
                if not missing_fields:
                    print("   ✅ consultations: All required fields present")
                    
                    # Validate totalRevenue calculation
                    completed_rev = consultations['completedRevenue']
                    confirmed_rev = consultations['confirmedRevenue']
                    total_rev = consultations['totalRevenue']
                    expected_total = round(completed_rev + confirmed_rev, 2)
                    
                    if abs(total_rev - expected_total) < 0.01:
                        print(f"   ✅ consultations.totalRevenue: {total_rev} = {completed_rev} + {confirmed_rev}")
                    else:
                        print(f"   ❌ consultations.totalRevenue: {total_rev} ≠ {expected_total}")
                        
                else:
                    print(f"   ❌ consultations: Missing fields {missing_fields}")
            else:
                print("   ❌ consultations: Object missing")
            
            # Check pending object
            if 'pending' in data:
                pending = data['pending']
                if 'companies' in pending and 'experts' in pending:
                    print(f"   ✅ pending: companies={pending['companies']}, experts={pending['experts']}")
                else:
                    print("   ❌ pending: Missing companies or experts fields")
            else:
                print("   ❌ pending: Object missing")
            
            # Check monthly array
            if 'monthly' in data:
                monthly = data['monthly']
                if isinstance(monthly, list) and len(monthly) == 12:
                    print(f"   ✅ monthly: Array with exactly 12 entries")
                    
                    # Check last entry has current year/month
                    last_entry = monthly[-1]
                    current_utc = datetime.utcnow()
                    if (last_entry.get('year') == current_utc.year and 
                        last_entry.get('month') == current_utc.month):
                        print(f"   ✅ monthly: Last entry is current month ({current_utc.year}-{current_utc.month:02d})")
                    else:
                        print(f"   ❌ monthly: Last entry {last_entry.get('year')}-{last_entry.get('month'):02d} ≠ current {current_utc.year}-{current_utc.month:02d}")
                        
                    # Check required fields in monthly entries
                    required_monthly_fields = ['key', 'year', 'month', 'signups', 'memberships', 'membershipRevenue', 'consultationRevenue', 'consultationBookings']
                    for i, entry in enumerate(monthly):
                        missing = [f for f in required_monthly_fields if f not in entry]
                        if missing:
                            print(f"   ❌ monthly[{i}]: Missing fields {missing}")
                            break
                    else:
                        print("   ✅ monthly: All entries have required fields")
                        
                else:
                    print(f"   ❌ monthly: Expected array of 12, got {type(monthly)} with length {len(monthly) if isinstance(monthly, list) else 'N/A'}")
            else:
                print("   ❌ monthly: Array missing")
            
            # Check topExperts array
            if 'topExperts' in data:
                top_experts = data['topExperts']
                if isinstance(top_experts, list) and len(top_experts) <= 5:
                    print(f"   ✅ topExperts: Array with {len(top_experts)} entries (≤ 5)")
                    
                    if top_experts:
                        required_expert_fields = ['id', 'name', 'specialty', 'specialtyAr', 'rating', 'totalSessions', 'hourlyRate']
                        first_expert = top_experts[0]
                        missing = [f for f in required_expert_fields if f not in first_expert]
                        if not missing:
                            print("   ✅ topExperts: Entries have required fields")
                        else:
                            print(f"   ❌ topExperts: Missing fields {missing}")
                else:
                    print(f"   ❌ topExperts: Expected array ≤ 5, got {type(top_experts)} with length {len(top_experts) if isinstance(top_experts, list) else 'N/A'}")
            else:
                print("   ❌ topExperts: Array missing")
                
        else:
            print(f"   ❌ Expected 200, got {response.status_code}")
            if response.content:
                print(f"   Response: {response.text}")
        
        # Test 4: Data sensitivity test - seed data and verify counters
        print("\n📋 TEST 4: Data sensitivity test")
        print("   🌱 Seeding test data...")
        
        db = client[DB_NAME]
        now = datetime.utcnow()
        yesterday = now - timedelta(days=1)
        tomorrow = now + timedelta(days=2)
        
        # Create an expert for appointments
        expert_id = generate_uuid()
        expert_user_id = create_test_user(client, "د. خبير تجريبي", f"expert-{generate_uuid()[:8]}@test.com", "expertpass123", "EXPERT")
        
        expert_doc = {
            '_id': expert_id,
            'userId': expert_user_id,
            'specialty': 'LEGAL',
            'specialtyAr': 'استشارات قانونية',
            'bio': 'خبير قانوني تجريبي',
            'experienceYears': 5,
            'hourlyRate': 25,
            'photo': '',
            'cv': '',
            'status': 'APPROVED',
            'rejectionReason': None,
            'isApproved': True,
            'rating': 0,
            'totalSessions': 0,
            'createdAt': now,
            'updatedAt': now
        }
        db.experts.insert_one(expert_doc)
        
        # Seed 1: Membership
        membership_id = generate_uuid()
        membership_doc = {
            '_id': membership_id,
            'userId': admin_id,  # Use admin user
            'tier': 'BASIC',
            'startDate': now,
            'endDate': now + timedelta(days=365),
            'amountPaid': 50,
            'paymentStatus': 'PAID'
        }
        db.memberships.insert_one(membership_doc)
        
        # Seed 2: Completed appointment
        completed_appt_id = generate_uuid()
        completed_appt_doc = {
            '_id': completed_appt_id,
            'clientId': member_id,
            'expertId': expert_id,
            'date': yesterday.replace(hour=0, minute=0, second=0, microsecond=0),
            'startTime': '09:00',
            'endTime': '10:00',
            'status': 'COMPLETED',
            'totalPaid': 25,
            'originalPrice': 25,
            'discountPercent': 0,
            'notes': '',
            'cancelledAt': None,
            'cancelledBy': None,
            'reminderSentAt': None,
            'rating': None,
            'reviewComment': '',
            'reviewedAt': None,
            'createdAt': now
        }
        db.appointments.insert_one(completed_appt_doc)
        
        # Seed 3: Confirmed appointment
        confirmed_appt_id = generate_uuid()
        confirmed_appt_doc = {
            '_id': confirmed_appt_id,
            'clientId': member_id,
            'expertId': expert_id,
            'date': tomorrow.replace(hour=0, minute=0, second=0, microsecond=0),
            'startTime': '10:00',
            'endTime': '11:00',
            'status': 'CONFIRMED',
            'totalPaid': 22.5,
            'originalPrice': 25,
            'discountPercent': 10,
            'notes': '',
            'cancelledAt': None,
            'cancelledBy': None,
            'reminderSentAt': None,
            'rating': None,
            'reviewComment': '',
            'reviewedAt': None,
            'createdAt': now
        }
        db.appointments.insert_one(confirmed_appt_doc)
        
        # Seed 4: Pending company
        company_id = generate_uuid()
        company_doc = {
            '_id': company_id,
            'userId': member_id,
            'nameAr': 'شركة تجريبية',
            'nameEn': 'Test Company',
            'sector': 'TECH',
            'description': 'شركة تجريبية للاختبار',
            'services': ['تطوير البرمجيات'],
            'logo': '',
            'phone': '+968 9123 4567',
            'email': 'test@company.com',
            'website': 'https://test.com',
            'location': 'مسقط',
            'governorate': 'MUSCAT',
            'status': 'PENDING',
            'rejectionReason': None,
            'isApproved': False,
            'createdAt': now,
            'updatedAt': now
        }
        db.companies.insert_one(company_doc)
        
        print("   ✅ Test data seeded successfully")
        
        # Get analytics again and verify increases
        print("   📊 Fetching analytics after seeding...")
        response = requests.get(f"{API_BASE}/admin/analytics", cookies=admin_cookies)
        
        if response.status_code == 200:
            new_data = response.json()
            print("   ✅ Analytics fetched successfully")
            
            # Verify membership increases
            new_memberships = new_data.get('memberships', {})
            if new_memberships.get('totalSold', 0) >= 1:
                print(f"   ✅ memberships.totalSold increased: {new_memberships.get('totalSold')}")
            else:
                print(f"   ❌ memberships.totalSold not increased: {new_memberships.get('totalSold')}")
                
            if new_memberships.get('totalRevenue', 0) >= 50:
                print(f"   ✅ memberships.totalRevenue increased: {new_memberships.get('totalRevenue')}")
            else:
                print(f"   ❌ memberships.totalRevenue not increased: {new_memberships.get('totalRevenue')}")
            
            # Verify consultation increases
            new_consultations = new_data.get('consultations', {})
            if new_consultations.get('completedRevenue', 0) >= 25:
                print(f"   ✅ consultations.completedRevenue increased: {new_consultations.get('completedRevenue')}")
            else:
                print(f"   ❌ consultations.completedRevenue not increased: {new_consultations.get('completedRevenue')}")
                
            if new_consultations.get('confirmedRevenue', 0) >= 22.5:
                print(f"   ✅ consultations.confirmedRevenue increased: {new_consultations.get('confirmedRevenue')}")
            else:
                print(f"   ❌ consultations.confirmedRevenue not increased: {new_consultations.get('confirmedRevenue')}")
                
            if new_consultations.get('totalRevenue', 0) >= 47.5:
                print(f"   ✅ consultations.totalRevenue increased: {new_consultations.get('totalRevenue')}")
            else:
                print(f"   ❌ consultations.totalRevenue not increased: {new_consultations.get('totalRevenue')}")
            
            # Verify pending increases
            new_pending = new_data.get('pending', {})
            if new_pending.get('companies', 0) >= 1:
                print(f"   ✅ pending.companies increased: {new_pending.get('companies')}")
            else:
                print(f"   ❌ pending.companies not increased: {new_pending.get('companies')}")
            
            # Verify monthly data includes current month revenue
            monthly = new_data.get('monthly', [])
            if monthly:
                last_month = monthly[-1]
                if last_month.get('membershipRevenue', 0) >= 50:
                    print(f"   ✅ monthly membershipRevenue increased: {last_month.get('membershipRevenue')}")
                else:
                    print(f"   ❌ monthly membershipRevenue not increased: {last_month.get('membershipRevenue')}")
                    
                if last_month.get('consultationRevenue', 0) >= 47.5:
                    print(f"   ✅ monthly consultationRevenue increased: {last_month.get('consultationRevenue')}")
                else:
                    print(f"   ❌ monthly consultationRevenue not increased: {last_month.get('consultationRevenue')}")
        else:
            print(f"   ❌ Failed to fetch analytics after seeding: {response.status_code}")
        
        # Test 5: Regression tests
        print("\n📋 TEST 5: Regression tests")
        
        # Test basic API health
        health_response = requests.get(f"{API_BASE}/")
        if health_response.status_code == 200 and health_response.json().get('message') == 'Majles API is running':
            print("   ✅ GET /api/ → 200 'Majles API is running'")
        else:
            print(f"   ❌ GET /api/ failed: {health_response.status_code}")
        
        # Test /me endpoint with admin session
        me_response = requests.get(f"{API_BASE}/me", cookies=admin_cookies)
        if me_response.status_code == 200:
            me_data = me_response.json()
            if me_data.get('role') == 'ADMIN':
                print("   ✅ GET /api/me with admin session → 200 with role=ADMIN")
            else:
                print(f"   ❌ GET /api/me wrong role: {me_data.get('role')}")
        else:
            print(f"   ❌ GET /api/me failed: {me_response.status_code}")
        
        # Test signup endpoint
        signup_email = f"signup-test-{generate_uuid()[:8]}@test.com"
        signup_data = {
            'name': 'مستخدم تجريبي جديد',
            'email': signup_email,
            'password': 'newpass123'
        }
        signup_response = requests.post(f"{API_BASE}/signup", json=signup_data)
        if signup_response.status_code == 200:
            signup_result = signup_response.json()
            if signup_result.get('success') and signup_result.get('user'):
                print("   ✅ POST /api/signup → 200 with new user")
            else:
                print(f"   ❌ POST /api/signup wrong response: {signup_result}")
        else:
            print(f"   ❌ POST /api/signup failed: {signup_response.status_code}")
        
        print("\n🎉 ADMIN ANALYTICS TESTING COMPLETE")
        
    except Exception as e:
        print(f"\n❌ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        client.close()

if __name__ == "__main__":
    test_admin_analytics()