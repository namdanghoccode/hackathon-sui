import { motion, AnimatePresence } from "framer-motion";
import { Gift, X, Bell, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNotification, GiftNotification } from "../contexts/NotificationContext";

interface NotificationToastProps {
  onClaimGift: (giftId: string) => void;
}

export function NotificationToast({ onClaimGift }: NotificationToastProps) {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead,
    removeNotification,
    clearAll 
  } = useNotification();
  
  const [isExpanded, setIsExpanded] = useState(false);

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Vừa xong';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
    return `${Math.floor(seconds / 86400)} ngày trước`;
  };

  const handleNotificationClick = (notification: GiftNotification) => {
    markAsRead(notification.id);
    if (notification.type === 'gift_received') {
      onClaimGift(notification.giftId);
    }
  };

  const getNotificationIcon = (type: GiftNotification['type']) => {
    switch (type) {
      case 'gift_received': return '🎁';
      case 'gift_opened': return '🎉';
      case 'gift_rejected': return '↩️';
      case 'gift_expired': return '⏰';
      case 'claim_success': return '✅';
      case 'claim_failed': return '❌';
      default: return '📬';
    }
  };

  const getNotificationMessage = (notification: GiftNotification) => {
    switch (notification.type) {
      case 'gift_received':
        return `Bạn nhận được ${notification.amount} SUI từ ${notification.senderAddress.slice(0, 6)}...${notification.senderAddress.slice(-4)}`;
      case 'gift_opened':
        return `Quà đã được mở thành công!`;
      case 'gift_rejected':
        return `Quà đã bị từ chối và hoàn tiền`;
      case 'gift_expired':
        return `Quà đã hết hạn và được hoàn tiền`;
      case 'claim_success':
        return `🎉 Nhận quà thành công! +${notification.amount} SUI`;
      case 'claim_failed':
        return `❌ Nhận quà thất bại: ${notification.message || 'Có lỗi xảy ra'}`;
      default:
        return 'Thông báo mới';
    }
  };

  return (
    <>
      {/* Notification Bell Button - Fixed position */}
      <motion.div
        style={{
          position: "fixed",
          top: "1.5rem",
          right: "1.5rem",
          zIndex: 1000,
        }}
      >
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            position: "relative",
            background: "linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)",
            color: "white",
            padding: "0.75rem",
            borderRadius: "50%",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(255, 107, 53, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Bell size={24} />
          
          {/* Unread badge */}
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                style={{
                  position: "absolute",
                  top: "-5px",
                  right: "-5px",
                  background: "#ef4444",
                  color: "white",
                  borderRadius: "50%",
                  width: "22px",
                  height: "22px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  fontWeight: 700,
                  border: "2px solid white",
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Notification Panel */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              style={{
                position: "absolute",
                top: "60px",
                right: 0,
                width: "360px",
                maxHeight: "500px",
                background: "white",
                borderRadius: "20px",
                boxShadow: "0 20px 60px rgba(0, 0, 0, 0.2)",
                overflow: "hidden",
                border: "2px solid rgba(255, 107, 53, 0.2)",
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: "1rem 1.25rem",
                  borderBottom: "1px solid rgba(0,0,0,0.1)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "linear-gradient(135deg, rgba(255, 107, 53, 0.05) 0%, rgba(247, 147, 30, 0.05) 100%)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Gift size={20} style={{ color: "#ff6b35" }} />
                  <span style={{ fontWeight: 700, color: "#333" }}>Thông báo</span>
                  {unreadCount > 0 && (
                    <span style={{
                      background: "#ff6b35",
                      color: "white",
                      padding: "0.15rem 0.5rem",
                      borderRadius: "10px",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}>
                      {unreadCount} mới
                    </span>
                  )}
                </div>
                
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {notifications.length > 0 && (
                    <>
                      <button
                        onClick={markAllAsRead}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#ff6b35",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: 600,
                        }}
                      >
                        Đánh dấu đã đọc
                      </button>
                      <button
                        onClick={clearAll}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#999",
                          cursor: "pointer",
                          padding: "0.25rem",
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setIsExpanded(false)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#999",
                      cursor: "pointer",
                      padding: "0.25rem",
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Notification List */}
              <div style={{ 
                maxHeight: "400px", 
                overflowY: "auto",
                overflowX: "hidden" 
              }}>
                {notifications.length === 0 ? (
                  <div style={{
                    padding: "3rem 1rem",
                    textAlign: "center",
                    color: "#999",
                  }}>
                    <Gift size={48} style={{ opacity: 0.3, marginBottom: "1rem" }} />
                    <p>Chưa có thông báo nào</p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      onClick={() => handleNotificationClick(notification)}
                      style={{
                        padding: "1rem 1.25rem",
                        borderBottom: "1px solid rgba(0,0,0,0.05)",
                        cursor: "pointer",
                        background: notification.read ? "white" : "rgba(255, 107, 53, 0.05)",
                        display: "flex",
                        gap: "0.75rem",
                        alignItems: "flex-start",
                        transition: "background 0.2s",
                      }}
                      whileHover={{ background: "rgba(255, 107, 53, 0.08)" }}
                    >
                      {/* Icon */}
                      <div style={{
                        fontSize: "1.5rem",
                        width: "40px",
                        height: "40px",
                        borderRadius: "12px",
                        background: "linear-gradient(135deg, rgba(255, 107, 53, 0.15) 0%, rgba(247, 147, 30, 0.15) 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        {getNotificationIcon(notification.type)}
                      </div>
                      
                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          margin: 0,
                          fontWeight: notification.read ? 400 : 600,
                          color: "#333",
                          fontSize: "14px",
                          lineHeight: 1.4,
                        }}>
                          {getNotificationMessage(notification)}
                        </p>
                        <p style={{
                          margin: "0.25rem 0 0",
                          fontSize: "12px",
                          color: "#999",
                        }}>
                          {formatTimeAgo(notification.timestamp)}
                        </p>
                        
                        {/* Action button for gift_received */}
                        {notification.type === 'gift_received' && (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNotificationClick(notification);
                            }}
                            style={{
                              marginTop: "0.5rem",
                              background: "linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)",
                              color: "white",
                              border: "none",
                              padding: "0.4rem 1rem",
                              borderRadius: "8px",
                              fontSize: "12px",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            🎁 Nhận quà ngay
                          </motion.button>
                        )}
                      </div>
                      
                      {/* Unread indicator */}
                      {!notification.read && (
                        <div style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: "#ff6b35",
                          flexShrink: 0,
                          marginTop: "6px",
                        }} />
                      )}
                      
                      {/* Delete button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeNotification(notification.id);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#ccc",
                          cursor: "pointer",
                          padding: "0.25rem",
                          opacity: 0.5,
                          transition: "opacity 0.2s",
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.5'}
                      >
                        <X size={14} />
                      </button>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Toast Notifications - Appears when new notification comes */}
      <AnimatePresence>
        {notifications.filter(n => !n.read && Date.now() - n.timestamp < 5000).slice(0, 3).map((notification, index) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: 100, y: 0 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ duration: 0.3 }}
            style={{
              position: "fixed",
              bottom: `${1.5 + index * 5}rem`,
              right: "1.5rem",
              background: "white",
              padding: "1rem 1.25rem",
              borderRadius: "16px",
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.15)",
              border: "2px solid #ff6b35",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              maxWidth: "350px",
              zIndex: 1001,
              cursor: "pointer",
            }}
            onClick={() => handleNotificationClick(notification)}
          >
            <motion.div
              animate={{ 
                rotate: [0, -10, 10, -10, 10, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{ duration: 0.5, repeat: 2 }}
              style={{ fontSize: "2rem" }}
            >
              🎁
            </motion.div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 700, color: "#ff6b35", fontSize: "14px" }}>
                Quà mới!
              </p>
              <p style={{ margin: "0.25rem 0 0", color: "#666", fontSize: "13px" }}>
                {getNotificationMessage(notification)}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                markAsRead(notification.id);
              }}
              style={{
                background: "none",
                border: "none",
                color: "#999",
                cursor: "pointer",
                padding: "0.25rem",
              }}
            >
              <X size={18} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </>
  );
}
