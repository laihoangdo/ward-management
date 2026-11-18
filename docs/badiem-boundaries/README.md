# Ranh giới tạm 51 ấp Bà Điểm

Phiên bản `pdf-20261018-v1`, dựng theo PDF bản đồ sáp nhập do người dùng cung cấp và ranh giới xã `xa_ba_diem.geojson`. Được dùng cho phân quyền theo yêu cầu trong khi chờ tọa độ chuẩn. Không coi đây là dữ liệu đo đạc pháp lý.

## Phương pháp và kiểm tra

- Lấy đường biên vector màu tím/cam trong PDF, polygonize được 49 vùng. Hai đường bị hở ở Hậu Lân/Hậu Lân 1 và Tiền Lân 1/Tiền Lân 2 được khôi phục bằng mép vùng màu vector của chính PDF. Không chia ấp theo vị trí hộ dân hoặc khoảng cách đến tâm ấp.
- Ghép đủ 51 nhãn với danh mục 51 mã ấp hiện có. Kiểm tra mỗi nhãn thuộc đúng một vùng riêng biệt.
- Gắn tọa độ bằng phép affine, 7 góc đặc trưng đối chiếu với ranh giới xã, hệ tính toán UTM 48N (EPSG:32648); xuất GeoJSON WGS84, thứ tự kinh độ/vĩ độ.
- RMS khớp 7 điểm: **6,37 m**, lớn nhất **10,10 m**. Đối chiếu toàn bộ đường bao ngoài trước khi cắt: trung vị **4,65 m**, P95 **15,38 m**, lớn nhất **136,73 m** tại chi tiết đường bao khác nhau. Các số này đo độ khớp giữa hai nguồn, **không chứng minh độ chính xác thực địa của ranh giới bên trong**.
- Cắt theo ranh giới xã người dùng cung cấp. Phần viền còn thiếu khoảng 101.558 m² (0,37% diện tích xã) được gán về mép polygon gần nhất, lấy mẫu mép 10 m. Chỉ xử lý viền/hở nhỏ; không dùng cách này để tạo ranh giới ấp nội bộ.
- Tổng diện tích theo phép chiếu khoảng 27,401 km². Sai số hở/chồng tính toán dưới 1 m². Một số đoạn giáp ranh cần đối chiếu thực địa, nhất là nơi hai nguồn khác nhau rõ.
- Đã đối chiếu thêm nhãn đường Phan Văn Hớn, Nguyễn Ảnh Thủ với dữ liệu đường trong project. Nhãn có độ lệch với tim đường và dữ liệu đường không phủ hết đoạn phía tây; không dùng các nhãn này làm điểm khống chế. Kết quả thô trong `road-label-checks.json` là khoảng cách **vị trí chữ đến đoạn đường có sẵn**, không phải sai số ranh giới.

`validation.json` lưu số liệu, điểm khống chế và SHA-256 đầu vào. `preview.png` ghi ID tương ứng danh mục ấp. Script chặn nếu đầu vào thay đổi, tránh tái sử dụng sai điểm khống chế.

## Dữ liệu và triển khai

- GeoJSON phiên bản: `src/main/resources/config/liquibase/data/badiem-hamlet-boundaries-20261018.geojson`.
- Bản để mở trong công cụ GIS: `src/main/webapp/content/data/badiem-hamlet-boundaries.geojson`.
- Migration `20261018010000_hamlet_pdf_boundaries.xml` cập nhật `hamlet.boundary_geo_json` theo **code**, không phụ thuộc ID database.
- Bảng `hamlet_boundary_revision` giữ cả giá trị trước và sau cập nhật của 51 ấp; dữ liệu cũ có 6 ranh giới được giữ nguyên trong bản sao. Migration chạy trong transaction, từ chối nhập nếu không khớp đủ 51 mã.
- Migration chạy một lần; SQL cũng có thể chạy lại mà không ghi đè ranh giới đã được sửa sau đó. Rollback chỉ khôi phục những ranh giới vẫn giữ nguyên giá trị do migration này ghi.
- Mọi feature có `properties.provisional=true`, `boundaryVersion`, nguồn và SHA-256 PDF.

Backend đang phát triển có tự khởi động lại khi tài nguyên thay đổi, nên database local đã áp dụng migration. Với môi trường khác, triển khai bản build này và khởi động backend để Liquibase áp dụng. Tải lại trang để lấy phạm vi mới.

## Phân quyền

RbacService lấy polygon từ database của các ấp được giao, dùng cho kiểm tra tọa độ hộ và toàn bộ footprint công trình. Khối nhà vượt đường biên bị chặn, trừ khi toàn bộ footprint được phủ bởi hợp của các ấp cùng được giao. Quyền hộ dân theo mã/ID ấp và các quyền chức năng vẫn áp dụng đồng thời. Không tự đổi `household.hamlet_id`, tọa độ hộ hoặc phân công cán bộ theo polygon tạm.

API `/api/gis/field-buildings/boundaries` trả đường biên toàn xã và các thuộc tính công khai theo danh sách cho phép, không trả thuộc tính tùy ý hoặc thông tin hộ. Bản đồ lấy ranh giới từ **database**, không dùng bản GeoJSON tĩnh để quyết định quyền. Nét vàng là các ấp; nét xanh là phạm vi được giao. Hình khối toàn xã vẫn hiển thị, hồ sơ và thao tác ngoài phạm vi bị chặn ở backend.

## Khi có tọa độ chuẩn

Super-admin cập nhật trường `boundaryGeoJson` qua chức năng/API ấp hiện có (`/api/hamlets`), theo đúng mã ấp; dùng Polygon/MultiPolygon hoặc Feature. Nếu dùng Feature, đặt `provisional=false`, `boundaryVersion` mới và ghi nguồn chính thức. Không đổi mã/ID ấp để giữ nguyên phân công và liên kết hộ dân. Kiểm tra vùng hở/chồng trước khi thay đồng bộ các ấp giáp nhau. Không sửa migration đã chạy; phát hành changeset mới khi cần phân phối dữ liệu chuẩn cho nhiều môi trường.

Ranh giới mới có hiệu lực ở backend từ request tiếp theo; tải lại trang để cập nhật đường biên và phạm vi phía trình duyệt.

## Tái tạo

Chạy từ thư mục project:

```powershell
uv run --with pymupdf --with shapely --with numpy --with pyproj --with matplotlib python scripts/derive-badiem-hamlet-boundaries.py
```

Chỉ dùng để tái tạo đúng phiên bản nguồn này; cần xem lại điểm khống chế và tạo phiên bản/migration mới khi thay nguồn.
