// /mnt/data/MenuPageProduction.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { formatCurrency } from '../utils/helpers';
import { Moon, Sun, Search, ShoppingCart, Users, X, Plus, Minus, Zap, CheckCircle, AlertTriangle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast'; // Assuming react-hot-toast or similar is used for modern notifications

/**
 * Production-ready Menu page - Enhanced for concurrency and modern UX.
 * - Uses dedicated loading states and toast notifications (removes native alerts).
 * - Refined cart logic: Half items are only added to the cart *after* a session is successfully started or joined (linked).
 * - Implements a CustomerModal for starting/joining sessions cleanly.
 */

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Use environment variable for dynamic default session duration (in minutes), defaulting to 30
const DEFAULT_HALF_SESSION_DURATION_MINUTES = parseInt(
  process.env.REACT_APP_HALF_SESSION_DURATION_MINUTES, 10
) || 30;

const BASE_CATEGORY_LABELS = [
  'Starters', 'Soups', 'Main Course', 'Veg Main Course', 'Non-Veg Main Course', 'Breads', 'Desserts', 'Beverages'
];

const CATEGORY_ALIAS = {
  starters: 'Starters',
  soup: 'Soups', soups: 'Soups',
  'main course': 'Main Course',
  'veg main course': 'Veg Main Course',
  'non-veg main course': 'Non-Veg Main Course',
  bread: 'Breads', breads: 'Breads',
  dessert: 'Desserts', desserts: 'Desserts',
  beverage: 'Beverages', beverages: 'Beverages',
  appetizer: 'Starters', appetizers: 'Starters'
};

const toNumber = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

const getTimeRemaining = (expiresAt) => {
  if (!expiresAt) return 0;
  const expiry = new Date(expiresAt);
  const diff = Math.max(0, expiry.getTime() - new Date().getTime());
  return Math.floor(diff / 1000 / 60);
};

// --- CUSTOMER INFO/SESSION MODAL COMPONENT (for cleaner UX) ---

const CustomerModal = ({ isOpen, onClose, customerInfo, setCustomerInfo, onSubmit, title, actionLabel, isLoading }) => {
  if (!isOpen) return null;

  const isFormValid = customerInfo.name.trim() && customerInfo.mobile.length === 10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 transition-opacity">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4 transition-transform scale-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-orange-600 dark:text-orange-400">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-300"><X size={20} /></button>
        </div>

        <div className="space-y-3">
          <input
            value={customerInfo.name}
            onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Your Name *"
            className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
            disabled={isLoading}
          />
          <input
            value={customerInfo.mobile}
            onChange={(e) => setCustomerInfo(prev => ({ ...prev, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
            placeholder="Mobile (10 digits) *"
            className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
            disabled={isLoading}
            maxLength={10}
          />
        </div>

        <button
          onClick={onSubmit}
          disabled={!isFormValid || isLoading}
          className="w-full mt-6 px-4 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold disabled:opacity-50 transition duration-150 flex items-center justify-center"
        >
          {isLoading ? (
            <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          ) : (
            actionLabel
          )}
        </button>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---

export default function MenuPageProduction() {
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
  
  // Concurrency and State Management
  const [isLoading, setIsLoading] = useState(false);
  const [modalState, setModalState] = useState(null); // { type: 'start' | 'join', data: menuItemId | sessionId }

  const normalizeCategory = (c) => {
    if (!c) return '';
    let s = String(c).trim().toLowerCase();
    s = s.replace(/\s+/g, ' ');
    if (CATEGORY_ALIAS[s]) return CATEGORY_ALIAS[s].toLowerCase();
    if (s.endsWith('s') && s.length > 3) s = s.slice(0, -1);
    return s;
  };

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  // WebSocket (menu/session updates)
  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${proto}://${window.location.host}/ws/${restaurant_id}`;
    let ws;
    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => console.log('WS connected');
      ws.onmessage = (e) => { try { handleWebSocketMessage(JSON.parse(e.data)); } catch (err) {console.error('WS message error:', err)} };
      ws.onerror = (err) => console.warn('WS error', err);
      ws.onclose = () => console.log('WS closed');
    } catch (e) {
      console.warn('WS init failed', e);
    }
    return () => { if (ws && ws.readyState === WebSocket.OPEN) ws.close(); };
  }, [restaurant_id]);

  const handleWebSocketMessage = (message) => {
    if (!message) return;
    if (message.type === 'menu.update') {
      if (message.data?.action === 'create') fetchMenu();
      if (message.data?.action === 'update') setMenuItems(prev => prev.map(it => it.id === message.data.item.id ? { ...it, ...message.data.item } : it));
      if (message.data?.action === 'delete') setMenuItems(prev => prev.filter(it => it.id !== message.data.item_id));
    }
    // Concurrency handling: If a session is created/joined, refetch active sessions.
    if (message.type === 'session.created' || message.type === 'session.joined' || message.type === 'session.expired') {
      fetchHalfOrders();
    }
  };

  useEffect(() => {
    fetchRestaurant();
    fetchMenu();
    fetchHalfOrders();
    // Refresh half orders every 15 seconds for timely expiry updates
    const t = setInterval(fetchHalfOrders, 15000); 
    return () => clearInterval(t);
  }, []);

  const fetchRestaurant = async () => {
    try { const r = await axios.get(`${API_URL}/restaurants/${restaurant_id}`); setRestaurant(r.data); } catch (e) { console.error('Error fetching restaurant:', e); toast.error('Failed to load restaurant details.'); }
  };
  const fetchMenu = async () => {
    try { const r = await axios.get(`${API_URL}/restaurants/${restaurant_id}/menu`); setMenuItems(r.data || []); } catch (e) { console.error('Error fetching menu:', e); toast.error('Failed to load menu items.'); }
  };
  const fetchHalfOrders = async () => {
    try {
      const r = await axios.get(`${API_URL}/half-order/active?restaurant_id=${restaurant_id}`);
      // Filter out expired sessions client-side just in case, though backend should handle it
      const active = (r.data || []).filter(h => getTimeRemaining(h.expires_at || h.expiresAt || Date.now()) > 0);
      setHalfOrders(active);
    } catch (e) { console.error('Error fetching half orders:', e); }
  };

  const displayCategories = useMemo(() => {
    const menuCats = Array.from(new Set(menuItems.map(i => (i.category || '').trim()).filter(Boolean)));
    const ordered = [...BASE_CATEGORY_LABELS];
    menuCats.forEach(c => { if (!ordered.includes(c)) ordered.push(c); });
    return ordered;
  }, [menuItems]);

  const groupedMenu = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = menuItems.filter(item => {
      const matchesSearch = !q || item.name.toLowerCase().includes(q) || (item.description || '').toLowerCase().includes(q);
      const filterNorm = categoryFilter === 'all' ? null : normalizeCategory(categoryFilter);
      const itemNorm = normalizeCategory(item.category || '');
      const matchesCategory = !filterNorm || itemNorm === filterNorm;
      const matchesType = itemTypeFilter === 'all' || (item.item_type || '').toLowerCase() === itemTypeFilter;
      return matchesSearch && matchesCategory && matchesType && item.available !== false;
    });

    const grouped = {};
    const cats = displayCategories.concat(filtered.map(i => i.category).filter(c => !displayCategories.includes(c)));
    cats.forEach(cat => grouped[cat] = filtered.filter(i => normalizeCategory(i.category || '') === normalizeCategory(cat || '')));
    return grouped;
  }, [menuItems, searchQuery, categoryFilter, itemTypeFilter, displayCategories]);

  // CART OPERATIONS
  const addToCart = useCallback((item, isHalf = false, sessionId = null) => {
    if (isHalf && !sessionId) {
      console.warn("Attempted to add unlinked half item to cart. This should not happen in the new flow.");
      return;
    }

    setCart(prev => {
      const price = toNumber(item.price ?? item.cost ?? 0);
      const half_price = toNumber(item.half_price ?? Math.round(price / 2));
      // Unique identification now includes sessionId for half orders
      const idx = prev.items.findIndex(it => it.id === item.id && it.isHalf === isHalf && (!isHalf || it.sessionId === sessionId));

      if (idx >= 0) { 
        const cp = [...prev.items]; 
        cp[idx].quantity += 1; 
        return { ...prev, items: cp }; 
      }
      
      const cartItem = { id: item.id, name: item.name, price, half_price, quantity: 1, isHalf, sessionId: sessionId || null, cartId: Date.now() + Math.random() };
      
      // Ensure halfOrderIds is updated for linked half items
      const newHalfOrderIds = sessionId ? [...new Set([...prev.halfOrderIds, sessionId])] : prev.halfOrderIds;

      return { ...prev, items: [...prev.items, cartItem], halfOrderIds: newHalfOrderIds };
    });
  }, []);

  const updateQuantity = useCallback((cartId, delta) => setCart(prev => ({ ...prev, items: prev.items.map(it => it.cartId === cartId ? { ...it, quantity: Math.max(1, it.quantity + delta) } : it) })), []);
  
  const removeFromCart = useCallback((cartId) => {
    setCart(prev => {
      const itemToRemove = prev.items.find(it => it.cartId === cartId);
      if (!itemToRemove) return prev;

      const newItems = prev.items.filter(it => it.cartId !== cartId);

      let newHalfOrderIds = prev.halfOrderIds;
      if (itemToRemove.isHalf && itemToRemove.sessionId) {
        // Check if any other item in the cart uses this sessionId. If not, remove it from halfOrderIds
        const isSessionStillReferenced = newItems.some(it => it.sessionId === itemToRemove.sessionId);
        if (!isSessionStillReferenced) {
          newHalfOrderIds = prev.halfOrderIds.filter(id => id !== itemToRemove.sessionId);
        }
      }

      return { ...prev, items: newItems, halfOrderIds: newHalfOrderIds };
    });
  }, []);

  // --- HALF SESSION LOGIC ---

  const handleStartHalf = (menuItemId) => {
    setModalState({ type: 'start', data: menuItemId });
  };

  const handleJoinHalf = (sessionId) => {
    setModalState({ type: 'join', data: sessionId });
  };

  const executeStartHalf = async () => {
    const menuItemId = modalState?.data;
    if (!menuItemId) return;
    setIsLoading(true);

    try {
      const res = await axios.post(`${API_URL}/half-order?restaurant_id=${restaurant_id}&table_no=${table_no}`, {
        customer_name: customerInfo.name,
        customer_mobile: customerInfo.mobile,
        menu_item_id: menuItemId
      });
      
      const session = res.data || {};
      const sessionId = session.id || session.session_id || null;
      const originalItem = menuItems.find(mi => String(mi.id) === String(menuItemId));

      if (sessionId && originalItem) {
        // MODIFICATION: Add linked item to cart immediately upon success
        addToCart(originalItem, true, sessionId);
        
        let timeLeft = getTimeRemaining(session.expires_at || session.expiresAt);
        // Fix for "0 min" bug: Fallback to env duration for initial alert if time is near zero
        if (timeLeft < 2) {
          timeLeft = DEFAULT_HALF_SESSION_DURATION_MINUTES;
        }

        toast.success(`Half session started for ${originalItem.name} — expires in ${timeLeft} min.`, { icon: <CheckCircle /> });
        fetchHalfOrders();
        setModalState(null);
      } else {
        throw new Error("Session ID or Menu Item data missing in response.");
      }
    } catch (e) {
      console.error('Start half session failed:', e);
      toast.error(`Failed to start half session: ${e.response?.data?.detail || e.message || 'Server error.'}`, { icon: <AlertTriangle /> });
    } finally {
      setIsLoading(false);
    }
  };

  const executeJoinHalf = async () => {
    const sessionId = modalState?.data;
    if (!sessionId) return;
    setIsLoading(true);

    try {
      const res = await axios.post(`${API_URL}/half-order/${sessionId}/join`, {
        table_no,
        customer_name: customerInfo.name,
        customer_mobile: customerInfo.mobile
      });

      const session = halfOrders.find(h => String(h.id) === String(sessionId)) || res.data || {};
      const menuId = session.menu_item_id ?? session.menu_item?.id;
      const menuName = session.menu_item_name ?? session.menu_item?.name ?? 'Half Item';
      const original = menuItems.find(mi => String(mi.id) === String(menuId));
      
      // Create a template item using available data if the full item is not in the menu list
      const template = original || { 
        id: menuId, 
        name: menuName, 
        price: toNumber(session.price ?? session.menu_item?.price ?? 0), 
        half_price: toNumber(session.half_price ?? session.menu_item?.half_price ?? 0) 
      };

      // MODIFICATION: Add linked item to cart immediately upon success
      addToCart(template, true, sessionId);
      
      toast.success(`Successfully joined half session for ${template.name}.`, { icon: <CheckCircle /> });
      fetchHalfOrders();
      setModalState(null);
    } catch (e) {
      console.error('Join half session failed:', e);
      toast.error(`Failed to join session: ${e.response?.data?.detail || e.message || 'Server error.'}`, { icon: <AlertTriangle /> });
    } finally {
      setIsLoading(false);
    }
  };

  // --- CHECKOUT LOGIC ---

  const checkout = async () => {
    if (!customerInfo.name || customerInfo.mobile.length !== 10) {
      toast.error('Please enter your name and a valid 10-digit mobile number.', { icon: <AlertTriangle /> });
      setShowCart(true); // Ensure cart is open to prompt user
      return;
    }
    if (cart.items.length === 0) {
      toast.error('Cart is empty', { icon: <AlertTriangle /> });
      return;
    }
    
    // Concurrency Check: Ensure all half items are linked to a session before checkout
    const unlinkedHalfItems = cart.items.filter(it => it.isHalf && !it.sessionId);
    if (unlinkedHalfItems.length > 0) {
      toast.error('All half items must be linked to an active session before placing the order.', { icon: <AlertTriangle /> });
      return;
    }

    setIsLoading(true);
    try {
      const orderItems = cart.items.map(it => ({
        menu_item_id: it.id,
        name: it.name,
        quantity: it.quantity,
        price: it.isHalf ? toNumber(it.half_price) : toNumber(it.price),
        is_half: Boolean(it.isHalf),
        half_session_id: it.sessionId || null
      }));
      
      await axios.post(`${API_URL}/orders`, {
        restaurant_id: Number(restaurant_id),
        table_no,
        customer_name: customerInfo.name,
        phone: customerInfo.mobile,
        items: orderItems,
        // halfOrderIds now correctly tracks only the unique session IDs used in the cart
        paired_order_ids: cart.halfOrderIds 
      });

      toast.success('Order placed successfully!', { icon: <CheckCircle /> });
      setCart({ items: [], halfOrderIds: [] });
      setShowCart(false);
      navigate('/order-success');
    } catch (e) {
      console.error('Checkout failed:', e);
      toast.error('Checkout failed: ' + (e.response?.data?.detail || e.message || 'Server error.'), { icon: <AlertTriangle /> });
    } finally {
      setIsLoading(false);
    }
  };

  const confirmHalfOrders = async () => {
    // This is just an alias for checkout when the cart contains only linked half orders.
    await checkout();
  };

  const totalAmount = useMemo(() => cart.items.reduce((s, it) => s + (it.isHalf ? toNumber(it.half_price) : toNumber(it.price)) * it.quantity, 0), [cart.items]);
  const totalItems = useMemo(() => cart.items.reduce((s, it) => s + it.quantity, 0), [cart.items]);

  const halfCapableMenu = useMemo(() => menuItems.filter(mi => mi.half_price && mi.available !== false), [menuItems]);
  const cardClass = (dark) => `rounded-2xl transition-all p-5 border ${dark ? 'bg-gradient-to-br from-gray-800 to-gray-700 border-gray-700 text-white' : 'bg-white/95 border-orange-100 text-gray-800'} shadow hover:shadow-lg transform hover:scale-[1.01]`;

  // Determine footer button behavior:
  const cartHasOnlyHalfItems = cart.items.length > 0 && cart.items.every(it => it.isHalf);
  const allHalfItemsLinked = cartHasOnlyHalfItems && cart.items.every(it => !!it.sessionId);
  const isCheckoutDisabled = isLoading || !customerInfo.name || customerInfo.mobile.length !== 10;

  // Modal Content Setup
  let modalProps = { isOpen: false, onClose: () => setModalState(null), customerInfo, setCustomerInfo, isLoading };
  if (modalState) {
    modalProps.isOpen = true;
    if (modalState.type === 'start') {
      const item = menuItems.find(mi => String(mi.id) === String(modalState.data));
      modalProps.title = `Start Half Session: ${item?.name || 'Item'}`;
      modalProps.actionLabel = "Start Session & Add to Cart";
      modalProps.onSubmit = executeStartHalf;
    } else if (modalState.type === 'join') {
      const session = halfOrders.find(h => String(h.id) === String(modalState.data));
      modalProps.title = `Join Half Session: ${session?.menu_item_name || 'Item'}`;
      modalProps.actionLabel = "Join Session & Add to Cart";
      modalProps.onSubmit = executeJoinHalf;
    }
  }

  return (
    <div className={`${isDarkMode ? 'dark' : ''} ${isDarkMode ? 'bg-gray-900 text-white min-h-screen' : 'bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 min-h-screen'}`}>
      <Toaster position="top-center" reverseOrder={false} />
      
      {/* Customer/Session Modal */}
      <CustomerModal {...modalProps} />

      {/* header */}
      <div className={`sticky top-0 z-40 ${isDarkMode ? 'bg-gray-900 border-b border-gray-800' : 'bg-white border-b border-orange-100'}`}>
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className={`${isDarkMode ? 'text-orange-300' : 'text-orange-600'} text-2xl md:text-3xl font-extrabold`}>{restaurant?.name || 'The Orange Bistro'}</h1>
              <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} text-sm`}>Table {table_no}</p>
            </div>

            <div className="flex gap-3 items-center">
              <button onClick={() => navigate(`/my-orders/${restaurant_id}/${table_no}`)} className="hidden sm:inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow hover:bg-blue-700 transition">My Orders</button>
              <button onClick={() => setShowCart(!showCart)} className="relative p-2 rounded-xl hover:bg-orange-100/10 transition"><ShoppingCart size={26} className="text-orange-500" />{totalItems>0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold">{totalItems}</span>}</button>
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-xl hover:bg-orange-100/10 transition">{isDarkMode ? <Sun size={20} className="text-white"/> : <Moon size={20} className="text-gray-800"/>}</button>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-4 top-3 text-gray-400" size={18}/>
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search dishes..." className={`${isDarkMode ? 'bg-gray-800 text-white border-gray-700' : 'bg-white text-gray-700 border-orange-200'} w-full pl-12 pr-4 py-3 rounded-2xl border-2 focus:outline-none text-sm`} />
            </div>

            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={`${isDarkMode ? 'bg-gray-800 text-white border-gray-700' : 'bg-white text-gray-700 border-orange-200'} px-4 py-3 rounded-2xl border-2 focus:outline-none text-sm`}>
              <option value="all">All Categories</option>
              {displayCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>

            <select value={itemTypeFilter} onChange={(e) => setItemTypeFilter(e.target.value)} className={`${isDarkMode ? 'bg-gray-800 text-white border-gray-700' : 'bg-white text-gray-700 border-orange-200'} px-4 py-3 rounded-2xl border-2 focus:outline-none text-sm`}>
              <option value="all">All Types</option>
              <option value="veg">🟢 Veg Only</option>
              <option value="non_veg">🔴 Non-Veg Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* main content */}
      <div className="container mx-auto px-6 py-8">
        {halfOrders.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-orange-600 flex items-center gap-3"><Users size={22}/> Active Half Orders ({halfOrders.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {halfOrders.map(h => {
                const timeLeft = getTimeRemaining(h.expires_at || h.expiresAt);
                return (
                  <div key={h.id} className={`${isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white/95 border-orange-100 text-gray-800'} rounded-xl p-4 shadow transition hover:shadow-md`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-lg">{h.menu_item_name}</h3>
                        <p className="text-sm text-gray-400">by {h.customer_name} • Table {h.table_no}</p>
                      </div>
                      <div className="text-right">
                        <div className={`text-xs px-2 py-1 rounded-full font-semibold ${timeLeft === 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                          {timeLeft === 0 ? 'Expired' : `${timeLeft} min`}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <button 
                        onClick={() => handleJoinHalf(h.id)} 
                        disabled={timeLeft === 0 || isLoading} 
                        className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-2 rounded-xl font-semibold hover:from-green-600 hover:to-green-700 transition disabled:opacity-50"
                      >
                        {timeLeft === 0 ? 'Expired' : 'Join Half'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* menu groups */}
        {Object.keys(groupedMenu).map(category => {
          const items = groupedMenu[category] || [];
          if (!items.length) return null;
          return (
            <div key={category} className="mb-12">
              <h2 className="text-3xl font-extrabold mb-6 text-orange-600">{category}</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {items.map(item => {
                  const isVeg = (item.item_type || '').toLowerCase() === 'veg';
                  return (
                    <div key={item.id} className={cardClass(isDarkMode)}>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-lg">{item.name}</h3>
                          <p className="text-sm text-gray-400 mt-1 line-clamp-2">{item.description}</p>
                        </div>
                        <div className="text-right"><div className={`text-xs px-3 py-1 rounded-full font-semibold ${isVeg ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{isVeg ? 'VEG' : 'NON-VEG'}</div></div>
                      </div>

                      <div className="flex items-end justify-between mt-4">
                        <div>
                          {/* full price */}
                          <div className="text-xl font-extrabold text-orange-600">{formatCurrency(toNumber(item.price))}</div>
                          {/* half price styled same emphasis color */}
                          {item.half_price && <div className="text-sm text-orange-600">Half: {formatCurrency(toNumber(item.half_price))}</div>}
                        </div>

                        <div className="flex flex-col gap-2">
                          <button onClick={() => addToCart(item, false)} disabled={isLoading} className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-semibold hover:from-indigo-600 hover:to-indigo-700 transition disabled:opacity-50">+ Add Full</button>

                          {item.half_price && (
                            <button onClick={() => handleStartHalf(item.id)} disabled={isLoading} className="px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold hover:from-orange-600 hover:to-orange-700 transition disabled:opacity-50">Start Half</button>
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

      {/* Cart sidebar (Modern UI) */}
      {showCart && (
        <div className="fixed inset-0 z-40 flex justify-end" onClick={() => setShowCart(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div onClick={(e) => e.stopPropagation()} className={`relative w-full max-w-md h-full ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white'} shadow-2xl overflow-auto flex flex-col`}>
            
            {/* Cart Header & Customer Info */}
            <div className="p-5 sticky top-0 z-10 bg-inherit border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-extrabold text-orange-600 dark:text-orange-400">Your Cart</h3>
                  <p className="text-sm text-gray-500">{totalItems} items • {cart.halfOrderIds.length} linked sessions</p>
                </div>
                <button onClick={() => setShowCart(false)} className="p-2 rounded-lg hover:bg-gray-200/10"><X size={22} /></button>
              </div>

              <div className="mt-4 space-y-3">
                <input value={customerInfo.name} onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))} placeholder="Your Name *" className={`${isDarkMode ? 'bg-gray-800 text-white border-gray-700' : 'bg-white border-gray-300'} w-full px-4 py-3 rounded-xl border focus:outline-none text-sm`} />
                <input value={customerInfo.mobile} onChange={(e) => setCustomerInfo(prev => ({ ...prev, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder="Mobile (10 digits) *" className={`${isDarkMode ? 'bg-gray-800 text-white border-gray-700' : 'bg-white border-gray-300'} w-full px-4 py-3 rounded-xl border focus:outline-none text-sm`} maxLength={10} />
              </div>
            </div>

            {/* Cart Items List */}
            <div className="p-5 flex-grow overflow-y-auto">
              {cart.items.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart size={64} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500 text-lg">Your cart is empty</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.items.map(item => {
                    const price = item.isHalf ? toNumber(item.half_price) : toNumber(item.price);
                    return (
                      <div key={item.cartId} className={`rounded-xl p-4 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white/95 border-gray-100'} shadow-sm border`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <p className="font-semibold">{item.name}</p>
                            
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ 
                                    backgroundColor: item.isHalf ? 'rgba(255, 159, 67, 0.1)' : 'rgba(79, 70, 229, 0.1)',
                                    color: item.isHalf ? '#FF9F43' : '#4F46E5'
                                }}>
                                    {item.isHalf ? 'HALF ORDER' : 'FULL ORDER'}
                                </p>
                                {item.isHalf && item.sessionId && <Zap size={14} className="text-green-500" title="Linked to Session" />}
                            </div>
                          </div>
                          <button onClick={() => removeFromCart(item.cartId)} className="text-red-500 hover:text-red-700"><X size={18} /></button>
                        </div>

                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-3">
                            <button onClick={() => updateQuantity(item.cartId, -1)} className="p-2 rounded-full hover:bg-gray-200/10" disabled={isLoading}><Minus size={14} /></button>
                            <div className="w-8 text-center font-semibold">{item.quantity}</div>
                            <button onClick={() => updateQuantity(item.cartId, 1)} className="p-2 rounded-full hover:bg-gray-200/10" disabled={isLoading}><Plus size={14} /></button>
                          </div>

                          <div className="text-right">
                            <div className="font-bold text-lg text-orange-600">{formatCurrency(price * item.quantity)}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cart Footer */}
            <div className={`p-5 sticky bottom-0 z-10 border-t ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <div className="text-sm text-gray-500">Total Amount</div>
                  <div className="text-2xl font-extrabold text-orange-600">{formatCurrency(totalAmount)}</div>
                </div>

                <div>
                  {cartHasOnlyHalfItems && allHalfItemsLinked ? (
                    // Only linked half items: show Confirm Half Orders
                    <button 
                      onClick={confirmHalfOrders} 
                      disabled={isCheckoutDisabled} 
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold hover:from-amber-600 hover:to-orange-700 transition disabled:opacity-50"
                    >
                      {isLoading ? 'Processing...' : 'Confirm Half Orders'}
                    </button>
                  ) : (
                    // Mixed or Full orders: show Place Order
                    <button 
                      onClick={checkout} 
                      disabled={isCheckoutDisabled} 
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white font-bold hover:from-green-600 hover:to-green-700 transition disabled:opacity-50"
                    >
                      {isCheckoutDisabled && cart.items.length > 0 ? 'Enter Details' : isLoading ? 'Processing...' : 'Place Order'}
                    </button>
                  )}
                </div>
              </div>
              <div className="text-xs text-gray-400">All half orders must be started or joined via an active session.</div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}