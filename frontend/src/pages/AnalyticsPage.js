import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { ArrowLeft, Moon, Sun, DollarSign, ShoppingBag, Users, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../utils/helpers';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const AnalyticsPage = () => {
  const { user } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [overview, setOverview] = useState({ 
    total_revenue: 0, 
    total_orders: 0, 
    active_half_orders: 0,
    average_order_value: 0,
    total_customers: 0,
    top_restaurants: []
  });
  const [popularItems, setPopularItems] = useState([]);

  useEffect(() => {
    fetchRestaurants();
    fetchAnalytics();
  }, [selectedRestaurant]);

  const fetchRestaurants = async () => {
    try {
      const response = await axios.get(`${API_URL}/restaurants`);
      setRestaurants(response.data);
    } catch (error) {
      console.error('Failed to load restaurants');
    }
  };

  const fetchAnalytics = async () => {
    try {
      const params = {};
      if (selectedRestaurant !== 'all') params.restaurant_id = selectedRestaurant;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      
      const overviewResponse = await axios.get(`${API_URL}/analytics/super-admin-overview`, { params });
      setOverview(overviewResponse.data);

      const popularResponse = await axios.get(`${API_URL}/analytics/popular-items`, { params: { ...params, limit: 10 } });
      setPopularItems(popularResponse.data);
    } catch (error) {
      toast.error('Failed to load analytics');
      console.error(error);
    }
  };

  const COLORS = ['#FF8C00', '#FFA733', '#FFB84D', '#FFC966', '#FFDA80', '#FFEB99', '#F97316', '#FB923C', '#FDBA74', '#FED7AA'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 transition-colors duration-500">
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl shadow-lg border-b border-white/20 dark:border-gray-700/20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button onClick={() => navigate('/admin')} variant="ghost" size="sm" data-testid="back-to-admin-btn">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-600 dark:from-amber-400 dark:to-orange-500" style={{ fontFamily: 'Space Grotesk, sans-serif' }} data-testid="analytics-title">
                Analytics Dashboard
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400" style={{ fontFamily: 'Inter, sans-serif' }}>Real-time insights and performance metrics</p>
            </div>
          </div>
          <button onClick={toggleTheme} className="p-3 rounded-full bg-white/70 dark:bg-gray-700/70 backdrop-blur-md shadow-md hover:shadow-lg transition-all" data-testid="theme-toggle-btn">
            {isDarkMode ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-gray-700" />}
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <Select value={selectedRestaurant} onValueChange={setSelectedRestaurant}>
            <SelectTrigger className="sm:w-64 bg-white/60 dark:bg-gray-700/60 backdrop-blur-md" data-testid="restaurant-filter">
              <SelectValue placeholder="Select Restaurant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Restaurants</SelectItem>
              {restaurants.map(r => (
                <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="sm:w-48 bg-white/60 dark:bg-gray-700/60 backdrop-blur-md"
            placeholder="Start Date"
          />
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="sm:w-48 bg-white/60 dark:bg-gray-700/60 backdrop-blur-md"
            placeholder="End Date"
          />
          <Button
            onClick={fetchAnalytics}
            className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700"
          >
            Apply Filters
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md border-orange-200 dark:border-amber-700/30" data-testid="revenue-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>Total Revenue</CardTitle>
              <DollarSign className="w-5 h-5 text-orange-600 dark:text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600 dark:text-amber-500" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                ${overview.total_revenue.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md border-orange-200 dark:border-amber-700/30" data-testid="orders-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>Total Orders</CardTitle>
              <ShoppingBag className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                {overview.total_orders}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md border-orange-200 dark:border-amber-700/30" data-testid="half-orders-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>Active Half Orders</CardTitle>
              <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                {overview.active_half_orders}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md" data-testid="popular-items-chart">
            <CardHeader>
              <CardTitle style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Top 10 Popular Items</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={popularItems}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: isDarkMode ? '#9CA3AF' : '#6B7280' }} />
                  <YAxis tick={{ fill: isDarkMode ? '#9CA3AF' : '#6B7280' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Bar dataKey="count" fill="#FF8C00" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md" data-testid="popular-items-pie-chart">
            <CardHeader>
              <CardTitle style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Item Distribution</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={popularItems.slice(0, 8)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {popularItems.slice(0, 8).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;