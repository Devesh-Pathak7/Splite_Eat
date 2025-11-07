from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
from models import UserRole, OrderStatus, HalfOrderStatus, RestaurantType, MenuItemType, AuditAction
import re

# User Schemas
class UserCreate(BaseModel):
    username: str
    password: str
    role: UserRole
    restaurant_id: Optional[int] = None

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    role: UserRole
    restaurant_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

# Restaurant Schemas
class RestaurantCreate(BaseModel):
    name: str
    location: Optional[str] = None
    contact: Optional[str] = None
    type: RestaurantType = RestaurantType.MIXED

class RestaurantUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    contact: Optional[str] = None
    type: Optional[RestaurantType] = None

class RestaurantResponse(BaseModel):
    id: int
    name: str
    location: Optional[str]
    contact: Optional[str]
    type: RestaurantType
    created_at: datetime

    class Config:
        from_attributes = True

# Table Schemas
class TableCreate(BaseModel):
    table_no: str
    capacity: int = 4

class TableResponse(BaseModel):
    id: int
    restaurant_id: int
    table_no: str
    qr_code: str
    capacity: int
    is_occupied: bool
    created_at: datetime

    class Config:
        from_attributes = True

# Menu Item Schemas
class MenuItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    price: float
    half_price: Optional[float] = None
    available: bool = True

class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    half_price: Optional[float] = None
    available: Optional[bool] = None

class MenuItemResponse(BaseModel):
    id: int
    restaurant_id: int
    name: str
    description: Optional[str]
    category: Optional[str]
    price: float
    half_price: Optional[float]
    available: bool
    created_at: datetime

    class Config:
        from_attributes = True

# Half Order Session Schemas
class HalfOrderCreate(BaseModel):
    customer_name: str
    customer_mobile: str
    menu_item_id: int

class HalfOrderJoin(BaseModel):
    customer_name: str
    customer_mobile: str

class HalfOrderResponse(BaseModel):
    id: int
    restaurant_id: int
    table_no: str
    customer_name: str
    customer_mobile: str
    menu_item_id: int
    menu_item_name: str
    status: HalfOrderStatus
    created_at: datetime
    expires_at: datetime

    class Config:
        from_attributes = True

# Order Schemas
class OrderItem(BaseModel):
    menu_item_id: int
    name: str
    quantity: int
    price: float

class OrderCreate(BaseModel):
    customer_name: str
    phone: str
    items: List[OrderItem]

class OrderUpdateStatus(BaseModel):
    status: OrderStatus

class OrderResponse(BaseModel):
    id: int
    restaurant_id: int
    table_no: str
    customer_name: str
    phone: Optional[str]
    items: str
    total_amount: float
    status: OrderStatus
    created_at: datetime

    class Config:
        from_attributes = True

# Analytics Schemas
class AnalyticsFilter(BaseModel):
    restaurant_id: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None