#!/usr/bin/env python3
"""
Quick test for routes that returned 502 errors
"""

import requests
import time

BASE_URL = "https://omani-startup-hub.preview.emergentagent.com/api"

print("Testing routes that returned 502...")
print("=" * 80)

# Test 1: GET /api/experts/:id/slots (public)
print("\n1. Testing GET /api/experts/:id/slots")
try:
    resp = requests.get(f"{BASE_URL}/experts/test-id/slots?date=2026-05-01", timeout=15)
    print(f"   Status: {resp.status_code}")
    if resp.status_code == 404:
        print("   ✅ Route works (404 for non-existent expert is expected)")
    elif resp.status_code == 200:
        print("   ✅ Route works (200)")
    else:
        print(f"   ⚠️  Unexpected status: {resp.status_code}")
except Exception as e:
    print(f"   ❌ Error: {e}")

time.sleep(2)

# Test 2: GET /api/admin/experts (no auth)
print("\n2. Testing GET /api/admin/experts (no auth)")
try:
    resp = requests.get(f"{BASE_URL}/admin/experts", timeout=15)
    print(f"   Status: {resp.status_code}")
    if resp.status_code == 401:
        print("   ✅ Route works (401 for no auth is expected)")
    elif resp.status_code == 200:
        print("   ✅ Route works (200)")
    else:
        print(f"   ⚠️  Unexpected status: {resp.status_code}")
except Exception as e:
    print(f"   ❌ Error: {e}")

time.sleep(2)

# Test 3: GET /api/admin/experts (retry)
print("\n3. Testing GET /api/admin/experts (retry)")
try:
    resp = requests.get(f"{BASE_URL}/admin/experts", timeout=15)
    print(f"   Status: {resp.status_code}")
    if resp.status_code == 401:
        print("   ✅ Route works (401 for no auth is expected)")
    elif resp.status_code == 200:
        print("   ✅ Route works (200)")
    else:
        print(f"   ⚠️  Unexpected status: {resp.status_code}")
except Exception as e:
    print(f"   ❌ Error: {e}")

print("\n" + "=" * 80)
print("Test complete")
