/**
 * Helper utilities for currency formatting and UI helpers
 */

export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '₹0.00';
  return `₹${parseFloat(amount).toFixed(2)}`;
};

export const getItemTypeBadge = (itemType) => {
  if (itemType === 'veg' || itemType === 'VEG') {
    return { color: 'green', label: 'VEG', icon: '🌿' };
  }
  return { color: 'red', label: 'NON-VEG', icon: '🍖' };
};

export const getStatusColor = (status) => {
  const colors = {
    PENDING: 'orange',
    PREPARING: 'blue',
    READY: 'purple',
    SERVED: 'green',
    COMPLETED: 'gray',
    CANCELLED: 'red',
    ACTIVE: 'green',
    JOINED: 'blue',
    EXPIRED: 'gray',
    AVAILABLE: 'green',
    OCCUPIED: 'orange',
    RESERVED: 'gray'
  };
  return colors[status] || 'gray';
};

export const validateMobile = (mobile) => {
  const mobileRegex = /^[6-9]\d{9}$/;
  return mobileRegex.test(mobile);
};

export const getRestaurantTypeLabel = (type) => {
  const labels = {
    'veg': 'Pure Veg',
    'non_veg': 'Non-Veg',
    'mixed': 'Veg & Non-Veg'
  };
  return labels[type] || type;
};

export const getItemTypeIndicator = (itemType) => {
  return getItemTypeBadge(itemType);
};

export const getTimeRemaining = (expiresAt) => {
  if (!expiresAt) return 0;
  try {
    const expiryDate = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
    const now = new Date();
    const diff = expiryDate - now;
    return Math.max(0, Math.floor(diff / 1000 / 60));
  } catch (error) {
    return 0;
  }
};
