#!/usr/bin/env python3
"""
Backend testing for Expert Review System endpoints
Tests POST /api/appointments/:id/review and GET /api/experts/:id/reviews
"""

import requests
import pymongo
import bcrypt
import uuid
from datetime import datetime, timedelta
import json
import os
from urllib.parse import urljoin

# Configuration from .env
BASE_URL = "https://omani-startup-hub.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "majles"

def get_db():
    """Get MongoDB database connection"""
    client = pymongo.MongoClient(MONGO_URL)
    return client[DB_NAME]

def create_test_user(email_suffix=""):
    """Create a test user via API and return user data + session cookies"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    email = f"testclient_{timestamp}{email_suffix}@example.com"
    password = "testpass123"
    
    # Create user via signup API
    signup_data = {
        "name": f"Test Client {timestamp}",
        "email": email,
        "password": password
    }
    
    response = requests.post(f"{API_BASE}/signup", json=signup_data)
    if response.status_code != 200:
        raise Exception(f"Signup failed: {response.status_code} {response.text}")
    
    user_data = response.json()["user"]
    
    # Login via NextAuth to get session cookies
    # First get CSRF token
    csrf_response = requests.get(f"{API_BASE}/auth/csrf")
    if csrf_response.status_code != 200:
        raise Exception(f"CSRF failed: {csrf_response.status_code}")
    
    csrf_token = csrf_response.json()["csrfToken"]
    
    # Login with credentials
    login_data = {
        "email": email,
        "password": password,
        "csrfToken": csrf_token,
        "callbackUrl": f"{BASE_URL}/dashboard",
        "json": "true"
    }
    
    login_response = requests.post(
        f"{API_BASE}/auth/callback/credentials",
        data=login_data,
        cookies=csrf_response.cookies,
        allow_redirects=False
    )
    
    if login_response.status_code not in [200, 302]:
        raise Exception(f"Login failed: {login_response.status_code} {login_response.text}")
    
    # Combine cookies from both requests
    session_cookies = {}
    session_cookies.update(csrf_response.cookies.get_dict())
    session_cookies.update(login_response.cookies.get_dict())
    
    return user_data, session_cookies

def seed_expert_and_user():
    """Seed an expert and its user directly in MongoDB"""
    db = get_db()
    
    # Create expert user
    expert_user_id = str(uuid.uuid4())
    expert_user = {
        "_id": expert_user_id,
        "name": "Dr. Ahmed Al-Rashid",
        "email": f"expert_{datetime.now().strftime('%Y%m%d_%H%M%S')}@example.com",
        "password": bcrypt.hashpw("expertpass123".encode(), bcrypt.gensalt()).decode(),
        "role": "EXPERT",
        "membershipTier": "GOLD",
        "membershipExpiry": datetime.now() + timedelta(days=365),
        "createdAt": datetime.now()
    }
    
    # Create expert profile
    expert_id = str(uuid.uuid4())
    expert = {
        "_id": expert_id,
        "userId": expert_user_id,
        "specialty": "LEGAL",
        "specialtyAr": "استشارات قانونية",
        "bio": "خبير قانوني متخصص في قانون الشركات",
        "experienceYears": 10,
        "hourlyRate": 25,
        "photo": "",
        "cv": "",
        "status": "APPROVED",
        "isApproved": True,
        "rating": 0,
        "totalSessions": 0,
        "createdAt": datetime.now(),
        "updatedAt": datetime.now()
    }
    
    # Insert into database
    db.users.insert_one(expert_user)
    db.experts.insert_one(expert)
    
    return expert_id, expert_user_id

def seed_appointment(client_id, expert_id, days_ago=1, status="CONFIRMED", rating=None):
    """Seed an appointment directly in MongoDB"""
    db = get_db()
    
    appointment_id = str(uuid.uuid4())
    appointment_date = datetime.now() - timedelta(days=days_ago)
    appointment_date = appointment_date.replace(hour=0, minute=0, second=0, microsecond=0)
    
    appointment = {
        "_id": appointment_id,
        "clientId": client_id,
        "expertId": expert_id,
        "date": appointment_date,
        "startTime": "09:00",
        "endTime": "10:00",
        "status": status,
        "totalPaid": 25,
        "originalPrice": 25,
        "discountPercent": 0,
        "notes": "",
        "cancelledAt": None,
        "cancelledBy": None,
        "reminderSentAt": None,
        "rating": rating,
        "reviewComment": "",
        "reviewedAt": None,
        "createdAt": datetime.now()
    }
    
    db.appointments.insert_one(appointment)
    return appointment_id

def test_review_endpoint():
    """Test the POST /api/appointments/:id/review endpoint"""
    print("🧪 Testing POST /api/appointments/:id/review endpoint...")
    
    try:
        # Setup: Create client user and get session
        print("📝 Creating test client user...")
        client_user, client_cookies = create_test_user()
        client_id = client_user["id"]
        print(f"✅ Created client: {client_user['email']}")
        
        # Setup: Create expert
        print("📝 Creating test expert...")
        expert_id, expert_user_id = seed_expert_and_user()
        print(f"✅ Created expert: {expert_id}")
        
        # Setup: Create past appointment
        print("📝 Creating past appointment...")
        appointment_id = seed_appointment(client_id, expert_id, days_ago=1, status="CONFIRMED")
        print(f"✅ Created appointment: {appointment_id}")
        
        # Test A: Happy path - valid review
        print("\n🔍 Test A: Happy path - valid review")
        review_data = {
            "rating": 5,
            "comment": "ممتاز، خدمة رائعة"
        }
        
        response = requests.post(
            f"{API_BASE}/appointments/{appointment_id}/review",
            json=review_data,
            cookies=client_cookies
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get("success") and result.get("appointment", {}).get("rating") == 5:
                print("✅ Happy path test passed")
                
                # Verify in database
                db = get_db()
                appt = db.appointments.find_one({"_id": appointment_id})
                expert = db.experts.find_one({"_id": expert_id})
                
                if (appt and appt.get("rating") == 5 and 
                    appt.get("reviewComment") == "ممتاز، خدمة رائعة" and
                    appt.get("reviewedAt") and
                    appt.get("status") == "COMPLETED" and
                    expert and expert.get("rating") == 5.0 and
                    expert.get("totalSessions") >= 1):
                    print("✅ Database verification passed")
                else:
                    print("❌ Database verification failed")
                    print(f"Appointment: rating={appt.get('rating')}, status={appt.get('status')}, reviewedAt={appt.get('reviewedAt')}")
                    print(f"Expert: rating={expert.get('rating')}, totalSessions={expert.get('totalSessions')}")
            else:
                print(f"❌ Happy path test failed: {result}")
        else:
            print(f"❌ Happy path test failed: {response.status_code} {response.text}")
        
        # Test B: Re-review same appointment (should fail with 409)
        print("\n🔍 Test B: Re-review same appointment")
        response = requests.post(
            f"{API_BASE}/appointments/{appointment_id}/review",
            json={"rating": 4, "comment": "تقييم ثاني"},
            cookies=client_cookies
        )
        
        if response.status_code == 409:
            result = response.json()
            if "لقد قمت بتقييم هذه الجلسة مسبقاً" in result.get("error", ""):
                print("✅ Re-review prevention test passed")
            else:
                print(f"❌ Wrong error message: {result}")
        else:
            print(f"❌ Re-review test failed: {response.status_code} {response.text}")
        
        # Test C: Create second appointment and review to test rating average
        print("\n🔍 Test C: Second review for rating average")
        appointment_id_2 = seed_appointment(client_id, expert_id, days_ago=2, status="CONFIRMED")
        
        response = requests.post(
            f"{API_BASE}/appointments/{appointment_id_2}/review",
            json={"rating": 3, "comment": "جيد"},
            cookies=client_cookies
        )
        
        if response.status_code == 200:
            # Check expert rating average (should be (5+3)/2 = 4.0)
            db = get_db()
            expert = db.experts.find_one({"_id": expert_id})
            expected_rating = 4.0  # (5+3)/2
            
            if expert and abs(expert.get("rating", 0) - expected_rating) < 0.01:
                print(f"✅ Rating average test passed: {expert.get('rating')}")
            else:
                print(f"❌ Rating average test failed: expected {expected_rating}, got {expert.get('rating', 0)}")
        else:
            print(f"❌ Second review failed: {response.status_code} {response.text}")
        
        # Test D: Validation errors
        print("\n🔍 Test D: Validation errors")
        
        # Create new appointment for validation tests
        appointment_id_3 = seed_appointment(client_id, expert_id, days_ago=3, status="CONFIRMED")
        
        validation_tests = [
            ({"rating": 0}, "التقييم يجب أن يكون بين 1 و 5 نجوم"),
            ({"rating": 6}, "التقييم يجب أن يكون بين 1 و 5 نجوم"),
            ({"rating": 3.5}, "التقييم يجب أن يكون بين 1 و 5 نجوم"),
            ({"rating": "abc"}, "التقييم يجب أن يكون بين 1 و 5 نجوم"),
        ]
        
        for test_data, expected_error in validation_tests:
            response = requests.post(
                f"{API_BASE}/appointments/{appointment_id_3}/review",
                json=test_data,
                cookies=client_cookies
            )
            
            if response.status_code == 400:
                result = response.json()
                if expected_error in result.get("error", ""):
                    print(f"✅ Validation test passed for {test_data}")
                else:
                    print(f"❌ Wrong error message for {test_data}: {result}")
            else:
                print(f"❌ Validation test failed for {test_data}: {response.status_code}")
        
        # Test E: Unauthorized access
        print("\n🔍 Test E: Unauthorized access")
        response = requests.post(
            f"{API_BASE}/appointments/{appointment_id_3}/review",
            json={"rating": 5}
        )
        
        if response.status_code == 401:
            result = response.json()
            if "غير مصرح" in result.get("error", ""):
                print("✅ Unauthorized test passed")
            else:
                print(f"❌ Wrong error message: {result}")
        else:
            print(f"❌ Unauthorized test failed: {response.status_code}")
        
        # Test F: Wrong user (create second client)
        print("\n🔍 Test F: Wrong user access")
        client_user_2, client_cookies_2 = create_test_user("_2")
        
        response = requests.post(
            f"{API_BASE}/appointments/{appointment_id_3}/review",
            json={"rating": 5},
            cookies=client_cookies_2
        )
        
        if response.status_code == 403:
            result = response.json()
            if "لا يمكنك تقييم جلسة ليست لك" in result.get("error", ""):
                print("✅ Wrong user test passed")
            else:
                print(f"❌ Wrong error message: {result}")
        else:
            print(f"❌ Wrong user test failed: {response.status_code}")
        
        # Test G: Future appointment
        print("\n🔍 Test G: Future appointment")
        future_appointment_id = seed_appointment(client_id, expert_id, days_ago=-1, status="CONFIRMED")  # Tomorrow
        
        response = requests.post(
            f"{API_BASE}/appointments/{future_appointment_id}/review",
            json={"rating": 5},
            cookies=client_cookies
        )
        
        if response.status_code == 400:
            result = response.json()
            if "لا يمكن التقييم قبل انتهاء الجلسة" in result.get("error", ""):
                print("✅ Future appointment test passed")
            else:
                print(f"❌ Wrong error message: {result}")
        else:
            print(f"❌ Future appointment test failed: {response.status_code}")
        
        # Test H: Cancelled appointment
        print("\n🔍 Test H: Cancelled appointment")
        cancelled_appointment_id = seed_appointment(client_id, expert_id, days_ago=4, status="CANCELLED")
        
        response = requests.post(
            f"{API_BASE}/appointments/{cancelled_appointment_id}/review",
            json={"rating": 5},
            cookies=client_cookies
        )
        
        if response.status_code == 400:
            result = response.json()
            if "لا يمكن تقييم جلسة ملغاة" in result.get("error", ""):
                print("✅ Cancelled appointment test passed")
            else:
                print(f"❌ Wrong error message: {result}")
        else:
            print(f"❌ Cancelled appointment test failed: {response.status_code}")
        
        # Test I: Not found appointment
        print("\n🔍 Test I: Not found appointment")
        random_uuid = str(uuid.uuid4())
        
        response = requests.post(
            f"{API_BASE}/appointments/{random_uuid}/review",
            json={"rating": 5},
            cookies=client_cookies
        )
        
        if response.status_code == 404:
            result = response.json()
            if "الحجز غير موجود" in result.get("error", ""):
                print("✅ Not found test passed")
            else:
                print(f"❌ Wrong error message: {result}")
        else:
            print(f"❌ Not found test failed: {response.status_code}")
        
        return expert_id
        
    except Exception as e:
        print(f"❌ Review endpoint test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        return None

def test_reviews_list_endpoint(expert_id):
    """Test the GET /api/experts/:id/reviews endpoint"""
    print("\n🧪 Testing GET /api/experts/:id/reviews endpoint...")
    
    try:
        # Test J: Get reviews list (public endpoint)
        print("\n🔍 Test J: Get reviews list")
        response = requests.get(f"{API_BASE}/experts/{expert_id}/reviews")
        
        if response.status_code == 200:
            result = response.json()
            reviews = result.get("reviews", [])
            
            if len(reviews) >= 2:  # Should have at least 2 reviews from previous tests
                # Check structure and sorting
                first_review = reviews[0]
                required_fields = ["id", "rating", "comment", "reviewedAt", "clientName"]
                
                if all(field in first_review for field in required_fields):
                    # Check if sorted by reviewedAt desc
                    if len(reviews) > 1:
                        first_date = datetime.fromisoformat(first_review["reviewedAt"].replace('Z', '+00:00'))
                        second_date = datetime.fromisoformat(reviews[1]["reviewedAt"].replace('Z', '+00:00'))
                        
                        if first_date >= second_date:
                            print(f"✅ Reviews list test passed: {len(reviews)} reviews found, properly sorted")
                            print(f"   First review: rating={first_review['rating']}, comment='{first_review['comment']}'")
                        else:
                            print("❌ Reviews not sorted by reviewedAt desc")
                    else:
                        print(f"✅ Reviews list test passed: {len(reviews)} review found")
                else:
                    print(f"❌ Missing required fields in review: {first_review}")
            else:
                print(f"❌ Expected at least 2 reviews, got {len(reviews)}")
        else:
            print(f"❌ Reviews list test failed: {response.status_code} {response.text}")
        
    except Exception as e:
        print(f"❌ Reviews list endpoint test failed with exception: {e}")
        import traceback
        traceback.print_exc()

def test_regression():
    """Test regression endpoints to ensure they still work"""
    print("\n🧪 Testing regression endpoints...")
    
    try:
        # Test K: GET /api/
        print("\n🔍 Test K: GET /api/")
        response = requests.get(f"{API_BASE}/")
        
        if response.status_code == 200:
            result = response.json()
            if result.get("message") == "Majles API is running":
                print("✅ API health check passed")
            else:
                print(f"❌ Wrong message: {result}")
        else:
            print(f"❌ API health check failed: {response.status_code}")
        
        # Test L: POST /api/signup
        print("\n🔍 Test L: POST /api/signup")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        signup_data = {
            "name": f"Regression Test {timestamp}",
            "email": f"regression_{timestamp}@example.com",
            "password": "testpass123"
        }
        
        response = requests.post(f"{API_BASE}/signup", json=signup_data)
        
        if response.status_code == 200:
            result = response.json()
            if result.get("success") and result.get("user"):
                print("✅ Signup regression test passed")
            else:
                print(f"❌ Signup response invalid: {result}")
        else:
            print(f"❌ Signup regression test failed: {response.status_code}")
        
    except Exception as e:
        print(f"❌ Regression test failed with exception: {e}")

def main():
    """Main test function"""
    print("🚀 Starting Expert Review System Backend Tests")
    print(f"📍 Base URL: {API_BASE}")
    print(f"🗄️  Database: {MONGO_URL}/{DB_NAME}")
    print("=" * 80)
    
    try:
        # Test the review endpoint
        expert_id = test_review_endpoint()
        
        if expert_id:
            # Test the reviews list endpoint
            test_reviews_list_endpoint(expert_id)
        
        # Test regression endpoints
        test_regression()
        
        print("\n" + "=" * 80)
        print("🎉 Expert Review System Backend Tests Completed!")
        
    except Exception as e:
        print(f"\n❌ Test suite failed with exception: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()