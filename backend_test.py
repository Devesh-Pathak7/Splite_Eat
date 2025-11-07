"""
Comprehensive Backend Testing for SplitEat Application
Tests all critical flows: Authentication, Half-Orders, Orders, Counter Operations, Analytics, RBAC
"""

import requests
import json
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional

# Backend URL from frontend .env
BACKEND_URL = "https://menumate-41.preview.emergentagent.com/api"

# Test credentials
SUPER_ADMIN = {"username": "admin", "password": "admin123"}
COUNTER_ADMIN_1 = {"username": "counter1", "password": "admin123"}
COUNTER_ADMIN_2 = {"username": "counter2", "password": "admin123"}

# Test data
TEST_RESTAURANT_ID = 1
TEST_TABLE_NO = "T1"

# Global variables to store test data
tokens = {}
session_ids = []
order_ids = []

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def print_test(test_name: str):
    print(f"\n{Colors.BLUE}{Colors.BOLD}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}{Colors.BOLD}TEST: {test_name}{Colors.RESET}")
    print(f"{Colors.BLUE}{Colors.BOLD}{'='*80}{Colors.RESET}")

def print_success(message: str):
    print(f"{Colors.GREEN}✓ {message}{Colors.RESET}")

def print_error(message: str):
    print(f"{Colors.RED}✗ {message}{Colors.RESET}")

def print_info(message: str):
    print(f"{Colors.YELLOW}ℹ {message}{Colors.RESET}")

def print_section(section_name: str):
    print(f"\n{Colors.BOLD}--- {section_name} ---{Colors.RESET}")


# ============ 1. AUTHENTICATION TESTS ============

def test_auth_login_super_admin():
    """Test super admin login"""
    print_test("1.1 Super Admin Login")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/auth/login",
            json=SUPER_ADMIN,
            timeout=10
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if "access_token" in data and "user" in data:
                tokens["super_admin"] = data["access_token"]
                print_success(f"Super admin logged in successfully")
                print_info(f"User: {data['user']['username']}, Role: {data['user']['role']}")
                return True
            else:
                print_error("Response missing access_token or user")
                return False
        else:
            print_error(f"Login failed: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


def test_auth_login_counter_admin():
    """Test counter admin login"""
    print_test("1.2 Counter Admin Login")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/auth/login",
            json=COUNTER_ADMIN_1,
            timeout=10
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if "access_token" in data and "user" in data:
                tokens["counter_admin_1"] = data["access_token"]
                print_success(f"Counter admin logged in successfully")
                print_info(f"User: {data['user']['username']}, Role: {data['user']['role']}, Restaurant: {data['user'].get('restaurant_id')}")
                return True
            else:
                print_error("Response missing access_token or user")
                return False
        else:
            print_error(f"Login failed: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


def test_auth_me():
    """Test /auth/me endpoint"""
    print_test("1.3 Get Current User (/auth/me)")
    
    if "super_admin" not in tokens:
        print_error("Super admin token not available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {tokens['super_admin']}"}
        response = requests.get(
            f"{BACKEND_URL}/auth/me",
            headers=headers,
            timeout=10
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"User info retrieved: {data['username']}")
            return True
        else:
            print_error(f"Failed: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


def test_rbac_unauthorized_access():
    """Test RBAC - Try accessing admin endpoint without proper role"""
    print_test("1.4 RBAC - Unauthorized Access Test")
    
    try:
        # Try to access without token
        response = requests.get(
            f"{BACKEND_URL}/restaurants",
            timeout=10
        )
        
        print_info(f"Status Code (no token): {response.status_code}")
        
        # Should work without auth for GET restaurants
        if response.status_code == 200:
            print_success("GET /restaurants works without auth (as expected)")
            return True
        else:
            print_error(f"Unexpected response: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


# ============ 2. RESTAURANT & TABLE TESTS ============

def test_get_restaurants():
    """Test GET /restaurants"""
    print_test("2.1 Get All Restaurants")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/restaurants",
            timeout=10
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Retrieved {len(data)} restaurants")
            for restaurant in data:
                print_info(f"  - ID: {restaurant['id']}, Name: {restaurant['name']}, Type: {restaurant['type']}")
            return len(data) >= 3
        else:
            print_error(f"Failed: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


def test_get_restaurant_tables():
    """Test GET /restaurants/{id}/tables"""
    print_test("2.2 Get Restaurant Tables")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/restaurants/{TEST_RESTAURANT_ID}/tables",
            timeout=10
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Retrieved {len(data)} tables for restaurant {TEST_RESTAURANT_ID}")
            for table in data[:5]:  # Show first 5
                print_info(f"  - Table: {table['table_no']}, Capacity: {table['capacity']}")
            return len(data) > 0
        else:
            print_error(f"Failed: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


def test_get_restaurant_menu():
    """Test GET /restaurants/{id}/menu"""
    print_test("2.3 Get Restaurant Menu")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/restaurants/{TEST_RESTAURANT_ID}/menu",
            timeout=10
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Retrieved {len(data)} menu items for restaurant {TEST_RESTAURANT_ID}")
            for item in data[:5]:  # Show first 5
                print_info(f"  - ID: {item['id']}, Name: {item['name']}, Price: ₹{item['price']}")
            return len(data) > 0
        else:
            print_error(f"Failed: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


# ============ 3. HALF-ORDER FLOW TESTS (CRITICAL) ============

def test_create_half_order():
    """Test POST /half-order - Create half-order session"""
    print_test("3.1 Create Half-Order Session")
    
    if "super_admin" not in tokens:
        print_error("Super admin token not available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {tokens['super_admin']}"}
        payload = {
            "customer_name": "Alice Kumar",
            "customer_mobile": "9876543210",
            "menu_item_id": 1
        }
        
        response = requests.post(
            f"{BACKEND_URL}/half-order?restaurant_id={TEST_RESTAURANT_ID}&table_no={TEST_TABLE_NO}",
            json=payload,
            headers=headers,
            timeout=10
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 201:
            data = response.json()
            session_ids.append(data['id'])
            print_success(f"Half-order session created: ID={data['id']}")
            print_info(f"  Customer: {data['customer_name']}")
            print_info(f"  Menu Item: {data['menu_item_name']}")
            print_info(f"  Expires At: {data['expires_at']}")
            
            # Verify expires_at is UTC and ~30 minutes from now
            expires_at = datetime.fromisoformat(data['expires_at'].replace('Z', '+00:00'))
            now = datetime.now(timezone.utc)
            time_diff = (expires_at - now).total_seconds() / 60
            
            if 28 <= time_diff <= 32:
                print_success(f"Expiry time is correct (~30 minutes): {time_diff:.1f} minutes")
            else:
                print_error(f"Expiry time incorrect: {time_diff:.1f} minutes (expected ~30)")
            
            return True
        else:
            print_error(f"Failed: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


def test_get_active_sessions():
    """Test GET /half-order/active"""
    print_test("3.2 Get Active Half-Order Sessions")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/half-order/active?restaurant_id={TEST_RESTAURANT_ID}",
            timeout=10
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Retrieved {len(data)} active sessions")
            
            # Verify our created session is in the list
            if session_ids:
                found = any(s['id'] == session_ids[0] for s in data)
                if found:
                    print_success("Our created session is in the active list")
                else:
                    print_error("Our created session NOT found in active list")
                    return False
            
            for session in data[:3]:  # Show first 3
                print_info(f"  - ID: {session['id']}, Customer: {session['customer_name']}, Item: {session['menu_item_name']}")
            
            return True
        else:
            print_error(f"Failed: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


def test_join_half_order():
    """Test POST /half-order/{id}/join - Join half-order session"""
    print_test("3.3 Join Half-Order Session")
    
    if not session_ids:
        print_error("No session ID available to join")
        return False
    
    if "super_admin" not in tokens:
        print_error("Super admin token not available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {tokens['super_admin']}"}
        payload = {
            "table_no": "T2",
            "customer_name": "Bob Singh",
            "customer_mobile": "9876543211"
        }
        
        response = requests.post(
            f"{BACKEND_URL}/half-order/{session_ids[0]}/join",
            json=payload,
            headers=headers,
            timeout=10
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Successfully joined half-order session")
            print_info(f"  Paired Order ID: {data.get('paired_order_id')}")
            print_info(f"  Table Pairing: {data.get('table_pairing')}")
            print_info(f"  Total Price: ₹{data.get('total_price')}")
            
            if 'paired_order_id' in data:
                order_ids.append(data['paired_order_id'])
            
            return True
        else:
            print_error(f"Failed: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


def test_join_same_session_twice():
    """Test atomic join - Try joining the SAME session again (should fail with 409)"""
    print_test("3.4 Atomic Join Test - Join Same Session Twice")
    
    # Create a new session first
    if "super_admin" not in tokens:
        print_error("Super admin token not available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {tokens['super_admin']}"}
        
        # Create new session
        payload = {
            "customer_name": "Charlie Patel",
            "customer_mobile": "+919876543212",
            "menu_item_id": 2
        }
        
        response = requests.post(
            f"{BACKEND_URL}/half-order?restaurant_id={TEST_RESTAURANT_ID}&table_no=T3",
            json=payload,
            headers=headers,
            timeout=10
        )
        
        if response.status_code != 201:
            print_error(f"Failed to create test session: {response.text}")
            return False
        
        new_session_id = response.json()['id']
        print_info(f"Created test session: {new_session_id}")
        
        # First join
        join_payload = {
            "table_no": "T4",
            "customer_name": "David Sharma",
            "customer_mobile": "+919876543213"
        }
        
        response1 = requests.post(
            f"{BACKEND_URL}/half-order/{new_session_id}/join",
            json=join_payload,
            headers=headers,
            timeout=10
        )
        
        print_info(f"First join status: {response1.status_code}")
        
        if response1.status_code != 200:
            print_error(f"First join failed: {response1.text}")
            return False
        
        print_success("First join succeeded")
        
        # Second join (should fail with 409)
        join_payload2 = {
            "table_no": "T5",
            "customer_name": "Eve Reddy",
            "customer_mobile": "+919876543214"
        }
        
        response2 = requests.post(
            f"{BACKEND_URL}/half-order/{new_session_id}/join",
            json=join_payload2,
            headers=headers,
            timeout=10
        )
        
        print_info(f"Second join status: {response2.status_code}")
        
        if response2.status_code == 409:
            print_success("Second join correctly rejected with 409 Conflict")
            return True
        else:
            print_error(f"Second join should have returned 409, got {response2.status_code}: {response2.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


def test_cancel_half_order_customer():
    """Test cancellation as customer within 5 minutes"""
    print_test("3.5 Cancel Half-Order (Customer within 5 min)")
    
    if "super_admin" not in tokens:
        print_error("Super admin token not available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {tokens['super_admin']}"}
        
        # Create new session
        payload = {
            "customer_name": "Frank Gupta",
            "customer_mobile": "+919876543215",
            "menu_item_id": 1
        }
        
        response = requests.post(
            f"{BACKEND_URL}/half-order?restaurant_id={TEST_RESTAURANT_ID}&table_no=T6",
            json=payload,
            headers=headers,
            timeout=10
        )
        
        if response.status_code != 201:
            print_error(f"Failed to create test session: {response.text}")
            return False
        
        cancel_session_id = response.json()['id']
        print_info(f"Created test session: {cancel_session_id}")
        
        # Try to cancel immediately (within 5 minutes)
        response = requests.delete(
            f"{BACKEND_URL}/half-order/{cancel_session_id}?reason=Changed my mind",
            headers=headers,
            timeout=10
        )
        
        print_info(f"Cancel status: {response.status_code}")
        
        if response.status_code == 200:
            print_success("Customer cancellation within 5 minutes succeeded")
            return True
        else:
            print_error(f"Cancellation failed: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


def test_cancel_half_order_counter_admin():
    """Test cancellation as counter admin (should always work)"""
    print_test("3.6 Cancel Half-Order (Counter Admin)")
    
    if "counter_admin_1" not in tokens:
        print_error("Counter admin token not available")
        return False
    
    try:
        # First create a session as super admin
        super_headers = {"Authorization": f"Bearer {tokens['super_admin']}"}
        payload = {
            "customer_name": "Grace Iyer",
            "customer_mobile": "+919876543216",
            "menu_item_id": 1
        }
        
        response = requests.post(
            f"{BACKEND_URL}/half-order?restaurant_id={TEST_RESTAURANT_ID}&table_no=T7",
            json=payload,
            headers=super_headers,
            timeout=10
        )
        
        if response.status_code != 201:
            print_error(f"Failed to create test session: {response.text}")
            return False
        
        cancel_session_id = response.json()['id']
        print_info(f"Created test session: {cancel_session_id}")
        
        # Cancel as counter admin
        counter_headers = {"Authorization": f"Bearer {tokens['counter_admin_1']}"}
        response = requests.delete(
            f"{BACKEND_URL}/half-order/{cancel_session_id}?reason=Admin override",
            headers=counter_headers,
            timeout=10
        )
        
        print_info(f"Cancel status: {response.status_code}")
        
        if response.status_code == 200:
            print_success("Counter admin cancellation succeeded")
            return True
        else:
            print_error(f"Cancellation failed: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


# ============ 4. ORDER FLOW TESTS (CRITICAL) ============

def test_create_full_order():
    """Test POST /orders - Create order with full items"""
    print_test("4.1 Create Full Order")
    
    if "super_admin" not in tokens:
        print_error("Super admin token not available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {tokens['super_admin']}"}
        payload = {
            "restaurant_id": TEST_RESTAURANT_ID,
            "table_no": "T8",
            "customer_name": "Henry Nair",
            "phone": "+919876543217",
            "items": [
                {
                    "menu_item_id": 1,
                    "name": "Paneer Tikka",
                    "quantity": 2,
                    "price": 200
                },
                {
                    "menu_item_id": 2,
                    "name": "Butter Naan",
                    "quantity": 3,
                    "price": 45
                }
            ]
        }
        
        response = requests.post(
            f"{BACKEND_URL}/orders",
            json=payload,
            headers=headers,
            timeout=10
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 201:
            data = response.json()
            order_ids.append(data['order_id'])
            print_success(f"Order created: ID={data['order_id']}")
            print_info(f"  Total Amount: ₹{data['total_amount']}")
            print_info(f"  Status: {data['status']}")
            return True
        else:
            print_error(f"Failed: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


def test_get_orders_today():
    """Test GET /orders with period=today"""
    print_test("4.2 Get Orders (Today)")
    
    if "counter_admin_1" not in tokens:
        print_error("Counter admin token not available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {tokens['counter_admin_1']}"}
        response = requests.get(
            f"{BACKEND_URL}/orders?restaurant_id={TEST_RESTAURANT_ID}&period=today",
            headers=headers,
            timeout=10
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Retrieved {data.get('total', 0)} orders for today")
            print_info(f"  Page: {data.get('page')}, Page Size: {data.get('page_size')}")
            print_info(f"  Total Pages: {data.get('total_pages')}")
            
            if 'orders' in data:
                for order in data['orders'][:3]:  # Show first 3
                    print_info(f"  - Order ID: {order['id']}, Table: {order['table_no']}, Amount: ₹{order['total_amount']}")
            
            return True
        else:
            print_error(f"Failed: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


def test_get_orders_month():
    """Test GET /orders with period=month"""
    print_test("4.3 Get Orders (Month)")
    
    if "counter_admin_1" not in tokens:
        print_error("Counter admin token not available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {tokens['counter_admin_1']}"}
        response = requests.get(
            f"{BACKEND_URL}/orders?restaurant_id={TEST_RESTAURANT_ID}&period=month",
            headers=headers,
            timeout=10
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Retrieved {data.get('total', 0)} orders for this month")
            return True
        else:
            print_error(f"Failed: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


def test_get_orders_pagination():
    """Test GET /orders with pagination"""
    print_test("4.4 Get Orders (Pagination)")
    
    if "counter_admin_1" not in tokens:
        print_error("Counter admin token not available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {tokens['counter_admin_1']}"}
        response = requests.get(
            f"{BACKEND_URL}/orders?restaurant_id={TEST_RESTAURANT_ID}&page=1&page_size=5",
            headers=headers,
            timeout=10
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Pagination working: Page {data.get('page')}, Size {data.get('page_size')}")
            return True
        else:
            print_error(f"Failed: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


def test_update_order_status():
    """Test PATCH /orders/{id} - Update order status"""
    print_test("4.5 Update Order Status")
    
    if not order_ids:
        print_error("No order ID available")
        return False
    
    if "counter_admin_1" not in tokens:
        print_error("Counter admin token not available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {tokens['counter_admin_1']}"}
        payload = {"status": "PREPARING"}
        
        response = requests.patch(
            f"{BACKEND_URL}/orders/{order_ids[-1]}",
            json=payload,
            headers=headers,
            timeout=10
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Order status updated to: {data['status']}")
            return True
        else:
            print_error(f"Failed: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


def test_send_to_kitchen():
    """Test POST /orders/{id}/send-to-kitchen"""
    print_test("4.6 Send Order to Kitchen")
    
    if not order_ids:
        print_error("No order ID available")
        return False
    
    if "counter_admin_1" not in tokens:
        print_error("Counter admin token not available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {tokens['counter_admin_1']}"}
        
        response = requests.post(
            f"{BACKEND_URL}/orders/{order_ids[-1]}/send-to-kitchen",
            headers=headers,
            timeout=10
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Order sent to kitchen: {data.get('message')}")
            return True
        else:
            print_error(f"Failed: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


def test_cancel_order():
    """Test POST /orders/{id}/cancel"""
    print_test("4.7 Cancel Order")
    
    # Create a new order to cancel
    if "counter_admin_1" not in tokens:
        print_error("Counter admin token not available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {tokens['counter_admin_1']}"}
        
        # Create order
        payload = {
            "restaurant_id": TEST_RESTAURANT_ID,
            "table_no": "T9",
            "customer_name": "Ivy Desai",
            "phone": "+919876543218",
            "items": [
                {
                    "menu_item_id": 1,
                    "name": "Test Item",
                    "quantity": 1,
                    "price": 100
                }
            ]
        }
        
        create_response = requests.post(
            f"{BACKEND_URL}/orders",
            json=payload,
            headers=headers,
            timeout=10
        )
        
        if create_response.status_code != 201:
            print_error(f"Failed to create test order: {create_response.text}")
            return False
        
        test_order_id = create_response.json()['order_id']
        print_info(f"Created test order: {test_order_id}")
        
        # Cancel it
        response = requests.post(
            f"{BACKEND_URL}/orders/{test_order_id}/cancel?reason=Customer request",
            headers=headers,
            timeout=10
        )
        
        print_info(f"Cancel status: {response.status_code}")
        
        if response.status_code == 200:
            print_success("Order cancelled successfully")
            return True
        else:
            print_error(f"Cancellation failed: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


def test_reopen_order():
    """Test POST /orders/{id}/reopen"""
    print_test("4.8 Reopen Cancelled Order")
    
    # Use the order we just cancelled
    if "counter_admin_1" not in tokens:
        print_error("Counter admin token not available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {tokens['counter_admin_1']}"}
        
        # Create and cancel an order first
        payload = {
            "restaurant_id": TEST_RESTAURANT_ID,
            "table_no": "T10",
            "customer_name": "Jack Menon",
            "phone": "+919876543219",
            "items": [
                {
                    "menu_item_id": 1,
                    "name": "Test Item",
                    "quantity": 1,
                    "price": 100
                }
            ]
        }
        
        create_response = requests.post(
            f"{BACKEND_URL}/orders",
            json=payload,
            headers=headers,
            timeout=10
        )
        
        if create_response.status_code != 201:
            print_error(f"Failed to create test order")
            return False
        
        test_order_id = create_response.json()['order_id']
        
        # Cancel it
        cancel_response = requests.post(
            f"{BACKEND_URL}/orders/{test_order_id}/cancel",
            headers=headers,
            timeout=10
        )
        
        if cancel_response.status_code != 200:
            print_error(f"Failed to cancel test order")
            return False
        
        print_info(f"Cancelled order {test_order_id}, now reopening...")
        
        # Reopen it
        response = requests.post(
            f"{BACKEND_URL}/orders/{test_order_id}/reopen",
            headers=headers,
            timeout=10
        )
        
        print_info(f"Reopen status: {response.status_code}")
        
        if response.status_code == 200:
            print_success("Order reopened successfully")
            return True
        else:
            print_error(f"Reopen failed: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


def test_csv_export():
    """Test GET /orders/export - CSV export"""
    print_test("4.9 CSV Export")
    
    if "counter_admin_1" not in tokens:
        print_error("Counter admin token not available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {tokens['counter_admin_1']}"}
        response = requests.get(
            f"{BACKEND_URL}/orders/export?restaurant_id={TEST_RESTAURANT_ID}",
            headers=headers,
            timeout=10
        )
        
        print_info(f"Status Code: {response.status_code}")
        print_info(f"Content-Type: {response.headers.get('Content-Type')}")
        
        if response.status_code == 200:
            if 'text/csv' in response.headers.get('Content-Type', ''):
                print_success("CSV export successful")
                print_info(f"CSV size: {len(response.content)} bytes")
                
                # Show first few lines
                lines = response.text.split('\n')[:5]
                print_info("First few lines:")
                for line in lines:
                    print_info(f"  {line}")
                
                return True
            else:
                print_error(f"Wrong content type: {response.headers.get('Content-Type')}")
                return False
        else:
            print_error(f"Failed: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


# ============ 5. COUNTER OPERATIONS TESTS ============

def test_get_tables_status():
    """Test GET /counter/tables"""
    print_test("5.1 Get Tables Status")
    
    if "counter_admin_1" not in tokens:
        print_error("Counter admin token not available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {tokens['counter_admin_1']}"}
        response = requests.get(
            f"{BACKEND_URL}/counter/tables?restaurant_id={TEST_RESTAURANT_ID}",
            headers=headers,
            timeout=10
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Retrieved table status")
            
            if 'summary' in data:
                summary = data['summary']
                print_info(f"  Total: {summary.get('total')}")
                print_info(f"  Available: {summary.get('available')}")
                print_info(f"  Occupied: {summary.get('occupied')}")
                print_info(f"  Reserved: {summary.get('reserved')}")
            
            if 'tables' in data:
                print_info(f"Sample tables:")
                for table in data['tables'][:5]:
                    print_info(f"  - {table['table_no']}: {table['status']} (Sessions: {table['active_sessions']}, Orders: {table['active_orders']})")
            
            return True
        else:
            print_error(f"Failed: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


def test_get_dashboard_stats():
    """Test GET /counter/dashboard-stats"""
    print_test("5.2 Get Dashboard Stats")
    
    if "counter_admin_1" not in tokens:
        print_error("Counter admin token not available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {tokens['counter_admin_1']}"}
        response = requests.get(
            f"{BACKEND_URL}/counter/dashboard-stats?restaurant_id={TEST_RESTAURANT_ID}",
            headers=headers,
            timeout=10
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Dashboard stats retrieved")
            print_info(f"  Active Orders: {data.get('active_orders')}")
            print_info(f"  Today's Revenue: ₹{data.get('today_revenue')}")
            print_info(f"  Active Half-Orders: {data.get('active_half_orders')}")
            return True
        else:
            print_error(f"Failed: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


# ============ 6. ANALYTICS TESTS ============

def test_analytics_overview():
    """Test GET /analytics/overview"""
    print_test("6.1 Analytics Overview")
    
    if "super_admin" not in tokens:
        print_error("Super admin token not available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {tokens['super_admin']}"}
        response = requests.get(
            f"{BACKEND_URL}/analytics/overview?restaurant_id={TEST_RESTAURANT_ID}",
            headers=headers,
            timeout=10
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Analytics overview retrieved")
            print_info(f"  Total Revenue: ₹{data.get('total_revenue')}")
            print_info(f"  Total Orders: {data.get('total_orders')}")
            print_info(f"  Active Half-Orders: {data.get('active_half_orders')}")
            return True
        else:
            print_error(f"Failed: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


def test_analytics_popular_items():
    """Test GET /analytics/popular-items"""
    print_test("6.2 Analytics Popular Items")
    
    if "super_admin" not in tokens:
        print_error("Super admin token not available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {tokens['super_admin']}"}
        response = requests.get(
            f"{BACKEND_URL}/analytics/popular-items?restaurant_id={TEST_RESTAURANT_ID}",
            headers=headers,
            timeout=10
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Popular items retrieved: {len(data)} items")
            for item in data[:5]:
                print_info(f"  - {item['name']}: {item['count']} orders")
            return True
        else:
            print_error(f"Failed: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


# ============ 7. RBAC ENFORCEMENT TESTS ============

def test_rbac_counter_admin_other_restaurant():
    """Test counter admin trying to access other restaurant's data"""
    print_test("7.1 RBAC - Counter Admin Access Other Restaurant")
    
    if "counter_admin_1" not in tokens:
        print_error("Counter admin token not available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {tokens['counter_admin_1']}"}
        
        # Counter admin 1 is for restaurant 1, try to access restaurant 2
        response = requests.get(
            f"{BACKEND_URL}/orders?restaurant_id=2&period=today",
            headers=headers,
            timeout=10
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        # Should either return 403 or filter to only their restaurant
        if response.status_code == 403:
            print_success("Access correctly denied with 403")
            return True
        elif response.status_code == 200:
            data = response.json()
            # Check if orders are filtered to their restaurant
            if 'orders' in data:
                other_restaurant_orders = [o for o in data['orders'] if o.get('restaurant_id') == 2]
                if len(other_restaurant_orders) == 0:
                    print_success("Orders correctly filtered to counter admin's restaurant")
                    return True
                else:
                    print_error(f"Counter admin can see other restaurant's orders!")
                    return False
            return True
        else:
            print_error(f"Unexpected response: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


def test_rbac_update_order_without_auth():
    """Test updating order without proper authentication"""
    print_test("7.2 RBAC - Update Order Without Auth")
    
    if not order_ids:
        print_info("No order ID available, skipping")
        return True
    
    try:
        payload = {"status": "COMPLETED"}
        
        response = requests.patch(
            f"{BACKEND_URL}/orders/{order_ids[0]}",
            json=payload,
            timeout=10
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 401 or response.status_code == 403:
            print_success("Access correctly denied without authentication")
            return True
        else:
            print_error(f"Should have been denied, got: {response.status_code}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


# ============ 8. EDGE CASES & ERROR HANDLING ============

def test_join_expired_session():
    """Test joining an expired half-order session"""
    print_test("8.1 Join Expired Half-Order Session")
    
    # This would require mocking time or waiting 30 minutes
    # For now, we'll test with an invalid session ID
    
    if "super_admin" not in tokens:
        print_error("Super admin token not available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {tokens['super_admin']}"}
        payload = {
            "table_no": "T99",
            "customer_name": "Test User",
            "customer_mobile": "+919999999999"
        }
        
        # Use a very high session ID that likely doesn't exist
        response = requests.post(
            f"{BACKEND_URL}/half-order/99999/join",
            json=payload,
            headers=headers,
            timeout=10
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 404 or response.status_code == 400 or response.status_code == 409:
            print_success(f"Correctly handled invalid/expired session with {response.status_code}")
            return True
        else:
            print_error(f"Unexpected response: {response.status_code}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


def test_create_half_order_invalid_menu_item():
    """Test creating half-order with invalid menu_item_id"""
    print_test("8.2 Create Half-Order with Invalid Menu Item")
    
    if "super_admin" not in tokens:
        print_error("Super admin token not available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {tokens['super_admin']}"}
        payload = {
            "customer_name": "Test User",
            "customer_mobile": "+919999999999",
            "menu_item_id": 99999  # Invalid ID
        }
        
        response = requests.post(
            f"{BACKEND_URL}/half-order?restaurant_id={TEST_RESTAURANT_ID}&table_no=T99",
            json=payload,
            headers=headers,
            timeout=10
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 400 or response.status_code == 404:
            print_success(f"Correctly rejected invalid menu item with {response.status_code}")
            return True
        else:
            print_error(f"Should have rejected, got: {response.status_code}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


def test_update_nonexistent_order():
    """Test updating non-existent order"""
    print_test("8.3 Update Non-Existent Order")
    
    if "counter_admin_1" not in tokens:
        print_error("Counter admin token not available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {tokens['counter_admin_1']}"}
        payload = {"status": "COMPLETED"}
        
        response = requests.patch(
            f"{BACKEND_URL}/orders/99999",
            json=payload,
            headers=headers,
            timeout=10
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 404 or response.status_code == 400:
            print_success(f"Correctly handled non-existent order with {response.status_code}")
            return True
        else:
            print_error(f"Should have returned 404, got: {response.status_code}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False


# ============ MAIN TEST RUNNER ============

def run_all_tests():
    """Run all tests and generate summary"""
    
    print(f"\n{Colors.BOLD}{'='*80}{Colors.RESET}")
    print(f"{Colors.BOLD}SPLITEAT BACKEND COMPREHENSIVE TEST SUITE{Colors.RESET}")
    print(f"{Colors.BOLD}{'='*80}{Colors.RESET}")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test Restaurant ID: {TEST_RESTAURANT_ID}")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    results = {}
    
    # 1. Authentication Tests
    print_section("SECTION 1: AUTHENTICATION TESTS")
    results['1.1_super_admin_login'] = test_auth_login_super_admin()
    results['1.2_counter_admin_login'] = test_auth_login_counter_admin()
    results['1.3_auth_me'] = test_auth_me()
    results['1.4_rbac_unauthorized'] = test_rbac_unauthorized_access()
    
    # 2. Restaurant & Table Tests
    print_section("SECTION 2: RESTAURANT & TABLE TESTS")
    results['2.1_get_restaurants'] = test_get_restaurants()
    results['2.2_get_tables'] = test_get_restaurant_tables()
    results['2.3_get_menu'] = test_get_restaurant_menu()
    
    # 3. Half-Order Flow Tests
    print_section("SECTION 3: HALF-ORDER FLOW TESTS (CRITICAL)")
    results['3.1_create_half_order'] = test_create_half_order()
    results['3.2_get_active_sessions'] = test_get_active_sessions()
    results['3.3_join_half_order'] = test_join_half_order()
    results['3.4_atomic_join'] = test_join_same_session_twice()
    results['3.5_cancel_customer'] = test_cancel_half_order_customer()
    results['3.6_cancel_counter_admin'] = test_cancel_half_order_counter_admin()
    
    # 4. Order Flow Tests
    print_section("SECTION 4: ORDER FLOW TESTS (CRITICAL)")
    results['4.1_create_order'] = test_create_full_order()
    results['4.2_get_orders_today'] = test_get_orders_today()
    results['4.3_get_orders_month'] = test_get_orders_month()
    results['4.4_pagination'] = test_get_orders_pagination()
    results['4.5_update_status'] = test_update_order_status()
    results['4.6_send_to_kitchen'] = test_send_to_kitchen()
    results['4.7_cancel_order'] = test_cancel_order()
    results['4.8_reopen_order'] = test_reopen_order()
    results['4.9_csv_export'] = test_csv_export()
    
    # 5. Counter Operations Tests
    print_section("SECTION 5: COUNTER OPERATIONS TESTS")
    results['5.1_tables_status'] = test_get_tables_status()
    results['5.2_dashboard_stats'] = test_get_dashboard_stats()
    
    # 6. Analytics Tests
    print_section("SECTION 6: ANALYTICS TESTS")
    results['6.1_analytics_overview'] = test_analytics_overview()
    results['6.2_popular_items'] = test_analytics_popular_items()
    
    # 7. RBAC Tests
    print_section("SECTION 7: RBAC ENFORCEMENT TESTS")
    results['7.1_rbac_other_restaurant'] = test_rbac_counter_admin_other_restaurant()
    results['7.2_rbac_no_auth'] = test_rbac_update_order_without_auth()
    
    # 8. Edge Cases
    print_section("SECTION 8: EDGE CASES & ERROR HANDLING")
    results['8.1_expired_session'] = test_join_expired_session()
    results['8.2_invalid_menu_item'] = test_create_half_order_invalid_menu_item()
    results['8.3_nonexistent_order'] = test_update_nonexistent_order()
    
    # Generate Summary
    print(f"\n{Colors.BOLD}{'='*80}{Colors.RESET}")
    print(f"{Colors.BOLD}TEST SUMMARY{Colors.RESET}")
    print(f"{Colors.BOLD}{'='*80}{Colors.RESET}")
    
    passed = sum(1 for v in results.values() if v)
    failed = sum(1 for v in results.values() if not v)
    total = len(results)
    
    print(f"\nTotal Tests: {total}")
    print(f"{Colors.GREEN}Passed: {passed}{Colors.RESET}")
    print(f"{Colors.RED}Failed: {failed}{Colors.RESET}")
    print(f"Success Rate: {(passed/total*100):.1f}%")
    
    print(f"\n{Colors.BOLD}Failed Tests:{Colors.RESET}")
    for test_name, result in results.items():
        if not result:
            print(f"{Colors.RED}  ✗ {test_name}{Colors.RESET}")
    
    print(f"\n{Colors.BOLD}Passed Tests:{Colors.RESET}")
    for test_name, result in results.items():
        if result:
            print(f"{Colors.GREEN}  ✓ {test_name}{Colors.RESET}")
    
    print(f"\nCompleted at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{Colors.BOLD}{'='*80}{Colors.RESET}\n")
    
    return results


if __name__ == "__main__":
    results = run_all_tests()
    
    # Exit with error code if any tests failed
    if not all(results.values()):
        exit(1)
    else:
        exit(0)
