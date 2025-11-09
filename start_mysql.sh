#!/bin/bash
# Start MySQL/MariaDB and ensure it's running

echo "🔧 Starting MySQL/MariaDB..."

# Create run directory if it doesn't exist
mkdir -p /run/mysqld
chown mysql:mysql /run/mysqld

# Kill any existing MySQL processes
pkill -9 mariadbd mysqld 2>/dev/null || true
sleep 2

# Start MariaDB in background
nohup mariadbd --user=mysql > /tmp/mariadb.log 2>&1 &

# Wait for MySQL to be ready
echo "⏳ Waiting for MySQL to start..."
for i in {1..30}; do
    if mysql -u root -proot -e "SELECT 1;" > /dev/null 2>&1; then
        echo "✅ MySQL is ready!"
        
        # Create database if it doesn't exist
        mysql -u root -proot -e "CREATE DATABASE IF NOT EXISTS spliteat_db;" 2>/dev/null
        
        # Set root password if not already set
        mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY 'root'; FLUSH PRIVILEGES;" 2>/dev/null || true
        
        echo "✅ Database setup complete"
        exit 0
    fi
    sleep 1
done

echo "❌ MySQL failed to start"
exit 1
