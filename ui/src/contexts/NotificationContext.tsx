import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

// Types
export interface GiftNotification {
  id: string;
  giftId: string;
  senderAddress: string;
  senderName?: string;
  amount: string;
  message?: string;
  timestamp: number;
  type: 'gift_received' | 'gift_opened' | 'gift_rejected' | 'gift_expired' | 'claim_success' | 'claim_failed';
  read: boolean;
}

interface NotificationContextType {
  notifications: GiftNotification[];
  unreadCount: number;
  addNotification: (notification: Omit<GiftNotification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  removeNotification: (notificationId: string) => void;
  clearAll: () => void;
  showPopup: GiftNotification | null;
  setShowPopup: (notification: GiftNotification | null) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// LocalStorage key
const STORAGE_KEY = 'suigift_notifications';

// Provider component
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<GiftNotification[]>(() => {
    // Load from localStorage on init
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return [];
        }
      }
    }
    return [];
  });
  
  const [showPopup, setShowPopup] = useState<GiftNotification | null>(null);

  // Save to localStorage whenever notifications change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  }, [notifications]);

  // Computed unread count
  const unreadCount = notifications.filter(n => !n.read).length;

  // Add new notification
  const addNotification = useCallback((
    notification: Omit<GiftNotification, 'id' | 'timestamp' | 'read'>
  ) => {
    const newNotification: GiftNotification = {
      ...notification,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      read: false,
    };

    setNotifications(prev => [newNotification, ...prev]);
    
    // Auto show popup for new gift
    if (notification.type === 'gift_received') {
      setShowPopup(newNotification);
    }

    // Play notification sound (optional)
    playNotificationSound();
    
    // Browser notification (if permitted)
    showBrowserNotification(newNotification);
  }, []);

  // Mark single notification as read
  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  // Remove single notification
  const removeNotification = useCallback((notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  }, []);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        removeNotification,
        clearAll,
        showPopup,
        setShowPopup,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

// Custom hook to use notification context
export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}

// Helper: Play notification sound
function playNotificationSound() {
  try {
    // Create a simple beep sound using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    // Ignore audio errors
  }
}

// Helper: Show browser notification
async function showBrowserNotification(notification: GiftNotification) {
  if (!('Notification' in window)) return;
  
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
  
  if (Notification.permission === 'granted') {
    const title = notification.type === 'gift_received' 
      ? '🎁 Bạn nhận được quà mới!' 
      : 'SuiGift - Thông báo';
      
    const body = notification.type === 'gift_received'
      ? `Bạn nhận được ${notification.amount} SUI từ ${notification.senderAddress.slice(0, 6)}...`
      : 'Có cập nhật mới về quà tặng của bạn';

    new Notification(title, {
      body,
      icon: '/gift-icon.png',
      badge: '/gift-icon.png',
      tag: notification.giftId,
      requireInteraction: true,
    });
  }
}
