// /mnt/data/MenuPageProduction.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { formatCurrency } from '../utils/helpers';
import { Moon, Sun, Search, ShoppingCart, Users, X, Plus, Minus } from 'lucide-react';

/**
 * Production-ready Menu page (updated)
 * - If cart contains ONLY joined half-items -> show "Confirm Half Orders" (not Place Order)
 * - Half price color now same as full price everywhere
 * - All previous behavior preserved
 */

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

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

  // pending flags for flows that open the cart
  const [pendingStartMenuId, setPendingStartMenuId] = useState(null);
  const [pendingJoinSessionId, setPendingJoinSessionId] = useState(null);
  const [cartHalfSelection, setCartHalfSelection] = useState('');

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
      ws.onmessage = (e) => { try { handleWebSocketMessage(JSON.parse(e.data)); } catch (err) {} };
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
    if (message.type === 'session.created' || message.type === 'session.joined') fetchHalfOrders();
  };

  useEffect(() => {
    fetchRestaurant();
    fetchMenu();
    fetchHalfOrders();
    const t = setInterval(fetchHalfOrders, 15000);
    return () => clearInterval(t);
  }, []);

  const fetchRestaurant = async () => {
    try { const r = await axios.get(`${API_URL}/restaurants/${restaurant_id}`); setRestaurant(r.data); } catch (e) { console.error(e); }
  };
  const fetchMenu = async () => {
    try { const r = await axios.get(`${API_URL}/restaurants/${restaurant_id}/menu`); setMenuItems(r.data || []); } catch (e) { console.error(e); }
  };
  const fetchHalfOrders = async () => {
    try {
      const r = await axios.get(`${API_URL}/half-order/active?restaurant_id=${restaurant_id}`);
      const act = (r.data || []).filter(h => new Date(h.expires_at || h.expiresAt || Date.now()) > new Date());
      setHalfOrders(act);
    } catch (e) { console.error(e); }
  };

  const getTimeRemaining = (expiresAt) => {
    const expiry = new Date(expiresAt || Date.now());
    const diff = Math.max(0, expiry - new Date());
    return Math.floor(diff / 1000 / 60);
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

  const toNumber = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

  // CART OPERATIONS
  const addToCart = useCallback((item, isHalf = false, sessionId = null) => {
    setCart(prev => {
      const price = toNumber(item.price ?? item.cost ?? 0);
      const half_price = toNumber(item.half_price ?? Math.round(price / 2));
      const idx = prev.items.findIndex(it => it.id === item.id && it.isHalf === isHalf && (!isHalf || it.sessionId === sessionId));
      if (idx >= 0) { const cp = [...prev.items]; cp[idx].quantity += 1; return { ...prev, items: cp }; }
      const cartItem = { id: item.id, name: item.name, price, half_price, quantity: 1, isHalf, sessionId: sessionId || null, cartId: Date.now() + Math.random() };
      return { ...prev, items: [...prev.items, cartItem] };
    });
  }, []);

  const updateQuantity = useCallback((cartId, delta) => setCart(prev => ({ ...prev, items: prev.items.map(it => it.cartId === cartId ? { ...it, quantity: Math.max(1, it.quantity + delta) } : it) })), []);
  const removeFromCart = useCallback((cartId) => setCart(prev => ({ ...prev, items: prev.items.filter(it => it.cartId !== cartId) })), []);

  // Start half from cart/menu (requires name/mobile)
  const createHalfOrder = async (menuItem) => {
    if (!customerInfo.name || customerInfo.mobile.length !== 10) {
      setShowCart(true);
      alert('Please enter your name and 10-digit mobile in the cart to start a half session.');
      return;
    }
    try {
      const res = await axios.post(`${API_URL}/half-order?restaurant_id=${restaurant_id}&table_no=${table_no}`, {
        customer_name: customerInfo.name,
        customer_mobile: customerInfo.mobile,
        menu_item_id: menuItem.id
      });
      const session = res.data || {};
      const sid = session.id || session.session_id || null;
      addToCart(menuItem, true, sid);
      setCart(prev => ({ ...prev, halfOrderIds: sid ? [...new Set([...prev.halfOrderIds, sid])] : prev.halfOrderIds }));
      alert(`Half session started — expires in ${getTimeRemaining(session.expires_at || session.expiresAt || Date.now())} min`);
      fetchHalfOrders();
      setPendingStartMenuId(null);
      setCartHalfSelection('');
    } catch (e) {
      alert('Failed to create half session: ' + (e.response?.data?.detail || e.message || 'error'));
    }
  };

  // Open cart to join session (no auto-add)
  const openCartForJoinSession = (sessionId) => {
    setPendingJoinSessionId(sessionId);
    setShowCart(true);
  };

  // Join from cart (explicit)
  const joinHalfOrderFromCart = async (sessionId) => {
    if (!customerInfo.name || customerInfo.mobile.length !== 10) {
      setShowCart(true);
      alert('Please enter your name and 10-digit mobile in the cart to join the session.');
      return;
    }
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
      const template = original || { id: menuId, name: menuName, price: toNumber(session.price ?? session.menu_item?.price ?? 0), half_price: toNumber(session.half_price ?? session.menu_item?.half_price ?? 0) };
      addToCart(template, true, sessionId);
      setCart(prev => ({ ...prev, halfOrderIds: [...new Set([...prev.halfOrderIds, sessionId])] }));
      alert('Joined half session and added to cart.');
      fetchHalfOrders();
      setPendingJoinSessionId(null);
    } catch (e) {
      alert('Failed to join session: ' + (e.response?.data?.detail || e.message || 'error'));
    }
  };

  // Called when user clicks Start Half on menu: open cart with selection
  const openCartForStartHalf = (menuItemId) => {
    setPendingStartMenuId(menuItemId);
    setCartHalfSelection(String(menuItemId));
    setShowCart(true);
  };

  // Checkout — same server call but button label will be appropriate for context
  const checkout = async () => {
    if (!customerInfo.name || customerInfo.mobile.length !== 10) {
      alert('Please enter your name and a valid 10-digit mobile number.');
      return;
    }
    if (cart.items.length === 0) {
      alert('Cart is empty');
      return;
    }
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
        paired_order_ids: cart.halfOrderIds
      });
      alert('Order placed successfully!');
      setCart({ items: [], halfOrderIds: [] });
      setShowCart(false);
      navigate('/order-success');
    } catch (e) {
      alert('Checkout failed: ' + (e.response?.data?.detail || e.message || 'error'));
    }
  };

  // new convenience method: confirm half orders (same payload as checkout but label is different)
  const confirmHalfOrders = async () => {
    // confirm half-only cart
    await checkout();
  };

  const totalAmount = useMemo(() => cart.items.reduce((s, it) => s + (it.isHalf ? toNumber(it.half_price) : toNumber(it.price)) * it.quantity, 0), [cart.items]);
  const totalItems = useMemo(() => cart.items.reduce((s, it) => s + it.quantity, 0), [cart.items]);

  // UI helper lists
  const halfCapableMenu = useMemo(() => menuItems.filter(mi => mi.half_price && mi.available !== false), [menuItems]);
  const cardClass = (dark) => `rounded-2xl transition-all p-5 border ${dark ? 'bg-gradient-to-br from-gray-800 to-gray-700 border-gray-700 text-white' : 'bg-white/95 border-orange-100 text-gray-800'} shadow`;
  const controlColorScheme = { colorScheme: isDarkMode ? 'dark' : 'light' };

  // Determine footer button behavior:
  const cartHasOnlyHalfItems = cart.items.length > 0 && cart.items.every(it => it.isHalf);
  const allHalfItemsLinked = cartHasOnlyHalfItems && cart.items.every(it => !!it.sessionId);

  return (
    <div className={`${isDarkMode ? 'dark' : ''} ${isDarkMode ? 'bg-gray-900 text-white min-h-screen' : 'bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 min-h-screen'}`}>
      {/* header */}
      <div className={`sticky top-0 z-60 ${isDarkMode ? 'bg-gray-900 border-b border-gray-800' : 'bg-white border-b border-orange-100'}`}>
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className={`${isDarkMode ? 'text-orange-300' : 'text-orange-600'} text-2xl md:text-3xl font-extrabold`}>{restaurant?.name || 'The Orange Bistro'}</h1>
              <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} text-sm`}>Table {table_no}</p>
            </div>

            <div className="flex gap-3 items-center">
              <button onClick={() => navigate(`/my-orders/${restaurant_id}/${table_no}`)} className="hidden sm:inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow">My Orders</button>
              <button onClick={() => setShowCart(!showCart)} className="relative p-2 rounded-xl hover:bg-orange-100/10 transition"><ShoppingCart size={26} className="text-orange-500" />{totalItems>0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold">{totalItems}</span>}</button>
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-xl hover:bg-orange-100/10 transition">{isDarkMode ? <Sun size={20}/> : <Moon size={20}/>}</button>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-4 top-3 text-gray-400" size={18}/>
              <input style={controlColorScheme} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search dishes..." className={`${isDarkMode ? 'bg-gray-800 text-white border-gray-700' : 'bg-white text-gray-700 border-orange-200'} w-full pl-12 pr-4 py-3 rounded-2xl border-2 focus:outline-none text-sm`} />
            </div>

            <select style={controlColorScheme} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={`${isDarkMode ? 'bg-gray-800 text-white border-gray-700' : 'bg-white text-gray-700 border-orange-200'} px-4 py-3 rounded-2xl border-2 focus:outline-none text-sm`}>
              <option value="all">All Categories</option>
              {displayCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>

            <select style={controlColorScheme} value={itemTypeFilter} onChange={(e) => setItemTypeFilter(e.target.value)} className={`${isDarkMode ? 'bg-gray-800 text-white border-gray-700' : 'bg-white text-gray-700 border-orange-200'} px-4 py-3 rounded-2xl border-2 focus:outline-none text-sm`}>
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
                  <div key={h.id} className={`${isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white/95 border-orange-100 text-gray-800'} rounded-xl p-4 shadow`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-lg">{h.menu_item_name}</h3>
                        <p className="text-sm text-gray-400">by {h.customer_name} • Table {h.table_no}</p>
                      </div>
                      <div className="text-right"><div className="text-xs bg-orange-50 text-orange-600 px-2 py-1 rounded-full">{timeLeft} min</div></div>
                    </div>
                    <div className="mt-3">
                      <button onClick={() => openCartForJoinSession(h.id)} disabled={timeLeft === 0} className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-2 rounded-xl font-semibold disabled:opacity-50">{timeLeft === 0 ? 'Expired' : 'Join Half'}</button>
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
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-extrabold mb-6 text-orange-600">{category}</h2>
                <div className="text-sm text-gray-500">Tap to add • Start half sessions from item or cart</div>
              </div>

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
                        <div className="text-right"><div className={`text-xs px-3 py-1 rounded-full ${isVeg ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{isVeg ? 'VEG' : 'NON-VEG'}</div></div>
                      </div>

                      <div className="flex items-end justify-between mt-4">
                        <div>
                          {/* full price */}
                          <div className="text-xl font-extrabold text-orange-600">{formatCurrency(toNumber(item.price))}</div>
                          {/* half price styled same emphasis color */}
                          {item.half_price && <div className="text-sm text-orange-600">Half: {formatCurrency(toNumber(item.half_price))}</div>}
                        </div>

                        <div className="flex flex-col gap-2">
                          <button onClick={() => addToCart(item, false)} className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-semibold">+ Add Full</button>

                          {item.half_price && (
                            <button onClick={() => openCartForStartHalf(item.id)} className="px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold">Start Half</button>
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

      {/* Cart sidebar */}
      {showCart && (
        <div className="fixed inset-0 z-70 flex justify-end" onClick={() => setShowCart(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div onClick={(e) => e.stopPropagation()} className={`relative w-full max-w-md h-full ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white'} shadow-2xl overflow-auto`}>
            <div className="p-5 sticky top-0 bg-opacity-100 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-extrabold text-orange-600">Your Cart</h3>
                  <p className="text-sm text-gray-500">{totalItems} items • {cart.halfOrderIds.length ? `${cart.halfOrderIds.length} half sessions` : 'No half sessions'}</p>
                </div>
                <button onClick={() => setShowCart(false)} className="p-2 rounded-lg hover:bg-gray-200/10"><X size={22} /></button>
              </div>

              <div className="mt-4 space-y-3">
                <input style={controlColorScheme} value={customerInfo.name} onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))} placeholder="Your Name *" className={`${isDarkMode ? 'bg-gray-800 text-white border-gray-700' : 'bg-white'} w-full px-4 py-3 rounded-xl border-2`} />
                <input style={controlColorScheme} value={customerInfo.mobile} onChange={(e) => setCustomerInfo(prev => ({ ...prev, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder="Mobile (10 digits) *" className={`${isDarkMode ? 'bg-gray-800 text-white border-gray-700' : 'bg-white'} w-full px-4 py-3 rounded-xl border-2`} />
              </div>

              {/* Cart-side Start Half */}
              <div className="mt-4 flex gap-2 items-center">
                <select value={cartHalfSelection} onChange={(e) => setCartHalfSelection(e.target.value)} className={`${isDarkMode ? 'bg-gray-800 text-white border-gray-700' : 'bg-white text-gray-700 border-orange-200'} w-full px-4 py-2 rounded-xl border-2 focus:outline-none text-sm`}>
                  <option value="">Pick item to start half session</option>
                  {halfCapableMenu.map(mi => <option key={mi.id} value={mi.id}>{mi.name} — {formatCurrency(toNumber(mi.half_price))}</option>)}
                </select>

                <button onClick={() => {
                  if (!cartHalfSelection) { alert('Select an item to start a half session.'); return; }
                  const menuItem = menuItems.find(mi => String(mi.id) === String(cartHalfSelection));
                  if (!menuItem) { alert('Selected item not found.'); return; }
                  createHalfOrder(menuItem);
                  setCartHalfSelection('');
                  setPendingStartMenuId(null);
                }} disabled={!customerInfo.name || customerInfo.mobile.length !== 10 || !cartHalfSelection} className="px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold disabled:opacity-50">
                  Start Half Session
                </button>
              </div>

              {/* If cart opened from a Join action, show Join Session button (explicit) */}
              {pendingJoinSessionId && (
                <div className="mt-4">
                  <div className="text-sm text-gray-500 mb-2">Joining session</div>
                  <div className="flex gap-2">
                    <button onClick={() => joinHalfOrderFromCart(pendingJoinSessionId)} disabled={!customerInfo.name || customerInfo.mobile.length !== 10} className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold disabled:opacity-50">
                      Join Session
                    </button>
                    <button onClick={() => { setPendingJoinSessionId(null); }} className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-5">
              {cart.items.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart size={64} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500 text-lg">Your cart is empty</p>
                  <button onClick={() => setShowCart(false)} className="mt-4 px-6 py-2 bg-orange-600 text-white rounded-xl font-semibold">Browse Menu</button>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {cart.items.map(item => {
                      const original = menuItems.find(mi => String(mi.id) === String(item.id));
                      return (
                        <div key={item.cartId} className={`rounded-xl p-4 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white/95 border-gray-100'} shadow-sm`}>
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <p className="font-semibold">{item.name}</p>
                              {/* Half/Full label */}
                              <p className="text-xs text-gray-400">{item.isHalf ? 'Half Order' : 'Full Order'}</p>
                              {/* half price styled same as full price */}
                              {item.isHalf && <p className="text-sm text-orange-600 mt-1">Half Price: {formatCurrency(toNumber(item.half_price))}</p>}
                            </div>
                            <button onClick={() => removeFromCart(item.cartId)} className="text-red-500 hover:text-red-700"><X size={18} /></button>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <button onClick={() => updateQuantity(item.cartId, -1)} className="p-2 rounded-full hover:bg-gray-200/10"><Minus size={14} /></button>
                              <div className="w-8 text-center font-semibold">{item.quantity}</div>
                              <button onClick={() => updateQuantity(item.cartId, 1)} className="p-2 rounded-full hover:bg-gray-200/10"><Plus size={14} /></button>
                            </div>

                            <div className="text-right">
                              <div className="font-bold text-lg text-orange-600">{formatCurrency((item.isHalf ? toNumber(item.half_price) : toNumber(item.price)) * item.quantity)}</div>

                              {/* Start Half from cart for eligible full items */}
                              {!item.isHalf && original && original.half_price && (
                                <div className="mt-2">
                                  <button onClick={() => { setPendingStartMenuId(original.id); setCartHalfSelection(String(original.id)); }} className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold">Start Half</button>
                                </div>
                              )}

                              {/* If half-item without sessionId, offer join if an active session exists */}
                              {item.isHalf && !item.sessionId && (() => {
                                const sessionForThis = halfOrders.find(h => normalizeCategory(h.menu_item_name || '') === normalizeCategory(item.name || ''));
                                if (sessionForThis) {
                                  return (
                                    <div className="mt-2">
                                      <button onClick={() => joinHalfOrderFromCart(sessionForThis.id)} className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-500 to-green-600 text-white text-sm font-semibold">Join Half</button>
                                    </div>
                                  );
                                }
                                return null;
                              })()}

                              {item.isHalf && item.sessionId && <div className="mt-2 text-sm text-green-600 font-semibold">Half session linked</div>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* FOOTER: show Confirm Half Orders if cart is only linked half items, else show Place Order */}
                  <div className="mt-6 border-t pt-4">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <div className="text-sm text-gray-500">Subtotal</div>
                        <div className="text-2xl font-extrabold text-orange-600">{formatCurrency(totalAmount)}</div>
                      </div>

                      <div>
                        {cartHasOnlyHalfItems && allHalfItemsLinked ? (
                          // Customer has only half items and they are joined/linked -> show Confirm Half Orders
                          <button onClick={confirmHalfOrders} className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold">
                            Confirm Half Orders
                          </button>
                        ) : (
                          // otherwise show normal place order button
                          <button onClick={checkout} disabled={!customerInfo.name || customerInfo.mobile.length !== 10} className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white font-bold disabled:opacity-50">
                            {(!customerInfo.name || customerInfo.mobile.length !== 10) ? 'Enter Details' : 'Place Order'}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-gray-400">You can start half sessions here or from menu items. Half sessions will be paired automatically on checkout.</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
