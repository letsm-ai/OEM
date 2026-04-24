#!/usr/bin/env python3
"""
Focused Backend Testing for Guest Checkout and Cron Endpoints
"""

import requests
import json
import os
import time
import uuid
from datetime import datetime, timedelta
import pymongo
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/.env')

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://omani-startup-hub.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'majles')
CRON_SECRET = os.getenv('CRON_SECRET_KEY', 'fcb09a9f909c3ea848c026041b3b3d3069beba9da6848e56')

print(f"🔧 Configuration:")
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

def create_test_product(vendor_id, name_ar, price, stock=20):
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
        'isActive': True,
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

def test_guest_checkout():
    """Test Guest Checkout functionality"""
    print("\n🧪 Testing Guest Checkout (POST /api/orders)")
    
    # Setup: Create a vendor user and product directly in DB
    timestamp = int(time.time())
    vendor_id = generate_uuid()
    vendor_doc = {
        '_id': vendor_id,
        'name': f'Test Vendor {timestamp}',
        'email': f'vendor{timestamp}@test.com',
        'password': 'placeholder_password_hash',  # Use placeholder for testing
        'role': 'VENDOR',
        'membershipTier': 'FREE',
        'membershipExpiry': None,
        'phone': '',
        'photo': '',
        'wishlist': [],
        'isGuest': False,
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
        db.users.insert_one(vendor_doc)
        print(f"✅ Created vendor user: {vendor_doc['name']}")
    except Exception as e:
        print(f"❌ Failed to create vendor: {e}")
        return False
    
    # Create product
    product_id = create_test_product(vendor_id, "منتج تجريبي للضيف", 10.0, stock=20)
    if not product_id:
        return False
    
    # Test data
    valid_shipping = {
        "name": "عميل ضيف",
        "phone": "+968 9123 4567",
        "addressLine": "شارع السلطان قابوس، مسقط",
        "governorate": "MUSCAT"
    }
    
    valid_items = [{
        "productId": product_id,
        "quantity": 2
    }]
    
    # Test G1: Missing guest object
    print("   Testing G1: Missing guest object...")
    try:
        response = requests.post(
            f"{API_BASE}/orders",
            json={
                "items": valid_items,
                "shippingAddress": valid_shipping,
                "paymentMethod": "COD"
            },
            timeout=30
        )
        
        if response.status_code == 400:
            error_msg = response.json().get('error', '')
            if 'للشراء كضيف، الاسم والبريد الإلكتروني مطلوبان' in error_msg:
                print("   ✅ G1: Missing guest object → 400 with correct Arabic error")
            else:
                print(f"   ❌ G1: Wrong error message: {error_msg}")
        else:
            print(f"   ❌ G1: Expected 400, got {response.status_code}")
    except Exception as e:
        print(f"   ❌ G1: Request failed: {e}")
    
    # Test G3: Invalid email format
    print("   Testing G3: Invalid email format...")
    try:
        response = requests.post(
            f"{API_BASE}/orders",
            json={
                "items": valid_items,
                "shippingAddress": valid_shipping,
                "paymentMethod": "COD",
                "guest": {"name": "Guest Test", "email": "notanemail", "phone": "+968 9123 4567"}
            },
            timeout=30
        )
        
        if response.status_code == 400:
            error_msg = response.json().get('error', '')
            if 'صيغة البريد الإلكتروني غير صحيحة' in error_msg:
                print("   ✅ G3: Invalid email → 400 with correct Arabic error")
            else:
                print(f"   ❌ G3: Wrong error message: {error_msg}")
        else:
            print(f"   ❌ G3: Expected 400, got {response.status_code}")
    except Exception as e:
        print(f"   ❌ G3: Request failed: {e}")
    
    # Test G5: Happy path guest checkout
    print("   Testing G5: Happy path guest checkout...")
    guest_email = f"guest{timestamp}@example.com"
    try:
        response = requests.post(
            f"{API_BASE}/orders",
            json={
                "items": valid_items,
                "shippingAddress": valid_shipping,
                "paymentMethod": "COD",
                "guest": {"name": "Guest Test", "email": guest_email, "phone": "+968 9123 4567"}
            },
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success') and result.get('order', {}).get('id'):
                print("   ✅ G5: Guest checkout successful → 200 with order.id")
                
                # Verify guest user created in DB
                guest_user = db.users.find_one({"email": guest_email})
                if guest_user and guest_user.get('isGuest') == True:
                    print("   ✅ G5: Guest user created with isGuest=true")
                else:
                    print("   ❌ G5: Guest user not found or isGuest not set")
                
                # Verify product stock decremented
                product = db.products.find_one({"_id": product_id})
                if product and product.get('stock') == 18:  # 20 - 2
                    print("   ✅ G5: Product stock decremented correctly (20 → 18)")
                else:
                    print(f"   ❌ G5: Product stock not decremented correctly: {product.get('stock') if product else 'Product not found'}")
                
                return True
            else:
                print(f"   ❌ G5: Invalid response structure: {result}")
        else:
            print(f"   ❌ G5: Expected 200, got {response.status_code}")
            if response.text:
                print(f"   Response: {response.text}")
    except Exception as e:
        print(f"   ❌ G5: Request failed: {e}")
    
    return False

def test_cron_endpoint():
    """Test Abandoned Carts Cron endpoint"""
    print("\n🧪 Testing Abandoned Carts Cron (POST /api/cron/abandoned-carts)")
    
    # Test CR1: No auth header
    print("   Testing CR1: No auth header...")
    try:
        response = requests.post(f"{API_BASE}/cron/abandoned-carts", timeout=30)
        
        if response.status_code == 401:
            error_msg = response.json().get('error', '')
            if 'غير مصرح' in error_msg:
                print("   ✅ CR1: No auth → 401 'غير مصرح'")
            else:
                print(f"   ❌ CR1: Wrong error message: {error_msg}")
        else:
            print(f"   ❌ CR1: Expected 401, got {response.status_code}")
    except Exception as e:
        print(f"   ❌ CR1: Request failed: {e}")
    
    # Test CR2: Wrong X-CRON-KEY
    print("   Testing CR2: Wrong X-CRON-KEY...")
    try:
        response = requests.post(
            f"{API_BASE}/cron/abandoned-carts",
            headers={'X-CRON-KEY': 'wrong-key'},
            timeout=30
        )
        
        if response.status_code == 401:
            print("   ✅ CR2: Wrong cron key → 401")
        else:
            print(f"   ❌ CR2: Expected 401, got {response.status_code}")
    except Exception as e:
        print(f"   ❌ CR2: Request failed: {e}")
    
    # Test CR3: Correct X-CRON-KEY
    print("   Testing CR3: Correct X-CRON-KEY...")
    try:
        response = requests.post(
            f"{API_BASE}/cron/abandoned-carts",
            headers={'X-CRON-KEY': CRON_SECRET},
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success') and 'candidates' in result and 'sent' in result:
                print(f"   ✅ CR3: Correct cron key → 200 {{ success: true, candidates: {result['candidates']}, sent: {result['sent']} }}")
                return True
            else:
                print(f"   ❌ CR3: Unexpected response structure: {result}")
        else:
            print(f"   ❌ CR3: Expected 200, got {response.status_code}")
            if response.text:
                print(f"   Response: {response.text}")
    except Exception as e:
        print(f"   ❌ CR3: Request failed: {e}")
    
    return False

def test_cart_without_auth():
    """Test Cart endpoints without authentication"""
    print("\n🧪 Testing Cart Endpoints (No Auth)")
    
    # Test C1: POST /api/cart without session
    print("   Testing C1: POST /api/cart without session...")
    try:
        response = requests.post(
            f"{API_BASE}/cart",
            json={"items": [{"productId": "test", "quantity": 1, "nameAr": "test", "unitPrice": 1, "image": ""}]},
            timeout=30
        )
        
        if response.status_code == 401:
            error_msg = response.json().get('error', '')
            if 'غير مصرح' in error_msg:
                print("   ✅ C1: POST /api/cart without session → 401 'غير مصرح'")
            else:
                print(f"   ❌ C1: Wrong error message: {error_msg}")
        else:
            print(f"   ❌ C1: Expected 401, got {response.status_code}")
    except Exception as e:
        print(f"   ❌ C1: Request failed: {e}")
    
    # Test C2: GET /api/cart without session
    print("   Testing C2: GET /api/cart without session...")
    try:
        response = requests.get(f"{API_BASE}/cart", timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            if result.get('items') == []:
                print("   ✅ C2: GET /api/cart without session → 200 { items: [] }")
                return True
            else:
                print(f"   ❌ C2: Expected empty items, got: {result}")
        else:
            print(f"   ❌ C2: Expected 200, got {response.status_code}")
    except Exception as e:
        print(f"   ❌ C2: Request failed: {e}")
    
    return False

def main():
    """Main testing function"""
    print("🚀 Starting Focused Backend Testing")
    print("=" * 60)
    
    # Test API health
    try:
        response = requests.get(f"{API_BASE}", timeout=30)
        if response.status_code == 200:
            print("✅ API Health Check: GET /api → 200")
        else:
            print(f"❌ API Health Check failed: {response.status_code}")
            return
    except Exception as e:
        print(f"❌ API Health Check failed: {e}")
        return
    
    # Run focused tests
    results = []
    
    try:
        results.append(("Guest Checkout", test_guest_checkout()))
        results.append(("Cron Endpoint", test_cron_endpoint()))
        results.append(("Cart (No Auth)", test_cart_without_auth()))
    except Exception as e:
        print(f"❌ Testing error: {e}")
        results.append(("Testing Error", False))
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TESTING SUMMARY")
    print("=" * 60)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {test_name}")
        if result:
            passed += 1
    
    print(f"\nOverall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")

if __name__ == "__main__":
    main()