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
