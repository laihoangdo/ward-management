# Cập nhật tên ấp cũ trong địa chỉ Trung Chánh 2

Script: [`scripts/data-fix/tc2-old-hamlet-addresses.sql`](../scripts/data-fix/tc2-old-hamlet-addresses.sql) · hoàn tác: [`tc2-old-hamlet-addresses-rollback.sql`](../scripts/data-fix/tc2-old-hamlet-addresses-rollback.sql)

## Đổi gì

`12/3A Ấp 62, Xã Bà Điểm` → `12/3A Ấp Trung Chánh 2, Xã Bà Điểm`

- Ấp cũ: 61, 62, 63, 69 và số cũ hơn 10 (=61), 11 (=62); kể cả cách viết `ấp`, `AP`, `ấp.`, `Âp`.
- **Số nhà trùng giữa hai ấp cũ** (cùng "31/5" ở ấp 62 và ấp 63) sẽ thành hai địa chỉ giống hệt, nên chỉ các địa chỉ này **giữ tên ấp cũ trong ngoặc**: `31/5 Ấp Trung Chánh 2 (ấp 63 cũ)`. Ngoặc dùng số ấp hiện hành (địa chỉ ghi "ấp 11" → "(ấp 62 cũ)"). Danh sách số nhà trùng được tính lại mỗi lần chạy (gộp 10→61, 11→62, cả địa chỉ đã đổi ở lần trước) và in trong báo cáo. Trên dữ liệu local: 14 số nhà — 11/3, 13/3T, 13/5, 13/6, 16/3A, 21/11, 21/4, 21/6, 23/5, 23/5Y, 31/5, 37/2B, 39/3, 52/5 (nhiều hơn 8 trong [phân tích](phan-tich-dia-chi-ap-cu-tc2.md) vì ở đây "ấp 11" được tính là ấp 62).
- Địa chỉ **hộ** của Trung Chánh 2 và địa chỉ trong **hồ sơ cư trú** (thường trú, tạm trú, nơi ở hiện tại, khai báo) của TC2.
- **Không đổi:** địa chỉ cư trú ghi xã/phường/huyện/tỉnh khác (quê quán, ví dụ "ấp 11, xã Đông Thạnh", "ấp 10, xã Hóc Môn") — script liệt kê số lượng theo đơn vị; "ấp 12" (số cũ của 63) và các số ấp khác; địa chỉ chỉ khác dạng mã Unicode.
- Không đổi `hamlet_id`, polygon, RBAC hay ấp cũ trên bản đồ (lấy từ file nguồn khi nhập, không đọc từ địa chỉ).

Số liệu trên bản dữ liệu local 17/11/2026: 1.288 hộ (1.241 đổi gọn, 47 giữ ngoặc), 8.162 địa chỉ cư trú (337 giữ ngoặc), 19 địa chỉ bỏ qua (xã Đông Thạnh 11, xã Hóc Môn 4, xã Hưng Long 3, xã Xuân Thới Sơn 1). Production có thể khác — đọc báo cáo của lần chạy thử.

## An toàn

- Một transaction; lỗi bất kỳ → không ghi gì. Kiểm tra trước: collation đọc đúng hoa/thường tiếng Việt, có ấp Trung Chánh 2.
- Hộ đi qua trigger kiểm toán (`tc2_roster.change_event`, trước/sau, actor, lý do kèm `run_id`); script kiểm đủ một sự kiện cho mỗi hộ. `version` của hộ tăng để form đang mở không ghi đè lại chữ cũ.
- Mỗi giá trị cũ/mới chép vào `database_repair.tc2_old_hamlet_address_fix` theo `run_id`. Chỉ cập nhật dòng còn đúng nội dung đã đọc; dòng bị sửa đồng thời → huỷ cả lần chạy.
- Chạy lại không đổi thêm gì (địa chỉ đã đổi không còn khớp).
- Đã diễn tập trọn vòng trên bản sao DB: áp dụng → chạy lại (0 thay đổi) → hoàn tác → dấu vân tay địa chỉ trùng bản gốc.

## Chạy trên production

1. Backup mới theo quy trình hiện có (`infra/vps/backup-production-local.sh`) và kiểm tra file backup.
2. Chép script vào máy chủ, rồi trong container database (cùng cách `admin_psql` của `infra/vps/migrate-production-db.sh`):

```bash
DB=<tên container database production>
run() { docker exec -i "$DB" bash -ec 'export PGPASSWORD="$(cat /run/secrets/database_owner)"; exec psql -X -h 127.0.0.1 -U Monolithic -d Monolithic -v ON_ERROR_STOP=1 "$@"' -- "$@"; }

# a) Chạy thử: đọc báo cáo (số hộ/địa chỉ, ví dụ trước→sau, địa chỉ bỏ qua)
run -v actor='Họ tên người chạy' < tc2-old-hamlet-addresses.sql
# b) Diễn tập: ghi + kiểm tra rồi ROLLBACK
run -v actor='Họ tên người chạy' -v apply=1 -v rehearse=1 < tc2-old-hamlet-addresses.sql
# c) Áp dụng — GHI LẠI run_id in ra
run -v actor='Họ tên người chạy' -v apply=1 < tc2-old-hamlet-addresses.sql
```

3. Kiểm tra trên ứng dụng: danh sách hộ TC2 hiện `Ấp Trung Chánh 2 (ấp 6x cũ)`; Lịch sử thay đổi của một hộ có sự kiện CORRECTION với lý do trên.

Hoàn tác (chỉ khôi phục địa chỉ chưa bị sửa sau đó):

```bash
run -v actor='Họ tên' -v run_id=<run_id> < tc2-old-hamlet-addresses-rollback.sql            # chạy thử
run -v actor='Họ tên' -v run_id=<run_id> -v apply=1 < tc2-old-hamlet-addresses-rollback.sql # hoàn tác
```

## Lưu ý sau khi chạy

- Tìm kiếm danh sách hộ khớp **từng từ** (không cần đúng thứ tự, bỏ qua hoa/thường, dấu phẩy): "12/3A ấp trung chánh 2", "trung chánh 2 12/3A", "12/3A" đều tìm theo địa chỉ hiện tại. "ấp 62" chỉ còn ra các hộ giữ "(ấp 62 cũ)"; ấp cũ của mọi hộ vẫn có ở bộ lọc "Ấp cũ (nguồn)" trên Sơ đồ địa bàn (lấy từ file nguồn).
- Dữ liệu nhập Excel mới sau này vẫn mang tên ấp cũ theo file nguồn; chạy lại script sẽ chỉ đổi phần mới.
