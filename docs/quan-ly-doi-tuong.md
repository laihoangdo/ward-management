# Quản lý đối tượng (GĐ2)

Màn hình **Quản lý đối tượng** (`?tab=subjects`) quản lý đối tượng trong ấp đang chọn, theo 6 hệ trong danh mục cán bộ đưa:

| Mã   | Hệ                     | Thông tin riêng                                     |
| ---- | ---------------------- | --------------------------------------------------- |
| AN   | An ninh                | Chỉ ghi **vi phạm**                                 |
| CT   | Chính trị              | Tiền án, tiền sự, vi phạm. Cần quyền riêng          |
| HS   | Hình sự                | Tiền án, tiền sự, vi phạm, thời hạn quản lý         |
| MT   | Ma túy                 | Như HS                                              |
| TNXH | Tệ nạn xã hội          | Như HS                                              |
| NV   | Cần theo dõi, nghi vấn | Biểu hiện nghi vấn, diện TB136. Chỉ ghi **vi phạm** |

## Dữ liệu

- `subject`: mỗi nhân khẩu có tối đa một dòng **đang quản lý** cho mỗi hệ (unique index một phần). Bảng ghi ngày đưa vào quản lý, thời hạn quản lý (không bắt buộc), chu kỳ gọi hỏi 1–12 tháng, hệ/loại ghi rõ, lưu ý khác, trạng thái `ACTIVE`/`ENDED`, ngày và lý do kết thúc, và `version` để chống ghi đè đồng thời.
- `subject_record`: tiền án / tiền sự / vi phạm, gồm ngày, số bản án/quyết định, cơ quan xử lý, tội danh/hành vi, hình phạt. Bảng này chỉ thêm, không sửa, không xoá.
- `subject_summon`: các lần gọi hỏi, răn đe, gồm ngày, cán bộ, nội dung, kết quả. Bảng này chỉ thêm.
- Họ tên, ngày sinh, giới tính, ĐDCN (che số), HSCT, địa chỉ, nghề nghiệp và **hình ảnh** đều đọc từ hồ sơ nhân khẩu (GĐ1), không sao chép sang bảng đối tượng.

## Cảnh báo

- **Hết hạn quản lý:** `managed_until` còn ≤ 30 ngày thì báo "Sắp hết hạn quản lý"; đã qua ngày thì báo "Quá hạn quản lý".
- **Gọi hỏi:** hạn tiếp theo = ngày gọi hỏi gần nhất (nếu chưa gọi lần nào thì lấy ngày đưa vào quản lý) + chu kỳ tháng. Còn ≤ 7 ngày thì báo "Sắp đến hạn"; đã qua thì báo "Quá hạn gọi hỏi".
- Đối tượng đã kết thúc quản lý không bị cảnh báo. Hằng số nằm trong `SubjectService` (`MANAGEMENT_WARNING_DAYS`, `SUMMON_WARNING_DAYS`).

## Phân quyền

- `canViewSubjects`: xem danh sách và hồ sơ (trừ hệ CT).
- `canManageSubjects`: đưa vào diện, sửa, ghi tiền án/tiền sự/vi phạm/gọi hỏi, kết thúc quản lý. Có quyền này thì cũng được xem.
- `canViewPoliticalSubjects`: xem và cập nhật hệ CT. Không có quyền này thì hệ CT bị loại khỏi mọi danh sách và số đếm, còn mở hồ sơ CT trả 404.
- Preset: Cán bộ quản lý ấp có sẵn `canViewSubjects` + `canManageSubjects`; Trưởng công an xã có cả ba quyền; Công an viên không có quyền nào. **Các tài khoản đã tạo trước đây chưa có các quyền này**, cấp trên phải cấp tại "Phân quyền Cán bộ & CAV".
- Mọi thao tác đều kiểm tra địa bàn của ấp (`RosterService.authorize`). Mỗi lần mở hồ sơ và mỗi thay đổi đều ghi `rbac_audit` với target `subject:<id>`.

## API

`/api/subjects` (danh sách, lọc `category`, `status`, `due=MANAGEMENT|SUMMON`, `search`, `residentId`, `page`), `/summary`, `/{id}`, `POST /`, `PUT /{id}`, `POST /{id}/end`, `/{id}/records`, `/{id}/summons`. Tham số `hamletId` được interceptor dùng chung (`roster/hamletScope.ts`) tự gắn vào mọi request.

## Chưa làm trong GĐ2

- Sửa hoặc xoá một dòng tiền án/tiền sự/gọi hỏi đã ghi (hiện chỉ thêm được).
- Đưa cảnh báo đối tượng vào chuông thông báo trên header.
- Xuất danh sách Excel và bản in A4 theo từng hệ (để GĐ6).
