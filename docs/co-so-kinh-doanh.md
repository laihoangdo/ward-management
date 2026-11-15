# Cơ sở kinh doanh & doanh nghiệp (GĐ3)

Màn hình **Cơ sở kinh doanh & DN** (`?tab=facilities`) có hai nhóm:

- **CSKD có điều kiện:** hộ có `is_conditional = true`. Đây là ngành nghề kinh doanh có điều kiện về ANTT. Nhà trọ / cơ sở lưu trú (`BOARDING_HOUSE`) luôn thuộc nhóm này; quy tắc nằm ở server, trong `RosterService.facility`.
- **Cơ sở, DN địa bàn:** các cơ sở còn lại.

Cơ sở vẫn là **hộ trong roster**, với loại hình `BUSINESS`, `BOARDING_HOUSE`, `RELIGIOUS` hoặc `ENTERPRISE` (Doanh nghiệp, loại hình mới). Tên cơ sở, ngành nghề, loại/số/hạn giấy phép, người đại diện, SĐT và ô "ngành nghề có điều kiện" đều sửa ở form hộ trong Danh sách hộ dân. Nút "Sửa tên, ngành nghề, giấy phép" mở thẳng form đó. Mọi thay đổi vẫn đi qua luồng có kiểm toán (`change_event`).

## Hồ sơ cơ sở

| Thông tin cán bộ yêu cầu         | Nơi lưu                                                                                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tên cơ sở, loại hình, ngành nghề | `household.business_name`, `type`, `business_category`                                                                                                                                     |
| Giấy tờ liên quan                | Giấy tờ đã đăng ký ở "Quản lý giấy tờ & ANTT" (`document_record`, liên kết theo id hộ), kèm bản quét PDF đính kèm                                                                          |
| Thông tin chủ cơ sở              | Chủ hộ đã xác minh (họ tên, ngày sinh, giới tính, ĐDCN che số, nghề nghiệp); nếu chưa có thì lấy người đại diện và SĐT                                                                     |
| Nhân viên cơ sở                  | `facility_employee`: nhân khẩu trong địa bàn (liên kết `resident_id`) hoặc người ngoài, gồm họ tên, năm sinh, giới tính, ĐDCN **mã hoá**, SĐT, công việc, quê quán, ngày bắt đầu/nghỉ việc |
| Hình ảnh kèm theo                | `attachment` với owner kind `FACILITY`: ảnh JPEG/PNG (chọn được ảnh chính) và PDF (category `DOCUMENT`), tối đa 30 tệp                                                                     |
| Thời hạn giấy phép               | `household.license_expiry` (ISO). Cảnh báo khi đã hết hạn hoặc còn ≤ 30 ngày                                                                                                               |
| Lịch sử vi phạm                  | `facility_violation` (chỉ thêm): ngày, nội dung, số quyết định, cơ quan xử lý, hình thức xử lý                                                                                             |
| Lưu ý khác                       | Ghi chú của từng nhân viên / vi phạm, chú thích tệp                                                                                                                                        |

## Phân quyền

- Xem: theo phạm vi roster của ấp. Ai mở được Danh sách hộ dân thì xem được cơ sở. Mỗi lần mở hồ sơ ghi `rbac_audit` (`facility:<id>`).
- `canManageFacilities` (mới): thêm/cho nghỉ nhân viên, ghi vi phạm, tải lên/xoá giấy tờ và ảnh. Preset Cán bộ quản lý ấp và Trưởng công an xã có quyền này; Công an viên thì không. Các tài khoản đã có phải được cấp quyền thêm.
- Sửa tên, ngành nghề, giấy phép: theo quyền sửa hộ hiện có (`canUpdateInspection`).

## Thay đổi chung

- `AttachmentRecords` dùng chung cho mọi loại chủ sở hữu tệp. `ResidentPhotoService` chuyển sang dùng nó, API không đổi.
- `AttachmentGallery` (frontend) hiển thị ảnh dạng lưới và PDF dạng tệp mở ở tab mới. `ResidentPhotos` giờ chỉ là lớp bọc mỏng của nó.
- PDF được trả về với `Content-Security-Policy: sandbox` và `nosniff`.
- Loại hình `ENTERPRISE` đã được thêm vào enum Java, ràng buộc DB, bộ lọc/xuất nhân khẩu và các màn hình GIS cũ (hiển thị như "Cơ sở KD").

## Chưa làm

- Sửa / xoá dòng vi phạm, sửa thông tin nhân viên (hiện chỉ thêm và ghi nghỉ việc).
- Màn hình GIS cũ (JPA) chưa phân biệt `ENTERPRISE` với `BUSINESS` khi lưu: sửa một doanh nghiệp từ màn hình cũ sẽ ghi lại thành `BUSINESS`. Nên sửa ở Danh sách hộ dân.
- Gắn tên cơ sở lên bản đồ (GĐ4); xuất Excel / in danh sách cơ sở (GĐ6).
