# Tối ưu giao diện hành chính — kết quả kiểm tra

## Phạm vi thay đổi

- Mở rộng token `--gis-*` hiện có cho light/dark, sidebar, chữ, border input và surface; không thêm theme song song.
- Header/sidebar: typography, label dài, nhóm menu, trạng thái đang chọn, icon Lucide, bố cục theo chiều rộng workspace; giữ callback cũ và các bộ lọc quyền.
- Tổng quan: heading, label thống kê, tương phản và xuống dòng trên thẻ nhỏ; giữ nguyên số liệu, công thức và điều hướng.
- Hồ sơ/danh sách: đồng bộ token CSS trong `roster.css`; không sửa logic tải, phân trang, chọn hoặc lưu.
- Bản đồ: chỉnh CSS toolbar/panel/form/focus theo theme. Không sửa `FieldHouseMap.tsx`, renderer, geometry, tile, API hoặc kiểm tra quyền.
- Đăng nhập: thay trình bày card; giữ `beginBackendLogin` và liên kết trang chủ.
- Thêm test hồi quy cho các callback Header và LoginScreen.

Thiết kế được mô tả tại `design-system/municipal-administration/MASTER.md`. Không thêm dependency, font online, dịch vụ ngoài, logo/quốc huy giả lập hoặc dữ liệu nghiệp vụ mẫu vào ứng dụng.

## Kiểm tra tự động

- TypeScript `tsc --noEmit`: đạt.
- ESLint các component thay đổi: không có lỗi; còn cảnh báo complexity sẵn có của OverviewTab.
- Build Vite production ra thư mục kiểm tra riêng trong `target/`: đạt. Có cảnh báo chunk lớn/hiệu quả dynamic import đã có, không phải lỗi build.
- Bộ test GIS + roster trước thay đổi: **185/187** đạt.
- Sau thay đổi và bổ sung 3 test: **188/190** đạt, không có lỗi mới. Hai lỗi nền vẫn là:
  - `app/gis/services/operationalLoading.spec.ts`: ánh xạ hồ sơ.
  - `app/gis/services/overviewDemographics.spec.ts`: fixture thống kê nhân khẩu.
- Không chỉnh các service/công thức này chỉ để làm xanh test trong một phase giao diện.

## Kiểm tra Chrome

Fixture tại `target/` dùng component và CSS thật, bao gồm Bootstrap + Tailwind để phát hiện xung đột cascade. Dữ liệu thống kê/tài khoản trong fixture là dữ liệu kiểm thử, không phải dữ liệu dân cư thực tế.

- 375, 768, 1024, 1440 px, mỗi kích thước kiểm tra light và dark: đạt, không tràn ngang header/toàn trang.
- Tìm kiếm dạng thu gọn, callback nhập tìm kiếm/refresh và focus input: đạt.
- Menu di động và trang đăng nhập ở 375 px, light/dark: đạt.
- Các cặp token chữ chính/phụ, primary và sidebar được kiểm tra tương phản; đồng thời đo chữ/nền **render thực tế** của menu đang chọn để bắt lỗi ghi đè Bootstrap. Các cặp kiểm tra đạt tối thiểu 4,5:1; đây không phải chứng nhận WCAG cho toàn bộ ứng dụng.
- Bản đồ với 79.109 công trình, cả light/dark: chọn nhà, sửa/lưu thuộc tính qua API adapter kiểm thử, giữ nút vẽ, bật/tắt Three.js và khôi phục native MapLibre đều đạt; chỉ một GeoJSON và một canvas, không ghi nhận lỗi render.
- API adapter chỉ dùng trong fixture; không ghi dữ liệu thử vào database thật.

Ảnh chụp và log được lưu trong `target/administration-*.png`, `target/design-*.log` (artifact kiểm thử, không phải route ứng dụng). Kiểm tra này không thay thế UAT của cán bộ trên các tài khoản/phạm vi thật hoặc đo hiệu năng GPU thực tế.

## Rà soát taste-skill (chế độ app screen)

Chạy đúng quy trình của skill `design-taste-frontend` cho màn hình nghiệp vụ: `lint.mjs --app` trên mã nguồn, `inspect.mjs --app` trên fixture component thật ở 1440/768/390 px, chấm điểm theo `references/critique.md`. Artifact: `target/taste-before/`, `target/taste-after/` (kèm `report.json`).

### Trước Review

- Lint mã nguồn: **21 FAIL / 65 WARN**.
- Inspector: FAIL `icon-chips` (8 icon nằm trong ô nền màu, 4 màu) — "tell" kinh điển của dashboard sinh tự động; WARN `micro-label` (2 nhãn eyebrow chữ hoa) và `tiny-text` (56% chữ dưới 13px). Điểm ROUND 1: 6,4 (bị trần 6,0 do FAIL).

### Các vòng sửa (tối đa 3, dừng khi đồng hồ đo pass)

- **Vòng 1 — chip icon, typography, chrome:** bỏ 2 eyebrow ("TRUNG TÂM ĐIỀU HÀNH", "THỐNG KÊ NHÂN KHẨU"); 4 thẻ KPI bỏ ô icon màu, trả về nhãn + số + icon trơn màu chữ; bỏ `font-mono` khỏi số liệu (dùng `tabular-nums`); viền/nền amber trên thẻ cảnh báo chỉ khi `warningCount > 0`; bỏ bóng card và `transition-all` ở trạng thái nghỉ; nút nhân khẩu/portal/đổi tài khoản về trung tính, mục đang chọn dùng nền thay vì màu đơn; đồng hồ bỏ mono, ngày viết thường; badge ≥ 11px, bỏ nhấp nháy trong chrome; cỡ chữ nhỏ nhất nâng 9px → 11px.
- **Vòng 2 — dọn nốt và emblem:** bỏ nốt `shadow-xs`/`shadow-inner` còn lại; `transition-all` trên biểu đồ đổi thành `transition-[width]`, hover màu đổi `transition-colors`; bóng dropdown tìm kiếm mobile và drawer sidebar chuyển xuống CSS và đánh dấu overlay thật; icon Moon bỏ indigo; emblem header bỏ ô nền xanh, trả về icon trơn; nút icon header (trang chủ, theme, chuông) bỏ nền màu nghỉ, giữ viền + hover. Detector đếm mọi icon-in-box vì Tailwind 4 trả màu `oklch` — nền nghỉ trong suốt là cách sửa trung thực, không phải lách rule.
- **Giữ có chủ đích:** logo brand đơn nhất trong sidebar (nhận diện sản phẩm, không phải chip KPI); hue phân loại biểu đồ (hồng/xanh giới tính, xanh lá/cam độ tuổi) có legend kèm theo; các remap dark mode, focus ring `#2563eb` và vô hiệu hoá animation lặp là pattern chức năng — đánh dấu `taste-skill-ignore` kèm `/* prettier-ignore */` để comment sống qua prettier.

### Sau review

- Lint mã nguồn: **0 FAIL / 0 WARN**.
- Inspector: **0 FAIL / 1 WARN**. Typefaces Roboto 100% (mono đã hết), cỡ chữ dùng mạnh 11–30px, nút chính `#1c4e3a`.
- WARN còn lại được bảo lưu: `tiny-text` 55% dưới 13px — đây là dashboard nghiệp vụ dày đặc; 11–12px chỉ còn ở subline/meta (đơn vị KPI, breadcrumb, tên ấp) đúng như rule cho phép, dữ liệu chính 14px+, số KPI 24–30px, bảng 14px. Nâng tiếp sẽ chật layout quản trị.
- Điểm ROUND 2: ~7,3 — không còn FAIL nên hết trần; chrome phẳng, màu đi trên dữ liệu và CTA; bố cục vẫn là lưới quản trị quy ước (đúng chủ đích ứng dụng nội bộ, không phải landing page).
- Hồi quy sau sửa: `tsc` sạch; eslint không lỗi; vitest GIS + roster **188/190** (đúng 2 lỗi nền đã biết); Header + LoginScreen spec đạt; field-map smoke **PASS** (79.109 công trình, chọn nhà, giữ nút vẽ, bật/tắt Three.js, khôi phục native, không lỗi render).

## Mở rộng đánh giá frontend-design — 01/11/2026

Các số **0 FAIL / 0 WARN** ở trên thuộc nhóm chrome/tổng quan đã rà soát trước đây, không đại diện toàn project.

### Đã chỉnh

- Tab Nhật ký, Sơ đồ địa bàn, Hộ dân, Nhân khẩu, Khu vực, Hồ sơ và Cài đặt: giảm nhãn in hoa, bỏ emoji trang trí trùng icon Lucide, làm phẳng nền chuyển sắc và bỏ bóng tím trên chip lưu trú.
- Giữ màu phân loại hành động, tuyến hẻm, cư trú và nhóm thống kê nhân khẩu. Ngoại lệ ghi ngay tại class/config; không đổi dữ liệu hay điều kiện lọc để làm sạch chỉ số.
- Hướng dẫn bản đồ, OCR, giọng nói: nền đặc, nút rõ hơn; OCR có tên truy cập cho nút đóng. Giữ callback, quyền, xử lý camera/OCR và luồng tìm kiếm.
- Sửa xung đột Bootstrap làm tiêu đề tab/dialog quá lớn bằng selector giới hạn phạm vi trong `index.css`.
- Hộp thoại giọng nói giới hạn chiều cao theo viewport, cuộn phần thân và cho footer xuống hàng trên màn hình nhỏ.

### Kết quả và giới hạn

- Audit tĩnh cùng phạm vi **61 file** (components GIS + index.css + roster.css): **120 FAIL / 457 WARN → 34 FAIL / 435 WARN**. Artifact: `target/taste-full-lint.json`. Đây là cải thiện từng phần, chưa phải toàn project sạch lint thiết kế; các modal quản trị/hồ sơ và một số control bản đồ còn cần rà soát.
- Fixture `.mjs` trước đó chứa `import type` không hợp lệ với JavaScript; đã bỏ import không dùng và kiểm tra bằng `node --check`. Lỗi này không phải lỗi module ứng dụng hoặc bằng chứng lỗi HMR.
- Năm tab `residents`, `households`, `documents`, `logs`, `areas`: **20/20 PASS** tại 1280×800 và 375×812 light/dark; mount, không tràn ngang trang/header, callback refresh và tương phản token/menu chọn đạt. Không suy rộng phép đo token thành tương phản của mọi nhãn dữ liệu.
- Ba modal có fixture riêng `target/administration-modal-smoke.html`: tại 1280×800 light, mount và callback đóng/áp dụng tìm kiếm đạt trước vòng sửa responsive cuối. Camera bị từ chối bằng mock và SpeechRecognition bị tắt trong fixture; không dùng camera thật, dịch vụ giọng nói hoặc ghi dữ liệu thật.
- Sau sửa responsive: ba modal **6/6 PASS tại 375×812 light/dark**, có assertion bounding rectangle của nút đóng/xác nhận, không chỉ gọi `.click()`. Đã xem lại ảnh: footer giọng nói nằm trọn màn hình và nội dung cuộn được. Không kiểm tra nhận diện giọng nói/camera thật hoặc toàn bộ trạng thái OCR trong fixture này.
- Field-map smoke chạy lại light/dark, cả với `&editor`: **PASS**, 79.109 công trình, một GeoJSON/canvas, chọn nhà, giữ control vẽ, khôi phục native và sửa/lưu thuộc tính qua API adapter giả lập (`propertiesEdited: true`), không lỗi render.
- `tsc --noEmit`: đạt. GIS + roster: **188/190**, vẫn đúng hai lỗi dịch vụ nêu trên.
- ESLint phạm vi mở rộng còn **13 lỗi unused-vars có sẵn**: OCR 11, giọng nói 2; đối chiếu bằng lint source từ `git show HEAD:<file>` qua stdin cho cùng kết quả. Không xoá state/logic nghiệp vụ chỉ để làm sạch lint trong đợt UI này.
- Chưa chạy lại inspector tự động cho toàn bộ tab/modal mở rộng. Không dùng điểm ~7,3 của vòng tổng quan trước để chấm toàn project.

## Hoàn tất xử lý 34 mục tồn đọng — 01/11/2026

Phần này cập nhật trạng thái cuối, thay cho kết luận còn 34 FAIL ở vòng phía trên.

### Phạm vi đã đóng

- **61 file GIS/CSS cùng phạm vi ban đầu:** từ 120 FAIL xuống **0 FAIL / 423 WARN**. Xử lý nốt các modal hộ dân/camera/cảnh báo, phân quyền/quản trị, control bản đồ và select.
- **Mở rộng toàn bộ `src/main/webapp/app`: 296 file, 0 FAIL / 460 WARN**, lưu tại `target/taste-project-lint.json`. Không giới hạn quét ở riêng thư mục components nữa.
- Trang chủ bỏ minh hoạ JHipster chiếm phần lớn màn hình điện thoại, bỏ nền chuyển sắc/nhãn trang trí; giữ nội dung, liên kết, kiểm tra tài khoản và điều hướng `/dashboard`/đăng nhập.
- Hai bản `SuperAdminAccessGuard` cùng được sửa trình bày; không gộp/xoá file hoặc đổi nơi import trong một đợt UI.
- Giữ có lý do: màu phân loại cư trú/hẻm, mode xoay, màu danh mục công trình và biểu đồ; nhánh `accentColor` có sẵn của SearchableSelect; scrim trung tính trên ảnh để đọc caption; URL ảnh từ xa cố ý bị từ chối trong test OCR. Ngoại lệ được ghi ngay trong source, không sửa giá trị màu dữ liệu/renderer hoặc test expectation.
- Checkbox quyền hỗ trợ Space/Enter, có role/aria-checked/nhãn. Cùng gọi handler cũ; test mới xác nhận toggle không tự gọi lưu quyền.

### Kiểm tra trực quan và tương tác

- Inspector thật cho **Nhật ký, Hub quản trị, Phân quyền và Guard**, mỗi màn hình ở **1440/768/390 px, light/dark**: **8 báo cáo, không FAIL**, không dùng `--allow`. Artifact: `target/taste-final/<tab>-<theme>/report.json` và ảnh cùng thư mục.
- Fixture bổ sung viewport meta để inspector thực sự đo mobile, không phải ảnh desktop thu nhỏ. Đã xem lại ảnh desktop/tablet/mobile sau sửa.
- Sửa phát hiện từ ảnh/inspector: tiêu đề Bootstrap quá lớn, heading quản trị thiếu tương phản, nền chọn cán bộ bán trong suốt khó đọc, ô icon quyền lặp, chữ dưới 11px, bóng trên button. Rút gọn heading dài nhưng giữ mô tả vai trò, tên quyền và điều kiện cấp quyền.
- Ba màn hình quản trị và bốn modal **hộ dân/cảnh báo/camera/thêm hộ**: **28/28 smoke PASS** ở 1440×900 và 375×812, light/dark; kiểm tra mount, tràn ngang, callback và nút đóng trong viewport. Guard còn kiểm tra callback đăng nhập quản trị. Các tab con đơn vị/tài khoản/whitelist/an ninh của Hub cũng mount PASS ở mobile.
- Trang chủ: PASS ở 375 px chưa đăng nhập và 1440 px đã đăng nhập, nút mở không gian làm việc vẫn điều hướng `/dashboard`.
- Bản đồ chạy lại light/dark với editor: **PASS**, 79.109 công trình; một GeoJSON/canvas, chọn nhà, giữ nút vẽ, sửa/lưu bằng adapter giả lập, khôi phục native; không lỗi render. Không đo/chứng nhận 60 FPS từ smoke dùng software GPU.
- Mọi fixture quản trị chặn ghi API và dùng dữ liệu tổng hợp; camera/speech bị mock, không thao tác hồ sơ thật.

### Hồi quy cuối

- TypeScript: PASS; production build: PASS tại `target/design-final-build-20261101` (cảnh báo chunk lớn/dynamic import và Vite config đã có, không sửa kiến trúc trong đợt UI).
- **Toàn frontend: 363/365 test PASS** trên 65 file; GIS/roster riêng **189/191 PASS**, gồm test bàn phím mới. Hai test lỗi vẫn ở `operationalLoading.spec.ts` và `overviewDemographics.spec.ts`, không sửa service/công thức.
- So sánh ESLint cùng cấu hình/source HEAD với bản đang sửa trên **34 file**: **95 → 91 lỗi nền, không có loại lỗi/tần suất lỗi mới**. Artifact `target/design-eslint-regression.json`. Không coi kết quả này là toàn project sạch ESLint.

### Cảnh báo còn lại và giới hạn kết luận

- Inspector còn WARN về tỷ lệ chữ 11–12px, viền panel mạnh và khoảng cách 41px ở hai khối Hub. Giữ theo mật độ danh sách/mã cấu hình, khả năng phân biệt panel dark và khoảng cách giữa mô tả với nhóm thao tác; không có chữ dưới sàn 11px ở các màn hình inspector này. Không gọi đây là chứng nhận WCAG.
- **460 WARN tĩnh không bị xoá/ẩn**: gồm mono cho mã/ID, bóng overlay, trạng thái đang quét/nghe, màu dữ liệu và cả nợ trình bày cũ như `transition-all`/blur ở phần chưa cải tổ. Đây không phải 460 lỗi chức năng, nhưng cũng không phải khẳng định mọi WARN đều lý tưởng. Đã tách rõ khỏi 0 FAIL để không báo project “hoàn hảo”.
- Kết thúc phạm vi cải thiện và kiểm tra trên; UAT với tài khoản/địa bàn thật, mọi tổ hợp dữ liệu, thiết bị camera/micro và screen reader vẫn cần môi trường kiểm thử nghiệp vụ riêng. Không đổi API, route, dữ liệu, kiểm tra RBAC/địa bàn hay thuật toán renderer.

## Rà soát bằng skill `ui-ux` (evondevKit) — 16/11/2026

Chế độ **soi** (nhánh V của skill), chấm theo hệ của dự án (`MASTER.md`, token `--gis-*`), không theo token của skill. Nguồn: đọc code; chưa chạy `probe.mjs` của skill (cần Playwright, chưa cài) và bộ smoke CDP cũ trong `target/` đã bị dọn khi build, nên phần soi ban đầu dựa trên đọc code; kiểm tra trình duyệt được làm sau bằng harness mới (mục bên dưới).

### Đã sửa (20 dòng của bảng soi)

- **Hỏng:** vùng bấm dưới 24px (nút X chip lọc, xoá tìm kiếm, đóng modal; thêm utility `.gis-hit-target`); nút chỉ có icon thiếu tên truy cập; `div` bấm được không dùng được bằng bàn phím (card hộ, dòng cảnh báo, ô hộ ở Tổng quan, bộ chọn hộ, ảnh hiện trường); lỗi tải không có lối đi tiếp (thêm nút "Thử lại" ở Cơ sở, Văn bản, Đối tượng, danh mục hành chính, hub quản trị, phân quyền); class `dark` còn dính khi rời dashboard sang `/roster`.
- **Lệch hệ:** chữ dưới 11px ở mã nguồn (nâng lên 11px, câu báo lỗi 12px; vùng đã được vá bằng CSS đổi đúng sang 12px rồi gỡ luật vá); nút chính và màu viết cứng đổi sang `var(--gis-*)` có fallback; panel bản đồ `MapLibreAreaMap.css` theo token nên có dark mode; checkbox/radio/slider lấy `accent-color` primary (class `text-*` trên checkbox trước đây không có tác dụng); `.gis-control` cho ô ngày; nút chọn tệp của roster; mẫu báo lỗi form (`useFormCheck`: tóm tắt tiếng Việt được focus, `aria-invalid`, `aria-describedby`) cho 9 form đang dựa vào bong bóng trình duyệt, cùng focus cảnh báo ở 3 form đối tượng/cơ sở; dòng "Đang tải…" ở 3 tab và route; một scrim modal `.gis-modal-scrim` không blur; bỏ blur trên panel trình soạn 3D; bo góc nút nhỏ; `transition-all` → `transition-colors`; bỏ bóng card nghỉ và pulse "Chưa lưu"; bảng dưới 640px xếp thẻ (`shared/stack-table.css`); tiêu đề Nhật ký về cỡ tiêu đề trang.
- **Shell JHipster / Gu:** navbar nền `#122e35` (như sidebar), loading bar vàng `#d4af37`; thanh cuộn mảnh theo token (`:where()` để không đè chỗ cố ý ẩn); class chết ở Sidebar thay bằng token đúng màu đang render.

### Báo nhầm đã loại khi sửa

- Kích thước control header (36px) và nút trong ô tìm kiếm header: `index.css` đã ép lên 40/44px và 26×30px — không đổi.
- `bg-blue-600` trên nút và `rounded-lg/xl/2xl` đã được remap toàn cục sang primary / 6px; các chip trạng thái, chấm, badge màu phân loại giữ nguyên.

### Kiểm tra tự động

- `tsc --noEmit`: PASS. Vitest toàn frontend: **561/561 PASS** (103 file; thêm 4 test: `useFormCheck`, bàn phím của bộ chọn hộ, Thử lại ở Cơ sở và danh mục hành chính).
- ESLint trên 40 file đã đổi, so với HEAD cùng cấu hình: 0 lỗi trước và sau, không thêm loại cảnh báo.
- Prettier: sạch trên mọi file đã đổi.
- Taste-lint `--app` toàn `src/main/webapp/app`: **212 → 174** phát hiện (`transition-all` 23→0, `glass` 11→0, `shadow` 65→62); 2 FAIL `purple` là màu dữ liệu đã có trước (`buildingTheme.ts`, `linkQuality.ts`), không thuộc đợt này.
- `vite build` production: PASS (cảnh báo chunk lớn / dynamic import đã có).

### Kiểm tra trên Chrome bằng harness CDP mới

Harness dựng lại trong `target/ui-harness/` (không commit, `/target/` đã ignore): `serve.mjs` chạy Vite bằng chính `vite.config.ts` và phục vụ fixture ở `/ui-harness/`; `main.tsx` render component thật trong shell GIS thật (Sidebar + Header) với Bootstrap + Tailwind + token; `shoot.mjs` điều khiển Chrome headless qua CDP bằng `WebSocket` sẵn có của Node, trả mọi `/api/*` bằng dữ liệu tổng hợp ngay ở tầng mạng (không gọi server thật), chụp và đo. Không thêm dependency.

- 13 cảnh (Tổng quan, Sơ đồ địa bàn, lọc, Nhật ký, modal ghi nhật ký, Cài đặt, Cơ sở, Cơ sở lỗi tải, form thêm hộ, nhóm quyền, bộ chọn hộ, danh mục lỗi tải, navbar JHipster) × 375/768/1024/1440 px × sáng/tối = **104 ảnh, 0 tràn ngang, 0 chỗ bấm dưới 24px, 0 chữ dưới 11px, 0 lỗi console**. Báo cáo `target/ui-harness/report.json`, ảnh `shots/`, xem nhanh `gallery.html`.
- Form thêm hộ bấm lưu khi trống: tóm tắt 6 trường bắt buộc nhận focus (đo `document.activeElement`).
- Lỗi phát hiện nhờ harness và đã sửa: Nhật ký tràn 84px ở 375px (hai ô lọc cùng hàng → cho xuống dòng); nút "Xóa tất cả bộ lọc" cao 21px; checkbox Cài đặt bị bóp còn 13px; logo sidebar dạng dải (768–1279px) bị ép còn 15px và icon "Về trang chủ" bị cắt nửa (Bootstrap `.px-3 { padding: 1rem !important }` trùng tên class Tailwind); đầu modal thêm hộ xanh dương sáng → primary. Hai lỗi do chính đợt này gây ra cũng bắt được và đã sửa: `useFormCheck` dùng `checkValidity()` làm bộ chọn ấp tự mở và cướp focus (đổi sang `validity.valid`), và `.gis-hit-target` (CSS ngoài layer) đè `absolute` của Tailwind làm lệch nút xoá ô tìm kiếm (chuyển vào `@layer base`).

### Ghi nhận, chưa sửa

- **Trùng tên utility Bootstrap/Tailwind:** các utility spacing của Bootstrap có `!important` (`p-*`, `px-*`, `m-*`, `gap-*`…) thắng Tailwind cùng tên trên toàn app (vd. `px-3` ra 16px thay vì 12px, `p-5` ra 48px). Bố cục hiện tại đã được chỉnh trên nền đó; sửa toàn cục cần một đợt riêng có so ảnh trước/sau.
- Chưa chạy smoke bản đồ MapLibre/Three.js (chọn nhà, vẽ, bật/tắt hiệu ứng) và chưa xem panel bản đồ (giờ theo dark mode) trên bản đồ thật — harness hiện không dựng bản đồ để tránh dùng dữ liệu công trình thật.

## Đợt cải thiện UI/UX 11/2026 — nghiệm thu một lần

Thực hiện đủ 5 giai đoạn của kế hoạch rút từ đánh giá Playwright độc lập (quy ước mới ghi tại MASTER.md, mục "Đợt cải thiện 11/2026"). Nghiệm thu một lần sau khi làm xong, trên hai nguồn:

- **Dữ liệu giả, cùng kịch bản cho bản cũ (HEAD trước đợt, git worktree) và bản mới**: 19 route × 1440/820/390 px = 57 lượt mỗi bản.
- **Backend thật trong container** (Spring Boot dev + PostGIS 18 + Keycloak 26.7.4, DB mới: 51 ấp, 0 hộ), đăng nhập form Keycloak bằng `cskv_thanh` (sub-admin, giao 1 ấp) và `admin` (superadmin): 114 lượt bằng `tools/e2e/ui-audit.cjs`. So với lượt đo cùng môi trường trước đợt.

| Chỉ số                                                 | Trước                                  | Sau                             | Chỉ tiêu          | Đạt                                             |
| ------------------------------------------------------ | -------------------------------------- | ------------------------------- | ----------------- | ----------------------------------------------- |
| Chữ < 12px (giả / thật)                                | 12,7% / 11,7%                          | 0,5% / 0,3%                     | ≤ 3%              | Đạt                                             |
| Điều khiển < 44px, mobile (giả / thật)                 | 56% / 54%                              | 13% / 23%                       | ≤ 10%             | Chưa (còn `/roster` độc lập, bản đồ)            |
| Tràn ngang toàn trang                                  | 0                                      | 0                               | 0                 | Đạt                                             |
| Lỗi JS / lỗi API (backend thật)                        | 0 / 0                                  | 0 / 0                           | 0                 | Đạt                                             |
| Điều khiển trên header (tối đa)                        | 10                                     | 7                               | ≤ 6               | Gần đạt (ô tìm kiếm + nút giọng nói tính riêng) |
| Dòng đầu danh sách hộ, desktop / tablet / mobile (giả) | 484 / 554 / 535 px                     | 385 / 436 / 470 px              | ≤ 260 / – / ≤ 340 | Chưa                                            |
| Menu thiếu quyền chuyển hướng ngầm (`cskv_thanh`)      | 3 menu, đích khác nhau theo kích thước | Có thông báo, luôn về Tổng quan | Không chuyển ngầm | Đạt                                             |
| Font online (Google Fonts)                             | Lato + Inter                           | Không                           | Không             | Đạt                                             |

Kiểm tra tự động: `tsc --noEmit` sạch; Vitest **579/579** (trước đợt cũng 579/579; 3 test cập nhật theo hành vi mới, thêm kiểm tra ẩn hướng dẫn và trang thiếu quyền); ESLint trên file đã đổi 0 lỗi, cảnh báo 15 → 13; `vite build` đạt, không còn tham chiếu `fonts.googleapis`.

Lỗi tìm thấy khi nghiệm thu và đã sửa trong đợt: bảng rỗng giữ chiều cao 177px đẩy thông báo "Chưa có hộ…" xuống dưới thanh điều hướng đáy (ẩn bảng khi `tbody:empty`); dải hướng dẫn trên điện thoại cao 3 dòng (gộp còn 1 dòng); tab Hộ dân/Nhân khẩu trùng sidebar khi nhúng trong dashboard.

Chưa đạt / chưa đo, để đợt sau: dòng dữ liệu đầu còn cao hơn chỉ tiêu (còn bộ chọn ấp, dải hướng dẫn, dòng tóm tắt, khung bộ lọc 2 hàng trước bảng); `/roster` độc lập chưa áp kích thước điều khiển mới (ngoài `#__page-root`); checkbox lớp/ô nhập trong panel bản đồ vẫn < 24px; tỷ lệ bản đồ chiếm màn hình mobile, số lần Tab tới nội dung và chế độ tối chưa đo lại; danh sách có dữ liệu thật chỉ đo được trên máy local (`tools/e2e/ui-audit.cjs`).
