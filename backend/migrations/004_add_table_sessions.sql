-- Migration: Add table sessions feature
-- Description: Adds table_order_sessions table and session_id to orders

-- Add half_order_join_fee to restaurants table
ALTER TABLE restaurants 
ADD COLUMN half_order_join_fee FLOAT NOT NULL DEFAULT 20.0;

-- Add session_id to orders table
ALTER TABLE orders 
ADD COLUMN session_id VARCHAR(100) NULL,
ADD INDEX idx_orders_session_id (session_id);

-- Create table_order_sessions table
CREATE TABLE IF NOT EXISTS table_order_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    restaurant_id INT NOT NULL,
    table_no VARCHAR(50) NOT NULL,
    session_id VARCHAR(100) UNIQUE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME NULL,
    total_orders_count INT NOT NULL DEFAULT 0,
    total_amount FLOAT NOT NULL DEFAULT 0.0,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    INDEX idx_table_sessions_restaurant_id (restaurant_id),
    INDEX idx_table_sessions_table_no (table_no),
    INDEX idx_table_sessions_session_id (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
