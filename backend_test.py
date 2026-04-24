#!/usr/bin/env python3
"""
Backend testing for NEW Product Variants feature (خيارات المنتج)
Testing all scenarios from the review request: V1-V15, R1-R3
"""

import requests
import json
import time
import os
from datetime import datetime
import pymongo
import bcrypt
from uuid import uuid4

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://omani-startup-hub.preview.emergentagent.com')
BASE = f"{BASE_URL}/api"
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'majles')

print(f"🧪 BACKEND TESTING: Product Variants Feature")
print(f"📍 Base URL: {BASE}")
print(f"🗄️ Database: {MONGO_URL}/{DB_NAME}")
print("=" * 80)

# MongoDB connection
client = pymongo.MongoClient(MONGO_URL)
db = client[DB_NAME]

def create_test_user(email, password="Password123", role="MEMBER"):
    """Create a test user directly in MongoDB"""
    user_id = str(uuid4())
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    user_doc = {
        "_id": user_id,
        "name": "مستخدم تجريبي",
        "email": email,
        "password": hashed_password,
        "role": role,
        "membershipTier": "FREE",
        "phone": "",
        "photo": "",
        "wishlist": [],
        "isGuest": False,
        "vendorProfile": {
            "slug": "",
            "businessName": "",
            "tagline": "",
            "bio": "",
            "banner": "",
            "logo": "",
            "phone": "",
            "whatsapp": "",
            "instagram": "",
            "website": "",
            "governorate": "",
            "city": "",
            "address": ""
        },
        "createdAt": datetime.utcnow()
    }
    
    try:
        db.users.insert_one(user_doc)
        print(f"✅ Created test user: {email} with role {role}")
        return user_id
    except pymongo.errors.DuplicateKeyError:
        print(f"⚠️ User {email} already exists")
        existing = db.users.find_one({"email": email})
        return existing["_id"] if existing else None

def promote_to_vendor(user_id):
    """Promote user to VENDOR role"""
    result = db.users.update_one(
        {"_id": user_id},
        {"$set": {"role": "VENDOR"}}
    )
    if result.modified_count > 0:
        print(f"✅ Promoted user {user_id} to VENDOR")
    return result.modified_count > 0

def login_with_nextauth(email, password="Password123"):
    """Login using the proven NextAuth credentials flow"""
    s = requests.Session()
    
    try:
        # Step 1: Get CSRF token
        csrf_response = s.get(f"{BASE}/auth/csrf", timeout=15)
        csrf_token = csrf_response.json()["csrfToken"]
        
        # Step 2: Login with credentials
        login_response = s.post(
            f"{BASE}/auth/callback/credentials",
            data={
                "csrfToken": csrf_token,
                "email": email,
                "password": password,
                "callbackUrl": f"{BASE_URL}/dashboard",
                "json": "true"
            },
            timeout=15
        )
        
        # Step 3: Verify session
        me_response = s.get(f"{BASE}/me", timeout=15)
        if me_response.status_code == 200:
            user_data = me_response.json()
            print(f"✅ Logged in as: {user_data.get('name')} ({user_data.get('role')})")
            return s, user_data
        else:
            print(f"❌ Login failed: {me_response.status_code}")
            return None, None
            
    except Exception as e:
        print(f"❌ Login error: {e}")
        return None, None

def test_scenario(name, func):
    """Test scenario wrapper"""
    print(f"\n📋 {name}")
    try:
        result = func()
        if result:
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED")
        return result
    except Exception as e:
        print(f"❌ {name} - ERROR: {e}")
        return False

def main():
    """Main test execution"""
    
    # Setup test data
    vendor_email = f"vendor_{int(time.time())}@test.com"
    buyer_email = f"buyer_{int(time.time())}@test.com"
    
    vendor_id = create_test_user(vendor_email, role="MEMBER")
    buyer_id = create_test_user(buyer_email, role="MEMBER")
    
    if not vendor_id or not buyer_id:
        print("❌ Failed to create test users")
        return
    
    # Promote vendor
    promote_to_vendor(vendor_id)
    
    # Login as vendor
    vendor_session, vendor_data = login_with_nextauth(vendor_email)
    if not vendor_session:
        print("❌ Failed to login as vendor")
        return
    
    # Login as buyer  
    buyer_session, buyer_data = login_with_nextauth(buyer_email)
    if not buyer_session:
        print("❌ Failed to login as buyer")
        return
    
    print(f"\n🎯 TESTING PRODUCT VARIANTS FEATURE")
    print("=" * 50)
    
    # Test results tracking
    results = {}
    
    # ====================================================
    # TASK A: POST /api/products — accept variants array
    # ====================================================
    
    def test_v1_valid_variants():
        """V1) Authenticated VENDOR. POST with valid variants"""
        payload = {
            "nameAr": "تيشيرت اختبار",
            "price": 10,
            "category": "FASHION",
            "stock": 0,
            "variants": [
                {
                    "name": "صغير / أحمر",
                    "sku": "S-RED-001",
                    "price": 10,
                    "stock": 5,
                    "attrs": {"size": "S", "color": "أحمر"}
                },
                {
                    "name": "متوسط / أحمر",
                    "sku": "M-RED-001",
                    "price": 11,
                    "stock": 3
                },
                {
                    "name": "كبير / أزرق",
                    "sku": "L-BLU-001",
                    "price": 12,
                    "stock": 8
                }
            ]
        }
        
        response = vendor_session.post(f"{BASE}/products", json=payload, timeout=15)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            product = data.get('product', {})
            
            # Verify response structure
            has_variants = product.get('hasVariants', False)
            variants = product.get('variants', [])
            stock = product.get('stock', 0)
            
            print(f"hasVariants: {has_variants}")
            print(f"variants.length: {len(variants)}")
            print(f"stock: {stock} (should be 16 = 5+3+8)")
            
            # Verify each variant has UUID id
            for i, variant in enumerate(variants):
                variant_id = variant.get('id', '')
                print(f"Variant {i+1} id: {variant_id}")
            
            # Store product ID for later tests
            results['test_product_id'] = product.get('id')
            
            return (has_variants == True and 
                   len(variants) == 3 and 
                   stock == 16 and
                   all('id' in v for v in variants))
        else:
            print(f"Error: {response.text}")
            return False
    
    def test_v2_empty_variants():
        """V2) POST with empty variants array"""
        payload = {
            "nameAr": "منتج بسيط",
            "price": 20,
            "category": "OTHER",
            "stock": 10,
            "variants": []
        }
        
        response = vendor_session.post(f"{BASE}/products", json=payload, timeout=15)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            product = data.get('product', {})
            
            has_variants = product.get('hasVariants', True)  # Should be False
            stock = product.get('stock', 0)
            
            print(f"hasVariants: {has_variants}")
            print(f"stock: {stock} (should be 10)")
            
            results['simple_product_id'] = product.get('id')
            
            return has_variants == False and stock == 10
        else:
            print(f"Error: {response.text}")
            return False
    
    def test_v3_missing_variant_name():
        """V3) Validation: variant with missing name"""
        payload = {
            "nameAr": "منتج خطأ",
            "price": 10,
            "category": "OTHER",
            "stock": 0,
            "variants": [
                {"name": "", "sku": "TEST-001", "price": 10, "stock": 5}
            ]
        }
        
        response = vendor_session.post(f"{BASE}/products", json=payload, timeout=15)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 400:
            error_text = response.text
            print(f"Error message: {error_text}")
            return "اسم الخيار رقم 1 مطلوب" in error_text
        else:
            print(f"Unexpected response: {response.text}")
            return False
    
    def test_v4_duplicate_sku():
        """V4) Validation: duplicate SKU within the same request"""
        payload = {
            "nameAr": "منتج خطأ",
            "price": 10,
            "category": "OTHER",
            "stock": 0,
            "variants": [
                {"name": "خيار 1", "sku": "DUPLICATE", "price": 10, "stock": 5},
                {"name": "خيار 2", "sku": "DUPLICATE", "price": 11, "stock": 3}
            ]
        }
        
        response = vendor_session.post(f"{BASE}/products", json=payload, timeout=15)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 400:
            error_text = response.text
            print(f"Error message: {error_text}")
            return "رمز المنتج (SKU) مكرر:" in error_text
        else:
            print(f"Unexpected response: {response.text}")
            return False
    
    def test_v5_invalid_variant_price():
        """V5) Validation: variant price = -1"""
        payload = {
            "nameAr": "منتج خطأ",
            "price": 10,
            "category": "OTHER",
            "stock": 0,
            "variants": [
                {"name": "خيار سالب", "sku": "NEG-001", "price": -1, "stock": 5}
            ]
        }
        
        response = vendor_session.post(f"{BASE}/products", json=payload, timeout=15)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 400:
            error_text = response.text
            print(f"Error message: {error_text}")
            return 'سعر الخيار "خيار سالب" غير صحيح' in error_text
        else:
            print(f"Unexpected response: {response.text}")
            return False
    
    def test_v6_too_many_variants():
        """V6) Validation: 51 variants"""
        variants = []
        for i in range(51):
            variants.append({
                "name": f"خيار {i+1}",
                "sku": f"VAR-{i+1:03d}",
                "price": 10,
                "stock": 1
            })
        
        payload = {
            "nameAr": "منتج كثير الخيارات",
            "price": 10,
            "category": "OTHER",
            "stock": 0,
            "variants": variants
        }
        
        response = vendor_session.post(f"{BASE}/products", json=payload, timeout=15)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 400:
            error_text = response.text
            print(f"Error message: {error_text}")
            return "الحد الأقصى للخيارات هو 50" in error_text
        else:
            print(f"Unexpected response: {response.text}")
            return False
    
    def test_v7_public_product_access():
        """V7) GET /api/products/:id (public) returns product with variants"""
        if not results.get('test_product_id'):
            print("No test product ID available")
            return False
        
        # Test without authentication (public access)
        public_session = requests.Session()
        response = public_session.get(f"{BASE}/products/{results['test_product_id']}", timeout=15)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            product = data.get('product', {})
            
            has_variants = product.get('hasVariants', False)
            variants = product.get('variants', [])
            
            print(f"hasVariants: {has_variants}")
            print(f"variants.length: {len(variants)}")
            
            return has_variants == True and len(variants) == 3
        else:
            print(f"Error: {response.text}")
            return False
    
    # ====================================================
    # TASK B: PUT /api/products/:id — update variants
    # ====================================================
    
    def test_v8_update_variants():
        """V8) Authenticated owner VENDOR. PUT with a NEW variants array"""
        if not results.get('test_product_id'):
            print("No test product ID available")
            return False
        
        # New variants with different IDs and stock counts
        payload = {
            "variants": [
                {
                    "name": "جديد / أخضر",
                    "sku": "NEW-GRN-001",
                    "price": 15,
                    "stock": 7,
                    "attrs": {"size": "M", "color": "أخضر"}
                },
                {
                    "name": "جديد / أصفر",
                    "sku": "NEW-YEL-001",
                    "price": 16,
                    "stock": 4
                }
            ]
        }
        
        response = vendor_session.put(f"{BASE}/products/{results['test_product_id']}", json=payload, timeout=15)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            product = data.get('product', {})
            
            has_variants = product.get('hasVariants', False)
            variants = product.get('variants', [])
            stock = product.get('stock', 0)
            
            print(f"hasVariants: {has_variants}")
            print(f"variants.length: {len(variants)}")
            print(f"stock: {stock} (should be 11 = 7+4)")
            
            # Verify old variant IDs are gone by checking names
            variant_names = [v.get('name', '') for v in variants]
            print(f"New variant names: {variant_names}")
            
            return (has_variants == True and 
                   len(variants) == 2 and 
                   stock == 11 and
                   "جديد / أخضر" in variant_names)
        else:
            print(f"Error: {response.text}")
            return False
    
    def test_v9_empty_variants_update():
        """V9) PUT with variants:[] (empty array)"""
        if not results.get('test_product_id'):
            print("No test product ID available")
            return False
        
        payload = {"variants": []}
        
        response = vendor_session.put(f"{BASE}/products/{results['test_product_id']}", json=payload, timeout=15)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            product = data.get('product', {})
            
            has_variants = product.get('hasVariants', True)  # Should be False
            variants = product.get('variants', [])
            
            print(f"hasVariants: {has_variants}")
            print(f"variants.length: {len(variants)}")
            
            return has_variants == False and len(variants) == 0
        else:
            print(f"Error: {response.text}")
            return False
    
    def test_v10_non_owner_update():
        """V10) PUT as non-owner (different VENDOR or MEMBER)"""
        if not results.get('test_product_id'):
            print("No test product ID available")
            return False
        
        # Try to update as buyer (non-owner)
        payload = {"variants": [{"name": "هاك", "price": 1, "stock": 1}]}
        
        response = buyer_session.put(f"{BASE}/products/{results['test_product_id']}", json=payload, timeout=15)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 403:
            error_text = response.text
            print(f"Error message: {error_text}")
            return "لا يمكنك تعديل هذا المنتج" in error_text
        else:
            print(f"Unexpected response: {response.text}")
            return False
    
    # ====================================================
    # TASK C: POST /api/orders with variantId
    # ====================================================
    
    def setup_variant_product():
        """Setup: create an order with the variant-having product from V1"""
        # First, recreate a product with variants for order testing
        payload = {
            "nameAr": "تيشيرت اختبار للطلب",
            "price": 10,
            "category": "FASHION",
            "stock": 0,
            "variants": [
                {
                    "name": "صغير / أحمر",
                    "sku": "S-RED-002",
                    "price": 10,
                    "stock": 5,
                    "attrs": {"size": "S", "color": "أحمر"}
                },
                {
                    "name": "متوسط / أحمر",
                    "sku": "M-RED-002",
                    "price": 11,
                    "stock": 3
                },
                {
                    "name": "كبير / أزرق",
                    "sku": "L-BLU-002",
                    "price": 12,
                    "stock": 8
                }
            ]
        }
        
        response = vendor_session.post(f"{BASE}/products", json=payload, timeout=15)
        if response.status_code == 200:
            data = response.json()
            product = data.get('product', {})
            results['order_test_product_id'] = product.get('id')
            results['order_test_variants'] = product.get('variants', [])
            print(f"✅ Created order test product: {product.get('id')}")
            return True
        else:
            print(f"❌ Failed to create order test product: {response.text}")
            return False
    
    def test_v11_order_without_variant_id():
        """V11) Order for a variant product WITHOUT variantId"""
        if not results.get('order_test_product_id'):
            print("No order test product available")
            return False
        
        payload = {
            "items": [
                {
                    "productId": results['order_test_product_id'],
                    "quantity": 1
                    # Missing variantId for variant product
                }
            ],
            "shippingAddress": {
                "name": "مشتري تجريبي",
                "phone": "+968 9123 4567",
                "governorate": "MUSCAT",
                "city": "مسقط",
                "addressLine": "شارع التجارة",
                "notes": ""
            },
            "paymentMethod": "COD"
        }
        
        response = buyer_session.post(f"{BASE}/orders", json=payload, timeout=15)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 400:
            error_text = response.text
            print(f"Error message: {error_text}")
            return 'يرجى اختيار خيار (متغير) للمنتج "تيشيرت اختبار للطلب"' in error_text
        else:
            print(f"Unexpected response: {response.text}")
            return False
    
    def test_v12_order_with_bogus_variant_id():
        """V12) Order with bogus variantId"""
        if not results.get('order_test_product_id'):
            print("No order test product available")
            return False
        
        payload = {
            "items": [
                {
                    "productId": results['order_test_product_id'],
                    "quantity": 1,
                    "variantId": "bogus-variant-id-12345"
                }
            ],
            "shippingAddress": {
                "name": "مشتري تجريبي",
                "phone": "+968 9123 4567",
                "governorate": "MUSCAT",
                "city": "مسقط",
                "addressLine": "شارع التجارة",
                "notes": ""
            },
            "paymentMethod": "COD"
        }
        
        response = buyer_session.post(f"{BASE}/orders", json=payload, timeout=15)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 400:
            error_text = response.text
            print(f"Error message: {error_text}")
            return 'الخيار المحدد للمنتج "تيشيرت اختبار للطلب" غير موجود' in error_text
        else:
            print(f"Unexpected response: {response.text}")
            return False
    
    def test_v13_order_quantity_exceeds_variant_stock():
        """V13) Order with quantity > variant stock"""
        if not results.get('order_test_product_id') or not results.get('order_test_variants'):
            print("No order test product/variants available")
            return False
        
        # Use first variant (stock=5) with quantity=10
        first_variant = results['order_test_variants'][0]
        variant_id = first_variant.get('id')
        
        payload = {
            "items": [
                {
                    "productId": results['order_test_product_id'],
                    "quantity": 10,  # > stock (5)
                    "variantId": variant_id
                }
            ],
            "shippingAddress": {
                "name": "مشتري تجريبي",
                "phone": "+968 9123 4567",
                "governorate": "MUSCAT",
                "city": "مسقط",
                "addressLine": "شارع التجارة",
                "notes": ""
            },
            "paymentMethod": "COD"
        }
        
        response = buyer_session.post(f"{BASE}/orders", json=payload, timeout=15)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 409:
            error_text = response.text
            print(f"Error message: {error_text}")
            return 'الكمية المتاحة من "تيشيرت اختبار للطلب - صغير / أحمر" غير كافية' in error_text
        else:
            print(f"Unexpected response: {response.text}")
            return False
    
    def test_v14_happy_path_cod_order():
        """V14) Happy path: COD order for variant"""
        if not results.get('order_test_product_id') or not results.get('order_test_variants'):
            print("No order test product/variants available")
            return False
        
        # Use second variant "متوسط / أحمر" (stock=3) quantity=2
        second_variant = results['order_test_variants'][1]
        variant_id = second_variant.get('id')
        
        payload = {
            "items": [
                {
                    "productId": results['order_test_product_id'],
                    "quantity": 2,
                    "variantId": variant_id
                }
            ],
            "shippingAddress": {
                "name": "مشتري تجريبي",
                "phone": "+968 9123 4567",
                "governorate": "MUSCAT",
                "city": "مسقط",
                "addressLine": "شارع التجارة",
                "notes": ""
            },
            "paymentMethod": "COD"
        }
        
        response = buyer_session.post(f"{BASE}/orders", json=payload, timeout=15)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            order = data.get('order', {})
            order_id = order.get('id')
            
            print(f"Order ID: {order_id}")
            print(f"Status: {order.get('status')}")
            
            # Verify in DB
            order_doc = db.orders.find_one({"_id": order_id})
            if order_doc:
                items = order_doc.get('items', [])
                if items:
                    item = items[0]
                    print(f"DB - variantId: {item.get('variantId')}")
                    print(f"DB - variantName: {item.get('variantName')}")
                    print(f"DB - unitPrice: {item.get('unitPrice')}")
                
                # Check product stock after order
                product_doc = db.products.find_one({"_id": results['order_test_product_id']})
                if product_doc:
                    variants = product_doc.get('variants', [])
                    for v in variants:
                        if v.get('id') == variant_id:
                            print(f"DB - Variant stock after: {v.get('stock')} (was 3, should be 1 or -1 if double-deduct)")
                    print(f"DB - Product stock after: {product_doc.get('stock')}")
            
            results['test_order_id'] = order_id
            return True
        else:
            print(f"Error: {response.text}")
            return False
    
    def test_v15_multi_variant_order():
        """V15) Happy path: ordering DIFFERENT variants from the same product"""
        if not results.get('order_test_product_id') or not results.get('order_test_variants'):
            print("No order test product/variants available")
            return False
        
        # Use first variant (qty=1) and third variant (qty=2)
        first_variant = results['order_test_variants'][0]
        third_variant = results['order_test_variants'][2]
        
        payload = {
            "items": [
                {
                    "productId": results['order_test_product_id'],
                    "quantity": 1,
                    "variantId": first_variant.get('id')
                },
                {
                    "productId": results['order_test_product_id'],
                    "quantity": 2,
                    "variantId": third_variant.get('id')
                }
            ],
            "shippingAddress": {
                "name": "مشتري تجريبي",
                "phone": "+968 9123 4567",
                "governorate": "MUSCAT",
                "city": "مسقط",
                "addressLine": "شارع التجارة",
                "notes": ""
            },
            "paymentMethod": "COD"
        }
        
        response = buyer_session.post(f"{BASE}/orders", json=payload, timeout=15)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            order = data.get('order', {})
            order_id = order.get('id')
            
            print(f"Order ID: {order_id}")
            
            # Verify in DB
            order_doc = db.orders.find_one({"_id": order_id})
            if order_doc:
                items = order_doc.get('items', [])
                print(f"DB - Order items count: {len(items)} (should be 2)")
                
                for i, item in enumerate(items):
                    print(f"DB - Item {i+1}: variantId={item.get('variantId')}, quantity={item.get('quantity')}")
            
            return len(order_doc.get('items', [])) == 2 if order_doc else False
        else:
            print(f"Error: {response.text}")
            return False
    
    # ====================================================
    # REGRESSION TESTS
    # ====================================================
    
    def test_r1_simple_product_creation():
        """R1) POST /api/products without `variants` field"""
        payload = {
            "nameAr": "منتج بسيط بدون خيارات",
            "price": 25,
            "category": "OTHER",
            "stock": 15
            # No variants field
        }
        
        response = vendor_session.post(f"{BASE}/products", json=payload, timeout=15)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            product = data.get('product', {})
            
            has_variants = product.get('hasVariants', True)  # Should be False
            variants = product.get('variants', [])
            stock = product.get('stock', 0)
            
            print(f"hasVariants: {has_variants}")
            print(f"variants: {variants}")
            print(f"stock: {stock}")
            
            results['regression_product_id'] = product.get('id')
            
            return has_variants == False and stock == 15
        else:
            print(f"Error: {response.text}")
            return False
    
    def test_r2_simple_product_order():
        """R2) POST /api/orders for simple product (no variantId)"""
        if not results.get('regression_product_id'):
            print("No regression product available")
            return False
        
        payload = {
            "items": [
                {
                    "productId": results['regression_product_id'],
                    "quantity": 2
                    # No variantId for simple product
                }
            ],
            "shippingAddress": {
                "name": "مشتري تجريبي",
                "phone": "+968 9123 4567",
                "governorate": "MUSCAT",
                "city": "مسقط",
                "addressLine": "شارع التجارة",
                "notes": ""
            },
            "paymentMethod": "COD"
        }
        
        response = buyer_session.post(f"{BASE}/orders", json=payload, timeout=15)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            order = data.get('order', {})
            
            print(f"Order ID: {order.get('id')}")
            print(f"Status: {order.get('status')}")
            
            # Check product stock decremented
            product_doc = db.products.find_one({"_id": results['regression_product_id']})
            if product_doc:
                print(f"DB - Product stock after: {product_doc.get('stock')} (was 15, should be 13)")
            
            return True
        else:
            print(f"Error: {response.text}")
            return False
    
    def test_r3_api_health():
        """R3) GET /api/ health check"""
        response = requests.get(f"{BASE}/", timeout=15)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            message = data.get('message', '')
            print(f"Message: {message}")
            return message == 'Majles API is running'
        else:
            print(f"Error: {response.text}")
            return False
    
    # Execute all tests
    test_results = {}
    
    # Setup for order tests
    if not setup_variant_product():
        print("❌ Failed to setup variant product for order tests")
        return
    
    # TASK A: POST /api/products — accept variants array
    test_results['V1'] = test_scenario("V1: Valid variants creation", test_v1_valid_variants)
    test_results['V2'] = test_scenario("V2: Empty variants array", test_v2_empty_variants)
    test_results['V3'] = test_scenario("V3: Missing variant name validation", test_v3_missing_variant_name)
    test_results['V4'] = test_scenario("V4: Duplicate SKU validation", test_v4_duplicate_sku)
    test_results['V5'] = test_scenario("V5: Invalid variant price validation", test_v5_invalid_variant_price)
    test_results['V6'] = test_scenario("V6: Too many variants validation", test_v6_too_many_variants)
    test_results['V7'] = test_scenario("V7: Public product access with variants", test_v7_public_product_access)
    
    # TASK B: PUT /api/products/:id — update variants
    test_results['V8'] = test_scenario("V8: Update variants array", test_v8_update_variants)
    test_results['V9'] = test_scenario("V9: Clear variants with empty array", test_v9_empty_variants_update)
    test_results['V10'] = test_scenario("V10: Non-owner update rejection", test_v10_non_owner_update)
    
    # TASK C: POST /api/orders with variantId
    test_results['V11'] = test_scenario("V11: Order variant product without variantId", test_v11_order_without_variant_id)
    test_results['V12'] = test_scenario("V12: Order with bogus variantId", test_v12_order_with_bogus_variant_id)
    test_results['V13'] = test_scenario("V13: Order quantity exceeds variant stock", test_v13_order_quantity_exceeds_variant_stock)
    test_results['V14'] = test_scenario("V14: Happy path COD order with variant", test_v14_happy_path_cod_order)
    test_results['V15'] = test_scenario("V15: Multi-variant order from same product", test_v15_multi_variant_order)
    
    # REGRESSION TESTS
    test_results['R1'] = test_scenario("R1: Simple product creation (no variants)", test_r1_simple_product_creation)
    test_results['R2'] = test_scenario("R2: Simple product order (no variantId)", test_r2_simple_product_order)
    test_results['R3'] = test_scenario("R3: API health check", test_r3_api_health)
    
    # Summary
    print("\n" + "=" * 80)
    print("🎯 PRODUCT VARIANTS TESTING SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for result in test_results.values() if result)
    total = len(test_results)
    
    print(f"📊 RESULTS: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    print()
    
    for test_name, result in test_results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name}: {status}")
    
    print("\n" + "=" * 80)
    
    if passed == total:
        print("🎉 ALL TESTS PASSED! Product Variants feature is working correctly.")
    else:
        print(f"⚠️ {total - passed} tests failed. Please review the implementation.")
    
    print("=" * 80)

if __name__ == "__main__":
    main()