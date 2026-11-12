# KẾ HOẠCH NÂNG CẤP TOÀN DIỆN UI/UX ĐA THIẾT BỊ & NGHIỆP VỤ CÔNG AN CƠ SỞ

> **Dự án:** Hệ thống Quản trị & Điều hành Dân cư - Địa bàn Hành chính (Công an xã Bà Điểm)  
> **Tài liệu phân tích chi tiết kèm theo:** [`deep_ui_ux_analysis_and_enhancement_plan.md`](./deep_ui_ux_analysis_and_enhancement_plan.md)  
> **Tuân thủ chuẩn:** `design-system/municipal-administration/MASTER.md` & `AGENTS.md` (Bảng màu xanh `#1c4e3a`, không thêm dependency mới, giữ nguyên 100% RBAC và dữ liệu nghiệp vụ).

---

## 1. Mô tả Mục tiêu (Goal Description)

Phân tích chuyên sâu toàn bộ giao diện và trải nghiệm người dùng (UI/UX) trên cả 3 nền tảng thiết bị:
- **Desktop (`>= 1280px` & `1440px`):** Tối ưu cho bàn làm việc trực ban, nhập liệu hàng loạt, đối soát hồ sơ, xuất báo cáo giao ban.
- **Tablet (`768px - 1023px`):** Tối ưu cho họp giao ban chỉ huy, kiểm tra hiện trường bán lưu động, thao tác cảm ứng kết hợp bản đồ 3D.
- **Mobile (`< 768px`, chuẩn 390px - 414px):** Tối ưu cho Cảnh sát khu vực (CSKV) / Công an viên đi tuần thực tế ngoài ngõ hẻm, thao tác 1 tay trong vùng ngón tay cái (Thumb Zone), định vị tìm nhà xung quanh 50m.

Đồng thời giải quyết triệt để bài toán:
1. **Loại bỏ tính năng thừa (Redundant):** Dọn dẹp các component trùng lặp, nút bấm phân tán, cơ chế cuộn giật lag trên di động.
2. **Bổ sung tính năng thiếu (Missing):** Nghiệp vụ tách/nhập hộ, tìm kiếm hẻm nhiều xuyệt (`120/45/8/..`), bộ lọc chiến dịch cao điểm (Nghĩa vụ quân sự, độ tuổi Căn cước mới, tạm trú sắp hết hạn).
3. **Đột phá với 5 Tính năng Đặc biệt (Specialized Features):**
   - Chế độ "Tuần tra Thực địa 1 Chạm" (Smart GPS Patrol Mode).
   - Sơ đồ Cây Quan hệ Gia đình Trực quan (Visual Household Lineage).
   - Sơ đồ 3D Phân tầng Nhà trọ & Chung cư mini (Multi-tier Vertical 3D).
   - Bản đồ Tuyến đường Hẹp & Lớp An toàn PCCC (Fire Safety Layer).
   - Sổ tay Ngoại tuyến & Đồng bộ Thông minh (Offline Cache & Sync).

---

## 1.1. Nguyên tắc Dữ liệu Thật (bắt buộc)

Chi tiết và bảng khoảng trống dữ liệu ở mục 1.3 của tài liệu phân tích. Tóm tắt:
1. Mọi dữ liệu đến từ API backend và PostgreSQL; không mock, không fixture, không `localStorage` cho dữ liệu nghiệp vụ.
2. Chưa có dữ liệu thì hiển thị "Chưa ghi nhận", không điền giả.
3. Chuỗi triển khai: Liquibase -> backend (RBAC, audit) -> API -> frontend -> test.
4. Không thêm dữ liệu mẫu vào context `dev/prod/test`.
5. Ghi dữ liệu phải qua RBAC theo ấp, `change_event` và idempotent.
6. Toạ độ `RANDOM_WITHIN_TC2`/`UNLOCATED` không dùng cho tuần tra GPS.
7. Hệ thống có 51 ấp (bảng `hamlet`); roster backend hiện cố định một ấp (`RosterService.hamlet()`) và phải được mở rộng ra 51 ấp theo RBAC (xem Quyết định đã chốt số 3).

---

## 2. Các Điểm Cần Người Dùng Đánh Giá & Quyết Định (User Review Required)

> [!IMPORTANT]
> **Quyết định 1: Dọn dẹp triệt để các component cũ `HouseholdsTab.tsx` và `ResidentsTab.tsx`**  
> Hiện tại hệ thống đang chạy luồng `UnifiedRoster` (`RosterPage.tsx`). Việc giữ lại `HouseholdsTab.tsx` và `ResidentsTab.tsx` gây lãng phí bộ nhớ và khó bảo trì. Đề xuất: Loại bỏ hoàn toàn 2 file cũ sau khi đã hợp nhất toàn bộ tính năng vào `RosterPage.tsx`.

> [!IMPORTANT]
> **Quyết định 2: Hợp nhất màn hình 3D SuperAdmin (`BaDiem3DMapEditor.tsx`) vào `FieldHouseMap.tsx`**  
> `BaDiem3DMapEditor` hiện lưu nháp vào `localStorage` và đọc JSON tĩnh, không phải dữ liệu DB. Đề xuất: bỏ ghi `localStorage`, chỉnh sửa hình học chỉ qua `PUT /api/gis/field-buildings/{id}` (đã có RBAC), giữ giới hạn 20 tầng / 70 m. Lưu ý `AGENTS.md` cấm thay renderer MapLibre/Three.js dùng chung canvas và cấm khôi phục viewer tab đã gỡ, nên chỉ chuyển các chức năng cần thiết và cần duyệt riêng.

> [!TIP]
> **Quyết định 3: Triển khai Chế độ Tuần tra GPS 50m trên Mobile**  
> Tính năng này sử dụng `navigator.geolocation` của trình duyệt trên điện thoại của cán bộ để truy vấn endpoint PostGIS "hộ gần nhất" (chỉ hộ có vị trí `VERIFIED` hoặc liên kết công trình). Vị trí cán bộ không được lưu liên tục; chỉ toạ độ lúc check-in được ghi cùng bản ghi xác minh. Cần người dùng phê duyệt việc cấp quyền vị trí khi cán bộ kích hoạt chế độ đi tuần.

---

## 3. Câu Hỏi Mở Cần Làm Rõ (Open Questions)

> [!NOTE]
> Các quyết định đã chốt:
> 1. **Dữ liệu PCCC & Tuyến hẻm hẹp:** dùng bảng DB nhập qua API có RBAC (có `source`, `recorded_by`, `recorded_at`), không dùng GeoJSON tĩnh. Còn cần: người cung cấp dữ liệu khảo sát thật.
> 2. **Chiến dịch Căn cước:** tách nhóm tuổi `Dưới 6`, `Từ 6 đến dưới 14` và `Từ đủ 14` (cùng các mốc 25, 40, 60). *Giả định, cần xác nhận lại nếu ý khác.*
> 3. **Phạm vi roster = 51 ấp:** `RosterService.hamlet()` (`RosterService.java:62`) và `RosterVerify.java:39` đang cố định mã `27592-TRUNGCHANH-2` (Ấp 62, do dữ liệu thật hiện chỉ nhập từ file Excel TC2 của ấp này), và mọi truy vấn roster lọc theo ấp đó. Cần bỏ hằng số này: ấp được xác định từ tham số + phạm vi RBAC của người dùng (`rbac.area(...)`), áp dụng cho cả import, danh sách, bản đồ, báo cáo. Đây là điều kiện tiên quyết trước khi làm bộ lọc chiến dịch và tuần tra cho các ấp khác.
> 4. **Địa chỉ nhiều xuyệt:** chỉ tìm tiền tố trên `raw_address` (có index), không thêm cột `alley_path`/`old_house_number`.

---

## 4. Kế hoạch Thay Đổi Mã Nguồn Chi Tiết (Proposed Changes)

### Phân hệ 1: Khung Điều Hướng & Giao Diện Tổng Thể (Header, Sidebar, Mobile Bar)

#### [MODIFY] [`Header.tsx`](file:///d:/PROJECT/police/police-jhip/src/main/webapp/app/gis/components/Header.tsx)
- Trên Mobile (`< 768px`): Thu gọn các nút hành động đơn lẻ (OCR, Camera) vào menu phụ ngữ cảnh; giải phóng diện tích cho thanh tìm kiếm và hiển thị đơn vị hành chính.
- Bổ sung chỉ báo trạng thái mạng: `Trực tuyến` (Online xanh lá) / `Ngoại tuyến` (Offline vàng cam) có icon trực quan.

#### [MODIFY] [`Sidebar.tsx`](file:///d:/PROJECT/police/police-jhip/src/main/webapp/app/gis/components/Sidebar.tsx)
- Giữ nguyên cơ chế Rail trên Tablet và Drawer trên Mobile.
- Bổ sung mục truy cập nhanh "Chế độ Tuần tra Địa bàn" dành riêng cho Cảnh sát khu vực.

---

### Phân hệ 2: Hồ Sơ Hộ Dân & Nhân Khẩu (`RosterPage.tsx`, `HouseholdDetailModal.tsx`)

#### [MODIFY] [`HouseholdDetailModal.tsx`](file:///d:/PROJECT/police/police-jhip/src/main/webapp/app/gis/components/HouseholdDetailModal.tsx)
- Bỏ cơ chế neo cuộn `scrollIntoView` gây giật màn hình trên Mobile.
- Thay bằng Tabs chuyển đổi mượt mà:
  - Tab 1: **Thông tin hộ & Địa chỉ** (kèm hỗ trợ hẻm nhánh nhiều xuyệt và số nhà cũ).
  - Tab 2: **Cây quan hệ gia đình (Visual Lineage)**: Trực quan hóa Chủ hộ -> Vợ/Chồng -> Con cái -> Tạm trú.
  - Tab 3: **Kiểm tra thực tế**: Bộ trạng thái (Đã xác minh, Vắng mặt 1/2, Chuyển đi) + Ảnh hiện trạng + Ghi chú.
  - Tab 4: **Nhà trọ / Cho thuê** (nếu là hộ kinh doanh phòng trọ: quản lý danh sách phòng).
- Đưa các nút hành động cốt lõi ("Lưu", "Xác minh", "Chụp ảnh") xuống **Sticky Bottom Bar** cố định ở đáy màn hình.

#### [MODIFY] [`RosterPage.tsx`](file:///d:/PROJECT/police/police-jhip/src/main/webapp/app/roster/RosterPage.tsx)
- Bổ sung bộ lọc **Chiến dịch Nghiệp vụ Nhanh**:
  - `military`: Nam 18–27 tuổi có hộ khẩu thường trú.
  - `identity_renewal`: Đến mốc tuổi cấp đổi Căn cước (14, 25, 40, 60 tuổi).
  - `temporary_expiring`: Tạm trú hết hạn trong 15 ngày tới.
  - `elderly`: Người cao tuổi từ 80 tuổi trở lên.
- Tích hợp nghiệp vụ **Tách hộ / Nhập hộ**: Chọn 1 hoặc nhiều nhân khẩu từ hộ hiện tại để chuyển sang hộ khác hoặc tạo hộ mới mà không làm mất lịch sử.

#### [DELETE] [`HouseholdsTab.tsx`](file:///d:/PROJECT/police/police-jhip/src/main/webapp/app/gis/components/HouseholdsTab.tsx) & [`ResidentsTab.tsx`](file:///d:/PROJECT/police/police-jhip/src/main/webapp/app/gis/components/ResidentsTab.tsx)
- Xóa bỏ sau khi đã hoàn tất di chuyển toàn bộ chức năng vào `RosterPage.tsx`.

---

### Phân hệ 3: Bản Đồ Không Gian 3D Thực Địa (`FieldHouseMap.tsx`, `ThreeBuildingLayer.ts`)

#### [MODIFY] [`FieldHouseMap.tsx`](file:///d:/PROJECT/police/police-jhip/src/main/webapp/app/gis/components/FieldHouseMap.tsx)
- Bổ sung chế độ **"Tuần tra Thực địa 1 Chạm" (Smart GPS Patrol Mode)**:
  - Nút bật/tắt GPS trên thanh công cụ di động.
  - Tự động quét và hiển thị 3 hộ dân gần nhất trong bán kính 50m.
  - Bấm 1 chạm để điểm danh xác minh kiểm tra ngay tại cửa nhà.
- Tích hợp lớp bản đồ **An toàn PCCC**:
  - Tô màu cam/đỏ cho các tuyến hẻm hẹp `< 3.5m`.
  - Hiển thị vị trí các trụ nước chữa cháy.
  - Cảnh báo công trình nhà trọ/chung cư mini chưa mở lối thoát nạn thứ 2.

#### [MODIFY] [`ThreeBuildingLayer.ts`](file:///d:/PROJECT/police/police-jhip/src/main/webapp/app/gis/components/ThreeBuildingLayer.ts)
- Bổ sung khả năng hiển thị **Mặt cắt phân tầng (Multi-tier floor slice)** khi cán bộ chọn một khối nhà trọ cao tầng.
- Phân biệt màu sắc các tầng/phòng theo trạng thái an ninh và nhân khẩu tạm trú.

---

### Phân hệ 4: Dịch Vụ Hỗ Trợ Ngoại Tuyến (Offline Field Support)

#### [NEW] `src/main/webapp/app/gis/services/offlineStorageService.ts`
- Quản lý bộ đệm cục bộ bằng `IndexedDB` cho các hộ dân và nhân khẩu thuộc phạm vi phân quyền của cán bộ.
- Lưu trữ hàng đợi thao tác ngoại tuyến (Offline mutation queue).

#### [NEW] `src/main/webapp/app/gis/services/geoPatrolService.ts`
- Cung cấp hàm theo dõi GPS độ chính xác cao và tính khoảng cách Haversine với tọa độ các hộ dân.

---

## 5. Kế Hoạch Xác Minh & Kiểm Thử (Verification Plan)

### 5.1. Kiểm thử Tự động (Automated Tests)
1. **ESLint & Prettier:**
   ```powershell
   npm run lint
   ```
   *Mục tiêu:* 0 lỗi, tuân thủ nghiêm ngặt chuẩn `MASTER.md`.
2. **TypeScript Strict Typecheck:**
   ```powershell
   npm run source:check
   ```
   *Mục tiêu:* `tsc --noEmit --noUnusedLocals --noUnusedParameters` đạt 0 lỗi.
3. **Unit Tests Vitest:**
   ```powershell
   npm test
   ```
   *Mục tiêu:* Toàn bộ test suites hiện có và các bài test mới cho `HouseholdDetailModal`, `geoPatrolService`, `offlineStorageService` đều PASS 100%.

### 5.2. Kiểm thử Thực tế trên Trình duyệt (Manual Verification)
- **Kịch bản 1 (Desktop):** Đăng nhập với tài khoản cán bộ -> Mở Roster -> Thử bộ lọc chiến dịch Nghĩa vụ quân sự -> Kiểm tra tốc độ lọc danh sách.
- **Kịch bản 2 (Tablet):** Mở Bản đồ 3D -> Bấm vào một công trình cao tầng -> Kiểm tra thao tác xem phân tầng mặt cắt các phòng.
- **Kịch bản 3 (Mobile 390px):**
  - Mở chi tiết hộ dân -> Kiểm tra hiển thị Cây quan hệ gia đình (Chủ hộ -> Vợ -> Con) -> Kiểm tra nút bấm cố định ở đáy (Sticky Bottom Bar).
  - Bật Chế độ Tuần tra GPS -> Kiểm tra danh sách nhà tự động xếp theo khoảng cách.
  - Ngắt kết nối mạng (DevTools Offline) -> Thử ghi nhận kiểm tra -> Bật lại mạng -> Xác minh dữ liệu được đồng bộ thành công.
