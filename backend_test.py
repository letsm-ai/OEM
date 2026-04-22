#!/usr/bin/env python3
"""
Phase 4 Expert Consultation Backend Testing
Testing all expert-related endpoints with comprehensive scenarios
"""

import requests
import json
import time
import uuid
from datetime import datetime, timedelta
import pymongo
from pymongo import MongoClient
import os
from urllib.parse import urljoin

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://omani-startup-hub.preview.emergentagent.com')
API_BASE = urljoin(BASE_URL, '/api/')
DB_NAME = os.getenv('DB_NAME', 'majles')
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')

print(f"🔧 Configuration:")
print(f"   BASE_URL: {BASE_URL}")
print(f"   API_BASE: {API_BASE}")
print(f"   DB_NAME: {DB_NAME}")
print(f"   MONGO_URL: {MONGO_URL}")

# MongoDB connection
try:
    mongo_client = MongoClient(MONGO_URL)
    db = mongo_client[DB_NAME]
    print(f"✅ MongoDB connected to database: {DB_NAME}")
except Exception as e:
    print(f"❌ MongoDB connection failed: {e}")
    exit(1)

# Test session management
session = requests.Session()

def timestamp_email():
    """Generate unique timestamped email for testing"""
    ts = int(time.time() * 1000)
    return f"test_{ts}@example.com"

def create_user(name, email, password, tier='FREE'):
    """Create a user and optionally upgrade tier"""
    try:
        # Signup
        signup_data = {'name': name, 'email': email, 'password': password}
        resp = session.post(urljoin(API_BASE, 'signup'), json=signup_data)
        if resp.status_code != 200:
            print(f"❌ Signup failed: {resp.status_code} - {resp.text}")
            return None
        
        user_data = resp.json()
        user_id = user_data['user']['id']
        print(f"✅ User created: {name} ({email}) - ID: {user_id}")
        
        # Upgrade tier via MongoDB if needed (to avoid JWT session issues)
        if tier != 'FREE':
            try:
                # Update user tier directly in MongoDB
                from datetime import datetime, timedelta
                expiry_date = datetime.now() + timedelta(days=365)
                
                db.users.update_one(
                    {"_id": user_id},
                    {"$set": {"membershipTier": tier, "membershipExpiry": expiry_date}}
                )
                print(f"✅ User tier updated to {tier} via MongoDB")
                
                # Create membership record
                tier_prices = {'BASIC': 50, 'GOLD': 100, 'PLATINUM': 200}
                membership_doc = {
                    '_id': str(uuid.uuid4()),
                    'userId': user_id,
                    'tier': tier,
                    'startDate': datetime.now(),
                    'endDate': expiry_date,
                    'amountPaid': tier_prices.get(tier, 0),
                    'paymentStatus': 'PAID'
                }
                db.memberships.insert_one(membership_doc)
                print(f"✅ Membership record created for {tier}")
                
            except Exception as e:
                print(f"❌ Tier upgrade failed: {e}")
                return None
        
        # Login via NextAuth after tier upgrade
        if not login_user(email, password):
            print(f"❌ Login after tier upgrade failed")
            return None
        
        return {'id': user_id, 'email': email, 'name': name, 'tier': tier}
    except Exception as e:
        print(f"❌ User creation failed: {e}")
        return None

def login_user(email, password):
    """Login user and return session"""
    try:
        # Get CSRF token first
        csrf_resp = session.get(urljoin(API_BASE, 'auth/csrf'))
        if csrf_resp.status_code != 200:
            print(f"❌ CSRF token failed: {csrf_resp.status_code}")
            return False
        
        csrf_token = csrf_resp.json().get('csrfToken')
        if not csrf_token:
            print("❌ No CSRF token received")
            return False
        
        # Login with credentials
        login_data = {
            'email': email,
            'password': password,
            'csrfToken': csrf_token,
            'callbackUrl': BASE_URL,
            'json': 'true'
        }
        
        login_resp = session.post(
            urljoin(API_BASE, 'auth/callback/credentials'),
            data=login_data,
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
            allow_redirects=False
        )
        
        # Check if login was successful (should get redirect or session cookie)
        if login_resp.status_code in [200, 302] or 'next-auth.session-token' in session.cookies:
            print(f"✅ Logged in: {email}")
            return True
        else:
            print(f"❌ Login failed: {login_resp.status_code} - {login_resp.text}")
            return False
    except Exception as e:
        print(f"❌ Login error: {e}")
        return False

def promote_user_to_admin(user_id):
    """Promote user to ADMIN role via MongoDB"""
    try:
        result = db.users.update_one(
            {"_id": user_id},
            {"$set": {"role": "ADMIN"}}
        )
        if result.modified_count > 0:
            print(f"✅ User {user_id} promoted to ADMIN")
            return True
        else:
            print(f"❌ Failed to promote user {user_id} to ADMIN")
            return False
    except Exception as e:
        print(f"❌ Admin promotion error: {e}")
        return False

def get_next_date(days_ahead, day_of_week=None):
    """Get next date N days ahead, optionally for specific day of week"""
    target_date = datetime.now() + timedelta(days=days_ahead)
    
    if day_of_week is not None:
        # Find next occurrence of specific day of week (0=Monday, 6=Sunday)
        current_weekday = target_date.weekday()
        days_until = (day_of_week - current_weekday) % 7
        if days_until == 0 and days_ahead > 0:
            days_until = 7  # Next week if today is the target day
        target_date = target_date + timedelta(days=days_until)
    
    return target_date.strftime('%Y-%m-%d')

def run_phase4_tests():
    """Run comprehensive Phase 4 Expert Consultation tests"""
    print("\n" + "="*80)
    print("🧪 PHASE 4 EXPERT CONSULTATION BACKEND TESTING")
    print("="*80)
    
    test_results = []
    expert_id = None  # Initialize to avoid scope issues
    appointment_id = None  # Initialize to avoid scope issues
    
    try:
        # A) TIER GATE + APPLY
        print("\n📋 A) TIER GATE + APPLY TESTS")
        print("-" * 50)
        
        # A1) Create FREE user and test tier gate
        print("\n🔸 A1) Testing FREE user tier gate")
        free_user = create_user("Free User", timestamp_email(), "password123", "FREE")
        if not free_user:
            test_results.append("❌ A1) FREE user creation failed")
        else:
            # Try to apply as expert (should fail)
            apply_resp = session.post(urljoin(API_BASE, 'experts/apply'), 
                                    json={'specialty': 'LEGAL', 'hourlyRate': 25})
            if apply_resp.status_code == 403:
                error_msg = apply_resp.json().get('error', '')
                if 'الباقة الذهبية' in error_msg or 'البلاتينية' in error_msg:
                    test_results.append("✅ A1) FREE user correctly blocked with Arabic error")
                else:
                    test_results.append(f"❌ A1) Wrong error message: {error_msg}")
            else:
                test_results.append(f"❌ A1) Expected 403, got {apply_resp.status_code}")
        
        # A2) Create BASIC user and test tier gate
        print("\n🔸 A2) Testing BASIC user tier gate")
        basic_user = create_user("Basic User", timestamp_email(), "password123", "BASIC")
        if basic_user:
            apply_resp = session.post(urljoin(API_BASE, 'experts/apply'), 
                                    json={'specialty': 'LEGAL', 'hourlyRate': 25})
            if apply_resp.status_code == 403:
                test_results.append("✅ A2) BASIC user correctly blocked")
            else:
                test_results.append(f"❌ A2) Expected 403, got {apply_resp.status_code}")
        
        # A3) Create GOLD user and test expert application
        print("\n🔸 A3) Testing GOLD user expert application")
        gold_user = create_user("Gold Expert", timestamp_email(), "password123", "GOLD")
        if not gold_user:
            test_results.append("❌ A3) GOLD user creation failed")
        else:
            # Re-login to get fresh JWT with GOLD tier
            login_user(gold_user['email'], "password123")
            
            # Test validation errors
            # Empty body
            apply_resp = session.post(urljoin(API_BASE, 'experts/apply'), json={})
            if apply_resp.status_code == 400 and 'التخصص غير صحيح' in apply_resp.json().get('error', ''):
                test_results.append("✅ A3a) Empty specialty validation working")
            else:
                test_results.append(f"❌ A3a) Expected 400 with Arabic error, got {apply_resp.status_code}")
            
            # Invalid specialty
            apply_resp = session.post(urljoin(API_BASE, 'experts/apply'), 
                                    json={'specialty': 'INVALID', 'hourlyRate': 25})
            if apply_resp.status_code == 400:
                test_results.append("✅ A3b) Invalid specialty validation working")
            else:
                test_results.append(f"❌ A3b) Expected 400, got {apply_resp.status_code}")
            
            # Invalid hourly rate
            apply_resp = session.post(urljoin(API_BASE, 'experts/apply'), 
                                    json={'specialty': 'LEGAL', 'hourlyRate': 0})
            if apply_resp.status_code == 400 and 'سعر الساعة مطلوب' in apply_resp.json().get('error', ''):
                test_results.append("✅ A3c) Invalid hourly rate validation working")
            else:
                test_results.append(f"❌ A3c) Expected 400 with Arabic error, got {apply_resp.status_code}")
            
            # Valid application
            apply_resp = session.post(urljoin(API_BASE, 'experts/apply'), 
                                    json={
                                        'specialty': 'LEGAL',
                                        'specialtyAr': 'قانون شركات',
                                        'bio': 'خبير قانوني متخصص في قانون الشركات',
                                        'experienceYears': 5,
                                        'hourlyRate': 25,
                                        'photo': '',
                                        'cv': ''
                                    })
            if apply_resp.status_code == 200:
                expert_data = apply_resp.json()
                if expert_data.get('success') and expert_data.get('expert', {}).get('id'):
                    expert_id = expert_data['expert']['id']
                    test_results.append(f"✅ A3d) Valid expert application successful - ID: {expert_id}")
                    
                    # Try duplicate application
                    dup_resp = session.post(urljoin(API_BASE, 'experts/apply'), 
                                          json={'specialty': 'LEGAL', 'hourlyRate': 25})
                    if dup_resp.status_code == 409 and 'لديك طلب تسجيل خبير مسبقاً' in dup_resp.json().get('error', ''):
                        test_results.append("✅ A3e) Duplicate application correctly blocked")
                    else:
                        test_results.append(f"❌ A3e) Expected 409 with Arabic error, got {dup_resp.status_code}")
                else:
                    test_results.append(f"❌ A3d) Invalid response structure: {expert_data}")
                    expert_id = expert_data.get('expert', {}).get('id')  # Try to get ID anyway
            else:
                test_results.append(f"❌ A3d) Expected 200, got {apply_resp.status_code} - {apply_resp.text}")
        
        # B) GET /experts (public)
        print("\n📋 B) GET /experts PUBLIC TESTS")
        print("-" * 50)
        
        # B4) Test that PENDING expert is not visible
        print("\n🔸 B4) Testing PENDING expert not visible in public list")
        experts_resp = session.get(urljoin(API_BASE, 'experts'))
        if experts_resp.status_code == 200:
            experts_list = experts_resp.json().get('experts', [])
            pending_found = any(e.get('id') == expert_id for e in experts_list)
            if not pending_found:
                test_results.append("✅ B4) PENDING expert correctly hidden from public list")
            else:
                test_results.append("❌ B4) PENDING expert visible in public list")
        else:
            test_results.append(f"❌ B4) GET /experts failed: {experts_resp.status_code}")
        
        # B5) Approve expert in DB and test visibility
        print("\n🔸 B5) Approving expert and testing visibility")
        try:
            # Approve expert directly in DB
            db.experts.update_one(
                {"_id": expert_id},
                {"$set": {"status": "APPROVED", "isApproved": True}}
            )
            print(f"✅ Expert {expert_id} approved in DB")
            
            # B6) Test approved expert is visible
            experts_resp = session.get(urljoin(API_BASE, 'experts'))
            if experts_resp.status_code == 200:
                experts_list = experts_resp.json().get('experts', [])
                approved_expert = next((e for e in experts_list if e.get('id') == expert_id), None)
                if approved_expert:
                    required_fields = ['id', 'name', 'specialty', 'specialtyAr', 'hourlyRate']
                    if all(field in approved_expert for field in required_fields):
                        test_results.append("✅ B6) APPROVED expert visible with correct fields")
                    else:
                        test_results.append(f"❌ B6) Missing fields in expert data: {approved_expert}")
                else:
                    test_results.append("❌ B6) APPROVED expert not found in public list")
            else:
                test_results.append(f"❌ B6) GET /experts failed: {experts_resp.status_code}")
            
            # B7) Test specialty filter
            print("\n🔸 B7) Testing specialty filter")
            legal_resp = session.get(urljoin(API_BASE, 'experts?specialty=LEGAL'))
            hr_resp = session.get(urljoin(API_BASE, 'experts?specialty=HR'))
            
            if legal_resp.status_code == 200 and hr_resp.status_code == 200:
                legal_experts = legal_resp.json().get('experts', [])
                hr_experts = hr_resp.json().get('experts', [])
                
                legal_found = any(e.get('id') == expert_id for e in legal_experts)
                hr_found = any(e.get('id') == expert_id for e in hr_experts)
                
                if legal_found and not hr_found:
                    test_results.append("✅ B7) Specialty filter working correctly")
                else:
                    test_results.append(f"❌ B7) Specialty filter issue - LEGAL: {legal_found}, HR: {hr_found}")
            else:
                test_results.append("❌ B7) Specialty filter requests failed")
        
        except Exception as e:
            test_results.append(f"❌ B5-B7) Expert approval/visibility tests failed: {e}")
        
        # C) GET /experts/:id
        print("\n📋 C) GET /experts/:id TESTS")
        print("-" * 50)
        
        # C8) Test PENDING expert access control
        print("\n🔸 C8) Testing PENDING expert access control")
        # Revert expert to PENDING
        db.experts.update_one(
            {"_id": expert_id},
            {"$set": {"status": "PENDING", "isApproved": False}}
        )
        
        # Test without auth
        session_backup = session.cookies.copy()
        session.cookies.clear()
        expert_detail_resp = session.get(urljoin(API_BASE, f'experts/{expert_id}'))
        if expert_detail_resp.status_code == 404:
            test_results.append("✅ C8) PENDING expert correctly hidden from anonymous users")
        else:
            test_results.append(f"❌ C8) Expected 404, got {expert_detail_resp.status_code}")
        
        # C9) Test owner can access PENDING expert
        session.cookies.update(session_backup)
        login_user(gold_user['email'], "password123")
        expert_detail_resp = session.get(urljoin(API_BASE, f'experts/{expert_id}'))
        if expert_detail_resp.status_code == 200:
            test_results.append("✅ C9) Owner can access PENDING expert")
        else:
            test_results.append(f"❌ C9) Expected 200, got {expert_detail_resp.status_code}")
        
        # C10) Test APPROVED expert public access
        db.experts.update_one(
            {"_id": expert_id},
            {"$set": {"status": "APPROVED", "isApproved": True}}
        )
        session.cookies.clear()
        expert_detail_resp = session.get(urljoin(API_BASE, f'experts/{expert_id}'))
        if expert_detail_resp.status_code == 200:
            test_results.append("✅ C10) APPROVED expert accessible to public")
        else:
            test_results.append(f"❌ C10) Expected 200, got {expert_detail_resp.status_code}")
        
        # D) AVAILABILITY
        print("\n📋 D) AVAILABILITY TESTS")
        print("-" * 50)
        
        # Login as expert owner
        login_user(gold_user['email'], "password123")
        
        # D11) Set availability
        print("\n🔸 D11) Setting expert availability")
        availability_data = {
            'availability': [
                {'dayOfWeek': 0, 'startTime': '09:00', 'endTime': '12:00'},  # Sunday
                {'dayOfWeek': 2, 'startTime': '14:00', 'endTime': '17:00'}   # Tuesday
            ]
        }
        avail_resp = session.put(urljoin(API_BASE, 'experts/me/availability'), json=availability_data)
        if avail_resp.status_code == 200:
            resp_data = avail_resp.json()
            if resp_data.get('success') and resp_data.get('count') == 2:
                test_results.append("✅ D11) Availability set successfully")
            else:
                test_results.append(f"❌ D11) Invalid response: {resp_data}")
        else:
            test_results.append(f"❌ D11) Expected 200, got {avail_resp.status_code}")
        
        # D12) Get availability
        print("\n🔸 D12) Getting expert availability")
        get_avail_resp = session.get(urljoin(API_BASE, f'experts/{expert_id}/availability'))
        if get_avail_resp.status_code == 200:
            avail_data = get_avail_resp.json().get('availability', [])
            if len(avail_data) == 2:
                test_results.append("✅ D12) Availability retrieved successfully")
            else:
                test_results.append(f"❌ D12) Expected 2 availability entries, got {len(avail_data)}")
        else:
            test_results.append(f"❌ D12) Expected 200, got {get_avail_resp.status_code}")
        
        # D13) Test invalid dayOfWeek
        print("\n🔸 D13) Testing invalid dayOfWeek validation")
        invalid_avail = {'availability': [{'dayOfWeek': 7, 'startTime': '09:00', 'endTime': '12:00'}]}
        invalid_resp = session.put(urljoin(API_BASE, 'experts/me/availability'), json=invalid_avail)
        if invalid_resp.status_code == 400:
            test_results.append("✅ D13) Invalid dayOfWeek correctly rejected")
        else:
            test_results.append(f"❌ D13) Expected 400, got {invalid_resp.status_code}")
        
        # D14) Test invalid time format
        print("\n🔸 D14) Testing invalid time format validation")
        invalid_time = {'availability': [{'dayOfWeek': 0, 'startTime': '9:00', 'endTime': '12:00'}]}
        invalid_time_resp = session.put(urljoin(API_BASE, 'experts/me/availability'), json=invalid_time)
        if invalid_time_resp.status_code == 400:
            test_results.append("✅ D14) Invalid time format correctly rejected")
        else:
            test_results.append(f"❌ D14) Expected 400, got {invalid_time_resp.status_code}")
        
        # D15) Test empty availability
        print("\n🔸 D15) Testing empty availability")
        empty_avail = {'availability': []}
        empty_resp = session.put(urljoin(API_BASE, 'experts/me/availability'), json=empty_avail)
        if empty_resp.status_code == 200 and empty_resp.json().get('count') == 0:
            test_results.append("✅ D15) Empty availability set successfully")
            
            # Restore availability for next tests
            session.put(urljoin(API_BASE, 'experts/me/availability'), json=availability_data)
        else:
            test_results.append(f"❌ D15) Empty availability failed: {empty_resp.status_code}")
        
        # E) SLOTS
        print("\n📋 E) SLOTS TESTS")
        print("-" * 50)
        
        # E16) Get slots for Sunday (dayOfWeek=0)
        print("\n🔸 E16) Testing slots for Sunday")
        next_sunday = get_next_date(7, 6)  # Next Sunday (6=Sunday in weekday)
        slots_resp = session.get(urljoin(API_BASE, f'experts/{expert_id}/slots?date={next_sunday}'))
        if slots_resp.status_code == 200:
            slots = slots_resp.json().get('slots', [])
            expected_slots = ['09:00', '10:00', '11:00']  # 3 one-hour slots from 09:00-12:00
            slot_times = [s.get('startTime') for s in slots]
            if all(time in slot_times for time in expected_slots):
                test_results.append(f"✅ E16) Sunday slots correct: {slot_times}")
            else:
                test_results.append(f"❌ E16) Expected {expected_slots}, got {slot_times}")
        else:
            test_results.append(f"❌ E16) Expected 200, got {slots_resp.status_code}")
        
        # E17) Get slots for Monday (no availability)
        print("\n🔸 E17) Testing slots for Monday (no availability)")
        next_monday = get_next_date(7, 0)  # Next Monday (0=Monday in weekday)
        monday_slots_resp = session.get(urljoin(API_BASE, f'experts/{expert_id}/slots?date={next_monday}'))
        if monday_slots_resp.status_code == 200:
            monday_slots = monday_slots_resp.json().get('slots', [])
            if len(monday_slots) == 0:
                test_results.append("✅ E17) Monday slots correctly empty")
            else:
                test_results.append(f"❌ E17) Expected 0 slots, got {len(monday_slots)}")
        else:
            test_results.append(f"❌ E17) Expected 200, got {monday_slots_resp.status_code}")
        
        # E18) Test invalid date format
        print("\n🔸 E18) Testing invalid date format")
        bad_date_resp = session.get(urljoin(API_BASE, f'experts/{expert_id}/slots?date=bad'))
        if bad_date_resp.status_code == 400 and 'تاريخ غير صحيح' in bad_date_resp.json().get('error', ''):
            test_results.append("✅ E18) Invalid date format correctly rejected")
        else:
            test_results.append(f"❌ E18) Expected 400 with Arabic error, got {bad_date_resp.status_code}")
        
        # F) BOOK APPOINTMENT
        print("\n📋 F) BOOK APPOINTMENT TESTS")
        print("-" * 50)
        
        # Create a client user
        print("\n🔸 F19) Creating client user and booking appointment")
        client_user = create_user("Client User", timestamp_email(), "password123", "FREE")
        if not client_user:
            test_results.append("❌ F19) Client user creation failed")
        else:
            login_user(client_user['email'], "password123")
            
            # Book appointment
            appointment_data = {
                'expertId': expert_id,
                'date': next_sunday,
                'startTime': '09:00',
                'endTime': '10:00'
            }
            book_resp = session.post(urljoin(API_BASE, 'appointments'), json=appointment_data)
            if book_resp.status_code == 200:
                appt_data = book_resp.json()
                if appt_data.get('success') and appt_data.get('appointment', {}).get('status') == 'CONFIRMED':
                    appointment_id = appt_data['appointment']['id']
                    total_paid = appt_data['appointment']['totalPaid']
                    
                    # Verify pricing for FREE tier (no discount)
                    if total_paid == 25:  # hourlyRate without discount
                        test_results.append(f"✅ F19) Appointment booked successfully - ID: {appointment_id}, Total: {total_paid}")
                    else:
                        test_results.append(f"❌ F19) Wrong pricing - Expected 25, got {total_paid}")
                else:
                    test_results.append(f"❌ F19) Invalid appointment response: {appt_data}")
                    # Try to get appointment_id anyway
                    appointment_id = appt_data.get('appointment', {}).get('id')
            else:
                test_results.append(f"❌ F19) Expected 200, got {book_resp.status_code} - {book_resp.text}")
            
            # F20) Try to book same slot again
            print("\n🔸 F20) Testing duplicate booking prevention")
            dup_book_resp = session.post(urljoin(API_BASE, 'appointments'), json=appointment_data)
            if dup_book_resp.status_code == 409 and 'هذا الموعد محجوز بالفعل' in dup_book_resp.json().get('error', ''):
                test_results.append("✅ F20) Duplicate booking correctly prevented")
            else:
                test_results.append(f"❌ F20) Expected 409 with Arabic error, got {dup_book_resp.status_code}")
            
            # F21) Try to book outside availability
            print("\n🔸 F21) Testing booking outside availability")
            outside_data = {
                'expertId': expert_id,
                'date': next_sunday,
                'startTime': '08:00',
                'endTime': '09:00'
            }
            outside_resp = session.post(urljoin(API_BASE, 'appointments'), json=outside_data)
            if outside_resp.status_code == 400 and 'الوقت غير ضمن أوقات المتاحة' in outside_resp.json().get('error', ''):
                test_results.append("✅ F21) Outside availability correctly rejected")
            else:
                test_results.append(f"❌ F21) Expected 400 with Arabic error, got {outside_resp.status_code}")
            
            # F22) Try self-booking (expert booking with themselves)
            print("\n🔸 F22) Testing self-booking prevention")
            login_user(gold_user['email'], "password123")  # Login as expert
            self_book_data = {
                'expertId': expert_id,
                'date': next_sunday,
                'startTime': '10:00',
                'endTime': '11:00'
            }
            self_book_resp = session.post(urljoin(API_BASE, 'appointments'), json=self_book_data)
            if self_book_resp.status_code == 400 and 'لا يمكنك حجز جلسة مع نفسك' in self_book_resp.json().get('error', ''):
                test_results.append("✅ F22) Self-booking correctly prevented")
            else:
                test_results.append(f"❌ F22) Expected 400 with Arabic error, got {self_book_resp.status_code}")
            
            # F23) Test unauthenticated booking
            print("\n🔸 F23) Testing unauthenticated booking")
            session.cookies.clear()
            unauth_resp = session.post(urljoin(API_BASE, 'appointments'), json=appointment_data)
            if unauth_resp.status_code == 401:
                test_results.append("✅ F23) Unauthenticated booking correctly rejected")
            else:
                test_results.append(f"❌ F23) Expected 401, got {unauth_resp.status_code}")
        
        # G) TIER DISCOUNT
        print("\n📋 G) TIER DISCOUNT TESTS")
        print("-" * 50)
        
        # Create clients with different tiers and test discounts
        tiers_discounts = [
            ('BASIC', 22.5),   # 10% discount: 25 * 0.9 = 22.5
            ('GOLD', 20.0),    # 20% discount: 25 * 0.8 = 20.0
            ('PLATINUM', 17.5) # 30% discount: 25 * 0.7 = 17.5
        ]
        
        for tier, expected_price in tiers_discounts:
            print(f"\n🔸 G24) Testing {tier} tier discount")
            tier_client = create_user(f"{tier} Client", timestamp_email(), "password123", tier)
            if tier_client:
                # Re-login to get fresh JWT with correct tier
                login_user(tier_client['email'], "password123")
                
                # Book different slot
                tier_appointment_data = {
                    'expertId': expert_id,
                    'date': next_sunday,
                    'startTime': f'{10 + tiers_discounts.index((tier, expected_price))}:00',
                    'endTime': f'{11 + tiers_discounts.index((tier, expected_price))}:00'
                }
                tier_book_resp = session.post(urljoin(API_BASE, 'appointments'), json=tier_appointment_data)
                if tier_book_resp.status_code == 200:
                    tier_appt = tier_book_resp.json().get('appointment', {})
                    total_paid = tier_appt.get('totalPaid')
                    if total_paid == expected_price:
                        test_results.append(f"✅ G24) {tier} discount correct: {total_paid}")
                    else:
                        test_results.append(f"❌ G24) {tier} wrong price - Expected {expected_price}, got {total_paid}")
                else:
                    test_results.append(f"❌ G24) {tier} booking failed: {tier_book_resp.status_code}")
        
        # H) LIST + CANCEL
        print("\n📋 H) LIST + CANCEL TESTS")
        print("-" * 50)
        
        # H25) Test client appointments list
        print("\n🔸 H25) Testing client appointments list")
        login_user(client_user['email'], "password123")
        client_appts_resp = session.get(urljoin(API_BASE, 'appointments'))
        if client_appts_resp.status_code == 200:
            client_appts = client_appts_resp.json().get('appointments', [])
            if len(client_appts) > 0:
                test_results.append(f"✅ H25) Client appointments list working: {len(client_appts)} appointments")
            else:
                test_results.append("❌ H25) No appointments found for client")
        else:
            test_results.append(f"❌ H25) Expected 200, got {client_appts_resp.status_code}")
        
        # H26) Test expert appointments list
        print("\n🔸 H26) Testing expert appointments list")
        login_user(gold_user['email'], "password123")
        expert_appts_resp = session.get(urljoin(API_BASE, 'appointments?as=expert'))
        if expert_appts_resp.status_code == 200:
            expert_appts = expert_appts_resp.json().get('appointments', [])
            if len(expert_appts) > 0:
                test_results.append(f"✅ H26) Expert appointments list working: {len(expert_appts)} appointments")
            else:
                test_results.append("❌ H26) No appointments found for expert")
        else:
            test_results.append(f"❌ H26) Expected 200, got {expert_appts_resp.status_code}")
        
        # H27) Test unauthorized cancellation
        print("\n🔸 H27) Testing unauthorized cancellation")
        if appointment_id:  # Only test if we have a valid appointment_id
            unrelated_user = create_user("Unrelated User", timestamp_email(), "password123")
            if unrelated_user:
                login_user(unrelated_user['email'], "password123")
                cancel_resp = session.post(urljoin(API_BASE, f'appointments/{appointment_id}/cancel'))
                if cancel_resp.status_code == 403:
                    test_results.append("✅ H27) Unauthorized cancellation correctly rejected")
                else:
                    test_results.append(f"❌ H27) Expected 403, got {cancel_resp.status_code}")
        else:
            test_results.append("❌ H27) Skipped - no valid appointment_id")
        
        # H28) Test 24-hour rule for client cancellation
        print("\n🔸 H28) Testing 24-hour cancellation rule")
        # Create a mock appointment with date = now + 1 hour via MongoDB
        near_future = datetime.now() + timedelta(hours=1)
        mock_appointment = {
            '_id': str(uuid.uuid4()),
            'clientId': client_user['id'],
            'expertId': expert_id,
            'date': near_future.replace(hour=0, minute=0, second=0, microsecond=0),
            'startTime': near_future.strftime('%H:%M'),
            'endTime': (near_future + timedelta(hours=1)).strftime('%H:%M'),
            'status': 'CONFIRMED',
            'totalPaid': 25,
            'originalPrice': 25,
            'discountPercent': 0,
            'createdAt': datetime.now()
        }
        db.appointments.insert_one(mock_appointment)
        
        login_user(client_user['email'], "password123")
        near_cancel_resp = session.post(urljoin(API_BASE, f'appointments/{mock_appointment["_id"]}/cancel'))
        if near_cancel_resp.status_code == 400 and 'لا يمكن الإلغاء قبل الجلسة بأقل من 24 ساعة' in near_cancel_resp.json().get('error', ''):
            test_results.append("✅ H28) 24-hour rule correctly enforced")
        else:
            test_results.append(f"❌ H28) Expected 400 with Arabic error, got {near_cancel_resp.status_code}")
        
        # H29) Test successful client cancellation (>24h)
        print("\n🔸 H29) Testing successful client cancellation")
        if appointment_id:  # Only test if we have a valid appointment_id
            login_user(client_user['email'], "password123")
            cancel_resp = session.post(urljoin(API_BASE, f'appointments/{appointment_id}/cancel'))
            if cancel_resp.status_code == 200:
                # Verify cancellation in DB
                cancelled_appt = db.appointments.find_one({'_id': appointment_id})
                if cancelled_appt and cancelled_appt.get('status') == 'CANCELLED' and cancelled_appt.get('cancelledBy') == 'client':
                    test_results.append("✅ H29) Client cancellation successful")
                else:
                    test_results.append(f"❌ H29) Cancellation not properly recorded in DB")
            else:
                test_results.append(f"❌ H29) Expected 200, got {cancel_resp.status_code}")
        else:
            test_results.append("❌ H29) Skipped - no valid appointment_id")
        
        # H30) Test expert cancellation bypasses 24h rule
        print("\n🔸 H30) Testing expert cancellation bypasses 24h rule")
        login_user(gold_user['email'], "password123")
        expert_cancel_resp = session.post(urljoin(API_BASE, f'appointments/{mock_appointment["_id"]}/cancel'))
        if expert_cancel_resp.status_code == 200:
            test_results.append("✅ H30) Expert cancellation bypasses 24h rule")
        else:
            test_results.append(f"❌ H30) Expected 200, got {expert_cancel_resp.status_code}")
        
        # H31) Test cancelling already cancelled appointment
        print("\n🔸 H31) Testing cancelling already cancelled appointment")
        if appointment_id:  # Only test if we have a valid appointment_id
            already_cancelled_resp = session.post(urljoin(API_BASE, f'appointments/{appointment_id}/cancel'))
            if already_cancelled_resp.status_code == 400 and 'الحجز ملغي مسبقاً' in already_cancelled_resp.json().get('error', ''):
                test_results.append("✅ H31) Already cancelled appointment correctly rejected")
            else:
                test_results.append(f"❌ H31) Expected 400 with Arabic error, got {already_cancelled_resp.status_code}")
        else:
            test_results.append("❌ H31) Skipped - no valid appointment_id")
        
        # I) ADMIN ENDPOINTS
        print("\n📋 I) ADMIN ENDPOINTS TESTS")
        print("-" * 50)
        
        # I32) Create admin user
        print("\n🔸 I32) Creating admin user")
        admin_user = create_user("Admin User", timestamp_email(), "password123")
        if admin_user:
            promote_user_to_admin(admin_user['id'])
            login_user(admin_user['email'], "password123")  # Re-login to get fresh JWT
            
            # I33) Test admin experts list
            print("\n🔸 I33) Testing admin experts list")
            admin_experts_resp = session.get(urljoin(API_BASE, 'admin/experts?status=PENDING'))
            if admin_experts_resp.status_code == 200:
                admin_experts = admin_experts_resp.json().get('experts', [])
                test_results.append(f"✅ I33) Admin experts list working: {len(admin_experts)} experts")
            else:
                test_results.append(f"❌ I33) Expected 200, got {admin_experts_resp.status_code}")
            
            # I34) Create new PENDING expert for approval tests
            print("\n🔸 I34) Creating new PENDING expert")
            new_expert_user = create_user("New Expert", timestamp_email(), "password123", "GOLD")
            if new_expert_user:
                login_user(new_expert_user['email'], "password123")
                apply_resp = session.post(urljoin(API_BASE, 'experts/apply'), 
                                        json={'specialty': 'FINANCIAL', 'hourlyRate': 30})
                if apply_resp.status_code == 200:
                    new_expert_id = apply_resp.json()['expert']['id']
                    test_results.append(f"✅ I34) New PENDING expert created: {new_expert_id}")
                    
                    # I35) Test admin approval
                    print("\n🔸 I35) Testing admin approval")
                    login_user(admin_user['email'], "password123")
                    approve_resp = session.post(urljoin(API_BASE, f'admin/experts/{new_expert_id}/approve'))
                    if approve_resp.status_code == 200:
                        # Verify in DB
                        approved_expert = db.experts.find_one({'_id': new_expert_id})
                        approved_user = db.users.find_one({'_id': new_expert_user['id']})
                        
                        if (approved_expert and approved_expert.get('status') == 'APPROVED' and 
                            approved_expert.get('isApproved') and approved_user and 
                            approved_user.get('role') == 'EXPERT'):
                            test_results.append("✅ I35) Admin approval working correctly")
                        else:
                            test_results.append("❌ I35) Approval not properly recorded in DB")
                    else:
                        test_results.append(f"❌ I35) Expected 200, got {approve_resp.status_code}")
                    
                    # I36) Test rejection without reason
                    print("\n🔸 I36) Testing rejection without reason")
                    reject_no_reason_resp = session.post(urljoin(API_BASE, f'admin/experts/{new_expert_id}/reject'), json={})
                    if reject_no_reason_resp.status_code == 400 and 'سبب الرفض مطلوب' in reject_no_reason_resp.json().get('error', ''):
                        test_results.append("✅ I36) Rejection without reason correctly rejected")
                    else:
                        test_results.append(f"❌ I36) Expected 400 with Arabic error, got {reject_no_reason_resp.status_code}")
                    
                    # I37) Test rejection with reason
                    print("\n🔸 I37) Testing rejection with reason")
                    reject_resp = session.post(urljoin(API_BASE, f'admin/experts/{new_expert_id}/reject'), 
                                             json={'reason': 'سيرة غير مكتملة'})
                    if reject_resp.status_code == 200:
                        # Verify in DB
                        rejected_expert = db.experts.find_one({'_id': new_expert_id})
                        if (rejected_expert and rejected_expert.get('status') == 'REJECTED' and 
                            rejected_expert.get('rejectionReason') == 'سيرة غير مكتملة'):
                            test_results.append("✅ I37) Admin rejection working correctly")
                        else:
                            test_results.append("❌ I37) Rejection not properly recorded in DB")
                    else:
                        test_results.append(f"❌ I37) Expected 200, got {reject_resp.status_code}")
            
            # I38) Test non-admin access to admin endpoints
            print("\n🔸 I38) Testing non-admin access to admin endpoints")
            login_user(client_user['email'], "password123")
            non_admin_resp = session.post(urljoin(API_BASE, f'admin/experts/{expert_id}/approve'))
            if non_admin_resp.status_code == 403:
                test_results.append("✅ I38) Non-admin correctly blocked from admin endpoints")
            else:
                test_results.append(f"❌ I38) Expected 403, got {non_admin_resp.status_code}")
        
        # J) REGRESSION
        print("\n📋 J) REGRESSION TESTS")
        print("-" * 50)
        
        # J39) Test API health
        print("\n🔸 J39) Testing API health")
        health_resp = session.get(urljoin(API_BASE, ''))
        if health_resp.status_code == 200 and health_resp.json().get('message') == 'Majles API is running':
            test_results.append("✅ J39) API health check working")
        else:
            test_results.append(f"❌ J39) API health check failed: {health_resp.status_code}")
        
        # J40) Test existing endpoints still work
        print("\n🔸 J40) Testing existing endpoints still work")
        # Test signup
        regression_user = create_user("Regression User", timestamp_email(), "password123")
        if regression_user:
            # Test membership subscribe
            subscribe_resp = session.post(urljoin(API_BASE, 'membership/subscribe'), json={'tier': 'BASIC'})
            if subscribe_resp.status_code == 200:
                # Test companies endpoint
                companies_resp = session.get(urljoin(API_BASE, 'companies'))
                if companies_resp.status_code == 200:
                    test_results.append("✅ J40) Existing endpoints still working")
                else:
                    test_results.append(f"❌ J40) Companies endpoint failed: {companies_resp.status_code}")
            else:
                test_results.append(f"❌ J40) Membership subscribe failed: {subscribe_resp.status_code}")
        else:
            test_results.append("❌ J40) Regression user creation failed")
    
    except Exception as e:
        test_results.append(f"❌ CRITICAL ERROR: {e}")
        import traceback
        traceback.print_exc()
    
    # Print results summary
    print("\n" + "="*80)
    print("📊 PHASE 4 EXPERT CONSULTATION TEST RESULTS")
    print("="*80)
    
    passed = sum(1 for result in test_results if result.startswith("✅"))
    failed = sum(1 for result in test_results if result.startswith("❌"))
    
    for result in test_results:
        print(result)
    
    print(f"\n📈 SUMMARY: {passed} passed, {failed} failed out of {len(test_results)} tests")
    
    if failed == 0:
        print("🎉 ALL TESTS PASSED!")
        return True
    else:
        print(f"⚠️  {failed} TESTS FAILED")
        return False

if __name__ == "__main__":
    success = run_phase4_tests()
    exit(0 if success else 1)