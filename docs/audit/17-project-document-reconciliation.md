> Historical snapshot: VietMap Compare and its unused Blender pipeline were subsequently removed. See `18-remove-vietmap-pipeline.md` for current status.

# Đối chiếu tài liệu và kế hoạch cải thiện có kiểm soát hồi quy

Ngày: **18/10/2026**. Tài liệu gốc: [tổng quan dự án, mục tiêu và quy chuẩn](../tong-quan-du-an-goal-va-quy-chuan.md).

## 1. Phạm vi và kết luận

Đã đối chiếu tài liệu với route/component đang dùng, service API, phân quyền backend, nhật ký công trình, bộ kiểm thử và script thiết lập RBAC. Đợt này chỉ cập nhật tài liệu và chạy kiểm tra; **không sửa logic ứng dụng, chạy nhập dữ liệu, chạy `setup-rbac.ps1`, đổi quyền hoặc sửa database**.

Các luồng có kiểm thử hiện đạt kiểm tra nền. Đây là bằng chứng để làm từng đợt nhỏ, không bảo đảm tất cả luồng thực tế đều đúng. Vẫn thiếu nghiệm thu trình duyệt có đăng nhập theo vai trò, camera thật, mobile và tải đồng thời.

Phân loại:

- **Giữ ổn định:** hành vi đang được người dùng chốt và có test bảo vệ.
- **Cập nhật tài liệu:** nhận định hoặc bằng chứng kiểm tra cần làm rõ, không cần đổi tính năng.
- **Cải thiện code:** có khoảng trống cụ thể; cần test mô tả hành vi cũ và luồng lỗi trước khi sửa.
- **Đổi nền tảng/chính sách:** cần thiết kế, dữ liệu thử, migration và rollback riêng; không gộp vào sửa giao diện hoặc bảo trì nhỏ.

## 2. Các hành vi phải giữ nguyên

| Luồng                 | Hợp đồng cần bảo toàn                                                                    | Bằng chứng kiểm tra hiện có                                                             |
| --------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Phiên và phân quyền   | Phiên backend quyết định danh tính; API/service kiểm tra quyền và ấp/tuyến               | `SecurityUtilsUnitTest`, `GisSecurityTest`, `RbacServiceTest`, `RbacMapWriteAspectTest` |
| Hiển thị toàn xã      | Giữ hình khối toàn xã, che thông tin hộ và chặn thao tác ngoài scope                     | `GisFieldBuildingResourceTest`, `FieldHouseMap.spec.tsx`                                |
| Vị trí và liên kết hộ | Quyền geometry và quyền hồ sơ cùng áp dụng; di chuyển kiểm tra vị trí cũ/mới của bản lưu | `TerritoryGeometryTest`, `BaDiemBoundaryDatasetTest`, resource tests                    |
| Nguồn ranh            | Ranh xã dùng nguồn chung; 51 ranh ấp tạm trong DB có phiên bản và bản sao cũ             | Dataset test và migration đã có; chưa phải dữ liệu khảo sát                             |
| Liên kết công trình   | Lưu qua API, không liên kết trùng; tự nhận diện chỉ hiện như đã lưu sau xác nhận         | Resource tests và field-map tests                                                       |
| Nhật ký 3D            | Chỉ lưu/di chuyển/sửa polygon–thuộc tính/liên kết hộ; trước/sau và actor do server ghi   | `FieldMapHistoryServiceTest`, resource tests                                            |
| Thao tác xem          | Không ghi history cho chọn nhà, zoom/xoay, layer/filter hoặc xuất ảnh                    | Không còn endpoint/service ghi sự kiện xem; field-map tests bảo vệ số lần ghi nghiệp vụ |
| Ảnh xuất              | Giữ khung thông tin cán bộ và xem trước/tải/copy/share/print                             | `mapCapture.spec.ts`, `MapCapturePreview.spec.tsx`; chưa kiểm tra tất cả trình duyệt    |
| Hộ và nhân khẩu       | Giữ ID hộ/ấp, danh sách cư dân và hợp đồng trạng thái NORMAL/WARNING/CRITICAL            | `householdApiService.spec.ts`, các component tests                                      |
| UI và nhập liệu       | Không đổi quyền, nguồn dữ liệu, xác nhận OCR và cách đóng/mở modal khi chỉ sửa bố cục    | Các test GIS về form, tìm kiếm, modal, OCR và phân công                                 |

Test hiện có là một phần của hợp đồng, không có nghĩa mọi tình huống trong mỗi hàng đã được bao phủ.

## 3. Ma trận phần cần cập nhật và cải thiện

| Mã / ưu tiên                | Căn cứ và phát hiện                                                                                                                                                                           | Hướng xử lý                                                                                                                                                        | Điều kiện bảo toàn/kiểm thử trước sửa                                                                                                                                     |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D01 / ngay                  | Tài liệu đã có RBAC, 51 ấp và nhật ký mutation-only; bằng chứng mục 3.6 chỉ nêu các nhóm test nhỏ trước đó                                                                                    | Cập nhật kết quả kiểm tra rộng hơn và dẫn báo cáo này; giữ snapshot DB cũ đúng thời điểm                                                                           | Không đổi số snapshot thành số liệu hiện tại nếu không truy vấn lại; không cộng số test của các lần chạy trùng                                                            |
| C01 / P1                    | `updateHouseholdInBackend`: PATCH hộ trước, sau đó nhiều request thêm/sửa/xóa cư dân; lỗi xóa cư dân chỉ warn và tiếp tục. Không có transaction chung giữa các HTTP request                   | Trước mắt bổ sung ca lỗi từng bước, phân biệt kết quả toàn phần/một phần và hướng dẫn tải lại. Sau đó thiết kế API cập nhật roster nguyên tử nếu nghiệp vụ yêu cầu | Lưu thành công phải giữ nguyên ID/hamlet và roster; kiểm tra lỗi ở request thứ hai, xóa thất bại và thử lại không tạo trùng. Không tự đổi payload/hợp đồng CRUD đang dùng |
| C02 / P1                    | `fetchPatrolLogsFromBackend`, `fetchSecurityAlertsFromBackend` bắt lỗi rồi trả `[]`; `loadOperationalData` dùng `Promise.allSettled`, nên lỗi đã bị nuốt có thể được xem là tải thành công    | Thêm test tải thành công rỗng khác lỗi mạng/403/500; truyền trạng thái lỗi lên UI qua hợp đồng rõ                                                                  | Lỗi không được xóa danh sách cũ hoặc báo “không có dữ liệu”; phản hồi rỗng thành công vẫn hiển thị bình thường; không đổi scope hoặc tạo seed fallback                    |
| C03 / P1                    | `mapDtoToHousehold` còn fallback bộ đếm dân số và tọa độ. `coordinatesEstimated` chỉ dựa trên sự hiện diện/số hữu hạn, không đọc nguồn ước lượng TC2                                          | Chốt mô hình nguồn/mức xác minh, thêm test riêng cho tọa độ thiếu, GPS xác minh và DXF ước lượng trước khi đổi mapper                                              | Giữ hiển thị/tra cứu TC2 theo chính sách hiện có; không đột ngột ẩn 896 bản ghi, sửa tọa độ hay tự sửa ấp. Không coi một cờ UI mới là chứng cứ khảo sát                   |
| C04 / P1                    | `fetchAuthorizedPages` đã giải quyết tải nhiều trang nhưng thiếu test phân trang chuyên biệt; nhật ký/cảnh báo vẫn lấy trang đầu 200/100 trong luồng mặc định                                 | Bổ sung test 0/500/501/nhiều trang, lỗi giữa trang và thứ tự ổn định. Thiết kế pagination/tìm kiếm server cho nhật ký/cảnh báo khi cần                             | Không trả tập dữ liệu thiếu mà gắn nhãn “tất cả”; giữ sort và API scope; chưa đổi toàn bộ các màn sang lazy load trong cùng đợt                                           |
| C05 / P1                    | Camera effect có deps `[isOpen, facingMode]`, cleanup gọi `stopStream` qua state; `getUserMedia` có thể trả sau khi modal đóng. Đây là rủi ro vòng đời theo code, chưa tái hiện trên thiết bị | Thêm test promise trả muộn, đóng modal, đổi camera và StrictMode; quản lý stream bằng ref/generation nếu xác nhận cần sửa                                          | Track phải dừng khi đóng, không gắn stream cũ vào video mới; giữ fallback upload và thông báo không có thiết bị; không đổi quyền camera                                   |
| C06 / P1                    | API save kiểm tra geometry trước đó khi đã có bản lưu DB; footprint nhập nền chưa có bản lưu không có geometry gốc được tra cứu ở backend                                                     | Bổ sung bài kiểm tra việc dùng ID footprint nhập với geometry khác; xác định chính sách ID và nguồn geometry gốc trước sửa API                                     | Giữ vẽ khối mới hợp lệ, liên kết lần đầu và di chuyển hợp lệ; không kết luận đã khai thác được chỉ từ việc đọc code; không nới kiểm tra quyền để làm test qua             |
| C07 / P1                    | Nhật ký mutation 3D ghi rõ không có chữ ký; một số mapper/đường ghi nhật ký khác còn chuỗi hash minh họa và dữ liệu thiết bị mặc định                                                         | Tách metadata thực/không ghi nhận/legacy; nếu cần chống sửa phải thiết kế riêng                                                                                    | Không làm mất lịch sử, sửa actor/timestamp hoặc tạo cảm giác hash minh họa là bằng chứng toàn vẹn; không bật lại nhật ký xem bản đồ                                       |
| A01 / P0 trước dữ liệu thật | `cryptoUtils.ts` có khóa cố định phía client, định dạng ciphertext hiện được test round-trip và tương thích                                                                                   | Thiết kế quản lý khóa và chiến lược chuyển dữ liệu, giữ đọc dữ liệu cũ trong giai đoạn chuyển tiếp                                                                 | Test dữ liệu cũ/mới, sai khóa, thiếu crypto, dữ liệu lỗi và backup/restore; không chỉ đổi secret vì sẽ làm hồ sơ cũ không đọc được                                        |
| A02 / P0 trước phát hành    | `setup-rbac.ps1` có thao tác tạo role/service-account, lưu secret và bootstrap super-admin; là script thiết lập có tác động quyền                                                             | Bổ sung runbook, kiểm tra môi trường/identity, quyền file secret và dry-run/idempotency trước khi thay script                                                      | Chỉ kiểm tra cú pháp/đọc trong đợt review. Không tự chạy script, đổi bootstrap user, role hoặc secret để thử luồng đang hoạt động                                         |
| A03 / P1                    | Có migration PostGIS nhưng local trước đó chưa bật extension; nhiều đường GIS, ranh tạm và báo cáo nguồn khác nhau                                                                            | Chốt đường dữ liệu chính, benchmark và triển khai PostGIS/viewport theo một đợt có backup                                                                          | GeoJSON/API/ID/liên kết hiện tại vẫn đọc được; giữ nguồn ranh đã chốt; không bật extension hay chuyển bảng GIS trực tiếp trong đợt UI                                     |
| L01 / P2                    | ESLint toàn nhóm GIS báo 148 error/27 warning; gồm cả module chính, legacy và test                                                                                                            | Phân loại rule/ảnh hưởng rồi sửa theo module sau khi có test, không chạy auto-fix toàn cây                                                                         | Không đổi business logic hoặc xóa module chỉ để làm sạch lint; giữ kiểm tra TypeScript, regression và build cho từng nhóm sửa                                             |

P0 là điều kiện cần giải quyết trước khi dùng dữ liệu thật/phát hành tương ứng, không có nghĩa phải sửa gấp toàn hệ thống đang chạy mà bỏ qua chuyển đổi và hồi quy.

## 4. Kế hoạch thực hiện theo đợt

### Đợt 1 — Tăng khả năng kiểm chứng, giữ nguyên hành vi

1. Viết test cho C01–C06 bằng dữ liệu giả và mock; mô tả rõ hành vi hiện tại và kỳ vọng nghiệp vụ, không đổi assertion để che một hành vi sai.
2. Xác định API/caller và UI đang dùng từng helper. Ghi contract: thành công rỗng, thất bại, một phần, ID/hamlet, nguồn tọa độ và trạng thái.
3. Chụp mốc code/dữ liệu trước thay đổi. Nếu làm trong worktree riêng, giữ đúng toàn bộ thay đổi chưa commit cần thiết; không lấy checkout sạch làm baseline thay cho phiên bản đang dùng.

### Đợt 2 — Cải thiện từng lỗi có phạm vi nhỏ

Ưu tiên C02 vì có thể làm UI hiểu sai trạng thái tải; sau đó C04 và C05. Với mỗi mục: test ca lỗi trước → sửa helper/caller liên quan → chạy test luồng thành công và lỗi → kiểm tra TypeScript/build → nghiệm thu UI. Không gộp thay đổi role, schema hay toàn bộ hệ thống modal vào cùng đợt.

C01 cần quyết định nghiệp vụ về tính nguyên tử; việc đổi sang API roster nguyên tử là đợt backend/API riêng. C03 và C06 cần quy tắc nguồn/ID rõ trước khi đổi quyền hoặc điều kiện hiển thị.

### Đợt 3 — Chuyển đổi dữ liệu và nền tảng

A01–A03 cần dữ liệu thử, sao lưu đã kiểm tra, migration, khả năng đọc dữ liệu cũ, kế hoạch rollback và nghiệm thu theo vai trò. Không dùng việc test unit đang pass để bỏ các bước này.

## 5. Cổng hồi quy cho từng đợt

| Thay đổi                  | Kiểm tra bắt buộc phù hợp                                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Chỉ tài liệu              | Markdown, link, căn cứ và phạm vi kết luận; không chạy script thiết lập/nhập dữ liệu                                       |
| Helper tải dữ liệu/mapper | API contract tests, nhiều trang, lỗi mạng/quyền, component dùng dữ liệu và TypeScript                                      |
| Hộ/cư dân                 | Giữ ID/hamlet, thêm/sửa/xóa roster, lỗi giữa chừng, retry không trùng và dữ liệu còn đúng sau tải lại                      |
| RBAC/geometry             | Đọc/ghi trong và ngoài ấp/tuyến, vị trí cũ/mới, hộ liên kết khác scope, polygon lỗ/lõm/giáp ranh và kiểm tra API trực tiếp |
| Bản đồ/ảnh/camera         | Load/unmount/HMR, source chưa sẵn sàng, gesture, popup, xuất ảnh, DPI khôi phục, track dừng và fallback thiết bị           |
| Migration/crypto          | Diễn tập trên bản sao, đối chiếu bảo toàn, tương thích dữ liệu cũ và phục hồi độc lập                                      |

Trước phát hành còn cần chạy các luồng có đăng nhập với super-admin, sub-admin và user theo dữ liệu được phép, trên desktop và mobile dọc/ngang. Kiểm tra console/network, lỗi máy chủ và dữ liệu sau tải lại. Nếu chưa chạy, ghi **chưa nghiệm thu**, không suy ra từ mock test.

## 6. Bằng chứng kiểm tra trong đợt review

- GIS: `npx.cmd vitest run app/gis` — **26 file, 85 test đạt**. Bao gồm các test dữ liệu/API helper, form, phân công, tìm kiếm, OCR, geometry, bản đồ và ảnh xuất hiện có.
- Backend mục tiêu: `RbacServiceTest`, `RbacMapWriteAspectTest`, `TerritoryGeometryTest`, `BaDiemBoundaryDatasetTest`, `GisFieldBuildingResourceTest`, `FieldMapHistoryServiceTest`, `GisSecurityTest`, `SecurityUtilsUnitTest` — **61 test đạt**, Maven `BUILD SUCCESS`.
- `npx.cmd tsc --noEmit` — đạt.
- Log: `target/project-review-gis-tests.log`, `target/project-review-backend-tests.log`, `target/project-review-types.log`. Các lỗi giả lập offline/HTML trong test health là ca kiểm thử có chủ đích; PowerShell có thể báo native stderr dù summary test đạt. Kết luận dựa trên summary và kết quả test, không chỉ mã thoát của wrapper shell.
- Production build đạt: chạy entry Vite qua Node, mã thoát thực 0; log `target/project-review-build.log`. Chạy sau khi Maven hoàn tất để không tranh chấp thư mục output.
- Baseline ESLint GIS: **119 file, 148 error, 27 warning**; `target/project-review-gis-lint.json`. Đây là nợ của checkout đang được kiểm tra, không phải lỗi phát sinh do thay đổi tài liệu. Không chạy auto-fix. Ví dụ: `App.tsx` 25 error, `BaDiem3DMapEditor.tsx` 20, `SuperAdminHubTab.tsx` 16; cần xem từng rule trước khi sửa, không coi mọi error lint là lỗi runtime.

Các log là bằng chứng local có thể bị ghi đè; release cần CI gắn với commit/snapshot cụ thể. Đợt review không thay thế kiểm thử tải, kiểm định bảo mật, nghiệm thu người dùng hay xác minh dữ liệu thực địa.

## 7. Tiến độ thực hiện từng bước

### Bước 1 — Hợp đồng tải dữ liệu (18/10/2026)

Đã xử lý C02 ở phạm vi các reader hỗ trợ vận hành: cư dân, hồ sơ, nhật ký và cảnh báo. Bổ sung `services/operationalLoading.spec.ts` kiểm tra qua helper thật với Axios giả lập, không chỉ mock kết quả của service.

- Trước sửa: 18/22 ca kiểm tra hợp đồng thất bại, xác nhận lỗi bị biến thành danh sách rỗng hoặc phản hồi sai định dạng được chấp nhận.
- Sau sửa: API lỗi được truyền lên caller; phản hồi danh sách rỗng thành công vẫn trả `[]`. Nhật ký/cảnh báo từ chối payload không phải mảng.
- `loadOperationalData` nhận đúng rejected/fulfilled của từng nhóm; `applyOperationalData` hiện chỉ thay state của nhóm fulfilled. Mở riêng tab Nhật ký có catch, giữ danh sách cũ và cập nhật thông báo lỗi, không để rejection không được xử lý.
- Giữ mapping thành công của cư dân, hồ sơ, mức cảnh báo và metadata trước/sau của nhật ký. Không sửa payload ghi, số liệu mặc định, quyền, database hoặc phạm vi ghi history.
- Kiểm tra cả lỗi giữa các trang hồ sơ: không trả phần đã tải như một kết quả đầy đủ. Chưa hoàn tất toàn bộ ma trận phân trang C04.
- Hồi quy: **27 file, 111 test GIS đạt**, TypeScript đạt, production build mã thoát 0. Còn nợ lint cũ ở App/service; không tuyên bố toàn bộ lint sạch. Không chạy lại backend vì không thay đổi backend trong bước này.
- Log: `target/step1-loading-before.log`, `target/step1-loading-gis-tests.log`, `target/step1-loading-types.log`, `target/step1-loading-build.log`, `target/step1-loading-lint.json`.

Chưa nghiệm thu bằng trình duyệt có đăng nhập trong bước này. Bước tiếp theo: C04 — kiểm tra ranh giới trang 0/500/501, lỗi giữa trang và tính đầy đủ dữ liệu; sau đó mới tiếp tục camera và luồng ghi roster.

### Bước 2 — Phân trang server cho danh sách hộ (18/10/2026)

Màn danh sách hộ dùng API mới `GET /api/gis/households/browse`. Server áp dụng phạm vi ấp/tuyến của tài khoản trước khi tìm kiếm, lọc, đếm và lấy trang. Các bộ đếm theo ấp/loại cư trú lấy từ toàn bộ phạm vi được phép, không tính từ vài dòng của trang hiện tại. API giới hạn tối đa 100 dòng/request; giao diện chọn 12/24/48/96 dòng, debounce tìm kiếm 250 ms và hủy request cũ khi đổi điều kiện. Nút làm mới ở tab này chỉ tải lại trang đang xem.

Khi mở hộ, giao diện tải hồ sơ và đầy đủ nhân khẩu của riêng hộ đó trước khi mở modal xem/sửa. Lỗi tải không mở modal với danh sách nhân khẩu thiếu; lỗi lấy trang có thông báo/thử lại và giữ kết quả trước. Không thay đổi API ghi hộ/roster, dữ liệu hộ hoặc phân quyền. Thêm index không duy nhất `resident(household_id,residence_type)` bằng Liquibase; môi trường khác cần chạy migration khi khởi động backend.

- GIS: **29 file, 116 test đạt**; bao gồm phân trang giao diện, tìm kiếm tại server, mở chi tiết đầy đủ và lỗi tải.
- Backend mục tiêu: **55 test đạt**, gồm `HouseholdBrowseResourceTest`, `RbacServiceTest`, `RbacMapWriteAspectTest`, `GisFieldBuildingResourceTest`, `FieldMapHistoryServiceTest`, `GisSecurityTest`. Các ca mới kiểm tra 0/500/501 bản ghi không thiếu/trùng, chặn ngoài ấp/tuyến, tìm kiếm trước phân trang và tham số không hợp lệ.
- TypeScript đạt; production Vite build hoàn tất. Ba file service/test mới đạt ESLint; vẫn còn nợ lint hiện hữu tại component/App, không tuyên bố toàn dự án sạch lint.
- Truy vấn đọc thử PostgreSQL local: facets khoảng 22,5 ms, lấy 12 ID trang đầu khoảng 0,8 ms; chỉ là một mẫu phạm vi ấp, chưa bao gồm mạng/JPA/render và không đại diện tải production.
- Log: `target/paged-households-gis.log`, `target/paged-households-backend.log`, `target/paged-households-types.log`, `target/paged-households-build.log`, `target/paged-households-new-lint.log`, `target/paged-households-query-check.json`.

Giới hạn: tổng quan và bản đồ vẫn sử dụng luồng tải chung đầy đủ để bảo toàn thống kê và dữ liệu bản đồ. Chi phí tải dashboard ban đầu chưa được loại bỏ; tối ưu tiếp cần API tổng hợp/viewport và kiểm tra riêng từng màn. Chưa nghiệm thu UI có đăng nhập theo vai trò hoặc đo hiệu năng mobile. SQL của API mới thực hiện phạm vi RBAC tương ứng logic hiện tại; khi thay đổi quy tắc scope phải cập nhật và kiểm tra cả đường này.

### Bước 3 — Giảm chờ mạng khi tải bộ dữ liệu đầy đủ (18/10/2026)

Tách helper `services/authorizedPages.ts` dùng chung cho hộ, nhân khẩu và hồ sơ. Sau trang đầu, khi có header `X-Total-Count` hợp lệ, tải các trang tiếp theo thành từng đợt tối đa hai request đồng thời cho mỗi bộ dữ liệu. Giữ thứ tự trang/ID, không tăng kích thước trang 500 và giữ nguyên API cùng phạm vi phân quyền. Hộ và nhân khẩu vốn tải đồng thời, nên hai bộ này có thể có tổng cộng bốn request trang đang chạy. Đây là đánh đổi có giới hạn giữa thời gian chờ mạng và số truy vấn đồng thời.

Thiếu/sai header thì tiếp tục đọc tuần tự như trước; trang cuối còn đủ 500 dòng thì kiểm tra tiếp phần đuôi để không cắt dữ liệu chỉ vì tổng số đã cũ. Một trang lỗi hoặc payload sai làm toàn bộ bộ dữ liệu thất bại, không trả dữ liệu một phần như kết quả thành công. Phân trang theo offset vẫn chưa bảo đảm snapshot khi dữ liệu thay đổi trong lúc đọc, giống giới hạn trước đó.

Kiểm tra: **30 file, 123 test GIS đạt**, TypeScript đạt, hai file helper/test mới đạt ESLint và Vite production build hoàn tất. Test mới xác nhận giới hạn request đồng thời, phản hồi về lệch thứ tự, 0/500/501 bản ghi, header thiếu/cũ và lỗi trang. Log: `target/parallel-pages-tests.log`, `target/parallel-pages-gis.log`, `target/parallel-pages-types.log`, `target/parallel-pages-lint.log`, `target/parallel-pages-build.log`. Không thay backend/schema trong bước này.

Đợt này giảm số lượt chờ nối tiếp khi có nhiều trang và header tổng số; chưa đo mức cải thiện trên mạng thực tế, không giảm tổng số bản ghi hoặc RAM giữ dữ liệu cho bản đồ/tổng quan. Tối ưu tải dashboard bằng API thống kê và dữ liệu bản đồ theo viewport vẫn là công việc tiếp theo, cần giữ đúng số đếm và phạm vi tìm kiếm trước khi bỏ tải đầy đủ.

### Bước 4 — API Tổng quan và trì hoãn tải bộ hồ sơ đầy đủ (18/10/2026)

`GET /api/gis/households/overview` trả tổng hộ/cơ sở, kinh doanh, cảnh báo, dân số và cơ cấu tuổi/giới, tên ấp, tối đa 16 hộ xem nhanh, 5 hộ cần chú ý và một trang cảnh báo (10/20/50 dòng). Bộ đếm của thanh thông tin phạm vi được trả riêng, không bị thu hẹp theo từ khóa tìm kiếm. API dùng transaction chỉ đọc/repeatable-read; cùng hàm dựng phạm vi ấp/tuyến và tìm kiếm với API danh sách. Tham số sai bị từ chối; tìm kiếm sử dụng tham số bind, kể cả ký tự đặc biệt. Việc tìm kiếm giữ các giá trị hiển thị mặc định của mapper, bao gồm mã hộ tự sinh và tên chưa cập nhật.

Nhân khẩu có roster thật được tổng hợp tại SQL; hộ chưa có roster được tính tương thích với `getEffectiveResidentsList` tại backend bằng các trường cơ cấu, không tạo hoặc lưu nhân khẩu mới. Fixture dùng chung giữa Java và frontend kiểm tra cách tính hiện có, kể cả cơ cấu thiếu/không nhất quán và năm thay đổi. Trường `fallbackHouseholds` cho biết số hộ thuộc nhánh tương thích này; không coi kết quả là dân số đã được xác minh.

`ServerOverviewTab` lấy thống kê từ API, debounce/hủy tìm kiếm cũ, phân trang cảnh báo tại server và giữ kết quả trước nếu lỗi. Chọn hộ trong xem nhanh/cảnh báo chỉ mở modal sau khi tải đủ hồ sơ và nhân khẩu riêng hộ đó. Khi lưu/xóa từ hồ sơ tải riêng, metadata nhật ký lấy được hộ đang chọn dù chưa có trong bộ nhớ dữ liệu chung; dữ liệu Tổng quan được làm mới khi danh sách trong phiên thay đổi.

`useDeferredOperationalData` bỏ tải toàn bộ hộ, nhân khẩu và hồ sơ trên Tổng quan/danh sách hộ. Khi mở màn khác hoặc modal cảnh báo tổng hợp, bộ dữ liệu đầy đủ mới tải; các yêu cầu đồng thời dùng chung một promise, không tải lại khi quay lại màn đã có dữ liệu. Làm mới Tổng quan chỉ lấy lại thống kê; làm mới danh sách chỉ lấy trang và thông tin đếm. Phản hồi từ dashboard đã unmount/đổi tài khoản không được áp dụng. Tài khoản/quyền vẫn gắn với key phiên hiện có.

Kiểm tra tự động: toàn bộ GIS **34 file, 135 test đạt**; backend mục tiêu **60 test đạt**, gồm API danh sách/Tổng quan, fixture cơ cấu, RBAC, bảo mật, công trình và history. TypeScript, lint bảy file frontend mới và production build đạt. Bằng chứng: `target/overview-gis.log`, `target/overview-ui.log`, `target/overview-deferred-final.log`, `target/overview-backend.log`, `target/overview-types.log`, `target/overview-lint.log`, `target/overview-build.log`. Không thay đổi schema trong bước này; vẫn còn nợ lint/bundle size đã có ở các phần khác.

Giới hạn: chưa đo trước/sau bằng trình duyệt có đăng nhập, chưa nghiệm thu desktop/mobile và chưa khẳng định phần trăm tăng tốc. Backend vẫn phải đọc/tổng hợp dữ liệu trong phạm vi, đặc biệt cơ cấu của hộ thiếu roster; giảm đáng kể dữ liệu truyền về trình duyệt không có nghĩa không còn chi phí truy vấn. Khi đã mở bản đồ, dữ liệu đầy đủ vẫn ở bộ nhớ; viewport/API thống kê cho các màn khác và giải phóng cache là bước tiếp theo. Các listener quản trị/cảnh báo riêng của tài khoản vẫn hoạt động như trước. Test SQL mới chạy trên H2 chế độ PostgreSQL, chưa thay thế kiểm thử API có đăng nhập trên PostgreSQL thật.

### Bước 5 — Đồng bộ RBAC theo sự kiện (18/10/2026)

Thêm stream `/api/rbac/events` có xác thực theo subject của phiên. Gỡ timer polling 30 giây của `me` và các danh sách RBAC; thay bằng một EventSource/tab, invalidation theo topic, đối chiếu khi reconnect/focus và retry có backoff. Tín hiệu được gửi sau commit; phiên bản/revision giúp phân biệt reconnect không có thay đổi với khả năng bỏ lỡ thay đổi quyền. Trường hợp khóa tài khoản khi đồng bộ Keycloak thất bại được phát yêu cầu kiểm tra lại sau audit độc lập. Chuyển chủ hồ sơ thông báo cả chủ cũ/mới và serialize transaction để không bỏ sót người bị thu hồi.

Frontend không áp dụng phản hồi cũ nếu có invalidation mới trong lúc request chạy; request được gộp và có một lượt theo sau. Khi quyền/scope trực tiếp bị thay đổi, dashboard cũ được bỏ trước khi nhận snapshot mới. Kiểm tra policy toàn cục không đóng form của tài khoản không bị ảnh hưởng. Mất kết nối có watchdog/reconnect, cleanup khi đổi phiên và nút thử lại quyền nếu tải lỗi. `health` vẫn giữ lịch riêng; không bật lại viewport đã hoàn tác của bản đồ.

Kiểm tra: **36 file, 143 test GIS đạt**, backend mục tiêu **75 test đạt**, TypeScript, lint sáu file service/test RBAC và production build đạt. Có test Spring proxy/transaction thật, luồng MVC SSE và filter chain xác thực/ASYNC. Không tuyên bố toàn bộ backend pass: `RbacMenuRemovalTest` ngoài nhóm mục tiêu có lỗi kỳ vọng ẩn `vietmap-compare` trong phần lọc menu không được sửa; log giữ riêng `target/rbac-events-baseline-menu-failure.log`.

Chi tiết, đường log và bước nghiệm thu hai trình duyệt: [RBAC_REALTIME.md](../RBAC_REALTIME.md). Chưa nghiệm thu UI đăng nhập/proxy thật. Hub đang trong một JVM; triển khai nhiều instance cần bus chung. Không thay schema, hồ sơ dân cư hoặc nội dung cấp quyền hiện có.

