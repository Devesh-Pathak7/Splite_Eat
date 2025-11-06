import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { WebSocketProvider, useWebSocket } from '../context/WebSocketContext';
import { useTheme } from '../context/ThemeContext';
import { ShoppingCart, Users, Clock, Filter, Moon, Sun } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const MenuPageContent = () => {
  const { restaurant_id, table_no } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [halfOrders, setHalfOrders] = useState([]);
  const [cart, setCart] = useState([]);
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showHalfOrderDialog, setShowHalfOrderDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState(null);
  const [selectedHalfOrder, setSelectedHalfOrder] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const { lastMessage } = useWebSocket();
  const { isDarkMode, toggleTheme } = useTheme();

  useEffect(() => {
    fetchRestaurant();
    fetchMenu();
    fetchHalfOrders();
  }, [restaurant_id, table_no]);

  useEffect(() => {
    if (lastMessage) {
      handleWebSocketMessage(lastMessage);
    }
  }, [lastMessage]);

  const handleWebSocketMessage = (message) => {
    switch (message.type) {
      case 'menu_update':
        fetchMenu();
        break;
      case 'half_order_created':
      case 'half_order_joined':
        fetchHalfOrders();
        break;
      default:
        break;
    }
  };

  const fetchRestaurant = async () => {
    try {
      const response = await axios.get(`${API_URL}/restaurants/${restaurant_id}`);
      setRestaurant(response.data);
    } catch (error) {
      toast.error('Failed to load restaurant info');
    }
  };

  const fetchMenu = async () => {
    try {
      const response = await axios.get(`${API_URL}/restaurants/${restaurant_id}/menu`);
      setMenuItems(response.data);
    } catch (error) {
      toast.error('Failed to load menu');
    }
  };

  const fetchHalfOrders = async () => {
    try {
      const response = await axios.get(`${API_URL}/restaurants/${restaurant_id}/tables/${table_no}/half-orders`);
      setHalfOrders(response.data);
    } catch (error) {
      console.error('Failed to load half orders:', error);
    }
  };

  const createHalfOrder = async () => {
    try {
      await axios.post(`${API_URL}/restaurants/${restaurant_id}/tables/${table_no}/half-orders`, {
        customer_name: customerName,
        customer_mobile: customerMobile,
        menu_item_id: selectedMenuItem.id
      });
      toast.success('Half order created! Waiting for someone to join...');
      setShowHalfOrderDialog(false);
      setCustomerName('');
      setCustomerMobile('');
      fetchHalfOrders();
    } catch (error) {
      toast.error('Failed to create half order');
    }
  };

  const joinHalfOrder = async () => {
    try {
      await axios.post(`${API_URL}/half-orders/${selectedHalfOrder.id}/join`, {
        customer_name: customerName,
        customer_mobile: customerMobile
      });
      toast.success('Successfully joined half order!');
      setShowJoinDialog(false);
      setCustomerName('');
      setCustomerMobile('');
      fetchHalfOrders();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to join half order');
    }
  };

  const addToCart = (item) => {
    const existing = cart.find(c => c.id === item.id);
    if (existing) {
      setCart(cart.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
    toast.success('Added to cart');
  };

  const placeOrder = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    if (!customerName || !customerMobile) {
      toast.error('Please enter your name and mobile number');
      return;
    }

    try {
      const orderItems = cart.map(item => ({
        menu_item_id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price
      }));

      await axios.post(`${API_URL}/restaurants/${restaurant_id}/tables/${table_no}/orders`, {
        customer_name: customerName,
        phone: customerMobile,
        items: orderItems
      });

      toast.success('Order placed successfully!');
      setCart([]);
      setCustomerName('');
      setCustomerMobile('');
    } catch (error) {
      toast.error('Failed to place order');
    }
  };

  const categories = ['all', ...new Set(menuItems.map(item => item.category).filter(Boolean))];
  const filteredMenu = menuItems.filter(item => {
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch && item.available;
  });

  const getRemainingTime = (expiresAt) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires - now;
    if (diff <= 0) return 'Expired';
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m remaining`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 transition-colors duration-500">
      <button
        onClick={toggleTheme}
        className="fixed top-6 right-6 p-3 rounded-full bg-white/70 dark:bg-gray-800/70 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-300 z-50"
        data-testid="theme-toggle-btn"
      >
        {isDarkMode ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-gray-700" />}
      </button>

      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl shadow-xl p-8 mb-6 border border-white/20 dark:border-gray-700/20">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-600 dark:from-amber-400 dark:to-orange-500" style={{ fontFamily: 'Space Grotesk, sans-serif' }} data-testid="restaurant-name">
            {restaurant?.name || 'Loading...'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2" style={{ fontFamily: 'Inter, sans-serif' }} data-testid="table-info">
            Table {table_no} • {restaurant?.location}
          </p>
        </div>

        {halfOrders.length > 0 && (
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              <Users className="inline w-6 h-6 mr-2" />Active Half Orders
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {halfOrders.map(order => (
                <Card key={order.id} className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md border-orange-200 dark:border-amber-700/30" data-testid={`half-order-${order.id}`}>
                  <CardHeader>
                    <CardTitle className="text-lg" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{order.menu_item_name}</CardTitle>
                    <CardDescription>by {order.customer_name}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="bg-orange-100 dark:bg-amber-900/30 text-orange-700 dark:text-amber-400">
                        <Clock className="w-3 h-3 mr-1" />
                        {getRemainingTime(order.expires_at)}
                      </Badge>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedHalfOrder(order);
                          setShowJoinDialog(true);
                        }}
                        className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700"
                        data-testid={`join-half-order-${order.id}-btn`}
                      >
                        Join
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="mb-6 flex flex-col md:flex-row gap-4">
          <Input
            placeholder="Search menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-white/50 dark:bg-gray-700/50 backdrop-blur-md"
            data-testid="menu-search-input"
          />
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="md:w-48 bg-white/50 dark:bg-gray-700/50 backdrop-blur-md" data-testid="category-filter">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMenu.map(item => (
            <Card key={item.id} className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]" data-testid={`menu-item-${item.id}`}>
              <CardHeader>
                <CardTitle style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{item.name}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-orange-600 dark:text-amber-500" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                      ${item.price.toFixed(2)}
                    </span>
                    {item.half_price && (
                      <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                        Half: ${item.half_price.toFixed(2)}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => addToCart(item)}
                      className="flex-1 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700"
                      data-testid={`add-to-cart-${item.id}-btn`}
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />Add
                    </Button>
                    {item.half_price && (
                      <Button
                        onClick={() => {
                          setSelectedMenuItem(item);
                          setShowHalfOrderDialog(true);
                        }}
                        variant="outline"
                        className="flex-1 border-orange-500 dark:border-amber-500 text-orange-600 dark:text-amber-500"
                        data-testid={`half-order-${item.id}-btn`}
                      >
                        <Users className="w-4 h-4 mr-2" />Half
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {cart.length > 0 && (
          <div className="fixed bottom-6 right-6 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-2xl p-6 max-w-md border border-white/20 dark:border-gray-700/20" data-testid="cart-panel">
            <h3 className="text-xl font-bold mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Your Cart</h3>
            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
              {cart.map(item => (
                <div key={item.id} className="flex justify-between items-center">
                  <span>{item.name} x{item.quantity}</span>
                  <span className="font-semibold">${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="border-t dark:border-gray-700 pt-3 mb-4">
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span className="text-orange-600 dark:text-amber-500">
                  ${cart.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)}
                </span>
              </div>
            </div>
            <div className="space-y-3">
              <Input
                placeholder="Your name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                data-testid="cart-customer-name-input"
              />
              <Input
                placeholder="Mobile number"
                value={customerMobile}
                onChange={(e) => setCustomerMobile(e.target.value)}
                data-testid="cart-customer-mobile-input"
              />
              <Button
                onClick={placeOrder}
                className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700"
                data-testid="place-order-btn"
              >
                Place Order
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showHalfOrderDialog} onOpenChange={setShowHalfOrderDialog}>
        <DialogContent className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Create Half Order</DialogTitle>
            <DialogDescription>
              Start a half order for {selectedMenuItem?.name}. Another customer can join within 30 minutes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Your Name</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter your name"
                data-testid="half-order-name-input"
              />
            </div>
            <div>
              <Label>Mobile Number</Label>
              <Input
                value={customerMobile}
                onChange={(e) => setCustomerMobile(e.target.value)}
                placeholder="Enter mobile number"
                data-testid="half-order-mobile-input"
              />
            </div>
            <Button
              onClick={createHalfOrder}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700"
              data-testid="create-half-order-btn"
            >
              Create Half Order
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Join Half Order</DialogTitle>
            <DialogDescription>
              Join {selectedHalfOrder?.customer_name}'s half order for {selectedHalfOrder?.menu_item_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Your Name</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter your name"
                data-testid="join-name-input"
              />
            </div>
            <div>
              <Label>Mobile Number</Label>
              <Input
                value={customerMobile}
                onChange={(e) => setCustomerMobile(e.target.value)}
                placeholder="Enter mobile number"
                data-testid="join-mobile-input"
              />
            </div>
            <Button
              onClick={joinHalfOrder}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700"
              data-testid="join-submit-btn"
            >
              Join Half Order
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const MenuPage = () => {
  const { restaurant_id } = useParams();
  
  return (
    <WebSocketProvider restaurantId={parseInt(restaurant_id)}>
      <MenuPageContent />
    </WebSocketProvider>
  );
};

export default MenuPage;