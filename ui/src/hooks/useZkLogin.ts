import { useState, useCallback, useEffect } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import { 
  generateNonce, 
  generateRandomness, 
  jwtToAddress,
} from '@mysten/sui/zklogin';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { GOOGLE_CLIENT_ID } from '../constants';

// Types
interface ZkLoginState {
  isLoggedIn: boolean;
  userAddress: string | null;
  userEmail: string | null;
  jwt: string | null;
  loading: boolean;
  error: string | null;
}

interface EphemeralKeyData {
  keypair: Ed25519Keypair;
  publicKey: string;
  maxEpoch: number;
  randomness: string;
  nonce: string;
}

// Storage keys
const STORAGE_KEYS = {
  EPHEMERAL_KEY: 'zklogin_ephemeral_key',
  JWT: 'zklogin_jwt',
  USER_ADDRESS: 'zklogin_user_address',
  USER_SALT: 'zklogin_user_salt',
  MAX_EPOCH: 'zklogin_max_epoch',
  RANDOMNESS: 'zklogin_randomness',
};

/**
 * Hook để quản lý zkLogin với Google OAuth
 */
export function useZkLogin() {
  const suiClient = useSuiClient();
  
  const [state, setState] = useState<ZkLoginState>({
    isLoggedIn: false,
    userAddress: null,
    userEmail: null,
    jwt: null,
    loading: false,
    error: null,
  });

  const [ephemeralKeyData, setEphemeralKeyData] = useState<EphemeralKeyData | null>(null);

  // Load saved session on mount
  useEffect(() => {
    const loadSavedSession = () => {
      try {
        console.log('loadSavedSession: Checking localStorage...');
        const savedJwt = localStorage.getItem(STORAGE_KEYS.JWT);
        const savedAddress = localStorage.getItem(STORAGE_KEYS.USER_ADDRESS);
        const savedEphemeralKey = localStorage.getItem(STORAGE_KEYS.EPHEMERAL_KEY);
        const savedMaxEpoch = localStorage.getItem(STORAGE_KEYS.MAX_EPOCH);
        const savedRandomness = localStorage.getItem(STORAGE_KEYS.RANDOMNESS);

        console.log('loadSavedSession: Found:', {
          hasJwt: !!savedJwt,
          hasAddress: !!savedAddress,
          hasEphemeralKey: !!savedEphemeralKey,
          hasMaxEpoch: !!savedMaxEpoch,
        });

        // Only need JWT and Address to restore basic session
        if (savedJwt && savedAddress) {
          // Decode JWT to get email
          const payload = JSON.parse(atob(savedJwt.split('.')[1]));
          console.log('loadSavedSession: JWT payload email:', payload.email);
          
          // Check if JWT is expired
          if (payload.exp * 1000 < Date.now()) {
            console.log('loadSavedSession: JWT expired, clearing session');
            clearSession();
            return;
          }

          // Try to restore ephemeral keypair if available
          if (savedEphemeralKey && savedMaxEpoch) {
            try {
              const keypairData = JSON.parse(savedEphemeralKey);
              const keypair = Ed25519Keypair.fromSecretKey(
                Uint8Array.from(Object.values(keypairData.secretKey))
              );

              setEphemeralKeyData({
                keypair,
                publicKey: keypair.getPublicKey().toBase64(),
                maxEpoch: parseInt(savedMaxEpoch),
                randomness: savedRandomness || '',
                nonce: '', // Will be regenerated if needed
              });
            } catch (e) {
              console.log('loadSavedSession: Could not restore ephemeral key, will regenerate if needed');
            }
          }

          console.log('loadSavedSession: Restoring session for:', payload.email);
          setState({
            isLoggedIn: true,
            userAddress: savedAddress,
            userEmail: payload.email,
            jwt: savedJwt,
            loading: false,
            error: null,
          });
        } else {
          console.log('loadSavedSession: No saved session found');
        }
      } catch (error) {
        console.error('loadSavedSession: Error:', error);
        clearSession();
      }
    };

    loadSavedSession();
  }, []);

  // Clear session
  const clearSession = useCallback(() => {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
    setState({
      isLoggedIn: false,
      userAddress: null,
      userEmail: null,
      jwt: null,
      loading: false,
      error: null,
    });
    setEphemeralKeyData(null);
  }, []);

  // Initialize zkLogin - Generate ephemeral keypair and nonce
  const initializeZkLogin = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Get current epoch from Sui
      const { epoch } = await suiClient.getLatestSuiSystemState();
      const maxEpoch = parseInt(epoch) + 2; // Valid for ~2 epochs (~48 hours)

      // Generate ephemeral keypair
      const keypair = new Ed25519Keypair();
      const randomness = generateRandomness();
      
      // Generate nonce for Google OAuth
      const nonce = generateNonce(
        keypair.getPublicKey(),
        maxEpoch,
        randomness
      );

      const keyData: EphemeralKeyData = {
        keypair,
        publicKey: keypair.getPublicKey().toBase64(),
        maxEpoch,
        randomness,
        nonce,
      };

      // Save to localStorage
      localStorage.setItem(STORAGE_KEYS.EPHEMERAL_KEY, JSON.stringify({
        secretKey: Array.from(keypair.getSecretKey()),
      }));
      localStorage.setItem(STORAGE_KEYS.MAX_EPOCH, maxEpoch.toString());
      localStorage.setItem(STORAGE_KEYS.RANDOMNESS, randomness);

      setEphemeralKeyData(keyData);
      setState(prev => ({ ...prev, loading: false }));

      return keyData;
    } catch (error) {
      console.error('Error initializing zkLogin:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Không thể khởi tạo zkLogin',
      }));
      return null;
    }
  }, [suiClient]);

  // Get Google OAuth URL
  const getGoogleLoginUrl = useCallback(async () => {
    let keyData = ephemeralKeyData;
    
    if (!keyData) {
      keyData = await initializeZkLogin();
    }

    if (!keyData) {
      throw new Error('Failed to initialize zkLogin');
    }

    // Use the exact origin without trailing slash
    const redirectUri = window.location.origin;
    console.log('zkLogin redirect URI:', redirectUri);
    
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'id_token',
      scope: 'openid email profile',
      nonce: keyData.nonce,
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    console.log('Full Google OAuth URL:', url);
    
    return url;
  }, [ephemeralKeyData, initializeZkLogin]);

  // Login with Google (redirect)
  const loginWithGoogle = useCallback(async () => {
    try {
      const url = await getGoogleLoginUrl();
      window.location.href = url;
    } catch (error) {
      console.error('Error starting Google login:', error);
      setState(prev => ({
        ...prev,
        error: 'Không thể bắt đầu đăng nhập Google',
      }));
    }
  }, [getGoogleLoginUrl]);

  // Handle OAuth callback - Process JWT from URL hash
  const handleOAuthCallback = useCallback(async (jwt: string) => {
    console.log('handleOAuthCallback: Starting...');
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Decode JWT to get user info
      console.log('handleOAuthCallback: Decoding JWT...');
      const payload = JSON.parse(atob(jwt.split('.')[1]));
      console.log('handleOAuthCallback: JWT payload:', payload);
      const { email } = payload;

      if (!email) {
        throw new Error('Email not found in JWT');
      }
      console.log('handleOAuthCallback: Email found:', email);

      // Generate user salt (deterministic based on email for consistency)
      // In production, you should store this securely per user
      const userSalt = await generateUserSalt(email);
      console.log('handleOAuthCallback: Salt generated');

      // Derive zkLogin address
      const address = jwtToAddress(jwt, userSalt);
      console.log('handleOAuthCallback: Address derived:', address);

      // Save session
      localStorage.setItem(STORAGE_KEYS.JWT, jwt);
      localStorage.setItem(STORAGE_KEYS.USER_ADDRESS, address);
      localStorage.setItem(STORAGE_KEYS.USER_SALT, userSalt);
      console.log('handleOAuthCallback: Session saved to localStorage');

      const newState = {
        isLoggedIn: true,
        userAddress: address,
        userEmail: email,
        jwt,
        loading: false,
        error: null,
      };
      console.log('handleOAuthCallback: Setting state:', newState);
      setState(newState);

      return { address, email };
    } catch (error) {
      console.error('handleOAuthCallback: Error:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Không thể xử lý đăng nhập',
      }));
      return null;
    }
  }, []);

  // Logout
  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  // Derive zkLogin address from email (for gift recipient)
  const deriveAddressFromEmail = useCallback(async (
    email: string, 
    customSalt?: string
  ): Promise<string | null> => {
    try {
      // For recipient address derivation, we need to simulate what their address would be
      // This requires knowing their salt, which is typically user-specific
      // For demo purposes, we use a deterministic salt based on email
      const salt = customSalt || await generateUserSalt(email);
      
      // Note: To get the actual address, we need a valid JWT
      // This is a limitation - we can only derive if we have the JWT
      // For the gift flow, the sender specifies the email, and the recipient
      // will authenticate to prove ownership
      
      console.log('Would derive address for email:', email, 'with salt:', salt);
      
      // Return null as we can't derive without JWT
      // The actual verification happens when recipient claims the gift
      return null;
    } catch (error) {
      console.error('Error deriving address:', error);
      return null;
    }
  }, []);

  return {
    ...state,
    ephemeralKeyData,
    initializeZkLogin,
    getGoogleLoginUrl,
    loginWithGoogle,
    handleOAuthCallback,
    logout,
    deriveAddressFromEmail,
    clearSession,
  };
}

/**
 * Generate a deterministic user salt from email
 * In production, this should be stored securely per user
 */
async function generateUserSalt(email: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase() + '_suigift_salt_v1');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  // Use first 16 bytes as BigInt for salt
  const saltBigInt = BigInt('0x' + hashArray.slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join(''));
  return saltBigInt.toString();
}

/**
 * Hash email to bytes (SHA-256) for smart contract
 */
export async function hashEmailForContract(email: string): Promise<number[]> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer));
}

/**
 * Verify if an email hash matches
 */
export async function verifyEmailHash(
  email: string, 
  hashBytes: number[]
): Promise<boolean> {
  const computedHash = await hashEmailForContract(email);
  return computedHash.every((byte, i) => byte === hashBytes[i]);
}

/**
 * Parse JWT from URL hash (OAuth callback)
 */
export function parseJwtFromUrl(): string | null {
  const hash = window.location.hash;
  console.log('parseJwtFromUrl - hash:', hash);
  
  if (!hash) {
    console.log('parseJwtFromUrl - no hash found');
    return null;
  }
  
  const params = new URLSearchParams(hash.slice(1));
  const idToken = params.get('id_token');
  console.log('parseJwtFromUrl - id_token found:', !!idToken);
  
  return idToken;
}

/**
 * Decode JWT payload
 */
export function decodeJwtPayload(jwt: string): Record<string, any> | null {
  try {
    const payload = jwt.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}
