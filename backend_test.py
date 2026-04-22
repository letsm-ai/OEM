#!/usr/bin/env python3
"""
Backend Test Suite for مجلس رواد الأعمال العماني (Omani Entrepreneur Majles)
Testing the NEW 24-hour reminder cron endpoint: POST /api/cron/send-reminders
"""

import os
import sys
import requests
import json
from datetime import datetime, timedelta
import pymongo
from pymongo import MongoClient
import uuid
import bcrypt
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/.env')

# Configuration
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'majles')
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')
CRON_SECRET = os.getenv('CRON_SECRET')

print(f"🔧 Configuration:")
print(f"   MONGO_URL: {MONGO_URL}")
print(f"   DB_NAME: {DB_NAME}")
print(f"   BASE_URL: {BASE_URL}")
print(f"   CRON_SECRET: {'✅ Set' if CRON_SECRET else '❌ Missing'}")
print()

# MongoDB connection
try:
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    print("✅ MongoDB connection established")
except Exception as e:
    print(f"❌ MongoDB connection failed: {e}")
    sys.exit(1)

def generate_uuid():
    """Generate UUID string like the Node.js app"""
    return str(uuid.uuid4())

def hash_password(password):
    """Hash password using bcrypt like the Node.js app"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_test_user(email, name="Test User", role="MEMBER", membership_tier="FREE"):
    """Create a test user in the database"""
    user_id = generate_uuid()
    user_doc = {
        "_id": user_id,
        "name": name,
        "email": email.lower().strip(),
        "password": hash_password("password123"),
        "role": role,
        "membershipTier": membership_tier,
        "membershipExpiry": None,
        "createdAt": datetime.utcnow()
    }
    
    # Insert or update user
    db.users.replace_one({"email": email.lower().strip()}, user_doc, upsert=True)
    return user_id

def create_test_expert(user_id, specialty="BUSINESS", hourly_rate=25):
    """Create a test expert in the database"""
    expert_id = generate_uuid()
    expert_doc = {
        "_id": expert_id,
        "userId": user_id,
        "specialtyAr": "استشارات تجارية",
        "specialty": specialty,
        "hourlyRate": hourly_rate,
        "bio": "خبير في الاستشارات التجارية",
        "status": "APPROVED",
        "isApproved": True,
        "createdAt": datetime.utcnow()
    }
    
    db.experts.replace_one({"userId": user_id}, expert_doc, upsert=True)
    return expert_id

def create_test_appointment(client_id, expert_id, target_datetime, status="CONFIRMED", reminder_sent=False):
    """Create a test appointment in the database"""
    appointment_id = generate_uuid()
    
    # Split target_datetime into date (UTC midnight) and time
    date_utc = target_datetime.replace(hour=0, minute=0, second=0, microsecond=0)
    start_time = f"{target_datetime.hour:02d}:{target_datetime.minute:02d}"
    end_datetime = target_datetime + timedelta(hours=1)
    end_time = f"{end_datetime.hour:02d}:{end_datetime.minute:02d}"
    
    appointment_doc = {
        "_id": appointment_id,
        "clientId": client_id,
        "expertId": expert_id,
        "date": date_utc,
        "startTime": start_time,
        "endTime": end_time,
        "status": status,
        "totalPaid": 25,
        "originalPrice": 25,
        "discountPercent": 0,
        "notes": "Test appointment for cron reminder",
        "cancelledAt": None,
        "cancelledBy": None,
        "reminderSentAt": datetime.utcnow() if reminder_sent else None,
        "createdAt": datetime.utcnow()
    }
    
    result = db.appointments.insert_one(appointment_doc)
    print(f"   📅 Created appointment {appointment_id} for {target_datetime} (status: {status})")
    return appointment_id

def cleanup_test_data():
    """Clean up test data"""
    print("🧹 Cleaning up test data...")
    
    # Remove test users (emails containing 'crontest')
    result = db.users.delete_many({"email": {"$regex": "crontest"}})
    print(f"   Deleted {result.deleted_count} test users")
    
    # Remove test experts for deleted users
    result = db.experts.delete_many({"userId": {"$in": []}})  # Will be empty after user deletion
    
    # Remove test appointments (notes containing 'Test appointment for cron')
    result = db.appointments.delete_many({"notes": {"$regex": "Test appointment for cron"}})
    print(f"   Deleted {result.deleted_count} test appointments")

def test_cron_endpoint():
    """Test the 24-hour reminder cron endpoint"""
    print("🚀 Testing 24-hour reminder cron endpoint: POST /api/cron/send-reminders")
    print("=" * 80)
    
    # Clean up any existing test data
    cleanup_test_data()
    
    # Test 1: Auth checks
    print("\n📋 TEST 1: Authentication Checks")
    print("-" * 40)
    
    # 1a: No Authorization header
    try:
        response = requests.post(f"{BASE_URL}/api/cron/send-reminders", 
                               headers={"Content-Type": "application/json"})
        if response.status_code == 401:
            response_data = response.json()
            if "غير مصرح" in response_data.get("error", ""):
                print("✅ 1a: No auth header → 401 with Arabic error 'غير مصرح'")
            else:
                print(f"❌ 1a: Expected Arabic error 'غير مصرح', got: {response_data}")
        else:
            print(f"❌ 1a: Expected 401, got {response.status_code}: {response.text}")
    except Exception as e:
        print(f"❌ 1a: Request failed: {e}")
    
    # 1b: Wrong Authorization token
    try:
        response = requests.post(f"{BASE_URL}/api/cron/send-reminders",
                               headers={
                                   "Content-Type": "application/json",
                                   "Authorization": "Bearer WRONG_TOKEN"
                               })
        if response.status_code == 401:
            response_data = response.json()
            if "غير مصرح" in response_data.get("error", ""):
                print("✅ 1b: Wrong token → 401 with Arabic error 'غير مصرح'")
            else:
                print(f"❌ 1b: Expected Arabic error 'غير مصرح', got: {response_data}")
        else:
            print(f"❌ 1b: Expected 401, got {response.status_code}: {response.text}")
    except Exception as e:
        print(f"❌ 1b: Request failed: {e}")
    
    # 1c: Correct Authorization token
    try:
        response = requests.post(f"{BASE_URL}/api/cron/send-reminders",
                               headers={
                                   "Content-Type": "application/json",
                                   "Authorization": f"Bearer {CRON_SECRET}"
                               })
        if response.status_code == 200:
            response_data = response.json()
            if (response_data.get("success") == True and 
                "considered" in response_data and 
                "sent" in response_data and 
                "failed" in response_data):
                print(f"✅ 1c: Correct token → 200 with JSON {response_data}")
            else:
                print(f"❌ 1c: Expected success response format, got: {response_data}")
        else:
            print(f"❌ 1c: Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        print(f"❌ 1c: Request failed: {e}")
    
    # Test 2: Empty case (no appointments in window)
    print("\n📋 TEST 2: Empty Case (No Appointments in 23h-25h Window)")
    print("-" * 60)
    
    try:
        response = requests.post(f"{BASE_URL}/api/cron/send-reminders",
                               headers={
                                   "Content-Type": "application/json",
                                   "Authorization": f"Bearer {CRON_SECRET}"
                               })
        if response.status_code == 200:
            response_data = response.json()
            if (response_data.get("success") == True and 
                response_data.get("considered") == 0 and
                response_data.get("sent") == 0 and
                response_data.get("failed") == 0):
                print(f"✅ 2: Empty case → considered=0, sent=0, failed=0: {response_data}")
            else:
                print(f"❌ 2: Expected empty response, got: {response_data}")
        else:
            print(f"❌ 2: Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        print(f"❌ 2: Request failed: {e}")
    
    # Test 3: Reminder fires (create appointment in 24h window)
    print("\n📋 TEST 3: Reminder Fires (Appointment in 24h Window)")
    print("-" * 55)
    
    # Create test users
    client_email = f"client.crontest.{int(datetime.utcnow().timestamp())}@example.com"
    expert_email = f"expert.crontest.{int(datetime.utcnow().timestamp())}@example.com"
    
    client_id = create_test_user(client_email, "Test Client", "MEMBER", "FREE")
    expert_user_id = create_test_user(expert_email, "Test Expert", "EXPERT", "GOLD")
    expert_id = create_test_expert(expert_user_id)
    
    print(f"   👤 Created test client: {client_id} ({client_email})")
    print(f"   👨‍💼 Created test expert: {expert_id} ({expert_email})")
    
    # Create appointment in 24h window (now + 24h)
    now = datetime.utcnow()
    target_datetime = now + timedelta(hours=24)
    appointment_id = create_test_appointment(client_id, expert_id, target_datetime)
    
    try:
        response = requests.post(f"{BASE_URL}/api/cron/send-reminders",
                               headers={
                                   "Content-Type": "application/json",
                                   "Authorization": f"Bearer {CRON_SECRET}"
                               })
        if response.status_code == 200:
            response_data = response.json()
            if (response_data.get("success") == True and 
                response_data.get("considered") >= 1 and
                response_data.get("sent") >= 1):
                print(f"✅ 3a: Reminder sent → {response_data}")
                
                # Verify in DB that reminderSentAt is set
                appointment = db.appointments.find_one({"_id": appointment_id})
                if appointment and appointment.get("reminderSentAt"):
                    print(f"✅ 3b: DB verification → reminderSentAt set: {appointment['reminderSentAt']}")
                else:
                    print(f"❌ 3b: DB verification failed → reminderSentAt not set")
            else:
                print(f"❌ 3a: Expected reminder to be sent, got: {response_data}")
        else:
            print(f"❌ 3a: Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        print(f"❌ 3a: Request failed: {e}")
    
    # Test 4: Idempotency (same appointment not reminded twice)
    print("\n📋 TEST 4: Idempotency (No Duplicate Reminders)")
    print("-" * 45)
    
    try:
        response = requests.post(f"{BASE_URL}/api/cron/send-reminders",
                               headers={
                                   "Content-Type": "application/json",
                                   "Authorization": f"Bearer {CRON_SECRET}"
                               })
        if response.status_code == 200:
            response_data = response.json()
            # The same appointment should not be considered again since reminderSentAt is set
            if (response_data.get("success") == True and 
                response_data.get("considered") == 0 and
                response_data.get("sent") == 0):
                print(f"✅ 4: Idempotency → considered=0, sent=0 (already reminded): {response_data}")
            else:
                print(f"❌ 4: Expected no reminders for already reminded appointment, got: {response_data}")
        else:
            print(f"❌ 4: Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        print(f"❌ 4: Request failed: {e}")
    
    # Test 5: Out of window appointments
    print("\n📋 TEST 5: Out of Window Appointments (Too Soon/Too Far)")
    print("-" * 55)
    
    # Create appointment too soon (10 hours from now)
    too_soon_datetime = now + timedelta(hours=10)
    too_soon_id = create_test_appointment(client_id, expert_id, too_soon_datetime)
    
    # Create appointment too far (40 hours from now)
    too_far_datetime = now + timedelta(hours=40)
    too_far_id = create_test_appointment(client_id, expert_id, too_far_datetime)
    
    try:
        response = requests.post(f"{BASE_URL}/api/cron/send-reminders",
                               headers={
                                   "Content-Type": "application/json",
                                   "Authorization": f"Bearer {CRON_SECRET}"
                               })
        if response.status_code == 200:
            response_data = response.json()
            # Should not consider appointments outside 23h-25h window
            if (response_data.get("success") == True and 
                response_data.get("considered") == 0 and
                response_data.get("sent") == 0):
                print(f"✅ 5: Out of window → considered=0, sent=0: {response_data}")
            else:
                print(f"❌ 5: Expected no reminders for out-of-window appointments, got: {response_data}")
        else:
            print(f"❌ 5: Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        print(f"❌ 5: Request failed: {e}")
    
    # Test 6: Cancelled appointments
    print("\n📋 TEST 6: Cancelled Appointments (Status != CONFIRMED)")
    print("-" * 50)
    
    # Create cancelled appointment in 24h window
    cancelled_datetime = now + timedelta(hours=24, minutes=30)
    cancelled_id = create_test_appointment(client_id, expert_id, cancelled_datetime, status="CANCELLED")
    
    try:
        response = requests.post(f"{BASE_URL}/api/cron/send-reminders",
                               headers={
                                   "Content-Type": "application/json",
                                   "Authorization": f"Bearer {CRON_SECRET}"
                               })
        if response.status_code == 200:
            response_data = response.json()
            # Should not consider cancelled appointments
            if (response_data.get("success") == True and 
                response_data.get("considered") == 0 and
                response_data.get("sent") == 0):
                print(f"✅ 6: Cancelled appointment → considered=0, sent=0: {response_data}")
            else:
                print(f"❌ 6: Expected no reminders for cancelled appointments, got: {response_data}")
        else:
            print(f"❌ 6: Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        print(f"❌ 6: Request failed: {e}")
    
    # Test 7: Regression tests
    print("\n📋 TEST 7: Regression Tests (Other Endpoints Still Work)")
    print("-" * 55)
    
    # 7a: GET /api/ should return 200
    try:
        response = requests.get(f"{BASE_URL}/api/")
        if response.status_code == 200:
            response_data = response.json()
            if "Majles API is running" in response_data.get("message", ""):
                print("✅ 7a: GET /api/ → 200 with correct message")
            else:
                print(f"❌ 7a: Expected 'Majles API is running', got: {response_data}")
        else:
            print(f"❌ 7a: Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        print(f"❌ 7a: Request failed: {e}")
    
    # 7b: POST /api/forgot-password with unknown email should return 200
    try:
        response = requests.post(f"{BASE_URL}/api/forgot-password",
                               headers={"Content-Type": "application/json"},
                               json={"email": "unknown.crontest@example.com"})
        if response.status_code == 200:
            response_data = response.json()
            if "إذا كان" in response_data.get("message", ""):
                print("✅ 7b: POST /api/forgot-password unknown email → 200 with anti-enumeration message")
            else:
                print(f"❌ 7b: Expected anti-enumeration message, got: {response_data}")
        else:
            print(f"❌ 7b: Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        print(f"❌ 7b: Request failed: {e}")
    
    # Clean up test data
    cleanup_test_data()
    
    print("\n" + "=" * 80)
    print("🎉 24-hour reminder cron endpoint testing completed!")
    print("=" * 80)

if __name__ == "__main__":
    test_cron_endpoint()