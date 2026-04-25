#!/usr/bin/env python3
"""
Backend testing for Social Media Links feature
Tests all scenarios from the review request
"""

import requests
import json
import time
import uuid
from pymongo import MongoClient
import bcrypt
import os

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://6f3dfdf5-cfdd-488c-a9a0-63f293d4ee0d.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

# MongoDB connection
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017/majles')
mongo_client = MongoClient(MONGO_URL)
db = mongo_client.majles

def create_test_user(email, password="Password123", role="MEMBER", tier="FREE"):
    """Create a test user directly in MongoDB"""
    user_id = str(uuid.uuid4())
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    user_doc = {
        "_id": user_id,
        "name": f"Test User {int(time.time())}",
        "email": email,
        "password": hashed_password,
        "role": role,
        "membershipTier": tier,
        "membershipExpiry": None,
        "phone": "",
        "photo": "",
        "wishlist": [],
        "isGuest": False,
        "vendorAbsorbsShipping": False,
        "isSuspended": False,
        "suspendedReason": "",
        "suspendedAt": None,
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
        "createdAt": time.time() * 1000
    }
    
    db.users.insert_one(user_doc)
    return user_id, email, password

def login_user(email, password):
    """Login user using NextAuth credentials flow"""
    session = requests.Session()
    
    # Get CSRF token
    csrf_response = session.get(f"{API_BASE}/auth/csrf")
    csrf_token = csrf_response.json().get('csrfToken')
    
    # Login
    login_data = {
        'csrfToken': csrf_token,
        'email': email,
        'password': password,
        'callbackUrl': f"{BASE_URL}/dashboard",
        'json': 'true'
    }
    
    login_response = session.post(
        f"{API_BASE}/auth/callback/credentials",
        data=login_data,
        headers={'Content-Type': 'application/x-www-form-urlencoded'}
    )
    
    # Verify login by checking /api/me
    me_response = session.get(f"{API_BASE}/me")
    if me_response.status_code == 200:
        return session
    else:
        print(f"Login failed for {email}: {me_response.status_code} {me_response.text}")
        return None

def test_sanitize_social_via_company():
    """Test sanitizeSocial behavior via POST /api/companies"""
    print("\n=== Testing sanitizeSocial behavior via POST /api/companies ===")
    
    # Create a test user with BASIC tier
    timestamp = int(time.time())
    email = f"test_company_{timestamp}@test.com"
    user_id, email, password = create_test_user(email, role="MEMBER", tier="BASIC")
    
    session = login_user(email, password)
    if not session:
        print("❌ Failed to login user for company test")
        return False
    
    test_cases = [
        {
            "name": "URL with scheme passes through",
            "input": {"instagram": "https://www.instagram.com/oem/"},
            "expected": {"instagram": "https://www.instagram.com/oem/"}
        },
        {
            "name": "URL without scheme gets https prefix",
            "input": {"instagram": "instagram.com/oem"},
            "expected": {"instagram": "https://instagram.com/oem"}
        },
        {
            "name": "@handle for instagram",
            "input": {"instagram": "@oem"},
            "expected": {"instagram": "https://www.instagram.com/oem/"}
        },
        {
            "name": "@handle for twitter",
            "input": {"twitter": "@oem"},
            "expected": {"twitter": "https://twitter.com/oem"}
        },
        {
            "name": "@handle for tiktok",
            "input": {"tiktok": "@oem"},
            "expected": {"tiktok": "https://www.tiktok.com/@oem"}
        },
        {
            "name": "WhatsApp phone with +",
            "input": {"whatsapp": "+96891234567"},
            "expected": {"whatsapp": "+96891234567"}
        },
        {
            "name": "WhatsApp wa.me URL",
            "input": {"whatsapp": "https://wa.me/96891234567"},
            "expected": {"whatsapp": "https://wa.me/96891234567"}
        },
        {
            "name": "WhatsApp digits only",
            "input": {"whatsapp": "96891234567"},
            "expected": {"whatsapp": "+96891234567"}
        },
        {
            "name": "Unknown key stripped",
            "input": {"instagram": "@test", "unknownKey": "xxx"},
            "expected": {"instagram": "https://www.instagram.com/test/"}
        },
        {
            "name": "Empty value stays empty",
            "input": {"instagram": ""},
            "expected": {"instagram": ""}
        }
    ]
    
    passed = 0
    total = len(test_cases)
    
    for i, test_case in enumerate(test_cases):
        print(f"\nTest {i+1}: {test_case['name']}")
        
        company_data = {
            "nameAr": f"شركة اختبار {i+1}",
            "sector": "TECH",
            "social": test_case["input"]
        }
        
        response = session.post(f"{API_BASE}/companies", json=company_data)
        
        if response.status_code in [200, 201]:
            company = response.json().get("company", {})
            social = company.get("social", {})
            
            # Check expected values
            success = True
            for key, expected_value in test_case["expected"].items():
                actual_value = social.get(key, "")
                if actual_value != expected_value:
                    print(f"  ❌ {key}: expected '{expected_value}', got '{actual_value}'")
                    success = False
                else:
                    print(f"  ✅ {key}: '{actual_value}'")
            
            # Check that unknown keys are not present
            if "unknownKey" in test_case["input"] and "unknownKey" in social:
                print(f"  ❌ unknownKey should be stripped but found: {social['unknownKey']}")
                success = False
            
            if success:
                passed += 1
                print(f"  ✅ Test passed")
            else:
                print(f"  ❌ Test failed")
        else:
            print(f"  ❌ API call failed: {response.status_code} {response.text}")
    
    print(f"\n=== sanitizeSocial tests: {passed}/{total} passed ===")
    return passed == total

def test_company_social_endpoints():
    """Test POST and PUT /api/companies with social"""
    print("\n=== Testing Company Social Endpoints ===")
    
    # Create test users
    timestamp = int(time.time())
    
    # Regular user with BASIC tier
    user_email = f"test_user_{timestamp}@test.com"
    user_id, user_email, password = create_test_user(user_email, role="MEMBER", tier="BASIC")
    user_session = login_user(user_email, password)
    
    # Admin user
    admin_email = f"test_admin_{timestamp}@test.com"
    admin_id, admin_email, admin_password = create_test_user(admin_email, role="ADMIN", tier="PLATINUM")
    admin_session = login_user(admin_email, admin_password)
    
    if not user_session or not admin_session:
        print("❌ Failed to login test users")
        return False
    
    # Test 1: POST /api/companies with social
    print("\n1. Testing POST /api/companies with social")
    company_data = {
        "nameAr": "شركة اختبار الشبكات الاجتماعية",
        "sector": "TECH",
        "social": {
            "instagram": "@testcompany",
            "facebook": "fb.com/testcompany",
            "whatsapp": "96891234567",
            "linkedin": "linkedin.com/company/test",
            "twitter": "@testcompany",
            "tiktok": "@testcompany",
            "snapchat": "@testcompany",
            "youtube": "youtube.com/testcompany"
        }
    }
    
    response = user_session.post(f"{API_BASE}/companies", json=company_data)
    
    if response.status_code in [200, 201]:
        company = response.json().get("company", {})
        company_id = company.get("id")
        social = company.get("social", {})
        
        print("✅ Company created successfully")
        print(f"  Company ID: {company_id}")
        print(f"  Social links: {json.dumps(social, indent=2, ensure_ascii=False)}")
        
        # Verify sanitization
        expected_social = {
            "instagram": "https://www.instagram.com/testcompany/",
            "facebook": "https://fb.com/testcompany",
            "whatsapp": "+96891234567",
            "linkedin": "https://linkedin.com/company/test",
            "twitter": "https://twitter.com/testcompany",
            "tiktok": "https://www.tiktok.com/@testcompany",
            "snapchat": "https://www.snapchat.com/add/testcompany",
            "youtube": "https://youtube.com/testcompany"
        }
        
        social_correct = True
        for key, expected in expected_social.items():
            actual = social.get(key, "")
            if actual != expected:
                print(f"  ❌ {key}: expected '{expected}', got '{actual}'")
                social_correct = False
        
        if social_correct:
            print("✅ Social links sanitized correctly")
        
        # Test 2: PUT /api/companies/:id with social (owner)
        print("\n2. Testing PUT /api/companies/:id with social (owner)")
        update_data = {
            "social": {
                "instagram": "@newhandle",
                "facebook": "",  # Clear this field
                "linkedin": "https://linkedin.com/in/newprofile"
            }
        }
        
        update_response = user_session.put(f"{API_BASE}/companies/{company_id}", json=update_data)
        
        if update_response.status_code == 200:
            updated_company = update_response.json().get("company", {})
            updated_social = updated_company.get("social", {})
            
            print("✅ Company updated successfully")
            print(f"  Updated social: {json.dumps(updated_social, indent=2, ensure_ascii=False)}")
            
            # Verify updates
            if updated_social.get("instagram") == "https://www.instagram.com/newhandle/":
                print("✅ Instagram updated correctly")
            else:
                print(f"❌ Instagram not updated correctly: {updated_social.get('instagram')}")
            
            if updated_social.get("facebook") == "":
                print("✅ Facebook cleared correctly")
            else:
                print(f"❌ Facebook not cleared: {updated_social.get('facebook')}")
        else:
            print(f"❌ Company update failed: {update_response.status_code} {update_response.text}")
        
        # Test 3: PUT /api/companies/:id with social (admin preserves status)
        print("\n3. Testing PUT /api/companies/:id with social (admin)")
        
        # First approve the company as admin
        approve_response = admin_session.post(f"{API_BASE}/admin/companies/{company_id}/approve")
        if approve_response.status_code == 200:
            print("✅ Company approved by admin")
        
        # Now update as admin
        admin_update_data = {
            "social": {
                "twitter": "@adminupdated"
            }
        }
        
        admin_update_response = admin_session.put(f"{API_BASE}/companies/{company_id}", json=admin_update_data)
        
        if admin_update_response.status_code == 200:
            admin_updated_company = admin_update_response.json().get("company", {})
            print("✅ Admin update successful")
            print(f"  Status preserved: {admin_updated_company.get('status')}")
            print(f"  Twitter updated: {admin_updated_company.get('social', {}).get('twitter')}")
        else:
            print(f"❌ Admin update failed: {admin_update_response.status_code} {admin_update_response.text}")
        
        return True
    else:
        print(f"❌ Company creation failed: {response.status_code} {response.text}")
        return False

def test_expert_social_endpoints():
    """Test POST /api/experts/apply and PUT /api/experts/me with social"""
    print("\n=== Testing Expert Social Endpoints ===")
    
    # Create a GOLD tier user
    timestamp = int(time.time())
    email = f"test_expert_{timestamp}@test.com"
    user_id, email, password = create_test_user(email, role="MEMBER", tier="GOLD")
    
    session = login_user(email, password)
    if not session:
        print("❌ Failed to login expert user")
        return False
    
    # Test 1: POST /api/experts/apply with social
    print("\n1. Testing POST /api/experts/apply with social")
    expert_data = {
        "specialty": "BUSINESS",
        "hourlyRate": 25,
        "bio": "خبير في إدارة الأعمال",
        "phone": "+96891234567",
        "email": "expert@test.com",
        "website": "https://expert.com",
        "social": {
            "instagram": "@experthandle",
            "linkedin": "linkedin.com/in/expert",
            "twitter": "@expert",
            "whatsapp": "+96891234567"
        }
    }
    
    response = session.post(f"{API_BASE}/experts/apply", json=expert_data)
    
    if response.status_code in [200, 201]:
        expert_response = response.json()
        expert_id = expert_response.get("expert", {}).get("id")
        print(f"✅ Expert application submitted successfully")
        print(f"  Expert ID: {expert_id}")
        
        # Verify expert was created with social fields
        expert_doc = db.experts.find_one({"_id": expert_id})
        if expert_doc:
            social = expert_doc.get("social", {})
            print(f"  Social links: {json.dumps(social, indent=2, ensure_ascii=False)}")
            
            # Verify sanitization
            if social.get("instagram") == "https://www.instagram.com/experthandle/":
                print("✅ Instagram sanitized correctly")
            else:
                print(f"❌ Instagram not sanitized: {social.get('instagram')}")
            
            if social.get("linkedin") == "https://linkedin.com/in/expert":
                print("✅ LinkedIn sanitized correctly")
            else:
                print(f"❌ LinkedIn not sanitized: {social.get('linkedin')}")
        
        # Test 2: PUT /api/experts/me
        print("\n2. Testing PUT /api/experts/me")
        update_data = {
            "bio": "خبير محدث في إدارة الأعمال",
            "social": {
                "instagram": "@newexperthandle",
                "facebook": "facebook.com/expert",
                "linkedin": ""  # Clear this field
            },
            "phone": "+96899999999",
            "website": "https://newexpert.com"
        }
        
        update_response = session.put(f"{API_BASE}/experts/me", json=update_data)
        
        if update_response.status_code == 200:
            updated_expert = update_response.json().get("expert", {})
            print("✅ Expert profile updated successfully")
            print(f"  Updated bio: {updated_expert.get('bio')}")
            print(f"  Updated phone: {updated_expert.get('phone')}")
            print(f"  Updated website: {updated_expert.get('website')}")
            
            updated_social = updated_expert.get("social", {})
            print(f"  Updated social: {json.dumps(updated_social, indent=2, ensure_ascii=False)}")
            
            # Verify updates
            if updated_social.get("instagram") == "https://www.instagram.com/newexperthandle/":
                print("✅ Instagram updated correctly")
            else:
                print(f"❌ Instagram not updated: {updated_social.get('instagram')}")
            
            if updated_social.get("facebook") == "https://facebook.com/expert":
                print("✅ Facebook updated correctly")
            else:
                print(f"❌ Facebook not updated: {updated_social.get('facebook')}")
            
            if updated_social.get("linkedin") == "":
                print("✅ LinkedIn cleared correctly")
            else:
                print(f"❌ LinkedIn not cleared: {updated_social.get('linkedin')}")
        else:
            print(f"❌ Expert update failed: {update_response.status_code} {update_response.text}")
        
        return True
    else:
        print(f"❌ Expert application failed: {response.status_code} {response.text}")
        return False

def test_public_endpoints_include_social():
    """Test that public GET endpoints include social fields"""
    print("\n=== Testing Public Endpoints Include Social ===")
    
    # Test GET /api/companies
    print("\n1. Testing GET /api/companies includes social")
    response = requests.get(f"{API_BASE}/companies")
    
    if response.status_code == 200:
        companies = response.json().get("companies", [])
        if companies:
            first_company = companies[0]
            if "social" in first_company:
                print("✅ GET /api/companies includes social field")
                print(f"  Sample social: {json.dumps(first_company['social'], indent=2, ensure_ascii=False)}")
            else:
                print("❌ GET /api/companies missing social field")
        else:
            print("⚠️ No companies found to test")
    else:
        print(f"❌ GET /api/companies failed: {response.status_code}")
    
    # Test GET /api/experts
    print("\n2. Testing GET /api/experts includes social")
    response = requests.get(f"{API_BASE}/experts")
    
    if response.status_code == 200:
        experts = response.json()
        if experts and len(experts) > 0:
            first_expert = experts[0]
            if "social" in first_expert:
                print("✅ GET /api/experts includes social field")
                print(f"  Sample social: {json.dumps(first_expert['social'], indent=2, ensure_ascii=False)}")
            else:
                print("❌ GET /api/experts missing social field")
            
            # Check for phone, email, website fields
            for field in ["phone", "email", "website"]:
                if field in first_expert:
                    print(f"✅ GET /api/experts includes {field} field")
                else:
                    print(f"❌ GET /api/experts missing {field} field")
        else:
            print("⚠️ No experts found to test")
    else:
        print(f"❌ GET /api/experts failed: {response.status_code}")

def test_edge_cases():
    """Test sanitization edge cases"""
    print("\n=== Testing Sanitization Edge Cases ===")
    
    # Create a test user
    timestamp = int(time.time())
    email = f"test_edge_{timestamp}@test.com"
    user_id, email, password = create_test_user(email, role="MEMBER", tier="BASIC")
    
    session = login_user(email, password)
    if not session:
        print("❌ Failed to login user for edge case tests")
        return False
    
    edge_cases = [
        {
            "name": "social: null",
            "input": {"nameAr": "شركة اختبار 1", "sector": "TECH", "social": None},
            "expected_social_keys": ["instagram", "facebook", "twitter", "linkedin", "whatsapp", "tiktok", "snapchat", "youtube"]
        },
        {
            "name": "social: 'not-an-object'",
            "input": {"nameAr": "شركة اختبار 2", "sector": "TECH", "social": "not-an-object"},
            "expected_social_keys": ["instagram", "facebook", "twitter", "linkedin", "whatsapp", "tiktok", "snapchat", "youtube"]
        },
        {
            "name": "social: {}",
            "input": {"nameAr": "شركة اختبار 3", "sector": "TECH", "social": {}},
            "expected_social_keys": ["instagram", "facebook", "twitter", "linkedin", "whatsapp", "tiktok", "snapchat", "youtube"]
        },
        {
            "name": "Very long URL (should be trimmed)",
            "input": {
                "nameAr": "شركة اختبار 4", 
                "sector": "TECH", 
                "social": {"instagram": "https://www.instagram.com/" + "a" * 500}
            },
            "check_length": True
        }
    ]
    
    passed = 0
    total = len(edge_cases)
    
    for i, test_case in enumerate(edge_cases):
        print(f"\nTest {i+1}: {test_case['name']}")
        
        response = session.post(f"{API_BASE}/companies", json=test_case["input"])
        
        if response.status_code in [200, 201]:
            company = response.json().get("company", {})
            social = company.get("social", {})
            
            if "expected_social_keys" in test_case:
                # Check that all 8 keys are present
                missing_keys = []
                for key in test_case["expected_social_keys"]:
                    if key not in social:
                        missing_keys.append(key)
                
                if not missing_keys:
                    print(f"✅ All 8 social keys present")
                    # Check that all values are empty strings
                    all_empty = all(social[key] == "" for key in test_case["expected_social_keys"])
                    if all_empty:
                        print(f"✅ All social values are empty strings")
                        passed += 1
                    else:
                        print(f"❌ Not all social values are empty: {social}")
                else:
                    print(f"❌ Missing keys: {missing_keys}")
            
            elif test_case.get("check_length"):
                # Check URL length is capped
                instagram_url = social.get("instagram", "")
                if len(instagram_url) <= 300:
                    print(f"✅ URL length capped correctly: {len(instagram_url)} chars")
                    passed += 1
                else:
                    print(f"❌ URL not capped: {len(instagram_url)} chars")
        else:
            print(f"❌ API call failed: {response.status_code} {response.text}")
    
    print(f"\n=== Edge case tests: {passed}/{total} passed ===")
    return passed == total

def test_authentication_and_authorization():
    """Test authentication and authorization for social endpoints"""
    print("\n=== Testing Authentication and Authorization ===")
    
    # Test unauthenticated access
    print("\n1. Testing unauthenticated access")
    
    # PUT /api/experts/me without auth
    response = requests.put(f"{API_BASE}/experts/me", json={"bio": "test"})
    if response.status_code == 401:
        print("✅ PUT /api/experts/me returns 401 without auth")
    else:
        print(f"❌ PUT /api/experts/me should return 401, got {response.status_code}")
    
    # Test user without expert record
    print("\n2. Testing user without expert record")
    timestamp = int(time.time())
    email = f"test_noexpert_{timestamp}@test.com"
    user_id, email, password = create_test_user(email, role="MEMBER", tier="GOLD")
    
    session = login_user(email, password)
    if session:
        response = session.put(f"{API_BASE}/experts/me", json={"bio": "test"})
        if response.status_code == 404:
            print("✅ PUT /api/experts/me returns 404 for user without expert record")
        else:
            print(f"❌ PUT /api/experts/me should return 404, got {response.status_code}")
    
    # Test tier requirements for expert application
    print("\n3. Testing tier requirements for expert application")
    
    # Create FREE tier user
    free_email = f"test_free_{timestamp}@test.com"
    free_user_id, free_email, free_password = create_test_user(free_email, role="MEMBER", tier="FREE")
    
    free_session = login_user(free_email, free_password)
    if free_session:
        expert_data = {
            "specialty": "LEGAL",
            "hourlyRate": 30,
            "bio": "خبير قانوني"
        }
        
        response = free_session.post(f"{API_BASE}/experts/apply", json=expert_data)
        if response.status_code == 403:
            print("✅ Expert application blocked for FREE tier user")
        else:
            print(f"❌ Expert application should be blocked for FREE tier, got {response.status_code}")

def main():
    """Run all social media tests"""
    print("🧪 Starting Social Media Links Backend Testing")
    print(f"Base URL: {BASE_URL}")
    print(f"API Base: {API_BASE}")
    
    # Test results
    results = []
    
    try:
        # Test 1: sanitizeSocial behavior
        results.append(("sanitizeSocial behavior", test_sanitize_social_via_company()))
        
        # Test 2: Company social endpoints
        results.append(("Company social endpoints", test_company_social_endpoints()))
        
        # Test 3: Expert social endpoints
        results.append(("Expert social endpoints", test_expert_social_endpoints()))
        
        # Test 4: Public endpoints include social
        results.append(("Public endpoints include social", test_public_endpoints_include_social()))
        
        # Test 5: Edge cases
        results.append(("Edge cases", test_edge_cases()))
        
        # Test 6: Authentication and authorization
        results.append(("Authentication and authorization", test_authentication_and_authorization()))
        
    except Exception as e:
        print(f"❌ Test execution failed: {str(e)}")
        import traceback
        traceback.print_exc()
    
    # Print summary
    print("\n" + "="*60)
    print("🎯 SOCIAL MEDIA LINKS TESTING SUMMARY")
    print("="*60)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {test_name}")
        if result:
            passed += 1
    
    print(f"\nOverall: {passed}/{total} test suites passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 All social media features are working correctly!")
    else:
        print("⚠️ Some issues found. Please review the failed tests above.")
    
    return passed == total

if __name__ == "__main__":
    main()