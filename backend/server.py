from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func, and_, or_
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional
import json
import os
import logging
import uuid
import qrcode
import io
import base64
from dotenv import load_dotenv

# Import models and utilities
from database import get_db, engine, Base
from models import User, Restaurant, Table, MenuItem, HalfOrderSession, Order, UserRole, OrderStatus, HalfOrderStatus
from schemas import *
from auth import get_password_hash, verify_password, create_access_token, get_current_user, require_role
from scheduler import start_scheduler, shutdown_scheduler

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(title="SplitEat API")
api_router = APIRouter(prefix="/api")

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}  # restaurant_id -> [websockets]
    
    async def connect(self, websocket: WebSocket, restaurant_id: int):
        await websocket.accept()
        if restaurant_id not in self.active_connections:
            self.active_connections[restaurant_id] = []
        self.active_connections[restaurant_id].append(websocket)
        logger.info(f"Client connected to restaurant {restaurant_id}. Total connections: {len(self.active_connections.get(restaurant_id, []))}")
    
    def disconnect(self, websocket: WebSocket, restaurant_id: int):
        if restaurant_id in self.active_connections:
            self.active_connections[restaurant_id].remove(websocket)
            if not self.active_connections[restaurant_id]:
                del self.active_connections[restaurant_id]
        logger.info(f"Client disconnected from restaurant {restaurant_id}")
    
    async def broadcast(self, message: dict, restaurant_id: int):
        if restaurant_id in self.active_connections:
            dead_connections = []
            for connection in self.active_connections[restaurant_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Error sending message: {e}")
                    dead_connections.append(connection)
            
            # Remove dead connections
            for conn in dead_connections:
                self.disconnect(conn, restaurant_id)

manager = ConnectionManager()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv('CORS_ORIGINS', '*').split(','),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============ AUTH ROUTES ============
@api_router.post("/auth/register", response_model=UserResponse)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    # Check if username exists
    result = await db.execute(select(User).where(User.username == user_data.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # Create user
    hashed_password = get_password_hash(user_data.password)
    user = User(
        username=user_data.username,
        password=hashed_password,
        role=user_data.role,
        restaurant_id=user_data.restaurant_id
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == credentials.username))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(credentials.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    access_token = create_access_token(data={"sub": user.username})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# ============ RESTAURANT ROUTES ============
@api_router.post("/restaurants", response_model=RestaurantResponse)
async def create_restaurant(
    restaurant: RestaurantCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    new_restaurant = Restaurant(**restaurant.model_dump())
    db.add(new_restaurant)
    await db.commit()
    await db.refresh(new_restaurant)
    return new_restaurant

@api_router.get("/restaurants", response_model=List[RestaurantResponse])
async def get_restaurants(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Restaurant))
    return result.scalars().all()

@api_router.get("/restaurants/{restaurant_id}", response_model=RestaurantResponse)
async def get_restaurant(restaurant_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Restaurant).where(Restaurant.id == restaurant_id))
    restaurant = result.scalar_one_or_none()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return restaurant

@api_router.put("/restaurants/{restaurant_id}", response_model=RestaurantResponse)
async def update_restaurant(
    restaurant_id: int,
    restaurant_data: RestaurantUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    result = await db.execute(select(Restaurant).where(Restaurant.id == restaurant_id))
    restaurant = result.scalar_one_or_none()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    for key, value in restaurant_data.model_dump(exclude_unset=True).items():
        setattr(restaurant, key, value)
    
    await db.commit()
    await db.refresh(restaurant)
    return restaurant

@api_router.delete("/restaurants/{restaurant_id}")
async def delete_restaurant(
    restaurant_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    result = await db.execute(select(Restaurant).where(Restaurant.id == restaurant_id))
    restaurant = result.scalar_one_or_none()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    await db.delete(restaurant)
    await db.commit()
    return {"message": "Restaurant deleted successfully"}

# ============ TABLE ROUTES ============
@api_router.post("/restaurants/{restaurant_id}/tables", response_model=TableResponse)
async def create_table(
    restaurant_id: int,
    table_data: TableCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.COUNTER_ADMIN]))
):
    # Verify restaurant exists
    result = await db.execute(select(Restaurant).where(Restaurant.id == restaurant_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Generate unique QR code
    qr_code_value = str(uuid.uuid4())
    
    new_table = Table(
        restaurant_id=restaurant_id,
        table_no=table_data.table_no,
        qr_code=qr_code_value,
        capacity=table_data.capacity
    )
    db.add(new_table)
    await db.commit()
    await db.refresh(new_table)
    return new_table

@api_router.get("/restaurants/{restaurant_id}/tables", response_model=List[TableResponse])
async def get_tables(restaurant_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Table).where(Table.restaurant_id == restaurant_id))
    return result.scalars().all()

@api_router.get("/tables/qr/{qr_code}")
async def get_table_by_qr(qr_code: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Table).where(Table.qr_code == qr_code))
    table = result.scalar_one_or_none()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    return {"restaurant_id": table.restaurant_id, "table_no": table.table_no}

@api_router.delete("/tables/{table_id}")
async def delete_table(
    table_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.COUNTER_ADMIN]))
):
    result = await db.execute(select(Table).where(Table.id == table_id))
    table = result.scalar_one_or_none()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    await db.delete(table)
    await db.commit()
    return {"message": "Table deleted successfully"}

# ============ MENU ROUTES ============
@api_router.post("/restaurants/{restaurant_id}/menu", response_model=MenuItemResponse)
async def create_menu_item(
    restaurant_id: int,
    item_data: MenuItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.COUNTER_ADMIN]))
):
    new_item = MenuItem(restaurant_id=restaurant_id, **item_data.model_dump())
    db.add(new_item)
    await db.commit()
    await db.refresh(new_item)
    
    # Broadcast menu update
    await manager.broadcast({
        "type": "menu_update",
        "action": "create",
        "item": {
            "id": new_item.id,
            "name": new_item.name,
            "price": new_item.price,
            "available": new_item.available
        }
    }, restaurant_id)
    
    return new_item

@api_router.get("/restaurants/{restaurant_id}/menu", response_model=List[MenuItemResponse])
async def get_menu_items(restaurant_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MenuItem).where(MenuItem.restaurant_id == restaurant_id))
    return result.scalars().all()

@api_router.put("/menu/{item_id}", response_model=MenuItemResponse)
async def update_menu_item(
    item_id: int,
    item_data: MenuItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.COUNTER_ADMIN]))
):
    result = await db.execute(select(MenuItem).where(MenuItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    for key, value in item_data.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    
    await db.commit()
    await db.refresh(item)
    
    # Broadcast menu update
    await manager.broadcast({
        "type": "menu_update",
        "action": "update",
        "item": {
            "id": item.id,
            "name": item.name,
            "price": item.price,
            "available": item.available
        }
    }, item.restaurant_id)
    
    return item

@api_router.delete("/menu/{item_id}")
async def delete_menu_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.COUNTER_ADMIN]))
):
    result = await db.execute(select(MenuItem).where(MenuItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    restaurant_id = item.restaurant_id
    await db.delete(item)
    await db.commit()
    
    # Broadcast menu update
    await manager.broadcast({
        "type": "menu_update",
        "action": "delete",
        "item_id": item_id
    }, restaurant_id)
    
    return {"message": "Menu item deleted successfully"}

# ============ HALF ORDER ROUTES ============
@api_router.get("/restaurants/{restaurant_id}/tables/{table_no}/half-orders", response_model=List[HalfOrderResponse])
async def get_active_half_orders(restaurant_id: int, table_no: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(HalfOrderSession).where(
            HalfOrderSession.restaurant_id == restaurant_id,
            HalfOrderSession.table_no == table_no,
            HalfOrderSession.status == HalfOrderStatus.ACTIVE
        )
    )
    return result.scalars().all()

@api_router.post("/restaurants/{restaurant_id}/tables/{table_no}/half-orders", response_model=HalfOrderResponse)
async def create_half_order(
    restaurant_id: int,
    table_no: str,
    order_data: HalfOrderCreate,
    db: AsyncSession = Depends(get_db)
):
    # Get menu item
    result = await db.execute(select(MenuItem).where(MenuItem.id == order_data.menu_item_id))
    menu_item = result.scalar_one_or_none()
    if not menu_item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    # Calculate expiry time
    expiry_minutes = int(os.getenv('HALF_ORDER_EXPIRY_MINUTES', '30'))
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=expiry_minutes)
    
    # Create half order session
    half_order = HalfOrderSession(
        restaurant_id=restaurant_id,
        table_no=table_no,
        customer_name=order_data.customer_name,
        customer_mobile=order_data.customer_mobile,
        menu_item_id=order_data.menu_item_id,
        menu_item_name=menu_item.name,
        expires_at=expires_at
    )
    db.add(half_order)
    await db.commit()
    await db.refresh(half_order)
    
    # Broadcast new half order
    await manager.broadcast({
        "type": "half_order_created",
        "half_order": {
            "id": half_order.id,
            "customer_name": half_order.customer_name,
            "menu_item_name": half_order.menu_item_name,
            "expires_at": half_order.expires_at.isoformat()
        }
    }, restaurant_id)
    
    return half_order

@api_router.post("/half-orders/{session_id}/join")
async def join_half_order(
    session_id: int,
    join_data: HalfOrderJoin,
    db: AsyncSession = Depends(get_db)
):
    # Get half order session
    result = await db.execute(select(HalfOrderSession).where(HalfOrderSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Half order session not found")
    
    if session.status != HalfOrderStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Half order session is not active")
    
    if session.expires_at < datetime.now(timezone.utc):
        session.status = HalfOrderStatus.EXPIRED
        await db.commit()
        raise HTTPException(status_code=400, detail="Half order session has expired")
    
    # Get menu item for pricing
    result = await db.execute(select(MenuItem).where(MenuItem.id == session.menu_item_id))
    menu_item = result.scalar_one_or_none()
    
    # Create order from half-order
    total_amount = menu_item.half_price if menu_item.half_price else menu_item.price
    items = json.dumps([{
        "menu_item_id": session.menu_item_id,
        "name": session.menu_item_name,
        "quantity": 1,
        "price": total_amount
    }])
    
    # Create order
    order = Order(
        restaurant_id=session.restaurant_id,
        table_no=session.table_no,
        customer_name=f"{session.customer_name} & {join_data.customer_name}",
        phone=join_data.customer_mobile,
        items=items,
        total_amount=total_amount
    )
    db.add(order)
    
    # Update half order status
    session.status = HalfOrderStatus.JOINED
    await db.commit()
    await db.refresh(order)
    
    # Broadcast half order joined
    await manager.broadcast({
        "type": "half_order_joined",
        "session_id": session_id,
        "order_id": order.id
    }, session.restaurant_id)
    
    return {"message": "Successfully joined half order", "order_id": order.id}

# ============ ORDER ROUTES ============
@api_router.post("/restaurants/{restaurant_id}/tables/{table_no}/orders", response_model=OrderResponse)
async def create_order(
    restaurant_id: int,
    table_no: str,
    order_data: OrderCreate,
    db: AsyncSession = Depends(get_db)
):
    # Calculate total
    total_amount = sum(item.price * item.quantity for item in order_data.items)
    items_json = json.dumps([item.model_dump() for item in order_data.items])
    
    order = Order(
        restaurant_id=restaurant_id,
        table_no=table_no,
        customer_name=order_data.customer_name,
        phone=order_data.phone,
        items=items_json,
        total_amount=total_amount
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    
    # Broadcast new order
    await manager.broadcast({
        "type": "new_order",
        "order": {
            "id": order.id,
            "table_no": order.table_no,
            "customer_name": order.customer_name,
            "total_amount": order.total_amount,
            "status": order.status.value
        }
    }, restaurant_id)
    
    return order

@api_router.get("/restaurants/{restaurant_id}/orders", response_model=List[OrderResponse])
async def get_orders(restaurant_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Order).where(Order.restaurant_id == restaurant_id).order_by(Order.created_at.desc())
    )
    return result.scalars().all()

@api_router.put("/orders/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: int,
    status_data: OrderUpdateStatus,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.COUNTER_ADMIN]))
):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order.status = status_data.status
    await db.commit()
    await db.refresh(order)
    
    # Broadcast order status update
    await manager.broadcast({
        "type": "order_status_update",
        "order": {
            "id": order.id,
            "status": order.status.value
        }
    }, order.restaurant_id)
    
    return order

# ============ ANALYTICS ROUTES ============
@api_router.get("/analytics/overview")
async def get_analytics_overview(
    restaurant_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query_conditions = []
    
    if restaurant_id:
        query_conditions.append(Order.restaurant_id == restaurant_id)
    
    if start_date:
        start = datetime.fromisoformat(start_date)
        query_conditions.append(Order.created_at >= start)
    
    if end_date:
        end = datetime.fromisoformat(end_date)
        query_conditions.append(Order.created_at <= end)
    
    # Total revenue
    revenue_query = select(func.sum(Order.total_amount))
    if query_conditions:
        revenue_query = revenue_query.where(and_(*query_conditions))
    result = await db.execute(revenue_query)
    total_revenue = result.scalar() or 0
    
    # Total orders
    orders_query = select(func.count(Order.id))
    if query_conditions:
        orders_query = orders_query.where(and_(*query_conditions))
    result = await db.execute(orders_query)
    total_orders = result.scalar() or 0
    
    # Active half orders
    half_orders_query = select(func.count(HalfOrderSession.id)).where(HalfOrderSession.status == HalfOrderStatus.ACTIVE)
    if restaurant_id:
        half_orders_query = half_orders_query.where(HalfOrderSession.restaurant_id == restaurant_id)
    result = await db.execute(half_orders_query)
    active_half_orders = result.scalar() or 0
    
    return {
        "total_revenue": float(total_revenue),
        "total_orders": total_orders,
        "active_half_orders": active_half_orders
    }

@api_router.get("/analytics/popular-items")
async def get_popular_items(
    restaurant_id: Optional[int] = None,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Get all orders
    query = select(Order)
    if restaurant_id:
        query = query.where(Order.restaurant_id == restaurant_id)
    
    result = await db.execute(query)
    orders = result.scalars().all()
    
    # Count items
    item_counts = {}
    for order in orders:
        items = json.loads(order.items)
        for item in items:
            item_name = item.get('name')
            if item_name in item_counts:
                item_counts[item_name] += item.get('quantity', 1)
            else:
                item_counts[item_name] = item.get('quantity', 1)
    
    # Sort and limit
    sorted_items = sorted(item_counts.items(), key=lambda x: x[1], reverse=True)[:limit]
    return [{"name": name, "count": count} for name, count in sorted_items]

# ============ WEBSOCKET ============
@app.websocket("/ws/{restaurant_id}")
async def websocket_endpoint(websocket: WebSocket, restaurant_id: int):
    await manager.connect(websocket, restaurant_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo back for ping-pong
            await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(websocket, restaurant_id)

# Include router
app.include_router(api_router)

# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created")
    
    # Start scheduler
    start_scheduler()
    logger.info("Application started")

@app.on_event("shutdown")
async def shutdown_event():
    shutdown_scheduler()
    logger.info("Application shutdown")

@api_router.get("/")
async def root():
    return {"message": "SplitEat API is running"}