# Tài liệu kỹ thuật - VKU Credit Registration Helper

## Tổng quan

Extension Chrome này được phát triển để hỗ trợ sinh viên VKU trong quá trình đăng ký tín chỉ, giúp việc tìm kiếm, xem chi tiết và đăng ký học phần trở nên dễ dàng hơn.

## Kiến trúc

### Cấu trúc thư mục
```
extension/
  ├── manifest.json      # Cấu hình extension
  ├── popup.html        # Giao diện popup
  ├── popup.js          # Logic xử lý popup
  ├── content.js        # Script tương tác với trang web
  ├── background.js     # Background script
  ├── styles.css        # CSS chung
  ├── choices.min.js    # Thư viện Choices.js
  ├── choices.min.css   # CSS cho Choices.js
  └── images/           # Icons và assets
```

### Các thành phần chính

#### 1. Popup UI (popup.html, popup.js)
- Giao diện chính của extension
- Sử dụng Choices.js cho multi-select
- Lưu trữ lựa chọn trong chrome.storage.local
- Xử lý các sự kiện người dùng

#### 2. Content Script (content.js)
- Tương tác với trang web VKU
- Lấy danh sách học phần
- Xử lý việc mở tab mới
- Đảm bảo các link đăng ký mở trong tab mới

#### 3. Background Script (background.js)
- Xử lý các sự kiện extension
- Quản lý storage
- Xử lý message passing

## API và Dependencies

### Chrome Extension API
- `chrome.storage.local`: Lưu trữ dữ liệu
- `chrome.tabs`: Quản lý tabs
- `chrome.runtime`: Message passing

### External Libraries
- Choices.js: Multi-select UI
- Version: Latest stable

## Tính năng chi tiết

### 1. Tìm kiếm học phần
```javascript
// popup.js
function requestCourseList() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'getCourseList' }, (response) => {
      // Xử lý response
    });
  });
}
```

### 2. Xem chi tiết học phần
```javascript
// content.js
async function showSelectedCourses(ids) {
  const newWindow = window.open('', '_blank');
  // Xử lý hiển thị chi tiết
}
```

### 3. Lưu trữ dữ liệu
```javascript
// popup.js
chrome.storage.local.set({ selectedCourses: selected });
chrome.storage.local.get('selectedCourses', (data) => {
  // Khôi phục lựa chọn
});
```

## Các vấn đề đã biết

1. **UX/UI**
   - Giao diện popup cần được cải thiện
   - Thiếu animations và transitions
   - Chưa tối ưu cho mobile

2. **Tính năng thiếu**
   - Chưa có quản lý học phần đã đăng ký
   - Thời khóa biểu chưa hoàn thiện
   - Thiếu tính năng xóa học phần

3. **Kỹ thuật**
   - Cần cải thiện error handling
   - Tối ưu performance
   - Thêm unit tests

## Kế hoạch phát triển

### Ngắn hạn
1. Hoàn thiện quản lý học phần đã đăng ký
2. Cải thiện UX/UI
3. Thêm thời khóa biểu

### Dài hạn
1. Thêm dark mode
2. Tối ưu hóa performance
3. Thêm tính năng xuất thời khóa biểu
4. Hỗ trợ thêm các trường đại học khác

## Hướng dẫn phát triển

### Cài đặt môi trường
1. Clone repository
2. Cài đặt extension trong Chrome
3. Tải và cài đặt Choices.js

### Quy trình phát triển
1. Tạo branch mới cho feature
2. Phát triển và test
3. Tạo pull request
4. Code review
5. Merge vào main

### Coding standards
- Sử dụng ESLint
- Tuân thủ Google JavaScript Style Guide
- Comment đầy đủ cho các hàm phức tạp

## Troubleshooting

### Các lỗi thường gặp
1. Không tìm thấy Choices.js
   - Kiểm tra file choices.min.js
   - Reload extension

2. Link không mở trong tab mới
   - Kiểm tra content script
   - Xem console log

3. Không lưu được lựa chọn
   - Kiểm tra chrome.storage
   - Xem permissions trong manifest.json

## Liên hệ và hỗ trợ

- Tạo issue trong repository
- Email: [your-email]
- Discord: [your-discord] 