// src/pages/CustomerDashboard.js

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Clock,
  CheckCircle,
  Loader,
  XCircle,
  ChefHat,
  Bell,
  ArrowLeft,
  Moon,
  Sun,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";

const API_ROOT = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";
const API_URL = `${API_ROOT}/api`;

// Safely parse JSON items from orders
const parseItems = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const formatCurrency = (v) =>
  "₹" + Number(v || 0).toFixed(2).replace(/\.00$/, "");

// Decide which price to show for a line item for THIS customer
const getCustomerItemPrice = (item, menuMap) => {
  const menu = item.menu_item_id ? menuMap[item.menu_item_id] : null;

  // HALF ORDER (paired) → always use half_price from menu table
  if (item.type === "paired") {
    if (menu && menu.half_price != null) {
      return Number(menu.half_price) || 0;
    }
    // Fallback if menu not loaded or half_price null
    if (typeof item.price === "number") {
      return item.price / 2;
    }
    return Number(item.price || 0);
  }

  // FULL ORDER → use full price; fall back to menu price if missing
  if (typeof item.price === "number") {
    return item.price;
  }
  if (menu && menu.price != null) {
    return Number(menu.price) || 0;
  }
  return 0;
};

const CustomerDashboard = () => {
  const { restaurant_id, table_no } = useParams();
  const navigate = useNavigate();
  const { isDarkMode, toggleTheme } = useTheme();

  const [restaurant, setRestaurant] = useState(null);
  const [activeOrders, setActiveOrders] = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);
  const [halfSessions, setHalfSessions] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tableSession, setTableSession] = useState(null);

  // Build quick lookup: menuId -> { price, half_price, name, ... }
  const menuMap = useMemo(() => {
    const map = {};
    (menuItems || []).forEach((m) => {
      map[m.id] = m;
    });
    return map;
  }, [menuItems]);

  /* ---------------- Status helpers ---------------- */

  const getStatusIcon = (status) => {
    switch (status) {
      case "PENDING":
        return <Clock className="text-orange-500" size={18} />;
      case "PREPARING":
        return <ChefHat className="text-blue-500" size={18} />;
      case "READY":
        return <Bell className="text-purple-500" size={18} />;
      case "SERVED":
      case "COMPLETED":
        return <CheckCircle className="text-green-500" size={18} />;
      case "CANCELLED":
        return <XCircle className="text-red-500" size={18} />;
      default:
        return <Loader className="text-gray-500 animate-spin" size={18} />;
    }
  };

  const getStatusChipClass = (status) => {
    const base = "px-2 py-0.5 rounded-full text-xs font-bold border";
    const map = {
      PENDING: "bg-orange-100 text-orange-800 border-orange-300",
      PREPARING: "bg-blue-100 text-blue-800 border-blue-300",
      READY: "bg-purple-100 text-purple-800 border-purple-300",
      SERVED: "bg-green-100 text-green-800 border-green-300",
      COMPLETED: "bg-green-100 text-green-800 border-green-300",
      CANCELLED: "bg-red-100 text-red-800 border-red-300",
    };
    return `${base} ${
      map[status] || "bg-gray-100 text-gray-800 border-gray-300"
    }`;
  };

  // UPDATED: messages changed to be suitable for table service (no "Please collect")
  const getStatusMessage = (status) => {
    const messages = {
      PENDING: "⏳ Your order has been received",
      PREPARING: "👨‍🍳 Your order is being prepared",
      READY: "✨ Your order is ready to be served",
      SERVED: "🍽️ Your order has been served",
      COMPLETED: "👍 Order completed",
      CANCELLED: "❌ Order cancelled",
    };
    return messages[status] || status;
  };

  const getTimeRemaining = (expiresAt) => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diff = expiry - now;
    return Math.max(0, Math.floor(diff / 60000));
  };

  /* ---------------- Data fetchers ---------------- */

  const fetchRestaurant = async () => {
    try {
      const res = await axios.get(`${API_URL}/restaurants/${restaurant_id}`);
      setRestaurant(res.data);
    } catch (err) {
      console.error("Restaurant fetch error:", err);
    }
  };

  const fetchMenu = async () => {
    try {
      const res = await axios.get(`${API_URL}/restaurants/${restaurant_id}/menu`);
    const data = Array.isArray(res.data) ? res.data : [];
      setMenuItems(data);
    } catch (err) {
      console.error("Menu fetch error:", err);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await axios.get(`${API_URL}/orders`, {
        params: { restaurant_id, page: 1, page_size: 50 },
      });

      const data = res.data;
      const list = Array.isArray(data.orders)
        ? data.orders
        : Array.isArray(data)
        ? data
        : [];

      // Orders where this table participates
      const tableOrders = list.filter((order) => {
        const t = order.table_no || "";
        return t === table_no || t.includes(table_no);
      });

      const active = tableOrders.filter((o) =>
        ["PENDING", "PREPARING", "READY"].includes(o.status)
      );
      const history = tableOrders.filter((o) =>
        ["SERVED", "COMPLETED", "CANCELLED"].includes(o.status)
      );

      setActiveOrders(active);
      setOrderHistory(history);
      setLoading(false);
    } catch (err) {
      console.error("Orders fetch error:", err);
      setLoading(false);
    }
  };

  const fetchHalfSessions = async () => {
    try {
      const res = await axios.get(`${API_URL}/half-order/active`, {
        params: { restaurant_id },
      });
      const sessions = Array.isArray(res.data) ? res.data : [];
      const mySessions = sessions.filter(
        (s) => s.table_no === table_no || s.joined_by_table_no === table_no
      );
      setHalfSessions(mySessions);
    } catch (err) {
      console.error("Half sessions fetch error:", err);
    }
  };

  const fetchTableSession = async () => {
    try {
      const res = await axios.get(`${API_URL}/table-sessions/active-orders`, {
        params: { restaurant_id, table_no },
      });
      if (res.data && res.data.session) {
        setTableSession(res.data.session);
      }
    } catch (err) {
      console.error("Table session fetch error:", err);
    }
  };

  /* ---------------- Effects ---------------- */

  // Initial load
  useEffect(() => {
    fetchRestaurant();
    fetchMenu();
    fetchOrders();
    fetchHalfSessions();

    // Poll orders + sessions for real-time updates
    const interval = setInterval(() => {
      fetchOrders();
      fetchHalfSessions();
    }, 8000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant_id, table_no]);

  // Optional WebSocket (if you already have one for other pages)
  useEffect(() => {
    try {
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const host = window.location.host;
      const wsUrl = `${proto}://${host}/ws/${restaurant_id}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => console.log("Customer WS connected");
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (
          msg.type === "order.status_updated" ||
          msg.type === "order.created" ||
          msg.type === "session.created" ||
          msg.type === "session.joined"
        ) {
          fetchOrders();
          fetchHalfSessions();
        }
      };
      ws.onerror = (err) => console.error("Customer WS error", err);
      ws.onclose = () => console.log("Customer WS closed");

      return () => ws.close();
    } catch (err) {
      console.error("WS init error:", err);
    }
  }, [restaurant_id, table_no]);

  /* ---------------- Loading ---------------- */

  if (loading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          isDarkMode
            ? "bg-gradient-to-br from-gray-900 via-gray-950 to-black"
            : "bg-gradient-to-br from-orange-50 to-amber-50"
        }`}
      >
        <Loader
          className={
            isDarkMode ? "animate-spin text-amber-400" : "animate-spin text-orange-600"
          }
          size={40}
        />
      </div>
    );
  }

  const containerBg = isDarkMode
    ? "bg-gradient-to-br from-gray-900 via-gray-950 to-black"
    : "bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100";

  /* ---------------- Render ---------------- */

  return (
    <div className={`min-h-screen ${containerBg} transition-colors duration-500`}>
      {/* Header */}
      <header
        className={
          isDarkMode
            ? "bg-gray-950/95 border-b border-gray-800"
            : "bg-white/95 border-b border-orange-300 shadow-sm"
        }
      >
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/menu/${restaurant_id}/${table_no}`)}
              className={`p-2 rounded-full ${
                isDarkMode ? "hover:bg-gray-900" : "hover:bg-orange-50"
              } transition`}
            >
              <ArrowLeft
                size={22}
                className={isDarkMode ? "text-amber-300" : "text-orange-500"}
              />
            </button>
            <div>
              <h1
                className={`text-xl font-semibold ${
                  isDarkMode ? "text-amber-200" : "text-orange-600"
                }`}
              >
                {restaurant?.name || "The Orange Bistro"}
              </h1>
              <p className={isDarkMode ? "text-xs text-gray-400" : "text-xs text-gray-600"}>
                Table {table_no}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-full border text-xs ${
                isDarkMode
                  ? "border-gray-700 bg-gray-900 hover:bg-gray-800"
                  : "border-orange-300 bg-white hover:bg-orange-50"
              } transition`}
            >
              {isDarkMode ? (
                <Sun className="w-5 h-5 text-yellow-300" />
              ) : (
                <Moon className="w-5 h-5 text-gray-700" />
              )}
            </button>
            <button
              onClick={() => navigate(`/menu/${restaurant_id}/${table_no}`)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                isDarkMode
                  ? "bg-amber-500 text-black hover:bg-amber-400"
                  : "bg-orange-500 text-white hover:bg-orange-600"
              } transition`}
            >
              Order More
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-8">
        {/* Half-order sessions info */}
        {halfSessions.length > 0 && (
          <section className="space-y-3">
            <h2
              className={`text-lg font-semibold ${
                isDarkMode ? "text-amber-200" : "text-orange-600"
              }`}
            >
              Half-Order Sessions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {halfSessions.map((session) => {
                const isCreator = session.table_no === table_no;
                const minutesLeft = getTimeRemaining(session.expires_at);
                return (
                  <div
                    key={session.id}
                    className={`rounded-lg p-3 text-sm border ${
                      isDarkMode
                        ? "bg-gray-950/80 border-amber-700/70"
                        : "bg-white border-orange-200"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <p
                        className={`font-semibold ${
                          isDarkMode ? "text-amber-100" : "text-orange-700"
                        }`}
                      >
                        {session.menu_item_name}
                      </p>
                      <span
                        className={`px-2 py-0.5 text-[11px] rounded-full font-semibold ${
                          session.status === "ACTIVE"
                            ? "bg-green-500 text-white"
                            : "bg-blue-500 text-white"
                        }`}
                      >
                        {session.status}
                      </span>
                    </div>
                    <p className={isDarkMode ? "text-gray-300" : "text-gray-700"}>
                      {isCreator ? "You started this session" : "You joined this session"}
                    </p>
                    {session.status === "JOINED" && (
                      <p
                        className={
                          isDarkMode ? "text-xs text-green-400" : "text-xs text-green-700"
                        }
                      >
                        Paired with table{" "}
                        {isCreator ? session.joined_by_table_no : session.table_no}
                      </p>
                    )}
                    {session.status === "ACTIVE" && (
                      <p
                        className={`mt-1 text-xs font-medium ${
                          isDarkMode ? "text-amber-300" : "text-orange-700"
                        }`}
                      >
                        {minutesLeft} mins left to find a partner
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Active Orders */}
        {activeOrders.length > 0 ? (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔥</span>
              <h2
                className={`text-lg font-semibold ${
                  isDarkMode ? "text-amber-200" : "text-orange-700"
                }`}
              >
                Active Orders
              </h2>
            </div>

            <div className="space-y-4">
              {activeOrders.map((order) => {
                const items = parseItems(order.items);
                const isPairedOrder = (order.table_no || "").includes("+");

                // Customer total = sum(full items + half items using menu.half_price)
                const customerTotal = items.reduce((sum, it) => {
                  const price = getCustomerItemPrice(it, menuMap);
                  const qty = it.quantity || 1;
                  return sum + price * qty;
                }, 0);

                return (
                  <div
                    key={order.id}
                    className={`rounded-xl border shadow-sm overflow-hidden ${
                      isDarkMode
                        ? "bg-gray-950/90 border-gray-800"
                        : "bg-white border-gray-200"
                    }`}
                  >
                    {/* Top status bar */}
                    <div
                      className={`flex justify-between items-center px-4 py-2 text-xs border-b ${
                        isDarkMode
                          ? "bg-gray-900 border-gray-800"
                          : "bg-slate-50 border-gray-200"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {getStatusIcon(order.status)}
                        <span className="font-semibold">Order #{order.id}</span>
                      </div>
                      <span className={getStatusChipClass(order.status)}>
                        {order.status}
                      </span>
                    </div>

                    <div className="px-4 py-3 space-y-3 text-sm">
                      {/* Shared banner */}
                      {isPairedOrder && (
                        <div
                          className={`rounded-md px-3 py-2 text-xs font-medium flex items-center gap-2 ${
                            isDarkMode
                              ? "bg-blue-950/70 border border-blue-700 text-blue-100"
                              : "bg-blue-50 border border-blue-300 text-blue-800"
                          }`}
                        >
                          <span className="text-base">👥</span>
                          <span>Shared Order: {order.table_no}</span>
                        </div>
                      )}

                      {/* Status message */}
                      <p
                        className={
                          isDarkMode ? "text-xs text-gray-300" : "text-xs text-gray-600"
                        }
                      >
                        {getStatusMessage(order.status)}
                      </p>

                      {/* Items */}
                      <div className="mt-1 space-y-2">
                        {items.map((item, idx) => {
                          const qty = item.quantity || 1;
                          const price = getCustomerItemPrice(item, menuMap);
                          const lineTotal = price * qty;

                          return (
                            <div
                              key={idx}
                              className={`flex items-center justify-between border-b last:border-none pb-2 ${
                                isDarkMode ? "border-gray-800" : "border-gray-100"
                              }`}
                            >
                              <div className="flex-1">
                                <p
                                  className={
                                    isDarkMode
                                      ? "text-sm font-medium text-gray-100"
                                      : "text-sm font-medium text-gray-800"
                                  }
                                >
                                  {item.name}
                                </p>
                                <div className="flex items-center gap-2 text-[11px] mt-0.5">
                                  <span
                                    className={
                                      isDarkMode ? "text-gray-400" : "text-gray-500"
                                    }
                                  >
                                    Qty: {qty}
                                  </span>
                                  {item.type === "paired" && (
                                    <span
                                      className={`px-2 py-0.5 rounded-full ${
                                        isDarkMode
                                          ? "bg-amber-900 text-amber-200"
                                          : "bg-orange-50 text-orange-700"
                                      }`}
                                    >
                                      Half-Order
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right text-sm font-semibold">
                                <span
                                  className={
                                    item.type === "paired"
                                      ? isDarkMode
                                        ? "text-amber-300"
                                        : "text-orange-600"
                                      : isDarkMode
                                      ? "text-gray-100"
                                      : "text-gray-800"
                                  }
                                >
                                  {formatCurrency(lineTotal)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Bill summary */}
                      <div
                        className={`mt-2 pt-2 border-t text-sm flex justify-between items-center ${
                          isDarkMode ? "border-gray-800" : "border-gray-200"
                        }`}
                      >
                        <span
                          className={
                            isDarkMode
                              ? "font-semibold text-gray-100"
                              : "font-semibold text-gray-800"
                          }
                        >
                          Total:
                        </span>
                        <span
                          className={
                            isDarkMode
                              ? "text-lg font-bold text-amber-300"
                              : "text-lg font-bold text-orange-600"
                          }
                        >
                          {formatCurrency(customerTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <section>
            <div
              className={`rounded-xl border text-center py-10 px-4 ${
                isDarkMode ? "bg-gray-950/90 border-gray-800" : "bg-white border-gray-200"
              }`}
            >
              <div className="text-4xl mb-3">🍽️</div>
              <h3
                className={
                  isDarkMode
                    ? "text-lg font-semibold text-gray-100 mb-1"
                    : "text-lg font-semibold text-gray-800 mb-1"
                }
              >
                No Active Orders
              </h3>
              <p
                className={
                  isDarkMode ? "text-xs text-gray-400 mb-4" : "text-xs text-gray-600 mb-4"
                }
              >
                Place your order from the menu to see it here.
              </p>
              <button
                onClick={() => navigate(`/menu/${restaurant_id}/${table_no}`)}
                className={
                  isDarkMode
                    ? "px-5 py-2 rounded-lg bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400"
                    : "px-5 py-2 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600"
                }
              >
                Browse Menu
              </button>
            </div>
          </section>
        )}

        {/* Order History */}
        {orderHistory.length > 0 && (
          <section className="pb-6 space-y-3">
            <h2
              className={`text-lg font-semibold ${
                isDarkMode ? "text-gray-200" : "text-gray-700"
              }`}
            >
              Order History
            </h2>
            <div className="space-y-3">
              {orderHistory.map((order) => {
                const items = parseItems(order.items);
                const created = new Date(order.created_at);

                // Same price logic for history
                const orderTotal = items.reduce((sum, it) => {
                  const price = getCustomerItemPrice(it, menuMap);
                  const qty = it.quantity || 1;
                  return sum + price * qty;
                }, 0);

                return (
                  <div
                    key={order.id}
                    className={`rounded-lg border text-xs p-3 ${
                      isDarkMode
                        ? "bg-gray-950/90 border-gray-800"
                        : "bg-white border-gray-200"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p
                          className={
                            isDarkMode
                              ? "font-semibold text-gray-100"
                              : "font-semibold text-gray-800"
                          }
                        >
                          Order #{order.id}
                        </p>
                        <p
                          className={
                            isDarkMode
                              ? "text-[11px] text-gray-400"
                              : "text-[11px] text-gray-500"
                          }
                        >
                          {created.toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                          })}{" "}
                          •{" "}
                          {created.toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <span className={getStatusChipClass(order.status)}>
                        {order.status}
                      </span>
                    </div>

                    <div className="space-y-1 mb-2">
                      {items.map((item, idx) => {
                        const qty = item.quantity || 1;
                        const price = getCustomerItemPrice(item, menuMap);
                        const lineTotal = price * qty;

                        return (
                          <div key={idx} className="flex justify-between">
                            <span
                              className={
                                isDarkMode ? "text-gray-200" : "text-gray-700"
                              }
                            >
                              {item.name} × {qty}
                              {item.type === "paired" && (
                                <span
                                  className={
                                    isDarkMode
                                      ? "ml-2 text-[10px] px-2 py-0.5 rounded-full bg-amber-900 text-amber-200"
                                      : "ml-2 text-[10px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-700"
                                  }
                                >
                                  Half
                                </span>
                              )}
                            </span>
                            <span
                              className={
                                isDarkMode ? "text-gray-300" : "text-gray-600"
                              }
                            >
                              {formatCurrency(lineTotal)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex justify-between items-center pt-1 border-t border-gray-200 dark:border-gray-800">
                      <span
                        className={
                          isDarkMode
                            ? "font-semibold text-gray-100"
                            : "font-semibold text-gray-800"
                        }
                      >
                        Total:
                      </span>
                      <span
                        className={
                          isDarkMode
                            ? "font-bold text-amber-300"
                            : "font-bold text-orange-600"
                        }
                      >
                        {formatCurrency(orderTotal)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default CustomerDashboard;
