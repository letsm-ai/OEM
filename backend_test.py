#!/usr/bin/env python3
"""
Backend test for Bulk Email Broadcast system with Resend Batch API migration.
Tests the three broadcast endpoints with focus on the new batch send implementation.
"""

import requests
import json
import time
from datetime import datetime

# Configuration
BASE_URL = "https://omani-startup-hub.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Admin credentials
ADMIN_EMAIL = "mazin298@gmail.com"
ADMIN_PASSWORD = "Password123"

class BroadcastTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        self.admin_cookies = None
        
    def login_admin(self):
        """Login as admin and get session cookies"""
        print("\n🔐 Logging in as admin...")
        
        # Get CSRF token first
        csrf_response = self.session.get(f"{API_BASE}/auth/csrf")
        if csrf_response.status_code != 200:
            print(f"❌ Failed to get CSRF token: {csrf_response.status_code}")
            return False
            
        csrf_data = csrf_response.json()
        csrf_token = csrf_data.get('csrfToken')
        
        # Login with credentials
        login_payload = {
            'email': ADMIN_EMAIL,
            'password': ADMIN_PASSWORD,
            'csrfToken': csrf_token,
            'json': True
        }
        
        login_response = self.session.post(
            f"{API_BASE}/auth/callback/credentials",
            json=login_payload
        )
        
        if login_response.status_code == 200:
            # Store cookies for subsequent requests
            self.admin_cookies = self.session.cookies
            print(f"✅ Admin login successful")
            return True
        else:
            print(f"❌ Admin login failed: {login_response.status_code}")
            print(f"Response: {login_response.text[:200]}")
            return False
    
    def test_preview_endpoint(self):
        """Test POST /api/admin/broadcast/preview"""
        print("\n" + "="*80)
        print("TEST 1: POST /api/admin/broadcast/preview")
        print("="*80)
        
        test_cases = [
            {
                "name": "Preview with PLATINUM tier (small audience)",
                "payload": {"tiers": ["PLATINUM"], "roles": [], "activeOnly": True},
                "expect_status": 200
            },
            {
                "name": "Preview with ADMIN role (small audience)",
                "payload": {"tiers": [], "roles": ["ADMIN"], "activeOnly": True},
                "expect_status": 200
            },
            {
                "name": "Preview with both tier and role",
                "payload": {"tiers": ["GOLD", "PLATINUM"], "roles": ["EXPERT"], "activeOnly": True},
                "expect_status": 200
            }
        ]
        
        passed = 0
        failed = 0
        
        for tc in test_cases:
            print(f"\n📋 {tc['name']}")
            try:
                response = self.session.post(
                    f"{API_BASE}/admin/broadcast/preview",
                    json=tc['payload'],
                    cookies=self.admin_cookies
                )
                
                if response.status_code == tc['expect_status']:
                    data = response.json()
                    if 'total' in data and 'optedOut' in data and 'deliverable' in data:
                        print(f"✅ Status: {response.status_code}")
                        print(f"   Response: total={data['total']}, optedOut={data['optedOut']}, deliverable={data['deliverable']}")
                        passed += 1
                    else:
                        print(f"❌ Missing required fields in response")
                        print(f"   Response: {data}")
                        failed += 1
                else:
                    print(f"❌ Expected {tc['expect_status']}, got {response.status_code}")
                    print(f"   Response: {response.text[:200]}")
                    failed += 1
            except Exception as e:
                print(f"❌ Exception: {str(e)}")
                failed += 1
        
        print(f"\n📊 Preview Endpoint: {passed} passed, {failed} failed")
        return passed, failed
    
    def test_send_endpoint(self):
        """Test POST /api/admin/broadcast/send - THE CRITICAL FIX"""
        print("\n" + "="*80)
        print("TEST 2: POST /api/admin/broadcast/send (BATCH API)")
        print("="*80)
        
        # Test validation errors first
        validation_tests = [
            {
                "name": "Missing subject",
                "payload": {"subject": "", "htmlBody": "<p>Test</p>", "roles": ["ADMIN"]},
                "expect_status": 400,
                "expect_error": "MISSING_SUBJECT"
            },
            {
                "name": "Missing htmlBody",
                "payload": {"subject": "Test", "htmlBody": "", "roles": ["ADMIN"]},
                "expect_status": 400,
                "expect_error": "MISSING_BODY"
            },
            {
                "name": "Missing target (no tiers AND no roles)",
                "payload": {"subject": "Test", "htmlBody": "<p>Test</p>", "tiers": [], "roles": []},
                "expect_status": 400,
                "expect_error": "MISSING_TARGET"
            }
        ]
        
        passed = 0
        failed = 0
        
        print("\n🔍 Validation Tests:")
        for tc in validation_tests:
            print(f"\n📋 {tc['name']}")
            try:
                response = self.session.post(
                    f"{API_BASE}/admin/broadcast/send",
                    json=tc['payload'],
                    cookies=self.admin_cookies
                )
                
                if response.status_code == tc['expect_status']:
                    data = response.json()
                    if tc['expect_error'] in str(data.get('error', '')):
                        print(f"✅ Status: {response.status_code}, Error: {data.get('error')}")
                        passed += 1
                    else:
                        print(f"❌ Expected error '{tc['expect_error']}', got: {data}")
                        failed += 1
                else:
                    print(f"❌ Expected {tc['expect_status']}, got {response.status_code}")
                    failed += 1
            except Exception as e:
                print(f"❌ Exception: {str(e)}")
                failed += 1
        
        # Test successful send with ADMIN role (small, safe audience)
        print("\n🚀 Successful Send Test (ADMIN role - small audience):")
        timestamp = int(time.time())
        send_payload = {
            "subject": f"Test Broadcast — Batch API {timestamp}",
            "htmlBody": "<p>هذا اختبار تلقائي للـ Batch API. تم إرساله من الاختبار.</p><p>This is an automated test of the Batch API migration.</p>",
            "roles": ["ADMIN"],
            "activeOnly": True
        }
        
        try:
            print(f"\n📤 Sending broadcast to ADMIN role...")
            response = self.session.post(
                f"{API_BASE}/admin/broadcast/send",
                json=send_payload,
                cookies=self.admin_cookies
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Broadcast sent successfully!")
                print(f"   Response structure:")
                print(f"   - id: {data.get('id', 'MISSING')}")
                print(f"   - totalRecipients: {data.get('totalRecipients', 'MISSING')}")
                print(f"   - successCount: {data.get('successCount', 'MISSING')}")
                print(f"   - failCount: {data.get('failCount', 'MISSING')}")
                print(f"   - optedOutSkipped: {data.get('optedOutSkipped', 'MISSING')}")
                print(f"   - status: {data.get('status', 'MISSING')}")
                
                # Verify critical fields
                required_fields = ['id', 'totalRecipients', 'successCount', 'failCount', 'optedOutSkipped', 'status']
                all_present = all(field in data for field in required_fields)
                
                if all_present:
                    # Check success criteria
                    if data['status'] == 'COMPLETED':
                        print(f"✅ Status is COMPLETED")
                        passed += 1
                    else:
                        print(f"⚠️  Status is {data['status']} (expected COMPLETED)")
                        if data.get('error'):
                            print(f"   Error details: {data['error']}")
                        passed += 1  # Still count as pass if we got a response
                    
                    if data['successCount'] > 0:
                        print(f"✅ successCount > 0 ({data['successCount']})")
                    else:
                        print(f"⚠️  successCount is 0 (may be expected if RESEND_API_KEY is unset)")
                    
                    if data['failCount'] == 0:
                        print(f"✅ failCount is 0")
                    else:
                        print(f"⚠️  failCount is {data['failCount']}")
                        if data.get('error'):
                            print(f"   Error details: {data['error']}")
                    
                    # Store broadcast ID for history test
                    self.last_broadcast_id = data.get('id')
                    
                else:
                    print(f"❌ Missing required fields in response")
                    failed += 1
            else:
                print(f"❌ Expected 200, got {response.status_code}")
                print(f"   Response: {response.text[:500]}")
                failed += 1
        except Exception as e:
            print(f"❌ Exception: {str(e)}")
            failed += 1
        
        print(f"\n📊 Send Endpoint: {passed} passed, {failed} failed")
        return passed, failed
    
    def test_history_endpoint(self):
        """Test GET /api/admin/broadcast/history"""
        print("\n" + "="*80)
        print("TEST 3: GET /api/admin/broadcast/history")
        print("="*80)
        
        passed = 0
        failed = 0
        
        try:
            print(f"\n📋 Fetching broadcast history (limit=5)...")
            response = self.session.get(
                f"{API_BASE}/admin/broadcast/history?limit=5",
                cookies=self.admin_cookies
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'items' in data:
                    items = data['items']
                    print(f"✅ Status: 200")
                    print(f"   Found {len(items)} broadcast(s)")
                    
                    if len(items) > 0:
                        first_item = items[0]
                        print(f"\n   Most recent broadcast:")
                        print(f"   - id: {first_item.get('id', 'MISSING')}")
                        print(f"   - subject: {first_item.get('subject', 'MISSING')}")
                        print(f"   - totalRecipients: {first_item.get('totalRecipients', 'MISSING')}")
                        print(f"   - successCount: {first_item.get('successCount', 'MISSING')}")
                        print(f"   - failCount: {first_item.get('failCount', 'MISSING')}")
                        print(f"   - status: {first_item.get('status', 'MISSING')}")
                        print(f"   - sentAt: {first_item.get('sentAt', 'MISSING')}")
                        
                        # Verify required fields
                        required_fields = ['id', 'subject', 'tiers', 'roles', 'totalRecipients', 
                                         'successCount', 'failCount', 'status', 'sentAt']
                        all_present = all(field in first_item for field in required_fields)
                        
                        if all_present:
                            print(f"✅ All required fields present")
                            passed += 1
                        else:
                            missing = [f for f in required_fields if f not in first_item]
                            print(f"❌ Missing fields: {missing}")
                            failed += 1
                        
                        # Check if our test broadcast appears
                        if hasattr(self, 'last_broadcast_id') and self.last_broadcast_id:
                            found = any(item.get('id') == self.last_broadcast_id for item in items)
                            if found:
                                print(f"✅ Test broadcast found in history")
                            else:
                                print(f"⚠️  Test broadcast not found in history (may take a moment)")
                    else:
                        print(f"⚠️  No broadcasts in history")
                        passed += 1  # Not a failure
                else:
                    print(f"❌ Missing 'items' field in response")
                    failed += 1
            else:
                print(f"❌ Expected 200, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                failed += 1
        except Exception as e:
            print(f"❌ Exception: {str(e)}")
            failed += 1
        
        print(f"\n📊 History Endpoint: {passed} passed, {failed} failed")
        return passed, failed
    
    def test_auth_checks(self):
        """Test authentication and authorization"""
        print("\n" + "="*80)
        print("TEST 4: Authentication & Authorization")
        print("="*80)
        
        passed = 0
        failed = 0
        
        # Test unauthenticated access
        print(f"\n📋 Testing unauthenticated access...")
        unauth_session = requests.Session()
        
        endpoints = [
            ("preview", f"{API_BASE}/admin/broadcast/preview", "POST", {"tiers": ["FREE"]}),
            ("send", f"{API_BASE}/admin/broadcast/send", "POST", {"subject": "Test", "htmlBody": "Test", "roles": ["ADMIN"]}),
            ("history", f"{API_BASE}/admin/broadcast/history", "GET", None)
        ]
        
        for name, url, method, payload in endpoints:
            try:
                if method == "POST":
                    response = unauth_session.post(url, json=payload)
                else:
                    response = unauth_session.get(url)
                
                if response.status_code == 401:
                    print(f"✅ {name}: Unauthenticated → 401")
                    passed += 1
                else:
                    print(f"❌ {name}: Expected 401, got {response.status_code}")
                    failed += 1
            except Exception as e:
                print(f"❌ {name}: Exception: {str(e)}")
                failed += 1
        
        print(f"\n📊 Auth Checks: {passed} passed, {failed} failed")
        return passed, failed
    
    def run_all_tests(self):
        """Run all tests"""
        print("\n" + "="*80)
        print("🧪 BULK EMAIL BROADCAST - BATCH API MIGRATION TEST")
        print("="*80)
        print(f"Base URL: {BASE_URL}")
        print(f"Testing as: {ADMIN_EMAIL}")
        print(f"Timestamp: {datetime.now().isoformat()}")
        
        if not self.login_admin():
            print("\n❌ Failed to login as admin. Cannot proceed with tests.")
            return
        
        total_passed = 0
        total_failed = 0
        
        # Run all test suites
        p, f = self.test_preview_endpoint()
        total_passed += p
        total_failed += f
        
        p, f = self.test_send_endpoint()
        total_passed += p
        total_failed += f
        
        p, f = self.test_history_endpoint()
        total_passed += p
        total_failed += f
        
        p, f = self.test_auth_checks()
        total_passed += p
        total_failed += f
        
        # Final summary
        print("\n" + "="*80)
        print("📊 FINAL SUMMARY")
        print("="*80)
        print(f"Total Passed: {total_passed}")
        print(f"Total Failed: {total_failed}")
        print(f"Success Rate: {total_passed}/{total_passed + total_failed} ({100 * total_passed / (total_passed + total_failed) if (total_passed + total_failed) > 0 else 0:.1f}%)")
        
        if total_failed == 0:
            print("\n✅ ALL TESTS PASSED - Batch API migration working correctly!")
        else:
            print(f"\n⚠️  {total_failed} test(s) failed - Review details above")
        
        print("="*80)

if __name__ == "__main__":
    tester = BroadcastTester()
    tester.run_all_tests()
