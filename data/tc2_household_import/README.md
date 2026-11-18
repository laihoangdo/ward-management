# Kết quả nhập sơ đồ Ấp Trung Chánh 2 — 2026-10-13

Đã nhập **896 bản ghi hộ dân** vào DB Monolithic, `hamlet_id=28`, Ấp Trung Chánh 2, xã Bà Điểm. Tên chủ hộ ngẫu nhiên có tiền tố `[GIẢ LẬP]`. Mỗi bản ghi có mã `TC2-...` riêng và ghi chú `[TC2_DXF_ESTIMATED]`. Cán bộ phụ trách ghi Thành theo yêu cầu; phân công RBAC hiện có được giữ nguyên, không cấp thêm quyền.

Từ 903 nhãn DXF có 792 số nhà khác nhau. 89 số xuất hiện nhiều lần, liên quan 200 nhãn; không gộp các số nhà có vị trí khác nhau. Không có nhãn trùng cả số nhà và tọa độ. Một nhãn chưa đủ chứng minh là một hộ cư trú độc lập: các bản ghi khởi tạo cần đối chiếu thực địa.

## Định vị

Người dùng đã cung cấp bốn mốc GPS khác nhau và xác nhận G1–G4 trong `gps_correspondences_review.png`. Mốc QL22–Nguyễn Ảnh Thủ gửi lặp chỉ tính một lần. Tọa độ và điểm DXF tương ứng nằm trong `user_gps_control_points.json`.

Phép căn chỉnh affine bình phương tối thiểu dùng tọa độ đông/bắc cục bộ gần G1. Sai lệch khớp mốc: 7,516 / 13,983 / 12,431 / 5,964 m; RMSE **10,513 m**. Đây là sai lệch khớp mốc, **không phải độ chính xác GPS từng nhà**. Không có điểm kiểm tra độc lập. Các tọa độ nhà là ước lượng từ bản vẽ tay, không phải tọa độ khảo sát hay ranh thửa chính thức.

**7 điểm ngoài ranh giới tham chiếu chưa nhập:** `154/6B`, `154/6H`, `1484`, `154/7`, `154/8`, `154/9`, `1508`. Xem `held_for_review.csv`. Ranh giới tham chiếu của dự án là provisional; không kết luận chắc chắn các địa chỉ thuộc xã khác và không kéo điểm vào trong ranh.

## Dữ liệu chưa xác minh

DXF không liên kết tên đường/hẻm chính xác với từng số nhà. Trường đường ghi **Chưa đối chiếu đường/hẻm (sơ đồ TC2)**; hẻm, tổ và ngày kiểm tra ghi **Chưa xác minh**. Không suy ra đường chỉ từ khoảng cách gần nhất. `current_map_corridor.geojson` có 11 hình học đường từ dữ liệu dự án liên quan Quốc lộ 22, Song Hành và Nguyễn Ảnh Thủ, chỉ dùng tham chiếu.

Không tạo số điện thoại, CCCD hoặc bản ghi nhân khẩu giả. Bộ đếm nhân khẩu là 0, kèm ghi chú chưa xác minh: **0 là giá trị khởi tạo, không phải kết quả điều tra dân số**. NORMAL là trạng thái khởi tạo của ứng dụng, không phải kết luận kiểm tra an ninh thực địa. Không coi tên giả lập là thông tin chủ hộ thật.

Các file DSF/QSF/DXF/HTM gốc được giữ nguyên. HTM chỉ tham chiếu QSF bằng ActiveX; không chạy ActiveX hoặc tải plugin cũ. SHA-256 nguồn và kiểm tra ban đầu nằm trong `inspection.json`; kết quả sau nhập nằm trong `live_import_report.json`.

## Kiểm tra

- Nhập thử trên DB sao chép; lần nhập thứ hai không tạo thêm hộ trùng.
- DB chính có 896 mã riêng, 896 tọa độ hợp lệ, 896 tên giả lập và 896 ghi chú ước lượng.
- Giữ nguyên 362 hộ cũ và dữ liệu nhân khẩu, hamlet, phân công, profile quyền, hồ sơ, cảnh báo, nhật ký tuần tra, GIS-building; đối chiếu toàn bộ nội dung với DB thử nghiệm đều khớp.
- Giao dịch có khóa, kiểm tra đúng mã hành chính của ấp và ghi sự kiện trong rbac_audit.
- Ứng dụng báo health UP. Không thay đổi frontend/backend hay menu. Chưa kiểm thử giao diện có đăng nhập trong bước này.

Tải lại dữ liệu ứng dụng và chọn **Ấp Trung Chánh 2**. Các quyền đọc tiếp tục theo phân công sẵn có. Không tạo ranh nhà mới; cách dựng khối minh họa của ứng dụng giữ nguyên.

## Tệp và tái tạo

`households_review.csv` và `households_draft.json` là bản trích ban đầu. `households_georeferenced.csv` chứa 903 nhãn đã tính tọa độ và trạng thái nhập. `household_points.estimated.geojson` có cả 7 điểm giữ lại, nên không nhập toàn bộ như dữ liệu đã được chấp nhận.

`import_households.sql` chỉ chứa 896 bản ghi được chọn; mã nguồn ổn định ngăn nhập lặp, không ghi đè hồ sơ tồn tại. `rollback_import.sql` chỉ xóa theo đúng mã nhập và dấu nguồn; kiểm tra dữ liệu liên quan/chỉnh sửa cần giữ trước khi dùng. FK có thể ngăn xóa nếu đã có nhân khẩu liên kết.

`georeference_report.json`, `live_import_report.json`, `preservation_check.json` lưu tham số căn chỉnh, kết quả nhập và đối chiếu bảo toàn.

```powershell
py -3.14 scripts/prepare_tc2_households.py
py -3.14 scripts/georeference_tc2_households.py
```

Hai lệnh tạo tệp, không tự ghi DB. Lệnh chuẩn bị ghi đè bản nháp CSV, nên lưu bản chỉnh sửa ở file riêng. Mốc đã xác nhận được lưu riêng. Nhập lại SQL không tự cập nhật tọa độ cũ để tránh ghi đè chỉnh sửa thực địa.

Sao lưu trước nhập: `backups/tc2-import-20261013/Monolithic-before.sql`, loại khỏi Git vì chứa dữ liệu riêng tư. DB thử `tc2_import_audit_20261013` còn được giữ để kiểm tra. Không phục hồi đè DB chính chỉ để đối chiếu vài bản ghi.