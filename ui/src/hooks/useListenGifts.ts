import { useEffect, useRef, useCallback } from 'react';
import { useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { useNotification } from '../contexts/NotificationContext';
import { useNetworkVariable } from '../networkConfig';

interface GiftCreatedEvent {
  gift_id: string;
  sender: string;
  recipient_email_hash: number[];
  amount: string;
  expires_at: string;
}

/**
 * Hook để lắng nghe sự kiện quà tặng từ Sui Blockchain
 * Sử dụng polling để kiểm tra events mới (vì Sui chưa hỗ trợ WebSocket native)
 */
export function useListenGifts() {
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const packageId = useNetworkVariable("helloWorldPackageId");
  const { addNotification } = useNotification();
  
  // Track processed events to avoid duplicates
  const processedEventsRef = useRef<Set<string>>(new Set());
  
  // Fetch new gift events
  const checkForNewGifts = useCallback(async () => {
    if (!currentAccount?.address || !packageId) return;
    
    try {
      // Query events từ package
      const events = await suiClient.queryEvents({
        query: {
          MoveEventType: `${packageId}::gifting::GiftCreatedEvent`,
        },
        limit: 50,
        order: 'descending',
      });
      
      for (const event of events.data) {
        const eventId = `${event.id.txDigest}-${event.id.eventSeq}`;
        
        // Skip if already processed
        if (processedEventsRef.current.has(eventId)) continue;
        processedEventsRef.current.add(eventId);
        
        const eventData = event.parsedJson as GiftCreatedEvent;
        
        // Check if this gift is for the current user
        // In zkLogin scenario, we would compare email hash
        // For now, we check if the recipient address matches
        // This would need to be enhanced with zkLogin address derivation
        
        // For demo: Listen to all events and check ownership via object query
        try {
          const giftObject = await suiClient.getObject({
            id: eventData.gift_id,
            options: { showOwner: true },
          });
          
          if (giftObject.data) {
            const owner = (giftObject.data.owner as any)?.AddressOwner;
            
            if (owner === currentAccount.address) {
              // This gift is for the current user!
              const amountInSui = (parseInt(eventData.amount) / 1_000_000_000).toFixed(4);
              
              addNotification({
                giftId: eventData.gift_id,
                senderAddress: eventData.sender,
                amount: amountInSui,
                type: 'gift_received',
              });
            }
          }
        } catch (err) {
          // Object might not exist anymore (already claimed)
          console.log('Gift object not found:', eventData.gift_id);
        }
      }
    } catch (error) {
      console.error('Error checking for new gifts:', error);
    }
  }, [suiClient, currentAccount, packageId, addNotification]);
  
  // Poll for new events every 10 seconds
  useEffect(() => {
    if (!currentAccount?.address) return;
    
    // Initial check
    checkForNewGifts();
    
    // Set up polling interval
    const intervalId = setInterval(checkForNewGifts, 10000);
    
    return () => clearInterval(intervalId);
  }, [currentAccount?.address, checkForNewGifts]);
  
  // Also check user's owned GiftBox objects directly
  const checkOwnedGifts = useCallback(async () => {
    if (!currentAccount?.address || !packageId) return;
    
    try {
      const ownedObjects = await suiClient.getOwnedObjects({
        owner: currentAccount.address,
        filter: {
          StructType: `${packageId}::gifting::GiftBox`,
        },
        options: {
          showContent: true,
        },
      });
      
      for (const obj of ownedObjects.data) {
        if (!obj.data) continue;
        
        const objectId = obj.data.objectId;
        
        // Skip if already notified
        if (processedEventsRef.current.has(`owned-${objectId}`)) continue;
        processedEventsRef.current.add(`owned-${objectId}`);
        
        if (obj.data.content?.dataType === 'moveObject') {
          const fields = obj.data.content.fields as any;
          const amountInSui = (parseInt(fields.content?.fields?.balance || '0') / 1_000_000_000).toFixed(4);
          
          addNotification({
            giftId: objectId,
            senderAddress: fields.sender,
            amount: amountInSui,
            message: fields.message,
            type: 'gift_received',
          });
        }
      }
    } catch (error) {
      console.error('Error checking owned gifts:', error);
    }
  }, [suiClient, currentAccount, packageId, addNotification]);
  
  // Check owned gifts on mount and when account changes
  useEffect(() => {
    if (currentAccount?.address) {
      checkOwnedGifts();
    }
  }, [currentAccount?.address, checkOwnedGifts]);
  
  return {
    checkForNewGifts,
    checkOwnedGifts,
  };
}

/**
 * Hook đơn giản hơn cho demo: Lắng nghe qua Supabase Realtime
 * (Cần setup Supabase project riêng)
 */
export function useSupabaseGiftListener() {
  const { addNotification } = useNotification();
  const currentAccount = useCurrentAccount();
  
  useEffect(() => {
    if (!currentAccount?.address) return;
    
    // TODO: Implement Supabase Realtime subscription
    // const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    // 
    // const subscription = supabase
    //   .channel('gifts')
    //   .on('postgres_changes', {
    //     event: 'INSERT',
    //     schema: 'public',
    //     table: 'gifts',
    //     filter: `recipient=eq.${currentAccount.address}`,
    //   }, (payload) => {
    //     addNotification({
    //       giftId: payload.new.gift_id,
    //       senderAddress: payload.new.sender,
    //       amount: payload.new.amount,
    //       type: 'gift_received',
    //     });
    //   })
    //   .subscribe();
    //
    // return () => {
    //   supabase.removeChannel(subscription);
    // };
  }, [currentAccount?.address, addNotification]);
}

/**
 * Utility: Hash email for zkLogin comparison
 */
export async function hashEmail(email: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer);
}

/**
 * Utility: Derive zkLogin address from email
 * Note: This is a simplified version. Real implementation needs
 * proper zkLogin proof generation with nonce, epoch, etc.
 */
export async function deriveZkLoginAddress(
  email: string,
  _googleIdToken: string,
  _salt: string
): Promise<string> {
  // This would need the actual zkLogin SDK implementation
  // For now, return placeholder
  console.log('Deriving zkLogin address for:', email);
  
  // In production, use:
  // import { jwtToAddress } from '@mysten/zklogin';
  // return jwtToAddress(_googleIdToken, _salt);
  
  return '0x...'; // Placeholder
}
