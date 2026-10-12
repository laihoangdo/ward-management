# RBAC và Keycloak: triển khai và vận hành

Cập nhật 09/10/2026. Đây là hướng dẫn sau triển khai; tài liệu đánh giá trước đây mô tả trạng thái trước khi nối API.

## Nguồn dữ liệu

**Keycloak** giữ danh tính OIDC `sub`, username, email, họ tên, mật khẩu, trạng thái khóa và realm role. **PostgreSQL** giữ hồ sơ nghiệp vụ cán bộ, ID địa bàn, tuyến đường, quyền chức năng, menu, whitelist, blacklist, nhật ký phân quyền và chủ thể phụ trách hồ sơ. LocalStorage và tài khoản mẫu không còn là nguồn cấp quyền.

`/api/rbac/me` kết hợp hai nguồn. Mỗi request được bảo vệ đọc lại role và trạng thái ở Keycloak, nên token cũ không giữ quyền đã thu hồi. Frontend làm mới mỗi 30 giây và sau khi lưu phân quyền trong cùng trang. Khi Keycloak không kết nối được, hệ thống không tự cấp quyền từ dữ liệu cục bộ.

Không có địa bàn thì không thấy dữ liệu; quyền chưa cấp mặc định false. Danh sách, tổng số, truy cập theo ID, ghi dữ liệu và CSV cùng chịu phạm vi địa bàn/tuyến. Tuyến được đối chiếu đúng tên street/alley trong DB; không dùng chuỗi gần đúng để cấp địa bàn. Để trống tuyến nghĩa là toàn bộ địa bàn đã chọn.

## Vai trò và quyền

| Realm role        | Vai trò giao diện | Thẩm quyền                                                        |
| ----------------- | ----------------- | ----------------------------------------------------------------- |
| `ROLE_USER`       | officer           | Nghiệp vụ trong địa bàn/tuyến được giao                           |
| `ROLE_SUB_ADMIN`  | sub-admin         | Phân công officer cấp dưới trong phạm vi của mình                 |
| `ROLE_ADMIN`      | admin             | Phân công sub-admin/officer cấp dưới trong phạm vi của mình       |
| `ROLE_SUPERADMIN` | superadmin        | Toàn hệ thống; tài khoản Keycloak, cấu hình truy cập, menu, audit |

Admin/sub-admin không được cấp quyền chức năng mà bản thân chưa có, cấp địa bàn/tuyến ngoài phạm vi, sửa người ngang/cao hơn hoặc tự sửa quyền mình. Tài khoản dịch vụ không được quản lý qua API cán bộ. Không xóa Super Admin qua ứng dụng.

| Quyền chức năng       | Kiểm soát                                                      |
| --------------------- | -------------------------------------------------------------- |
| `canAddHouseholds`    | Tạo hộ trong phạm vi                                           |
| `canEditCoordinates`  | Đổi tọa độ hộ                                                  |
| `canScanOcr`          | Mở OCR trên trình duyệt; lưu kết quả vẫn cần quyền ghi hồ sơ   |
| `canRenewDocs`        | Ghi/gia hạn giấy tờ thuộc phạm vi                              |
| `canExportReports`    | Xuất CSV hộ/nhân khẩu qua server; lọc phạm vi, không xuất CCCD |
| `canSendReminders`    | Lưu yêu cầu nhắc nhở vào hàng đợi pending                      |
| `canUpdateInspection` | Sửa thông tin hộ/nhân khẩu; ghi kiểm tra, cảnh báo, tuần tra   |
| `canManageStreets`    | Sửa địa bàn được giao; tạo địa bàn chỉ Super Admin             |

Xóa hồ sơ cần cấp quản lý và quyền nghiệp vụ tương ứng. Nhật ký tuần tra không được sửa/xóa. Danh tính người ghi lấy từ server. Phân công và audit nằm trong giao dịch PostgreSQL; sửa đồng thời bị chặn bằng version, trả HTTP 409.

## Thiết lập môi trường

Local đã có realm `jhipster` tại cổng 9080, bốn role, service client `rbac-admin` và tài khoản `admin` hiện hữu được bootstrap thành Super Admin. Mật khẩu hiện hữu được giữ nguyên, đăng ký vẫn tắt.

Trên môi trường mới:

1. Chạy PostgreSQL và Keycloak từ compose dự án.
2. Đăng nhập `kcadm.sh` trong container bằng quản trị viên Keycloak của môi trường đó.
3. Chạy `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-rbac.ps1 -BootstrapUser admin`, dùng username quản trị ứng dụng hiện hữu. Tham số `-Container` đổi container nếu khác local; script hiện dùng realm `jhipster`.
4. Script tạo client confidential, bật service account, cấp `manage-users`, `view-users`, `query-users`, `view-realm` của `realm-management`. Secret ghi vào `.rbac/keycloak.properties`, được gitignore và Spring import khi khởi động.
5. Khởi động backend để Liquibase tạo bảng RBAC. Production cung cấp `RBAC_KEYCLOAK_CLIENT_ID`, `RBAC_KEYCLOAK_CLIENT_SECRET` qua secret môi trường, cùng issuer OIDC đúng môi trường. Không đưa secret/token vào frontend.

Không cấp ADMIN/SUPERADMIN làm role mặc định. Tham khảo [Keycloak Server Administration Guide](https://www.keycloak.org/docs/latest/server_admin/index.html) cho role mapping, credentials và service account.

## Hướng dẫn giao diện

### Super Admin

1. Đăng nhập tài khoản bootstrap, mở **Trung tâm Quản trị Tối cao**.
2. Quản lý đơn vị: tạo/sửa địa bàn thật. Số hộ đọc từ DB; xóa địa bàn có liên kết bị khóa ngoại từ chối.
3. Quản lý tài khoản: tạo cán bộ, chọn role và ID địa bàn, nhập mật khẩu tạm ít nhất 12 ký tự. Người dùng phải đổi mật khẩu khi đăng nhập. Có thể sửa email/role, khóa/mở khóa, đặt lại mật khẩu tạm và xóa tài khoản thực trong Keycloak.
4. Mở **Phân quyền Cán bộ & CAV**, chọn cán bộ, ID địa bàn, tuyến đường nếu cần thu hẹp và quyền cần dùng; lưu.
5. Cấu hình menu thay đổi khả năng nhìn thấy menu theo role. Đây là cấu hình giao diện; quyền thao tác API và phạm vi dữ liệu được kiểm tra riêng.
6. Whitelist có công tắc bật kiểm tra email. Khi bật, tài khoản thông thường phải có email active trong danh sách; Super Admin được miễn để vận hành. Whitelist không tự tạo tài khoản, không gán role và không tự cấu hình Google SSO.
7. Blacklist chặn remote IP tại API ứng dụng. Đây không phải firewall OS hay chặn trang Keycloak. Sau reverse proxy cần cấu hình forwarding từ proxy đáng tin cậy; không tin header tùy ý do client gửi.
8. Mục an ninh có nút tải nhật ký phân quyền từ máy chủ. Cảnh báo kiểm thử được lưu như kiểm thử và hiển thị chưa gửi email.

### Admin/sub-admin

Mở menu phân quyền. Danh sách server chỉ trả cấp dưới thuộc toàn bộ phạm vi quản lý của mình. Chọn cán bộ, phân công và cấp quyền trong giới hạn hiện có. Nếu HTTP 409, tải lại dữ liệu trước khi lưu lại.

### Quản trị trực tiếp trong Keycloak

Admin Console → realm `jhipster` → Users → tài khoản → Role mapping → Assign role → chọn realm role tương ứng. Kiểm tra role kế thừa từ group/composite khi thu hồi quyền. Enabled dùng để khóa; Credentials dùng đặt mật khẩu tạm. Những thay đổi này được API đọc lại; địa bàn và quyền chức năng vẫn quản lý trong ứng dụng vì chúng nằm ở PostgreSQL.

Nếu group/composite vẫn cấp role cao hơn role chọn, API từ chối đồng bộ và giữ tài khoản khóa. Gỡ role kế thừa tại Keycloak rồi lưu lại.

Giao dịch DB không bao trùm Keycloak: ứng dụng khóa và đăng xuất trước khi đổi role/hồ sơ, chỉ mở lại khi các bước thành công. Nếu đồng bộ thất bại giữa chừng, tài khoản giữ khóa và có audit lỗi; quản trị viên kiểm tra và lưu lại. Tài khoản mới được tạo khóa trước. Lỗi version được kiểm tra trước khi thay đổi tài khoản hiện hữu.

## Hồ sơ cũ

Hộ/nhân khẩu dùng quan hệ thật `household.area_zone_id`, `resident.household_id`. Hộ chưa có địa bàn chỉ Super Admin thấy; cần gán địa bàn dựa trên thông tin thật.

Giấy tờ/cảnh báo/tuần tra cũ chưa có quan hệ địa bàn trực tiếp. Hồ sơ mới có chủ thể tạo trong `rbac_record_scope`; cấp quản lý chỉ xem khi toàn bộ địa bàn của chủ thể nằm trong phạm vi của mình. Hồ sơ cũ chưa có chủ thể chỉ Super Admin thấy. API gán chủ thể đã được phân công:

```http
PUT /api/rbac/record-scope/{document|alert|patrol}/{recordId}/{keycloakSubject}
```

Không tự suy đoán từ tên cơ sở/địa chỉ, không tự gán hồ sơ thật cho tài khoản mẫu. Đổi phân công của chủ thể có thể đổi phạm vi hồ sơ theo chủ thể; nghiệp vụ yêu cầu địa bàn lịch sử bất biến cần bổ sung quan hệ địa bàn trực tiếp vào ba loại hồ sơ này.

## API và kiểm thử

- `GET /api/rbac/me`, `/users`, `/areas`, `/audit`.
- `POST /api/rbac/users`, `DELETE /users/{id}`: tài khoản Keycloak thật.
- `PUT /api/rbac/users/{id}/delegation`: địa bàn, quyền; gửi version đang đọc.
- `GET/POST/DELETE /api/rbac/settings/{kind}`: menus, units, whitelist, blacklist, alerts; menu dùng `PUT /settings/menus`.
- `GET/PUT /api/rbac/policy`: chính sách whitelist.
- `GET /api/rbac/export/{households|residents}`: CSV phạm vi được phép, chống công thức CSV.
- `POST /api/rbac/documents/{id}/reminder`: lưu yêu cầu pending, audit phía server.

Session vẫn cần CSRF khi ghi. Token quản trị không trả về client.

Test backend: `RbacServiceTest`, `GisSecurityTest`, `SecurityUtilsUnitTest`. Test frontend: `rbacApiService.spec.ts`, `backendSession.spec.ts`. Test thật: `node scripts/test_rbac_integration.cjs`, mặc định backend cổng 8081; dùng `RBAC_TEST_URL` để đổi. Script cần CLI Keycloak đã đăng nhập, tạo fixture tiền tố UUID và dọn sau kiểm thử.

## Giới hạn còn lại

Kết quả kiểm chứng: 28 test backend và 6 test frontend đạt; build Vite đạt. Script tích hợp đạt với backend kiểm thử 8081 và backend ứng dụng 8080: tạo/xóa tài khoản, tăng/giảm role, giới hạn cấp quản lý, địa bàn/tuyến, di chuyển nhân khẩu, quyền hồ sơ giấy tờ, CSV theo phạm vi, khóa tài khoản trên token đã cấp và optimistic concurrency. Fixture hộ, nhân khẩu, giấy tờ, địa bàn được dọn sau khi chạy.

- Chưa tích hợp dịch vụ gửi email/SMS: nhắc nhở là hàng đợi pending, không tuyên bố đã giao thông báo.
- OCR chạy trong trình duyệt; backend bảo vệ lưu dữ liệu, không thể ngăn người dùng chạy OCR bên ngoài ứng dụng.
- Chưa kiểm thử trực quan bằng trình duyệt trong phiên này.
- Typecheck toàn dự án còn lỗi cũ trong các module GIS trùng lặp ngoài phạm vi RBAC; build Vite được kiểm tra riêng.
