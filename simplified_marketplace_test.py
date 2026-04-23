#!/usr/bin/env python3
"""
Simplified Backend testing for Phase 5 - Multi-vendor Marketplace endpoints
Testing core marketplace functionality with direct database setup
"""

import requests
import json
import uuid
import time
import pymongo
import bcrypt
import os

# Configuration
BASE_URL = "https://omani-startup-hub.preview.emergentagent.com/api"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "majles"

class SimplifiedMarketplaceTest:
    def __init__(self):
        self.session = requests.Session()
        self.mongo_client = pymongo.MongoClient(MONGO_URL)
        self.db = self.mongo_client[DB_NAME]
        
        print("🧪 SIMPLIFIED MARKETPLACE BACKEND TESTING")
        print(f"📍 Base URL: {BASE_URL}")
        print(f"🗄️ Database: MongoDB {DB_NAME}")
        print()

    def test_basic_endpoints(self):
        """Test basic marketplace endpoints without authentication"""
        print("🔍 TESTING BASIC MARKETPLACE ENDPOINTS...")
        
        # Test 1: GET /api/ (health check)
        response = self.session.get(f"{BASE_URL}/")
        if response.status_code == 200 and "Majles API is running" in response.json().get("message", ""):
            print("✅ 1. GET /api/ → 200 'Majles API is running'")
        else:
            print(f"❌ 1. Expected 200, got {response.status_code}: {response.text}")
            return False
        
        # Test 2: GET /api/products (public products list)
        response = self.session.get(f"{BASE_URL}/products")
        if response.status_code == 200:
            result = response.json()
            # Handle both array and object response formats
            if isinstance(result, list):
                products = result
            elif isinstance(result, dict) and 'products' in result:
                products = result['products']
            else:
                print(f"❌ 2. Invalid products response: {result}")
                return False
            
            if isinstance(products, list):
                print(f"✅ 2. GET /api/products → 200 with {len(products)} products")
            else:
                print(f"❌ 2. Products not a list: {products}")
                return False
        else:
            print(f"❌ 2. Expected 200, got {response.status_code}")
            return False
        
        # Test 3: GET /api/products?category=FOOD
        response = self.session.get(f"{BASE_URL}/products?category=FOOD")
        if response.status_code == 200:
            result = response.json()
            # Handle both array and object response formats
            if isinstance(result, list):
                products = result
            elif isinstance(result, dict) and 'products' in result:
                products = result['products']
            else:
                print(f"❌ 3. Invalid response: {result}")
                return False
            
            if isinstance(products, list):
                print(f"✅ 3. GET /api/products?category=FOOD → 200 with {len(products)} FOOD products")
            else:
                print(f"❌ 3. Products not a list: {products}")
                return False
        else:
            print(f"❌ 3. Expected 200, got {response.status_code}")
            return False
        
        return True

    def test_authentication_required_endpoints(self):
        """Test endpoints that require authentication"""
        print("\n🔐 TESTING AUTHENTICATION-REQUIRED ENDPOINTS...")
        
        # Test 1: POST /api/vendor/apply - No session
        response = self.session.post(f"{BASE_URL}/vendor/apply", json={"businessName": "متجر تجريبي"})
        if response.status_code == 401 and "غير مصرح" in response.json().get("error", ""):
            print("✅ 1. POST /api/vendor/apply (no auth) → 401 'غير مصرح'")
        else:
            print(f"❌ 1. Expected 401, got {response.status_code}: {response.text}")
            return False
        
        # Test 2: GET /api/vendor/application - No session
        response = self.session.get(f"{BASE_URL}/vendor/application")
        if response.status_code == 401:
            print("✅ 2. GET /api/vendor/application (no auth) → 401")
        else:
            print(f"❌ 2. Expected 401, got {response.status_code}")
            return False
        
        # Test 3: POST /api/products - No session
        response = self.session.post(f"{BASE_URL}/products", json={"nameAr": "منتج", "price": 10})
        if response.status_code == 401:
            print("✅ 3. POST /api/products (no auth) → 401")
        else:
            print(f"❌ 3. Expected 401, got {response.status_code}")
            return False
        
        # Test 4: POST /api/orders - No session
        response = self.session.post(f"{BASE_URL}/orders", json={"items": []})
        if response.status_code == 401 and "يجب تسجيل الدخول لإتمام الطلب" in response.json().get("error", ""):
            print("✅ 4. POST /api/orders (no auth) → 401 'يجب تسجيل الدخول لإتمام الطلب'")
        else:
            print(f"❌ 4. Expected 401, got {response.status_code}: {response.text}")
            return False
        
        # Test 5: GET /api/admin/vendor-applications - No session
        response = self.session.get(f"{BASE_URL}/admin/vendor-applications")
        if response.status_code == 401:
            print("✅ 5. GET /api/admin/vendor-applications (no auth) → 401")
        else:
            print(f"❌ 5. Expected 401, got {response.status_code}")
            return False
        
        return True

    def test_validation_endpoints(self):
        """Test endpoint validation without authentication"""
        print("\n✅ TESTING ENDPOINT VALIDATION...")
        
        # Test 1: GET /api/products/:id with invalid ID
        invalid_id = str(uuid.uuid4())
        response = self.session.get(f"{BASE_URL}/products/{invalid_id}")
        if response.status_code == 404 and "المنتج غير موجود" in response.json().get("error", ""):
            print("✅ 1. GET /api/products/:id (invalid) → 404 'المنتج غير موجود'")
        else:
            print(f"❌ 1. Expected 404, got {response.status_code}: {response.text}")
            return False
        
        # Test 2: GET /api/orders/:id with invalid ID
        response = self.session.get(f"{BASE_URL}/orders/{invalid_id}")
        if response.status_code == 401:  # Should be 401 first (no auth)
            print("✅ 2. GET /api/orders/:id (no auth) → 401")
        else:
            print(f"❌ 2. Expected 401, got {response.status_code}")
            return False
        
        return True

    def test_database_models(self):
        """Test database models and structure"""
        print("\n🗄️ TESTING DATABASE MODELS...")
        
        try:
            # Check collections exist
            collections = self.db.list_collection_names()
            required_collections = ['users', 'products', 'orders', 'vendorapplications']
            
            for collection in required_collections:
                if collection in collections:
                    print(f"✅ Collection '{collection}' exists")
                else:
                    print(f"❌ Collection '{collection}' missing")
                    return False
            
            # Check if we can query users
            user_count = self.db.users.count_documents({})
            print(f"✅ Users collection has {user_count} documents")
            
            # Check if we can query products
            product_count = self.db.products.count_documents({})
            print(f"✅ Products collection has {product_count} documents")
            
            # Check if we can query orders
            order_count = self.db.orders.count_documents({})
            print(f"✅ Orders collection has {order_count} documents")
            
            # Check if we can query vendor applications
            app_count = self.db.vendorapplications.count_documents({})
            print(f"✅ Vendor applications collection has {app_count} documents")
            
            return True
            
        except Exception as e:
            print(f"❌ Database error: {e}")
            return False

    def test_signup_endpoint(self):
        """Test signup endpoint functionality"""
        print("\n👤 TESTING SIGNUP ENDPOINT...")
        
        # Test 1: Valid signup
        test_email = f"test-{int(time.time())}@example.com"
        signup_data = {
            "name": "مستخدم تجريبي",
            "email": test_email,
            "password": "testpass123"
        }
        
        response = self.session.post(f"{BASE_URL}/signup", json=signup_data)
        if response.status_code == 200:
            result = response.json()
            if result.get("success") and result.get("user"):
                user_id = result["user"]["id"]
                print(f"✅ 1. Valid signup → 200 with user ID: {user_id}")
                
                # Verify user in database
                db_user = self.db.users.find_one({"_id": user_id})
                if db_user:
                    print("✅ 2. User stored in database correctly")
                    
                    # Clean up test user
                    self.db.users.delete_one({"_id": user_id})
                    print("✅ 3. Test user cleaned up")
                else:
                    print("❌ 2. User not found in database")
                    return False
            else:
                print(f"❌ 1. Invalid response: {result}")
                return False
        else:
            print(f"❌ 1. Expected 200, got {response.status_code}: {response.text}")
            return False
        
        # Test 2: Invalid signup (missing fields)
        response = self.session.post(f"{BASE_URL}/signup", json={"name": "Test"})
        if response.status_code == 400:
            print("✅ 4. Invalid signup (missing fields) → 400")
        else:
            print(f"❌ 4. Expected 400, got {response.status_code}")
            return False
        
        # Test 3: Invalid signup (short password)
        response = self.session.post(f"{BASE_URL}/signup", json={
            "name": "Test", "email": "test@example.com", "password": "123"
        })
        if response.status_code == 400 and "يجب أن تكون كلمة المرور 6 أحرف على الأقل" in response.json().get("error", ""):
            print("✅ 5. Short password → 400 'يجب أن تكون كلمة المرور 6 أحرف على الأقل'")
        else:
            print(f"❌ 5. Expected 400, got {response.status_code}: {response.text}")
            return False
        
        return True

    def run_all_tests(self):
        """Run all simplified tests"""
        print("🚀 STARTING SIMPLIFIED MARKETPLACE TESTING...")
        print("=" * 80)
        
        test_suites = [
            ("BASIC ENDPOINTS", self.test_basic_endpoints),
            ("AUTHENTICATION REQUIRED", self.test_authentication_required_endpoints),
            ("VALIDATION", self.test_validation_endpoints),
            ("DATABASE MODELS", self.test_database_models),
            ("SIGNUP ENDPOINT", self.test_signup_endpoint)
        ]
        
        passed_suites = 0
        total_suites = len(test_suites)
        
        for suite_name, test_func in test_suites:
            try:
                if test_func():
                    print(f"✅ {suite_name} SUITE PASSED")
                    passed_suites += 1
                else:
                    print(f"❌ {suite_name} SUITE FAILED")
            except Exception as e:
                print(f"❌ {suite_name} SUITE ERROR: {e}")
        
        print("\n" + "=" * 80)
        print(f"🎯 SIMPLIFIED TESTING COMPLETE: {passed_suites}/{total_suites} SUITES PASSED")
        
        if passed_suites == total_suites:
            print("🎉 MARKETPLACE ENDPOINTS BASIC FUNCTIONALITY VERIFIED!")
            return True
        else:
            print("⚠️  SOME BASIC FUNCTIONALITY HAS ISSUES")
            return False

    def cleanup(self):
        """Clean up"""
        try:
            self.mongo_client.close()
            print("🧹 Cleanup complete")
        except Exception as e:
            print(f"⚠️  Cleanup error: {e}")

if __name__ == "__main__":
    suite = SimplifiedMarketplaceTest()
    try:
        success = suite.run_all_tests()
        exit(0 if success else 1)
    finally:
        suite.cleanup()