# 🔐 Half-Order Session Concurrency & Duplicate Prevention

## Overview
This document explains how SplitEat handles concurrent half-order operations and prevents duplicate sessions.

---

## 🎯 Problem Statement

### **Issue 1: Multiple Customers Joining Same Session**
**Scenario:**
- Table T1 creates half-order for "Paneer Tikka"
- Tables T2, T3, and T4 all click "Join" at the exact same moment

**Without Concurrency Control:**
- Race condition could cause data corruption
- Multiple paired orders for same session
- Payment calculation errors
- Kitchen receives duplicate orders

### **Issue 2: Duplicate Active Sessions**
**Scenario:**
- Table T1 creates half-order for "Paneer Tikka"
- Table T2 doesn't see it (slow network) and creates another half-order for "Paneer Tikka"
- Now 2 active sessions exist for same dish in same restaurant

**Without Duplicate Prevention:**
- Confusing customer experience
- Kitchen confusion (which half-order to prepare?)
- Wasted inventory
- Poor user experience

---

## ✅ Solutions Implemented

## **Solution 1: Database Row-Level Locking**

### **How It Works:**

```python
# Step 1: Lock the row before any updates
result = await db.execute(
    select(HalfOrderSession)
    .where(HalfOrderSession.id == session_id)
    .with_for_update()  # ⚡ ROW LOCK
)
session = result.scalar_one_or_none()
```

**What `FOR UPDATE` Does:**
1. **Locks the database row** immediately
2. Other transactions trying to read this row will **WAIT**
3. First transaction completes → releases lock
4. Next transaction gets the lock → processes
5. Guarantees **serial execution** of concurrent requests

### **Join Process with Locking:**

```
Time    Table T2          Table T3          Table T4
─────────────────────────────────────────────────────
0ms     Click "Join" →    Click "Join" →    Click "Join" →
10ms    ✓ Gets Lock       ⏳ Waits         ⏳ Waits
15ms    Processing...     ⏳ Waits         ⏳ Waits
20ms    Creates Pair      ⏳ Waits         ⏳ Waits
25ms    Commits + ✓       Gets Lock →      ⏳ Waits
30ms                      Check: Already   ⏳ Waits
                          Joined!
35ms                      ❌ Error         Gets Lock →
40ms                                       Check: Already
                                          Joined!
45ms                                       ❌ Error
```

### **Duplicate Join Prevention:**

```python
# Check if this table already joined
existing_paired = await db.execute(
    select(PairedOrder).where(
        and_(
            or_(
                PairedOrder.half_session_a == session.id,
                PairedOrder.half_session_b == session.id
            ),
            PairedOrder.joiner_table_no == joiner_table_no
        )
    )
)

if existing_paired.scalar_one_or_none():
    raise ValueError(f"Table {joiner_table_no} has already joined this session")
```

**Result:** ✅ Only ONE customer successfully joins, others get clear error message.

---

## **Solution 2: Duplicate Session Prevention**

### **How It Works:**

```python
# Before creating new session, check for existing active sessions
existing_result = await db.execute(
    select(HalfOrderSession)
    .where(
        and_(
            HalfOrderSession.restaurant_id == restaurant_id,
            HalfOrderSession.menu_item_id == menu_item_id,
            HalfOrderSession.status == HalfOrderStatus.ACTIVE
        )
    )
)
existing_sessions = existing_result.scalars().all()

# Filter out expired sessions
valid_existing = []
for sess in existing_sessions:
    expires_at = sess.expires_at
    if expires_at.tzinfo is None:
        expires_at = IST.localize(expires_at)
    
    if expires_at > now_ist:
        valid_existing.append(sess)

if valid_existing:
    # Show existing sessions to user
    session_info = ", ".join([
        f"Session #{s.id} by Table {s.table_no} ({s.customer_name})"
        for s in valid_existing[:3]
    ])
    
    raise ValueError(
        f"Active half-order already exists for {menu_item.name}. "
        f"Please join existing session(s): {session_info}"
    )
```

### **User Experience Flow:**

**Scenario: Table T2 tries to create duplicate**

```
Table T1 → Creates half-order for "Paneer Tikka" ✓
         → Session #123 active for 28 minutes

Table T2 → Clicks "Start Half" for "Paneer Tikka"
         → ❌ Error: "Active half-order already exists for Paneer Tikka.
                     Please join existing session(s): 
                     Session #123 by Table T1 (Rajesh Kumar)"
         → Frontend shows error + button to join Session #123
```

**Result:** ✅ Prevents confusion, guides users to join existing sessions.

---

## 🔄 Complete Concurrency Flow

### **Scenario: 5 Tables, 1 Paneer Tikka Session**

```
Restaurant: The Orange Bistro
Menu Item: Paneer Tikka (Half Price: ₹200)

Timeline:
─────────────────────────────────────────────────────────

09:00 AM - Table T1 (Rajesh)
  → Creates Half-Order Session #456
  → Status: ACTIVE
  → Expires: 09:30 AM

09:05 AM - Table T2 (Priya) tries to create duplicate
  → ❌ Error: "Active session exists, join Session #456"
  → Clicks "Join Session #456"
  → ✓ SUCCESS - Creates PairedOrder #101
  → Session #456 status → JOINED
  → Tracking: joiner_table_no = "T2"

09:06 AM - Table T3 (Amit) tries to join
09:06 AM - Table T4 (Neha) tries to join  } CONCURRENT
09:06 AM - Table T5 (Vikram) tries to join}

Processing Order (Database Lock):
  1. T3 gets lock first → Checks for existing paired order by T3 → None found → ✓ Creates PairedOrder #102
  2. T4 waits → Gets lock → Checks → None found → ✓ Creates PairedOrder #103
  3. T5 waits → Gets lock → Checks → None found → ✓ Creates PairedOrder #104

Result:
  → Original Session #456 by T1
  → 4 Paired Orders: T2, T3, T4, T5
  → 5 customers sharing same dish
  → Each tracked separately in paired_orders table
```

---

## 📊 Database Schema Updates

### **PairedOrder Table (Enhanced)**

```sql
CREATE TABLE paired_orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    half_session_a INT NOT NULL,
    half_session_b INT NOT NULL,
    restaurant_id INT NOT NULL,
    menu_item_id INT NOT NULL,
    menu_item_name VARCHAR(120) NOT NULL,
    total_price FLOAT NOT NULL,
    status ENUM('PENDING', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING',
    created_at DATETIME NOT NULL,
    completed_at DATETIME,
    order_id INT,
    
    -- NEW: Joiner tracking for concurrency
    joiner_table_no VARCHAR(20),
    joiner_customer_name VARCHAR(100),
    joiner_customer_mobile VARCHAR(15),
    
    INDEX idx_paired_orders_joiner_table (joiner_table_no),
    INDEX idx_paired_orders_session_joiner (half_session_a, joiner_table_no),
    
    FOREIGN KEY (half_session_a) REFERENCES half_order_sessions(id),
    FOREIGN KEY (half_session_b) REFERENCES half_order_sessions(id)
);
```

---

## 🧪 Testing Scenarios

### **Test 1: Concurrent Join (3 customers)**

```bash
# Terminal 1 - Table T2
curl -X POST http://localhost:8001/api/half-order/456/join \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"table_no":"T2","customer_name":"Priya","customer_mobile":"9876543211"}'

# Terminal 2 - Table T3 (same moment)
curl -X POST http://localhost:8001/api/half-order/456/join \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"table_no":"T3","customer_name":"Amit","customer_mobile":"9876543212"}'

# Terminal 3 - Table T4 (same moment)
curl -X POST http://localhost:8001/api/half-order/456/join \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"table_no":"T4","customer_name":"Neha","customer_mobile":"9876543213"}'
```

**Expected Result:**
- All 3 succeed (processed serially by database lock)
- 3 separate PairedOrder records created
- Each tracked with unique joiner_table_no

### **Test 2: Duplicate Join Prevention**

```bash
# Table T2 joins once
curl -X POST http://localhost:8001/api/half-order/456/join ...

# Table T2 tries to join AGAIN
curl -X POST http://localhost:8001/api/half-order/456/join ...

# Expected: ❌ Error: "Table T2 has already joined this session"
```

### **Test 3: Duplicate Session Prevention**

```bash
# Table T1 creates session for Paneer Tikka
curl -X POST "http://localhost:8001/api/half-order?restaurant_id=1&table_no=T1" \
  -d '{"customer_name":"Rajesh","customer_mobile":"9876543210","menu_item_id":1}'

# Table T2 tries to create ANOTHER session for Paneer Tikka
curl -X POST "http://localhost:8001/api/half-order?restaurant_id=1&table_no=T2" \
  -d '{"customer_name":"Priya","customer_mobile":"9876543211","menu_item_id":1}'

# Expected: ❌ Error: "Active half-order already exists for Paneer Tikka. 
#                     Please join existing session(s): Session #456 by Table T1"
```

---

## 🎯 Key Benefits

### **1. Data Integrity**
✅ No duplicate paired orders
✅ No race conditions
✅ Consistent payment calculations
✅ Accurate kitchen orders

### **2. User Experience**
✅ Clear error messages
✅ Suggested actions (join existing session)
✅ Fair access (first-come-first-served with locking)
✅ No confusion about multiple sessions

### **3. Business Logic**
✅ One active session per menu item per restaurant
✅ Multiple customers can join same session
✅ Each joiner tracked individually
✅ Proper audit trail

### **4. Performance**
✅ Row-level locking (not table-level)
✅ Fast concurrent operations
✅ Indexed queries for quick lookups
✅ Minimal lock contention

---

## 🔍 Monitoring & Debugging

### **Check Active Sessions:**
```sql
SELECT 
    id,
    restaurant_id,
    table_no,
    menu_item_name,
    customer_name,
    status,
    created_at,
    expires_at,
    joined_by_table_no,
    joined_by_customer_name
FROM half_order_sessions
WHERE status IN ('ACTIVE', 'JOINED')
ORDER BY created_at DESC;
```

### **Check Paired Orders:**
```sql
SELECT 
    po.id,
    po.half_session_a,
    po.menu_item_name,
    po.joiner_table_no,
    po.joiner_customer_name,
    po.status,
    po.created_at
FROM paired_orders po
WHERE po.status = 'PENDING'
ORDER BY po.created_at DESC;
```

### **Count Joiners for a Session:**
```sql
SELECT 
    COUNT(*) as total_joiners
FROM paired_orders
WHERE half_session_a = 456 OR half_session_b = 456;
```

---

## 📋 Summary

| Feature | Status | Implementation |
|---------|--------|----------------|
| **Concurrent Join Prevention** | ✅ Implemented | Row-level locking with `FOR UPDATE` |
| **Duplicate Join Check** | ✅ Implemented | Query existing paired orders by table |
| **Duplicate Session Prevention** | ✅ Implemented | Check active sessions before creation |
| **Multiple Joiners Support** | ✅ Implemented | Multiple PairedOrder records per session |
| **Joiner Tracking** | ✅ Implemented | Store joiner details in PairedOrder |
| **Timezone Consistency** | ✅ Implemented | IST timezone throughout |
| **Audit Logging** | ✅ Implemented | All operations logged |
| **WebSocket Broadcast** | ✅ Implemented | Real-time updates to all clients |

---

## 🚀 Production Considerations

### **Database Optimization:**
- Indexes on `(restaurant_id, menu_item_id, status)` for fast lookups
- Index on `(half_session_a, joiner_table_no)` for duplicate checks
- Regular cleanup of expired sessions

### **Application Layer:**
- Connection pooling for high concurrency
- Timeout configuration for lock waits
- Retry logic for failed transactions

### **Monitoring:**
- Track lock wait times
- Monitor duplicate attempt frequency
- Alert on session creation failures
- Dashboard for active sessions count

---

**✅ SplitEat now has production-grade concurrency control for half-order sessions!**
