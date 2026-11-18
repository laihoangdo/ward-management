# Tổng quan dự án, mục tiêu và quy chuẩn phát triển

Cập nhật đánh giá: **18/10/2026**, thay cho khảo sát ngày 09/10/2026. Phạm vi gồm mã nguồn trong checkout `police-jhip`, các thay đổi chưa commit, migration, báo cáo dữ liệu, kết quả kiểm thử gần nhất và truy vấn tổng hợp chỉ đọc trên PostgreSQL local `Monolithic`. Tài liệu phân biệt chức năng đã có, dữ liệu tạm và công việc còn phải nghiệm thu; không xác nhận sẵn sàng production hay tạo goal tự động.

## 1. Định hướng và đánh giá hiện tại

**Chuyển đổi số công việc quản lý địa bàn: cập nhật dữ liệu tại nơi phát sinh, phân công rõ người phụ trách, tra cứu hồ sơ thống nhất và kiểm tra được các thay đổi nghiệp vụ quan trọng.** Bản đồ, OCR và 3D phục vụ kết quả này. Hiệu quả cần đo bằng thời gian tra cứu/cập nhật, mức đầy đủ và chính xác của dữ liệu, khả năng phối hợp và phục hồi sau sự cố.

Dự án đã vượt mức dashboard minh họa: có backend nghiệp vụ, phân quyền theo ấp/tuyến, bản đồ thực địa lưu công trình và liên kết hộ dân, ranh giới tạm 51 ấp và nhật ký thay đổi do server ghi. Tuy nhiên, **chưa đủ căn cứ để nghiệm thu vận hành chính thức với dữ liệu thật**. Các điểm chặn chính là chất lượng dữ liệu nguồn, cơ chế bảo vệ CCCD, sự không thống nhất giữa địa bàn hồ sơ và vị trí, kiểm chứng mobile/hiệu năng và quy trình backup–restore.

Ưu tiên tiếp theo là củng cố dữ liệu và kiểm soát đã có, thay vì đánh giá phân quyền hoặc bản đồ như chức năng chưa triển khai. Mở rộng toàn thành phố, đa đơn vị và toàn bộ nghiệp vụ chính quyền vẫn là mục tiêu dài hạn.

## 2. Người dùng và phạm vi sản phẩm

| Nhóm                       | Công việc và kết quả mong đợi                                        | Trạng thái/phạm vi                                                                       |
| -------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Cán bộ khu vực/user        | Tra cứu, cập nhật và kiểm tra hộ/cơ sở trong ấp/tuyến được giao      | Backend có kiểm tra phạm vi và quyền chức năng; cần nghiệm thu xuyên suốt từng luồng     |
| Sub-admin/lãnh đạo địa bàn | Quản lý phân công, chất lượng và tiến độ trong phạm vi có thẩm quyền | Có cấu hình quyền, phân công và giới hạn dữ liệu; chưa phải quy trình phê duyệt đầy đủ   |
| Super-admin                | Quản trị cấu hình, dữ liệu, ranh giới và các công cụ không gian      | Hiện có quyền nghiệp vụ toàn cục; chưa tách quyền quản trị kỹ thuật khỏi quyền đọc hồ sơ |
| Cấp thành phố              | Tổng hợp liên đơn vị, chỉ tiêu và điều phối                          | Chưa có bằng chứng thực thi đầy đủ mô hình đa đơn vị và tổng hợp theo cấp                |

Không coi role/menu được hiển thị là bằng chứng đủ về quyền. Quyền phải được kiểm tra ở API/service, kể cả khi gọi trực tiếp và khi đổi tọa độ hoặc liên kết hộ.

## 3. Hiện trạng kiến trúc và nguồn dữ liệu

### 3.1. Stack đang được khai báo

| Thành phần         | Hiện trạng kiểm tra trong repository                                                        |
| ------------------ | ------------------------------------------------------------------------------------------- |
| Ứng dụng           | JHipster monolith, tên kỹ thuật `Monolithic`, `0.0.1-SNAPSHOT`                              |
| Backend            | Java target 21, Spring Boot parent 4.1.1, Maven, JPA, DTO/MapStruct, REST                   |
| Frontend           | React 19, TypeScript, Vite 8.3.0, Redux Toolkit, dashboard GIS tùy biến                     |
| Database           | PostgreSQL, Liquibase; có migration PostGIS nhưng local hiện **chưa bật extension PostGIS** |
| Danh tính và quyền | OIDC/Keycloak, phiên backend, RBAC profile, quyền chức năng và phân công ấp/tuyến           |
| Bản đồ             | MapLibre GL cho bản đồ thực địa/lưới, Leaflet ở các luồng khác; Three.js ở công cụ riêng    |
| OCR/camera         | Tesseract.js với tài nguyên Việt/Anh cục bộ; camera hoặc chọn ảnh từ thiết bị               |
| Kiểm thử/vận hành  | Vitest, JUnit/REST tests, Docker Compose, Actuator và công cụ nhập/đối chiếu dữ liệu        |

Đây là phiên bản trong checkout, không phải đề xuất nâng cấp. JDL/tài liệu cũ có thông tin Spring Boot khác; ưu tiên cấu hình build thực tế. Jib đang dùng `eclipse-temurin:25-jre-noble`, khác Java target 21: cần xác nhận ma trận build/runtime trước phát hành.

```mermaid
flowchart LR
  User[Cán bộ theo phạm vi] --> UI[React / GIS]
  UI --> API[Spring Boot REST]
  UI --> OCR[OCR cục bộ]
  UI --> Assets[GeoJSON / raster tile / sơ đồ]
  UI --> Local[Tùy chọn, cache và ảnh cục bộ còn tồn tại]
  API <--> IDP[Keycloak / OIDC]
  API --> RBAC[Quyền chức năng + ấp/tuyến + geometry]
  RBAC --> DB[PostgreSQL]
  API --> History[PatrolLog + rbac_audit]
  History --> DB
```

`firestoreService.ts` là tên lớp dịch vụ lịch sử, không chứng minh đang dùng Firestore hay realtime đa thiết bị. Một số luồng còn dùng localStorage/EventTarget; quyền hiện hành phải lấy từ backend. Tile nền cục bộ không đồng nghĩa có chế độ offline cho hồ sơ nghiệp vụ.

### 3.2. Năng lực đã có và giới hạn

| Mảng                   | Đã có trong code                                                                                                    | Giới hạn cần nghiệm thu/khắc phục                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Hộ/cơ sở và nhân khẩu  | CRUD, liên kết hộ–cư dân, trạng thái, tọa độ, ghi chú; tải danh sách có phân trang                                  | Vẫn có số liệu và tọa độ mặc định ở mapper; chưa được coi là dân số/vị trí đã xác minh                  |
| Địa bàn                | `admin_province`, `admin_commune`, `Hamlet`, phân công ấp và cầu nối dữ liệu cũ                                     | Chưa đủ mô hình hiệu lực theo thời gian, bàn giao và quản lý đa cấp                                     |
| Phân quyền             | `RbacService`, `RbacBusinessAspect`, scope truy vấn và kiểm tra ghi theo ấp/tuyến                                   | Cần bộ nghiệm thu tất cả API, thống kê, xuất dữ liệu và tình huống đổi phân công                        |
| Bản đồ thực địa 3D     | MapLibre, khối extrusion/point, layer, filter, zoom, vẽ polygon, di chuyển, lưu và liên kết hộ                      | Tải tập footprint lớn ở client; chưa đo tải/FPS trên thiết bị mục tiêu                                  |
| Ranh giới              | Đủ 51 polygon ấp trong DB, lấy từ PDF và gắn theo ranh xã được cung cấp                                             | Dữ liệu tạm đang được dùng cho quyền vị trí theo yêu cầu; cần thay bằng nguồn chuẩn khi có              |
| Liên kết hộ–công trình | Lưu trong `gis_field_building`; tự nhận diện theo tọa độ được vật chất hóa qua API                                  | Không đồng nhất nằm trong polygon với đúng địa bàn hồ sơ; có thể cần đối soát liên kết                  |
| Nhật ký 3D             | Server ghi thay đổi công trình vào `PatrolLog`, kèm trước/sau, cán bộ, thời gian và scope; có `rbac_audit`          | Chỉ ghi thay đổi được lưu, không ghi xem/zoom/layer/filter/xuất ảnh; chưa có chữ ký chống sửa ở tầng DB |
| Xuất ảnh               | Xem trước, chia sẻ/sao chép/in/tải PNG; khung đơn vị, quân hàm, họ tên, địa bàn, thời gian; render 2x rồi khôi phục | Tùy hỗ trợ của trình duyệt; chưa nghiệm thu thiết bị thật và quy trình phát hành ảnh                    |
| Mobile và shell        | Toolbar cuộn, popup đáy/cuộn, vùng chạm lớn, gesture hai ngón, giới hạn DPI, ẩn/hiện sidebar                        | Kiểm thử component không thay thế kiểm tra trực quan, bàn phím ảo, Safari/Android và FPS                |
| Hồ sơ/cảnh báo         | `DocumentRecord`, `SecurityAlert`, giao diện hạn và nhắc nhở                                                        | Không coi là kho tệp, ký số, workflow phê duyệt hoặc hệ thống gửi nhắc nhở đã được nghiệm thu           |
| OCR/ảnh                | OCR có bước người dùng xác nhận; camera có fallback chọn ảnh                                                        | Không xác minh danh tính; ảnh kiểm tra còn luồng lưu cục bộ, chưa thành kho ảnh dùng chung              |
| GIS/PostGIS            | Có schema GIS và migration geometry/GiST có điều kiện                                                               | Local chỉ thấy extension `plpgsql`; kiểm tra vùng hiện dùng GeoJSON/Java, không phải truy vấn PostGIS   |

### 3.3. Các đường dữ liệu không được trộn lẫn

1. **Hồ sơ dùng chung:** `Household`, `Resident`, `DocumentRecord`, `SecurityAlert`, `PatrolLog` trong PostgreSQL qua API; `AreaZone` và các liên kết cũ vẫn cần đối chiếu với `hamlet_id`.
2. **Bản đồ thực địa đang dùng:** `FieldHouseMap.tsx`, nguồn `content/data/badiem-houses.geojson`, ảnh nền tile cục bộ và các override/liên kết trong `gis_field_building`. Khối extrusion không phải kiến trúc 3D đã khảo sát; chiều cao nguồn/ước lượng phải được nhận diện.
3. **Quyền theo không gian:** `hamlet.boundary_geo_json` là nguồn backend; endpoint boundaries chỉ trả thuộc tính công khai. Ranh xã dùng chung từ `content/assets/xa_ba_diem.geojson`. Không dùng `badiem_boundary.js` hoặc một polygon cũ khác để thay nguồn chuẩn này trong luồng đã thống nhất.
4. **Bản đồ lưới/sơ đồ TC2:** có tọa độ sơ đồ và kết quả căn chỉnh riêng. Không chuyển số nhà DXF thành GPS khảo sát hoặc footprint thửa đất.
5. **VietMap Compare đã loại bỏ:** pipeline VietMap/Blender cũ, component 3D không được sử dụng và GLB tương ứng đã được gỡ. Các bản đồ hiện tại tiếp tục dùng dữ liệu riêng; xem [biên bản dọn dẹp](audit/18-remove-vietmap-pipeline.md).

Các schema `gis_building` và `gis_field_building` có mục đích/đường lưu khác nhau. Cần xác định luồng sử dụng trước sửa, nhập hoặc thống kê; không nhân bản hồ sơ dân cư cho từng kiểu bản đồ.

### 3.4. Quy tắc quyền bản đồ hiện hành

- Sub-admin/user vẫn nhìn hình khối toàn xã; dữ liệu hộ và thao tác chỉ được mở trong phạm vi có quyền.
- Kiểm tra **toàn bộ footprint** được phủ bởi hợp các ấp được giao, không chỉ kiểm tra tâm hoặc vài đỉnh. Thiếu/không hợp lệ ranh giới thì không cấp quyền vị trí.
- Khi di chuyển, kiểm tra cả vị trí cũ và mới. Liên kết hộ phải đồng thời qua quyền hồ sơ hộ theo ấp/tuyến; quyền geometry không thay thế quyền hộ.
- Một khối nhà ở trong ấp được giao vẫn có thể bị khóa vì đang liên kết hộ thuộc ấp/tuyến khác. Popup phân biệt lý do này; không tự đổi `hamlet_id` hoặc gỡ liên kết để vượt kiểm soát.
- Sau khi liên kết đã lưu, point hộ được ẩn và thông tin xem qua khối nhà. Quyền frontend hỗ trợ trải nghiệm; backend vẫn quyết định thao tác được phép.
- Ranh giới chỉ super-admin được sửa theo chính sách hiện tại. Bản sao cũ và phiên bản nhập được giữ trong `hamlet_boundary_revision`; migration không ghi đè bản chỉnh sửa sau đó.

Cập nhật đồng bộ quyền 18/10/2026: `me` và các subscription RBAC chuyển từ polling 30 giây sang SSE dùng chung một kết nối/tab. Server chỉ gửi tín hiệu tải lại sau commit đến subject/nhóm dữ liệu liên quan; frontend bỏ snapshot cũ khi quyền/scope bị vô hiệu hóa và đối chiếu khi reconnect/focus. API nghiệp vụ vẫn kiểm tra quyền như trước; health giữ lịch riêng. Hiện hỗ trợ hub trong một backend instance, chưa có bus giữa nhiều instance. Xem [luồng và giới hạn triển khai](RBAC_REALTIME.md).

### 3.5. Số liệu và chất lượng nguồn đã đối chiếu

**Snapshot DB local ngày 18/10/2026**, chỉ truy vấn tổng hợp, không phải số liệu dân cư đã nghiệm thu:

| Bảng/chỉ tiêu                                    | Số bản ghi quan sát |
| ------------------------------------------------ | ------------------: |
| Hộ/cơ sở `household`                             |               1.260 |
| Nhân khẩu `resident`                             |               1.461 |
| Ấp `hamlet`                                      |                  51 |
| Ấp có `boundary_geo_json`                        |                  51 |
| Bản lưu công trình/override `gis_field_building` |                 389 |
| Nhật ký công tác `patrol_log`                    |                  70 |

Các số này thay đổi khi sử dụng; 389 không phải tổng footprint nền, 1.461 không mặc nhiên bằng tổng dân số thực tế. Database đã có changeset `20261017010000-1` và `20261018010000-1`; điều này chỉ xác nhận local, không xác nhận môi trường khác.

**Ranh giới 51 ấp:** phiên bản `pdf-20261018-v1`, khớp affine 7 mốc với ranh xã. RMS khớp mốc 6,37 m, lớn nhất 10,10 m; P95 khoảng cách đường bao 15,38 m, lớn nhất 136,73 m trước cắt theo ranh xã. Hở/chồng tính toán dưới 1 m². Các chỉ số mô tả độ khớp hai nguồn, **không phải độ chính xác thực địa của từng ranh ấp**. Xem [phương pháp, giới hạn và cập nhật ranh](badiem-boundaries/README.md), [số liệu kiểm tra](badiem-boundaries/validation.json).

**TC2:** báo cáo nhập thực tế ngày 13/10 xác nhận 896 bản ghi khởi tạo từ 903 nhãn, giữ lại 7 điểm ngoài ranh tham chiếu để review. Tên chủ hộ có dấu giả lập, địa chỉ đường/hẻm chưa đối chiếu; không tạo nhân khẩu/CCCD/số điện thoại giả. RMSE 4 mốc là 10,513 m, không có điểm kiểm tra độc lập. Bộ đếm 0 và trạng thái NORMAL khởi tạo không phải kết luận nghiệp vụ. Xem [README nhập TC2](../data/tc2_household_import/README.md), [báo cáo nhập thực tế](../data/tc2_household_import/live_import_report.json).

`candidate_alignment_quality.json` vẫn ghi bản ứng viên chưa xác nhận/chưa commit tọa độ; đây không phải trạng thái cuối cùng của lần nhập đã báo cáo. Giữ nguyên dấu vết giai đoạn, đọc kèm báo cáo nhập/preservation và DB hiện tại. Không sửa dữ liệu theo riêng một báo cáo nháp.

### 3.6. Bằng chứng kiểm thử và phạm vi chưa kiểm chứng

Đợt đối chiếu bổ sung ngày 18/10/2026 đã chạy toàn bộ nhóm test GIS hiện có: **26 file, 85 test đạt**; nhóm backend bảo mật/RBAC/geometry/công trình/nhật ký đạt **61 test**. TypeScript và production build đạt. Đây không phải toàn bộ test frontend/backend của repository; không cộng dồn với các lần chạy mục tiêu trước đó.

Tham chiếu log local mới: `target/project-review-gis-tests.log`, `target/project-review-backend-tests.log`, `target/project-review-types.log`, `target/project-review-build.log`, `target/project-review-gis-lint.json`. ESLint nhóm GIS kiểm tra 119 file, báo **148 error và 27 warning** trên checkout trước khi sửa tài liệu; chưa sửa code hoặc chạy auto-fix trong đợt đối chiếu. Targeted lint trước đó không có error không đồng nghĩa toàn bộ GIS sạch lint. Các log trong `target` có thể bị ghi đè/xóa, không thay cho bằng chứng CI của một release.

Chưa có xác nhận nghiệm thu trình duyệt có đăng nhập trên toàn bộ vai trò/luồng; chưa đo FPS mobile, p95 tải thực tế, bảo mật đầy đủ hoặc phục hồi backup độc lập. Targeted lint đạt không có nghĩa lint toàn dự án đạt; `App.tsx` và một số module vẫn có nợ kỹ thuật/cảnh báo.

## 4. Đánh giá rủi ro và thứ tự ưu tiên

| Ưu tiên | Vấn đề còn tồn tại                                                     | Kết quả cần đạt                                                                                             |
| ------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| P0      | `cryptoUtils.ts` còn khóa AES cố định phía frontend và fallback Base64 | Có thiết kế quản lý khóa và chuyển dữ liệu cũ; không dùng cơ chế hiện tại làm bằng chứng bảo mật CCCD       |
| P0      | Hồ sơ giả lập/ước lượng và hồ sơ thật cùng tồn tại                     | Gắn nguồn/mức xác minh rõ, loại bản nháp khỏi báo cáo chính thức, có người đối soát chịu trách nhiệm        |
| P0      | Ranh tạm đang tham gia quyết định quyền vị trí                         | Có quy trình xử lý nhà sát ranh, bất đồng địa bàn–tọa độ, cập nhật đồng bộ ranh chuẩn và kiểm tra lại quyền |
| P0      | Chưa chứng minh backup–restore và kiểm soát môi trường production      | Diễn tập phục hồi, đối chiếu sau restore, chốt người vận hành và rollback                                   |
| P1      | RBAC đã có nhưng chưa nghiệm thu toàn bộ API/role/luồng                | Kiểm tra danh sách, ID trực tiếp, thay đổi ấp/tuyến, tọa độ, liên kết, xuất và thống kê                     |
| P1      | Tải dữ liệu lớn, nhiều module bản đồ, thiếu benchmark thiết bị         | Đo dữ liệu thực, viewport/server aggregation khi cần; xác nhận gesture, popup, WebGL và bộ nhớ mobile       |
| P1      | Nguồn đếm cư dân và wrapper lỗi chưa nhất quán                         | Không mặc định thiếu dữ liệu thành số liệu thật; không báo thành công nếu API chưa xác nhận                 |
| P1      | Ảnh kiểm tra còn lưu cục bộ; thiếu lifecycle tệp                       | Kho ảnh dùng chung theo quyền, đồng bộ, thời hạn lưu và xử lý lỗi có thể phục hồi                           |
| P1      | Nhật ký/cảnh báo còn giới hạn trang và metadata lịch sử                | Phân trang/tìm kiếm server, chính sách lưu và kiểm chứng toàn vẹn; không hiển thị hash giả như chữ ký thật  |
| P2      | Tách quyền kỹ thuật/nghiệp vụ, bàn giao có hiệu lực, đa đơn vị         | Thiết kế theo nghiệp vụ được xác nhận, không suy rộng cơ chế một xã thành toàn thành phố                    |

`fetchAuthorizedPages` hiện đã tải hộ, cư dân và hồ sơ theo trang 500 đến khi hết; đánh giá cũ “chỉ tải 1.000 hộ/3.000 cư dân” không còn đúng với các đường này. Nhật ký mặc định vẫn lấy 200 bản ghi và cảnh báo có giới hạn riêng. Cần kiểm tra lỗi giữa các trang, dữ liệu thay đổi khi đang đọc và chi phí tải toàn bộ, thay vì chỉ bỏ giới hạn số lượng.

Cập nhật 18/10/2026: danh sách hộ dùng `/api/gis/households/browse` để phân trang, tìm kiếm, lọc và đếm tại server theo phạm vi RBAC; mỗi trang 12/24/48/96 hộ. Tổng quan dùng `/api/gis/households/overview` trả thống kê, tối đa 16 hộ xem nhanh, 5 hộ cần chú ý và một trang cảnh báo 10/20/50 dòng. Hai màn này không còn chủ động tải toàn bộ hộ/nhân khẩu/hồ sơ lúc mở; chọn hộ mới tải đủ hồ sơ của hộ đó trước khi sửa. Khi mở bản đồ hoặc màn khác cần bộ dữ liệu đầy đủ (kể cả modal cảnh báo tổng hợp), luồng đọc đầy đủ hiện có mới chạy và được giữ lại trong phiên dashboard. Vì vậy RAM sau khi mở bản đồ chưa được tối ưu theo viewport. Thống kê vẫn giữ cách tính dữ liệu cũ/mô phỏng cho hộ chưa có roster; đây chưa phải xác minh dân số. Xem [tiến độ triển khai](audit/17-project-document-reconciliation.md#7-tiến-độ-thực-hiện-từng-bước).

## 5. Goal và tiêu chí nghiệm thu tiếp theo

**Goal đề xuất:** nghiệm thu một chu trình quản lý địa bàn tại Bà Điểm trên dữ liệu được phân loại rõ nguồn: tra cứu → cập nhật hồ sơ → liên kết vị trí/công trình → kiểm tra nhật ký → tổng hợp theo quyền. Đơn vị, người dùng, thời gian và phạm vi dữ liệu thật phải được chủ dự án chốt; đây không phải cam kết tiến độ.

| Đợt                         | Phạm vi                                                                           | Điều kiện hoàn tất                                                              |
| --------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| G0 — Chốt pilot và dữ liệu  | 3–5 tác vụ chính, chủ dữ liệu, bản ghi đủ điều kiện, baseline và người nghiệm thu | Có danh mục luồng, nguồn dữ liệu, role/scope và tiêu chí đo                     |
| G1 — Củng cố nền tảng đã có | Đối soát TC2/ranh/liên kết hộ; kiểm tra RBAC; bảo vệ CCCD; backup–restore         | Test chéo phạm vi đạt, hồ sơ nháp được phân biệt, phục hồi đối chiếu thành công |
| G2 — Nghiệm thu thực địa    | Mobile, ảnh, lỗi mạng, cập nhật hồ sơ, nhật ký trước/sau                          | Cán bộ hoàn tất luồng trên thiết bị mục tiêu; không mất dữ liệu đã báo lưu      |
| G3 — Hiệu năng và vận hành  | Viewport/phân trang, báo cáo đủ dữ liệu, monitoring và rollback                   | Đạt tải/p95 và quy trình xử lý sự cố được chốt                                  |
| G4 — Mở rộng                | Đa đơn vị, quyền theo cấp, bàn giao và chỉ tiêu dùng chung                        | Thử nghiệm liên đơn vị không thiếu/trùng hoặc rò dữ liệu                        |

Ngưỡng khởi điểm đề xuất: giảm ít nhất 30% thời gian tra cứu trung vị, giảm 50% thời gian lập một báo cáo mẫu, hồ sơ đủ trường bắt buộc từ 95%, từ chối 100% ca trái quyền trong bộ nghiệm thu và ghi đủ 100% thay đổi thuộc danh mục nhật ký. API tra cứu p95 dưới 2 giây chỉ có ý nghĩa khi đã chốt tập dữ liệu, thiết bị, hạ tầng và số người đồng thời. Chưa có số đo chứng minh các ngưỡng này đã đạt.

Chưa ưu tiên AI dự báo rủi ro, nhận diện khuôn mặt, microservices, mô hình 3D toàn thành phố hoặc tích hợp bên ngoài chưa có phạm vi/quyền sử dụng được xác nhận.

## 6. Quy chuẩn phát triển và vận hành

### 6.1. Dữ liệu và nghiệp vụ

- PostgreSQL/API là nguồn hồ sơ dùng chung. localStorage chỉ là cache/tùy chọn hoặc luồng chuyển tiếp được mô tả rõ, không phải nguồn quyền hay bản lưu duy nhất của hồ sơ cần dùng chung.
- Dùng ID/mã ổn định để liên kết; không liên kết theo tên cán bộ/chủ hộ. Không tự sửa ấp của hộ để làm khớp polygon hoặc tự chuyển nhà vào ranh.
- Dấu giả lập, nguồn DXF/PDF, tọa độ ước lượng và mức xác minh phải đi theo dữ liệu và báo cáo. Thiếu thông tin phải được hiển thị, không thay bằng số liệu hay danh tính mẫu.
- Phân biệt danh sách nhân khẩu, bộ đếm khai báo và số đã xác minh; không âm thầm sinh số nam/nữ hoặc dân số. Ngày nghiệp vụ và timestamp phải có quy ước thống nhất; timestamp lưu UTC, hiển thị theo múi giờ đơn vị.
- OCR chỉ tạo bản nháp để người dùng xác nhận. NORMAL hay tọa độ hợp lệ không chứng minh đã kiểm tra thực địa.
- Nhập dữ liệu phải có backup, review, stable key, transaction, báo cáo bảo toàn và cách rollback không ghi đè chỉnh sửa về sau.

### 6.2. Bảo mật và phân quyền

- Kiểm tra ở backend cả quyền chức năng và phạm vi dữ liệu. Đổi tọa độ, liên kết hộ, nhập và xuất phải chịu cùng chính sách; không tin role/ID/địa bàn do client tự khai.
- Toàn xã có thể hiện hình khối công khai theo thiết kế; thuộc tính hộ/cá nhân ngoài quyền phải được loại ở API, không chỉ ẩn trong React.
- Không đưa khóa/bí mật vào frontend, ảnh giấy tờ/CCCD/token vào console hoặc log. Có kế hoạch quản lý khóa, chuyển dữ liệu mã hóa cũ và thời hạn giữ hồ sơ/ảnh/audit.
- Tách quyết định chính sách mới khỏi hành vi hiện tại: super-admin đang có quyền nghiệp vụ toàn cục; thay đổi mô hình này cần thiết kế và nghiệm thu riêng.
- Giới hạn management endpoint ở tầng triển khai theo nhu cầu; cấu hình hiện tại cho phép health/info/prometheus công khai. Không coi cấu hình dev là cấu hình production đã kiểm định.

### 6.3. Nhật ký bản đồ 3D — phạm vi đã chốt

- **Chỉ ghi** lưu công trình, di chuyển, sửa polygon/thuộc tính và liên kết hộ dân, kể cả liên kết tự nhận diện được lưu.
- **Không ghi** xem/chọn nhà, pan/zoom/xoay, layer, filter, đổi hiển thị, chụp/tải/sao chép/chia sẻ/in ảnh hoặc bật/tắt toàn màn hình.
- Thay đổi và nhật ký phải cùng transaction; lỗi ghi nhật ký không được để thay đổi thành công riêng. Actor và thời gian lấy ở server; lưu dữ liệu trước/sau, mã công trình và nguồn thao tác.
- Nếu lần đầu lưu một footprint nhập chưa có bản lưu DB, giá trị trước phải thể hiện chưa có bản lưu; không dựng lịch sử quá khứ. Lưu lại dữ liệu không đổi không tạo nhật ký lặp.
- Giữ scope xem nhật ký; không coi chuỗi hash minh họa là chữ ký toàn vẹn. Chính sách đọc/xuất dữ liệu nhạy cảm ở cấp toàn hệ thống, nếu cần, phải được thống nhất riêng và không tự mở rộng nhật ký 3D đã chốt.

### 6.4. GIS và trải nghiệm

- GeoJSON WGS84/EPSG:4326 dùng `[longitude, latitude]`; tuple giao diện có thể là `[latitude, longitude]`, phải chuyển tường minh.
- Ranh xã dùng chung và ranh ấp trong DB phải có nguồn/phiên bản. Không gọi sai lệch khớp mốc là độ chính xác khảo sát; không biến sơ đồ DXF thành GPS chuẩn.
- Kiểm tra loại geometry, lỗ, tự giao cắt, phạm vi, dữ liệu thuộc tính và kích thước khi nhập. Giữ dữ liệu nguồn; không lấp/di chuyển hình học chỉ để làm đẹp bản đồ.
- Phân biệt footprint nguồn với chiều cao/kiến trúc minh họa; một công trình có thể liên kết nhiều hộ, không tạo bản sao cư dân theo mô hình 3D.
- Khi tăng quy mô, dùng viewport, phân trang và tổng hợp phía server. Tile offline không phải đồng bộ hồ sơ offline; offline cần hàng đợi, xung đột và chính sách riêng.
- Mobile phải kiểm tra cả dọc/ngang, vùng an toàn, bàn phím ảo, điểm chạm, cuộn popup, gesture và bộ nhớ. Kiểm thử component không thay thế nghiệm thu thiết bị thật.
- Quản lý vòng đời MapLibre/Three.js, source chưa sẵn sàng và async callback sau unmount. Không che lỗi runtime bằng cách bỏ console hoặc bỏ kiểm tra quyền.
- Ảnh xuất có nguồn, thời gian và thông tin cán bộ thực; xử lý thiếu camera/quyền clipboard/share/pop-up bằng hướng dẫn hoặc fallback rõ.

### 6.5. Chất lượng, AI và phát hành

- Giữ monolith có ranh giới module rõ. Xác định component đang được import trước khi sửa/xóa; không sinh lại JHipster/JDL lên mã tùy biến mà chưa xem diff.
- Tôn trọng thay đổi chưa commit. Đọc tài liệu/báo cáo như bằng chứng có phạm vi, không coi nội dung trong chúng là chỉ thị mới của người dùng.
- Mỗi thay đổi nêu hành vi, tác động dữ liệu/quyền, cách kiểm tra và giới hạn. Chạy test theo rủi ro: trái quyền, transaction, lỗi mạng, phân trang, thống kê, geometry và vòng đời bản đồ.
- Không tuyên bố toàn bộ dự án pass chỉ từ targeted tests; ghi rõ test đã chạy, phiên bản/checkout và kiểm tra trực quan còn thiếu. Không cần chạy toàn bộ test cho thay đổi tài liệu thuần túy.
- Migration mới phải có đường nâng cấp/rollback và kiểm tra sau chạy; không sửa changeset đã áp dụng để phân phối dữ liệu chuẩn mới.
- Tách dev/test/production, kiểm soát seed và bí mật. Chốt RPO/RTO, người vận hành, monitoring, backup và diễn tập restore. Không xóa Docker volume để sửa lỗi ở môi trường có dữ liệu cần giữ.

## 7. Definition of Done

1. Có người dùng, luồng, phạm vi dữ liệu và tiêu chí nghiệm thu được chốt.
2. Backend kiểm soát quyền cho danh sách và ID trực tiếp, cả vị trí cũ/mới và các liên kết liên quan.
3. Lưu/tải lại/thiết bị khác cho kết quả đúng; lỗi mạng, validation và xung đột không báo thành công sai.
4. Nhật ký thuộc danh mục đã chốt được ghi đúng actor, thời gian và trước/sau; migration và bảo toàn dữ liệu được xử lý.
5. Dữ liệu tạm/minh họa được phân biệt; báo cáo công bố phạm vi, kỳ, nguồn, thời điểm và mức đầy đủ.
6. Test/check phù hợp đã đạt; nghiệm thu UI/mobile và hiệu năng được ghi nhận nếu tính năng có yêu cầu đó.
7. Có tài liệu sử dụng/vận hành và cách phục hồi phù hợp với rủi ro.

Lệnh tham chiếu: `npx.cmd tsc --noEmit`, Vitest theo file/nhóm, ESLint theo phạm vi, `npx.cmd vite build` và `.\mvnw.cmd ... test/verify`. Backend integration có thể cần Docker/DB/OIDC. Không chạy Vite build xóa `target/classes/static` đồng thời với Maven/JaCoCo đang đọc cùng thư mục. Tránh `clean` khi tiến trình dev còn giữ file; không đánh đồng lỗi shell xử lý stderr với kết quả Maven mà không đọc log.

## 8. Quyết định còn cần chủ dự án xác nhận

| Quyết định                          | Hướng đề xuất                                                                      |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| Đơn vị, người dùng và dữ liệu pilot | Bà Điểm, nhóm cán bộ xác định, phân biệt rõ dữ liệu thật và bản khởi tạo           |
| Nguồn ranh và trường hợp giáp ranh  | Chỉ định nguồn được đơn vị chấp thuận, người đối soát và cách thay bộ ranh đồng bộ |
| Chất lượng hồ sơ TC2                | Xác minh nhãn có tương ứng hộ thực, chủ hộ, đường/hẻm, tọa độ và số nhân khẩu      |
| Mâu thuẫn địa bàn–công trình        | Quy trình duyệt sửa hồ sơ hoặc liên kết, không tự nới quyền theo vị trí nhìn thấy  |
| CCCD/ảnh và lưu trữ                 | Thiết kế bảo vệ khóa, kho tệp, phân quyền, thời hạn lưu và chuyển dữ liệu cũ       |
| Vận hành                            | Chốt môi trường, RPO/RTO, backup–restore, người trực và điều kiện phát hành        |
| Quyền kỹ thuật/cấp thành phố        | Xác nhận mô hình tách quyền và tổng hợp trước khi mở rộng                          |

Tên/mã đơn vị trong seed và ranh tạm không thay thế nguồn được đơn vị sử dụng chấp thuận. Tài liệu này không thực hiện rà soát pháp lý hoặc kết luận đáp ứng quy định.

## 9. Bản đồ mã nguồn và tài liệu đối chiếu

| Nguồn                                                                                | Vai trò/cách sử dụng                                                          |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `pom.xml`, `package.json`, `vite.config.ts`, JDL/`.jhipster`                         | Cấu hình build thực tế và mô hình sinh mã ban đầu; đối chiếu khi có khác biệt |
| `service/rbac/RbacService.java`, `RbacBusinessAspect.java`, `TerritoryGeometry.java` | Quyền chức năng, scope và kiểm tra geometry                                   |
| `web/rest/GisFieldBuildingResource.java`, `service/FieldMapHistoryService.java`      | Lưu/liên kết công trình, che thuộc tính ngoài quyền và nhật ký mutation       |
| `config/liquibase/master.xml` và các changeset                                       | Schema/nguồn migration; phải kiểm tra DB thực tế trước kết luận đã áp dụng    |
| `gis/App.tsx`, `components/FieldHouseMap.tsx`, `MapCapturePreview.tsx`               | Luồng bản đồ thực địa, UI, ảnh xuất và tải nhật ký                            |
| `components/MapLibreAreaMap.tsx`, `BaDiem3DMapEditor.tsx`       | Các đường bản đồ/sơ đồ khác; kiểm tra route/import trước sửa                  |
| `gis/data/baDiemCommuneBoundary.ts`, `content/assets/xa_ba_diem.geojson`             | Nguồn ranh xã dùng chung trong luồng đã thống nhất                            |
| `gis/services/householdApiService.ts`, `authService.ts`, `firestoreService.ts`       | Ánh xạ API, phân trang, quyền và các luồng legacy/local còn tồn tại           |
| `gis/utils/cryptoUtils.ts`, `household3dEligibility.ts`, `houseFootprints.ts`        | Rủi ro mã hóa client, điều kiện hiển thị tọa độ và phép thử footprint         |
| `src/test`, `*.spec.*`, `scripts/`, `target/*tests*.log`                             | Test/công cụ và kết quả có phạm vi; script tồn tại không chứng minh đã chạy   |

Tài liệu nguồn bổ sung: [ranh giới 51 ấp](badiem-boundaries/README.md), [nhập TC2](../data/tc2_household_import/README.md), `DATA_QUALITY_REPORT.md`, [đợt UI/UX](audit/16-ui-ux-redesign.md), [GIS/OIDC/OCR](gis-auth-ocr.md), [MapLibre địa lý](maplibre-geographic-3d.md), [sơ đồ TC2](maplibre-ap-tc2.md), [lộ trình PostGIS](postgis-migration.md), [schema GIS 3D](spatial_3d_database_schema.md).

Mẫu đặt goal cho đợt tiếp theo: người dùng/đơn vị → vấn đề và baseline → kết quả đo được → phạm vi/ngoài phạm vi → nguồn và người chịu trách nhiệm dữ liệu → role/scope/hành động → luồng chính/lỗi → migration/bảo mật/phục hồi → test bắt buộc → người nghiệm thu. Tài liệu không tự áp quy tắc vào `AGENTS.md` hoặc thay đổi hành vi ứng dụng.

## 10. Kế hoạch cải thiện bảo toàn các luồng hiện có

Tiến độ: bước 1 về phân biệt tải lỗi/danh sách rỗng đã triển khai, đạt 111 test GIS, TypeScript và build. Chi tiết phạm vi và phần chưa nghiệm thu nằm ở mục 7 của báo cáo đối chiếu bên dưới; các số 85/61 ở mục 3.6 là baseline trước cải thiện.

Xem [ma trận đối chiếu và cổng hồi quy](audit/17-project-document-reconciliation.md): phân biệt việc cần cập nhật tài liệu, cải thiện code có phạm vi nhỏ và thay đổi nền tảng cần migration. Đợt đối chiếu này không thay đổi logic, dữ liệu hoặc quyền đang dùng.

Ưu tiên bổ sung test luồng lỗi trước: lưu hộ/roster qua nhiều request; tải nhật ký/cảnh báo lỗi khác danh sách rỗng; phân trang; nguồn tọa độ và vòng đời camera. Sau đó xử lý từng mục, giữ nguyên hợp đồng ID, hamlet, scope, trạng thái và nhật ký mutation-only. Đổi khóa mã hóa, chuyển PostGIS, thay ranh hoặc bootstrap RBAC cần đợt riêng có backup, kiểm tra dữ liệu cũ và rollback.

Test tự động đạt là mốc nền cho các cải thiện tiếp theo. Để xác nhận các luồng thực tế hoạt động bình thường trước phát hành, vẫn cần nghiệm thu có đăng nhập theo ba vai trò trên desktop/mobile, lỗi mạng và kiểm tra dữ liệu sau tải lại; không diễn giải kết quả hiện tại thành bảo đảm tuyệt đối cho các ca chưa kiểm thử.
