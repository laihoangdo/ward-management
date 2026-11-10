# Kiểm tra console runtime — 01/11/2026

## Các lỗi trong ảnh đã xác định và sửa

| Nhóm                                        | Nguyên nhân / cách sửa                                                                                                                                                                                                                                                                                    | Kiểm tra                                                                                                                                                     |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `path`, `url`, `source-map-js` externalized | Chuỗi `react-jhipster → sanitize-html → PostCSS`. PostCSS khai báo các module này là `false` trong browser field; dùng module CommonJS rỗng đúng phạm vi PostCSS thay vì Node-external Proxy của Vite. Không polyfill/tắt warning toàn cục.                                                               | Console trang chủ: 23 warning trước, 0 sau. Browser smoke vẫn loại `script`, `onclick`, `position:fixed`, giữ `color:red` được phép.                         |
| React `Expected static flag was missing`    | `WarningDetailModal` return trước hook khi đóng. Đưa guard xuống sau tất cả hook.                                                                                                                                                                                                                         | Test chuyển đóng/mở lặp hai lần trên cùng component, không có `console.error`.                                                                               |
| Camera `NotFoundError`                      | Máy không có camera không phải chưa cấp quyền. Phân biệt thiếu thiết bị, từ chối quyền, camera bận và cấu hình không hỗ trợ. Hiện hướng dẫn/tải ảnh; không retry vô ích khi thiếu thiết bị hoặc bị từ chối. Chỉ log lỗi không dự kiến.                                                                    | Unit/component test cho NotFound, quyền, fallback; giữ input tải ảnh.                                                                                        |
| Camera trả stream sau khi đã đóng           | Cleanup trước đây đọc state trong closure cũ. Giữ stream/request ID bằng ref, dừng track nếu kết quả đến muộn hoặc component đóng.                                                                                                                                                                        | Test resolve `getUserMedia` sau đóng: track được dừng.                                                                                                       |
| Hai tham số OCR không tồn tại               | Config nhúng trong model `vie` v4 còn `language_model_ngram_on`, `classify_misfit_junk_penalty`; core LSTM Tesseract 7 không hỗ trợ. Khi phục vụ/copy asset, biến đúng hai dòng config thành comment có cùng độ dài; không đổi bảng offset hoặc trọng số. Đổi namespace cache model để không dùng bản cũ. | Test byte-equality của trọng số/offset cho eng/vie; OCR thật ảnh tổng hợp vẫn cùng nội dung, confidence 90, không còn hai warning tham số.                   |
| Three.js `Context Lost` khi rời map         | MapLibre 5 `map.remove()` không gọi `onRemove` của custom layer. Gỡ effects/custom layer trước khi huỷ map/shared GL context; giải phóng InstancedMesh và tham chiếu scene. Không ép mất context của renderer dùng chung.                                                                                 | Test thứ tự dispose trước map.remove, dispose idempotent; stress StrictMode 8 instance mỗi loại map, không exception/warning hoặc log Three.js Context Lost. |

## Lỗi `Cannot read properties of undefined (reading 'key')`

Ảnh không có stack mở rộng nên chưa xác định được vị trí gọi gây lỗi. Không thêm catch toàn cục hoặc sửa package MapLibre để che lỗi. Đã sửa vấn đề cleanup đồ hoạ có thật như trên; sau đó thử:

- MapLibreAreaMap và FieldHouseMap trong React StrictMode, mở/đóng liên tục, zoom 12–19, xoay và mousemove: mỗi loại 8 instance, không tái hiện lỗi `key`.
- Bản đồ 79.109 công trình: chọn nhà, sửa/lưu thuộc tính bằng API adapter giả, dùng chung canvas, giữ nút vẽ và khôi phục native: PASS.

Không coi việc chưa tái hiện là bằng chứng đã sửa dứt điểm lỗi `key`. Nếu còn xuất hiện sau tải lại, cần stack mở rộng của error cùng tab/thao tác gây lỗi; không cần gửi dữ liệu hộ dân.

## Log không phải lỗi ứng dụng

- `Estimating resolution as …`, `Detected … diacritics`: thông tin từ stderr của engine OCR, Chrome có thể tô đỏ. OCR vẫn hoàn thành thành công; giữ tự ước lượng độ phân giải, không gán DPI giả hoặc tắt console toàn cục để làm đẹp log.
- `loadingBar/...`, `authentication/...`: log Redux dev từ logger middleware, không phải exception.
- `NotFoundError` không thể được giải quyết bằng phần mềm để tạo ra camera thật: cần kết nối camera hoặc dùng tải ảnh.

## Hồi quy

- TypeScript app và kiểm tra riêng Vite config/helpers: PASS.
- Production build: PASS, `target/console-validation-build`. Còn cảnh báo chunk lớn/dynamic import cũ, không phải các warning runtime trong ảnh.
- Toàn frontend: **374/376 test PASS** trên 69 file. Hai lỗi nền vẫn là `operationalLoading.spec.ts` và `overviewDemographics.spec.ts`; không đổi service/công thức liên quan.
- Thêm 11 test cho hook lifecycle, camera, browser compatibility/model integrity và resource cleanup; ổn định assertion chờ layer hộ dân cập nhật bất đồng bộ, không thay logic phân quyền/lưu dữ liệu.
- Fixture/artifact: `target/console-diagnostics-{app,ocr,sanitize}.json`, `target/ocr-engine-smoke.html`, `target/sanitize-browser-smoke.html`, `target/map-lifecycle-smoke.html`. Chỉ dùng ảnh/dữ liệu tổng hợp và API adapter kiểm thử.
