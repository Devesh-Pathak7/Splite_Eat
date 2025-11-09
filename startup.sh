#!/bin/bash

echo "=========================================="
echo "🚀 SplitEat Startup Script"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${YELLOW}💬 $1${NC}"; }

# Step 1: Start MySQL
print_info "Step 1: Starting MySQL/MariaDB..."
pkill -9 mariadbd 2>/dev/null || true
mkdir -p /run/mysqld
chmod 777 /run/mysqld
nohup mariadbd --user=root > /tmp/mariadb.log 2>&1 &

# Wait for MySQL
for i in {1..20}; do
    if mysql -u root -e "SELECT 1;" > /dev/null 2>&1; then
        print_success "MySQL is ready"
        break
    fi
    sleep 1
done

# Set password and create database
mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY 'root'; FLUSH PRIVILEGES;" 2>/dev/null || true
mysql -u root -proot -e "CREATE DATABASE IF NOT EXISTS spliteat_db;" 2>&1 | grep -v "Warning"

print_success "MySQL configured"
echo ""

# Step 2: Initialize Database
print_info "Step 2: Initializing database..."
cd /app/backend
python init_db.py > /dev/null 2>&1
if [ $? -eq 0 ]; then
    print_success "Database tables created"
else
    print_error "Database initialization failed"
fi
echo ""

# Step 3: Seed Data
print_info "Step 3: Seeding sample data..."
python seed_db.py > /dev/null 2>&1
if [ $? -eq 0 ]; then
    print_success "Sample data seeded"
else
    print_info "Skipping seed (data already exists)"
fi
echo ""

# Step 4: Start Backend
print_info "Step 4: Starting backend..."
sudo supervisorctl restart backend > /dev/null 2>&1
sleep 3
if sudo supervisorctl status backend | grep -q RUNNING; then
    print_success "Backend is running"
else
    print_error "Backend failed to start"
    print_info "Check logs: tail -f /var/log/supervisor/backend.err.log"
fi
echo ""

# Step 5: Start Frontend
print_info "Step 5: Starting frontend..."
sudo supervisorctl restart frontend > /dev/null 2>&1
sleep 2
if sudo supervisorctl status frontend | grep -q RUNNING; then
    print_success "Frontend is running"
else
    print_error "Frontend failed to start"
fi
echo ""

# Step 6: Test API
print_info "Step 6: Testing API..."
API_TEST=$(curl -s http://localhost:8001/api/restaurants | jq 'length' 2>/dev/null)
if [ "$API_TEST" -gt 0 ]; then
    print_success "API is responding ($API_TEST restaurants found)"
else
    print_error "API is not responding"
fi
echo ""

echo "=========================================="
print_success "STARTUP COMPLETE!"
echo "=========================================="
echo ""
echo "📝 Access Points:"
echo "   Frontend: https://your-domain.com"
echo "   Backend: http://localhost:8001"
echo "   API Docs: http://localhost:8001/docs"
echo ""
echo "🔑 Login Credentials:"
echo "   Super Admin: admin / admin123"
echo "   Counter Admin: counter1 / admin123"
echo ""
echo "📱 Test Menu Page:"
echo "   https://your-domain.com/menu/1/T1"
echo ""
echo "🔍 Useful Commands:"
echo "   • View logs: tail -f /var/log/supervisor/backend.err.log"
echo "   • Restart: sudo supervisorctl restart all"
echo "   • Status: sudo supervisorctl status"
echo ""
