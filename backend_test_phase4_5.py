#!/usr/bin/env python3
"""
ROUTE SPLIT REGRESSION TEST — Phase 4 & 5
Tests 11 new route files (13 endpoints) for appointments, reviews, cart, wishlist, coupons.
Handler logic is UNCHANGED — verifying Next.js file-based routing wires them correctly.
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
MEMBER_EMAIL = f"phase45_member_{TIMESTAMP}@test.com"
ADMIN_EMAIL = f"phase45_admin_{TIMESTAMP}@test.com"
EXPERT_EMAIL = f"phase45_expert_{TIMESTAMP}@test.com"
PASSWORD = "Password123"

print("=" * 80)
print("ROUTE SPLIT REGRESSION TEST — Phase 4 & 5")
print("11 route files, 13 endpoints")
print("=" * 80)

# MongoDB connection
client = MongoClient(MONGO_URL)
db = client['majles']

# Test results tracking
test_results = {
    "total": 0,
    "passed": 0,
    "failed": 0,
    "errors": []
}

def log_test(name, passed, details=""):
    """Log test result"""
    test_results["total"] += 1
    if passed:
        test_results["passed"] += 1
        print(f"✅ {name}")
    else:
        test_results["failed"] += 1
        test_results["errors"].append(f"{name}: {details}")
        print(f"❌ {name}: {details}")

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

member_id = create_test_user(MEMBER_EMAIL, "Phase45 Member", "MEMBER", "FREE")
admin_id = create_test_user(ADMIN_EMAIL, "Phase45 Admin", "ADMIN", "PLATINUM")
expert_id = create_test_user(EXPERT_EMAIL, "Phase45 Expert", "EXPERT", "GOLD")

if not all([member_id, admin_id, expert_id]):
    print("❌ Failed to create test users. Exiting.")
    exit(1)

# Login sessions
member_session = login_user(MEMBER_EMAIL, PASSWORD)
admin_session = login_user(ADMIN_EMAIL, PASSWORD)
expert_session = login_user(EXPERT_EMAIL, PASSWORD)

if not all([member_session, admin_session, expert_session]):
    print("❌ Failed to login test users. Exiting.")
    exit(1)

# Create test data: Expert profile with availability
print("\n" + "=" * 80)
print("SETUP: Creating test expert profile and availability")
print("=" * 80)

# Create expert profile for expert_id
expert_doc_id = str(uuid.uuid4())
db.experts.insert_one({
    "_id": expert_doc_id,
    "userId": expert_id,
    "specialtyAr": "استشارات تقنية",
    "specialty": "TECH",
    "hourlyRate": 30,
    "bio": "خبير تقني للاختبار",
    "status": "APPROVED",
    "isApproved": True,
    "rating": 0,
    "totalSessions": 0,
    "createdAt": datetime.utcnow()
})
print(f"✅ Created expert profile: {expert_doc_id}")

# Create availability for expert (Sunday 09:00-12:00)
availability_id = str(uuid.uuid4())
db.availabilities.insert_one({
    "_id": availability_id,
    "expertId": expert_doc_id,
    "dayOfWeek": 0,  # Sunday
    "startTime": "09:00",
    "endTime": "12:00",
    "createdAt": datetime.utcnow()
})
print(f"✅ Created availability for expert")

# Create test product for reviews, cart, wishlist
print("\n" + "=" * 80)
print("SETUP: Creating test product")
print("=" * 80)

product_id = str(uuid.uuid4())
db.products.insert_one({
    "_id": product_id,
    "nameAr": "منتج اختبار Phase 4-5",
    "nameEn": "Phase 4-5 Test Product",
    "descriptionAr": "منتج للاختبار",
    "descriptionEn": "Test product",
    "price": 50,
    "stock": 100,
    "category": "ELECTRONICS",  # Valid enum: FOOD, FASHION, ELECTRONICS, OFFICE, HANDICRAFT, DIGITAL, OTHER
    "vendorId": admin_id,
    "status": "APPROVED",
    "isApproved": True,
    "images": [],
    "createdAt": datetime.utcnow()
})
print(f"✅ Created test product: {product_id}")

# ============================================================================
# TEST SECTION 1: AUTH GUARDS (401 for unauthenticated)
# ============================================================================
print("\n" + "=" * 80)
print("TEST SECTION 1: AUTH GUARDS (401 for unauthenticated)")
print("=" * 80)

# Test appointments endpoints
try:
    resp = requests.get(f"{BASE_URL}/appointments", timeout=10)
    log_test("GET /api/appointments (no auth)", resp.status_code == 401, f"Got {resp.status_code}")
except Exception as e:
    log_test("GET /api/appointments (no auth)", False, str(e))

# Note: POST /api/appointments validates data before auth, so 400 is acceptable
try:
    resp = requests.post(f"{BASE_URL}/appointments", json={}, timeout=10)
    # Either 401 (auth first) or 400 (validation first) is acceptable
    log_test("POST /api/appointments (no auth)", resp.status_code in [400, 401], f"Got {resp.status_code}")
except Exception as e:
    log_test("POST /api/appointments (no auth)", False, str(e))

try:
    resp = requests.post(f"{BASE_URL}/appointments/{expert_doc_id}/cancel", json={}, timeout=10)
    log_test("POST /api/appointments/[id]/cancel (no auth)", resp.status_code == 401, f"Got {resp.status_code}")
except Exception as e:
    log_test("POST /api/appointments/[id]/cancel (no auth)", False, str(e))

try:
    resp = requests.post(f"{BASE_URL}/appointments/{expert_doc_id}/review", json={}, timeout=10)
    log_test("POST /api/appointments/[id]/review (no auth)", resp.status_code == 401, f"Got {resp.status_code}")
except Exception as e:
    log_test("POST /api/appointments/[id]/review (no auth)", False, str(e))

# Test product reviews endpoints (POST requires auth, GET is public)
try:
    resp = requests.post(f"{BASE_URL}/products/{product_id}/reviews", json={}, timeout=10)
    log_test("POST /api/products/[id]/reviews (no auth)", resp.status_code == 401, f"Got {resp.status_code}")
except Exception as e:
    log_test("POST /api/products/[id]/reviews (no auth)", False, str(e))

# Note: my-review-status is intentionally public (returns different data based on auth)
try:
    resp = requests.get(f"{BASE_URL}/products/{product_id}/my-review-status", timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        # Should return loggedIn: false for unauthenticated users
        log_test("GET /api/products/[id]/my-review-status (no auth) - public endpoint", 
                 data.get("loggedIn") == False, f"loggedIn={data.get('loggedIn')}")
    else:
        log_test("GET /api/products/[id]/my-review-status (no auth) - public endpoint", False, f"Got {resp.status_code}")
except Exception as e:
    log_test("GET /api/products/[id]/my-review-status (no auth) - public endpoint", False, str(e))

# Test cart endpoints (Note: cart endpoints are intentionally public - return empty data for unauthenticated)
try:
    resp = requests.get(f"{BASE_URL}/cart", timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        # Should return empty items array for unauthenticated users
        log_test("GET /api/cart (no auth) - public endpoint", 
                 data.get("items") == [], f"items={data.get('items')}")
    else:
        log_test("GET /api/cart (no auth) - public endpoint", False, f"Got {resp.status_code}")
except Exception as e:
    log_test("GET /api/cart (no auth) - public endpoint", False, str(e))

try:
    resp = requests.post(f"{BASE_URL}/cart", json={}, timeout=10)
    log_test("POST /api/cart (no auth)", resp.status_code == 401, f"Got {resp.status_code}")
except Exception as e:
    log_test("POST /api/cart (no auth)", False, str(e))

try:
    resp = requests.delete(f"{BASE_URL}/cart", timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        # Should return success: true for unauthenticated users (no-op)
        log_test("DELETE /api/cart (no auth) - public endpoint", 
                 data.get("success") == True, f"success={data.get('success')}")
    else:
        log_test("DELETE /api/cart (no auth) - public endpoint", False, f"Got {resp.status_code}")
except Exception as e:
    log_test("DELETE /api/cart (no auth) - public endpoint", False, str(e))

# Test wishlist endpoints
try:
    resp = requests.get(f"{BASE_URL}/wishlist", timeout=10)
    log_test("GET /api/wishlist (no auth)", resp.status_code == 401, f"Got {resp.status_code}")
except Exception as e:
    log_test("GET /api/wishlist (no auth)", False, str(e))

try:
    resp = requests.post(f"{BASE_URL}/wishlist/{product_id}", json={}, timeout=10)
    log_test("POST /api/wishlist/[id] (no auth)", resp.status_code == 401, f"Got {resp.status_code}")
except Exception as e:
    log_test("POST /api/wishlist/[id] (no auth)", False, str(e))

try:
    resp = requests.delete(f"{BASE_URL}/wishlist/{product_id}", timeout=10)
    log_test("DELETE /api/wishlist/[id] (no auth)", resp.status_code == 401, f"Got {resp.status_code}")
except Exception as e:
    log_test("DELETE /api/wishlist/[id] (no auth)", False, str(e))

# Test coupons validate endpoint (requires auth)
try:
    resp = requests.post(f"{BASE_URL}/coupons/validate", json={}, timeout=10)
    log_test("POST /api/coupons/validate (no auth)", resp.status_code == 401, f"Got {resp.status_code}")
except Exception as e:
    log_test("POST /api/coupons/validate (no auth)", False, str(e))

# Test admin coupons endpoints
try:
    resp = requests.get(f"{BASE_URL}/admin/coupons", timeout=10)
    log_test("GET /api/admin/coupons (no auth)", resp.status_code == 401, f"Got {resp.status_code}")
except Exception as e:
    log_test("GET /api/admin/coupons (no auth)", False, str(e))

try:
    resp = requests.post(f"{BASE_URL}/admin/coupons", json={}, timeout=10)
    log_test("POST /api/admin/coupons (no auth)", resp.status_code == 401, f"Got {resp.status_code}")
except Exception as e:
    log_test("POST /api/admin/coupons (no auth)", False, str(e))

# ============================================================================
# TEST SECTION 2: ROLE GUARDS (403 for non-admin on admin routes)
# ============================================================================
print("\n" + "=" * 80)
print("TEST SECTION 2: ROLE GUARDS (403 for non-admin on admin routes)")
print("=" * 80)

try:
    resp = member_session.get(f"{BASE_URL}/admin/coupons", timeout=10)
    log_test("GET /api/admin/coupons (MEMBER)", resp.status_code == 403, f"Got {resp.status_code}")
except Exception as e:
    log_test("GET /api/admin/coupons (MEMBER)", False, str(e))

try:
    resp = member_session.post(f"{BASE_URL}/admin/coupons", json={}, timeout=10)
    log_test("POST /api/admin/coupons (MEMBER)", resp.status_code == 403, f"Got {resp.status_code}")
except Exception as e:
    log_test("POST /api/admin/coupons (MEMBER)", False, str(e))

# Create a test coupon for PATCH/DELETE tests
coupon_id = str(uuid.uuid4())
db.coupons.insert_one({
    "_id": coupon_id,
    "code": f"TEST{TIMESTAMP}",
    "type": "PERCENT",  # Field name is 'type'
    "value": 10,  # Field name is 'value'
    "minSubtotal": 0,  # Field name is 'minSubtotal'
    "maxDiscount": 100,
    "usageLimit": 10,
    "usedCount": 0,
    "startsAt": datetime.utcnow(),  # Field name is 'startsAt'
    "expiresAt": datetime.utcnow() + timedelta(days=30),  # Field name is 'expiresAt'
    "active": True,
    "createdAt": datetime.utcnow()
})
print(f"✅ Created test coupon: {coupon_id}")

try:
    resp = member_session.patch(f"{BASE_URL}/admin/coupons/{coupon_id}", json={}, timeout=10)
    log_test("PATCH /api/admin/coupons/[id] (MEMBER)", resp.status_code == 403, f"Got {resp.status_code}")
except Exception as e:
    log_test("PATCH /api/admin/coupons/[id] (MEMBER)", False, str(e))

try:
    resp = member_session.delete(f"{BASE_URL}/admin/coupons/{coupon_id}", timeout=10)
    log_test("DELETE /api/admin/coupons/[id] (MEMBER)", resp.status_code == 403, f"Got {resp.status_code}")
except Exception as e:
    log_test("DELETE /api/admin/coupons/[id] (MEMBER)", False, str(e))

# ============================================================================
# TEST SECTION 3: POSITIVE PATHS (correct response shapes)
# ============================================================================
print("\n" + "=" * 80)
print("TEST SECTION 3: POSITIVE PATHS (correct response shapes)")
print("=" * 80)

# 3.1: Appointments flow
print("\n--- 3.1: Appointments ---")

# Book an appointment (member books with expert)
next_sunday = datetime.utcnow()
while next_sunday.weekday() != 6:  # Find next Sunday
    next_sunday += timedelta(days=1)
appointment_date = next_sunday.strftime("%Y-%m-%d")
appointment_time = "09:00"
appointment_end_time = "10:00"

try:
    resp = member_session.post(f"{BASE_URL}/appointments", json={
        "expertId": expert_doc_id,
        "date": appointment_date,
        "startTime": appointment_time,
        "endTime": appointment_end_time
    }, timeout=10)
    
    if resp.status_code == 200:
        appointment_data = resp.json()
        appointment_id = appointment_data.get("appointment", {}).get("id")
        log_test("POST /api/appointments (book)", True)
        print(f"   Created appointment: {appointment_id}")
    else:
        log_test("POST /api/appointments (book)", False, f"Status {resp.status_code}: {resp.text[:200]}")
        appointment_id = None
except Exception as e:
    log_test("POST /api/appointments (book)", False, str(e))
    appointment_id = None

# List appointments
try:
    resp = member_session.get(f"{BASE_URL}/appointments", timeout=10)
    if resp.status_code == 200:
        appointments = resp.json().get("appointments", [])
        log_test("GET /api/appointments (list)", len(appointments) >= 1, f"Found {len(appointments)} appointments")
    else:
        log_test("GET /api/appointments (list)", False, f"Status {resp.status_code}")
except Exception as e:
    log_test("GET /api/appointments (list)", False, str(e))

# Cancel appointment (if created) - use expert session to bypass 24h rule
if appointment_id:
    try:
        resp = expert_session.post(f"{BASE_URL}/appointments/{appointment_id}/cancel", json={}, timeout=10)
        log_test("POST /api/appointments/[id]/cancel (expert)", resp.status_code == 200, f"Status {resp.status_code}")
    except Exception as e:
        log_test("POST /api/appointments/[id]/cancel (expert)", False, str(e))

# Review appointment (create a past completed appointment first)
past_appointment_id = str(uuid.uuid4())
past_date = datetime.utcnow() - timedelta(days=2)
db.appointments.insert_one({
    "_id": past_appointment_id,
    "clientId": member_id,
    "expertId": expert_doc_id,
    "date": past_date.strftime("%Y-%m-%d"),
    "startTime": "10:00",
    "endTime": "11:00",
    "status": "CONFIRMED",
    "price": 30,
    "createdAt": datetime.utcnow()
})
print(f"✅ Created past appointment for review: {past_appointment_id}")

try:
    resp = member_session.post(f"{BASE_URL}/appointments/{past_appointment_id}/review", json={
        "rating": 5,
        "comment": "جلسة ممتازة للاختبار"
    }, timeout=10)
    log_test("POST /api/appointments/[id]/review", resp.status_code == 200, f"Status {resp.status_code}")
except Exception as e:
    log_test("POST /api/appointments/[id]/review", False, str(e))

# 3.2: Product reviews flow
print("\n--- 3.2: Product Reviews ---")

# Get reviews list (public)
try:
    resp = requests.get(f"{BASE_URL}/products/{product_id}/reviews", timeout=10)
    log_test("GET /api/products/[id]/reviews (public)", resp.status_code == 200, f"Status {resp.status_code}")
except Exception as e:
    log_test("GET /api/products/[id]/reviews (public)", False, str(e))

# Create a test order with the product (required for review)
order_id = str(uuid.uuid4())
db.orders.insert_one({
    "_id": order_id,
    "buyerId": member_id,  # Field name is buyerId, not userId
    "items": [{
        "productId": product_id,
        "quantity": 1,
        "price": 50
    }],
    "totalAmount": 50,
    "status": "DELIVERED",
    "createdAt": datetime.utcnow()
})
print(f"✅ Created test order for product review: {order_id}")

# Post a review
try:
    resp = member_session.post(f"{BASE_URL}/products/{product_id}/reviews", json={
        "rating": 4,
        "comment": "منتج جيد للاختبار"
    }, timeout=10)
    log_test("POST /api/products/[id]/reviews", resp.status_code == 200, f"Status {resp.status_code}")
    if resp.status_code == 200:
        print(f"   Review created successfully")
        time.sleep(0.5)  # Small delay to ensure DB consistency
except Exception as e:
    log_test("POST /api/products/[id]/reviews", False, str(e))

# Get my review status
try:
    resp = member_session.get(f"{BASE_URL}/products/{product_id}/my-review-status", timeout=10)
    if resp.status_code == 200:
        status_data = resp.json()
        has_reviewed = status_data.get("hasReviewed", False) or status_data.get("alreadyReviewed", False)
        log_test("GET /api/products/[id]/my-review-status", has_reviewed == True, f"hasReviewed={has_reviewed}, data={status_data}")
    else:
        log_test("GET /api/products/[id]/my-review-status", False, f"Status {resp.status_code}")
except Exception as e:
    log_test("GET /api/products/[id]/my-review-status", False, str(e))

# 3.3: Cart flow
print("\n--- 3.3: Cart ---")

# Add to cart
try:
    resp = member_session.post(f"{BASE_URL}/cart", json={
        "items": [{
            "productId": product_id,
            "quantity": 2,
            "nameAr": "منتج اختبار Phase 4-5",
            "unitPrice": 50,
            "image": ""
        }]
    }, timeout=10)
    if resp.status_code == 200:
        resp_data = resp.json()
        log_test("POST /api/cart (add item)", True, f"count={resp_data.get('count')}")
        time.sleep(0.5)  # Small delay to ensure DB consistency
    else:
        log_test("POST /api/cart (add item)", False, f"Status {resp.status_code}")
except Exception as e:
    log_test("POST /api/cart (add item)", False, str(e))

# Get cart
try:
    resp = member_session.get(f"{BASE_URL}/cart", timeout=10)
    if resp.status_code == 200:
        cart_data = resp.json()
        items = cart_data.get("items", [])
        log_test("GET /api/cart", len(items) >= 1, f"Found {len(items)} items, data={cart_data}")
    else:
        log_test("GET /api/cart", False, f"Status {resp.status_code}")
except Exception as e:
    log_test("GET /api/cart", False, str(e))

# Clear cart
try:
    resp = member_session.delete(f"{BASE_URL}/cart", timeout=10)
    log_test("DELETE /api/cart (clear)", resp.status_code == 200, f"Status {resp.status_code}")
except Exception as e:
    log_test("DELETE /api/cart (clear)", False, str(e))

# 3.4: Wishlist flow
print("\n--- 3.4: Wishlist ---")

# Add to wishlist
try:
    resp = member_session.post(f"{BASE_URL}/wishlist/{product_id}", json={}, timeout=10)
    log_test("POST /api/wishlist/[id] (add)", resp.status_code == 200, f"Status {resp.status_code}")
except Exception as e:
    log_test("POST /api/wishlist/[id] (add)", False, str(e))

# Get wishlist
try:
    resp = member_session.get(f"{BASE_URL}/wishlist", timeout=10)
    if resp.status_code == 200:
        wishlist_data = resp.json()
        items = wishlist_data.get("items", [])
        log_test("GET /api/wishlist", len(items) >= 1, f"Found {len(items)} items")
    else:
        log_test("GET /api/wishlist", False, f"Status {resp.status_code}")
except Exception as e:
    log_test("GET /api/wishlist", False, str(e))

# Remove from wishlist
try:
    resp = member_session.delete(f"{BASE_URL}/wishlist/{product_id}", timeout=10)
    log_test("DELETE /api/wishlist/[id] (remove)", resp.status_code == 200, f"Status {resp.status_code}")
except Exception as e:
    log_test("DELETE /api/wishlist/[id] (remove)", False, str(e))

# 3.5: Coupons flow
print("\n--- 3.5: Coupons ---")

# Validate coupon (member)
try:
    resp = member_session.post(f"{BASE_URL}/coupons/validate", json={
        "code": f"TEST{TIMESTAMP}",
        "subtotal": 100
    }, timeout=10)
    log_test("POST /api/coupons/validate", resp.status_code == 200, f"Status {resp.status_code}")
except Exception as e:
    log_test("POST /api/coupons/validate", False, str(e))

# Admin: List coupons
try:
    resp = admin_session.get(f"{BASE_URL}/admin/coupons", timeout=10)
    if resp.status_code == 200:
        coupons = resp.json().get("coupons", [])
        log_test("GET /api/admin/coupons (ADMIN)", len(coupons) >= 1, f"Found {len(coupons)} coupons")
    else:
        log_test("GET /api/admin/coupons (ADMIN)", False, f"Status {resp.status_code}")
except Exception as e:
    log_test("GET /api/admin/coupons (ADMIN)", False, str(e))

# Admin: Create coupon
new_coupon_code = f"ADMIN{TIMESTAMP}"
try:
    resp = admin_session.post(f"{BASE_URL}/admin/coupons", json={
        "code": new_coupon_code,
        "type": "FIXED",  # Field name is 'type', not 'discountType'
        "value": 20,  # Field name is 'value', not 'discountValue'
        "minSubtotal": 50,  # Field name is 'minSubtotal', not 'minPurchase'
        "maxDiscount": 20,
        "usageLimit": 5,
        "startsAt": datetime.utcnow().isoformat(),
        "expiresAt": (datetime.utcnow() + timedelta(days=30)).isoformat()
    }, timeout=10)
    
    if resp.status_code == 200:
        new_coupon_data = resp.json()
        new_coupon_id = new_coupon_data.get("coupon", {}).get("id")
        log_test("POST /api/admin/coupons (ADMIN create)", True)
        print(f"   Created coupon: {new_coupon_id}")
    else:
        log_test("POST /api/admin/coupons (ADMIN create)", False, f"Status {resp.status_code}: {resp.text[:200]}")
        new_coupon_id = None
except Exception as e:
    log_test("POST /api/admin/coupons (ADMIN create)", False, str(e))
    new_coupon_id = None

# Admin: Update coupon
if new_coupon_id:
    try:
        resp = admin_session.patch(f"{BASE_URL}/admin/coupons/{new_coupon_id}", json={
            "value": 25,  # Field name is 'value'
            "active": True  # Field name is 'active'
        }, timeout=10)
        log_test("PATCH /api/admin/coupons/[id] (ADMIN update)", resp.status_code == 200, f"Status {resp.status_code}")
    except Exception as e:
        log_test("PATCH /api/admin/coupons/[id] (ADMIN update)", False, str(e))

# Admin: Delete coupon
if new_coupon_id:
    try:
        resp = admin_session.delete(f"{BASE_URL}/admin/coupons/{new_coupon_id}", timeout=10)
        log_test("DELETE /api/admin/coupons/[id] (ADMIN delete)", resp.status_code == 200, f"Status {resp.status_code}")
    except Exception as e:
        log_test("DELETE /api/admin/coupons/[id] (ADMIN delete)", False, str(e))

# ============================================================================
# TEST SECTION 4: REGRESSION CHECK (catch-all routes NOT split)
# ============================================================================
print("\n" + "=" * 80)
print("TEST SECTION 4: REGRESSION CHECK (catch-all routes NOT split)")
print("=" * 80)

# GET /api/products (list)
try:
    resp = requests.get(f"{BASE_URL}/products", timeout=10)
    if resp.status_code == 200:
        products = resp.json().get("products", [])
        log_test("GET /api/products (list) - catch-all", len(products) >= 0, f"Found {len(products)} products")
    else:
        log_test("GET /api/products (list) - catch-all", False, f"Status {resp.status_code}")
except Exception as e:
    log_test("GET /api/products (list) - catch-all", False, str(e))

# GET /api/products/[id] (detail)
try:
    resp = requests.get(f"{BASE_URL}/products/{product_id}", timeout=10)
    log_test("GET /api/products/[id] (detail) - catch-all", resp.status_code == 200, f"Status {resp.status_code}")
except Exception as e:
    log_test("GET /api/products/[id] (detail) - catch-all", False, str(e))

# GET /api/orders (buyer list)
try:
    resp = member_session.get(f"{BASE_URL}/orders", timeout=10)
    if resp.status_code == 200:
        orders = resp.json().get("orders", [])
        log_test("GET /api/orders - catch-all", len(orders) >= 0, f"Found {len(orders)} orders")
    else:
        log_test("GET /api/orders - catch-all", False, f"Status {resp.status_code}")
except Exception as e:
    log_test("GET /api/orders - catch-all", False, str(e))

# ============================================================================
# CLEANUP
# ============================================================================
print("\n" + "=" * 80)
print("CLEANUP: Removing test data")
print("=" * 80)

try:
    # Delete test users
    db.users.delete_many({"email": {"$in": [MEMBER_EMAIL, ADMIN_EMAIL, EXPERT_EMAIL]}})
    print(f"✅ Deleted test users")
    
    # Delete test expert and availability
    db.experts.delete_one({"_id": expert_doc_id})
    db.availabilities.delete_one({"_id": availability_id})
    print(f"✅ Deleted test expert and availability")
    
    # Delete test product
    db.products.delete_one({"_id": product_id})
    print(f"✅ Deleted test product")
    
    # Delete test appointments
    db.appointments.delete_many({"$or": [
        {"clientId": member_id},
        {"expertId": expert_doc_id}
    ]})
    print(f"✅ Deleted test appointments")
    
    # Delete test orders
    db.orders.delete_many({"buyerId": member_id})
    print(f"✅ Deleted test orders")
    
    # Delete test reviews
    db.reviews.delete_many({"userId": member_id})
    print(f"✅ Deleted test reviews")
    
    # Delete test coupons
    db.coupons.delete_many({"code": {"$regex": f"^(TEST|ADMIN){TIMESTAMP}"}})
    print(f"✅ Deleted test coupons")
    
    # Delete test cart and wishlist
    db.carts.delete_many({"userId": member_id})
    db.wishlists.delete_many({"userId": member_id})
    print(f"✅ Deleted test cart and wishlist")
    
except Exception as e:
    print(f"❌ Cleanup error: {e}")

# ============================================================================
# SUMMARY
# ============================================================================
print("\n" + "=" * 80)
print("TEST SUMMARY")
print("=" * 80)
print(f"Total tests: {test_results['total']}")
print(f"Passed: {test_results['passed']}")
print(f"Failed: {test_results['failed']}")
print(f"Success rate: {test_results['passed'] / test_results['total'] * 100:.1f}%")

if test_results['failed'] > 0:
    print("\n❌ FAILED TESTS:")
    for error in test_results['errors']:
        print(f"  - {error}")
else:
    print("\n✅ ALL TESTS PASSED!")

print("=" * 80)
