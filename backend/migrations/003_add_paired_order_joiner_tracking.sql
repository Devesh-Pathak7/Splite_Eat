-- Migration: Add joiner tracking to paired_orders table
-- Purpose: Track which table/customer joined a half-order session
-- Date: 2025-11-09

USE spliteat_db;

-- Add joiner tracking columns
ALTER TABLE paired_orders 
ADD COLUMN IF NOT EXISTS joiner_table_no VARCHAR(20),
ADD COLUMN IF NOT EXISTS joiner_customer_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS joiner_customer_mobile VARCHAR(15);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_paired_orders_joiner_table 
ON paired_orders(joiner_table_no);

-- Add index for session lookup with joiner
CREATE INDEX IF NOT EXISTS idx_paired_orders_session_joiner 
ON paired_orders(half_session_a, joiner_table_no);

-- Add comment
ALTER TABLE paired_orders 
COMMENT = 'Tracks paired half-orders with joiner information for concurrency control';

SELECT 'Migration 003 completed successfully' AS status;
