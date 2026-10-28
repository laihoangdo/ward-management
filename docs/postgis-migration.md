# PostGIS — trạng thái hiện tại

Đã triển khai ngày **29/10/2026** bằng logical dump/restore sang một cluster mới, không gắn volume PostgreSQL cũ vào image mới.

- PostgreSQL 18.6 + PostGIS 3.6.4: `police-postgis-1`, cổng `5433`, volume `police_postgis18_data`.
- BE dùng tài khoản hạn chế `police_runtime` và bật kiểm tra PostGIS.
- Geometry WGS84/GiST cho hộ, ranh ấp và công trình thực địa; API viewport và kiểm tra toàn footprint.
- Cluster `5432` được giữ nguyên; database nghiệp vụ cũ mặc định read-only để phục hồi, không còn là nguồn vận hành.
- Backup sau triển khai đã được restore và đối soát thành công.

Xem [biên bản triển khai, lệnh vận hành, kiểm thử và phục hồi](postgis-deployment-20261029.md) trước khi thay cấu hình hoặc restore.

Tọa độ ngẫu nhiên và ranh tạm không trở thành dữ liệu đã xác minh chỉ vì được lưu trong PostGIS. Frontend vẫn dùng nguồn footprint nền hiện hành; chưa chuyển toàn bộ layer sang tải theo viewport.
