#!/usr/bin/env python3
"""
Phase C Backend Testing - Comprehensive test for all 5 refactored modules:
1. Cart endpoints + abandoned cart cron
2. Vendor analytics (full KPI dashboard)
3. Vendor promotions (BUY_X_GET_Y, TIER types)
4. Inventory management + CSV import + stock movements
5. Vendor product CRUD

Testing against: https://omani-startup-hub.preview.emergentagent.com/api
"""

import requests
import json
import time
import uuid
import base64
from datetime import datetime, timedelta

# Configuration
BASE_URL = "https://omani-startup-hub.preview.emergentagent.com/api"
CRON_SECRET = "fcb09a9f909c3ea848c026041b3b3d3069beba9da6848e56"

class PhaseCtester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'Phase-C-Backend-Tester/1.0'
        })
        self.vendor_session = None
        self.admin_session = None
        self.test_product_id = None
        self.test_promotion_id = None
        
    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")
        
    def create_test_user(self, role="VENDOR"):
        """Create a fresh test user with timestamped email"""
        timestamp = int(time.time())
        email = f"phasec_{role.lower()}_{timestamp}@test.com"
        password = "Password123"
        
        # Create user
        signup_data = {
            "name": f"Phase C {role} User",
            "email": email,
            "password": password
        }
        
        response = self.session.post(f"{BASE_URL}/signup", json=signup_data)
        if response.status_code != 200:
            raise Exception(f"Failed to create user: {response.text}")
            
        # Login to get session
        login_data = {"email": email, "password": password}
        csrf_response = self.session.get(f"{BASE_URL}/auth/csrf")
        csrf_token = csrf_response.json().get('csrfToken')
        
        login_response = self.session.post(
            f"{BASE_URL}/auth/callback/credentials",
            data={
                "email": email,
                "password": password,
                "csrfToken": csrf_token,
                "callbackUrl": "/",
                "json": "true"
            },
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )
        
        if login_response.status_code != 200:
            raise Exception(f"Failed to login: {login_response.text}")
            
        # Get session cookies
        session_cookies = {}
        for cookie in self.session.cookies:
            session_cookies[cookie.name] = cookie.value
            
        return {
            "email": email,
            "password": password,
            "user_id": response.json()["user"]["id"],
            "cookies": session_cookies
        }
        
    def setup_test_data(self):
        """Setup test users and promote to required roles"""
        self.log("Setting up test data...")
        
        # Create vendor user
        vendor_user = self.create_test_user("VENDOR")
        self.vendor_session = requests.Session()
        self.vendor_session.cookies.update(vendor_user["cookies"])
        self.vendor_session.headers.update({'Content-Type': 'application/json'})
        
        # Create admin user  
        admin_user = self.create_test_user("ADMIN")
        self.admin_session = requests.Session()
        self.admin_session.cookies.update(admin_user["cookies"])
        self.admin_session.headers.update({'Content-Type': 'application/json'})
        
        # Promote users via direct MongoDB (using pymongo)
        try:
            import pymongo
            client = pymongo.MongoClient("mongodb://localhost:27017/")
            db = client["majles"]
            
            # Promote vendor user to VENDOR role
            db.users.update_one(
                {"_id": vendor_user["user_id"]},
                {"$set": {"role": "VENDOR", "membershipTier": "GOLD"}}
            )
            
            # Promote admin user to ADMIN role
            db.users.update_one(
                {"_id": admin_user["user_id"]},
                {"$set": {"role": "ADMIN", "membershipTier": "PLATINUM"}}
            )
            
            self.log(f"✅ Created vendor user: {vendor_user['email']}")
            self.log(f"✅ Created admin user: {admin_user['email']}")
            
            client.close()
            
        except ImportError:
            self.log("⚠️ pymongo not available, using API promotion")
            # Alternative: use API endpoints if available
            
        return vendor_user, admin_user

    def test_cart_endpoints(self):
        """Test cart upsert/get/clear endpoints"""
        self.log("\n🛒 TESTING CART ENDPOINTS")
        
        try:
            # Test 1: POST /api/cart (upsert)
            cart_data = {
                "items": [
                    {
                        "productId": str(uuid.uuid4()),
                        "quantity": 2,
                        "nameAr": "منتج تجريبي للسلة",
                        "unitPrice": 15.5,
                        "image": "data:image/png;base64,test"
                    },
                    {
                        "productId": str(uuid.uuid4()),
                        "quantity": 1,
                        "nameAr": "منتج آخر",
                        "unitPrice": 25.0,
                        "image": ""
                    }
                ]
            }
            
            response = self.vendor_session.post(f"{BASE_URL}/cart", json=cart_data)
            assert response.status_code == 200, f"Cart upsert failed: {response.text}"
            result = response.json()
            assert result["success"] == True
            assert result["count"] == 2
            self.log("✅ C1: POST /api/cart (upsert) → 200 with success=true, count=2")
            
            # Test 2: GET /api/cart
            response = self.vendor_session.get(f"{BASE_URL}/cart")
            assert response.status_code == 200, f"Cart get failed: {response.text}"
            result = response.json()
            assert "items" in result
            assert len(result["items"]) == 2
            self.log("✅ C2: GET /api/cart → 200 with items array (2 items)")
            
            # Test 3: DELETE /api/cart (clear)
            response = self.vendor_session.delete(f"{BASE_URL}/cart")
            assert response.status_code == 200, f"Cart clear failed: {response.text}"
            result = response.json()
            assert result["success"] == True
            self.log("✅ C3: DELETE /api/cart → 200 with success=true")
            
            # Test 4: GET /api/cart (after clear)
            response = self.vendor_session.get(f"{BASE_URL}/cart")
            assert response.status_code == 200
            result = response.json()
            assert len(result["items"]) == 0
            self.log("✅ C4: GET /api/cart (after clear) → 200 with empty items array")
            
            # Test 5: Unauthenticated cart access
            response = self.session.get(f"{BASE_URL}/cart")
            assert response.status_code == 200
            result = response.json()
            assert result["items"] == []
            self.log("✅ C5: GET /api/cart (unauthenticated) → 200 with empty items")
            
        except Exception as e:
            self.log(f"❌ Cart endpoints test failed: {str(e)}")
            return False
            
        return True

    def test_abandoned_cart_cron(self):
        """Test abandoned cart cron endpoint"""
        self.log("\n📧 TESTING ABANDONED CART CRON")
        
        try:
            # Test 1: No authorization header
            response = self.session.post(f"{BASE_URL}/cron/abandoned-carts")
            assert response.status_code == 401, f"Expected 401, got {response.status_code}"
            result = response.json()
            assert "غير مصرح" in result.get("error", "")
            self.log("✅ AC1: POST /api/cron/abandoned-carts (no auth) → 401 'غير مصرح'")
            
            # Test 2: Wrong cron key
            headers = {"X-CRON-KEY": "wrong-key"}
            response = self.session.post(f"{BASE_URL}/cron/abandoned-carts", headers=headers)
            assert response.status_code == 401
            self.log("✅ AC2: POST /api/cron/abandoned-carts (wrong key) → 401")
            
            # Test 3: Correct cron key
            headers = {"X-CRON-KEY": CRON_SECRET}
            response = self.session.post(f"{BASE_URL}/cron/abandoned-carts", headers=headers)
            assert response.status_code == 200, f"Cron failed: {response.text}"
            result = response.json()
            assert result["success"] == True
            assert "candidates" in result
            assert "sent" in result
            self.log(f"✅ AC3: POST /api/cron/abandoned-carts (correct key) → 200 with candidates={result['candidates']}, sent={result['sent']}")
            
            # Test 4: Admin session authorization
            response = self.admin_session.post(f"{BASE_URL}/cron/abandoned-carts")
            assert response.status_code == 200
            result = response.json()
            assert result["success"] == True
            self.log("✅ AC4: POST /api/cron/abandoned-carts (admin session) → 200")
            
        except Exception as e:
            self.log(f"❌ Abandoned cart cron test failed: {str(e)}")
            return False
            
        return True

    def test_vendor_analytics(self):
        """Test vendor analytics endpoint"""
        self.log("\n📊 TESTING VENDOR ANALYTICS")
        
        try:
            # Test 1: Unauthenticated request
            response = self.session.get(f"{BASE_URL}/vendor/analytics")
            assert response.status_code == 401
            self.log("✅ VA1: GET /api/vendor/analytics (no auth) → 401")
            
            # Test 2: Non-vendor user (using regular session)
            regular_user = self.create_test_user("MEMBER")
            regular_session = requests.Session()
            regular_session.cookies.update(regular_user["cookies"])
            regular_session.headers.update({'Content-Type': 'application/json'})
            
            response = regular_session.get(f"{BASE_URL}/vendor/analytics")
            assert response.status_code == 403
            result = response.json()
            assert "صلاحيات بائع مطلوبة" in result.get("error", "")
            self.log("✅ VA2: GET /api/vendor/analytics (non-vendor) → 403 'صلاحيات بائع مطلوبة'")
            
            # Test 3: Vendor analytics (full payload)
            response = self.vendor_session.get(f"{BASE_URL}/vendor/analytics")
            assert response.status_code == 200, f"Vendor analytics failed: {response.text}"
            result = response.json()
            
            # Validate payload structure
            required_fields = [
                "generatedAt", "kpi", "last30Days", "products", 
                "pendingShipments", "monthly", "topProducts", 
                "byCategory", "orderStatus"
            ]
            for field in required_fields:
                assert field in result, f"Missing field: {field}"
                
            # Validate KPI structure
            kpi = result["kpi"]
            kpi_fields = [
                "totalRevenue", "totalUnits", "totalOrders", 
                "totalCommission", "totalNet", "commissionPercent", "avgOrderValue"
            ]
            for field in kpi_fields:
                assert field in kpi, f"Missing KPI field: {field}"
                
            # Validate monthly array (should have 12 entries)
            assert len(result["monthly"]) == 12, f"Expected 12 monthly entries, got {len(result['monthly'])}"
            
            # Validate monthly structure
            for month in result["monthly"]:
                assert "key" in month
                assert "year" in month
                assert "month" in month
                assert "revenue" in month
                assert "orders" in month
                assert "units" in month
                
            self.log(f"✅ VA3: GET /api/vendor/analytics (vendor) → 200 with complete payload")
            self.log(f"    • totalRevenue: {kpi['totalRevenue']}")
            self.log(f"    • totalOrders: {kpi['totalOrders']}")
            self.log(f"    • totalUnits: {kpi['totalUnits']}")
            self.log(f"    • commissionPercent: {kpi['commissionPercent']}%")
            self.log(f"    • monthly entries: {len(result['monthly'])}")
            self.log(f"    • topProducts: {len(result['topProducts'])}")
            self.log(f"    • byCategory: {len(result['byCategory'])}")
            
        except Exception as e:
            self.log(f"❌ Vendor analytics test failed: {str(e)}")
            return False
            
        return True

    def test_promotions(self):
        """Test vendor promotions CRUD"""
        self.log("\n🎁 TESTING VENDOR PROMOTIONS")
        
        try:
            # Test 1: GET /api/vendor/promotions (empty list)
            response = self.vendor_session.get(f"{BASE_URL}/vendor/promotions")
            assert response.status_code == 200, f"Get promotions failed: {response.text}"
            result = response.json()
            assert "promotions" in result
            self.log(f"✅ P1: GET /api/vendor/promotions → 200 with {len(result['promotions'])} promotions")
            
            # Test 2: POST /api/vendor/promotions (BUY_X_GET_Y)
            promo_data = {
                "type": "BUY_X_GET_Y",
                "nameAr": "اشتري 2 واحصل على 1 مجاناً",
                "descriptionAr": "عرض خاص لفترة محدودة",
                "productIds": [],
                "isActive": True,
                "priority": 1,
                "buyQty": 2,
                "getQty": 1,
                "getDiscountPercent": 100
            }
            
            response = self.vendor_session.post(f"{BASE_URL}/vendor/promotions", json=promo_data)
            assert response.status_code == 200, f"Create BUY_X_GET_Y promotion failed: {response.text}"
            result = response.json()
            assert "promotion" in result
            promo = result["promotion"]
            assert promo["type"] == "BUY_X_GET_Y"
            assert promo["buyQty"] == 2
            assert promo["getQty"] == 1
            assert promo["getDiscountPercent"] == 100
            self.test_promotion_id = promo["id"]
            self.log("✅ P2: POST /api/vendor/promotions (BUY_X_GET_Y) → 200 with promotion created")
            
            # Test 3: POST /api/vendor/promotions (TIER)
            tier_data = {
                "type": "TIER",
                "nameAr": "خصومات متدرجة",
                "descriptionAr": "خصم حسب قيمة الطلب",
                "tiers": [
                    {"minSpend": 50, "percent": 10},
                    {"minSpend": 100, "percent": 20},
                    {"minSpend": 200, "percent": 30}
                ]
            }
            
            response = self.vendor_session.post(f"{BASE_URL}/vendor/promotions", json=tier_data)
            assert response.status_code == 200, f"Create TIER promotion failed: {response.text}"
            result = response.json()
            promo = result["promotion"]
            assert promo["type"] == "TIER"
            assert len(promo["tiers"]) == 3
            self.log("✅ P3: POST /api/vendor/promotions (TIER) → 200 with 3 tiers")
            
            # Test 4: PUT /api/vendor/promotions/:id
            update_data = {
                "nameAr": "اشتري 2 واحصل على 1 مجاناً - محدث",
                "isActive": False
            }
            
            response = self.vendor_session.put(f"{BASE_URL}/vendor/promotions/{self.test_promotion_id}", json=update_data)
            assert response.status_code == 200, f"Update promotion failed: {response.text}"
            result = response.json()
            promo = result["promotion"]
            assert "محدث" in promo["nameAr"]
            assert promo["isActive"] == False
            self.log("✅ P4: PUT /api/vendor/promotions/:id → 200 with updated promotion")
            
            # Test 5: Validation errors
            invalid_data = {"type": "INVALID_TYPE"}
            response = self.vendor_session.post(f"{BASE_URL}/vendor/promotions", json=invalid_data)
            assert response.status_code == 400
            result = response.json()
            assert "نوع العرض غير صحيح" in result.get("error", "")
            self.log("✅ P5: POST /api/vendor/promotions (invalid type) → 400 'نوع العرض غير صحيح'")
            
            # Test 6: DELETE /api/vendor/promotions/:id
            response = self.vendor_session.delete(f"{BASE_URL}/vendor/promotions/{self.test_promotion_id}")
            assert response.status_code == 200, f"Delete promotion failed: {response.text}"
            result = response.json()
            assert result["success"] == True
            self.log("✅ P6: DELETE /api/vendor/promotions/:id → 200 with success=true")
            
        except Exception as e:
            self.log(f"❌ Promotions test failed: {str(e)}")
            return False
            
        return True

    def test_inventory_management(self):
        """Test inventory endpoints"""
        self.log("\n📦 TESTING INVENTORY MANAGEMENT")
        
        try:
            # Test 1: GET /api/vendor/inventory
            response = self.vendor_session.get(f"{BASE_URL}/vendor/inventory")
            assert response.status_code == 200, f"Get inventory failed: {response.text}"
            result = response.json()
            assert "products" in result
            assert "summary" in result
            summary = result["summary"]
            assert "total" in summary
            assert "active" in summary
            assert "lowCount" in summary
            self.log(f"✅ I1: GET /api/vendor/inventory → 200 with summary (total={summary['total']}, active={summary['active']}, lowCount={summary['lowCount']})")
            
            # Test 2: GET /api/vendor/inventory?lowStock=1
            response = self.vendor_session.get(f"{BASE_URL}/vendor/inventory?lowStock=1")
            assert response.status_code == 200
            result = response.json()
            # Should only return low stock products
            self.log(f"✅ I2: GET /api/vendor/inventory?lowStock=1 → 200 with {len(result['products'])} low stock products")
            
            # Test 3: GET /api/vendor/products/import/template
            response = self.vendor_session.get(f"{BASE_URL}/vendor/products/import/template")
            assert response.status_code == 200, f"Get template failed: {response.text}"
            assert response.headers.get('Content-Type') == 'text/csv; charset=utf-8'
            assert response.headers.get('Content-Disposition') == 'attachment; filename="products_template.csv"'
            content = response.text
            assert content.startswith('\ufeff')  # BOM
            assert 'nameAr' in content
            assert 'عسل سدر جبلي' in content  # Sample data
            self.log("✅ I3: GET /api/vendor/products/import/template → 200 with CSV content-type and BOM")
            
            # Test 4: POST /api/vendor/products/import (validation)
            import_data = {"rows": []}
            response = self.vendor_session.post(f"{BASE_URL}/vendor/products/import", json=import_data)
            assert response.status_code == 400
            result = response.json()
            assert "لا توجد صفوف لاستيرادها" in result.get("error", "")
            self.log("✅ I4: POST /api/vendor/products/import (empty rows) → 400 'لا توجد صفوف لاستيرادها'")
            
            # Test 5: POST /api/vendor/products/import (dry run)
            import_data = {
                "dryRun": True,
                "rows": [
                    {
                        "nameAr": "منتج تجريبي للاستيراد",
                        "price": 25.5,
                        "stock": 10,
                        "category": "ELECTRONICS",
                        "lowStockThreshold": 3
                    }
                ]
            }
            
            response = self.vendor_session.post(f"{BASE_URL}/vendor/products/import", json=import_data)
            assert response.status_code == 200, f"Import dry run failed: {response.text}"
            result = response.json()
            assert result["success"] == True
            assert result["dryRun"] == True
            assert result["okCount"] == 1
            assert result["failCount"] == 0
            assert result["createdCount"] == 0
            self.log("✅ I5: POST /api/vendor/products/import (dry run) → 200 with okCount=1, failCount=0, createdCount=0")
            
        except Exception as e:
            self.log(f"❌ Inventory management test failed: {str(e)}")
            return False
            
        return True

    def test_vendor_products_crud(self):
        """Test vendor product CRUD operations"""
        self.log("\n🛍️ TESTING VENDOR PRODUCTS CRUD")
        
        try:
            # Test 1: POST /api/products (create)
            product_data = {
                "nameAr": "منتج تجريبي للمرحلة ج",
                "nameEn": "Phase C Test Product",
                "description": "منتج تجريبي لاختبار المرحلة ج من التطوير",
                "price": 45.75,
                "category": "ELECTRONICS",
                "subcategory": "هواتف ذكية",
                "stock": 15,
                "lowStockThreshold": 5,
                "tags": ["تجريبي", "اختبار", "مرحلة ج"],
                "images": [
                    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
                ]
            }
            
            response = self.vendor_session.post(f"{BASE_URL}/products", json=product_data)
            assert response.status_code == 200, f"Create product failed: {response.text}"
            result = response.json()
            assert result["success"] == True
            assert "product" in result
            product = result["product"]
            assert product["nameAr"] == product_data["nameAr"]
            assert product["price"] == product_data["price"]
            assert product["category"] == product_data["category"]
            self.test_product_id = product["id"]
            self.log("✅ VP1: POST /api/products → 200 with product created")
            
            # Test 2: GET /api/vendor/products
            response = self.vendor_session.get(f"{BASE_URL}/vendor/products")
            assert response.status_code == 200, f"Get vendor products failed: {response.text}"
            result = response.json()
            assert "products" in result
            assert len(result["products"]) >= 1
            # Find our test product
            found = any(p["id"] == self.test_product_id for p in result["products"])
            assert found, "Test product not found in vendor products list"
            self.log(f"✅ VP2: GET /api/vendor/products → 200 with {len(result['products'])} products")
            
            # Test 3: PUT /api/products/:id (update)
            update_data = {
                "nameAr": "منتج تجريبي محدث للمرحلة ج",
                "price": 55.25,
                "stock": 20,
                "isActive": True
            }
            
            response = self.vendor_session.put(f"{BASE_URL}/products/{self.test_product_id}", json=update_data)
            assert response.status_code == 200, f"Update product failed: {response.text}"
            result = response.json()
            assert result["success"] == True
            product = result["product"]
            assert "محدث" in product["nameAr"]
            assert product["price"] == 55.25
            assert product["stock"] == 20
            self.log("✅ VP3: PUT /api/products/:id → 200 with updated product")
            
            # Test 4: GET /api/products/:id/stock/movements
            response = self.vendor_session.get(f"{BASE_URL}/products/{self.test_product_id}/stock/movements")
            assert response.status_code == 200, f"Get stock movements failed: {response.text}"
            result = response.json()
            assert "movements" in result
            # Should have at least one INIT movement from product creation
            movements = result["movements"]
            assert len(movements) >= 1
            init_movement = next((m for m in movements if m["type"] == "INIT"), None)
            assert init_movement is not None, "No INIT stock movement found"
            self.log(f"✅ VP4: GET /api/products/:id/stock/movements → 200 with {len(movements)} movements")
            
            # Test 5: POST /api/products/:id/stock/adjust
            adjust_data = {
                "type": "ADJUST",
                "delta": -5,
                "note": "تعديل تجريبي للمخزون"
            }
            
            response = self.vendor_session.post(f"{BASE_URL}/products/{self.test_product_id}/stock/adjust", json=adjust_data)
            assert response.status_code == 200, f"Stock adjust failed: {response.text}"
            result = response.json()
            assert result["success"] == True
            assert result["delta"] == -5
            assert result["newStock"] == 15  # 20 - 5
            self.log("✅ VP5: POST /api/products/:id/stock/adjust → 200 with delta=-5, newStock=15")
            
            # Test 6: Validation errors
            invalid_product = {
                "nameAr": "X",  # Too short
                "price": -10,   # Negative price
                "category": "INVALID"  # Invalid category
            }
            
            response = self.vendor_session.post(f"{BASE_URL}/products", json=invalid_product)
            assert response.status_code == 400
            result = response.json()
            assert "اسم المنتج مطلوب" in result.get("error", "")
            self.log("✅ VP6: POST /api/products (invalid data) → 400 'اسم المنتج مطلوب'")
            
            # Test 7: DELETE /api/products/:id (soft delete - product has no orders)
            response = self.vendor_session.delete(f"{BASE_URL}/products/{self.test_product_id}")
            assert response.status_code == 200, f"Delete product failed: {response.text}"
            result = response.json()
            assert result["success"] == True
            # Since product has no orders, it should be hard deleted
            self.log("✅ VP7: DELETE /api/products/:id → 200 with success=true")
            
        except Exception as e:
            self.log(f"❌ Vendor products CRUD test failed: {str(e)}")
            return False
            
        return True

    def test_public_product_promotions(self):
        """Test public product promotions endpoint"""
        self.log("\n🎯 TESTING PUBLIC PRODUCT PROMOTIONS")
        
        try:
            # Create a test product first
            product_data = {
                "nameAr": "منتج للعروض الترويجية",
                "price": 100,
                "category": "ELECTRONICS",
                "stock": 10
            }
            
            response = self.vendor_session.post(f"{BASE_URL}/products", json=product_data)
            assert response.status_code == 200
            product_id = response.json()["product"]["id"]
            
            # Create a promotion for this product
            promo_data = {
                "type": "BUY_X_GET_Y",
                "nameAr": "عرض خاص للمنتج",
                "productIds": [product_id],
                "isActive": True,
                "buyQty": 2,
                "getQty": 1,
                "getDiscountPercent": 50
            }
            
            response = self.vendor_session.post(f"{BASE_URL}/vendor/promotions", json=promo_data)
            assert response.status_code == 200
            
            # Test: GET /api/products/:id/promotions (public endpoint)
            response = self.session.get(f"{BASE_URL}/products/{product_id}/promotions")
            assert response.status_code == 200, f"Get product promotions failed: {response.text}"
            result = response.json()
            assert "promotions" in result
            promotions = result["promotions"]
            assert len(promotions) >= 1
            
            # Find our promotion
            found_promo = next((p for p in promotions if p["nameAr"] == "عرض خاص للمنتج"), None)
            assert found_promo is not None, "Test promotion not found"
            assert found_promo["type"] == "BUY_X_GET_Y"
            assert found_promo["buyQty"] == 2
            assert found_promo["getQty"] == 1
            
            self.log(f"✅ PP1: GET /api/products/:id/promotions → 200 with {len(promotions)} active promotions")
            
            # Test with non-existent product
            fake_id = str(uuid.uuid4())
            response = self.session.get(f"{BASE_URL}/products/{fake_id}/promotions")
            assert response.status_code == 404
            result = response.json()
            assert "المنتج غير موجود" in result.get("error", "")
            self.log("✅ PP2: GET /api/products/:id/promotions (non-existent) → 404 'المنتج غير موجود'")
            
        except Exception as e:
            self.log(f"❌ Public product promotions test failed: {str(e)}")
            return False
            
        return True

    def run_all_tests(self):
        """Run all Phase C tests"""
        self.log("🚀 STARTING PHASE C BACKEND TESTING")
        self.log("=" * 60)
        
        # Setup
        try:
            self.setup_test_data()
        except Exception as e:
            self.log(f"❌ Setup failed: {str(e)}")
            return False
        
        # Run tests
        test_results = []
        
        test_results.append(("Cart Endpoints", self.test_cart_endpoints()))
        test_results.append(("Abandoned Cart Cron", self.test_abandoned_cart_cron()))
        test_results.append(("Vendor Analytics", self.test_vendor_analytics()))
        test_results.append(("Vendor Promotions", self.test_promotions()))
        test_results.append(("Inventory Management", self.test_inventory_management()))
        test_results.append(("Vendor Products CRUD", self.test_vendor_products_crud()))
        test_results.append(("Public Product Promotions", self.test_public_product_promotions()))
        
        # Summary
        self.log("\n" + "=" * 60)
        self.log("📊 PHASE C TESTING SUMMARY")
        self.log("=" * 60)
        
        passed = 0
        total = len(test_results)
        
        for test_name, result in test_results:
            status = "✅ PASSED" if result else "❌ FAILED"
            self.log(f"{status} - {test_name}")
            if result:
                passed += 1
        
        self.log(f"\n🎯 OVERALL RESULT: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
        
        if passed == total:
            self.log("🎉 ALL PHASE C TESTS PASSED! The refactored modules are working correctly.")
        else:
            self.log("⚠️ Some tests failed. Please check the logs above for details.")
            
        return passed == total

if __name__ == "__main__":
    tester = PhaseCtester()
    success = tester.run_all_tests()
    exit(0 if success else 1)