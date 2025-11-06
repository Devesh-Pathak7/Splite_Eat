-- SplitEat Database Seed Data
-- Run this after creating the database and tables

USE spliteat_db;

-- Insert Sample Super Admin
INSERT INTO users (username, password, role, restaurant_id, created_at) VALUES
('admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYFj.Y8UaEm', 'super_admin', NULL, NOW());
-- Password: admin123

-- Insert Sample Restaurants
INSERT INTO restaurants (name, location, contact, created_at) VALUES
('The Orange Bistro', '123 Main Street, Downtown', '+1-555-0101', NOW()),
('Sunset Bar & Grill', '456 Beach Avenue, Seaside', '+1-555-0102', NOW()),
('Mountain View Restaurant', '789 Hill Road, Uptown', '+1-555-0103', NOW());

-- Insert Counter Admins for each restaurant
INSERT INTO users (username, password, role, restaurant_id, created_at) VALUES
('counter1', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYFj.Y8UaEm', 'counter_admin', 1, NOW()),
('counter2', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYFj.Y8UaEm', 'counter_admin', 2, NOW()),
('counter3', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYFj.Y8UaEm', 'counter_admin', 3, NOW());
-- All counter passwords: admin123

-- Insert Tables for Restaurant 1 (The Orange Bistro)
INSERT INTO tables (restaurant_id, table_no, qr_code, capacity, is_occupied, created_at) VALUES
(1, '1', UUID(), 4, FALSE, NOW()),
(1, '2', UUID(), 4, FALSE, NOW()),
(1, '3', UUID(), 6, FALSE, NOW()),
(1, '4', UUID(), 2, FALSE, NOW()),
(1, '5', UUID(), 8, FALSE, NOW());

-- Insert Tables for Restaurant 2 (Sunset Bar & Grill)
INSERT INTO tables (restaurant_id, table_no, qr_code, capacity, is_occupied, created_at) VALUES
(2, '1', UUID(), 4, FALSE, NOW()),
(2, '2', UUID(), 4, FALSE, NOW()),
(2, '3', UUID(), 6, FALSE, NOW()),
(2, '4', UUID(), 2, FALSE, NOW());

-- Insert Tables for Restaurant 3 (Mountain View Restaurant)
INSERT INTO tables (restaurant_id, table_no, qr_code, capacity, is_occupied, created_at) VALUES
(3, '1', UUID(), 4, FALSE, NOW()),
(3, '2', UUID(), 4, FALSE, NOW()),
(3, '3', UUID(), 6, FALSE, NOW());

-- Insert Menu Items for Restaurant 1 (The Orange Bistro)
INSERT INTO menu_items (restaurant_id, name, description, category, price, half_price, available, created_at) VALUES
(1, 'Margherita Pizza', 'Classic Italian pizza with fresh mozzarella and basil', 'Main Course', 14.99, 8.99, TRUE, NOW()),
(1, 'Caesar Salad', 'Crispy romaine lettuce with Caesar dressing and croutons', 'Appetizer', 9.99, NULL, TRUE, NOW()),
(1, 'Grilled Salmon', 'Fresh Atlantic salmon with lemon butter sauce', 'Main Course', 22.99, 13.99, TRUE, NOW()),
(1, 'Chocolate Lava Cake', 'Warm chocolate cake with molten center', 'Dessert', 7.99, 4.99, TRUE, NOW()),
(1, 'Craft Beer Selection', 'Rotating selection of local craft beers', 'Beverage', 6.99, NULL, TRUE, NOW()),
(1, 'Truffle Pasta', 'Handmade pasta with truffle cream sauce', 'Main Course', 18.99, 10.99, TRUE, NOW()),
(1, 'Garlic Bread', 'Toasted bread with garlic butter and herbs', 'Appetizer', 5.99, NULL, TRUE, NOW()),
(1, 'Tiramisu', 'Classic Italian coffee-flavored dessert', 'Dessert', 8.99, 5.49, TRUE, NOW());

-- Insert Menu Items for Restaurant 2 (Sunset Bar & Grill)
INSERT INTO menu_items (restaurant_id, name, description, category, price, half_price, available, created_at) VALUES
(2, 'BBQ Ribs Platter', 'Tender ribs with signature BBQ sauce', 'Main Course', 24.99, 14.99, TRUE, NOW()),
(2, 'Buffalo Wings', 'Spicy chicken wings with blue cheese dip', 'Appetizer', 12.99, 7.99, TRUE, NOW()),
(2, 'Grilled Burger', 'Juicy beef burger with all the fixings', 'Main Course', 15.99, NULL, TRUE, NOW()),
(2, 'Fish Tacos', 'Grilled fish with fresh salsa and lime', 'Main Course', 13.99, 8.49, TRUE, NOW()),
(2, 'Mojito', 'Refreshing mint and lime cocktail', 'Beverage', 9.99, NULL, TRUE, NOW()),
(2, 'Nachos Supreme', 'Loaded nachos with cheese, jalapeños, and sour cream', 'Appetizer', 11.99, 6.99, TRUE, NOW());

-- Insert Menu Items for Restaurant 3 (Mountain View Restaurant)
INSERT INTO menu_items (restaurant_id, name, description, category, price, half_price, available, created_at) VALUES
(3, 'Steak Frites', 'Premium ribeye with hand-cut fries', 'Main Course', 32.99, 18.99, TRUE, NOW()),
(3, 'Lobster Bisque', 'Creamy lobster soup with cognac', 'Appetizer', 14.99, NULL, TRUE, NOW()),
(3, 'Vegetarian Risotto', 'Creamy arborio rice with seasonal vegetables', 'Main Course', 16.99, 9.99, TRUE, NOW()),
(3, 'Crème Brûlée', 'Classic French custard with caramelized sugar', 'Dessert', 9.99, NULL, TRUE, NOW()),
(3, 'House Wine', 'Selection of red and white wines', 'Beverage', 8.99, NULL, TRUE, NOW());

-- Insert Sample Orders (for analytics demo)
INSERT INTO orders (restaurant_id, table_no, customer_name, phone, items, total_amount, status, created_at) VALUES
(1, '1', 'John Doe', '+1-555-1001', '[{"menu_item_id": 1, "name": "Margherita Pizza", "quantity": 2, "price": 14.99}]', 29.98, 'COMPLETED', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(1, '2', 'Jane Smith', '+1-555-1002', '[{"menu_item_id": 3, "name": "Grilled Salmon", "quantity": 1, "price": 22.99}]', 22.99, 'COMPLETED', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(1, '3', 'Bob Johnson', '+1-555-1003', '[{"menu_item_id": 6, "name": "Truffle Pasta", "quantity": 1, "price": 18.99}]', 18.99, 'COMPLETED', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(2, '1', 'Alice Brown', '+1-555-2001', '[{"menu_item_id": 9, "name": "BBQ Ribs Platter", "quantity": 2, "price": 24.99}]', 49.98, 'COMPLETED', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(2, '2', 'Charlie Davis', '+1-555-2002', '[{"menu_item_id": 11, "name": "Grilled Burger", "quantity": 3, "price": 15.99}]', 47.97, 'COMPLETED', NOW()),
(3, '1', 'Diana Wilson', '+1-555-3001', '[{"menu_item_id": 15, "name": "Steak Frites", "quantity": 2, "price": 32.99}]', 65.98, 'PENDING', NOW());

SELECT 'Seed data inserted successfully!' AS Result;