#!/usr/bin/env python3
"""
Focused Backend Testing for Updated Directory Endpoints
Tests the 3 updated company endpoints with better isolation from existing data.
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
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "majles"

class FocusedDirectoryTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        
        # MongoDB connection
        self.mongo_client = pymongo.MongoClient(MONGO_URL)
        self.db = self.mongo_client[DB_NAME]
        
        # Test data storage
        self.test_user_id = None
        self.test_companies = []
        self.auth_cookies = None
        self.test_email = f"directory_test_{int(time.time())}@example.com"
        
    def log(self, message):
        """Log test messages with timestamp"""
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")
        
    def setup_test_user(self):
        """Setup test user with BASIC tier"""
        try:
            self.log("🔧 Setting up test user...")
            
            user_id = str(uuid.uuid4())
            password_hash = bcrypt.hashpw("testpass123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            test_user = {
                "_id": user_id,
                "name": "مستخدم تجريبي للدليل",
                "email": self.test_email,
                "password": password_hash,
                "role": "MEMBER",
                "membershipTier": "BASIC",
                "membershipExpiry": datetime.now() + timedelta(days=365),
                "phone": "",
                "photo": "",
                "createdAt": datetime.now()
            }
            
            # Insert user
            self.db.users.insert_one(test_user)
            self.test_user_id = user_id
            self.log(f"✅ Created test user: {test_user['email']}")
            return True
            
        except Exception as e:
            self.log(f"❌ Failed to setup test user: {e}")
            return False
    
    def authenticate_user(self):
        """Authenticate the test user"""
        try:
            self.log("🔐 Authenticating test user...")
            
            # Get CSRF token first
            csrf_response = self.session.get(f"{BASE_URL}/auth/csrf")
            if csrf_response.status_code != 200:
                self.log(f"❌ Failed to get CSRF token: {csrf_response.status_code}")
                return False
                
            csrf_data = csrf_response.json()
            csrf_token = csrf_data.get('csrfToken')
            
            # Login with credentials
            login_data = {
                "email": self.test_email,
                "password": "testpass123",
                "csrfToken": csrf_token,
                "callbackUrl": "/",
                "json": "true"
            }
            
            login_response = self.session.post(
                f"{BASE_URL}/auth/callback/credentials",
                data=login_data,
                headers={'Content-Type': 'application/x-www-form-urlencoded'}
            )
            
            if login_response.status_code == 200:
                self.auth_cookies = self.session.cookies
                self.log("✅ Authentication successful")
                return True
            else:
                self.log(f"❌ Authentication failed: {login_response.status_code}")
                return False
                
        except Exception as e:
            self.log(f"❌ Authentication error: {e}")
            return False
    
    def test_get_companies_sort_and_search(self):
        """Test GET /api/companies sort and search functionality with isolated data"""
        self.log("\n🧪 Testing GET /api/companies (sort and search)...")
        
        tests_passed = 0
        total_tests = 6
        
        try:
            # Create test companies with specific timestamps for sort testing
            now = datetime.now()
            company1_id = str(uuid.uuid4())
            company2_id = str(uuid.uuid4())
            
            # Create companies directly in DB with controlled timestamps
            company1 = {
                "_id": company1_id,
                "userId": self.test_user_id,
                "nameAr": "شركة الألف للاختبار",
                "nameEn": "Alpha Test Company",
                "sector": "TECH",
                "description": "شركة تقنية متخصصة في الحلول الرقمية",
                "services": ["استشارات قانونية", "عقود"],
                "location": "الغبرة الشمالية",
                "governorate": "MUSCAT",
                "status": "APPROVED",
                "isApproved": True,
                "createdAt": now - timedelta(hours=2),  # 2 hours ago
                "updatedAt": now - timedelta(hours=2)
            }
            
            company2 = {
                "_id": company2_id,
                "userId": self.test_user_id,
                "nameAr": "شركة الياء للاختبار",
                "nameEn": "Yaa Test Company", 
                "sector": "TECH",
                "description": "شركة تمويل وخدمات مالية",
                "services": ["تمويل"],
                "location": "صلالة مركز",
                "governorate": "DHOFAR",
                "status": "APPROVED",
                "isApproved": True,
                "createdAt": now - timedelta(hours=1),  # 1 hour ago
                "updatedAt": now - timedelta(hours=1)
            }
            
            # Insert companies
            self.db.companies.insert_many([company1, company2])
            self.test_companies.extend([company1_id, company2_id])
            
            # Test 1: Sort by newest - شركة الياء should come first among our test companies
            response = self.session.get(f"{BASE_URL}/companies?sort=newest")
            if response.status_code == 200:
                data = response.json()
                companies = data.get('companies', [])
                test_companies = [c for c in companies if 'للاختبار' in c.get('nameAr', '')]
                if len(test_companies) >= 2 and test_companies[0].get('nameAr') == 'شركة الياء للاختبار':
                    self.log("✅ Sort by newest working - شركة الياء للاختبار comes first")
                    tests_passed += 1
                else:
                    self.log(f"❌ Sort by newest failed - Test companies order incorrect")
            else:
                self.log(f"❌ Sort by newest failed - Status: {response.status_code}")
            
            # Test 2: Sort by oldest - شركة الألف should come first among our test companies
            response = self.session.get(f"{BASE_URL}/companies?sort=oldest")
            if response.status_code == 200:
                data = response.json()
                companies = data.get('companies', [])
                test_companies = [c for c in companies if 'للاختبار' in c.get('nameAr', '')]
                if len(test_companies) >= 2 and test_companies[0].get('nameAr') == 'شركة الألف للاختبار':
                    self.log("✅ Sort by oldest working - شركة الألف للاختبار comes first")
                    tests_passed += 1
                else:
                    self.log(f"❌ Sort by oldest failed - Test companies order incorrect")
            else:
                self.log(f"❌ Sort by oldest failed - Status: {response.status_code}")
            
            # Test 3: Sort by name (alphabetical) - شركة الألف should come first
            response = self.session.get(f"{BASE_URL}/companies?sort=name")
            if response.status_code == 200:
                data = response.json()
                companies = data.get('companies', [])
                test_companies = [c for c in companies if 'للاختبار' in c.get('nameAr', '')]
                if len(test_companies) >= 2 and test_companies[0].get('nameAr') == 'شركة الألف للاختبار':
                    self.log("✅ Sort by name working - شركة الألف للاختبار comes first alphabetically")
                    tests_passed += 1
                else:
                    self.log(f"❌ Sort by name failed - Test companies order incorrect")
            else:
                self.log(f"❌ Sort by name failed - Status: {response.status_code}")
            
            # Test 4: Search by services array - should find شركة الألف
            response = self.session.get(f"{BASE_URL}/companies?search=استشارات قانونية")
            if response.status_code == 200:
                data = response.json()
                companies = data.get('companies', [])
                found_alpha = any(c.get('nameAr') == 'شركة الألف للاختبار' for c in companies)
                if found_alpha:
                    self.log("✅ Search by services working - Found شركة الألف للاختبار by 'استشارات قانونية'")
                    tests_passed += 1
                else:
                    self.log("❌ Search by services failed - شركة الألف للاختبار not found")
            else:
                self.log(f"❌ Search by services failed - Status: {response.status_code}")
            
            # Test 5: Search by location - should find شركة الألف
            response = self.session.get(f"{BASE_URL}/companies?search=الغبرة")
            if response.status_code == 200:
                data = response.json()
                companies = data.get('companies', [])
                found_alpha = any(c.get('nameAr') == 'شركة الألف للاختبار' for c in companies)
                if found_alpha:
                    self.log("✅ Search by location working - Found شركة الألف للاختبار by 'الغبرة'")
                    tests_passed += 1
                else:
                    self.log("❌ Search by location failed - شركة الألف للاختبار not found")
            else:
                self.log(f"❌ Search by location failed - Status: {response.status_code}")
            
            # Test 6: Limit parameter - should return at most 1 company
            response = self.session.get(f"{BASE_URL}/companies?limit=1")
            if response.status_code == 200:
                data = response.json()
                companies = data.get('companies', [])
                if len(companies) <= 1:
                    self.log("✅ Limit parameter working - Returned at most 1 company")
                    tests_passed += 1
                else:
                    self.log(f"❌ Limit parameter failed - Returned {len(companies)} companies")
            else:
                self.log(f"❌ Limit parameter failed - Status: {response.status_code}")
            
        except Exception as e:
            self.log(f"❌ GET /api/companies test error: {e}")
        
        self.log(f"📊 GET /api/companies Sort/Search: {tests_passed}/{total_tests} tests passed")
        return tests_passed == total_tests
    
    def test_post_companies_lat_lng(self):
        """Test POST /api/companies with lat/lng validation"""
        self.log("\n🧪 Testing POST /api/companies (lat/lng validation)...")
        
        tests_passed = 0
        total_tests = 6
        
        try:
            # Test 1: Valid company without lat/lng
            company_data = {
                "nameAr": "شركة تجريبية بدون إحداثيات",
                "sector": "TECH",
                "description": "شركة للاختبار"
            }
            
            response = self.session.post(f"{BASE_URL}/companies", json=company_data)
            if response.status_code == 200:
                data = response.json()
                company_id = data.get('company', {}).get('id')
                if company_id:
                    # Verify in DB that lat/lng are null
                    db_company = self.db.companies.find_one({"_id": company_id})
                    if db_company and db_company.get('lat') is None and db_company.get('lng') is None:
                        self.log("✅ Company creation without lat/lng working - DB has null coordinates")
                        tests_passed += 1
                        self.test_companies.append(company_id)
                    else:
                        self.log(f"❌ Company creation without lat/lng failed - DB lat: {db_company.get('lat')}, lng: {db_company.get('lng')}")
                else:
                    self.log("❌ Company creation without lat/lng failed - No company ID returned")
            else:
                self.log(f"❌ Company creation without lat/lng failed - Status: {response.status_code}, Response: {response.text}")
            
            # Test 2: Valid company with lat/lng in Oman
            company_data = {
                "nameAr": "شركة تجريبية مع إحداثيات",
                "sector": "TECH",
                "lat": 23.588,
                "lng": 58.383
            }
            
            response = self.session.post(f"{BASE_URL}/companies", json=company_data)
            if response.status_code == 200:
                data = response.json()
                company_id = data.get('company', {}).get('id')
                if company_id:
                    # Verify in DB that lat/lng are stored correctly
                    db_company = self.db.companies.find_one({"_id": company_id})
                    if (db_company and 
                        db_company.get('lat') is not None and
                        db_company.get('lng') is not None and
                        abs(db_company.get('lat') - 23.588) < 0.001 and 
                        abs(db_company.get('lng') - 58.383) < 0.001):
                        self.log("✅ Company creation with valid lat/lng working - DB has correct coordinates")
                        tests_passed += 1
                        self.test_companies.append(company_id)
                    else:
                        self.log(f"❌ Company creation with valid lat/lng failed - DB lat: {db_company.get('lat')}, lng: {db_company.get('lng')}")
                else:
                    self.log("❌ Company creation with valid lat/lng failed - No company ID returned")
            else:
                self.log(f"❌ Company creation with valid lat/lng failed - Status: {response.status_code}, Response: {response.text}")
            
            # Test 3: Invalid lat outside Oman
            company_data = {
                "nameAr": "شركة خارج عمان",
                "sector": "TECH",
                "lat": 15.0,  # Outside Oman
                "lng": 58.0
            }
            
            response = self.session.post(f"{BASE_URL}/companies", json=company_data)
            if response.status_code == 400:
                data = response.json()
                error_msg = data.get('error', '')
                if 'الإحداثيات غير صحيحة (يجب أن تكون ضمن حدود سلطنة عُمان)' in error_msg:
                    self.log("✅ Invalid lat validation working - Correct Arabic error message")
                    tests_passed += 1
                else:
                    self.log(f"❌ Invalid lat validation failed - Wrong error message: {error_msg}")
            else:
                self.log(f"❌ Invalid lat validation failed - Status: {response.status_code}")
            
            # Test 4: Invalid lng outside Oman
            company_data = {
                "nameAr": "شركة خارج عمان 2",
                "sector": "TECH",
                "lat": 23.0,  # Inside Oman
                "lng": 45.0   # Outside Oman
            }
            
            response = self.session.post(f"{BASE_URL}/companies", json=company_data)
            if response.status_code == 400:
                data = response.json()
                error_msg = data.get('error', '')
                if 'الإحداثيات غير صحيحة (يجب أن تكون ضمن حدود سلطنة عُمان)' in error_msg:
                    self.log("✅ Invalid lng validation working - Correct Arabic error message")
                    tests_passed += 1
                else:
                    self.log(f"❌ Invalid lng validation failed - Wrong error message: {error_msg}")
            else:
                self.log(f"❌ Invalid lng validation failed - Status: {response.status_code}")
            
            # Test 5: Invalid types (string coordinates)
            company_data = {
                "nameAr": "شركة إحداثيات خاطئة",
                "sector": "TECH",
                "lat": "abc",
                "lng": "def"
            }
            
            response = self.session.post(f"{BASE_URL}/companies", json=company_data)
            if response.status_code == 400:
                data = response.json()
                error_msg = data.get('error', '')
                if 'الإحداثيات غير صحيحة (يجب أن تكون ضمن حدود سلطنة عُمان)' in error_msg:
                    self.log("✅ Invalid coordinate types validation working - Correct Arabic error message")
                    tests_passed += 1
                else:
                    self.log(f"❌ Invalid coordinate types validation failed - Wrong error message: {error_msg}")
            else:
                self.log(f"❌ Invalid coordinate types validation failed - Status: {response.status_code}")
            
            # Test 6: Empty string coordinates should behave like undefined
            company_data = {
                "nameAr": "شركة إحداثيات فارغة",
                "sector": "TECH",
                "lat": "",
                "lng": ""
            }
            
            response = self.session.post(f"{BASE_URL}/companies", json=company_data)
            if response.status_code == 200:
                data = response.json()
                company_id = data.get('company', {}).get('id')
                if company_id:
                    # Verify in DB that lat/lng are null
                    db_company = self.db.companies.find_one({"_id": company_id})
                    if db_company and db_company.get('lat') is None and db_company.get('lng') is None:
                        self.log("✅ Empty string coordinates working - DB has null coordinates")
                        tests_passed += 1
                        self.test_companies.append(company_id)
                    else:
                        self.log(f"❌ Empty string coordinates failed - DB lat: {db_company.get('lat')}, lng: {db_company.get('lng')}")
                else:
                    self.log("❌ Empty string coordinates failed - No company ID returned")
            else:
                self.log(f"❌ Empty string coordinates failed - Status: {response.status_code}")
            
        except Exception as e:
            self.log(f"❌ POST /api/companies test error: {e}")
        
        self.log(f"📊 POST /api/companies lat/lng: {tests_passed}/{total_tests} tests passed")
        return tests_passed == total_tests
    
    def test_put_companies_lat_lng(self):
        """Test PUT /api/companies/:id with lat/lng validation"""
        self.log("\n🧪 Testing PUT /api/companies/:id (lat/lng validation)...")
        
        tests_passed = 0
        total_tests = 4
        
        try:
            # First create a company to update
            company_data = {
                "nameAr": "شركة للتحديث",
                "sector": "TECH"
            }
            
            response = self.session.post(f"{BASE_URL}/companies", json=company_data)
            if response.status_code != 200:
                self.log(f"❌ Failed to create company for PUT testing - Status: {response.status_code}")
                return False
                
            company_id = response.json().get('company', {}).get('id')
            if not company_id:
                self.log("❌ No company ID returned for PUT testing")
                return False
            
            self.test_companies.append(company_id)
            
            # Test 1: Update with valid lat/lng in Oman
            update_data = {
                "lat": 24.0,
                "lng": 56.5,
                "description": "تحديث مع إحداثيات صحيحة"
            }
            
            response = self.session.put(f"{BASE_URL}/companies/{company_id}", json=update_data)
            if response.status_code == 200:
                # Verify in DB
                db_company = self.db.companies.find_one({"_id": company_id})
                if (db_company and 
                    db_company.get('lat') is not None and
                    db_company.get('lng') is not None and
                    abs(db_company.get('lat') - 24.0) < 0.001 and 
                    abs(db_company.get('lng') - 56.5) < 0.001 and
                    db_company.get('status') == 'PENDING'):  # Should reset to PENDING for non-admin
                    self.log("✅ PUT with valid lat/lng working - DB updated correctly, status reset to PENDING")
                    tests_passed += 1
                else:
                    self.log(f"❌ PUT with valid lat/lng failed - DB lat: {db_company.get('lat')}, lng: {db_company.get('lng')}, status: {db_company.get('status')}")
            else:
                self.log(f"❌ PUT with valid lat/lng failed - Status: {response.status_code}")
            
            # Test 2: Update with lat: null to clear coordinates
            update_data = {
                "lat": None,
                "description": "تحديث لمسح الإحداثيات"
            }
            
            response = self.session.put(f"{BASE_URL}/companies/{company_id}", json=update_data)
            if response.status_code == 200:
                # Verify in DB that both lat and lng are null
                db_company = self.db.companies.find_one({"_id": company_id})
                if db_company and db_company.get('lat') is None and db_company.get('lng') is None:
                    self.log("✅ PUT with lat: null working - Both coordinates cleared in DB")
                    tests_passed += 1
                else:
                    self.log(f"❌ PUT with lat: null failed - DB lat: {db_company.get('lat')}, lng: {db_company.get('lng')}")
            else:
                self.log(f"❌ PUT with lat: null failed - Status: {response.status_code}")
            
            # Test 3: Update with lat: '' (empty string) to clear coordinates
            update_data = {
                "lat": "",
                "description": "تحديث لمسح الإحداثيات بنص فارغ"
            }
            
            response = self.session.put(f"{BASE_URL}/companies/{company_id}", json=update_data)
            if response.status_code == 200:
                # Verify in DB that both lat and lng are null
                db_company = self.db.companies.find_one({"_id": company_id})
                if db_company and db_company.get('lat') is None and db_company.get('lng') is None:
                    self.log("✅ PUT with lat: '' working - Both coordinates cleared in DB")
                    tests_passed += 1
                else:
                    self.log(f"❌ PUT with lat: '' failed - DB lat: {db_company.get('lat')}, lng: {db_company.get('lng')}")
            else:
                self.log(f"❌ PUT with lat: '' failed - Status: {response.status_code}")
            
            # Test 4: Update with invalid coordinates
            update_data = {
                "lat": 99,
                "lng": 99,
                "description": "تحديث بإحداثيات خاطئة"
            }
            
            response = self.session.put(f"{BASE_URL}/companies/{company_id}", json=update_data)
            if response.status_code == 400:
                data = response.json()
                error_msg = data.get('error', '')
                if 'الإحداثيات غير صحيحة (يجب أن تكون ضمن حدود سلطنة عُمان)' in error_msg:
                    self.log("✅ PUT with invalid coordinates working - Correct Arabic error message")
                    tests_passed += 1
                else:
                    self.log(f"❌ PUT with invalid coordinates failed - Wrong error message: {error_msg}")
            else:
                self.log(f"❌ PUT with invalid coordinates failed - Status: {response.status_code}")
            
        except Exception as e:
            self.log(f"❌ PUT /api/companies/:id test error: {e}")
        
        self.log(f"📊 PUT /api/companies/:id lat/lng: {tests_passed}/{total_tests} tests passed")
        return tests_passed == total_tests
    
    def test_regression_endpoints(self):
        """Test regression endpoints to ensure they still work"""
        self.log("\n🧪 Testing regression endpoints...")
        
        tests_passed = 0
        total_tests = 3
        
        try:
            # Test 1: GET /api/ health check
            response = self.session.get(f"{BASE_URL}/")
            if response.status_code == 200:
                data = response.json()
                if data.get('message') == 'Majles API is running':
                    self.log("✅ GET /api/ health check working")
                    tests_passed += 1
                else:
                    self.log(f"❌ GET /api/ health check failed - Wrong message: {data}")
            else:
                self.log(f"❌ GET /api/ health check failed - Status: {response.status_code}")
            
            # Test 2: POST /api/signup (create fresh user)
            signup_data = {
                "name": "مستخدم جديد للاختبار",
                "email": f"regression_test_{int(time.time())}@example.com",
                "password": "testpass123"
            }
            
            response = self.session.post(f"{BASE_URL}/signup", json=signup_data)
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and data.get('user'):
                    self.log("✅ POST /api/signup working")
                    tests_passed += 1
                else:
                    self.log(f"❌ POST /api/signup failed - Invalid response: {data}")
            else:
                self.log(f"❌ POST /api/signup failed - Status: {response.status_code}")
            
            # Test 3: GET /api/companies (no params) - should work as before
            response = self.session.get(f"{BASE_URL}/companies")
            if response.status_code == 200:
                data = response.json()
                if 'companies' in data and isinstance(data['companies'], list):
                    self.log("✅ GET /api/companies (no params) working")
                    tests_passed += 1
                else:
                    self.log(f"❌ GET /api/companies (no params) failed - Invalid response structure")
            else:
                self.log(f"❌ GET /api/companies (no params) failed - Status: {response.status_code}")
            
        except Exception as e:
            self.log(f"❌ Regression test error: {e}")
        
        self.log(f"📊 Regression tests: {tests_passed}/{total_tests} tests passed")
        return tests_passed == total_tests
    
    def cleanup_test_data(self):
        """Clean up test data"""
        try:
            self.log("🧹 Cleaning up test data...")
            
            # Delete test companies
            if self.test_companies:
                self.db.companies.delete_many({"_id": {"$in": self.test_companies}})
                self.log(f"✅ Deleted {len(self.test_companies)} test companies")
            
            # Delete test user
            if self.test_user_id:
                self.db.users.delete_one({"_id": self.test_user_id})
                self.log("✅ Deleted test user")
            
        except Exception as e:
            self.log(f"❌ Cleanup error: {e}")
    
    def run_all_tests(self):
        """Run all backend tests"""
        self.log("🚀 Starting Focused Directory Backend Testing...")
        self.log(f"📍 Base URL: {BASE_URL}")
        self.log(f"🗄️  Database: {MONGO_URL}/{DB_NAME}")
        
        # Setup
        if not self.setup_test_user():
            self.log("❌ Failed to setup test user. Aborting tests.")
            return False
        
        if not self.authenticate_user():
            self.log("❌ Failed to authenticate. Aborting tests.")
            self.cleanup_test_data()
            return False
        
        # Run tests
        results = []
        results.append(self.test_get_companies_sort_and_search())
        results.append(self.test_post_companies_lat_lng())
        results.append(self.test_put_companies_lat_lng())
        results.append(self.test_regression_endpoints())
        
        # Cleanup
        self.cleanup_test_data()
        
        # Summary
        passed_tests = sum(results)
        total_tests = len(results)
        
        self.log(f"\n📊 FINAL RESULTS:")
        self.log(f"✅ Passed: {passed_tests}/{total_tests} test suites")
        
        if passed_tests == total_tests:
            self.log("🎉 ALL TESTS PASSED! Directory backend endpoints are working correctly.")
            return True
        else:
            self.log("❌ Some tests failed. Please check the logs above.")
            return False

if __name__ == "__main__":
    tester = FocusedDirectoryTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)