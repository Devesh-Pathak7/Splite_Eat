from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Enum, ForeignKey, Text, JSON, BigInteger
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base
import enum
import pytz

# IST Timezone
IST = pytz.timezone('Asia/Kolkata')

# Timezone-aware UTC datetime helper
def utc_now():
    """Get current UTC time with timezone info"""
    return datetime.now(timezone.utc)

def ist_now():
    """Get current IST time"""
    return datetime.now(IST)

class UserRole(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    COUNTER_ADMIN = "counter_admin"
    CUSTOMER = "customer"

class OrderStatus(str, enum.Enum):
    PENDING = "PENDING"
    PREPARING = "PREPARING"
    READY = "READY"
    SERVED = "SERVED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class HalfOrderStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    JOINED = "JOINED"
    EXPIRED = "EXPIRED"
    COMPLETED = "COMPLETED"

class RestaurantType(str, enum.Enum):
    VEG = "veg"
    NON_VEG = "non_veg"
    MIXED = "mixed"

class MenuItemType(str, enum.Enum):
    VEG = "veg"
    NON_VEG = "non_veg"

class AuditAction(str, enum.Enum):
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    OVERRIDE_LOGIN = "OVERRIDE_LOGIN"
    CANCEL = "CANCEL"
    REOPEN = "REOPEN"
    SEND_TO_KITCHEN = "SEND_TO_KITCHEN"
    JOIN_SESSION = "JOIN_SESSION"
    EXPIRE_SESSION = "EXPIRE_SESSION"

class TableStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    OCCUPIED = "OCCUPIED"
    RESERVED = "RESERVED"

class PairedOrderStatus(str, enum.Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.CUSTOMER)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    
    restaurant = relationship("Restaurant", back_populates="users")

class Restaurant(Base):
    __tablename__ = "restaurants"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    location = Column(String(300))
    contact = Column(String(50))
    type = Column(Enum(RestaurantType), default=RestaurantType.MIXED, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    
    users = relationship("User", back_populates="restaurant", cascade="all, delete-orphan")
    tables = relationship("Table", back_populates="restaurant", cascade="all, delete-orphan")
    menu_items = relationship("MenuItem", back_populates="restaurant", cascade="all, delete-orphan")
    half_order_sessions = relationship("HalfOrderSession", back_populates="restaurant", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="restaurant", cascade="all, delete-orphan")

class Table(Base):
    __tablename__ = "tables"
    
    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    table_no = Column(String(50), nullable=False)
    qr_code = Column(String(255), unique=True, nullable=False)
    capacity = Column(Integer, default=4)
    is_occupied = Column(Boolean, default=False)
    status = Column(Enum(TableStatus), default=TableStatus.AVAILABLE, nullable=False)
    occupied_since = Column(DateTime(timezone=True), nullable=True)
    last_updated = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    
    restaurant = relationship("Restaurant", back_populates="tables")

class MenuItem(Base):
    __tablename__ = "menu_items"
    
    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    category = Column(String(100))
    item_type = Column(Enum(MenuItemType), default=MenuItemType.VEG, nullable=False)
    price = Column(Float, nullable=False)
    half_price = Column(Float, nullable=True)
    available = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    
    restaurant = relationship("Restaurant", back_populates="menu_items")

class HalfOrderSession(Base):
    __tablename__ = "half_order_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    table_no = Column(String(50), nullable=False)
    customer_name = Column(String(100), nullable=False)
    customer_mobile = Column(String(20), nullable=False)
    menu_item_id = Column(Integer, nullable=False)
    menu_item_name = Column(String(200), nullable=False)
    status = Column(Enum(HalfOrderStatus), default=HalfOrderStatus.ACTIVE)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    joined_by_table_no = Column(String(50), nullable=True)
    joined_by_customer_name = Column(String(100), nullable=True)
    joined_at = Column(DateTime(timezone=True), nullable=True)
    
    restaurant = relationship("Restaurant", back_populates="half_order_sessions")

class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    table_no = Column(String(50), nullable=False)
    customer_name = Column(String(100), nullable=False)
    phone = Column(String(20))
    items = Column(Text)  # JSON string of items
    total_amount = Column(Float, nullable=False)
    status = Column(Enum(OrderStatus), default=OrderStatus.PENDING)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    sent_to_kitchen_at = Column(DateTime(timezone=True), nullable=True)
    sent_to_kitchen_by = Column(Integer, nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_by = Column(Integer, nullable=True)
    cancel_reason = Column(Text, nullable=True)
    
    restaurant = relationship("Restaurant", back_populates="orders")

class PairedOrder(Base):
    __tablename__ = "paired_orders"
    
    id = Column(Integer, primary_key=True, index=True)
    half_session_a = Column(Integer, ForeignKey("half_order_sessions.id", ondelete="CASCADE"), nullable=False)
    half_session_b = Column(Integer, ForeignKey("half_order_sessions.id", ondelete="CASCADE"), nullable=False)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    menu_item_id = Column(Integer, nullable=False)
    menu_item_name = Column(String(120), nullable=False)
    total_price = Column(Float, nullable=False)
    status = Column(Enum(PairedOrderStatus), default=PairedOrderStatus.PENDING, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    order_id = Column(Integer, nullable=True)

class AuditLog(Base):
    __tablename__ = "audit_log"
    
    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    username = Column(String(100))
    action = Column(String(100), nullable=False)
    resource_type = Column(String(50), nullable=False)
    resource_id = Column(String(100))
    meta = Column(JSON)
    ip_address = Column(String(50))
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

class ErrorLog(Base):
    __tablename__ = "error_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    error_type = Column(String(100))
    error_message = Column(Text)
    stack_trace = Column(Text)
    endpoint = Column(String(200))
    user_id = Column(Integer, nullable=True)
    request_data = Column(Text)
    created_at = Column(DateTime(timezone=True), default=utc_now)