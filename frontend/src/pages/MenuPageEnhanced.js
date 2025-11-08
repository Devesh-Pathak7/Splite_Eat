import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { formatCurrency, getItemTypeIndicator, getTimeRemaining } from '../utils/helpers';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const MenuPageEnhanced = () => {
  const { restaurant_id, table_no } = useParams();
  const [menuItems, setMenuItems] = useState([]);
  const [halfOrders, setHalfOrders] = useState([]);
  const [cart, setCart] = useState({ fullItems: [], halfOrderId: null });
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');

  useEffect(() => {
    fetchMenu();
    fetchHalfOrders();
    const interval = setInterval(fetchHalfOrders, 15000);
    return () => clearInterval(interval);
  }, []);

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
      setHalfOrders(res.data.filter(h => getTimeRemaining(h.expires_at) > 0));
    } catch (err) {
      console.error('Half orders fetch error:', err);
    }
  };

  const addToCart = (item, isHalf = false) => {
    setCart(prev => ({
      ...prev,
      fullItems: [...prev.fullItems, { ...item, quantity: 1, isHalf }]
    }));
  };

  const createHalfOrder = async (menuItem) => {
    if (!customerName || !customerMobile) return alert('Enter name and mobile');
    if (customerMobile.length !== 10) return alert('Mobile must be 10 digits');
    
    try {
      await axios.post(
        `${API_URL}/half-order?restaurant_id=${restaurant_id}&table_no=${table_no}`,
        {
          customer_name: customerName,
          customer_mobile: customerMobile,
          menu_item_id: menuItem.id
        }
      );
      alert('Half-order created! Others can join now.');
      fetchHalfOrders();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.detail || 'Failed'));
    }
  };

  const joinHalfOrder = async (sessionId) => {
    if (!customerName || !customerMobile) return alert('Enter name and mobile');
    
    try {
      await axios.post(`${API_URL}/half-order/${sessionId}/join`, {
        table_no: table_no,
        customer_name: customerName,
        customer_mobile: customerMobile
      });
      alert('Joined half-order successfully!');
      setCart(prev => ({ ...prev, halfOrderId: sessionId }));
    } catch (err) {
      alert('Error: ' + (err.response?.data?.detail || 'Failed'));
    }
  };

  const checkout = async () => {
    if (!customerName || !customerMobile) return alert('Enter customer details');
    if (cart.fullItems.length === 0 && !cart.halfOrderId) return alert('Cart is empty');

    try {
      const orderItems = cart.fullItems.map(item => ({
        menu_item_id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.isHalf ? item.half_price : item.price
      }));

      await axios.post(`${API_URL}/orders`, {
        restaurant_id: parseInt(restaurant_id),
        table_no: table_no,
        customer_name: customerName,
        phone: customerMobile,
        items: orderItems,
        paired_order_ids: cart.halfOrderId ? [cart.halfOrderId] : []
      });

      alert('Order placed successfully!');
      setCart({ fullItems: [], halfOrderId: null });
    } catch (err) {
      alert('Checkout failed: ' + (err.response?.data?.detail || 'Error'));
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Menu - Table {table_no}</h1>
      
      {/* Customer Info */}
      <div className="bg-white p-4 rounded-lg shadow mb-6 grid grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="Your Name"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          className="border p-2 rounded"
        />
        <input
          type="tel"
          placeholder="Mobile (10 digits)"
          value={customerMobile}
          onChange={(e) => setCustomerMobile(e.target.value)}
          maxLength={10}
          className="border p-2 rounded"
        />
      </div>

      {/* Active Half Orders */}
      {halfOrders.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-orange-600">🍽️ Active Half Orders</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {halfOrders.map(ho => (
              <div key={ho.id} className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4">
                <h3 className="font-bold text-lg">{ho.menu_item_name}</h3>
                <p className="text-sm text-gray-600">Started by: {ho.customer_name}</p>
                <p className="text-sm text-gray-600">Table: {ho.table_no}</p>
                <p className="text-sm font-semibold text-orange-600">
                  ⏱️ Expires in: {getTimeRemaining(ho.expires_at)} min
                </p>
                <button
                  onClick={() => joinHalfOrder(ho.id)}
                  disabled={getTimeRemaining(ho.expires_at) === 0}
                  className="mt-3 w-full bg-green-500 text-white py-2 rounded hover:bg-green-600 disabled:bg-gray-300"
                >
                  {getTimeRemaining(ho.expires_at) === 0 ? '⏰ Expired' : '👥 Join Now'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Menu Items */}
      <h2 className="text-2xl font-bold mb-4">Full Menu</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {menuItems.map(item => {
          const badge = getItemTypeIndicator(item.item_type);
          return (
            <div key={item.id} className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg">{item.name}</h3>
                <span className={`px-2 py-1 rounded text-xs text-white bg-${badge.color}-500`}>
                  {badge.icon} {badge.label}
                </span>
              </div>
              <p className="text-gray-600 text-sm mb-3">{item.description}</p>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-lg">{formatCurrency(item.price)}</p>
                  {item.half_price && (
                    <p className="text-sm text-gray-500">Half: {formatCurrency(item.half_price)}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => addToCart(item, false)}
                    className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                  >
                    Add Full
                  </button>
                  {item.half_price && (
                    <button
                      onClick={() => createHalfOrder(item)}
                      className="bg-orange-500 text-white px-3 py-1 rounded text-sm hover:bg-orange-600"
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

      {/* Cart */}
      {(cart.fullItems.length > 0 || cart.halfOrderId) && (
        <div className="fixed bottom-0 right-0 m-6 bg-white rounded-lg shadow-2xl p-6 max-w-md">
          <h3 className="text-xl font-bold mb-4">🛒 Your Cart</h3>
          {cart.halfOrderId && (
            <p className="text-green-600 mb-2">✓ Joined Half-Order Session</p>
          )}
          {cart.fullItems.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center mb-2 pb-2 border-b">
              <span>{item.name} {item.isHalf ? '(Half)' : '(Full)'}</span>
              <span>{formatCurrency(item.isHalf ? item.half_price : item.price)}</span>
            </div>
          ))}
          <div className="flex justify-between items-center font-bold text-lg mt-4 pt-4 border-t">
            <span>Total:</span>
            <span>
              {formatCurrency(
                cart.fullItems.reduce((sum, item) => 
                  sum + (item.isHalf ? item.half_price : item.price) * item.quantity, 0
                )
              )}
            </span>
          </div>
          <button
            onClick={checkout}
            className="w-full mt-4 bg-green-500 text-white py-3 rounded-lg font-bold hover:bg-green-600"
          >
            Place Order
          </button>
        </div>
      )}
    </div>
  );
};

export default MenuPageEnhanced;
