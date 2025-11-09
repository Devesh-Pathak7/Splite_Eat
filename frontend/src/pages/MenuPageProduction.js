import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useVirtualizer } from '@tanstack/react-virtual';
import { formatCurrency } from '../utils/helpers';
import { Moon, Sun, Search, ShoppingCart, Clock, Users, X, Plus, Minus } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Category definitions
const CATEGORIES = [
  'Starters',
  'Soups', 
  'Main Course',
  'Veg Main Course',
  'Non-Veg Main Course',
  'Breads',
  'Desserts',
  'Beverages'
];

const MenuPageProduction = () => {
  const { restaurant_id, table_no } = useParams();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [halfOrders, setHalfOrders] = useState([]);
  const [cart, setCart] = useState({ items: [], halfOrderIds: [] });
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [itemTypeFilter, setItemTypeFilter] = useState('all');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({ name: '', mobile: '' });
  const [ws, setWs] = useState(null);
  const parentRef = useRef();

  // WebSocket connection
  useEffect(() => {
    const wsUrl = `wss://${window.location.host.replace('https://', '')}/ws/${restaurant_id}`;
    const websocket = new WebSocket(wsUrl);
    
    websocket.onopen = () => {
      console.log('WebSocket connected');
    };
    
    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleWebSocketMessage(message);
    };
    
    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    websocket.onclose = () => {
      console.log('WebSocket disconnected');
    };
    
    setWs(websocket);
    
    return () => {
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.close();
      }
    };
  }, [restaurant_id]);

  const handleWebSocketMessage = (message) => {
    console.log('WebSocket message:', message);
    
    // Handle menu updates
    if (message.type === 'menu.update') {
      if (message.data.action === 'create') {
        fetchMenu();
      } else if (message.data.action === 'update') {
        setMenuItems(prev => prev.map(item => 
          item.id === message.data.item.id ? { ...item, ...message.data.item } : item
        ));
      } else if (message.data.action === 'delete') {
        setMenuItems(prev => prev.filter(item => item.id !== message.data.item_id));
      }
    }
    
    // Handle half-order updates
    if (message.type === 'session.created' || message.type === 'session.joined') {
      fetchHalfOrders();
    }
  };

  useEffect(() => {
    fetchRestaurant();
    fetchMenu();
    fetchHalfOrders();
    const interval = setInterval(fetchHalfOrders, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchRestaurant = async () => {
    try {
      const res = await axios.get(`${API_URL}/restaurants/${restaurant_id}`);
      setRestaurant(res.data);
    } catch (err) {
      console.error('Restaurant fetch error:', err);
    }
  };

  const fetchMenu = async () => {
    try {
      const res = await axios.get(`${API_URL}/restaurants/${restaurant_id}/menu`);
      setMenuItems(res.data);
    } catch (err) {
      console.error('Menu fetch error:', err);
    }
  };

  const fetchHalfOrders = async () => {
    try {
      const res = await axios.get(`${API_URL}/half-order/active?restaurant_id=${restaurant_id}`);
      const active = res.data.filter(h => {
        const expiresAt = new Date(h.expires_at);
        return expiresAt > new Date();
      });
      setHalfOrders(active);
    } catch (err) {
      console.error('Half orders fetch error:', err);
    }
  };

  const getTimeRemaining = (expiresAt) => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diff = expiry - now;
    return Math.max(0, Math.floor(diff / 1000 / 60));
  };

  // Group menu items by category
  const groupedMenu = useMemo(() => {
    const filtered = menuItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesType = itemTypeFilter === 'all' || item.item_type.toLowerCase() === itemTypeFilter;
      return matchesSearch && matchesCategory && matchesType && item.available;
    });

    const grouped = {};
    CATEGORIES.forEach(cat => {
      grouped[cat] = filtered.filter(item => item.category === cat);
    });
    
    return grouped;
  }, [menuItems, searchQuery, categoryFilter, itemTypeFilter]);

  const addToCart = useCallback((item, isHalf = false) => {
    setCart(prev => {
      const existingIndex = prev.items.findIndex(i => 
        i.id === item.id && i.isHalf === isHalf
      );
      
      if (existingIndex >= 0) {
        const newItems = [...prev.items];
        newItems[existingIndex].quantity += 1;
        return { ...prev, items: newItems };
      }
      
      return {
        ...prev,
        items: [...prev.items, { 
          ...item, 
          quantity: 1, 
          isHalf,
          cartId: Date.now() + Math.random()
        }]
      };
    });
  }, []);

  const updateQuantity = useCallback((cartId, delta) => {
    setCart(prev => ({
      ...prev,
      items: prev.items.map(item => 
        item.cartId === cartId 
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item
      )
    }));
  }, []);

  const removeFromCart = useCallback((cartId) => {
    setCart(prev => ({
      ...prev,
      items: prev.items.filter(item => item.cartId !== cartId)
    }));
  }, []);

  const createHalfOrder = async (menuItem) => {
    if (!customerInfo.name || customerInfo.mobile.length !== 10) {
      alert('Please enter your details in the cart before creating a half-order');
      setShowCart(true);
      return;
    }
    
    try {
      const res = await axios.post(
        `${API_URL}/half-order?restaurant_id=${restaurant_id}&table_no=${table_no}`,
        {
          customer_name: customerInfo.name,
          customer_mobile: customerInfo.mobile,
          menu_item_id: menuItem.id
        }
      );
      alert(`✅ Half-order created! Session expires in ${Math.floor(getTimeRemaining(res.data.expires_at))} minutes.`);
      fetchHalfOrders();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.detail || 'Failed to create half-order'));
    }
  };

  const joinHalfOrder = async (sessionId) => {
    if (!customerInfo.name || customerInfo.mobile.length !== 10) {
      alert('Please enter your details in the cart before joining');
      setShowCart(true);
      return;
    }
    
    try {
      await axios.post(`${API_URL}/half-order/${sessionId}/join`, {
        table_no: table_no,
        customer_name: customerInfo.name,
        customer_mobile: customerInfo.mobile
      });
      setCart(prev => ({ ...prev, halfOrderIds: [...prev.halfOrderIds, sessionId] }));
      alert('✅ Successfully joined half-order!');
      fetchHalfOrders();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.detail || 'Failed to join'));
    }
  };

  const checkout = async () => {
    if (!customerInfo.name || customerInfo.mobile.length !== 10) {
      alert('Please enter your name and 10-digit mobile number');
      return;
    }
    if (cart.items.length === 0 && cart.halfOrderIds.length === 0) {
      alert('Cart is empty');
      return;
    }

    try {
      const orderItems = cart.items.map(item => ({
        menu_item_id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.isHalf ? item.half_price : item.price
      }));

      await axios.post(`${API_URL}/orders`, {
        restaurant_id: parseInt(restaurant_id),
        table_no: table_no,
        customer_name: customerInfo.name,
        phone: customerInfo.mobile,
        items: orderItems,
        paired_order_ids: cart.halfOrderIds
      });

      alert('✅ Order placed successfully!');
      setCart({ items: [], halfOrderIds: [] });
      setShowCart(false);
      navigate('/order-success');
    } catch (err) {
      alert('Checkout failed: ' + (err.response?.data?.detail || 'Error'));
    }
  };

  const totalAmount = useMemo(() => {
    return cart.items.reduce((sum, item) => 
      sum + (item.isHalf ? item.half_price : item.price) * item.quantity, 0
    );
  }, [cart.items]);

  const totalItems = useMemo(() => {
    return cart.items.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart.items]);

  return (
    <div className={isDarkMode ? 'bg-gray-900 text-white min-h-screen' : 'bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 min-h-screen'}>
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-white dark:bg-gray-800 shadow-lg border-b-2 border-orange-400">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-orange-600">
                {restaurant?.name || 'SplitEat'}
              </h1>
              <p className="text-sm text-gray-600">Table {table_no}</p>
            </div>
            <div className="flex gap-3 items-center">
              <button 
                onClick={() => setShowCart(!showCart)} 
                className="relative p-2 hover:bg-orange-100 rounded-full transition"
              >
                <ShoppingCart size={28} className="text-orange-600" />
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold">
                    {totalItems}
                  </span>
                )}
              </button>
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 hover:bg-orange-100 rounded-full transition"
              >
                {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search dishes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 rounded-lg border-2 border-orange-300 focus:border-orange-500 outline-none text-sm"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border-2 border-orange-300 focus:border-orange-500 outline-none text-sm"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select
              value={itemTypeFilter}
              onChange={(e) => setItemTypeFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border-2 border-orange-300 focus:border-orange-500 outline-none text-sm"
            >
              <option value="all">All Types</option>
              <option value="veg">🟢 Veg Only</option>
              <option value="non_veg">🔴 Non-Veg Only</option>
            </select>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Active Half Orders */}
        {halfOrders.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-orange-600 flex items-center gap-2">
              <Users size={28} />
              Active Half Orders ({halfOrders.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {halfOrders.map(ho => {
                const timeLeft = getTimeRemaining(ho.expires_at);
                return (
                  <div key={ho.id} className="bg-gradient-to-br from-orange-100 to-amber-100 border-2 border-orange-400 rounded-xl p-4 shadow-lg hover:shadow-2xl transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-lg text-gray-800">{ho.menu_item_name}</h3>
                      <span className="px-2 py-1 bg-orange-500 text-white text-xs rounded-full animate-pulse">
                        LIVE
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-1">👤 {ho.customer_name}</p>
                    <p className="text-sm text-gray-700 mb-1">🪑 Table {ho.table_no}</p>
                    <div className="flex items-center gap-2 mb-3 text-orange-700 font-semibold">
                      <Clock size={16} />
                      <span>{timeLeft} min left</span>
                    </div>
                    <button
                      onClick={() => joinHalfOrder(ho.id)}
                      disabled={timeLeft === 0}
                      className="w-full bg-green-500 text-white py-2 rounded-lg font-semibold hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
                    >
                      {timeLeft === 0 ? '⏰ Expired' : '👥 Join Now'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Menu Items by Category */}
        {CATEGORIES.map(category => {
          const items = groupedMenu[category] || [];
          if (items.length === 0) return null;

          return (
            <div key={category} className="mb-12">
              <h2 className="text-3xl font-bold mb-6 text-orange-600 border-b-4 border-orange-400 pb-2">
                {category}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {items.map(item => {
                  const isVeg = item.item_type.toLowerCase() === 'veg';
                  return (
                    <div 
                      key={item.id} 
                      className="bg-white rounded-xl shadow-md hover:shadow-2xl transition-all p-4 border-2 border-gray-200 hover:border-orange-400"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-lg text-gray-800 flex-1 pr-2">{item.name}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                          isVeg ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {isVeg ? '🟢' : '🔴'} {isVeg ? 'VEG' : 'NON-VEG'}
                        </span>
                      </div>
                      {item.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{item.description}</p>
                      )}
                      <div className="flex justify-between items-end mt-auto">
                        <div>
                          <p className="font-bold text-xl text-orange-600">{formatCurrency(item.price)}</p>
                          {item.half_price && (
                            <p className="text-sm text-gray-500">Half: {formatCurrency(item.half_price)}</p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => addToCart(item, false)}
                            className="bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-600 transition-all whitespace-nowrap"
                          >
                            + Add Full
                          </button>
                          {item.half_price && (
                            <button
                              onClick={() => createHalfOrder(item)}
                              className="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-orange-600 transition-all whitespace-nowrap"
                            >
                              Start Half
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cart Sidebar */}
      {showCart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end" onClick={() => setShowCart(false)}>
          <div 
            className="bg-white w-full max-w-md h-full shadow-2xl overflow-auto" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b-2 border-orange-400 p-4 z-10">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-orange-600">🛒 Your Cart</h2>
                <button onClick={() => setShowCart(false)} className="text-gray-600 hover:text-gray-900">
                  <X size={28} />
                </button>
              </div>

              {/* Customer Info in Cart */}
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Your Name *"
                  value={customerInfo.name}
                  onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg border-2 border-orange-300 focus:border-orange-500 outline-none"
                />
                <input
                  type="tel"
                  placeholder="Mobile (10 digits) *"
                  value={customerInfo.mobile}
                  onChange={(e) => setCustomerInfo(prev => ({ 
                    ...prev, 
                    mobile: e.target.value.replace(/\D/g, '').slice(0, 10) 
                  }))}
                  className="w-full px-4 py-2 rounded-lg border-2 border-orange-300 focus:border-orange-500 outline-none"
                />
              </div>
            </div>

            <div className="p-4">
              {cart.halfOrderIds.length > 0 && (
                <div className="bg-green-50 border-2 border-green-300 rounded-lg p-3 mb-4">
                  <p className="text-green-700 font-semibold">✓ Joined {cart.halfOrderIds.length} Half-Order(s)</p>
                </div>
              )}

              {cart.items.length === 0 && cart.halfOrderIds.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart size={64} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500 text-lg">Your cart is empty</p>
                  <button 
                    onClick={() => setShowCart(false)}
                    className="mt-4 text-orange-600 font-semibold"
                  >
                    Browse Menu
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-3 mb-6">
                    {cart.items.map((item) => (
                      <div key={item.cartId} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-800">{item.name}</p>
                            <p className="text-xs text-gray-500">
                              {item.isHalf ? '🟡 Half Order' : '🟢 Full Order'}
                            </p>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.cartId)}
                            className="text-red-500 hover:text-red-700 ml-2"
                          >
                            <X size={20} />
                          </button>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-300 px-2 py-1">
                            <button 
                              onClick={() => updateQuantity(item.cartId, -1)}
                              className="text-orange-600 hover:text-orange-700"
                            >
                              <Minus size={16} />
                            </button>
                            <span className="font-semibold w-8 text-center">{item.quantity}</span>
                            <button 
                              onClick={() => updateQuantity(item.cartId, 1)}
                              className="text-orange-600 hover:text-orange-700"
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                          <span className="font-bold text-lg text-orange-600">
                            {formatCurrency((item.isHalf ? item.half_price : item.price) * item.quantity)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t-2 border-gray-300 pt-4">
                    <div className="flex justify-between items-center mb-6">
                      <span className="text-xl font-bold text-gray-800">Total:</span>
                      <span className="text-3xl font-bold text-orange-600">{formatCurrency(totalAmount)}</span>
                    </div>
                    <button
                      onClick={checkout}
                      disabled={!customerInfo.name || customerInfo.mobile.length !== 10}
                      className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-4 rounded-xl font-bold text-lg hover:from-green-600 hover:to-green-700 transition-all shadow-lg disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed"
                    >
                      {!customerInfo.name || customerInfo.mobile.length !== 10 
                        ? 'Enter Details Above' 
                        : 'Place Order'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuPageProduction;
