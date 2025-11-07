# SplitEat - Local Setup Guide with MySQL

## Prerequisites Checklist
- [x] MySQL 8.0 installed (MySQL Workbench 8.0 CE)
- [x] Python 3.11+
- [x] Node.js 18+ and Yarn

## Step-by-Step Setup

### 1. MySQL Database Setup

Open MySQL Workbench or terminal and run:

```sql
-- Create database
CREATE DATABASE IF NOT EXISTS spliteat_db;

-- Verify database is created
SHOW DATABASES LIKE 'spliteat_db';

-- Optional: Create dedicated user (recommended for production)
CREATE USER IF NOT EXISTS 'spliteat_user'@'localhost' IDENTIFIED BY 'spliteat_password';
GRANT ALL PRIVILEGES ON spliteat_db.* TO 'spliteat_user'@'localhost';
FLUSH PRIVILEGES;
```

### 2. Update Backend Configuration

Edit `/app/backend/.env` with your MySQL credentials:

```bash
# Database Configuration
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root              # or spliteat_user if you created one
MYSQL_PASSWORD=your_password  # your MySQL root password
MYSQL_DATABASE=spliteat_db

# JWT Configuration (change in production)
SECRET_KEY=your-secret-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Super Admin Override (for emergency access)
SUPER_ADMIN_OVERRIDE_KEY=emergency-override-key-change-in-production

# Half Order Configuration
HALF_ORDER_EXPIRY_MINUTES=30

# CORS Configuration
CORS_ORIGINS=*
```

### 3. Initialize Database Tables

Run the initialization script:

```bash
cd /app/backend
python init_db.py
```

You should see:
```
🔧 Initializing SplitEat Database...
📋 Creating database tables...
✅ Database tables created successfully!
```

### 4. Seed Sample Data (Optional but Recommended)

Populate with sample restaurants, users, and menu items:

```bash
python seed_db.py
```

This creates:
- **Super Admin**: username: `admin`, password: `admin123`
- **3 Restaurants** with different types (Mixed, Mixed, Pure Veg)
- **3 Counter Admins**: `counter1`, `counter2`, `counter3` (password: `admin123`)
- **12 Tables** with QR codes
- **11 Menu Items** (Veg and Non-Veg)
- **Sample Orders**

### 5. Verify Database Setup

Check tables in MySQL Workbench:

```sql
USE spliteat_db;
SHOW TABLES;

-- Should show:
-- audit_logs
-- error_logs
-- half_order_sessions
-- menu_items
-- orders
-- restaurants
-- tables
-- users

-- Verify data
SELECT * FROM users;
SELECT * FROM restaurants;
SELECT * FROM menu_items;
```

### 6. Install Backend Dependencies

```bash
cd /app/backend
pip install -r requirements.txt
```

### 7. Start Backend Server

```bash
sudo supervisorctl restart backend

# Check status
sudo supervisorctl status backend

# View logs
tail -f /var/log/supervisor/backend.out.log
```

Backend should start on port 8001.

### 8. Start Frontend

```bash
cd /app/frontend
yarn install  # if not already done
sudo supervisorctl restart frontend

# Check status
sudo supervisorctl status frontend
```

Frontend should start on port 3000.

### 9. Access Application

Open your browser:
- **URL**: Your deployment URL or http://localhost:3000
- **Login**: username: `admin`, password: `admin123`

## Troubleshooting

### Issue: "Can't connect to MySQL server"

**Solution:**
```bash
# Check if MySQL is running
sudo service mysql status
# or
mysqladmin -u root -p status

# Start MySQL if not running
sudo service mysql start

# Test connection
mysql -u root -p
```

### Issue: "Failed to load restaurants"

**Causes & Solutions:**

1. **Database not initialized**
   ```bash
   cd /app/backend
   python init_db.py
   python seed_db.py
   ```

2. **Backend not running**
   ```bash
   sudo supervisorctl status backend
   sudo supervisorctl restart backend
   ```

3. **Wrong credentials in .env**
   - Verify MYSQL_PASSWORD matches your MySQL root password
   - Test connection: `mysql -u root -p`

4. **Database doesn't exist**
   ```sql
   CREATE DATABASE spliteat_db;
   ```

5. **Check backend logs**
   ```bash
   tail -f /var/log/supervisor/backend.err.log
   ```

### Issue: "Access denied for user"

**Solution:**
```sql
-- Reset MySQL root password if forgotten
-- Or grant permissions
GRANT ALL PRIVILEGES ON spliteat_db.* TO 'root'@'localhost';
FLUSH PRIVILEGES;
```

### Issue: Tables not created

**Solution:**
```bash
# Run init script again
cd /app/backend
python init_db.py

# Verify in MySQL
mysql -u root -p spliteat_db
SHOW TABLES;
```

### Issue: API returns 500 errors

**Solution:**
```bash
# Check backend error logs
tail -n 100 /var/log/supervisor/backend.err.log

# Common issues:
# 1. Missing tables - run init_db.py
# 2. Wrong password in .env
# 3. MySQL not running
```

## Quick Test Commands

### Test Database Connection
```bash
cd /app/backend
python -c "import asyncio; from database import engine; asyncio.run(engine.connect())"
```

### Test API
```bash
# Health check
curl http://localhost:8001/api/

# Should return: {"message":"SplitEat API is running"}

# List restaurants
curl http://localhost:8001/api/restaurants
```

### Test Login
```bash
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

## Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| MYSQL_HOST | MySQL server host | localhost | Yes |
| MYSQL_PORT | MySQL server port | 3306 | Yes |
| MYSQL_USER | MySQL username | root | Yes |
| MYSQL_PASSWORD | MySQL password | - | Yes |
| MYSQL_DATABASE | Database name | spliteat_db | Yes |
| SECRET_KEY | JWT secret key | - | Yes |
| HALF_ORDER_EXPIRY_MINUTES | Half order timeout | 30 | No |
| SUPER_ADMIN_OVERRIDE_KEY | Emergency access | - | No |

## Default Credentials

### Super Admin
- **Username**: `admin`
- **Password**: `admin123`
- **Access**: All restaurants, analytics, user management

### Counter Admins
- **Username**: `counter1`, `counter2`, `counter3`
- **Password**: `admin123`
- **Access**: Restaurant-specific menu, orders, tables

## Need Help?

If you're still facing issues:

1. Check all logs:
   - Backend: `/var/log/supervisor/backend.err.log`
   - Frontend: `/var/log/supervisor/frontend.err.log`

2. Verify MySQL connection:
   ```bash
   mysql -u root -p -e "USE spliteat_db; SELECT COUNT(*) FROM users;"
   ```

3. Ensure all services running:
   ```bash
   sudo supervisorctl status
   ```

4. Review this guide step-by-step

## Success Checklist

- [ ] MySQL running and accessible
- [ ] Database `spliteat_db` exists
- [ ] Tables created (run `init_db.py`)
- [ ] Sample data loaded (run `seed_db.py`)
- [ ] Backend running without errors
- [ ] Frontend running and accessible
- [ ] Can login as admin
- [ ] Can see restaurants list
- [ ] Can add new restaurant

Once all checked, your SplitEat application is ready! 🎉