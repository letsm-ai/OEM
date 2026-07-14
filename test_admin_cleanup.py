#!/usr/bin/env python3
"""
Admin Cleanup Endpoints Testing
Tests the new individual browse + delete endpoints in the Admin Cleanup panel
"""

import requests
import json
import time
import os
from datetime import datetime
from pymongo import MongoClient
from bson import ObjectId
import uuid

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://omani-startup-hub.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017/majles')
DB_NAME = os.getenv('DB_NAME', 'majles')

# Admin credentials
ADMIN_EMAIL = "mazin298@gmail.com"
ADMIN_PASSWORD = "Password123"

# MongoDB connection
mongo_client = MongoClient(MONGO_URL)
db = mongo_client[DB_NAME]

print("=" * 80)
print("ADMIN CLEANUP ENDPOINTS TESTING")
print("=" * 80)
print(f"API Base URL: {API_BASE}")
print(f"MongoDB: {MONGO_URL}/{DB_NAME}")
print(f"Test started at: {datetime.now().isoformat()}")
print("=" * 80)

# Test counters
total_tests = 0
passed_tests = 0
failed_tests = 0

def test_result(name, passed, details=""):
    global total_tests, passed_tests, failed_tests
    total_tests += 1
    if passed:
        passed_tests += 1
        print(f"✅ TEST {total_tests}: {name}")
    else:
        failed_tests += 1
        print(f"❌ TEST {total_tests}: {name}")
    if details:
        print(f"   {details}")
    print()

def login(email, password):
    """Login and return session cookies"""
    session = requests.Session()
    
    # Get CSRF token
    csrf_resp = session.get(f"{BASE_URL}/api/auth/csrf")
    csrf_token = csrf_resp.json().get('csrfToken')
    
    # Login
    login_resp = session.post(
        f"{BASE_URL}/api/auth/callback/credentials",
        data={
            'email': email,
            'password': password,
            'csrfToken': csrf_token,
            'json': 'true'
        },
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
        allow_redirects=False
    )
    
    return session

def create_member_session():
    """Create a MEMBER user and return session"""
    test_email = f"member_test_{int(time.time())}@example.com"
    test_password = "TestPass123"
    
    # Create user via signup
    resp = requests.post(
        f"{API_BASE}/signup",
        json={
            'name': 'Member Test User',
            'email': test_email,
            'password': test_password
        }
    )
    
    if resp.status_code == 200:
        # Login as member
        return login(test_email, test_password), test_email
    return None, None

# =============================================================================
# SECTION A: BROWSE ENDPOINT TESTS - GET /api/admin/cleanup/browse
# =============================================================================
print("\n" + "=" * 80)
print("SECTION A: BROWSE ENDPOINT - GET /api/admin/cleanup/browse")
print("=" * 80)

# Login as admin
admin_session = login(ADMIN_EMAIL, ADMIN_PASSWORD)

# A1: Users list
print("\nA1: Users list - ?type=users&page=1&limit=20")
try:
    resp = admin_session.get(
        f"{API_BASE}/admin/cleanup/browse",
        params={'type': 'users', 'page': 1, 'limit': 20}
    )
    data = resp.json()
    
    if resp.status_code == 200:
        # Verify response shape
        required_fields = ['type', 'total', 'page', 'limit', 'pages', 'items']
        has_all_fields = all(field in data for field in required_fields)
        
        if has_all_fields and data['type'] == 'users':
            # Verify items structure
            if len(data['items']) > 0:
                first_item = data['items'][0]
                item_fields = ['id', 'email', 'name', 'role', 'tier', 'phone', 'createdAt', 'refs', 'isSelf']
                has_item_fields = all(field in first_item for field in item_fields)
                
                # Check for admin user with isSelf=true
                admin_user = next((u for u in data['items'] if u['email'] == ADMIN_EMAIL), None)
                
                if has_item_fields and admin_user and admin_user.get('isSelf') == True:
                    test_result(
                        "Browse users list",
                        True,
                        f"Found {data['total']} users, page {data['page']}/{data['pages']}, admin has isSelf=true"
                    )
                else:
                    test_result(
                        "Browse users list",
                        False,
                        f"Missing item fields or admin isSelf not true. admin_user={admin_user}"
                    )
            else:
                test_result(
                    "Browse users list",
                    False,
                    f"No items returned. Data: {data}"
                )
        else:
            test_result(
                "Browse users list",
                False,
                f"Missing fields or type not 'users'. Data: {data}"
            )
    else:
        test_result(
            "Browse users list",
            False,
            f"Expected 200, got {resp.status_code}: {data}"
        )
except Exception as e:
    test_result("Browse users list", False, f"Exception: {e}")

# A2: Companies list
print("\nA2: Companies list - ?type=companies&page=1&limit=20")
try:
    resp = admin_session.get(
        f"{API_BASE}/admin/cleanup/browse",
        params={'type': 'companies', 'page': 1, 'limit': 20}
    )
    data = resp.json()
    
    if resp.status_code == 200:
        if data['type'] == 'companies':
            # Verify items structure
            if len(data['items']) > 0:
                first_item = data['items'][0]
                item_fields = ['id', 'nameAr', 'nameEn', 'sector', 'governorate', 'ownerId', 'featured', 'verified', 'logo', 'createdAt']
                has_item_fields = all(field in first_item for field in item_fields)
                
                if has_item_fields:
                    test_result(
                        "Browse companies list",
                        True,
                        f"Found {data['total']} companies (expected ~76), page {data['page']}/{data['pages']}"
                    )
                else:
                    test_result(
                        "Browse companies list",
                        False,
                        f"Missing item fields. first_item keys: {first_item.keys()}"
                    )
            else:
                test_result(
                    "Browse companies list",
                    True,
                    f"No companies in DB (total={data['total']})"
                )
        else:
            test_result(
                "Browse companies list",
                False,
                f"Type not 'companies'. Data: {data}"
            )
    else:
        test_result(
            "Browse companies list",
            False,
            f"Expected 200, got {resp.status_code}: {data}"
        )
except Exception as e:
    test_result("Browse companies list", False, f"Exception: {e}")

# A3: Experts list
print("\nA3: Experts list - ?type=experts&page=1&limit=20")
try:
    resp = admin_session.get(
        f"{API_BASE}/admin/cleanup/browse",
        params={'type': 'experts', 'page': 1, 'limit': 20}
    )
    data = resp.json()
    
    if resp.status_code == 200:
        if data['type'] == 'experts':
            # Verify items structure
            if len(data['items']) > 0:
                first_item = data['items'][0]
                item_fields = ['id', 'nameAr', 'nameEn', 'specialty', 'userId', 'featured', 'photo', 'hourlyRate', 'createdAt', 'refs']
                has_item_fields = all(field in first_item for field in item_fields)
                
                if has_item_fields and 'bookings' in first_item['refs']:
                    test_result(
                        "Browse experts list",
                        True,
                        f"Found {data['total']} experts, page {data['page']}/{data['pages']}"
                    )
                else:
                    test_result(
                        "Browse experts list",
                        False,
                        f"Missing item fields. first_item keys: {first_item.keys()}"
                    )
            else:
                test_result(
                    "Browse experts list",
                    True,
                    f"No experts in DB (total={data['total']})"
                )
        else:
            test_result(
                "Browse experts list",
                False,
                f"Type not 'experts'. Data: {data}"
            )
    else:
        test_result(
            "Browse experts list",
            False,
            f"Expected 200, got {resp.status_code}: {data}"
        )
except Exception as e:
    test_result("Browse experts list", False, f"Exception: {e}")

# A4: Products list
print("\nA4: Products list - ?type=products&page=1&limit=20")
try:
    resp = admin_session.get(
        f"{API_BASE}/admin/cleanup/browse",
        params={'type': 'products', 'page': 1, 'limit': 20}
    )
    data = resp.json()
    
    if resp.status_code == 200:
        if data['type'] == 'products':
            # Verify items structure
            if len(data['items']) > 0:
                first_item = data['items'][0]
                item_fields = ['id', 'nameAr', 'nameEn', 'price', 'stock', 'vendorId', 'featured', 'status', 'image', 'createdAt', 'refs']
                has_item_fields = all(field in first_item for field in item_fields)
                
                if has_item_fields and 'orderedTimes' in first_item['refs'] and 'reviews' in first_item['refs']:
                    test_result(
                        "Browse products list",
                        True,
                        f"Found {data['total']} products, page {data['page']}/{data['pages']}"
                    )
                else:
                    test_result(
                        "Browse products list",
                        False,
                        f"Missing item fields. first_item keys: {first_item.keys()}"
                    )
            else:
                test_result(
                    "Browse products list",
                    True,
                    f"No products in DB (total={data['total']})"
                )
        else:
            test_result(
                "Browse products list",
                False,
                f"Type not 'products'. Data: {data}"
            )
    else:
        test_result(
            "Browse products list",
            False,
            f"Expected 200, got {resp.status_code}: {data}"
        )
except Exception as e:
    test_result("Browse products list", False, f"Exception: {e}")

# A5: Invalid type
print("\nA5: Invalid type - ?type=INVALID")
try:
    resp = admin_session.get(
        f"{API_BASE}/admin/cleanup/browse",
        params={'type': 'INVALID'}
    )
    data = resp.json()
    
    if resp.status_code == 400 and data.get('error') == 'INVALID_TYPE':
        test_result(
            "Browse invalid type",
            True,
            f"Correctly rejected: {data.get('message')}"
        )
    else:
        test_result(
            "Browse invalid type",
            False,
            f"Expected 400 with INVALID_TYPE, got {resp.status_code}: {data}"
        )
except Exception as e:
    test_result("Browse invalid type", False, f"Exception: {e}")

# A6: Search filter
print("\nA6: Search filter - ?type=users&q=mazin")
try:
    resp = admin_session.get(
        f"{API_BASE}/admin/cleanup/browse",
        params={'type': 'users', 'q': 'mazin'}
    )
    data = resp.json()
    
    if resp.status_code == 200:
        # Should include at least one user with 'mazin' in email/name
        mazin_user = next((u for u in data['items'] if 'mazin' in u['email'].lower() or 'mazin' in u['name'].lower()), None)
        
        if mazin_user:
            test_result(
                "Browse search filter",
                True,
                f"Found user with 'mazin': {mazin_user['email']}"
            )
        else:
            test_result(
                "Browse search filter",
                False,
                f"No user with 'mazin' found. Items: {[u['email'] for u in data['items']]}"
            )
    else:
        test_result(
            "Browse search filter",
            False,
            f"Expected 200, got {resp.status_code}: {data}"
        )
except Exception as e:
    test_result("Browse search filter", False, f"Exception: {e}")

# A7: Pagination
print("\nA7: Pagination - ?type=companies&page=2&limit=10")
try:
    resp = admin_session.get(
        f"{API_BASE}/admin/cleanup/browse",
        params={'type': 'companies', 'page': 2, 'limit': 10}
    )
    data = resp.json()
    
    if resp.status_code == 200:
        if data['page'] == 2 and data['limit'] == 10:
            test_result(
                "Browse pagination",
                True,
                f"Page 2 returned correctly, total={data['total']}, pages={data['pages']}"
            )
        else:
            test_result(
                "Browse pagination",
                False,
                f"Page or limit mismatch. Data: {data}"
            )
    else:
        test_result(
            "Browse pagination",
            False,
            f"Expected 200, got {resp.status_code}: {data}"
        )
except Exception as e:
    test_result("Browse pagination", False, f"Exception: {e}")

# =============================================================================
# SECTION B: DELETE ENDPOINT TESTS - DELETE /api/admin/cleanup/entity
# =============================================================================
print("\n" + "=" * 80)
print("SECTION B: DELETE ENDPOINT - DELETE /api/admin/cleanup/entity")
print("=" * 80)

# B1: Missing confirm
print("\nB1: Missing confirm")
try:
    resp = admin_session.delete(
        f"{API_BASE}/admin/cleanup/entity",
        json={'type': 'users', 'id': str(ObjectId())}
    )
    data = resp.json()
    
    if resp.status_code == 400 and data.get('error') == 'MISSING_CONFIRM':
        test_result(
            "Delete missing confirm",
            True,
            f"Correctly rejected: {data.get('message')}"
        )
    else:
        test_result(
            "Delete missing confirm",
            False,
            f"Expected 400 with MISSING_CONFIRM, got {resp.status_code}: {data}"
        )
except Exception as e:
    test_result("Delete missing confirm", False, f"Exception: {e}")

# B2: Invalid type
print("\nB2: Invalid type")
try:
    resp = admin_session.delete(
        f"{API_BASE}/admin/cleanup/entity",
        json={'type': 'BAD', 'id': str(ObjectId()), 'confirm': 'DELETE-ENTITY'}
    )
    data = resp.json()
    
    if resp.status_code == 400 and data.get('error') == 'INVALID_TYPE':
        test_result(
            "Delete invalid type",
            True,
            f"Correctly rejected: {data.get('message')}"
        )
    else:
        test_result(
            "Delete invalid type",
            False,
            f"Expected 400 with INVALID_TYPE, got {resp.status_code}: {data}"
        )
except Exception as e:
    test_result("Delete invalid type", False, f"Exception: {e}")

# B3: Invalid id (not a valid ObjectId)
print("\nB3: Invalid id (not a valid ObjectId)")
try:
    resp = admin_session.delete(
        f"{API_BASE}/admin/cleanup/entity",
        json={'type': 'users', 'id': 'notavalidobjectid', 'confirm': 'DELETE-ENTITY'}
    )
    data = resp.json()
    
    if resp.status_code == 400 and data.get('error') == 'INVALID_ID':
        test_result(
            "Delete invalid id",
            True,
            f"Correctly rejected: {data.get('message')}"
        )
    else:
        test_result(
            "Delete invalid id",
            False,
            f"Expected 400 with INVALID_ID, got {resp.status_code}: {data}"
        )
except Exception as e:
    test_result("Delete invalid id", False, f"Exception: {e}")

# B4: Cannot delete self
print("\nB4: Cannot delete self")
try:
    # Get admin's user id from /api/me
    me_resp = admin_session.get(f"{API_BASE}/me")
    me_data = me_resp.json()
    admin_id = me_data.get('id')
    
    if admin_id:
        resp = admin_session.delete(
            f"{API_BASE}/admin/cleanup/entity",
            json={'type': 'users', 'id': admin_id, 'confirm': 'DELETE-ENTITY'}
        )
        data = resp.json()
        
        if resp.status_code == 400 and data.get('error') == 'CANNOT_DELETE_SELF':
            test_result(
                "Delete cannot delete self",
                True,
                f"Correctly rejected: {data.get('message')}"
            )
        else:
            test_result(
                "Delete cannot delete self",
                False,
                f"Expected 400 with CANNOT_DELETE_SELF, got {resp.status_code}: {data}"
            )
    else:
        test_result(
            "Delete cannot delete self",
            False,
            f"Failed to get admin id from /api/me"
        )
except Exception as e:
    test_result("Delete cannot delete self", False, f"Exception: {e}")

# B5: Delete an entity (happy path - Company)
print("\nB5: Delete an entity (happy path - Company)")
try:
    # Create a throwaway Company
    throwaway_company = {
        '_id': str(uuid.uuid4()),
        'nameAr': 'شركة الحذف التجريبي',
        'sector': 'TECH',
        'governorate': 'مسقط',
        'ownerId': str(uuid.uuid4()),
        'createdAt': datetime.utcnow()
    }
    db.companies.insert_one(throwaway_company)
    company_id = throwaway_company['_id']
    print(f"✓ Created throwaway company: {company_id}")
    
    # Delete via API
    resp = admin_session.delete(
        f"{API_BASE}/admin/cleanup/entity",
        json={'type': 'companies', 'id': company_id, 'confirm': 'DELETE-ENTITY'}
    )
    data = resp.json()
    
    if resp.status_code == 200:
        if data.get('success') == True and 'الحذف' in data.get('message', ''):
            # Verify deletion
            deleted_company = db.companies.find_one({'_id': company_id})
            
            if deleted_company is None:
                test_result(
                    "Delete company (happy path)",
                    True,
                    f"Company deleted successfully: {data.get('message')}, deleted counts: {data.get('deleted')}"
                )
            else:
                test_result(
                    "Delete company (happy path)",
                    False,
                    f"Company still exists in DB after deletion"
                )
        else:
            test_result(
                "Delete company (happy path)",
                False,
                f"Success not true or message missing 'الحذف'. Data: {data}"
            )
    else:
        test_result(
            "Delete company (happy path)",
            False,
            f"Expected 200, got {resp.status_code}: {data}"
        )
except Exception as e:
    test_result("Delete company (happy path)", False, f"Exception: {e}")

# B6: Delete non-existent
print("\nB6: Delete non-existent")
try:
    non_existent_id = str(uuid.uuid4())
    
    resp = admin_session.delete(
        f"{API_BASE}/admin/cleanup/entity",
        json={'type': 'companies', 'id': non_existent_id, 'confirm': 'DELETE-ENTITY'}
    )
    data = resp.json()
    
    if resp.status_code == 404 and data.get('error') == 'NOT_FOUND':
        test_result(
            "Delete non-existent",
            True,
            f"Correctly returned 404"
        )
    else:
        test_result(
            "Delete non-existent",
            False,
            f"Expected 404 with NOT_FOUND, got {resp.status_code}: {data}"
        )
except Exception as e:
    test_result("Delete non-existent", False, f"Exception: {e}")

# B7: Delete a Product (happy path)
print("\nB7: Delete a Product (happy path)")
try:
    # Create a throwaway Product
    throwaway_product = {
        '_id': str(uuid.uuid4()),
        'nameAr': 'منتج الحذف التجريبي 12345',
        'price': 10,
        'stock': 5,
        'vendorId': str(uuid.uuid4()),
        'createdAt': datetime.utcnow()
    }
    db.products.insert_one(throwaway_product)
    product_id = throwaway_product['_id']
    print(f"✓ Created throwaway product: {product_id}")
    
    # Delete via API
    resp = admin_session.delete(
        f"{API_BASE}/admin/cleanup/entity",
        json={'type': 'products', 'id': product_id, 'confirm': 'DELETE-ENTITY'}
    )
    data = resp.json()
    
    if resp.status_code == 200:
        if data.get('success') == True and data.get('deleted', {}).get('products') == 1:
            # Verify deletion
            deleted_product = db.products.find_one({'_id': product_id})
            
            if deleted_product is None:
                test_result(
                    "Delete product (happy path)",
                    True,
                    f"Product deleted successfully: deleted.products={data.get('deleted', {}).get('products')}"
                )
            else:
                test_result(
                    "Delete product (happy path)",
                    False,
                    f"Product still exists in DB after deletion"
                )
        else:
            test_result(
                "Delete product (happy path)",
                False,
                f"Success not true or deleted.products != 1. Data: {data}"
            )
    else:
        test_result(
            "Delete product (happy path)",
            False,
            f"Expected 200, got {resp.status_code}: {data}"
        )
except Exception as e:
    test_result("Delete product (happy path)", False, f"Exception: {e}")

# B8: Delete an Expert (happy path)
print("\nB8: Delete an Expert (happy path)")
try:
    # Create a throwaway Expert
    throwaway_expert = {
        '_id': str(uuid.uuid4()),
        'nameAr': 'خبير الحذف التجريبي',
        'specialtyAr': 'استشارات قانونية',
        'userId': str(uuid.uuid4()),
        'hourlyRate': 25,
        'createdAt': datetime.utcnow()
    }
    db.experts.insert_one(throwaway_expert)
    expert_id = throwaway_expert['_id']
    print(f"✓ Created throwaway expert: {expert_id}")
    
    # Delete via API
    resp = admin_session.delete(
        f"{API_BASE}/admin/cleanup/entity",
        json={'type': 'experts', 'id': expert_id, 'confirm': 'DELETE-ENTITY'}
    )
    data = resp.json()
    
    if resp.status_code == 200:
        if data.get('success') == True and data.get('deleted', {}).get('experts') == 1:
            # Verify deletion
            deleted_expert = db.experts.find_one({'_id': expert_id})
            
            if deleted_expert is None:
                test_result(
                    "Delete expert (happy path)",
                    True,
                    f"Expert deleted successfully: deleted.experts={data.get('deleted', {}).get('experts')}"
                )
            else:
                test_result(
                    "Delete expert (happy path)",
                    False,
                    f"Expert still exists in DB after deletion"
                )
        else:
            test_result(
                "Delete expert (happy path)",
                False,
                f"Success not true or deleted.experts != 1. Data: {data}"
            )
    else:
        test_result(
            "Delete expert (happy path)",
            False,
            f"Expected 200, got {resp.status_code}: {data}"
        )
except Exception as e:
    test_result("Delete expert (happy path)", False, f"Exception: {e}")

# =============================================================================
# SECTION C: AUTH CHECKS
# =============================================================================
print("\n" + "=" * 80)
print("SECTION C: AUTH CHECKS")
print("=" * 80)

# C1: Browse without session cookie
print("\nC1: Browse without session cookie")
try:
    resp = requests.get(
        f"{API_BASE}/admin/cleanup/browse",
        params={'type': 'users'}
    )
    data = resp.json()
    
    if resp.status_code == 401 and data.get('error') == 'UNAUTHORIZED':
        test_result(
            "Browse without auth",
            True,
            f"Correctly rejected: {data.get('error')}"
        )
    else:
        test_result(
            "Browse without auth",
            False,
            f"Expected 401 with UNAUTHORIZED, got {resp.status_code}: {data}"
        )
except Exception as e:
    test_result("Browse without auth", False, f"Exception: {e}")

# C2: Delete without session cookie
print("\nC2: Delete without session cookie")
try:
    resp = requests.delete(
        f"{API_BASE}/admin/cleanup/entity",
        json={'type': 'companies', 'id': str(uuid.uuid4()), 'confirm': 'DELETE-ENTITY'}
    )
    data = resp.json()
    
    if resp.status_code == 401 and data.get('error') == 'UNAUTHORIZED':
        test_result(
            "Delete without auth",
            True,
            f"Correctly rejected: {data.get('error')}"
        )
    else:
        test_result(
            "Delete without auth",
            False,
            f"Expected 401 with UNAUTHORIZED, got {resp.status_code}: {data}"
        )
except Exception as e:
    test_result("Delete without auth", False, f"Exception: {e}")

# C3: Browse with non-admin (MEMBER) session
print("\nC3: Browse with non-admin (MEMBER) session")
try:
    member_session, member_email = create_member_session()
    
    if member_session:
        resp = member_session.get(
            f"{API_BASE}/admin/cleanup/browse",
            params={'type': 'users'}
        )
        data = resp.json()
        
        if resp.status_code == 403 and data.get('error') == 'FORBIDDEN':
            test_result(
                "Browse with MEMBER session",
                True,
                f"Correctly rejected: {data.get('error')}"
            )
        else:
            test_result(
                "Browse with MEMBER session",
                False,
                f"Expected 403 with FORBIDDEN, got {resp.status_code}: {data}"
            )
        
        # Cleanup member user
        user = db.users.find_one({'email': member_email})
        if user:
            db.users.delete_one({'_id': user['_id']})
            print(f"✓ Cleaned up member user: {member_email}")
    else:
        test_result(
            "Browse with MEMBER session",
            False,
            f"Failed to create member session"
        )
except Exception as e:
    test_result("Browse with MEMBER session", False, f"Exception: {e}")

# C4: Delete with non-admin (MEMBER) session
print("\nC4: Delete with non-admin (MEMBER) session")
try:
    member_session, member_email = create_member_session()
    
    if member_session:
        resp = member_session.delete(
            f"{API_BASE}/admin/cleanup/entity",
            json={'type': 'companies', 'id': str(uuid.uuid4()), 'confirm': 'DELETE-ENTITY'}
        )
        data = resp.json()
        
        if resp.status_code == 403 and data.get('error') == 'FORBIDDEN':
            test_result(
                "Delete with MEMBER session",
                True,
                f"Correctly rejected: {data.get('error')}"
            )
        else:
            test_result(
                "Delete with MEMBER session",
                False,
                f"Expected 403 with FORBIDDEN, got {resp.status_code}: {data}"
            )
        
        # Cleanup member user
        user = db.users.find_one({'email': member_email})
        if user:
            db.users.delete_one({'_id': user['_id']})
            print(f"✓ Cleaned up member user: {member_email}")
    else:
        test_result(
            "Delete with MEMBER session",
            False,
            f"Failed to create member session"
        )
except Exception as e:
    test_result("Delete with MEMBER session", False, f"Exception: {e}")

# =============================================================================
# SUMMARY
# =============================================================================
print("\n" + "=" * 80)
print("TEST SUMMARY")
print("=" * 80)
print(f"Total Tests: {total_tests}")
print(f"Passed: {passed_tests} ✅")
print(f"Failed: {failed_tests} ❌")
print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
print("=" * 80)

if failed_tests == 0:
    print("\n🎉 ALL TESTS PASSED!")
else:
    print(f"\n⚠️  {failed_tests} TEST(S) FAILED")

print(f"\nTest completed at: {datetime.now().isoformat()}")
