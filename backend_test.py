#!/usr/bin/env python3
"""
Backend Testing for Phase 5 Shopify-like Features: Wishlist and Discount Coupons
Omani Entrepreneur Majles (مجلس رواد الأعمال العماني)

This script tests the new Phase 5 features:
1. Wishlist (Favorites) - GET/POST/DELETE /api/wishlist endpoints
2. Discount Coupons - POST /api/coupons/validate, POST /api/orders with couponCode, Admin CRUD

Base URL: Read from /app/.env NEXT_PUBLIC_BASE_URL + '/api'
Database: MongoDB via MONGO_URL from /app/.env
"""

import os
import sys
import json
import requests
import pymongo
import bcrypt
import uuid
from datetime import datetime, timedelta
from urllib.parse import quote

# Read environment variables
def load_env():
    env_vars = {}
    try:
        with open('/app/.env', 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key] = value
    except FileNotFoundError:
        print("❌ /app/.env file not found")
        sys.exit(1)
    return env_vars

ENV = load_env()
BASE_URL = ENV.get('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000') + '/api'
MONGO_URL = ENV.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = ENV.get('DB_NAME', 'majles')

print(f"🌐 Base URL: {BASE_URL}")
print(f"🗄️ MongoDB: {MONGO_URL}/{DB_NAME}")

# MongoDB connection
try:
    mongo_client = pymongo.MongoClient(MONGO_URL)
    db = mongo_client[DB_NAME]
    print("✅ MongoDB connection established")
except Exception as e:
    print(f"❌ MongoDB connection failed: {e}")
    sys.exit(1)

# Test counters
tests_passed = 0
tests_failed = 0

def test_result(name, success, details=""):
    global tests_passed, tests_failed
    if success:
        tests_passed += 1
        print(f"✅ {name}")
        if details:
            print(f"   {details}")
    else:
        tests_failed += 1
        print(f"❌ {name}")
        if details:
            print(f"   {details}")

def make_request(method, endpoint, data=None, headers=None, cookies=None):
    """Make HTTP request with error handling"""
    url = f"{BASE_URL}{endpoint}"
    try:
        if method == 'GET':
            response = requests.get(url, headers=headers, cookies=cookies, timeout=30)
        elif method == 'POST':
            response = requests.post(url, json=data, headers=headers, cookies=cookies, timeout=30)
        elif method == 'PUT':
            response = requests.put(url, json=data, headers=headers, cookies=cookies, timeout=30)
        elif method == 'PATCH':
            response = requests.patch(url, json=data, headers=headers, cookies=cookies, timeout=30)
        elif method == 'DELETE':
            response = requests.delete(url, headers=headers, cookies=cookies, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return response
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return None

def create_test_user(email_suffix, role='MEMBER', tier='FREE'):
    """Create a test user directly in MongoDB with bcrypt password"""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    email = f"test_{email_suffix}_{timestamp}@test.com"
    password = "testpass123"
    
    # Hash password with bcrypt
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    user_doc = {
        '_id': str(uuid.uuid4()),
        'name': f'Test User {email_suffix.title()}',
        'email': email,
        'password': hashed_password,
        'role': role,
        'membershipTier': tier,
        'phone': '',
        'photo': '',
        'wishlist': [],
        'vendorProfile': {
            'slug': '',
            'businessName': '',
            'tagline': '',
            'bio': '',
            'banner': '',
            'logo': '',
            'phone': '',
            'whatsapp': '',
            'instagram': '',
            'website': '',
            'governorate': '',
            'city': '',
            'address': ''
        },
        'createdAt': datetime.utcnow()
    }
    
    try:
        db.users.insert_one(user_doc)
        return {
            'id': user_doc['_id'],
            'email': email,
            'password': password,
            'name': user_doc['name'],
            'role': role,
            'tier': tier
        }
    except Exception as e:
        print(f"❌ Failed to create user: {e}")
        return None

def login_user(email, password):
    """Login user via NextAuth and get session cookie"""
    # First get CSRF token
    csrf_response = make_request('GET', '/auth/csrf')
    if not csrf_response or csrf_response.status_code != 200:
        print(f"❌ Failed to get CSRF token: {csrf_response.status_code if csrf_response else 'No response'}")
        return None
    
    csrf_token = csrf_response.json().get('csrfToken')
    if not csrf_token:
        print("❌ No CSRF token in response")
        return None
    
    # Login with credentials
    login_data = {
        'email': email,
        'password': password,
        'csrfToken': csrf_token,
        'callbackUrl': f"{BASE_URL.replace('/api', '')}/dashboard",
        'json': 'true'
    }
    
    login_response = make_request('POST', '/auth/callback/credentials', data=login_data)
    if not login_response or login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.status_code if login_response else 'No response'}")
        if login_response:
            print(f"   Response: {login_response.text}")
        return None
    
    # Extract session cookie
    cookies = {}
    for cookie in login_response.cookies:
        if 'session-token' in cookie.name or 'next-auth' in cookie.name:
            cookies[cookie.name] = cookie.value
    
    if not cookies:
        print("❌ No session cookies found in login response")
        print(f"   Available cookies: {[cookie.name for cookie in login_response.cookies]}")
        return None
    
    print(f"✅ Login successful, cookies: {list(cookies.keys())}")
    return cookies

def create_test_product(vendor_id, name_suffix="Product", price=10.0, stock=5, is_active=True):
    """Create a test product directly in MongoDB"""
    product_doc = {
        '_id': str(uuid.uuid4()),
        'vendorId': vendor_id,
        'nameAr': f'منتج تجريبي {name_suffix}',
        'nameEn': f'Test {name_suffix}',
        'price': price,
        'description': f'وصف المنتج التجريبي {name_suffix}',
        'images': ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='],
        'category': 'OTHER',
        'stock': stock,
        'isActive': is_active,
        'salesCount': 0,
        'rating': 0,
        'reviewCount': 0,
        'createdAt': datetime.utcnow(),
        'updatedAt': datetime.utcnow()
    }
    
    try:
        db.products.insert_one(product_doc)
        return product_doc
    except Exception as e:
        print(f"❌ Failed to create product: {e}")
        return None

def create_test_order(buyer_id, product_id, vendor_id, status='PAID'):
    """Create a test order directly in MongoDB"""
    order_doc = {
        '_id': str(uuid.uuid4()),
        'buyerId': buyer_id,
        'items': [{
            'productId': product_id,
            'vendorId': vendor_id,
            'nameAr': 'منتج تجريبي',
            'image': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
            'unitPrice': 10.0,
            'quantity': 1,
            'lineSubtotal': 10.0
        }],
        'subtotal': 10.0,
        'discountPercent': 0,
        'discountAmount': 0,
        'tierAtPurchase': 'FREE',
        'couponCode': '',
        'couponDiscount': 0,
        'commissionPercent': 5,
        'commissionAmount': 0.5,
        'totalPaid': 10.0,
        'shippingAddress': {
            'name': 'Test Buyer',
            'phone': '+968 9123 4567',
            'governorate': 'MUSCAT',
            'city': 'مسقط',
            'addressLine': 'شارع التجارة',
            'notes': ''
        },
        'status': status,
        'paymentProvider': 'MOCK',
        'paymentStatus': 'PAID',
        'paymentId': 'mock_payment_123',
        'createdAt': datetime.utcnow(),
        'updatedAt': datetime.utcnow()
    }
    
    try:
        db.orders.insert_one(order_doc)
        return order_doc
    except Exception as e:
        print(f"❌ Failed to create order: {e}")
        return None

def create_test_coupon(code, type_='PERCENT', value=10, active=True, expires_at=None, starts_at=None, 
                      min_subtotal=0, max_discount=0, usage_limit=0, per_user_limit=1):
    """Create a test coupon directly in MongoDB"""
    coupon_doc = {
        '_id': str(uuid.uuid4()),
        'code': code.upper(),
        'description': f'Test coupon {code}',
        'type': type_,
        'value': value,
        'minSubtotal': min_subtotal,
        'maxDiscount': max_discount,
        'startsAt': starts_at or datetime.utcnow(),
        'expiresAt': expires_at,
        'usageLimit': usage_limit,
        'usedCount': 0,
        'perUserLimit': per_user_limit,
        'active': active,
        'createdBy': None,
        'createdAt': datetime.utcnow(),
        'updatedAt': datetime.utcnow()
    }
    
    try:
        db.coupons.insert_one(coupon_doc)
        return coupon_doc
    except Exception as e:
        print(f"❌ Failed to create coupon: {e}")
        return None

def test_regression_endpoints():
    """Test basic regression endpoints to ensure system is working"""
    print("\n🔄 REGRESSION TESTS")
    
    # Test health endpoint
    response = make_request('GET', '/')
    test_result(
        "GET /api/ → 200",
        response and response.status_code == 200 and 'Majles API is running' in response.text,
        f"Status: {response.status_code if response else 'No response'}"
    )
    
    # Test products endpoint (public)
    response = make_request('GET', '/products')
    test_result(
        "GET /api/products → 200",
        response and response.status_code == 200,
        f"Status: {response.status_code if response else 'No response'}"
    )
    
    # Test vendors endpoint (public)
    response = make_request('GET', '/vendors')
    test_result(
        "GET /api/vendors → 200",
        response and response.status_code == 200,
        f"Status: {response.status_code if response else 'No response'}"
    )

def test_wishlist_endpoints():
    """Test Wishlist (Favorites) endpoints"""
    print("\n❤️ WISHLIST ENDPOINTS TESTING")
    
    # Create test data
    print("📋 Setting up test data...")
    buyer = create_test_user('buyer', 'MEMBER', 'FREE')
    vendor = create_test_user('vendor', 'VENDOR', 'BASIC')
    
    if not buyer or not vendor:
        test_result("Wishlist test setup", False, "Failed to create test users")
        return
    
    # Create test products
    product1 = create_test_product(vendor['id'], 'Honey', 15.0, 10, True)
    product2 = create_test_product(vendor['id'], 'Dates', 25.0, 5, True)
    inactive_product = create_test_product(vendor['id'], 'Inactive', 30.0, 0, False)
    
    if not product1 or not product2 or not inactive_product:
        test_result("Wishlist test setup", False, "Failed to create test products")
        return
    
    # Login buyer
    buyer_cookies = login_user(buyer['email'], buyer['password'])
    if not buyer_cookies:
        test_result("Buyer login for wishlist tests", False, "Failed to login buyer")
        return
    
    print("✅ Test data setup complete")
    
    # Test 1: GET /api/wishlist (no session) → 401
    response = make_request('GET', '/wishlist')
    test_result(
        "GET /api/wishlist (no auth) → 401",
        response and response.status_code == 401 and 'غير مصرح' in response.text,
        f"Status: {response.status_code if response else 'No response'}"
    )
    
    # Test 2: GET /api/wishlist (empty wishlist) → 200 with empty items
    response = make_request('GET', '/wishlist', cookies=buyer_cookies)
    test_result(
        "GET /api/wishlist (empty) → 200",
        response and response.status_code == 200,
        f"Status: {response.status_code if response else 'No response'}"
    )
    
    if response and response.status_code == 200:
        data = response.json()
        test_result(
            "Empty wishlist structure",
            'items' in data and 'count' in data and data['count'] == 0 and len(data['items']) == 0,
            f"Response: {data}"
        )
    
    # Test 3: POST /api/wishlist/:productId (no auth) → 401
    response = make_request('POST', f"/wishlist/{product1['_id']}")
    test_result(
        "POST /api/wishlist/:productId (no auth) → 401",
        response and response.status_code == 401,
        f"Status: {response.status_code if response else 'No response'}"
    )
    
    # Test 4: POST /api/wishlist/:productId (invalid product) → 404
    fake_product_id = str(uuid.uuid4())
    response = make_request('POST', f"/wishlist/{fake_product_id}", cookies=buyer_cookies)
    test_result(
        "POST /api/wishlist/:productId (invalid product) → 404",
        response and response.status_code == 404 and 'المنتج غير موجود' in response.text,
        f"Status: {response.status_code if response else 'No response'}"
    )
    
    # Test 5: POST /api/wishlist/:productId (first time) → 200
    response = make_request('POST', f"/wishlist/{product1['_id']}", cookies=buyer_cookies)
    test_result(
        "POST /api/wishlist/:productId (first time) → 200",
        response and response.status_code == 200,
        f"Status: {response.status_code if response else 'No response'}"
    )
    
    if response and response.status_code == 200:
        data = response.json()
        test_result(
            "First wishlist add response",
            data.get('success') is True and data.get('count') == 1,
            f"Response: {data}"
        )
    
    # Test 6: POST /api/wishlist/:productId (second time, idempotent) → 200
    response = make_request('POST', f"/wishlist/{product1['_id']}", cookies=buyer_cookies)
    test_result(
        "POST /api/wishlist/:productId (duplicate) → 200",
        response and response.status_code == 200,
        f"Status: {response.status_code if response else 'No response'}"
    )
    
    if response and response.status_code == 200:
        data = response.json()
        test_result(
            "Duplicate wishlist add response",
            data.get('success') is True and data.get('alreadyInWishlist') is True,
            f"Response: {data}"
        )
    
    # Test 7: Add second product to wishlist
    response = make_request('POST', f"/wishlist/{product2['_id']}", cookies=buyer_cookies)
    test_result(
        "POST /api/wishlist/:productId (second product) → 200",
        response and response.status_code == 200,
        f"Status: {response.status_code if response else 'No response'}"
    )
    
    # Test 8: GET /api/wishlist (with items) → 200
    response = make_request('GET', '/wishlist', cookies=buyer_cookies)
    test_result(
        "GET /api/wishlist (with items) → 200",
        response and response.status_code == 200,
        f"Status: {response.status_code if response else 'No response'}"
    )
    
    if response and response.status_code == 200:
        data = response.json()
        test_result(
            "Wishlist with items structure",
            'items' in data and 'count' in data and data['count'] == 2 and len(data['items']) == 2,
            f"Count: {data.get('count')}, Items: {len(data.get('items', []))}"
        )
        
        # Check that items are ordered newest first (product2 should be first)
        if len(data.get('items', [])) >= 2:
            first_item = data['items'][0]
            test_result(
                "Wishlist order (newest first)",
                first_item.get('id') == product2['_id'],
                f"First item ID: {first_item.get('id')}, Expected: {product2['_id']}"
            )
            
            # Check item structure
            required_fields = ['id', 'nameAr', 'price', 'images', 'stock', 'vendorName', 'vendorSlug']
            has_all_fields = all(field in first_item for field in required_fields)
            test_result(
                "Wishlist item structure",
                has_all_fields,
                f"Item fields: {list(first_item.keys())}"
            )
    
    # Test 9: Add inactive product (should work but not appear in GET)
    response = make_request('POST', f"/wishlist/{inactive_product['_id']}", cookies=buyer_cookies)
    test_result(
        "POST /api/wishlist/:productId (inactive product) → 200",
        response and response.status_code == 200,
        f"Status: {response.status_code if response else 'No response'}"
    )
    
    # Test 10: GET /api/wishlist (inactive products should not appear)
    response = make_request('GET', '/wishlist', cookies=buyer_cookies)
    if response and response.status_code == 200:
        data = response.json()
        # Should still show count=2 (only active products)
        test_result(
            "Inactive products filtered from wishlist",
            data.get('count') == 2 and len(data.get('items', [])) == 2,
            f"Count: {data.get('count')}, Items: {len(data.get('items', []))}"
        )
    
    # Test 11: DELETE /api/wishlist/:productId (no auth) → 401
    response = make_request('DELETE', f"/wishlist/{product1['_id']}")
    test_result(
        "DELETE /api/wishlist/:productId (no auth) → 401",
        response and response.status_code == 401,
        f"Status: {response.status_code if response else 'No response'}"
    )
    
    # Test 12: DELETE /api/wishlist/:productId (not in wishlist) → 200
    non_wishlist_product = create_test_product(vendor['id'], 'NotInWishlist', 5.0, 3, True)
    if non_wishlist_product:
        response = make_request('DELETE', f"/wishlist/{non_wishlist_product['_id']}", cookies=buyer_cookies)
        test_result(
            "DELETE /api/wishlist/:productId (not in wishlist) → 200",
            response and response.status_code == 200,
            f"Status: {response.status_code if response else 'No response'}"
        )
        
        if response and response.status_code == 200:
            data = response.json()
            test_result(
                "Delete non-wishlist item response",
                data.get('success') is True and data.get('notFound') is True,
                f"Response: {data}"
            )
    
    # Test 13: DELETE /api/wishlist/:productId (existing item) → 200
    response = make_request('DELETE', f"/wishlist/{product1['_id']}", cookies=buyer_cookies)
    test_result(
        "DELETE /api/wishlist/:productId (existing) → 200",
        response and response.status_code == 200,
        f"Status: {response.status_code if response else 'No response'}"
    )
    
    if response and response.status_code == 200:
        data = response.json()
        test_result(
            "Delete existing item response",
            data.get('success') is True and data.get('count') == 1,
            f"Response: {data}"
        )
    
    # Test 14: Verify wishlist count after deletion
    response = make_request('GET', '/wishlist', cookies=buyer_cookies)
    if response and response.status_code == 200:
        data = response.json()
        test_result(
            "Wishlist count after deletion",
            data.get('count') == 1 and len(data.get('items', [])) == 1,
            f"Count: {data.get('count')}, Items: {len(data.get('items', []))}"
        )

def test_coupon_validation_endpoint():
    """Test POST /api/coupons/validate endpoint"""
    print("\n🎫 COUPON VALIDATION ENDPOINT TESTING")
    
    # Create test data
    print("📋 Setting up test data...")
    buyer = create_test_user('coupon_buyer', 'MEMBER', 'FREE')
    
    if not buyer:
        test_result("Coupon test setup", False, "Failed to create test user")
        return
    
    # Create test coupons
    valid_coupon = create_test_coupon('WELCOME10', 'PERCENT', 10, True)
    expired_coupon = create_test_coupon('EXPIRED20', 'PERCENT', 20, True, 
                                       expires_at=datetime.utcnow() - timedelta(days=1))
    future_coupon = create_test_coupon('FUTURE15', 'PERCENT', 15, True,
                                      starts_at=datetime.utcnow() + timedelta(days=1))
    inactive_coupon = create_test_coupon('INACTIVE25', 'PERCENT', 25, False)
    min_subtotal_coupon = create_test_coupon('MIN50', 'PERCENT', 10, True, min_subtotal=50)
    fixed_coupon = create_test_coupon('FIXED5', 'FIXED', 5, True)
    max_discount_coupon = create_test_coupon('MAXCAP', 'PERCENT', 50, True, max_discount=3)
    
    if not all([valid_coupon, expired_coupon, future_coupon, inactive_coupon, 
               min_subtotal_coupon, fixed_coupon, max_discount_coupon]):
        test_result("Coupon creation", False, "Failed to create test coupons")
        return
    
    # Login buyer
    buyer_cookies = login_user(buyer['email'], buyer['password'])
    if not buyer_cookies:
        test_result("Buyer login for coupon tests", False, "Failed to login buyer")
        return
    
    print("✅ Test data setup complete")
    
    # Test 1: POST /api/coupons/validate (no auth) → 401
    response = make_request('POST', '/coupons/validate', data={'code': 'WELCOME10', 'subtotal': 100})
    test_result(
        "POST /api/coupons/validate (no auth) → 401",
        response and response.status_code == 401 and 'يجب تسجيل الدخول' in response.text,
        f"Status: {response.status_code if response else 'No response'}"
    )
    
    # Test 2: Empty cart → 400
    response = make_request('POST', '/coupons/validate', 
                          data={'code': 'WELCOME10', 'subtotal': 0}, cookies=buyer_cookies)
    test_result(
        "POST /api/coupons/validate (empty cart) → 400",
        response and response.status_code == 400 and 'السلة فارغة' in response.text,
        f"Status: {response.status_code if response else 'No response'}"
    )
    
    # Test 3: Invalid/unknown code → 200 with valid: false
    response = make_request('POST', '/coupons/validate', 
                          data={'code': 'INVALID123', 'subtotal': 100}, cookies=buyer_cookies)
    test_result(
        "POST /api/coupons/validate (invalid code) → 200",
        response and response.status_code == 200,
        f"Status: {response.status_code if response else 'No response'}"
    )
    
    if response and response.status_code == 200:
        data = response.json()
        test_result(
            "Invalid code response",
            data.get('valid') is False and 'رمز الكوبون غير صحيح' in data.get('error', ''),
            f"Response: {data}"
        )
    
    # Test 4: Inactive coupon → valid: false
    response = make_request('POST', '/coupons/validate', 
                          data={'code': 'INACTIVE25', 'subtotal': 100}, cookies=buyer_cookies)
    if response and response.status_code == 200:
        data = response.json()
        test_result(
            "Inactive coupon response",
            data.get('valid') is False and 'الكوبون غير فعّال' in data.get('error', ''),
            f"Response: {data}"
        )
    
    # Test 5: Expired coupon → valid: false
    response = make_request('POST', '/coupons/validate', 
                          data={'code': 'EXPIRED20', 'subtotal': 100}, cookies=buyer_cookies)
    if response and response.status_code == 200:
        data = response.json()
        test_result(
            "Expired coupon response",
            data.get('valid') is False and 'انتهت صلاحية الكوبون' in data.get('error', ''),
            f"Response: {data}"
        )
    
    # Test 6: Future coupon → valid: false
    response = make_request('POST', '/coupons/validate', 
                          data={'code': 'FUTURE15', 'subtotal': 100}, cookies=buyer_cookies)
    if response and response.status_code == 200:
        data = response.json()
        test_result(
            "Future coupon response",
            data.get('valid') is False and 'الكوبون غير فعّال بعد' in data.get('error', ''),
            f"Response: {data}"
        )
    
    # Test 7: Below minimum subtotal → valid: false
    response = make_request('POST', '/coupons/validate', 
                          data={'code': 'MIN50', 'subtotal': 30}, cookies=buyer_cookies)
    if response and response.status_code == 200:
        data = response.json()
        test_result(
            "Below minimum subtotal response",
            data.get('valid') is False and 'الحد الأدنى لاستخدام الكوبون: 50 ر.ع' in data.get('error', ''),
            f"Response: {data}"
        )
    
    # Test 8: Valid PERCENT coupon → valid: true with correct calculation
    response = make_request('POST', '/coupons/validate', 
                          data={'code': 'WELCOME10', 'subtotal': 100}, cookies=buyer_cookies)
    test_result(
        "Valid PERCENT coupon → 200",
        response and response.status_code == 200,
        f"Status: {response.status_code if response else 'No response'}"
    )
    
    if response and response.status_code == 200:
        data = response.json()
        expected_fields = ['valid', 'tierDiscountAmount', 'baseAmount', 'couponDiscountAmount', 'finalTotal']
        has_fields = all(field in data for field in expected_fields)
        
        # For FREE tier user: tierDiscountAmount=0, baseAmount=100, couponDiscountAmount=10, finalTotal=90
        test_result(
            "Valid PERCENT coupon calculation",
            (data.get('valid') is True and 
             data.get('tierDiscountAmount') == 0 and 
             data.get('baseAmount') == 100 and 
             data.get('couponDiscountAmount') == 10 and 
             data.get('finalTotal') == 90 and
             has_fields),
            f"Response: {data}"
        )
    
    # Test 9: Valid FIXED coupon → valid: true with correct calculation
    response = make_request('POST', '/coupons/validate', 
                          data={'code': 'FIXED5', 'subtotal': 100}, cookies=buyer_cookies)
    if response and response.status_code == 200:
        data = response.json()
        test_result(
            "Valid FIXED coupon calculation",
            (data.get('valid') is True and 
             data.get('couponDiscountAmount') == 5 and 
             data.get('finalTotal') == 95),
            f"Response: {data}"
        )
    
    # Test 10: PERCENT with maxDiscount cap
    response = make_request('POST', '/coupons/validate', 
                          data={'code': 'MAXCAP', 'subtotal': 100}, cookies=buyer_cookies)
    if response and response.status_code == 200:
        data = response.json()
        # 50% of 100 = 50, but capped at 3
        test_result(
            "PERCENT coupon with maxDiscount cap",
            (data.get('valid') is True and 
             data.get('couponDiscountAmount') == 3 and 
             data.get('finalTotal') == 97),
            f"Response: {data}"
        )
    
    # Test 11: FIXED value > baseAmount (should be capped)
    large_fixed_coupon = create_test_coupon('LARGE50', 'FIXED', 50, True)
    if large_fixed_coupon:
        response = make_request('POST', '/coupons/validate', 
                              data={'code': 'LARGE50', 'subtotal': 10}, cookies=buyer_cookies)
        if response and response.status_code == 200:
            data = response.json()
            test_result(
                "FIXED coupon > subtotal (capped)",
                (data.get('valid') is True and 
                 data.get('couponDiscountAmount') == 10 and 
                 data.get('finalTotal') == 0),
                f"Response: {data}"
            )

def test_coupon_order_integration():
    """Test POST /api/orders with couponCode"""
    print("\n🛒 COUPON ORDER INTEGRATION TESTING")
    
    # Create test data
    print("📋 Setting up test data...")
    buyer = create_test_user('order_buyer', 'MEMBER', 'FREE')
    vendor = create_test_user('order_vendor', 'VENDOR', 'BASIC')
    
    if not buyer or not vendor:
        test_result("Order coupon test setup", False, "Failed to create test users")
        return
    
    # Create test product
    product = create_test_product(vendor['id'], 'OrderProduct', 20.0, 10, True)
    if not product:
        test_result("Order coupon test setup", False, "Failed to create test product")
        return
    
    # Create test coupons
    valid_coupon = create_test_coupon('ORDER10', 'PERCENT', 10, True)
    invalid_coupon_code = 'NONEXISTENT'
    per_user_limit_coupon = create_test_coupon('ONCE', 'PERCENT', 15, True, per_user_limit=1)
    
    if not all([valid_coupon, per_user_limit_coupon]):
        test_result("Order coupon creation", False, "Failed to create test coupons")
        return
    
    # Login buyer
    buyer_cookies = login_user(buyer['email'], buyer['password'])
    if not buyer_cookies:
        test_result("Buyer login for order coupon tests", False, "Failed to login buyer")
        return
    
    print("✅ Test data setup complete")
    
    # Test 1: Valid cart + invalid coupon code → 400
    order_data = {
        'items': [{
            'productId': product['_id'],
            'quantity': 2
        }],
        'shippingAddress': {
            'name': 'Test Buyer',
            'phone': '+968 9123 4567',
            'governorate': 'MUSCAT',
            'city': 'مسقط',
            'addressLine': 'شارع التجارة',
            'notes': ''
        },
        'couponCode': invalid_coupon_code
    }
    
    response = make_request('POST', '/orders', data=order_data, cookies=buyer_cookies)
    test_result(
        "POST /api/orders (invalid coupon) → 400",
        response and response.status_code == 400,
        f"Status: {response.status_code if response else 'No response'}"
    )
    
    # Test 2: Valid cart + valid coupon → 200
    order_data['couponCode'] = 'ORDER10'
    response = make_request('POST', '/orders', data=order_data, cookies=buyer_cookies)
    test_result(
        "POST /api/orders (valid coupon) → 200",
        response and response.status_code == 200,
        f"Status: {response.status_code if response else 'No response'}"
    )
    
    order_id = None
    if response and response.status_code == 200:
        data = response.json()
        order_id = data.get('order', {}).get('id')
        
        # Check order structure
        order = data.get('order', {})
        test_result(
            "Order with coupon structure",
            (order.get('couponCode') == 'ORDER10' and 
             order.get('couponDiscount') > 0 and
             order.get('totalPaid') < order.get('subtotal', 0)),
            f"Order: couponCode={order.get('couponCode')}, couponDiscount={order.get('couponDiscount')}, totalPaid={order.get('totalPaid')}"
        )
    
    # Test 3: Verify database updates after successful order
    if order_id:
        # Check Coupon.usedCount incremented
        coupon_doc = db.coupons.find_one({'code': 'ORDER10'})
        test_result(
            "Coupon usedCount incremented",
            coupon_doc and coupon_doc.get('usedCount') == 1,
            f"usedCount: {coupon_doc.get('usedCount') if coupon_doc else 'Not found'}"
        )
        
        # Check CouponRedemption document created
        redemption_doc = db.couponredemptions.find_one({'orderId': order_id})
        test_result(
            "CouponRedemption document created",
            redemption_doc is not None,
            f"Redemption found: {redemption_doc is not None}"
        )
        
        if redemption_doc:
            test_result(
                "CouponRedemption structure",
                (redemption_doc.get('couponId') == valid_coupon['_id'] and
                 redemption_doc.get('code') == 'ORDER10' and
                 redemption_doc.get('userId') == buyer['id'] and
                 redemption_doc.get('amountSaved') > 0),
                f"Redemption: {redemption_doc}"
            )
        
        # Check Order document has couponCode and couponDiscount
        order_doc = db.orders.find_one({'_id': order_id})
        test_result(
            "Order document coupon fields",
            (order_doc and 
             order_doc.get('couponCode') == 'ORDER10' and
             order_doc.get('couponDiscount') > 0),
            f"Order couponCode: {order_doc.get('couponCode') if order_doc else 'Not found'}, couponDiscount: {order_doc.get('couponDiscount') if order_doc else 'Not found'}"
        )
    
    # Test 4: Try using per-user limit coupon again → 400
    order_data_2 = {
        'items': [{
            'productId': product['_id'],
            'quantity': 1
        }],
        'shippingAddress': {
            'name': 'Test Buyer',
            'phone': '+968 9123 4567',
            'governorate': 'MUSCAT',
            'city': 'مسقط',
            'addressLine': 'شارع التجارة',
            'notes': ''
        },
        'couponCode': 'ONCE'
    }
    
    # First use should work
    response = make_request('POST', '/orders', data=order_data_2, cookies=buyer_cookies)
    test_result(
        "POST /api/orders (per-user limit coupon first use) → 200",
        response and response.status_code == 200,
        f"Status: {response.status_code if response else 'No response'}"
    )
    
    # Second use should fail
    response = make_request('POST', '/orders', data=order_data_2, cookies=buyer_cookies)
    test_result(
        "POST /api/orders (per-user limit exceeded) → 400",
        response and response.status_code == 400 and 'لقد استخدمت هذا الكوبون' in response.text,
        f"Status: {response.status_code if response else 'No response'}"
    )
    
    # Test 5: Order without couponCode should still work (regression)
    order_data_no_coupon = {
        'items': [{
            'productId': product['_id'],
            'quantity': 1
        }],
        'shippingAddress': {
            'name': 'Test Buyer',
            'phone': '+968 9123 4567',
            'governorate': 'MUSCAT',
            'city': 'مسقط',
            'addressLine': 'شارع التجارة',
            'notes': ''
        }
    }
    
    response = make_request('POST', '/orders', data=order_data_no_coupon, cookies=buyer_cookies)
    test_result(
        "POST /api/orders (no coupon) → 200",
        response and response.status_code == 200,
        f"Status: {response.status_code if response else 'No response'}"
    )
    
    if response and response.status_code == 200:
        data = response.json()
        order = data.get('order', {})
        test_result(
            "Order without coupon structure",
            (order.get('couponCode') == '' and 
             order.get('couponDiscount') == 0),
            f"Order: couponCode='{order.get('couponCode')}', couponDiscount={order.get('couponDiscount')}"
        )

def test_admin_coupon_crud():
    """Test Admin Coupon CRUD endpoints"""
    print("\n👑 ADMIN COUPON CRUD TESTING")
    
    # Create test data
    print("📋 Setting up test data...")
    admin = create_test_user('admin', 'ADMIN', 'PLATINUM')
    member = create_test_user('member', 'MEMBER', 'FREE')
    
    if not admin or not member:
        test_result("Admin coupon test setup", False, "Failed to create test users")
        return
    
    # Login users
    admin_cookies = login_user(admin['email'], admin['password'])
    member_cookies = login_user(member['email'], member['password'])
    
    if not admin_cookies or not member_cookies:
        test_result("User login for admin coupon tests", False, "Failed to login users")
        return
    
    print("✅ Test data setup complete")
    
    # Test 1: GET /api/admin/coupons (no auth) → 401
    response = make_request('GET', '/admin/coupons')
    test_result(
        "GET /api/admin/coupons (no auth) → 401",
        response and response.status_code == 401,
        f"Status: {response.status_code if response else 'No response'}"
    )
    
    # Test 2: GET /api/admin/coupons (MEMBER) → 403
    response = make_request('GET', '/admin/coupons', cookies=member_cookies)
    test_result(
        "GET /api/admin/coupons (MEMBER) → 403",
        response and response.status_code == 403 and 'صلاحيات مسؤول مطلوبة' in response.text,
        f"Status: {response.status_code if response else 'No response'}"
    )
    
    # Test 3: GET /api/admin/coupons (ADMIN) → 200
    response = make_request('GET', '/admin/coupons', cookies=admin_cookies)
    test_result(
        "GET /api/admin/coupons (ADMIN) → 200",
        response and response.status_code == 200,
        f"Status: {response.status_code if response else 'No response'}"
    )
    
    if response and response.status_code == 200:
        data = response.json()
        test_result(
            "Admin coupons list structure",
            'coupons' in data and isinstance(data['coupons'], list),
            f"Response keys: {list(data.keys())}"
        )
    
    # Test 4: POST /api/admin/coupons (invalid code) → 400
    invalid_coupon_data = {
        'code': 'ab',  # too short
        'description': 'Test coupon',
        'type': 'PERCENT',
        'value': 10
    }
    
    response = make_request('POST', '/admin/coupons', data=invalid_coupon_data, cookies=admin_cookies)
    test_result(
        "POST /api/admin/coupons (invalid code) → 400",
        response and response.status_code == 400 and 'الرمز يجب أن يكون بين 3 و 32' in response.text,
        f"Status: {response.status_code if response else 'No response'}"
    )
    
    # Test 5: POST /api/admin/coupons (invalid value) → 400
    invalid_value_data = {
        'code': 'TESTCOUPON',
        'description': 'Test coupon',
        'type': 'PERCENT',
        'value': 0  # invalid
    }
    
    response = make_request('POST', '/admin/coupons', data=invalid_value_data, cookies=admin_cookies)
    test_result(
        "POST /api/admin/coupons (invalid value) → 400",
        response and response.status_code == 400 and 'قيمة الخصم غير صحيحة' in response.text,
        f"Status: {response.status_code if response else 'No response'}"
    )
    
    # Test 6: POST /api/admin/coupons (PERCENT > 100) → 400
    invalid_percent_data = {
        'code': 'TESTCOUPON',
        'description': 'Test coupon',
        'type': 'PERCENT',
        'value': 150  # > 100%
    }
    
    response = make_request('POST', '/admin/coupons', data=invalid_percent_data, cookies=admin_cookies)
    test_result(
        "POST /api/admin/coupons (PERCENT > 100) → 400",
        response and response.status_code == 400 and 'نسبة الخصم يجب ألا تتجاوز 100%' in response.text,
        f"Status: {response.status_code if response else 'No response'}"
    )
    
    # Test 7: POST /api/admin/coupons (valid) → 200
    valid_coupon_data = {
        'code': 'welcome10',  # should be auto-uppercased
        'description': 'Welcome discount',
        'type': 'PERCENT',
        'value': 10,
        'minSubtotal': 50,
        'maxDiscount': 20,
        'usageLimit': 100,
        'perUserLimit': 1
    }
    
    response = make_request('POST', '/admin/coupons', data=valid_coupon_data, cookies=admin_cookies)
    test_result(
        "POST /api/admin/coupons (valid) → 200",
        response and response.status_code == 200,
        f"Status: {response.status_code if response else 'No response'}"
    )
    
    created_coupon_id = None
    if response and response.status_code == 200:
        data = response.json()
        created_coupon_id = data.get('coupon', {}).get('id')
        test_result(
            "Created coupon structure",
            (data.get('success') is True and 
             data.get('coupon', {}).get('code') == 'WELCOME10'),  # auto-uppercased
            f"Response: {data}"
        )
    
    # Test 8: POST /api/admin/coupons (duplicate code) → 409
    response = make_request('POST', '/admin/coupons', data=valid_coupon_data, cookies=admin_cookies)
    test_result(
        "POST /api/admin/coupons (duplicate) → 409",
        response and response.status_code == 409 and 'رمز الكوبون مستخدم مسبقاً' in response.text,
        f"Status: {response.status_code if response else 'No response'}"
    )
    
    # Test 9: PATCH /api/admin/coupons/:id (invalid id) → 404
    fake_coupon_id = str(uuid.uuid4())
    response = make_request('PATCH', f'/admin/coupons/{fake_coupon_id}', 
                          data={'active': False}, cookies=admin_cookies)
    test_result(
        "PATCH /api/admin/coupons/:id (invalid id) → 404",
        response and response.status_code == 404 and 'الكوبون غير موجود' in response.text,
        f"Status: {response.status_code if response else 'No response'}"
    )
    
    # Test 10: PATCH /api/admin/coupons/:id (valid) → 200
    if created_coupon_id:
        response = make_request('PATCH', f'/admin/coupons/{created_coupon_id}', 
                              data={'active': False}, cookies=admin_cookies)
        test_result(
            "PATCH /api/admin/coupons/:id (valid) → 200",
            response and response.status_code == 200,
            f"Status: {response.status_code if response else 'No response'}"
        )
        
        # Test 11: Validate endpoint should now return inactive error
        buyer = create_test_user('validate_buyer', 'MEMBER', 'FREE')
        if buyer:
            buyer_cookies = login_user(buyer['email'], buyer['password'])
            if buyer_cookies:
                response = make_request('POST', '/coupons/validate', 
                                      data={'code': 'WELCOME10', 'subtotal': 100}, 
                                      cookies=buyer_cookies)
                if response and response.status_code == 200:
                    data = response.json()
                    test_result(
                        "Deactivated coupon validation",
                        data.get('valid') is False and 'الكوبون غير فعّال' in data.get('error', ''),
                        f"Response: {data}"
                    )
    
    # Test 12: DELETE /api/admin/coupons/:id (unused coupon) → 200
    unused_coupon = create_test_coupon('UNUSED', 'PERCENT', 5, True)
    if unused_coupon:
        response = make_request('DELETE', f"/admin/coupons/{unused_coupon['_id']}", cookies=admin_cookies)
        test_result(
            "DELETE /api/admin/coupons/:id (unused) → 200",
            response and response.status_code == 200,
            f"Status: {response.status_code if response else 'No response'}"
        )
    
    # Test 13: DELETE /api/admin/coupons/:id (used coupon) → 400
    # First create and use a coupon
    used_coupon = create_test_coupon('USED', 'PERCENT', 5, True)
    if used_coupon:
        # Simulate usage by incrementing usedCount
        db.coupons.update_one({'_id': used_coupon['_id']}, {'$set': {'usedCount': 1}})
        
        response = make_request('DELETE', f"/admin/coupons/{used_coupon['_id']}", cookies=admin_cookies)
        test_result(
            "DELETE /api/admin/coupons/:id (used) → 400",
            response and response.status_code == 400 and 'لا يمكن حذف كوبون تم استخدامه' in response.text,
            f"Status: {response.status_code if response else 'No response'}"
        )

def main():
    """Main test execution"""
    print("🚀 STARTING PHASE 5 SHOPIFY-LIKE FEATURES BACKEND TESTING")
    print("=" * 80)
    
    # Run all test suites
    test_regression_endpoints()
    test_wishlist_endpoints()
    test_coupon_validation_endpoint()
    test_coupon_order_integration()
    test_admin_coupon_crud()
    
    # Final summary
    print("\n" + "=" * 80)
    print("📊 FINAL TEST RESULTS")
    print(f"✅ Tests Passed: {tests_passed}")
    print(f"❌ Tests Failed: {tests_failed}")
    print(f"📈 Success Rate: {(tests_passed / (tests_passed + tests_failed) * 100):.1f}%" if (tests_passed + tests_failed) > 0 else "No tests run")
    
    if tests_failed == 0:
        print("\n🎉 ALL TESTS PASSED! Phase 5 Shopify-like features are working correctly.")
    else:
        print(f"\n⚠️ {tests_failed} test(s) failed. Please review the issues above.")
    
    # Close MongoDB connection
    mongo_client.close()
    
    return tests_failed == 0

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)