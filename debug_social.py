#!/usr/bin/env python3
"""
Debug test for social media functionality
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

def create_test_user(email, password="Password123", role="MEMBER", tier="BASIC"):
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

def debug_social_functionality():
    """Debug social media functionality step by step"""
    print("🔍 Debugging Social Media Functionality")
    
    # Create a test user
    timestamp = int(time.time())
    email = f"debug_user_{timestamp}@test.com"
    user_id, email, password = create_test_user(email, role="MEMBER", tier="BASIC")
    
    print(f"✅ Created test user: {email}")
    
    # Login
    session = login_user(email, password)
    if not session:
        print("❌ Failed to login")
        return
    
    print("✅ Logged in successfully")
    
    # Test 1: Create company with social
    print("\n1. Testing company creation with social")
    company_data = {
        "nameAr": "شركة اختبار الشبكات الاجتماعية",
        "sector": "TECH",
        "social": {
            "instagram": "@testcompany",
            "facebook": "facebook.com/testcompany"
        }
    }
    
    print(f"Sending data: {json.dumps(company_data, indent=2, ensure_ascii=False)}")
    
    response = session.post(f"{API_BASE}/companies", json=company_data)
    print(f"Response status: {response.status_code}")
    print(f"Response body: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
    
    if response.status_code in [200, 201]:
        company = response.json().get("company", {})
        company_id = company.get("id")
        
        # Check database directly
        print(f"\n2. Checking database for company {company_id}")
        db_company = db.companies.find_one({"_id": company_id})
        if db_company:
            print(f"DB Company keys: {list(db_company.keys())}")
            if "social" in db_company:
                print(f"DB Social field: {json.dumps(db_company['social'], indent=2, ensure_ascii=False)}")
            else:
                print("❌ No social field in database")
        else:
            print("❌ Company not found in database")
        
        # Test 3: Get company via API
        print(f"\n3. Testing GET /api/companies/{company_id}")
        get_response = session.get(f"{API_BASE}/companies/{company_id}")
        print(f"GET Response status: {get_response.status_code}")
        if get_response.status_code == 200:
            get_company = get_response.json()
            print(f"GET Response keys: {list(get_company.keys())}")
            if "social" in get_company:
                print(f"GET Social field: {json.dumps(get_company['social'], indent=2, ensure_ascii=False)}")
            else:
                print("❌ No social field in GET response")
        
        # Test 4: Get companies list
        print(f"\n4. Testing GET /api/companies (list)")
        list_response = requests.get(f"{API_BASE}/companies")
        print(f"List Response status: {list_response.status_code}")
        if list_response.status_code == 200:
            companies_data = list_response.json()
            companies = companies_data.get("companies", [])
            print(f"Found {len(companies)} companies")
            
            # Find our company
            our_company = None
            for comp in companies:
                if comp.get("id") == company_id:
                    our_company = comp
                    break
            
            if our_company:
                print(f"Our company keys: {list(our_company.keys())}")
                if "social" in our_company:
                    print(f"List Social field: {json.dumps(our_company['social'], indent=2, ensure_ascii=False)}")
                else:
                    print("❌ No social field in list response")
            else:
                print("❌ Our company not found in list (might be PENDING)")

def test_expert_specialty():
    """Test expert application with correct specialty"""
    print("\n🔍 Testing Expert Application")
    
    # Create a GOLD tier user
    timestamp = int(time.time())
    email = f"expert_debug_{timestamp}@test.com"
    user_id, email, password = create_test_user(email, role="MEMBER", tier="GOLD")
    
    session = login_user(email, password)
    if not session:
        print("❌ Failed to login expert user")
        return
    
    print("✅ Logged in as GOLD user")
    
    # Test with correct specialty
    expert_data = {
        "specialty": "LEGAL",  # Use valid specialty
        "hourlyRate": 25,
        "bio": "خبير قانوني",
        "phone": "+96891234567",
        "email": "expert@test.com",
        "website": "https://expert.com",
        "social": {
            "instagram": "@experthandle",
            "linkedin": "linkedin.com/in/expert"
        }
    }
    
    print(f"Sending expert data: {json.dumps(expert_data, indent=2, ensure_ascii=False)}")
    
    response = session.post(f"{API_BASE}/experts/apply", json=expert_data)
    print(f"Expert Response status: {response.status_code}")
    print(f"Expert Response body: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
    
    if response.status_code in [200, 201]:
        expert_response = response.json()
        expert_id = expert_response.get("expert", {}).get("id")
        
        # Check database
        print(f"\nChecking expert in database: {expert_id}")
        db_expert = db.experts.find_one({"_id": expert_id})
        if db_expert:
            print(f"DB Expert keys: {list(db_expert.keys())}")
            if "social" in db_expert:
                print(f"DB Expert Social: {json.dumps(db_expert['social'], indent=2, ensure_ascii=False)}")
            else:
                print("❌ No social field in expert database")
            
            # Check other new fields
            for field in ["phone", "email", "website"]:
                if field in db_expert:
                    print(f"DB Expert {field}: {db_expert[field]}")
                else:
                    print(f"❌ No {field} field in expert database")

def main():
    print("🧪 Social Media Debug Testing")
    debug_social_functionality()
    test_expert_specialty()

if __name__ == "__main__":
    main()