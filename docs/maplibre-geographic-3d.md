# Bản đồ tọa độ MapLibre 2D/3D

Màn MapLibre mở ở chế độ tọa độ và dùng các hộ dân hiện có của ứng dụng. `Household` đã có số nhà, đường, hẻm, ấp, chủ hộ, trạng thái, dân số và tọa độ. Hộ thiếu tọa độ hoặc tọa độ được ước lượng không được dựng trên bản đồ địa lý. Với hộ có tọa độ nhưng chưa có ranh nhà, bản đồ tạo một footprint **minh họa 6 × 8 m** và dùng chiều cao mặc định của `BUILDING_TYPES` (không suy đoán số tầng thật). Click khối hoặc điểm hộ dân mở luồng chi tiết hộ dân hiện có. Chủ hộ chỉ hiện thành nhãn khi người dùng chủ động bật lớp đó.

`AreaZone` đã có `boundaryGeoJson`. Bản đồ đọc ranh giới hợp lệ từ `/api/area-zones`; không tạo bảng khu vực trùng lặp. Nếu dữ liệu hiện chưa có ranh, layer ranh giới sẽ trống. Các bảng GIS mới chưa có dữ liệu đường/ranh nhà đã georeference nên ứng dụng không tự tạo đường từ tên địa chỉ.

Có thể nạp GeoJSON WGS84 `FeatureCollection` vào phiên xem. `properties.kind` nhận `building`, `road` hoặc `area`:

```json
{
  "type": "FeatureCollection",
  "features": [
    { "type": "Feature", "properties": { "kind": "building", "id": "B-1", "householdId": "12", "address": "124/5 Nguyễn Văn Cừ", "buildingType": "two", "floors": 2, "height": 7 }, "geometry": { "type": "Polygon", "coordinates": [[[106.6119,10.854],[106.612,10.854],[106.612,10.8541],[106.6119,10.8541],[106.6119,10.854]]] } },
    { "type": "Feature", "properties": { "kind": "road", "id": "R-1", "name": "Nguyễn Văn Cừ", "roadType": "main", "width": 6, "status": "Đang sử dụng" }, "geometry": { "type": "LineString", "coordinates": [[106.6119,10.8539],[106.6122,10.8542]] } }
  ]
}
```

`roadType` là `main`, `secondary`, `alley`. Đường được trải thành polygon theo `width` (mét) rồi dựng bề mặt MapLibre cao 0,18 m; độ rộng mặc định tương ứng 8/5/2,5 m nếu thiếu thuộc tính. Khối nhà có footprint thực từ GeoJSON được ưu tiên so với khối minh họa của cùng `householdId`. Để liên kết đúng hồ sơ, `householdId` phải bằng `Household.id` dạng chuỗi. Chiều cao và màu mặc định lấy từ `/api/gis/building-types`, với giá trị dự phòng trong `mapModel.ts`.

Panel layer có công tắc nhà, ba loại đường, ranh khu vực, nhãn và điểm hộ dân. Các lớp địa điểm/trường/chợ/cơ sở tôn giáo/an ninh được liệt kê nhưng vô hiệu hóa cho tới khi có dữ liệu địa lý được phân loại. Nhãn hộ dân chỉ xuất hiện từ zoom 16,5, giới hạn 120 nhãn trong khung nhìn và loại trùng theo ô màn hình. Tên chủ hộ mặc định ẩn. Chế độ Population dùng heatmap theo số cư dân từng hộ; Household Density dùng heatmap theo số hộ. Risk tô theo trạng thái hồ sơ, không phải mô hình dự báo rủi ro. Camera hỗ trợ zoom, pan, xoay, nghiêng, reset, toàn màn hình và đổi 2D/3D.

## Thiết kế lưu trữ mở rộng

Migration `20261008190000_gis_3d_model.xml` thêm `gis_map`, `gis_building_type`, `gis_road`, `gis_building`, `gis_map_layer`, `gis_map_source`. Bảng nhà dùng khóa ngoại nullable tới `Household`, `AreaZone`, `gis_road` và loại nhà; không sao chép hồ sơ hộ dân. Các bảng mới chưa tự động nhập DXF vì bản vẽ chưa được gắn GPS. `GET /api/gis/building-types` đọc màu và chiều cao mặc định; quản trị viên có thể cập nhật qua `PUT /api/gis/building-types/{code}`. Việc nạp GeoJSON ở màn review vẫn chỉ tồn tại trong phiên trình duyệt, chưa ghi vào `gis_road`/`gis_building`.

Three.js render thân, mái và đế bằng instanced meshes trong custom layer chung camera với MapLibre. Khối dùng hộp bao của footprint để nhẹ; ranh đa giác gốc vẫn ở lớp chọn nhà MapLibre. Có nút chuyển về extrusion MapLibre cơ bản. Công cụ MapLibre cũng có tìm hộ, định vị, chụp ảnh canvas, panel lớp và hướng dẫn. Ảnh chụp canvas có thể không bao gồm nhãn DOM nổi.
