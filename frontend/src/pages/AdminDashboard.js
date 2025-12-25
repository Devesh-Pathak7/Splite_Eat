import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { LogOut, Moon, Sun, Plus, Building, Users, BarChart3, Edit, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { getRestaurantTypeLabel } from '../utils/helpers';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState([]);
  const [users, setUsers] = useState([]);
  const [showAddRestaurant, setShowAddRestaurant] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState(null);
  const [newRestaurant, setNewRestaurant] = useState({
    name: '',
    location: '',
    contact: '',
    type: 'mixed'
  });
  const [newUser, setNewUser] = useState({ username: '', password: '', restaurant_id: '' });

  useEffect(() => {
    fetchRestaurants();
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API_URL}/users`, { headers });
      setUsers(response.data);
    } catch (error) {
      toast.error('Failed to load users');
    }
  };

  const fetchRestaurants = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API_URL}/restaurants`, { headers });
      setRestaurants(response.data);
    } catch (error) {
      toast.error('Failed to load restaurants');
    }
  };

  const addRestaurant = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(`${API_URL}/restaurants`, newRestaurant, { headers });
      toast.success('Restaurant added successfully');
      setShowAddRestaurant(false);
      setNewRestaurant({ name: '', location: '', contact: '', type: 'mixed' });
      fetchRestaurants();
    } catch (error) {
      toast.error('Failed to add restaurant');
    }
  };

  const updateRestaurant = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.put(`${API_URL}/restaurants/${editingRestaurant.id}`, {
        name: editingRestaurant.name,
        location: editingRestaurant.location,
        contact: editingRestaurant.contact
      }, { headers });
      toast.success('Restaurant updated');
      setEditingRestaurant(null);
      fetchRestaurants();
    } catch (error) {
      toast.error('Failed to update restaurant');
    }
  };

  const deleteRestaurant = async (id) => {
    if (!window.confirm('Are you sure? This will delete all related data.')) return;
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.delete(`${API_URL}/restaurants/${id}`, { headers });
      toast.success('Restaurant deleted');
      fetchRestaurants();
    } catch (error) {
      toast.error('Failed to delete restaurant');
    }
  };

  const createUser = async () => {
    if (!newUser.username || !newUser.password) {
      toast.error('Username and password required');
      return;
    }
    try {
      const payload = {
        username: newUser.username,
        password: newUser.password,
        role: 'counter_admin',
        restaurant_id: parseInt(newUser.restaurant_id)
      };
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(`${API_URL}/users`, payload, { headers });
      toast.success('User created');
      setShowCreateUser(false);
      setNewUser({ username: '', password: '', restaurant_id: '' });
      fetchUsers();
    } catch (error) {
      toast.error('Failed to create user');
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm('Delete user?')) return;
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.delete(`${API_URL}/users/${id}`, { headers });
      toast.success('User deleted');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to delete user');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 transition-colors duration-500">
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl shadow-lg border-b border-white/20 dark:border-gray-700/20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-600 dark:from-amber-400 dark:to-orange-500" style={{ fontFamily: 'Space Grotesk, sans-serif' }} data-testid="admin-dashboard-title">
              Admin Dashboard
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
        <Tabs defaultValue="restaurants" className="space-y-6">
          <TabsList className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl p-1">
            <TabsTrigger value="restaurants" data-testid="restaurants-tab"><Building className="w-4 h-4 mr-2" />Restaurants</TabsTrigger>
            <TabsTrigger value="analytics" onClick={() => navigate('/analytics')} data-testid="analytics-tab"><BarChart3 className="w-4 h-4 mr-2" />Analytics</TabsTrigger>
            <TabsTrigger value="users" data-testid="users-tab"><Users className="w-4 h-4 mr-2" />Restaurant Users</TabsTrigger>
          </TabsList>

          <TabsContent value="restaurants" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Restaurant Management</h2>
              <Button onClick={() => setShowAddRestaurant(true)} className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700" data-testid="add-restaurant-btn">
                <Plus className="w-4 h-4 mr-2" />Add Restaurant
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {restaurants.map(restaurant => {
                const typeInfo = getRestaurantTypeLabel(restaurant.type || 'mixed');
                return (
                  <Card key={restaurant.id} className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md hover:shadow-xl transition-all" data-testid={`restaurant-${restaurant.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{restaurant.name}</CardTitle>
                        <Badge className={typeInfo.color}>
                          {typeInfo.icon} {typeInfo.text}
                        </Badge>
                      </div>
                      <CardDescription>{restaurant.location}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Contact: {restaurant.contact}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditingRestaurant(restaurant)} data-testid={`edit-restaurant-${restaurant.id}-btn`}>
                        <Edit className="w-3 h-3 mr-1" />Edit
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteRestaurant(restaurant.id)} data-testid={`delete-restaurant-${restaurant.id}-btn`}>
                        <Trash2 className="w-3 h-3 mr-1" />Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Restaurant Users</h2>
              <Button onClick={() => setShowCreateUser(true)} className="bg-gradient-to-r from-orange-500 to-amber-600" data-testid="create-user-btn">
                <Plus className="w-4 h-4 mr-2" />Create User
              </Button>
            </div>

            <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md rounded-lg p-4">
              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="text-left">
                      <th className="px-4 py-2">Username</th>
                      <th className="px-4 py-2">Role</th>
                      <th className="px-4 py-2">Restaurant</th>
                      <th className="px-4 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="border-t">
                        <td className="px-4 py-3">{u.username}</td>
                        <td className="px-4 py-3"><Badge className="bg-amber-100 text-amber-800">{u.role}</Badge></td>
                        <td className="px-4 py-3">{u.restaurant_id ? (restaurants.find(r => r.id === u.restaurant_id)?.name || '—') : 'All'}</td>
                        <td className="px-4 py-3">
                          <Button size="sm" variant="destructive" onClick={() => deleteUser(u.id)}>
                            <Trash2 className="w-3 h-3 mr-1" />Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showAddRestaurant} onOpenChange={setShowAddRestaurant}>
        <DialogContent className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Add Restaurant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={newRestaurant.name} onChange={(e) => setNewRestaurant({...newRestaurant, name: e.target.value})} data-testid="add-restaurant-name-input" /></div>
            <div><Label>Location</Label><Input value={newRestaurant.location} onChange={(e) => setNewRestaurant({...newRestaurant, location: e.target.value})} data-testid="add-restaurant-location-input" /></div>
            <div><Label>Contact</Label><Input value={newRestaurant.contact} onChange={(e) => setNewRestaurant({...newRestaurant, contact: e.target.value})} data-testid="add-restaurant-contact-input" /></div>
            <div>
              <Label>Restaurant Type</Label>
              <Select value={newRestaurant.type} onValueChange={(value) => setNewRestaurant({...newRestaurant, type: value})}>
                <SelectTrigger data-testid="add-restaurant-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="veg">🟢 Pure Veg</SelectItem>
                  <SelectItem value="non_veg">🔴 Non-Veg Only</SelectItem>
                  <SelectItem value="mixed">🟡 Veg & Non-Veg</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={addRestaurant} className="w-full bg-gradient-to-r from-orange-500 to-amber-600" data-testid="submit-add-restaurant-btn">Add Restaurant</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
        <DialogContent className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Create User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Username</Label><Input value={newUser.username} onChange={(e) => setNewUser({...newUser, username: e.target.value})} data-testid="create-user-username" /></div>
            <div><Label>Password</Label><Input type="password" value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} data-testid="create-user-password" /></div>
            <div>
              <Label>Restaurant</Label>
              <Select value={newUser.restaurant_id} onValueChange={(value) => setNewUser({...newUser, restaurant_id: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {restaurants.map(r => (
                    <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={createUser} className="w-full bg-gradient-to-r from-orange-500 to-amber-600" data-testid="submit-create-user-btn">Create User</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingRestaurant} onOpenChange={() => setEditingRestaurant(null)}>
        <DialogContent className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Edit Restaurant</DialogTitle>
          </DialogHeader>
          {editingRestaurant && (
            <div className="space-y-4">
              <div><Label>Name</Label><Input value={editingRestaurant.name} onChange={(e) => setEditingRestaurant({...editingRestaurant, name: e.target.value})} data-testid="edit-restaurant-name-input" /></div>
              <div><Label>Location</Label><Input value={editingRestaurant.location} onChange={(e) => setEditingRestaurant({...editingRestaurant, location: e.target.value})} data-testid="edit-restaurant-location-input" /></div>
              <div><Label>Contact</Label><Input value={editingRestaurant.contact} onChange={(e) => setEditingRestaurant({...editingRestaurant, contact: e.target.value})} data-testid="edit-restaurant-contact-input" /></div>
              <div>
                <Label>Restaurant Type</Label>
                <Select value={editingRestaurant.type || 'mixed'} onValueChange={(value) => setEditingRestaurant({...editingRestaurant, type: value})}>
                  <SelectTrigger data-testid="edit-restaurant-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="veg">🟢 Pure Veg</SelectItem>
                    <SelectItem value="non_veg">🔴 Non-Veg Only</SelectItem>
                    <SelectItem value="mixed">🟡 Veg & Non-Veg</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={updateRestaurant} className="w-full bg-gradient-to-r from-orange-500 to-amber-600" data-testid="submit-edit-restaurant-btn">Update Restaurant</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;