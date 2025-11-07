import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { WebSocketProvider, useWebSocket } from '../context/WebSocketContext';
import { useTheme } from '../context/ThemeContext';
import { ShoppingCart, Users, Clock, Filter, Moon, Sun, X } from 'lucide-react';
import { formatCurrency, getItemTypeIndicator, getTimeRemaining, validateMobile, getRestaurantTypeLabel } from '../utils/helpers';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const MenuPageContent = () => {
  const { restaurant_id, table_no } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [halfOrders, setHalfOrders] = useState([]);
  const [cart, setCart] = useState([]);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterItemType, setFilterItemType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showHalfOrderDialog, setShowHalfOrderDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showCart, setShowCart] = useState(false);
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
    const interval = setInterval(fetchHalfOrders, 30000); // Refresh every 30s
    return () => clearInterval(interval);
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
        toast.info('Menu updated!');
        break;
      case 'half_order_created':
        fetchHalfOrders();
        toast.success('New half order available!');
        break;
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
    if (!validateMobile(customerMobile)) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }

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
      toast.error(error.response?.data?.detail || 'Failed to create half order');
    }
  };

  const joinHalfOrder = async () => {
    if (!validateMobile(customerMobile)) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/half-orders/${selectedHalfOrder.id}/join-enhanced`, {
        customer_name: customerName,
        customer_mobile: customerMobile,
        table_no: table_no
      });
      toast.success(`Successfully joined! ${response.data.table_pairing}`);
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
    setShowCart(true);
    toast.success(`${item.name} added to cart`);
  };

  const removeFromCart = (itemId) => {
    setCart(cart.filter(c => c.id !== itemId));
    toast.info('Item removed from cart');
  };

  const updateQuantity = (itemId, delta) => {
    setCart(cart.map(c => {
      if (c.id === itemId) {
        const newQuantity = c.quantity + delta;
        return newQuantity > 0 ? { ...c, quantity: newQuantity } : c;
      }
      return c;
    }).filter(c => c.quantity > 0));
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

    if (!validateMobile(customerMobile)) {
      toast.error('Please enter a valid 10-digit mobile number');
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

      toast.success('Order placed successfully! 🍽️');
      setCart([]);
      setShowCart(false);
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
    const matchesType = filterItemType === 'all' || item.item_type === filterItemType;
    return matchesCategory && matchesSearch && matchesType && item.available;
  });

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const restaurantTypeInfo = restaurant ? getRestaurantTypeLabel(restaurant.type) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 transition-colors duration-500">
      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="fixed top-6 right-6 p-3 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-300 z-50"
        data-testid="theme-toggle-btn"
      >
        {isDarkMode ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-gray-700" />}
      </button>

      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Restaurant Header */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-xl p-6 mb-6 border border-white/20 dark:border-gray-700/20">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-600 dark:from-amber-400 dark:to-orange-500" style={{ fontFamily: 'Space Grotesk, sans-serif' }} data-testid="restaurant-name">
                  {restaurant?.name || 'Loading...'}
                </h1>
                {restaurantTypeInfo && (
                  <Badge className={restaurantTypeInfo.color}>
                    {restaurantTypeInfo.icon} {restaurantTypeInfo.text}
                  </Badge>
                )}
              </div>
              <p className="text-gray-600 dark:text-gray-400" style={{ fontFamily: 'Inter, sans-serif' }} data-testid="table-info">
                Table {table_no} • {restaurant?.location}
              </p>
            </div>
            {cart.length > 0 && (
              <Button
                onClick={() => setShowCart(true)}
                className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-lg"
                data-testid="open-cart-btn"
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                Cart ({cart.length})
              </Button>
            )}
          </div>
        </div>

        {/* Active Half Orders */}
        {halfOrders.length > 0 && (
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              <Users className="w-6 h-6 mr-2 text-orange-500" />Active Half Orders
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {halfOrders.map(order => {
                const timeInfo = getTimeRemaining(order.expires_at);
                return (
                  <Card key={order.id} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border-orange-200 dark:border-amber-700/30 hover:shadow-lg transition-all" data-testid={`half-order-${order.id}`}>
                    <CardHeader>
                      <CardTitle className="text-lg" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{order.menu_item_name}</CardTitle>
                      <CardDescription>Started by {order.customer_name} from Table {order.table_no}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant="outline" className={`${timeInfo.color} border-current`}>
                          <Clock className="w-3 h-3 mr-1" />
                          {timeInfo.text}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedHalfOrder(order);
                          setShowJoinDialog(true);
                        }}
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                        data-testid={`join-half-order-${order.id}-btn`}
                        disabled={timeInfo.text === 'Expired'}
                      >
                        <Users className="w-4 h-4 mr-2" />
                        Join Now
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <Input
            placeholder="Search menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-white/60 dark:bg-gray-700/60 backdrop-blur-md flex-1"
            data-testid="menu-search-input"
          />
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="sm:w-48 bg-white/60 dark:bg-gray-700/60 backdrop-blur-md" data-testid="category-filter">
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
          {restaurant?.type === 'mixed' && (
            <Select value={filterItemType} onValueChange={setFilterItemType}>
              <SelectTrigger className="sm:w-48 bg-white/60 dark:bg-gray-700/60 backdrop-blur-md" data-testid="type-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="veg">🟢 Veg Only</SelectItem>
                <SelectItem value="non_veg">🔴 Non-Veg Only</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMenu.map(item => {
            const typeInfo = getItemTypeIndicator(item.item_type);
            return (
              <Card key={item.id} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]" data-testid={`menu-item-${item.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="flex-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{item.name}</CardTitle>
                    <Badge className={typeInfo.color} data-testid={`item-type-${item.id}`}>
                      {typeInfo.icon} {typeInfo.label}
                    </Badge>
                  </div>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-orange-600 dark:text-amber-500" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                        {formatCurrency(item.price)}
                      </span>
                      {item.half_price && (
                        <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                          Half: {formatCurrency(item.half_price)}
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
                          className="flex-1 border-orange-500 dark:border-amber-500 text-orange-600 dark:text-amber-500 hover:bg-orange-50 dark:hover:bg-amber-900/20"
                          data-testid={`half-order-${item.id}-btn`}
                        >
                          <Users className="w-4 h-4 mr-2" />Half
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Cart Sidebar */}
      {showCart && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-end" onClick={() => setShowCart(false)}>
          <div
            className="w-full sm:w-96 bg-white dark:bg-gray-800 h-full shadow-2xl overflow-y-auto animate-slide-in"
            onClick={(e) => e.stopPropagation()}
            data-testid="cart-sidebar"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Your Cart</h3>
                <button onClick={() => setShowCart(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {cart.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Your cart is empty</p>
              ) : (
                <>
                  <div className="space-y-4 mb-6">
                    {cart.map(item => (
                      <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                        <div className="flex-1">
                          <p className="font-medium text-gray-800 dark:text-gray-200">{item.name}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{formatCurrency(item.price)} each</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 flex items-center justify-center"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-semibold">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="border-t dark:border-gray-700 pt-4 mb-6">
                    <div className="flex justify-between text-lg font-bold mb-4">
                      <span>Total:</span>
                      <span className="text-orange-600 dark:text-amber-500">{formatCurrency(cartTotal)}</span>
                    </div>
                    <div className="space-y-3">
                      <Input
                        placeholder="Your name *"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        data-testid="cart-customer-name-input"
                      />
                      <Input
                        placeholder="Mobile number (10 digits) *"
                        value={customerMobile}
                        onChange={(e) => setCustomerMobile(e.target.value)}
                        maxLength={10}
                        data-testid="cart-customer-mobile-input"
                      />
                      <Button
                        onClick={placeOrder}
                        className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-lg py-6"
                        data-testid="place-order-btn"
                      >
                        Place Order • {formatCurrency(cartTotal)}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Half Order Dialog */}
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
              <Label>Your Name *</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter your name"
                data-testid="half-order-name-input"
              />
            </div>
            <div>
              <Label>Mobile Number * (10 digits)</Label>
              <Input
                value={customerMobile}
                onChange={(e) => setCustomerMobile(e.target.value)}
                placeholder="9876543210"
                maxLength={10}
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

      {/* Join Half Order Dialog */}
      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Join Half Order</DialogTitle>
            <DialogDescription>
              Join {selectedHalfOrder?.customer_name}'s half order from Table {selectedHalfOrder?.table_no} for {selectedHalfOrder?.menu_item_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Your Name *</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter your name"
                data-testid="join-name-input"
              />
            </div>
            <div>
              <Label>Mobile Number * (10 digits)</Label>
              <Input
                value={customerMobile}
                onChange={(e) => setCustomerMobile(e.target.value)}
                placeholder="9876543210"
                maxLength={10}
                data-testid="join-mobile-input"
              />
            </div>
            <Button
              onClick={joinHalfOrder}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
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