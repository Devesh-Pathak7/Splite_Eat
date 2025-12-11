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
import { ArrowLeft, Moon, Sun, ShoppingBag, Users, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../utils/helpers';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const AnalyticsPage = () => {
  const { user } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState('all');
  const [period, setPeriod] = useState('today');
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
  const [halfOrdersJoined, setHalfOrdersJoined] = useState(0);
  const [halfOrderCommission, setHalfOrderCommission] = useState(0);

  useEffect(() => {
    fetchRestaurants();
    fetchAnalytics();
  }, [selectedRestaurant, period]);

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

      // Fetch half-order metrics
      const halfOrdersParams = { period };
      if (selectedRestaurant !== 'all') halfOrdersParams.restaurant_id = selectedRestaurant;
      
      const halfOrdersResponse = await axios.get(`${API_URL}/analytics/half-orders-joined`, { params: halfOrdersParams });
      setHalfOrdersJoined(halfOrdersResponse.data.joined_pairs_count);

      const commissionResponse = await axios.get(`${API_URL}/analytics/half-order-commission`, { params: halfOrdersParams });
      setHalfOrderCommission(commissionResponse.data.total_commission);
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
            <SelectTrigger className="sm:w-48 bg-white/60 dark:bg-gray-700/60 backdrop-blur-md" data-testid="restaurant-filter">
              <SelectValue placeholder="Select Restaurant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Restaurants</SelectItem>
              {restaurants.map(r => (
                <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="sm:w-48 bg-white/60 dark:bg-gray-700/60 backdrop-blur-md" data-testid="period-filter">
              <SelectValue placeholder="Select Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="last_3_months">Last 3 Months</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md border-orange-200 dark:border-amber-700/30" data-testid="revenue-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600 dark:text-amber-500" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                {formatCurrency(overview.total_revenue)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md border-orange-200 dark:border-amber-700/30" data-testid="orders-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>Total Orders</CardTitle>
              <ShoppingBag className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                {overview.total_orders}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md border-orange-200 dark:border-amber-700/30" data-testid="avg-order-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>Avg Order Value</CardTitle>
              <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                {formatCurrency(overview.average_order_value)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md border-orange-200 dark:border-amber-700/30" data-testid="customers-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>Total Customers</CardTitle>
              <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                {overview.total_customers}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md border-orange-200 dark:border-amber-700/30" data-testid="half-joined-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>Half+Half Joined</CardTitle>
              <ShoppingBag className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-400" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                {halfOrdersJoined}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md border-orange-200 dark:border-amber-700/30" data-testid="half-commission-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>Half+Half Commission</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                ₹{halfOrderCommission}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Restaurants Section */}
        {overview.top_restaurants && overview.top_restaurants.length > 0 && (
          <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md mb-8">
            <CardHeader>
              <CardTitle style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Top 5 Restaurants by Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {overview.top_restaurants.map((rest, index) => (
                  <div key={rest.restaurant_id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="text-2xl font-bold text-gray-400 dark:text-gray-500">#{index + 1}</div>
                      <div>
                        <p className="font-semibold text-gray-800 dark:text-gray-200">{rest.name}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{rest.orders} orders</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-orange-600 dark:text-amber-500">{formatCurrency(rest.revenue)}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{rest.active_tables} active tables</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md" data-testid="popular-items-chart">
            <CardHeader>
              <CardTitle style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Top 10 Popular Items</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <div style={{ width: '100%', minWidth: '500px', height: 340 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={popularItems} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 11, fill: isDarkMode ? '#9CA3AF' : '#6B7280' }} 
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
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
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md" data-testid="popular-items-pie-chart">
            <CardHeader>
              <CardTitle style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Item Distribution</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center overflow-x-auto">
              <div style={{ width: '100%', minWidth: '400px', height: 340 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 20, right: 80, bottom: 20, left: 20 }}>
                    <Pie
                      data={popularItems.slice(0, 8)}
                      cx="40%"
                      cy="50%"
                      labelLine={true}
                      label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {popularItems.slice(0, 8).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [value, 'Orders']}
                      labelFormatter={(label) => {
                        const item = popularItems.find(x => x.count === label);
                        return item ? item.name : label;
                      }}
                      contentStyle={{
                        backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                        padding: '8px'
                      }}
                    />
                    <Legend 
                      layout="vertical"
                      align="right"
                      verticalAlign="middle"
                      wrapperStyle={{
                        paddingLeft: '20px',
                        fontSize: '12px'
                      }}
                      formatter={(value, entry) => {
                        const item = popularItems[entry.index];
                        return item ? item.name : value;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;