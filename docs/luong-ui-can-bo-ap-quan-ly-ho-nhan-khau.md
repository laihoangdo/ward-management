# Luồng UI đề xuất: cán bộ ấp quản lý hộ và nhân khẩu

> Cập nhật 20/10/2026: module thực tế nằm tại `/roster`; xem [phạm vi đã triển khai và hướng dẫn vận hành](tc2-roster-implementation.md). Tài liệu này giữ mô tả luồng mục tiêu; các thao tác bàn giao liên địa bàn và quy trình xác minh nghiệp vụ cần được chốt riêng trước mở rộng.

Đây là thiết kế trải nghiệm mục tiêu theo mô hình database TC2 mới, không phải xác nhận mọi màn hình đã có trong ứng dụng. Các ví dụ dùng dữ liệu minh họa, không lấy thông tin cá nhân từ Excel. Màn hình nghiệp vụ không hiển thị tên bảng/FK cho cán bộ.

## 1. Điểm bắt đầu chung

Đăng nhập → **Địa bàn được phân công → Hộ dân**. Cán bộ chỉ tra cứu/thao tác trong scope được cấp. Với cán bộ chỉ được giao TC2, hiển thị “Địa bàn: Trung Chánh 2”, không cần dropdown một lựa chọn. Không đưa 61/62/63/69 thành bốn địa bàn hiện hành; thông tin nguồn cũ nằm ở phần nguồn dữ liệu khi có.

Danh sách hiển thị: mã hộ, số HSCT nếu có, tên chủ hộ/người đại diện, địa chỉ, số thành viên theo định nghĩa rõ, mức xác minh và ngày cập nhật. Thanh tìm kiếm cho mã hộ, HSCT, tên hoặc địa chỉ; tra định danh là thao tác có quyền riêng, không hiển thị định danh đầy đủ trong danh sách.

Các thao tác chính: **Thêm hộ dân**, mở một hộ, **Thêm nhân khẩu**, **Sửa thông tin hộ**. Trong chi tiết hộ có các tab **Thông tin hộ – Thành viên – Lịch sử thay đổi**. Mỗi người có chi tiết **Cá nhân – Cư trú – Lịch sử thành viên – Xác minh**.

Trước mỗi lần lưu, backend kiểm tra lại quyền; menu/địa bàn đang hiển thị không thay thế kiểm tra quyền. Không nhập dữ liệu cá nhân vào bản nháp localStorage. Hủy hoặc rời trang khi chưa lưu có lựa chọn tiếp tục sửa hoặc bỏ thay đổi.

## 2. Luồng A — Nhập một hộ dân mới

### Bước 1: Kiểm tra hộ đã có

Từ danh sách bấm **Thêm hộ dân**. Màn hình “Kiểm tra hộ đã tồn tại” yêu cầu địa chỉ hoặc HSCT nếu có; tên chủ hộ là thông tin bổ sung. Bấm **Tìm hộ tương tự**.

- Có hộ trùng chắc chắn: **Mở hộ hiện có** để bổ sung, không tạo bản sao.
- Chỉ giống địa chỉ: hiển thị ứng viên. Có thể là nhiều hộ cùng nhà; cán bộ chọn đúng hộ hoặc **Tạo hộ khác tại địa chỉ này**, ghi lý do khi có ứng viên đáng ngờ.
- Không thấy hoặc dữ liệu chưa đủ kết luận: tiếp tục tạo; hệ thống kiểm tra lại khi lưu để tránh hai người tạo đồng thời.

### Bước 2: Nhập thông tin hộ

Form “Thông tin hộ” gồm địa bàn TC2 cố định theo scope, địa chỉ nguyên bản, các thành phần địa chỉ nếu đã biết, HSCT không bắt buộc, số điện thoại không bắt buộc, tên chủ hộ/người đại diện nếu biết. Mã hộ nội bộ do hệ thống sinh. Với hồ sơ thiếu thông tin tối thiểu, cho lưu nháp phía server có quyền truy cập riêng; chưa đưa vào thống kê chính thức.

Địa chỉ không bắt buộc có đường khi nguồn chỉ ghi số nhà/ấp. Không nhập số điện thoại, quan hệ hoặc tọa độ giả để vượt validation. Bản đồ có thể dùng **Chọn vị trí sau**; điểm chưa xác minh không được trình bày như GPS đã khảo sát. Không tự gắn vào công trình gần nhất.

### Bước 3: Thêm chủ hộ và các thành viên

Bấm **Thêm thành viên**. Mỗi người đi qua luồng tìm định danh/người hiện có ở luồng B trước khi tạo cá nhân mới. Nếu chủ hộ là thành viên thực sự của hộ, chọn **Là chủ hộ** trên thành viên đã chọn. Nếu nguồn chỉ có tên người đại diện, giữ tên đại diện và trạng thái “Chưa xác minh”, không tạo cá nhân hoặc quan hệ chủ hộ giả.

Mỗi thành viên nhập tên, ngày sinh đầy đủ hoặc **Chỉ biết năm sinh**, giới tính, giấy tờ nếu có; quan hệ với chủ hộ có thể “Chưa rõ”. Chọn loại hồ sơ cư trú và địa chỉ liên quan, ngày đăng ký/hiệu lực nếu biết. Dấu thực tế cư trú có ba lựa chọn “Đang cư trú / Không cư trú / Chưa xác minh”, kèm nguồn/ngày xác minh khi thực sự có.

Có thể thêm nhiều người trước khi lưu, hoặc tạo hộ trước rồi thêm người sau. Hộ chưa có thành viên phải hiển thị “Chưa nhập thành viên”, không suy ra hộ không có người.

### Bước 4: Xem lại

Màn hình “Kiểm tra trước khi lưu” gồm thông tin hộ, người được chọn làm chủ hộ/đại diện, các thành viên và hồ sơ cư trú, trường còn thiếu, ứng viên trùng chưa xử lý. Nút chính **Lưu hộ và thành viên**; nút phụ **Quay lại sửa**. Không bắt cán bộ phê duyệt riêng từng bảng database.

Lỗi bắt buộc chặn lưu chính thức và trỏ tới trường cần sửa. Vấn đề chưa xác minh có thể chuyển nháp nếu chính sách cho phép; không tự đánh VERIFIED. Các hồ sơ đã đầy đủ có thể lưu ngay, không mặc định thêm vòng lãnh đạo duyệt khi chưa có yêu cầu nghiệp vụ.

### Bước 5: Lưu thành công

Backend lưu hộ, cá nhân mới nếu cần, thành viên và hồ sơ cư trú trong một giao dịch. Chỉ sau commit UI hiển thị **“Đã tạo hộ …”**, mở chi tiết hộ và nút **Thêm nhân khẩu**. Nếu giao dịch lỗi, không để lại hộ/cá nhân tạo dở; UI giữ dữ liệu nhập để thử lại. Retry dùng khóa yêu cầu để tránh tạo trùng.

## 3. Luồng B — Thêm nhân khẩu cho hộ đang có

### Bước 1: Mở đúng hộ

Danh sách → mở hộ → tab **Thành viên** → **Thêm nhân khẩu**. Header luôn giữ mã hộ, tên chủ hộ và địa chỉ để tránh thêm nhầm. Không cho đổi hộ đích âm thầm trong form.

### Bước 2: Tìm người trước khi tạo

Chọn loại giấy tờ và nhập số nếu có → **Kiểm tra người đã có**. Không có giấy tờ thì chọn **Chưa có/chưa rõ giấy tờ**, nhập tên + ngày/năm sinh, địa chỉ bổ sung để tìm ứng viên.

- Người đã có trong hộ: mở hồ sơ người đó, không thêm membership lần hai cho cùng thời kỳ.
- Người đã có và được phép truy cập: chọn **Dùng hồ sơ này**, đối chiếu tên/ngày sinh. Không sửa nhân thân chỉ để làm kết quả khớp.
- Người có thể tồn tại ngoài phạm vi: hiển thị “Cần phối hợp đối soát”, không lộ tên/địa chỉ ngoài quyền; tạo yêu cầu xử lý theo quy trình quản lý, không cho mở hồ sơ trái quyền hoặc tạo bản trùng để đi tiếp.
- Không có ứng viên: **Tạo hồ sơ cá nhân mới**. Thiếu định danh vẫn được nhập nếu các trường tối thiểu đủ và có mức xác minh phù hợp; không sinh số giả.

### Bước 3: Thông tin cá nhân

Với người mới: nhập họ tên, ngày sinh hoặc năm sinh, giới tính, tên cha/mẹ nếu biết, giấy tờ và nguồn xác minh. Với người có sẵn: hiển thị tóm tắt để xác nhận, không tạo lại cá nhân. Nếu muốn sửa nhân thân, chuyển sang luồng D có quyền tương ứng và nêu tác động dùng chung.

### Bước 4: Quan hệ hộ và cư trú

Form gồm **Quan hệ với chủ hộ**, **Là chủ hộ**, ngày bắt đầu tham gia hộ nếu biết; phần riêng **Loại hồ sơ cư trú**, địa chỉ, ngày đăng ký, thời hạn nếu có; phần **Thực tế cư trú**. Nơi thường trú và nơi đang ở có thể khác nhau. Không tự lấy ngày nhập làm ngày đăng ký hoặc ngày bắt đầu ở.

Nếu người đang là thành viên hộ khác, UI phân biệt **thêm hồ sơ cư trú khác**, **chuyển hộ**, **sửa liên kết sai**. Chuyển hộ cần ngày hiệu lực, kiểm tra quyền hộ nguồn/đích và lịch sử liên quan. Không tự kết thúc mọi quan hệ/hồ sơ cũ khi thêm tạm trú hoặc NOHT.

Nếu chọn chủ hộ mới khi đã có chủ hộ hiện hành, mở thao tác **Thay đổi chủ hộ** để chốt ngày hiệu lực và giữ lịch sử; không lưu hai chủ hộ hiện hành của cùng loại hộ nếu nghiệp vụ không cho phép.

### Bước 5: Xem lại và lưu

Tóm tắt “Thêm người A vào hộ H” cùng các phần được tạo mới hoặc sử dụng lại; bấm **Lưu nhân khẩu**. Backend ghi đồng bộ liên kết hộ, hồ sơ cư trú, lần xác minh nếu có và audit, sau đó cập nhật danh sách. Bộ đếm phải phản ánh đúng định nghĩa; có ba thành viên đã nhập không đồng nghĩa ba người đã xác minh đang ở thực tế.

## 4. Luồng C — Chỉnh sửa thông tin hộ

### Bước 1: Mở chi tiết hộ

Chọn hộ → **Thông tin hộ → Sửa thông tin hộ**. Form hiển thị phiên bản mới nhất, thời điểm cập nhật và trường được phép sửa.

### Bước 2: Chọn nội dung cần thay đổi

- Sửa lỗi tên liên hệ/số điện thoại/ghi chú: cập nhật thông tin hộ.
- Đổi chủ hộ: dùng thao tác riêng chọn thành viên, ngày hiệu lực, lý do; không sửa chuỗi tên rồi coi đã chuyển chủ hộ.
- Đổi địa chỉ: chọn **Sửa lỗi địa chỉ** hoặc **Hộ chuyển nơi ở**. Sửa lỗi giữ dấu vết trước/sau; chuyển nơi ở tạo hiệu lực/lịch sử phù hợp, không ghi đè địa chỉ lịch sử của mọi hồ sơ cư trú.
- Đổi vị trí trên bản đồ hoặc liên kết công trình: thao tác riêng, kiểm tra quyền vị trí và quyền hồ sơ, không tự thay từ địa chỉ text.
- Chuyển sang ấp khác: đi qua quy trình bàn giao/kiểm tra scope, không cho sửa dropdown địa bàn để vượt quyền.

### Bước 3: Xem thay đổi

Hiển thị từng trường **Trước → Sau**, ngày hiệu lực khi thay đổi có lịch sử, lý do khi sửa nội dung trọng yếu. Không cho tự sửa tổng nam/nữ/số người để khớp mong muốn; tính từ dữ liệu người/hồ sơ theo định nghĩa hoặc hiển thị riêng chỉ tiêu nguồn chưa đối soát.

### Bước 4: Lưu và xác nhận

Bấm **Lưu thay đổi** → backend kiểm tra quyền, phiên bản, ràng buộc và ghi audit → hiển thị chi tiết mới. Nếu người khác đã sửa cùng hộ, báo **“Hộ đã được cập nhật bởi người khác”**, hiển thị khác biệt và cho tải bản mới/áp lại phần cần sửa; không ghi đè âm thầm hoặc làm mất nội dung đang nhập.

## 5. Luồng D — Chỉnh sửa nhân khẩu của một hộ

### Bước 1: Chọn người

Chi tiết hộ → **Thành viên** → chọn người → **Chỉnh sửa**. Màn hình cho chọn ba nhóm tác động rõ ràng: **Thông tin cá nhân**, **Quan hệ với hộ này**, **Hồ sơ cư trú**. Xác minh thực tế có nút **Ghi nhận xác minh** riêng.

### Bước 2: Sửa đúng nhóm

| Nhu cầu cán bộ | UI cần mở | Hành vi lưu |
| --- | --- | --- |
| Sai tên/ngày sinh/giới tính | Thông tin cá nhân | Sửa danh tính dùng chung sau kiểm tra quyền; các màn hình tham chiếu thấy thông tin mới |
| Bổ sung/sửa CCCD | Giấy tờ định danh | Kiểm tra loại/số/trùng; lưu lịch sử và mức xác minh; xung đột chuyển review |
| Sai quan hệ với chủ hộ | Quan hệ với hộ này | Sửa membership được chọn, không sửa quan hệ ở mọi hộ |
| Người chuyển hộ | Chuyển hộ | Kết thúc/mở membership theo ngày hiệu lực đã xác minh, giữ lịch sử |
| Gia hạn tạm trú | Cư trú → Gia hạn | Ghi sự kiện/phiên bản mới có nguồn; không mất kỳ hạn cũ |
| Sai ngày đăng ký/địa chỉ | Cư trú → Sửa thông tin hồ sơ | Chọn đúng record, sửa có audit; không đổi các hồ sơ khác |
| Vừa kiểm tra thấy đang ở | Ghi nhận xác minh | Thêm lần ghi nhận có ngày/cán bộ/nguồn, không tự sửa loại đăng ký |

Không đặt một nút “Loại cư trú hiện tại” duy nhất rồi ghi đè mọi lịch sử. Khi cùng người có thường trú và tạm trú ở các nơi khác nhau, UI hiển thị từng hồ sơ và thời gian của nó. Người liên quan nhiều hộ chỉ hiện các hộ/hồ sơ được cấp quyền; sửa nhân thân dùng chung cần quyền chuyên biệt hoặc yêu cầu cán bộ có thẩm quyền xử lý.

### Bước 3: Kiểm tra tác động

Màn hình xem lại thể hiện rõ **“Thay đổi thông tin cá nhân dùng chung”** hoặc **“Chỉ thay đổi quan hệ với hộ …”** hoặc **“Chỉ thay đổi hồ sơ tạm trú …”**. Trường trọng yếu có lý do và nguồn kiểm chứng. Mã định danh trùng với người khác chặn cập nhật trực tiếp; hướng sang đối soát, không cho tự gộp hai người.

### Bước 4: Lưu

Backend kiểm tra phiên bản cá nhân, membership hoặc record tương ứng; ghi thay đổi và audit trong cùng giao dịch. Thành công quay về đúng tab/người đang xem. Nếu lỗi/xung đột, giữ form và chỉ rõ nguyên nhân. Thống kê/tổng hợp được cập nhật hoặc đánh dấu đang cập nhật sau commit, không hiển thị thành công trước commit.

## 6. UI đơn giản, lưu trữ đầy đủ ở bên dưới

| Thao tác UI | Các thành phần dữ liệu chịu tác động |
| --- | --- |
| Tạo hộ và thành viên | household; resident/identity khi tạo người mới; membership; residence_record/address; verification khi có |
| Thêm người đã có | Dùng lại resident; tạo membership/record cần thiết; không nhân đôi cá nhân |
| Sửa liên hệ hộ | household + audit/version |
| Đổi chủ hộ/chuyển hộ | membership theo hiệu lực + audit; xử lý record liên quan theo nghiệp vụ |
| Sửa cá nhân | resident/identity + audit/version; không tự đổi quan hệ hộ |
| Sửa/gia hạn cư trú | residence_record/address và lịch sử sự kiện/phiên bản + audit |
| Xác minh thực tế | Thêm residence_verification; không thay hồ sơ pháp lý bằng dấu X |

Nguồn nhập tay lưu actor/time/method=MANUAL trong provenance/audit; không giả lập một dòng Excel. Các bảng import chỉ dùng khi nhập file. Với thao tác nhập tay có nhiều bước, đề xuất draft phía server kèm TTL/chính sách giữ phù hợp; “Lưu nháp” khác “Lưu hồ sơ” và không đưa vào dân số chính thức.

Ngày hiệu lực chưa rõ giữ UNKNOWN; không biến thời điểm hệ thống ghi nhận thành thời điểm nghiệp vụ. Thao tác tác động liên hộ phải kiểm tra đầy đủ quyền nguồn/đích. Quy trình bàn giao và phê duyệt chỉ thêm ở các nghiệp vụ thực sự cần, không bắt mọi lần sửa thông tin phải duyệt.
