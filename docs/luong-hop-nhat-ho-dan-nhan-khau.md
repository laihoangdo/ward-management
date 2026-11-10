# Hộ dân và nhân khẩu sau hợp nhất — 27/10/2026

## Dữ liệu và cấu trúc

`public.household` và `public.resident` là hai bảng lõi duy nhất. Giữ khóa bigint để đọc bằng API/GIS hiện có; `roster_id` UUID là định danh ổn định của hồ sơ thật. `tc2_roster.household/resident` là view cập nhật trực tiếp lên hai bảng này, không phải hai bản dữ liệu. Các bảng nguồn, giấy tờ, membership, cư trú, xác minh và lịch sử tiếp tục tham chiếu UUID, có FK tới bảng lõi.

Giữ nguyên nguồn Excel của ấp Trung Chánh 2 và các chỉnh sửa đã phát sinh. Đợt hợp nhất có 1.291 hộ/nhóm địa chỉ, 5.074 cá nhân, 10.835 dòng staging và 36.503 sự kiện lịch sử. Các số này bao gồm các bộ staging/thao tác phát sinh sau lần nhập đầu; không lấy 10.835 làm số nhân khẩu. Dòng chờ đối soát không tự chuyển thành người chuẩn. Các nhóm địa chỉ tạm không mặc nhiên là hộ thực tế.

Theo xác nhận của người dùng, 1.260 hộ và 1.461 nhân khẩu cũ là mock: đã loại khỏi hai bảng nghiệp vụ. Lưu bản phục hồi tại schema `legacy_mock_20261027`, không đưa vào API, thống kê hoặc bản đồ; trigger ngăn cập nhật/xóa nội dung bản lưu. Không xóa địa bàn, phân quyền hoặc công trình; tháo liên kết công trình tới mock nếu có, không chuyển nhầm sang hộ thật.

Backup trước hợp nhất: `backups/tc2-roster-20261027-221214/`, gồm dump toàn database và khóa mã hóa. Đã restore thử vào `tc2_restore_unify_20261027`. Không commit backup, workbook, khóa hoặc ảnh chụp chứa thông tin cá nhân vào Git.

Backup sau hợp nhất: `backups/tc2-roster-20261027-223513/`, đã restore thành công vào `tc2_restore_unified_final_20261027` với đủ 1.291 hộ/nhóm, 5.074 cá nhân, 10.835 dòng nguồn và 36.503 sự kiện. Có 1 hộ và 1 cá nhân nhập trực tiếp trong module thật từ trước đợt hợp nhất; giữ nguyên, không tự xếp chúng vào tập mock của hai bảng cũ.

## Menu Danh sách hộ dân

Giao diện chia đôi sau khi chọn hộ hoặc nhân khẩu: danh sách bên trái, thông tin và thao tác bên phải; hai khung cuộn độc lập, dòng đang xem được đánh dấu. Bấm thành viên của hộ để xem nhân khẩu trong cùng khung, dùng **Về hộ đang xem** để quay lại. **Đóng chi tiết** trả danh sách về toàn bộ chiều rộng. Trên điện thoại, chi tiết mở thành khung riêng gần toàn màn hình; đóng khung để tiếp tục danh sách. Nguồn, lịch sử, chọn hộ và chuyển hộ được hiển thị cùng vùng chi tiết.

1. Mở dashboard → **Danh sách hộ dân**. Danh sách phân trang phía server, tìm theo mã, HSCT, địa chỉ hoặc đại diện; lọc nguồn Excel/nhập trực tiếp và có/chưa có HSCT.
2. Bấm mã hộ để mở thông tin, các quan hệ thành viên hiện hành/đã kết thúc và từng dòng nguồn. Tên đại diện Excel không mặc nhiên là chủ hộ đã xác minh.
3. **Thêm hộ** → nhập địa chỉ nguyên văn, đại diện/điện thoại/HSCT nếu biết, lý do → **Xem lại** → **Lưu hồ sơ**. Không yêu cầu tạo số điện thoại giả. Hộ mới có origin MANUAL và tọa độ tạm trong TC2, chưa gắn công trình.
4. Trong hộ, tìm người bằng tên/định danh trước. **Dùng hồ sơ này** để thêm quan hệ hộ mà không tạo lại người. Nếu chưa có, chọn **Tạo người mới**, nhập nhân thân, quan hệ, ngày bắt đầu nếu biết; chỉ chọn loại hồ sơ cư trú khi có căn cứ.
5. **Sửa hộ** → sửa dữ liệu hiện hành và kết quả đối chiếu hộ, nhập lý do → xem trước/sau → lưu. Thiếu phiên bản hoặc phiên bản cũ bị từ chối; tải lại đối chiếu trước khi sửa tiếp.
6. **Sửa quan hệ** để cập nhật vai trò/chủ hộ hoặc kết thúc tham gia hộ. Không xóa người khi rời hộ. Cơ sở dữ liệu ngăn hai chủ hộ hiện hành của cùng hộ.
7. **Nguồn ban đầu** mở đúng file/sheet/dòng. **Lịch sử hộ** xem những thay đổi gắn với hộ và quan hệ/hồ sơ liên quan, phân trang 100 sự kiện.

## Menu Quản lý nhân khẩu

1. Mở dashboard → **Quản lý nhân khẩu**. Đây là danh sách cá nhân độc lập, không tạo bằng cách nhân số dòng cư trú. Tìm họ tên/định danh, lọc nguồn và loại hồ sơ; bộ lọc loại hồ sơ chỉ xác định có hồ sơ loại đó, không xác nhận đang có mặt thực tế.
2. Chọn tên để xem nhân thân, giấy tờ đang dùng/đã thay, các quan hệ hộ theo thời gian, hồ sơ cư trú, xác minh và nguồn. Số giấy tờ giữ kiểu text và số 0 đầu; chỉ trả cho người có quyền trong địa bàn.
3. **Thêm nhân khẩu** tạo người chưa gắn hộ, cần lý do; sau lưu có thể **Gắn vào hộ có sẵn** hoặc thêm hồ sơ cư trú. Nếu số định danh đang tồn tại, hệ thống yêu cầu tìm và dùng lại người đã có.
4. **Gắn vào hộ có sẵn** → tìm mã/địa chỉ/HSCT → chọn hộ → nhập quan hệ và thời điểm nếu biết → xem lại → lưu. Không tự kết thúc quan hệ hộ khác. Người có nhiều quan hệ không bị nhân đôi trong danh sách cá nhân.
5. **Chuyển sang hộ khác** trên quan hệ hiện hành → tìm/chọn hộ đích → nhập ngày chuyển, quan hệ mới và lý do → xem lại → lưu. Đóng quan hệ cũ và mở quan hệ mới trong một transaction; có lỗi thì cả hai cùng rollback. Hồ sơ đăng ký cư trú là nghiệp vụ riêng, không tự thay giấy tờ/địa chỉ đăng ký theo việc chuyển quan hệ hộ. Mốc valid_to của quan hệ cũ ghi ngày chuyển; khi làm báo cáo hiệu lực cần dùng cùng quy ước kết thúc tại mốc chuyển, không đếm hai quan hệ trong ngày đó.
6. **Sửa / kết thúc quan hệ** dùng để đổi vai trò hoặc ghi ngày rời hộ; quan hệ cũ và lịch sử vẫn được giữ.
7. **Sửa thông tin cá nhân dùng chung** cập nhật họ tên, giới tính, cha/mẹ, ngày sinh; giữ DAY/YEAR/UNKNOWN. Thông tin chỉ có năm không được biến thành ngày 01/01 hoặc tuổi chính xác.
8. **Giấy tờ / đối soát** bổ sung giấy tờ; khi sửa số sai/đổi giấy tờ, chọn giấy tờ cũ cần thay. Giấy tờ cũ được giữ ở trạng thái không còn dùng. Không tự coi định danh nguồn là CCCD đã kiểm chứng.
9. **Hồ sơ cư trú** → chọn loại và hộ liên quan nếu đã đối chiếu, nhập địa chỉ theo vai trò và các mốc thực sự biết → xem lại → lưu. Một người có nhiều hồ sơ nhưng vẫn là một cá nhân. NOHT và nguồn Đ19 được giữ riêng.
10. Trên từng hồ sơ, **Sửa / gia hạn** hoặc **Kết thúc** với lý do và ngày phù hợp. Không cập nhật hàng loạt mọi hồ sơ của người đó; không xóa hồ sơ cũ. Xem thêm trạng thái/phân loại/đại diện/thời gian nguyên bản trong phần thông tin nguồn.
11. **Ghi nhận xác minh** lưu có mặt/vắng/chưa rõ, ngày kiểm tra và lý do. Dấu X không ngày trong Excel không trở thành một lần kiểm tra có ngày tự đặt.
12. **Nguồn cá nhân** và **Lịch sử cá nhân** cho phép truy vết bản đầu và các thay đổi sau đó.

## Luồng nhập nguồn và báo cáo dùng chung

Bản đồ 3D có lớp **Hộ dân — vị trí tạm**, bật mặc định trong **Layer & bộ lọc**. Điểm cam hiển thị các tọa độ `RANDOM_WITHIN_TC2` trong phạm vi được phép xem, bấm để mở hồ sơ hộ. Lớp tách biệt điểm đã xác minh và có thể bật/tắt riêng; các điểm thiếu tọa độ hoặc chỉ dùng vị trí fallback không được đưa vào lớp này. Hộ đã liên kết công trình không hiển thị lặp ở vị trí tạm. Tọa độ random không tham gia tự nhận diện/liên kết khối nhà; cả client và API auto-link đều chặn. Gắn thủ công sau khi đối chiếu là thao tác riêng. Ảnh PNG xuất từ bản đồ ghi chú rõ điểm cam là vị trí chưa xác minh.

**Nhập Excel / đối soát** → chọn file XLSX, ấp nguồn, tên bộ → kiểm tra và lưu staging → xem lỗi/nguồn → xử lý xung đột có lý do → áp dụng dòng đủ điều kiện. Không tự áp dụng ngay khi upload. Giữ cấu trúc parser bốn file đã hỗ trợ; cấu trúc lạ phải được mapping trước.

**Lịch sử & báo cáo** → chọn khoảng ngày → xem tổng hợp và trước/sau → xuất CSV tổng hợp/chi tiết. Báo cáo hiện theo thời điểm hệ thống ghi nhận (RECORDED_AT); ngày hiệu lực được giữ riêng, chưa phải công cụ tính toàn bộ dân số cư trú tại một ngày lịch sử tùy ý. Không coi nhập baseline hoặc chuyển schema là tăng dân số thực tế. Chuyển bảng không sinh lại sự kiện baseline.

Origin EXCEL không mất đi khi sửa thủ công. Giá trị hiện hành nằm trong bảng lõi; bản Excel mã hóa bất biến nằm ở import_row; mỗi chỉnh sửa có actor/lý do/thời điểm/trước-sau trong event. Nhiều dòng nguồn có thể chứng minh cùng một người.

## Quyền, tương thích và recovery

API mới kiểm tra quyền và địa bàn cho mỗi thao tác. Tạo hộ/người/thành viên dùng `canAddHouseholds`; sửa, chuyển hộ, giấy tờ và xác minh dùng `canUpdateInspection`; xuất báo cáo dùng `canExportReports`. Phạm vi tuyến chưa xác minh vẫn bị chặn thay vì cấp toàn bộ dữ liệu TC2 cho tài khoản chỉ phụ trách tuyến.

API bigint cũ chỉ còn phục vụ đọc cho GIS. Ghi qua `/api/households` và `/api/residents` trả 409 với hướng dẫn dùng menu mới; trigger DB cũng chặn ghi không có audit actor và chặn xóa cứng. Các route entity cũ mở giao diện thống nhất. Chi tiết hộ trên bản đồ có liên kết sang hồ sơ đầy đủ. Không dùng form cũ để ghi dữ liệu thật.

Các cột FK/loại cư trú đơn trên resident chỉ là phép chiếu tương thích: chỉ gắn household_id nếu có đúng một quan hệ hộ hiện hành; nhiều loại cư trú không bị ép thành thường trú. Dân số từ GIS cũ là số người có quan hệ hộ trong phạm vi, không bao gồm mọi người chưa gắn hộ; menu nhân khẩu là nơi tra danh sách đầy đủ. Các trường giới tính/tuổi chưa biết không được suy ra bằng phép trừ để gán cho nam/người lớn.

Hai entity lõi không dùng cache Hibernate cấp hai để tránh GIS đọc dữ liệu cũ sau khi workflow JDBC cập nhật bảng chung.

Liquibase gồm hai changeset 27/10: hợp nhất lõi và bổ sung phép chiếu tương thích. Chấp nhận đúng checksum bản đầu đã được devtools local áp dụng; không bỏ kiểm tra checksum cho các migration khác. Chưa có rollback xóa dữ liệu tự động.

Để phục hồi, restore dump vào database mới bằng `scripts/tc2-roster-restore.ps1`, trỏ cấu hình tới DB mới và dùng đúng khóa. Nếu đã có thao tác mới sau cutover, cần xuất/replay delta hoặc phục hồi snapshot mới hơn; không chỉ đổi về bản trước hợp nhất rồi bỏ qua thay đổi phát sinh. Schema mock chỉ là lưu phục hồi, không được trộn trở lại dữ liệu thật.

## Kiểm tra nghiệm thu

- 28 test backend/parser/browse qua, một test workbook có điều kiện bị skip; có test PostgreSQL cho import qua view, loại mock, mã hóa, audit, chuyển hộ nguyên tử, retry và từ chối ghi ngoài workflow.
- 10 test frontend qua; TypeScript và build production qua. Lint riêng RosterPage không có lỗi, còn cảnh báo complexity; lint toàn các file GIS cũ vẫn có lỗi sẵn có về import/biến không dùng và bitwise, chưa coi là toàn repo đã sạch lint.
- Smoke test với tài khoản OIDC tạm: đọc API thật, phân trang nhân khẩu, giải mã nguồn, xuất CSV, kiểm tra phạm vi địa bàn và từ chối ghi API cũ. Không tạo/sửa hồ sơ dân cư trên database thật trong smoke test.
- Trình duyệt: mở cả hai menu trên dashboard, mở form hộ/người, tab nhập nguồn và kiểm tra chiều ngang mobile; ảnh kiểm tra chứa dữ liệu cá nhân chỉ lưu tại `.tc2-private/`.
- Checksum JSONB chuẩn hóa của toàn bộ hộ, cá nhân, dòng nguồn và event khớp trước/sau hợp nhất; không tạo lại baseline hoặc làm mất lịch sử khi đổi bảng.
