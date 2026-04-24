#!/usr/bin/env python3
"""
Focused Backend Testing - Critical Scenarios After FIXES
Focus on the most important tests that can be verified
"""

import requests
import json
import os
import time
import uuid
from datetime import datetime, timedelta
import pymongo
import bcrypt
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/.env')

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://omani-startup-hub.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'majles')
CRON_SECRET = os.getenv('CRON_SECRET_KEY', os.getenv('CRON_SECRET', 'fcb09a9f909c3ea848c026041b3b3d3069beba9da6848e56'))

print(f"🔧 Configuration:")
print(f"   BASE_URL: {BASE_URL}")
print(f"   API_BASE: {API_BASE}")
print(f"   CRON_SECRET: {CRON_SECRET}")
print()

# MongoDB connection
try:
    mongo_client = pymongo.MongoClient(MONGO_URL)
    db = mongo_client[DB_NAME]
    print("✅ MongoDB connection established")
except Exception as e:
    print(f"❌ MongoDB connection failed: {e}")
    exit(1)

def generate_uuid():
    """Generate UUID string for MongoDB _id"""
    return str(uuid.uuid4())

def hash_password(password):
    """Hash password using bcrypt (compatible with bcryptjs)"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_test_user(name, email, password, role='MEMBER', tier='FREE', is_guest=False):
    """Create a test user directly in MongoDB"""
    user_id = generate_uuid()
    user_doc = {
        '_id': user_id,
        'name': name,
        'email': email.lower(),
        'password': '' if is_guest else hash_password(password),
        'role': role,
        'membershipTier': tier,
        'membershipExpiry': None,
        'phone': '',
        'photo': '',
        'wishlist': [],
        'isGuest': is_guest,
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
        print(f"✅ Created user: {name} ({email}) - Role: {role}, Tier: {tier}, Guest: {is_guest}")
        return user_id
    except Exception as e:
        print(f"❌ Failed to create user {email}: {e}")
        return None

def create_test_product(vendor_id, name_ar, price, stock=20, is_active=True):
    """Create a test product directly in MongoDB"""
    product_id = generate_uuid()
    product_doc = {
        '_id': product_id,
        'vendorId': vendor_id,
        'nameAr': name_ar,
        'nameEn': '',
        'price': price,
        'description': 'منتج تجريبي للاختبار',
        'images': [],
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
        print(f"✅ Created product: {name_ar} - Price: {price} OMR, Stock: {stock}")
        return product_id
    except Exception as e:
        print(f"❌ Failed to create product: {e}")
        return None

def make_request(method, endpoint, data=None, headers=None, timeout=10):
    """Make HTTP request"""
    url = f"{API_BASE}{endpoint}"
    req_headers = {'Content-Type': 'application/json'}
    
    if headers:
        req_headers.update(headers)
    
    try:
        if method.upper() == 'GET':
            response = requests.get(url, headers=req_headers, timeout=timeout)
        elif method.upper() == 'POST':
            response = requests.post(url, json=data, headers=req_headers, timeout=timeout)
        elif method.upper() == 'DELETE':
            response = requests.delete(url, headers=req_headers, timeout=timeout)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return response
    except requests.exceptions.Timeout:
        print(f"❌ Request timeout for {method} {url}")
        return None
    except requests.exceptions.RequestException as e:
        print(f"❌ Request error for {method} {url}: {e}")
        return None
    except Exception as e:
        print(f"❌ Unexpected error for {method} {url}: {e}")
        return None

def test_guest_checkout_critical():
    """Test the critical guest checkout scenarios"""
    print("\n🧪 CRITICAL TEST: Guest Checkout Happy Path (G5)")
    
    # Setup: Create vendor and product
    timestamp = int(time.time())
    vendor_email = f"vendor{timestamp}@test.com"
    vendor_id = create_test_user(f"Vendor {timestamp}", vendor_email, "password123", role='VENDOR')
    
    if not vendor_id:
        print("❌ Failed to create vendor user")
        return False
    
    product_id = create_test_product(vendor_id, "منتج تجريبي", 10.0, stock=20)
    if not product_id:
        print("❌ Failed to create test product")
        return False
    
    # Test G5: Happy path - new guest email (CRITICAL TEST)
    print("   Testing G5: Happy path guest checkout...")
    guest_email = f"guest{timestamp}@example.com"
    guest_data = {
        "items": [{"productId": product_id, "quantity": 2}],
        "shippingAddress": {
            "name": "عميل تجريبي",
            "phone": "+968 9123 4567",
            "addressLine": "شارع السلطان قابوس، مسقط",
            "governorate": "MUSCAT"
        },
        "paymentMethod": "COD",
        "guest": {"name": "Guest Test", "email": guest_email, "phone": "+968 9123 4567"}
    }
    
    response = make_request('POST', '/orders', guest_data, timeout=30)
    if response and response.status_code == 200:
        try:
            result = response.json()
            if result.get('success') and result.get('order', {}).get('id'):
                print("   ✅ G5: Guest checkout successful → 200 with order.id")
                
                # Verify guest user created in DB with correct fields
                guest_user = db.users.find_one({"email": guest_email})
                if guest_user:
                    checks = [
                        (guest_user.get('isGuest') == True, f"isGuest=true (got {guest_user.get('isGuest')})"),
                        (guest_user.get('password') == '', f"password='' (got '{guest_user.get('password')}')"),
                        (guest_user.get('name') == "Guest Test", f"name='Guest Test' (got '{guest_user.get('name')}')"),
                        (guest_user.get('email') == guest_email, f"email='{guest_email}' (got '{guest_user.get('email')}')"),
                    ]
                    
                    for check, desc in checks:
                        if check:
                            print(f"   ✅ G5: Guest user {desc}")
                        else:
                            print(f"   ❌ G5: Guest user {desc}")
                else:
                    print("   ❌ G5: Guest user not found in database")
                
                # Verify order details
                order = db.orders.find_one({"_id": result['order']['id']})
                if order:
                    order_checks = [
                        (order.get('paymentProvider') == 'COD', f"paymentProvider=COD (got {order.get('paymentProvider')})"),
                        (order.get('status') == 'PAID', f"status=PAID (got {order.get('status')})"),
                        (order.get('userId') == guest_user.get('_id'), f"userId matches guest user"),
                    ]
                    
                    for check, desc in order_checks:
                        if check:
                            print(f"   ✅ G5: Order {desc}")
                        else:
                            print(f"   ❌ G5: Order {desc}")
                else:
                    print("   ❌ G5: Order not found in database")
                
                return True
                    
            else:
                print(f"   ❌ G5: Invalid response structure: {result}")
                return False
        except Exception as e:
            print(f"   ❌ G5: Error parsing response: {e}")
            return False
    else:
        print(f"   ❌ G5: Guest checkout failed → {response.status_code if response else 'No response'}")
        if response:
            try:
                error_response = response.json()
                print(f"   ❌ G5: Error response: {error_response}")
            except:
                print(f"   ❌ G5: Response text: {response.text[:500]}")
        return False

def test_guest_checkout_validations():
    """Test guest checkout validation scenarios"""
    print("\n🧪 Testing Guest Checkout Validations (G1-G4)")
    
    # Setup: Create vendor and product
    timestamp = int(time.time())
    vendor_email = f"vendor{timestamp}@test.com"
    vendor_id = create_test_user(f"Vendor {timestamp}", vendor_email, "password123", role='VENDOR')
    product_id = create_test_product(vendor_id, "منتج تجريبي", 10.0, stock=20)
    
    if not all([vendor_id, product_id]):
        print("❌ Failed to create test data")
        return False
    
    valid_shipping = {
        "name": "عميل تجريبي",
        "phone": "+968 9123 4567",
        "addressLine": "شارع السلطان قابوس، مسقط",
        "governorate": "MUSCAT"
    }
    
    valid_items = [{"productId": product_id, "quantity": 2}]
    
    # Test cases with expected Arabic error messages
    test_cases = [
        {
            "name": "G1: Missing guest object",
            "data": {
                "items": valid_items,
                "shippingAddress": valid_shipping,
                "paymentMethod": "COD"
            },
            "expected_status": 400,
            "expected_error": "للشراء كضيف، الاسم والبريد الإلكتروني مطلوبان"
        },
        {
            "name": "G2: Empty guest name",
            "data": {
                "items": valid_items,
                "shippingAddress": valid_shipping,
                "paymentMethod": "COD",
                "guest": {"name": "", "email": "test@example.com", "phone": "+968 9123 4567"}
            },
            "expected_status": 400,
            "expected_error": "للشراء كضيف، الاسم والبريد الإلكتروني مطلوبان"
        },
        {
            "name": "G3: Invalid email format",
            "data": {
                "items": valid_items,
                "shippingAddress": valid_shipping,
                "paymentMethod": "COD",
                "guest": {"name": "Guest Test", "email": "notanemail", "phone": "+968 9123 4567"}
            },
            "expected_status": 400,
            "expected_error": "صيغة البريد الإلكتروني غير صحيحة"
        }
    ]
    
    # G4: Email belongs to registered user
    registered_email = f"registered{timestamp}@test.com"
    registered_user_id = create_test_user("Registered User", registered_email, "password123")
    if registered_user_id:
        test_cases.append({
            "name": "G4: Email belongs to registered user",
            "data": {
                "items": valid_items,
                "shippingAddress": valid_shipping,
                "paymentMethod": "COD",
                "guest": {"name": "Guest Test", "email": registered_email, "phone": "+968 9123 4567"}
            },
            "expected_status": 409,
            "expected_error": "هذا البريد مسجّل مسبقاً، يُرجى تسجيل الدخول لإتمام الطلب"
        })
    
    # Run validation test cases
    passed = 0
    for test_case in test_cases:
        print(f"   Testing {test_case['name']}...")
        response = make_request('POST', '/orders', test_case['data'], timeout=15)
        
        if response and response.status_code == test_case['expected_status']:
            try:
                error_msg = response.json().get('error', '')
                if test_case['expected_error'] in error_msg:
                    print(f"   ✅ {test_case['name']} → {response.status_code} with correct Arabic error")
                    passed += 1
                else:
                    print(f"   ❌ {test_case['name']} → Wrong error message: {error_msg}")
            except:
                print(f"   ❌ {test_case['name']} → Invalid JSON response")
        else:
            print(f"   ❌ {test_case['name']} → Expected {test_case['expected_status']}, got {response.status_code if response else 'No response'}")
    
    print(f"   Validation tests: {passed}/{len(test_cases)} passed")
    return passed == len(test_cases)

def test_cart_unauthenticated():
    """Test cart endpoints without authentication"""
    print("\n🧪 Testing Cart Endpoints (Unauthenticated)")
    
    # C1: POST /api/cart without session
    print("   Testing C1: POST /api/cart without session...")
    cart_data = {
        "items": [{
            "productId": "test-product-id",
            "quantity": 2,
            "nameAr": "منتج",
            "unitPrice": 5,
            "image": ""
        }]
    }
    
    response = make_request('POST', '/cart', cart_data)
    if response and response.status_code == 401:
        try:
            error_msg = response.json().get('error', '')
            if 'غير مصرح' in error_msg:
                print("   ✅ C1: POST /api/cart without session → 401 'غير مصرح'")
                c1_pass = True
            else:
                print(f"   ❌ C1: Wrong error message: {error_msg}")
                c1_pass = False
        except:
            print("   ❌ C1: Invalid JSON response")
            c1_pass = False
    else:
        print(f"   ❌ C1: Expected 401, got {response.status_code if response else 'No response'}")
        c1_pass = False
    
    # C2: GET /api/cart without session
    print("   Testing C2: GET /api/cart without session...")
    response = make_request('GET', '/cart')
    if response and response.status_code == 200:
        try:
            result = response.json()
            if result.get('items') == []:
                print("   ✅ C2: GET /api/cart without session → 200 { items: [] }")
                c2_pass = True
            else:
                print(f"   ❌ C2: Expected empty items, got: {result}")
                c2_pass = False
        except:
            print("   ❌ C2: Invalid JSON response")
            c2_pass = False
    else:
        print(f"   ❌ C2: Expected 200, got {response.status_code if response else 'No response'}")
        c2_pass = False
    
    return c1_pass and c2_pass

def test_cron_endpoint():
    """Test cron endpoint"""
    print("\n🧪 Testing Cron Endpoint")
    
    # CR1: No auth header
    print("   Testing CR1: No auth header...")
    response = make_request('POST', '/cron/abandoned-carts')
    if response and response.status_code == 401:
        try:
            error_msg = response.json().get('error', '')
            if 'غير مصرح' in error_msg:
                print("   ✅ CR1: No auth → 401 'غير مصرح'")
                cr1_pass = True
            else:
                print(f"   ❌ CR1: Wrong error message: {error_msg}")
                cr1_pass = False
        except:
            print("   ❌ CR1: Invalid JSON response")
            cr1_pass = False
    else:
        print(f"   ❌ CR1: Expected 401, got {response.status_code if response else 'No response'}")
        cr1_pass = False
    
    # CR2: Wrong X-CRON-KEY
    print("   Testing CR2: Wrong X-CRON-KEY...")
    response = make_request('POST', '/cron/abandoned-carts', headers={'X-CRON-KEY': 'wrong-key'})
    if response and response.status_code == 401:
        print("   ✅ CR2: Wrong cron key → 401")
        cr2_pass = True
    else:
        print(f"   ❌ CR2: Expected 401, got {response.status_code if response else 'No response'}")
        cr2_pass = False
    
    # CR3: Correct X-CRON-KEY
    print("   Testing CR3: Correct X-CRON-KEY...")
    response = make_request('POST', '/cron/abandoned-carts', headers={'X-CRON-KEY': CRON_SECRET})
    if response and response.status_code == 200:
        try:
            result = response.json()
            if result.get('success') and 'candidates' in result and 'sent' in result:
                print(f"   ✅ CR3: Correct cron key → 200 {{ success: true, candidates: {result['candidates']}, sent: {result['sent']} }}")
                cr3_pass = True
            else:
                print(f"   ❌ CR3: Unexpected response structure: {result}")
                cr3_pass = False
        except:
            print("   ❌ CR3: Invalid JSON response")
            cr3_pass = False
    else:
        print(f"   ❌ CR3: Expected 200, got {response.status_code if response else 'No response'}")
        cr3_pass = False
    
    return cr1_pass and cr2_pass and cr3_pass

def main():
    """Main testing function"""
    print("🚀 Starting FOCUSED Backend Testing for Omani Entrepreneur Majles")
    print("🔧 FIXES APPLIED:")
    print("   1. User.password is now `default: ''` with custom validator for isGuest=true")
    print("   2. NEXTAUTH_URL aligned with NEXT_PUBLIC_BASE_URL")
    print("   3. CRON_SECRET_KEY env variable set")
    print("=" * 80)
    
    # Test API health first
    print("🧪 Testing API Health...")
    response = make_request('GET', '')
    if response and response.status_code == 200:
        print("✅ GET /api → 200 'Majles API is running'")
    else:
        print(f"❌ GET /api → {response.status_code if response else 'No response'}")
        print("❌ API health check failed. Stopping tests.")
        return
    
    # Run focused tests
    results = []
    
    try:
        results.append(("Guest Checkout Critical (G5)", test_guest_checkout_critical()))
        results.append(("Guest Checkout Validations (G1-G4)", test_guest_checkout_validations()))
        results.append(("Cart Unauthenticated (C1-C2)", test_cart_unauthenticated()))
        results.append(("Cron Endpoint (CR1-CR3)", test_cron_endpoint()))
    except Exception as e:
        print(f"❌ Testing error: {e}")
        results.append(("Testing Error", False))
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 FOCUSED TESTING SUMMARY")
    print("=" * 80)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {test_name}")
        if result:
            passed += 1
    
    print(f"\nOverall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 All focused tests passed!")
    else:
        print("⚠️  Some tests failed. Check the detailed output above.")
    
    # Return summary for test_result.md update
    return {
        "guest_checkout_critical": results[0][1],
        "guest_checkout_validations": results[1][1],
        "cart_unauthenticated": results[2][1],
        "cron_endpoint": results[3][1],
        "overall_passed": passed,
        "overall_total": total
    }

if __name__ == "__main__":
    main()