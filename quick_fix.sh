#!/bin/bash

# Quick Fix Script for Common Issues

echo "========================================"
echo "🔧 SplitEat Quick Fix"
echo "========================================"
echo ""

# Check what's wrong
echo "🔍 Diagnosing issues..."
echo ""

# 1. Check MySQL
echo "1. Checking MySQL..."
if command -v mysql &> /dev/null; then
    if mysql -u root -p${MYSQL_PASSWORD:-root} -e "USE spliteat_db; SELECT 1;" &> /dev/null; then
        echo "   ✅ MySQL is accessible"
    else
        echo "   ❌ Cannot access database"
        echo "   🔧 Fix: Check password in /app/backend/.env"
    fi
else
    echo "   ❌ MySQL not found"
fi

echo ""

# 2. Check Backend
echo "2. Checking Backend..."
if sudo supervisorctl status backend | grep -q RUNNING; then
    echo "   ✅ Backend is running"
else
    echo "   ❌ Backend is not running"
    echo "   🔧 Fix: sudo supervisorctl restart backend"
fi

echo ""

# 3. Check Frontend
echo "3. Checking Frontend..."
if sudo supervisorctl status frontend | grep -q RUNNING; then
    echo "   ✅ Frontend is running"
else
    echo "   ❌ Frontend is not running"
    echo "   🔧 Fix: sudo supervisorctl restart frontend"
fi

echo ""

# 4. Check API
echo "4. Checking API..."
API_RESPONSE=$(curl -s http://localhost:8001/api/ 2>/dev/null || echo "")
if [[ $API_RESPONSE == *"SplitEat"* ]]; then
    echo "   ✅ API is responding"
else
    echo "   ❌ API is not responding"
    echo "   🔧 Fix: Check backend logs"
fi

echo ""
echo "========================================"
echo "💡 Quick Fixes:"
echo "========================================"
echo ""
echo "If 'Failed to load restaurants':"
echo "  cd /app/backend"
echo "  python init_db.py    # Initialize tables"
echo "  python seed_db.py    # Add sample data"
echo "  sudo supervisorctl restart backend"
echo ""
echo "If 'Can't connect to MySQL':"
echo "  1. Check .env file: cat /app/backend/.env"
echo "  2. Test MySQL: mysql -u root -p"
echo "  3. Create DB: CREATE DATABASE spliteat_db;"
echo ""
echo "View error logs:"
echo "  tail -f /var/log/supervisor/backend.err.log"
echo ""
