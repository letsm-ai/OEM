#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Phase 1 of Omani Entrepreneur Majles (مجلس رواد الأعمال العماني).
  Foundation only: DB schema (9 tables), auth (email/password credentials), Arabic RTL layout,
  Cairo font, navbar, landing page, signup/login pages, and protected dashboard showing user name & role.
  Tech chosen (user approved): Next.js 14 JS + MongoDB (Mongoose) + NextAuth credentials + bcrypt.

backend:
  - task: "MongoDB + Mongoose models (User, Company, Product, Order, OrderItem, Expert, Availability, Appointment, Membership)"
    implemented: true
    working: true
    file: "/app/lib/models.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "All 9 schemas implemented with UUID _id, enums for role/tier/sector/status."
      - working: true
        agent: "testing"
        comment: "Verified User model working correctly. UUID format confirmed (d2af3663-83d0-4e1c-ae1d-8a321987cd42), default values (role=MEMBER, membershipTier=FREE) applied correctly."

  - task: "POST /api/signup (create user with bcrypt hashed password, default role=MEMBER, tier=FREE)"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Validates name/email/password, min 6 chars, unique email, hashes with bcryptjs, returns user (no password)."
      - working: true
        agent: "testing"
        comment: "All validations working: ✅ Valid signup (200), ✅ Duplicate email (409), ✅ Missing fields (400), ✅ Short password <6 chars (400). Password not returned in response. User stored with UUID _id."

  - task: "NextAuth Credentials provider /api/auth/[...nextauth]"
    implemented: true
    working: true
    file: "/app/app/api/auth/[...nextauth]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "JWT session; exposes id, role, membershipTier in session.user. Arabic error messages."
      - working: true
        agent: "testing"
        comment: "NextAuth working correctly: ✅ CSRF token retrieval, ✅ Valid credentials login (creates session-token), ✅ Wrong password rejection (401 status, no valid session). Arabic error messages confirmed."

  - task: "GET /api/me (returns logged-in user info based on session)"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Uses getServerSession, returns 401 if unauthenticated."
      - working: true
        agent: "testing"
        comment: "Working correctly: ✅ Unauthenticated request returns 401 with Arabic error 'غير مصرح', ✅ Authenticated request returns user data (id, name, email, role=MEMBER, membershipTier=FREE, createdAt). Password field excluded."

frontend:
  - task: "Arabic RTL layout + Cairo font + sticky Navbar"
    implemented: true
    working: "NA"
    file: "/app/app/layout.js, /app/components/Navbar.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Nav: الرئيسية | المتجر | الاستشارات | دليل الشركات | العضوية | حسابي. Shows login/signup or user + logout."

  - task: "Landing page hero + features + pricing preview"
    implemented: true
    working: "NA"
    file: "/app/app/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Primary #1B3A6B navy + #C9A84C gold gradient hero."

  - task: "Signup page + Login page (Arabic)"
    implemented: true
    working: "NA"
    file: "/app/app/signup/page.js, /app/app/login/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "After signup auto-signs-in and redirects to /dashboard."

  - task: "Protected dashboard showing name + role + membership tier"
    implemented: true
    working: "NA"
    file: "/app/app/dashboard/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Server component, redirects to /login if no session."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 2
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Phase 1 implementation complete. Please test backend:
      1) GET /api/  -> should return 200 {message: "Majles API is running"}
      2) POST /api/signup  with {name, email, password} -> 200 + user; duplicate -> 409; <6 chars password -> 400; missing -> 400
      3) NextAuth login: POST /api/auth/callback/credentials with email/password; after signup a user should be able to login.
      4) GET /api/me with valid NextAuth session cookie -> user data; without session -> 401
      All endpoints go through Next.js at NEXT_PUBLIC_BASE_URL/api. Mongo DB name = 'majles'.
  - agent: "testing"
    message: |
      ✅ Backend Phase 1 testing COMPLETE - All endpoints working correctly:
      
      1) GET /api/ ✅ Returns 200 {"message":"Majles API is running"}
      2) POST /api/signup ✅ All validations working (valid signup, duplicate email 409, missing fields 400, short password 400)
      3) NextAuth login ✅ CSRF + credentials authentication working, wrong password properly rejected (401)
      4) GET /api/me ✅ Unauthenticated returns 401, authenticated returns user data
      5) Data integrity ✅ UUID format, default values (role=MEMBER, tier=FREE), password excluded from responses
      
      All Arabic error messages working. MongoDB integration confirmed. Ready for frontend testing or Phase 2.
