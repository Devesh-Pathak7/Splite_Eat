-- Migration: Add table order sessions and join fee support
-- Date: 2025-11-09

USE spliteat_db;

-- Create table_order_sessions table
CREATE TABLE IF NOT EXISTS table_order_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    restaurant_id INT NOT NULL,
    table_no VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    INDEX idx_table_sessions_restaurant (restaurant_id),
    INDEX idx_table_sessions_table (restaurant_id, table_no, is_active),
    INDEX idx_table_sessions_status (status, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add session_id to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS session_id INT,
ADD CONSTRAINT fk_orders_session 
    FOREIGN KEY (session_id) REFERENCES table_order_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_session_id ON orders(session_id);

-- Add join_fee to paired_orders table
ALTER TABLE paired_orders 
ADD COLUMN IF NOT EXISTS join_fee DECIMAL(10,2) DEFAULT 0.00;

SELECT 'Migration 004 completed successfully' AS status;
