#!/bin/bash
TOKEN=$(curl -s -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r .access_token)

echo "🧪 Test 1: Full Order Creation"
ORDER=$(curl -s -X POST http://localhost:8001/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"restaurant_id":1,"table_no":"T6","customer_name":"Test User","phone":"9999999999","items":[{"menu_item_id":2,"name":"Item","quantity":1,"price":100}]}')
  
echo "Order ID: $(echo $ORDER | jq -r .order_id)"
echo ""

echo "🧪 Test 2: Half-Order Join → Auto Order"
SESSION=$(curl -s -X POST "http://localhost:8001/api/half-order?restaurant_id=1&table_no=T7" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"customer_name":"User A","customer_mobile":"1111111111","menu_item_id":3}')
  
SID=$(echo $SESSION | jq -r .id)
echo "Session: $SID"

JOIN=$(curl -s -X POST "http://localhost:8001/api/half-order/$SID/join" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"table_no":"T8","customer_name":"User B","customer_mobile":"2222222222"}')
  
echo "Order created: $(echo $JOIN | jq -r .order_id)"
echo "Table pairing: $(echo $JOIN | jq -r .table_pairing)"
