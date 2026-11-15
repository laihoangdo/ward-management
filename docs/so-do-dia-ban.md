# Sơ đồ địa bàn (GĐ4)

Các bổ sung trên **Bản đồ 3D thực địa** (`FieldHouseMap`), không thay renderer MapLibre + Three.js.

## Tô màu theo "Diện quản lý"

Ô "Tô màu theo" có thêm chế độ **Diện quản lý**:

| Màu     | Ý nghĩa                                                   | Nguồn                                                       |
| ------- | --------------------------------------------------------- | ----------------------------------------------------------- |
| Đỏ      | Nhà có đối tượng đang quản lý (mọi hệ)                    | `subject` với `status = 'ACTIVE'`                           |
| Xanh    | Nhà có đảng viên                                          | `resident_tag` = `DANG_VIEN`                                |
| Tím     | Nhà có cán bộ hưu trí hoặc cựu chiến binh                 | `resident_tag` = `CB_HUU_TRI`, `CCB`                        |
| Xám nhạt | Hộ không thuộc diện nào                                   |                                                             |

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

## Chưa làm

- Bản đồ của Danh sách hộ dân (`RosterMapPane`) vẫn tô màu theo chất lượng liên kết; chế độ diện quản lý mới chỉ có trên bản đồ 3D thực địa.
- Danh sách hộ chưa lọc được theo diện xã hội.
