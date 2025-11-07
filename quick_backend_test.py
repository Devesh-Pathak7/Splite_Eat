"""
Quick Backend Validation Test - Critical Paths Only
Tests: Auth, Half-order flow, Orders, Counter operations
"""

import requests
import json
from datetime import datetime

# Backend URL
BACKEND_URL = "https://menumate-41.preview.emergentagent.com/api"

# Test credentials
ADMIN_CREDS = {"username": "admin", "password": "admin123"}
COUNTER_CREDS = {"username": "counter1", "password": "admin123"}

# Test data
RESTAURANT_ID = 1
TEST_MOBILE = "9876543210"

# Store tokens and IDs
tokens = {}
session_id = None
order_id = None

def print_test(name):
    print(f"\n{'='*60}")
    print(f"TEST: {name}")
    print('='*60)

def print_result(passed, message):
    status = "✓ PASS" if passed else "✗ FAIL"
    print(f"{status}: {message}")
    return passed

# ============ 1. AUTH TEST ============

def test_auth_login():
    """Test POST /api/auth/login"""
    print_test("1. Auth Login (admin/admin123)")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/auth/login",
            json=ADMIN_CREDS,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if "access_token" in data and "user" in data:
                tokens["admin"] = data["access_token"]
                return print_result(True, f"Admin logged in: {data['user']['username']}")
            else:
                return print_result(False, "Missing access_token or user in response")
        else:
            return print_result(False, f"Status {response.status_code}: {response.text}")
    except Exception as e:
        return print_result(False, f"Exception: {str(e)}")


def test_counter_login():
    """Test counter admin login"""
    print_test("2. Counter Admin Login (counter1/admin123)")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/auth/login",
            json=COUNTER_CREDS,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if "access_token" in data:
                tokens["counter"] = data["access_token"]
                return print_result(True, f"Counter admin logged in: {data['user']['username']}")
            else:
                return print_result(False, "Missing access_token")
        else:
            return print_result(False, f"Status {response.status_code}: {response.text}")
    except Exception as e:
        return print_result(False, f"Exception: {str(e)}")


# ============ 2. HALF-ORDER TESTS ============

def test_create_half_order():
    """Test POST /api/half-order - Create session"""
    global session_id
    print_test("3. Create Half-Order Session")
    
    if "admin" not in tokens:
        return print_result(False, "Admin token not available")
    
    try:
        headers = {"Authorization": f"Bearer {tokens['admin']}"}
        payload = {
            "customer_name": "Rajesh Kumar",
            "customer_mobile": TEST_MOBILE,
            "menu_item_id": 1
        }
        
        response = requests.post(
            f"{BACKEND_URL}/half-order?restaurant_id={RESTAURANT_ID}&table_no=T1",
            json=payload,
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 201:
            data = response.json()
            session_id = data['id']
            return print_result(True, f"Session created: ID={session_id}, Expires={data.get('expires_at', 'N/A')}")
        else:
            return print_result(False, f"Status {response.status_code}: {response.text}")
    except Exception as e:
        return print_result(False, f"Exception: {str(e)}")


def test_get_active_sessions():
    """Test GET /api/half-order/active"""
    print_test("4. Get Active Half-Order Sessions")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/half-order/active?restaurant_id={RESTAURANT_ID}",
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            found = any(s['id'] == session_id for s in data) if session_id else False
            msg = f"Retrieved {len(data)} sessions"
            if session_id:
                msg += f", our session {'found' if found else 'NOT FOUND'}"
            return print_result(True if not session_id or found else False, msg)
        else:
            return print_result(False, f"Status {response.status_code}: {response.text}")
    except Exception as e:
        return print_result(False, f"Exception: {str(e)}")


def test_join_half_order():
    """Test POST /api/half-order/{id}/join"""
    print_test("5. Join Half-Order Session")
    
    if not session_id:
        return print_result(False, "No session ID available")
    
    if "admin" not in tokens:
        return print_result(False, "Admin token not available")
    
    try:
        headers = {"Authorization": f"Bearer {tokens['admin']}"}
        payload = {
            "table_no": "T2",
            "customer_name": "Priya Sharma",
            "customer_mobile": "9876543211"
        }
        
        response = requests.post(
            f"{BACKEND_URL}/half-order/{session_id}/join",
            json=payload,
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            return print_result(True, f"Joined successfully: Paired Order={data.get('paired_order_id', 'N/A')}")
        else:
            return print_result(False, f"Status {response.status_code}: {response.text}")
    except Exception as e:
        return print_result(False, f"Exception: {str(e)}")


# ============ 3. ORDER TESTS ============

def test_create_order():
    """Test POST /api/orders"""
    global order_id
    print_test("6. Create Order")
    
    if "admin" not in tokens:
        return print_result(False, "Admin token not available")
    
    try:
        headers = {"Authorization": f"Bearer {tokens['admin']}"}
        payload = {
            "restaurant_id": RESTAURANT_ID,
            "table_no": "T3",
            "customer_name": "Amit Patel",
            "phone": "9876543212",
            "items": [
                {
                    "menu_item_id": 1,
                    "name": "Paneer Tikka",
                    "quantity": 2,
                    "price": 200
                }
            ]
        }
        
        response = requests.post(
            f"{BACKEND_URL}/orders",
            json=payload,
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 201:
            data = response.json()
            order_id = data.get('order_id')
            return print_result(True, f"Order created: ID={order_id}, Amount=₹{data.get('total_amount', 0)}")
        else:
            return print_result(False, f"Status {response.status_code}: {response.text}")
    except Exception as e:
        return print_result(False, f"Exception: {str(e)}")


def test_get_orders():
    """Test GET /api/orders"""
    print_test("7. Get Orders (Today)")
    
    if "counter" not in tokens:
        return print_result(False, "Counter token not available")
    
    try:
        headers = {"Authorization": f"Bearer {tokens['counter']}"}
        response = requests.get(
            f"{BACKEND_URL}/orders?restaurant_id={RESTAURANT_ID}&period=today",
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            total = data.get('total', 0)
            return print_result(True, f"Retrieved {total} orders")
        else:
            return print_result(False, f"Status {response.status_code}: {response.text}")
    except Exception as e:
        return print_result(False, f"Exception: {str(e)}")


def test_update_order_status():
    """Test PATCH /api/orders/{id}"""
    print_test("8. Update Order Status")
    
    if not order_id:
        return print_result(False, "No order ID available")
    
    if "counter" not in tokens:
        return print_result(False, "Counter token not available")
    
    try:
        headers = {"Authorization": f"Bearer {tokens['counter']}"}
        payload = {"status": "PREPARING"}
        
        response = requests.patch(
            f"{BACKEND_URL}/orders/{order_id}",
            json=payload,
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            return print_result(True, f"Status updated to: {data.get('status', 'N/A')}")
        else:
            return print_result(False, f"Status {response.status_code}: {response.text}")
    except Exception as e:
        return print_result(False, f"Exception: {str(e)}")


# ============ 4. COUNTER TESTS ============

def test_get_tables():
    """Test GET /api/counter/tables"""
    print_test("9. Get Tables Status")
    
    if "counter" not in tokens:
        return print_result(False, "Counter token not available")
    
    try:
        headers = {"Authorization": f"Bearer {tokens['counter']}"}
        response = requests.get(
            f"{BACKEND_URL}/counter/tables?restaurant_id={RESTAURANT_ID}",
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            summary = data.get('summary', {})
            return print_result(True, f"Tables: {summary.get('total', 0)} total, {summary.get('available', 0)} available")
        else:
            return print_result(False, f"Status {response.status_code}: {response.text}")
    except Exception as e:
        return print_result(False, f"Exception: {str(e)}")


def test_dashboard_stats():
    """Test GET /api/counter/dashboard-stats"""
    print_test("10. Get Dashboard Stats")
    
    if "counter" not in tokens:
        return print_result(False, "Counter token not available")
    
    try:
        headers = {"Authorization": f"Bearer {tokens['counter']}"}
        response = requests.get(
            f"{BACKEND_URL}/counter/dashboard-stats?restaurant_id={RESTAURANT_ID}",
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            return print_result(True, f"Active Orders: {data.get('active_orders', 0)}, Revenue: ₹{data.get('today_revenue', 0)}")
        else:
            return print_result(False, f"Status {response.status_code}: {response.text}")
    except Exception as e:
        return print_result(False, f"Exception: {str(e)}")


# ============ MAIN RUNNER ============

def run_tests():
    """Run all critical path tests"""
    print("\n" + "="*60)
    print("QUICK BACKEND VALIDATION TEST")
    print("="*60)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Restaurant ID: {RESTAURANT_ID}")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    results = []
    
    # Run tests in sequence
    results.append(("Auth Login", test_auth_login()))
    results.append(("Counter Login", test_counter_login()))
    results.append(("Create Half-Order", test_create_half_order()))
    results.append(("Get Active Sessions", test_get_active_sessions()))
    results.append(("Join Half-Order", test_join_half_order()))
    results.append(("Create Order", test_create_order()))
    results.append(("Get Orders", test_get_orders()))
    results.append(("Update Order Status", test_update_order_status()))
    results.append(("Get Tables", test_get_tables()))
    results.append(("Dashboard Stats", test_dashboard_stats()))
    
    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    
    passed = sum(1 for _, result in results if result)
    failed = sum(1 for _, result in results if not result)
    
    print(f"\nTotal: {len(results)} | Passed: {passed} | Failed: {failed}")
    
    if failed > 0:
        print("\nFailed Tests:")
        for name, result in results:
            if not result:
                print(f"  ✗ {name}")
    
    print(f"\nCompleted: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60 + "\n")
    
    return all(result for _, result in results)


if __name__ == "__main__":
    success = run_tests()
    exit(0 if success else 1)
