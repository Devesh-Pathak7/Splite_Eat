#!/usr/bin/env python3
"""
Database Seeding Script for SplitEat
Populates the database with sample data
"""

import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from database import DATABASE_URL
from models import *
from auth import get_password_hash
from datetime import datetime, timedelta, timezone
import uuid

async def seed_database():
    """Seed database with initial data"""
    print("🌱 Seeding SplitEat Database...\n")
    
    try:
        # Create engine and session
        engine = create_async_engine(DATABASE_URL)
        async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        
        async with async_session() as session:
            print("👤 Creating Super Admin...")
            # Create super admin
            super_admin = User(
                username="admin",
                password=get_password_hash("admin123"),
                role=UserRole.SUPER_ADMIN,
                restaurant_id=None
            )
            session.add(super_admin)
            await session.commit()
            print("   ✅ Super Admin created (username: admin, password: admin123)")
            
            print("\n🏢 Creating Restaurants...")
            # Create restaurants
            restaurants_data = [
                {"name": "The Orange Bistro", "location": "123 Main Street, Downtown", "contact": "+91-9876543210", "type": RestaurantType.MIXED},
                {"name": "Sunset Bar & Grill", "location": "456 Beach Avenue, Seaside", "contact": "+91-9876543211", "type": RestaurantType.MIXED},
                {"name": "Green Leaf Veg Restaurant", "location": "789 Hill Road, Uptown", "contact": "+91-9876543212", "type": RestaurantType.VEG},
            ]
            
            restaurants = []
            for i, rest_data in enumerate(restaurants_data, 1):
                restaurant = Restaurant(**rest_data)
                session.add(restaurant)
                await session.flush()
                restaurants.append(restaurant)
                print(f"   ✅ Restaurant {i}: {rest_data['name']} (ID: {restaurant.id})")
            
            await session.commit()
            
            print("\n👨‍🍳 Creating Counter Admins...")
            # Create counter admins for each restaurant
            for i, restaurant in enumerate(restaurants, 1):
                counter_admin = User(
                    username=f"counter{i}",
                    password=get_password_hash("admin123"),
                    role=UserRole.COUNTER_ADMIN,
                    restaurant_id=restaurant.id
                )
                session.add(counter_admin)
                print(f"   ✅ Counter Admin {i}: counter{i} (Restaurant: {restaurant.name})")
            
            await session.commit()
            
            print("\n🍽️  Creating Tables with QR Codes...")
            # Create tables for each restaurant
            total_tables = 0
            for restaurant in restaurants:
                num_tables = 5 if restaurant.id == 1 else 4 if restaurant.id == 2 else 3
                for table_num in range(1, num_tables + 1):
                    table = Table(
                        restaurant_id=restaurant.id,
                        table_no=str(table_num),
                        qr_code=str(uuid.uuid4()),
                        capacity=4 if table_num <= 3 else 6
                    )
                    session.add(table)
                    total_tables += 1
                print(f"   ✅ {num_tables} tables created for {restaurant.name}")
            
            await session.commit()
            print(f"   📊 Total tables created: {total_tables}")
            
            print("\n🍕 Creating Menu Items...")
            # Create menu items for Restaurant 1 (Mixed)
            menu_items_r1 = [
                {"name": "Margherita Pizza", "description": "Classic Italian pizza with mozzarella", "category": "Main Course", "item_type": MenuItemType.VEG, "price": 449.00, "half_price": 249.00},
                {"name": "Grilled Chicken", "description": "Tender grilled chicken with herbs", "category": "Main Course", "item_type": MenuItemType.NON_VEG, "price": 599.00, "half_price": 349.00},
                {"name": "Caesar Salad", "description": "Fresh romaine with Caesar dressing", "category": "Appetizer", "item_type": MenuItemType.VEG, "price": 299.00, "half_price": None},
                {"name": "Paneer Tikka", "description": "Spicy cottage cheese tikka", "category": "Appetizer", "item_type": MenuItemType.VEG, "price": 349.00, "half_price": 199.00},
                {"name": "Butter Chicken", "description": "Rich and creamy butter chicken", "category": "Main Course", "item_type": MenuItemType.NON_VEG, "price": 499.00, "half_price": 289.00},
            ]
            
            for item_data in menu_items_r1:
                item = MenuItem(restaurant_id=restaurants[0].id, **item_data)
                session.add(item)
            
            print(f"   ✅ {len(menu_items_r1)} menu items for {restaurants[0].name}")
            
            # Create menu items for Restaurant 2 (Mixed)
            menu_items_r2 = [
                {"name": "BBQ Ribs", "description": "Smoky BBQ ribs", "category": "Main Course", "item_type": MenuItemType.NON_VEG, "price": 699.00, "half_price": 399.00},
                {"name": "Veggie Burger", "description": "Healthy veggie patty burger", "category": "Main Course", "item_type": MenuItemType.VEG, "price": 299.00, "half_price": None},
                {"name": "Fish Tacos", "description": "Fresh fish tacos with salsa", "category": "Main Course", "item_type": MenuItemType.NON_VEG, "price": 449.00, "half_price": 259.00},
            ]
            
            for item_data in menu_items_r2:
                item = MenuItem(restaurant_id=restaurants[1].id, **item_data)
                session.add(item)
            
            print(f"   ✅ {len(menu_items_r2)} menu items for {restaurants[1].name}")
            
            # Create menu items for Restaurant 3 (Pure Veg)
            menu_items_r3 = [
                {"name": "Palak Paneer", "description": "Spinach and cottage cheese curry", "category": "Main Course", "item_type": MenuItemType.VEG, "price": 349.00, "half_price": 199.00},
                {"name": "Veg Biryani", "description": "Aromatic vegetable biryani", "category": "Main Course", "item_type": MenuItemType.VEG, "price": 399.00, "half_price": 229.00},
                {"name": "Dal Makhani", "description": "Creamy black lentils", "category": "Main Course", "item_type": MenuItemType.VEG, "price": 299.00, "half_price": None},
            ]
            
            for item_data in menu_items_r3:
                item = MenuItem(restaurant_id=restaurants[2].id, **item_data)
                session.add(item)
            
            print(f"   ✅ {len(menu_items_r3)} menu items for {restaurants[2].name}")
            
            await session.commit()
            
            print("\n📦 Creating Sample Orders...")
            # Create a few sample orders
            sample_order = Order(
                restaurant_id=restaurants[0].id,
                table_no="1",
                customer_name="John Doe",
                phone="9876543210",
                items='[{"menu_item_id": 1, "name": "Margherita Pizza", "quantity": 1, "price": 449.00}]',
                total_amount=449.00,
                status="PENDING"
            )
            session.add(sample_order)
            await session.commit()
            print("   ✅ Sample order created")
        
        await engine.dispose()
        
        print("\n" + "="*60)
        print("✅ DATABASE SEEDING COMPLETE!")
        print("="*60)
        print("\n📝 Login Credentials:")
        print("\n🔑 Super Admin:")
        print("   Username: admin")
        print("   Password: admin123")
        print("\n🔑 Counter Admins:")
        print("   Username: counter1, counter2, counter3")
        print("   Password: admin123 (for all)")
        print("\n🎯 What's Created:")
        print("   • 3 Restaurants (Mixed, Mixed, Pure Veg)")
        print("   • 12 Tables with QR codes")
        print("   • 11 Menu items across restaurants")
        print("   • 1 Sample order")
        print("\n🚀 Next Step: Restart backend and login!")
        print("   sudo supervisorctl restart backend\n")
        
    except Exception as e:
        print(f"\n❌ Error seeding database: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    print("\n" + "="*60)
    print("🌱 SplitEat Database Seeding")
    print("="*60 + "\n")
    asyncio.run(seed_database())