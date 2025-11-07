import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { WebSocketProvider, useWebSocket } from '../context/WebSocketContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { LogOut, Moon, Sun, Plus, ShoppingBag, Users, Table as TableIcon, Menu, Edit, Trash2, Clock } from 'lucide-react';
import { formatCurrency, getItemTypeIndicator, getTimeRemaining } from '../utils/helpers';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const CounterDashboardContent = () => {
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { lastMessage } = useWebSocket();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [tables, setTables] = useState([]);
  const [halfOrders, setHalfOrders] = useState([]);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showAddTable, setShowAddTable] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [newMenuItem, setNewMenuItem] = useState({
    name: '',
    description: '',
    category: '',
    item_type: 'veg',
    price: '',
    half_price: '',
    available: true
  });
  const [halfOrderFilter, setHalfOrderFilter] = useState('active');

  const [newTable, setNewTable] = useState({
    table_no: '',
    capacity: 4
  });

  useEffect(() => {
    if (user?.restaurant_id) {
      fetchOrders();
      fetchMenu();
      fetchTables();
      fetchHalfOrders();
    }
  }, [user]);

  useEffect(() => {
    if (lastMessage) {
      handleWebSocketMessage(lastMessage);
    }
  }, [lastMessage]);

  const handleWebSocketMessage = (message) => {
    switch (message.type) {
      case 'new_order':
        fetchOrders();
        toast.success('New order received!');
        break;
      case 'half_order_created':
      case 'half_order_joined':
        fetchHalfOrders();
        break;
      default:
        break;
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API_URL}/restaurants/${user.restaurant_id}/orders`);
      setOrders(response.data);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  };

  const fetchMenu = async () => {
    try {
      const response = await axios.get(`${API_URL}/restaurants/${user.restaurant_id}/menu`);
      setMenuItems(response.data);
    } catch (error) {
      console.error('Failed to fetch menu:', error);
    }
  };

  const fetchTables = async () => {
    try {
      const response = await axios.get(`${API_URL}/restaurants/${user.restaurant_id}/tables`);
      setTables(response.data);
    } catch (error) {
      console.error('Failed to fetch tables:', error);
    }
  };

  const fetchHalfOrders = async () => {
    try {
      const response = await axios.get(`${API_URL}/restaurants/${user.restaurant_id}/orders`);
      setHalfOrders(response.data.filter(o => o.status === 'ACTIVE'));
    } catch (error) {
      console.error('Failed to fetch half orders:', error);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await axios.put(`${API_URL}/orders/${orderId}/status`, { status: newStatus });
      toast.success('Order status updated');
      fetchOrders();
    } catch (error) {
      toast.error('Failed to update order status');
    }
  };

  const addMenuItem = async () => {
    try {
      await axios.post(`${API_URL}/restaurants/${user.restaurant_id}/menu`, {
        ...newMenuItem,
        price: parseFloat(newMenuItem.price),
        half_price: newMenuItem.half_price ? parseFloat(newMenuItem.half_price) : null
      });
      toast.success('Menu item added');
      setShowAddMenu(false);
      setNewMenuItem({ name: '', description: '', category: '', price: '', half_price: '', available: true });
      fetchMenu();
    } catch (error) {
      toast.error('Failed to add menu item');
    }
  };

  const updateMenuItem = async () => {
    try {
      await axios.put(`${API_URL}/menu/${editingItem.id}`, {
        ...editingItem,
        price: parseFloat(editingItem.price),
        half_price: editingItem.half_price ? parseFloat(editingItem.half_price) : null
      });
      toast.success('Menu item updated');
      setEditingItem(null);
      fetchMenu();
    } catch (error) {
      toast.error('Failed to update menu item');
    }
  };

  const deleteMenuItem = async (itemId) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try {
      await axios.delete(`${API_URL}/menu/${itemId}`);
      toast.success('Menu item deleted');
      fetchMenu();
    } catch (error) {
      toast.error('Failed to delete menu item');
    }
  };

  const addTable = async () => {
    try {
      await axios.post(`${API_URL}/restaurants/${user.restaurant_id}/tables`, newTable);
      toast.success('Table added successfully');
      setShowAddTable(false);
      setNewTable({ table_no: '', capacity: 4 });
      fetchTables();
    } catch (error) {
      toast.error('Failed to add table');
    }
  };

  const deleteTable = async (tableId) => {
    if (!window.confirm('Are you sure you want to delete this table?')) return;
    try {
      await axios.delete(`${API_URL}/tables/${tableId}`);
      toast.success('Table deleted');
      fetchTables();
    } catch (error) {
      toast.error('Failed to delete table');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getQRCodeLink = (table) => {
    return `${window.location.origin}/menu/${user.restaurant_id}/${table.table_no}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 transition-colors duration-500">
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl shadow-lg border-b border-white/20 dark:border-gray-700/20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-600 dark:from-amber-400 dark:to-orange-500" style={{ fontFamily: 'Space Grotesk, sans-serif' }} data-testid="counter-dashboard-title">
              Counter Dashboard
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400" style={{ fontFamily: 'Inter, sans-serif' }}>Welcome, {user?.username}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={toggleTheme} className="p-3 rounded-full bg-white/70 dark:bg-gray-700/70 backdrop-blur-md shadow-md hover:shadow-lg transition-all" data-testid="theme-toggle-btn">
              {isDarkMode ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-gray-700" />}
            </button>
            <Button onClick={handleLogout} variant="outline" className="border-orange-500 dark:border-amber-500" data-testid="logout-btn">
              <LogOut className="w-4 h-4 mr-2" />Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <Tabs defaultValue="orders" className="space-y-6">
          <TabsList className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl p-1">
            <TabsTrigger value="orders" data-testid="orders-tab"><ShoppingBag className="w-4 h-4 mr-2" />Orders</TabsTrigger>
            <TabsTrigger value="menu" data-testid="menu-tab"><Menu className="w-4 h-4 mr-2" />Menu</TabsTrigger>
            <TabsTrigger value="tables" data-testid="tables-tab"><TableIcon className="w-4 h-4 mr-2" />Tables</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Active Orders</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {orders.filter(o => o.status !== 'COMPLETED' && o.status !== 'CANCELLED').map(order => {
                const isHalfOrder = order.table_no.includes('+');
                const waitingTime = Math.floor((new Date() - new Date(order.created_at)) / 60000);
                return (
                  <Card key={order.id} className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md hover:shadow-lg transition-all" data-testid={`order-${order.id}`}>
                    <CardHeader>
                      <CardTitle className="flex justify-between items-start">
                        <span style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Order #{order.id}</span>
                        <Badge className={`
                          ${order.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : ''}
                          ${order.status === 'PREPARING' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : ''}
                          ${order.status === 'READY' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : ''}
                          ${order.status === 'SERVED' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : ''}
                        `}>
                          {order.status === 'PENDING' && '🟡'}
                          {order.status === 'PREPARING' && '🔵'}
                          {order.status === 'READY' && '🟢'}
                          {order.status === 'SERVED' && '✅'}
                          {' '}{order.status}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="space-y-1">
                        <div className="flex items-center gap-2">
                          {isHalfOrder ? (
                            <span className="text-sm font-medium text-orange-600 dark:text-amber-500">
                              🍽️ Half-Order Match: {order.table_no}
                            </span>
                          ) : (
                            <span>Table {order.table_no}</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Waiting {waitingTime}m • {order.customer_name}
                        </div>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-2xl font-bold text-orange-600 dark:text-amber-500" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                        {formatCurrency(order.total_amount)}
                      </div>
                    <div className="flex flex-wrap gap-2">
                      {order.status === 'PENDING' && (
                        <Button size="sm" onClick={() => updateOrderStatus(order.id, 'PREPARING')} className="bg-blue-500 hover:bg-blue-600" data-testid={`order-${order.id}-preparing-btn`}>
                          Start Preparing
                        </Button>
                      )}
                      {order.status === 'PREPARING' && (
                        <Button size="sm" onClick={() => updateOrderStatus(order.id, 'READY')} className="bg-green-500 hover:bg-green-600" data-testid={`order-${order.id}-ready-btn`}>
                          Mark Ready
                        </Button>
                      )}
                      {order.status === 'READY' && (
                        <Button size="sm" onClick={() => updateOrderStatus(order.id, 'SERVED')} className="bg-purple-500 hover:bg-purple-600" data-testid={`order-${order.id}-served-btn`}>
                          Mark Served
                        </Button>
                      )}
                      {order.status === 'SERVED' && (
                        <Button size="sm" onClick={() => updateOrderStatus(order.id, 'COMPLETED')} className="bg-gray-500 hover:bg-gray-600" data-testid={`order-${order.id}-complete-btn`}>
                          Complete
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" onClick={() => updateOrderStatus(order.id, 'CANCELLED')} data-testid={`order-${order.id}-cancel-btn`}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="menu" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Menu Management</h2>
              <Button onClick={() => setShowAddMenu(true)} className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700" data-testid="add-menu-item-btn">
                <Plus className="w-4 h-4 mr-2" />Add Item
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {menuItems.map(item => {
                const typeInfo = getItemTypeIndicator(item.item_type || 'veg');
                return (
                  <Card key={item.id} className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md" data-testid={`menu-item-${item.id}`}>
                    <CardHeader>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-lg font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{item.name}</span>
                        <div className="flex gap-2">
                          <Badge className={typeInfo.color}>
                            {typeInfo.icon}
                          </Badge>
                          <Badge variant={item.available ? 'default' : 'secondary'}>
                            {item.available ? 'Available' : 'Unavailable'}
                          </Badge>
                        </div>
                      </div>
                      <CardDescription>{item.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-xl font-bold text-orange-600 dark:text-amber-500">{formatCurrency(item.price)}</span>
                        {item.half_price && <span className="text-sm text-gray-600">Half: {formatCurrency(item.half_price)}</span>}
                      </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditingItem(item)} data-testid={`edit-menu-${item.id}-btn`}>
                        <Edit className="w-3 h-3 mr-1" />Edit
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteMenuItem(item.id)} data-testid={`delete-menu-${item.id}-btn`}>
                        <Trash2 className="w-3 h-3 mr-1" />Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="tables" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Table Management</h2>
              <Button onClick={() => setShowAddTable(true)} className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700" data-testid="add-table-btn">
                <Plus className="w-4 h-4 mr-2" />Add Table
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tables.map(table => (
                <Card key={table.id} className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md" data-testid={`table-${table.id}`}>
                  <CardHeader>
                    <CardTitle style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Table {table.table_no}</CardTitle>
                    <CardDescription>Capacity: {table.capacity} people</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs break-all">
                      <strong>QR Link:</strong> {getQRCodeLink(table)}
                    </div>
                    <Button size="sm" variant="destructive" onClick={() => deleteTable(table.id)} data-testid={`delete-table-${table.id}-btn`}>
                      <Trash2 className="w-3 h-3 mr-1" />Delete Table
                    </Button>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showAddMenu} onOpenChange={setShowAddMenu}>
        <DialogContent className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Add Menu Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={newMenuItem.name} onChange={(e) => setNewMenuItem({...newMenuItem, name: e.target.value})} data-testid="add-menu-name-input" /></div>
            <div><Label>Description</Label><Input value={newMenuItem.description} onChange={(e) => setNewMenuItem({...newMenuItem, description: e.target.value})} data-testid="add-menu-description-input" /></div>
            <div><Label>Category</Label><Input value={newMenuItem.category} onChange={(e) => setNewMenuItem({...newMenuItem, category: e.target.value})} data-testid="add-menu-category-input" /></div>
            <div>
              <Label>Type</Label>
              <Select value={newMenuItem.item_type} onValueChange={(value) => setNewMenuItem({...newMenuItem, item_type: value})}>
                <SelectTrigger data-testid="add-menu-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="veg">🟢 Veg</SelectItem>
                  <SelectItem value="non_veg">🔴 Non-Veg</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Price (₹)</Label><Input type="number" step="0.01" value={newMenuItem.price} onChange={(e) => setNewMenuItem({...newMenuItem, price: e.target.value})} data-testid="add-menu-price-input" /></div>
            <div><Label>Half Price (₹, optional)</Label><Input type="number" step="0.01" value={newMenuItem.half_price} onChange={(e) => setNewMenuItem({...newMenuItem, half_price: e.target.value})} data-testid="add-menu-half-price-input" /></div>
            <Button onClick={addMenuItem} className="w-full bg-gradient-to-r from-orange-500 to-amber-600" data-testid="submit-add-menu-btn">Add Item</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Edit Menu Item</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-4">
              <div><Label>Name</Label><Input value={editingItem.name} onChange={(e) => setEditingItem({...editingItem, name: e.target.value})} data-testid="edit-menu-name-input" /></div>
              <div><Label>Description</Label><Input value={editingItem.description} onChange={(e) => setEditingItem({...editingItem, description: e.target.value})} data-testid="edit-menu-description-input" /></div>
              <div><Label>Category</Label><Input value={editingItem.category} onChange={(e) => setEditingItem({...editingItem, category: e.target.value})} data-testid="edit-menu-category-input" /></div>
              <div><Label>Price</Label><Input type="number" step="0.01" value={editingItem.price} onChange={(e) => setEditingItem({...editingItem, price: e.target.value})} data-testid="edit-menu-price-input" /></div>
              <div><Label>Half Price</Label><Input type="number" step="0.01" value={editingItem.half_price || ''} onChange={(e) => setEditingItem({...editingItem, half_price: e.target.value})} data-testid="edit-menu-half-price-input" /></div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={editingItem.available} onChange={(e) => setEditingItem({...editingItem, available: e.target.checked})} data-testid="edit-menu-available-checkbox" />
                <Label>Available</Label>
              </div>
              <Button onClick={updateMenuItem} className="w-full bg-gradient-to-r from-orange-500 to-amber-600" data-testid="submit-edit-menu-btn">Update Item</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showAddTable} onOpenChange={setShowAddTable}>
        <DialogContent className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Add Table</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Table Number</Label><Input value={newTable.table_no} onChange={(e) => setNewTable({...newTable, table_no: e.target.value})} data-testid="add-table-number-input" /></div>
            <div><Label>Capacity</Label><Input type="number" value={newTable.capacity} onChange={(e) => setNewTable({...newTable, capacity: parseInt(e.target.value)})} data-testid="add-table-capacity-input" /></div>
            <Button onClick={addTable} className="w-full bg-gradient-to-r from-orange-500 to-amber-600" data-testid="submit-add-table-btn">Add Table</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const CounterDashboard = () => {
  const { user } = useAuth();
  
  if (!user?.restaurant_id) return <div>Loading...</div>;
  
  return (
    <WebSocketProvider restaurantId={user.restaurant_id}>
      <CounterDashboardContent />
    </WebSocketProvider>
  );
};

export default CounterDashboard;