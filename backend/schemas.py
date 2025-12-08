from pydantic import BaseModel, Field, validator, ConfigDict
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

    model_config = ConfigDict(from_attributes=True)
    # Deprecated Config class

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

    model_config = ConfigDict(from_attributes=True)
    # Deprecated Config class

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

    model_config = ConfigDict(from_attributes=True)
    # Deprecated Config class

# Menu Item Schemas
class MenuItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    item_type: MenuItemType = MenuItemType.VEG
    price: float
    half_price: Optional[float] = None
    available: bool = True

class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    item_type: Optional[MenuItemType] = None
    price: Optional[float] = None
    half_price: Optional[float] = None
    available: Optional[bool] = None

class MenuItemResponse(BaseModel):
    id: int
    restaurant_id: int
    name: str
    description: Optional[str]
    category: Optional[str]
    item_type: MenuItemType
    price: float
    half_price: Optional[float]
    available: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
    # Deprecated Config class

# Half Order Session Schemas
class HalfOrderCreate(BaseModel):
    customer_name: str
    customer_mobile: Optional[str] = None
    menu_item_id: int

    @validator('customer_mobile')
    def validate_mobile(cls, v):
        if v in (None, "", " "):
            return None
        if not re.match(r'^\d{10}$', v):
            raise ValueError("Mobile number must be 10 digits")
        return v

class HalfOrderJoin(BaseModel):
    customer_name: str
    customer_mobile: Optional[str] = None
    table_no: str

    @validator('customer_mobile')
    def validate_mobile(cls, v):
        if v in (None, "", " "):
            return None
        if not re.match(r'^\d{10}$', v):
            raise ValueError("Mobile number must be 10 digits")
        return v

class HalfOrderResponse(BaseModel):
    id: int
    restaurant_id: int
    table_no: str
    customer_name: str
    customer_mobile: Optional[str] = None
    menu_item_id: int
    menu_item_name: str
    status: HalfOrderStatus
    created_at: datetime
    expires_at: datetime
    joined_by_table_no: Optional[str]
    joined_by_customer_name: Optional[str]
    joined_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)
    # Deprecated Config class

# Order Schemas
class OrderItem(BaseModel):
    menu_item_id: int
    name: str
    quantity: int
    price: float

class OrderCreate(BaseModel):
    restaurant_id: int
    table_no: str
    customer_name: str
    phone: Optional[str] = None
    items: List[OrderItem]
    paired_order_ids: Optional[List[int]] = None
    idempotency_key: Optional[str] = None

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

    model_config = ConfigDict(from_attributes=True)
    # Deprecated Config class

# Analytics Schemas
class AnalyticsFilter(BaseModel):
    restaurant_id: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None

# Audit Log Schemas
class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int]
    username: Optional[str]
    action: AuditAction
    resource_type: Optional[str]
    resource_id: Optional[int]
    details: Optional[str]
    ip_address: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
    # Deprecated Config class

# Override Login Schema
class OverrideLoginRequest(BaseModel):
    override_key: str
    target_username: str

# Error Log Response
class ErrorLogResponse(BaseModel):
    id: int
    error_type: Optional[str]
    error_message: Optional[str]
    endpoint: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
    # Deprecated Config class
