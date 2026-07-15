#!/usr/bin/env python3
"""
Backend API tests for Guest Checkout with Optional Account Signup
Tests the POST /api/orders endpoint with guest checkout scenarios
"""

import requests
import time
from pymongo import MongoClient

# Configuration
BASE_URL = "https://omani-startup-hub.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"
MONGO_URL = "mongodb://localhost:27017/majles"

# Test product ID (active product with stock)
PRODUCT_ID = "44651b8d-358f-4f11-93de-e0274f4ce272"
VARIANT_ID = "e82b713a-ee73-4d04-bf0d-15ad11265f8b"  # صغير / أحمر variant

# Admin credentials (for cleanup only)
ADMIN_EMAIL = "mazin298@gmail.com"
ADMIN_PASSWORD = "Password123"

# MongoDB connection
client = MongoClient(MONGO_URL)
db = client['majles']

def generate_test_email():
    """Generate unique timestamped email for testing"""
    timestamp = int(time.time() * 1000)
    return f"guest-test-{timestamp}@test.com"

def cleanup_test_data(email):
    """Delete test user and their orders"""
    try:
        user = db.users.find_one({'email': email})
        if user:
            user_id = user['_id']
            # Delete orders
            db.orders.delete_many({'buyerId': user_id})
            # Delete user
            db.users.delete_one({'_id': user_id})
            print(f"  ✓ Cleaned up user: {email}")
    except Exception as e:
        print(f"  ⚠ Cleanup error for {email}: {e}")

def test_guest_checkout_with_password():
    """Test 1: Guest checkout WITH password → creates FULL account"""
    print("\n" + "="*80)
    print("TEST 1: Guest checkout WITH password → creates FULL account")
    print("="*80)
    
    email = generate_test_email()
    password = "SecurePass123"
    
    payload = {
        "items": [{"productId": PRODUCT_ID, "variantId": VARIANT_ID, "quantity": 1}],
        "shippingAddress": {
            "name": "عميل اختبار مع حساب",
            "phone": "99900001",
            "governorate": "MUSCAT",
            "city": "مسقط",
            "addressLine": "شارع اختبار",
            "notes": ""
        },
        "guest": {
            "name": "عميل اختبار مع حساب",
            "email": email,
            "phone": "99900001",
            "password": password
        },
        "paymentMethod": "COD"
    }
    
    try:
        print(f"📤 POST /api/orders (guest with password)")
        print(f"   Email: {email}")
        print(f"   Password: {password}")
        
        response = requests.post(f"{API_BASE}/orders", json=payload, timeout=30)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Response: success={data.get('success')}, cod={data.get('cod')}, accountCreated={data.get('accountCreated')}")
            
            # Verify accountCreated flag
            if data.get('accountCreated') == True:
                print(f"   ✅ accountCreated flag is TRUE (as expected)")
            else:
                print(f"   ❌ accountCreated flag is {data.get('accountCreated')} (expected TRUE)")
                return False
            
            # Verify in database
            user = db.users.find_one({'email': email})
            if user:
                print(f"\n   📊 Database verification:")
                print(f"      Email: {user['email']}")
                print(f"      isGuest: {user.get('isGuest', 'N/A')}")
                print(f"      Password starts with $2: {str(user.get('password', '')).startswith('$2')}")
                print(f"      Password length: {len(user.get('password', ''))}")
                print(f"      Role: {user.get('role', 'N/A')}")
                print(f"      Membership Tier: {user.get('membershipTier', 'N/A')}")
                
                # Verify all conditions
                if user.get('isGuest') == False:
                    print(f"      ✅ isGuest is FALSE (full account)")
                else:
                    print(f"      ❌ isGuest is {user.get('isGuest')} (expected FALSE)")
                    return False
                
                if str(user.get('password', '')).startswith('$2') and len(user.get('password', '')) >= 60:
                    print(f"      ✅ Password is bcrypt hashed")
                else:
                    print(f"      ❌ Password is not properly hashed")
                    return False
                
                if user.get('role') == 'MEMBER' and user.get('membershipTier') == 'FREE':
                    print(f"      ✅ Role and tier are correct")
                else:
                    print(f"      ❌ Role or tier incorrect")
                    return False
                
                print(f"\n   ✅ TEST 1 PASSED: Full account created successfully")
                return True
            else:
                print(f"   ❌ User not found in database")
                return False
        else:
            print(f"   ❌ Unexpected status code: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Exception: {e}")
        return False
    finally:
        cleanup_test_data(email)

def test_guest_checkout_without_password():
    """Test 2: Guest checkout WITHOUT password → creates GUEST account"""
    print("\n" + "="*80)
    print("TEST 2: Guest checkout WITHOUT password → creates GUEST account")
    print("="*80)
    
    email = generate_test_email()
    
    payload = {
        "items": [{"productId": PRODUCT_ID, "variantId": VARIANT_ID, "quantity": 1}],
        "shippingAddress": {
            "name": "عميل اختبار بدون حساب",
            "phone": "99900002",
            "governorate": "MUSCAT",
            "city": "مسقط",
            "addressLine": "شارع اختبار 2",
            "notes": ""
        },
        "guest": {
            "name": "عميل اختبار بدون حساب",
            "email": email,
            "phone": "99900002"
            # No password field
        },
        "paymentMethod": "COD"
    }
    
    try:
        print(f"📤 POST /api/orders (guest without password)")
        print(f"   Email: {email}")
        
        response = requests.post(f"{API_BASE}/orders", json=payload, timeout=30)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Response: success={data.get('success')}, cod={data.get('cod')}, accountCreated={data.get('accountCreated')}")
            
            # Verify accountCreated flag
            if data.get('accountCreated') == False:
                print(f"   ✅ accountCreated flag is FALSE (as expected)")
            else:
                print(f"   ❌ accountCreated flag is {data.get('accountCreated')} (expected FALSE)")
                return False
            
            # Verify in database
            user = db.users.find_one({'email': email})
            if user:
                print(f"\n   📊 Database verification:")
                print(f"      Email: {user['email']}")
                print(f"      isGuest: {user.get('isGuest', 'N/A')}")
                print(f"      Password: '{user.get('password', '')}'")
                
                # Verify all conditions
                if user.get('isGuest') == True:
                    print(f"      ✅ isGuest is TRUE (guest account)")
                else:
                    print(f"      ❌ isGuest is {user.get('isGuest')} (expected TRUE)")
                    return False
                
                if user.get('password') == '' or user.get('password') is None:
                    print(f"      ✅ Password is empty")
                else:
                    print(f"      ❌ Password is not empty: {user.get('password')}")
                    return False
                
                print(f"\n   ✅ TEST 2 PASSED: Guest account created successfully")
                return True
            else:
                print(f"   ❌ User not found in database")
                return False
        else:
            print(f"   ❌ Unexpected status code: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Exception: {e}")
        return False
    finally:
        cleanup_test_data(email)

def test_password_too_short():
    """Test 3: Password too short → 400 error"""
    print("\n" + "="*80)
    print("TEST 3: Password too short → 400 error")
    print("="*80)
    
    email = generate_test_email()
    
    payload = {
        "items": [{"productId": PRODUCT_ID, "variantId": VARIANT_ID, "quantity": 1}],
        "shippingAddress": {
            "name": "عميل اختبار كلمة سر قصيرة",
            "phone": "99900003",
            "governorate": "MUSCAT",
            "city": "مسقط",
            "addressLine": "شارع اختبار 3",
            "notes": ""
        },
        "guest": {
            "name": "عميل اختبار كلمة سر قصيرة",
            "email": email,
            "phone": "99900003",
            "password": "abc"  # Too short (3 chars)
        },
        "paymentMethod": "COD"
    }
    
    try:
        print(f"📤 POST /api/orders (guest with short password)")
        print(f"   Email: {email}")
        print(f"   Password: 'abc' (3 chars)")
        
        response = requests.post(f"{API_BASE}/orders", json=payload, timeout=30)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 400:
            data = response.json()
            error_msg = data.get('error', '')
            print(f"   ✅ Got 400 error as expected")
            print(f"   Error message: {error_msg}")
            
            # Verify error message contains "كلمة السر"
            if 'كلمة السر' in error_msg or 'كلمة المرور' in error_msg:
                print(f"   ✅ Error message contains password reference")
            else:
                print(f"   ⚠ Error message doesn't contain expected Arabic text")
            
            # Verify no user was created
            user = db.users.find_one({'email': email})
            if user is None:
                print(f"   ✅ No user created in database")
                print(f"\n   ✅ TEST 3 PASSED: Short password rejected correctly")
                return True
            else:
                print(f"   ❌ User was created despite short password")
                return False
        else:
            print(f"   ❌ Unexpected status code: {response.status_code} (expected 400)")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Exception: {e}")
        return False
    finally:
        cleanup_test_data(email)

def test_existing_full_account_email():
    """Test 4: Existing full-account email → 409 error"""
    print("\n" + "="*80)
    print("TEST 4: Existing full-account email → 409 error")
    print("="*80)
    
    # Use admin email (existing full account)
    email = ADMIN_EMAIL
    
    payload = {
        "items": [{"productId": PRODUCT_ID, "variantId": VARIANT_ID, "quantity": 1}],
        "shippingAddress": {
            "name": "محاولة استخدام بريد موجود",
            "phone": "99900004",
            "governorate": "MUSCAT",
            "city": "مسقط",
            "addressLine": "شارع اختبار 4",
            "notes": ""
        },
        "guest": {
            "name": "محاولة استخدام بريد موجود",
            "email": email,
            "phone": "99900004",
            "password": "AnyPassword123"
        },
        "paymentMethod": "COD"
    }
    
    try:
        print(f"📤 POST /api/orders (guest with existing admin email)")
        print(f"   Email: {email}")
        
        response = requests.post(f"{API_BASE}/orders", json=payload, timeout=30)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 409:
            data = response.json()
            error_msg = data.get('error', '')
            print(f"   ✅ Got 409 conflict as expected")
            print(f"   Error message: {error_msg}")
            
            # Verify error message contains "هذا البريد مسجّل مسبقاً"
            if 'هذا البريد مسجّل مسبقاً' in error_msg or 'البريد' in error_msg:
                print(f"   ✅ Error message contains expected Arabic text")
            else:
                print(f"   ⚠ Error message doesn't contain expected Arabic text")
            
            print(f"\n   ✅ TEST 4 PASSED: Existing email rejected correctly")
            return True
        else:
            print(f"   ❌ Unexpected status code: {response.status_code} (expected 409)")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Exception: {e}")
        return False

def test_upgrade_guest_to_full_account():
    """Test 5: Upgrade guest → full account"""
    print("\n" + "="*80)
    print("TEST 5: Upgrade guest → full account")
    print("="*80)
    
    email = generate_test_email()
    
    # Step 1: Create guest without password
    print("\n   STEP 1: Create guest account (no password)")
    payload1 = {
        "items": [{"productId": PRODUCT_ID, "variantId": VARIANT_ID, "quantity": 1}],
        "shippingAddress": {
            "name": "عميل للترقية",
            "phone": "99900005",
            "governorate": "MUSCAT",
            "city": "مسقط",
            "addressLine": "شارع اختبار 5",
            "notes": ""
        },
        "guest": {
            "name": "عميل للترقية",
            "email": email,
            "phone": "99900005"
            # No password
        },
        "paymentMethod": "COD"
    }
    
    try:
        print(f"   📤 POST /api/orders (create guest)")
        print(f"      Email: {email}")
        
        response1 = requests.post(f"{API_BASE}/orders", json=payload1, timeout=30)
        print(f"      Status: {response1.status_code}")
        
        if response1.status_code != 200:
            print(f"   ❌ Failed to create guest account")
            print(f"      Response: {response1.text}")
            return False
        
        data1 = response1.json()
        print(f"      ✅ Guest created: accountCreated={data1.get('accountCreated')}")
        
        # Verify guest account in DB
        user1 = db.users.find_one({'email': email})
        if not user1:
            print(f"   ❌ Guest user not found in database")
            return False
        
        print(f"      isGuest: {user1.get('isGuest')}")
        print(f"      Password: '{user1.get('password', '')}'")
        
        if user1.get('isGuest') != True:
            print(f"   ❌ User is not a guest (expected isGuest=True)")
            return False
        
        # Step 2: Same email with password (upgrade)
        print("\n   STEP 2: Same email with password (upgrade to full account)")
        time.sleep(1)  # Small delay
        
        payload2 = {
            "items": [{"productId": PRODUCT_ID, "variantId": VARIANT_ID, "quantity": 1}],
            "shippingAddress": {
                "name": "عميل للترقية",
                "phone": "99900005",
                "governorate": "MUSCAT",
                "city": "مسقط",
                "addressLine": "شارع اختبار 5",
                "notes": ""
            },
            "guest": {
                "name": "عميل للترقية",
                "email": email,
                "phone": "99900005",
                "password": "SecurePass123"  # Now with password
            },
            "paymentMethod": "COD"
        }
        
        print(f"   📤 POST /api/orders (upgrade with password)")
        print(f"      Email: {email}")
        print(f"      Password: SecurePass123")
        
        response2 = requests.post(f"{API_BASE}/orders", json=payload2, timeout=30)
        print(f"      Status: {response2.status_code}")
        
        if response2.status_code == 200:
            data2 = response2.json()
            print(f"      ✅ Response: success={data2.get('success')}, accountCreated={data2.get('accountCreated')}")
            
            # Verify accountCreated flag
            if data2.get('accountCreated') == True:
                print(f"      ✅ accountCreated flag is TRUE (upgrade successful)")
            else:
                print(f"      ❌ accountCreated flag is {data2.get('accountCreated')} (expected TRUE)")
                return False
            
            # Verify upgrade in database
            user2 = db.users.find_one({'email': email})
            if user2:
                print(f"\n   📊 Database verification after upgrade:")
                print(f"      Email: {user2['email']}")
                print(f"      isGuest: {user2.get('isGuest', 'N/A')}")
                print(f"      Password starts with $2: {str(user2.get('password', '')).startswith('$2')}")
                print(f"      Password length: {len(user2.get('password', ''))}")
                
                # Verify upgrade conditions
                if user2.get('isGuest') == False:
                    print(f"      ✅ isGuest is now FALSE (upgraded to full account)")
                else:
                    print(f"      ❌ isGuest is {user2.get('isGuest')} (expected FALSE)")
                    return False
                
                if str(user2.get('password', '')).startswith('$2') and len(user2.get('password', '')) >= 60:
                    print(f"      ✅ Password is now bcrypt hashed")
                else:
                    print(f"      ❌ Password is not properly hashed")
                    return False
                
                print(f"\n   ✅ TEST 5 PASSED: Guest upgraded to full account successfully")
                return True
            else:
                print(f"   ❌ User not found in database after upgrade")
                return False
        else:
            print(f"   ❌ Unexpected status code: {response2.status_code}")
            print(f"   Response: {response2.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Exception: {e}")
        return False
    finally:
        cleanup_test_data(email)

def test_account_created_field_consistency():
    """Test 6: Response includes accountCreated field consistently"""
    print("\n" + "="*80)
    print("TEST 6: Response includes accountCreated field consistently")
    print("="*80)
    
    email = generate_test_email()
    
    payload = {
        "items": [{"productId": PRODUCT_ID, "variantId": VARIANT_ID, "quantity": 1}],
        "shippingAddress": {
            "name": "اختبار الاتساق",
            "phone": "99900006",
            "governorate": "MUSCAT",
            "city": "مسقط",
            "addressLine": "شارع اختبار 6",
            "notes": ""
        },
        "guest": {
            "name": "اختبار الاتساق",
            "email": email,
            "phone": "99900006",
            "password": "TestPass123"
        },
        "paymentMethod": "COD"
    }
    
    try:
        print(f"📤 POST /api/orders (verify accountCreated field presence)")
        print(f"   Email: {email}")
        
        response = requests.post(f"{API_BASE}/orders", json=payload, timeout=30)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Check if accountCreated field exists
            if 'accountCreated' in data:
                print(f"   ✅ accountCreated field present in response")
                print(f"   Value: {data['accountCreated']}")
                
                # Verify it's a boolean
                if isinstance(data['accountCreated'], bool):
                    print(f"   ✅ accountCreated is a boolean type")
                    print(f"\n   ✅ TEST 6 PASSED: accountCreated field is consistent")
                    return True
                else:
                    print(f"   ❌ accountCreated is not a boolean: {type(data['accountCreated'])}")
                    return False
            else:
                print(f"   ❌ accountCreated field missing from response")
                print(f"   Response keys: {list(data.keys())}")
                return False
        else:
            print(f"   ❌ Unexpected status code: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Exception: {e}")
        return False
    finally:
        cleanup_test_data(email)

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("GUEST CHECKOUT WITH OPTIONAL ACCOUNT SIGNUP - BACKEND TESTS")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Product ID: {PRODUCT_ID}")
    print(f"MongoDB: {MONGO_URL}")
    
    results = []
    
    # Run all tests
    results.append(("Test 1: Guest with password → Full account", test_guest_checkout_with_password()))
    results.append(("Test 2: Guest without password → Guest account", test_guest_checkout_without_password()))
    results.append(("Test 3: Password too short → 400", test_password_too_short()))
    results.append(("Test 4: Existing email → 409", test_existing_full_account_email()))
    results.append(("Test 5: Upgrade guest → Full account", test_upgrade_guest_to_full_account()))
    results.append(("Test 6: accountCreated field consistency", test_account_created_field_consistency()))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {test_name}")
    
    print(f"\n{'='*80}")
    print(f"TOTAL: {passed}/{total} tests passed ({int(passed/total*100)}% success rate)")
    print(f"{'='*80}\n")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
