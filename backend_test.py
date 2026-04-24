#!/usr/bin/env python3
"""
Product Reviews Backend Testing
Testing the NEW Product Reviews feature (Phase 5 Shopify-like enhancement)
"""

import requests
import json
import time
import uuid
import bcrypt
from pymongo import MongoClient
from datetime import datetime, timedelta
import os

# Configuration
BASE_URL = "https://omani-startup-hub.preview.emergentagent.com/api"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "majles"

def get_db():
    """Get MongoDB database connection"""
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]

def create_test_user(email, password="Password123", name="Test User", role="MEMBER"):
    """Create a test user directly in MongoDB"""
    db = get_db()
    user_id = str(uuid.uuid4())
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    user_doc = {
        "_id": user_id,
        "name": name,
        "email": email.lower(),
        "password": hashed_password,
        "role": role,
        "membershipTier": "FREE",
        "phone": "",
        "photo": "",
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
    
    db.users.insert_one(user_doc)
    return user_id

def create_test_product(vendor_id, name="منتج تجريبي", price=10):
    """Create a test product directly in MongoDB"""
    db = get_db()
    product_id = str(uuid.uuid4())
    
    product_doc = {
        "_id": product_id,
        "vendorId": vendor_id,
        "nameAr": name,
        "nameEn": "",
        "price": price,
        "description": "وصف المنتج التجريبي",
        "images": [],
        "category": "OTHER",
        "stock": 100,
        "isActive": True,
        "salesCount": 0,
        "rating": 0,
        "reviewCount": 0,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    
    db.products.insert_one(product_doc)
    return product_id

def create_test_order(buyer_id, product_id, vendor_id, status="PAID"):
    """Create a test order directly in MongoDB"""
    db = get_db()
    order_id = str(uuid.uuid4())
    
    order_doc = {
        "_id": order_id,
        "buyerId": buyer_id,
        "items": [{
            "productId": product_id,
            "vendorId": vendor_id,
            "nameAr": "منتج تجريبي",
            "image": "",
            "unitPrice": 10,
            "quantity": 1,
            "lineSubtotal": 10
        }],
        "subtotal": 10,
        "discountPercent": 0,
        "discountAmount": 0,
        "tierAtPurchase": "FREE",
        "commissionPercent": 5,
        "commissionAmount": 0.5,
        "totalPaid": 10,
        "shippingAddress": {
            "name": "عميل تجريبي",
            "phone": "+968 9123 4567",
            "governorate": "MUSCAT",
            "city": "مسقط",
            "addressLine": "شارع السلطان قابوس",
            "notes": ""
        },
        "status": status,
        "paymentProvider": "MOCK",
        "paymentStatus": "PAID",
        "paymentId": "",
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    
    db.orders.insert_one(order_doc)
    return order_id

def login_user(email, password="Password123"):
    """Login user via NextAuth and get session cookie"""
    # First get CSRF token
    csrf_response = requests.get(f"{BASE_URL}/auth/csrf")
    if csrf_response.status_code != 200:
        print(f"❌ Failed to get CSRF token: {csrf_response.status_code}")
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
        'callbackUrl': '/',
        'json': 'true'
    }
    
    login_response = requests.post(
        f"{BASE_URL}/auth/callback/credentials",
        data=login_data,
        cookies=csrf_response.cookies,
        allow_redirects=False
    )
    
    if login_response.status_code not in [200, 302]:
        print(f"❌ Login failed: {login_response.status_code}")
        return None
    
    # Extract session cookie
    session_cookies = {}
    for cookie in login_response.cookies:
        if 'session-token' in cookie.name or 'next-auth' in cookie.name:
            session_cookies[cookie.name] = cookie.value
    
    if not session_cookies:
        print("❌ No session cookies found after login")
        return None
    
    return session_cookies

def test_get_product_reviews():
    """Test GET /api/products/:id/reviews (public, no auth)"""
    print("\n🧪 Testing GET /api/products/:id/reviews")
    
    # Create test data
    timestamp = int(time.time())
    vendor_email = f"vendor-{timestamp}@test.com"
    vendor_id = create_test_user(vendor_email, role="VENDOR", name="بائع تجريبي")
    product_id = create_test_product(vendor_id)
    
    try:
        # Test 1: Valid product id → 200 with empty reviews initially
        print("  📋 Test 1: Valid product with no reviews")
        response = requests.get(f"{BASE_URL}/products/{product_id}/reviews")
        
        if response.status_code == 200:
            data = response.json()
            if 'reviews' in data and isinstance(data['reviews'], list):
                print(f"  ✅ Valid product → 200 with reviews array (length: {len(data['reviews'])})")
            else:
                print(f"  ❌ Invalid response structure: {data}")
                return False
        else:
            print(f"  ❌ Expected 200, got {response.status_code}: {response.text}")
            return False
        
        # Test 2: Invalid product id → 404
        print("  📋 Test 2: Invalid product id")
        invalid_id = str(uuid.uuid4())
        response = requests.get(f"{BASE_URL}/products/{invalid_id}/reviews")
        
        if response.status_code == 404:
            data = response.json()
            if data.get('error') == 'المنتج غير موجود':
                print("  ✅ Invalid product id → 404 with Arabic error")
            else:
                print(f"  ❌ Wrong error message: {data}")
                return False
        else:
            print(f"  ❌ Expected 404, got {response.status_code}: {response.text}")
            return False
        
        print("  🎉 GET /api/products/:id/reviews tests passed!")
        return True
        
    except Exception as e:
        print(f"  ❌ Test failed with exception: {e}")
        return False

def test_post_product_reviews():
    """Test POST /api/products/:id/reviews (auth required)"""
    print("\n🧪 Testing POST /api/products/:id/reviews")
    
    # Create test data
    timestamp = int(time.time())
    vendor_email = f"vendor-{timestamp}@test.com"
    buyer_email = f"buyer-{timestamp}@test.com"
    buyer2_email = f"buyer2-{timestamp}@test.com"
    
    vendor_id = create_test_user(vendor_email, role="VENDOR", name="بائع تجريبي")
    buyer_id = create_test_user(buyer_email, name="عميل تجريبي")
    buyer2_id = create_test_user(buyer2_email, name="عميل تجريبي 2")
    
    product_id = create_test_product(vendor_id)
    order_id = create_test_order(buyer_id, product_id, vendor_id, "PAID")
    
    # Login buyer
    buyer_cookies = login_user(buyer_email)
    if not buyer_cookies:
        print("  ❌ Failed to login buyer")
        return False
    
    # Login vendor
    vendor_cookies = login_user(vendor_email)
    if not vendor_cookies:
        print("  ❌ Failed to login vendor")
        return False
    
    try:
        # Test 1: No session → 401
        print("  📋 Test 1: No session")
        response = requests.post(f"{BASE_URL}/products/{product_id}/reviews", 
                               json={"rating": 5, "comment": "ممتاز"})
        
        if response.status_code == 401:
            data = response.json()
            if data.get('error') == 'غير مصرح':
                print("  ✅ No session → 401 with Arabic error")
            else:
                print(f"  ❌ Wrong error message: {data}")
                return False
        else:
            print(f"  ❌ Expected 401, got {response.status_code}: {response.text}")
            return False
        
        # Test 2: Invalid product id → 404
        print("  📋 Test 2: Invalid product id")
        invalid_id = str(uuid.uuid4())
        response = requests.post(f"{BASE_URL}/products/{invalid_id}/reviews",
                               json={"rating": 5, "comment": "ممتاز"},
                               cookies=buyer_cookies)
        
        if response.status_code == 404:
            data = response.json()
            if data.get('error') == 'المنتج غير موجود':
                print("  ✅ Invalid product id → 404 with Arabic error")
            else:
                print(f"  ❌ Wrong error message: {data}")
                return False
        else:
            print(f"  ❌ Expected 404, got {response.status_code}: {response.text}")
            return False
        
        # Test 3: Rating validation tests
        print("  📋 Test 3: Rating validation")
        
        # rating=0
        response = requests.post(f"{BASE_URL}/products/{product_id}/reviews",
                               json={"rating": 0, "comment": "test"},
                               cookies=buyer_cookies)
        if response.status_code == 400 and response.json().get('error') == 'التقييم يجب أن يكون بين 1 و 5 نجوم':
            print("    ✅ rating=0 → 400 with Arabic error")
        else:
            print(f"    ❌ rating=0 test failed: {response.status_code} {response.text}")
            return False
        
        # rating=6
        response = requests.post(f"{BASE_URL}/products/{product_id}/reviews",
                               json={"rating": 6, "comment": "test"},
                               cookies=buyer_cookies)
        if response.status_code == 400 and response.json().get('error') == 'التقييم يجب أن يكون بين 1 و 5 نجوم':
            print("    ✅ rating=6 → 400 with Arabic error")
        else:
            print(f"    ❌ rating=6 test failed: {response.status_code} {response.text}")
            return False
        
        # rating=3.5
        response = requests.post(f"{BASE_URL}/products/{product_id}/reviews",
                               json={"rating": 3.5, "comment": "test"},
                               cookies=buyer_cookies)
        if response.status_code == 400 and response.json().get('error') == 'التقييم يجب أن يكون بين 1 و 5 نجوم':
            print("    ✅ rating=3.5 → 400 with Arabic error")
        else:
            print(f"    ❌ rating=3.5 test failed: {response.status_code} {response.text}")
            return False
        
        # rating='abc'
        response = requests.post(f"{BASE_URL}/products/{product_id}/reviews",
                               json={"rating": "abc", "comment": "test"},
                               cookies=buyer_cookies)
        if response.status_code == 400 and response.json().get('error') == 'التقييم يجب أن يكون بين 1 و 5 نجوم':
            print("    ✅ rating='abc' → 400 with Arabic error")
        else:
            print(f"    ❌ rating='abc' test failed: {response.status_code} {response.text}")
            return False
        
        # Test 4: Vendor reviewing own product → 400
        print("  📋 Test 4: Vendor reviewing own product")
        response = requests.post(f"{BASE_URL}/products/{product_id}/reviews",
                               json={"rating": 5, "comment": "منتج رائع"},
                               cookies=vendor_cookies)
        
        if response.status_code == 400:
            data = response.json()
            if data.get('error') == 'لا يمكنك تقييم منتجك الخاص':
                print("  ✅ Vendor reviewing own product → 400 with Arabic error")
            else:
                print(f"  ❌ Wrong error message: {data}")
                return False
        else:
            print(f"  ❌ Expected 400, got {response.status_code}: {response.text}")
            return False
        
        # Test 5: User who hasn't purchased → 403
        print("  📋 Test 5: User who hasn't purchased")
        buyer2_cookies = login_user(buyer2_email)
        if not buyer2_cookies:
            print("  ❌ Failed to login buyer2")
            return False
        
        response = requests.post(f"{BASE_URL}/products/{product_id}/reviews",
                               json={"rating": 5, "comment": "منتج رائع"},
                               cookies=buyer2_cookies)
        
        if response.status_code == 403:
            data = response.json()
            if data.get('error') == 'يجب شراء المنتج أولاً لتتمكن من تقييمه':
                print("  ✅ Non-purchaser → 403 with Arabic error")
            else:
                print(f"  ❌ Wrong error message: {data}")
                return False
        else:
            print(f"  ❌ Expected 403, got {response.status_code}: {response.text}")
            return False
        
        # Test 6: Happy path - Valid review submission
        print("  📋 Test 6: Valid review submission")
        response = requests.post(f"{BASE_URL}/products/{product_id}/reviews",
                               json={"rating": 5, "comment": "منتج ممتاز جداً!"},
                               cookies=buyer_cookies)
        
        if response.status_code == 200:
            data = response.json()
            if (data.get('success') and 'review' in data and 'product' in data and
                data['review']['rating'] == 5 and data['product']['rating'] == 5.0 and
                data['product']['reviewCount'] == 1):
                print("  ✅ Valid review submission → 200 with correct data")
                print(f"    📊 Product rating: {data['product']['rating']}, reviewCount: {data['product']['reviewCount']}")
            else:
                print(f"  ❌ Invalid response structure: {data}")
                return False
        else:
            print(f"  ❌ Expected 200, got {response.status_code}: {response.text}")
            return False
        
        # Test 7: Duplicate review → 409
        print("  📋 Test 7: Duplicate review")
        response = requests.post(f"{BASE_URL}/products/{product_id}/reviews",
                               json={"rating": 4, "comment": "تقييم آخر"},
                               cookies=buyer_cookies)
        
        if response.status_code == 409:
            data = response.json()
            if data.get('error') == 'لقد قمت بتقييم هذا المنتج مسبقاً':
                print("  ✅ Duplicate review → 409 with Arabic error")
            else:
                print(f"  ❌ Wrong error message: {data}")
                return False
        else:
            print(f"  ❌ Expected 409, got {response.status_code}: {response.text}")
            return False
        
        # Test 8: Aggregation test - Second buyer with another order
        print("  📋 Test 8: Rating aggregation test")
        buyer3_email = f"buyer3-{timestamp}@test.com"
        buyer3_id = create_test_user(buyer3_email, name="عميل تجريبي 3")
        order2_id = create_test_order(buyer3_id, product_id, vendor_id, "PAID")
        buyer3_cookies = login_user(buyer3_email)
        
        if buyer3_cookies:
            response = requests.post(f"{BASE_URL}/products/{product_id}/reviews",
                                   json={"rating": 3, "comment": "منتج جيد"},
                                   cookies=buyer3_cookies)
            
            if response.status_code == 200:
                data = response.json()
                expected_rating = (5 + 3) / 2  # 4.0
                if (data.get('success') and data['product']['rating'] == expected_rating and
                    data['product']['reviewCount'] == 2):
                    print(f"  ✅ Rating aggregation → Product rating: {data['product']['rating']}, reviewCount: {data['product']['reviewCount']}")
                else:
                    print(f"  ❌ Aggregation failed: {data}")
                    return False
            else:
                print(f"  ❌ Second review failed: {response.status_code} {response.text}")
                return False
        
        # Test 9: Status validation - Test different order statuses
        print("  📋 Test 9: Order status validation")
        
        # Create buyer with SHIPPED order
        buyer4_email = f"buyer4-{timestamp}@test.com"
        buyer4_id = create_test_user(buyer4_email, name="عميل تجريبي 4")
        order3_id = create_test_order(buyer4_id, product_id, vendor_id, "SHIPPED")
        buyer4_cookies = login_user(buyer4_email)
        
        if buyer4_cookies:
            response = requests.post(f"{BASE_URL}/products/{product_id}/reviews",
                                   json={"rating": 4, "comment": "منتج جيد - شحن سريع"},
                                   cookies=buyer4_cookies)
            
            if response.status_code == 200:
                print("  ✅ SHIPPED order status accepted for review")
            else:
                print(f"  ❌ SHIPPED order should be accepted: {response.status_code} {response.text}")
                return False
        
        # Create buyer with PENDING order (should be rejected)
        buyer5_email = f"buyer5-{timestamp}@test.com"
        buyer5_id = create_test_user(buyer5_email, name="عميل تجريبي 5")
        order4_id = create_test_order(buyer5_id, product_id, vendor_id, "PENDING")
        buyer5_cookies = login_user(buyer5_email)
        
        if buyer5_cookies:
            response = requests.post(f"{BASE_URL}/products/{product_id}/reviews",
                                   json={"rating": 4, "comment": "منتج جيد"},
                                   cookies=buyer5_cookies)
            
            if response.status_code == 403:
                data = response.json()
                if data.get('error') == 'يجب شراء المنتج أولاً لتتمكن من تقييمه':
                    print("  ✅ PENDING order status rejected for review")
                else:
                    print(f"  ❌ Wrong error message for PENDING order: {data}")
                    return False
            else:
                print(f"  ❌ PENDING order should be rejected: {response.status_code} {response.text}")
                return False
        
        # Test 10: Comment length validation (1500 chars should be truncated to 1000)
        print("  📋 Test 10: Comment length validation")
        long_comment = "تعليق طويل جداً " * 100  # Create a very long comment
        
        buyer6_email = f"buyer6-{timestamp}@test.com"
        buyer6_id = create_test_user(buyer6_email, name="عميل تجريبي 6")
        order5_id = create_test_order(buyer6_id, product_id, vendor_id, "DELIVERED")
        buyer6_cookies = login_user(buyer6_email)
        
        if buyer6_cookies:
            response = requests.post(f"{BASE_URL}/products/{product_id}/reviews",
                                   json={"rating": 5, "comment": long_comment},
                                   cookies=buyer6_cookies)
            
            if response.status_code == 200:
                data = response.json()
                if len(data['review']['comment']) <= 1000:
                    print(f"  ✅ Long comment truncated to {len(data['review']['comment'])} chars")
                else:
                    print(f"  ❌ Comment not truncated: {len(data['review']['comment'])} chars")
                    return False
            else:
                print(f"  ❌ Long comment test failed: {response.status_code} {response.text}")
                return False
        
        print("  🎉 POST /api/products/:id/reviews tests passed!")
        return True
        
    except Exception as e:
        print(f"  ❌ Test failed with exception: {e}")
        return False

def test_get_my_review_status():
    """Test GET /api/products/:id/my-review-status (auth optional)"""
    print("\n🧪 Testing GET /api/products/:id/my-review-status")
    
    # Create test data
    timestamp = int(time.time())
    vendor_email = f"vendor-{timestamp}@test.com"
    buyer_email = f"buyer-{timestamp}@test.com"
    buyer2_email = f"buyer2-{timestamp}@test.com"
    
    vendor_id = create_test_user(vendor_email, role="VENDOR", name="بائع تجريبي")
    buyer_id = create_test_user(buyer_email, name="عميل تجريبي")
    buyer2_id = create_test_user(buyer2_email, name="عميل تجريبي 2")
    
    product_id = create_test_product(vendor_id)
    order_id = create_test_order(buyer_id, product_id, vendor_id, "PAID")
    
    try:
        # Test 1: No session → 200 with loggedIn: false
        print("  📋 Test 1: No session")
        response = requests.get(f"{BASE_URL}/products/{product_id}/my-review-status")
        
        if response.status_code == 200:
            data = response.json()
            expected_keys = ['loggedIn', 'hasPurchased', 'alreadyReviewed', 'canReview']
            if (all(key in data for key in expected_keys) and 
                data['loggedIn'] == False and data['canReview'] == False):
                print("  ✅ No session → 200 with correct structure")
            else:
                print(f"  ❌ Invalid response structure: {data}")
                return False
        else:
            print(f"  ❌ Expected 200, got {response.status_code}: {response.text}")
            return False
        
        # Test 2: Invalid product id → 404
        print("  📋 Test 2: Invalid product id")
        invalid_id = str(uuid.uuid4())
        response = requests.get(f"{BASE_URL}/products/{invalid_id}/my-review-status")
        
        if response.status_code == 404:
            data = response.json()
            if data.get('error') == 'المنتج غير موجود':
                print("  ✅ Invalid product id → 404 with Arabic error")
            else:
                print(f"  ❌ Wrong error message: {data}")
                return False
        else:
            print(f"  ❌ Expected 404, got {response.status_code}: {response.text}")
            return False
        
        # Test 3: User who hasn't purchased
        print("  📋 Test 3: User who hasn't purchased")
        buyer2_cookies = login_user(buyer2_email)
        if not buyer2_cookies:
            print("  ❌ Failed to login buyer2")
            return False
        
        response = requests.get(f"{BASE_URL}/products/{product_id}/my-review-status",
                              cookies=buyer2_cookies)
        
        if response.status_code == 200:
            data = response.json()
            if (data.get('loggedIn') == True and data.get('hasPurchased') == False and
                data.get('alreadyReviewed') == False and data.get('canReview') == False):
                print("  ✅ Non-purchaser → canReview=false, hasPurchased=false")
            else:
                print(f"  ❌ Invalid response for non-purchaser: {data}")
                return False
        else:
            print(f"  ❌ Expected 200, got {response.status_code}: {response.text}")
            return False
        
        # Test 4: User who purchased but hasn't reviewed
        print("  📋 Test 4: User who purchased but hasn't reviewed")
        buyer_cookies = login_user(buyer_email)
        if not buyer_cookies:
            print("  ❌ Failed to login buyer")
            return False
        
        response = requests.get(f"{BASE_URL}/products/{product_id}/my-review-status",
                              cookies=buyer_cookies)
        
        if response.status_code == 200:
            data = response.json()
            if (data.get('loggedIn') == True and data.get('hasPurchased') == True and
                data.get('alreadyReviewed') == False and data.get('canReview') == True and
                data.get('myReview') is None):
                print("  ✅ Purchaser without review → canReview=true, hasPurchased=true")
            else:
                print(f"  ❌ Invalid response for purchaser: {data}")
                return False
        else:
            print(f"  ❌ Expected 200, got {response.status_code}: {response.text}")
            return False
        
        # Test 5: Submit a review and check status again
        print("  📋 Test 5: User who purchased and already reviewed")
        
        # Submit review first
        review_response = requests.post(f"{BASE_URL}/products/{product_id}/reviews",
                                      json={"rating": 4, "comment": "منتج جيد جداً"},
                                      cookies=buyer_cookies)
        
        if review_response.status_code != 200:
            print(f"  ❌ Failed to submit review: {review_response.status_code}")
            return False
        
        # Check status after review
        response = requests.get(f"{BASE_URL}/products/{product_id}/my-review-status",
                              cookies=buyer_cookies)
        
        if response.status_code == 200:
            data = response.json()
            if (data.get('loggedIn') == True and data.get('hasPurchased') == True and
                data.get('alreadyReviewed') == True and data.get('canReview') == False and
                data.get('myReview') is not None and data['myReview']['rating'] == 4):
                print("  ✅ Reviewed purchaser → canReview=false, alreadyReviewed=true, myReview present")
            else:
                print(f"  ❌ Invalid response for reviewed purchaser: {data}")
                return False
        else:
            print(f"  ❌ Expected 200, got {response.status_code}: {response.text}")
            return False
        
        # Test 6: Vendor viewing own product
        print("  📋 Test 6: Vendor viewing own product")
        vendor_cookies = login_user(vendor_email)
        if not vendor_cookies:
            print("  ❌ Failed to login vendor")
            return False
        
        response = requests.get(f"{BASE_URL}/products/{product_id}/my-review-status",
                              cookies=vendor_cookies)
        
        if response.status_code == 200:
            data = response.json()
            if (data.get('loggedIn') == True and data.get('isOwnProduct') == True and
                data.get('canReview') == False):
                print("  ✅ Vendor viewing own product → isOwnProduct=true, canReview=false")
            else:
                print(f"  ❌ Invalid response for vendor: {data}")
                return False
        else:
            print(f"  ❌ Expected 200, got {response.status_code}: {response.text}")
            return False
        
        print("  🎉 GET /api/products/:id/my-review-status tests passed!")
        return True
        
    except Exception as e:
        print(f"  ❌ Test failed with exception: {e}")
        return False

def test_regression_endpoints():
    """Test regression endpoints to ensure existing functionality still works"""
    print("\n🧪 Testing Regression Endpoints")
    
    try:
        # Test 1: GET /api/ → 200
        print("  📋 Test 1: GET /api/")
        response = requests.get(f"{BASE_URL}/")
        
        if response.status_code == 200:
            data = response.json()
            if 'message' in data:
                print("  ✅ GET /api/ → 200 with message")
            else:
                print(f"  ❌ Invalid response structure: {data}")
                return False
        else:
            print(f"  ❌ Expected 200, got {response.status_code}: {response.text}")
            return False
        
        # Test 2: GET /api/products → 200 (should now include rating and reviewCount fields)
        print("  📋 Test 2: GET /api/products")
        response = requests.get(f"{BASE_URL}/products")
        
        if response.status_code == 200:
            data = response.json()
            if 'products' in data and isinstance(data['products'], list):
                # Check if products have rating and reviewCount fields
                if data['products']:
                    product = data['products'][0]
                    if 'rating' in product and 'reviewCount' in product:
                        print("  ✅ GET /api/products → 200 with rating and reviewCount fields")
                    else:
                        print(f"  ❌ Products missing rating/reviewCount fields: {list(product.keys())}")
                        return False
                else:
                    print("  ✅ GET /api/products → 200 with empty products array")
            else:
                print(f"  ❌ Invalid response structure: {data}")
                return False
        else:
            print(f"  ❌ Expected 200, got {response.status_code}: {response.text}")
            return False
        
        # Test 3: POST /api/signup → 200
        print("  📋 Test 3: POST /api/signup")
        timestamp = int(time.time())
        test_email = f"regression-{timestamp}@test.com"
        
        response = requests.post(f"{BASE_URL}/signup", json={
            "name": "مستخدم تجريبي",
            "email": test_email,
            "password": "Password123"
        })
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success') and 'user' in data:
                print("  ✅ POST /api/signup → 200 with user data")
            else:
                print(f"  ❌ Invalid response structure: {data}")
                return False
        else:
            print(f"  ❌ Expected 200, got {response.status_code}: {response.text}")
            return False
        
        # Test 4: GET /api/vendors → 200 (vendor storefront regression)
        print("  📋 Test 4: GET /api/vendors")
        response = requests.get(f"{BASE_URL}/vendors")
        
        if response.status_code == 200:
            data = response.json()
            if 'vendors' in data and isinstance(data['vendors'], list):
                print("  ✅ GET /api/vendors → 200 with vendors array")
            else:
                print(f"  ❌ Invalid response structure: {data}")
                return False
        else:
            print(f"  ❌ Expected 200, got {response.status_code}: {response.text}")
            return False
        
        print("  🎉 Regression tests passed!")
        return True
        
    except Exception as e:
        print(f"  ❌ Regression test failed with exception: {e}")
        return False

def cleanup_test_data():
    """Clean up test data from database"""
    try:
        db = get_db()
        
        # Delete test users (those with test emails)
        result = db.users.delete_many({"email": {"$regex": ".*@test\\.com$"}})
        print(f"🧹 Cleaned up {result.deleted_count} test users")
        
        # Delete test products
        result = db.products.delete_many({"nameAr": {"$regex": "منتج تجريبي"}})
        print(f"🧹 Cleaned up {result.deleted_count} test products")
        
        # Delete test orders
        result = db.orders.delete_many({"shippingAddress.name": {"$regex": "عميل تجريبي"}})
        print(f"🧹 Cleaned up {result.deleted_count} test orders")
        
        # Delete test reviews
        result = db.productreviews.delete_many({"comment": {"$regex": "منتج"}})
        print(f"🧹 Cleaned up {result.deleted_count} test reviews")
        
    except Exception as e:
        print(f"⚠️ Cleanup failed: {e}")

def main():
    """Run all Product Reviews backend tests"""
    print("🚀 Starting Product Reviews Backend Testing")
    print(f"📍 Base URL: {BASE_URL}")
    print(f"🗄️ Database: {MONGO_URL}/{DB_NAME}")
    
    # Clean up any existing test data
    cleanup_test_data()
    
    # Run tests
    tests = [
        ("GET /api/products/:id/reviews", test_get_product_reviews),
        ("POST /api/products/:id/reviews", test_post_product_reviews),
        ("GET /api/products/:id/my-review-status", test_get_my_review_status),
        ("Regression Endpoints", test_regression_endpoints)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n{'='*60}")
        print(f"🧪 Running: {test_name}")
        print('='*60)
        
        try:
            if test_func():
                passed += 1
                print(f"✅ {test_name} PASSED")
            else:
                print(f"❌ {test_name} FAILED")
        except Exception as e:
            print(f"💥 {test_name} CRASHED: {e}")
    
    # Final cleanup
    cleanup_test_data()
    
    # Summary
    print(f"\n{'='*60}")
    print("📊 FINAL RESULTS")
    print('='*60)
    print(f"✅ Passed: {passed}/{total}")
    print(f"❌ Failed: {total - passed}/{total}")
    print(f"📈 Success Rate: {(passed/total)*100:.1f}%")
    
    if passed == total:
        print("\n🎉 ALL PRODUCT REVIEWS TESTS PASSED!")
        print("🚀 Product Reviews feature is ready for production!")
    else:
        print(f"\n⚠️ {total - passed} test(s) failed. Please review the issues above.")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)