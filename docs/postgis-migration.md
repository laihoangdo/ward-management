# Chuyển GIS sang PostGIS theo từng bước

## Bước 1 — tọa độ hộ dân (đã chuẩn bị)

`src/main/docker/postgresql.yml` dùng `postgis/postgis:18-3.6` cho môi trường mới. Liquibase `20261008210000_postgis_foundation.xml` bật extension PostGIS khi gói đã có trong PostgreSQL, tạo `household.location_geom` kiểu `geometry(Point,4326)` và chỉ mục GiST. Cột này **được sinh tự động** từ `longitude` và `latitude` hiện có. Tọa độ `(0,0)` hoặc ngoài phạm vi hợp lệ cho giá trị `NULL`.

API kéo thả/đổi tọa độ vẫn cập nhật `latitude` và `longitude` như trước; PostgreSQL tự cập nhật `location_geom` trong cùng giao dịch. Giao diện MapLibre/Three.js và API hộ dân chưa cần đổi ở bước này.

Migration cũng tạo cột hình học có chỉ mục cho `gis_building.footprint_geom` và `gis_road.line_geom`. Hai bảng này hiện chưa có dữ liệu; các cột hình học chưa được nạp tự động từ sơ đồ DXF hoặc GeoJSON. Không thể suy ra tọa độ thực địa của DXF chỉ từ bản vẽ.

## Nâng cấp DB đang chạy

Container hiện tại dùng `postgres:18.6` và một Docker volume ẩn danh chứa dữ liệu. Image này không có gói PostGIS nên Liquibase **bỏ qua, không ghi nhận** hai changeset mới; ứng dụng vẫn khởi động được. Đổi image trong Compose không tự cài extension vào container đang chạy.

Trước khi tạo lại container, cần sao lưu toàn bộ DB và xác nhận đường dẫn volume hiện tại. Không dùng `docker compose down -v` hoặc `up --renew-anon-volumes`: hai lệnh đó có thể bỏ volume dữ liệu. Sau khi có bản sao lưu đã kiểm tra, tạo lại container bằng image PostGIS 18, giữ nguyên volume PostgreSQL 18; sau đó chạy Liquibase và kiểm tra:

```sql
SELECT extversion FROM pg_extension WHERE extname = 'postgis';
SELECT count(*) FROM household WHERE location_geom IS NOT NULL;
SELECT ST_AsText(location_geom) FROM household WHERE location_geom IS NOT NULL LIMIT 1;
```

Kiểm tra sửa tọa độ một hộ dân qua giao diện rồi xác nhận `longitude`, `latitude` và `ST_X(location_geom)`, `ST_Y(location_geom)` thay đổi cùng nhau. Luôn dùng `[longitude, latitude]` trong geometry GeoJSON/PostGIS, còn giao diện `HouseholdFacility.coordinates` hiện là `[latitude, longitude]`.

## Bước 2 — hình nhà và đường thực địa

Xác định nguồn footprint/centerline đã gắn GPS (WGS84/EPSG:4326), chuẩn hóa geometry thành `MultiPolygon` cho nhà và `MultiLineString` cho đường, rồi nạp có kiểm tra vào `gis_building`/`gis_road`. Liên kết nhà với `household_id` sau khi đối chiếu địa chỉ và vị trí; không gán hàng loạt theo thứ tự hay tạo khối nhà giả từ GPS. Nguồn DXF/iGrafx cần điểm khống chế thực địa trước khi chuyển sang tọa độ địa lý.

## Bước 3 — dùng PostGIS trong API bản đồ

Đọc nhà/đường theo khung nhìn bằng `ST_Intersects` trên cột geometry và trả GeoJSON cho MapLibre/Three.js. Giữ API hộ dân hiện tại làm nguồn hồ sơ, trạng thái và thao tác sửa tọa độ. Chỉ thay nguồn hình học của layer sau khi dữ liệu bước 2 đã được kiểm tra trên bản đồ.
