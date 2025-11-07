// Currency formatter (INR)
export const formatCurrency = (amount) => {
  return `₹${amount.toFixed(2)}`;
};

// Get veg/non-veg indicator
export const getItemTypeIndicator = (itemType) => {
  if (itemType === 'veg') {
    return {
      icon: '🟢',
      label: 'Veg',
      color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
    };
  } else {
    return {
      icon: '🔴',
      label: 'Non-Veg',
      color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
    };
  }
};

// Format time remaining
export const getTimeRemaining = (expiresAt) => {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diff = expires - now;
  
  if (diff <= 0) return { text: 'Expired', color: 'text-red-500' };
  
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  
  if (minutes > 5) {
    return { text: `${minutes}m remaining`, color: 'text-green-600 dark:text-green-400' };
  } else if (minutes > 2) {
    return { text: `${minutes}m ${seconds}s`, color: 'text-yellow-600 dark:text-yellow-400' };
  } else {
    return { text: `${minutes}m ${seconds}s`, color: 'text-red-600 dark:text-red-400' };
  }
};

// Validate Indian mobile number
export const validateMobile = (mobile) => {
  const regex = /^[6-9]\d{9}$/;
  return regex.test(mobile);
};

// Format mobile number for display
export const formatMobile = (mobile) => {
  if (!mobile || mobile.length !== 10) return mobile;
  return `${mobile.slice(0, 5)}-${mobile.slice(5)}`;
};

// Get restaurant type label
export const getRestaurantTypeLabel = (type) => {
  const labels = {
    'veg': { text: 'Pure Veg', icon: '🟢', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    'non_veg': { text: 'Non-Veg Only', icon: '🔴', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    'mixed': { text: 'Veg & Non-Veg', icon: '🟡', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' }
  };
  return labels[type] || labels.mixed;
};