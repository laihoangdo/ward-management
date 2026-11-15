# Trích danh sách theo hệ loại để in, nộp (GĐ6)

Các màn hình Quản lý đối tượng, Cơ sở kinh doanh & DN và Văn bản hướng dẫn CSKV đều có hai nút **In danh sách** và **Xuất Excel**. Cả hai lấy theo đúng bộ lọc đang chọn trên màn hình. Danh sách nhân khẩu vẫn dùng hộp "Xuất danh sách" đã có từ trước.

| Màn hình               | Tiêu đề bản in                                                                                                               | Cột                                                                                                                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quản lý đối tượng      | "DANH SÁCH ĐỐI TƯỢNG HỆ …" theo hệ đang chọn, hoặc "DANH SÁCH ĐỐI TƯỢNG QUẢN LÝ" khi chọn mọi hệ                             | STT, họ tên, ngày sinh, giới tính, số ĐDCN (che), số HSCT, địa chỉ, hệ, diện / nhóm, quản lý từ / đến, gọi hỏi gần nhất, hạn gọi hỏi, số tiền án / tiền sự / vi phạm, ghi chú (biểu hiện nghi vấn, TB136, cảnh báo hạn) |
| Cơ sở kinh doanh & DN  | "DANH SÁCH CƠ SỞ KINH DOANH CÓ ĐIỀU KIỆN VỀ AN NINH, TRẬT TỰ", "DANH SÁCH CƠ SỞ, DOANH NGHIỆP TRÊN ĐỊA BÀN" hoặc cả hai nhóm | STT, tên cơ sở, loại hình, ngành nghề, địa chỉ, chủ / người đại diện, điện thoại, loại / số / hạn giấy phép, số nhân viên, số vi phạm, ghi chú                                                                          |
| Văn bản hướng dẫn CSKV | "SỔ THEO DÕI VĂN BẢN HƯỚNG DẪN NGHIỆP VỤ CẢNH SÁT KHU VỰC"                                                                   | STT, số ký hiệu, cơ quan ban hành, ngày ban hành, trích yếu, ngày nhận, lĩnh vực, số bản quét, ghi chú                                                                                                                  |

Bản in và file Excel có cùng bố cục với danh sách nhân khẩu:

- Khổ A4 ngang, tên Công an xã và quốc hiệu ở đầu trang.
- Tiêu đề, phạm vi (ấp), dòng điều kiện lọc và tổng số.
- Hàng tiêu đề cột được lặp lại ở mỗi trang và có bộ lọc trong Excel.
- Cuối trang có chỗ ký cho người lập danh sách và Trưởng Công an xã, kèm giờ xuất và tên người xuất.

## API

- `GET /api/{subjects|facilities|guidance-documents}/export/print`: trả về `ListSheet` dạng JSON để dựng bản in.
- `GET /api/{subjects|facilities|guidance-documents}/export/xlsx`: trả về file Excel.

Mỗi API nhận các tham số lọc giống hệt danh sách của màn hình đó. Hai API của đối tượng và cơ sở nằm dưới đường dẫn của chính màn hình, nên `hamletId` được gửi kèm tự động như các yêu cầu khác.

## Phân quyền và an toàn

- Danh sách đối tượng và danh sách cơ sở cần quyền **`canExportReports`** (Xuất báo cáo), cùng với phạm vi ấp và quyền xem như trên màn hình.
  - Đối tượng hệ Chính trị chỉ có trong danh sách khi tài khoản có `canViewPoliticalSubjects`.
- Sổ văn bản thì mọi cán bộ đã đăng nhập đều in được.
- Số ĐDCN luôn ở dạng che. Mỗi lần in hoặc xuất Excel đều ghi `rbac_audit` (`list-export`, `list:<loại>`), kèm số dòng và điều kiện lọc.
- Mỗi danh sách tối đa 5.000 dòng. Nếu vượt quá thì dòng tổng số ghi rõ là danh sách đã bị cắt bớt.

## Mã nguồn

- Backend:
  - `service/export/ListSheet` là mô hình danh sách.
  - `ListSheetWorkbook` ghi danh sách ra file Excel.
  - `ListExportService` dựng danh sách cho từng loại.
  - `web/rest/ListExportResource` là REST API.
  - `SubjectService.all` và `FacilityService.all` dùng lại đúng truy vấn của màn hình, chỉ bỏ phân trang.
- Frontend: `roster/ListExport.tsx`, gồm `ListExportActions` (hai nút) và `ListPrintView` (dùng lại CSS bản in nhân khẩu).
