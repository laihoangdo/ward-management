# Triển khai PostGIS local — 29/10/2026

**Cập nhật sau cleanup:** backup mới nhất đã kiểm chứng là `backups/tc2-roster-20261029-003523/`. Các DB restore lỗi/trùng và một số backup trung gian đã được dọn; xem [checkpoint còn giữ và biên bản dọn dẹp](cleanup-20261029.md). Các tên DB restore trong phần bằng chứng bên dưới là lịch sử kiểm tra, không phải tất cả còn tồn tại.

## Kết quả và cấu hình đang dùng

- PostgreSQL **18.6**, PostGIS **3.6.4**, image `postgis/postgis:18-3.6` được pin theo digest trong `src/main/docker/postgis.yml`.
- Container **`police-postgis-1`**, cổng **`127.0.0.1:5433`**, database `Monolithic`, named volume **`police_postgis18_data`** tại `/var/lib/postgresql` (PGDATA `/var/lib/postgresql/18/docker`).
- BE dùng `police_runtime`, Liquibase và Docker service connections bị tắt ở runtime. URL và `gis.postgis.enabled=true` nằm trong `.rbac/database-runtime.properties`, không commit credentials.
- `.rbac/active-database.json` chỉ định container/port hiện hành cho backup, restore, import và cleanup fixture. Thiếu metadata khi runtime trỏ 5433 thì script dừng, không âm thầm quay về DB cũ.
- Cluster cũ **`monolithic-postgresql-1` trên 5432 và volume gốc được giữ nguyên**. Riêng database `Monolithic` đã đặt `default_transaction_read_only=on` để ngăn ghi nhầm; các DB audit/rehearsal cũ khác vẫn ở cluster đó.

Không gắn volume cũ vào image mới, không `down -v`, không renew anonymous volume. Đây là **logical dump/restore sang volume mới**, không nâng cấp vật lý tại chỗ.

## Các lớp dữ liệu không gian

| Nguồn                                      | Cột geometry dẫn xuất | SRID / index                | Kết quả snapshot triển khai |
| ------------------------------------------ | --------------------- | --------------------------- | --------------------------- |
| `household.longitude/latitude`             | `location_geom`       | Point 4326 / GiST           | 1.291 điểm                  |
| `hamlet.boundary_geo_json`                 | `boundary_geom`       | MultiPolygon 4326 / GiST    | 51 ranh hợp lệ              |
| `gis_field_building.feature_json.geometry` | `footprint_geom`      | MultiPolygon 4326 / GiST    | 390 footprint hợp lệ        |
| `gis_building.footprint_geojson`           | `footprint_geom`      | MultiPolygon 4326 / GiST    | Chưa có bản ghi             |
| `gis_road.geometry_geojson`                | `line_geom`           | MultiLineString 4326 / GiST | Chưa có bản ghi             |

Point được sinh tự động theo foundation cũ. Ranh ấp và công trình thực địa dùng generated columns; hai bảng GIS cũ dùng trigger đồng bộ. Nguồn JSON và hồ sơ nghiệp vụ vẫn là nguồn gốc, không ghi đè theo geometry. `[longitude,latitude]` là thứ tự WGS84 trong GeoJSON; không đổi thứ tự tọa độ UI.

**1.291 tọa độ vẫn là `RANDOM_WITHIN_TC2`, không phải vị trí đã xác minh.** Ranh ấp vẫn là nguồn tạm đã có; cài PostGIS không biến PDF thành ranh pháp lý hay footprint thành khảo sát thực địa. Không chạy `ST_MakeValid`, không nắn ranh hoặc tự thay tọa độ để làm dữ liệu qua kiểm tra. Polygon sai bị từ chối, không âm thầm sửa.

## Migrations và API

- Hai foundation `20261008210000-1/-2` trước đây bị skip vì thiếu extension, nay được Liquibase thực thi đúng checksum gốc.
- `20261029000000-1`: parser polygon WGS84, generated geometry, GiST và đồng bộ bảng GIS cũ.
- `20261029010000-1`: cố định `search_path=pg_catalog,public` cho hàm geometry, bảo đảm generated expressions hoạt động khi `pg_restore` COPY với search path rỗng. Không sửa lại changeset đã áp dụng.
- `PostgisConfiguration` từ chối khởi động khi bật PostGIS nhưng thiếu extension/schema/index hoặc cấu hình hàm an toàn cho restore.
- `PostgisSpatialService` kiểm tra **toàn bộ footprint** bằng `ST_Covers` trên hợp các ranh được giao, không chỉ tâm/đỉnh. Hợp vùng được cache theo request, không dùng cache quyền xuyên tài khoản.
- Trong giai đoạn chuyển đổi, **PostGIS và chính sách Java hiện hành đều phải cho phép**. Thiếu ranh hoặc engine từ chối thì không cấp quyền; không tự fallback sang Java khi truy vấn PostGIS lỗi. Quyền hồ sơ hộ/tuyến vẫn là kiểm tra riêng, không bị quyền geometry thay thế.
- API mới: `GET /api/gis/spatial/buildings?west=106&south=10&east=107&north=11`, dùng `ST_Intersects` và index; yêu cầu đăng nhập + `canViewField3DMap`, tái sử dụng cùng cơ chế che thuộc tính/ID hộ ngoài phạm vi như API cũ. Không trả hơn 1.000 công trình; khung quá rộng phải thu hẹp, không cắt dữ liệu âm thầm.

Frontend hiện tại vẫn hoạt động qua API cũ và nguồn footprint nền tĩnh; **chưa đổi toàn bộ MapLibre sang tải theo viewport**, chưa nạp toàn bộ GeoJSON nền/DXF vào database. API viewport mới dành cho bước tối ưu tiếp theo. Không coi đây là mô hình mesh 3D địa chính hoặc multi-instance/offline hoàn chỉnh.

## Chạy và sao lưu

Tại root repository:

```powershell
docker compose -f src/main/docker/postgis.yml up -d --wait
# Keycloak hiện tại vẫn dùng dịch vụ riêng ở 9080.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/start-backend-runtime.ps1
```

Cũng có thể dùng `npm run backend:start` / `npm run app:start`: hai lệnh đã chuyển sang wrapper runtime đa nền tảng, không khởi động backend mặc định bằng tài khoản admin của cluster cũ. Thiếu file credentials sẽ dừng thay vì fallback.

Không dùng `services.yml`/`npm run services:up` để vận hành cluster mới: cấu hình legacy đó vẫn chỉ tới service cũ. Không tạo lại service cũ để “đồng bộ image”.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/tc2-roster-backup.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/tc2-roster-restore.ps1 -BackupDirectory <backup> -TargetDatabase tc2_restore_<ten_moi>
```

Hai script tự chọn container hiện hành qua metadata. Có thể dùng `-Container` rõ ràng khi kiểm tra cluster cũ. Restore luôn vào DB mới, không overwrite; cần image có PostGIS tương thích và đúng `data.key`. Dump không bao gồm role toàn cluster; restore `--no-privileges` cần DBA cấp lại quyền khi dùng DB phục hồi làm DB vận hành. Runtime không được sửa `spatial_ref_sys`, schema, migration hoặc xóa/sửa lịch sử. Cấu hình local vẫn là **trust auth, loopback-only**, không phải cấu hình production; production phải có SCRAM/TLS/network policy/backup key tách biệt.

## Bằng chứng đối soát và restore

- Backup cuối trước cutover, sau dừng BE: `backups/tc2-roster-20261029-000300/`.
- Rehearsal trên cluster mới: `tc2_restore_postgis_20261029`.
- Fingerprint JSONB có thứ tự và số dòng của **47 bảng nghiệp vụ/lưu trữ** giữa cluster cũ và mới đều khớp; chỉ loại các cột geometry dẫn xuất mới và metadata Liquibase/PostGIS khỏi phép so.
- Giữ nguyên 1.291 hộ/nhóm, 5.074 cá nhân, 10.835 dòng nguồn và 36.503 event cư trú; không sinh lại baseline khi chuyển DB.
- Backup **đã restore thành công sau sửa search path**: `backups/tc2-roster-20261029-001306/`.
- DB phục hồi đã kiểm tra: `tc2_restore_postgis_verified2_20261029` trên `police-postgis-1`; đủ extension, 51 ranh, 390 footprint, 1.291 point; 47 bảng khớp DB vận hành.
- Backup thử trước fix `...001013/` đã phát hiện lỗi restore generated function; **không coi bản này là backup đã nghiệm thu**. DB restore thất bại `tc2_restore_postgis_verified_20261029` được giữ nguyên để điều tra, không dùng làm DB vận hành.
- Nhóm test mới + hồi quy: **55/55 đạt**, gồm 6 test PostgreSQL/PostGIS thật trên rehearsal, test lỗ polygon/hợp vùng, parser sai không tự sửa, generated geometry, index, empty search path, dual-engine và mask/quyền API. Log `target/postgis-tests.log`.
- Chưa nghiệm thu browser có đăng nhập cho toàn bộ vai trò, chưa đo tải mobile hay chuyển toàn bộ layer sang viewport. Lỗi `LoggingAspectTest` ở đợt chạy toàn suite trước vẫn ngoài phạm vi này; không tuyên bố toàn repository đã sạch test.

Chạy lại nhóm DB test chỉ vào restore:

```powershell
$env:RUN_POSTGIS_DB_TESTS='true'
$env:POSTGIS_TEST_DATABASE='tc2_restore_postgis_20261029'
.\mvnw.cmd '-Dskip.installnodenpm' '-Dskip.npm' '-Dmaven.compiler.useIncrementalCompilation=false' '-Dtest=PostgisConfigurationTest,PostgisSpatialServiceTest,PostgisSpatialPostgresTest,PostgisPolicyTest,PostgisResourceTest,GisFieldBuildingResourceTest,TerritoryGeometryTest,RbacServiceTest,RuntimeDatabaseConfigurationTest' test
```

## Phục hồi / quay lại

`scripts/restore-postgis.ps1` dùng cho restore sang DB đích chưa tồn tại; `scripts/activate-postgis.ps1` là thao tác cutover một lần, cố ý từ chối ghi đè config/manifest đã có. Không chạy lại activation khi chỉ cần khởi động ứng dụng.

Để quay về cluster cũ, **phải dừng BE và đối soát mọi thay đổi phát sinh sau cutover**. DB cũ là snapshot tại thời điểm chuyển; không chỉ đổi URL rồi bỏ dữ liệu mới. Ưu tiên restore backup PostGIS mới nhất vào DB mới, kiểm tra/replay delta và cấp lại quyền trước khi đổi cấu hình.

Nếu đã xác nhận không có delta hoặc đã replay đầy đủ: DBA kết nối database `postgres` trên container cũ để `ALTER DATABASE "Monolithic" RESET default_transaction_read_only`; phục hồi `.rbac/database-runtime-before-postgis.properties` (ACL chỉ tài khoản Windows hiện tại), cập nhật metadata về container/port cũ và tắt `gis.postgis.enabled` trước khởi động lại. Không ghi đè volume hoặc xóa cluster mới để rollback. Giữ cả hai cho đến khi nghiệm thu.
