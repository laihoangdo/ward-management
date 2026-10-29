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

## Kiểm tra hồi quy

- Kiểm tra light/dark ở 375, 768, 1024 và 1440 px, nội dung đơn vị/label dài, không overflow toàn trang.
- Kiểm tra menu, tìm kiếm/xóa/giọng nói, refresh, theme, cảnh báo và các callback hiện có.
- Chạy lại test GIS/roster và smoke chọn nhà/bật-tắt hiệu ứng/sửa thuộc tính trên bản đồ.
- Baseline trước đợt thiết kế: 185/187 test GIS + roster đạt; hai lỗi sẵn có tại `operationalLoading.spec.ts` và `overviewDemographics.spec.ts`. Không sửa dịch vụ hoặc công thức để làm xanh test trong một phase chỉ tối ưu giao diện; báo riêng nếu vẫn còn.
