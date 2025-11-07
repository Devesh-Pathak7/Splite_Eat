# SplitEat - Troubleshooting Guide

## Common Issues and Solutions

### Issue 1: "Failed to load restaurants" after login

**Symptoms:**
- Toast notification shows "Failed to load restaurants"
- Super admin page is empty
- Cannot add new restaurants

**Root Causes & Solutions:**

#### A. Database tables not created

**Check:**
```bash
mysql -u root -p
USE spliteat_db;
SHOW TABLES;
```

**Solution:**
```bash
cd /app/backend
python init_db.py
python seed_db.py
sudo supervisorctl restart backend
```

#### B. Backend not connected to MySQL

**Check backend logs:**
```bash
tail -n 50 /var/log/supervisor/backend.err.log
```

**Look for:**
- "Can't connect to MySQL server"
- "Access denied for user"
- "Unknown database"

**Solution:**
1. Verify MySQL is running:
   ```bash
   sudo service mysql status
   sudo service mysql start  # if not running
   ```

2. Check credentials in `/app/backend/.env`:
   ```bash
   cat /app/backend/.env
   ```

3. Test MySQL connection:
   ```bash
   cd /app/backend
   python test_connection.py
   ```

4. Ensure database exists:
   ```sql
   CREATE DATABASE IF NOT EXISTS spliteat_db;
   ```

#### C. Backend crashed or not running

**Check status:**
```bash
sudo supervisorctl status backend
```

**If not running:**
```bash
sudo supervisorctl restart backend
tail -f /var/log/supervisor/backend.out.log
```

#### D. API endpoint issues

**Test API directly:**
```bash
# Health check
curl http://localhost:8001/api/

# Test restaurants endpoint
curl http://localhost:8001/api/restaurants
```

**Expected response:**
```json
[]
```
or list of restaurants if seeded.

**If API not responding:**
1. Check backend is running
2. Check port 8001 is accessible
3. Review backend error logs

---

### Issue 2: "Can't connect to MySQL server"

**Solution:**

1. **Check MySQL is running:**
   ```bash
   sudo service mysql status
   # or
   mysqladmin -u root -p status
   ```

2. **Start MySQL:**
   ```bash
   sudo service mysql start
   ```

3. **Verify MySQL is listening:**
   ```bash
   sudo netstat -tlnp | grep 3306
   ```

4. **Test connection:**
   ```bash
   mysql -u root -p
   ```

5. **Check firewall (if remote):**
   ```bash
   sudo ufw allow 3306
   ```

---

### Issue 3: "Access denied for user 'root'@'localhost'"

**Solution:**

1. **Verify password in .env matches MySQL:**
   ```bash
   cat /app/backend/.env | grep MYSQL_PASSWORD
   ```

2. **Reset MySQL password if needed:**
   ```bash
   sudo mysql
   ```
   ```sql
   ALTER USER 'root'@'localhost' IDENTIFIED BY 'your_new_password';
   FLUSH PRIVILEGES;
   ```

3. **Update .env with new password**

4. **Grant permissions:**
   ```sql
   GRANT ALL PRIVILEGES ON spliteat_db.* TO 'root'@'localhost';
   FLUSH PRIVILEGES;
   ```

---

### Issue 4: Database exists but no tables

**Check:**
```sql
USE spliteat_db;
SHOW TABLES;
```

**Solution:**
```bash
cd /app/backend
python init_db.py
```

**Verify:**
```sql
SHOW TABLES;
-- Should show: users, restaurants, tables, menu_items, 
--              half_order_sessions, orders, audit_logs, error_logs
```

---

### Issue 5: Backend keeps crashing

**Diagnose:**
```bash
tail -n 100 /var/log/supervisor/backend.err.log
```

**Common causes:**

1. **Import errors:**
   ```bash
   cd /app/backend
   pip install -r requirements.txt
   ```

2. **Database connection timeout:**
   - Check MySQL is running
   - Verify network connectivity

3. **Syntax errors:**
   - Review recent code changes
   - Check Python version: `python --version` (should be 3.11+)

4. **Port already in use:**
   ```bash
   sudo lsof -i :8001
   # Kill process if needed
   sudo kill -9 <PID>
   ```

---

### Issue 6: Frontend shows blank page

**Check:**
```bash
sudo supervisorctl status frontend
tail -f /var/log/supervisor/frontend.err.log
```

**Solution:**
```bash
cd /app/frontend
yarn install
sudo supervisorctl restart frontend
```

**Check browser console:**
- Press F12
- Look for errors in Console tab
- Common: CORS errors, network errors

---

### Issue 7: WebSocket not connecting

**Symptoms:**
- Real-time updates not working
- Half-orders not updating live

**Check:**
1. Backend WebSocket endpoint: `ws://localhost:8001/ws/{restaurant_id}`
2. Browser console for WebSocket errors

**Solution:**
1. Restart backend:
   ```bash
   sudo supervisorctl restart backend
   ```

2. Check firewall allows WebSocket connections

3. Verify CORS settings in `.env`

---

### Issue 8: Cannot add new restaurant

**Symptoms:**
- Add button doesn't work
- Form submission fails
- Error toast appears

**Solution:**

1. **Check authentication:**
   - Ensure logged in as super admin
   - Check token hasn't expired
   - Try logging out and back in

2. **Check API:**
   ```bash
   # Get auth token first by logging in
   TOKEN="your_token_here"
   
   curl -X POST http://localhost:8001/api/restaurants \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name":"Test Restaurant","location":"Test Location","contact":"1234567890","type":"mixed"}'
   ```

3. **Check backend logs for errors:**
   ```bash
   tail -f /var/log/supervisor/backend.err.log
   ```

---

## Quick Diagnostic Commands

### System Status
```bash
# Check all services
sudo supervisorctl status

# Check MySQL
sudo service mysql status

# Check ports
sudo netstat -tlnp | grep -E '3000|3306|8001'
```

### Database Check
```bash
# Connection test
cd /app/backend
python test_connection.py

# Manual check
mysql -u root -p spliteat_db -e "SELECT COUNT(*) FROM users;"
```

### API Testing
```bash
# Health check
curl http://localhost:8001/api/

# Restaurants
curl http://localhost:8001/api/restaurants

# Login test
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Logs
```bash
# Backend errors
tail -f /var/log/supervisor/backend.err.log

# Backend output
tail -f /var/log/supervisor/backend.out.log

# Frontend
tail -f /var/log/supervisor/frontend.err.log

# All logs
sudo supervisorctl tail -f backend stderr
```

---

## Complete Reset (Nuclear Option)

If nothing works, start fresh:

```bash
# 1. Stop services
sudo supervisorctl stop backend frontend

# 2. Drop and recreate database
mysql -u root -p -e "DROP DATABASE IF EXISTS spliteat_db; CREATE DATABASE spliteat_db;"

# 3. Reinitialize
cd /app/backend
python init_db.py
python seed_db.py

# 4. Restart services
sudo supervisorctl start backend frontend

# 5. Wait 5 seconds
sleep 5

# 6. Check status
sudo supervisorctl status

# 7. Test API
curl http://localhost:8001/api/restaurants
```

---

## Still Having Issues?

### Collect Debug Information

```bash
# Save diagnostic info
echo "=== System Info ===" > debug_info.txt
uname -a >> debug_info.txt
python --version >> debug_info.txt
mysql --version >> debug_info.txt

echo "\n=== Service Status ===" >> debug_info.txt
sudo supervisorctl status >> debug_info.txt

echo "\n=== MySQL Status ===" >> debug_info.txt
sudo service mysql status >> debug_info.txt

echo "\n=== Backend Errors ===" >> debug_info.txt
tail -n 50 /var/log/supervisor/backend.err.log >> debug_info.txt

echo "\n=== API Test ===" >> debug_info.txt
curl -v http://localhost:8001/api/ >> debug_info.txt 2>&1

cat debug_info.txt
```

### Contact Support With:
1. Output of `debug_info.txt`
2. Your `.env` file (remove sensitive passwords)
3. MySQL version: `mysql --version`
4. Python version: `python --version`
5. Steps that led to the error

---

## Prevention Checklist

- [ ] MySQL always running before starting backend
- [ ] Database credentials correct in `.env`
- [ ] Database `spliteat_db` exists
- [ ] Tables initialized with `init_db.py`
- [ ] Sample data loaded with `seed_db.py`
- [ ] Backend starts without errors
- [ ] Frontend connects to backend
- [ ] Can login as admin
- [ ] API responds to health check

---

## Useful Scripts

```bash
# Complete setup
/app/setup.sh

# Quick diagnosis
/app/quick_fix.sh

# Test connection
cd /app/backend && python test_connection.py

# Initialize DB
cd /app/backend && python init_db.py

# Seed data
cd /app/backend && python seed_db.py
```