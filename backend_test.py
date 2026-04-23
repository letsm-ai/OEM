#!/usr/bin/env python3
"""
Backend testing for Profile Settings endpoints on مجلس رواد الأعمال العماني Next.js app.

Tests the following endpoints:
1. GET /api/me (regression - should now include phone and photo)
2. PUT /api/me (profile update)
3. POST /api/me/change-password (change password)
4. DELETE /api/me (delete account)
"""

import requests
import json
import time
import pymongo
import bcrypt
from datetime import datetime, timedelta
import uuid

# Configuration
BASE_URL = "https://omani-startup-hub.preview.emergentagent.com/api"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "majles"

def get_mongo_client():
    """Get MongoDB client"""
    return pymongo.MongoClient(MONGO_URL)

def create_test_user(email, password, name="Test User", role="MEMBER"):
    """Create a test user directly in MongoDB"""
    client = get_mongo_client()
    db = client[DB_NAME]
    users = db.users
    
    # Hash password
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "_id": user_id,
        "name": name,
        "email": email.lower().strip(),
        "password": hashed_password,
        "role": role,
        "membershipTier": "FREE",
        "membershipExpiry": None,
        "phone": "",
        "photo": "",
        "createdAt": datetime.utcnow()
    }
    
    try:
        users.insert_one(user_doc)
        print(f"✅ Created test user: {email} with ID: {user_id}")
        return user_id
    except pymongo.errors.DuplicateKeyError:
        print(f"⚠️ User {email} already exists")
        existing = users.find_one({"email": email})
        return existing["_id"] if existing else None
    finally:
        client.close()

def login_user(email, password):
    """Login user and get session cookie"""
    # First get CSRF token
    csrf_response = requests.get(f"{BASE_URL}/auth/csrf")
    if csrf_response.status_code != 200:
        print(f"❌ Failed to get CSRF token: {csrf_response.status_code}")
        return None
    
    csrf_token = csrf_response.json().get('csrfToken')
    
    # Login with credentials
    login_data = {
        'email': email,
        'password': password,
        'csrfToken': csrf_token,
        'callbackUrl': f"{BASE_URL.replace('/api', '')}/dashboard",
        'json': 'true'
    }
    
    login_response = requests.post(
        f"{BASE_URL}/auth/callback/credentials",
        data=login_data,
        cookies=csrf_response.cookies,
        allow_redirects=False
    )
    
    if login_response.status_code == 200:
        # Extract session cookie
        session_cookies = {}
        for cookie in login_response.cookies:
            if 'session-token' in cookie.name or 'next-auth' in cookie.name:
                session_cookies[cookie.name] = cookie.value
        
        if session_cookies:
            print(f"✅ Login successful for {email}")
            return session_cookies
    
    print(f"❌ Login failed for {email}: {login_response.status_code}")
    return None

def seed_password_reset_token(user_id):
    """Seed a password reset token for testing"""
    client = get_mongo_client()
    db = client[DB_NAME]
    tokens = db.passwordresettokens
    
    token_id = str(uuid.uuid4())
    token_doc = {
        "_id": token_id,
        "userId": user_id,
        "tokenHash": "test_token_hash_" + str(uuid.uuid4()).replace('-', ''),
        "expiresAt": datetime.utcnow() + timedelta(hours=1),
        "usedAt": None,
        "createdAt": datetime.utcnow()
    }
    
    try:
        tokens.insert_one(token_doc)
        print(f"✅ Seeded password reset token for user {user_id}")
        return token_id
    finally:
        client.close()

def check_password_reset_token_used(user_id):
    """Check if password reset tokens are marked as used"""
    client = get_mongo_client()
    db = client[DB_NAME]
    tokens = db.passwordresettokens
    
    try:
        unused_tokens = list(tokens.find({"userId": user_id, "usedAt": None}))
        used_tokens = list(tokens.find({"userId": user_id, "usedAt": {"$ne": None}}))
        print(f"📊 User {user_id} - Unused tokens: {len(unused_tokens)}, Used tokens: {len(used_tokens)}")
        return len(unused_tokens) == 0
    finally:
        client.close()

def promote_user_to_admin(user_id):
    """Promote user to ADMIN role"""
    client = get_mongo_client()
    db = client[DB_NAME]
    users = db.users
    
    try:
        result = users.update_one(
            {"_id": user_id},
            {"$set": {"role": "ADMIN"}}
        )
        if result.modified_count > 0:
            print(f"✅ Promoted user {user_id} to ADMIN")
            return True
        return False
    finally:
        client.close()

def seed_test_data_for_deletion(user_id):
    """Seed test data for account deletion testing"""
    client = get_mongo_client()
    db = client[DB_NAME]
    
    # Create another user for appointments
    other_user_id = str(uuid.uuid4())
    other_user_doc = {
        "_id": other_user_id,
        "name": "Other User",
        "email": f"other_{int(time.time())}@test.com",
        "password": bcrypt.hashpw("password123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
        "role": "MEMBER",
        "membershipTier": "FREE",
        "phone": "",
        "photo": "",
        "createdAt": datetime.utcnow()
    }
    db.users.insert_one(other_user_doc)
    
    # Create Expert record for the user
    expert_id = str(uuid.uuid4())
    expert_doc = {
        "_id": expert_id,
        "userId": user_id,
        "specialtyAr": "استشارات قانونية",
        "specialty": "LEGAL",
        "hourlyRate": 25,
        "status": "APPROVED",
        "rating": 0,
        "totalSessions": 0,
        "createdAt": datetime.utcnow()
    }
    db.experts.insert_one(expert_doc)
    
    # Create Availability for the expert
    availability_id = str(uuid.uuid4())
    availability_doc = {
        "_id": availability_id,
        "expertId": expert_id,
        "dayOfWeek": 0,  # Sunday
        "startTime": "09:00",
        "endTime": "12:00",
        "createdAt": datetime.utcnow()
    }
    db.availabilities.insert_one(availability_doc)
    
    # Create Company owned by user
    company_id = str(uuid.uuid4())
    company_doc = {
        "_id": company_id,
        "userId": user_id,
        "nameAr": "شركة تجريبية",
        "sector": "TECH",
        "status": "PENDING",
        "isApproved": False,
        "createdAt": datetime.utcnow()
    }
    db.companies.insert_one(company_doc)
    
    # Create Membership for user
    membership_id = str(uuid.uuid4())
    membership_doc = {
        "_id": membership_id,
        "userId": user_id,
        "tier": "BASIC",
        "startDate": datetime.utcnow(),
        "endDate": datetime.utcnow() + timedelta(days=365),
        "paymentStatus": "PAID",
        "amountPaid": 50,
        "createdAt": datetime.utcnow()
    }
    db.memberships.insert_one(membership_doc)
    
    # Create future CONFIRMED appointment where user is client
    future_client_appt_id = str(uuid.uuid4())
    future_date = datetime.utcnow() + timedelta(days=1)
    future_client_appt = {
        "_id": future_client_appt_id,
        "clientId": user_id,
        "expertId": expert_id,
        "date": future_date,
        "startTime": "10:00",
        "endTime": "11:00",
        "status": "CONFIRMED",
        "totalPaid": 25,
        "createdAt": datetime.utcnow()
    }
    db.appointments.insert_one(future_client_appt)
    
    # Create future CONFIRMED appointment where user is expert (via their expert record)
    future_expert_appt_id = str(uuid.uuid4())
    future_expert_appt = {
        "_id": future_expert_appt_id,
        "clientId": other_user_id,
        "expertId": expert_id,
        "date": future_date,
        "startTime": "11:00",
        "endTime": "12:00",
        "status": "CONFIRMED",
        "totalPaid": 25,
        "createdAt": datetime.utcnow()
    }
    db.appointments.insert_one(future_expert_appt)
    
    # Create past COMPLETED appointment (should remain untouched)
    past_date = datetime.utcnow() - timedelta(days=1)
    past_appt_id = str(uuid.uuid4())
    past_appt = {
        "_id": past_appt_id,
        "clientId": user_id,
        "expertId": expert_id,
        "date": past_date,
        "startTime": "10:00",
        "endTime": "11:00",
        "status": "COMPLETED",
        "totalPaid": 25,
        "createdAt": datetime.utcnow()
    }
    db.appointments.insert_one(past_appt)
    
    client.close()
    
    print(f"✅ Seeded test data for user {user_id}")
    return {
        "other_user_id": other_user_id,
        "expert_id": expert_id,
        "company_id": company_id,
        "membership_id": membership_id,
        "future_client_appt_id": future_client_appt_id,
        "future_expert_appt_id": future_expert_appt_id,
        "past_appt_id": past_appt_id
    }

def verify_cascade_deletion(user_id, seeded_data):
    """Verify cascade deletion worked correctly"""
    client = get_mongo_client()
    db = client[DB_NAME]
    
    try:
        # Check user is gone
        user = db.users.find_one({"_id": user_id})
        user_deleted = user is None
        
        # Check company is gone
        company = db.companies.find_one({"_id": seeded_data["company_id"]})
        company_deleted = company is None
        
        # Check expert is gone
        expert = db.experts.find_one({"_id": seeded_data["expert_id"]})
        expert_deleted = expert is None
        
        # Check availability is gone
        availability = db.availabilities.find_one({"expertId": seeded_data["expert_id"]})
        availability_deleted = availability is None
        
        # Check membership is gone
        membership = db.memberships.find_one({"_id": seeded_data["membership_id"]})
        membership_deleted = membership is None
        
        # Check password reset tokens are gone
        tokens = list(db.passwordresettokens.find({"userId": user_id}))
        tokens_deleted = len(tokens) == 0
        
        # Check future appointments are cancelled
        future_client_appt = db.appointments.find_one({"_id": seeded_data["future_client_appt_id"]})
        client_appt_cancelled = future_client_appt and future_client_appt["status"] == "CANCELLED" and future_client_appt["cancelledBy"] == "client"
        
        future_expert_appt = db.appointments.find_one({"_id": seeded_data["future_expert_appt_id"]})
        expert_appt_cancelled = future_expert_appt and future_expert_appt["status"] == "CANCELLED" and future_expert_appt["cancelledBy"] == "expert"
        
        # Check past appointment is unchanged
        past_appt = db.appointments.find_one({"_id": seeded_data["past_appt_id"]})
        past_appt_unchanged = past_appt and past_appt["status"] == "COMPLETED"
        
        print(f"📊 Cascade deletion verification:")
        print(f"   User deleted: {user_deleted}")
        print(f"   Company deleted: {company_deleted}")
        print(f"   Expert deleted: {expert_deleted}")
        print(f"   Availability deleted: {availability_deleted}")
        print(f"   Membership deleted: {membership_deleted}")
        print(f"   Tokens deleted: {tokens_deleted}")
        print(f"   Future client appt cancelled: {client_appt_cancelled}")
        print(f"   Future expert appt cancelled: {expert_appt_cancelled}")
        print(f"   Past appt unchanged: {past_appt_unchanged}")
        
        return all([
            user_deleted, company_deleted, expert_deleted, availability_deleted,
            membership_deleted, tokens_deleted, client_appt_cancelled,
            expert_appt_cancelled, past_appt_unchanged
        ])
        
    finally:
        client.close()

def test_get_me_regression():
    """Test GET /api/me includes phone and photo fields"""
    print("\n🧪 Testing GET /api/me regression (phone and photo fields)")
    
    # Create test user
    timestamp = int(time.time())
    email = f"regression_test_{timestamp}@majles.test"
    password = "TestPass123"
    user_id = create_test_user(email, password)
    
    if not user_id:
        print("❌ Failed to create test user")
        return False
    
    # Login
    cookies = login_user(email, password)
    if not cookies:
        print("❌ Failed to login")
        return False
    
    # Test unauthenticated request
    response = requests.get(f"{BASE_URL}/me")
    if response.status_code == 401 and "غير مصرح" in response.text:
        print("✅ Unauthenticated request returns 401 with Arabic error")
    else:
        print(f"❌ Unauthenticated request failed: {response.status_code}")
        return False
    
    # Test authenticated request
    response = requests.get(f"{BASE_URL}/me", cookies=cookies)
    if response.status_code == 200:
        data = response.json()
        required_fields = ['id', 'name', 'email', 'phone', 'photo', 'role', 'membershipTier', 'membershipExpiry', 'createdAt']
        
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            print(f"❌ Missing fields in response: {missing_fields}")
            return False
        
        # Check phone and photo default to empty string
        if data['phone'] == '' and data['photo'] == '':
            print("✅ Authenticated request returns user data with phone='' and photo='' defaults")
            return True
        else:
            print(f"❌ Phone or photo not empty strings: phone='{data['phone']}', photo='{data['photo']}'")
            return False
    else:
        print(f"❌ Authenticated request failed: {response.status_code}")
        return False

def test_put_me_validations():
    """Test PUT /api/me validation scenarios"""
    print("\n🧪 Testing PUT /api/me validations")
    
    # Create test user
    timestamp = int(time.time())
    email = f"put_test_{timestamp}@majles.test"
    password = "TestPass123"
    user_id = create_test_user(email, password)
    
    if not user_id:
        print("❌ Failed to create test user")
        return False
    
    # Login
    cookies = login_user(email, password)
    if not cookies:
        print("❌ Failed to login")
        return False
    
    # Test unauthenticated request
    response = requests.put(f"{BASE_URL}/me", json={"name": "Test"})
    if response.status_code == 401 and "غير مصرح" in response.text:
        print("✅ Unauthenticated request returns 401")
    else:
        print(f"❌ Unauthenticated request failed: {response.status_code}")
        return False
    
    # Test no fields provided
    response = requests.put(f"{BASE_URL}/me", json={}, cookies=cookies)
    if response.status_code == 400 and "لا توجد تغييرات" in response.text:
        print("✅ No fields returns 400 'لا توجد تغييرات'")
    else:
        print(f"❌ No fields test failed: {response.status_code}")
        return False
    
    # Test name validation - too short
    response = requests.put(f"{BASE_URL}/me", json={"name": "A"}, cookies=cookies)
    if response.status_code == 400 and "الاسم يجب أن يكون بين 2 و 80 حرفاً" in response.text:
        print("✅ Short name returns 400 with Arabic error")
    else:
        print(f"❌ Short name test failed: {response.status_code}")
        return False
    
    # Test name validation - too long
    long_name = "A" * 81
    response = requests.put(f"{BASE_URL}/me", json={"name": long_name}, cookies=cookies)
    if response.status_code == 400 and "الاسم يجب أن يكون بين 2 و 80 حرفاً" in response.text:
        print("✅ Long name returns 400 with Arabic error")
    else:
        print(f"❌ Long name test failed: {response.status_code}")
        return False
    
    # Test phone validation - invalid format
    response = requests.put(f"{BASE_URL}/me", json={"phone": "abc123"}, cookies=cookies)
    if response.status_code == 400 and "رقم الهاتف غير صحيح" in response.text:
        print("✅ Invalid phone returns 400 with Arabic error")
    else:
        print(f"❌ Invalid phone test failed: {response.status_code}")
        return False
    
    # Test photo validation - invalid format
    response = requests.put(f"{BASE_URL}/me", json={"photo": "invalid_photo"}, cookies=cookies)
    if response.status_code == 400 and "صيغة الصورة غير مدعومة" in response.text:
        print("✅ Invalid photo format returns 400 with Arabic error")
    else:
        print(f"❌ Invalid photo test failed: {response.status_code}")
        return False
    
    # Test photo validation - too large
    large_photo = "data:image/png;base64," + "A" * 2000000
    response = requests.put(f"{BASE_URL}/me", json={"photo": large_photo}, cookies=cookies)
    if response.status_code == 400 and "حجم الصورة كبير جداً" in response.text:
        print("✅ Large photo returns 400 with Arabic error")
    else:
        print(f"❌ Large photo test failed: {response.status_code}")
        return False
    
    return True

def test_put_me_happy_path():
    """Test PUT /api/me happy path scenarios"""
    print("\n🧪 Testing PUT /api/me happy path")
    
    # Create test user
    timestamp = int(time.time())
    email = f"put_happy_{timestamp}@majles.test"
    password = "TestPass123"
    user_id = create_test_user(email, password)
    
    if not user_id:
        print("❌ Failed to create test user")
        return False
    
    # Login
    cookies = login_user(email, password)
    if not cookies:
        print("❌ Failed to login")
        return False
    
    # Test name update
    response = requests.put(f"{BASE_URL}/me", json={"name": "Updated Name"}, cookies=cookies)
    if response.status_code == 200:
        data = response.json()
        if data.get('success') and data.get('user', {}).get('name') == "Updated Name":
            print("✅ Name update successful")
        else:
            print(f"❌ Name update response invalid: {data}")
            return False
    else:
        print(f"❌ Name update failed: {response.status_code}")
        return False
    
    # Test phone update
    response = requests.put(f"{BASE_URL}/me", json={"phone": "+968 9123 4567"}, cookies=cookies)
    if response.status_code == 200:
        data = response.json()
        if data.get('success') and data.get('user', {}).get('phone') == "+968 9123 4567":
            print("✅ Phone update successful")
        else:
            print(f"❌ Phone update response invalid: {data}")
            return False
    else:
        print(f"❌ Phone update failed: {response.status_code}")
        return False
    
    # Test photo update with small valid data URL
    small_photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
    response = requests.put(f"{BASE_URL}/me", json={"photo": small_photo}, cookies=cookies)
    if response.status_code == 200:
        data = response.json()
        if data.get('success') and data.get('user', {}).get('photo') == small_photo:
            print("✅ Photo update successful")
        else:
            print(f"❌ Photo update response invalid: {data}")
            return False
    else:
        print(f"❌ Photo update failed: {response.status_code}")
        return False
    
    # Test photo clear
    response = requests.put(f"{BASE_URL}/me", json={"photo": ""}, cookies=cookies)
    if response.status_code == 200:
        data = response.json()
        if data.get('success') and data.get('user', {}).get('photo') == "":
            print("✅ Photo clear successful")
        else:
            print(f"❌ Photo clear response invalid: {data}")
            return False
    else:
        print(f"❌ Photo clear failed: {response.status_code}")
        return False
    
    return True

def test_change_password():
    """Test POST /api/me/change-password"""
    print("\n🧪 Testing POST /api/me/change-password")
    
    # Create test user
    timestamp = int(time.time())
    email = f"change_pass_{timestamp}@majles.test"
    old_password = "OldPass12"
    user_id = create_test_user(email, old_password)
    
    if not user_id:
        print("❌ Failed to create test user")
        return False
    
    # Seed a password reset token
    token_id = seed_password_reset_token(user_id)
    
    # Login
    cookies = login_user(email, old_password)
    if not cookies:
        print("❌ Failed to login")
        return False
    
    # Test unauthenticated request
    response = requests.post(f"{BASE_URL}/me/change-password", json={"currentPassword": "test", "newPassword": "test"})
    if response.status_code == 401 and "غير مصرح" in response.text:
        print("✅ Unauthenticated request returns 401")
    else:
        print(f"❌ Unauthenticated request failed: {response.status_code}")
        return False
    
    # Test missing fields
    response = requests.post(f"{BASE_URL}/me/change-password", json={}, cookies=cookies)
    if response.status_code == 400 and "كلمة المرور الحالية والجديدة مطلوبتان" in response.text:
        print("✅ Missing fields returns 400 with Arabic error")
    else:
        print(f"❌ Missing fields test failed: {response.status_code}")
        return False
    
    # Test short new password
    response = requests.post(f"{BASE_URL}/me/change-password", json={"currentPassword": old_password, "newPassword": "123"}, cookies=cookies)
    if response.status_code == 400 and "يجب أن تكون كلمة المرور 6 أحرف على الأقل" in response.text:
        print("✅ Short new password returns 400 with Arabic error")
    else:
        print(f"❌ Short new password test failed: {response.status_code}")
        return False
    
    # Test same password
    response = requests.post(f"{BASE_URL}/me/change-password", json={"currentPassword": old_password, "newPassword": old_password}, cookies=cookies)
    if response.status_code == 400 and "كلمة المرور الجديدة يجب أن تختلف عن الحالية" in response.text:
        print("✅ Same password returns 400 with Arabic error")
    else:
        print(f"❌ Same password test failed: {response.status_code}")
        return False
    
    # Test wrong current password
    response = requests.post(f"{BASE_URL}/me/change-password", json={"currentPassword": "WrongPass", "newPassword": "NewPass456"}, cookies=cookies)
    if response.status_code == 400 and "كلمة المرور الحالية غير صحيحة" in response.text:
        print("✅ Wrong current password returns 400 with Arabic error")
    else:
        print(f"❌ Wrong current password test failed: {response.status_code}")
        return False
    
    # Test successful password change
    new_password = "NewPass456"
    response = requests.post(f"{BASE_URL}/me/change-password", json={"currentPassword": old_password, "newPassword": new_password}, cookies=cookies)
    if response.status_code == 200 and "تم تحديث كلمة المرور بنجاح" in response.text:
        print("✅ Password change successful")
    else:
        print(f"❌ Password change failed: {response.status_code}")
        return False
    
    # Verify can't login with old password
    old_cookies = login_user(email, old_password)
    if old_cookies is None:
        print("✅ Cannot login with old password")
    else:
        print("❌ Can still login with old password")
        return False
    
    # Verify can login with new password
    new_cookies = login_user(email, new_password)
    if new_cookies:
        print("✅ Can login with new password")
    else:
        print("❌ Cannot login with new password")
        return False
    
    # Verify password reset token is invalidated
    if check_password_reset_token_used(user_id):
        print("✅ Password reset token invalidated")
    else:
        print("❌ Password reset token not invalidated")
        return False
    
    return True

def test_delete_account_admin_guard():
    """Test DELETE /api/me admin protection"""
    print("\n🧪 Testing DELETE /api/me admin guard")
    
    # Create test user
    timestamp = int(time.time())
    email = f"admin_test_{timestamp}@majles.test"
    password = "AdminPass123"
    user_id = create_test_user(email, password)
    
    if not user_id:
        print("❌ Failed to create test user")
        return False
    
    # Promote to admin
    if not promote_user_to_admin(user_id):
        print("❌ Failed to promote user to admin")
        return False
    
    # Login as admin
    cookies = login_user(email, password)
    if not cookies:
        print("❌ Failed to login as admin")
        return False
    
    # Test admin deletion protection
    response = requests.delete(f"{BASE_URL}/me", json={"password": password, "confirm": "حذف"}, cookies=cookies)
    if response.status_code == 403 and "لا يمكن حذف حساب المسؤول من هذه الصفحة" in response.text:
        print("✅ Admin deletion blocked with Arabic error")
        return True
    else:
        print(f"❌ Admin deletion test failed: {response.status_code}")
        return False

def test_delete_account_happy_path():
    """Test DELETE /api/me happy path with cascade deletion"""
    print("\n🧪 Testing DELETE /api/me happy path")
    
    # Create test user
    timestamp = int(time.time())
    email = f"delete_test_{timestamp}@majles.test"
    password = "DeletePass123"
    user_id = create_test_user(email, password)
    
    if not user_id:
        print("❌ Failed to create test user")
        return False
    
    # Seed test data for cascade deletion
    seeded_data = seed_test_data_for_deletion(user_id)
    
    # Login
    cookies = login_user(email, password)
    if not cookies:
        print("❌ Failed to login")
        return False
    
    # Test unauthenticated request
    response = requests.delete(f"{BASE_URL}/me", json={"password": password, "confirm": "حذف"})
    if response.status_code == 401 and "غير مصرح" in response.text:
        print("✅ Unauthenticated request returns 401")
    else:
        print(f"❌ Unauthenticated request failed: {response.status_code}")
        return False
    
    # Test missing password
    response = requests.delete(f"{BASE_URL}/me", json={"confirm": "حذف"}, cookies=cookies)
    if response.status_code == 400 and "كلمة المرور مطلوبة لتأكيد الحذف" in response.text:
        print("✅ Missing password returns 400 with Arabic error")
    else:
        print(f"❌ Missing password test failed: {response.status_code}")
        return False
    
    # Test wrong confirm
    response = requests.delete(f"{BASE_URL}/me", json={"password": password, "confirm": "wrong"}, cookies=cookies)
    if response.status_code == 400 and "يجب كتابة كلمة" in response.text and "حذف" in response.text:
        print("✅ Wrong confirm returns 400 with Arabic error")
    else:
        print(f"❌ Wrong confirm test failed: {response.status_code}")
        print(f"Response: {response.text}")
        return False
    
    # Test wrong password
    response = requests.delete(f"{BASE_URL}/me", json={"password": "WrongPass", "confirm": "حذف"}, cookies=cookies)
    if response.status_code == 400 and "كلمة المرور غير صحيحة" in response.text:
        print("✅ Wrong password returns 400 with Arabic error")
    else:
        print(f"❌ Wrong password test failed: {response.status_code}")
        return False
    
    # Test successful deletion
    response = requests.delete(f"{BASE_URL}/me", json={"password": password, "confirm": "حذف"}, cookies=cookies)
    if response.status_code == 200 and "تم حذف الحساب" in response.text:
        print("✅ Account deletion successful")
    else:
        print(f"❌ Account deletion failed: {response.status_code}")
        return False
    
    # Verify cascade deletion
    if verify_cascade_deletion(user_id, seeded_data):
        print("✅ Cascade deletion verified")
    else:
        print("❌ Cascade deletion failed")
        return False
    
    # Verify cannot login anymore
    login_cookies = login_user(email, password)
    if login_cookies is None:
        print("✅ Cannot login after deletion")
        return True
    else:
        print("❌ Can still login after deletion")
        return False

def test_regression_endpoints():
    """Test regression endpoints to ensure they still work"""
    print("\n🧪 Testing regression endpoints")
    
    # Test GET /api/
    response = requests.get(f"{BASE_URL}/")
    if response.status_code == 200 and "Majles API is running" in response.text:
        print("✅ GET /api/ working")
    else:
        print(f"❌ GET /api/ failed: {response.status_code}")
        return False
    
    # Test POST /api/signup
    timestamp = int(time.time())
    email = f"regression_{timestamp}@majles.test"
    response = requests.post(f"{BASE_URL}/signup", json={
        "name": "Regression Test",
        "email": email,
        "password": "TestPass123"
    })
    if response.status_code == 200:
        data = response.json()
        if data.get('success') and data.get('user'):
            print("✅ POST /api/signup working")
        else:
            print(f"❌ POST /api/signup response invalid: {data}")
            return False
    else:
        print(f"❌ POST /api/signup failed: {response.status_code}")
        return False
    
    # Test POST /api/forgot-password with unknown email
    response = requests.post(f"{BASE_URL}/forgot-password", json={"email": "unknown@test.com"})
    if response.status_code == 200:
        print("✅ POST /api/forgot-password working")
    else:
        print(f"❌ POST /api/forgot-password failed: {response.status_code}")
        return False
    
    return True

def main():
    """Run all tests"""
    print("🚀 Starting Profile Settings Backend Testing")
    print(f"Base URL: {BASE_URL}")
    print(f"MongoDB: {MONGO_URL}/{DB_NAME}")
    
    tests = [
        ("GET /api/me regression", test_get_me_regression),
        ("PUT /api/me validations", test_put_me_validations),
        ("PUT /api/me happy path", test_put_me_happy_path),
        ("POST /api/me/change-password", test_change_password),
        ("DELETE /api/me admin guard", test_delete_account_admin_guard),
        ("DELETE /api/me happy path", test_delete_account_happy_path),
        ("Regression endpoints", test_regression_endpoints),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n{'='*60}")
        print(f"Running: {test_name}")
        print('='*60)
        
        try:
            if test_func():
                print(f"✅ {test_name} PASSED")
                passed += 1
            else:
                print(f"❌ {test_name} FAILED")
        except Exception as e:
            print(f"❌ {test_name} ERROR: {e}")
    
    print(f"\n{'='*60}")
    print(f"FINAL RESULTS: {passed}/{total} tests passed")
    print('='*60)
    
    if passed == total:
        print("🎉 ALL TESTS PASSED!")
        return True
    else:
        print("💥 SOME TESTS FAILED!")
        return False

if __name__ == "__main__":
    main()