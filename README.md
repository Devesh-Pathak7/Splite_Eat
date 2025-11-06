# SplitEat - Restaurant & Bar Management System

A production-ready full-stack application for restaurant and bar management with a unique **Half-Order Sharing** feature that allows customers to split dishes and reduce food waste.

## Features

### Core Functionality
- **QR Code Table System**: Each table has a unique QR code linking to the restaurant menu
- **Half-Order Sharing**: Customers can create or join half-orders for menu items
- **Real-Time Updates**: WebSocket-powered live synchronization across all users
- **Role-Based Access**: Super Admin, Counter Admin, and Customer roles
- **Analytics Dashboard**: Comprehensive insights with interactive charts
- **Theme Toggle**: Beautiful light/dark mode with glassmorphic UI

### Technology Stack

**Backend:**
- FastAPI (Python)
- MySQL with SQLAlchemy ORM
- JWT Authentication
- Native WebSocket support
- APScheduler for background tasks

**Frontend:**
- React 19
- React Router v7
- Recharts for analytics
- Shadcn UI components
- Tailwind CSS
- Axios for API calls

**Database:**
- MySQL 8.0+

## Prerequisites

Before running the application, ensure you have:

- **Python 3.11+**
- **Node.js 18+** and **Yarn**
- **MySQL 8.0+**

## Installation & Setup

### 1. Database Setup

```bash
# Start MySQL and create database
mysql -u root -p

CREATE DATABASE spliteat_db;
EXIT;
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd /app/backend

# Update .env with your MySQL credentials
# Edit /app/backend/.env:
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=spliteat_db

# Install Python dependencies (already installed)
# pip install -r requirements.txt

# The database tables will be created automatically on first run
# Optionally, seed sample data:
mysql -u root -p spliteat_db < /app/seed_data.sql
```

### 3. Frontend Setup

```bash
# Navigate to frontend directory
cd /app/frontend

# Dependencies are already installed
# yarn install (already done)
```

### 4. Running the Application

**Backend (Terminal 1):**
```bash
cd /app/backend
# Backend runs via supervisor - check status:
sudo supervisorctl status backend

# Or restart:
sudo supervisorctl restart backend

# View logs:
tail -f /var/log/supervisor/backend.out.log
```

**Frontend (Terminal 2):**
```bash
cd /app/frontend
# Frontend runs via supervisor - check status:
sudo supervisorctl status frontend

# Or restart:
sudo supervisorctl restart frontend

# View logs:
tail -f /var/log/supervisor/frontend.out.log
```

## Default Credentials

After running seed data:

**Super Admin:**
- Username: `admin`
- Password: `admin123`

**Counter Admin (Restaurant 1):**
- Username: `counter1`
- Password: `admin123`

**Counter Admin (Restaurant 2):**
- Username: `counter2`
- Password: `admin123`

## Application URLs

- **Frontend**: `http://localhost:3000` (or your configured URL)
- **Backend API**: `http://localhost:8001/api`
- **API Docs**: `http://localhost:8001/docs`

## User Flows

### Customer Flow
1. Scan QR code from restaurant table
2. View menu with real-time availability
3. Create a half-order or join existing ones
4. Add items to cart and place order
5. Track order status in real-time

### Counter Admin Flow
1. Login to counter dashboard
2. View and manage active orders
3. Update order status (Pending → Preparing → Ready → Served → Completed)
4. Manage menu items (add, edit, delete, toggle availability)
5. Manage tables and generate QR codes
6. Monitor half-orders

### Super Admin Flow
1. Login to admin dashboard
2. Manage restaurants (add, edit, delete)
3. Assign counter admins to restaurants
4. View comprehensive analytics
5. Filter data by restaurant, date range, etc.
6. Monitor system-wide metrics

## Configuration

### Half-Order Expiry Time

Default: 30 minutes (configurable in `/app/backend/.env`):

```bash
HALF_ORDER_EXPIRY_MINUTES=30
```

### WebSocket Configuration

WebSocket connections are established per restaurant for efficient real-time updates.

## Database Schema

- **users**: User accounts with role-based access
- **restaurants**: Restaurant information
- **tables**: Restaurant tables with QR codes
- **menu_items**: Menu items with pricing and availability
- **half_order_sessions**: Active half-order sessions
- **orders**: Customer orders with status tracking

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Restaurants
- `GET /api/restaurants` - List all restaurants
- `POST /api/restaurants` - Create restaurant (Super Admin)
- `PUT /api/restaurants/{id}` - Update restaurant
- `DELETE /api/restaurants/{id}` - Delete restaurant

### Menu
- `GET /api/restaurants/{id}/menu` - Get menu items
- `POST /api/restaurants/{id}/menu` - Add menu item
- `PUT /api/menu/{id}` - Update menu item
- `DELETE /api/menu/{id}` - Delete menu item

### Orders
- `GET /api/restaurants/{id}/orders` - Get all orders
- `POST /api/restaurants/{id}/tables/{table}/orders` - Create order
- `PUT /api/orders/{id}/status` - Update order status

### Half Orders
- `GET /api/restaurants/{id}/tables/{table}/half-orders` - Get active half orders
- `POST /api/restaurants/{id}/tables/{table}/half-orders` - Create half order
- `POST /api/half-orders/{id}/join` - Join half order

### Analytics
- `GET /api/analytics/overview` - Get overview metrics
- `GET /api/analytics/popular-items` - Get popular menu items

### WebSocket
- `WS /ws/{restaurant_id}` - Real-time updates for restaurant

## Real-Time Features

The application uses WebSocket for:
- Half-order creation and joining
- Order status updates
- Menu availability changes
- Table occupancy updates

## Background Tasks

APScheduler runs every minute to:
- Check and expire half-orders past their expiry time
- Broadcast expiry events to connected clients

## Troubleshooting

### Backend won't start
```bash
# Check MySQL connection
mysql -u root -p

# Verify .env credentials
cat /app/backend/.env

# Check backend logs
tail -f /var/log/supervisor/backend.err.log
```

### Frontend won't connect to backend
```bash
# Verify REACT_APP_BACKEND_URL in /app/frontend/.env
cat /app/frontend/.env

# Test backend API
curl http://localhost:8001/api/
```

### WebSocket not connecting
- Ensure backend is running
- Check browser console for WebSocket errors
- Verify restaurant_id is correct

## Production Deployment

For production:

1. Update `.env` files with production credentials
2. Set strong `SECRET_KEY` in backend `.env`
3. Configure CORS origins properly
4. Use production-grade MySQL instance
5. Enable HTTPS for WebSocket (WSS)
6. Set up proper logging and monitoring

## License

MIT License

## Support

For issues or questions, please check the application logs or contact the development team.