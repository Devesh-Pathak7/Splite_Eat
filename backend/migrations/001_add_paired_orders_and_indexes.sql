-- SplitEat Database Migration 001
-- Adds paired_orders table, audit_log, and necessary indexes
-- Run this in MySQL Workbench on spliteat_db

USE spliteat_db;

-- ============================================
-- 1. ADD MISSING COLUMNS TO half_order_sessions
-- ============================================

ALTER TABLE half_order_sessions
  MODIFY COLUMN created_at DATETIME(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6)),
  MODIFY COLUMN expires_at DATETIME(6) NOT NULL;

-- Add joined columns if not exist
ALTER TABLE half_order_sessions
  ADD COLUMN IF NOT EXISTS menu_item_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS joined_by_table_no VARCHAR(20),
  ADD COLUMN IF NOT EXISTS joined_by_customer_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS joined_at DATETIME(6) NULL;

-- ============================================
-- 2. CREATE paired_orders TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS paired_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  half_session_a INT NOT NULL,
  half_session_b INT NOT NULL,
  restaurant_id INT NOT NULL,
  menu_item_id INT NOT NULL,
  menu_item_name VARCHAR(120) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  created_at DATETIME(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6)),
  completed_at DATETIME(6) NULL,
  order_id INT NULL,
  UNIQUE KEY uq_sessions (half_session_a, half_session_b),
  KEY idx_status (status),
  KEY idx_restaurant (restaurant_id),
  KEY idx_order (order_id),
  FOREIGN KEY (half_session_a) REFERENCES half_order_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (half_session_b) REFERENCES half_order_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 3. CREATE audit_log TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  username VARCHAR(100),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(100),
  meta JSON,
  ip_address VARCHAR(50),
  created_at DATETIME(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6)),
  KEY idx_user (user_id),
  KEY idx_action (action),
  KEY idx_resource (resource_type, resource_id),
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 4. ADD PERFORMANCE INDEXES
-- ============================================

-- Half order sessions indexes
ALTER TABLE half_order_sessions 
  ADD INDEX IF NOT EXISTS idx_status_expires (status, expires_at),
  ADD INDEX IF NOT EXISTS idx_restaurant (restaurant_id),
  ADD INDEX IF NOT EXISTS idx_table_restaurant (restaurant_id, table_no, status);

-- Menu items indexes
ALTER TABLE menu_items 
  ADD INDEX IF NOT EXISTS idx_rest_menu (restaurant_id, available);

-- Orders indexes
ALTER TABLE orders
  ADD INDEX IF NOT EXISTS idx_restaurant_status (restaurant_id, status, created_at),
  ADD INDEX IF NOT EXISTS idx_created (created_at);

-- ============================================
-- 5. ADD ORDER STATUS TRACKING COLUMNS
-- ============================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS sent_to_kitchen_at DATETIME(6) NULL,
  ADD COLUMN IF NOT EXISTS sent_to_kitchen_by INT NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at DATETIME(6) NULL,
  ADD COLUMN IF NOT EXISTS cancelled_by INT NULL,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT NULL;

-- ============================================
-- 6. UPDATE DATETIME COLUMNS TO UTC
-- ============================================

ALTER TABLE users
  MODIFY COLUMN created_at DATETIME(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6));

ALTER TABLE restaurants
  MODIFY COLUMN created_at DATETIME(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6));

ALTER TABLE tables
  MODIFY COLUMN created_at DATETIME(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6));

ALTER TABLE menu_items
  MODIFY COLUMN created_at DATETIME(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6));

ALTER TABLE orders
  MODIFY COLUMN created_at DATETIME(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6));

-- ============================================
-- 7. VERIFY MIGRATION
-- ============================================

SELECT 'Migration 001 completed successfully' AS status;
SHOW TABLES;
DESCRIBE half_order_sessions;
DESCRIBE paired_orders;
DESCRIBE audit_log;