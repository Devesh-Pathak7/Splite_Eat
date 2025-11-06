# SplitEat - Local Setup Instructions

## Quick Start Guide

This application is **ready to run locally** with MySQL. Follow these steps:

## Step 1: Install MySQL

### On Ubuntu/Debian:
```bash
sudo apt update
sudo apt install mysql-server -y
sudo systemctl start mysql
sudo systemctl enable mysql
```

### On macOS:
```bash
brew install mysql
brew services start mysql
```

### On Windows:
Download and install from: https://dev.mysql.com/downloads/installer/

## Step 2: Configure MySQL

```bash
# Secure MySQL installation
sudo mysql_secure_installation

# Create database and user
sudo mysql
```

In MySQL shell:
```sql
CREATE DATABASE spliteat_db;
CREATE USER 'spliteat_user'@'localhost' IDENTIFIED BY 'spliteat_password';
GRANT ALL PRIVILEGES ON spliteat_db.* TO 'spliteat_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## Step 3: Update Backend Configuration

Edit `/app/backend/.env` with your MySQL credentials:

```bash
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=spliteat_user
MYSQL_PASSWORD=spliteat_password
MYSQL_DATABASE=spliteat_db

SECRET_KEY=change-this-to-a-random-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

HALF_ORDER_EXPIRY_MINUTES=30

CORS_ORIGINS=*
```

## Step 4: Seed Sample Data (Optional)

```bash
mysql -u spliteat_user -p spliteat_db < /app/seed_data.sql
# Enter password: spliteat_password
```

This creates:
- 1 Super Admin (username: `admin`, password: `admin123`)
- 3 Restaurants with sample menus
- 3 Counter Admins (username: `counter1/2/3`, password: `admin123`)
- Sample tables and orders

## Step 5: Start the Application

### Backend:
```bash
cd /app/backend
sudo supervisorctl restart backend

# Check if running:
sudo supervisorctl status backend

# View logs:
tail -f /var/log/supervisor/backend.out.log
```

### Frontend:
```bash
cd /app/frontend
sudo supervisorctl restart frontend

# Check if running:
sudo supervisorctl status frontend

# View logs:
tail -f /var/log/supervisor/frontend.out.log
```

## Step 6: Access the Application

- **Frontend**: Open your browser to the URL shown in frontend `.env` file
- **Login Page**: Use credentials from seed data
- **API Documentation**: http://localhost:8001/docs

## Verify Installation

### Test Backend API:
```bash
curl http://localhost:8001/api/
# Should return: {"message":"SplitEat API is running"}
```

### Test Database Connection:
```bash
mysql -u spliteat_user -p spliteat_db -e "SHOW TABLES;"
```

### Test Login:
1. Go to login page
2. Enter username: `admin`, password: `admin123`
3. Should redirect to Admin Dashboard

## Troubleshooting

### Backend won't start - MySQL connection error

**Problem**: `Can't connect to MySQL server`

**Solution**:
1. Check MySQL is running: `sudo systemctl status mysql`
2. Start MySQL: `sudo systemctl start mysql`
3. Verify credentials in `/app/backend/.env`
4. Test connection: `mysql -u spliteat_user -p`

### Backend won't start - Import errors

**Solution**:
```bash
cd /app/backend
pip install -r requirements.txt
sudo supervisorctl restart backend
```

### Frontend won't connect to backend

**Problem**: API calls failing

**Solution**:
1. Check backend is running: `sudo supervisorctl status backend`
2. Verify `REACT_APP_BACKEND_URL` in `/app/frontend/.env`
3. Test API: `curl http://localhost:8001/api/`

### WebSocket not working

**Solution**:
1. Ensure backend is running
2. Check browser console for WebSocket errors
3. Verify WebSocket URL in browser DevTools Network tab

### Tables not created automatically

**Solution**:
Tables are created automatically on first backend startup. If they're missing:

```bash
# Run this SQL manually:
mysql -u spliteat_user -p spliteat_db
```

Then check `/app/backend/models.py` for table definitions and create them manually if needed, or restart backend to trigger auto-creation.

## Testing the Application

### Test QR Code Flow:

1. Login as counter admin (`counter1` / `admin123`)
2. Go to Tables tab
3. Copy a QR link
4. Open in new browser tab/window
5. You should see the menu page

### Test Half-Orders:

1. Open menu page (from QR link)
2. Find an item with "Half" price
3. Click "Half" button
4. Enter customer details
5. Create half order
6. Open same menu in another tab
7. Join the half order

### Test Real-Time Updates:

1. Open counter dashboard
2. Open menu page in another tab
3. Place an order from menu
4. Watch order appear in counter dashboard in real-time

## Architecture Overview

```
[Customer's Phone]
      ↓ (Scans QR)
[Menu Page] ←WebSocket→ [Backend FastAPI]
      ↑                         ↓
      |                    [MySQL DB]
      |                         ↑
[Counter Dashboard] ←WS→  [Scheduler]
      ↑                    (Expires half-orders)
[Admin Dashboard]
```

## Configuration Options

### Backend (.env):
- `HALF_ORDER_EXPIRY_MINUTES`: Half-order expiry time (default: 30)
- `ACCESS_TOKEN_EXPIRE_MINUTES`: JWT token expiry (default: 1440 = 24h)
- `SECRET_KEY`: JWT secret key (change in production!)
- `CORS_ORIGINS`: Allowed CORS origins

### Frontend (.env):
- `REACT_APP_BACKEND_URL`: Backend API URL (auto-configured for deployment)

## Next Steps

Once the application is running:

1. **Super Admin**: Login and create/manage restaurants
2. **Counter Admin**: Manage menu items, tables, and orders
3. **Customer**: Scan QR codes and place orders
4. **Analytics**: View comprehensive analytics dashboard

## Support

If you encounter issues:

1. Check the logs:
   - Backend: `/var/log/supervisor/backend.err.log`
   - Frontend: `/var/log/supervisor/frontend.err.log`

2. Verify services are running:
   ```bash
   sudo supervisorctl status
   ```

3. Review this documentation and README.md

## Production Deployment Notes

For production deployment:

1. **Security**:
   - Change `SECRET_KEY` to a strong random value
   - Use strong MySQL passwords
   - Configure CORS properly (not `*`)
   - Enable HTTPS/WSS

2. **Performance**:
   - Use production MySQL instance
   - Configure connection pooling
   - Enable caching
   - Use CDN for static assets

3. **Monitoring**:
   - Set up application logging
   - Monitor WebSocket connections
   - Track database performance
   - Set up error alerting

Enjoy using SplitEat! 🍕🍔🍻