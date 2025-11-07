/**
 * Timezone utilities for IST display
 */

import { format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const IST_TIMEZONE = 'Asia/Kolkata';

export const formatToIST = (utcDateString) => {
  if (!utcDateString) return '';
  try {
    const date = typeof utcDateString === 'string' ? parseISO(utcDateString) : utcDateString;
    const istDate = toZonedTime(date, IST_TIMEZONE);
    return format(istDate, 'dd MMM yyyy, hh:mm a');
  } catch (error) {
    console.error('Date formatting error:', error);
    return utcDateString;
  }
};

export const formatTimeOnly = (utcDateString) => {
  if (!utcDateString) return '';
  try {
    const date = typeof utcDateString === 'string' ? parseISO(utcDateString) : utcDateString;
    const istDate = toZonedTime(date, IST_TIMEZONE);
    return format(istDate, 'hh:mm a');
  } catch (error) {
    return utcDateString;
  }
};

export const getTimeRemaining = (expiresAt) => {
  if (!expiresAt) return 0;
  try {
    const expiryDate = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
    const now = new Date();
    const diff = expiryDate - now;
    return Math.max(0, Math.floor(diff / 1000 / 60)); // minutes
  } catch (error) {
    return 0;
  }
};
