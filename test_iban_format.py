#!/usr/bin/env python3
"""
Phase B Refactoring - Quick IBAN Format Test
Testing the current IBAN validation implementation
"""

import requests
import json
import time
import os
import pymongo
from bson import ObjectId
import bcrypt
import uuid
from datetime import datetime

# Get base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://omani-startup-hub.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

def get_db_connection():
    """Get MongoDB connection"""
    try:
        mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017/majles')
        client = pymongo.MongoClient(mongo_url)
        db = client.get_default_database()
        return db
    except Exception as e:
        print(f"Failed to connect to MongoDB: {e}")
        return None

def create_vendor_user():
    """Create a vendor user directly in the database"""
    db = get_db_connection()
    if db is None:
        return None, None
    
    timestamp = int(time.time())
    vendor_email = f"iban_test_{timestamp}@x.com"
    vendor_password = "Password123"
    
    # Hash password
    hashed_password = bcrypt.hashpw(vendor_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Create vendor user
    vendor_user = {
        "_id": str(uuid.uuid4()),
        "name": f"IBAN Test Vendor {timestamp}",
        "email": vendor_email,
        "password": hashed_password,
        "role": "VENDOR",
        "membershipTier": "GOLD",
        "membershipExpiry": None,
        "phone": "+968 9123 4567",
        "photo": "",
        "isGuest": False,
        "isSuspended": False,
        "suspendedReason": "",
        "suspendedAt": None,
        "vendorAbsorbsShipping": False,
        "wishlist": [],
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    
    try:
        result = db.users.insert_one(vendor_user)
        return vendor_email, vendor_password
    except Exception as e:
        print(f"Failed to create vendor user: {e}")
        return None, None

def get_auth_session(email, password):
    """Get authenticated session using NextAuth credentials"""
    session = requests.Session()
    
    # Get CSRF token
    csrf_response = session.get(f"{API_BASE}/auth/csrf")
    if csrf_response.status_code != 200:
        return None, "Failed to get CSRF token"
    
    csrf_token = csrf_response.json().get('csrfToken')
    if not csrf_token:
        return None, "No CSRF token in response"
    
    # Login with credentials
    login_data = {
        'email': email,
        'password': password,
        'csrfToken': csrf_token,
        'callbackUrl': BASE_URL,
        'json': 'true'
    }
    
    login_response = session.post(
        f"{API_BASE}/auth/callback/credentials",
        data=login_data,  # Form data, not JSON
        headers={'Content-Type': 'application/x-www-form-urlencoded'}
    )
    
    # Verify session
    me_response = session.get(f"{API_BASE}/me")
    if me_response.status_code == 200:
        user_data = me_response.json()
        return session, user_data
    
    return None, f"Authentication failed: {me_response.status_code}"

def test_iban_formats():
    """Test different IBAN formats to understand the current validation"""
    print("🧪 TESTING IBAN FORMAT VALIDATION")
    
    vendor_email, vendor_password = create_vendor_user()
    if not vendor_email:
        print("❌ Failed to create vendor user")
        return
    
    vendor_session, _ = get_auth_session(vendor_email, vendor_password)
    if not vendor_session:
        print("❌ Failed to authenticate vendor")
        return
    
    base_payout_data = {
        "amount": 50,
        "bankDetails": {
            "accountHolderName": "Test User",
            "bankName": "Test Bank"
        }
    }
    
    # Test different IBAN formats based on the regex: ^OM\d{2}[A-Z0-9]{16}$
    test_ibans = [
        ("OM12345678901234567890", "Current test format (20 chars)"),
        ("OM123456789012345678", "18 chars total"),
        ("OM12ABCD1234567890123456", "20 chars with letters"),
        ("OM12123456789012345678", "20 chars all numeric"),
        ("OM811234567890123456", "19 chars total"),
        ("OM8112345678901234567", "21 chars total"),
    ]
    
    for iban, description in test_ibans:
        payout_data = base_payout_data.copy()
        payout_data["bankDetails"]["iban"] = iban
        response = vendor_session.post(f"{API_BASE}/vendor/payouts", json=payout_data)
        
        if response.status_code == 400:
            error_msg = response.json().get('error', '')
            if 'IBAN' in error_msg:
                status = "❌ INVALID"
            elif 'الرصيد' in error_msg:
                status = "✅ VALID (failed on balance)"
            else:
                status = f"? OTHER ERROR: {error_msg}"
        else:
            status = f"✅ ACCEPTED ({response.status_code})"
        
        print(f"{status}: {iban} ({description})")

def main():
    print("🚀 IBAN FORMAT VALIDATION TEST")
    print("Testing current implementation regex: ^OM\\d{2}[A-Z0-9]{16}$")
    print("=" * 60)
    
    test_iban_formats()
    
    print("=" * 60)
    print("✅ IBAN format testing complete")

if __name__ == "__main__":
    main()