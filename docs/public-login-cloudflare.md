# Đăng nhập qua Cloudflare Tunnel

> **24/10/2026: cấu hình tunnel này đã ngừng sử dụng.** Xem [cấu hình OIDC không dùng tunnel](oidc-hosting.md). Override trỏ tunnel cũ trong `.rbac/keycloak.properties` đã được gỡ; Keycloak dev dùng `http://localhost:9080`. Nội dung dưới đây chỉ giữ làm lịch sử xử lý sự cố, không phải hướng dẫn khởi động hiện tại.

Sửa lỗi ngày 23/10/2026: callback OIDC quay lại ứng dụng nhưng phiên không được công nhận, `/api/account` trả 401. Lần tái hiện ban đầu, discovery trên tunnel trả issuer `http://<tunnel>/realms/jhipster` trong khi backend chờ `http://localhost:9080/realms/jhipster`.

Cấu hình đúng gồm ba phần:

1. Keycloak realm `frontendUrl` và backend OIDC issuer dùng cùng URL **HTTPS công khai**, kể cả khi token được đổi ở backend.
2. Vite chuyển `/realms`, `/resources` tới Keycloak và các API/callback tới backend, giữ nhất quán `X-Forwarded-Proto/Host/Port`. Không sửa URL redirect bằng regex hoặc mặc định ép mọi request localhost thành HTTPS.
3. `rbac.keycloak.issuer-uri` giữ URL nội bộ `http://localhost:9080/realms/jhipster`. Không proxy đường quản trị Keycloak ra Internet chỉ để backend kiểm tra quyền. Keycloak nhận `proxy-headers=xforwarded`; cookie công khai là Secure.

Issuer đang dùng được lưu tại `.rbac/keycloak.properties`, không hardcode tên tunnel trong sample. Profile `secret-samples` đọc `${APP_OIDC_ISSUER:...}`; development giữ fallback localhost khi chưa cấu hình public. File `.rbac` chứa các cấu hình riêng và có thể chứa secret, không commit.

Khi URL tunnel thay đổi, đăng nhập kcadm bằng tài khoản quản trị local rồi chạy:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/configure-public-login.ps1 -PublicOrigin https://TEN-MOI.trycloudflare.com
```

Script lưu cấu hình trước vào `.rbac/oidc-recovery/<thời điểm>`, đồng bộ realm, callback `web_app` và issuer backend. Sau đó restart backend; cần Vite còn chạy để backend đọc discovery qua tunnel. Không recreate/xóa volume Keycloak để sửa lỗi này.

Đối với container hiện tại, `proxy-headers=xforwarded` đã được ghi vào `/opt/keycloak/conf/keycloak.conf` và restart cùng container, giữ dữ liệu tài khoản. Docker Compose cũng có biến `KC_PROXY_HEADERS` cho các lần dựng mới. Không tự đưa Keycloak admin routes vào proxy frontend.

Sau khi đổi issuer hoặc restart backend, phiên cũ có thể không còn hợp lệ: tải lại trang và đăng nhập mới. Không cần đổi mật khẩu hoặc xóa dữ liệu dân cư. Nếu quay về localhost hoàn toàn, khôi phục realm/frontend URL và issuer backend về localhost cùng nhau; không để một bên public và một bên local.

Kiểm tra thực tế cần dùng OAuth code flow và cookie trên trình duyệt, mở dashboard và chờ qua các request nền/SSE. Kiểm thử chỉ gắn Bearer token vào API không đủ phát hiện lỗi issuer/callback/cookie này. Giữ xác minh issuer, token và phân quyền backend; không bỏ kiểm tra 401 để che lỗi.
