import {
  useSignAndExecuteTransaction,
  useSuiClient,
  useSuiClientQuery,
} from "@mysten/dapp-kit";
import type { SuiObjectData } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { Box, Button, Container, Flex, Heading, Text, TextField } from "@radix-ui/themes";
import { useNetworkVariable } from "./networkConfig";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Sparkles, Clock, AlertTriangle, RotateCcw, Mail, CheckCircle, Shield } from "lucide-react";
import ClipLoader from "react-spinners/ClipLoader";
import confetti from "canvas-confetti";
import { useZkLogin, verifyEmailHash, hashEmailForContract } from "./hooks/useZkLogin";
import { useNotification } from "./contexts/NotificationContext";

interface ClaimGiftProps {
  onBack: () => void;
  initialGiftId?: string; // Allow passing gift ID from notification
}

// Helper functions (moved outside component to avoid hoisting issues)
const getGiftFieldsHelper = (data: SuiObjectData) => {
  if (data.content?.dataType !== "moveObject") {
    return null;
  }
  return data.content.fields as {
    sender: string;
    message: string;
    is_opened?: boolean;
    is_claimed?: boolean;
    content: { fields: { balance: string } };
    gas_deposit?: { fields: { balance: string } };
    expires_at?: string;
    created_at?: string;
    recipient_email_hash?: number[];
  };
};

const isSharedGiftHelper = (objData: SuiObjectData): boolean => {
  if (objData.content?.dataType !== "moveObject") return false;
  const type = objData.content.type || "";
  return type.includes("SharedGiftBox");
};

export function ClaimGift({ onBack, initialGiftId }: ClaimGiftProps) {
  const packageId = useNetworkVariable("helloWorldPackageId");
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  
  // Notification context
  const { addNotification } = useNotification();
  
  // zkLogin state - lấy từ session đăng nhập ở trang chính
  const { 
    isLoggedIn: zkLoggedIn, 
    userEmail: zkUserEmail,
    userAddress: zkUserAddress,
  } = useZkLogin();
  
  const [emailVerified, setEmailVerified] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'none' | 'checking' | 'verified' | 'failed'>('none');

  const [giftId, setGiftId] = useState(initialGiftId || "");
  const [searchedGiftId, setSearchedGiftId] = useState(initialGiftId || "");
  const [waitingForTxn, setWaitingForTxn] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isOpened, setIsOpened] = useState(false);
  const [error, setError] = useState("");
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  // Auto search if initialGiftId is provided
  useEffect(() => {
    if (initialGiftId) {
      setGiftId(initialGiftId);
      setSearchedGiftId(initialGiftId);
    }
  }, [initialGiftId]);

  const { data, isPending, error: queryError } = useSuiClientQuery(
    "getObject",
    {
      id: searchedGiftId,
      options: {
        showContent: true,
        showOwner: true,
      },
    },
    {
      enabled: searchedGiftId.length > 0,
    }
  );

  // Calculate time remaining
  useEffect(() => {
    if (!data?.data) return;
    
    const giftData = getGiftFieldsHelper(data.data);
    if (!giftData || !giftData.expires_at || giftData.expires_at === "0") {
      setTimeRemaining(null);
      setIsExpired(false);
      return;
    }

    const checkExpiry = () => {
      const expiresAt = parseInt(giftData.expires_at || "0");
      const now = Date.now();
      
      if (now > expiresAt) {
        setIsExpired(true);
        setTimeRemaining("Đã hết hạn");
        return;
      }

      setIsExpired(false);
      const remaining = expiresAt - now;
      const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
      const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      
      if (days > 0) {
        setTimeRemaining(`${days} ngày ${hours} giờ`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours} giờ ${minutes} phút`);
      } else {
        setTimeRemaining(`${minutes} phút`);
      }
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [data]);

  // Verify zkLogin email matches gift recipient
  useEffect(() => {
    const verifyEmail = async () => {
      console.log('=== EMAIL VERIFICATION START ===');
      console.log('data?.data:', !!data?.data);
      console.log('zkLoggedIn:', zkLoggedIn);
      console.log('zkUserEmail:', zkUserEmail);
      
      if (!data?.data || !zkLoggedIn || !zkUserEmail) {
        console.log('Missing data - setting not verified');
        setEmailVerified(false);
        setVerificationStatus('none');
        return;
      }

      // Check if this is a SharedGiftBox
      const isSharedGiftBox = isSharedGiftHelper(data.data);
      console.log('isSharedGiftBox:', isSharedGiftBox);
      
      const giftData = getGiftFieldsHelper(data.data);
      console.log('giftData:', giftData);
      console.log('recipient_email_hash:', giftData?.recipient_email_hash);
      
      if (!giftData || !giftData.recipient_email_hash || giftData.recipient_email_hash.length === 0) {
        // No email hash stored - this is a standard gift, auto verify
        console.log('No email hash - auto verify');
        setEmailVerified(true);
        setVerificationStatus('verified');
        return;
      }

      // For SharedGiftBox: Trust zkLogin authentication, contract will verify
      // User just needs to be logged in with zkLogin
      if (isSharedGiftBox) {
        console.log('SharedGiftBox detected - auto verify, contract will check hash');
        setEmailVerified(true); // Allow attempt, contract will verify hash
        setVerificationStatus('verified');
        setError(''); // Clear any previous error
        return;
      }

      setVerificationStatus('checking');
      
      try {
        // Get the stored email hash from the gift
        const storedHash = giftData.recipient_email_hash;
        
        // Debug log
        console.log('User email:', zkUserEmail);
        console.log('Stored hash:', storedHash);
        
        // Verify the zkLogin user's email matches
        const isVerified = await verifyEmailHash(zkUserEmail, storedHash);
        
        console.log('Email verified:', isVerified);
        
        // Compute hash for debugging
        const computedHash = await hashEmailForContract(zkUserEmail);
        console.log('Computed hash:', computedHash);
        
        setEmailVerified(isVerified);
        setVerificationStatus(isVerified ? 'verified' : 'failed');
        
        if (!isVerified) {
          setError(`Email không khớp! Gift này được gửi cho email khác.`);
        } else {
          setError('');
        }
      } catch (err) {
        console.error('Email verification error:', err);
        setEmailVerified(false);
        setVerificationStatus('failed');
      }
    };

    verifyEmail();
  }, [data, zkLoggedIn, zkUserEmail]);

  // Trigger confetti animation
  const triggerConfetti = () => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: any = setInterval(function () {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      });
    }, 250);
  };

  const handleSearchGift = () => {
    if (!giftId) {
      setError("Vui lòng nhập Gift ID!");
      return;
    }
    setError("");
    setSearchedGiftId(giftId);
  };

  const handleOpenGift = async () => {
    if (!searchedGiftId) return;
    if (isExpired) {
      setError("Quà đã hết hạn! Không thể nhận được nữa.");
      return;
    }

    setWaitingForTxn(true);
    setError("");

    const tx = new Transaction();

    // Kiểm tra loại quà và gọi function phù hợp
    if (isShared) {
      // SharedGiftBox - cần email hash để claim
      if (!zkLoggedIn || !zkUserEmail) {
        setError("Vui lòng đăng nhập bằng Google để nhận quà!");
        setWaitingForTxn(false);
        return;
      }
      
      // Hash email của người dùng hiện tại
      const myEmailHash = await hashEmailForContract(zkUserEmail);
      
      // Debug: Log để so sánh hash
      console.log('=== CLAIM DEBUG ===');
      console.log('Claiming with email:', zkUserEmail);
      console.log('My email hash:', myEmailHash);
      console.log('Stored email hash in gift:', giftData?.recipient_email_hash);
      
      // So sánh hash
      const storedHash = giftData?.recipient_email_hash;
      if (storedHash) {
        const hashMatch = myEmailHash.length === storedHash.length && 
          myEmailHash.every((byte: number, i: number) => byte === storedHash[i]);
        console.log('Hash match:', hashMatch);
        
        if (!hashMatch) {
          setError(`Email không khớp! Gift này được gửi cho email khác, không phải ${zkUserEmail}`);
          setWaitingForTxn(false);
          return;
        }
      }
      
      tx.moveCall({
        target: `${packageId}::gifting::claim_shared_gift`,
        arguments: [
          tx.object(searchedGiftId),
          tx.pure('vector<u8>', myEmailHash),
          tx.object("0x6"), // Sui Clock object
        ],
      });
    } else {
      // GiftBox thường - chỉ chủ sở hữu mới claim được
      tx.moveCall({
        target: `${packageId}::gifting::open_and_claim`,
        arguments: [
          tx.object(searchedGiftId),
          tx.object("0x6"), // Sui Clock object
        ],
      });
    }

    signAndExecute(
      {
        transaction: tx,
      },
      {
        onSuccess: (result) => {
          suiClient
            .waitForTransaction({ digest: result.digest })
            .then(async () => {
              setIsOpened(true);
              triggerConfetti();
              setWaitingForTxn(false);
              
              // Thêm thông báo nhận quà thành công
              const amountSui = giftData?.content?.fields?.balance 
                ? (parseInt(giftData.content.fields.balance) / 1_000_000_000).toFixed(4)
                : "0";
              addNotification({
                giftId: searchedGiftId,
                senderAddress: giftData?.sender || "Unknown",
                amount: amountSui,
                message: giftData?.message || "",
                type: 'claim_success',
              });
            })
            .catch((err) => {
              console.error(err);
              setError("Không thể mở quà. Vui lòng thử lại!");
              setWaitingForTxn(false);
              
              // Thêm thông báo thất bại
              addNotification({
                giftId: searchedGiftId,
                senderAddress: giftData?.sender || "Unknown",
                amount: "0",
                message: "Lỗi khi xử lý giao dịch",
                type: 'claim_failed',
              });
            });
        },
        onError: (err) => {
          console.error(err);
          let errorMessage = "Có lỗi xảy ra";
          
          if (err.message?.includes("EGiftExpired") || err.message?.includes("expired")) {
            setError("Quà đã hết hạn!");
            errorMessage = "Quà đã hết hạn";
            setIsExpired(true);
          } else if (err.message?.includes("EEmailHashMismatch") || err.message?.includes("mismatch")) {
            setError("Email không khớp! Quà này được gửi cho email khác.");
            errorMessage = "Email không khớp";
          } else if (err.message?.includes("EGiftAlreadyClaimed") || err.message?.includes("claimed")) {
            setError("Quà này đã được nhận rồi!");
            errorMessage = "Quà đã được nhận";
          } else if (err.message?.includes("No valid gas coins")) {
            setError("Không đủ SUI để trả phí giao dịch!");
            errorMessage = "Không đủ SUI trả phí gas";
          } else if (isShared) {
            setError("Có lỗi xảy ra. Email của bạn có thể không khớp với email người nhận.");
            errorMessage = "Email không khớp hoặc lỗi khác";
          } else {
            setError("Có lỗi xảy ra. Bạn có phải là người nhận không?");
            errorMessage = "Không phải người nhận";
          }
          
          // Thêm thông báo thất bại
          addNotification({
            giftId: searchedGiftId,
            senderAddress: giftData?.sender || "Unknown",
            amount: "0",
            message: errorMessage,
            type: 'claim_failed',
          });
          
          setWaitingForTxn(false);
        },
      }
    );
  };

  // Reject gift - return to sender (chỉ dành cho GiftBox thường, không phải SharedGiftBox)
  const handleRejectGift = () => {
    if (!searchedGiftId) return;
    
    // SharedGiftBox không thể reject - chỉ có thể claim hoặc đợi hết hạn để refund
    if (isShared) {
      setError("Quà gửi qua email không thể từ chối. Người gửi có thể lấy lại khi quà hết hạn.");
      return;
    }

    setIsRejecting(true);
    setError("");

    const tx = new Transaction();

    tx.moveCall({
      target: `${packageId}::gifting::reject_gift`,
      arguments: [tx.object(searchedGiftId)],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: (result) => {
          suiClient
            .waitForTransaction({ digest: result.digest })
            .then(() => {
              setSearchedGiftId("");
              setGiftId("");
              setIsRejecting(false);
              alert("Đã từ chối quà và hoàn tiền cho người gửi!");
            })
            .catch((err) => {
              console.error(err);
              setError("Không thể từ chối quà. Vui lòng thử lại!");
              setIsRejecting(false);
            });
        },
        onError: (err) => {
          console.error(err);
          setError("Có lỗi xảy ra khi từ chối quà.");
          setIsRejecting(false);
        },
      }
    );
  };

  // Refund expired gift
  const handleRefundExpired = () => {
    if (!searchedGiftId || !isExpired) return;

    setWaitingForTxn(true);
    setError("");

    const tx = new Transaction();

    tx.moveCall({
      target: `${packageId}::gifting::refund_expired_gift`,
      arguments: [
        tx.object(searchedGiftId),
        tx.object("0x6"), // Sui Clock object
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: (result) => {
          suiClient
            .waitForTransaction({ digest: result.digest })
            .then(() => {
              setSearchedGiftId("");
              setGiftId("");
              setWaitingForTxn(false);
              alert("Đã hoàn tiền quà hết hạn về cho người gửi!");
            })
            .catch((err) => {
              console.error(err);
              setError("Không thể hoàn tiền. Vui lòng thử lại!");
              setWaitingForTxn(false);
            });
        },
        onError: (err) => {
          console.error(err);
          setError("Có lỗi xảy ra khi hoàn tiền.");
          setWaitingForTxn(false);
        },
      }
    );
  };

  // Use the helper functions
  const giftData = data?.data ? getGiftFieldsHelper(data.data) : null;
  const isShared = data?.data ? isSharedGiftHelper(data.data) : false;
  const hasZkLoginRequirement = giftData?.recipient_email_hash && giftData.recipient_email_hash.length > 0;
  const suiAmount = giftData?.content?.fields?.balance
    ? (parseInt(giftData.content.fields.balance) / 1_000_000_000).toFixed(4)
    : "0";

  return (
    <Box
      style={{
        minHeight: "100vh",
        background: "linear-gradient(to bottom, #ffffff 0%, #fef9f6 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Animated Background Stars */}
      {[...Array(25)].map((_, i) => (
        <motion.div
          key={i}
          animate={{
            scale: [0, 1.5, 0],
            opacity: [0, 0.6, 0],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: i * 0.2,
          }}
          style={{
            position: "absolute",
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: i % 2 === 0 ? "#ff6b35" : "#f7931e",
            boxShadow: `0 0 15px ${i % 2 === 0 ? "#ff6b35" : "#f7931e"}`,
            filter: "blur(1px)",
          }}
        />
      ))}

      <Container size="3" py="6">
        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Button
            variant="soft"
            size="3"
            onClick={onBack}
            style={{
              color: "#ff6b35",
              background: "rgba(255, 107, 53, 0.1)",
              marginBottom: "2rem",
              fontWeight: 600,
            }}
          >
            <ArrowLeft size={20} />
            Quay lại
          </Button>
        </motion.div>

        <Flex direction="column" align="center" gap="6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            style={{ textAlign: "center" }}
          >
            <Box style={{
              display: "inline-block",
              background: "linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)",
              padding: "1.5rem",
              borderRadius: "25px",
              marginBottom: "1rem",
              boxShadow: "0 15px 50px rgba(255, 107, 53, 0.4)",
            }}>
              <Sparkles size={56} color="white" />
            </Box>
            <Heading size="8" mb="2" style={{ color: "#ff6b35", fontWeight: 900 }}>
              Nhận quà tặng 🎁
            </Heading>
            <Text size="3" style={{ color: "#666", fontWeight: 500 }}>
              Nhập Gift ID để mở hộp quà bất ngờ của bạn
            </Text>
          </motion.div>

          {/* Search Box */}
          {!searchedGiftId && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              style={{ width: "100%", maxWidth: "600px" }}
            >
              <Box
                p="6"
                style={{
                  background: "rgba(255, 255, 255, 0.95)",
                  borderRadius: "25px",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                }}
              >
                <Flex direction="column" gap="4">
                  {/* Hiển thị trạng thái đăng nhập từ trang chính */}
                  {zkLoggedIn ? (
                    <Box
                      p="3"
                      style={{
                        background: "linear-gradient(135deg, rgba(52, 168, 83, 0.1) 0%, rgba(66, 133, 244, 0.1) 100%)",
                        borderRadius: "12px",
                        border: "1px solid rgba(52, 168, 83, 0.3)",
                      }}
                    >
                      <Flex align="center" gap="2">
                        <CheckCircle size={18} color="#34a853" />
                        <Text size="2" style={{ color: "#34a853", fontWeight: 600 }}>
                          Đăng nhập: {zkUserEmail}
                        </Text>
                      </Flex>
                    </Box>
                  ) : (
                    <Box
                      p="3"
                      style={{
                        background: "rgba(255, 193, 7, 0.1)",
                        borderRadius: "12px",
                        border: "1px solid rgba(255, 193, 7, 0.3)",
                      }}
                    >
                      <Text size="2" style={{ color: "#b45309" }}>
                        💡 Để nhận quà qua email, hãy đăng nhập Google ở góc phải trên màn hình chính
                      </Text>
                    </Box>
                  )}

                  <Box>
                    <Text as="label" size="3" weight="bold" mb="2" style={{ display: "block", color: "#ff6b35" }}>
                      🎁 Gift ID
                    </Text>
                    <TextField.Root
                      size="3"
                      placeholder="0x..."
                      value={giftId}
                      onChange={(e) => setGiftId(e.target.value)}
                      style={{
                        borderRadius: "12px",
                        border: "2px solid rgba(255, 107, 53, 0.3)",
                        fontSize: "1rem",
                      }}
                    />
                  </Box>

                  {error && (
                    <Box
                      p="3"
                      style={{
                        background: "rgba(255, 50, 50, 0.1)",
                        borderRadius: "12px",
                        border: "1px solid rgba(255, 50, 50, 0.3)",
                      }}
                    >
                      <Text size="2" style={{ color: "#d00", fontWeight: 600 }}>
                        ⚠️ {error}
                      </Text>
                    </Box>
                  )}

                  <Button
                    size="4"
                    onClick={handleSearchGift}
                    style={{
                      background: "linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)",
                      color: "white",
                      padding: "1.2rem",
                      fontSize: "1rem",
                      fontWeight: 700,
                      borderRadius: "15px",
                      cursor: "pointer",
                      border: "none",
                      boxShadow: "0 10px 30px rgba(255, 107, 53, 0.3)",
                    }}
                  >
                    🔍 Tìm quà
                  </Button>
                </Flex>
              </Box>
            </motion.div>
          )}

          {/* Gift Box Display */}
          {searchedGiftId && !isOpened && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              style={{ 
                width: "100%", 
                maxWidth: "600px",
                boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
              }}
            >
              <Box
                p="8"
                style={{
                  background: "rgba(255, 255, 255, 0.95)",
                  borderRadius: "30px",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                }}
              >
                {isPending ? (
                  <Flex justify="center" align="center" style={{ padding: "3rem" }}>
                    <ClipLoader size={50} color="#ff6b35" />
                  </Flex>
                ) : queryError || !giftData ? (
                  <Box style={{ textAlign: "center" }}>
                    <Text size="4" style={{ color: "#c00" }}>
                      Không tìm thấy quà hoặc quà đã được mở!
                    </Text>
                    <Button
                      size="3"
                      variant="soft"
                      onClick={() => {
                        setSearchedGiftId("");
                        setGiftId("");
                        setError("");
                      }}
                      style={{ marginTop: "1rem" }}
                    >
                      Thử lại
                    </Button>
                  </Box>
                ) : (
                  <Flex direction="column" align="center" gap="5">
                    {/* Gift Info */}
                    <Box style={{ textAlign: "center", width: "100%" }}>
                      <Text size="2" style={{ color: "#666", marginBottom: "0.8rem", display: "block", fontWeight: 500 }}>
                        Từ: {giftData.sender.slice(0, 6)}...{giftData.sender.slice(-4)}
                      </Text>
                      
                      {/* Expiry time indicator */}
                      {timeRemaining && (
                        <Box
                          mb="4"
                          p="3"
                          style={{
                            background: isExpired 
                              ? "rgba(255, 50, 50, 0.1)" 
                              : "rgba(255, 107, 53, 0.1)",
                            borderRadius: "12px",
                            border: isExpired 
                              ? "1px solid rgba(255, 50, 50, 0.3)"
                              : "1px solid rgba(255, 107, 53, 0.3)",
                          }}
                        >
                          <Flex align="center" justify="center" gap="2">
                            {isExpired ? (
                              <AlertTriangle size={18} color="#d00" />
                            ) : (
                              <Clock size={18} color="#ff6b35" />
                            )}
                            <Text size="2" style={{ 
                              color: isExpired ? "#d00" : "#ff6b35",
                              fontWeight: 600 
                            }}>
                              {isExpired ? "Quà đã hết hạn!" : `Còn ${timeRemaining} để nhận`}
                            </Text>
                          </Flex>
                        </Box>
                      )}
                      
                      <Box
                        p="4"
                        mb="4"
                        style={{
                          background: "rgba(255, 107, 53, 0.08)",
                          borderRadius: "15px",
                          border: "2px dashed rgba(255, 107, 53, 0.3)",
                        }}
                      >
                        <Text size="3" style={{ color: "#ff6b35", fontStyle: "italic", fontWeight: 600 }}>
                          "{giftData.message}"
                        </Text>
                      </Box>
                      
                      {/* Amount preview */}
                      <Box
                        p="4"
                        mb="4"
                        style={{
                          background: "linear-gradient(135deg, rgba(255, 107, 53, 0.15) 0%, rgba(247, 147, 30, 0.15) 100%)",
                          borderRadius: "15px",
                        }}
                      >
                        <Text size="2" style={{ color: "#666", display: "block" }}>
                          Số tiền trong quà
                        </Text>
                        <Text size="6" style={{ color: "#ff6b35", fontWeight: 800 }}>
                          {suiAmount} SUI
                        </Text>
                      </Box>
                    </Box>

                    {error && (
                      <Box
                        p="3"
                        style={{
                          background: "#fee",
                          borderRadius: "12px",
                          border: "1px solid #fcc",
                          width: "100%",
                        }}
                      >
                        <Text size="2" style={{ color: "#c00" }}>
                          {error}
                        </Text>
                      </Box>
                    )}

                    {/* zkLogin Verification Section */}
                    {hasZkLoginRequirement && (
                      <Box
                        p="4"
                        mb="2"
                        style={{
                          background: zkLoggedIn && emailVerified 
                            ? "rgba(34, 197, 94, 0.1)"
                            : !zkLoggedIn 
                              ? "rgba(255, 193, 7, 0.1)"
                              : "rgba(255, 107, 53, 0.08)",
                          borderRadius: "15px",
                          border: zkLoggedIn && emailVerified 
                            ? "2px solid rgba(34, 197, 94, 0.3)"
                            : !zkLoggedIn
                              ? "2px solid rgba(255, 193, 7, 0.3)"
                              : "2px solid rgba(255, 107, 53, 0.3)",
                          width: "100%",
                        }}
                      >
                        <Flex align="center" gap="3" mb="2">
                          <Shield size={20} color={zkLoggedIn && emailVerified ? "#22c55e" : !zkLoggedIn ? "#b45309" : "#ff6b35"} />
                          <Text size="3" weight="bold" style={{ 
                            color: zkLoggedIn && emailVerified ? "#22c55e" : !zkLoggedIn ? "#b45309" : "#ff6b35" 
                          }}>
                            {zkLoggedIn && emailVerified 
                              ? "✓ Email đã xác minh" 
                              : !zkLoggedIn
                                ? "Cần đăng nhập Google"
                                : "Email không khớp"}
                          </Text>
                        </Flex>
                        
                        {!zkLoggedIn ? (
                          <Text size="2" style={{ color: "#666" }}>
                            Quà này yêu cầu xác minh email. Vui lòng đăng nhập Google ở góc phải trên màn hình chính trước khi nhận quà.
                          </Text>
                        ) : (
                          <Flex align="center" gap="2">
                            <Mail size={16} color="#666" />
                            <Text size="2" style={{ color: "#666" }}>
                              {zkUserEmail}
                            </Text>
                            {verificationStatus === 'checking' && (
                              <ClipLoader size={14} color="#ff6b35" />
                            )}
                            {verificationStatus === 'verified' && (
                              <CheckCircle size={16} color="#22c55e" />
                            )}
                            {verificationStatus === 'failed' && (
                              <AlertTriangle size={16} color="#dc2626" />
                            )}
                          </Flex>
                        )}
                      </Box>
                    )}

                    {/* Action Buttons */}
                    {isExpired ? (
                      // Expired: Show refund button
                      <motion.div
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        style={{ width: "100%" }}
                      >
                        <Button
                          size="4"
                          onClick={handleRefundExpired}
                          disabled={waitingForTxn}
                          style={{
                            background: waitingForTxn 
                              ? "#ccc"
                              : "linear-gradient(135deg, #666 0%, #888 100%)",
                            color: "white",
                            padding: "1.5rem 2rem",
                            fontSize: "1.1rem",
                            fontWeight: 800,
                            borderRadius: "18px",
                            cursor: waitingForTxn ? "not-allowed" : "pointer",
                            border: "none",
                            width: "100%",
                            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.2)",
                          }}
                        >
                          {waitingForTxn ? (
                            <Flex align="center" justify="center" gap="2">
                              <ClipLoader size={22} color="white" />
                              Đang xử lý...
                            </Flex>
                          ) : (
                            <Flex align="center" justify="center" gap="2">
                              <RotateCcw size={22} />
                              Hoàn tiền về người gửi
                            </Flex>
                          )}
                        </Button>
                      </motion.div>
                    ) : (
                      // Not expired: Show claim and reject buttons
                      <Flex gap="3" style={{ width: "100%" }}>
                        {/* Reject Button - Chỉ hiển thị cho GiftBox thường, không phải SharedGiftBox */}
                        {!isShared && (
                          <motion.div
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            style={{ flex: 1 }}
                          >
                            <Button
                              size="4"
                              onClick={handleRejectGift}
                              disabled={waitingForTxn || isRejecting || (hasZkLoginRequirement && !emailVerified)}
                              style={{
                                background: "white",
                                color: "#666",
                                padding: "1.5rem 1rem",
                                fontSize: "1rem",
                                fontWeight: 700,
                                borderRadius: "15px",
                                cursor: isRejecting || (hasZkLoginRequirement && !emailVerified) ? "not-allowed" : "pointer",
                                border: "2px solid #ccc",
                                width: "100%",
                                opacity: (hasZkLoginRequirement && !emailVerified) ? 0.5 : 1,
                              }}
                            >
                              {isRejecting ? (
                                <ClipLoader size={20} color="#666" />
                              ) : (
                                "↩️ Từ chối"
                              )}
                            </Button>
                          </motion.div>
                        )}

                        {/* Open Button */}
                        <motion.div
                          whileHover={{ scale: (hasZkLoginRequirement && !emailVerified) ? 1 : 1.05, y: (hasZkLoginRequirement && !emailVerified) ? 0 : -3 }}
                          whileTap={{ scale: (hasZkLoginRequirement && !emailVerified) ? 1 : 0.95 }}
                          style={{ flex: isShared ? 1 : 2 }}
                        >
                          <Button
                            size="4"
                            onClick={handleOpenGift}
                            disabled={waitingForTxn || isRejecting || (hasZkLoginRequirement && !emailVerified)}
                            style={{
                              background: waitingForTxn || (hasZkLoginRequirement && !emailVerified)
                                ? "#ccc"
                                : "linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)",
                              color: "white",
                              padding: "1.5rem 2rem",
                              fontSize: "1.2rem",
                              fontWeight: 900,
                              borderRadius: "18px",
                              cursor: waitingForTxn || (hasZkLoginRequirement && !emailVerified) ? "not-allowed" : "pointer",
                              border: "none",
                              width: "100%",
                              boxShadow: (hasZkLoginRequirement && !emailVerified) ? "none" : "0 15px 40px rgba(255, 107, 53, 0.4)",
                              letterSpacing: "0.5px",
                            }}
                          >
                            {waitingForTxn ? (
                              <Flex align="center" justify="center" gap="2">
                                <ClipLoader size={24} color="white" />
                                Đang mở quà...
                              </Flex>
                            ) : (hasZkLoginRequirement && !emailVerified) ? (
                              <Flex align="center" justify="center" gap="2">
                                <Shield size={22} />
                                Cần xác minh email
                              </Flex>
                            ) : (
                              <motion.span
                                animate={{
                                  scale: [1, 1.05, 1],
                                }}
                                transition={{
                                  duration: 1,
                                  repeat: Infinity,
                                }}
                              >
                                🎉 MỞ QUÀ NGAY!
                              </motion.span>
                            )}
                          </Button>
                        </motion.div>
                      </Flex>
                    )}
                    
                    <Text size="2" style={{ color: "#999", textAlign: "center" }}>
                      💡 {giftData.gas_deposit?.fields?.balance && parseInt(giftData.gas_deposit.fields.balance) > 0
                        ? "Phí gas sẽ được trả từ gas deposit của người gửi"
                        : "Bạn cần có SUI trong ví để trả phí gas"}
                    </Text>
                  </Flex>
                )}
              </Box>
            </motion.div>
          )}

          {/* Success State - After Opening with Explosion Effect */}
          <AnimatePresence>
            {isOpened && (
              <motion.div
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.3 }}
                transition={{ duration: 0.8, type: "spring", bounce: 0.5 }}
                style={{ 
                  width: "100%", 
                  maxWidth: "700px",
                  boxShadow: "0 40px 120px rgba(255, 107, 53, 0.5)"
                }}
              >
                <Box
                  p="9"
                  style={{
                    background: "rgba(255, 255, 255, 0.98)",
                    borderRadius: "35px",
                    boxShadow: "0 40px 120px rgba(255, 107, 53, 0.5)",
                    textAlign: "center",
                    border: "4px solid #ff6b35",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {/* Celebration Animation */}
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                      rotate: [0, 20, -20, 0],
                    }}
                    transition={{
                      duration: 0.6,
                      repeat: 3,
                    }}
                  >
                    <Text
                      size="9"
                      style={{
                        fontSize: "7rem",
                        display: "block",
                        marginBottom: "1rem",
                        filter: "drop-shadow(0 10px 30px rgba(255, 107, 53, 0.5))",
                      }}
                    >
                      🎉
                    </Text>
                  </motion.div>

                  <Heading size="8" mb="5" style={{ color: "#ff6b35", fontWeight: 900 }}>
                    CHÚC MỪNG!
                  </Heading>

                  {/* Animated Amount Display */}
                  <Box
                    p="7"
                    mb="5"
                    style={{
                      background: "linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)",
                      borderRadius: "25px",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <motion.div
                      animate={{
                        rotate: [0, 360],
                        scale: [1, 1.2, 1],
                      }}
                      transition={{
                        duration: 20,
                        repeat: Infinity,
                        ease: "linear"
                      }}
                      style={{
                        position: "absolute",
                        top: "-50%",
                        left: "-50%",
                        width: "200%",
                        height: "200%",
                        background: "radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)",
                      }}
                    />
                    
                    <Text size="3" style={{ color: "rgba(255,255,255,0.95)", marginBottom: "0.8rem", display: "block", position: "relative" }}>
                      Bạn đã nhận được
                    </Text>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.8, type: "spring" }}
                    >
                      <Text
                        size="9"
                        weight="bold"
                        style={{
                          color: "white",
                          fontSize: "4rem",
                          display: "block",
                          textShadow: "0 4px 20px rgba(0,0,0,0.3)",
                          position: "relative",
                        }}
                      >
                        {suiAmount} SUI
                      </Text>
                    </motion.div>
                  </Box>

                  {giftData && (
                    <Box
                      p="5"
                      mb="5"
                      style={{
                        background: "rgba(255, 107, 53, 0.1)",
                        borderRadius: "20px",
                        border: "2px dashed #ff6b35",
                      }}
                    >
                      <Text size="4" weight="bold" style={{ color: "#ff6b35", marginBottom: "0.5rem", display: "block" }}>
                        💌 Lời nhắn từ người gửi:
                      </Text>
                      <Text size="4" style={{ color: "#666", fontStyle: "italic", lineHeight: 1.6 }}>
                        "{giftData.message}"
                      </Text>
                    </Box>
                  )}

                  <Button
                    size="4"
                    variant="soft"
                    onClick={() => {
                      setIsOpened(false);
                      setSearchedGiftId("");
                      setGiftId("");
                    }}
                    style={{
                      padding: "1.5rem 2.5rem",
                      borderRadius: "15px",
                      marginTop: "1rem",
                      background: "rgba(255, 107, 53, 0.1)",
                      color: "#ff6b35",
                      fontWeight: 700,
                      border: "2px solid #ff6b35",
                    }}
                  >
                    Nhận quà khác
                  </Button>
                </Box>
              </motion.div>
            )}
          </AnimatePresence>
        </Flex>
      </Container>
    </Box>
  );
}
