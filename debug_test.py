#!/usr/bin/env python3
"""
Phase C Backend Testing - Debug version to investigate failures
"""

import requests
import json
import time
import uuid
from datetime import datetime

# Configuration
BASE_URL = "https://omani-startup-hub.preview.emergentagent.com/api"
CRON_SECRET = "fcb09a9f909c3ea848c026041b3b3d3069beba9da6848e56"

def log(message):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

def create_test_user(role="VENDOR"):
    """Create a fresh test user with timestamped email"""
    session = requests.Session()
    session.headers.update({'Content-Type': 'application/json'})
    
    timestamp = int(time.time())
    email = f"phasec_debug_{role.lower()}_{timestamp}@test.com"
    password = "Password123"
    
    # Create user
    signup_data = {
        "name": f"Phase C Debug {role} User",
        "email": email,
        "password": password
    }
    
    response = session.post(f"{BASE_URL}/signup", json=signup_data)
    if response.status_code != 200:
        raise Exception(f"Failed to create user: {response.text}")
        
    # Login to get session
    csrf_response = session.get(f"{BASE_URL}/auth/csrf")
    csrf_token = csrf_response.json().get('csrfToken')
    
    login_response = session.post(
        f"{BASE_URL}/auth/callback/credentials",
        data={
            "email": email,
            "password": password,
            "csrfToken": csrf_token,
            "callbackUrl": "/",
            "json": "true"
        },
        headers={'Content-Type': 'application/x-www-form-urlencoded'}
    )
    
    if login_response.status_code != 200:
        raise Exception(f"Failed to login: {login_response.text}")
        
    # Get session cookies
    session_cookies = {}
    for cookie in session.cookies:
        session_cookies[cookie.name] = cookie.value
        
    # Create authenticated session
    auth_session = requests.Session()
    auth_session.cookies.update(session_cookies)
    auth_session.headers.update({'Content-Type': 'application/json'})
    
    return {
        "email": email,
        "user_id": response.json()["user"]["id"],
        "session": auth_session
    }

def test_abandoned_cart_cron_debug():
    """Debug the abandoned cart cron test"""
    log("🔍 DEBUGGING ABANDONED CART CRON")
    
    try:
        # Create admin user
        admin_user = create_test_user("ADMIN")
        
        # Promote to admin via MongoDB
        import pymongo
        client = pymongo.MongoClient("mongodb://localhost:27017/")
        db = client["majles"]
        
        db.users.update_one(
            {"_id": admin_user["user_id"]},
            {"$set": {"role": "ADMIN"}}
        )
        client.close()
        
        log(f"✅ Created admin user: {admin_user['email']}")
        
        # Test 4: Admin session authorization
        response = admin_user["session"].post(f"{BASE_URL}/cron/abandoned-carts")
        log(f"Admin session response: {response.status_code}")
        if response.status_code != 200:
            log(f"Error: {response.text}")
            return False
        
        result = response.json()
        log(f"Admin session result: {result}")
        return True
        
    except Exception as e:
        log(f"❌ Debug failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_vendor_analytics_debug():
    """Debug the vendor analytics test"""
    log("🔍 DEBUGGING VENDOR ANALYTICS")
    
    try:
        # Create vendor user
        vendor_user = create_test_user("VENDOR")
        
        # Promote to vendor via MongoDB
        import pymongo
        client = pymongo.MongoClient("mongodb://localhost:27017/")
        db = client["majles"]
        
        db.users.update_one(
            {"_id": vendor_user["user_id"]},
            {"$set": {"role": "VENDOR", "membershipTier": "GOLD"}}
        )
        client.close()
        
        log(f"✅ Created vendor user: {vendor_user['email']}")
        
        # Test vendor analytics
        response = vendor_user["session"].get(f"{BASE_URL}/vendor/analytics")
        log(f"Vendor analytics response: {response.status_code}")
        if response.status_code != 200:
            log(f"Error: {response.text}")
            return False
        
        result = response.json()
        log(f"Analytics keys: {list(result.keys())}")
        
        # Check required fields
        required_fields = [
            "generatedAt", "kpi", "last30Days", "products", 
            "pendingShipments", "monthly", "topProducts", 
            "byCategory", "orderStatus"
        ]
        
        missing_fields = []
        for field in required_fields:
            if field not in result:
                missing_fields.append(field)
        
        if missing_fields:
            log(f"❌ Missing fields: {missing_fields}")
            return False
        
        log("✅ All required fields present")
        return True
        
    except Exception as e:
        log(f"❌ Debug failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    log("🔍 STARTING DEBUG TESTS")
    
    # Test 1: Abandoned cart cron
    result1 = test_abandoned_cart_cron_debug()
    log(f"Abandoned cart cron debug: {'✅ PASSED' if result1 else '❌ FAILED'}")
    
    # Test 2: Vendor analytics
    result2 = test_vendor_analytics_debug()
    log(f"Vendor analytics debug: {'✅ PASSED' if result2 else '❌ FAILED'}")
    
    log(f"🎯 DEBUG SUMMARY: {sum([result1, result2])}/2 tests passed")