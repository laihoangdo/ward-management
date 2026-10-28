# Phân tích và mapping bốn file DSNK Trung Chánh 2

> Cập nhật 20/10/2026: đã triển khai module và nhập nguồn thật vào schema riêng `tc2_roster`. Xem [kết quả triển khai, hướng dẫn sử dụng và recovery](tc2-roster-implementation.md). Các số liệu dưới đây là khảo sát nguồn trước nhập; các dòng bất đồng vẫn được giữ để đối soát.

Khảo sát ngày **19/10/2026**, mở rộng [thiết kế database ban đầu](ke-hoach-database-dsnk-tc2-ap62.md). Tài liệu này là nguồn ưu tiên cho phạm vi bốn file, mapping địa bàn và tổng số liệu; thiết kế bảng/luồng chuyển đổi ở tài liệu ban đầu tiếp tục áp dụng cùng các bổ sung dưới đây. Đã đọc mọi sheet, phân tích dòng nghiệp vụ, sheet phụ, định danh, ngày sinh, HSCT và đối chiếu PostgreSQL local chỉ đọc. Chưa nhập hồ sơ hoặc sửa schema.

## 1. Phạm vi địa bàn đã được xác nhận

Theo xác nhận của người dùng trong yêu cầu này, **toàn bộ dữ liệu của bốn file thuộc ấp Trung Chánh 2, sáp nhập từ ấp 61, 62, 63, 69**. File 61/63/69 chỉ chứa **một phần** ấp cũ như tên file, không đại diện toàn bộ ấp cũ.

| Nguồn | Phạm vi trong lần nhập | Địa bàn nghiệp vụ đích |
| --- | --- | --- |
| DSNK TC2 – Ấp 62 | Toàn bộ dữ liệu nghiệp vụ trong file được cung cấp | Trung Chánh 2 |
| DSNK TC2 – một phần Ấp 61 | Chỉ các dòng thuộc file được cung cấp | Trung Chánh 2 |
| DSNK TC2 – một phần Ấp 63 | Chỉ các dòng thuộc file được cung cấp | Trung Chánh 2 |
| DSNK TC2 – một phần Ấp 69 | Chỉ các dòng thuộc file được cung cấp | Trung Chánh 2 |

Đích hiện có: **`hamlet.id=28`, `hamlet.code=27592-TRUNGCHANH-2`, `name=Trung Chánh 2`**. Khi áp dụng ở môi trường khác phải tìm theo code, xác minh đúng đơn vị cha và lấy ID thực tế, không hardcode 28 xuyên môi trường. Không tạo thêm bốn hamlet hiện hành từ bốn file. Không đổi địa bàn của địa chỉ thường trú ngoài TC2 sang TC2: địa bàn quản lý bộ hồ sơ và địa bàn của từng địa chỉ là hai thuộc tính khác nhau.

Xác nhận này giải quyết điểm chưa rõ TC2–Ấp 62 của khảo sát trước. Chưa có ngày hiệu lực sáp nhập hoặc ranh giới chuẩn trong yêu cầu; để trống ngày hiệu lực, không tự gán 19/10/2026. Việc gom hồ sơ không phải bằng chứng để đổi polygon hoặc tự liên kết một hộ với khối nhà trên bản đồ.

## 2. Tổng hợp sau khi phân biệt dữ liệu và bản sao

| Nguồn ấp cũ | Thường trú | Tạm trú | NOHT | Đ19 | Tổng dòng nghiệp vụ | Định danh phân biệt trong file | Nhóm trùng trong file |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 61, một phần | 1.648 | 57 | 345 | 0 | 2.050 | 2.026 | 24 |
| 62 | 1.375 | 380 | 280 | 4 | 2.039 | 1.956 | 82 |
| 63, một phần | 337 | 36 | 10 | 0 | 383 | 383 | 0 |
| 69, một phần | 499 | 121 | 121 | 0 | 741 | 741 | 0 |
| **Tổng theo dòng** | **3.859** | **594** | **756** | **4** | **5.213** | **5.106 trước loại trùng giữa file** | **106 nhóm nội bộ** |

Toàn bộ bốn file có **5.104 chuỗi định danh phân biệt**, **108 nhóm trùng định danh**, **109 dòng vượt số khóa phân biệt**. Không có dòng nghiệp vụ thiếu giá trị định danh sau loại tiêu đề/dòng tổng. Đây chưa phải 5.104 người đã xác thực: số định danh nguồn còn cần kiểm tra và các nhóm trùng còn có xung đột nhân thân.

Phân bố độ dài giá trị định danh: 4.670 dòng dài 11, 39 dòng dài 10, 504 dòng dài 12. Riêng thường trú 69 có 499 định danh dạng text dài 12, trong khi phần lớn các sheet khác lưu dạng số. Không chuyển text sang số, không tự bù 0 rồi coi là định danh đã xác minh. Khử trùng toàn TC2, không dùng `(ấp cũ, định danh)` làm khóa người vì sẽ tạo hai người cho hồ sơ chuyển địa chỉ.

### 2.1. Sheet phụ và dòng phải loại khỏi nhập nghiệp vụ

| File | Sheet/phạm vi | Xử lý và bằng chứng |
| --- | --- | --- |
| 62 | Sheet1: 671 dòng; Sheet2: 224 dòng | Không header; tất cả khớp tên + ngày sinh với Thường trú |
| 61 | Sheet1: 783 dòng; Sheet2: 246 dòng | Không header; cột A là STT, B tên, C ngày sinh; tất cả khớp tên + ngày sinh với Thường trú |
| 69 | Nam: 245 dòng | Không header; cột B/C tên/ngày sinh; tất cả khớp Thường trú |
| 69 | Sheet1: 501 dòng vật lý | Dòng 1 header, dòng 2 là header nội bộ `Column1.*`, 499 dòng còn lại là bản sao Thường trú |
| 69 | Thường trú!B501 | Ghi chú tổng “91 hộ”, không phải người; không nhập |

499 dòng người trong Sheet1 của 69 có cùng tập định danh và cùng toàn bộ B:J với 499 dòng Thường trú; khác STT không tạo nghiệp vụ mới. Tổng “91 hộ” trong ghi chú không khớp 87 HSCT phân biệt; giữ là chỉ tiêu nguồn chờ đối soát, không dùng làm số hộ thực tế. Thường trú 69 còn có STT lặp: khóa provenance phải là file hash + sheet + số dòng vật lý, không dùng STT làm khóa.

## 3. Mapping cột theo từng cấu trúc

Đặc tả tên cột và phạm vi chính xác nằm trong [mapping JSON](tc2-four-files-mapping.json), kèm SHA-256 từng file, số dòng kỳ vọng và ngoại lệ. Đây là đặc tả thiết kế để xây importer, chưa phải cấu hình chạy nhập tự động. Phải kiểm tra đồng thời file hash, tên sheet và header; file khác phiên bản cần được profile lại.

### 3.1. Thường trú

| Thuộc tính | 61 | 62 | 63 | 69 |
| --- | --- | --- | --- | --- |
| STT / tên / ngày sinh | A / B / C | A / B / C | A / B / C | A / B / C |
| Tuổi nguồn | D | D | Không có | Không có |
| Giới tính / định danh | E / F | E / F | D / E | D / E |
| Tên chủ hộ / HSCT | G / H | G / H | F / G | F / G |
| Nơi thường trú | I | I | H | H |
| Nơi ở hiện tại | J | K | I | I |
| Ngày đăng ký thường trú | Không có | J | Không có | Không có |
| Tên cha / mẹ | Không có | L / M | Không có | Không có |
| Trạng thái / quản lý đặc thù | Không có | N / O | Không có | Không có |
| Phân loại nhà ở | Không có | P, toàn bộ trống | Không có | Không có |
| Đánh dấu thực tế cư trú | K | Q | J | J |
| Cột cần giữ raw để review | L/M, ghi chú rời | Các giá trị chưa phân giải | C280 là năm 1979 | B501 là dòng tổng |

Cột L/M của Thường trú 61 có tổng ba ô ghi chú, không phải trạng thái hay phân loại. Tên `Column1/Column2` ở đây **khác nghĩa** với Column1/Column2 của NOHT 62. Giữ raw/ghi chú nguồn có quyền truy cập phù hợp, không suy diễn từ tên cột mặc định. Ở 69, map “Giới tính nam/nữ” thành MALE/FEMALE; các file khác dùng “Nam/Nữ”.

`Thường trú!C280` của file 63 ghi số **1979**, format General: map `birth_year=1979`, `birth_date=NULL`, precision YEAR. Không coi 1979 là Excel serial hoặc tự tạo ngày 01/01/1979. Các cột ngày sinh còn lại parse được theo ô ngày/dd/MM/yyyy trong khảo sát.

### 3.2. Tạm trú

| Thuộc tính | 61 | 62 | 63 | 69 |
| --- | --- | --- | --- | --- |
| Tên / ngày sinh | B / C | B / C | B / C | B / C |
| Giới tính / định danh | D / E | E / F | D / E | D / E |
| Tuổi nguồn | Không có | D | Không có | Không có |
| Chủ hộ/người đại diện | F | G | F | F |
| Nơi tạm trú | G | H | G | G |
| Ngày đăng ký / hạn | H / I | I / J | Không có | Không có |
| Nơi thường trú | J | K | H | H |
| Trạng thái / đặc thù / loại đăng ký | K / L / M | L / M / N | Không có | Không có |
| Nhãn còn hạn nguồn | Không có | O | Không có | Không có |
| Thực tế cư trú | N | P | I | I |

Thêm alias header “Địa chỉ nơi thường trú” (63) tương đương vai trò địa chỉ thường trú, không nhầm với nơi tạm trú. Không điền ngày đăng ký/hạn của 63/69 từ file khác hoặc lấy ngày nhập. Hạn chưa có phải hiện UNKNOWN.

Có **47 dòng có ngày kết thúc trước 19/10/2026**: 17 ở 61 và 30 ở 62; 157 dòng tạm trú của 63/69 không có cột hạn. Không báo toàn bộ 594 dòng là còn hạn. Giữ nhãn nguồn của 62, tính trạng thái hạn theo ngày tham chiếu; cần xác minh ngày gia hạn và quy ước ngày kết thúc trước khi đổi trạng thái nghiệp vụ.

### 3.3. Khai báo NOHT và Đ19

| Thuộc tính NOHT | 61 | 62 | 63 | 69 |
| --- | --- | --- | --- | --- |
| Tên / ngày sinh | B / C | B / C | B / C | B / C |
| Giới tính / định danh | D / E | E / F | D / E | D / E |
| Ngày đăng ký | F | G | F | Không có cột tên này |
| Thời gian cư trú nguồn | Không có | Không có | Không có | F |
| Địa chỉ | G | H | G | G, tên “Nơi ở hiện tại” |
| Trạng thái nguồn | Không có | I, Column1 | Không có | H |
| Quản lý đặc thù | Không có | J, Column2 | Không có | Không có |
| Thực tế cư trú | H | K | H | I |

F của NOHT 69 chứa 58 ô ngày và 63 chuỗi; parse ngày có thể thực hiện nhưng **không tự map sang registration_date** vì header là “Thời gian cư trú”. Trước mắt giữ `source_residence_time_raw`, chỉ chuyển sang mốc bắt đầu/đăng ký sau xác nhận nghiệp vụ. Không để sự khác biệt này biến thành hai cột date có ý nghĩa lẫn lộn.

Đ19 chỉ có ở 62, giữ mapping A:M của khảo sát trước. Sheet không xuất hiện ở file khác có nghĩa không có dữ liệu được cung cấp cho loại đó, không kết luận địa bàn không có người thuộc nhóm này.

## 4. Đối soát trùng toàn bộ TC2

### 4.1. Trùng giữa file

| Cặp nguồn | Nhóm định danh giao nhau | Vị trí nguồn để review |
| --- | ---: | --- |
| 61–62 | 1 | 62/Tạm trú!187 ↔ 61/Khai báo NOHT!182 |
| 61–69 | 1 | 61/Thường trú!50 ↔ 69/Khai báo NOHT!86 |
| Các cặp còn lại | 0 | Không thấy giao theo chuỗi định danh nguyên bản |

Hai nhóm này cần một danh tính dùng chung sau xác minh, nhưng có thể giữ nhiều hồ sơ cư trú. Không chọn file thắng theo số ấp hoặc tự ghi đè địa chỉ. Quyết định hồ sơ đang hiệu lực phải dựa vào thời gian/nguồn và người review.

### 4.2. Trùng trong và giữa loại nghiệp vụ

108 nhóm trùng toàn bộ gồm: 4 nhóm chỉ Tạm trú; 7 nhóm chỉ NOHT; 79 nhóm giao Tạm trú–NOHT; 18 nhóm giao Thường trú–NOHT. Tổng 109 dòng vượt khóa vì có một nhóm ba dòng. Phân biệt bản sao cùng sự kiện với nhiều sự kiện của một người.

Trong các nhóm cùng định danh, sau chuẩn hóa tên Unicode/space/hoa thường, parse ngày và chuẩn hóa giới tính, có **2 nhóm bất đồng tên, 29 nhóm bất đồng ngày sinh, 1 nhóm bất đồng giới tính**. Các tập này có thể chồng nhau, không cộng thành số người lỗi. Các bất đồng phải được review trước tự merge; không chỉ đếm khóa trùng rồi loại dòng sau.

### 4.3. Hộ và dấu thực tế cư trú

| Nguồn | HSCT phân biệt ở Thường trú | HSCT có nhiều tên chủ hộ sau chuẩn hóa | Dòng có đánh X, mọi sheet nghiệp vụ |
| --- | ---: | ---: | ---: |
| 61 | 319 | 25 | 1.669 |
| 62 | 284 | 15 | 1.436 |
| 63 | 62 | 3 | 243 |
| 69 | 87 | 3 | 248 |
| **Tổng** | **752** | **46** | **3.596** |

Không thấy cùng chuỗi HSCT xuất hiện giữa các file trong lần khảo sát. Tuy vậy 752 là số khóa hồ sơ nguồn, chưa phải số hộ đang ở hoặc số nhà. Hộ tạm trú/NOHT không có HSCT để suy ra tổng hộ toàn TC2. Các nhóm chủ hộ bất đồng cần phân biệt đổi chủ hộ, khác người đại diện, khác cách ghi hoặc lỗi.

3.596 dấu X là số **lượt dòng**, chưa khử trùng người và chưa có ngày kiểm tra. Trống là UNKNOWN; đặc biệt 69 thường trú chỉ sáu dòng đánh X, không suy ra 493 người còn lại vắng mặt. Không dùng số dấu X làm dân số thực tế đã nghiệm thu.

## 5. Đối chiếu DB và thiết kế bổ sung cho địa bàn sáp nhập

Snapshot local vẫn có 1.461 resident và 1.260 household; 896 hộ thuộc hamlet TC2 hiện có. Khảo sát trước xác nhận 896 hộ mã TC2 chưa có resident liên kết. Cả bốn nguồn có **0 dòng khớp định danh DB** khi so nguyên bản hoặc thử bù trái 12 ký tự; **86 dòng có tên xuất hiện trong DB** sau chuẩn hóa. Không tự merge 86 dòng theo tên hoặc kết luận toàn bộ nguồn là người mới. Không thay 896 hộ hiện tại bằng 752 HSCT: hai tập có nguồn và mức xác minh khác nhau.

Giữ thiết kế resident/identity, household/membership, residence_record/address, verification/classification và staging ở kế hoạch trước, bổ sung:

1. **Bộ nhập nhiều file:** `import_collection(id, code, target_hamlet_id, mapping_version, status, created_at/by)` gom bốn `import_batch`. `import_batch` thêm `collection_id`, `source_legacy_hamlet`, `source_extent`, file hash. Phê duyệt/apply và đối soát trùng ở cấp collection; giao dịch có thể chia batch nhưng resolver danh tính và ledger dùng chung.
2. **Quản lý địa bàn hồ sơ:** `residence_record.managing_hamlet_id` FK là scope quản lý, độc lập `residence_address.hamlet_id`. Hồ sơ bộ này scope TC2; địa chỉ thường trú ngoài TC2 giữ nguyên, có thể không có FK local. Service kiểm tra quyền nhập TC2 trước apply. Không lấy scope từ tùy ý sửa address text.
3. **Nguồn địa bàn cũ theo từng dòng:** lưu `source_legacy_hamlet` qua batch/source row, có khả năng nhiều nguồn ấp cũ chứng minh cùng resident; không đặt một `legacy_hamlet` duy nhất trên resident. Nếu cần mô hình lịch sử sáp nhập chính thức, thêm `hamlet_predecessor_mapping` có mã đơn vị nguồn, đơn vị đích, extent FULL/PARTIAL, thời gian và tài liệu căn cứ nullable/chờ xác nhận. Không dùng alias toàn phần “Ấp 61/63/69” để map mọi địa chỉ của các ấp đó sang TC2.
4. **Khóa hộ:** HSCT text + cơ quan/phạm vi cấp là ứng viên ghép hộ; source file/ấp cũ là provenance, không mặc định là thành phần khóa hộ vĩnh viễn. Khi chưa chốt cơ quan cấp, không unique HSCT toàn DB hoặc gộp chỉ theo địa chỉ/tên.
5. **Parser ngày sinh theo precision:** nhận `date`, text dd/MM/yyyy và năm bốn chữ số; nhận diện năm trước Excel serial, chỉ xử lý serial theo kiểu/format ngày được xác minh. Tuổi nguồn chỉ dùng kiểm tra; ngày sinh có precision YEAR không được lọc tuổi tròn như precision DAY mà không quy tắc báo cáo rõ.
6. **Mapping có ngữ cảnh:** registry theo file phiên bản + sheet + header, hỗ trợ cột vắng mặt và alias; reject cấu trúc mới chưa duyệt. Các cột còn thiếu ở nguồn giữ UNKNOWN, không ghi NULL đè trường đã xác minh trên entity hiện có.
7. **Nhận diện bản sao/annotation:** importer có quyết định EXCLUDED_AUXILIARY, EXCLUDED_HEADER, EXCLUDED_SUMMARY và lý do; lưu số dòng vật lý để kiểm toán. Bản sao 69 không tạo resident/record/verification lần hai.

Không cần tạo bốn bảng nhân khẩu hoặc bốn bảng hộ tương ứng bốn ấp cũ. Không dùng việc sáp nhập dữ liệu để mở rộng quyền qua các phần ấp cũ không nằm trong bộ nguồn. Cần kiểm thử scope mới trên các bảng record, membership, identity và import row, không chỉ trên household cũ.

## 6. Kế hoạch cập nhật thay cho phạm vi một file

| Giai đoạn | Công việc | Kết quả cần đạt |
| --- | --- | --- |
| 1. Chốt mapping | Dùng xác nhận người dùng cho scope TC2; chốt ngày hiệu lực, loại định danh, ý nghĩa thời gian NOHT69 và HSCT | Mapping version bốn file; các ô chưa rõ có quyết định review |
| 2. Chuẩn bị | Snapshot/restore DB riêng; xây import collection/staging; bảo vệ raw nguồn | Đủ bốn file hash; báo cáo nguồn có thể truy lại từng dòng, không lưu PII trong Git |
| 3. Dry-run chung | Parse mọi sheet và loại dòng phụ; resolver chạy toàn collection | Đúng 5.213 dòng; 5.104 khóa định danh thô; 108 nhóm trùng, 109 dòng vượt khóa; không tạo entity nghiệp vụ |
| 4. Review | Xử lý hai nhóm giao file, các xung đột tên/ngày sinh/giới tính, 46 HSCT nhiều chủ hộ, định danh thiếu 0 | Có quyết định ghép/tách/chờ xử lý, không tự ưu tiên file |
| 5. Schema/API | Migration cộng thêm theo kế hoạch trước + scope/provenance sáp nhập + parser nhiều cấu trúc | DTO/UI/service/RBAC nhất quán; date precision và UNKNOWN hiển thị đúng |
| 6. Apply thử | Nhóm hồ sơ đã duyệt trên DB restore, đối chiếu hộ nguồn với hộ TC2 trên bản đồ | Không ghi đè hồ sơ đã xác minh; mỗi thay đổi có ledger; giữ liên kết GIS |
| 7. Nghiệm thu | Nhập lại/retry/cạnh tranh/rollback, kiểm tra hạn và báo cáo theo thời điểm | Không nhân đôi; thống kê phân biệt người, sự kiện, hộ nguồn và dấu xác minh |

Không bắt mọi nhóm phải được giải quyết bằng merge: hồ sơ chưa đủ căn cứ có thể giữ ở staging và không vào báo cáo chính thức. Không được bỏ im lặng các dòng đó.

## 7. Kiểm tra đã thực hiện và điều kiện triển khai

Đã đọc và profile cả bốn workbook; đối chiếu số dòng sau loại bản sao; kiểm tra trường ngày theo kiểu ô/chuỗi; đối chiếu 499 dòng bản sao 69 trên B:J; kiểm tra sheet phụ theo tên + ngày sinh; khử trùng nội bộ/liên file theo chuỗi định danh; đối chiếu tên/định danh với DB và kiểm tra hamlet đích chỉ đọc. Tổng thường trú 3.859, tạm trú 594, NOHT 756, Đ19 4 cộng đúng 5.213.

Các mốc kiểm thử bắt buộc khi xây importer: ngày sinh YEAR tại 63/C280; giới tính dạng dài ở 69; header nội bộ 69/Sheet1!2; tổng 69/Thường trú!501; HSCT đọc từ H ở 61/62 nhưng G ở 63/69; định danh đọc từ F hoặc E đúng cấu trúc; cột F/NOHT69 không tự coi ngày đăng ký. Test người xuất hiện ở hai file phải tạo một danh tính đã xác minh nhưng không mất hai dòng nguồn.

Chưa xác minh từng hồ sơ với tài liệu gốc/nhân khẩu thực địa, chưa chuẩn hóa mọi địa chỉ tới nhà/GPS, chưa xác nhận ngày hiệu lực sáp nhập và chưa thử apply/rollback migration vì yêu cầu hiện tại là phân tích/mapping và lập kế hoạch. Không có thay đổi trên database đang sử dụng.
