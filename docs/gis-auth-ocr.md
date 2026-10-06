# GIS: đăng nhập, API và OCR

## Đăng nhập

`/dashboard` và `/gis-dashboard` dùng phiên OAuth2/OIDC của Spring Security, qua `/api/account`. Nút đăng nhập chuyển đến `/oauth2/authorization/oidc`. Keycloak/OIDC phải hoạt động theo cấu hình backend hiện có.

Tài khoản demo, mật khẩu hardcode, nhập email thủ công và nút nâng quyền Super Admin đã được bỏ khỏi luồng đăng nhập. Nội dung localStorage không tạo phiên đăng nhập hoặc cấp quyền.

Ánh xạ quyền từ tài khoản backend:

| Authority         | Vai trò GIS |
| ----------------- | ----------- |
| `ROLE_USER`       | officer     |
| `ROLE_SUB_ADMIN`  | sub-admin   |
| `ROLE_ADMIN`      | admin       |
| `ROLE_SUPERADMIN` | superadmin  |

Các authority phải được cấp trong nhà cung cấp OIDC và xuất hiện trong `/api/account`. Quyền vào trang quản trị JHipster vẫn yêu cầu `ROLE_ADMIN`; tài khoản Super Admin cần thêm quyền này nếu sử dụng trang quản trị JHipster.

Các API hộ dân, nhân khẩu, hồ sơ, nhật ký, cảnh báo và địa bàn yêu cầu xác thực. CSRF được bật lại cho yêu cầu ghi bằng session; Axios cùng origin gửi cookie `XSRF-TOKEN` qua header `X-XSRF-TOKEN`.

Danh sách tài khoản, phân công địa bàn và menu cũ lưu cục bộ vẫn là dữ liệu giao diện, không phải nguồn cấp quyền OIDC. Hệ thống chưa có mô hình phân công địa bàn được backend thực thi; thay đổi này không thiết lập giới hạn truy cập theo từng ấp/đường.

## OCR cục bộ

Ảnh được nhận dạng bằng Tesseract.js trong Web Worker của trình duyệt. Worker, WASM và mô hình `vie`/`eng` được đóng gói bằng Vite tại `/ocr/`. Không dùng CDN và không gọi endpoint `/api/ocr/scan` chưa được triển khai. Xem [tài liệu Tesseract.js](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md).

Hỗ trợ ảnh PNG, JPEG, WebP dưới 10 MB từ camera hoặc tải lên. Trình duyệt cần HTTPS hoặc localhost để dùng camera. Đóng hộp thoại sẽ hủy nhận dạng và dừng camera. Nhận dạng tự dừng sau hai phút.

Thông tin được tách theo nhãn trên CCCD/CMND hoặc giấy đăng ký kinh doanh. Kết quả không phải xác minh danh tính: người dùng phải kiểm tra dấu tiếng Việt, số giấy tờ và từng trường trước khi lưu. Các trường không đọc được để trống; thêm nhân khẩu yêu cầu họ tên, năm sinh hợp lệ và giới tính.

Chỉ dữ liệu đã xác nhận mới được ghi qua API backend. Lưu ảnh vào mục ảnh kiểm tra là lựa chọn riêng, mặc định tắt, và hiện được lưu trong trình duyệt theo cơ chế cũ. Ảnh không được gửi đến dịch vụ OCR bên ngoài.

## Kiểm tra

```powershell
node node_modules/vite/bin/vite.js build
node node_modules/vitest/vitest.mjs run src/main/webapp/app/gis/services
.\mvnw.cmd '-Dskip.installnodenpm' '-Dskip.npm' '-Dtest=GisSecurityTest' test
```

Trạng thái backend được kiểm tra định kỳ 30 giây. Chỉ hiển thị online khi `/management/health` trả HTTP thành công và JSON có `status: UP`; lỗi mạng, timeout hoặc phản hồi khác được hiển thị offline.

`muc-tieu.md` và `Map3DTab.tsx` không có trong checkout đã khảo sát. Không tạo file thay thế vì chưa có nội dung hoặc yêu cầu chức năng 3D tương ứng.
