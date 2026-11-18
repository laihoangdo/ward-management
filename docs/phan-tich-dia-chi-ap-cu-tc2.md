# Địa chỉ, tên ấp cũ và tổ trong bốn file DSNK Trung Chánh 2

Khảo sát ngày **08/11/2026**, bổ sung cho [phân tích và mapping bốn file](phan-tich-mapping-dsnk-trung-chanh-2.md). Phạm vi: cấu trúc **địa chỉ**, tên ấp, tổ dân phố, số nhà, nhà trọ và metadata — các phần tài liệu trước chưa khảo sát. Chỉ đọc file và truy vấn đếm chỉ đọc trên PostgreSQL local; không chép tên, định danh, số điện thoại hay địa chỉ của cá nhân nào vào tài liệu này. Số nhà trong ví dụ đều đã được che.

Bối cảnh do cán bộ quản lý ấp cung cấp: sau sáp nhập, **ấp Trung Chánh 2 được gộp từ ấp 62 và một phần các ấp 61, 63, 69** — đúng bốn file trong `backups/tc2-roster-20261020/`.

## 1. Có ít nhất ba lớp tên ấp — cần cán bộ xác nhận

| File (ấp cũ) | Tên số khác cũng xuất hiện trong địa chỉ trong địa bàn | Số địa chỉ |
| ------------ | ------------------------------------------------------ | ---------: |
| 61           | ấp **10**                                              |        112 |
| 62           | ấp **11**                                              |        231 |
| 63           | ấp **12**                                              |         44 |
| 69           | ấp Trung Chánh 1 / Trung Chánh 2                       |         14 |

- Cặp 10→61, 11→62, 12→63 **cùng lệch 51**: dấu hiệu đánh số lại có hệ thống, không phải lỗi gõ.
- Ghi chú nguồn dạng "Ấp 11 (ấp Trung Chánh 2 cũ)" và "ấp 7 (ấp 3 cũ)".
- NOHT của file 62: địa chỉ khai báo ghi "ấp 11" từ 01/2024 đến khoảng 06/2025, ghi "ấp 62" chủ yếu từ 08–09/2025. Tuy vậy NOHT năm 2024 của file 61 đã ghi "ấp 61", nên **không suy ra được một mốc đổi tên chung**; hệ thống nguồn có thể đã cập nhật lại tên cho một phần hồ sơ.
- Bảng `hamlet` của ứng dụng dùng tên chữ (Trung Chánh 1/2, Mỹ Hòa 1, Tiền Lân 4…), khớp lớp tên sau sáp nhập.

Hệ quả: dữ liệu đã nhập `tc2_roster.residence_address` vẫn giữ tên cũ — **213 địa chỉ "ấp 11", 125 "ấp 10", 64 "ấp 12"**. Tìm kiếm/chuẩn hóa chỉ theo "Trung Chánh 2" hoặc "ấp 61/62/63/69" sẽ bỏ sót. Cần `hamlet_alias` (đã có trong [kế hoạch database](ke-hoach-database-dsnk-tc2-ap62.md)) lưu nhiều tên theo thời kỳ. Không tự đổi `hamlet_id`, polygon hay RBAC từ tên trong địa chỉ.

> **Đính chính:** một báo cáo trao đổi trước đọc nhầm ghi chú trên thành "Ấp 62 (ấp Trung Chánh 2 cũ)" do che chữ số. Giá trị đúng là **"Ấp 11 (ấp Trung Chánh 2 cũ)"**.

## 2. Tổ dân phố

- Trong địa bàn, "Tổ N" **chỉ đi kèm tên ấp dạng chữ** của cách ghi cũ: Mỹ Hòa 1 (tổ 10, 14, 15, 18, 33…), Trung Chánh 2 (tổ 13), Trung Chánh 1, Mỹ Huề, "ấp 3 cũ". Địa chỉ dùng số ấp 61/62/63/69 không ghi tổ.
- Số lần ghi tổ trong địa bàn rất ít (62: 2, 61: 15, 63: 5, 69: 0); phần lớn "Tổ N" là địa chỉ ngoài địa bàn (nơi thường trú của người tạm trú).
- Bảng `household` của ứng dụng: **0/1291 hộ TC2 có `neighborhood_group`**.

Kết luận: bốn file **không cung cấp danh sách tổ hiện hành** của Trung Chánh 2. Tổ phải lấy từ danh sách chính thức của cán bộ ấp; không suy từ số nhà hay ghi chú.

## 3. Ấp cũ là cách chia địa bàn có nguồn gốc rõ ràng

- 1291/1291 hộ TC2 trên bản đồ khớp `tc2_roster.household` qua `roster_id`.
- Theo provenance (`import_row` → `import_batch.legacy_hamlet`): **1290 hộ thuộc đúng một ấp cũ**, 0 hộ thuộc hai ấp, 1 hộ không có dòng nguồn.
- Phân bố: ấp 62 — 572 hộ, 61 — 445, 69 — 195, 63 — 78.

Ứng dụng dùng giá trị này làm bộ lọc "Ấp cũ (nguồn)" ở tab Sơ đồ địa bàn (xem mục 7).

## 4. Số nhà trùng sau khi gộp

Mỗi ấp cũ có dãy số riêng (số gốc trước "/"): 61 là 6–1508, 62 là 7–644, 63 là 11–92, 69 là 14–72. Sau khi gộp:

- **8 số nhà giống hệt nhau** xuất hiện ở hai ấp cũ khác nhau (62×63: 5, 61×62: 2, 61×69: 1);
- 25 cặp trùng số gốc (riêng 62×63 có 9).

"12/3A, Trung Chánh 2" có thể là hai căn nhà khác nhau. Khóa địa chỉ, tìm kiếm và liên kết hộ ↔ khối nhà trên bản đồ **phải kèm ấp cũ** cho tới khi có số nhà thống nhất mới.

## 5. Định dạng khác nhau giữa các file

| File | Mẫu địa chỉ thường trú (số đã che)                | Ghi chú                                                                           |
| ---- | ------------------------------------------------- | --------------------------------------------------------------------------------- |
| 61   | `999/9, ấp 61, xã Bà Điểm`                        | 5 địa chỉ còn ghi "xã Trung Chánh"; tên đường QL22, Nguyễn Ảnh Thủ, Trưng Vương 3 |
| 62   | `99/9A ấp 62, xã Bà Điểm, …`                      | ~92% không có tên đường; Lê Quang Đạo, Song Hành QL22, Thương Mại 1               |
| 63   | `99/9A, ấp 63, xã Bà Điểm, thành phố Hồ Chí Minh` | Ít tên đường                                                                      |
| 69   | `99/9A ấp 69`                                     | **Không ghi xã/tỉnh**; Trưng Vương 3                                              |

- Nhà trọ/phòng tập trung ở 62 (173 địa chỉ có "phòng", "nhà trọ", "nhà ngăn phòng cho thuê") và 61 (33); 63/69 gần như không có. Một số nhà có nhiều hộ/phòng: liên kết khối nhà phải cho phép 1 nhà ↔ nhiều hộ. Phần ngoặc của địa chỉ có thể chứa tên chủ nhà trọ — coi là dữ liệu cá nhân.
- Có địa chỉ "Nhà không số" và mô tả tương đối ("kế nhà…", "cạnh…").
- `household.street` và `alley` của 1291 hộ TC2 đều trống; địa chỉ nằm nguyên văn ở `raw_address`. Danh sách tuyến đường ghi cứng trước đây (Phan Văn Hớn, Bà Điểm 4, Nguyễn Thị Sóc…) không xuất hiện trong dữ liệu nguồn.

## 6. Metadata và dấu vết làm việc của cán bộ

- Cả bốn workbook **tạo ngày 08/07/2026 trong khoảng 17 phút** (03:33–03:50 UTC); sửa cuối 06/08–30/08/2026 (61 muộn nhất). Đây là mốc ngày nguồn còn để trống ở P0 của kế hoạch database.
- File 62: định dạng có điều kiện tô đỏ định danh trùng chỉ phủ dòng 2–1352 của Thường trú; **24 dòng 1353–1376 thêm sau không được kiểm tra trùng**. 5 dòng Thường trú tô vàng B–G, đều chưa đánh X và "Đang thường trú" — ý nghĩa chưa rõ. Màu xen kẽ ở Sheet1/Sheet2 là kiểu bảng, không mang nghĩa.

## 7. Thay đổi đã áp dụng trong ứng dụng

- API `GET /api/households` trả thêm `legacyHamlet` (chỉ đọc) lấy từ provenance nhập, qua một truy vấn gom nhóm cho mỗi trang; không đọc từ địa chỉ text, hộ có nguồn ở nhiều ấp cũ không nhận giá trị, không mở rộng phạm vi RBAC. Mapper bỏ qua trường này khi ghi.
- Tab Sơ đồ địa bàn: bỏ công thức tự chia Tổ 1–8; hộ chưa ghi tổ hiện "Chưa phân tổ" và bộ lọc tổ báo chưa có dữ liệu. Thêm bộ lọc "Ấp cũ (nguồn)". Danh sách tuyến đường lấy từ cột tên đường thật; hiện báo "chưa có dữ liệu tên đường" vì địa chỉ nguồn chưa được tách. Nhãn hẻm không còn ghép nguyên địa chỉ nguồn.

## 8. Cần cán bộ xác nhận

1. Thứ tự các lớp tên (ấp 10/11/12 → 61/62/63 → Trung Chánh 2?) và ngày hiệu lực; "ấp Trung Chánh 2 cũ" có cùng phạm vi với Trung Chánh 2 hiện nay không.
2. Danh sách tổ dân phố hiện hành của Trung Chánh 2 và hộ thuộc từng tổ.
3. Số trước dấu "/" có phải số hẻm không; cách phân biệt các số nhà trùng giữa ấp cũ.
4. Ý nghĩa 5 dòng tô vàng và 24 dòng thêm sau ở file 62.
