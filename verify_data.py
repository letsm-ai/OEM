#!/usr/bin/env python3
"""
Data integrity verification script
"""

import requests
import re

BASE_URL = "https://6f3dfdf5-cfdd-488c-a9a0-63f293d4ee0d.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

def verify_data_integrity():
    """Verify user data integrity"""
    print("=== Data Integrity Verification ===")
    
    # Create a user and check the response structure
    import time
    timestamp = int(time.time())
    test_user = {
        "name": "فاطمة أحمد",
        "email": f"fatima.test.{timestamp}@example.com",
        "password": "securepass123"
    }
    
    try:
        # Create user
        response = requests.post(
            f"{API_BASE}/signup",
            json=test_user,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            user = data.get("user", {})
            
            # Check UUID format (should be string, not ObjectId)
            user_id = user.get("id")
            uuid_pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            
            if user_id and re.match(uuid_pattern, user_id):
                print(f"✅ User ID is valid UUID: {user_id}")
            else:
                print(f"❌ User ID is not valid UUID: {user_id}")
            
            # Check required fields
            required_fields = ["id", "name", "email", "role", "membershipTier"]
            missing_fields = [field for field in required_fields if not user.get(field)]
            
            if not missing_fields:
                print("✅ All required fields present")
            else:
                print(f"❌ Missing fields: {missing_fields}")
            
            # Check default values
            if user.get("role") == "MEMBER":
                print("✅ Default role is MEMBER")
            else:
                print(f"❌ Default role is not MEMBER: {user.get('role')}")
                
            if user.get("membershipTier") == "FREE":
                print("✅ Default membershipTier is FREE")
            else:
                print(f"❌ Default membershipTier is not FREE: {user.get('membershipTier')}")
            
            # Check password is not included
            if "password" not in user:
                print("✅ Password not included in response")
            else:
                print("❌ Password included in response")
            
            print(f"User data structure: {user}")
            
        else:
            print(f"❌ Failed to create user: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Exception: {str(e)}")

if __name__ == "__main__":
    verify_data_integrity()