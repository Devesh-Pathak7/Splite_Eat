#!/usr/bin/env python3
"""
Quick Database Connection Test
"""

import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine
from database import DATABASE_URL
import os

async def test_connection():
    print("\n" + "="*60)
    print("🔍 Testing MySQL Connection")
    print("="*60 + "\n")
    
    print("📊 Configuration:")
    print(f"   Host: {os.getenv('MYSQL_HOST', 'localhost')}")
    print(f"   Port: {os.getenv('MYSQL_PORT', '3306')}")
    print(f"   User: {os.getenv('MYSQL_USER', 'root')}")
    print(f"   Database: {os.getenv('MYSQL_DATABASE', 'spliteat_db')}")
    print(f"   Password: {'*' * len(os.getenv('MYSQL_PASSWORD', ''))}")
    
    try:
        print("\n🔗 Connecting to MySQL...")
        engine = create_async_engine(DATABASE_URL)
        
        async with engine.connect() as conn:
            result = await conn.execute(
                text("SELECT VERSION(), DATABASE(), USER()")
            )
            row = result.fetchone()
            
            print("✅ Connection successful!\n")
            print("📊 MySQL Information:")
            print(f"   Version: {row[0]}")
            print(f"   Database: {row[1]}")
            print(f"   User: {row[2]}")
            
            # Check if tables exist
            result = await conn.execute(
                text("SHOW TABLES")
            )
            tables = result.fetchall()
            
            if tables:
                print(f"\n📋 Tables found: {len(tables)}")
                for table in tables:
                    print(f"   • {table[0]}")
            else:
                print("\n⚠️  No tables found. Run 'python init_db.py' to create tables.")
        
        await engine.dispose()
        
        print("\n" + "="*60)
        print("✅ DATABASE CONNECTION TEST PASSED!")
        print("="*60 + "\n")
        return True
        
    except Exception as e:
        print("\n" + "="*60)
        print("❌ DATABASE CONNECTION FAILED")
        print("="*60)
        print(f"\nError: {str(e)}\n")
        print("🔧 Troubleshooting Steps:")
        print("1. Check if MySQL is running:")
        print("   sudo service mysql status")
        print("\n2. Verify credentials in /app/backend/.env")
        print("\n3. Test MySQL connection:")
        print(f"   mysql -u {os.getenv('MYSQL_USER', 'root')} -p")
        print("\n4. Ensure database exists:")
        print("   CREATE DATABASE spliteat_db;")
        print("\n5. Check MySQL error logs")
        print("\n")
        return False

from sqlalchemy import text

if __name__ == "__main__":
    success = asyncio.run(test_connection())
    sys.exit(0 if success else 1)