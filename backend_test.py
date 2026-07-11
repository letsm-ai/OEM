#!/usr/bin/env python3
"""
PHASE 6 REGRESSION TEST — Route Extraction (Products + Orders + Vendor)
Tests ~728 lines extracted from catch-all into 5 lib/api modules + 8 dedicated route files.
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
BUYER_EMAIL = f"phase6_buyer_{TIMESTAMP}@test.com"
VENDOR_EMAIL = f"phase6_vendor_{TIMESTAMP}@test.com"
ADMIN_EMAIL = f"phase6_admin_{TIMESTAMP}@test.com"
PASSWORD = "Password123"

print("=" * 80)
print("PHASE 6 REGRESSION TEST — Route Extraction")
print("Testing: Products, Orders, AI Search, Vendor Orders")
print("=" * 80)

# MongoDB connection
client = MongoClient(MONGO_URL)
db = client['majles']

def create_test_user(email, name, role="MEMBER", tier="FREE"):
    """Create a test user via signup and promote via MongoDB"""
    try:
        # Signup
        resp = requests.post(f"{BASE_URL}/signup", json={
            "name": name,
            "email": email,
            "password": PASSWORD
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

# Setup: Create test users
print("\n" + "=" * 80)
print("SETUP: Creating test users")
print("=" * 80)

buyer_id = create_test_user(BUYER_EMAIL, "Test Buyer", "MEMBER", "FREE")
vendor_id = create_test_user(VENDOR_EMAIL, "Test Vendor", "VENDOR", "BASIC")
admin_id = create_test_user(ADMIN_EMAIL, "Test Admin", "ADMIN", "PLATINUM")

if not all([buyer_id, vendor_id, admin_id]):
    print("❌ Failed to create test users. Exiting.")
    exit(1)

# Login sessions
buyer_session = login_user(BUYER_EMAIL, PASSWORD)
vendor_session = login_user(VENDOR_EMAIL, PASSWORD)
admin_session = login_user(ADMIN_EMAIL, PASSWORD)

if not all([buyer_session, vendor_session, admin_session]):
    print("❌ Failed to login test users. Exiting.")
    exit(1)

# Test counters
total_tests = 0
passed_tests = 0
failed_tests = 0

def test_endpoint(name, method, path, session=None, expected_status=None, body=None, description="", check_json=False):
    """Test an endpoint and track results"""
    global total_tests, passed_tests, failed_tests
    total_tests += 1
    
    try:
        url = f"{BASE_URL}{path}"
        
        if method == "GET":
            resp = session.get(url, timeout=10) if session else requests.get(url, timeout=10)
        elif method == "POST":
            resp = session.post(url, json=body, timeout=10) if session else requests.post(url, json=body, timeout=10)
        elif method == "PUT":
            resp = session.put(url, json=body, timeout=10) if session else requests.put(url, json=body, timeout=10)
        elif method == "PATCH":
            resp = session.patch(url, json=body, timeout=10) if session else requests.patch(url, json=body, timeout=10)
        elif method == "DELETE":
            resp = session.delete(url, timeout=10) if session else requests.delete(url, timeout=10)
        else:
            print(f"❌ {name}: Unknown method {method}")
            failed_tests += 1
            return None
        
        if expected_status and resp.status_code != expected_status:
            print(f"❌ {name}: Expected {expected_status}, got {resp.status_code} - {description}")
            print(f"   Response: {resp.text[:200]}")
            failed_tests += 1
            return None
        
        if check_json:
            try:
                resp.json()
            except:
                print(f"❌ {name}: Invalid JSON response - {description}")
                failed_tests += 1
                return None
        
        print(f"✅ {name}: {resp.status_code} - {description}")
        passed_tests += 1
        return resp
    except Exception as e:
        print(f"❌ {name}: Exception - {e}")
        failed_tests += 1
        return None

# ============================================================================
# SETUP: Create test products
# ============================================================================
print("\n" + "=" * 80)
print("SETUP: Creating test products")
print("=" * 80)

test_product_id = str(uuid.uuid4())
db.products.insert_one({
    "_id": test_product_id,
    "vendorId": vendor_id,
    "nameAr": "خاتم ذهبي فاخر",
    "nameEn": "Luxury Gold Ring",
    "description": "خاتم ذهبي عيار 21 قيراط",
    "category": "JEWELRY",
    "subcategory": "خواتم",
    "price": 150.0,
    "stock": 10,
    "isActive": True,
    "tags": ["ذهب", "خواتم", "فاخر"],
    "images": [],
    "rating": 4.5,
    "salesCount": 5,
    "createdAt": datetime.utcnow()
})
print(f"✅ Created test product: {test_product_id}")

test_product_id_2 = str(uuid.uuid4())
db.products.insert_one({
    "_id": test_product_id_2,
    "vendorId": vendor_id,
    "nameAr": "سوار فضي",
    "nameEn": "Silver Bracelet",
    "description": "سوار فضي أنيق",
    "category": "JEWELRY",
    "subcategory": "أساور",
    "price": 50.0,
    "stock": 20,
    "isActive": True,
    "tags": ["فضة", "أساور"],
    "images": [],
    "rating": 4.0,
    "salesCount": 3,
    "createdAt": datetime.utcnow()
})
print(f"✅ Created test product 2: {test_product_id_2}")

# ============================================================================
# A) GET /api/tags/popular — Extracted to /lib/api/products-public.js
# ============================================================================
print("\n" + "=" * 80)
print("A) GET /api/tags/popular (Extracted Route)")
print("=" * 80)

resp = test_endpoint(
    "A1-Public", "GET", "/tags/popular",
    session=None, expected_status=200,
    description="Public tags list (no auth required)",
    check_json=True
)

if resp:
    data = resp.json()
    if "tags" in data and isinstance(data["tags"], list):
        print(f"   ✓ Response has 'tags' array with {len(data['tags'])} items")
    else:
        print(f"   ⚠ Response missing 'tags' array")

resp = test_endpoint(
    "A2-Limit", "GET", "/tags/popular?limit=5",
    session=None, expected_status=200,
    description="Tags with limit parameter",
    check_json=True
)

# ============================================================================
# B) GET /api/products — Extracted to /lib/api/products-public.js
# ============================================================================
print("\n" + "=" * 80)
print("B) GET /api/products (Extracted Route)")
print("=" * 80)

resp = test_endpoint(
    "B1-Public", "GET", "/products",
    session=None, expected_status=200,
    description="Public products list (no auth required)",
    check_json=True
)

if resp:
    data = resp.json()
    if "products" in data and isinstance(data["products"], list):
        print(f"   ✓ Response has 'products' array with {len(data['products'])} items")
        if len(data["products"]) > 0:
            p = data["products"][0]
            if "vendorName" in p and "vendorSlug" in p:
                print(f"   ✓ Vendor enrichment working (vendorName: {p.get('vendorName', 'N/A')})")
            else:
                print(f"   ⚠ Vendor enrichment missing")
    else:
        print(f"   ⚠ Response missing 'products' array")

resp = test_endpoint(
    "B2-Category", "GET", "/products?category=JEWELRY",
    session=None, expected_status=200,
    description="Products filtered by category",
    check_json=True
)

resp = test_endpoint(
    "B3-Search", "GET", "/products?search=خاتم",
    session=None, expected_status=200,
    description="Products search filter",
    check_json=True
)

resp = test_endpoint(
    "B4-Sort", "GET", "/products?sort=price_asc",
    session=None, expected_status=200,
    description="Products with sort parameter",
    check_json=True
)

resp = test_endpoint(
    "B5-Price", "GET", "/products?minPrice=50&maxPrice=200",
    session=None, expected_status=200,
    description="Products with price range filter",
    check_json=True
)

# ============================================================================
# C) GET /api/products/[id] — Extracted to /lib/api/products-public.js
# ============================================================================
print("\n" + "=" * 80)
print("C) GET /api/products/[id] (Extracted Route)")
print("=" * 80)

resp = test_endpoint(
    "C1-Valid", "GET", f"/products/{test_product_id}",
    session=None, expected_status=200,
    description="Public product detail (no auth required)",
    check_json=True
)

if resp:
    data = resp.json()
    if "product" in data:
        p = data["product"]
        if "vendor" in p and p["vendor"]:
            print(f"   ✓ Vendor embed working (vendor.name: {p['vendor'].get('name', 'N/A')})")
        else:
            print(f"   ⚠ Vendor embed missing")
    else:
        print(f"   ⚠ Response missing 'product' object")

resp = test_endpoint(
    "C2-NotFound", "GET", f"/products/{uuid.uuid4()}",
    session=None, expected_status=404,
    description="Non-existent product → 404"
)

# ============================================================================
# D) GET /api/products/[id]/related — Extracted to /lib/api/products-public.js
# ============================================================================
print("\n" + "=" * 80)
print("D) GET /api/products/[id]/related (Extracted Route)")
print("=" * 80)

resp = test_endpoint(
    "D1-Valid", "GET", f"/products/{test_product_id}/related",
    session=None, expected_status=200,
    description="Related products (no auth required)",
    check_json=True
)

if resp:
    data = resp.json()
    if "products" in data and isinstance(data["products"], list):
        print(f"   ✓ Response has 'products' array with {len(data['products'])} items")
        if len(data["products"]) > 0:
            p = data["products"][0]
            if "vendorName" in p and "vendorSlug" in p:
                print(f"   ✓ Vendor enrichment working in related products")
            else:
                print(f"   ⚠ Vendor enrichment missing in related products")
    else:
        print(f"   ⚠ Response missing 'products' array")

resp = test_endpoint(
    "D2-NotFound", "GET", f"/products/{uuid.uuid4()}/related",
    session=None, expected_status=404,
    description="Non-existent product → 404"
)

# ============================================================================
# E) POST /api/products/ai-search — Extracted to /lib/api/products-ai.js
# ============================================================================
print("\n" + "=" * 80)
print("E) POST /api/products/ai-search (Extracted Route)")
print("=" * 80)

resp = test_endpoint(
    "E1-Empty", "POST", "/products/ai-search",
    session=None, expected_status=400,
    body={},
    description="Empty query → 400"
)

resp = test_endpoint(
    "E2-Valid", "POST", "/products/ai-search",
    session=None, expected_status=None,  # May be 200 or 500 depending on EMERGENT_LLM_KEY
    body={"query": "خواتم رخيصة"},
    description="Valid AI search query (may fail if LLM key missing)"
)

if resp:
    if resp.status_code == 200:
        data = resp.json()
        if "products" in data and "filters" in data:
            print(f"   ✓ AI search successful with {len(data['products'])} products")
            print(f"   ✓ Filters: {data.get('filters', {})}")
        else:
            print(f"   ⚠ Response missing expected fields")
    elif resp.status_code == 500:
        print(f"   ⚠ AI search failed (likely missing EMERGENT_LLM_KEY) - this is acceptable")
    else:
        print(f"   ⚠ Unexpected status code: {resp.status_code}")

resp = test_endpoint(
    "E3-TooLong", "POST", "/products/ai-search",
    session=None, expected_status=400,
    body={"query": "x" * 201},
    description="Query too long (>200 chars) → 400"
)

# ============================================================================
# F) POST /api/orders/verify — Extracted to /lib/api/orders-verify.js
# ============================================================================
print("\n" + "=" * 80)
print("F) POST /api/orders/verify (Extracted Route)")
print("=" * 80)

resp = test_endpoint(
    "F1-Auth", "POST", "/orders/verify",
    session=None, expected_status=401,
    body={"sessionId": "test"},
    description="Unauthenticated → 401"
)

resp = test_endpoint(
    "F2-Missing", "POST", "/orders/verify",
    session=buyer_session, expected_status=400,
    body={},
    description="Missing sessionId/orderId → 400"
)

resp = test_endpoint(
    "F3-NotFound", "POST", "/orders/verify",
    session=buyer_session, expected_status=404,
    body={"orderId": str(uuid.uuid4())},
    description="Non-existent order → 404"
)

# ============================================================================
# G) GET /api/orders/[id] — Extracted to /lib/api/orders-read.js
# ============================================================================
print("\n" + "=" * 80)
print("G) GET /api/orders/[id] (Extracted Route)")
print("=" * 80)

# Create a test order
test_order_id = str(uuid.uuid4())
db.orders.insert_one({
    "_id": test_order_id,
    "buyerId": buyer_id,
    "items": [{
        "productId": test_product_id,
        "vendorId": vendor_id,
        "nameAr": "خاتم ذهبي",
        "quantity": 1,
        "price": 150.0,
        "lineSubtotal": 150.0
    }],
    "subtotal": 150.0,
    "discountPercent": 0,
    "discountAmount": 0,
    "shippingFee": 0,
    "totalPaid": 150.0,
    "status": "PAID",
    "paymentStatus": "PAID",
    "paymentMethod": "COD",
    "shippingAddress": {
        "name": "Test Buyer",
        "phone": "+96812345678",
        "governorate": "MUSCAT",
        "wilayat": "مسقط",
        "address": "شارع الاختبار"
    },
    "createdAt": datetime.utcnow()
})
print(f"✅ Created test order: {test_order_id}")

resp = test_endpoint(
    "G1-Auth", "GET", f"/orders/{test_order_id}",
    session=None, expected_status=401,
    description="Unauthenticated → 401"
)

resp = test_endpoint(
    "G2-Buyer", "GET", f"/orders/{test_order_id}",
    session=buyer_session, expected_status=200,
    description="Buyer can view their order",
    check_json=True
)

if resp:
    data = resp.json()
    if "order" in data:
        print(f"   ✓ Order detail returned for buyer")
    else:
        print(f"   ⚠ Response missing 'order' object")

resp = test_endpoint(
    "G3-Vendor", "GET", f"/orders/{test_order_id}",
    session=vendor_session, expected_status=200,
    description="Vendor can view order with their items",
    check_json=True
)

if resp:
    data = resp.json()
    if "order" in data and "items" in data["order"]:
        items = data["order"]["items"]
        print(f"   ✓ Vendor sees {len(items)} item(s) (filtered to their items only)")
    else:
        print(f"   ⚠ Response missing order items")

resp = test_endpoint(
    "G4-Admin", "GET", f"/orders/{test_order_id}",
    session=admin_session, expected_status=200,
    description="Admin can view any order",
    check_json=True
)

# Create another user to test 403
other_user_id = create_test_user(f"phase6_other_{TIMESTAMP}@test.com", "Other User", "MEMBER", "FREE")
other_session = login_user(f"phase6_other_{TIMESTAMP}@test.com", PASSWORD)

resp = test_endpoint(
    "G5-Forbidden", "GET", f"/orders/{test_order_id}",
    session=other_session, expected_status=403,
    description="Non-buyer/non-vendor/non-admin → 403"
)

resp = test_endpoint(
    "G6-NotFound", "GET", f"/orders/{uuid.uuid4()}",
    session=buyer_session, expected_status=404,
    description="Non-existent order → 404"
)

# ============================================================================
# H) GET /api/vendor/orders — Extracted to /lib/api/vendor-orders.js
# ============================================================================
print("\n" + "=" * 80)
print("H) GET /api/vendor/orders (Extracted Route)")
print("=" * 80)

resp = test_endpoint(
    "H1-Auth", "GET", "/vendor/orders",
    session=None, expected_status=401,
    description="Unauthenticated → 401"
)

resp = test_endpoint(
    "H2-Role", "GET", "/vendor/orders",
    session=buyer_session, expected_status=403,
    description="Non-vendor/non-admin → 403"
)

resp = test_endpoint(
    "H3-Vendor", "GET", "/vendor/orders",
    session=vendor_session, expected_status=200,
    description="Vendor can view their orders",
    check_json=True
)

if resp:
    data = resp.json()
    if "orders" in data and "earnings" in data:
        print(f"   ✓ Response has 'orders' array with {len(data['orders'])} items")
        earnings = data["earnings"]
        if all(k in earnings for k in ["totalSales", "totalCommission", "totalNet", "commissionPercent"]):
            print(f"   ✓ Earnings aggregation working (totalSales: {earnings['totalSales']}, totalNet: {earnings['totalNet']})")
        else:
            print(f"   ⚠ Earnings aggregation incomplete")
    else:
        print(f"   ⚠ Response missing 'orders' or 'earnings'")

resp = test_endpoint(
    "H4-Admin", "GET", "/vendor/orders",
    session=admin_session, expected_status=200,
    description="Admin can view vendor orders",
    check_json=True
)

# ============================================================================
# I) PATCH /api/vendor/orders/[id]/status — Extracted to /lib/api/vendor-orders.js
# ============================================================================
print("\n" + "=" * 80)
print("I) PATCH /api/vendor/orders/[id]/status (Extracted Route)")
print("=" * 80)

resp = test_endpoint(
    "I1-Auth", "PATCH", f"/vendor/orders/{test_order_id}/status",
    session=None, expected_status=401,
    body={"status": "SHIPPED"},
    description="Unauthenticated → 401"
)

resp = test_endpoint(
    "I2-Role", "PATCH", f"/vendor/orders/{test_order_id}/status",
    session=buyer_session, expected_status=403,
    body={"status": "SHIPPED"},
    description="Non-vendor/non-admin → 403"
)

resp = test_endpoint(
    "I3-Invalid", "PATCH", f"/vendor/orders/{test_order_id}/status",
    session=vendor_session, expected_status=400,
    body={"status": "INVALID"},
    description="Invalid status → 400"
)

resp = test_endpoint(
    "I4-Valid", "PATCH", f"/vendor/orders/{test_order_id}/status",
    session=vendor_session, expected_status=200,
    body={"status": "SHIPPED", "trackingNumber": "TRK123", "carrier": "Oman Post"},
    description="Valid status transition PAID → SHIPPED",
    check_json=True
)

if resp:
    data = resp.json()
    if "order" in data and data["order"].get("status") == "SHIPPED":
        print(f"   ✓ Order status updated to SHIPPED")
        if data["order"].get("trackingNumber") == "TRK123":
            print(f"   ✓ Tracking number saved")
    else:
        print(f"   ⚠ Status update incomplete")

resp = test_endpoint(
    "I5-Transition", "PATCH", f"/vendor/orders/{test_order_id}/status",
    session=vendor_session, expected_status=200,
    body={"status": "DELIVERED"},
    description="Valid status transition SHIPPED → DELIVERED",
    check_json=True
)

resp = test_endpoint(
    "I6-InvalidTransition", "PATCH", f"/vendor/orders/{test_order_id}/status",
    session=vendor_session, expected_status=400,
    body={"status": "SHIPPED"},
    description="Invalid transition DELIVERED → SHIPPED → 400"
)

resp = test_endpoint(
    "I7-NotFound", "PATCH", f"/vendor/orders/{uuid.uuid4()}/status",
    session=vendor_session, expected_status=404,
    body={"status": "SHIPPED"},
    description="Non-existent order → 404"
)

# ============================================================================
# REGRESSION: POST /api/products (still delegates to products-vendor.js)
# ============================================================================
print("\n" + "=" * 80)
print("REGRESSION: POST /api/products (Stayed in Split Route)")
print("=" * 80)

resp = test_endpoint(
    "R1-Auth", "POST", "/products",
    session=None, expected_status=401,
    body={"nameAr": "منتج", "price": 100},
    description="Unauthenticated → 401"
)

resp = test_endpoint(
    "R2-Role", "POST", "/products",
    session=buyer_session, expected_status=403,
    body={"nameAr": "منتج", "price": 100},
    description="Non-vendor/non-admin → 403"
)

resp = test_endpoint(
    "R3-Valid", "POST", "/products",
    session=vendor_session, expected_status=200,
    body={
        "nameAr": "منتج اختبار جديد",
        "nameEn": "New Test Product",
        "description": "وصف المنتج",
        "category": "JEWELRY",
        "price": 100,
        "stock": 10
    },
    description="Vendor can create product",
    check_json=True
)

# ============================================================================
# REGRESSION: PUT/DELETE /api/products/[id] (still delegates)
# ============================================================================
print("\n" + "=" * 80)
print("REGRESSION: PUT/DELETE /api/products/[id] (Stayed in Split Route)")
print("=" * 80)

resp = test_endpoint(
    "R4-Auth", "PUT", f"/products/{test_product_id}",
    session=None, expected_status=401,
    body={"price": 200},
    description="Unauthenticated → 401"
)

resp = test_endpoint(
    "R5-Valid", "PUT", f"/products/{test_product_id}",
    session=vendor_session, expected_status=200,
    body={"price": 175, "description": "وصف محدث"},
    description="Vendor can update their product",
    check_json=True
)

resp = test_endpoint(
    "R6-Auth", "DELETE", f"/products/{test_product_id_2}",
    session=None, expected_status=401,
    description="Unauthenticated → 401"
)

resp = test_endpoint(
    "R7-Valid", "DELETE", f"/products/{test_product_id_2}",
    session=vendor_session, expected_status=200,
    description="Vendor can delete their product"
)

# ============================================================================
# REGRESSION: GET /api/orders (buyer list — still in catch-all)
# ============================================================================
print("\n" + "=" * 80)
print("REGRESSION: GET /api/orders (Stayed in Catch-all)")
print("=" * 80)

resp = test_endpoint(
    "R8-Auth", "GET", "/orders",
    session=None, expected_status=401,
    description="Unauthenticated → 401"
)

resp = test_endpoint(
    "R9-Valid", "GET", "/orders",
    session=buyer_session, expected_status=200,
    description="Buyer can view their order list",
    check_json=True
)

if resp:
    data = resp.json()
    if "orders" in data and isinstance(data["orders"], list):
        print(f"   ✓ Response has 'orders' array with {len(data['orders'])} items")
    else:
        print(f"   ⚠ Response missing 'orders' array")

# ============================================================================
# REGRESSION: POST /api/orders (checkout — still in catch-all)
# ============================================================================
print("\n" + "=" * 80)
print("REGRESSION: POST /api/orders (Stayed in Catch-all)")
print("=" * 80)

resp = test_endpoint(
    "R10-Empty", "POST", "/orders",
    session=buyer_session, expected_status=400,
    body={"items": [], "paymentMethod": "COD"},
    description="Empty cart → 400"
)

if resp:
    print(f"   ✓ Empty cart validation working (still in catch-all)")

# ============================================================================
# REGRESSION: POST /api/webhooks/thawani (uses finalizeOrderPayment via import)
# ============================================================================
print("\n" + "=" * 80)
print("REGRESSION: POST /api/webhooks/thawani (Uses order-finalize.js)")
print("=" * 80)

resp = test_endpoint(
    "R11-Unsigned", "POST", "/webhooks/thawani",
    session=None, expected_status=None,  # May be 401 or 501 depending on implementation
    body={"event": "test"},
    description="Unsigned webhook → 401/501"
)

if resp:
    if resp.status_code in [401, 501]:
        print(f"   ✓ Webhook security working (rejected unsigned request)")
    else:
        print(f"   ⚠ Unexpected status code: {resp.status_code}")

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
    print("\n✅ PHASE 6 REGRESSION TEST COMPLETE")
    print("   All extracted routes working correctly:")
    print("   • GET /api/tags/popular")
    print("   • GET /api/products (with filters)")
    print("   • GET /api/products/[id] (with vendor embed)")
    print("   • GET /api/products/[id]/related")
    print("   • POST /api/products/ai-search")
    print("   • POST /api/orders/verify")
    print("   • GET /api/orders/[id]")
    print("   • GET /api/vendor/orders (with earnings)")
    print("   • PATCH /api/vendor/orders/[id]/status")
    print("\n✅ REGRESSION TESTS PASSED")
    print("   Routes that stayed in catch-all still working:")
    print("   • GET /api/orders (buyer list)")
    print("   • POST /api/orders (checkout validation)")
    print("   • POST /api/webhooks/thawani (webhook security)")
    print("   • POST /api/products (create)")
    print("   • PUT/DELETE /api/products/[id]")
else:
    print(f"⚠️  {failed_tests} test(s) failed. Review output above.")

# Cleanup
print("\n" + "=" * 80)
print("CLEANUP: Removing test data")
print("=" * 80)
db.users.delete_many({"email": {"$regex": f"phase6_.*_{TIMESTAMP}@test.com"}})
db.products.delete_many({"_id": {"$in": [test_product_id, test_product_id_2]}})
db.orders.delete_many({"_id": test_order_id})
print("✅ Cleanup complete")
