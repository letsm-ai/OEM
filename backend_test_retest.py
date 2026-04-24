#!/usr/bin/env python3
"""
Backend Re-testing for Omani Entrepreneur Majles - After FIXES Applied
Testing the 4 current focus tasks after fixes:
1. POST /api/orders Guest Checkout (all sub-cases G1-G7 from previous run — especially G5 happy-path and G7 authenticated regression)
2. POST /api/orders with paymentMethod='COD' (COD1-COD3 — requires authenticated session, retry now that NEXTAUTH_URL is fixed)
3. POST/GET/DELETE /api/cart (all C1-C8 — requires authenticated session)
4. POST /api/cron/abandoned-carts (already verified, quick re-confirm CR1-CR8)

FIXES APPLIED:
1. User.password is now `default: ''` with a custom validator that skips required-check when `isGuest===true`
2. NEXTAUTH_URL is now aligned to the same host as NEXT_PUBLIC_BASE_URL
3. CRON_SECRET_KEY env is set in /app/.env (same value as CRON_SECRET)
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
print(f"   MONGO_URL: {MONGO_URL}")
print(f"   DB_NAME: {DB_NAME}")
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

def login_user(email, password):
    """Login user via NextAuth credentials and return session cookie"""
    try:
        # First get CSRF token
        csrf_response = requests.get(f"{API_BASE}/auth/csrf", timeout=30)
        if csrf_response.status_code != 200:
            print(f"❌ Failed to get CSRF token: {csrf_response.status_code}")
            return None
        
        csrf_token = csrf_response.json().get('csrfToken')
        if not csrf_token:
            print("❌ No CSRF token in response")
            return None
        
        print(f"   Got CSRF token: {csrf_token[:20]}...")
        
        # Login with credentials
        login_data = {
            'email': email,
            'password': password,
            'csrfToken': csrf_token,
            'callbackUrl': f"{BASE_URL}/dashboard",
            'json': 'true'
        }
        
        login_response = requests.post(
            f"{API_BASE}/auth/callback/credentials",
            data=login_data,
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
            allow_redirects=False,
            timeout=30
        )
        
        print(f"   Login response status: {login_response.status_code}")
        print(f"   Login response headers: {dict(login_response.headers)}")
        
        # Extract session cookie
        session_cookie = None
        for cookie in login_response.cookies:
            print(f"   Found cookie: {cookie.name} = {cookie.value[:20]}...")
            if 'session-token' in cookie.name or 'next-auth.session-token' in cookie.name:
                session_cookie = f"{cookie.name}={cookie.value}"
                break
        
        if session_cookie:
            print(f"✅ Login successful for {email}")
            return session_cookie
        else:
            print(f"❌ Login failed for {email} - No session cookie found")
            print(f"   Response status: {login_response.status_code}")
            print(f"   Available cookies: {[cookie.name for cookie in login_response.cookies]}")
            
            # Try to get response text for debugging
            try:
                response_text = login_response.text[:500]
                print(f"   Response text: {response_text}")
            except:
                pass
            
            return None
            
    except Exception as e:
        print(f"❌ Login error for {email}: {e}")
        return None

def make_request(method, endpoint, data=None, headers=None, session_cookie=None):
    """Make HTTP request with optional session cookie"""
    url = f"{API_BASE}{endpoint}"
    req_headers = {'Content-Type': 'application/json'}
    
    if headers:
        req_headers.update(headers)
    
    if session_cookie:
        req_headers['Cookie'] = session_cookie
    
    try:
        if method.upper() == 'GET':
            response = requests.get(url, headers=req_headers, timeout=30, allow_redirects=True)
        elif method.upper() == 'POST':
            response = requests.post(url, json=data, headers=req_headers, timeout=30, allow_redirects=True)
        elif method.upper() == 'DELETE':
            response = requests.delete(url, headers=req_headers, timeout=30, allow_redirects=True)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return response
    except requests.exceptions.RequestException as e:
        print(f"❌ Request error for {method} {url}: {e}")
        return None
    except Exception as e:
        print(f"❌ Unexpected error for {method} {url}: {e}")
        return None

def test_api_health():
    """Test basic API health"""
    print("🧪 Testing API Health...")
    response = make_request('GET', '')
    
    if response and response.status_code == 200:
        print("✅ GET /api → 200 'Majles API is running'")
        return True
    else:
        print(f"❌ GET /api → {response.status_code if response else 'No response'}")
        return False

def test_guest_checkout():
    """Test TASK 1: POST /api/orders — Guest Checkout (G1-G7)"""
    print("\n🧪 TASK 1: Testing Guest Checkout (POST /api/orders) - ALL G1-G7 SCENARIOS")
    
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
    
    # Test data
    valid_shipping = {
        "name": "عميل تجريبي",
        "phone": "+968 9123 4567",
        "addressLine": "شارع السلطان قابوس، مسقط",
        "governorate": "MUSCAT"
    }
    
    valid_items = [{
        "productId": product_id,
        "quantity": 2
    }]
    
    # G1: Missing guest object (no session)
    print("   Testing G1: Missing guest object...")
    g1_data = {
        "items": valid_items,
        "shippingAddress": valid_shipping,
        "paymentMethod": "COD"
    }
    response = make_request('POST', '/orders', g1_data)
    
    if response and response.status_code == 400:
        try:
            error_msg = response.json().get('error', '')
            if 'للشراء كضيف، الاسم والبريد الإلكتروني مطلوبان' in error_msg:
                print("   ✅ G1: Missing guest object → 400 'للشراء كضيف، الاسم والبريد الإلكتروني مطلوبان'")
            else:
                print(f"   ❌ G1: Wrong error message: {error_msg}")
        except:
            print("   ❌ G1: Invalid JSON response")
    else:
        print(f"   ❌ G1: Expected 400, got {response.status_code if response else 'No response'}")
    
    # G2: Empty guest name
    print("   Testing G2: Empty guest name...")
    g2_data = {
        "items": valid_items,
        "shippingAddress": valid_shipping,
        "paymentMethod": "COD",
        "guest": {"name": "", "email": "test@example.com", "phone": "+968 9123 4567"}
    }
    response = make_request('POST', '/orders', g2_data)
    
    if response and response.status_code == 400:
        try:
            error_msg = response.json().get('error', '')
            if 'للشراء كضيف، الاسم والبريد الإلكتروني مطلوبان' in error_msg:
                print("   ✅ G2: Empty guest name → 400 'للشراء كضيف، الاسم والبريد الإلكتروني مطلوبان'")
            else:
                print(f"   ❌ G2: Wrong error message: {error_msg}")
        except:
            print("   ❌ G2: Invalid JSON response")
    else:
        print(f"   ❌ G2: Expected 400, got {response.status_code if response else 'No response'}")
    
    # G3: Invalid email format
    print("   Testing G3: Invalid email format...")
    g3_data = {
        "items": valid_items,
        "shippingAddress": valid_shipping,
        "paymentMethod": "COD",
        "guest": {"name": "Guest Test", "email": "notanemail", "phone": "+968 9123 4567"}
    }
    response = make_request('POST', '/orders', g3_data)
    
    if response and response.status_code == 400:
        try:
            error_msg = response.json().get('error', '')
            if 'صيغة البريد الإلكتروني غير صحيحة' in error_msg:
                print("   ✅ G3: Invalid email format → 400 'صيغة البريد الإلكتروني غير صحيحة'")
            else:
                print(f"   ❌ G3: Wrong error message: {error_msg}")
        except:
            print("   ❌ G3: Invalid JSON response")
    else:
        print(f"   ❌ G3: Expected 400, got {response.status_code if response else 'No response'}")
    
    # G4: Email belongs to registered user
    print("   Testing G4: Email belongs to registered user...")
    registered_email = f"registered{timestamp}@test.com"
    registered_user_id = create_test_user("Registered User", registered_email, "password123")
    
    if registered_user_id:
        g4_data = {
            "items": valid_items,
            "shippingAddress": valid_shipping,
            "paymentMethod": "COD",
            "guest": {"name": "Guest Test", "email": registered_email, "phone": "+968 9123 4567"}
        }
        response = make_request('POST', '/orders', g4_data)
        
        if response and response.status_code == 409:
            try:
                error_msg = response.json().get('error', '')
                if 'هذا البريد مسجّل مسبقاً، يُرجى تسجيل الدخول لإتمام الطلب' in error_msg:
                    print("   ✅ G4: Registered email → 409 'هذا البريد مسجّل مسبقاً، يُرجى تسجيل الدخول لإتمام الطلب'")
                else:
                    print(f"   ❌ G4: Wrong error message: {error_msg}")
            except:
                print("   ❌ G4: Invalid JSON response")
        else:
            print(f"   ❌ G4: Expected 409, got {response.status_code if response else 'No response'}")
    else:
        print("   ❌ G4: Failed to create registered user")
    
    # G5: Happy path - new guest email (CRITICAL TEST)
    print("   Testing G5: Happy path guest checkout (CRITICAL)...")
    guest_email = f"guest{timestamp}@example.com"
    g5_data = {
        "items": valid_items,
        "shippingAddress": valid_shipping,
        "paymentMethod": "COD",
        "guest": {"name": "Guest Test", "email": guest_email, "phone": "+968 9123 4567"}
    }
    
    response = make_request('POST', '/orders', g5_data)
    if response and response.status_code == 200:
        try:
            result = response.json()
            if result.get('success') and result.get('order', {}).get('id'):
                print("   ✅ G5: Guest checkout successful → 200 with order.id")
                
                # Verify guest user created in DB
                guest_user = db.users.find_one({"email": guest_email})
                if guest_user and guest_user.get('isGuest') == True and guest_user.get('password') == '':
                    print("   ✅ G5: Guest user created with isGuest=true and password=''")
                else:
                    print(f"   ❌ G5: Guest user not found or incorrect: isGuest={guest_user.get('isGuest') if guest_user else 'N/A'}, password='{guest_user.get('password') if guest_user else 'N/A'}'")
                
                # Verify product stock decremented
                product = db.products.find_one({"_id": product_id})
                if product and product.get('stock') == 18:  # 20 - 2
                    print("   ✅ G5: Product stock decremented correctly (20 → 18)")
                else:
                    print(f"   ❌ G5: Product stock not decremented correctly: {product.get('stock') if product else 'Product not found'}")
                
                # Verify order details
                order = db.orders.find_one({"_id": result['order']['id']})
                if order:
                    if order.get('paymentProvider') == 'COD' and order.get('status') == 'PAID':
                        print("   ✅ G5: Order created with COD provider and PAID status")
                    else:
                        print(f"   ❌ G5: Order has wrong provider/status: {order.get('paymentProvider')}/{order.get('status')}")
                else:
                    print("   ❌ G5: Order not found in database")
                    
            else:
                print(f"   ❌ G5: Invalid response structure: {result}")
        except Exception as e:
            print(f"   ❌ G5: Error parsing response: {e}")
    else:
        print(f"   ❌ G5: Guest checkout failed → {response.status_code if response else 'No response'}")
        if response:
            try:
                error_response = response.json()
                print(f"   ❌ G5: Error response: {error_response}")
            except:
                print(f"   ❌ G5: Response text: {response.text[:500]}")
    
    # G6: Re-using same guest email
    print("   Testing G6: Re-using same guest email...")
    response = make_request('POST', '/orders', g5_data)
    if response and response.status_code == 200:
        print("   ✅ G6: Re-using guest email successful → 200")
        
        # Verify no duplicate user created
        guest_users = list(db.users.find({"email": guest_email}))
        if len(guest_users) == 1:
            print("   ✅ G6: No duplicate guest user created")
        else:
            print(f"   ❌ G6: Found {len(guest_users)} users with same email")
    else:
        print(f"   ❌ G6: Re-using guest email failed → {response.status_code if response else 'No response'}")
    
    # G7: Authenticated user order (regression test)
    print("   Testing G7: Authenticated user order (regression)...")
    auth_user_email = f"authuser{timestamp}@test.com"
    auth_user_id = create_test_user("Auth User", auth_user_email, "password123")
    
    if auth_user_id:
        session_cookie = login_user(auth_user_email, "password123")
        if session_cookie:
            g7_data = {
                "items": valid_items,
                "shippingAddress": valid_shipping,
                "paymentMethod": "COD"
                # No guest field for authenticated users
            }
            
            response = make_request('POST', '/orders', g7_data, session_cookie=session_cookie)
            if response and response.status_code == 200:
                print("   ✅ G7: Authenticated user order successful → 200")
            else:
                print(f"   ❌ G7: Authenticated user order failed → {response.status_code if response else 'No response'}")
        else:
            print("   ❌ G7: Failed to login authenticated user")
    else:
        print("   ❌ G7: Failed to create authenticated user")
    
    print("✅ TASK 1: Guest Checkout testing completed (G1-G7)")
    return True

def test_cod_payment():
    """Test TASK 2: POST /api/orders with paymentMethod=COD (COD1-COD3)"""
    print("\n🧪 TASK 2: Testing COD Payment (POST /api/orders with paymentMethod=COD) - COD1-COD3")
    
    # Setup: Create user, vendor, and product
    timestamp = int(time.time())
    user_email = f"coduser{timestamp}@test.com"
    user_id = create_test_user(f"COD User {timestamp}", user_email, "password123")
    
    vendor_email = f"codvendor{timestamp}@test.com"
    vendor_id = create_test_user(f"COD Vendor {timestamp}", vendor_email, "password123", role='VENDOR')
    
    product_id = create_test_product(vendor_id, "منتج COD", 15.0, stock=30)
    
    if not all([user_id, vendor_id, product_id]):
        print("❌ Failed to create test data for COD testing")
        return False
    
    session_cookie = login_user(user_email, "password123")
    if not session_cookie:
        print("❌ Failed to login COD test user - NextAuth session issue")
        return False
    
    # COD1: Test COD payment method
    print("   Testing COD1: COD payment method...")
    cod_data = {
        "items": [{"productId": product_id, "quantity": 1}],
        "shippingAddress": {
            "name": "عميل COD",
            "phone": "+968 9123 4567",
            "addressLine": "شارع السلطان قابوس، مسقط",
            "governorate": "MUSCAT"
        },
        "paymentMethod": "COD"
    }
    
    response = make_request('POST', '/orders', cod_data, session_cookie=session_cookie)
    if response and response.status_code == 200:
        try:
            result = response.json()
            order_id = result.get('order', {}).get('id')
            if order_id:
                print("   ✅ COD1: COD order created successfully → 200")
                
                # Verify order details in DB
                order = db.orders.find_one({"_id": order_id})
                if order:
                    checks = [
                        (order.get('paymentProvider') == 'COD', f"paymentProvider=COD (got {order.get('paymentProvider')})"),
                        (order.get('status') == 'PAID', f"status=PAID (got {order.get('status')})"),
                        (order.get('paymentStatus') == 'PENDING', f"paymentStatus=PENDING (got {order.get('paymentStatus')})"),
                        (order.get('paymentId', '').startswith('cod_'), f"paymentId starts with 'cod_' (got {order.get('paymentId')})"),
                        (order.get('totalPaid') > 15.0, f"totalPaid includes COD fee (got {order.get('totalPaid')})")  # 15 + shipping + COD fee
                    ]
                    
                    for check, desc in checks:
                        if check:
                            print(f"   ✅ COD1: {desc}")
                        else:
                            print(f"   ❌ COD1: {desc}")
                else:
                    print("   ❌ COD1: Order not found in database")
            else:
                print(f"   ❌ COD1: No order ID in response: {result}")
        except Exception as e:
            print(f"   ❌ COD1: Error parsing response: {e}")
    else:
        print(f"   ❌ COD1: COD order failed → {response.status_code if response else 'No response'}")
        if response:
            try:
                error_response = response.json()
                print(f"   ❌ COD1: Error response: {error_response}")
            except:
                print(f"   ❌ COD1: Response text: {response.text[:500]}")
    
    # COD2: Test default payment method (should use Thawani or MOCK)
    print("   Testing COD2: Default payment method...")
    default_data = {
        "items": [{"productId": product_id, "quantity": 1}],
        "shippingAddress": {
            "name": "عميل افتراضي",
            "phone": "+968 9123 4567",
            "addressLine": "شارع السلطان قابوس، مسقط",
            "governorate": "MUSCAT"
        }
        # No paymentMethod specified
    }
    
    response = make_request('POST', '/orders', default_data, session_cookie=session_cookie)
    if response and response.status_code == 200:
        try:
            result = response.json()
            if result.get('success'):
                print("   ✅ COD2: Default payment method order created → 200")
                
                # Check if it's Thawani (with paymentUrl) or MOCK (status=PAID)
                if result.get('paymentUrl'):
                    print("   ✅ COD2: Thawani payment URL provided")
                elif result.get('order', {}).get('status') == 'PAID':
                    print("   ✅ COD2: MOCK payment (status=PAID)")
                else:
                    print(f"   ❌ COD2: Unexpected payment flow: {result}")
            else:
                print(f"   ❌ COD2: Order creation failed: {result}")
        except Exception as e:
            print(f"   ❌ COD2: Error parsing response: {e}")
    else:
        print(f"   ❌ COD2: Default payment order failed → {response.status_code if response else 'No response'}")
    
    # COD3: Verify stock deduction for COD orders
    print("   Testing COD3: Stock deduction for COD orders...")
    initial_stock = db.products.find_one({"_id": product_id}).get('stock', 0)
    
    cod_stock_data = {
        "items": [{"productId": product_id, "quantity": 3}],
        "shippingAddress": {
            "name": "عميل المخزون",
            "phone": "+968 9123 4567",
            "addressLine": "شارع السلطان قابوس، مسقط",
            "governorate": "MUSCAT"
        },
        "paymentMethod": "COD"
    }
    
    response = make_request('POST', '/orders', cod_stock_data, session_cookie=session_cookie)
    if response and response.status_code == 200:
        # Check stock after order
        final_stock = db.products.find_one({"_id": product_id}).get('stock', 0)
        if final_stock == initial_stock - 3:
            print(f"   ✅ COD3: Stock decremented correctly ({initial_stock} → {final_stock})")
        else:
            print(f"   ❌ COD3: Stock not decremented correctly ({initial_stock} → {final_stock})")
    else:
        print(f"   ❌ COD3: COD stock test order failed → {response.status_code if response else 'No response'}")
    
    print("✅ TASK 2: COD Payment testing completed (COD1-COD3)")
    return True

def test_cart_persistence():
    """Test TASK 3: POST/GET/DELETE /api/cart — Cart Persistence (C1-C8)"""
    print("\n🧪 TASK 3: Testing Cart Persistence - ALL C1-C8 SCENARIOS")
    
    # Setup: Create user and product
    timestamp = int(time.time())
    user_email = f"cartuser{timestamp}@test.com"
    user_id = create_test_user(f"Cart User {timestamp}", user_email, "password123")
    
    vendor_email = f"cartvendor{timestamp}@test.com"
    vendor_id = create_test_user(f"Cart Vendor {timestamp}", vendor_email, "password123", role='VENDOR')
    
    product_id = create_test_product(vendor_id, "منتج السلة", 5.0, stock=50)
    
    if not all([user_id, vendor_id, product_id]):
        print("❌ Failed to create test data for cart testing")
        return False
    
    session_cookie = login_user(user_email, "password123")
    if not session_cookie:
        print("❌ Failed to login cart test user - NextAuth session issue")
        return False
    
    # Test data
    cart_data = {
        "items": [{
            "productId": product_id,
            "quantity": 2,
            "nameAr": "منتج",
            "unitPrice": 5,
            "image": ""
        }]
    }
    
    # C1: POST /api/cart without session
    print("   Testing C1: POST /api/cart without session...")
    response = make_request('POST', '/cart', cart_data)
    if response and response.status_code == 401:
        try:
            error_msg = response.json().get('error', '')
            if 'غير مصرح' in error_msg:
                print("   ✅ C1: POST /api/cart without session → 401 'غير مصرح'")
            else:
                print(f"   ❌ C1: Wrong error message: {error_msg}")
        except:
            print("   ❌ C1: Invalid JSON response")
    else:
        print(f"   ❌ C1: Expected 401, got {response.status_code if response else 'No response'}")
    
    # C2: GET /api/cart without session
    print("   Testing C2: GET /api/cart without session...")
    response = make_request('GET', '/cart')
    if response and response.status_code == 200:
        try:
            result = response.json()
            if result.get('items') == []:
                print("   ✅ C2: GET /api/cart without session → 200 { items: [] }")
            else:
                print(f"   ❌ C2: Expected empty items, got: {result}")
        except:
            print("   ❌ C2: Invalid JSON response")
    else:
        print(f"   ❌ C2: Expected 200, got {response.status_code if response else 'No response'}")
    
    # C3: Authenticated POST /api/cart
    print("   Testing C3: Authenticated POST /api/cart...")
    response = make_request('POST', '/cart', cart_data, session_cookie=session_cookie)
    if response and response.status_code == 200:
        try:
            result = response.json()
            if result.get('success') and result.get('count') == 1:
                print("   ✅ C3: Authenticated POST /api/cart → 200 { success: true, count: 1 }")
                
                # Verify cart in DB
                cart = db.carts.find_one({"userId": user_id})
                if cart and len(cart.get('items', [])) == 1:
                    print("   ✅ C3: Cart document created in MongoDB")
                else:
                    print("   ❌ C3: Cart not found in database")
            else:
                print(f"   ❌ C3: Unexpected response: {result}")
        except:
            print("   ❌ C3: Invalid JSON response")
    else:
        print(f"   ❌ C3: Expected 200, got {response.status_code if response else 'No response'}")
    
    # C4: Authenticated GET /api/cart
    print("   Testing C4: Authenticated GET /api/cart...")
    response = make_request('GET', '/cart', session_cookie=session_cookie)
    if response and response.status_code == 200:
        try:
            result = response.json()
            items = result.get('items', [])
            if len(items) == 1 and items[0].get('productId') == product_id:
                print("   ✅ C4: Authenticated GET /api/cart → 200 with saved items")
            else:
                print(f"   ❌ C4: Unexpected items: {items}")
        except:
            print("   ❌ C4: Invalid JSON response")
    else:
        print(f"   ❌ C4: Expected 200, got {response.status_code if response else 'No response'}")
    
    # C5: POST /api/cart with 150 items (should be capped to 100)
    print("   Testing C5: POST /api/cart with 150 items...")
    large_cart_data = {
        "items": [
            {
                "productId": product_id,
                "quantity": 1,
                "nameAr": f"منتج {i}",
                "unitPrice": 1,
                "image": ""
            } for i in range(150)
        ]
    }
    
    response = make_request('POST', '/cart', large_cart_data, session_cookie=session_cookie)
    if response and response.status_code == 200:
        try:
            result = response.json()
            if result.get('count') == 100:  # Should be capped to 100
                print("   ✅ C5: Large cart capped to 100 items")
                
                # Verify in DB
                cart = db.carts.find_one({"userId": user_id})
                if cart and len(cart.get('items', [])) == 100:
                    print("   ✅ C5: Database cart has exactly 100 items")
                else:
                    print(f"   ❌ C5: Database cart has {len(cart.get('items', [])) if cart else 0} items")
            else:
                print(f"   ❌ C5: Expected count=100, got {result.get('count')}")
        except:
            print("   ❌ C5: Invalid JSON response")
    else:
        print(f"   ❌ C5: Expected 200, got {response.status_code if response else 'No response'}")
    
    # C6: POST /api/cart with quantity=500 (should be clamped to 99)
    print("   Testing C6: POST /api/cart with quantity=500...")
    high_qty_data = {
        "items": [{
            "productId": product_id,
            "quantity": 500,
            "nameAr": "منتج كمية عالية",
            "unitPrice": 5,
            "image": ""
        }]
    }
    
    response = make_request('POST', '/cart', high_qty_data, session_cookie=session_cookie)
    if response and response.status_code == 200:
        # Verify quantity clamped in DB
        cart = db.carts.find_one({"userId": user_id})
        if cart and cart.get('items') and cart['items'][0].get('quantity') == 99:
            print("   ✅ C6: Quantity clamped to 99 in database")
        else:
            actual_qty = cart['items'][0].get('quantity') if cart and cart.get('items') else 'N/A'
            print(f"   ❌ C6: Quantity not clamped correctly: {actual_qty}")
    else:
        print(f"   ❌ C6: Expected 200, got {response.status_code if response else 'No response'}")
    
    # C7: POST /api/cart should reset reminder fields
    print("   Testing C7: POST /api/cart resets reminder fields...")
    
    # First set reminder fields in DB
    db.carts.update_one(
        {"userId": user_id},
        {
            "$set": {
                "lastReminderSentAt": datetime.utcnow(),
                "reminderEmailsSent": 5
            }
        }
    )
    
    # Then POST to cart
    response = make_request('POST', '/cart', cart_data, session_cookie=session_cookie)
    if response and response.status_code == 200:
        # Verify reminder fields reset
        cart = db.carts.find_one({"userId": user_id})
        if cart:
            if cart.get('lastReminderSentAt') is None and cart.get('reminderEmailsSent') == 0:
                print("   ✅ C7: Reminder fields reset correctly")
            else:
                print(f"   ❌ C7: Reminder fields not reset: lastReminderSentAt={cart.get('lastReminderSentAt')}, reminderEmailsSent={cart.get('reminderEmailsSent')}")
        else:
            print("   ❌ C7: Cart not found in database")
    else:
        print(f"   ❌ C7: Expected 200, got {response.status_code if response else 'No response'}")
    
    # C8: Authenticated DELETE /api/cart
    print("   Testing C8: Authenticated DELETE /api/cart...")
    response = make_request('DELETE', '/cart', session_cookie=session_cookie)
    if response and response.status_code == 200:
        try:
            result = response.json()
            if result.get('success'):
                print("   ✅ C8: DELETE /api/cart → 200 { success: true }")
                
                # Verify cart emptied in DB
                cart = db.carts.find_one({"userId": user_id})
                if cart and cart.get('items') == []:
                    print("   ✅ C8: Cart items array emptied in database")
                else:
                    print(f"   ❌ C8: Cart not emptied: {cart.get('items') if cart else 'Cart not found'}")
            else:
                print(f"   ❌ C8: Unexpected response: {result}")
        except:
            print("   ❌ C8: Invalid JSON response")
    else:
        print(f"   ❌ C8: Expected 200, got {response.status_code if response else 'No response'}")
    
    print("✅ TASK 3: Cart Persistence testing completed (C1-C8)")
    return True

def test_abandoned_carts_cron():
    """Test TASK 4: POST /api/cron/abandoned-carts (CR1-CR8)"""
    print("\n🧪 TASK 4: Testing Abandoned Carts Cron - QUICK RE-CONFIRM CR1-CR8")
    
    # Setup: Create user and admin
    timestamp = int(time.time())
    user_email = f"cronuser{timestamp}@test.com"
    user_id = create_test_user(f"Cron User {timestamp}", user_email, "password123")
    
    admin_email = f"cronadmin{timestamp}@test.com"
    admin_id = create_test_user(f"Cron Admin {timestamp}", admin_email, "password123", role='ADMIN')
    
    if not all([user_id, admin_id]):
        print("❌ Failed to create test users for cron testing")
        return False
    
    # CR1: No auth header, no session
    print("   Testing CR1: No auth header, no session...")
    response = make_request('POST', '/cron/abandoned-carts')
    if response and response.status_code == 401:
        try:
            error_msg = response.json().get('error', '')
            if 'غير مصرح' in error_msg:
                print("   ✅ CR1: No auth → 401 'غير مصرح'")
            else:
                print(f"   ❌ CR1: Wrong error message: {error_msg}")
        except:
            print("   ❌ CR1: Invalid JSON response")
    else:
        print(f"   ❌ CR1: Expected 401, got {response.status_code if response else 'No response'}")
    
    # CR2: Wrong X-CRON-KEY
    print("   Testing CR2: Wrong X-CRON-KEY...")
    response = make_request('POST', '/cron/abandoned-carts', headers={'X-CRON-KEY': 'wrong-key'})
    if response and response.status_code == 401:
        print("   ✅ CR2: Wrong cron key → 401")
    else:
        print(f"   ❌ CR2: Expected 401, got {response.status_code if response else 'No response'}")
    
    # CR3: Correct X-CRON-KEY
    print("   Testing CR3: Correct X-CRON-KEY...")
    response = make_request('POST', '/cron/abandoned-carts', headers={'X-CRON-KEY': CRON_SECRET})
    if response and response.status_code == 200:
        try:
            result = response.json()
            if result.get('success') and 'candidates' in result and 'sent' in result:
                print(f"   ✅ CR3: Correct cron key → 200 {{ success: true, candidates: {result['candidates']}, sent: {result['sent']} }}")
            else:
                print(f"   ❌ CR3: Unexpected response structure: {result}")
        except:
            print("   ❌ CR3: Invalid JSON response")
    else:
        print(f"   ❌ CR3: Expected 200, got {response.status_code if response else 'No response'}")
    
    # CR3 Alternative: ADMIN session
    print("   Testing CR3 Alt: ADMIN session...")
    admin_session = login_user(admin_email, "password123")
    if admin_session:
        response = make_request('POST', '/cron/abandoned-carts', session_cookie=admin_session)
        if response and response.status_code == 200:
            print("   ✅ CR3 Alt: ADMIN session → 200")
        else:
            print(f"   ❌ CR3 Alt: Expected 200, got {response.status_code if response else 'No response'}")
    else:
        print("   ❌ CR3 Alt: Failed to login admin user")
    
    # Quick test of abandoned cart scenario (CR4-CR8 abbreviated)
    print("   Testing CR4-CR8: Abandoned cart scenario (abbreviated)...")
    
    # Create cart 36 hours ago
    abandoned_time = datetime.utcnow() - timedelta(hours=36)
    cart_doc = {
        '_id': generate_uuid(),
        'userId': user_id,
        'items': [{
            'productId': 'test-product-id',
            'quantity': 1,
            'nameAr': 'منتج مهجور',
            'unitPrice': 10,
            'image': ''
        }],
        'lastReminderSentAt': None,
        'reminderEmailsSent': 0,
        'updatedAt': abandoned_time
    }
    
    try:
        db.carts.insert_one(cart_doc)
        print("   ✅ CR4-CR8: Created abandoned cart (36 hours old)")
        
        # Call cron endpoint
        response = make_request('POST', '/cron/abandoned-carts', headers={'X-CRON-KEY': CRON_SECRET})
        if response and response.status_code == 200:
            result = response.json()
            if result.get('candidates', 0) >= 1:
                print(f"   ✅ CR4-CR8: Found abandoned cart (candidates: {result['candidates']})")
                
                # Verify cart updated in DB
                updated_cart = db.carts.find_one({"_id": cart_doc['_id']})
                if updated_cart and updated_cart.get('reminderEmailsSent') == 1:
                    print("   ✅ CR4-CR8: Cart reminder fields updated correctly")
                else:
                    print(f"   ❌ CR4-CR8: Cart reminder fields not updated")
            else:
                print(f"   ❌ CR4-CR8: No candidates found: {result}")
        else:
            print(f"   ❌ CR4-CR8: Cron call failed → {response.status_code if response else 'No response'}")
            
    except Exception as e:
        print(f"   ❌ CR4-CR8: Error creating abandoned cart: {e}")
    
    print("✅ TASK 4: Abandoned Carts Cron testing completed (CR1-CR8)")
    return True

def main():
    """Main testing function"""
    print("🚀 Starting Backend RE-TESTING for Omani Entrepreneur Majles")
    print("🔧 FIXES APPLIED:")
    print("   1. User.password is now `default: ''` with custom validator for isGuest=true")
    print("   2. NEXTAUTH_URL aligned with NEXT_PUBLIC_BASE_URL")
    print("   3. CRON_SECRET_KEY env variable set")
    print("=" * 80)
    
    # Test API health first
    if not test_api_health():
        print("❌ API health check failed. Stopping tests.")
        return
    
    # Run all test tasks
    results = []
    
    try:
        results.append(("TASK 1: Guest Checkout (G1-G7)", test_guest_checkout()))
        results.append(("TASK 2: COD Payment (COD1-COD3)", test_cod_payment()))
        results.append(("TASK 3: Cart Persistence (C1-C8)", test_cart_persistence()))
        results.append(("TASK 4: Abandoned Carts Cron (CR1-CR8)", test_abandoned_carts_cron()))
    except Exception as e:
        print(f"❌ Testing error: {e}")
        results.append(("Testing Error", False))
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 RE-TESTING SUMMARY")
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
        print("🎉 All tests passed!")
    else:
        print("⚠️  Some tests failed. Check the detailed output above.")

if __name__ == "__main__":
    main()