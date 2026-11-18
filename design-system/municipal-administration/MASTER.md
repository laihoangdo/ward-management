# Giao diện điều hành hành chính địa phương

## Phạm vi

Tối ưu lớp trình bày cho ứng dụng hiện có, phù hợp sử dụng nội bộ ở xã/phường/thành phố. Đây là quy ước thiết kế của dự án, không phải bộ nhận diện chính thức hoặc chứng nhận tuân thủ.

Giữ nguyên route, API, dữ liệu, quyền theo vai trò/địa bàn và hành vi nghiệp vụ. Giữ tên đơn vị/vai trò lấy từ hồ sơ hiện có; không đổi mô hình phân quyền hay đổi tên nghiệp vụ để khớp một template.

## Hướng thiết kế đã chọn

- Trang trọng, bình tĩnh, rõ thứ bậc, ưu tiên thông tin và thao tác thường dùng.
- Tham khảo skill UI UX Pro Max: style **Accessible & Ethical**, ID `accessible-and-ethical`, trạng thái active, phù hợp Government và chi phí render thấp; kiểm chứng bằng truy vấn style `accessible ethical`.
- Tham khảo UX `keyboard focus visible`: giữ focus ring rõ trên mọi control.
- Tham khảo stack HTML/Tailwind 4.3 `responsive layout`: padding và bố cục thay đổi theo không gian khả dụng.
- Kết quả design-system tự động có phần Hero/CTA của landing page không phù hợp ứng dụng nghiệp vụ; không sử dụng phần bố cục đó. Giữ cấu trúc dashboard/sidebar/bảng/bản đồ đang có.
- Không sử dụng các gợi ý font tải từ Google hoặc thêm thư viện animation/icon. Giữ Roboto/Inter/Arial/system sans và Lucide hiện có; font phải đọc tốt tiếng Việt.

## Semantic tokens dùng chung

Nguồn thực thi: `src/main/webapp/app/gis/index.css`, mở rộng các biến `--gis-*` hiện có; không tạo theme độc lập.

| Vai trò                    | Light                 | Dark      |
| -------------------------- | --------------------- | --------- |
| Primary / chữ trên primary | `#1c4e3a` / `#ffffff` | Như light |
| Nền ứng dụng               | `#f8f9fa`             | `#0b1520` |
| Surface                    | `#ffffff`             | `#111f2c` |
| Surface phụ                | `#f1f5f3`             | `#1b2c3a` |
| Chữ chính                  | `#172c35`             | `#edf3f7` |
| Chữ phụ                    | `#526170`             | `#b0c0cb` |
| Border                     | `#cbd2d9`             | `#3b4e5b` |
| Border input               | `#84939c`             | `#718693` |
| Chữ accent                 | `#1c4e3a`             | `#a7dfbd` |

Sidebar giữ nền xanh trầm `#122e35`, surface `#1b3940`, chữ `#f1f7f5`, chữ phụ `#b9cdc9`. Mục đang chọn có nền `#e8f1ec`, chữ `#153c2c` và vạch nhấn vàng. Không dùng màu đơn độc để biểu thị lựa chọn: giữ `aria-current`, chữ và icon.

Giữ các màu cảnh báo, trạng thái hộ dân, phân quyền, biểu tượng và layer địa lý hiện có; không đồng loạt tô màu nghiệp vụ theo brand.

## Component

- **Header:** surface đặc, không backdrop blur; title có thể xuống dòng; control tìm kiếm, cập nhật, cảnh báo, giọng nói, theme và tài khoản giữ callback cũ. Điều chỉnh bố cục theo chiều rộng workspace, không chỉ viewport. Nội dung phụ thu gọn trước khi ảnh hưởng vùng thao tác chính.
- **Sidebar:** các nhóm/menu/quyền không đổi; label dài được xuống dòng; thông tin đơn vị/vị trí không bị cắt cứng. Icon dùng Lucide; thay ký tự trang trí emoji bằng vector sẵn có.
- **Tổng quan:** giữ thống kê, công thức, cảnh báo và nút điều hướng; làm rõ heading, phân cấp thẻ và label. Không thêm số liệu, badge hoặc xu hướng giả.
- **Danh sách/hồ sơ:** giữ bảng, bộ lọc, trang và thao tác; tái sử dụng token chung trong `roster.css`. Không thay kích thước canvas hay cấu trúc workspace nghiệp vụ.
- **Bản đồ:** chỉ chỉnh toolbar, panel, label, form, focus và surface. Không đổi geometry, projection, renderer, event chọn nhà, quyền, giới hạn 20 tầng/70 m, lưu/liên kết hay tile offline.
- **Đăng nhập:** card gọn, nhấn brand vừa phải, copy rõ ràng; giữ nguyên luồng đăng nhập backend và link trang chủ.

## Nhịp điệu và trạng thái

- Spacing theo nhịp 4/8 px; border radius chủ yếu 6–8 px; shadow nhỏ và tĩnh.
- Chữ nội dung/bảng khoảng 14–16 px; nhãn phụ không dưới 12 px ở nội dung chính; heading trang 20–24 px. Input trên mobile 16 px.
- Control chính desktop khoảng 40–44 px; mobile ít nhất 44 px khi có thể. Không kéo giãn control bản đồ một cách làm mất chức năng trên màn hình nhỏ.
- Chuyển trạng thái ưu tiên màu/border, không nhảy layout hoặc chạy animation liên tục; tôn trọng reduced motion.
- Mục tiêu kiểm tra tương phản: chữ thông thường ít nhất 4,5:1; focus/control boundary có tương phản phù hợp. Đây không thay thế kiểm thử toàn diện bằng screen reader hoặc chứng nhận WCAG.

## Rà soát taste-skill — quy ước áp dụng cho app screen

Skill `design-taste-frontend` chạy ở chế độ `--app` (dashboard/admin), không dùng rule landing page. Kết quả đo lưu ở `target/taste-before/` và `target/taste-after/`. Quy ước rút ra, áp dụng cho mọi sửa giao diện sau này:

- **Không đặt icon trong ô nền màu.** KPI là nhãn + số; icon đi kèm thì trơn và màu chữ. Ngoại lệ duy nhất: logo brand đơn nhất ở sidebar.
- **Số liệu không dùng font mono**; dùng `tabular-nums` để canh cột.
- **Không nhãn eyebrow** (chữ hoa, tracking rộng phía trên tiêu đề); viết thường, cỡ body.
- **Card phẳng:** không shadow ở trạng thái nghỉ. Shadow chỉ cho overlay thật: menu thả, dialog, drawer, panel nổi trên bản đồ, sticky bar.
- **Cỡ chữ nhỏ nhất 12px** (đổi từ 11px trong đợt 11/2026); subline/meta 12px, dữ liệu và nhãn chính 13–14px, số KPI lớn. Không dùng `text-[11px]`.
- **Transition gọi tên thuộc tính** (`transition-colors`, `transition-[width]`), không dùng `transition-all`.
- **Không animation lặp** (ping/pulse/bounce) trong chrome; chỉ giữ trong phản hồi chức năng của modal (đang nghe, đang quét).
- **Màu cảnh báo chỉ hiện khi có cảnh báo** (ví dụ thẻ "Cảnh báo hồ sơ" về trung tính khi count = 0).
- Pattern chức năng bắt buộc giữ (remap dark mode, focus ring, neutralizer animation) phải mang comment `taste-skill-ignore` trên đúng dòng bị flag, kèm `/* prettier-ignore */` cho block CSS kết thúc bằng `{` để comment không bị prettier dịch dòng.
- Hue phân loại hành động, tuyến hẻm, cư trú và dữ liệu biểu đồ được giữ khi có nhãn/legend nhất quán; không coi mọi màu tím là trang trí. Ngoại lệ ghi tại class/config, không đổi logic hoặc giấu trạng thái để vượt lint.
- Kiểm tra Bootstrap/Tailwind trên trình duyệt thật: cỡ heading có thể bị Bootstrap ghi đè. Selector sửa phải giới hạn ở tiêu đề/tab/dialog liên quan; không reset toàn cục.
- Modal mobile: giới hạn chiều cao theo viewport, nội dung cuộn được và nút đóng/xác nhận nằm trong vùng thao tác. Callback chạy thành công không chứng minh nút thực sự nhìn thấy; smoke phải kiểm tra bounding rectangle.
- Chỉnh skill hoặc bỏ qua chỉ số đo đều không chấp nhận; nếu một WARN không sửa được thì bảo lưu bằng lý do ghi trong tài liệu kiểm thử.

## Ưu tiên người dùng tuyến cơ sở (công an viên, cán bộ ấp/xã)

Rút ra từ đợt rà soát 11/2026, áp dụng khi sửa các màn hình dùng hằng ngày:

- **Việc thường làm nằm trong màn hình đầu**, nhất là trên điện thoại 390 px: ô tìm kiếm và dòng kết quả đầu tiên của danh sách hộ/nhân khẩu phải thấy được mà không cuộn. Tab chức năng nằm một hàng, cuộn ngang trong chính nó.
- **Dưới 640 px, bảng thành danh sách dòng hai tầng**: dòng 1 là định danh (mã hộ/họ tên, dạng liên kết chữ), các trường còn lại có nhãn cột (`data-label`). Không bỏ trường, không bắt cuộn ngang trang.
- **Số liệu chính (4 KPI) luôn đứng đầu Tổng quan**, khối "Cần chú ý" ngay sau đó (đổi trong đợt 11/2026: trước đây cảnh báo đứng đầu khi có việc, làm KPI rơi xuống dưới màn hình đầu ở 900 px). Khi trống, "Cần chú ý" là một dòng trạng thái trung tính. Màu cảnh báo, nhãn đếm và bộ lọc "sắp hết hạn" chỉ mang màu khi số lượng > 0.
- **Một `h1` mỗi màn hình** (tiêu đề ở header). Nội dung nhúng trong dashboard dùng `h2` và không lồng `<main>`.
- **Không hiển thị nhãn trống**: thông tin hồ sơ (số hiệu, địa bàn) chỉ hiện khi có dữ liệu.
- Dòng phụ dưới tiêu đề nói về dữ liệu (phạm vi đang xem), không hướng dẫn cách dùng giao diện.
- Tiêu đề trong card dùng `.gis-panel-title` (16 px) và tiêu đề từng mục `.gis-item-title` (15 px) vì Bootstrap ghi đè cỡ `h3/h4` của Tailwind.
- Nút chỉ có icon luôn có `aria-label`; icon trang trí đặt `aria-hidden`.
- **Form:** không dựa vào bong bóng lỗi của trình duyệt. Khi bấm tiếp mà còn trường bắt buộc trống: tóm tắt lỗi tiếng Việt ở đầu form (được focus), mỗi trường có `aria-invalid` và dòng báo nằm ngoài `label` (nối bằng `aria-describedby`), tự xóa khi đã nhập. Áp dụng cả cho `select` bắt buộc.
- **Dải phạm vi địa bàn** của công an viên/cán bộ ấp là một dòng nền sáng: ấp, vai trò, tuyến, số hộ. Không hiện tổng nhân khẩu ở đó vì cách đếm khác giữa các màn hình; con số đó thuộc trang Tổng quan.
- **Kiểm tra theo vai trò thật:** dùng tài khoản thử có tiền tố tạo qua `/api/rbac/users` trên Keycloak/DB local, xóa bằng `DELETE /api/rbac/users/{id}` và kiểm tra còn 0 bản ghi sau khi chụp. Không xem giao diện cán bộ chỉ bằng tài khoản quản trị.
- **Cấp xã (Trưởng Công an xã):** danh sách hơn 3 ấp được giao gập sau dòng "N ấp được giao"; không để thông tin hồ sơ đẩy menu xuống dưới màn hình đầu.
- **Nhật ký:** dữ liệu JSON (hình học, bản ghi) gập trong "Xem dữ liệu thay đổi"; giá trị thường hiện đầy đủ, không cắt. Không gắn nhãn "thời gian thực" hay "mã hóa" khi dữ liệu không như vậy.
- **Nhãn trạng thái nói đúng điều dữ liệu biết:** không có cảnh báo trong dữ liệu ghi "Không có vị trí cần kiểm tra", không ghi "An toàn ANTT". Số nhân khẩu cộng theo hộ phải ghi rõ "theo hộ".
- Ô chọn trong `label` dùng `.gis-check-row` (Bootstrap làm `label` inline-block, phá `flex` của Tailwind).
- **Không đưa control ghi dữ liệu mà server luôn từ chối.** API cũ `/api/households`, `/api/residents` chỉ cho đọc (`UnifiedRosterWebConfiguration` trả 409 cho mọi lệnh ghi); với hộ TC2, sửa thông tin và cập nhật ghi chú phải dẫn sang hồ sơ hộ trong roster.
- Trang Cài đặt chỉ hiện sự thật kiểm chứng được (trạng thái kết nối); không hiện danh mục API, phiên bản hay huy hiệu "đã xác thực" không có nguồn.

## Đợt cải thiện 11/2026 (đánh giá độc lập + 5 giai đoạn)

Rút từ đánh giá Playwright 114 lượt trên backend/DB thật (bảng 1–8 trong canvas đánh giá). Quy ước mới, thay thế điều mâu thuẫn ở trên:

- **Header** giữ: thu/mở sidebar, nút **Trang chủ** (mở trang portal `/`), tiêu đề = **đúng nhãn menu đang mở**, chấm trạng thái máy chủ, tìm kiếm (kèm giọng nói), cập nhật, hướng dẫn, **đồng hồ kèm thứ/ngày/tháng/năm** (từ md; dòng ngày từ lg), giao diện sáng/tối, chuông. Không đặt lối tắt module hay tài khoản/đăng xuất trên header. (Nút Trang chủ và đồng hồ được người dùng chọn giữ lại, 11/2026.)
- **Sidebar:** logo → **thẻ cán bộ ở đầu** (nhãn vai trò, cấp bậc + họ tên, chức vụ, số hiệu, Đổi tài khoản, địa bàn được giao, nút đăng xuất) → menu theo nhóm → "Hướng dẫn sử dụng" → chân chỉ có trạng thái máy chủ. Thứ tự trong nhóm theo công việc (`workOrder` trong `Sidebar.tsx`), không theo thứ tự lưu trên server. Mục "Quản trị và phân quyền" (Phân quyền cán bộ, Trung tâm quản trị) được làm nổi: chữ/icon vàng, viền vàng nhạt, để không lẫn với việc hằng ngày. (Bố cục thẻ cán bộ ở đầu được người dùng chọn giữ lại, 11/2026.)
- **Một đường dẫn đăng xuất** (trong thẻ cán bộ ở sidebar). Trang `/` là trang portal ("Không gian làm việc địa bàn"), giữ như cũ theo lựa chọn của người dùng, 11/2026.
- **Dải "Hướng dẫn" theo menu** ẩn được bằng nút ✕, ghi nhớ theo menu (`localStorage gis.guideBanner.hidden`); nút "?" ở header và mục sidebar vẫn mở cẩm nang.
- **Không âm thầm chuyển màn khi thiếu quyền:** hiện `.gis-denied-notice` ("Tài khoản chưa được cấp quyền mở …"), đích dự phòng luôn là Tổng quan nếu được phép. Trang `/admin` thiếu quyền có nút "Về bảng điều hành".
- **Kích thước điều khiển trong vùng làm việc:** ô nhập/select ≥ 40px, nút ≥ 36px trên chuột; mọi ô nhập/select/nút ≥ 44px và chữ nhập ≥ 16px trên thiết bị cảm ứng (`pointer: coarse`); checkbox/radio 20px. Canvas bản đồ và control MapLibre không bị ép; thanh công cụ Bản đồ 3D (ngoài canvas) ≥ 44px khi cảm ứng.
- **Nút dùng chung:** `.gis-btn-primary` / `.gis-btn-secondary`; trạng thái disabled nền sáng, chữ đủ tương phản (không làm mờ khối tối).
- **Thẻ danh sách < 640px:** bỏ ô STT, giá trị đứng ngay sau nhãn (không căn phải xa nhãn). Ngày, STT, mã không bị bẻ giữa token (`overflow-wrap: break-word`, không `anywhere`).
- **Danh sách rỗng** dùng `.roster-empty`: nói vì sao rỗng (bộ lọc hay chưa có dữ liệu) và bước tiếp theo. Bảng cấu hình trống có dòng giải thích.
- **Chip lọc trên điện thoại** là một hàng cuộn ngang, không xếp nhiều hàng. Tab con của Trung tâm quản trị là một hàng `nav` cuộn ngang.
- **Panel hồ sơ hộ trên bản đồ** (`HouseholdDetailModal` dạng drawer): đầu panel = dòng địa bàn (chỉ phần có dữ liệu) + mã hồ sơ rút gọn (đủ khi rê chuột), địa chỉ làm tiêu đề tối đa 2 dòng; "Mở hồ sơ đầy đủ" là nút chính chiếm cả hàng; các thao tác khác là lưới 4 ô bằng nhau (icon trên nhãn ngắn, ≥ 56px), không xếp nút lẫn cỡ. Tổ dân phố hiện trong "Thông tin hộ" ("Chưa có tổ dân phố" khi trống, không bịa giá trị). Điện thoại: bottom sheet 72dvh.
- **Thông báo trên Bản đồ 3D** thu về một dòng `<details>` (Three.js, chế độ chỉ xem) để bản đồ giữ phần lớn màn hình điện thoại.
- **Màn chờ đầu tiên** (`index.html`): chữ tiếng Việt + vòng xoay, sau 15 s gợi ý tải lại. Không hiển thị trang gỡ lỗi JHipster cho người dùng.
- **Không tải font online** ở bất kỳ shell nào: Bootswatch `$web-font-path: false`, cùng một stack font hệ thống cho dashboard, `/roster`, `/admin` và theme đăng nhập Keycloak.
- **Theme đăng nhập Keycloak (`territory`)** theo token sáng/xanh lá của app, không dùng nền xanh navy/nút xanh dương riêng.
- **Chữ:** tiêu đề, nút, tab viết hoa đầu câu ("Lưu cấu hình phân quyền"), giữ hoa cho tên riêng và viết tắt (CSKV, CAV, ANTT).

## Kiểm tra hồi quy

- Kiểm tra light/dark ở 375, 768, 1024 và 1440 px, nội dung đơn vị/label dài, không overflow toàn trang.
- Chạy `tools/e2e/ui-audit.cjs` (xem đầu file) với tài khoản cán bộ ấp và quản trị trên DB thật, so `target/ui-audit/report.json` với lần trước: chữ < 12px, điều khiển < 44px, tràn ngang, lỗi JS/API, chuyển hướng ngầm.
- Kiểm tra menu, tìm kiếm/xóa/giọng nói, refresh, theme, cảnh báo và các callback hiện có.
- Chạy lại test GIS/roster và smoke chọn nhà/bật-tắt hiệu ứng/sửa thuộc tính trên bản đồ.
- Baseline trước đợt thiết kế: 185/187 test GIS + roster đạt; hai lỗi sẵn có tại `operationalLoading.spec.ts` và `overviewDemographics.spec.ts`. Không sửa dịch vụ hoặc công thức để làm xanh test trong một phase chỉ tối ưu giao diện; báo riêng nếu vẫn còn.
