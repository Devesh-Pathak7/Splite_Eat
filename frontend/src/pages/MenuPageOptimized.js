import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useVirtualizer } from '@tanstack/react-virtual';
import { formatCurrency, getItemTypeIndicator } from '../utils/helpers';
import { Moon, Sun, Search, Filter, ShoppingCart, Clock, Users } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const MenuPageOptimized = () => {
  const { restaurant_id, table_no } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [halfOrders, setHalfOrders] = useState([]);
  const [cart, setCart] = useState({ items: [], halfOrderIds: [] });
  const [customer, setCustomer] = useState({ name: '', mobile: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [itemTypeFilter, setItemTypeFilter] = useState('all');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showCart, setShowCart] = useState(false);

  const parentRef = React.useRef();

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

  const filteredMenu = useMemo(() => {
    return menuItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesType = itemTypeFilter === 'all' || item.item_type.toLowerCase() === itemTypeFilter;
      return matchesSearch && matchesCategory && matchesType;
    });
  }, [menuItems, searchQuery, categoryFilter, itemTypeFilter]);

  const categories = useMemo(() => {
    return ['all', ...new Set(menuItems.map(item => item.category).filter(Boolean))];
  }, [menuItems]);

  const rowVirtualizer = useVirtualizer({
    count: Math.ceil(filteredMenu.length / 3),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 300,
    overscan: 5
  });

  const addToCart = useCallback((item, isHalf = false) => {
    setCart(prev => ({
      ...prev,
      items: [...prev.items, { 
        ...item, 
        quantity: 1, 
        isHalf,
        cartId: Date.now() 
      }]
    }));
  }, []);

  const removeFromCart = useCallback((cartId) => {
    setCart(prev => ({
      ...prev,
      items: prev.items.filter(item => item.cartId !== cartId)
    }));
  }, []);

  const createHalfOrder = async (menuItem) => {
    if (!customer.name || customer.mobile.length !== 10) {
      alert('Please enter valid name and 10-digit mobile number');
      return;
    }
    
    try {
      const res = await axios.post(
        `${API_URL}/half-order?restaurant_id=${restaurant_id}&table_no=${table_no}`,
        {
          customer_name: customer.name,
          customer_mobile: customer.mobile,
          menu_item_id: menuItem.id
        }
      );
      alert(`Half-order created! Session ID: ${res.data.id}\nOthers can join within ${Math.floor(getTimeRemaining(res.data.expires_at))} minutes.`);
      fetchHalfOrders();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.detail || 'Failed to create half-order'));
    }
  };

  const joinHalfOrder = async (sessionId) => {
    if (!customer.name || customer.mobile.length !== 10) {
      alert('Please enter valid name and 10-digit mobile number');
      return;
    }
    
    try {
      await axios.post(`${API_URL}/half-order/${sessionId}/join`, {
        table_no: table_no,
        customer_name: customer.name,
        customer_mobile: customer.mobile
      });
      setCart(prev => ({ ...prev, halfOrderIds: [...prev.halfOrderIds, sessionId] }));
      alert('Successfully joined half-order!');
      fetchHalfOrders();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.detail || 'Failed to join'));
    }
  };

  const checkout = async () => {
    if (!customer.name || customer.mobile.length !== 10) {
      alert('Please enter valid customer details');
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
        customer_name: customer.name,
        phone: customer.mobile,
        items: orderItems,
        paired_order_ids: cart.halfOrderIds
      });

      alert('✅ Order placed successfully!');
      setCart({ items: [], halfOrderIds: [] });
      setShowCart(false);
    } catch (err) {
      alert('Checkout failed: ' + (err.response?.data?.detail || 'Error'));
    }
  };

  const totalAmount = useMemo(() => {
    return cart.items.reduce((sum, item) => 
      sum + (item.isHalf ? item.half_price : item.price) * item.quantity, 0
    );
  }, [cart.items]);

  return (
    <div className={isDarkMode ? 'bg-gray-900 text-white min-h-screen' : 'bg-gradient-to-br from-orange-50 to-amber-50 min-h-screen'}>
      {/* Fixed Header */}
      <div className="sticky top-0 z-50 bg-white dark:bg-gray-800 shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-orange-600">
                {restaurant?.name || 'SplitEat'}
              </h1>
              <p className="text-sm text-gray-600">Table {table_no}</p>
            </div>
            <div className="flex gap-4 items-center">
              <button onClick={() => setShowCart(!showCart)} className="relative">
                <ShoppingCart size={28} className="text-orange-600" />
                {cart.items.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center">
                    {cart.items.length}
                  </span>
                )}
              </button>
              <button onClick={() => setIsDarkMode(!isDarkMode)}>
                {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
              </button>
            </div>
          </div>

          {/* Customer Info */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <input
              type="text"
              placeholder="Your Name *"
              value={customer.name}
              onChange={(e) => setCustomer(prev => ({ ...prev, name: e.target.value }))}
              className="px-4 py-2 rounded-lg border-2 border-orange-300 focus:border-orange-500 outline-none"
            />
            <input
              type="tel"
              placeholder="Mobile (10 digits) *"
              value={customer.mobile}
              onChange={(e) => setCustomer(prev => ({ ...prev, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
              className="px-4 py-2 rounded-lg border-2 border-orange-300 focus:border-orange-500 outline-none"
            />
          </div>

          {/* Search & Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search dishes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border-2 border-orange-300 focus:border-orange-500 outline-none"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 rounded-lg border-2 border-orange-300 focus:border-orange-500 outline-none"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</option>
              ))}
            </select>
            <select
              value={itemTypeFilter}
              onChange={(e) => setItemTypeFilter(e.target.value)}
              className="px-4 py-2 rounded-lg border-2 border-orange-300 focus:border-orange-500 outline-none"
            >
              <option value="all">All Types</option>
              <option value="veg">🟢 Veg</option>
              <option value="non_veg">🔴 Non-Veg</option>
            </select>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Active Half Orders Section */}
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
                      <span className="px-2 py-1 bg-orange-500 text-white text-xs rounded-full">
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

        {/* Virtualized Menu Grid */}
        <h2 className="text-2xl font-bold mb-4 text-orange-600">Full Menu ({filteredMenu.length} items)</h2>
        <div ref={parentRef} style={{ height: '800px', overflow: 'auto' }}>
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative'
            }}
          >
            {rowVirtualizer.getVirtualItems().map(virtualRow => {
              const startIdx = virtualRow.index * 3;
              const rowItems = filteredMenu.slice(startIdx, startIdx + 3);
              
              return (
                <div
                  key={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`
                  }}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-2">
                    {rowItems.map(item => {
                      const badge = getItemTypeIndicator(item.item_type);
                      return (
                        <div key={item.id} className="bg-white rounded-xl shadow-md hover:shadow-2xl transition-all p-4 border border-gray-200">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-lg text-gray-800 flex-1">{item.name}</h3>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${badge.color === 'green' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {badge.icon} {badge.label}
                            </span>
                          </div>
                          {item.description && (
                            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{item.description}</p>
                          )}
                          <div className="flex justify-between items-end">
                            <div>
                              <p className="font-bold text-xl text-orange-600">{formatCurrency(item.price)}</p>
                              {item.half_price && (
                                <p className="text-sm text-gray-500">Half: {formatCurrency(item.half_price)}</p>
                              )}
                            </div>
                            <div className="flex flex-col gap-2">
                              <button
                                onClick={() => addToCart(item, false)}
                                className="bg-blue-500 text-white px-4 py-1 rounded-lg text-sm font-semibold hover:bg-blue-600 transition-all"
                              >
                                + Add Full
                              </button>
                              {item.half_price && (
                                <button
                                  onClick={() => createHalfOrder(item)}
                                  className="bg-orange-500 text-white px-4 py-1 rounded-lg text-sm font-semibold hover:bg-orange-600 transition-all"
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
        </div>
      </div>

      {/* Cart Sidebar */}
      {showCart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end" onClick={() => setShowCart(false)}>
          <div className="bg-white w-full max-w-md h-full shadow-2xl p-6 overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-orange-600">🛒 Your Cart</h2>
              <button onClick={() => setShowCart(false)} className="text-gray-600 text-2xl">×</button>
            </div>

            {cart.halfOrderIds.length > 0 && (
              <div className="bg-green-50 border-2 border-green-300 rounded-lg p-3 mb-4">
                <p className="text-green-700 font-semibold">✓ Joined {cart.halfOrderIds.length} Half-Order Session(s)</p>
              </div>
            )}

            {cart.items.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Cart is empty</p>
            ) : (
              <>
                {cart.items.map((item) => (
                  <div key={item.cartId} className="flex justify-between items-center mb-4 pb-4 border-b">
                    <div className="flex-1">
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-xs text-gray-500">
                        {item.isHalf ? '🟡 Half Order' : '🟢 Full Order'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold">{formatCurrency(item.isHalf ? item.half_price : item.price)}</span>
                      <button
                        onClick={() => removeFromCart(item.cartId)}
                        className="text-red-500 font-bold"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
                <div className="mt-6 pt-4 border-t-2">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xl font-bold">Total:</span>
                    <span className="text-2xl font-bold text-orange-600">{formatCurrency(totalAmount)}</span>
                  </div>
                  <button
                    onClick={checkout}
                    className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-4 rounded-xl font-bold text-lg hover:from-green-600 hover:to-green-700 transition-all shadow-lg"
                  >
                    Place Order
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuPageOptimized;
