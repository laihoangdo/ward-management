# Bản đồ 2D/3D ấp TC2

Trong tab **Bản đồ giám sát**, chọn **Thử bản đồ MapLibre 2D/3D**. Cùng một bản đồ chuyển giữa góc nhìn 2D và 3D. Điểm hộ dân hiện có được hiển thị từ tọa độ đã lưu; nhấp điểm hoặc ranh nhà có `householdId` trùng hồ sơ để mở chi tiết.

Màn MapLibre hiện mở mặc định ở **Sơ đồ TC2**: 903 nhãn địa chỉ trong `vector.DXF` được dựng thành 903 khối minh họa. 149 khối dùng đường bao DXF khép kín chứa nhãn; 754 khối còn lại dùng ô nhỏ ước lượng quanh nhãn vì chưa có ranh ô đủ rõ trong DXF. Chiều cao đồng nhất chỉ để minh họa, không phải chiều cao thực tế. Mô hình Blender 497 khối vẫn được dùng để căn chỉnh sơ đồ và lấy một số nhãn địa danh, nhưng không còn là nguồn đếm ô nhà. Đây là **tọa độ cục bộ của bản vẽ**, chưa định vị GPS. Nền OSM và các ghim hộ dân bị ẩn trong chế độ này để tránh nhầm với vị trí thật. Có thể đổi giữa 2D/3D ngay trên cùng sơ đồ. Nút **Bản đồ tọa độ** trở lại nền OSM và dữ liệu hộ dân thật.

Sơ đồ còn có lớp **Nét DXF** bật/tắt được: 1.745 đường nét từ `vector.DXF` được căn với mô hình Blender bằng 356 cặp số nhà duy nhất. Trong đó 244 cặp có sai lệch tối đa 4 đơn vị sơ đồ; sai số trung vị của nhóm này là 2,18 đơn vị. 112 cặp số nhà duy nhất chưa đạt ngưỡng cần kiểm tra thủ công trong `docs/tc2-dxf-blender-match-review.csv`. Lớp DXF chứa cả ranh nhà lẫn mép đường/hẻm; file gốc đặt tất cả trên layer `0`, vì vậy ứng dụng **không gắn nhãn các nét này là đường giao thông**. Chạy `python scripts/extract_dxf_schematic.py` để tái tạo khối địa chỉ, lớp nét, tên đường và bảng đối chiếu sau khi DXF thay đổi. Phép căn chỉnh này chỉ đồng bộ hai bản vẽ cục bộ, không tạo tọa độ GPS.

Tệp `SO DO AP TC2 chinh lai.dsf` là OLE Compound Document, gồm luồng `DesignerDoc` độc quyền. Nó không phải GeoJSON, không thể dùng trực tiếp như tọa độ WGS84. Bản `.blend` là cảnh 3D nén, không được đóng gói vào ứng dụng; chỉ bản xuất hình học gọn được dùng. Không nên suy ra tọa độ thực từ hai tệp này khi chưa đối chiếu địa bàn.

## Chuẩn bị dữ liệu

1. Mở `.dsf` trong iGrafx Designer và xuất hình học vector qua **Export → AutoCAD DXF**. Phiên bản Designer đã kiểm tra không có lựa chọn xuất SVG.
2. Gắn tọa độ bản vẽ bằng các mốc thực địa phân bố quanh ấp trong QGIS; kiểm tra sai số và vị trí ranh sau chuyển đổi.
3. Xuất `FeatureCollection` GeoJSON theo WGS84, tọa độ `[kinh độ, vĩ độ]`. Mỗi nhà là `Polygon`/`MultiPolygon` với `properties.kind = "building"`; mỗi đường là `LineString`/`MultiLineString` với `properties.kind = "road"`. Thuộc tính `height` tính bằng mét và chỉ điền nếu có số đo hoặc quy ước chiều cao được phê duyệt. `householdId` phải khớp ID hồ sơ thực tế.
4. Dùng nút **Nạp GeoJSON địa bàn** để xem thử. Tệp chỉ nằm trong bộ nhớ khi màn MapLibre đang mở, không gửi lên máy chủ; rời màn cần nạp lại.

Ví dụ **minh họa cấu trúc, không phải tọa độ thực của ấp TC2**:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "kind": "building", "householdId": "id-ho-dan", "height": 6 },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [106.612, 10.854],
            [106.6121, 10.854],
            [106.6121, 10.8541],
            [106.612, 10.8541],
            [106.612, 10.854]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": { "kind": "road" },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [106.6119, 10.8539],
          [106.6122, 10.8542]
        ]
      }
    }
  ]
}
```

Không đưa tên, số điện thoại, giấy tờ hoặc dữ liệu cư trú vào GeoJSON. Bản đồ chỉ giữ hình học, ID liên kết và trạng thái điểm; thông tin hộ dân tiếp tục đi qua luồng ứng dụng đã xác thực.

Sơ đồ TC2 hiển thị nhãn Quốc lộ 22, Đường song hành, Trưng Vương 3 từ các vị trí chữ lặp lại trong DXF; nhãn Hẻm 17, Hẻm 136, Hẻm 170, Chợ đầu mối và Khu biệt thự lấy từ Blender. Các nhãn dùng tọa độ cục bộ của sơ đồ, không phải vị trí GPS đã kiểm chứng. Nút +/- và cuộn/chụm để zoom; nút xoay, hướng Bắc và thanh góc nghiêng điều khiển góc nhìn 3D. Nền sơ đồ dùng màu và nét vẽ nội bộ, không gọi Google Maps hoặc dịch vụ trả phí. Chế độ tọa độ vẫn dùng raster OpenStreetMap và cần GeoJSON WGS84 để hiện nhà/đường đúng vị trí địa lý.

Hiện đây là màn thử nghiệm. Các thao tác sửa tọa độ, bộ lọc nâng cao và trích xuất ảnh vẫn ở bản đồ Leaflet cũ. Chỉ thay hẳn Leaflet sau khi có GeoJSON đã kiểm tra thực địa và đối chiếu đủ tính năng.
