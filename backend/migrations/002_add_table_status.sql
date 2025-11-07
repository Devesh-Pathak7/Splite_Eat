-- SplitEat Database Migration 002
-- Adds table status tracking and reservation system

USE spliteat_db;

-- ============================================
-- 1. ADD TABLE STATUS COLUMN
-- ============================================

ALTER TABLE tables
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'AVAILABLE',
  ADD COLUMN IF NOT EXISTS occupied_since DATETIME(6) NULL,
  ADD COLUMN IF NOT EXISTS last_updated DATETIME(6) DEFAULT (UTC_TIMESTAMP(6)) ON UPDATE CURRENT_TIMESTAMP(6);

-- ============================================
-- 2. ADD INDEX FOR TABLE STATUS QUERIES
-- ============================================

ALTER TABLE tables
  ADD INDEX IF NOT EXISTS idx_restaurant_status (restaurant_id, status);

-- ============================================
-- 3. UPDATE EXISTING TABLES
-- ============================================

UPDATE tables 
SET status = CASE 
  WHEN is_occupied = 1 THEN 'OCCUPIED'
  ELSE 'AVAILABLE'
END;

SELECT 'Migration 002 completed successfully' AS status;