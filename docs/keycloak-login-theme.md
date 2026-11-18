# Giao diện đăng nhập quản lý địa bàn

Theme `territory` kế thừa template của Keycloak, giữ nguyên form xác thực OIDC, CSRF, nút hiện mật khẩu và xử lý lỗi. Phần tùy biến gồm nền xanh đậm, biểu tượng khiên trung tính (không phải huy hiệu chính thức), tên hệ thống, form responsive và nội dung tiếng Việt.

Nguồn theme: `src/main/docker/keycloak-themes/territory/login/`. Chỉnh màu/bố cục trong `resources/css/territory.css`, biểu tượng trong `resources/img/shield.svg`, nội dung trong `messages/messages_vi.properties`, hướng dẫn hỗ trợ trong `footer.ftl`.

`src/main/docker/keycloak.yml` mount theme vào `/opt/keycloak/themes/territory`. File `realm-config/jhipster-realm.json` chọn theme, mặc định tiếng Việt và đặt `registrationAllowed: false`. Chức năng tự đăng ký bị tắt tại server, không chỉ ẩn liên kết.

## Realm đã tồn tại

Keycloak `--import-realm` bỏ qua realm đã tồn tại. Vì vậy thay đổi file import chưa đủ để cập nhật môi trường đang chạy. File `src/main/docker/keycloak-theme-settings.json` là bản cập nhật nhỏ, chỉ chứa cấu hình theme/ngôn ngữ/đăng ký; đặt ngoài thư mục import để không bị hiểu là realm riêng.

Từ thư mục gốc dự án, với container development mặc định:

```powershell
docker cp src/main/docker/keycloak-themes/territory monolithic-keycloak-1:/opt/keycloak/themes/territory
docker cp src/main/docker/keycloak-theme-settings.json monolithic-keycloak-1:/tmp/territory-login-settings.json
docker exec monolithic-keycloak-1 sh -c '/opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:9080 --realm master --user "$KC_BOOTSTRAP_ADMIN_USERNAME" --password "$KC_BOOTSTRAP_ADMIN_PASSWORD"'
docker exec monolithic-keycloak-1 /opt/keycloak/bin/kcadm.sh update realms/jhipster -f /tmp/territory-login-settings.json
docker exec monolithic-keycloak-1 /opt/keycloak/bin/kcadm.sh get realms/jhipster --fields realm,loginTheme,registrationAllowed,defaultLocale,supportedLocales
```

Nếu tài khoản quản trị hiện tại đã đổi so với biến bootstrap, đăng nhập bằng tài khoản quản trị hiện hành hoặc chỉnh trong Admin Console: Realm Settings → Themes/Localization và Login → User registration. Không ghi mật khẩu vào repository.

Lần triển khai ngày 09/10/2026 đã sao chép theme và cập nhật realm trực tiếp trong container đang chạy; không tạo lại container, xóa realm hoặc thay tài khoản. Mount Compose sẽ có hiệu lực khi container được tạo lại theo cấu hình mới. Không tạo lại container chỉ để nhận mount khi chưa có phương án giữ dữ liệu: cấu hình hiện tại dùng `dev-file` và chưa khai báo volume lưu database Keycloak.

## Kiểm tra

- Trang OIDC trả HTTP 200, `lang="vi"`, đúng nhãn tiếng Việt và không có liên kết đăng ký.
- CSS, biểu tượng và tài nguyên kế thừa trả HTTP thành công.
- Gửi thông tin đăng nhập không hợp lệ nhận lỗi tiếng Việt.
- Endpoint `/realms/jhipster/protocol/openid-connect/registrations` từ chối đăng ký với HTTP 400 và thông báo tiếng Việt.
- `docker compose -f src/main/docker/keycloak.yml config --quiet` kiểm tra cấu hình Compose.

Các kiểm tra HTTP trên đã thực hiện với Keycloak đang chạy. Chưa kiểm tra trực quan desktop/mobile hoặc đăng nhập thành công xuyên suốt ứng dụng trong lần thay đổi này vì không có trình duyệt kết nối. Mở lại luồng đăng nhập từ `/dashboard` để kiểm tra giao diện; nếu trình duyệt giữ CSS cũ, dùng Ctrl+F5.

Khi nâng phiên bản Keycloak, kiểm tra lại selectors CSS, footer và các khóa thông báo. Tài liệu tham chiếu: [Themes](https://www.keycloak.org/ui-customization/themes), [Localization](https://www.keycloak.org/ui-customization/localization).
