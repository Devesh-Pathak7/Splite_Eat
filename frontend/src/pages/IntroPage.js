import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Moon, Sun, Utensils, Users, TrendingUp } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const IntroPage = () => {
  const navigate = useNavigate();
  const { isDarkMode, toggleTheme } = useTheme();

  const handleContinue = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-orange-50 via-white to-amber-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 transition-colors duration-500">

      {/* Theme toggle button */}
      <button
        onClick={toggleTheme}
        className="fixed top-6 right-6 p-3 rounded-full bg-white/70 dark:bg-gray-800/70 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-300 z-50"
        data-testid="theme-toggle-btn"
      >
        {isDarkMode ? (
          <Sun className="w-5 h-5 text-amber-500" />
        ) : (
          <Moon className="w-5 h-5 text-gray-700" />
        )}
      </button>

      <div className="w-full max-w-2xl">

        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-orange-400 to-amber-500 rounded-full flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform duration-300">
              <Utensils className="w-10 h-10 text-white" />
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-3 tracking-tight">
            SplitEat
          </h1>

          <p className="text-lg text-gray-600 dark:text-gray-300">
            Share Meals, Split Bills
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">

          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl p-6 border border-white/20 dark:border-gray-700/20 hover:shadow-lg transition-shadow duration-300">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                <Utensils className="w-6 h-6 text-orange-500" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
              Order Seamlessly
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              Browse the menu, select items, and order directly from your table
            </p>
          </div>

          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl p-6 border border-white/20 dark:border-gray-700/20 hover:shadow-lg transition-shadow duration-300">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
              Split Easily
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              Join other diners at your table and split the bill fairly
            </p>
          </div>

          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl p-6 border border-white/20 dark:border-gray-700/20 hover:shadow-lg transition-shadow duration-300">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-500" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
              Track Spending
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              View real-time bill splits and manage your expenses
            </p>
          </div>

        </div>

        {/* Benefits Section */}
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/10 dark:to-amber-900/10 rounded-2xl p-8 mb-8 border border-orange-200 dark:border-orange-800/30">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
            Why Choose SplitEat?
          </h2>
          <ul className="space-y-4">

            {/* New Added Point */}
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-white text-sm font-bold">✓</span>
              </div>
              <div>
                <p className="text-gray-900 dark:text-white font-semibold">No More Food Wastage</p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Order exactly what you need and reduce unnecessary leftovers
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-white text-sm font-bold">✓</span>
              </div>
              <div>
                <p className="text-gray-900 dark:text-white font-semibold">No More Math</p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Automatic bill splitting based on individual orders
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-white text-sm font-bold">✓</span>
              </div>
              <div>
                <p className="text-gray-900 dark:text-white font-semibold">Fast & Simple</p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Quick scanning and ordering without waiting for the bill
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-white text-sm font-bold">✓</span>
              </div>
              <div>
                <p className="text-gray-900 dark:text-white font-semibold">Real-Time Updates</p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  See orders and bills update instantly across all devices
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-white text-sm font-bold">✓</span>
              </div>
              <div>
                <p className="text-gray-900 dark:text-white font-semibold">Secure & Reliable</p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Enterprise-grade security for your restaurant and payments
                </p>
              </div>
            </li>

          </ul>
        </div>

        {/* CTA Section */}
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl p-8 border border-white/20 dark:border-gray-700/20 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Ready to Transform Your Dining?
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
            Get started with SplitEat today and experience dining like never before
          </p>
          <Button
            onClick={handleContinue}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 text-lg"
          >
            Continue to Login
          </Button>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            © 2025 SplitEat. All rights reserved.
          </p>
        </div>

      </div>
    </div>
  );
};

export default IntroPage;
