# Đối chiếu DSNK TC2 – Ấp 62 và kế hoạch điều chỉnh database

> **Cập nhật phạm vi 19/10/2026:** Người dùng đã xác nhận bốn file Ấp 62 và một phần Ấp 61/63/69 đều thuộc Trung Chánh 2 sau sáp nhập. Xem [phân tích và mapping toàn bộ bốn file](phan-tich-mapping-dsnk-trung-chanh-2.md) và [đặc tả cột nguồn](tc2-four-files-mapping.json). Tài liệu hiện tại giữ số liệu khảo sát riêng file 62 và thiết kế nền. Các yêu cầu xác nhận quan hệ TC2–Ấp 62 bên dưới đã được giải quyết ở phạm vi bộ dữ liệu do người dùng cung cấp; không còn là điều kiện chặn mapping. Ngày hiệu lực/ranh giới và phạm vi phần ấp cũ ngoài bộ nguồn vẫn chưa có căn cứ để thay đổi.

Ngày khảo sát: **19/10/2026**. Phạm vi: đọc toàn bộ sáu sheet Excel, schema thực tế và truy vấn chỉ đọc PostgreSQL local `Monolithic` trong container `monolithic-postgresql-1`, đối chiếu entity/JHipster/Liquibase và luồng GIS. Đây là thiết kế và kế hoạch triển khai, chưa sửa schema hoặc nhập dữ liệu nghiệp vụ. Nội dung trong Excel được coi là dữ liệu nguồn, không phải chỉ dẫn thực thi.

Nguồn Excel: `DSNK - TC2 - Ấp 62.xlsx` tại thư mục gốc repository. SHA-256: `8410b6ce0233aa08cbd3514ecf2df7b4a6f8a3b4945347505fa02cd06397f23a`. Các số liệu dưới đây là snapshot khảo sát, không phải dân số đã xác minh. Không chép tên, CCCD hoặc địa chỉ cá nhân vào tài liệu này.

## 1. Kết luận thiết kế

Cần giữ một hồ sơ cá nhân dùng chung, tách nhiều hồ sơ cư trú theo thời gian và loại nghiệp vụ; tách hộ đăng ký khỏi địa điểm/công trình. Không nhập mỗi dòng thành một nhân khẩu mới, không thêm toàn bộ cột Excel vào `resident`, không dùng trường `notes` để thay cấu trúc nghiệp vụ.

Ưu tiên triển khai lớp staging và đối soát trước, mở rộng schema theo hướng cộng thêm, sau đó mới chuyển API/UI và nhập thử. Các điểm chưa đủ căn cứ — định danh mất số 0, quan hệ TC2–Ấp 62, chủ hộ khác nhau trong cùng HSCT, loại nghiệp vụ NOHT/Đ19 — phải có trạng thái chờ xác minh và người xử lý.

## 2. Dữ liệu thực tế trong workbook

| Sheet | Phạm vi đã đọc | Số dòng dữ liệu | Nhận định |
| --- | --- | ---: | --- |
| Thường trú | A1:Q1376 | 1.375 | 284 số HSCT phân biệt, 296 tên chủ hộ phân biệt; đây chưa phải số hộ đã xác minh |
| Tạm trú | A1:P381 | 380 | 375 định danh phân biệt; có lặp nội bộ và lặp với NOHT |
| Khai báo NOHT | A1:K281 | 280 | I/J có tên mặc định Column1/Column2 nhưng chứa thông tin nghiệp vụ |
| NK Đ19 | A1:M5 | 4 | Tình trạng nguồn: chưa đủ điều kiện đăng ký thường trú |
| Sheet1 | A1:D671 | 671 | Không có header; cả 671 dòng khớp tên + ngày sinh với Thường trú; là danh sách nam trong nguồn |
| Sheet2 | A1:C224 | 224 | Không có header; cả 224 dòng khớp tên + ngày sinh với Thường trú; tuổi nguồn 0–13 |

Hai sheet phụ có dữ liệu ngay dòng 1. Không bỏ dòng đầu như header và cũng không cộng vào tổng nhập nghiệp vụ. Chưa suy diễn Sheet2 là toàn bộ danh sách dưới một ngưỡng tuổi khi chưa kiểm tra tiêu chí lập sheet.

### 2.1. Định danh và bản ghi trùng

- Bốn sheet nghiệp vụ có **2.039 dòng**, 1.956 chuỗi định danh phân biệt trước xác minh; không đồng nghĩa 1.956 người đã được xác thực.
- 82 nhóm trùng định danh tạo ra 83 dòng vượt số khóa phân biệt. Trong đó 78 nhóm giao giữa Tạm trú và NOHT; bốn nhóm chỉ trong Tạm trú. Một nhóm giao xuất hiện hai lần ở Tạm trú và một lần ở NOHT.
- Ví dụ vị trí cần đối soát: `Tạm trú!F50` / `F291`; `Tạm trú!F274` / `F316` / `Khai báo NOHT!F5`. Không xóa dòng chỉ vì trùng số: có thể là đợt đăng ký khác, bản sao hoặc xung đột nhân thân.
- 2.014 giá trị dài 11 ký tự, 20 dài 10, 5 dài 12. Định danh ở Thường trú/Tạm trú/NOHT đều được lưu dạng số; Đ19 có hai ô số và hai ô text. Dấu hiệu mất số 0 đầu cần kiểm tra cùng number format và nguồn gốc; **không mặc định mọi giá trị đều là CCCD 12 số** vì tiêu đề gồm cả ĐDCN/CCCD/CMND.
- Bù `zfill(12)` chỉ được dùng để tạo ứng viên đối sánh và chẩn đoán, không tự sửa giá trị chính thức. Giữ nguyên giá trị và kiểu ô nguồn trong staging.

### 2.2. Ngày tháng, tuổi, trạng thái

- Thường trú: 1.375 ngày sinh đều là ô ngày; chỉ 276/1.375 có ngày đăng ký thường trú. Không điền ngày giả cho 1.099 ô thiếu.
- Tạm trú: ngày sinh có 101 ô text, ngày đăng ký 132 ô text, thời hạn 128 ô text. NOHT: ngày sinh 148 ô text, ngày đăng ký 183 ô text. Các chuỗi ngày này đều parse được theo `dd/MM/yyyy` trong lần khảo sát.
- Cột tuổi ở ba sheet chính có tổng 2.035 công thức, dựa trên `2026 - năm sinh`. Đây là tuổi theo năm, không phải tuổi tròn vào ngày báo cáo. Không lưu tuổi như thuộc tính cố định.
- Tạm trú có 380 nhãn “Còn thời hạn tạm trú”, nhưng 30 ngày kết thúc đã trước 19/10/2026. Giữ nhãn như snapshot nguồn; tính tình trạng thời hạn từ ngày kết thúc tại thời điểm xem. Cần xác minh cột thời hạn thực sự là ngày kết thúc và các dòng có gia hạn chưa cập nhật.
- Đ19 có một chuỗi thời gian dạng `31/12/2025 -`, ba ô thiếu; cần hỗ trợ khoảng mở, không tự suy ra ngày kết thúc.
- Thường trú có 13 ô trạng thái trống. Không biến trống thành “đang thường trú” đã xác minh.

### 2.3. Quan hệ hộ, địa chỉ và thực tế cư trú

- Trong 284 HSCT của Thường trú, **15 số HSCT có hơn một chuỗi tên chủ hộ**. Cần kiểm tra thay đổi chủ hộ, lỗi nhập hoặc chuẩn hóa tên; không ghép theo tên chủ hộ đơn lẻ.
- Thường trú có 241 chuỗi nơi thường trú và 406 chuỗi nơi ở hiện tại. Hai địa chỉ có ý nghĩa khác nhau; số chuỗi phân biệt không phải số nhà/công trình.
- Cột đánh X: Thường trú 785 dòng (768 `x`, 17 `X`), Tạm trú 367, NOHT 280, Đ19 4. Tổng 1.436 dấu đánh theo dòng, chưa loại trùng người. Ô trống là chưa xác nhận, không tự hiểu là không cư trú.
- Phân loại nhà ở ở Thường trú trống toàn bộ. Không tự gán loại nhà từ việc một người có thường trú.
- NOHT: Column1 chứa “Chưa đủ điều kiện ĐKTT” ở 280 dòng; Column2 chứa “Không thuộc diện quản lý theo đặc thù” ở 274 dòng, sáu dòng trống. Cần đổi tên trong mapping, giữ tên gốc ở staging.
- Không có cột số điện thoại, tọa độ, quan hệ thành viên với chủ hộ hoặc phân loại an ninh để điền các trường tương ứng hiện có. Tên cha/mẹ không đủ để tạo FK tới một người trong DB.

## 3. Đối chiếu database đang chạy

| Kiểm tra local | Kết quả |
| --- | --- |
| `household` | 1.260 bản ghi; tất cả có `hamlet_id` |
| `resident` | 1.461; PERMANENT 1.340, TEMPORARY 121 |
| Nhân khẩu chưa có hộ | 29 |
| Nhóm mã hộ `TC2-%` | 896 hộ, chưa có resident liên kết |
| Định danh DB đúng dạng 12 chữ số | 1.051; không đủ căn cứ coi là định danh đã xác thực |
| Định danh DB NULL hoặc chuỗi rỗng | 283; các giá trị còn lại cần profile riêng trước migration |
| Khớp định danh Excel–DB | 0 dòng khi so chuỗi trực tiếp; 0 khi thử bù trái đủ 12 ký tự cho chuỗi số |
| Khớp tên sau NFC, bỏ khoảng trắng thừa, không phân biệt hoa thường | 32 dòng Excel có tên xuất hiện trong DB; không đủ bằng chứng để merge |

DB không có `hamlet.name` chứa “62”. Địa bàn TC2 hiện là `hamlet.id=28`, code `27592-TRUNGCHANH-2`, name `Trung Chánh 2`. Tên file và địa chỉ Ấp 62 chưa đủ căn cứ để đổi tên địa bàn hoặc chuyển toàn bộ 896 hộ sang Ấp 62. Cần xác nhận bảng đối chiếu địa bàn cũ/mới, phạm vi và thời điểm hiệu lực.

Schema thực tế phù hợp phần cốt lõi của entity đang có: `resident` chỉ có tên, chuỗi định danh unique, năm sinh, giới tính, quan hệ text, một `residence_type`, một `temporary_registered_at`, notes và một `household_id`. `household` vừa mang thông tin hộ, người đứng tên, cơ sở kinh doanh, vừa mang tọa độ và bộ đếm dân số; `owner_phone`, street, house_number đang NOT NULL. Không thể nhập sạch file này bằng mapping hiện tại mà không mất dữ liệu hoặc điền giả.

Changeset local mới nhất quan sát được: `20261019000000-1`; có `20261018030000-1`, `20261018020000-1`, `20261018010000-1`. Khi thực hiện phải kiểm tra lại thứ tự và schema từng môi trường, không dựa riêng ngày tên file migration.

Nguồn code cần cập nhật đồng bộ khi triển khai: `.jhipster/Resident.json`, `.jhipster/Household.json`, domain/DTO/mapper/criteria/repository/service/REST; Liquibase master; model/form frontend; `app/gis/services/firestoreService.ts`, `app/gis/utils/residentRosterUtils.ts`, `cryptoUtils.ts` và các luồng thống kê/phân quyền. Luồng GIS hiện có mã hóa CCCD phía client và tạo dữ liệu nhân khẩu suy diễn; không được dùng dữ liệu suy diễn để ghép hồ sơ thật.

## 4. Thiết kế database đề xuất

Tên bảng/cột dưới đây là đề xuất cho migration mới, chưa phải DDL đã áp dụng. Giữ ID hiện có để không phá liên kết hồ sơ, nhật ký và GIS.

### 4.1. Cá nhân và định danh

**Mở rộng `resident`:** `birth_date date NULL`, `birth_date_precision varchar(12)` (DAY/YEAR/UNKNOWN), `father_name`, `mother_name`, `data_origin`, `verification_status`, audit timestamps/actor và `version bigint` cho optimistic locking. Giữ `birth_year` trong giai đoạn tương thích; năm cũ không được tự biến thành ngày 01/01. Khi có ngày sinh đầy đủ, năm sinh phải nhất quán; tuổi tính từ ngày tham chiếu do báo cáo truyền vào.

**Thêm `resident_identity`:** `id`, `resident_id` FK, `document_type`, `number_ciphertext`, `number_lookup_hmac`, `key_version`, `verification_status`, `valid_from`, `valid_to`, `source_row_id`. Cho phép một người có nhiều loại giấy tờ theo thời gian. Tra cứu/khử trùng qua HMAC số đã chuẩn hóa có khóa phía server; ciphertext dùng mã hóa xác thực với nonce riêng. Unique theo `(document_type, number_lookup_hmac)` cho định danh đã xác minh đang hiệu lực; không ép unique các dòng staging chưa rõ loại giấy tờ. Luồng cấp định danh phải khóa/kiểm tra giao dịch để tránh hai người giữ cùng định danh đã xác minh.

Không dùng hash thường cho không gian CCCD dễ dò và không unique ciphertext ngẫu nhiên. Thiết kế chuyển khóa, giới hạn quyền giải mã và che giá trị ở log/DTO `toString`. Chuyển dần `resident.id_card_number`; chỉ gỡ cột/index cũ sau khi hoàn thành chuyển đổi và loại mọi đường ghi cũ.

### 4.2. Hộ và thành viên hộ

**Mở rộng `household`:** `source_case_number` (HSCT dạng text), `data_origin`, `verification_status`, `version`. Cho phép phone NULL khi không có nguồn; các trường địa chỉ tách không đủ thông tin phải cho NULL hoặc nằm trong luồng hồ sơ chưa hoàn thiện, thay vì dùng chuỗi rỗng để qua validation. Không biến HSCT thành `code` toàn cục: mã nội bộ và số hồ sơ bên ngoài có vai trò khác nhau.

**Thêm `household_membership`:** `id`, `household_id`, `resident_id`, `relationship_code` nullable, `is_head`, `valid_from`, `valid_to`, `verification_status`, `source_row_id`. Tên chủ hộ nguyên bản lưu ở nguồn; chỉ liên kết chủ hộ tới resident sau xác minh. Không tự coi chủ hộ/người đại diện tạm trú là chủ sở hữu nhà hoặc người đang cư trú tại đó.

Index `(household_id, valid_to)`, `(resident_id, valid_to)`; FK đầy đủ; kiểm tra ngày đầu ≤ ngày cuối khi đủ ngày. Chỉ đặt ràng buộc một chủ hộ hiện hành cho hộ đã xác minh sau khi xử lý 15 nhóm HSCT bất đồng. Uniqueness HSCT cần chốt cơ quan cấp/phạm vi/thời kỳ trước, không unique đơn cột toàn DB.

### 4.3. Địa chỉ và hồ sơ cư trú

**Thêm `residence_address`:** `id`, `raw_address text`, các thành phần địa chỉ chuẩn hóa nullable, `hamlet_id` nullable, `household_id` nullable, `normalization_status`, `source_row_id`. Giữ nguyên địa chỉ ngoài địa bàn hoặc chưa phân giải; không bắt mọi nơi thường trú phải tham chiếu hamlet local. Một địa điểm có thể có nhiều hộ. FK hộ ở đây chỉ là liên kết đã đối soát, không unique địa chỉ.

**Thêm `residence_record`:** `id`, `resident_id`, `record_kind`, `source_status`, `normalized_status`, `registration_date`, `valid_from`, `valid_to`, `address_id`, `household_id` nullable, `representative_name_raw`, `registration_form`, `source_sheet_kind`, `verification_status`, `source_row_id`, `version`. Các `record_kind` dự kiến PERMANENT_REGISTRATION, TEMPORARY_REGISTRATION, CURRENT_ADDRESS_DECLARATION, ARTICLE19_SOURCE; hai mã cuối là phân loại nguồn chờ chốt nghiệp vụ, không phải diễn giải pháp lý mới.

**Thêm `residence_record_address`:** `(record_id, address_id, address_role)` để giữ đồng thời nơi thường trú, nơi ở hiện tại, nơi tạm trú, nơi ở trước khi chuyển đến. Unique theo tổ hợp này; FK không cascade xóa hồ sơ đã có lịch sử. `address_id` chính trên record là địa chỉ của nghiệp vụ đó, bảng vai trò giữ các địa chỉ liên quan.

Một resident có thể có nhiều record; không unique `resident_id` hoặc `(resident_id, record_kind)` vì có lịch sử gia hạn/chuyển nơi ở. Index `(resident_id, record_kind, valid_from)`, `(household_id)`, `(address_id)`, partial index `valid_to` cho hồ sơ cần theo dõi hạn. Kiểm tra `valid_to >= valid_from` khi đủ hai ngày, nhưng ngày đăng ký không mặc nhiên là ngày bắt đầu cư trú. Dòng sai ngày đi vào danh sách lỗi, không ép vượt constraint bằng NULL.

Không tự map NOHT hay Đ19 sang STAY/STAY_AWAY/UNVERIFIED đang có. Giữ `resident.residence_type` và `household_id` như projection phục vụ API cũ trong giai đoạn chuyển tiếp; chỉ một service sở hữu quy tắc projection, không có hai đường ghi độc lập. Nếu không có lựa chọn tương thích chính xác, API cũ phải thể hiện chưa phân loại thay vì tạo một sự kiện pháp lý giả.

### 4.4. Xác minh thực tế, phân loại và địa bàn

**Thêm `residence_verification`:** `id`, `resident_id`, `residence_record_id` nullable, `presence_status` (PRESENT/ABSENT/UNKNOWN), `observed_at` nullable, `recorded_at`, `verified_by` nullable, `method`, `source_row_id`. Dấu X nguồn là ghi nhận chưa biết ngày khảo sát/cán bộ; `recorded_at` nhập không thay cho `observed_at`. Ô trống → UNKNOWN. Không tạo lần kiểm tra thực địa có người xác minh giả.

**Thêm `resident_classification`:** `id`, `resident_id`, `classification_code`, `raw_label`, `valid_from/to`, `verification_status`, `source_row_id`. Phân biệt “không thuộc diện” với thiếu thông tin. Chỉ thêm danh mục chi tiết khi có yêu cầu nghiệp vụ; không suy ra cảnh báo an ninh từ trạng thái cư trú. Phân loại nhà ở thuộc hộ/địa điểm, không thuộc người.

**Thêm `hamlet_alias`:** `id`, `hamlet_id`, `alias`, `normalized_alias`, `source`, `valid_from/to`, `verification_status`. Chỉ thêm alias Ấp 62 → TC2 khi xác nhận tương đương. Nếu thực tế chia/tách địa giới, cần bảng quan hệ chuyển đổi nhiều–nhiều theo hiệu lực và quy trình bàn giao, không dùng alias để thay đổi quyền. Không đổi polygon, `hamlet_id` hoặc liên kết `gis_field_building` chỉ từ địa chỉ text.

### 4.5. Nguồn nhập, đối soát và khả năng hoàn tác

**`import_batch`:** `id`, file hash/name, parser/mapping version, source date nullable, imported_at/by, target scope, status, tổng dòng theo sheet và kết quả.

**`import_row`:** `id`, `batch_id`, sheet, row_number, source key, raw payload được bảo vệ, normalized payload, validation errors, decision/status, reviewer/time. Unique `(batch_id, sheet, row_number)`. Raw payload giữ kiểu ô, giá trị, công thức/giá trị cache có liên quan; không phát tán PII vào Git/log. File hash + mapping version + scope giúp nhận diện lần chạy lại; retry một batch không tạo thêm dòng.

**`import_row_link`:** một dòng nguồn liên kết tới các entity đích đã tạo/ghép và quyết định tương ứng. Với các bảng đích xác định nên dùng FK cụ thể hoặc bảng link riêng theo loại, tránh polymorphic ID không kiểm chứng. Cho phép nhiều dòng nguồn chứng minh cùng một resident/record mà không mất provenance.

**`import_change`:** batch/row, entity, thao tác, trước/sau được bảo vệ, version trước/sau, actor/time. Rollback dùng thay đổi đảo có kiểm tra version, chỉ hoàn tác trường do batch sở hữu và chưa có sửa đổi tiếp theo; không xóa resident dùng chung khi batch khác đã tham chiếu. Giữ nguyên audit. Thời hạn giữ raw nguồn, quyền truy cập và xóa theo chính sách vận hành được chốt trước khi dùng dữ liệu thật.

## 5. Mapping và quy tắc nhập

| Nguồn | Đích | Quy tắc |
| --- | --- | --- |
| Họ tên, giới tính | resident | Chuẩn hóa Unicode/space; giữ nguyên bản; Nam/Nữ map enum hiện có |
| Ngày sinh | birth_date + precision | Parse ô ngày hoặc dd/MM/yyyy; không dùng cached tuổi thay ngày sinh |
| ĐDCN/CCCD/CMND | staging → resident_identity | Giữ text/kiểu nguồn; chỉ lập danh tính đã xác minh sau đối soát loại và số |
| Họ tên cha/mẹ | resident.father_name/mother_name | Không tạo FK tự động từ tên |
| HSCT + chủ hộ | household + membership | HSCT có phạm vi, kiểm tra 15 nhóm bất đồng; tên không phải khóa duy nhất |
| Ngày ĐKTT Thường trú | permanent record.registration_date | Không nhập vào temporary_registered_at |
| Ngày ĐKTT / hạn Tạm trú | temporary record | Giữ ngày và nhãn nguồn; tính hạn theo ngày báo cáo |
| NOHT Column1/Column2 | status/classification | Đổi tên ở mapping; không lưu hai cột vô nghĩa trong schema nghiệp vụ |
| Địa chỉ mỗi vai trò | residence_address + record_address | Giữ raw; đối soát địa bàn, hộ và công trình riêng |
| Đánh X | residence_verification | PRESENT theo nguồn, chưa có ngày/người xác minh; trống UNKNOWN |
| Sheet1/Sheet2 | kiểm tra chéo | Không tạo nhân khẩu/record mới |

Thứ tự ghép: định danh đã xác minh + kiểm tra tên/ngày sinh → đối chiếu thủ công khi xung đột → ứng viên tên + ngày sinh + địa chỉ khi định danh chưa đủ. Không auto merge theo tên. Với DB hiện tại, 0 khớp định danh và 32 dòng khớp tên chỉ là kết quả dò ứng viên; không chứng minh 2.039 dòng đều là người mới hoặc DB không có cùng người.

Khử trùng cấp sự kiện dựa trên người đã xác minh + loại nghiệp vụ + ngày đăng ký/hiệu lực + địa chỉ và nguồn, có xử lý ngày thiếu. 78 nhóm giao Tạm trú/NOHT có thể giữ hai nghiệp vụ trên cùng người; năm dòng lặp nội bộ Tạm trú cần so toàn bộ nội dung trước khi chọn cùng hay khác đợt. Không cộng hai hồ sơ thành hai người trong thống kê dân số.

## 6. Kế hoạch triển khai theo thứ tự

| Bước | Công việc | Điều kiện hoàn thành |
| --- | --- | --- |
| P0.1 | Xác nhận TC2–Ấp 62, ý nghĩa HSCT/ĐKTT/thời hạn/NOHT/Đ19, quy ước định danh | Có mapping version, người xác nhận và ngày hiệu lực; mọi điểm chưa rõ có trạng thái review |
| P0.2 | Profile lại môi trường đích, backup và restore sang DB riêng; xác định dữ liệu giả/lịch sử | Restore đọc được, tổng bản ghi/FK đối chiếu; không nhầm 896 điểm TC2 với 896 hộ thật đã xác minh |
| P1.1 | Liquibase mới: staging/provenance, các trường resident nullable, bỏ bắt buộc phone khi phù hợp | Chạy trên DB restore; entity/DTO/.jhipster/validation thống nhất; chưa thay đường đọc cũ |
| P1.2 | Thêm identity, record/address, membership, verification/classification, alias | FK/index/check đầy đủ; quy tắc uniqueness và cạnh tranh giao dịch đã kiểm tra |
| P1.3 | Chuẩn hóa định danh server, chuyển dữ liệu cũ theo nguồn; thêm audit/version | Không lộ raw identity; không hợp nhất dữ liệu giả với hồ sơ nguồn; mọi xung đột được ghi |
| P2.1 | Import dry-run cả workbook vào staging trên DB riêng | Đúng 2.039 dòng nghiệp vụ; phụ 671/224 không nhập; bảng lỗi/trùng/ứng viên đầy đủ |
| P2.2 | Đối soát hộ/định danh/địa bàn; chạy apply có giao dịch và ledger | Duyệt quyết định theo dòng/nhóm; hồ sơ chưa rõ không vào thống kê chính thức |
| P2.3 | Chuyển service/API/UI sang record và projection tương thích | CRUD/tra cứu/hạn/tổng hợp/RBAC chạy thống nhất; UI phân biệt dữ liệu nguồn/chưa xác minh |
| P3 | Canary theo nhóm đã duyệt, đối chiếu trước/sau, mở rộng; gỡ dần cột cũ ở release sau | Không mất liên kết GIS/audit; nhập lại không nhân đôi; rollback thử đạt; không còn writer cũ trước drop |

Mỗi thay đổi dùng changeset mới được include trong Liquibase master, không sửa changeset đã chạy. Tách migration cộng thêm, backfill và xóa cột thành các đợt riêng. Khi backfill lớn, chia batch có checkpoint; schema migration không kiêm nhập file PII. Chưa chốt ngày phát hành trước khi xong P0 và dry-run.

## 7. Kiểm thử và tiêu chí nghiệm thu

1. Parser đọc cả ô ngày/text, giữ số 0 và loại giấy tờ, không coi dòng đầu sheet phụ là header; đọc được 2.035 công thức tuổi nhưng không lưu tuổi cố định. File có cấu trúc lạ phải báo lỗi mapping.
2. Reconcile: 1.375 + 380 + 280 + 4 = 2.039 dòng; 82 nhóm trùng, 83 dòng vượt khóa; 671/224 dòng phụ không tạo entity. Không buộc số người đích bằng 1.956 trước xác minh.
3. Mỗi dòng có kết quả áp dụng/ghép/chờ duyệt/từ chối và lý do. Tổng các trạng thái bằng tổng nguồn; mỗi entity mới có provenance. 15 HSCT bất đồng không bị tự chọn chủ hộ.
4. Thiếu ngày/phone/quan hệ/địa chỉ chuẩn hóa không tạo giá trị giả. Dấu X, trống và xác nhận vắng được phân biệt; 30 dòng hạn quá ngày tham chiếu hiện trong danh sách đối soát, không tự chuyển loại cư trú.
5. Một người có cả Tạm trú/NOHT không nhân đôi danh tính; đăng ký/gia hạn/chuyển nơi ở giữ lịch sử. Chạy lại cùng batch và retry sau lỗi không nhân đôi người, record hoặc membership.
6. API scope kiểm tra trên record/địa bàn đã xác minh; địa chỉ ngoài phạm vi không làm lộ hồ sơ. Import không được đổi phân công, polygon hoặc liên kết nhà để đi qua quyền. Tra cứu/thống kê/xuất dữ liệu áp dụng cùng scope.
7. Không lộ định danh trong log, lỗi import, DTO hay Git. Kiểm thử HMAC/giải mã/đổi khóa, xung đột identity đồng thời, version conflict và hai lần apply song song.
8. So tổng cư dân độc nhất theo phạm vi/thời điểm, số hồ sơ theo loại và số lượt xác minh thành các chỉ tiêu riêng. Bộ đếm hộ và `hamlet.population_count` không còn là dữ liệu tự nhập độc lập thiếu nguồn; báo cáo phải nêu quy tắc người đang ở thực tế khác người đăng ký thường trú.
9. Backup–restore và rollback batch có sửa tiếp theo phải giữ chỉnh sửa mới, không xóa người dùng chung. Kiểm tra trước/sau số liên kết GIS, hộ, nhân khẩu, FK và audit. Chạy integration test trên PostgreSQL; không dùng H2 thay bằng chứng constraint/index đặc thù.

## 8. Các quyết định cần chốt trong bước P0

- Ấp 62 là alias toàn phần của Trung Chánh 2 hay địa bàn sau sắp xếp khác phạm vi? Nguồn xác nhận và ngày hiệu lực nào?
- Cách xác minh số định danh bị lưu dạng số; hai giá trị text ở Đ19 thuộc loại giấy tờ nào? Có bản xuất giữ text không mất số 0 không?
- HSCT có duy nhất theo đơn vị/thời kỳ không; 15 nhóm tên chủ hộ khác nhau phản ánh lịch sử hay lỗi?
- Ngày nguồn được chốt lúc nào, dấu X do ai ghi và tại thời điểm nào? Cột thời hạn là ngày hết hạn hay mốc khác; 30 dòng đã có gia hạn chưa?
- Chốt mô hình nghiệp vụ NOHT/Đ19 với cán bộ phụ trách, không suy diễn từ tên sheet thành quy tắc pháp lý. Nếu cần quy định pháp luật cụ thể phải xác minh văn bản hiện hành riêng.

Các quyết định này chặn việc áp dụng dữ liệu tương ứng, không chặn xây staging, lập bảng đối soát, migration cộng thêm và kiểm thử trên bản sao. Phạm vi yêu cầu hiện tại dừng ở khảo sát và lập kế hoạch; chưa tự triển khai các thay đổi trên database đang sử dụng.
