# Loại bỏ pipeline VietMap cũ

Menu `vietmap-compare` đã bị loại bỏ. Dọn component `Field3DMapTab` không còn nơi import, các script tải VietMap/dựng và xuất Blender liên quan, cấu hình local và GLB 47.962.596 byte. Vite không còn publicDir dành riêng cho GLB này.

Giữ `AreaMapTab`, `MapLibreAreaMap`, `FieldHouseMap`, dữ liệu hộ dân, polygon nhà, ranh xã/ấp, sơ đồ DXF/TC2 và thư viện MapLibre/Three.js cho các luồng hiện tại. Không xóa dữ liệu chỉ vì tên có Blender hoặc 3D.

Tên bảng thực tế là `rbac_setting` (số ít). Migration `20261019000000_remove_vietmap_menu.xml` chỉ xóa bản ghi `kind='menus' AND id='vietmap-compare'` khi Liquibase chạy. Chưa thực thi trực tiếp trên database trong lượt dọn mã. Không sửa hồ sơ hoặc quyền các menu khác.

Giữ bộ lọc ID đã loại bỏ ở backend/frontend và regression tests để cấu hình cũ không làm menu xuất hiện lại. Các tài liệu audit trước đây là lịch sử tại thời điểm ghi, không mô tả tính năng đang hoạt động. Không xóa lịch sử audit hoặc sửa checksum các migration cũ.

Kiểm tra sau dọn: TypeScript đạt; 37 file / 145 test GIS đạt; `RbacMenuRemovalTest` đạt (lỗi bộ lọc được ghi ở audit SSE trước đây đã được sửa); Vite production build đạt, không còn GLB cũ trong output. Lượt build đầu gặp lỗi truy cập output khi Maven chạy; build lại sau Maven thành công. Chưa chạy migration trên database thực hoặc kiểm thử bản đồ bằng trình duyệt đã đăng nhập.
