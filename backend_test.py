#!/usr/bin/env python3
"""
Backend test for Thawani Payment Integration - Membership Subscriptions
Tests the three endpoints with focus on webhook (which doesn't require auth)
"""

import requests
import json
import time
import hmac
import hashlib
from datetime import datetime, timedelta
from pymongo import MongoClient
import bcrypt

# Configuration
BASE_URL = "http://localhost:3000"
API_BASE = f"{BASE_URL}/api"
MONGO_URL = "mongodb://localhost:27017/majles"
WEBHOOK_SECRET = "whsec_En5ST9J899HlRYvQw3i9Xio9VZj0MR"

def get_mongo_client():
    """Get MongoDB client"""
    return MongoClient(MONGO_URL)

def compute_hmac_signature(raw_body, timestamp, secret):
    """Compute HMAC-SHA256 signature for Thawani webhook"""
    text = f"{raw_body}-{timestamp}"
    signature = hmac.new(
        secret.encode('ascii'),
        text.encode('ascii'),
        hashlib.sha256
    ).hexdigest()
    return signature

def test_subscribe_unauthenticated():
    """Test A1: POST /api/membership/subscribe without auth"""
    print("\n" + "="*80)
    print("TEST A1: POST /api/membership/subscribe (Unauthenticated)")
    print("="*80)
    
    try:
        response = requests.post(f"{API_BASE}/membership/subscribe", json={"tier": "BASIC"})
        if response.status_code == 401:
            print("✅ A1 PASSED: Unauthenticated request returns 401")
            return True
        else:
            print(f"❌ A1 FAILED: Expected 401, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ A1 FAILED: {e}")
        return False

def test_verify_unauthenticated():
    """Test B1: POST /api/membership/verify without auth"""
    print("\n" + "="*80)
    print("TEST B1: POST /api/membership/verify (Unauthenticated)")
    print("="*80)
    
    try:
        response = requests.post(f"{API_BASE}/membership/verify", json={"membershipId": "test"})
        if response.status_code == 401:
            print("✅ B1 PASSED: Unauthenticated request returns 401")
            return True
        else:
            print(f"❌ B1 FAILED: Expected 401, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ B1 FAILED: {e}")
        return False

def test_webhook_signature_validation():
    """Test C1: Webhook signature validation"""
    print("\n" + "="*80)
    print("TEST C1: POST /api/webhooks/thawani (Signature Validation)")
    print("="*80)
    
    results = {"no_signature": False, "bad_signature": False}
    
    payload = {"event_type": "checkout.completed", "data": {}}
    raw_body = json.dumps(payload)
    timestamp = str(int(time.time()))
    
    # Test with no signature
    try:
        response = requests.post(
            f"{API_BASE}/webhooks/thawani",
            data=raw_body,
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 401:
            print("✅ C1a PASSED: No signature returns 401")
            results["no_signature"] = True
        else:
            print(f"❌ C1a FAILED: Expected 401, got {response.status_code}")
    except Exception as e:
        print(f"❌ C1a FAILED: {e}")
    
    # Test with bad signature
    try:
        response = requests.post(
            f"{API_BASE}/webhooks/thawani",
            data=raw_body,
            headers={
                "Content-Type": "application/json",
                "thawani-signature": "bad_signature",
                "thawani-timestamp": timestamp
            }
        )
        if response.status_code == 401:
            print("✅ C1b PASSED: Bad signature returns 401")
            results["bad_signature"] = True
        else:
            print(f"❌ C1b FAILED: Expected 401, got {response.status_code}")
    except Exception as e:
        print(f"❌ C1b FAILED: {e}")
    
    return results["no_signature"] and results["bad_signature"]

def test_webhook_checkout_completed():
    """Test C2: Webhook checkout.completed event"""
    print("\n" + "="*80)
    print("TEST C2: POST /api/webhooks/thawani (checkout.completed)")
    print("="*80)
    
    try:
        # Create a test user and PENDING membership directly in DB
        client = get_mongo_client()
        db = client["majles"]
        
        timestamp = int(time.time())
        user_id = f"test_user_webhook_{timestamp}"
        
        # Create user
        hashed = bcrypt.hashpw("Password123".encode('utf-8'), bcrypt.gensalt())
        user_doc = {
            "_id": user_id,
            "name": f"Test User {timestamp}",
            "email": f"test_webhook_{timestamp}@test.com",
            "password": hashed.decode('utf-8'),
            "role": "MEMBER",
            "membershipTier": "FREE",
            "membershipExpiry": None,
            "phone": "",
            "photo": "",
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        db.users.insert_one(user_doc)
        print(f"✅ Created test user: {user_doc['email']}")
        
        # Create PENDING membership
        now = datetime.utcnow()
        end_date = now + timedelta(days=365)
        membership_id = f"test_mem_{timestamp}"
        session_id = f"test_session_{timestamp}"
        
        membership_doc = {
            "_id": membership_id,
            "userId": user_id,
            "tier": "BASIC",
            "startDate": now,
            "endDate": end_date,
            "amountPaid": 50,
            "paymentStatus": "PENDING",
            "thawaniSessionId": session_id,
            "createdAt": now,
            "updatedAt": now
        }
        db.memberships.insert_one(membership_doc)
        print(f"✅ Created PENDING membership: {membership_id}")
        
        # Send webhook with valid HMAC
        payload = {
            "event_type": "checkout.completed",
            "data": {
                "session_id": session_id,
                "metadata": {
                    "kind": "membership",
                    "membership_id": membership_id
                }
            }
        }
        raw_body = json.dumps(payload)
        webhook_timestamp = str(int(time.time()))
        signature = compute_hmac_signature(raw_body, webhook_timestamp, WEBHOOK_SECRET)
        
        response = requests.post(
            f"{API_BASE}/webhooks/thawani",
            data=raw_body,
            headers={
                "Content-Type": "application/json",
                "thawani-signature": signature,
                "thawani-timestamp": webhook_timestamp
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("received") == True:
                print("✅ C2 WEBHOOK RECEIVED: 200 with received:true")
                
                # Wait for async processing
                time.sleep(2)
                
                # Verify DB changes
                membership = db.memberships.find_one({"_id": membership_id})
                user = db.users.find_one({"_id": user_id})
                
                if not membership:
                    print("❌ C2 FAILED: Membership not found in DB")
                    return False
                
                if not user:
                    print("❌ C2 FAILED: User not found in DB")
                    return False
                
                # Check membership status
                if membership.get("paymentStatus") != "PAID":
                    print(f"❌ C2 FAILED: Membership.paymentStatus should be PAID, got {membership.get('paymentStatus')}")
                    return False
                
                print(f"✅ C2 DB CHECK: Membership.paymentStatus = {membership.get('paymentStatus')}")
                
                # Check user tier
                if user.get("membershipTier") != "BASIC":
                    print(f"❌ C2 FAILED: User.membershipTier should be BASIC, got {user.get('membershipTier')}")
                    return False
                
                print(f"✅ C2 DB CHECK: User.membershipTier = {user.get('membershipTier')}")
                
                # Check user expiry
                if not user.get("membershipExpiry"):
                    print(f"❌ C2 FAILED: User.membershipExpiry not set")
                    return False
                
                print(f"✅ C2 DB CHECK: User.membershipExpiry = {user.get('membershipExpiry')}")
                
                print("✅ C2 PASSED: checkout.completed activates membership correctly")
                return True
            else:
                print(f"❌ C2 FAILED: Response incorrect: {data}")
                return False
        else:
            print(f"❌ C2 FAILED: Expected 200, got {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ C2 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_webhook_idempotency():
    """Test C3: Webhook idempotency"""
    print("\n" + "="*80)
    print("TEST C3: POST /api/webhooks/thawani (Idempotency)")
    print("="*80)
    
    try:
        # Create a test user and PAID membership
        client = get_mongo_client()
        db = client["majles"]
        
        timestamp = int(time.time())
        user_id = f"test_user_idempotent_{timestamp}"
        
        # Create user
        hashed = bcrypt.hashpw("Password123".encode('utf-8'), bcrypt.gensalt())
        user_doc = {
            "_id": user_id,
            "name": f"Test User {timestamp}",
            "email": f"test_idempotent_{timestamp}@test.com",
            "password": hashed.decode('utf-8'),
            "role": "MEMBER",
            "membershipTier": "BASIC",  # Already activated
            "membershipExpiry": datetime.utcnow() + timedelta(days=365),
            "phone": "",
            "photo": "",
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        db.users.insert_one(user_doc)
        
        # Create PAID membership
        now = datetime.utcnow()
        end_date = now + timedelta(days=365)
        membership_id = f"test_mem_paid_{timestamp}"
        session_id = f"test_session_paid_{timestamp}"
        
        membership_doc = {
            "_id": membership_id,
            "userId": user_id,
            "tier": "BASIC",
            "startDate": now,
            "endDate": end_date,
            "amountPaid": 50,
            "paymentStatus": "PAID",  # Already paid
            "thawaniSessionId": session_id,
            "createdAt": now,
            "updatedAt": now
        }
        db.memberships.insert_one(membership_doc)
        print(f"✅ Created PAID membership: {membership_id}")
        
        # Send webhook (replay)
        payload = {
            "event_type": "checkout.completed",
            "data": {
                "session_id": session_id,
                "metadata": {
                    "kind": "membership",
                    "membership_id": membership_id
                }
            }
        }
        raw_body = json.dumps(payload)
        webhook_timestamp = str(int(time.time()))
        signature = compute_hmac_signature(raw_body, webhook_timestamp, WEBHOOK_SECRET)
        
        response = requests.post(
            f"{API_BASE}/webhooks/thawani",
            data=raw_body,
            headers={
                "Content-Type": "application/json",
                "thawani-signature": signature,
                "thawani-timestamp": webhook_timestamp
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("received") == True:
                print("✅ C3 WEBHOOK RECEIVED: 200 with received:true (idempotent)")
                
                # Wait a bit
                time.sleep(1)
                
                # Verify DB unchanged
                membership = db.memberships.find_one({"_id": membership_id})
                user = db.users.find_one({"_id": user_id})
                
                if (membership and membership.get("paymentStatus") == "PAID" and
                    user and user.get("membershipTier") == "BASIC"):
                    print("✅ C3 PASSED: Replay doesn't re-modify (idempotent)")
                    return True
                else:
                    print(f"❌ C3 FAILED: DB state changed unexpectedly")
                    return False
            else:
                print(f"❌ C3 FAILED: Response incorrect: {data}")
                return False
        else:
            print(f"❌ C3 FAILED: Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ C3 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_webhook_payment_failed():
    """Test C4: Webhook payment.failed event"""
    print("\n" + "="*80)
    print("TEST C4: POST /api/webhooks/thawani (payment.failed)")
    print("="*80)
    
    try:
        # Create a test user and PENDING membership
        client = get_mongo_client()
        db = client["majles"]
        
        timestamp = int(time.time())
        user_id = f"test_user_failed_{timestamp}"
        
        # Create user
        hashed = bcrypt.hashpw("Password123".encode('utf-8'), bcrypt.gensalt())
        user_doc = {
            "_id": user_id,
            "name": f"Test User {timestamp}",
            "email": f"test_failed_{timestamp}@test.com",
            "password": hashed.decode('utf-8'),
            "role": "MEMBER",
            "membershipTier": "FREE",
            "membershipExpiry": None,
            "phone": "",
            "photo": "",
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        db.users.insert_one(user_doc)
        
        # Create PENDING membership
        now = datetime.utcnow()
        end_date = now + timedelta(days=365)
        membership_id = f"test_mem_fail_{timestamp}"
        session_id = f"test_session_fail_{timestamp}"
        
        membership_doc = {
            "_id": membership_id,
            "userId": user_id,
            "tier": "GOLD",
            "startDate": now,
            "endDate": end_date,
            "amountPaid": 100,
            "paymentStatus": "PENDING",
            "thawaniSessionId": session_id,
            "createdAt": now,
            "updatedAt": now
        }
        db.memberships.insert_one(membership_doc)
        print(f"✅ Created PENDING membership: {membership_id}")
        print(f"   User tier before: {user_doc['membershipTier']}")
        
        # Send payment.failed webhook
        payload = {
            "event_type": "payment.failed",
            "data": {
                "session_id": session_id,
                "client_reference_id": f"mem_{membership_id}"
            }
        }
        raw_body = json.dumps(payload)
        webhook_timestamp = str(int(time.time()))
        signature = compute_hmac_signature(raw_body, webhook_timestamp, WEBHOOK_SECRET)
        
        response = requests.post(
            f"{API_BASE}/webhooks/thawani",
            data=raw_body,
            headers={
                "Content-Type": "application/json",
                "thawani-signature": signature,
                "thawani-timestamp": webhook_timestamp
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("received") == True:
                print("✅ C4 WEBHOOK RECEIVED: 200 with received:true")
                
                # Wait for async processing
                time.sleep(1)
                
                # Verify DB changes
                membership = db.memberships.find_one({"_id": membership_id})
                user = db.users.find_one({"_id": user_id})
                
                if not membership:
                    print("❌ C4 FAILED: Membership not found in DB")
                    return False
                
                if not user:
                    print("❌ C4 FAILED: User not found in DB")
                    return False
                
                # Check membership status changed to FAILED
                if membership.get("paymentStatus") != "FAILED":
                    print(f"❌ C4 FAILED: Membership.paymentStatus should be FAILED, got {membership.get('paymentStatus')}")
                    return False
                
                print(f"✅ C4 DB CHECK: Membership.paymentStatus = {membership.get('paymentStatus')}")
                
                # Check user tier UNCHANGED (still FREE)
                if user.get("membershipTier") != "FREE":
                    print(f"❌ C4 FAILED: User.membershipTier should remain FREE, got {user.get('membershipTier')}")
                    return False
                
                print(f"✅ C4 DB CHECK: User.membershipTier = {user.get('membershipTier')} (unchanged)")
                
                print("✅ C4 PASSED: payment.failed sets membership to FAILED, user tier unchanged")
                return True
            else:
                print(f"❌ C4 FAILED: Response incorrect: {data}")
                return False
        else:
            print(f"❌ C4 FAILED: Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ C4 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Main test runner"""
    print("="*80)
    print("THAWANI PAYMENT INTEGRATION - MEMBERSHIP SUBSCRIPTIONS TEST")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"MongoDB: {MONGO_URL}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("\nNOTE: Authentication tests (A2-A6, B2-B5) require NextAuth session")
    print("      which cannot be easily automated. Testing unauthenticated")
    print("      endpoints and webhook functionality.")
    
    results = {}
    
    # Test A1: Subscribe unauthenticated
    results["A1_subscribe_unauth"] = test_subscribe_unauthenticated()
    
    # Test B1: Verify unauthenticated
    results["B1_verify_unauth"] = test_verify_unauthenticated()
    
    # Test C1: Webhook signature validation
    results["C1_webhook_signature"] = test_webhook_signature_validation()
    
    # Test C2: Webhook checkout.completed
    results["C2_webhook_completed"] = test_webhook_checkout_completed()
    
    # Test C3: Webhook idempotency
    results["C3_webhook_idempotency"] = test_webhook_idempotency()
    
    # Test C4: Webhook payment.failed
    results["C4_webhook_failed"] = test_webhook_payment_failed()
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, passed_flag in results.items():
        status = "✅ PASSED" if passed_flag else "❌ FAILED"
        print(f"{status}: {test_name}")
    
    print(f"\n{'='*80}")
    print(f"TOTAL: {passed}/{total} tests passed ({int(passed/total*100)}%)")
    print(f"{'='*80}\n")
    
    print("\n📝 AUTHENTICATION NOTE:")
    print("   The following tests require authenticated sessions and cannot be")
    print("   easily automated with NextAuth's browser-based flow:")
    print("   - A2-A6: Subscribe endpoint with various tiers")
    print("   - B2-B5: Verify endpoint with various scenarios")
    print("   These should be tested manually or with a browser automation tool.")

if __name__ == "__main__":
    main()
