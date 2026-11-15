# Sơ đồ địa bàn (GĐ4)

Các bổ sung trên **Bản đồ 3D thực địa** (`FieldHouseMap`), không thay renderer MapLibre + Three.js.

## Tô màu theo "Diện quản lý"

Ô "Tô màu theo" có thêm chế độ **Diện quản lý**:

| Màu      | Ý nghĩa                                   | Nguồn                                |
| -------- | ----------------------------------------- | ------------------------------------ |
| Đỏ       | Nhà có đối tượng đang quản lý (mọi hệ)    | `subject` với `status = 'ACTIVE'`    |
| Xanh     | Nhà có đảng viên                          | `resident_tag` = `DANG_VIEN`         |
| Tím      | Nhà có cán bộ hưu trí hoặc cựu chiến binh | `resident_tag` = `CB_HUU_TRI`, `CCB` |
| Xám nhạt | Hộ không thuộc diện nào                   |                                      |

Một nhà có nhiều hộ hoặc nhiều diện thì lấy màu của diện cao nhất: đối tượng > đảng viên > CB hưu trí, CCB.

Dữ liệu lấy từ `GET /api/gis/household-categories`, chỉ tải khi chọn chế độ này. Hộ được nối với nhân khẩu qua `tc2_roster.household_membership` hiện hành. Phạm vi trả về giống danh sách hộ trên bản đồ: theo ấp được phân công, và theo tuyến đường nếu cán bộ chỉ được giao tuyến.

- Màu đỏ chỉ có khi tài khoản có `canViewSubjects` hoặc `canManageSubjects`. Đối tượng hệ Chính trị chỉ tính khi có thêm `canViewPoliticalSubjects`. Thiếu quyền thì chú giải bỏ mục "Nhà đối tượng" và hiện một dòng giải thích.

## Diện xã hội của nhân khẩu

Hồ sơ nhân khẩu (Danh sách hộ dân → chi tiết nhân khẩu) có thêm mục **Diện xã hội** với ba lựa chọn: Đảng viên, Cán bộ hưu trí, Cựu chiến binh.

- API: `GET/PUT /api/roster/residents/{id}/tags`.
- Sửa diện cần quyền `canUpdateInspection`, giống quyền sửa nhân khẩu. Mỗi lần thay đổi ghi `rbac_audit` (`update-resident-tags`), kèm giá trị trước và sau.

## Tên cơ sở trên nhà

Nhãn số nhà (từ zoom 17) ghi thêm tên cơ sở kinh doanh hoặc doanh nghiệp (`businessName`) của hộ trong nhà, ví dụ "Tạp hóa Minh · 12".

## Tìm kiếm

- **Theo toạ độ:** gõ hoặc dán "vĩ độ, kinh độ", ví dụ `10.8541, 106.6123`. Chấp nhận dấu phẩy, chấm phẩy hoặc khoảng trắng; nếu dán ngược thành kinh độ, vĩ độ thì tự đổi lại. Nhấn Enter để bay tới, cắm ghim đỏ và chọn công trình tại điểm đó nếu có. Mỗi số phải có phần thập phân, nên "12 3" vẫn được tìm như chữ.
- **Theo số nhà + tên đường:** gõ liền, ví dụ "12 đường số 3". Không cần dấu, áp dụng cho mọi ô tìm hộ dùng chung `matchesHouseholdSearch`.

## Vị trí của tôi và chỉ đường tới khối nhà

Áp dụng trên Bản đồ 3D thực địa.

**Cách dùng**

- **Vị trí của tôi** (thanh công cụ): bật theo dõi GPS. Bản đồ hiện chấm xanh, mũi tên hướng đi và vòng sai số, rồi bay tới vị trí đó.
- **Đi tới khối nhà** (khung công trình đang chọn), hoặc **Chỉ đường** (ngăn hồ sơ hộ):
  - Vẽ lộ trình theo đường thật từ chỗ cán bộ đứng; phần đã đi chuyển màu xám.
  - Thẻ chỉ dẫn ghi bước kế tiếp (ví dụ "Rẽ trái vào Nguyễn Ảnh Thủ · sau 45 m"), quãng còn lại và thời gian dự kiến.
- Thời gian dự kiến tính theo tốc độ trung bình: xe máy 25 km/h, đi bộ 4,5 km/h. Đi bộ được đi ngược đường một chiều; xe máy thì không.
- **Bám theo:** bản đồ quay theo hướng đi và giữ cán bộ ở phía dưới màn hình. Kéo hoặc xoay bản đồ thì tạm ngưng; bấm **Bám theo** để tiếp tục.

**Cập nhật theo thời gian thực**

- Lệch tuyến hơn 30 m hai lần liên tiếp thì tự tính lại lộ trình, tối đa 5 giây một lần.
- Cách đích ≤ 20 m thì báo **Đã tới khối nhà**.
- Màn hình được giữ sáng trong lúc dẫn đường, nếu trình duyệt cho phép.
- Nét đứt là đoạn không có trong dữ liệu đường: lối vào nhà, hẻm nhỏ chưa có trên OSM, hoặc khi đứng xa đường.

**Dữ liệu đường**

- Đường OpenStreetMap quanh xã (© OpenStreetMap contributors, ODbL) được nhập một lần vào bảng `public.gis_road`:
  - changelog `20261116000000_gis_road_osm.xml`;
  - lúc lập: 7.117 tuyến, 964 km.
- Làm mới bằng `node scripts/osm/import-badiem-roads.mjs`, rồi chạy Liquibase. Script chỉ gửi khung toạ độ của xã tới Overpass.
- Trình duyệt tải `GET /api/gis/roads` (GeoJSON, có ETag, cache 1 ngày) và tự tính lộ trình (A*).

**Chọn điểm xuất phát** (dòng **Từ** trong thẻ chỉ dẫn → **Đổi**)
- Mặc định xuất phát từ vị trí GPS.
- Khi GPS nằm ngoài vùng dữ liệu đường (cách đường hoặc cách đích hơn 1 km), ô chọn tự mở kèm lời giải thích.
- **Tìm theo chữ:** số nhà + tên đường, tên chủ hộ, tên công trình, tên đường OSM hoặc toạ độ. Tìm ngay trên máy, không gọi dịch vụ tra địa chỉ bên ngoài.
  - Hộ đã gắn khối nhà hoặc có toạ độ khảo sát thì dùng đúng vị trí đó. Hộ chỉ có vị trí tạm thì không đưa vào kết quả.
  - Không có hộ đúng số nhà (ví dụ "86 tiền lân 17"): gợi ý tuyến đường "Tiền Lân 17", ghi rõ "chưa có số nhà 86", lấy điểm giữa tuyến.
- **Chọn trên bản đồ:** chạm vào điểm muốn xuất phát; cú chạm này không làm đổi khối nhà đang chọn.
- Từ điểm đã chọn, lộ trình là **cố định**: hiện cả tuyến, không bám GPS. Bấm **Dùng vị trí GPS** để quay về dẫn đường theo vị trí thật.

**Quyền riêng tư:** vị trí cán bộ **không gửi lên máy chủ** và không lưu vết; tắt **Vị trí của tôi** là ngừng theo dõi.

**Yêu cầu**

- Mở ứng dụng qua HTTPS (localhost được miễn) và cho phép quyền vị trí của trình duyệt.
- GPS điện thoại thường sai số 5–20 m. Khi sai số trên 50 m, thẻ chỉ dẫn hiện cảnh báo.

## Chưa làm

- Không có giọng nói dẫn đường.
- Hẻm thiếu trong OSM chưa vẽ bổ sung được từ ứng dụng.
- Bản đồ của Danh sách hộ dân (`RosterMapPane`) vẫn tô màu theo chất lượng liên kết; chế độ diện quản lý mới chỉ có trên bản đồ 3D thực địa.
- Danh sách hộ chưa lọc được theo diện xã hội.
