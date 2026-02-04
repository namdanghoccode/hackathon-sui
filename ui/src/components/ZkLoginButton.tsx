import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useZkLogin, parseJwtFromUrl } from '../hooks/useZkLogin';
import ClipLoader from 'react-spinners/ClipLoader';

interface ZkLoginButtonProps {
  onLoginSuccess?: (address: string, email: string) => void;
  onLogout?: () => void;
  compact?: boolean;
}

export function ZkLoginButton({ 
  onLoginSuccess, 
  onLogout,
  compact = false 
}: ZkLoginButtonProps) {
  const {
    isLoggedIn,
    userAddress,
    userEmail,
    loading,
    error,
    loginWithGoogle,
    handleOAuthCallback,
    logout,
  } = useZkLogin();

  // Handle OAuth callback on mount
  useEffect(() => {
    const jwt = parseJwtFromUrl();
    if (jwt) {
      handleOAuthCallback(jwt).then((result) => {
        if (result && onLoginSuccess) {
          onLoginSuccess(result.address, result.email);
        }
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
      });
    }
  }, [handleOAuthCallback, onLoginSuccess]);

  // Notify on login success
  useEffect(() => {
    if (isLoggedIn && userAddress && userEmail && onLoginSuccess) {
      onLoginSuccess(userAddress, userEmail);
    }
  }, [isLoggedIn, userAddress, userEmail, onLoginSuccess]);

  const handleLogout = () => {
    logout();
    if (onLogout) onLogout();
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: compact ? '0.5rem 1rem' : '0.75rem 1.5rem',
          background: 'rgba(66, 133, 244, 0.1)',
          borderRadius: '12px',
        }}
      >
        <ClipLoader size={16} color="#4285f4" />
        <span style={{ color: '#4285f4', fontSize: compact ? '13px' : '14px' }}>
          Đang xử lý...
        </span>
      </motion.div>
    );
  }

  if (isLoggedIn && userEmail) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        {/* User info */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: compact ? '0.4rem 0.8rem' : '0.5rem 1rem',
            background: 'linear-gradient(135deg, rgba(66, 133, 244, 0.1) 0%, rgba(52, 168, 83, 0.1) 100%)',
            borderRadius: '12px',
            border: '1px solid rgba(66, 133, 244, 0.2)',
          }}
        >
          {/* Google avatar placeholder */}
          <div
            style={{
              width: compact ? '24px' : '28px',
              height: compact ? '24px' : '28px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #4285f4 0%, #34a853 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: compact ? '12px' : '14px',
              fontWeight: 700,
            }}
          >
            {userEmail[0].toUpperCase()}
          </div>
          
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ 
              fontSize: compact ? '12px' : '13px', 
              fontWeight: 600, 
              color: '#333' 
            }}>
              {userEmail.split('@')[0]}
            </div>
            {userAddress && !compact && (
              <div style={{ 
                fontSize: '11px', 
                color: '#666',
                fontFamily: 'monospace',
              }}>
                {formatAddress(userAddress)}
              </div>
            )}
          </div>
        </div>

        {/* Logout button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleLogout}
          style={{
            padding: compact ? '0.4rem 0.8rem' : '0.5rem 1rem',
            borderRadius: '10px',
            border: '1px solid #ddd',
            background: 'white',
            color: '#666',
            fontSize: compact ? '12px' : '13px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Đăng xuất
        </motion.button>
      </motion.div>
    );
  }

  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={loginWithGoogle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: compact ? '0.5rem 1rem' : '0.75rem 1.5rem',
        borderRadius: '12px',
        border: 'none',
        background: 'white',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Google logo */}
      <svg width={compact ? 16 : 18} height={compact ? 16 : 18} viewBox="0 0 24 24">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      
      <span style={{ 
        color: '#333', 
        fontWeight: 600, 
        fontSize: compact ? '13px' : '14px' 
      }}>
        {compact ? 'Google' : 'Đăng nhập với Google'}
      </span>

      {error && (
        <span style={{ 
          color: '#d00', 
          fontSize: '12px',
          marginLeft: '0.5rem',
        }}>
          ⚠️
        </span>
      )}
    </motion.button>
  );
}

/**
 * Component hiển thị thông tin zkLogin address
 */
export function ZkLoginInfo({ 
  address, 
  email 
}: { 
  address: string; 
  email: string;
}) {
  return (
    <div
      style={{
        padding: '1rem',
        background: 'linear-gradient(135deg, rgba(66, 133, 244, 0.08) 0%, rgba(52, 168, 83, 0.08) 100%)',
        borderRadius: '15px',
        border: '1px solid rgba(66, 133, 244, 0.2)',
      }}
    >
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.5rem',
        marginBottom: '0.5rem',
      }}>
        <svg width={16} height={16} viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <span style={{ fontWeight: 600, color: '#333', fontSize: '14px' }}>
          zkLogin Account
        </span>
      </div>
      
      <div style={{ fontSize: '13px', color: '#666' }}>
        <div style={{ marginBottom: '0.25rem' }}>
          📧 {email}
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: '12px' }}>
          🔑 {address.slice(0, 10)}...{address.slice(-8)}
        </div>
      </div>
    </div>
  );
}
