#!/usr/bin/env python3
"""
Comprehensive backend test for Phase A refactoring verification.
Tests all endpoints from the extracted modules:
- /app/lib/api/membership.js
- /app/lib/api/companies.js  
- /app/lib/api/experts.js

Goal: Verify functional parity - no behavior should have changed by the extraction.
"""

import requests
import json
import time
import uuid
from datetime import datetime, timedelta
import pymongo
import bcrypt
import os

# Configuration
BASE_URL = "https://omani-startup-hub.preview.emergentagent.com/api"
MONGO_URL = "mongodb://localhost:27017/majles"

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'Backend-Test/1.0'
        })
        
        # Connect to MongoDB for direct operations
        self.mongo_client = pymongo.MongoClient(MONGO_URL)
        self.db = self.mongo_client.majles
        
        # Test data storage
        self.test_users = {}
        self.test_companies = {}
        self.test_experts = {}
        self.test_appointments = {}
        
        # Test results
        self.results = {
            'membership': {'passed': 0, 'failed': 0, 'tests': []},
            'companies': {'passed': 0, 'failed': 0, 'tests': []},
            'experts': {'passed': 0, 'failed': 0, 'tests': []},
            'total_passed': 0,
            'total_failed': 0
        }

    def log_test(self, category, test_name, passed, details=""):
        """Log test result"""
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   {details}")
        
        self.results[category]['tests'].append({
            'name': test_name,
            'passed': passed,
            'details': details
        })
        
        if passed:
            self.results[category]['passed'] += 1
            self.results['total_passed'] += 1
        else:
            self.results[category]['failed'] += 1
            self.results['total_failed'] += 1

    def create_test_user(self, role="MEMBER", tier="FREE", email_suffix=""):
        """Create a test user with fresh timestamped email"""
        timestamp = int(time.time())
        email = f"refactor_{role.lower()}_{timestamp}{email_suffix}@x.com"
        password = "Password123"
        
        # Create user via signup endpoint
        signup_data = {
            "name": f"Test {role} User",
            "email": email,
            "password": password
        }
        
        response = self.session.post(f"{BASE_URL}/signup", json=signup_data)
        if response.status_code != 200:
            print(f"Failed to create user: {response.text}")
            return None
            
        user_data = response.json()
        user_id = user_data['user']['id']
        
        # Update role and tier via MongoDB if needed
        if role != "MEMBER" or tier != "FREE":
            self.db.users.update_one(
                {"_id": user_id},
                {"$set": {"role": role, "membershipTier": tier}}
            )
        
        user_info = {
            'id': user_id,
            'email': email,
            'password': password,
            'role': role,
            'tier': tier
        }
        
        self.test_users[f"{role}_{tier}"] = user_info
        return user_info

    def login_user(self, user_info):
        """Login user and get session"""
        # Get CSRF token
        csrf_response = self.session.get(f"{BASE_URL}/auth/csrf")
        if csrf_response.status_code != 200:
            return False
            
        csrf_token = csrf_response.json().get('csrfToken')
        
        # Login with credentials
        login_data = {
            'email': user_info['email'],
            'password': user_info['password'],
            'csrfToken': csrf_token,
            'callbackUrl': '/',
            'json': 'true'
        }
        
        login_response = self.session.post(
            f"{BASE_URL}/auth/callback/credentials",
            data=login_data,
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )
        
        # Verify session by calling /me
        me_response = self.session.get(f"{BASE_URL}/me")
        return me_response.status_code == 200

    def test_membership_endpoints(self):
        """Test all membership endpoints from membership.js"""
        print("\n🧪 TESTING MEMBERSHIP ENDPOINTS")
        print("=" * 50)
        
        # Create test users
        basic_user = self.create_test_user("MEMBER", "FREE", "_basic")
        if not basic_user:
            self.log_test('membership', 'User creation', False, "Failed to create basic user")
            return
            
        # Test 1: POST /membership/subscribe - No auth
        response = self.session.post(f"{BASE_URL}/membership/subscribe", json={"tier": "BASIC"})
        self.log_test('membership', 'Subscribe without auth → 401', 
                     response.status_code == 401 and 'غير مصرح' in response.text)
        
        # Login user
        if not self.login_user(basic_user):
            self.log_test('membership', 'User login', False, "Failed to login user")
            return
            
        # Test 2: POST /membership/subscribe - Invalid tier
        response = self.session.post(f"{BASE_URL}/membership/subscribe", json={"tier": "INVALID"})
        self.log_test('membership', 'Subscribe invalid tier → 400', 
                     response.status_code == 400 and 'باقة غير صحيحة' in response.text)
        
        # Test 3: POST /membership/subscribe - FREE tier
        response = self.session.post(f"{BASE_URL}/membership/subscribe", json={"tier": "FREE"})
        self.log_test('membership', 'Subscribe FREE tier → 400', 
                     response.status_code == 400 and 'الباقة المجانية مفعلة تلقائياً' in response.text)
        
        # Test 4: POST /membership/subscribe - Valid BASIC subscription
        response = self.session.post(f"{BASE_URL}/membership/subscribe", json={"tier": "BASIC"})
        success = response.status_code == 200
        if success:
            data = response.json()
            success = (data.get('success') and 
                      data.get('membership', {}).get('tier') == 'BASIC' and
                      data.get('membership', {}).get('amountPaid') == 50)
        self.log_test('membership', 'Subscribe BASIC tier → 200', success)
        
        # Test 5: GET /membership/history - No auth (logout first)
        self.session.cookies.clear()
        response = self.session.get(f"{BASE_URL}/membership/history")
        self.log_test('membership', 'History without auth → 401', 
                     response.status_code == 401)
        
        # Login again
        self.login_user(basic_user)
        
        # Test 6: GET /membership/history - With auth
        response = self.session.get(f"{BASE_URL}/membership/history")
        success = response.status_code == 200
        if success:
            data = response.json()
            success = 'history' in data and len(data['history']) >= 1
        self.log_test('membership', 'History with auth → 200', success)
        
        # Test 7: POST /membership/discount - Invalid price
        response = self.session.post(f"{BASE_URL}/membership/discount", json={"price": "invalid"})
        self.log_test('membership', 'Discount invalid price → 400', 
                     response.status_code == 400 and 'السعر غير صحيح' in response.text)
        
        # Test 8: POST /membership/discount - Valid price with BASIC tier
        response = self.session.post(f"{BASE_URL}/membership/discount", json={"price": 100})
        success = response.status_code == 200
        if success:
            data = response.json()
            success = (data.get('tier') == 'BASIC' and 
                      data.get('discountPercent') == 10 and
                      data.get('finalPrice') == 90)
        self.log_test('membership', 'Discount with BASIC tier → 200', success)
        
        # Test 9: POST /membership/discount - No session (should use FREE tier)
        self.session.cookies.clear()
        response = self.session.post(f"{BASE_URL}/membership/discount", json={"price": 100})
        success = response.status_code == 200
        if success:
            data = response.json()
            success = (data.get('tier') == 'FREE' and 
                      data.get('discountPercent') == 0 and
                      data.get('finalPrice') == 100)
        self.log_test('membership', 'Discount without session → FREE tier', success)

    def test_companies_endpoints(self):
        """Test all companies endpoints from companies.js"""
        print("\n🧪 TESTING COMPANIES ENDPOINTS")
        print("=" * 50)
        
        # Create test users
        basic_user = self.create_test_user("MEMBER", "BASIC", "_comp")
        admin_user = self.create_test_user("ADMIN", "FREE", "_admin")
        
        # Test 1: GET /companies (public)
        response = self.session.get(f"{BASE_URL}/companies")
        success = response.status_code == 200 and 'companies' in response.json()
        self.log_test('companies', 'Public companies list → 200', success)
        
        # Test 2: POST /companies - No auth
        company_data = {
            "nameAr": "شركة اختبار",
            "sector": "TECH",
            "description": "شركة للاختبار"
        }
        response = self.session.post(f"{BASE_URL}/companies", json=company_data)
        self.log_test('companies', 'Create company without auth → 401', 
                     response.status_code == 401)
        
        # Login BASIC user
        self.login_user(basic_user)
        
        # Test 3: POST /companies - Missing required fields
        response = self.session.post(f"{BASE_URL}/companies", json={"nameAr": "test"})
        self.log_test('companies', 'Create company missing sector → 400', 
                     response.status_code == 400 and 'القطاع مطلوبان' in response.text)
        
        # Test 4: POST /companies - Invalid sector
        invalid_data = company_data.copy()
        invalid_data["sector"] = "INVALID"
        response = self.session.post(f"{BASE_URL}/companies", json=invalid_data)
        self.log_test('companies', 'Create company invalid sector → 400', 
                     response.status_code == 400 and 'القطاع غير صحيح' in response.text)
        
        # Test 5: POST /companies - Valid creation
        response = self.session.post(f"{BASE_URL}/companies", json=company_data)
        success = response.status_code == 200
        company_id = None
        if success:
            data = response.json()
            success = (data.get('success') and 
                      data.get('company', {}).get('status') == 'PENDING')
            company_id = data.get('company', {}).get('id')
        self.log_test('companies', 'Create company valid → 200', success)
        
        if company_id:
            self.test_companies[basic_user['id']] = company_id
            
            # Test 6: GET /companies/:id - PENDING company without auth
            self.session.cookies.clear()
            response = self.session.get(f"{BASE_URL}/companies/{company_id}")
            self.log_test('companies', 'Get PENDING company without auth → 404', 
                         response.status_code == 404)
            
            # Test 7: GET /companies/:id - Owner can access PENDING
            self.login_user(basic_user)
            response = self.session.get(f"{BASE_URL}/companies/{company_id}")
            self.log_test('companies', 'Owner access PENDING company → 200', 
                         response.status_code == 200)
            
            # Test 8: PUT /companies/:id - Update by owner
            update_data = {"description": "Updated description"}
            response = self.session.put(f"{BASE_URL}/companies/{company_id}", json=update_data)
            success = response.status_code == 200
            if success:
                data = response.json()
                success = data.get('company', {}).get('status') == 'PENDING'  # Should reset to PENDING
            self.log_test('companies', 'Update company by owner → 200', success)
            
            # Test 9: DELETE /companies/:id - Delete by owner
            response = self.session.delete(f"{BASE_URL}/companies/{company_id}")
            self.log_test('companies', 'Delete company by owner → 200', 
                         response.status_code == 200)
        
        # Test 10: GET /my-companies
        response = self.session.get(f"{BASE_URL}/my-companies")
        success = response.status_code == 200 and 'companies' in response.json()
        self.log_test('companies', 'My companies → 200', success)
        
        # Admin tests
        self.login_user(admin_user)
        
        # Test 11: GET /admin/companies
        response = self.session.get(f"{BASE_URL}/admin/companies")
        success = response.status_code == 200 and 'companies' in response.json()
        self.log_test('companies', 'Admin companies list → 200', success)
        
        # Create a company for admin tests
        self.login_user(basic_user)
        response = self.session.post(f"{BASE_URL}/companies", json=company_data)
        if response.status_code == 200:
            admin_test_company_id = response.json().get('company', {}).get('id')
            
            # Test 12: POST /admin/companies/:id/approve
            self.login_user(admin_user)
            response = self.session.post(f"{BASE_URL}/admin/companies/{admin_test_company_id}/approve")
            success = response.status_code == 200
            if success:
                data = response.json()
                success = data.get('status') == 'APPROVED'
            self.log_test('companies', 'Admin approve company → 200', success)
            
            # Test 13: POST /admin/companies/:id/reject
            # Create another company to reject
            self.login_user(basic_user)
            reject_data = company_data.copy()
            reject_data["nameAr"] = "شركة للرفض"
            response = self.session.post(f"{BASE_URL}/companies", json=reject_data)
            if response.status_code == 200:
                reject_company_id = response.json().get('company', {}).get('id')
                
                self.login_user(admin_user)
                response = self.session.post(f"{BASE_URL}/admin/companies/{reject_company_id}/reject", 
                                           json={"reason": "Test rejection"})
                success = response.status_code == 200
                if success:
                    data = response.json()
                    success = data.get('status') == 'REJECTED'
                self.log_test('companies', 'Admin reject company → 200', success)

    def test_experts_endpoints(self):
        """Test all experts endpoints from experts.js"""
        print("\n🧪 TESTING EXPERTS ENDPOINTS")
        print("=" * 50)
        
        # Create test users
        gold_user = self.create_test_user("MEMBER", "GOLD", "_expert")
        free_user = self.create_test_user("MEMBER", "FREE", "_client")
        admin_user = self.create_test_user("ADMIN", "FREE", "_exp_admin")
        
        # Test 1: GET /experts (public)
        response = self.session.get(f"{BASE_URL}/experts")
        success = response.status_code == 200 and 'experts' in response.json()
        self.log_test('experts', 'Public experts list → 200', success)
        
        # Test 2: POST /experts/apply - No auth
        expert_data = {
            "specialty": "LEGAL",
            "hourlyRate": 25,
            "bio": "Legal expert"
        }
        response = self.session.post(f"{BASE_URL}/experts/apply", json=expert_data)
        self.log_test('experts', 'Apply expert without auth → 401', 
                     response.status_code == 401)
        
        # Test 3: POST /experts/apply - FREE user (should fail)
        self.login_user(free_user)
        response = self.session.post(f"{BASE_URL}/experts/apply", json=expert_data)
        self.log_test('experts', 'Apply expert with FREE tier → 403', 
                     response.status_code == 403 and 'الباقة الذهبية أو البلاتينية مطلوبة' in response.text)
        
        # Test 4: POST /experts/apply - GOLD user, invalid specialty
        self.login_user(gold_user)
        invalid_data = expert_data.copy()
        invalid_data["specialty"] = "INVALID"
        response = self.session.post(f"{BASE_URL}/experts/apply", json=invalid_data)
        self.log_test('experts', 'Apply expert invalid specialty → 400', 
                     response.status_code == 400 and 'التخصص غير صحيح' in response.text)
        
        # Test 5: POST /experts/apply - GOLD user, invalid hourly rate
        invalid_data = expert_data.copy()
        invalid_data["hourlyRate"] = 0
        response = self.session.post(f"{BASE_URL}/experts/apply", json=invalid_data)
        self.log_test('experts', 'Apply expert invalid rate → 400', 
                     response.status_code == 400 and 'سعر الساعة مطلوب' in response.text)
        
        # Test 6: POST /experts/apply - Valid application
        response = self.session.post(f"{BASE_URL}/experts/apply", json=expert_data)
        success = response.status_code == 200
        expert_id = None
        if success:
            data = response.json()
            success = data.get('success') and data.get('expert', {}).get('status') == 'PENDING'
            expert_id = data.get('expert', {}).get('id')
        self.log_test('experts', 'Apply expert valid → 200', success)
        
        # Test 7: POST /experts/apply - Duplicate application
        response = self.session.post(f"{BASE_URL}/experts/apply", json=expert_data)
        self.log_test('experts', 'Apply expert duplicate → 409', 
                     response.status_code == 409)
        
        if expert_id:
            self.test_experts[gold_user['id']] = expert_id
            
            # Test 8: GET /experts/me
            response = self.session.get(f"{BASE_URL}/experts/me")
            success = response.status_code == 200 and 'specialty' in response.json()
            self.log_test('experts', 'Get expert me → 200', success)
            
            # Test 9: PUT /experts/me
            update_data = {"bio": "Updated bio", "hourlyRate": 30}
            response = self.session.put(f"{BASE_URL}/experts/me", json=update_data)
            self.log_test('experts', 'Update expert me → 200', 
                         response.status_code == 200)
            
            # Test 10: PUT /experts/me/availability
            availability_data = {
                "availability": [
                    {"dayOfWeek": 0, "startTime": "09:00", "endTime": "12:00"},
                    {"dayOfWeek": 1, "startTime": "14:00", "endTime": "17:00"}
                ]
            }
            response = self.session.put(f"{BASE_URL}/experts/me/availability", json=availability_data)
            success = response.status_code == 200
            if success:
                data = response.json()
                success = data.get('count') == 2
            self.log_test('experts', 'Set availability → 200', success)
            
            # Test 11: GET /experts/:id/availability
            response = self.session.get(f"{BASE_URL}/experts/{expert_id}/availability")
            success = response.status_code == 200 and 'availability' in response.json()
            self.log_test('experts', 'Get expert availability → 200', success)
            
            # Test 12: GET /experts/:id/slots
            tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
            response = self.session.get(f"{BASE_URL}/experts/{expert_id}/slots?date={tomorrow}")
            success = response.status_code == 200 and 'slots' in response.json()
            self.log_test('experts', 'Get expert slots → 200', success)
            
            # Admin approve expert for appointment tests
            self.login_user(admin_user)
            response = self.session.post(f"{BASE_URL}/admin/experts/{expert_id}/approve")
            if response.status_code == 200:
                # Test 13: POST /appointments - Guest booking
                guest_data = {
                    "expertId": expert_id,
                    "date": tomorrow,
                    "startTime": "09:00",
                    "endTime": "10:00",
                    "guest": {
                        "name": "Guest Client",
                        "email": f"guest_{int(time.time())}@test.com",
                        "phone": "+968 9123 4567"
                    }
                }
                self.session.cookies.clear()  # Logout
                response = self.session.post(f"{BASE_URL}/appointments", json=guest_data)
                success = response.status_code == 200
                appointment_id = None
                if success:
                    data = response.json()
                    success = data.get('success') and data.get('appointment', {}).get('status') == 'CONFIRMED'
                    appointment_id = data.get('appointment', {}).get('id')
                self.log_test('experts', 'Guest appointment booking → 200', success)
                
                # Test 14: POST /appointments - Authenticated booking
                self.login_user(free_user)
                auth_data = {
                    "expertId": expert_id,
                    "date": tomorrow,
                    "startTime": "10:00",
                    "endTime": "11:00"
                }
                response = self.session.post(f"{BASE_URL}/appointments", json=auth_data)
                success = response.status_code == 200
                auth_appointment_id = None
                if success:
                    data = response.json()
                    success = data.get('success')
                    auth_appointment_id = data.get('appointment', {}).get('id')
                self.log_test('experts', 'Authenticated appointment booking → 200', success)
                
                # Test 15: POST /appointments - Duplicate booking
                response = self.session.post(f"{BASE_URL}/appointments", json=auth_data)
                self.log_test('experts', 'Duplicate appointment booking → 409', 
                             response.status_code == 409 and 'محجوز بالفعل' in response.text)
                
                # Test 16: GET /appointments
                response = self.session.get(f"{BASE_URL}/appointments")
                success = response.status_code == 200 and 'appointments' in response.json()
                self.log_test('experts', 'Get appointments → 200', success)
                
                # Test 17: POST /appointments/:id/cancel
                if auth_appointment_id:
                    response = self.session.post(f"{BASE_URL}/appointments/{auth_appointment_id}/cancel")
                    self.log_test('experts', 'Cancel appointment → 200', 
                                 response.status_code == 200)
            
            # Admin tests
            self.login_user(admin_user)
            
            # Test 18: GET /admin/experts
            response = self.session.get(f"{BASE_URL}/admin/experts")
            success = response.status_code == 200 and 'experts' in response.json()
            self.log_test('experts', 'Admin experts list → 200', success)
            
            # Test 19: POST /admin/experts/:id/reject
            # Create another expert to reject
            self.login_user(gold_user)
            reject_data = expert_data.copy()
            reject_data["specialty"] = "BUSINESS"
            # Need to create new user since one expert per user
            reject_user = self.create_test_user("MEMBER", "GOLD", "_reject")
            self.login_user(reject_user)
            response = self.session.post(f"{BASE_URL}/experts/apply", json=reject_data)
            if response.status_code == 200:
                reject_expert_id = response.json().get('expert', {}).get('id')
                
                self.login_user(admin_user)
                response = self.session.post(f"{BASE_URL}/admin/experts/{reject_expert_id}/reject", 
                                           json={"reason": "Test rejection"})
                success = response.status_code == 200
                if success:
                    data = response.json()
                    success = data.get('status') == 'REJECTED'
                self.log_test('experts', 'Admin reject expert → 200', success)

    def test_validation_edge_cases(self):
        """Test validation and edge cases"""
        print("\n🧪 TESTING VALIDATION & EDGE CASES")
        print("=" * 50)
        
        # Test 404s for missing IDs
        fake_id = str(uuid.uuid4())
        
        response = self.session.get(f"{BASE_URL}/companies/{fake_id}")
        self.log_test('experts', 'GET company with fake ID → 404', 
                     response.status_code == 404)
        
        response = self.session.get(f"{BASE_URL}/experts/{fake_id}")
        self.log_test('experts', 'GET expert with fake ID → 404', 
                     response.status_code == 404)
        
        # Test invalid date format for slots
        response = self.session.get(f"{BASE_URL}/experts/{fake_id}/slots?date=invalid")
        self.log_test('experts', 'GET slots with invalid date → 400', 
                     response.status_code == 400 and 'تاريخ غير صحيح' in response.text)

    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 STARTING COMPREHENSIVE BACKEND TESTING")
        print("Phase A Refactoring Verification")
        print("Testing extracted modules: membership.js, companies.js, experts.js")
        print("=" * 70)
        
        try:
            self.test_membership_endpoints()
            self.test_companies_endpoints()
            self.test_experts_endpoints()
            self.test_validation_edge_cases()
            
        except Exception as e:
            print(f"❌ Test execution failed: {e}")
            import traceback
            traceback.print_exc()
        
        finally:
            self.print_summary()

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 70)
        print("📊 TEST SUMMARY")
        print("=" * 70)
        
        for category, results in self.results.items():
            if category in ['membership', 'companies', 'experts']:
                passed = results['passed']
                failed = results['failed']
                total = passed + failed
                success_rate = (passed / total * 100) if total > 0 else 0
                
                print(f"\n{category.upper()}:")
                print(f"  ✅ Passed: {passed}")
                print(f"  ❌ Failed: {failed}")
                print(f"  📈 Success Rate: {success_rate:.1f}%")
                
                if failed > 0:
                    print(f"  Failed tests:")
                    for test in results['tests']:
                        if not test['passed']:
                            print(f"    - {test['name']}: {test['details']}")
        
        total_tests = self.results['total_passed'] + self.results['total_failed']
        overall_success = (self.results['total_passed'] / total_tests * 100) if total_tests > 0 else 0
        
        print(f"\n🎯 OVERALL RESULTS:")
        print(f"  Total Tests: {total_tests}")
        print(f"  ✅ Passed: {self.results['total_passed']}")
        print(f"  ❌ Failed: {self.results['total_failed']}")
        print(f"  📈 Success Rate: {overall_success:.1f}%")
        
        if overall_success >= 90:
            print("\n🎉 EXCELLENT: Refactoring verification successful!")
            print("   Functional parity maintained across all modules.")
        elif overall_success >= 75:
            print("\n✅ GOOD: Most functionality working correctly.")
            print("   Minor issues detected, review failed tests.")
        else:
            print("\n⚠️  ISSUES DETECTED: Significant functionality problems.")
            print("   Review failed tests and investigate regressions.")

if __name__ == "__main__":
    tester = BackendTester()
    tester.run_all_tests()