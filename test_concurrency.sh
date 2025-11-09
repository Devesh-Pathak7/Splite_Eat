#!/bin/bash
# Test Half-Order Concurrency

echo "=========================================="
echo "🧪 Half-Order Concurrency Test"
echo "=========================================="
echo ""

# Get auth token
echo "🔑 Getting auth token..."
TOKEN=$(curl -s -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r .access_token)

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo "❌ Failed to get auth token"
    exit 1
fi
echo "✅ Got token"
echo ""

# Test 1: Create half-order session
echo "📝 Test 1: Create half-order session"
echo "────────────────────────────────────────"
SESSION=$(curl -s -X POST "http://localhost:8001/api/half-order?restaurant_id=1&table_no=T1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"customer_name":"Rajesh Kumar","customer_mobile":"9876543210","menu_item_id":1}')

SESSION_ID=$(echo $SESSION | jq -r .id)
if [ -z "$SESSION_ID" ] || [ "$SESSION_ID" = "null" ]; then
    echo "❌ Failed to create session"
    echo "Response: $SESSION"
    exit 1
fi
echo "✅ Created session #$SESSION_ID"
echo ""

# Test 2: Try to create duplicate session (should fail)
echo "📝 Test 2: Try duplicate session creation (should fail)"
echo "────────────────────────────────────────"
DUPLICATE=$(curl -s -X POST "http://localhost:8001/api/half-order?restaurant_id=1&table_no=T2" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"customer_name":"Priya Sharma","customer_mobile":"9876543211","menu_item_id":1}')

ERROR=$(echo $DUPLICATE | jq -r .detail)
if [[ "$ERROR" == *"Active half-order already exists"* ]]; then
    echo "✅ Duplicate prevention working!"
    echo "   Error message: $ERROR"
else
    echo "❌ Duplicate prevention failed!"
    echo "   Response: $DUPLICATE"
fi
echo ""

# Test 3: Concurrent joins (3 tables)
echo "📝 Test 3: Concurrent joins by 3 tables"
echo "────────────────────────────────────────"

# Join in background
curl -s -X POST "http://localhost:8001/api/half-order/$SESSION_ID/join" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"table_no":"T2","customer_name":"Priya","customer_mobile":"9876543211"}' > /tmp/join_t2.json &

curl -s -X POST "http://localhost:8001/api/half-order/$SESSION_ID/join" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"table_no":"T3","customer_name":"Amit","customer_mobile":"9876543212"}' > /tmp/join_t3.json &

curl -s -X POST "http://localhost:8001/api/half-order/$SESSION_ID/join" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"table_no":"T4","customer_name":"Neha","customer_mobile":"9876543213"}' > /tmp/join_t4.json &

# Wait for all
wait

echo "Results:"
for table in T2 T3 T4; do
    RESULT=$(cat /tmp/join_${table,,}.json | jq -r .paired_order_id)
    if [ "$RESULT" != "null" ] && [ -n "$RESULT" ]; then
        echo "  ✅ Table $table joined successfully (Paired Order #$RESULT)"
    else
        ERROR=$(cat /tmp/join_${table,,}.json | jq -r .detail)
        echo "  ❌ Table $table failed: $ERROR"
    fi
done
echo ""

# Test 4: Try duplicate join (should fail)
echo "📝 Test 4: Try duplicate join (should fail)"
echo "────────────────────────────────────────"
DUPE_JOIN=$(curl -s -X POST "http://localhost:8001/api/half-order/$SESSION_ID/join" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"table_no":"T2","customer_name":"Priya","customer_mobile":"9876543211"}')

ERROR=$(echo $DUPE_JOIN | jq -r .detail)
if [[ "$ERROR" == *"already joined"* ]]; then
    echo "✅ Duplicate join prevention working!"
    echo "   Error: $ERROR"
else
    echo "❌ Duplicate join prevention failed"
    echo "   Response: $DUPE_JOIN"
fi
echo ""

# Summary
echo "=========================================="
echo "📊 Test Summary"
echo "=========================================="
mysql -u root -proot -e "
SELECT 
    COUNT(*) as total_paired_orders,
    GROUP_CONCAT(joiner_table_no) as joined_tables
FROM spliteat_db.paired_orders 
WHERE half_session_a = $SESSION_ID OR half_session_b = $SESSION_ID;
" 2>/dev/null | tail -n +2

echo ""
echo "✅ All concurrency tests completed!"
