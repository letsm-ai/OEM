#!/usr/bin/env python3
"""
PHASE 8 REGRESSION TEST — POST /orders (checkout) extraction
Tests the 385-line checkout block extracted from catch-all into handleOrderCreate()
in /app/lib/api/orders-create.js, now exposed via /app/app/api/orders/route.js

SAFETY: Thawani is in PRODUCTION mode (not test mode), so we ONLY test:
- Rejection paths that happen BEFORE payment
- COD path (creates PAID order immediately - will delete after)
- GET /orders (buyer list)
- Regression tests (webhooks, verify, order detail)
"""

import requests
import time
import json
from pymongo import MongoClient
import bcrypt
from datetime import datetime, timedelta
import uuid

BASE_URL = "https://omani-startup-hub.preview.emergentagent.com/api"
MONGO_URL = "mongodb://localhost:27017/majles"

# Test user credentials
TIMESTAMP = int(time.time())
BUYER_EMAIL = f"phase8_buyer_{TIMESTAMP}@test.com"
VENDOR_EMAIL = f"phase8_vendor_{TIMESTAMP}@test.com"
GUEST_EMAIL = f"phase8_guest_{TIMESTAMP}@test.com"
EXISTING_USER_EMAIL = f"phase8_existing_{TIMESTAMP}@test.com"
PASSWORD = "Password123"

print("=" * 80)
print("PHASE 8 REGRESSION TEST — POST /orders (checkout) extraction")
print("Testing: handleOrderCreate() + handleOrdersList() via /api/orders route")
print("=" * 80)

# MongoDB connection
client = MongoClient(MONGO_URL)
db = client['majles']

# Test counters
total_tests = 0
passed_tests = 0
failed_tests = 0

def test_result(name, passed, message=""):
    """Track test results"""
    global total_tests, passed_tests, failed_tests
    total_tests += 1
    if passed:
        passed_tests += 1
        print(f"✅ {name}: {message}")
    else:
        failed_tests += 1
        print(f"❌ {name}: {message}")

def create_test_user(email, name, role="MEMBER", tier="FREE", with_password=True):
    """Create a test user via signup and promote via MongoDB"""
    try:
        # Signup
        resp = requests.post(f"{BASE_URL}/signup", json={
            "name": name,
            "email": email,
            "password": PASSWORD if with_password else ""
        }, timeout=10)
        
        if resp.status_code != 200:
            print(f"❌ Signup failed for {email}: {resp.status_code} {resp.text[:200]}")
            return None
        
        user_data = resp.json()
        user_id = user_data.get("user", {}).get("id")
        
        # Promote role and tier via MongoDB
        if role != "MEMBER" or tier != "FREE":
            update_data = {}
            if role != "MEMBER":
                update_data["role"] = role
            if tier != "FREE":
                update_data["membershipTier"] = tier
                update_data["membershipExpiry"] = datetime.utcnow() + timedelta(days=365)
            
            db.users.update_one({"_id": user_id}, {"$set": update_data})
        
        print(f"✅ Created user: {email} (role={role}, tier={tier})")
        return user_id
    except Exception as e:
        print(f"❌ Error creating user {email}: {e}")
        return None

def login_user(email, password):
    """Login via NextAuth and return session"""
    try:
        session = requests.Session()
        
        # Get CSRF token
        csrf_resp = session.get(f"{BASE_URL}/auth/csrf", timeout=10)
        csrf_token = csrf_resp.json().get("csrfToken")
        
        # Login
        login_resp = session.post(
            f"{BASE_URL}/auth/callback/credentials",
            data={
                "csrfToken": csrf_token,
                "email": email,
                "password": password,
                "callbackUrl": "/",
                "json": "true"
            },
            timeout=10
        )
        
        if login_resp.status_code == 200:
            print(f"✅ Logged in: {email}")
            return session
        else:
            print(f"❌ Login failed for {email}: {login_resp.status_code}")
            return None
    except Exception as e:
        print(f"❌ Login error for {email}: {e}")
        return None

# ============================================================================
# SETUP: Create test users and products
# ============================================================================
print("\n" + "=" * 80)
print("SETUP: Creating test users and products")
print("=" * 80)

buyer_id = create_test_user(BUYER_EMAIL, "Phase8 Buyer", "MEMBER", "FREE")
vendor_id = create_test_user(VENDOR_EMAIL, "Phase8 Vendor", "VENDOR", "BASIC")
existing_user_id = create_test_user(EXISTING_USER_EMAIL, "Existing User", "MEMBER", "FREE")

if not all([buyer_id, vendor_id, existing_user_id]):
    print("❌ Failed to create test users. Exiting.")
    exit(1)

# Login sessions
buyer_session = login_user(BUYER_EMAIL, PASSWORD)

if not buyer_session:
    print("❌ Failed to login buyer. Exiting.")
    exit(1)

# Create test products
test_product_id = str(uuid.uuid4())
test_product_low_stock_id = str(uuid.uuid4())
test_product_with_variants_id = str(uuid.uuid4())

db.products.insert_one({
    "_id": test_product_id,
    "vendorId": vendor_id,
    "nameAr": "منتج اختبار Phase 8",
    "nameEn": "Phase 8 Test Product",
    "description": "منتج للاختبار",
    "category": "JEWELRY",
    "price": 50.0,
    "stock": 100,
    "isActive": True,
    "hasVariants": False,
    "variants": [],
    "createdAt": datetime.utcnow()
})
print(f"✅ Created test product: {test_product_id}")

db.products.insert_one({
    "_id": test_product_low_stock_id,
    "vendorId": vendor_id,
    "nameAr": "منتج مخزون قليل",
    "nameEn": "Low Stock Product",
    "description": "منتج بمخزون قليل",
    "category": "JEWELRY",
    "price": 30.0,
    "stock": 1,
    "isActive": True,
    "hasVariants": False,
    "variants": [],
    "createdAt": datetime.utcnow()
})
print(f"✅ Created low stock product: {test_product_low_stock_id}")

# Create product with variants
variant_id_1 = str(uuid.uuid4())
variant_id_2 = str(uuid.uuid4())
db.products.insert_one({
    "_id": test_product_with_variants_id,
    "vendorId": vendor_id,
    "nameAr": "منتج بخيارات",
    "nameEn": "Product with Variants",
    "description": "منتج بخيارات متعددة",
    "category": "JEWELRY",
    "price": 40.0,
    "stock": 10,
    "isActive": True,
    "hasVariants": True,
    "variants": [
        {
            "id": variant_id_1,
            "name": "صغير",
            "price": 40.0,
            "stock": 5,
            "image": ""
        },
        {
            "id": variant_id_2,
            "name": "كبير",
            "price": 50.0,
            "stock": 1,
            "image": ""
        }
    ],
    "createdAt": datetime.utcnow()
})
print(f"✅ Created product with variants: {test_product_with_variants_id}")

# ============================================================================
# TEST 1: POST /orders with empty body (guest without name/email)
# ============================================================================
print("\n" + "=" * 80)
print("TEST 1: POST /orders - Empty body (guest without name/email)")
print("=" * 80)

try:
    resp = requests.post(f"{BASE_URL}/orders", json={}, timeout=10)
    if resp.status_code == 400:
        error_msg = resp.json().get("error", "")
        if "للشراء كضيف" in error_msg or "الاسم والبريد الإلكتروني مطلوبان" in error_msg:
            test_result("Test 1", True, f"400 with correct Arabic error: {error_msg}")
        else:
            test_result("Test 1", False, f"400 but wrong error message: {error_msg}")
    else:
        test_result("Test 1", False, f"Expected 400, got {resp.status_code}: {resp.text[:200]}")
except Exception as e:
    test_result("Test 1", False, f"Exception: {e}")

# ============================================================================
# TEST 2: POST /orders as guest with valid guest info but empty items[]
# ============================================================================
print("\n" + "=" * 80)
print("TEST 2: POST /orders - Guest with empty cart")
print("=" * 80)

try:
    resp = requests.post(f"{BASE_URL}/orders", json={
        "guest": {
            "name": "ضيف اختبار",
            "email": GUEST_EMAIL,
            "phone": "+96812345678"
        },
        "items": [],
        "shippingAddress": {
            "name": "ضيف اختبار",
            "phone": "+96812345678",
            "addressLine": "شارع الاختبار",
            "governorate": "MUSCAT"
        },
        "paymentMethod": "COD"
    }, timeout=10)
    
    if resp.status_code == 400:
        error_msg = resp.json().get("error", "")
        if "السلة فارغة" in error_msg:
            test_result("Test 2", True, f"400 with correct Arabic error: {error_msg}")
        else:
            test_result("Test 2", False, f"400 but wrong error message: {error_msg}")
    else:
        test_result("Test 2", False, f"Expected 400, got {resp.status_code}: {resp.text[:200]}")
except Exception as e:
    test_result("Test 2", False, f"Exception: {e}")

# ============================================================================
# TEST 3: POST /orders with items but no shippingAddress
# ============================================================================
print("\n" + "=" * 80)
print("TEST 3: POST /orders - Items but no shipping address")
print("=" * 80)

try:
    resp = requests.post(f"{BASE_URL}/orders", json={
        "guest": {
            "name": "ضيف اختبار",
            "email": GUEST_EMAIL,
            "phone": "+96812345678"
        },
        "items": [
            {
                "productId": test_product_id,
                "quantity": 1
            }
        ],
        "paymentMethod": "COD"
    }, timeout=10)
    
    if resp.status_code == 400:
        error_msg = resp.json().get("error", "")
        if "عنوان الشحن" in error_msg:
            test_result("Test 3", True, f"400 with correct Arabic error: {error_msg}")
        else:
            test_result("Test 3", False, f"400 but wrong error message: {error_msg}")
    else:
        test_result("Test 3", False, f"Expected 400, got {resp.status_code}: {resp.text[:200]}")
except Exception as e:
    test_result("Test 3", False, f"Exception: {e}")

# ============================================================================
# TEST 4: POST /orders with non-existent product
# ============================================================================
print("\n" + "=" * 80)
print("TEST 4: POST /orders - Non-existent product")
print("=" * 80)

try:
    fake_product_id = str(uuid.uuid4())
    resp = requests.post(f"{BASE_URL}/orders", json={
        "guest": {
            "name": "ضيف اختبار",
            "email": GUEST_EMAIL,
            "phone": "+96812345678"
        },
        "items": [
            {
                "productId": fake_product_id,
                "quantity": 1
            }
        ],
        "shippingAddress": {
            "name": "ضيف اختبار",
            "phone": "+96812345678",
            "addressLine": "شارع الاختبار",
            "governorate": "MUSCAT"
        },
        "paymentMethod": "COD"
    }, timeout=10)
    
    if resp.status_code == 409:
        error_msg = resp.json().get("error", "")
        if "بعض المنتجات لم تعد متاحة" in error_msg:
            test_result("Test 4", True, f"409 with correct Arabic error: {error_msg}")
        else:
            test_result("Test 4", False, f"409 but wrong error message: {error_msg}")
    else:
        test_result("Test 4", False, f"Expected 409, got {resp.status_code}: {resp.text[:200]}")
except Exception as e:
    test_result("Test 4", False, f"Exception: {e}")

# ============================================================================
# TEST 5: POST /orders as guest with email that has existing password-protected user
# ============================================================================
print("\n" + "=" * 80)
print("TEST 5: POST /orders - Guest email already registered with password")
print("=" * 80)

try:
    resp = requests.post(f"{BASE_URL}/orders", json={
        "guest": {
            "name": "محاولة ضيف",
            "email": EXISTING_USER_EMAIL,  # This email already has a password
            "phone": "+96812345678"
        },
        "items": [
            {
                "productId": test_product_id,
                "quantity": 1
            }
        ],
        "shippingAddress": {
            "name": "محاولة ضيف",
            "phone": "+96812345678",
            "addressLine": "شارع الاختبار",
            "governorate": "MUSCAT"
        },
        "paymentMethod": "COD"
    }, timeout=10)
    
    if resp.status_code == 409:
        error_msg = resp.json().get("error", "")
        if "هذا البريد مسجّل مسبقاً" in error_msg:
            test_result("Test 5", True, f"409 with correct Arabic error: {error_msg}")
        else:
            test_result("Test 5", False, f"409 but wrong error message: {error_msg}")
    else:
        test_result("Test 5", False, f"Expected 409, got {resp.status_code}: {resp.text[:200]}")
except Exception as e:
    test_result("Test 5", False, f"Exception: {e}")

# ============================================================================
# TEST 6: POST /orders authenticated with insufficient stock
# ============================================================================
print("\n" + "=" * 80)
print("TEST 6: POST /orders - Authenticated with insufficient stock")
print("=" * 80)

try:
    resp = buyer_session.post(f"{BASE_URL}/orders", json={
        "items": [
            {
                "productId": test_product_low_stock_id,
                "quantity": 10  # Product only has stock=1
            }
        ],
        "shippingAddress": {
            "name": "Phase8 Buyer",
            "phone": "+96812345678",
            "addressLine": "شارع الاختبار",
            "governorate": "MUSCAT"
        },
        "paymentMethod": "COD"
    }, timeout=10)
    
    if resp.status_code in [400, 409]:
        error_msg = resp.json().get("error", "")
        if "الكمية المتاحة" in error_msg or "غير كافية" in error_msg:
            test_result("Test 6", True, f"{resp.status_code} with correct Arabic error: {error_msg}")
        else:
            test_result("Test 6", False, f"{resp.status_code} but wrong error message: {error_msg}")
    else:
        test_result("Test 6", False, f"Expected 400/409, got {resp.status_code}: {resp.text[:200]}")
except Exception as e:
    test_result("Test 6", False, f"Exception: {e}")

# ============================================================================
# TEST 7: POST /orders authenticated with variant insufficient stock
# ============================================================================
print("\n" + "=" * 80)
print("TEST 7: POST /orders - Authenticated with variant insufficient stock")
print("=" * 80)

try:
    resp = buyer_session.post(f"{BASE_URL}/orders", json={
        "items": [
            {
                "productId": test_product_with_variants_id,
                "variantId": variant_id_2,  # This variant has stock=1
                "quantity": 5
            }
        ],
        "shippingAddress": {
            "name": "Phase8 Buyer",
            "phone": "+96812345678",
            "addressLine": "شارع الاختبار",
            "governorate": "MUSCAT"
        },
        "paymentMethod": "COD"
    }, timeout=10)
    
    if resp.status_code in [400, 409]:
        error_msg = resp.json().get("error", "")
        if "الكمية المتاحة" in error_msg or "غير كافية" in error_msg:
            test_result("Test 7", True, f"{resp.status_code} with correct Arabic error: {error_msg}")
        else:
            test_result("Test 7", False, f"{resp.status_code} but wrong error message: {error_msg}")
    else:
        test_result("Test 7", False, f"Expected 400/409, got {resp.status_code}: {resp.text[:200]}")
except Exception as e:
    test_result("Test 7", False, f"Exception: {e}")

# ============================================================================
# TEST 8: POST /orders authenticated with valid COD payment (SUCCESS PATH)
# ============================================================================
print("\n" + "=" * 80)
print("TEST 8: POST /orders - Authenticated with valid COD payment (SUCCESS)")
print("=" * 80)

created_order_id = None
try:
    resp = buyer_session.post(f"{BASE_URL}/orders", json={
        "items": [
            {
                "productId": test_product_id,
                "quantity": 2
            }
        ],
        "shippingAddress": {
            "name": "Phase8 Buyer",
            "phone": "+96812345678",
            "addressLine": "شارع الاختبار، مسقط",
            "governorate": "MUSCAT",
            "city": "مسقط"
        },
        "paymentMethod": "COD"
    }, timeout=30)
    
    if resp.status_code == 200:
        data = resp.json()
        if data.get("success") and data.get("order"):
            order = data["order"]
            created_order_id = order.get("id")
            
            # Verify response structure
            checks = []
            checks.append(("success field", data.get("success") == True))
            checks.append(("order.id present", created_order_id is not None))
            checks.append(("order.status", order.get("status") == "PAID"))
            checks.append(("order.paymentProvider", order.get("paymentProvider") == "COD"))
            checks.append(("order.totalPaid > 0", order.get("totalPaid", 0) > 0))
            checks.append(("order.items array", isinstance(order.get("items"), list)))
            checks.append(("order.shippingAddress", order.get("shippingAddress") is not None))
            
            all_passed = all(check[1] for check in checks)
            if all_passed:
                test_result("Test 8", True, f"COD order created successfully: {created_order_id}")
                print(f"   Order details: status={order.get('status')}, totalPaid={order.get('totalPaid')} OMR")
            else:
                failed_checks = [check[0] for check in checks if not check[1]]
                test_result("Test 8", False, f"Response structure incomplete: {failed_checks}")
        else:
            test_result("Test 8", False, f"Response missing success/order fields: {data}")
    else:
        test_result("Test 8", False, f"Expected 200, got {resp.status_code}: {resp.text[:200]}")
except Exception as e:
    test_result("Test 8", False, f"Exception: {e}")

# ============================================================================
# TEST 9: GET /api/orders unauthenticated
# ============================================================================
print("\n" + "=" * 80)
print("TEST 9: GET /api/orders - Unauthenticated")
print("=" * 80)

try:
    resp = requests.get(f"{BASE_URL}/orders", timeout=10)
    if resp.status_code == 401:
        error_msg = resp.json().get("error", "")
        if "غير مصرح" in error_msg:
            test_result("Test 9", True, f"401 with correct Arabic error: {error_msg}")
        else:
            test_result("Test 9", False, f"401 but wrong error message: {error_msg}")
    else:
        test_result("Test 9", False, f"Expected 401, got {resp.status_code}: {resp.text[:200]}")
except Exception as e:
    test_result("Test 9", False, f"Exception: {e}")

# ============================================================================
# TEST 10: GET /api/orders authenticated as buyer
# ============================================================================
print("\n" + "=" * 80)
print("TEST 10: GET /api/orders - Authenticated as buyer")
print("=" * 80)

try:
    resp = buyer_session.get(f"{BASE_URL}/orders", timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        if "orders" in data and isinstance(data["orders"], list):
            orders_count = len(data["orders"])
            test_result("Test 10", True, f"200 with orders array ({orders_count} orders)")
            
            # Verify the order we just created is in the list
            if created_order_id and orders_count > 0:
                order_ids = [o.get("id") for o in data["orders"]]
                if created_order_id in order_ids:
                    print(f"   ✓ Created order {created_order_id} found in buyer's order list")
                else:
                    print(f"   ⚠ Created order {created_order_id} NOT found in list")
        else:
            test_result("Test 10", False, f"Response missing 'orders' array: {data}")
    else:
        test_result("Test 10", False, f"Expected 200, got {resp.status_code}: {resp.text[:200]}")
except Exception as e:
    test_result("Test 10", False, f"Exception: {e}")

# ============================================================================
# REGRESSION TEST 1: POST /api/webhooks/thawani (unsigned)
# ============================================================================
print("\n" + "=" * 80)
print("REGRESSION 1: POST /api/webhooks/thawani - Unsigned webhook")
print("=" * 80)

try:
    resp = requests.post(f"{BASE_URL}/webhooks/thawani", json={
        "event": "test",
        "data": {}
    }, timeout=10)
    
    # Should reject unsigned webhooks with 401 or 501
    if resp.status_code in [401, 501]:
        test_result("Regression 1", True, f"{resp.status_code} - Unsigned webhook rejected")
    else:
        test_result("Regression 1", False, f"Expected 401/501, got {resp.status_code}: {resp.text[:200]}")
except Exception as e:
    test_result("Regression 1", False, f"Exception: {e}")

# ============================================================================
# REGRESSION TEST 2: POST /api/orders/verify with fake sessionId
# ============================================================================
print("\n" + "=" * 80)
print("REGRESSION 2: POST /api/orders/verify - Fake sessionId")
print("=" * 80)

try:
    fake_order_id = str(uuid.uuid4())
    resp = buyer_session.post(f"{BASE_URL}/orders/verify", json={
        "orderId": fake_order_id,
        "sessionId": "fake_session_id_12345"
    }, timeout=10)
    
    if resp.status_code == 404:
        test_result("Regression 2", True, "404 - Order not found with fake sessionId")
    else:
        test_result("Regression 2", False, f"Expected 404, got {resp.status_code}: {resp.text[:200]}")
except Exception as e:
    test_result("Regression 2", False, f"Exception: {e}")

# ============================================================================
# REGRESSION TEST 3: GET /api/orders/[id] as buyer
# ============================================================================
print("\n" + "=" * 80)
print("REGRESSION 3: GET /api/orders/[id] - Buyer can view their order")
print("=" * 80)

if created_order_id:
    try:
        resp = buyer_session.get(f"{BASE_URL}/orders/{created_order_id}", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if "order" in data:
                order = data["order"]
                checks = []
                checks.append(("order.id matches", order.get("id") == created_order_id))
                checks.append(("order.buyerId", order.get("buyerId") == buyer_id))
                checks.append(("order.status", order.get("status") == "PAID"))
                checks.append(("order.items array", isinstance(order.get("items"), list)))
                
                all_passed = all(check[1] for check in checks)
                if all_passed:
                    test_result("Regression 3", True, f"Buyer can view order {created_order_id}")
                else:
                    failed_checks = [check[0] for check in checks if not check[1]]
                    test_result("Regression 3", False, f"Order data incomplete: {failed_checks}")
            else:
                test_result("Regression 3", False, f"Response missing 'order' field: {data}")
        else:
            test_result("Regression 3", False, f"Expected 200, got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        test_result("Regression 3", False, f"Exception: {e}")
else:
    test_result("Regression 3", False, "Skipped - no order was created in Test 8")

# ============================================================================
# CLEANUP: Delete test order
# ============================================================================
print("\n" + "=" * 80)
print("CLEANUP: Deleting test data")
print("=" * 80)

if created_order_id:
    try:
        # Delete the order we created
        db.orders.delete_one({"_id": created_order_id})
        print(f"✅ Deleted test order: {created_order_id}")
        
        # Restore product stock (we decremented it during order creation)
        db.products.update_one(
            {"_id": test_product_id},
            {"$inc": {"stock": 2, "salesCount": -2}}
        )
        print(f"✅ Restored product stock for: {test_product_id}")
    except Exception as e:
        print(f"⚠ Cleanup error: {e}")

# Delete test users and products
try:
    db.users.delete_many({"email": {"$regex": f"phase8_.*_{TIMESTAMP}@test.com"}})
    db.products.delete_many({"_id": {"$in": [test_product_id, test_product_low_stock_id, test_product_with_variants_id]}})
    print("✅ Deleted test users and products")
except Exception as e:
    print(f"⚠ Cleanup error: {e}")

# ============================================================================
# SUMMARY
# ============================================================================
print("\n" + "=" * 80)
print("TEST SUMMARY")
print("=" * 80)
print(f"Total tests: {total_tests}")
print(f"✅ Passed: {passed_tests}")
print(f"❌ Failed: {failed_tests}")
print(f"Success rate: {(passed_tests/total_tests*100):.1f}%")
print("=" * 80)

if failed_tests == 0:
    print("🎉 ALL TESTS PASSED!")
    print("\n✅ PHASE 8 REGRESSION TEST COMPLETE")
    print("   POST /orders (checkout) extraction working correctly:")
    print("   • Guest checkout validation (name/email required)")
    print("   • Empty cart validation")
    print("   • Shipping address validation")
    print("   • Product availability checks")
    print("   • Email conflict detection (existing user)")
    print("   • Stock validation (simple and variant products)")
    print("   • COD order creation (success path)")
    print("   • Response structure validation")
    print("\n✅ GET /orders (buyer list) working correctly:")
    print("   • Authentication required (401 for unauth)")
    print("   • Returns orders array for authenticated buyer")
    print("\n✅ REGRESSION TESTS PASSED:")
    print("   • POST /api/webhooks/thawani (signature validation)")
    print("   • POST /api/orders/verify (order not found)")
    print("   • GET /api/orders/[id] (buyer access)")
else:
    print(f"⚠️  {failed_tests} test(s) failed. Review output above.")
    exit(1)
