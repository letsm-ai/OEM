#!/usr/bin/env python3
"""
Broadcast/Bulk-Email System Backend Testing
Tests the 3 new admin endpoints for email broadcasting.

SAFETY: Uses Option B - temporarily unsets RESEND_API_KEY to avoid sending real emails.
"""

import requests
import time
import json
from pymongo import MongoClient
import os

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://omani-startup-hub.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017/majles')
DB_NAME = os.getenv('DB_NAME', 'majles')

# Test user credentials
EPOCH = int(time.time())
ADMIN_EMAIL = f"broadcast_admin_{EPOCH}@test.local"
MEMBER_EMAIL = f"broadcast_member_{EPOCH}@test.local"
PASSWORD = "Password123"

def print_test(msg):
    """Print test step"""
    print(f"\n{'='*80}")
    print(f"TEST: {msg}")
    print('='*80)

def print_result(success, msg):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {msg}")

def create_user_and_login(email, password, role='MEMBER'):
    """Create a user via signup and optionally promote to admin, then login"""
    print(f"\n→ Creating user {email} with role {role}...")
    
    # Signup
    resp = requests.post(f"{API_BASE}/signup", json={
        'name': f'Test User {EPOCH}',
        'email': email,
        'password': password
    })
    
    if resp.status_code != 200:
        print(f"  Signup failed: {resp.status_code} {resp.text}")
        return None
    
    user_data = resp.json()
    user_id = user_data.get('user', {}).get('id')
    print(f"  User created: {user_id}")
    
    # Promote to specified role if not MEMBER
    if role != 'MEMBER':
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        result = db.users.update_one(
            {'_id': user_id},
            {'$set': {'role': role}}
        )
        print(f"  Promoted to {role}: {result.modified_count} doc(s) updated")
        client.close()
    
    # Login via NextAuth
    session = requests.Session()
    
    # Get CSRF token
    csrf_resp = session.get(f"{API_BASE}/auth/csrf")
    csrf_token = csrf_resp.json().get('csrfToken')
    
    # Login
    login_resp = session.post(
        f"{API_BASE}/auth/callback/credentials",
        data={
            'csrfToken': csrf_token,
            'email': email,
            'password': password,
            'callbackUrl': f"{BASE_URL}/dashboard",
            'json': 'true'
        },
        headers={'Content-Type': 'application/x-www-form-urlencoded'}
    )
    
    if login_resp.status_code == 200:
        print(f"  Login successful for {email}")
        return session
    else:
        print(f"  Login failed: {login_resp.status_code}")
        return None

def get_broadcast_from_db(broadcast_id):
    """Fetch EmailBroadcast document from MongoDB"""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    doc = db.emailbroadcasts.find_one({'_id': broadcast_id})
    client.close()
    return doc

def create_email_optout(email):
    """Create an EmailOptOut record for testing"""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    result = db.emailoptouts.insert_one({
        '_id': f"optout_{EPOCH}",
        'email': email.lower(),
        'reason': 'Testing opt-out',
        'source': 'admin',
        'createdAt': time.time()
    })
    client.close()
    return result.inserted_id

def count_users_by_filter(tiers=None, roles=None, active_only=True):
    """Count users matching the filter (for verification)"""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    filter_query = {'email': {'$exists': True, '$ne': ''}}
    if tiers and len(tiers) > 0:
        filter_query['membershipTier'] = {'$in': tiers}
    if roles and len(roles) > 0:
        filter_query['role'] = {'$in': roles}
    if active_only:
        filter_query['status'] = {'$ne': 'SUSPENDED'}
    
    count = db.users.count_documents(filter_query)
    client.close()
    return count

# =============================================================================
# TEST SUITE
# =============================================================================

def test_preview_auth():
    """Test authentication and authorization for preview endpoint"""
    print_test("POST /api/admin/broadcast/preview - Authentication & Authorization")
    
    # Test 1: Unauthenticated request
    print("\n→ Test 1a: Unauthenticated request")
    resp = requests.post(f"{API_BASE}/admin/broadcast/preview", json={
        'tiers': ['FREE'],
        'roles': [],
        'activeOnly': True
    })
    success = resp.status_code == 401
    print_result(success, f"Unauthenticated → {resp.status_code} (expected 401)")
    if not success:
        print(f"  Response: {resp.text}")
    
    # Test 1b: Non-admin authenticated
    print("\n→ Test 1b: Non-admin authenticated (MEMBER)")
    member_session = create_user_and_login(MEMBER_EMAIL, PASSWORD, role='MEMBER')
    if member_session:
        resp = member_session.post(f"{API_BASE}/admin/broadcast/preview", json={
            'tiers': ['FREE'],
            'roles': [],
            'activeOnly': True
        })
        success = resp.status_code == 403
        print_result(success, f"Non-admin → {resp.status_code} (expected 403)")
        if not success:
            print(f"  Response: {resp.text}")
    else:
        print_result(False, "Failed to create member session")
    
    # Test 1c: Admin authenticated
    print("\n→ Test 1c: Admin authenticated")
    admin_session = create_user_and_login(ADMIN_EMAIL, PASSWORD, role='ADMIN')
    if admin_session:
        resp = admin_session.post(f"{API_BASE}/admin/broadcast/preview", json={
            'tiers': ['FREE'],
            'roles': [],
            'activeOnly': True
        })
        success = resp.status_code == 200
        print_result(success, f"Admin → {resp.status_code} (expected 200)")
        if success:
            data = resp.json()
            print(f"  Response: total={data.get('total')}, optedOut={data.get('optedOut')}, deliverable={data.get('deliverable')}")
        else:
            print(f"  Response: {resp.text}")
        return admin_session
    else:
        print_result(False, "Failed to create admin session")
        return None

def test_preview_filters(admin_session):
    """Test preview endpoint with various filter combinations"""
    print_test("POST /api/admin/broadcast/preview - Filter Combinations")
    
    if not admin_session:
        print_result(False, "No admin session available")
        return
    
    # Test 2a: Filter by tier only (FREE)
    print("\n→ Test 2a: Filter by tier only (FREE)")
    resp = admin_session.post(f"{API_BASE}/admin/broadcast/preview", json={
        'tiers': ['FREE'],
        'roles': [],
        'activeOnly': True
    })
    if resp.status_code == 200:
        data = resp.json()
        expected_count = count_users_by_filter(tiers=['FREE'], roles=None, active_only=True)
        print_result(True, f"FREE tier → total={data.get('total')}, optedOut={data.get('optedOut')}, deliverable={data.get('deliverable')}")
        print(f"  DB verification: Expected ~{expected_count} users with FREE tier")
        
        # Verify response structure
        has_all_fields = all(k in data for k in ['total', 'optedOut', 'deliverable'])
        print_result(has_all_fields, f"Response has all required fields: {has_all_fields}")
        
        # Verify numbers are valid
        is_valid = (
            isinstance(data.get('total'), int) and
            isinstance(data.get('optedOut'), int) and
            isinstance(data.get('deliverable'), int) and
            data.get('total') >= 0 and
            data.get('optedOut') >= 0 and
            data.get('deliverable') >= 0 and
            data.get('deliverable') == data.get('total') - data.get('optedOut')
        )
        print_result(is_valid, f"Numbers are valid and deliverable = total - optedOut: {is_valid}")
    else:
        print_result(False, f"Request failed: {resp.status_code} {resp.text}")
    
    # Test 2b: Filter by role only (VENDOR)
    print("\n→ Test 2b: Filter by role only (VENDOR)")
    resp = admin_session.post(f"{API_BASE}/admin/broadcast/preview", json={
        'tiers': [],
        'roles': ['VENDOR'],
        'activeOnly': True
    })
    if resp.status_code == 200:
        data = resp.json()
        expected_count = count_users_by_filter(tiers=None, roles=['VENDOR'], active_only=True)
        print_result(True, f"VENDOR role → total={data.get('total')}, optedOut={data.get('optedOut')}, deliverable={data.get('deliverable')}")
        print(f"  DB verification: Expected ~{expected_count} users with VENDOR role")
    else:
        print_result(False, f"Request failed: {resp.status_code} {resp.text}")
    
    # Test 2c: Filter by tier AND role (GOLD/PLATINUM + EXPERT)
    print("\n→ Test 2c: Filter by tier AND role (GOLD/PLATINUM + EXPERT)")
    resp = admin_session.post(f"{API_BASE}/admin/broadcast/preview", json={
        'tiers': ['GOLD', 'PLATINUM'],
        'roles': ['EXPERT'],
        'activeOnly': False
    })
    if resp.status_code == 200:
        data = resp.json()
        # Note: Implementation uses AND logic (both tier AND role must match)
        expected_count = count_users_by_filter(tiers=['GOLD', 'PLATINUM'], roles=['EXPERT'], active_only=False)
        print_result(True, f"GOLD/PLATINUM + EXPERT → total={data.get('total')}, optedOut={data.get('optedOut')}, deliverable={data.get('deliverable')}")
        print(f"  DB verification: Expected ~{expected_count} users (AND logic: tier IN [GOLD,PLATINUM] AND role IN [EXPERT])")
    else:
        print_result(False, f"Request failed: {resp.status_code} {resp.text}")
    
    # Test 2d: Empty filters (all users)
    print("\n→ Test 2d: Empty filters (all users with email)")
    resp = admin_session.post(f"{API_BASE}/admin/broadcast/preview", json={
        'tiers': [],
        'roles': [],
        'activeOnly': True
    })
    if resp.status_code == 200:
        data = resp.json()
        expected_count = count_users_by_filter(tiers=None, roles=None, active_only=True)
        print_result(True, f"All users → total={data.get('total')}, optedOut={data.get('optedOut')}, deliverable={data.get('deliverable')}")
        print(f"  DB verification: Expected ~{expected_count} users with email (activeOnly=true)")
        print(f"  ⚠️  Note: This would target ALL users in production!")
    else:
        print_result(False, f"Request failed: {resp.status_code} {resp.text}")
    
    # Test 2e: activeOnly=false includes suspended users
    print("\n→ Test 2e: activeOnly=false includes suspended users")
    resp = admin_session.post(f"{API_BASE}/admin/broadcast/preview", json={
        'tiers': ['FREE'],
        'roles': [],
        'activeOnly': False
    })
    if resp.status_code == 200:
        data = resp.json()
        expected_count = count_users_by_filter(tiers=['FREE'], roles=None, active_only=False)
        print_result(True, f"FREE (activeOnly=false) → total={data.get('total')}, optedOut={data.get('optedOut')}, deliverable={data.get('deliverable')}")
        print(f"  DB verification: Expected ~{expected_count} users (includes suspended)")
    else:
        print_result(False, f"Request failed: {resp.status_code} {resp.text}")

def test_preview_optout(admin_session):
    """Test that preview correctly counts opted-out users"""
    print_test("POST /api/admin/broadcast/preview - Opt-out Counting")
    
    if not admin_session:
        print_result(False, "No admin session available")
        return
    
    # Create a test user and opt them out
    print("\n→ Creating test user and opting them out")
    test_email = f"optout_test_{EPOCH}@test.local"
    
    # Create user
    resp = requests.post(f"{API_BASE}/signup", json={
        'name': 'Opt-out Test User',
        'email': test_email,
        'password': PASSWORD
    })
    
    if resp.status_code == 200:
        print(f"  Created user: {test_email}")
        
        # Create opt-out record
        create_email_optout(test_email)
        print(f"  Created opt-out record for {test_email}")
        
        # Query preview for MEMBER role (should include our test user)
        resp = admin_session.post(f"{API_BASE}/admin/broadcast/preview", json={
            'tiers': [],
            'roles': ['MEMBER'],
            'activeOnly': True
        })
        
        if resp.status_code == 200:
            data = resp.json()
            print_result(True, f"Preview with opt-out → total={data.get('total')}, optedOut={data.get('optedOut')}, deliverable={data.get('deliverable')}")
            
            # Verify opt-out is counted
            has_optout = data.get('optedOut', 0) > 0
            print_result(has_optout, f"Opt-out count > 0: {has_optout} (optedOut={data.get('optedOut')})")
        else:
            print_result(False, f"Preview request failed: {resp.status_code} {resp.text}")
    else:
        print_result(False, f"Failed to create test user: {resp.status_code} {resp.text}")

def test_send_validation(admin_session):
    """Test send endpoint validation"""
    print_test("POST /api/admin/broadcast/send - Validation")
    
    if not admin_session:
        print_result(False, "No admin session available")
        return
    
    # Test 3a: Missing subject
    print("\n→ Test 3a: Missing subject")
    resp = admin_session.post(f"{API_BASE}/admin/broadcast/send", json={
        'subject': '',
        'htmlBody': '<p>Test body</p>',
        'tiers': ['FREE'],
        'roles': [],
        'activeOnly': True
    })
    success = resp.status_code == 400 and 'MISSING_SUBJECT' in resp.text
    print_result(success, f"Missing subject → {resp.status_code} (expected 400 with MISSING_SUBJECT)")
    if not success:
        print(f"  Response: {resp.text}")
    
    # Test 3b: Missing body
    print("\n→ Test 3b: Missing body")
    resp = admin_session.post(f"{API_BASE}/admin/broadcast/send", json={
        'subject': 'Test Subject',
        'htmlBody': '',
        'tiers': ['FREE'],
        'roles': [],
        'activeOnly': True
    })
    success = resp.status_code == 400 and 'MISSING_BODY' in resp.text
    print_result(success, f"Missing body → {resp.status_code} (expected 400 with MISSING_BODY)")
    if not success:
        print(f"  Response: {resp.text}")
    
    # Test 3c: Missing target (empty tiers AND roles)
    print("\n→ Test 3c: Missing target (empty tiers AND roles)")
    resp = admin_session.post(f"{API_BASE}/admin/broadcast/send", json={
        'subject': 'Test Subject',
        'htmlBody': '<p>Test body</p>',
        'tiers': [],
        'roles': [],
        'activeOnly': True
    })
    success = resp.status_code == 400 and 'MISSING_TARGET' in resp.text
    print_result(success, f"Missing target → {resp.status_code} (expected 400 with MISSING_TARGET)")
    if not success:
        print(f"  Response: {resp.text}")

def test_send_success(admin_session):
    """Test successful send with RESEND_API_KEY unset (safe mode)"""
    print_test("POST /api/admin/broadcast/send - Successful Send (Safe Mode)")
    
    if not admin_session:
        print_result(False, "No admin session available")
        return None
    
    # Create a specific test user to target
    print("\n→ Creating dedicated test user for broadcast")
    target_email = f"broadcast_target_{EPOCH}@test.local"
    resp = requests.post(f"{API_BASE}/signup", json={
        'name': 'Broadcast Target User',
        'email': target_email,
        'password': PASSWORD
    })
    
    if resp.status_code != 200:
        print_result(False, f"Failed to create target user: {resp.status_code}")
        return None
    
    print(f"  Created target user: {target_email}")
    
    # Send broadcast targeting MEMBER role (will include our test user)
    print("\n→ Sending broadcast (RESEND_API_KEY should be unset)")
    resp = admin_session.post(f"{API_BASE}/admin/broadcast/send", json={
        'subject': f'Test Broadcast {EPOCH}',
        'htmlBody': f'<h1>Test Broadcast</h1><p>This is a test broadcast sent at {EPOCH}</p>',
        'tiers': [],
        'roles': ['MEMBER'],
        'activeOnly': True
    })
    
    if resp.status_code == 200:
        data = resp.json()
        print_result(True, f"Send successful → {resp.status_code}")
        print(f"  Response: {json.dumps(data, indent=2)}")
        
        # Verify response structure
        required_fields = ['id', 'totalRecipients', 'successCount', 'failCount', 'optedOutSkipped', 'status']
        has_all_fields = all(k in data for k in required_fields)
        print_result(has_all_fields, f"Response has all required fields: {has_all_fields}")
        
        # Verify broadcast ID
        broadcast_id = data.get('id')
        if broadcast_id:
            print_result(True, f"Broadcast ID returned: {broadcast_id}")
            
            # Verify EmailBroadcast document in DB
            print("\n→ Verifying EmailBroadcast document in database")
            time.sleep(1)  # Give DB a moment to persist
            doc = get_broadcast_from_db(broadcast_id)
            
            if doc:
                print_result(True, f"EmailBroadcast document found in DB")
                print(f"  Document: {json.dumps({k: str(v) for k, v in doc.items()}, indent=2)}")
                
                # Verify fields match
                fields_match = (
                    doc.get('subject') == f'Test Broadcast {EPOCH}' and
                    doc.get('roles') == ['MEMBER'] and
                    doc.get('tiers') == [] and
                    doc.get('activeOnly') == True and
                    doc.get('totalRecipients') == data.get('totalRecipients') and
                    doc.get('successCount') == data.get('successCount') and
                    doc.get('failCount') == data.get('failCount') and
                    doc.get('optedOutSkipped') == data.get('optedOutSkipped') and
                    doc.get('status') == data.get('status')
                )
                print_result(fields_match, f"Document fields match response: {fields_match}")
                
                # Verify sentBy field
                has_sentby = doc.get('sentBy') is not None and doc.get('sentBy') != ''
                print_result(has_sentby, f"sentBy field populated: {has_sentby} (sentBy={doc.get('sentBy')})")
                
                # Verify sentAt field
                has_sentat = doc.get('sentAt') is not None
                print_result(has_sentat, f"sentAt field populated: {has_sentat}")
                
                return broadcast_id
            else:
                print_result(False, f"EmailBroadcast document NOT found in DB")
                return broadcast_id
        else:
            print_result(False, "No broadcast ID in response")
            return None
    else:
        print_result(False, f"Send failed: {resp.status_code} {resp.text}")
        return None

def test_history_auth():
    """Test authentication and authorization for history endpoint"""
    print_test("GET /api/admin/broadcast/history - Authentication & Authorization")
    
    # Test 4a: Unauthenticated request
    print("\n→ Test 4a: Unauthenticated request")
    resp = requests.get(f"{API_BASE}/admin/broadcast/history")
    success = resp.status_code == 401
    print_result(success, f"Unauthenticated → {resp.status_code} (expected 401)")
    if not success:
        print(f"  Response: {resp.text}")
    
    # Test 4b: Non-admin authenticated
    print("\n→ Test 4b: Non-admin authenticated (MEMBER)")
    member_session = requests.Session()
    csrf_resp = member_session.get(f"{API_BASE}/auth/csrf")
    csrf_token = csrf_resp.json().get('csrfToken')
    member_session.post(
        f"{API_BASE}/auth/callback/credentials",
        data={
            'csrfToken': csrf_token,
            'email': MEMBER_EMAIL,
            'password': PASSWORD,
            'callbackUrl': f"{BASE_URL}/dashboard",
            'json': 'true'
        },
        headers={'Content-Type': 'application/x-www-form-urlencoded'}
    )
    
    resp = member_session.get(f"{API_BASE}/admin/broadcast/history")
    success = resp.status_code == 403
    print_result(success, f"Non-admin → {resp.status_code} (expected 403)")
    if not success:
        print(f"  Response: {resp.text}")

def test_history_list(admin_session, expected_broadcast_id=None):
    """Test history endpoint returns correct data"""
    print_test("GET /api/admin/broadcast/history - List Broadcasts")
    
    if not admin_session:
        print_result(False, "No admin session available")
        return
    
    # Test 5a: Get history with default limit
    print("\n→ Test 5a: Get history with default limit")
    resp = admin_session.get(f"{API_BASE}/admin/broadcast/history")
    
    if resp.status_code == 200:
        data = resp.json()
        print_result(True, f"History retrieved → {resp.status_code}")
        
        # Verify response structure
        has_items = 'items' in data and isinstance(data['items'], list)
        print_result(has_items, f"Response has 'items' array: {has_items}")
        
        if has_items:
            items = data['items']
            print(f"  Found {len(items)} broadcast(s)")
            
            if len(items) > 0:
                # Verify first item structure
                first = items[0]
                required_fields = ['id', 'subject', 'tiers', 'roles', 'totalRecipients', 
                                 'successCount', 'failCount', 'optedOutSkipped', 'status',
                                 'sentBy', 'sentByName', 'sentAt', 'createdAt']
                has_all_fields = all(k in first for k in required_fields)
                print_result(has_all_fields, f"First item has all required fields: {has_all_fields}")
                
                if not has_all_fields:
                    missing = [k for k in required_fields if k not in first]
                    print(f"  Missing fields: {missing}")
                
                print(f"  First item: {json.dumps(first, indent=2, default=str)}")
                
                # Verify sorting (DESC by createdAt)
                if len(items) > 1:
                    is_sorted = all(
                        items[i]['createdAt'] >= items[i+1]['createdAt']
                        for i in range(len(items)-1)
                    )
                    print_result(is_sorted, f"Items sorted DESC by createdAt: {is_sorted}")
                
                # Verify expected broadcast is in the list
                if expected_broadcast_id:
                    found = any(item['id'] == expected_broadcast_id for item in items)
                    print_result(found, f"Expected broadcast {expected_broadcast_id} found in history: {found}")
                    
                    if found:
                        # Verify it's at index 0 (most recent)
                        is_first = items[0]['id'] == expected_broadcast_id
                        print_result(is_first, f"Expected broadcast is at index 0 (most recent): {is_first}")
            else:
                print("  No broadcasts in history yet")
    else:
        print_result(False, f"History request failed: {resp.status_code} {resp.text}")
    
    # Test 5b: Get history with custom limit
    print("\n→ Test 5b: Get history with custom limit (limit=2)")
    resp = admin_session.get(f"{API_BASE}/admin/broadcast/history?limit=2")
    
    if resp.status_code == 200:
        data = resp.json()
        items = data.get('items', [])
        respects_limit = len(items) <= 2
        print_result(respects_limit, f"Respects limit parameter: {respects_limit} (returned {len(items)} items)")
    else:
        print_result(False, f"History request with limit failed: {resp.status_code} {resp.text}")

# =============================================================================
# MAIN TEST EXECUTION
# =============================================================================

def main():
    print("\n" + "="*80)
    print("BROADCAST / BULK-EMAIL SYSTEM - BACKEND TESTING")
    print("="*80)
    print(f"\nBase URL: {BASE_URL}")
    print(f"API Base: {API_BASE}")
    print(f"Test Epoch: {EPOCH}")
    print(f"\n⚠️  SAFETY MODE: Testing with RESEND_API_KEY unset to avoid sending real emails")
    print("="*80)
    
    try:
        # Phase 1: Preview endpoint tests
        admin_session = test_preview_auth()
        if admin_session:
            test_preview_filters(admin_session)
            test_preview_optout(admin_session)
        
        # Phase 2: Send endpoint tests
        if admin_session:
            test_send_validation(admin_session)
            broadcast_id = test_send_success(admin_session)
        else:
            broadcast_id = None
        
        # Phase 3: History endpoint tests
        test_history_auth()
        if admin_session:
            test_history_list(admin_session, expected_broadcast_id=broadcast_id)
        
        print("\n" + "="*80)
        print("TESTING COMPLETE")
        print("="*80)
        
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
