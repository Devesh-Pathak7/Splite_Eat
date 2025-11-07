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
  Complete SplitEat restaurant order management system with half-order sharing feature.
  Key requirements:
  - Half-order flow with UTC timezone-aware expiry (30 min default)
  - Atomic join with row-locking (return 409 if already joined)
  - Cancellation rules: Customer within 5 min, Counter admin anytime
  - Orders supporting both half-order and full-order items
  - Counter dashboard with real-time table status (Available/Occupied/Reserved)
  - WebSocket events for all state changes (session.created, session.joined, etc.)
  - RBAC enforcement (super_admin, restaurant_admin, customer)
  - Audit logging for all privileged actions with IST display
  - IST timezone display throughout frontend

backend:
  - task: "Integrate half_order_router into server.py"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Router integrated into server.py. WebSocket manager from service layer is now being used."

  - task: "Integrate orders_router into server.py"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Router integrated into server.py. All order endpoints are now available."

  - task: "Integrate counter_router into server.py"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Router integrated into server.py. Counter endpoints are now available."

  - task: "Half-order creation endpoint (POST /api/half-order)"
    implemented: true
    working: true
    file: "/app/backend/routers/half_order_router.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Endpoint created with UTC timezone-aware expiry. Needs testing after integration."
      - working: true
        agent: "testing"
        comment: "✓ TESTED: Half-order session creation works. Session ID=1 created with 30-minute expiry. Endpoint returns 201 with correct response structure."

  - task: "Half-order join endpoint with row-locking (POST /api/half-order/{id}/join)"
    implemented: true
    working: false
    file: "/app/backend/routers/half_order_router.py"
    stuck_count: 1
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Atomic join with row-locking implemented. Returns 409 on conflict. Needs testing."
      - working: false
        agent: "testing"
        comment: "✗ CRITICAL BUG: Timezone comparison error in /app/backend/services/half_order_service.py line 123. Error: 'can't compare offset-naive and offset-aware datetimes'. MySQL DATETIME columns don't store timezone info, so retrieved datetime is timezone-naive but code compares with timezone-aware utc_now(). FIX: Add .replace(tzinfo=timezone.utc) to session.expires_at before comparison."

  - task: "Half-order cancellation with rules (DELETE /api/half-order/{id})"
    implemented: true
    working: "NA"
    file: "/app/backend/routers/half_order_router.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Cancellation rules implemented (customer 5 min, counter admin anytime). Needs testing."

  - task: "Get active half-orders (GET /api/half-order/active)"
    implemented: true
    working: true
    file: "/app/backend/routers/half_order_router.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Returns all active sessions restaurant-wide. Needs testing."
      - working: true
        agent: "testing"
        comment: "✓ TESTED: GET /api/half-order/active works correctly. Returns 200 with list of active sessions. Created session was found in the list."

  - task: "Order creation with paired orders (POST /api/orders)"
    implemented: true
    working: false
    file: "/app/backend/routers/orders_router.py"
    stuck_count: 1
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Supports both half-order and full-order items. Needs testing."
      - working: false
        agent: "testing"
        comment: "✗ CRITICAL BUG: TypeError in /app/backend/services/order_service.py line 43. Error: 'OrderItem' object is not subscriptable. The items parameter is a list of Pydantic OrderItem objects, not dicts. FIX: Change item['price'] to item.price and item.get('quantity', 1) to item.quantity throughout the function."

  - task: "Order filtering (GET /api/orders)"
    implemented: true
    working: false
    file: "/app/backend/routers/orders_router.py"
    stuck_count: 1
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Filters: today/last_7/month/custom with pagination. Needs testing."
      - working: false
        agent: "testing"
        comment: "✗ CRITICAL BUG: Serialization error when returning orders. Error: 'Unable to serialize unknown type: <class 'models.Order'>'. The endpoint returns Order model objects directly but they need to be converted to dict or use response_model properly. FIX: Ensure Order objects are properly serialized using Pydantic schemas."

  - task: "CSV export (GET /api/orders/export)"
    implemented: true
    working: "NA"
    file: "/app/backend/routers/orders_router.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "CSV export with filters. Needs testing."

  - task: "Order status update (PATCH /api/orders/{id})"
    implemented: true
    working: "NA"
    file: "/app/backend/routers/orders_router.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Update order status with audit logging. Needs testing."

  - task: "Counter tables status (GET /api/counter/tables)"
    implemented: true
    working: true
    file: "/app/backend/routers/counter_router.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Returns table status with auto-update. Needs testing."
      - working: true
        agent: "testing"
        comment: "✓ TESTED: GET /api/counter/tables works correctly. Returns 200 with table status summary (5 total, 4 available) and detailed table information."

  - task: "WebSocket event broadcasting"
    implemented: true
    working: "NA"
    file: "/app/backend/services/websocket_service.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "WebSocket service created. Needs integration testing for all events."

  - task: "RBAC enforcement on endpoints"
    implemented: true
    working: "NA"
    file: "/app/backend/routers/*.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Role-based access control using require_role decorator. Needs testing."

  - task: "Audit logging for all actions"
    implemented: true
    working: "NA"
    file: "/app/backend/services/audit_service.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Audit service logs all privileged actions. Needs testing."

frontend:
  - task: "MenuPage - Live half-order sessions"
    implemented: false
    working: "NA"
    file: "/app/frontend/src/pages/MenuPage.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Not yet implemented. Pending backend completion."

  - task: "CounterDashboard - Real-time table grid"
    implemented: false
    working: "NA"
    file: "/app/frontend/src/pages/CounterDashboard.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Not yet implemented. Pending backend completion."

  - task: "Theme toggle (light/dark mode)"
    implemented: false
    working: "NA"
    file: "/app/frontend/src/context/ThemeContext.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Not yet implemented. Pending backend completion."

  - task: "IST timezone display"
    implemented: false
    working: "NA"
    file: "/app/frontend/src/utils/helpers.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Not yet implemented. Pending backend completion."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 0
  run_ui: false

test_plan:
  current_focus:
    - "Integrate half_order_router into server.py"
    - "Integrate orders_router into server.py"
    - "Integrate counter_router into server.py"
    - "Test all half-order endpoints"
    - "Test order creation and filtering"
    - "Test counter table status"
    - "Verify WebSocket events"
    - "Verify RBAC enforcement"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      PHASE 1 Backend Integration Complete!
      ✅ All three routers integrated into server.py
      ✅ WebSocket manager migrated to service layer (ws_manager)
      ✅ All broadcast calls updated to new signature
      ✅ MySQL/MariaDB installed and configured
      ✅ Database initialized with all tables
      ✅ Sample data seeded (3 restaurants, 12 tables, 11 menu items)
      ✅ Backend server running successfully
      
      Next: Testing agent should test all endpoints comprehensively:
      - Authentication (login, register)
      - Half-order flow (create, join, cancel, get active)
      - Order flow (create, filter, CSV export, status update)
      - Counter operations (table status, dashboard stats)
      - WebSocket events
      - RBAC enforcement
      
      Test Credentials:
      - Super Admin: admin / admin123
      - Counter Admins: counter1, counter2, counter3 / admin123
      
      Backend URL: http://localhost:8001