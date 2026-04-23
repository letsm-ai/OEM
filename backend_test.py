#!/usr/bin/env python3
"""
Backend testing for Phase 5 - Multi-vendor Marketplace endpoints
Testing all vendor applications, products, orders, and vendor dashboard endpoints
"""

import requests
import json
import uuid
import time
from datetime import datetime, timedelta
import pymongo
import bcrypt
import os

# Configuration
BASE_URL = "https://omani-startup-hub.preview.emergentagent.com/api"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "majles"

# Test data
TEST_EMAIL_VENDOR = f"vendor-test-{int(time.time())}@example.com"
TEST_EMAIL_BUYER = f"buyer-test-{int(time.time())}@example.com"
TEST_EMAIL_ADMIN = f"admin-test-{int(time.time())}@example.com"
TEST_PASSWORD = "testpass123"

class MarketplaceTestSuite:
    def __init__(self):
        self.session = requests.Session()
        self.mongo_client = pymongo.MongoClient(MONGO_URL)
        self.db = self.mongo_client[DB_NAME]
        
        # Test user IDs and tokens
        self.vendor_id = None
        self.buyer_id = None
        self.admin_id = None
        self.vendor_token = None
        self.buyer_token = None
        self.admin_token = None
        
        # Test data IDs
        self.vendor_app_id = None
        self.product1_id = None
        self.product2_id = None
        self.order_id = None
        
        print("🧪 MARKETPLACE BACKEND TESTING SUITE INITIALIZED")
        print(f"📍 Base URL: {BASE_URL}")
        print(f"🗄️ Database: MongoDB {DB_NAME}")
        print()

    def setup_test_users(self):
        """Create test users with different roles and tiers"""
        print("👥 SETTING UP TEST USERS...")
        
        # Create vendor user (GOLD tier)
        vendor_data = {
            "name": "بائع تجريبي",
            "email": TEST_EMAIL_VENDOR,
            "password": TEST_PASSWORD
        }
        
        # Create buyer user (FREE tier)
        buyer_data = {
            "name": "مشتري تجريبي", 
            "email": TEST_EMAIL_BUYER,
            "password": TEST_PASSWORD
        }
        
        # Create admin user
        admin_data = {
            "name": "مسؤول تجريبي",
            "email": TEST_EMAIL_ADMIN,
            "password": TEST_PASSWORD
        }
        
        # Signup users
        for user_type, data in [("vendor", vendor_data), ("buyer", buyer_data), ("admin", admin_data)]:
            response = self.session.post(f"{BASE_URL}/signup", json=data)
            if response.status_code == 200:
                user_info = response.json()["user"]
                if user_type == "vendor":
                    self.vendor_id = user_info["id"]
                elif user_type == "buyer":
                    self.buyer_id = user_info["id"]
                elif user_type == "admin":
                    self.admin_id = user_info["id"]
                print(f"✅ {user_type} user created: {user_info['id']}")
            else:
                print(f"❌ Failed to create {user_type} user: {response.status_code}")
                return False
        
        # Upgrade vendor to GOLD tier and admin to ADMIN role via direct DB update
        try:
            # Update vendor to GOLD tier
            self.db.users.update_one(
                {"_id": self.vendor_id},
                {"$set": {"membershipTier": "GOLD"}}
            )
            print("✅ Vendor upgraded to GOLD tier")
            
            # Update admin role
            self.db.users.update_one(
                {"_id": self.admin_id},
                {"$set": {"role": "ADMIN"}}
            )
            print("✅ Admin role assigned")
            
        except Exception as e:
            print(f"❌ Failed to update user roles: {e}")
            return False
        
        return True

    def login_users(self):
        """Login all test users and get session tokens"""
        print("\n🔐 LOGGING IN TEST USERS...")
        
        # Get CSRF token first
        csrf_response = self.session.get(f"{BASE_URL}/auth/csrf")
        if csrf_response.status_code != 200:
            print(f"❌ Failed to get CSRF token: {csrf_response.status_code}")
            return False
        
        csrf_token = csrf_response.json().get("csrfToken")
        
        # Login each user
        for user_type, email in [("vendor", TEST_EMAIL_VENDOR), ("buyer", TEST_EMAIL_BUYER), ("admin", TEST_EMAIL_ADMIN)]:
            login_data = {
                "email": email,
                "password": TEST_PASSWORD,
                "csrfToken": csrf_token
            }
            
            response = self.session.post(f"{BASE_URL}/auth/callback/credentials", json=login_data)
            if response.status_code == 200:
                # Get session token from cookies
                session_token = None
                for cookie in self.session.cookies:
                    if cookie.name == "next-auth.session-token":
                        session_token = cookie.value
                        break
                
                if session_token:
                    if user_type == "vendor":
                        self.vendor_token = session_token
                    elif user_type == "buyer":
                        self.buyer_token = session_token
                    elif user_type == "admin":
                        self.admin_token = session_token
                    print(f"✅ {user_type} logged in successfully")
                else:
                    print(f"❌ No session token found for {user_type}")
                    return False
            else:
                print(f"❌ Failed to login {user_type}: {response.status_code}")
                return False
        
        return True

    def set_session_token(self, token):
        """Set session token for requests"""
        if token:
            self.session.cookies.set("next-auth.session-token", token)
        else:
            self.session.cookies.clear()

    def test_vendor_applications(self):
        """Test vendor application endpoints"""
        print("\n🏪 TESTING VENDOR APPLICATION ENDPOINTS...")
        
        # Test 1: POST /api/vendor/apply - No session
        self.set_session_token(None)
        response = self.session.post(f"{BASE_URL}/vendor/apply", json={"businessName": "متجر تجريبي"})
        if response.status_code == 401 and "غير مصرح" in response.json().get("error", ""):
            print("✅ 1. No session → 401 'غير مصرح'")
        else:
            print(f"❌ 1. Expected 401, got {response.status_code}: {response.text}")
            return False
        
        # Test 2: POST /api/vendor/apply - FREE tier (buyer)
        self.set_session_token(self.buyer_token)
        response = self.session.post(f"{BASE_URL}/vendor/apply", json={"businessName": "متجر تجريبي"})
        if response.status_code == 403 and "تحتاج إلى عضوية ذهبية أو بلاتينية للتقديم كبائع" in response.json().get("error", ""):
            print("✅ 2. FREE tier → 403 'تحتاج إلى عضوية ذهبية أو بلاتينية للتقديم كبائع'")
        else:
            print(f"❌ 2. Expected 403, got {response.status_code}: {response.text}")
            return False
        
        # Test 3: POST /api/vendor/apply - Missing businessName
        self.set_session_token(self.vendor_token)
        response = self.session.post(f"{BASE_URL}/vendor/apply", json={})
        if response.status_code == 400 and "اسم المتجر/النشاط مطلوب" in response.json().get("error", ""):
            print("✅ 3. Missing businessName → 400 'اسم المتجر/النشاط مطلوب'")
        else:
            print(f"❌ 3. Expected 400, got {response.status_code}: {response.text}")
            return False
        
        # Test 4: POST /api/vendor/apply - Valid application
        self.set_session_token(self.vendor_token)
        app_data = {
            "businessName": "متجر البائع التجريبي",
            "businessDescription": "متجر لبيع المنتجات التجريبية",
            "phone": "+968 9123 4567"
        }
        response = self.session.post(f"{BASE_URL}/vendor/apply", json=app_data)
        if response.status_code == 200:
            result = response.json()
            if result.get("success") and result.get("application", {}).get("status") == "PENDING":
                self.vendor_app_id = result["application"]["id"]
                print("✅ 4. Valid application → 200 with status=PENDING")
            else:
                print(f"❌ 4. Invalid response structure: {result}")
                return False
        else:
            print(f"❌ 4. Expected 200, got {response.status_code}: {response.text}")
            return False
        
        # Test 5: POST /api/vendor/apply - Duplicate application
        response = self.session.post(f"{BASE_URL}/vendor/apply", json=app_data)
        if response.status_code == 409 and "لديك طلب قيد المراجعة بالفعل" in response.json().get("error", ""):
            print("✅ 5. Duplicate application → 409 'لديك طلب قيد المراجعة بالفعل'")
        else:
            print(f"❌ 5. Expected 409, got {response.status_code}: {response.text}")
            return False
        
        # Test 6: GET /api/vendor/application
        response = self.session.get(f"{BASE_URL}/vendor/application")
        if response.status_code == 200:
            result = response.json()
            if result.get("application") and result["application"]["status"] == "PENDING":
                print("✅ 6. GET application → 200 with PENDING status")
            else:
                print(f"❌ 6. Invalid response: {result}")
                return False
        else:
            print(f"❌ 6. Expected 200, got {response.status_code}: {response.text}")
            return False
        
        # Test 7: GET /api/admin/vendor-applications - Non-admin
        self.set_session_token(self.buyer_token)
        response = self.session.get(f"{BASE_URL}/admin/vendor-applications?status=PENDING")
        if response.status_code == 403 and "صلاحيات مسؤول مطلوبة" in response.json().get("error", ""):
            print("✅ 7. Non-admin → 403 'صلاحيات مسؤول مطلوبة'")
        else:
            print(f"❌ 7. Expected 403, got {response.status_code}: {response.text}")
            return False
        
        # Test 8: GET /api/admin/vendor-applications - Admin
        self.set_session_token(self.admin_token)
        response = self.session.get(f"{BASE_URL}/admin/vendor-applications?status=PENDING")
        if response.status_code == 200:
            result = response.json()
            if isinstance(result, list) and len(result) >= 1:
                print("✅ 8. Admin can access applications → 200 with list")
            else:
                print(f"❌ 8. Invalid response: {result}")
                return False
        else:
            print(f"❌ 8. Expected 200, got {response.status_code}: {response.text}")
            return False
        
        # Test 9: POST /api/admin/vendor-applications/:id/approve
        if self.vendor_app_id:
            response = self.session.post(f"{BASE_URL}/admin/vendor-applications/{self.vendor_app_id}/approve", 
                                       json={"note": "طلب ممتاز"})
            if response.status_code == 200:
                # Verify user role changed to VENDOR
                vendor_user = self.db.users.find_one({"_id": self.vendor_id})
                if vendor_user and vendor_user.get("role") == "VENDOR":
                    print("✅ 9. Admin approve → 200, user role = VENDOR")
                else:
                    print(f"❌ 9. User role not updated: {vendor_user.get('role') if vendor_user else 'User not found'}")
                    return False
            else:
                print(f"❌ 9. Expected 200, got {response.status_code}: {response.text}")
                return False
        
        return True

    def test_products(self):
        """Test product endpoints"""
        print("\n📦 TESTING PRODUCT ENDPOINTS...")
        
        # Test 1: POST /api/products - No session
        self.set_session_token(None)
        product_data = {
            "nameAr": "منتج تجريبي",
            "price": 12.5,
            "category": "FOOD",
            "stock": 10
        }
        response = self.session.post(f"{BASE_URL}/products", json=product_data)
        if response.status_code == 401:
            print("✅ 1. No session → 401")
        else:
            print(f"❌ 1. Expected 401, got {response.status_code}")
            return False
        
        # Test 2: POST /api/products - Non-vendor
        self.set_session_token(self.buyer_token)
        response = self.session.post(f"{BASE_URL}/products", json=product_data)
        if response.status_code == 403 and "صلاحيات بائع مطلوبة" in response.json().get("error", ""):
            print("✅ 2. Non-vendor → 403 'صلاحيات بائع مطلوبة'")
        else:
            print(f"❌ 2. Expected 403, got {response.status_code}: {response.text}")
            return False
        
        # Test 3: POST /api/products - Invalid data
        self.set_session_token(self.vendor_token)
        invalid_data = {"nameAr": "ا", "price": -5, "category": "INVALID"}
        response = self.session.post(f"{BASE_URL}/products", json=invalid_data)
        if response.status_code == 400:
            error_msg = response.json().get("error", "")
            if "اسم المنتج مطلوب" in error_msg or "السعر غير صحيح" in error_msg or "الفئة غير صحيحة" in error_msg:
                print("✅ 3. Invalid data → 400 with Arabic error")
            else:
                print(f"❌ 3. Unexpected error message: {error_msg}")
                return False
        else:
            print(f"❌ 3. Expected 400, got {response.status_code}")
            return False
        
        # Test 4: POST /api/products - Valid product 1
        product1_data = {
            "nameAr": "عسل عماني طبيعي",
            "price": 10.0,
            "category": "FOOD",
            "stock": 5,
            "description": "عسل طبيعي من الجبال العمانية"
        }
        response = self.session.post(f"{BASE_URL}/products", json=product1_data)
        if response.status_code == 200:
            result = response.json()
            if result.get("success") and result.get("product"):
                self.product1_id = result["product"]["id"]
                print("✅ 4. Valid product 1 created → 200")
            else:
                print(f"❌ 4. Invalid response: {result}")
                return False
        else:
            print(f"❌ 4. Expected 200, got {response.status_code}: {response.text}")
            return False
        
        # Test 5: POST /api/products - Valid product 2
        product2_data = {
            "nameAr": "تمر عماني فاخر",
            "price": 20.0,
            "category": "FOOD",
            "stock": 5,
            "description": "تمر عماني من أجود الأنواع"
        }
        response = self.session.post(f"{BASE_URL}/products", json=product2_data)
        if response.status_code == 200:
            result = response.json()
            if result.get("success") and result.get("product"):
                self.product2_id = result["product"]["id"]
                print("✅ 5. Valid product 2 created → 200")
            else:
                print(f"❌ 5. Invalid response: {result}")
                return False
        else:
            print(f"❌ 5. Expected 200, got {response.status_code}: {response.text}")
            return False
        
        # Test 6: GET /api/products (public)
        self.set_session_token(None)
        response = self.session.get(f"{BASE_URL}/products")
        if response.status_code == 200:
            products = response.json()
            if isinstance(products, list) and len(products) >= 2:
                # Check if vendorName is populated
                has_vendor_name = any(p.get("vendorName") for p in products)
                if has_vendor_name:
                    print("✅ 6. Public products list → 200 with vendorName")
                else:
                    print("❌ 6. Products missing vendorName field")
                    return False
            else:
                print(f"❌ 6. Invalid products list: {products}")
                return False
        else:
            print(f"❌ 6. Expected 200, got {response.status_code}")
            return False
        
        # Test 7: GET /api/products?category=FOOD
        response = self.session.get(f"{BASE_URL}/products?category=FOOD")
        if response.status_code == 200:
            products = response.json()
            if isinstance(products, list):
                food_products = [p for p in products if p.get("category") == "FOOD"]
                if len(food_products) >= 2:
                    print("✅ 7. Category filter → 200 with FOOD products")
                else:
                    print(f"❌ 7. Not enough FOOD products: {len(food_products)}")
                    return False
            else:
                print(f"❌ 7. Invalid response: {products}")
                return False
        else:
            print(f"❌ 7. Expected 200, got {response.status_code}")
            return False
        
        # Test 8: GET /api/products/:id
        if self.product1_id:
            response = self.session.get(f"{BASE_URL}/products/{self.product1_id}")
            if response.status_code == 200:
                product = response.json()
                if product.get("nameAr") == "عسل عماني طبيعي":
                    print("✅ 8. Product detail → 200 with correct data")
                else:
                    print(f"❌ 8. Wrong product data: {product}")
                    return False
            else:
                print(f"❌ 8. Expected 200, got {response.status_code}")
                return False
        
        # Test 9: PUT /api/products/:id - Non-owner
        self.set_session_token(self.buyer_token)
        if self.product1_id:
            response = self.session.put(f"{BASE_URL}/products/{self.product1_id}", 
                                      json={"price": 15.0})
            if response.status_code == 403 and "لا يمكنك تعديل هذا المنتج" in response.json().get("error", ""):
                print("✅ 9. Non-owner update → 403 'لا يمكنك تعديل هذا المنتج'")
            else:
                print(f"❌ 9. Expected 403, got {response.status_code}: {response.text}")
                return False
        
        # Test 10: PUT /api/products/:id - Owner
        self.set_session_token(self.vendor_token)
        if self.product1_id:
            response = self.session.put(f"{BASE_URL}/products/{self.product1_id}", 
                                      json={"price": 15.0, "stock": 8})
            if response.status_code == 200:
                print("✅ 10. Owner update → 200")
            else:
                print(f"❌ 10. Expected 200, got {response.status_code}: {response.text}")
                return False
        
        # Test 11: GET /api/vendor/products
        response = self.session.get(f"{BASE_URL}/vendor/products")
        if response.status_code == 200:
            products = response.json()
            if isinstance(products, list) and len(products) >= 2:
                print("✅ 11. Vendor products → 200 with products list")
            else:
                print(f"❌ 11. Invalid vendor products: {products}")
                return False
        else:
            print(f"❌ 11. Expected 200, got {response.status_code}")
            return False
        
        return True

    def test_orders(self):
        """Test order endpoints - the most complex test"""
        print("\n🛒 TESTING ORDER ENDPOINTS...")
        
        # Test 1: POST /api/orders - No session
        self.set_session_token(None)
        order_data = {
            "items": [{"productId": self.product1_id, "quantity": 1}],
            "shippingAddress": {
                "name": "مشتري تجريبي",
                "phone": "+968 9876 5432",
                "addressLine": "شارع السلطان قابوس، مسقط"
            }
        }
        response = self.session.post(f"{BASE_URL}/orders", json=order_data)
        if response.status_code == 401 and "يجب تسجيل الدخول لإتمام الطلب" in response.json().get("error", ""):
            print("✅ 1. No session → 401 'يجب تسجيل الدخول لإتمام الطلب'")
        else:
            print(f"❌ 1. Expected 401, got {response.status_code}: {response.text}")
            return False
        
        # Test 2: POST /api/orders - Empty items
        self.set_session_token(self.buyer_token)
        empty_order = {
            "items": [],
            "shippingAddress": {
                "name": "مشتري تجريبي",
                "phone": "+968 9876 5432",
                "addressLine": "شارع السلطان قابوس، مسقط"
            }
        }
        response = self.session.post(f"{BASE_URL}/orders", json=empty_order)
        if response.status_code == 400 and "السلة فارغة" in response.json().get("error", ""):
            print("✅ 2. Empty items → 400 'السلة فارغة'")
        else:
            print(f"❌ 2. Expected 400, got {response.status_code}: {response.text}")
            return False
        
        # Test 3: POST /api/orders - Missing shipping address
        missing_address = {
            "items": [{"productId": self.product1_id, "quantity": 1}],
            "shippingAddress": {"name": ""}
        }
        response = self.session.post(f"{BASE_URL}/orders", json=missing_address)
        if response.status_code == 400 and "عنوان الشحن" in response.json().get("error", ""):
            print("✅ 3. Missing shipping address → 400 with Arabic error")
        else:
            print(f"❌ 3. Expected 400, got {response.status_code}: {response.text}")
            return False
        
        # Test 4: POST /api/orders - Invalid product
        invalid_product = {
            "items": [{"productId": str(uuid.uuid4()), "quantity": 1}],
            "shippingAddress": {
                "name": "مشتري تجريبي",
                "phone": "+968 9876 5432",
                "addressLine": "شارع السلطان قابوس، مسقط"
            }
        }
        response = self.session.post(f"{BASE_URL}/orders", json=invalid_product)
        if response.status_code == 409 and "بعض المنتجات لم تعد متاحة" in response.json().get("error", ""):
            print("✅ 4. Invalid product → 409 'بعض المنتجات لم تعد متاحة'")
        else:
            print(f"❌ 4. Expected 409, got {response.status_code}: {response.text}")
            return False
        
        # Test 5: POST /api/orders - Insufficient stock
        if self.product1_id:
            insufficient_stock = {
                "items": [{"productId": self.product1_id, "quantity": 100}],
                "shippingAddress": {
                    "name": "مشتري تجريبي",
                    "phone": "+968 9876 5432",
                    "addressLine": "شارع السلطان قابوس، مسقط"
                }
            }
            response = self.session.post(f"{BASE_URL}/orders", json=insufficient_stock)
            if response.status_code == 409 and "الكمية المتاحة" in response.json().get("error", ""):
                print("✅ 5. Insufficient stock → 409 with Arabic error")
            else:
                print(f"❌ 5. Expected 409, got {response.status_code}: {response.text}")
                return False
        
        # Test 6: POST /api/orders - Valid order (FREE buyer)
        valid_order = {
            "items": [
                {"productId": self.product1_id, "quantity": 2},
                {"productId": self.product2_id, "quantity": 1}
            ],
            "shippingAddress": {
                "name": "مشتري تجريبي",
                "phone": "+968 9876 5432",
                "governorate": "MUSCAT",
                "city": "مسقط",
                "addressLine": "شارع السلطان قابوس، مسقط",
                "notes": "يرجى التسليم في المساء"
            }
        }
        response = self.session.post(f"{BASE_URL}/orders", json=valid_order)
        if response.status_code == 200:
            result = response.json()
            # Verify calculations: 2*15 + 1*20 = 50 (subtotal)
            # FREE tier: 0% discount, 5% commission
            expected_subtotal = 50.0
            expected_discount = 0.0
            expected_commission = 2.5  # 5% of 50
            expected_total = 50.0
            
            if (result.get("subtotal") == expected_subtotal and
                result.get("discountAmount") == expected_discount and
                result.get("commissionAmount") == expected_commission and
                result.get("totalPaid") == expected_total and
                result.get("status") == "PAID"):
                self.order_id = result.get("id")
                print("✅ 6. Valid order (FREE) → 200 with correct calculations")
                print(f"   Subtotal: {result.get('subtotal')}, Discount: {result.get('discountAmount')}, Commission: {result.get('commissionAmount')}, Total: {result.get('totalPaid')}")
            else:
                print(f"❌ 6. Wrong calculations: {result}")
                return False
        else:
            print(f"❌ 6. Expected 200, got {response.status_code}: {response.text}")
            return False
        
        # Test 7: Verify stock reduction
        if self.product1_id:
            response = self.session.get(f"{BASE_URL}/products/{self.product1_id}")
            if response.status_code == 200:
                product = response.json()
                # Stock should be reduced: 8 - 2 = 6, salesCount should be 2
                if product.get("stock") == 6 and product.get("salesCount") == 2:
                    print("✅ 7. Stock reduction verified → stock=6, salesCount=2")
                else:
                    print(f"❌ 7. Wrong stock/sales: stock={product.get('stock')}, salesCount={product.get('salesCount')}")
                    return False
            else:
                print(f"❌ 7. Failed to get product: {response.status_code}")
                return False
        
        # Test 8: GET /api/orders (buyer's orders)
        response = self.session.get(f"{BASE_URL}/orders")
        if response.status_code == 200:
            orders = response.json()
            if isinstance(orders, list) and len(orders) >= 1:
                print("✅ 8. Buyer orders → 200 with orders list")
            else:
                print(f"❌ 8. Invalid orders list: {orders}")
                return False
        else:
            print(f"❌ 8. Expected 200, got {response.status_code}")
            return False
        
        # Test 9: GET /api/orders/:id (buyer access)
        if self.order_id:
            response = self.session.get(f"{BASE_URL}/orders/{self.order_id}")
            if response.status_code == 200:
                order = response.json()
                if order.get("id") == self.order_id:
                    print("✅ 9. Order detail (buyer) → 200")
                else:
                    print(f"❌ 9. Wrong order: {order}")
                    return False
            else:
                print(f"❌ 9. Expected 200, got {response.status_code}")
                return False
        
        # Test 10: GET /api/orders/:id (unrelated user)
        self.set_session_token(self.admin_token)
        if self.order_id:
            response = self.session.get(f"{BASE_URL}/orders/{self.order_id}")
            if response.status_code == 200:  # Admin can see all orders
                print("✅ 10. Order detail (admin) → 200")
            else:
                print(f"❌ 10. Expected 200, got {response.status_code}")
                return False
        
        # Test 11: GET /api/vendor/orders
        self.set_session_token(self.vendor_token)
        response = self.session.get(f"{BASE_URL}/vendor/orders")
        if response.status_code == 200:
            result = response.json()
            if result.get("orders") and result.get("earnings"):
                earnings = result["earnings"]
                # Check earnings calculation
                if (earnings.get("totalSales") >= 50 and
                    earnings.get("totalCommission") >= 2.5 and
                    earnings.get("commissionPercent") == 5):
                    print("✅ 11. Vendor orders → 200 with earnings")
                    print(f"   Earnings: sales={earnings.get('totalSales')}, commission={earnings.get('totalCommission')}")
                else:
                    print(f"❌ 11. Wrong earnings: {earnings}")
                    return False
            else:
                print(f"❌ 11. Invalid vendor orders response: {result}")
                return False
        else:
            print(f"❌ 11. Expected 200, got {response.status_code}")
            return False
        
        # Test 12: PATCH /api/vendor/orders/:id/status
        if self.order_id:
            response = self.session.patch(f"{BASE_URL}/vendor/orders/{self.order_id}/status",
                                        json={"status": "SHIPPED"})
            if response.status_code == 200:
                print("✅ 12. Vendor status update → 200")
            else:
                print(f"❌ 12. Expected 200, got {response.status_code}: {response.text}")
                return False
        
        return True

    def test_regressions(self):
        """Test regression endpoints"""
        print("\n🔄 TESTING REGRESSION ENDPOINTS...")
        
        # Test 1: GET /api/
        self.set_session_token(None)
        response = self.session.get(f"{BASE_URL}/")
        if response.status_code == 200 and "Majles API is running" in response.json().get("message", ""):
            print("✅ 1. GET /api/ → 200 'Majles API is running'")
        else:
            print(f"❌ 1. Expected 200, got {response.status_code}: {response.text}")
            return False
        
        # Test 2: POST /api/signup fresh
        fresh_email = f"fresh-{int(time.time())}@example.com"
        signup_data = {
            "name": "مستخدم جديد",
            "email": fresh_email,
            "password": "newpass123"
        }
        response = self.session.post(f"{BASE_URL}/signup", json=signup_data)
        if response.status_code == 200:
            print("✅ 2. POST /api/signup fresh → 200")
        else:
            print(f"❌ 2. Expected 200, got {response.status_code}: {response.text}")
            return False
        
        return True

    def run_all_tests(self):
        """Run all marketplace tests"""
        print("🚀 STARTING MARKETPLACE BACKEND TESTING...")
        print("=" * 80)
        
        # Setup
        if not self.setup_test_users():
            print("❌ FAILED: User setup")
            return False
        
        if not self.login_users():
            print("❌ FAILED: User login")
            return False
        
        # Test suites
        test_suites = [
            ("VENDOR APPLICATIONS", self.test_vendor_applications),
            ("PRODUCTS", self.test_products),
            ("ORDERS & CHECKOUT", self.test_orders),
            ("REGRESSIONS", self.test_regressions)
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
        print(f"🎯 MARKETPLACE TESTING COMPLETE: {passed_suites}/{total_suites} SUITES PASSED")
        
        if passed_suites == total_suites:
            print("🎉 ALL MARKETPLACE ENDPOINTS WORKING CORRECTLY!")
            return True
        else:
            print("⚠️  SOME MARKETPLACE ENDPOINTS HAVE ISSUES")
            return False

    def cleanup(self):
        """Clean up test data"""
        try:
            # Clean up test users and related data
            test_emails = [TEST_EMAIL_VENDOR, TEST_EMAIL_BUYER, TEST_EMAIL_ADMIN]
            self.db.users.delete_many({"email": {"$in": test_emails}})
            
            if self.vendor_id:
                self.db.vendorapplications.delete_many({"userId": self.vendor_id})
                self.db.products.delete_many({"vendorId": self.vendor_id})
            
            if self.buyer_id:
                self.db.orders.delete_many({"buyerId": self.buyer_id})
            
            print("🧹 Test data cleaned up")
        except Exception as e:
            print(f"⚠️  Cleanup error: {e}")
        finally:
            self.mongo_client.close()

if __name__ == "__main__":
    suite = MarketplaceTestSuite()
    try:
        success = suite.run_all_tests()
        exit(0 if success else 1)
    finally:
        suite.cleanup()