import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { WebSocketProvider, useWebSocket } from "../context/WebSocketContext";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";

import {
  LogOut,
  Moon,
  Sun,
  Plus,
  ShoppingBag,
  Table as TableIcon,
  Menu,
  Edit,
  Trash2,
  Clock,
} from "lucide-react";

import { formatCurrency, getItemTypeIndicator } from "../utils/helpers";

const API_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";
const DEFAULT_PAGE_SIZE = 100;

/** Normalize table/session key for grouping */
const normalizeTableKey = (raw) => {
  if ((raw === null || raw === undefined || raw === "") && raw !== 0) return "unassigned";
  return String(raw).trim();
};

/** Format half-order label, e.g. "3+1" -> "T3 + T1" */
const formatHalfOrderLabel = (raw) => {
  if (!raw) return raw;
  if (typeof raw !== "string") return String(raw);

  const parts = raw
    .split("+")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length <= 1) return raw;

  const norm = parts.map((p) => {
    const match = p.match(/([A-Za-z]*)(\d+)/);
    if (match) {
      const prefix = match[1] ? match[1].toUpperCase().replace(/[^A-Z]/g, "") : "T";
      return `${prefix}${match[2]}`;
    }
    return `T${p}`;
  });

  return norm.join(" + ");
};

/** Parse items when backend sends JSON string */
const parseItems = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === "object") return [parsed];
      return [];
    } catch {
      return [];
    }
  }
  if (typeof raw === "object") return [raw];
  return [];
};

/**
 * Parse incoming timestamp robustly.
 * If value is an ISO string without timezone (e.g. "2025-12-24T00:30:00"),
 * treat it as UTC by appending a 'Z'. This avoids double-localization issues
 * where Date() interprets the string as local time.
 */
const parseToDate = (value) => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    // ISO-like without timezone: YYYY-MM-DDTHH:MM:SS(.sss)
    const isoNoTz = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;
    // DB style: YYYY-MM-DD HH:MM:SS(.sss) (space separator) - treat as UTC
    const dbSpace = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/;
    if (isoNoTz.test(value)) {
      try {
        return new Date(value + "Z"); // treat as UTC
      } catch {
        return new Date(value);
      }
    }
    if (dbSpace.test(value)) {
      try {
        return new Date(value.replace(" ", "T") + "Z");
      } catch {
        return new Date(value);
      }
    }
    return new Date(value);
  }
  return new Date();
};

/** Format IST date/time display */
const formatDateTimeIST = (value) => {
  try {
    const date = parseToDate(value);
    const dateStr = date.toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const timeStr = date.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    const dayStr = date.toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
    });
    return { dateStr, timeStr, dayStr };
  } catch {
    return { dateStr: "", timeStr: "", dayStr: "" };
  }
};

/** Order title: same-day -> yyyymmdd-id */
const orderDisplayLabel = (order) => {
  const created = parseToDate(order.created_at || order.createdAt || order.timestamp || Date.now());
  const createdIST = new Date(
    created.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  const nowIST = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  const sameDay =
    createdIST.getFullYear() === nowIST.getFullYear() &&
    createdIST.getMonth() === nowIST.getMonth() &&
    createdIST.getDate() === nowIST.getDate();

  if (sameDay) {
    const y = createdIST.getFullYear();
    const m = String(createdIST.getMonth() + 1).padStart(2, "0");
    const d = String(createdIST.getDate()).padStart(2, "0");
    return `Order #${y}${m}${d}-${order.id || order.order_id}`;
  }
  return `Order #${order.id || order.order_id}`;
};

/**
 * Time windows (IST-based):
 *  - today: current calendar day
 *  - week: last 7 days
 *  - month: last 30 days
 *  - quarter: last 90 days
 */
const getTimeRangeDates = (period) => {
  const now = new Date();
  const nowIST = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  const startIST = new Date(nowIST);

  switch (period) {
    case "today":
      // from midnight of today
      startIST.setHours(0, 0, 0, 0);
      break;
    case "week":
      startIST.setDate(startIST.getDate() - 7);
      startIST.setHours(0, 0, 0, 0);
      break;
    case "month":
      startIST.setDate(startIST.getDate() - 30);
      startIST.setHours(0, 0, 0, 0);
      break;
    case "quarter":
      startIST.setDate(startIST.getDate() - 90);
      startIST.setHours(0, 0, 0, 0);
      break;
    default:
      startIST.setFullYear(1970, 0, 1);
      startIST.setHours(0, 0, 0, 0);
  }

  return { start: startIST, end: nowIST };
};

/* ------------------------- Main counter dashboard ------------------------- */

const CounterDashboardContent = () => {
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { lastMessage } = useWebSocket();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [tables, setTables] = useState([]);

  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showAddTable, setShowAddTable] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [newMenuItem, setNewMenuItem] = useState({
    name: "",
    description: "",
    category: "",
    item_type: "veg",
    price: "",
    half_price: "",
    available: true,
  });

  const [newTable, setNewTable] = useState({
    table_no: "",
    capacity: 4,
  });

  const [historyOrders, setHistoryOrders] = useState([]);
  const [historyPeriod, setHistoryPeriod] = useState("today");
  const [historyOrderType, setHistoryOrderType] = useState("all");
  const [tabValue, setTabValue] = useState("orders");

  /* ---------------------- Initial fetch ---------------------- */

  useEffect(() => {
    if (user?.restaurant_id) {
      fetchOrders();
      fetchMenu();
      fetchTables();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (tabValue === "history") {
      fetchHistoryOrders();
    }
  }, [historyPeriod, historyOrderType, tabValue]);

  /* ---------------------- WebSocket live refresh ---------------------- */

  useEffect(() => {
    if (!lastMessage) return;
    const type = lastMessage.type || lastMessage.event || "";

    if (
      type.includes("order") ||
      type.includes("session") ||
      type.includes("half") ||
      type.includes("table")
    ) {
      fetchOrders();
      fetchMenu();
      fetchTables();
      if (tabValue === "history") {
        fetchHistoryOrders();
      }
    }
  }, [lastMessage, tabValue]);

  /* ---------------------- API calls ---------------------- */

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token") || "";
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchOrders = async () => {
    if (!user?.restaurant_id) {
      setOrders([]);
      return;
    }
    try {
      const headers = getAuthHeaders();
      const resp = await axios.get(`${API_URL}/api/orders`, {
        headers,
        params: {
          restaurant_id: Number(user.restaurant_id),
          page: 1,
          page_size: DEFAULT_PAGE_SIZE,
        },
      });

      const data = resp.data;
      let list = [];

      if (Array.isArray(data)) list = data;
      else if (Array.isArray(data.orders)) list = data.orders;
      else if (Array.isArray(data.data)) list = data.data;
      else if (Array.isArray(data.results)) list = data.results;
      else {
        const arr = Object.values(data || {}).find((v) => Array.isArray(v));
        if (arr) list = arr;
      }

      if (!Array.isArray(list) && data && (data.id || data.order_id)) {
        list = [data];
      }

      setOrders(list || []);
    } catch (error) {
      console.error("fetchOrders error:", error);
      setOrders([]);
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        toast.error("Authentication required — please login.");
        navigate('/login');
        return;
      }
      toast.error("Unable to fetch orders. Please check server connectivity.");
    }
  };

  const fetchMenu = async () => {
    if (!user?.restaurant_id) return;
    try {
      const headers = getAuthHeaders();
const resp = await axios.get(
  `${API_URL}/api/restaurants/${Number(user.restaurant_id)}/menu`,
  { headers }
);

      const data = resp.data;
      if (Array.isArray(data)) setMenuItems(data);
      else if (Array.isArray(data.menu)) setMenuItems(data.menu);
      else if (Array.isArray(data.data)) setMenuItems(data.data);
      else {
        const arr = Object.values(data || {}).find((v) => Array.isArray(v));
        if (arr) setMenuItems(arr);
        else setMenuItems([]);
      }
    } catch (error) {
      console.error("fetchMenu error:", error);
      setMenuItems([]);
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        toast.error("Authentication required — please login.");
        navigate('/login');
        return;
      }
      toast.error("Unable to fetch menu.");
    }
  };

  const fetchTables = async () => {
    if (!user?.restaurant_id) return;
    try {
      const headers = getAuthHeaders();
      // Use counter endpoint which returns computed statuses (AVAILABLE/OCCUPIED/RESERVED)
      const resp = await axios.get(`${API_URL}/api/counter/tables`, {
        headers,
        params: { restaurant_id: Number(user.restaurant_id) },
      });
      const data = resp.data;
      if (Array.isArray(data)) setTables(data);
      else if (Array.isArray(data.tables)) setTables(data.tables);
      else if (Array.isArray(data.data)) setTables(data.data);
      else {
        const arr = Object.values(data || {}).find((v) => Array.isArray(v));
        if (arr) setTables(arr);
        else setTables([]);
      }
    } catch (error) {
      console.error("fetchTables error:", error);
      setTables([]);
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        toast.error("Authentication required — please login.");
        navigate('/login');
        return;
      }
      toast.error("Unable to fetch tables.");
    }
  };

  const fetchHistoryOrders = async () => {
    if (!user?.restaurant_id) {
      setHistoryOrders([]);
      return;
    }
    try {
      const headers = getAuthHeaders();
      let params = {
        restaurant_id: Number(user.restaurant_id),
        type: historyOrderType,
        page: 1,
        page_size: 100, // Fetch more for history
      };

      if (historyPeriod === "month") {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        params.period = "custom";
        params.start_date = startOfMonth.toISOString().split('T')[0];
        params.end_date = now.toISOString().split('T')[0];
      } else if (historyPeriod === "last_3_months") {
        const now = new Date();
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        params.period = "custom";
        params.start_date = threeMonthsAgo.toISOString().split('T')[0];
        params.end_date = now.toISOString().split('T')[0];
      } else {
        params.period = historyPeriod;
      }

      const resp = await axios.get(`${API_URL}/api/orders/history`, {
        headers,
        params,
      });
      const data = resp.data;
      if (Array.isArray(data.orders)) setHistoryOrders(data.orders);
      else setHistoryOrders([]);
    } catch (error) {
      console.error("fetchHistoryOrders error:", error);
      setHistoryOrders([]);
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        toast.error("Authentication required — please login.");
        navigate('/login');
        return;
      }
      toast.error("Unable to fetch order history.");
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    if (!orderId) return;
    try {
      const headers = getAuthHeaders();
      await axios.patch(
        `${API_URL}/api/orders/${orderId}`,
        { status: newStatus },
        { headers }
      );
      toast.success("Order status updated");
      fetchOrders();
    } catch (error) {
      console.error("updateOrderStatus error:", error);
      toast.error("Failed to update order status");
    }
  };

  const addMenuItem = async () => {
    if (!user?.restaurant_id) return;
    try {
      const headers = getAuthHeaders();
      const body = {
        ...newMenuItem,
        price: newMenuItem.price ? parseFloat(newMenuItem.price) : 0,
        half_price: newMenuItem.half_price
          ? parseFloat(newMenuItem.half_price)
          : null,
      };
      await axios.post(
        `${API_URL}/api/restaurants/${Number(user.restaurant_id)}/menu`,
        body,
        { headers }
      );
      toast.success("Menu item added");
      setShowAddMenu(false);
      setNewMenuItem({
        name: "",
        description: "",
        category: "",
        item_type: "veg",
        price: "",
        half_price: "",
        available: true,
      });
      fetchMenu();
    } catch (error) {
      console.error("addMenuItem error:", error);
      toast.error("Failed to add menu item");
    }
  };

  const updateMenuItem = async () => {
    if (!editingItem || !editingItem.id) return;
    try {
      const headers = getAuthHeaders();
      const body = {
        ...editingItem,
        price: editingItem.price ? parseFloat(editingItem.price) : 0,
        half_price: editingItem.half_price
          ? parseFloat(editingItem.half_price)
          : null,
      };
      await axios.put(`${API_URL}/api/menu/${editingItem.id}`, body, {
        headers,
      });
      toast.success("Menu item updated");
      setEditingItem(null);
      fetchMenu();
    } catch (error) {
      console.error("updateMenuItem error:", error);
      toast.error("Failed to update menu item");
    }
  };

  const deleteMenuItem = async (itemId) => {
    if (!itemId) return;
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    try {
      const headers = getAuthHeaders();
      await axios.delete(`${API_URL}/api/menu/${itemId}`, { headers });
      toast.success("Menu item deleted");
      fetchMenu();
    } catch (error) {
      console.error("deleteMenuItem error:", error);
      toast.error("Failed to delete menu item");
    }
  };

  const addTable = async () => {
    if (!user?.restaurant_id) return;
    try {
      const headers = getAuthHeaders();
      const body = { ...newTable, table_no: newTable.table_no };
      await axios.post(
        `${API_URL}/api/restaurants/${Number(user.restaurant_id)}/tables`,
        body,
        { headers }
      );
      toast.success("Table added");
      setShowAddTable(false);
      setNewTable({ table_no: "", capacity: 4 });
      fetchTables();
    } catch (error) {
      console.error("addTable error:", error);
      toast.error("Failed to add table");
    }
  };

  const deleteTable = async (tableId) => {
    if (!tableId) return;
    if (!window.confirm("Are you sure you want to delete this table?")) return;
    try {
      const headers = getAuthHeaders();
      await axios.delete(`${API_URL}/api/tables/${tableId}`, { headers });
      toast.success("Table deleted");
      fetchTables();
    } catch (error) {
      console.error("deleteTable error:", error);
      toast.error("Failed to delete table");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const getQRCodeLink = (table) =>
    `${window.location.origin}/menu/${user.restaurant_id}/${table.table_no}`;

  /* ---------------------- Derived data ---------------------- */

  const activeOrders = (orders || []).filter((o) => {
    const s = (o.status || "").toString().toUpperCase();
    return s !== "COMPLETED" && s !== "CANCELLED";
  });

  const groupedActive = useMemo(
    () =>
      activeOrders.reduce((acc, ord) => {
        // Prefer grouping by S2 session token when available, fallback to table_no
        const key = ord.session_token
          ? ord.session_token
          : normalizeTableKey(ord.table_no || ord.table || ord.tableNo || "unassigned");
        if (!acc[key]) acc[key] = [];
        acc[key].push(ord);
        return acc;
      }, {}),
    [activeOrders]
  );

  const dashboardSummary = useMemo(() => {
    const totalGroups = Object.keys(groupedActive).length;
    const totalOrders = activeOrders.length;
    const totalAmount = Object.keys(groupedActive).reduce((sum, key) => {
      const group = groupedActive[key];
      const groupSum = group.reduce(
        (s, o) => s + Number(o.total_amount || o.total || o.amount || 0),
        0
      );
      return sum + groupSum;
    }, 0);

    const nowIST = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );
    const dateStr = nowIST.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const dayStr = nowIST.toLocaleDateString("en-IN", { weekday: "short" });
    const timeStr = nowIST.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    return { totalGroups, totalOrders, totalAmount, dateStr, dayStr, timeStr };
  }, [groupedActive, activeOrders]);

  const filteredHistoryOrders = useMemo(() => {
    if (!historyOrders) return [];
    if (historyOrderType === "all") return historyOrders;
    return historyOrders.filter((order) => {
      if (historyOrderType === "half") return order.order_type === "Half";
      if (historyOrderType === "full") return order.order_type === "Full";
      return true;
    });
  }, [historyOrders, historyOrderType]);

  /* ---------------------- UI rendering ---------------------- */

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 transition-colors duration-500">
      {/* Top bar */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl shadow-lg border-b border-white/20 dark:border-gray-700/20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1
              className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-600"
              style={{ fontFamily: "Space Grotesk, sans-serif" }}
            >
              Counter Dashboard
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Welcome, {user?.username}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={toggleTheme}
              className="p-3 rounded-full bg-white/70 dark:bg-gray-700/70 backdrop-blur-md shadow-md hover:shadow-lg transition-all"
            >
              {isDarkMode ? (
                <Sun className="w-5 h-5 text-amber-500" />
              ) : (
                <Moon className="w-5 h-5 text-gray-700" />
              )}
            </button>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="border-orange-500 dark:border-amber-500"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-6 py-6 lg:px-8 lg:py-8">
        <Tabs value={tabValue} onValueChange={(v) => setTabValue(v)} className="space-y-6">
          <TabsList className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl p-1 rounded-xl">
            <TabsTrigger value="orders">
              <ShoppingBag className="w-4 h-4 mr-2" />
              Orders
            </TabsTrigger>
            <TabsTrigger value="menu">
              <Menu className="w-4 h-4 mr-2" />
              Menu
            </TabsTrigger>
            <TabsTrigger value="tables">
              <TableIcon className="w-4 h-4 mr-2" />
              Tables
            </TabsTrigger>
            <TabsTrigger value="history">
              <Clock className="w-4 h-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          {/* Summary bar */}
          <div className="mb-6 flex flex-wrap gap-6 items-center justify-between bg-white/80 dark:bg-gray-800/80 px-6 py-4 rounded-xl shadow-md">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Today
              </div>
              <div className="font-semibold text-lg">
                {dashboardSummary.dayStr} • {dashboardSummary.dateStr} •{" "}
                {dashboardSummary.timeStr} IST
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-xs text-gray-500">Active Sessions</div>
                <div className="font-semibold text-lg">
                  {dashboardSummary.totalGroups}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500">Active Orders</div>
                <div className="font-semibold text-lg">
                  {dashboardSummary.totalOrders}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500">Total Active Amount</div>
                <div className="font-semibold text-lg text-orange-600">
                  {formatCurrency(dashboardSummary.totalAmount)}
                </div>
              </div>
            </div>
          </div>

          {/* ------------------- Active Orders tab ------------------- */}
         {/* ------------------- Active Orders tab ------------------- */}
<TabsContent value="orders" className="space-y-4">
  <div className="flex justify-between items-center mb-2">
    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
      Active Orders
    </h2>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {(() => {
      const grouped = groupedActive;
      const groupsArray = Object.keys(grouped).map((k) => ({
        key: k,
        orders: grouped[k],
      }));

      if (groupsArray.length === 0) {
        return (
          <div className="text-sm text-gray-500">
            No active orders.
          </div>
        );
      }

      return groupsArray.map((group) => {
        const firstOrder = group.orders[0];

        // Compute table label compatible with both field names
        const tableLabel = firstOrder.table_reference || firstOrder.table_no || "-";

        const isHalfOrder = group.orders.some(
          (o) =>
            (String(o.table_no || "").includes("+")) ||
            !!o.is_half ||
            !!o.half_order
        );

        const formattedTableLabel = isHalfOrder
          ? formatHalfOrderLabel(tableLabel || group.key)
          : `Table ${tableLabel}`;

        const waitingTime = Math.max(
          0,
          Math.floor(
            (Date.now() - parseToDate(firstOrder.created_at || firstOrder.createdAt || firstOrder.timestamp || Date.now())) / 60000
          )
        );

        const groupTotal = group.orders.reduce(
          (sum, o) =>
            sum +
            Number(o.total_amount || o.total || o.amount || 0),
          0
        );

        const subOrdersCount = group.orders.length;
        const displayLabel = orderDisplayLabel(firstOrder);

        return (
          <Card
            key={`group-${group.key}`}
            className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md hover:shadow-xl transition-all rounded-2xl border border-orange-100/60 dark:border-gray-700/60"
          >
            <CardHeader className="pt-4 pb-3 px-5">
              <CardTitle className="flex justify-between items-start">
                <div>
                  <div
                    style={{ fontFamily: "Space Grotesk, sans-serif" }}
                    className="font-semibold text-gray-900 dark:text-gray-50"
                  >
                    {displayLabel}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    {formattedTableLabel}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const name = firstOrder.customer_name || firstOrder.customer || "Guest";
                        setHistoryPeriod("today");
                        setHistoryCustomerFilter(name || null);
                        setTabValue("history");
                      }}
                      className="text-left text-sm text-gray-600 dark:text-gray-300 hover:underline"
                    >
                      {firstOrder.customer_name || firstOrder.customer || "Guest"}
                    </button>
                  </div>
                </div>
                <Badge className="px-3 py-1 text-xs font-semibold rounded-full">
                  {(() => {
                    const statuses = Array.from(
                      new Set(
                        group.orders.map((o) =>
                          (o.status || "").toString().toUpperCase()
                        )
                      )
                    );
                    if (statuses.some((s) => s === "PENDING")) return "PENDING";
                    if (statuses.some((s) => s === "PREPARING")) return "PREPARING";
                    if (statuses.some((s) => s === "READY")) return "READY";
                    if (statuses.some((s) => s === "SERVED")) return "SERVED";
                    return statuses[0] || "—";
                  })()}
                </Badge>
              </CardTitle>
            </CardHeader>

            <CardContent className="px-5 pb-4 pt-0 space-y-4">
              {/* Group summary row */}
              <div className="flex items-center justify-between">
                <div>
                  <div
                    className="text-2xl font-bold text-orange-600 dark:text-amber-500"
                    style={{ fontFamily: "Space Grotesk, sans-serif" }}
                  >
                    {formatCurrency(groupTotal)}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Session total amount
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    {subOrdersCount}
                  </div>
                  <div className="text-xs text-gray-500">Orders</div>
                </div>
              </div>

              {/* Orders list inside the session */}
              <div className="space-y-3 rounded-xl bg-gray-50/80 dark:bg-gray-950/40 p-3">
                {group.orders.map((ord) => {
                  const rawItems =
                    ord.items ||
                    ord.order_items ||
                    ord.cart_items ||
                    ord.line_items ||
                    [];
                  const items = parseItems(rawItems);
                  const orderTotal =
                    Number(ord.total_amount || ord.total || ord.amount || 0);

                  return (
                    <div
                      key={ord.id || ord.order_id}
                      className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between rounded-xl bg-white dark:bg-gray-900 px-3 py-3"
                    >
                      {/* Left: order meta + items */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-gray-500">
                            #{ord.id || ord.order_id}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] uppercase tracking-wide"
                          >
                            {(ord.status || "").toString()}
                          </Badge>
                        </div>

                        <div className="space-y-1 text-sm text-gray-800 dark:text-gray-200">
                          {items.length > 0 ? (
                            items.map((it, idx) => {
                              const qty = it.quantity || 1;
                              const linePrice = (it.price || 0) * qty;
                              return (
                                <div
                                  key={idx}
                                  className="flex justify-between gap-3 items-start"
                                >
                                  <span className="flex-1">
                                    {it.name} <span className="font-semibold">×{qty}</span>
                                    {it.type === "paired" && (
                                      <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 dark:bg-orange-900/40 dark:text-orange-200">
                                        Half Order
                                      </span>
                                    )}
                                  </span>
                                  <span className="flex-shrink-0 text-xs font-medium text-gray-800 dark:text-gray-100 whitespace-nowrap">
                                    {formatCurrency(linePrice)}
                                  </span>
                                </div>
                              );
                            })
                          ) : (
                            <span className="text-xs text-gray-500">
                              No items
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: total + actions */}
                      <div className="flex flex-col items-end gap-2">
                        <div className="text-sm font-semibold text-orange-600 dark:text-amber-400">
                          {formatCurrency(orderTotal)}
                        </div>

                        <div className="flex flex-wrap gap-2 justify-end">
                          {(ord.status || "")
                            .toString()
                            .toUpperCase() === "PENDING" && (
                            <Button
                              size="sm"
                              className="h-8 px-3 text-xs"
                              onClick={() =>
                                updateOrderStatus(
                                  ord.id || ord.order_id,
                                  "PREPARING"
                                )
                              }
                            >
                              Start
                            </Button>
                          )}
                          {(ord.status || "")
                            .toString()
                            .toUpperCase() === "PREPARING" && (
                            <Button
                              size="sm"
                              className="h-8 px-3 text-xs"
                              onClick={() =>
                                updateOrderStatus(
                                  ord.id || ord.order_id,
                                  "READY"
                                )
                              }
                            >
                              Ready
                            </Button>
                          )}
                          {(ord.status || "")
                            .toString()
                            .toUpperCase() === "READY" && (
                            <Button
                              size="sm"
                              className="h-8 px-3 text-xs"
                              onClick={() =>
                                updateOrderStatus(
                                  ord.id || ord.order_id,
                                  "SERVED"
                                )
                              }
                            >
                              Serve
                            </Button>
                          )}
                          {(ord.status || "")
                            .toString()
                            .toUpperCase() === "SERVED" && (
                            <Button
                              size="sm"
                              className="h-8 px-3 text-xs"
                              onClick={() =>
                                updateOrderStatus(
                                  ord.id || ord.order_id,
                                  "COMPLETED"
                                )
                              }
                            >
                              Complete
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-8 px-3 text-xs"
                            onClick={() =>
                              updateOrderStatus(
                                ord.id || ord.order_id,
                                "CANCELLED"
                              )
                            }
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom summary row */}
              <div className="flex justify-between items-center pt-3 mt-1 border-t border-gray-200 dark:border-gray-800">
                <span className="text-xs font-medium text-gray-500">
                  Total
                </span>
                <span className="text-lg font-semibold text-orange-600 dark:text-amber-500">
                  {formatCurrency(groupTotal)}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      });
    })()}
  </div>
</TabsContent>

          {/* ------------------- Menu tab ------------------- */}
          <TabsContent value="menu" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                Menu Management
              </h2>
              <Button
                onClick={() => setShowAddMenu(true)}
                className="bg-gradient-to-r from-orange-500 to-amber-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(menuItems || []).map((item) => {
                const typeInfo = getItemTypeIndicator(item.item_type || "veg");
                return (
                  <Card
                    key={item.id || item._id || Math.random()}
                    className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-2xl"
                  >
                    <CardHeader>
                      <div className="flex justify-between items-start mb-2">
                        <span
                          className="text-lg font-bold"
                          style={{ fontFamily: "Space Grotesk, sans-serif" }}
                        >
                          {item.name}
                        </span>
                        <div className="flex gap-2">
                          <Badge className={typeInfo.color}>
                            {typeInfo.icon}
                          </Badge>
                          <Badge
                            variant={item.available ? "default" : "secondary"}
                          >
                            {item.available ? "Available" : "Unavailable"}
                          </Badge>
                        </div>
                      </div>
                      <CardDescription>{item.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-xl font-bold text-orange-600 dark:text-amber-500">
                          {formatCurrency(item.price || item.cost || 0)}
                        </span>
                        {item.half_price && (
                          <span className="text-sm text-orange-600 dark:text-amber-500">
                            Half: {formatCurrency(item.half_price)}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingItem(item)}
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            deleteMenuItem(item.id || item._id)
                          }
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* ------------------- Tables tab ------------------- */}
          <TabsContent value="tables" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                Table Management
              </h2>
              <Button
                onClick={() => setShowAddTable(true)}
                className="bg-gradient-to-r from-orange-500 to-amber-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Table
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(tables || []).map((table) => (
                <Card
                  key={table.id || table._id || Math.random()}
                  className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-2xl"
                >
                  <CardHeader>
                    <CardTitle style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                      Table {table.table_no}
                    </CardTitle>
                    <CardDescription>
                      Capacity: {table.capacity || table.size || 4} people
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs break-all">
                      <strong>QR Link:</strong> {getQRCodeLink(table)}
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        deleteTable(table.id || table._id)
                      }
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete Table
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ------------------- History tab ------------------- */}
          <TabsContent value="history" className="space-y-4">
            <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                  Order History
                </h2>
                <p className="text-sm text-gray-500">
                  View past orders by time range and type (Half / Full).
                </p>
              </div>
                <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label>Period</Label>
                  <Select
                    value={historyPeriod}
                    onValueChange={(v) => setHistoryPeriod(v)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="this_week">This Week</SelectItem>
                      <SelectItem value="month">Month</SelectItem>
                      <SelectItem value="last_3_months">Last 3 Months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label>Type</Label>
                  <Select
                    value={historyOrderType}
                    onValueChange={(v) => setHistoryOrderType(v)}
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="full">Full</SelectItem>
                      <SelectItem value="half">Half</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-center">
                  <span className="text-sm font-semibold">
                    {filteredHistoryOrders.length}
                  </span>
                  <div className="text-xs text-gray-500">orders</div>
                </div>
              </div>
            </div>

            {filteredHistoryOrders.length === 0 && (
              <div className="text-sm text-gray-500">
                No orders found for selected filters.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredHistoryOrders.map((ord) => {
                const completedAt = ord.completed_at;
                const { dateStr, timeStr, dayStr } = formatDateTimeIST(completedAt);

                return (
                  <Card
                    key={`hist-${ord.order_id}`}
                    className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-2xl"
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="flex justify-between items-center">
                        <span>
                          #{ord.order_id} • {formatCurrency(ord.total_amount)}
                        </span>
                        <Badge>{ord.order_type}</Badge>
                      </CardTitle>
                      <CardDescription>
                        <div className="text-sm">
                          {ord.table_reference}
                        </div>
                        <div className="text-xs text-gray-500">
                          {dayStr} {dateStr} • {timeStr} IST
                        </div>
                      </CardDescription>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Menu dialog */}
      <Dialog open={showAddMenu} onOpenChange={setShowAddMenu}>
        <DialogContent className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Space Grotesk, sans-serif" }}>
              Add Menu Item
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={newMenuItem.name}
                onChange={(e) =>
                  setNewMenuItem({ ...newMenuItem, name: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={newMenuItem.description}
                onChange={(e) =>
                  setNewMenuItem({
                    ...newMenuItem,
                    description: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <Label>Category</Label>
              <Input
                value={newMenuItem.category}
                onChange={(e) =>
                  setNewMenuItem({
                    ...newMenuItem,
                    category: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select
                value={newMenuItem.item_type}
                onValueChange={(value) =>
                  setNewMenuItem({ ...newMenuItem, item_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="veg">🟢 Veg</SelectItem>
                  <SelectItem value="non_veg">🔴 Non-Veg</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Price (₹)</Label>
              <Input
                type="number"
                step="0.01"
                value={newMenuItem.price}
                onChange={(e) =>
                  setNewMenuItem({
                    ...newMenuItem,
                    price: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <Label>Half Price (₹, optional)</Label>
              <Input
                type="number"
                step="0.01"
                value={newMenuItem.half_price}
                onChange={(e) =>
                  setNewMenuItem({
                    ...newMenuItem,
                    half_price: e.target.value,
                  })
                }
              />
            </div>
            <Button
              onClick={addMenuItem}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-600"
            >
              Add Item
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Menu dialog */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Space Grotesk, sans-serif" }}>
              Edit Menu Item
            </DialogTitle>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={editingItem.name}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      name: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={editingItem.description}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      description: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label>Category</Label>
                <Input
                  value={editingItem.category}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      category: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label>Type</Label>
                <Select
                  value={editingItem.item_type || "veg"}
                  onValueChange={(value) =>
                    setEditingItem({
                      ...editingItem,
                      item_type: value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="veg">🟢 Veg</SelectItem>
                    <SelectItem value="non_veg">🔴 Non-Veg</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Price (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editingItem.price}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      price: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label>Half Price (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editingItem.half_price || ""}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      half_price: e.target.value,
                    })
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingItem.available}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      available: e.target.checked,
                    })
                  }
                />
                <Label>Available</Label>
              </div>
              <Button
                onClick={updateMenuItem}
                className="w-full bg-gradient-to-r from-orange-500 to-amber-600"
              >
                Update Item
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Table dialog */}
      <Dialog open={showAddTable} onOpenChange={setShowAddTable}>
        <DialogContent className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Space Grotesk, sans-serif" }}>
              Add Table
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Table Number</Label>
              <Input
                value={newTable.table_no}
                onChange={(e) =>
                  setNewTable({
                    ...newTable,
                    table_no: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <Label>Capacity</Label>
              <Input
                type="number"
                value={newTable.capacity}
                onChange={(e) =>
                  setNewTable({
                    ...newTable,
                    capacity: parseInt(e.target.value || "4", 10),
                  })
                }
              />
            </div>
            <Button
              onClick={addTable}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-600"
            >
              Add Table
            </Button>
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