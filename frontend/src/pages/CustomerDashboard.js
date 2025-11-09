import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { formatCurrency } from '../utils/helpers';
import { Clock, CheckCircle, Loader, XCircle, ChefHat, Bell, ArrowLeft } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const CustomerDashboard = () => {
  const { restaurant_id, table_no } = useParams();
  const navigate = useNavigate();
  const [activeOrders, setActiveOrders] = useState([]);
  const [halfOrders, setHalfOrders] = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ws, setWs] = useState(null);
  const [restaurant, setRestaurant] = useState(null);

  // WebSocket connection for real-time updates
  useEffect(() => {
    const wsUrl = `wss://${window.location.host.replace('https://', '')}/ws/${restaurant_id}`;
    const websocket = new WebSocket(wsUrl);
    
    websocket.onopen = () => {
      console.log('🔗 Connected to real-time updates');
    };
    
    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleWebSocketMessage(message);
    };
    
    websocket.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };
    
    setWs(websocket);
    
    return () => {
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.close();
      }
    };
  }, [restaurant_id]);

  const handleWebSocketMessage = (message) => {
    console.log('📨 Received update:', message);
    
    // Refresh data on any order/session update
    if (message.type === 'order.status_updated' || 
        message.type === 'order.created' ||
        message.type === 'session.created' ||
        message.type === 'session.joined') {
      fetchOrders();
      fetchHalfOrders();
    }
  };

  useEffect(() => {
    fetchRestaurant();
    fetchOrders();
    fetchHalfOrders();
    
    // Poll for updates every 10 seconds as backup
    const interval = setInterval(() => {
      fetchOrders();
      fetchHalfOrders();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [restaurant_id, table_no]);

  const fetchRestaurant = async () => {
    try {
      const res = await axios.get(`${API_URL}/restaurants/${restaurant_id}`);
      setRestaurant(res.data);
    } catch (err) {
      console.error('Restaurant fetch error:', err);
    }
  };

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(
        `${API_URL}/orders?restaurant_id=${restaurant_id}&page=1&page_size=50`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Filter orders for this table
      const tableOrders = res.data.orders.filter(order => 
        order.table_no === table_no || 
        order.table_no.includes(table_no)
      );
      
      // Separate active and completed
      const active = tableOrders.filter(order => 
        ['PENDING', 'PREPARING', 'READY'].includes(order.status)
      );
      
      const history = tableOrders.filter(order => 
        ['SERVED', 'COMPLETED', 'CANCELLED'].includes(order.status)
      );
      
      setActiveOrders(active);
      setOrderHistory(history);
      setLoading(false);
    } catch (err) {
      console.error('Orders fetch error:', err);
      setLoading(false);
    }
  };

  const fetchHalfOrders = async () => {
    try {
      const res = await axios.get(`${API_URL}/half-order/active?restaurant_id=${restaurant_id}`);
      
      // Filter sessions for this table
      const tableSessions = res.data.filter(session => 
        session.table_no === table_no || 
        session.joined_by_table_no === table_no
      );
      
      setHalfOrders(tableSessions);
    } catch (err) {
      console.error('Half orders fetch error:', err);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="text-orange-500" size={20} />;
      case 'PREPARING':
        return <ChefHat className="text-blue-500" size={20} />;
      case 'READY':
        return <Bell className="text-purple-500 animate-pulse" size={20} />;
      case 'SERVED':
        return <CheckCircle className="text-green-500" size={20} />;
      case 'COMPLETED':
        return <CheckCircle className="text-green-500" size={20} />;
      case 'CANCELLED':
        return <XCircle className="text-red-500" size={20} />;
      default:
        return <Loader className="text-gray-500 animate-spin" size={20} />;
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'PENDING': 'bg-orange-100 text-orange-800 border-orange-300',
      'PREPARING': 'bg-blue-100 text-blue-800 border-blue-300',
      'READY': 'bg-purple-100 text-purple-800 border-purple-300',
      'SERVED': 'bg-green-100 text-green-800 border-green-300',
      'COMPLETED': 'bg-green-100 text-green-800 border-green-300',
      'CANCELLED': 'bg-red-100 text-red-800 border-red-300'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getStatusMessage = (status) => {
    const messages = {
      'PENDING': '⏳ Your order has been received',
      'PREPARING': '👨‍🍳 Chef is preparing your order',
      'READY': '✨ Your order is ready! Please collect',
      'SERVED': '✅ Order served',
      'COMPLETED': '✅ Order completed',
      'CANCELLED': '❌ Order cancelled'
    };
    return messages[status] || status;
  };

  const getTimeRemaining = (expiresAt) => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diff = expiry - now;
    return Math.max(0, Math.floor(diff / 1000 / 60));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center">
        <Loader className="animate-spin text-orange-600" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100">
      {/* Header */}
      <div className="bg-white shadow-lg border-b-2 border-orange-400">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/menu/${restaurant_id}/${table_no}`)}
                className="p-2 hover:bg-orange-100 rounded-full transition"
              >
                <ArrowLeft size={24} className="text-orange-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-orange-600">
                  {restaurant?.name || 'My Orders'}
                </h1>
                <p className="text-sm text-gray-600">Table {table_no}</p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/menu/${restaurant_id}/${table_no}`)}
              className="bg-orange-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-orange-600 transition"
            >
              Order More
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Active Half-Order Sessions */}
        {halfOrders.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-orange-600">
              🤝 Your Half-Order Sessions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {halfOrders.map(session => {
                const timeLeft = getTimeRemaining(session.expires_at);
                const isCreator = session.table_no === table_no;
                
                return (
                  <div key={session.id} className="bg-gradient-to-br from-orange-100 to-amber-100 border-2 border-orange-400 rounded-xl p-4 shadow-lg">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-lg">{session.menu_item_name}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        session.status === 'ACTIVE' ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'
                      }`}>
                        {session.status}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <p className="text-gray-700">
                        {isCreator ? (
                          <>👤 You created this session</>
                        ) : (
                          <>👥 You joined {session.customer_name}'s session</>
                        )}
                      </p>
                      {session.status === 'JOINED' && (
                        <p className="text-green-700 font-semibold">
                          ✓ Paired with Table {isCreator ? session.joined_by_table_no : session.table_no}
                        </p>
                      )}
                      {session.status === 'ACTIVE' && (
                        <div className="flex items-center gap-2 text-orange-700 font-semibold">
                          <Clock size={16} />
                          <span>{timeLeft} minutes left</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Active Orders */}
        {activeOrders.length > 0 ? (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-orange-600">
              🔥 Active Orders
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {activeOrders.map(order => {
                const items = JSON.parse(order.items || '[]');
                const isPaired = order.table_no.includes('+');
                
                return (
                  <div
                    key={order.id}
                    className={`bg-white rounded-xl shadow-lg border-2 overflow-hidden ${
                      order.status === 'READY' 
                        ? 'border-purple-500 animate-pulse' 
                        : 'border-gray-200'
                    }`}
                  >
                    {/* Status Header */}
                    <div className={`px-4 py-3 ${getStatusColor(order.status)} border-b-2`}>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(order.status)}
                          <span className="font-bold">Order #{order.id}</span>
                        </div>
                        <span className="text-sm font-semibold">{order.status}</span>
                      </div>
                      <p className="text-xs mt-1">{getStatusMessage(order.status)}</p>
                    </div>

                    {/* Order Details */}
                    <div className="p-4">
                      {isPaired && (
                        <div className="bg-blue-50 border border-blue-300 rounded-lg p-2 mb-3">
                          <p className="text-xs text-blue-700 font-semibold">
                            👥 Shared Order: {order.table_no}
                          </p>
                          <p className="text-xs text-blue-600">{order.customer_name}</p>
                        </div>
                      )}

                      {/* Items List */}
                      <div className="space-y-2 mb-4">
                        {items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-800">{item.name}</p>
                              {item.type === 'paired' && (
                                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                                  Half-Order Shared
                                </span>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                              <p className="font-bold text-orange-600">{formatCurrency(item.price * item.quantity)}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Total */}
                      <div className="flex justify-between items-center pt-3 border-t-2 border-gray-200">
                        <span className="text-lg font-bold text-gray-800">Total:</span>
                        <span className="text-2xl font-bold text-orange-600">
                          {formatCurrency(order.total_amount)}
                        </span>
                      </div>

                      {/* Ready Notification */}
                      {order.status === 'READY' && (
                        <div className="mt-4 bg-purple-500 text-white p-3 rounded-lg text-center font-bold animate-pulse">
                          🔔 Your order is ready! Please collect from counter
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-xl shadow-lg">
            <div className="text-6xl mb-4">🍽️</div>
            <h3 className="text-2xl font-bold text-gray-700 mb-2">No Active Orders</h3>
            <p className="text-gray-600 mb-6">Place your first order from the menu!</p>
            <button
              onClick={() => navigate(`/menu/${restaurant_id}/${table_no}`)}
              className="bg-orange-500 text-white px-8 py-3 rounded-lg font-bold hover:bg-orange-600 transition"
            >
              Browse Menu
            </button>
          </div>
        )}

        {/* Order History */}
        {orderHistory.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4 text-gray-700">
              📜 Order History
            </h2>
            <div className="space-y-4">
              {orderHistory.map(order => {
                const items = JSON.parse(order.items || '[]');
                
                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-lg shadow-md border border-gray-200 p-4"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold text-gray-800">Order #{order.id}</p>
                        <p className="text-sm text-gray-600">
                          {new Date(order.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </div>
                    
                    <div className="space-y-1 mb-2">
                      {items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-gray-700">{item.name} × {item.quantity}</span>
                          <span className="text-gray-600">{formatCurrency(item.price * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                      <span className="font-semibold text-gray-800">Total:</span>
                      <span className="font-bold text-orange-600">{formatCurrency(order.total_amount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerDashboard;
