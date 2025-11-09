import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Toaster } from './components/ui/sonner';
import LoginPage from './pages/LoginPage';
import MenuPage from './pages/MenuPageProduction';
import CustomerDashboard from './pages/CustomerDashboard';
import CounterDashboard from './pages/CounterDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AnalyticsPage from './pages/AnalyticsPage';
import './App.css';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-amber-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-600" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Loading...
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={getRoleBasedRoute(user.role)} replace /> : <LoginPage />} />
      <Route path="/menu/:restaurant_id/:table_no" element={<MenuPage />} />
      <Route path="/my-orders/:restaurant_id/:table_no" element={<CustomerDashboard />} />
      <Route
        path="/counter"
        element={
          <ProtectedRoute allowedRoles={['counter_admin']}>
            <CounterDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <AnalyticsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          user ? (
            <Navigate to={getRoleBasedRoute(user.role)} replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
};

const getRoleBasedRoute = (role) => {
  switch (role) {
    case 'super_admin':
      return '/admin';
    case 'counter_admin':
      return '/counter';
    default:
      return '/login';
  }
};

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <div className="App">
            <AppRoutes />
            <Toaster position="top-right" richColors closeButton />
          </div>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;