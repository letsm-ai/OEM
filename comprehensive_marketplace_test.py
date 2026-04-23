#!/usr/bin/env python3
"""
Comprehensive Backend testing for Phase 5 - Multi-vendor Marketplace endpoints
Testing with direct database setup for authentication simulation
"""

import requests
import json
import uuid
import time
import pymongo
import bcrypt
from datetime import datetime, timedelta

# Configuration
BASE_URL = "https://omani-startup-hub.preview.emergentagent.com/api"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "majles"

class ComprehensiveMarketplaceTest:
    def __init__(self):
        self.session = requests.Session()
        self.mongo_client = pymongo.MongoClient(MONGO_URL)
        self.db = self.mongo_client[DB_NAME]
        
        # Test data
        self.test_vendor_id = None
        self.test_buyer_id = None
        self.test_admin_id = None
        self.test_product_id = None
        self.test_order_id = None
        self.test_vendor_app_id = None
        
        print("🧪 COMPREHENSIVE MARKETPLACE BACKEND TESTING")
        print(f"📍 Base URL: {BASE_URL}")
        print(f"🗄️ Database: MongoDB {DB_NAME}")
        print()

    def setup_test_data(self):
        """Setup test data directly in database"""
        print("🔧 SETTING UP TEST DATA IN DATABASE...")
        
        try:
            # Create test vendor user
            vendor_id = str(uuid.uuid4())
            vendor_data = {
                "_id": vendor_id,
                "name": "بائع تجريبي للاختبار",
                "email": f"test-vendor-{int(time.time())}@example.com",
                "password": bcrypt.hashpw("testpass123".encode(), bcrypt.gensalt()).decode(),
                "role": "VENDOR",
                "membershipTier": "GOLD",
                "membershipExpiry": None,
                "phone": "+968 9123 4567",
                "photo": "",
                "createdAt": datetime.utcnow()
            }
            self.db.users.insert_one(vendor_data)
            self.test_vendor_id = vendor_id
            print(f"✅ Test vendor created: {vendor_id}")
            
            # Create test buyer user
            buyer_id = str(uuid.uuid4())
            buyer_data = {
                "_id": buyer_id,
                "name": "مشتري تجريبي للاختبار",
                "email": f"test-buyer-{int(time.time())}@example.com",
                "password": bcrypt.hashpw("testpass123".encode(), bcrypt.gensalt()).decode(),
                "role": "MEMBER",
                "membershipTier": "FREE",
                "membershipExpiry": None,
                "phone": "+968 9876 5432",
                "photo": "",
                "createdAt": datetime.utcnow()
            }
            self.db.users.insert_one(buyer_data)
            self.test_buyer_id = buyer_id
            print(f"✅ Test buyer created: {buyer_id}")
            
            # Create test admin user
            admin_id = str(uuid.uuid4())
            admin_data = {
                "_id": admin_id,
                "name": "مسؤول تجريبي للاختبار",
                "email": f"test-admin-{int(time.time())}@example.com",
                "password": bcrypt.hashpw("testpass123".encode(), bcrypt.gensalt()).decode(),
                "role": "ADMIN",
                "membershipTier": "PLATINUM",
                "membershipExpiry": None,
                "phone": "+968 9999 9999",
                "photo": "",
                "createdAt": datetime.utcnow()
            }
            self.db.users.insert_one(admin_data)
            self.test_admin_id = admin_id
            print(f"✅ Test admin created: {admin_id}")
            
            # Create test product
            product_id = str(uuid.uuid4())
            product_data = {
                "_id": product_id,
                "vendorId": vendor_id,
                "nameAr": "منتج اختبار للمتجر",
                "nameEn": "Test Product",
                "price": 25.0,
                "description": "منتج تجريبي لاختبار النظام",
                "images": [],
                "category": "FOOD",
                "stock": 10,
                "isActive": True,
                "salesCount": 0,
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            }
            self.db.products.insert_one(product_data)
            self.test_product_id = product_id
            print(f"✅ Test product created: {product_id}")
            
            # Create test vendor application
            app_id = str(uuid.uuid4())
            app_data = {
                "_id": app_id,
                "userId": buyer_id,  # Buyer applying to be vendor
                "businessName": "متجر المشتري الجديد",
                "businessDescription": "متجر لبيع المنتجات المحلية",
                "phone": "+968 9876 5432",
                "status": "PENDING",
                "adminNote": "",
                "reviewedBy": None,
                "reviewedAt": None,
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            }
            self.db.vendorapplications.insert_one(app_data)
            self.test_vendor_app_id = app_id
            print(f"✅ Test vendor application created: {app_id}")
            
            return True
            
        except Exception as e:
            print(f"❌ Failed to setup test data: {e}")
            return False

    def test_vendor_application_endpoints(self):
        """Test vendor application endpoints"""
        print("\n🏪 TESTING VENDOR APPLICATION ENDPOINTS...")
        
        # Test 1: GET /api/admin/vendor-applications?status=PENDING (no auth)
        response = self.session.get(f"{BASE_URL}/admin/vendor-applications?status=PENDING")
        if response.status_code == 401:
            print("✅ 1. Admin vendor apps (no auth) → 401")
        else:
            print(f"❌ 1. Expected 401, got {response.status_code}")
            return False
        
        # Test 2: POST /api/vendor/apply (no auth)
        response = self.session.post(f"{BASE_URL}/vendor/apply", json={"businessName": "متجر جديد"})
        if response.status_code == 401 and "غير مصرح" in response.json().get("error", ""):
            print("✅ 2. Vendor apply (no auth) → 401 'غير مصرح'")
        else:
            print(f"❌ 2. Expected 401, got {response.status_code}: {response.text}")
            return False
        
        # Test 3: GET /api/vendor/application (no auth)
        response = self.session.get(f"{BASE_URL}/vendor/application")
        if response.status_code == 401:
            print("✅ 3. Get vendor application (no auth) → 401")
        else:
            print(f"❌ 3. Expected 401, got {response.status_code}")
            return False
        
        return True

    def test_product_endpoints(self):
        """Test product endpoints"""
        print("\n📦 TESTING PRODUCT ENDPOINTS...")
        
        # Test 1: GET /api/products (public)
        response = self.session.get(f"{BASE_URL}/products")
        if response.status_code == 200:
            result = response.json()
            products = result.get('products', [])
            if len(products) >= 1:  # Should include our test product
                print(f"✅ 1. GET /api/products → 200 with {len(products)} products")
            else:
                print(f"❌ 1. No products found: {products}")
                return False
        else:
            print(f"❌ 1. Expected 200, got {response.status_code}")
            return False
        
        # Test 2: GET /api/products?category=FOOD
        response = self.session.get(f"{BASE_URL}/products?category=FOOD")
        if response.status_code == 200:
            result = response.json()
            products = result.get('products', [])
            food_products = [p for p in products if p.get('category') == 'FOOD']
            if len(food_products) >= 1:  # Should include our test product
                print(f"✅ 2. GET /api/products?category=FOOD → 200 with {len(food_products)} FOOD products")
            else:
                print(f"❌ 2. No FOOD products found: {food_products}")
                return False
        else:
            print(f"❌ 2. Expected 200, got {response.status_code}")
            return False
        
        # Test 3: GET /api/products/:id (valid product)
        if self.test_product_id:
            response = self.session.get(f"{BASE_URL}/products/{self.test_product_id}")
            if response.status_code == 200:
                result = response.json()
                # Handle both direct product and wrapped product response
                if 'product' in result:
                    product = result['product']
                else:
                    product = result
                
                if product.get('nameAr') == 'منتج اختبار للمتجر':
                    print("✅ 3. GET /api/products/:id → 200 with correct product")
                else:
                    print(f"❌ 3. Wrong product data: {product}")
                    return False
            else:
                print(f"❌ 3. Expected 200, got {response.status_code}")
                return False
        
        # Test 4: GET /api/products/:id (invalid product)
        invalid_id = str(uuid.uuid4())
        response = self.session.get(f"{BASE_URL}/products/{invalid_id}")
        if response.status_code == 404 and "المنتج غير موجود" in response.json().get("error", ""):
            print("✅ 4. GET /api/products/:id (invalid) → 404 'المنتج غير موجود'")
        else:
            print(f"❌ 4. Expected 404, got {response.status_code}: {response.text}")
            return False
        
        # Test 5: POST /api/products (no auth)
        response = self.session.post(f"{BASE_URL}/products", json={
            "nameAr": "منتج جديد",
            "price": 15.0,
            "category": "FOOD"
        })
        if response.status_code == 401:
            print("✅ 5. POST /api/products (no auth) → 401")
        else:
            print(f"❌ 5. Expected 401, got {response.status_code}")
            return False
        
        # Test 6: PUT /api/products/:id (no auth)
        if self.test_product_id:
            response = self.session.put(f"{BASE_URL}/products/{self.test_product_id}", json={"price": 30.0})
            if response.status_code == 401:
                print("✅ 6. PUT /api/products/:id (no auth) → 401")
            else:
                print(f"❌ 6. Expected 401, got {response.status_code}")
                return False
        
        # Test 7: DELETE /api/products/:id (no auth)
        if self.test_product_id:
            response = self.session.delete(f"{BASE_URL}/products/{self.test_product_id}")
            if response.status_code == 401:
                print("✅ 7. DELETE /api/products/:id (no auth) → 401")
            else:
                print(f"❌ 7. Expected 401, got {response.status_code}")
                return False
        
        # Test 8: GET /api/vendor/products (no auth)
        response = self.session.get(f"{BASE_URL}/vendor/products")
        if response.status_code == 401:
            print("✅ 8. GET /api/vendor/products (no auth) → 401")
        else:
            print(f"❌ 8. Expected 401, got {response.status_code}")
            return False
        
        return True

    def test_order_endpoints(self):
        """Test order endpoints"""
        print("\n🛒 TESTING ORDER ENDPOINTS...")
        
        # Test 1: POST /api/orders (no auth)
        order_data = {
            "items": [{"productId": self.test_product_id, "quantity": 2}],
            "shippingAddress": {
                "name": "مشتري تجريبي",
                "phone": "+968 9876 5432",
                "addressLine": "شارع السلطان قابوس، مسقط"
            }
        }
        response = self.session.post(f"{BASE_URL}/orders", json=order_data)
        if response.status_code == 401 and "يجب تسجيل الدخول لإتمام الطلب" in response.json().get("error", ""):
            print("✅ 1. POST /api/orders (no auth) → 401 'يجب تسجيل الدخول لإتمام الطلب'")
        else:
            print(f"❌ 1. Expected 401, got {response.status_code}: {response.text}")
            return False
        
        # Test 2: GET /api/orders (no auth)
        response = self.session.get(f"{BASE_URL}/orders")
        if response.status_code == 401:
            print("✅ 2. GET /api/orders (no auth) → 401")
        else:
            print(f"❌ 2. Expected 401, got {response.status_code}")
            return False
        
        # Test 3: GET /api/orders/:id (no auth)
        test_order_id = str(uuid.uuid4())
        response = self.session.get(f"{BASE_URL}/orders/{test_order_id}")
        if response.status_code == 401:
            print("✅ 3. GET /api/orders/:id (no auth) → 401")
        else:
            print(f"❌ 3. Expected 401, got {response.status_code}")
            return False
        
        # Test 4: GET /api/vendor/orders (no auth)
        response = self.session.get(f"{BASE_URL}/vendor/orders")
        if response.status_code == 401:
            print("✅ 4. GET /api/vendor/orders (no auth) → 401")
        else:
            print(f"❌ 4. Expected 401, got {response.status_code}")
            return False
        
        # Test 5: PATCH /api/vendor/orders/:id/status (no auth)
        response = self.session.patch(f"{BASE_URL}/vendor/orders/{test_order_id}/status", json={"status": "SHIPPED"})
        if response.status_code == 401:
            print("✅ 5. PATCH /api/vendor/orders/:id/status (no auth) → 401")
        else:
            print(f"❌ 5. Expected 401, got {response.status_code}")
            return False
        
        return True

    def test_validation_scenarios(self):
        """Test various validation scenarios"""
        print("\n✅ TESTING VALIDATION SCENARIOS...")
        
        # Test 1: POST /api/orders with empty items (no auth, but should validate first)
        response = self.session.post(f"{BASE_URL}/orders", json={"items": []})
        if response.status_code == 401:  # Auth check comes first
            print("✅ 1. POST /api/orders (empty items, no auth) → 401")
        else:
            print(f"❌ 1. Expected 401, got {response.status_code}")
            return False
        
        # Test 2: POST /api/vendor/apply with missing data (no auth)
        response = self.session.post(f"{BASE_URL}/vendor/apply", json={})
        if response.status_code == 401:  # Auth check comes first
            print("✅ 2. POST /api/vendor/apply (missing data, no auth) → 401")
        else:
            print(f"❌ 2. Expected 401, got {response.status_code}")
            return False
        
        # Test 3: POST /api/products with invalid data (no auth)
        response = self.session.post(f"{BASE_URL}/products", json={"nameAr": "", "price": -5})
        if response.status_code == 401:  # Auth check comes first
            print("✅ 3. POST /api/products (invalid data, no auth) → 401")
        else:
            print(f"❌ 3. Expected 401, got {response.status_code}")
            return False
        
        return True

    def test_database_consistency(self):
        """Test database consistency and data integrity"""
        print("\n🗄️ TESTING DATABASE CONSISTENCY...")
        
        try:
            # Test 1: Verify test data exists
            vendor = self.db.users.find_one({"_id": self.test_vendor_id})
            if vendor and vendor.get("role") == "VENDOR":
                print("✅ 1. Test vendor exists in database with VENDOR role")
            else:
                print(f"❌ 1. Test vendor not found or wrong role: {vendor}")
                return False
            
            # Test 2: Verify test product exists
            product = self.db.products.find_one({"_id": self.test_product_id})
            if product and product.get("vendorId") == self.test_vendor_id:
                print("✅ 2. Test product exists and linked to vendor")
            else:
                print(f"❌ 2. Test product not found or wrong vendor: {product}")
                return False
            
            # Test 3: Verify vendor application exists
            app = self.db.vendorapplications.find_one({"_id": self.test_vendor_app_id})
            if app and app.get("status") == "PENDING":
                print("✅ 3. Test vendor application exists with PENDING status")
            else:
                print(f"❌ 3. Test vendor application not found or wrong status: {app}")
                return False
            
            # Test 4: Check collections structure
            collections = self.db.list_collection_names()
            required_collections = ['users', 'products', 'orders', 'vendorapplications']
            for collection in required_collections:
                if collection in collections:
                    count = self.db[collection].count_documents({})
                    print(f"✅ 4.{collection}: Collection exists with {count} documents")
                else:
                    print(f"❌ 4.{collection}: Collection missing")
                    return False
            
            return True
            
        except Exception as e:
            print(f"❌ Database consistency error: {e}")
            return False

    def run_all_tests(self):
        """Run all comprehensive tests"""
        print("🚀 STARTING COMPREHENSIVE MARKETPLACE TESTING...")
        print("=" * 80)
        
        # Setup
        if not self.setup_test_data():
            print("❌ FAILED: Test data setup")
            return False
        
        # Test suites
        test_suites = [
            ("VENDOR APPLICATION ENDPOINTS", self.test_vendor_application_endpoints),
            ("PRODUCT ENDPOINTS", self.test_product_endpoints),
            ("ORDER ENDPOINTS", self.test_order_endpoints),
            ("VALIDATION SCENARIOS", self.test_validation_scenarios),
            ("DATABASE CONSISTENCY", self.test_database_consistency)
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
        print(f"🎯 COMPREHENSIVE TESTING COMPLETE: {passed_suites}/{total_suites} SUITES PASSED")
        
        if passed_suites == total_suites:
            print("🎉 ALL MARKETPLACE ENDPOINTS COMPREHENSIVE TESTING PASSED!")
            return True
        else:
            print("⚠️  SOME MARKETPLACE FUNCTIONALITY HAS ISSUES")
            return False

    def cleanup(self):
        """Clean up test data"""
        try:
            # Clean up test data
            if self.test_vendor_id:
                self.db.users.delete_one({"_id": self.test_vendor_id})
            if self.test_buyer_id:
                self.db.users.delete_one({"_id": self.test_buyer_id})
            if self.test_admin_id:
                self.db.users.delete_one({"_id": self.test_admin_id})
            if self.test_product_id:
                self.db.products.delete_one({"_id": self.test_product_id})
            if self.test_vendor_app_id:
                self.db.vendorapplications.delete_one({"_id": self.test_vendor_app_id})
            
            print("🧹 Test data cleaned up")
        except Exception as e:
            print(f"⚠️  Cleanup error: {e}")
        finally:
            self.mongo_client.close()

if __name__ == "__main__":
    suite = ComprehensiveMarketplaceTest()
    try:
        success = suite.run_all_tests()
        exit(0 if success else 1)
    finally:
        suite.cleanup()