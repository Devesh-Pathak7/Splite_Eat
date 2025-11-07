#!/bin/bash

# SplitEat - Complete Setup Script
# This script will set up the entire application

set -e  # Exit on error

echo "========================================"
echo "🚀 SplitEat Complete Setup"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${YELLOW}💬 $1${NC}"; }

# Step 1: Check MySQL
print_info "Step 1: Checking MySQL connection..."
cd /app/backend

if python test_connection.py; then
    print_success "MySQL connection successful"
else
    print_error "MySQL connection failed"
    print_info "Please ensure:"
    echo "  1. MySQL is running: sudo service mysql start"
    echo "  2. Database exists: CREATE DATABASE spliteat_db;"
    echo "  3. Credentials in /app/backend/.env are correct"
    exit 1
fi

echo ""

# Step 2: Initialize Database
print_info "Step 2: Initializing database tables..."
if python init_db.py; then
    print_success "Database tables created"
else
    print_error "Failed to create tables"
    exit 1
fi

echo ""

# Step 3: Seed Data
print_info "Step 3: Seeding sample data..."
read -p "Do you want to seed sample data? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if python seed_db.py; then
        print_success "Sample data seeded"
    else
        print_error "Failed to seed data"
    fi
else
    print_info "Skipping sample data seeding"
fi

echo ""

# Step 4: Restart Backend
print_info "Step 4: Restarting backend server..."
if sudo supervisorctl restart backend; then
    sleep 3
    print_success "Backend restarted"
else
    print_error "Failed to restart backend"
    exit 1
fi

echo ""

# Step 5: Check Backend Status
print_info "Step 5: Checking backend status..."
if sudo supervisorctl status backend | grep -q RUNNING; then
    print_success "Backend is running"
else
    print_error "Backend is not running"
    echo "Check logs: tail -f /var/log/supervisor/backend.err.log"
    exit 1
fi

echo ""

# Step 6: Restart Frontend
print_info "Step 6: Restarting frontend..."
if sudo supervisorctl restart frontend; then
    sleep 2
    print_success "Frontend restarted"
else
    print_error "Failed to restart frontend"
fi

echo ""

# Step 7: Test API
print_info "Step 7: Testing API..."
API_RESPONSE=$(curl -s http://localhost:8001/api/ || echo "")
if [[ $API_RESPONSE == *"SplitEat API is running"* ]]; then
    print_success "API is responding"
else
    print_error "API is not responding"
    echo "Check backend logs: tail -f /var/log/supervisor/backend.out.log"
fi

echo ""
echo "========================================"
print_success "SETUP COMPLETE!"
echo "========================================"
echo ""
echo "📝 Login Credentials:"
echo "  Super Admin:"
echo "    Username: admin"
echo "    Password: admin123"
echo ""
echo "  Counter Admins:"
echo "    Username: counter1, counter2, counter3"
echo "    Password: admin123"
echo ""
echo "🌐 Access your application now!"
echo ""
echo "🔍 Useful Commands:"
echo "  - View backend logs: tail -f /var/log/supervisor/backend.out.log"
echo "  - View frontend logs: tail -f /var/log/supervisor/frontend.out.log"
echo "  - Check services: sudo supervisorctl status"
echo "  - Restart backend: sudo supervisorctl restart backend"
echo ""
