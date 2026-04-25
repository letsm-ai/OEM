#!/usr/bin/env python3
"""
Backend testing for NEW shipping policy + per-vendor shipping absorption.

Tests the following endpoints:
1. POST /api/shipping/quote - Updated with vendor absorption logic
2. GET /api/vendor/profile - Now includes vendorAbsorbsShipping
3. PUT /api/vendor/profile - Now accepts vendorAbsorbsShipping

Test scenarios from review request:
- New shipping fees: 2 OMR for MUSCAT, 3 OMR for all other governorates
- Vendor absorption: when ALL vendors in cart have vendorAbsorbsShipping=true, fee=0
- Mixed vendors: when some absorb and some don't, customer pays regional fee
"""

import requests
import json
import time
import uuid
from datetime import datetime

# Configuration
BASE_URL = "https://omani-startup-hub.preview.emergentagent.com/api"
TEST_PASSWORD = "Password123"

class ShippingPolicyTester:
    def __init__(self):
        self.session = requests.Session()
        self.test_users = {}
        self.test_vendors = {}
        self.test_products = {}
        
    def log(self, message):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {message}")
        
    def create_test_user(self, role="MEMBER", suffix=""):
        """Create a test user and return credentials"""
        timestamp = int(time.time())
        email = f"shipping_test_{role.lower()}_{timestamp}{suffix}@example.com"
        name = f"Test {role} {timestamp}"
        
        # Create user via signup
        response = self.session.post(f"{BASE_URL}/signup", json={
            "name": name,
            "email": email,
            "password": TEST_PASSWORD
        })
        
        if response.status_code != 200:
            self.log(f"❌ Failed to create user {email}: {response.status_code} {response.text}")
            return None
            
        user_data = response.json()
        user_id = user_data["user"]["id"]
        
        # Promote to desired role if not MEMBER
        if role != "MEMBER":
            import pymongo
            client = pymongo.MongoClient("mongodb://localhost:27017")
            db = client["majles"]
            db.users.update_one(
                {"_id": user_id},
                {"$set": {"role": role}}
            )
            client.close()
            
        self.test_users[role] = {
            "email": email,
            "password": TEST_PASSWORD,
            "name": name,
            "id": user_id
        }
        
        self.log(f"✅ Created {role} user: {email}")
        return self.test_users[role]
        
    def login_user(self, email, password):
        """Login user and set session cookies"""
        # Get CSRF token
        csrf_response = self.session.get(f"{BASE_URL}/auth/csrf")
        if csrf_response.status_code != 200:
            self.log(f"❌ Failed to get CSRF token: {csrf_response.status_code}")
            return False
            
        csrf_token = csrf_response.json().get("csrfToken")
        if not csrf_token:
            self.log("❌ No CSRF token in response")
            return False
            
        # Login with credentials
        login_data = {
            "csrfToken": csrf_token,
            "email": email,
            "password": password,
            "callbackUrl": "/",
            "json": "true"
        }
        
        login_response = self.session.post(
            f"{BASE_URL}/auth/callback/credentials",
            data=login_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        if login_response.status_code == 200:
            # Verify login by checking /api/me
            me_response = self.session.get(f"{BASE_URL}/me")
            if me_response.status_code == 200:
                user_data = me_response.json()
                self.log(f"✅ Logged in as: {user_data.get('name')} ({user_data.get('role')})")
                return True
                
        self.log(f"❌ Login failed for {email}: {login_response.status_code}")
        return False
        
    def create_test_product(self, vendor_id):
        """Create a test product for a vendor"""
        product_data = {
            "nameAr": f"منتج اختبار الشحن {int(time.time())}",
            "nameEn": f"Shipping Test Product {int(time.time())}",
            "price": 25.0,
            "description": "منتج لاختبار سياسة الشحن الجديدة",
            "category": "OTHER",
            "stock": 100,
            "isActive": True
        }
        
        response = self.session.post(f"{BASE_URL}/products", json=product_data)
        if response.status_code == 200:
            product = response.json()["product"]
            self.test_products[vendor_id] = product
            self.log(f"✅ Created test product: {product['id']}")
            return product
        else:
            self.log(f"❌ Failed to create product: {response.status_code} {response.text}")
            return None
            
    def test_shipping_quote_basic(self):
        """Test basic shipping quote functionality with new rates"""
        self.log("\n🧪 Testing basic shipping quote functionality...")
        
        test_cases = [
            # Test case a) MUSCAT → 2 OMR
            {
                "name": "MUSCAT governorate",
                "body": {"governorate": "MUSCAT", "amount": 10},
                "expected": {"fee": 2.0, "isFree": False, "absorbedByVendor": False}
            },
            # Test case b) DHOFAR → 3 OMR  
            {
                "name": "DHOFAR governorate",
                "body": {"governorate": "DHOFAR", "amount": 10},
                "expected": {"fee": 3.0, "isFree": False}
            },
            # Test case c) BATINAH → 3 OMR
            {
                "name": "BATINAH governorate", 
                "body": {"governorate": "BATINAH", "amount": 10},
                "expected": {"fee": 3.0}
            },
            # Test case d) MUSANDAM → 3 OMR (was 6 OMR before)
            {
                "name": "MUSANDAM governorate",
                "body": {"governorate": "MUSANDAM", "amount": 10}, 
                "expected": {"fee": 3.0}
            },
            # Test case e) Free threshold reached
            {
                "name": "MUSCAT with free threshold",
                "body": {"governorate": "MUSCAT", "amount": 35},
                "expected": {"fee": 0, "isFree": True, "freeThresholdReached": True}
            },
            # Test case f) Invalid governorate fallback
            {
                "name": "Invalid governorate fallback",
                "body": {"governorate": "INVALID_GOV", "amount": 10},
                "expected": {"fee": 3.0}  # DEFAULT_SHIPPING_FEE
            },
            # Test case g) Empty items array
            {
                "name": "Empty items array",
                "body": {"governorate": "MUSCAT", "amount": 10, "items": []},
                "expected": {"fee": 2.0, "absorbedByVendor": False}
            }
        ]
        
        passed = 0
        total = len(test_cases)
        
        for test_case in test_cases:
            try:
                response = self.session.post(f"{BASE_URL}/shipping/quote", json=test_case["body"])
                
                if response.status_code != 200:
                    self.log(f"❌ {test_case['name']}: HTTP {response.status_code}")
                    continue
                    
                data = response.json()
                
                # Check expected values
                success = True
                for key, expected_value in test_case["expected"].items():
                    if key in data and data[key] != expected_value:
                        self.log(f"❌ {test_case['name']}: {key} = {data[key]}, expected {expected_value}")
                        success = False
                        
                # Verify response structure
                required_fields = ["governorate", "fee", "isFree", "freeThreshold", "freeThresholdReached", "absorbedByVendor", "allRates"]
                for field in required_fields:
                    if field not in data:
                        self.log(f"❌ {test_case['name']}: Missing field {field}")
                        success = False
                        
                if success:
                    self.log(f"✅ {test_case['name']}: fee={data['fee']}, isFree={data['isFree']}")
                    passed += 1
                    
            except Exception as e:
                self.log(f"❌ {test_case['name']}: Exception {str(e)}")
                
        self.log(f"\n📊 Basic shipping quote tests: {passed}/{total} passed")
        return passed == total
        
    def test_vendor_profile_endpoints(self):
        """Test vendor profile GET/PUT with vendorAbsorbsShipping field"""
        self.log("\n🧪 Testing vendor profile endpoints...")
        
        # Create and login as vendor
        vendor = self.create_test_user("VENDOR", "_profile")
        if not vendor or not self.login_user(vendor["email"], vendor["password"]):
            self.log("❌ Failed to create/login vendor for profile tests")
            return False
            
        passed = 0
        total = 5
        
        try:
            # Test 1: GET /api/vendor/profile includes vendorAbsorbsShipping
            response = self.session.get(f"{BASE_URL}/vendor/profile")
            if response.status_code == 200:
                profile = response.json()["profile"]
                if "vendorAbsorbsShipping" in profile and profile["vendorAbsorbsShipping"] == False:
                    self.log("✅ GET /vendor/profile: vendorAbsorbsShipping defaults to false")
                    passed += 1
                else:
                    self.log(f"❌ GET /vendor/profile: vendorAbsorbsShipping = {profile.get('vendorAbsorbsShipping')}")
            else:
                self.log(f"❌ GET /vendor/profile failed: {response.status_code}")
                
            # Test 2: PUT /api/vendor/profile with vendorAbsorbsShipping=true
            update_data = {
                "vendorAbsorbsShipping": True,
                "businessName": "Test Shipping Store"
            }
            response = self.session.put(f"{BASE_URL}/vendor/profile", json=update_data)
            if response.status_code == 200:
                profile = response.json()["profile"]
                if profile.get("vendorAbsorbsShipping") == True:
                    self.log("✅ PUT /vendor/profile: vendorAbsorbsShipping set to true")
                    passed += 1
                else:
                    self.log(f"❌ PUT /vendor/profile: vendorAbsorbsShipping = {profile.get('vendorAbsorbsShipping')}")
            else:
                self.log(f"❌ PUT /vendor/profile failed: {response.status_code} {response.text}")
                
            # Test 3: Verify persistence with GET
            response = self.session.get(f"{BASE_URL}/vendor/profile")
            if response.status_code == 200:
                profile = response.json()["profile"]
                if profile.get("vendorAbsorbsShipping") == True:
                    self.log("✅ GET /vendor/profile: vendorAbsorbsShipping persisted as true")
                    passed += 1
                else:
                    self.log(f"❌ GET /vendor/profile: vendorAbsorbsShipping not persisted = {profile.get('vendorAbsorbsShipping')}")
            else:
                self.log(f"❌ GET /vendor/profile verification failed: {response.status_code}")
                
            # Test 4: Toggle back to false
            update_data = {"vendorAbsorbsShipping": False}
            response = self.session.put(f"{BASE_URL}/vendor/profile", json=update_data)
            if response.status_code == 200:
                profile = response.json()["profile"]
                if profile.get("vendorAbsorbsShipping") == False:
                    self.log("✅ PUT /vendor/profile: vendorAbsorbsShipping toggled to false")
                    passed += 1
                else:
                    self.log(f"❌ PUT /vendor/profile: vendorAbsorbsShipping = {profile.get('vendorAbsorbsShipping')}")
            else:
                self.log(f"❌ PUT /vendor/profile toggle failed: {response.status_code}")
                
            # Test 5: Invalid value (string instead of boolean)
            update_data = {"vendorAbsorbsShipping": "truthy_string"}
            response = self.session.put(f"{BASE_URL}/vendor/profile", json=update_data)
            if response.status_code == 200:
                profile = response.json()["profile"]
                if profile.get("vendorAbsorbsShipping") == False:  # Should NOT be true for non-boolean
                    self.log("✅ PUT /vendor/profile: string value correctly rejected (remains false)")
                    passed += 1
                else:
                    self.log(f"❌ PUT /vendor/profile: string value incorrectly accepted = {profile.get('vendorAbsorbsShipping')}")
            else:
                self.log(f"❌ PUT /vendor/profile string test failed: {response.status_code}")
                
        except Exception as e:
            self.log(f"❌ Vendor profile test exception: {str(e)}")
            
        self.log(f"\n📊 Vendor profile tests: {passed}/{total} passed")
        return passed == total
        
    def test_vendor_absorption_flow(self):
        """Test end-to-end vendor absorption flow"""
        self.log("\n🧪 Testing vendor absorption flow...")
        
        # Create vendor and set absorption to true
        vendor = self.create_test_user("VENDOR", "_absorption")
        if not vendor or not self.login_user(vendor["email"], vendor["password"]):
            self.log("❌ Failed to create/login vendor for absorption tests")
            return False
            
        passed = 0
        total = 4
        
        try:
            # Step 1: Set vendorAbsorbsShipping=true
            update_data = {"vendorAbsorbsShipping": True, "businessName": "Absorption Test Store"}
            response = self.session.put(f"{BASE_URL}/vendor/profile", json=update_data)
            if response.status_code == 200:
                self.log("✅ Set vendor absorption to true")
                vendor_id = vendor["id"]
                
                # Step 2: Create a product for this vendor
                product = self.create_test_product(vendor_id)
                if product:
                    product_id = product["id"]
                    
                    # Step 3: Test shipping quote with this vendor's product
                    quote_data = {
                        "governorate": "MUSCAT",
                        "amount": 10,
                        "items": [{"productId": product_id, "vendorId": vendor_id}]
                    }
                    response = self.session.post(f"{BASE_URL}/shipping/quote", json=quote_data)
                    if response.status_code == 200:
                        data = response.json()
                        if data.get("fee") == 0 and data.get("isFree") == True and data.get("absorbedByVendor") == True:
                            self.log("✅ Shipping absorbed by vendor: fee=0, absorbedByVendor=true")
                            passed += 1
                        else:
                            self.log(f"❌ Absorption failed: fee={data.get('fee')}, absorbedByVendor={data.get('absorbedByVendor')}")
                    else:
                        self.log(f"❌ Shipping quote failed: {response.status_code}")
                        
                    # Step 4: Toggle vendor flag to false and test again
                    update_data = {"vendorAbsorbsShipping": False}
                    response = self.session.put(f"{BASE_URL}/vendor/profile", json=update_data)
                    if response.status_code == 200:
                        passed += 1
                        
                        # Test shipping quote again
                        response = self.session.post(f"{BASE_URL}/shipping/quote", json=quote_data)
                        if response.status_code == 200:
                            data = response.json()
                            if data.get("fee") == 2.0 and data.get("isFree") == False and data.get("absorbedByVendor") == False:
                                self.log("✅ Shipping NOT absorbed after toggle: fee=2.0, absorbedByVendor=false")
                                passed += 1
                            else:
                                self.log(f"❌ Toggle failed: fee={data.get('fee')}, absorbedByVendor={data.get('absorbedByVendor')}")
                        else:
                            self.log(f"❌ Second shipping quote failed: {response.status_code}")
                    else:
                        self.log(f"❌ Toggle vendor absorption failed: {response.status_code}")
                else:
                    self.log("❌ Failed to create test product")
            else:
                self.log(f"❌ Failed to set vendor absorption: {response.status_code}")
                
        except Exception as e:
            self.log(f"❌ Vendor absorption test exception: {str(e)}")
            
        # Test with fake product/vendor IDs (graceful fallback)
        try:
            fake_quote_data = {
                "governorate": "MUSCAT",
                "amount": 10,
                "items": [{"productId": "fake-product-id", "vendorId": "fake-vendor-id"}]
            }
            response = self.session.post(f"{BASE_URL}/shipping/quote", json=fake_quote_data)
            if response.status_code == 200:
                data = response.json()
                if data.get("fee") == 2.0 and data.get("absorbedByVendor") == False:
                    self.log("✅ Graceful fallback for fake vendor: fee=2.0, absorbedByVendor=false")
                    passed += 1
                else:
                    self.log(f"❌ Fake vendor fallback failed: fee={data.get('fee')}, absorbedByVendor={data.get('absorbedByVendor')}")
            else:
                self.log(f"❌ Fake vendor quote failed: {response.status_code}")
        except Exception as e:
            self.log(f"❌ Fake vendor test exception: {str(e)}")
            
        self.log(f"\n📊 Vendor absorption tests: {passed}/{total} passed")
        return passed == total
        
    def test_authorization(self):
        """Test authorization for vendor profile endpoints"""
        self.log("\n🧪 Testing authorization...")
        
        passed = 0
        total = 2
        
        try:
            # Test 1: Unauthenticated access
            temp_session = requests.Session()
            response = temp_session.get(f"{BASE_URL}/vendor/profile")
            if response.status_code == 401:
                self.log("✅ GET /vendor/profile: 401 without session")
                passed += 1
            else:
                self.log(f"❌ GET /vendor/profile: Expected 401, got {response.status_code}")
                
            response = temp_session.put(f"{BASE_URL}/vendor/profile", json={"vendorAbsorbsShipping": True})
            if response.status_code == 401:
                self.log("✅ PUT /vendor/profile: 401 without session")
                passed += 1
            else:
                self.log(f"❌ PUT /vendor/profile: Expected 401, got {response.status_code}")
                
        except Exception as e:
            self.log(f"❌ Authorization test exception: {str(e)}")
            
        self.log(f"\n📊 Authorization tests: {passed}/{total} passed")
        return passed == total
        
    def run_all_tests(self):
        """Run all shipping policy tests"""
        self.log("🚀 Starting NEW shipping policy + vendor absorption backend tests...")
        self.log(f"🌐 Base URL: {BASE_URL}")
        
        results = []
        
        # Test 1: Basic shipping quote functionality
        results.append(("Basic Shipping Quote", self.test_shipping_quote_basic()))
        
        # Test 2: Vendor profile endpoints
        results.append(("Vendor Profile Endpoints", self.test_vendor_profile_endpoints()))
        
        # Test 3: End-to-end vendor absorption flow
        results.append(("Vendor Absorption Flow", self.test_vendor_absorption_flow()))
        
        # Test 4: Authorization
        results.append(("Authorization", self.test_authorization()))
        
        # Summary
        self.log("\n" + "="*60)
        self.log("📊 SHIPPING POLICY TEST RESULTS:")
        self.log("="*60)
        
        passed_count = 0
        total_count = len(results)
        
        for test_name, passed in results:
            status = "✅ PASSED" if passed else "❌ FAILED"
            self.log(f"{status}: {test_name}")
            if passed:
                passed_count += 1
                
        self.log("="*60)
        self.log(f"🎯 OVERALL RESULT: {passed_count}/{total_count} test suites passed")
        
        if passed_count == total_count:
            self.log("🎉 ALL SHIPPING POLICY TESTS PASSED!")
            return True
        else:
            self.log("⚠️  Some tests failed. Check logs above for details.")
            return False

if __name__ == "__main__":
    tester = ShippingPolicyTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)