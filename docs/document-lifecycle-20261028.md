# Hồ sơ có thời hạn — đối chiếu, đăng ký và gia hạn

**Lưu ý lưu trữ:** các backup trung gian của đợt này đã được thay bằng checkpoint trước cutover và backup PostGIS đã kiểm chứng; xem [biên bản dọn dẹp](cleanup-20261029.md) trước phục hồi.

## Đã triển khai

Changeset `20261028010000-1` bổ sung vào `document_record`:

- `household_id`: FK tới hộ/cơ sở đang quản lý, do người dùng chọn rõ ràng.
- `expiry_on`, `issued_on`: kiểu `date`. Ngày cấp chưa biết được để trống.
- `document_number`, `issuing_authority`: số giấy tờ/cơ quan cấp nếu đã có căn cứ.
- `verified_by`, `verified_at`, `version`: cán bộ xác nhận, thời điểm hệ thống và phiên bản chống ghi đè.

Giữ nguyên `expiry_date`, tên hộ, địa chỉ, trạng thái và các trường nguồn cũ. Không tự parse ngày nguyên văn, gán hộ theo tên/địa chỉ hoặc coi status cũ là kết luận hợp lệ. Tám hồ sơ hiện có vẫn chưa được xác nhận sau migration; không tạo lịch sử nghiệp vụ giả khi thêm cột.

`document_record_history` giữ trước/sau, operation, actor, reason, request ID/hash và thời gian do DB ghi trong cùng transaction. Trigger chặn ghi thiếu audit, sửa nguồn cũ, xóa hồ sơ và sửa/xóa/truncate lịch sử. Runtime chỉ được SELECT/INSERT trên lịch sử, không có quyền UPDATE/DELETE. Đây không phải chữ ký số hay cơ chế chống DBA can thiệp.

Một hộ/cơ sở có thể có nhiều hồ sơ, mỗi hồ sơ có lịch sử riêng. Chưa tách cơ sở kinh doanh khỏi bảng hộ/cơ sở hiện hành.

## Giao diện

Vào dashboard → **Hồ sơ & giấy tờ**:

1. **Thêm hồ sơ**: nhập tên, loại, tìm hộ theo mã/địa chỉ và chọn đúng hộ; nhập ngày hết hạn, lý do/căn cứ. Số giấy tờ, cơ quan cấp và ngày cấp chưa biết có thể để trống.
2. **Đối chiếu**: áp dụng cho nguồn cũ chưa xác nhận. Hiển thị riêng ngày nguyên văn, không tự điền thành ngày đã kiểm chứng. Cho phép xác nhận ngày trong quá khứ và hiển thị hồ sơ đã hết hạn.
3. **Gia hạn**: ngày mới phải sau hạn đã xác nhận và không trước hôm nay theo `Asia/Ho_Chi_Minh`. Không tự chuyển giấy phép đã xác nhận sang hộ khác.
4. **Lịch sử**: xem đăng ký/đối chiếu/gia hạn theo trang, gồm hạn trước/sau, số giấy tờ, cơ quan cấp, actor và lý do.

Ngày hết hạn được hiểu là còn hiệu lực hết ngày đó. Trạng thái tính từ ngày đã xác nhận theo ngày lịch Việt Nam: quá hạn, trong 30 ngày tới, hợp lệ; thiếu ngày/hộ thì **chưa đối chiếu**, không mặc định hợp lệ. Đã bỏ các ngày 01/01 và địa bàn mặc định giả từ mapper GIS.

Đây là luồng **hồ sơ có thời hạn xác định**. Không nhập một ngày giả cho giấy tờ không quy định hạn hoặc chưa biết hạn. Phân loại riêng `không thời hạn`, sửa sai sau xác nhận, thu hồi/hủy và phê duyệt pháp lý là các bước còn phải thiết kế; chưa coi màn hình này là toàn bộ quy trình cấp phép. Không tự gỡ cảnh báo an ninh của hộ chỉ vì gia hạn một giấy tờ.

## API và quyền

- `GET /api/document-records`, `/{id}`, `/count`: tương thích đọc, DTO có thêm các trường chuẩn hóa. Các trường nguồn cũ vẫn là nguồn; client không được dùng chúng thay ngày đã xác nhận.
- POST/PUT/PATCH/DELETE CRUD cũ bị từ chối với 409 và hướng dẫn dùng workflow mới. Các form entity JHipster cũ không còn là đường ghi hồ sơ.
- `POST /api/legal-documents`: đăng ký hồ sơ mới.
- `POST /api/legal-documents/{id}/confirm-or-renew`: đối chiếu lần đầu hoặc gia hạn.
- `GET /api/legal-documents/{id}/history?page=0`: 50 sự kiện/trang, kiểm tra phạm vi trước đọc.

Payload ghi:

```json
{
  "requestId": "<UUID mới cho một nội dung thao tác>",
  "version": 0,
  "householdId": 123,
  "expiryOn": "2027-10-28",
  "issuedOn": null,
  "documentNumber": "",
  "issuingAuthority": "",
  "reason": "Căn cứ đã kiểm tra",
  "docName": "Tên hồ sơ — bắt buộc khi đăng ký",
  "docType": "Loại hồ sơ — bắt buộc khi đăng ký"
}
```

`householdId=123` chỉ là ví dụ, không được tạo/liên kết tự động. `version` bắt buộc đúng phiên bản khi đối chiếu/gia hạn. Gửi lại cùng request ID/actor/nội dung trả cùng kết quả, không ghi thêm event; dùng lại mã với nội dung khác trả 409. Khóa transaction theo request ID và khóa hàng ngăn ghi đồng thời/trùng retry. Giao diện giữ request ID khi thử lại nội dung không đổi.

Mọi ghi cần `canRenewDocs`; cần quyền hồ sơ theo chính sách record scope hiện hành và quyền hộ theo ấp/tuyến. Việc sở hữu hồ sơ không vượt được giới hạn hộ liên kết. List/count JPA cũng lọc thêm phạm vi hộ, không chỉ chi tiết và mutation. Nhắc nhở tiếp tục cần `canSendReminders`, là yêu cầu chờ xử lý chứ không xác nhận đã gửi email/SMS.

## Bảo toàn và kiểm tra

- Backup trước thay đổi: `backups/tc2-roster-20261028-233104/`.
- Backup sau triển khai: `backups/tc2-roster-20261028-234903/`.
- Restore rehearsal: `tc2_restore_documents_20261028`, không ghi fixture vào DB chính.
- Trên bản sao: kiểm tra đăng ký/gia hạn, retry, xung đột phiên bản, bất biến nguồn và từ chối ghi/xóa SQL ngoài workflow. Fixture rollback sau mỗi test.
- Fingerprint toàn bộ hộ, cá nhân, dòng nguồn, sự kiện cư trú và hồ sơ cũ khớp giữa DB chính và bản sao sau migration/test. Giữ nguyên 1.291 hộ/nhóm, 5.074 cá nhân, 10.835 dòng nguồn và 36.503 sự kiện cư trú. DB chính không có event hồ sơ thử.
- Nhóm mục tiêu backend: **15 test đạt**, gồm 3 test PostgreSQL thật trên bản sao. Log `target/document-lifecycle-backend-tests.log`.
- Frontend mục tiêu: **15 test đạt**; TypeScript và production build đạt. ESLint nhóm file chức năng mới không có error/warning. Các log tương ứng trong `target/document-lifecycle-*`.
- Toàn bộ backend unit đã được chạy thêm: **202 test, 1 failure, 14 skip**. Failure ở `LoggingAspectTest.logAroundLogsEnterAndExit`: test đòi log Exit, trong khi `LoggingAspect.logExit` hiện đang comment lệnh log. Hai file này không được thay trong đợt này; không bật lại log dữ liệu hồ sơ chỉ để test xanh. Không coi toàn repository sạch test.
- Chưa nghiệm thu browser có đăng nhập trên mọi vai trò, chưa chạy toàn bộ generated integration tests `*IT`. Các test CRUD entity cũ cần được chuyển sang hợp đồng read-only/workflow mới trước khi dùng làm bằng chứng release.

Chạy lại nhóm DB test chỉ với database restore:

```powershell
$env:RUN_DOCUMENT_DB_TESTS = 'true'
$env:DOCUMENT_TEST_DATABASE = 'tc2_restore_documents_20261028'
.\mvnw.cmd '-Dskip.installnodenpm' '-Dskip.npm' '-Dmaven.compiler.useIncrementalCompilation=false' '-Dtest=DocumentLifecycleServiceTest,DocumentLifecyclePostgresTest,DocumentLegacyWriteTest,DocumentHouseholdScopeTest,DocumentRecordMapperTest,RuntimeDatabaseConfigurationTest' test
```

BE đang vận hành bằng `police_runtime`; chạy lại bằng `scripts/start-backend-runtime.ps1`. Không chạy test Maven đồng thời với quá trình Maven đang biên dịch server. Script dùng `useIncrementalCompilation=false` để tránh lỗi class output thiếu đã gặp với toolchain Java 23 local; Java target của dự án vẫn là 21.

## Chưa triển khai tiếp

Chuyển địa bàn liên ấp, bàn giao/phân quyền theo hiệu lực, phân biệt giấy tờ không thời hạn và chưa biết hạn, sửa sai/thu hồi có kiểm soát và chuẩn hóa `household.license_expiry`/`last_checked_date` vẫn là các đợt riêng. PostGIS đã được [triển khai riêng ngày 29/10](postgis-deployment-20261029.md). Không bỏ FK phạm vi hoặc đổi image PostgreSQL trực tiếp để làm nhanh các phần còn lại.
