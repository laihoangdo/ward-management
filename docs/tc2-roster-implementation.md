# Triển khai hồ sơ thật Trung Chánh 2 — 20/10/2026

> Cập nhật 27/10/2026: đã hợp nhất vào bảng lõi và bỏ mock khỏi dữ liệu nghiệp vụ. Xem [cấu trúc, hai menu, flow và recovery sau hợp nhất](luong-hop-nhat-ho-dan-nhan-khau.md). Các số liệu/mô tả cách ly bên dưới là mốc triển khai trước.

## 1. Cách sử dụng

Mở **http://localhost:9000/roster** khi đang chạy Vite, hoặc `/roster` trên server phục vụ bản build. Trong sidebar GIS có mục **Hồ sơ dân cư TC2 · nguồn thật**. Đăng nhập tài khoản được giao toàn ấp TC2; backend tiếp tục kiểm tra quyền chức năng và scope ở mỗi thao tác. Tài khoản chỉ được giao tuyến đường chưa được mở bộ nguồn khi tuyến chưa xác minh, để tránh vượt phạm vi.

Các trang:

- **Hộ & nhân khẩu:** danh sách phân trang/tìm kiếm; tạo/sửa hộ, thêm người mới hoặc người có sẵn, sửa cá nhân, sửa quan hệ hộ, bổ sung giấy tờ, thêm/sửa/gia hạn hồ sơ cư trú, ghi nhận xác minh và xem nguồn.
- **Nhập Excel / đối soát:** chọn nhiều XLSX và ấp nguồn tương ứng; kiểm tra/lưu nguồn trước, xem lỗi và áp dụng các dòng sẵn sàng. Hỗ trợ tất cả cấu trúc đã khảo sát của bốn file hiện tại; không nhận `.xls` nhị phân hoặc tự đoán cấu trúc mới.
- **Vị trí tạm:** điểm hộ/nhóm địa chỉ trong polygon TC2. Bấm điểm để mở hộ; chưa liên kết công trình.
- **Lịch sử & báo cáo:** lọc theo ngày ghi nhận tại múi giờ Việt Nam, xem trước/sau, xuất CSV tổng hợp và CSV chi tiết mở bằng Excel. Phân biệt nhập nguồn, sửa dữ liệu, bổ sung hồ sơ, gia hạn và xác minh.

Module hiện hành `/dashboard` và các entity `public.household/resident` vẫn sử dụng dữ liệu cũ. Không tự thay dữ liệu cũ hoặc trộn hai tập vào thống kê/bản đồ cũ. Vào `/roster` để làm việc với bộ thật; tích hợp liên kết khối nhà là bước riêng sau khi có vị trí đúng.

## 2. Kết quả nhập thực tế

Database local: `Monolithic`; schema mới: **`tc2_roster`**. Collection ID ban đầu: `54a50921-1bf8-422a-a792-62be6e014d32`. Bốn nguồn thuộc cùng hamlet code `27592-TRUNGCHANH-2`; các phần ấp 61/63/69 không bị hiểu là toàn bộ ấp cũ.

| Chỉ tiêu | Số lượng |
| --- | ---: |
| Dòng nghiệp vụ trong bốn file | 5.213 |
| Đã áp dụng | 5.151 |
| Chờ đối soát | 62 dòng / 31 nhóm định danh |
| Dòng phụ, tiêu đề, bản sao và tổng được giữ nguồn nhưng không nhập nghiệp vụ | 2.684 |
| Tổng dòng nguồn lưu mã hóa | 7.897 |
| Cá nhân đã tạo | 5.073 |
| Hồ sơ cư trú đã tạo | 5.150 |
| Hộ có HSCT nguồn | 752 |
| Nhóm địa chỉ/người đại diện tạm, chưa xác minh là hộ độc lập | 538 |
| Tổng hộ/nhóm địa chỉ | 1.290 |
| HSCT có tên chủ hộ nguồn bất đồng | 46 |
| Điểm nằm ngoài polygon TC2 trong lần kiểm tra | 0 |
| Dòng đã áp dụng thiếu liên kết nguồn | 0 |

Một sự kiện nguồn trùng hoàn toàn được dùng lại; hai dòng nguồn cùng được giữ, nên số record ít hơn số dòng áp dụng một. Nhiều hồ sơ cư trú dùng chung một cá nhân. Những con số này là quy mô **hồ sơ đã nhập**, chưa phải dân số đang ở thực tế đã được xác minh.

Đã nhập thử trọn bộ trên `tc2_roster_rehearsal` trước khi áp dụng vào database local. Hai bảng cũ vẫn có 1.260 hộ và 1.461 nhân khẩu; checksum nội dung hai bảng khớp bản trước nhập. Không tạo nhân khẩu giả, số điện thoại giả, quan hệ chủ hộ giả hoặc ngày nghiệp vụ bằng ngày nhập.

## 3. Các điểm phải đối soát bằng nghiệp vụ

**62 dòng / 31 nhóm:** cùng chuỗi định danh nhưng thông tin nhân thân bất đồng. Chúng nằm trong staging, có toàn bộ dữ liệu nguồn, chưa tự tạo/ghép cá nhân. Trong tab đối soát có ba quyết định:

1. **Sửa dữ liệu chuẩn hóa rồi dò lại:** nhập phần đã xác minh và lý do; giữ nguyên bản gốc.
2. **Xác nhận là cá nhân riêng:** chỉ dùng khi đã xác minh hai người khác nhau, không dùng để bỏ qua cảnh báo cho nhanh.
3. **Liên kết cá nhân đã có theo ID:** chọn đúng hồ sơ sau đối chiếu và có quyền; bản nguồn bất đồng vẫn được giữ. Có thể lấy ID từ tìm kiếm/chi tiết API trong giai đoạn vận hành hiện tại.

Sau quyết định, dòng chuyển sẵn sàng; áp dụng lại collection để hoàn tất. Không có giả định tự bù 0 đầu CCCD hoặc gộp theo tên. Nhãn định danh nguồn là chưa xác định loại/kiểm chứng; cán bộ bổ sung giấy tờ đã đối chiếu qua thao tác riêng.

**46 HSCT:** khi có nhiều tên chủ hộ nguồn, hệ thống không chọn một tên làm đúng. `representative_name` để trống và gắn `HEAD_CONFLICT`; từng tên nguồn vẫn nằm trong hồ sơ/dòng Excel gốc. Chọn chủ hộ trên membership sau xác minh; cần kết thúc vai trò chủ hộ hiện hành trước khi ghi nhận vai trò khác nếu có xung đột. Cờ chất lượng nguồn vẫn mô tả bất đồng của bản nguồn, không bị xóa chỉ vì sửa tên hiển thị.

**538 nhóm địa chỉ tạm:** được nhóm theo loại hồ sơ + địa chỉ + người đại diện từ nguồn. Chưa tự kết luận cùng nhà là cùng hộ, chưa coi tên đại diện tạm trú là chủ sở hữu nhà. Cần đối chiếu và liên kết hộ chính thức trước báo cáo số hộ thực tế.

## 4. Schema và bảo toàn dữ liệu

Các bảng triển khai: `import_collection`, `import_batch`, `import_row`, `source_link`, `review_event`, `household`, `resident`, `resident_identity`, `household_membership`, `residence_address`, `residence_record`, `residence_record_address`, `residence_verification`, `change_event`, `request_receipt`.

Khác với sơ đồ thiết kế tổng quát: thông tin phân loại nguồn hiện giữ ở `residence_record.classification_raw/housing_classification_raw`, chưa tạo danh mục phân loại chuẩn riêng. Thông tin sáp nhập giữ trong collection/batch/source row; chưa tạo quan hệ địa giới pháp lý theo ngày hiệu lực chưa được cung cấp. Các bảng mới tham chiếu hamlet hiện có, không nhân đôi địa bàn/RBAC.

Nguồn ô Excel giữ giá trị, giá trị lưu trong OOXML, kiểu, format và công thức/cache có liên quan. `raw_ciphertext` và `parsed_ciphertext` bất biến bằng trigger. Quyết định sửa sau đó lưu riêng, có actor/reason/time. Các trường ngày thiếu giữ NULL; năm sinh 1979 ở 63/C280 giữ precision YEAR; các địa chỉ có vai trò riêng và có thể nằm ngoài TC2.

Hồ sơ nghiệp vụ được audit bằng trigger PostgreSQL trong cùng giao dịch. Lưu trước/sau, actor, loại thay đổi, lý do, ngày hiệu lực nếu có và collection nếu là import. `change_event` và `review_event` chỉ append; nguồn không sửa/xóa qua API. Version kiểm tra ghi đè đồng thời; receipt chống retry tạo hộ/thành viên/hồ sơ trùng. Nguồn nhập tay dùng origin MANUAL và actor, không giả một dòng Excel.

Không có API xóa cứng nhân khẩu/hộ. Kết thúc membership/hồ sơ phải nhập mốc hiệu lực và giữ lịch sử. Sửa nhân thân dùng chung, quan hệ hộ, hồ sơ cư trú và xác minh là thao tác riêng. Các địa chỉ đã có được giữ; sửa địa chỉ record thay liên kết có audit và không xóa địa chỉ cũ.

## 5. Tọa độ tạm

`coordinate_method=RANDOM_WITHIN_TC2`. Dùng địa chỉ và khóa nhóm làm seed, cùng hash boundary để tạo điểm giả ổn định bằng rejection sampling **bên trong polygon**, có xét lỗ và MultiPolygon. Có `coordinate_seed`, `boundary_hash`; không chỉ random trong bounding box. Không ghi hoặc sửa polygon.

Đây không phải geocode và không mô tả tương quan thực tế giữa số nhà và GPS. Địa chỉ thường trú là seed của hộ thường trú; nhóm tạm trú/NOHT dùng địa chỉ nghiệp vụ tương ứng để tránh đưa vị trí ngoài TC2 vào map. Tất cả hiển thị nhãn tạm, không được dùng điểm này làm chứng cứ thực địa, thống kê phân bố thực hoặc tự liên kết khối nhà. Sửa địa chỉ không âm thầm xác nhận hay đổi điểm thành VERIFIED.

## 6. Khóa mã hóa, backup và recovery

Khóa AES-GCM/HMAC nằm tại **`.tc2-private/data.key`**, hoặc đường dẫn cấu hình `application.roster.key-file`. Không nằm trong frontend/Git. Raw nguồn, quyết định chuẩn hóa và số giấy tờ được mã hóa phía server; tra định danh dùng HMAC có khóa. Khi DB đã có nguồn mã hóa mà khóa bị thiếu, service từ chối tự sinh khóa thay thế. Lưu khóa cùng backup và giữ quyền truy cập phù hợp.

Bản trước nhập: `backups/tc2-roster-20261020/before.dump`, khóa và bốn file gốc cùng thư mục. Bản đầy đủ sau nhập: **`backups/tc2-roster-20261020-003313/`**, gồm `database.dump`, `data.key`, manifest và SHA-256. Các thư mục này và file XLSX thật được ignore trong Git.

Đã restore bản sau nhập sang **`tc2_restore_20261020_final`**, đối chiếu 5.073 cá nhân, 1.290 hộ/nhóm, 7.897 dòng nguồn và 36.498 sự kiện lịch sử tại thời điểm snapshot; giải mã được toàn bộ nguồn, điểm đều trong ranh. Chưa chuyển ứng dụng sang DB restore. Database rehearsal/validation/restore được giữ để kiểm tra, không tự xóa.

Tạo backup mới:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/tc2-roster-backup.ps1
```

Restore vào database mới, không ghi đè DB đang sử dụng:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/tc2-roster-restore.ps1 -BackupDirectory backups/tc2-roster-20261020-003313 -TargetDatabase tc2_restore_review
```

Script chỉ chấp nhận tên `tc2_restore_*` chưa tồn tại, kiểm tra checksum, không drop schema/database. Muốn mở ứng dụng trên bản phục hồi: chạy instance riêng với `spring.datasource.url` trỏ DB mới và `application.roster.key-file` trỏ khóa đúng của backup. Không đổi datasource của instance đang dùng nếu chưa đối chiếu bản phục hồi.

Giấy tờ được sửa bằng cách bổ sung giấy tờ đúng và tùy chọn kết thúc giấy tờ cũ; giữ số cũ mã hóa và lịch sử, không xóa nguồn. Các định danh đã kết thúc không tự dùng để tạo/ghép người khi nhập nguồn mới; chuyển đối soát nếu gặp lại.

Importer local có thể chạy lại cùng bốn file mà không nhân đôi:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/tc2-roster-import.ps1
```

Đợt stage và apply là hai transaction riêng: nếu apply lỗi, nguồn đã stage vẫn còn để retry; không để dữ liệu nghiệp vụ/audit tạo dở. Re-apply không tự áp dụng dòng REVIEW. Liquibase có ba changeset mới, không sửa changeset cũ đã chạy. Không hỗ trợ drop schema tự động để rollback; dùng bản phục hồi độc lập hoặc thao tác sửa bù có audit.

## 7. Báo cáo có ý nghĩa gì

Theo ngày ghi nhận tại `Asia/Ho_Chi_Minh`, báo cáo đếm quy mô registry đầu/cuối kỳ và số thay đổi theo loại/entity. Không đồng nhất số event với số người, số hồ sơ cư trú với dân số đang ở, số nhóm địa chỉ với hộ thực tế, hoặc hết hạn một hồ sơ với người đã chuyển đi. Các lỗi sửa dữ liệu và import baseline có loại riêng.

CSV chi tiết có thời điểm ghi nhận, ngày hiệu lực nếu biết, actor, loại nghiệp vụ, lý do, trước/sau; không xuất ciphertext/HMAC của định danh. Trường text được quote và phòng công thức spreadsheet khi xuất. Báo cáo chi tiết giới hạn 100.000 sự kiện/lần và dùng snapshot transaction. Không suy diễn lịch sử trước thời điểm nhập nguồn khi không có ngày nguồn/hiệu lực đã xác minh.

## 8. Kiểm chứng

- Parser kiểm tra đủ bốn file: đúng 5.213 dòng nghiệp vụ; giữ số 0 đầu, date/year precision, giới tính dạng dài và bỏ đúng bản sao/tiêu đề/dòng tổng.
- PostgreSQL riêng `tc2_roster_validation`: 11 kiểm thử gồm scope/quyền, mã hóa/khóa bị thiếu, idempotency, audit/source bất biến, rollback transaction, xung đột, version, quyết định review, sửa địa chỉ/giấy tờ có lịch sử và an toàn báo cáo spreadsheet.
- 4 kiểm thử parser và 3 kiểm thử UI; TypeScript, lint phạm vi thay đổi và production build.
- API thật bằng tài khoản OIDC tạm: danh sách/chi tiết/nguồn/history/report/map, che định danh trong danh sách và từ chối ngoài địa bàn. Không chèn fixture vào roster thật.
- Trình duyệt thật: mở route, form tạo hộ, trang import; desktop và mobile 390px, không tràn ngang. Không ghi hồ sơ thật trong smoke test UI.
- Reconciliation đọc toàn bộ nguồn mã hóa, kiểm tra từng tọa độ và so public legacy bằng checksum; phục hồi sang DB mới đã diễn tập.

Các test kiểm tra luồng sửa nghiệp vụ trên PostgreSQL fixture riêng; không thay cho việc cán bộ xác minh 31 nhóm định danh, 46 HSCT và các địa chỉ chưa đối soát. Chưa đo tải nhiều người dùng hoặc nghiệm thu mọi thao tác mobile trên thiết bị thực.
