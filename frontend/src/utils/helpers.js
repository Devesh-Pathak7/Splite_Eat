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
