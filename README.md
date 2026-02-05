# 🎁 SuiGift - Nền tảng tặng quà kỹ thuật số Tết

**Kết nối truyền thống Việt Nam với công nghệ Blockchain hiện đại**

SuiGift là một ứng dụng Web3 độc đáo cho phép bạn gửi SUI token như món quà Tết đặc biệt, kèm theo lời chúc ý nghĩa. Ứng dụng được xây dựng trên Sui Blockchain - nền tảng blockchain nhanh chóng, an toàn và chi phí thấp.

## ✨ Tính năng nổi bật

- 🎀 **Hộp quà ảo đẹp mắt**: Không chỉ là giao dịch, mà là trải nghiệm cảm xúc
- ✉️ **Gửi qua Email (zkLogin)**: Không cần biết địa chỉ ví, chỉ cần email
- ⏰ **Quản lý thời hạn**: Tự động hoàn tiền sau 7 ngày nếu không nhận
- ⛽ **Gas Deposit**: Người gửi trả phí, người nhận không cần SUI sẵn
- 🎉 **Hiệu ứng đặc biệt**: Pháo giấy và animation khi mở quà
- 🔐 **An toàn tuyệt đối**: Blockchain Sui với smart contract đã kiểm tra

> 💡 **Đọc thêm về ý tưởng và tầm nhìn trong [NARRATIVE.md](./NARRATIVE.md)**


## 🚀 Khởi động nhanh (3 phút!)

### Cách 1: Dùng package đã publish sẵn

App đã được cấu hình sẵn với package đã publish, bạn có thể trải nghiệm ngay:

1. Cài đặt dependencies:
   ```bash
   cd ui
   npm install  # hoặc pnpm install
   ```

2. Chạy ứng dụng:
   ```bash
   npm run dev  # hoặc pnpm dev
   ```

3. Mở trình duyệt: [http://localhost:5173/](http://localhost:5173/)

4. Kết nối ví Sui và bắt đầu tặng quà! 🎁

### Cách 2: Deploy package của riêng bạn

Nếu muốn customize hoặc deploy phiên bản riêng, xem hướng dẫn bên dưới.

## 🔧 Deploy phiên bản của bạn

### Yêu cầu
- Cài đặt Sui CLI: [Hướng dẫn](https://docs.sui.io/guides/developer/getting-started/sui-install)
- Node.js và npm/pnpm

### Bước 1: Publish Move Package

```bash
cd move/hello-world
sui move build
sui client publish --gas-budget 100000000
```

**Quan trọng**: Copy `PackageID` từ output và dán vào `ui/src/constants.ts`:
```typescript
export const TESTNET_HELLO_WORLD_PACKAGE_ID = "0xYOUR_PACKAGE_ID";
```

### Bước 2: Chạy Frontend

```bash
cd ui
npm install
npm run dev
```

Truy cập: [http://localhost:5173/](http://localhost:5173/)

## 📚 Tài liệu chi tiết

- **[NARRATIVE.md](./NARRATIVE.md)**: Câu chuyện, ý tưởng và tầm nhìn của SuiGift
- **[QUICK_START.md](./QUICK_START.md)**: Hướng dẫn sử dụng chi tiết
- **[CHECKLIST.md](./CHECKLIST.md)**: Checklist triển khai và tính năng
- **[ui/README_FRONTEND.md](./ui/README_FRONTEND.md)**: Tài liệu kỹ thuật frontend

## 🎯 Use Cases thực tế

### 1. Lì xì Tết cho con cháu
Anh/chị đang ở xa, gửi lì xì Tết về quê bằng SUI token kèm lời chúc đầy ý nghĩa.

### 2. Quà sinh nhật bạn bè
Tặng quà sinh nhật độc đáo với cryptocurrency và lời nhắn riêng tư.

### 3. Thưởng nhân viên
Doanh nghiệp gửi bonus cuối năm bằng crypto một cách chuyên nghiệp.

### 4. Giới thiệu người thân với Web3
Giúp người thân dễ dàng trải nghiệm blockchain qua zkLogin (đăng nhập Google).

## 🏗️ Kiến trúc kỹ thuật

### Smart Contract (Move)
```move
module hello_world::gifting {
    // Regular gift - Gửi đến địa chỉ ví
    public fun send_sui_gift(coin, message, recipient, ctx)
    
    // zkLogin gift - Gửi qua email
    public fun send_gift_email_only(coin, gas, message, email_hash, clock, ctx)
    
    // Claim shared gift - Nhận quà qua email
    public fun claim_shared_gift(gift, email_hash, clock, ctx)
    
    // Open & claim regular gift
    public fun open_and_claim(gift, clock, ctx)
    
    // Refund expired gifts
    public fun refund_expired_gift(gift, clock, ctx)
    public fun refund_shared_gift(gift, clock, ctx)
}
```

### Frontend Stack
- **React** + **TypeScript** + **Vite**: Framework hiện đại
- **@mysten/dapp-kit**: Tích hợp Sui blockchain
- **@mysten/zklogin**: Đăng nhập Google authentication
- **Framer Motion**: Animations mượt mà
- **Radix UI**: Component library đẹp
- **Canvas Confetti**: Hiệu ứng pháo giấy

## 🎨 Screenshots

*(Chạy ứng dụng để thấy giao diện đẹp với gradient cam-đỏ Tết!)*

- Trang chủ với hero section bắt mắt
- Form tạo quà với toggle zkLogin
- Màn hình nhận quà với hiệu ứng 3D
- Popup thông báo quà mới realtime
- Hiệu ứng confetti khi mở quà 🎉

## 🤝 Đóng góp

SuiGift là dự án mã nguồn mở! Chúng tôi hoan nghênh mọi đóng góp:

1. Fork repository
2. Tạo branch tính năng: `git checkout -b feature/TinhNangMoi`
3. Commit changes: `git commit -m 'Thêm tính năng X'`
4. Push to branch: `git push origin feature/TinhNangMoi`
5. Tạo Pull Request

## 👥 Team Chain-Linkers

Được phát triển bởi đội ngũ Chain-Linkers - Nhóm phát triển blockchain từ Việt Nam với đam mê xây dựng ứng dụng Web3 thực tế.

## 📜 License

MIT License - Xem [LICENSE](./LICENSE) để biết thêm chi tiết.

---

**🇻🇳 Made with ❤️ in Vietnam | Powered by Sui Blockchain**

*"Tặng quà kỹ thuật số, gửi trao yêu thương thật"* ✨