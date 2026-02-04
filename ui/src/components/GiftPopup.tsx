import { motion, AnimatePresence } from "framer-motion";
import { X, User } from "lucide-react";
import { GiftNotification, useNotification } from "../contexts/NotificationContext";
import { useSignAndExecuteTransaction, useSuiClient, useCurrentAccount } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useNetworkVariable } from "../networkConfig";
import { useState } from "react";
import ClipLoader from "react-spinners/ClipLoader";
import confetti from "canvas-confetti";

interface GiftPopupProps {
  notification: GiftNotification;
  onClose: () => void;
  onSuccess?: () => void;
}

export function GiftPopup({ notification, onClose, onSuccess }: GiftPopupProps) {
  const packageId = useNetworkVariable("helloWorldPackageId");
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { markAsRead, addNotification } = useNotification();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Trigger confetti
  const triggerConfetti = () => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    
    const interval = setInterval(() => {
      if (Date.now() > animationEnd) {
        clearInterval(interval);
        return;
      }
      
      confetti({
        particleCount: 50,
        startVelocity: 30,
        spread: 360,
        origin: {
          x: Math.random(),
          y: Math.random() - 0.2
        }
      });
    }, 250);
  };

  // Claim gift
  const handleClaimGift = async () => {
    if (!currentAccount) {
      setError("Vui lòng kết nối ví trước!");
      return;
    }

    setIsLoading(true);
    setError("");

    const tx = new Transaction();
    
    // Sử dụng Clock object cho việc kiểm tra hết hạn
    tx.moveCall({
      target: `${packageId}::gifting::open_and_claim`,
      arguments: [
        tx.object(notification.giftId),
        tx.object("0x6"), // Sui Clock object
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: async (result) => {
          try {
            await suiClient.waitForTransaction({ digest: result.digest });
            setSuccess(true);
            triggerConfetti();
            markAsRead(notification.id);
            
            // Add success notification
            addNotification({
              giftId: notification.giftId,
              senderAddress: notification.senderAddress,
              amount: notification.amount,
              type: 'gift_opened',
            });
            
            if (onSuccess) onSuccess();
          } catch (err) {
            setError("Không thể xác nhận giao dịch");
          }
          setIsLoading(false);
        },
        onError: (err) => {
          console.error(err);
          if (err.message?.includes("expired")) {
            setError("Quà đã hết hạn!");
          } else {
            setError("Có lỗi xảy ra. Bạn có phải là người nhận không?");
          }
          setIsLoading(false);
        },
      }
    );
  };

  // Reject gift
  const handleRejectGift = async () => {
    if (!currentAccount) {
      setError("Vui lòng kết nối ví trước!");
      return;
    }

    setIsRejecting(true);
    setError("");

    const tx = new Transaction();
    
    tx.moveCall({
      target: `${packageId}::gifting::reject_gift`,
      arguments: [tx.object(notification.giftId)],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: async (result) => {
          try {
            await suiClient.waitForTransaction({ digest: result.digest });
            markAsRead(notification.id);
            
            addNotification({
              giftId: notification.giftId,
              senderAddress: notification.senderAddress,
              amount: notification.amount,
              type: 'gift_rejected',
            });
            
            onClose();
          } catch (err) {
            setError("Không thể xác nhận giao dịch");
          }
          setIsRejecting(false);
        },
        onError: (err) => {
          console.error(err);
          setError("Có lỗi xảy ra khi từ chối quà");
          setIsRejecting(false);
        },
      }
    );
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.6)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2000,
          padding: "1rem",
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 50 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          style={{
            background: "white",
            borderRadius: "30px",
            padding: "2.5rem",
            maxWidth: "450px",
            width: "100%",
            boxShadow: "0 30px 100px rgba(0, 0, 0, 0.3)",
            border: "3px solid rgba(255, 107, 53, 0.3)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: "1rem",
              right: "1rem",
              background: "rgba(0,0,0,0.05)",
              border: "none",
              borderRadius: "50%",
              padding: "0.5rem",
              cursor: "pointer",
              color: "#666",
            }}
          >
            <X size={20} />
          </button>

          {!success ? (
            <>
              {/* Gift animation */}
              <motion.div
                animate={{
                  rotate: [0, -5, 5, -5, 5, 0],
                  y: [0, -10, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                style={{
                  textAlign: "center",
                  marginBottom: "1.5rem",
                }}
              >
                <div style={{
                  fontSize: "5rem",
                  filter: "drop-shadow(0 10px 30px rgba(255, 107, 53, 0.4))",
                }}>
                  🎁
                </div>
              </motion.div>

              <h2 style={{
                textAlign: "center",
                color: "#ff6b35",
                fontSize: "1.8rem",
                fontWeight: 800,
                marginBottom: "0.5rem",
              }}>
                Bạn nhận được quà!
              </h2>

              <p style={{
                textAlign: "center",
                color: "#666",
                marginBottom: "2rem",
              }}>
                Có ai đó gửi cho bạn một hộp quà bất ngờ
              </p>

              {/* Gift info card */}
              <div style={{
                background: "linear-gradient(135deg, rgba(255, 107, 53, 0.1) 0%, rgba(247, 147, 30, 0.1) 100%)",
                borderRadius: "20px",
                padding: "1.5rem",
                marginBottom: "1.5rem",
              }}>
                {/* Amount */}
                <div style={{
                  textAlign: "center",
                  marginBottom: "1rem",
                }}>
                  <p style={{ color: "#999", fontSize: "14px", marginBottom: "0.25rem" }}>
                    Số tiền
                  </p>
                  <p style={{
                    color: "#ff6b35",
                    fontSize: "2.5rem",
                    fontWeight: 800,
                    margin: 0,
                  }}>
                    {notification.amount} SUI
                  </p>
                </div>

                {/* Sender */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  justifyContent: "center",
                  padding: "0.75rem",
                  background: "rgba(255,255,255,0.7)",
                  borderRadius: "12px",
                }}>
                  <User size={16} style={{ color: "#ff6b35" }} />
                  <span style={{ color: "#666", fontSize: "14px" }}>
                    Từ: <strong>{formatAddress(notification.senderAddress)}</strong>
                  </span>
                </div>

                {/* Message if exists */}
                {notification.message && (
                  <div style={{
                    marginTop: "1rem",
                    padding: "1rem",
                    background: "rgba(255,255,255,0.7)",
                    borderRadius: "12px",
                    border: "2px dashed rgba(255, 107, 53, 0.3)",
                  }}>
                    <p style={{
                      color: "#666",
                      fontStyle: "italic",
                      margin: 0,
                      textAlign: "center",
                    }}>
                      "{notification.message}"
                    </p>
                  </div>
                )}
              </div>

              {/* Error message */}
              {error && (
                <div style={{
                  background: "rgba(255, 50, 50, 0.1)",
                  border: "1px solid rgba(255, 50, 50, 0.3)",
                  borderRadius: "12px",
                  padding: "0.75rem 1rem",
                  marginBottom: "1rem",
                }}>
                  <p style={{ color: "#d00", margin: 0, fontSize: "14px" }}>
                    ⚠️ {error}
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: "flex", gap: "1rem" }}>
                {/* Reject button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleRejectGift}
                  disabled={isLoading || isRejecting}
                  style={{
                    flex: 1,
                    padding: "1rem",
                    borderRadius: "15px",
                    border: "2px solid #ccc",
                    background: "white",
                    color: "#666",
                    fontWeight: 600,
                    fontSize: "1rem",
                    cursor: isRejecting ? "not-allowed" : "pointer",
                    opacity: isRejecting ? 0.7 : 1,
                  }}
                >
                  {isRejecting ? (
                    <ClipLoader size={20} color="#666" />
                  ) : (
                    "↩️ Từ chối"
                  )}
                </motion.button>

                {/* Claim button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleClaimGift}
                  disabled={isLoading || isRejecting}
                  style={{
                    flex: 2,
                    padding: "1rem",
                    borderRadius: "15px",
                    border: "none",
                    background: isLoading 
                      ? "#ccc" 
                      : "linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)",
                    color: "white",
                    fontWeight: 700,
                    fontSize: "1.1rem",
                    cursor: isLoading ? "not-allowed" : "pointer",
                    boxShadow: "0 10px 30px rgba(255, 107, 53, 0.4)",
                  }}
                >
                  {isLoading ? (
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                      <ClipLoader size={20} color="white" />
                      Đang xử lý...
                    </span>
                  ) : (
                    "🎉 Mở quà ngay!"
                  )}
                </motion.button>
              </div>

              {/* Info text */}
              <p style={{
                textAlign: "center",
                color: "#999",
                fontSize: "12px",
                marginTop: "1rem",
              }}>
                💡 Phí gas sẽ được trả từ quà của bạn
              </p>
            </>
          ) : (
            // Success state
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 15 }}
                style={{ textAlign: "center" }}
              >
                <div style={{ fontSize: "6rem", marginBottom: "1rem" }}>
                  🎉
                </div>
                <h2 style={{
                  color: "#ff6b35",
                  fontSize: "2rem",
                  fontWeight: 800,
                  marginBottom: "1rem",
                }}>
                  Chúc mừng!
                </h2>
                <p style={{ color: "#666", marginBottom: "0.5rem" }}>
                  Bạn đã nhận được
                </p>
                <p style={{
                  color: "#ff6b35",
                  fontSize: "3rem",
                  fontWeight: 800,
                  marginBottom: "2rem",
                }}>
                  {notification.amount} SUI
                </p>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onClose}
                  style={{
                    padding: "1rem 2.5rem",
                    borderRadius: "15px",
                    border: "none",
                    background: "linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)",
                    color: "white",
                    fontWeight: 700,
                    fontSize: "1.1rem",
                    cursor: "pointer",
                    boxShadow: "0 10px 30px rgba(255, 107, 53, 0.4)",
                  }}
                >
                  Tuyệt vời! 🚀
                </motion.button>
              </motion.div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
