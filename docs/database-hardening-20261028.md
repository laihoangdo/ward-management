# Củng cố database — đợt 1, 28/10/2026

**Lưu ý lưu trữ:** một số backup trung gian được nhắc bên dưới đã được dọn sau khi có checkpoint thay thế. Xem [danh sách backup còn giữ](cleanup-20261029.md) trước phục hồi.

## Phạm vi đã triển khai

Không thay mô hình danh tính/địa bàn hoặc suy diễn dữ liệu chưa xác minh trong đợt này.

- Changeset `20261028000000-1` chạy trong một transaction, khóa ghi công trình khi đối soát.
- Tháo **552** liên kết tới hộ mock lưu tại `legacy_mock_20261027`, trên **385** công trình. Giữ nguyên liên kết hộ thật, geometry và thuộc tính khác. ID treo không thuộc kho mock sẽ làm migration thất bại để chờ đối soát, không bị tự xóa.
- `database_repair.field_building_snapshot` giữ nguyên JSON trước sửa; `integrity_summary` ghi số lượng/lý do/thời điểm. Runtime không có quyền truy cập schema này. Snapshot có trigger chặn sửa, xóa và truncate. Đây vẫn là dữ liệu riêng tư, không xuất vào Git.
- `gis_field_building_household` là phép chiếu quan hệ của `householdIds` trong JSON, được trigger cập nhật trong cùng transaction khi lưu feature. FK ngăn hộ không tồn tại; unique giữ quy tắc API hiện tại: một hộ không gắn đồng thời hai công trình. Một công trình có thể gắn nhiều hộ. Không ghi trực tiếp vào bảng chiếu; endpoint hiện tại vẫn tương thích.
- `household.hamlet_id` bắt buộc có giá trị. CHECK ngày sinh chặn trường hợp DAY thiếu năm vốn có thể lọt qua CHECK do SQL NULL.
- Bổ sung index tra membership theo người/thời hạn, hồ sơ cư trú theo hộ/loại/thời hạn và cá nhân theo ấp/ID. Chưa xóa index cũ.
- Role `police_runtime` không có superuser, tạo database/role, bypass RLS, tạo bảng ứng dụng, sửa migration hoặc sửa/xóa lịch sử cư trú. Không có quyền đọc schema mock/snapshot. Quyền người dùng vẫn do backend/RBAC thực thi, **không phải RLS**.
- Profile `db-runtime` tắt Liquibase và Docker Compose service connection. Service connection Docker có thể ghi đè datasource properties bằng tài khoản admin; không được bật ở profile này. PostgreSQL/Keycloak phải được khởi động riêng.
- `RuntimeDatabaseConfiguration` kiểm tra kết nối thực tế khi khởi động; từ chối chạy nếu không phải role hạn chế hoặc Liquibase còn bật. Không chỉ kiểm tra tên username trong file.

## Backup và bằng chứng

- Backup trước sửa: `backups/tc2-roster-20261028-231717/` gồm dump và khóa mã hóa, checksum trong manifest.
- Đã restore thử vào database riêng `tc2_restore_hardening_20261028` trước áp dụng trên DB chính.
- Đã so fingerprint JSONB có thứ tự của toàn bộ hộ, cá nhân, dòng nguồn và event giữa bản sao đã migration và DB chính; nội dung khớp. Không coi baseline/chuyển schema/sửa liên kết là biến động dân số.
- Giữ nguyên **1.291 hộ/nhóm địa chỉ**, **5.074 cá nhân**, **10.835 dòng nguồn**, **36.503 event**.
- Kiểm thử PostgreSQL trên bản sao: không còn ID treo; JSON khớp bảng chiếu; chặn liên kết treo/trùng; unlink/relink đồng bộ; snapshot bất biến; chặn ngày sinh thiếu năm. Test ghi đều rollback.
- Kiểm tra role trên bản sao: thao tác đọc/trigger cập nhật được, không có quyền DDL/archive/sửa lịch sử. Tạo role thử cũng rollback trước khi provision role thật.
- Nhóm backend mục tiêu: **37 test được báo cáo, 36 đạt, 1 skip có điều kiện**, không failure/error. Log `target/database-hardening-tests.log`. Không phải nghiệm thu toàn bộ ứng dụng hay toàn bộ vai trò bằng trình duyệt.

## Chạy BE với role hạn chế

Các dịch vụ PostgreSQL và Keycloak phải đang chạy. Không dùng role runtime để chạy Liquibase.

Máy đã provision:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/start-backend-runtime.ps1
```

Máy mới, **sau khi migration đã được áp dụng và kiểm tra bằng tài khoản quản trị**:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/setup-database-runtime.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/start-backend-runtime.ps1
```

Mật khẩu ngẫu nhiên được lưu vào `.rbac/database-runtime.properties`, đã bị Git bỏ qua và có ACL chỉ cho tài khoản Windows hiện tại. Không hiển thị mật khẩu trong log hoặc truyền vào đối số tiến trình. Script từ chối ghi đè file hoặc role có sẵn; việc xoay khóa/cấp quyền lại phải được thực hiện có chủ đích. Không cấp tự động quyền cho bảng mới trong tương lai: review migration và grant riêng.

Lệnh backend cũ không có `db-runtime` vẫn là luồng cấu hình phát triển/migration, **không phải lệnh vận hành quyền hạn chế**. Production dùng `prod,db-runtime` với URL/credentials riêng, không lấy secret mẫu làm cấu hình triển khai.

Kiểm tra kết nối thực tế bằng tài khoản DBA, không cần đọc hồ sơ cá nhân:

```sql
SELECT usename, application_name, count(*)
FROM pg_stat_activity WHERE datname = current_database()
GROUP BY 1,2;
```

## Phục hồi

Ưu tiên restore dump vào **database mới** bằng `scripts/tc2-roster-restore.ps1`, không đè database đang dùng. Giữ đúng khóa và kiểm tra toàn vẹn trước đổi datasource. Role PostgreSQL là đối tượng toàn cluster, không nằm trong dump database: khi restore sang DB mới cần DBA review/cấp quyền cho role hiện có và trỏ URL đúng DB mới; không chạy script tạo role để ghi đè mật khẩu.

Snapshot công trình là bằng chứng trước sửa, không phải lệnh hoàn tác tự động. Khôi phục nguyên JSON chứa ID mock vào DB đã hardening sẽ bị FK chặn; nếu cần phục hồi trạng thái cũ phải dùng bản restore cô lập. Không vô hiệu hóa trigger hoặc nhập lại mock vào dữ liệu nghiệp vụ. Nếu có thao tác mới sau backup, phải đối soát/replay delta trước cutover.

## Các giai đoạn tiếp theo và tiến độ

### 2. Danh tính cá nhân và chuyển địa bàn

Hiện `RosterService.hamlet()` còn cố định TC2; FK ghép người/hộ yêu cầu cùng ấp. Không đơn giản bỏ FK hoặc nới RBAC. Cần đồng thời:

1. Tách danh tính cá nhân ổn định khỏi quan hệ phạm vi quản lý có `valid_from/valid_to`; giữ lịch sử ấp nguồn.
2. Luồng bàn giao giữa ấp, yêu cầu quyền với cả nguồn và đích, có lý do/actor/version và transaction nguyên tử.
3. Truy vấn từng API theo phạm vi có hiệu lực; người ngoài phạm vi không đọc được hồ sơ hộ/cư trú nguồn chỉ vì biết UUID.
4. Test gọi API trực tiếp, chuyển/thu hồi phân công, giao thoa nhiều phạm vi, chuyển trong cùng ngày và báo cáo lịch sử. Thống nhất khoảng hiệu lực `[valid_from, valid_to)` cho membership; ngày hết hạn giấy phép có thể là ngày bao gồm, không gộp hai quy ước.

### 3. Hồ sơ pháp lý và cơ sở kinh doanh

Đã triển khai tiếp phần hồ sơ **có thời hạn xác định**: FK hộ/cơ sở, ngày kiểu `date`, nguồn bất biến, lịch sử, version/retry và giao diện đăng ký–đối chiếu–gia hạn. Xem [phạm vi, kiểm thử và giới hạn](document-lifecycle-20261028.md). Chưa coi là toàn bộ quy trình pháp lý; giấy tờ không thời hạn, sửa sai/thu hồi và các cột giấy phép/ngày kiểm tra cũ trên hộ vẫn cần đợt riêng.

### 4. PostGIS và dữ liệu đã xác minh

Đã triển khai ngày 29/10/2026 trên cluster/volume mới, có extension, geometry 4326/GiST, quyền vùng kép và backup đã restore kiểm tra. Xem [biên bản triển khai PostGIS](postgis-deployment-20261029.md). Không đổi image volume PostgreSQL cũ trực tiếp hoặc coi b-tree kinh/vĩ độ là spatial index.

Vẫn còn 1.291 tọa độ ngẫu nhiên, 46 nhóm có HEAD_CONFLICT, 69 người có nhiều quan hệ hộ và 124 dòng REVIEW. Giữ trạng thái chưa xác minh, không tự chọn chủ hộ, chuẩn hóa vị trí hoặc tạo ngày bắt đầu cư trú. Các hạng mục này cần cán bộ đối soát thực địa/giấy tờ, không thể giải quyết bằng migration kỹ thuật.
