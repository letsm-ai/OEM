#!/usr/bin/env python3
"""
Focused test for the failing Product Variants scenarios
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

print(f"🔍 FOCUSED TESTING: Product Variants Failing Scenarios")
print(f"📍 Base URL: {BASE}")
print("=" * 80)

# MongoDB connection
client = pymongo.MongoClient(MONGO_URL)
db = client[DB_NAME]

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

def main():
    # Use existing test users
    vendor_email = "vendor_1777053481@test.com"
    buyer_email = "buyer_1777053481@test.com"
    
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
    
    print("\n🎯 TESTING FAILING SCENARIOS")
    print("=" * 50)
    
    # Test V5: Invalid variant price validation
    print("\n📋 V5: Invalid variant price validation")
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
    print(f"Response: {response.text}")
    
    expected_error = 'سعر الخيار "خيار سالب" غير صحيح'
    actual_error = response.text
    
    if response.status_code == 400 and expected_error in actual_error:
        print("✅ V5: PASSED")
    else:
        print("❌ V5: FAILED")
        print(f"Expected: {expected_error}")
        print(f"Actual: {actual_error}")
    
    # Create a product with variants for order testing
    print("\n📋 Creating test product with variants")
    variant_product_payload = {
        "nameAr": "تيشيرت اختبار للطلب",
        "price": 10,
        "category": "FASHION",
        "stock": 0,
        "variants": [
            {
                "name": "صغير / أحمر",
                "sku": "S-RED-TEST",
                "price": 10,
                "stock": 5,
                "attrs": {"size": "S", "color": "أحمر"}
            },
            {
                "name": "متوسط / أحمر",
                "sku": "M-RED-TEST",
                "price": 11,
                "stock": 3
            },
            {
                "name": "كبير / أزرق",
                "sku": "L-BLU-TEST",
                "price": 12,
                "stock": 8
            }
        ]
    }
    
    response = vendor_session.post(f"{BASE}/products", json=variant_product_payload, timeout=15)
    print(f"Product creation status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        product = data.get('product', {})
        product_id = product.get('id')
        variants = product.get('variants', [])
        
        print(f"✅ Created product: {product_id}")
        print(f"Variants: {len(variants)}")
        
        if variants:
            first_variant = variants[0]
            second_variant = variants[1] if len(variants) > 1 else variants[0]
            
            print(f"First variant: {first_variant.get('name')} (id: {first_variant.get('id')})")
            
            # Test V11: Order variant product without variantId
            print("\n📋 V11: Order variant product without variantId")
            order_payload = {
                "items": [
                    {
                        "productId": product_id,
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
            
            response = buyer_session.post(f"{BASE}/orders", json=order_payload, timeout=15)
            print(f"Status: {response.status_code}")
            print(f"Response: {response.text}")
            
            expected_error = 'يرجى اختيار خيار (متغير) للمنتج "تيشيرت اختبار للطلب"'
            actual_error = response.text
            
            if response.status_code == 400 and expected_error in actual_error:
                print("✅ V11: PASSED")
            else:
                print("❌ V11: FAILED")
                print(f"Expected: {expected_error}")
                print(f"Actual: {actual_error}")
            
            # Test V12: Order with bogus variantId
            print("\n📋 V12: Order with bogus variantId")
            order_payload["items"][0]["variantId"] = "bogus-variant-id-12345"
            
            response = buyer_session.post(f"{BASE}/orders", json=order_payload, timeout=15)
            print(f"Status: {response.status_code}")
            print(f"Response: {response.text}")
            
            expected_error = 'الخيار المحدد للمنتج "تيشيرت اختبار للطلب" غير موجود'
            actual_error = response.text
            
            if response.status_code == 400 and expected_error in actual_error:
                print("✅ V12: PASSED")
            else:
                print("❌ V12: FAILED")
                print(f"Expected: {expected_error}")
                print(f"Actual: {actual_error}")
            
            # Test V13: Order quantity exceeds variant stock
            print("\n📋 V13: Order quantity exceeds variant stock")
            order_payload["items"][0]["variantId"] = first_variant.get('id')
            order_payload["items"][0]["quantity"] = 10  # > stock (5)
            
            response = buyer_session.post(f"{BASE}/orders", json=order_payload, timeout=15)
            print(f"Status: {response.status_code}")
            print(f"Response: {response.text}")
            
            expected_error = 'الكمية المتاحة من "تيشيرت اختبار للطلب - صغير / أحمر" غير كافية'
            actual_error = response.text
            
            if response.status_code == 409 and expected_error in actual_error:
                print("✅ V13: PASSED")
            else:
                print("❌ V13: FAILED")
                print(f"Expected: {expected_error}")
                print(f"Actual: {actual_error}")
            
            # Test V15: Multi-variant order from same product
            print("\n📋 V15: Multi-variant order from same product")
            order_payload = {
                "items": [
                    {
                        "productId": product_id,
                        "quantity": 1,
                        "variantId": first_variant.get('id')
                    },
                    {
                        "productId": product_id,
                        "quantity": 2,
                        "variantId": second_variant.get('id')
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
            
            response = buyer_session.post(f"{BASE}/orders", json=order_payload, timeout=15)
            print(f"Status: {response.status_code}")
            print(f"Response: {response.text}")
            
            if response.status_code == 200:
                data = response.json()
                order = data.get('order', {})
                order_id = order.get('id')
                
                print(f"✅ V15: PASSED - Order created: {order_id}")
                
                # Verify in DB
                order_doc = db.orders.find_one({"_id": order_id})
                if order_doc:
                    items = order_doc.get('items', [])
                    print(f"DB - Order items count: {len(items)} (should be 2)")
                    
                    for i, item in enumerate(items):
                        print(f"DB - Item {i+1}: variantId={item.get('variantId')}, quantity={item.get('quantity')}")
                else:
                    print("❌ Order not found in DB")
            else:
                print("❌ V15: FAILED")
                print(f"Expected: 200")
                print(f"Actual: {response.status_code} - {response.text}")
        
    else:
        print(f"❌ Failed to create test product: {response.text}")

if __name__ == "__main__":
    main()