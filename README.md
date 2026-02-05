# 🎁 SuiGift - Nền Tảng Tặng Quà Blockchain

> **"Tặng quà kỹ thuật số trong nháy mắt - trên blockchain Sui"**

**SuiGift by Chain-Linkers** là một ứng dụng phi tập trung (DApp) được xây dựng trên nền tảng **Sui Blockchain**, cho phép người dùng gửi và nhận quà tặng kỹ thuật số (SUI Token) một cách an toàn, nhanh chóng và đặc biệt là **không cần người nhận phải có ví crypto sẵn**.

---

## 💡 Vấn Đề Chúng Tôi Giải Quyết

### Thực tế hiện nay:
- **Rào cản gia nhập crypto**: Để nhận tiền điện tử, người nhận cần tạo ví, backup seed phrase, hiểu về blockchain... - quá phức tạp cho người mới.
- **Lì xì Tết truyền thống**: Khó gửi cho người ở xa, phải có tiền mặt, không thể gửi theo cách sáng tạo.
- **Chuyển tiền quốc tế**: Phí cao, thời gian lâu, thủ tục rườm rà.

### Giải pháp SuiGift:
> **"Chỉ cần biết email người nhận - họ sẽ nhận được quà ngay cả khi chưa từng dùng crypto!"**

---

## 🏗️ Kiến Trúc Hệ Thống

### Smart Contract (Move Language)
```
📦 hello_world::gifting
├── GiftBox          - Hộp quà gửi cho địa chỉ ví cụ thể
├── SharedGiftBox    - Hộp quà gửi bằng email (không cần địa chỉ ví)
└── Events           - Thông báo real-time khi có quà mới
```

### Frontend (React + TypeScript)
```
🖥️ SuiGift UI
├── HomePage         - Trang chủ với giao diện đẹp mắt
├── CreateGift       - Tạo và gửi quà tặng
├── ClaimGift        - Nhận và mở quà
├── zkLogin          - Đăng nhập bằng Google (không cần ví)
└── Notifications    - Thông báo quà mới real-time
```

---

## ✨ Các Tính Năng Chính

### 1️⃣ Tạo Hộp Quà (Create Gift)

**Hai chế độ gửi quà:**

| Chế Độ | Mô Tả | Use Case |
|--------|-------|----------|
| **Classic Mode** | Gửi đến địa chỉ ví Sui | Người nhận đã có ví crypto |
| **zkLogin Mode** | Chỉ cần email người nhận | Người nhận chưa có ví - sử dụng Google OAuth |

**Quy trình gửi quà:**
1. Nhập số lượng SUI muốn tặng
2. Viết lời nhắn chúc mừng
3. Chọn mode: nhập địa chỉ ví **HOẶC** email
4. Ký giao dịch → Quà được tạo trên blockchain!

**Tính năng nổi bật:**
- **Gas Deposit**: Người gửi có thể đính kèm 0.01 SUI để trả phí gas cho người nhận (họ không cần có SUI sẵn)
- **Expiry Time**: Quà tự động hết hạn sau 7 ngày - tiền hoàn về nếu không được nhận
- **SHA256 Email Hash**: Bảo mật - email được mã hóa trước khi lưu on-chain

### 2️⃣ Nhận Quà (Claim Gift)

**Trải nghiệm người nhận:**
```
📧 Nhận link quà → 🔐 Đăng nhập Google → ✅ Xác thực email → 🎉 Mở quà với confetti!
```

**Các tùy chọn:**
- **Mở quà**: Nhận SUI vào ví
- **Từ chối**: Hoàn tiền về cho người gửi
- **Kiểm tra thời hạn**: Countdown timer hiển thị thời gian còn lại

**Bảo mật với zkLogin:**
- Hệ thống xác thực email của người claim phải khớp với email người gửi đã chỉ định
- Không ai khác có thể "cướp" quà của bạn

### 3️⃣ Đăng Nhập Không Cần Ví (zkLogin)

**Đây là điểm đột phá của SuiGift!**

```typescript
// Quy trình zkLogin
1. User click "Đăng nhập với Google"
2. Chuyển hướng đến Google OAuth
3. Nhận JWT token
4. Generate địa chỉ Sui từ email (deterministic)
5. User có thể tương tác với blockchain!
```

**Lợi ích:**
- ✅ Không cần cài extension ví
- ✅ Không cần backup seed phrase
- ✅ Quen thuộc như đăng nhập Facebook/Google
- ✅ Địa chỉ ví được generate từ email - luôn nhất quán

### 4️⃣ Thông Báo Real-Time

**Hệ thống notification thông minh:**
```typescript
// Lắng nghe events từ blockchain
useListenGifts() → queryEvents() → addNotification()
```

**Loại thông báo:**
- 🎁 `gift_received` - Có quà mới cho bạn!
- ✅ `gift_opened` - Quà đã được mở
- ❌ `gift_rejected` - Quà bị từ chối
- ⏰ `gift_expired` - Quà đã hết hạn
- 🎉 `claim_success` - Nhận quà thành công!

### 5️⃣ Hoàn Tiền Tự Động (Refund)

**Bảo vệ người gửi:**
```move
// Sau 7 ngày, nếu quà chưa được nhận:
refund_expired_gift() → transfer SUI về sender
refund_shared_gift() → hoàn tiền SharedGiftBox
```

---

## 🎨 Giao Diện Người Dùng

### Thiết kế hiện đại:
- **Màu chủ đạo**: Orange gradient (#ff6b35 → #f7931e)
- **Animations**: Framer Motion với particles floating
- **Responsive**: Hoạt động tốt trên mobile
- **Confetti**: Hiệu ứng pháo hoa khi mở quà thành công!

### UX thân thiện:
- Nút "Lấy Testnet SUI" - link trực tiếp đến faucet
- Hiển thị countdown thời gian hết hạn quà
- Loading spinner và error messages rõ ràng
- Copy gift ID dễ dàng để chia sẻ

---

## 🔒 Bảo Mật

| Layer | Giải pháp |
|-------|-----------|
| **Email Privacy** | SHA256 hash - không ai đọc được email thật |
| **Smart Contract** | Kiểm tra chủ sở hữu, thời hạn, trạng thái trước mọi action |
| **zkLogin** | Google OAuth + Zero-Knowledge Proof |
| **Ephemeral Keys** | Key tạm thời, tự hết hạn theo epoch |

---

## 📊 Use Cases Thực Tế

### 🧧 Lì Xì Tết Online
> Ông bà ở Việt Nam gửi lì xì cho cháu ở Mỹ - chỉ cần email!

### 🎂 Quà Sinh Nhật
> Gửi SUI kèm lời chúc cá nhân hóa, người nhận tự quyết định dùng tiền làm gì

### 💼 Thưởng Nhân Viên
> HR gửi bonus crypto cho team mà không cần thu thập địa chỉ ví phức tạp

### 🎓 Học Bổng / Tài Trợ
> Tổ chức gửi grant đến sinh viên chỉ với email trường

---

## 🚀 Quick Start

### Prerequisites
- [Sui CLI](https://docs.sui.io/guides/developer/getting-started/sui-install) đã được cài đặt
- Node.js 18+ và pnpm

### 1. Chạy Frontend (Sử dụng package đã deploy)
```bash
cd ui
pnpm install
pnpm dev
```
Truy cập: http://localhost:5173/

### 2. Deploy Smart Contract của riêng bạn
```bash
cd move/hello-world
sui client publish
```
Copy `PackageID` và paste vào `ui/src/constants.ts`

---

## 🚀 Tầm Nhìn Tương Lai

1. **Multi-token Support**: Hỗ trợ gửi các token khác trên Sui
2. **NFT Gifts**: Tặng NFT kèm theo SUI
3. **Random Red Envelope**: Lì xì ngẫu nhiên cho nhóm người
4. **Scheduled Gifts**: Đặt lịch gửi quà tự động
5. **Mobile App**: Ứng dụng iOS/Android native

---

## 💪 Tại Sao Chọn SuiGift?

| Tiêu chí | SuiGift | Giải pháp truyền thống |
|----------|---------|------------------------|
| Tốc độ | 2-3 giây | Vài ngày (chuyển khoản quốc tế) |
| Phí | ~0.001 SUI | 2-5% (dịch vụ chuyển tiền) |
| Rào cản | Chỉ cần email | Cần tài khoản ngân hàng |
| Bảo mật | Blockchain immutable | Có thể bị gian lận |
| Minh bạch | Xem được trên explorer | Hộp đen |

---

## 👥 Đội Ngũ Phát Triển

**Chain-Linkers Team**

---

## 🎯 Kết Luận

**SuiGift** không chỉ là một ứng dụng chuyển tiền - đó là **cầu nối đưa người dùng phổ thông vào thế giới Web3** một cách tự nhiên nhất. Bằng việc kết hợp **zkLogin + SharedGiftBox**, chúng tôi đã loại bỏ hoàn toàn rào cản "phải có ví crypto" - mở ra cơ hội cho hàng tỷ người tiếp cận blockchain lần đầu tiên.

---

## 📄 License

MIT License

---

**Demo**: Kết nối ví → Tạo quà → Chia sẻ link → Người nhận đăng nhập Google → Mở quà! 🎉