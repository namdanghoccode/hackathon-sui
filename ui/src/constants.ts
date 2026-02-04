// Package ID của Move module đã được publish trên Sui Testnet
// Module: hello_world::gifting
export const TESTNET_HELLO_WORLD_PACKAGE_ID = "0xbfd458b21fb9a1df0243e070c0abf8aee429a2312f1739e13e41a9c6d3b0d382"

// Google OAuth Client ID cho zkLogin
export const GOOGLE_CLIENT_ID = "73217626840-2tms0neoef5u6igqcd8vutrghpu5abn2.apps.googleusercontent.com";

// Sui Clock Object ID (standard on all networks)
export const SUI_CLOCK_OBJECT_ID = "0x6";

// Gift expiry time (7 days in milliseconds)
export const DEFAULT_GIFT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

// Recommended gas deposit for recipients (in SUI)
export const RECOMMENDED_GAS_DEPOSIT = 0.01;

// Notification polling interval (in milliseconds)
export const NOTIFICATION_POLL_INTERVAL = 10000;

// LocalStorage keys
export const STORAGE_KEYS = {
  NOTIFICATIONS: 'suigift_notifications',
  ZKLOGIN_SALT: 'suigift_zklogin_salt',
};

// API endpoints (for future backend integration)
export const API_ENDPOINTS = {
  // Supabase Realtime (if using)
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  
  // Push Protocol (if using)
  PUSH_CHANNEL: '',
};
