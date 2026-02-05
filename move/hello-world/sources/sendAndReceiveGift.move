#[allow(lint(self_transfer))]
module hello_world::gifting {
    // --- KHAI BÁO THƯ VIỆN (IMPORTS) ---
    use std::string::String;
    use sui::coin::{Self, Coin}; 
    use sui::sui::SUI;
    use sui::event; 
    use sui::clock::Clock;
    
    // Bổ sung các thư viện thiếu để xử lý Object và Transfer
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    // --- CONSTANTS ---
    // Thời gian hết hạn mặc định: 7 ngày (tính bằng milliseconds)
    const DEFAULT_EXPIRY_MS: u64 = 7 * 24 * 60 * 60 * 1000;
    
    // Error codes
    const EGiftExpired: u64 = 1;
    const EGiftNotExpired: u64 = 2;
    const ENotSender: u64 = 3;
    const EInsufficientGasDeposit: u64 = 4;
    const EEmailHashMismatch: u64 = 5;
    const EGiftAlreadyClaimed: u64 = 6;

    // --- CẤU TRÚC DỮ LIỆU (STRUCTS) ---

    // Tắt cảnh báo về việc dùng Coin thay vì Balance (để code đơn giản cho demo)
    #[allow(lint(coin_field))]
    public struct GiftBox has key, store {
        id: UID,
        sender: address,
        recipient_email_hash: vector<u8>, // Hash của email người nhận (SHA256)
        message: String,
        is_opened: bool,
        content: Coin<SUI>,
        gas_deposit: Coin<SUI>, // SUI để trả phí gas cho người nhận
        created_at: u64, // Timestamp khi tạo quà
        expires_at: u64  // Timestamp hết hạn
    }
    
    // Shared GiftBox - Ai có email đúng thì nhận được (không cần biết trước địa chỉ)
    #[allow(lint(coin_field))]
    public struct SharedGiftBox has key {
        id: UID,
        sender: address,
        recipient_email_hash: vector<u8>, // Hash của email người nhận (SHA256)
        message: String,
        is_claimed: bool,
        content: Coin<SUI>,
        gas_deposit: Coin<SUI>,
        created_at: u64,
        expires_at: u64
    }

    // --- EVENTS ---
    
    // Sự kiện khi quà được tạo (để frontend lắng nghe)
    public struct GiftCreatedEvent has copy, drop {
        gift_id: ID,
        sender: address,
        recipient_email_hash: vector<u8>,
        amount: u64,
        expires_at: u64,
    }

    // Sự kiện Proof of Impact: Được phát ra khi quà được mở
    public struct GiftOpenedEvent has copy, drop {
        gift_id: ID,
        sender: address,
        recipient: address,
        amount: u64,
    }
    
    // Sự kiện khi quà bị từ chối
    public struct GiftRejectedEvent has copy, drop {
        gift_id: ID,
        sender: address,
        recipient: address,
        amount: u64,
    }
    
    // Sự kiện khi quà hết hạn và hoàn tiền
    public struct GiftRefundedEvent has copy, drop {
        gift_id: ID,
        sender: address,
        amount: u64,
        reason: String, // "expired" hoặc "rejected"
    }
    
    // Event cho SharedGiftBox
    public struct SharedGiftCreatedEvent has copy, drop {
        gift_id: ID,
        sender: address,
        recipient_email_hash: vector<u8>,
        amount: u64,
        expires_at: u64,
    }
    
    public struct SharedGiftClaimedEvent has copy, drop {
        gift_id: ID,
        sender: address,
        claimer: address,
        amount: u64,
    }

    // --- CÁC HÀM CHỨC NĂNG ---

    // 1. Gửi quà với zkLogin (SENDER thực hiện)
    // Frontend sẽ hash email người nhận và truyền vào `recipient_email_hash`
    // `gas_deposit` là số SUI để trả phí gas cho người nhận (khuyến nghị 0.01 SUI)
    public fun send_sui_gift_zklogin(
        input_coin: Coin<SUI>, 
        gas_coin: Coin<SUI>, // SUI để trả phí gas cho người nhận
        message: String, 
        recipient_email_hash: vector<u8>, // SHA256 hash của email người nhận
        recipient: address, // Địa chỉ zkLogin của người nhận
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let id = object::new(ctx);
        let current_time = sui::clock::timestamp_ms(clock);
        let expires_at = current_time + DEFAULT_EXPIRY_MS;
        
        let gift_amount = coin::value(&input_coin);
        let gift_id = object::uid_to_inner(&id);

        let gift = GiftBox {
            id,
            sender,
            recipient_email_hash,
            message,
            is_opened: false,
            content: input_coin,
            gas_deposit: gas_coin,
            created_at: current_time,
            expires_at
        };

        // Emit event để frontend lắng nghe
        event::emit(GiftCreatedEvent {
            gift_id,
            sender,
            recipient_email_hash,
            amount: gift_amount,
            expires_at,
        });

        // Chuyển quyền sở hữu GiftBox cho địa chỉ zkLogin của người nhận
        transfer::public_transfer(gift, recipient);
    }
    
    // 1b. GỬI QUÀ CHỈ BẰNG EMAIL (không cần biết địa chỉ ví người nhận)
    // Quà sẽ là shared object - ai chứng minh được email thì nhận được
    public fun send_gift_email_only(
        input_coin: Coin<SUI>,
        gas_coin: Coin<SUI>,
        message: String,
        recipient_email_hash: vector<u8>, // SHA256 hash của email người nhận
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let id = object::new(ctx);
        let current_time = sui::clock::timestamp_ms(clock);
        let expires_at = current_time + DEFAULT_EXPIRY_MS;
        
        let gift_amount = coin::value(&input_coin);
        let gift_id = object::uid_to_inner(&id);

        let gift = SharedGiftBox {
            id,
            sender,
            recipient_email_hash,
            message,
            is_claimed: false,
            content: input_coin,
            gas_deposit: gas_coin,
            created_at: current_time,
            expires_at
        };

        // Emit event
        event::emit(SharedGiftCreatedEvent {
            gift_id,
            sender,
            recipient_email_hash,
            amount: gift_amount,
            expires_at,
        });

        // SHARE object - bất kỳ ai cũng có thể tương tác
        transfer::share_object(gift);
    }
    
    // 2b. NHẬN QUÀ BẰNG EMAIL (cho SharedGiftBox)
    // Người nhận cần chứng minh họ sở hữu email bằng cách cung cấp email hash đúng
    // Frontend sẽ xác minh qua zkLogin trước khi gọi function này
    public fun claim_shared_gift(
        gift: &mut SharedGiftBox,
        claimer_email_hash: vector<u8>, // Hash email của người claim
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let claimer = tx_context::sender(ctx);
        let current_time = sui::clock::timestamp_ms(clock);
        
        // Kiểm tra chưa được claim
        assert!(!gift.is_claimed, EGiftAlreadyClaimed);
        
        // Kiểm tra hết hạn
        assert!(current_time <= gift.expires_at, EGiftExpired);
        
        // Kiểm tra email hash khớp
        assert!(gift.recipient_email_hash == claimer_email_hash, EEmailHashMismatch);
        
        // Đánh dấu đã claim
        gift.is_claimed = true;
        
        let gift_id = object::uid_to_inner(&gift.id);
        let amount = coin::value(&gift.content);
        
        // Emit event
        event::emit(SharedGiftClaimedEvent {
            gift_id,
            sender: gift.sender,
            claimer,
            amount,
        });
        
        // Chuyển tiền cho người claim
        let content_value = coin::value(&gift.content);
        let content_to_transfer = coin::split(&mut gift.content, content_value, ctx);
        transfer::public_transfer(content_to_transfer, claimer);
        
        // Chuyển gas deposit cho người claim
        let gas_value = coin::value(&gift.gas_deposit);
        if (gas_value > 0) {
            let gas_to_transfer = coin::split(&mut gift.gas_deposit, gas_value, ctx);
            transfer::public_transfer(gas_to_transfer, claimer);
        }
    }
    
    // 3b. HOÀN TIỀN SharedGiftBox hết hạn
    public fun refund_shared_gift(
        gift: &mut SharedGiftBox,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let current_time = sui::clock::timestamp_ms(clock);
        
        // Chỉ refund nếu chưa claim và đã hết hạn
        assert!(!gift.is_claimed, EGiftAlreadyClaimed);
        assert!(current_time > gift.expires_at, EGiftNotExpired);
        
        gift.is_claimed = true; // Đánh dấu để không thể claim nữa
        
        let gift_id = object::uid_to_inner(&gift.id);
        let amount = coin::value(&gift.content);
        
        event::emit(GiftRefundedEvent {
            gift_id,
            sender: gift.sender,
            amount,
            reason: std::string::utf8(b"expired"),
        });
        
        // Hoàn tiền về cho sender
        let content_value = coin::value(&gift.content);
        if (content_value > 0) {
            let content_to_transfer = coin::split(&mut gift.content, content_value, ctx);
            transfer::public_transfer(content_to_transfer, gift.sender);
        };
        
        let gas_value = coin::value(&gift.gas_deposit);
        if (gas_value > 0) {
            let gas_to_transfer = coin::split(&mut gift.gas_deposit, gas_value, ctx);
            transfer::public_transfer(gas_to_transfer, gift.sender);
        }
    }
    
    // Hàm gửi quà đơn giản (không cần gas deposit) - tương thích ngược
    public fun send_sui_gift(
        input_coin: Coin<SUI>, 
        message: String, 
        recipient: address,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let id = object::new(ctx);
        let gift_amount = coin::value(&input_coin);
        let gift_id = object::uid_to_inner(&id);

        // Tạo coin rỗng cho gas_deposit (người nhận tự trả gas)
        let empty_gas = coin::zero<SUI>(ctx);

        let gift = GiftBox {
            id,
            sender,
            recipient_email_hash: vector::empty<u8>(),
            message,
            is_opened: false,
            content: input_coin,
            gas_deposit: empty_gas,
            created_at: 0,
            expires_at: 0 // 0 = không hết hạn
        };

        event::emit(GiftCreatedEvent {
            gift_id,
            sender,
            recipient_email_hash: vector::empty<u8>(),
            amount: gift_amount,
            expires_at: 0,
        });

        transfer::public_transfer(gift, recipient);
    }

    // 2. Mở quà và Nhận tiền (RECIPIENT thực hiện)
    // Gas sẽ được trả từ gas_deposit của người gửi
    public fun open_and_claim(
        gift: GiftBox, 
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let recipient = tx_context::sender(ctx);
        let current_time = sui::clock::timestamp_ms(clock);
        
        // Kiểm tra hết hạn (nếu expires_at > 0)
        if (gift.expires_at > 0) {
            assert!(current_time <= gift.expires_at, EGiftExpired);
        };

        let GiftBox { 
            id, 
            sender, 
            recipient_email_hash: _,
            message: _, 
            is_opened: _, 
            content,
            gas_deposit,
            created_at: _,
            expires_at: _
        } = gift;

        let amount = coin::value(&content);
        let gift_id = object::uid_to_inner(&id);

        // Emit event
        event::emit(GiftOpenedEvent {
            gift_id,
            sender,
            recipient,
            amount,
        });

        object::delete(id);

        // Chuyển SUI vào ví người nhận
        transfer::public_transfer(content, recipient);
        
        // Gas deposit cũng chuyển cho người nhận (hoặc có thể burn)
        if (coin::value(&gas_deposit) > 0) {
            transfer::public_transfer(gas_deposit, recipient);
        } else {
            coin::destroy_zero(gas_deposit);
        }
    }
    
    // 3. Từ chối quà (RECIPIENT thực hiện) - hoàn tiền về cho sender
    public fun reject_gift(
        gift: GiftBox,
        ctx: &mut TxContext
    ) {
        let recipient = tx_context::sender(ctx);
        
        let GiftBox { 
            id, 
            sender, 
            recipient_email_hash: _,
            message, 
            is_opened: _, 
            content,
            gas_deposit,
            created_at: _,
            expires_at: _
        } = gift;

        let amount = coin::value(&content);
        let gift_id = object::uid_to_inner(&id);

        // Emit event
        event::emit(GiftRejectedEvent {
            gift_id,
            sender,
            recipient,
            amount,
        });
        
        event::emit(GiftRefundedEvent {
            gift_id,
            sender,
            amount,
            reason: message, // Sử dụng lại message field
        });

        object::delete(id);

        // Hoàn tiền về cho người gửi
        transfer::public_transfer(content, sender);
        
        if (coin::value(&gas_deposit) > 0) {
            transfer::public_transfer(gas_deposit, sender);
        } else {
            coin::destroy_zero(gas_deposit);
        }
    }
    
    // 4. Hoàn tiền khi quà hết hạn (SENDER hoặc bất kỳ ai có thể gọi)
    public fun refund_expired_gift(
        gift: GiftBox,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let current_time = sui::clock::timestamp_ms(clock);
        
        // Chỉ có thể refund nếu đã hết hạn (và có set thời hạn)
        assert!(gift.expires_at > 0, EGiftNotExpired);
        assert!(current_time > gift.expires_at, EGiftNotExpired);
        
        let GiftBox { 
            id, 
            sender, 
            recipient_email_hash: _,
            message: _, 
            is_opened: _, 
            content,
            gas_deposit,
            created_at: _,
            expires_at: _
        } = gift;

        let amount = coin::value(&content);
        let gift_id = object::uid_to_inner(&id);

        event::emit(GiftRefundedEvent {
            gift_id,
            sender,
            amount,
            reason: std::string::utf8(b"expired"),
        });

        object::delete(id);

        // Hoàn tiền về cho người gửi
        transfer::public_transfer(content, sender);
        
        if (coin::value(&gas_deposit) > 0) {
            transfer::public_transfer(gas_deposit, sender);
        } else {
            coin::destroy_zero(gas_deposit);
        }
    }
    
    // 5. Hàm open_and_claim cũ (tương thích ngược, không cần clock)
    public fun open_and_claim_legacy(
        gift: GiftBox, 
        ctx: &mut TxContext
    ) {
        let recipient = tx_context::sender(ctx);

        let GiftBox { 
            id, 
            sender, 
            recipient_email_hash: _,
            message: _, 
            is_opened: _, 
            content,
            gas_deposit,
            created_at: _,
            expires_at: _
        } = gift;

        let amount = coin::value(&content);
        let gift_id = object::uid_to_inner(&id);

        event::emit(GiftOpenedEvent {
            gift_id,
            sender,
            recipient,
            amount,
        });

        object::delete(id);
        transfer::public_transfer(content, recipient);
        
        if (coin::value(&gas_deposit) > 0) {
            transfer::public_transfer(gas_deposit, recipient);
        } else {
            coin::destroy_zero(gas_deposit);
        }
    }
    
    // --- VIEW FUNCTIONS ---
    
    // Kiểm tra quà còn hiệu lực không
    public fun is_gift_valid(gift: &GiftBox, clock: &Clock): bool {
        if (gift.expires_at == 0) {
            return true // Không có thời hạn
        };
        let current_time = sui::clock::timestamp_ms(clock);
        current_time <= gift.expires_at
    }
    
    // Lấy thông tin quà
    public fun get_gift_info(gift: &GiftBox): (address, u64, u64, u64, bool) {
        (
            gift.sender,
            coin::value(&gift.content),
            gift.created_at,
            gift.expires_at,
            gift.is_opened
        )
    }
}