#!/usr/bin/env python3
"""
Backend test for Jobs / Employment Board feature.
Tests all CRUD operations, authentication, authorization, and business logic.
"""
import requests
import json
import time
from datetime import datetime, timedelta
from pymongo import MongoClient
import os

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://omani-startup-hub.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017/majles')
DB_NAME = os.getenv('DB_NAME', 'majles')

# Admin credentials
ADMIN_EMAIL = "mazin298@gmail.com"
ADMIN_PASSWORD = "Password123"

# Test state
admin_session = None
admin_user_id = None
test_company_id = None
test_job_id = None
test_seeker_user_id = None
test_seeker_session = None
test_application_id = None
no_company_user_session = None
no_company_user_id = None

# Cleanup tracking
cleanup_items = {
    'users': [],
    'companies': [],
    'jobs': [],
    'applications': [],
    'seekers': []
}

def print_test(msg):
    """Print test message"""
    print(f"\n{'='*80}")
    print(f"TEST: {msg}")
    print('='*80)

def print_result(success, msg):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {msg}")

def login(email, password):
    """Login and return session cookies"""
    try:
        # Get CSRF token
        csrf_resp = requests.get(f"{API_BASE}/auth/csrf")
        if csrf_resp.status_code != 200:
            print(f"❌ Failed to get CSRF token: {csrf_resp.status_code}")
            return None
        csrf_token = csrf_resp.json().get('csrfToken')
        
        # Login
        login_resp = requests.post(
            f"{API_BASE}/auth/callback/credentials",
            data={
                'email': email,
                'password': password,
                'csrfToken': csrf_token,
                'json': 'true'
            },
            cookies=csrf_resp.cookies,
            allow_redirects=False
        )
        
        if login_resp.status_code in [200, 302]:
            # Combine cookies
            cookies = {**csrf_resp.cookies.get_dict(), **login_resp.cookies.get_dict()}
            return cookies
        else:
            print(f"❌ Login failed: {login_resp.status_code}")
            return None
    except Exception as e:
        print(f"❌ Login error: {e}")
        return None

def get_user_id(session_cookies):
    """Get user ID from session"""
    try:
        resp = requests.get(f"{API_BASE}/me", cookies=session_cookies)
        if resp.status_code == 200:
            return resp.json().get('id')
        return None
    except:
        return None

def create_test_user(email_prefix):
    """Create a test user and return session + user_id"""
    try:
        timestamp = int(time.time() * 1000)
        email = f"{email_prefix}-{timestamp}@test.com"
        name = f"مستخدم تجريبي {timestamp}"
        
        resp = requests.post(
            f"{API_BASE}/signup",
            json={
                'name': name,
                'email': email,
                'password': 'Test123456'
            }
        )
        
        if resp.status_code != 200:
            print(f"❌ Failed to create user: {resp.status_code} - {resp.text}")
            return None, None
        
        # Login
        session = login(email, 'Test123456')
        if not session:
            return None, None
        
        user_id = get_user_id(session)
        if user_id:
            cleanup_items['users'].append(user_id)
        
        return session, user_id
    except Exception as e:
        print(f"❌ Create user error: {e}")
        return None, None

def create_test_company(session_cookies, owner_id):
    """Create a test company for the user"""
    try:
        timestamp = int(time.time() * 1000)
        resp = requests.post(
            f"{API_BASE}/companies",
            json={
                'nameAr': f'شركة اختبار الوظائف {timestamp}',
                'sector': 'TECH',
                'governorate': 'MUSCAT',
                'description': 'شركة تجريبية لاختبار نظام الوظائف'
            },
            cookies=session_cookies
        )
        
        if resp.status_code == 200:
            company_id = resp.json().get('company', {}).get('id')
            if company_id:
                cleanup_items['companies'].append(company_id)
                # Approve the company directly in DB
                client = MongoClient(MONGO_URL)
                db = client[DB_NAME]
                db.companies.update_one(
                    {'_id': company_id},
                    {'$set': {'status': 'APPROVED', 'isApproved': True}}
                )
                client.close()
                return company_id
        return None
    except Exception as e:
        print(f"❌ Create company error: {e}")
        return None

def cleanup():
    """Clean up test data"""
    print_test("CLEANUP - Removing test data")
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        
        # Delete applications
        if cleanup_items['applications']:
            result = db.jobapplications.delete_many({'_id': {'$in': cleanup_items['applications']}})
            print(f"Deleted {result.deleted_count} applications")
        
        # Delete jobs
        if cleanup_items['jobs']:
            result = db.jobpostings.delete_many({'_id': {'$in': cleanup_items['jobs']}})
            print(f"Deleted {result.deleted_count} jobs")
        
        # Delete seekers
        if cleanup_items['seekers']:
            result = db.jobseekers.delete_many({'userId': {'$in': cleanup_items['seekers']}})
            print(f"Deleted {result.deleted_count} job seekers")
        
        # Delete companies
        if cleanup_items['companies']:
            result = db.companies.delete_many({'_id': {'$in': cleanup_items['companies']}})
            print(f"Deleted {result.deleted_count} companies")
        
        # Delete users (except admin)
        if cleanup_items['users']:
            result = db.users.delete_many({'_id': {'$in': cleanup_items['users']}})
            print(f"Deleted {result.deleted_count} users")
        
        client.close()
        print_result(True, "Cleanup completed")
    except Exception as e:
        print_result(False, f"Cleanup error: {e}")

# ============================================================================
# TEST SCENARIOS
# ============================================================================

def test_1_public_jobs_list():
    """Test 1: Public jobs list (unauthenticated)"""
    print_test("1. Public jobs list (unauthenticated)")
    
    try:
        resp = requests.get(f"{API_BASE}/jobs")
        print_result(
            resp.status_code == 200,
            f"GET /api/jobs returns 200 (got {resp.status_code})"
        )
        
        if resp.status_code == 200:
            data = resp.json()
            has_structure = all(k in data for k in ['total', 'page', 'limit', 'pages', 'items'])
            print_result(
                has_structure,
                f"Response has correct structure: {has_structure}"
            )
            print(f"   Total jobs: {data.get('total', 0)}")
        
        # Test with filters
        resp2 = requests.get(f"{API_BASE}/jobs?sector=TECH&governorate=MUSCAT")
        print_result(
            resp2.status_code == 200,
            f"GET /api/jobs with filters returns 200 (got {resp2.status_code})"
        )
        
        return True
    except Exception as e:
        print_result(False, f"Error: {e}")
        return False

def test_2_employer_no_company():
    """Test 2: Employer workflow - user with NO company"""
    print_test("2. Employer workflow - user with NO company")
    
    global no_company_user_session, no_company_user_id
    
    try:
        # Create user without company
        no_company_user_session, no_company_user_id = create_test_user('no-company')
        if not no_company_user_session:
            print_result(False, "Failed to create test user")
            return False
        
        print_result(True, f"Created test user: {no_company_user_id}")
        
        # Try to access employer jobs
        resp = requests.get(f"{API_BASE}/employer/jobs", cookies=no_company_user_session)
        is_403 = resp.status_code == 403
        has_code = resp.json().get('code') == 'NO_COMPANY' if is_403 else False
        
        print_result(
            is_403 and has_code,
            f"GET /api/employer/jobs without company returns 403 NO_COMPANY (got {resp.status_code}, code: {resp.json().get('code')})"
        )
        
        return is_403 and has_code
    except Exception as e:
        print_result(False, f"Error: {e}")
        return False

def test_3_employer_with_company():
    """Test 3: Employer workflow - admin with company"""
    print_test("3. Employer workflow - admin with company")
    
    global admin_session, admin_user_id, test_company_id, test_job_id
    
    try:
        # Login as admin
        admin_session = login(ADMIN_EMAIL, ADMIN_PASSWORD)
        if not admin_session:
            print_result(False, "Failed to login as admin")
            return False
        
        admin_user_id = get_user_id(admin_session)
        print_result(True, f"Logged in as admin: {admin_user_id}")
        
        # Check if admin has a company
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        existing_company = db.companies.find_one({'ownerId': admin_user_id})
        
        if existing_company:
            test_company_id = existing_company['_id']
            print_result(True, f"Admin already has company: {test_company_id}")
        else:
            # Create company for admin
            test_company_id = create_test_company(admin_session, admin_user_id)
            if not test_company_id:
                print_result(False, "Failed to create company for admin")
                client.close()
                return False
            print_result(True, f"Created company for admin: {test_company_id}")
        
        client.close()
        
        # GET /api/employer/jobs
        resp = requests.get(f"{API_BASE}/employer/jobs", cookies=admin_session)
        is_200 = resp.status_code == 200
        has_structure = False
        if is_200:
            data = resp.json()
            has_structure = 'companies' in data and 'items' in data
        
        print_result(
            is_200 and has_structure,
            f"GET /api/employer/jobs returns 200 with structure (got {resp.status_code})"
        )
        
        return is_200 and has_structure
    except Exception as e:
        print_result(False, f"Error: {e}")
        return False

def test_4_create_job_posting():
    """Test 4: Create job posting"""
    print_test("4. Create job posting")
    
    global test_job_id
    
    try:
        # Valid job posting
        job_data = {
            "companyId": test_company_id,
            "titleAr": "مطور Full-Stack",
            "descriptionAr": "نبحث عن مطور محترف للانضمام إلى فريقنا في مسقط. يشمل الدور بناء واجهات المستخدم والـ APIs والعمل مع MongoDB.",
            "sector": "TECH",
            "governorate": "MUSCAT",
            "city": "مسقط",
            "employmentType": "FULL_TIME",
            "workMode": "HYBRID",
            "experienceLevel": "MID",
            "salaryMin": 500,
            "salaryMax": 1000,
            "requirements": ["3+ سنوات خبرة", "React/Node.js"],
            "responsibilities": ["بناء واجهات المستخدم"],
            "benefits": ["تأمين صحي"],
            "skills": ["React", "Node.js", "MongoDB"]
        }
        
        resp = requests.post(f"{API_BASE}/employer/jobs", json=job_data, cookies=admin_session)
        is_200 = resp.status_code == 200
        
        if is_200:
            data = resp.json()
            test_job_id = data.get('job', {}).get('id')
            if test_job_id:
                cleanup_items['jobs'].append(test_job_id)
            
            job = data.get('job', {})
            has_correct_data = (
                job.get('status') == 'ACTIVE' and
                job.get('applyDeadline') is not None
            )
            
            print_result(
                has_correct_data,
                f"Job created with correct data: status={job.get('status')}, deadline set"
            )
        
        print_result(is_200, f"POST /api/employer/jobs returns 200 (got {resp.status_code})")
        
        # Test validation: missing sector
        invalid_data = {**job_data, 'sector': None}
        del invalid_data['sector']
        resp2 = requests.post(f"{API_BASE}/employer/jobs", json=invalid_data, cookies=admin_session)
        print_result(
            resp2.status_code == 400,
            f"POST with missing sector returns 400 (got {resp2.status_code})"
        )
        
        # Test validation: missing governorate
        invalid_data2 = {**job_data, 'governorate': None}
        del invalid_data2['governorate']
        resp3 = requests.post(f"{API_BASE}/employer/jobs", json=invalid_data2, cookies=admin_session)
        print_result(
            resp3.status_code == 400,
            f"POST with missing governorate returns 400 (got {resp3.status_code})"
        )
        
        # Test validation: titleAr too short
        invalid_data3 = {**job_data, 'titleAr': 'ab'}
        resp4 = requests.post(f"{API_BASE}/employer/jobs", json=invalid_data3, cookies=admin_session)
        print_result(
            resp4.status_code == 400,
            f"POST with short titleAr returns 400 (got {resp4.status_code})"
        )
        
        # Test validation: descriptionAr too short
        invalid_data4 = {**job_data, 'descriptionAr': 'short'}
        resp5 = requests.post(f"{API_BASE}/employer/jobs", json=invalid_data4, cookies=admin_session)
        print_result(
            resp5.status_code == 400,
            f"POST with short descriptionAr returns 400 (got {resp5.status_code})"
        )
        
        return is_200 and test_job_id is not None
    except Exception as e:
        print_result(False, f"Error: {e}")
        return False

def test_5_public_job_detail():
    """Test 5: Public job detail"""
    print_test("5. Public job detail")
    
    try:
        # GET /api/jobs (should contain the new job)
        resp = requests.get(f"{API_BASE}/jobs")
        if resp.status_code == 200:
            data = resp.json()
            job_found = any(j.get('id') == test_job_id for j in data.get('items', []))
            print_result(job_found, f"New job appears in public list: {job_found}")
        
        # GET /api/jobs/:id
        resp2 = requests.get(f"{API_BASE}/jobs/{test_job_id}")
        is_200 = resp2.status_code == 200
        
        if is_200:
            data = resp2.json()
            has_structure = 'job' in data and 'alreadyApplied' in data
            print_result(has_structure, f"Job detail has correct structure: {has_structure}")
        
        print_result(is_200, f"GET /api/jobs/:id returns 200 (got {resp2.status_code})")
        
        # Test invalid ID
        resp3 = requests.get(f"{API_BASE}/jobs/invalid-id")
        print_result(
            resp3.status_code == 400,
            f"GET /api/jobs/<invalid-id> returns 400 (got {resp3.status_code})"
        )
        
        # Test non-existent ID
        fake_id = "507f1f77bcf86cd799439011"
        resp4 = requests.get(f"{API_BASE}/jobs/{fake_id}")
        print_result(
            resp4.status_code == 404,
            f"GET /api/jobs/<non-existent-id> returns 404 (got {resp4.status_code})"
        )
        
        return is_200
    except Exception as e:
        print_result(False, f"Error: {e}")
        return False

def test_6_job_seeker_profile():
    """Test 6: Job seeker profile"""
    print_test("6. Job seeker profile")
    
    global test_seeker_user_id, test_seeker_session
    
    try:
        # Create fresh user
        test_seeker_session, test_seeker_user_id = create_test_user('job-seeker')
        if not test_seeker_session:
            print_result(False, "Failed to create test seeker")
            return False
        
        cleanup_items['seekers'].append(test_seeker_user_id)
        print_result(True, f"Created test seeker: {test_seeker_user_id}")
        
        # Test unauthenticated access
        resp = requests.get(f"{API_BASE}/me/job-seeker")
        print_result(
            resp.status_code == 401,
            f"GET /api/me/job-seeker unauthenticated returns 401 (got {resp.status_code})"
        )
        
        # GET profile (should be null)
        resp2 = requests.get(f"{API_BASE}/me/job-seeker", cookies=test_seeker_session)
        is_200 = resp2.status_code == 200
        profile_null = resp2.json().get('profile') is None if is_200 else False
        
        print_result(
            is_200 and profile_null,
            f"GET /api/me/job-seeker returns 200 with null profile (got {resp2.status_code}, profile: {resp2.json().get('profile')})"
        )
        
        # PUT with missing fullName
        resp3 = requests.put(
            f"{API_BASE}/me/job-seeker",
            json={'title': 'مطور'},
            cookies=test_seeker_session
        )
        print_result(
            resp3.status_code == 400,
            f"PUT without fullName returns 400 (got {resp3.status_code})"
        )
        
        # PUT with valid data
        profile_data = {
            'fullName': 'طالب اختبار',
            'title': 'مطور',
            'phone': '99000001',
            'yearsOfExperience': 3,
            'skills': ['React', 'Node.js'],
            'links': [{'label': 'LinkedIn', 'url': 'https://linkedin.com/in/test'}]
        }
        
        resp4 = requests.put(
            f"{API_BASE}/me/job-seeker",
            json=profile_data,
            cookies=test_seeker_session
        )
        is_200_put = resp4.status_code == 200
        print_result(is_200_put, f"PUT /api/me/job-seeker returns 200 (got {resp4.status_code})")
        
        # GET profile again (should have data)
        resp5 = requests.get(f"{API_BASE}/me/job-seeker", cookies=test_seeker_session)
        if resp5.status_code == 200:
            profile = resp5.json().get('profile', {})
            has_data = profile.get('fullName') == 'طالب اختبار'
            print_result(has_data, f"Profile saved correctly: {has_data}")
        
        return is_200 and is_200_put
    except Exception as e:
        print_result(False, f"Error: {e}")
        return False

def test_7_apply_flow():
    """Test 7: Apply flow"""
    print_test("7. Apply flow")
    
    global test_application_id
    
    try:
        # Apply with complete profile
        resp = requests.post(
            f"{API_BASE}/jobs/{test_job_id}/apply",
            json={'coverLetter': 'أهتم كثيراً بالانضمام لفريقكم'},
            cookies=test_seeker_session
        )
        is_200 = resp.status_code == 200
        
        if is_200:
            data = resp.json()
            test_application_id = data.get('application', {}).get('id')
            if test_application_id:
                cleanup_items['applications'].append(test_application_id)
            print_result(True, f"Application created: {test_application_id}")
        
        print_result(is_200, f"POST /api/jobs/:id/apply returns 200 (got {resp.status_code})")
        
        # Verify applicant count incremented
        resp2 = requests.get(f"{API_BASE}/jobs/{test_job_id}")
        if resp2.status_code == 200:
            job = resp2.json().get('job', {})
            count = job.get('applicantsCount', 0)
            print_result(count > 0, f"Applicant count incremented: {count}")
        
        # Try duplicate apply
        resp3 = requests.post(
            f"{API_BASE}/jobs/{test_job_id}/apply",
            json={'coverLetter': 'Another application'},
            cookies=test_seeker_session
        )
        is_409 = resp3.status_code == 409
        has_code = resp3.json().get('code') == 'DUPLICATE' if is_409 else False
        print_result(
            is_409 and has_code,
            f"Duplicate apply returns 409 DUPLICATE (got {resp3.status_code}, code: {resp3.json().get('code')})"
        )
        
        # Employer tries to apply to own job
        resp4 = requests.post(
            f"{API_BASE}/jobs/{test_job_id}/apply",
            json={'coverLetter': 'Test'},
            cookies=admin_session
        )
        print_result(
            resp4.status_code == 400,
            f"Employer applying to own job returns 400 (got {resp4.status_code})"
        )
        
        # Fresh user with empty profile tries to apply
        fresh_session, fresh_user_id = create_test_user('empty-profile')
        if fresh_session:
            resp5 = requests.post(
                f"{API_BASE}/jobs/{test_job_id}/apply",
                json={'coverLetter': 'Test'},
                cookies=fresh_session
            )
            is_400 = resp5.status_code == 400
            has_code = resp5.json().get('code') == 'PROFILE_INCOMPLETE' if is_400 else False
            print_result(
                is_400 and has_code,
                f"Empty profile apply returns 400 PROFILE_INCOMPLETE (got {resp5.status_code}, code: {resp5.json().get('code')})"
            )
        
        return is_200
    except Exception as e:
        print_result(False, f"Error: {e}")
        return False

def test_8_my_applications():
    """Test 8: My applications"""
    print_test("8. My applications")
    
    try:
        # GET /api/me/job-applications
        resp = requests.get(f"{API_BASE}/me/job-applications", cookies=test_seeker_session)
        is_200 = resp.status_code == 200
        
        if is_200:
            data = resp.json()
            items = data.get('items', [])
            has_application = len(items) > 0
            has_job_info = items[0].get('job') is not None if has_application else False
            
            print_result(
                has_application and has_job_info,
                f"Applications list has items with job info: {has_application and has_job_info}"
            )
        
        print_result(is_200, f"GET /api/me/job-applications returns 200 (got {resp.status_code})")
        
        # DELETE application (withdraw)
        resp2 = requests.delete(
            f"{API_BASE}/me/job-applications/{test_application_id}",
            cookies=test_seeker_session
        )
        is_200_delete = resp2.status_code == 200
        print_result(is_200_delete, f"DELETE application returns 200 (got {resp2.status_code})")
        
        # Verify status is WITHDRAWN and count decremented
        if is_200_delete:
            client = MongoClient(MONGO_URL)
            db = client[DB_NAME]
            app = db.jobapplications.find_one({'_id': test_application_id})
            if app:
                status_withdrawn = app.get('status') == 'WITHDRAWN'
                print_result(status_withdrawn, f"Application status is WITHDRAWN: {status_withdrawn}")
            
            # Check applicant count
            resp3 = requests.get(f"{API_BASE}/jobs/{test_job_id}")
            if resp3.status_code == 200:
                job = resp3.json().get('job', {})
                count = job.get('applicantsCount', 0)
                print_result(count == 0, f"Applicant count decremented: {count}")
            
            client.close()
        
        # Try to delete someone else's application (should fail)
        resp4 = requests.delete(
            f"{API_BASE}/me/job-applications/{test_application_id}",
            cookies=admin_session
        )
        print_result(
            resp4.status_code == 403,
            f"Delete other's application returns 403 (got {resp4.status_code})"
        )
        
        return is_200 and is_200_delete
    except Exception as e:
        print_result(False, f"Error: {e}")
        return False

def test_9_employer_sees_applicants():
    """Test 9: Employer sees applicants"""
    print_test("9. Employer sees applicants")
    
    try:
        # Re-apply so we have an application to view
        requests.post(
            f"{API_BASE}/jobs/{test_job_id}/apply",
            json={'coverLetter': 'Re-applying after withdrawal'},
            cookies=test_seeker_session
        )
        time.sleep(0.5)
        
        # GET /api/employer/jobs/:id/applicants
        resp = requests.get(
            f"{API_BASE}/employer/jobs/{test_job_id}/applicants",
            cookies=admin_session
        )
        is_200 = resp.status_code == 200
        
        if is_200:
            data = resp.json()
            has_structure = 'job' in data and 'items' in data
            items = data.get('items', [])
            has_items = len(items) > 0
            
            print_result(
                has_structure and has_items,
                f"Applicants list has correct structure and items: {has_structure and has_items}"
            )
            
            if has_items:
                app_id = items[0].get('id')
                
                # PATCH application status
                resp2 = requests.patch(
                    f"{API_BASE}/employer/applications/{app_id}",
                    json={'status': 'SHORTLISTED'},
                    cookies=admin_session
                )
                is_200_patch = resp2.status_code == 200
                
                if is_200_patch:
                    data2 = resp2.json()
                    app = data2.get('application', {})
                    status_updated = app.get('status') == 'SHORTLISTED'
                    viewed_set = app.get('employerViewedAt') is not None
                    
                    print_result(
                        status_updated and viewed_set,
                        f"Application status updated and viewedAt set: {status_updated and viewed_set}"
                    )
                
                print_result(is_200_patch, f"PATCH application returns 200 (got {resp2.status_code})")
        
        print_result(is_200, f"GET /api/employer/jobs/:id/applicants returns 200 (got {resp.status_code})")
        
        return is_200
    except Exception as e:
        print_result(False, f"Error: {e}")
        return False

def test_10_extend_deadline():
    """Test 10: Extend job deadline"""
    print_test("10. Extend job deadline")
    
    try:
        # Get current deadline
        resp = requests.get(f"{API_BASE}/jobs/{test_job_id}")
        if resp.status_code == 200:
            old_deadline = resp.json().get('job', {}).get('applyDeadline')
            
            # Extend deadline
            resp2 = requests.post(
                f"{API_BASE}/employer/jobs/{test_job_id}/extend",
                cookies=admin_session
            )
            is_200 = resp2.status_code == 200
            
            if is_200:
                new_deadline = resp2.json().get('job', {}).get('applyDeadline')
                extended = new_deadline > old_deadline if new_deadline and old_deadline else False
                print_result(extended, f"Deadline extended: {extended}")
            
            print_result(is_200, f"POST /api/employer/jobs/:id/extend returns 200 (got {resp2.status_code})")
            
            return is_200
        
        return False
    except Exception as e:
        print_result(False, f"Error: {e}")
        return False

def test_11_close_reopen_job():
    """Test 11: Close and reopen job"""
    print_test("11. Close and reopen job")
    
    try:
        # Close job
        resp = requests.patch(
            f"{API_BASE}/employer/jobs/{test_job_id}",
            json={'status': 'CLOSED'},
            cookies=admin_session
        )
        is_200_close = resp.status_code == 200
        
        if is_200_close:
            status = resp.json().get('job', {}).get('status')
            print_result(status == 'CLOSED', f"Job closed: {status == 'CLOSED'}")
        
        print_result(is_200_close, f"PATCH to close job returns 200 (got {resp.status_code})")
        
        # Reopen job
        resp2 = requests.patch(
            f"{API_BASE}/employer/jobs/{test_job_id}",
            json={'status': 'ACTIVE'},
            cookies=admin_session
        )
        is_200_reopen = resp2.status_code == 200
        
        if is_200_reopen:
            status = resp2.json().get('job', {}).get('status')
            print_result(status == 'ACTIVE', f"Job reopened: {status == 'ACTIVE'}")
        
        print_result(is_200_reopen, f"PATCH to reopen job returns 200 (got {resp2.status_code})")
        
        return is_200_close and is_200_reopen
    except Exception as e:
        print_result(False, f"Error: {e}")
        return False

def test_12_auth_checks():
    """Test 12: Authentication checks"""
    print_test("12. Authentication checks")
    
    try:
        # Test all employer endpoints without auth
        endpoints = [
            ('GET', f"{API_BASE}/employer/jobs"),
            ('POST', f"{API_BASE}/employer/jobs"),
            ('GET', f"{API_BASE}/employer/jobs/{test_job_id}/applicants"),
        ]
        
        all_401 = True
        for method, url in endpoints:
            if method == 'GET':
                resp = requests.get(url)
            else:
                resp = requests.post(url, json={})
            
            is_401 = resp.status_code == 401
            print_result(is_401, f"{method} {url.split('/api/')[-1]} returns 401 (got {resp.status_code})")
            all_401 = all_401 and is_401
        
        # Test job-seeker endpoints without auth
        seeker_endpoints = [
            ('GET', f"{API_BASE}/me/job-seeker"),
            ('PUT', f"{API_BASE}/me/job-seeker"),
            ('GET', f"{API_BASE}/me/job-applications"),
        ]
        
        for method, url in seeker_endpoints:
            if method == 'GET':
                resp = requests.get(url)
            else:
                resp = requests.put(url, json={})
            
            is_401 = resp.status_code == 401
            print_result(is_401, f"{method} {url.split('/api/')[-1]} returns 401 (got {resp.status_code})")
            all_401 = all_401 and is_401
        
        return all_401
    except Exception as e:
        print_result(False, f"Error: {e}")
        return False

def test_13_delete_job():
    """Test 13: Delete job (cleanup test)"""
    print_test("13. Delete job")
    
    try:
        resp = requests.delete(
            f"{API_BASE}/employer/jobs/{test_job_id}",
            cookies=admin_session
        )
        is_200 = resp.status_code == 200
        print_result(is_200, f"DELETE /api/employer/jobs/:id returns 200 (got {resp.status_code})")
        
        # Verify job is deleted
        resp2 = requests.get(f"{API_BASE}/jobs/{test_job_id}")
        print_result(
            resp2.status_code == 404,
            f"Deleted job returns 404 (got {resp2.status_code})"
        )
        
        if is_200:
            # Remove from cleanup list since we already deleted it
            if test_job_id in cleanup_items['jobs']:
                cleanup_items['jobs'].remove(test_job_id)
        
        return is_200
    except Exception as e:
        print_result(False, f"Error: {e}")
        return False

# ============================================================================
# MAIN TEST RUNNER
# ============================================================================

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("JOBS / EMPLOYMENT BOARD - BACKEND TESTING")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"MongoDB: {MONGO_URL}")
    print("="*80)
    
    results = []
    
    try:
        # Run tests in order
        results.append(("Public jobs list", test_1_public_jobs_list()))
        results.append(("Employer - no company", test_2_employer_no_company()))
        results.append(("Employer - with company", test_3_employer_with_company()))
        results.append(("Create job posting", test_4_create_job_posting()))
        results.append(("Public job detail", test_5_public_job_detail()))
        results.append(("Job seeker profile", test_6_job_seeker_profile()))
        results.append(("Apply flow", test_7_apply_flow()))
        results.append(("My applications", test_8_my_applications()))
        results.append(("Employer sees applicants", test_9_employer_sees_applicants()))
        results.append(("Extend deadline", test_10_extend_deadline()))
        results.append(("Close and reopen job", test_11_close_reopen_job()))
        results.append(("Authentication checks", test_12_auth_checks()))
        results.append(("Delete job", test_13_delete_job()))
        
    finally:
        # Always cleanup
        cleanup()
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {name}")
    
    print("="*80)
    print(f"TOTAL: {passed}/{total} tests passed ({passed*100//total}%)")
    print("="*80)
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
