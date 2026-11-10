# OIDC không phụ thuộc Cloudflare Tunnel

Cập nhật 24/10/2026. Lỗi `UnknownHostException` khi backend tải discovery đến tên `trycloudflare.com` cũ xuất phát từ override được lưu tại `.rbac/keycloak.properties`. Tunnel đã ngừng hoạt động, nên địa chỉ đó không thể dùng làm issuer lúc khởi động.

## Chạy development

- Issuer mặc định: `http://localhost:9080/realms/jhipster`.
- Keycloak realm dev có `frontendUrl=http://localhost:9080`.
- Backend: `http://localhost:8080`; Vite: `http://localhost:9000`.
- `.rbac/keycloak.properties` giữ các secret/cấu hình quản trị có sẵn, nhưng không còn override issuer tới tunnel.
- Vite không mặc định cho phép domain Cloudflare; mặc định lắng nghe localhost. `VITE_DEV_HOST` và `VITE_ALLOWED_HOSTS` chỉ đặt khi thật sự cần môi trường dev khác.

Nếu vẫn thấy domain cũ sau khi restart, kiểm tra cả biến môi trường/Run Configuration của IDE: `APP_OIDC_ISSUER` và `SPRING_SECURITY_OAUTH2_CLIENT_PROVIDER_OIDC_ISSUER_URI`. Biến môi trường hoặc tham số `-D` có độ ưu tiên cao hơn file cấu hình. Không xóa toàn bộ `.rbac/keycloak.properties`, vì file này có thể chứa secret quản trị đang dùng.

## Triển khai trên host mới

Domain ứng dụng người dùng cung cấp: **`sunnytech.cloud`**. Tại thời điểm kiểm tra 24/10/2026, DNS từ máy làm việc trả `ENOTFOUND`, nên chưa thể xác nhận endpoint Keycloak trên domain này. Chưa đặt domain chưa sẵn sàng thành issuer bắt buộc cho development; nếu làm vậy backend sẽ tiếp tục lỗi discovery khi khởi động.

Template triển khai nằm ở [config/production.env.example](../config/production.env.example), giả định Keycloak dùng cùng domain dưới `/realms/jhipster`. Nếu Keycloak ở host/domain riêng thì cần thay issuer bằng địa chỉ thực tế của Keycloak. File template không tự được nạp và chứa placeholder secret, chưa phải cấu hình host đã triển khai.

Không dùng Vite dev server làm host production. Build frontend và dùng backend/reverse proxy trên host triển khai. Cấu hình theo domain Keycloak thực tế, ví dụ:

```text
APP_OIDC_ISSUER=https://sunnytech.cloud/realms/jhipster
SPRING_SECURITY_OAUTH2_CLIENT_PROVIDER_OIDC_ISSUER_URI=https://sunnytech.cloud/realms/jhipster
RBAC_KEYCLOAK_ISSUER_URI=http://keycloak:9080/realms/jhipster
```

Issuer public trên là ví dụ theo giả định Keycloak cùng domain, không phải cấu hình đã áp dụng. Với profile `secret-samples`, `APP_OIDC_ISSUER` được đọc từ sample. Trên production không dùng secret mẫu; cấu hình client ID/secret và issuer qua secret manager/biến môi trường của host.

Issuer trong discovery, issuer của token và issuer backend phải giống nhau. Domain issuer phải được browser và backend phân giải DNS/truy cập được. Cấu hình Keycloak hostname/frontend URL theo domain HTTPS cố định, callback client `web_app` theo `https://APP-DOMAIN/login/oauth2/code/oidc` và web origin tương ứng. Kết nối quản trị Keycloak có thể dùng URL mạng nội bộ riêng; không công khai admin routes qua frontend proxy.

Nếu dùng Docker, `localhost` bên trong container là chính container đó: đặt địa chỉ service Keycloak phù hợp cho kết nối nội bộ. Chưa cấu hình/deploy host mới vì chưa có thông tin domain/hạ tầng đích.

Bản cấu hình trước khi gỡ tunnel được lưu riêng tại `.rbac/oidc-recovery/no-tunnel-20261024/`. Không thay đổi dữ liệu dân cư, tài khoản hoặc phân quyền để sửa lỗi discovery này.
