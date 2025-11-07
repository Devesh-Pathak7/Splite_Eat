#!/usr/bin/env python3
"""
Database Initialization Script for SplitEat
Run this script to create all tables and seed initial data
"""

import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine
from database import Base, DATABASE_URL
from models import *
from auth import get_password_hash
import os

async def init_database():
    """Initialize database tables"""
    print("🔧 Initializing SplitEat Database...")
    print(f"📊 Database URL: {DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else DATABASE_URL}")
    
    try:
        # Create engine
        engine = create_async_engine(DATABASE_URL, echo=True)
        
        # Create all tables
        print("\n📋 Creating database tables...")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
        
        print("✅ Database tables created successfully!")
        
        # Close engine
        await engine.dispose()
        
        print("\n" + "="*60)
        print("✅ DATABASE INITIALIZATION COMPLETE!")
        print("="*60)
        print("\n📝 Next Steps:")
        print("1. Run seed data script: python seed_db.py")
        print("2. Or create super admin manually via API")
        print("3. Restart backend: sudo supervisorctl restart backend")
        print("\n")
        
    except Exception as e:
        print(f"\n❌ Error initializing database: {str(e)}")
        print("\n🔍 Troubleshooting:")
        print("1. Ensure MySQL is running")
        print("2. Check database credentials in .env file")
        print("3. Verify database 'spliteat_db' exists")
        print("4. Test connection: mysql -u root -p")
        sys.exit(1)

if __name__ == "__main__":
    print("\n" + "="*60)
    print("🚀 SplitEat Database Initialization")
    print("="*60 + "\n")
    asyncio.run(init_database())