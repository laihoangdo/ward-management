# Phân tích database trước release — 03/11/2026

## Phạm vi và kết luận

Đợt kiểm tra này chỉ đọc DB và source, không drop schema/database, chạy migration, nhập lại dữ liệu hay chuyển kết nối. Chưa rehearsal migration từ DB rỗng trong đợt này; chưa thể chứng nhận cài mới tương đương hệ thống hiện hành.

- Các mục trong ảnh là **database** của cluster cũ 5432, không phải schema DB đang vận hành.
- Backend hiện có 10 kết nối JDBC `police_runtime` tới `Monolithic` trên `police-postgis-1:5433`. Cluster 5432 chỉ quan sát thấy Navicat kết nối `Monolithic`; DB đó được đặt read-only.
- Khởi tạo cấu trúc không khôi phục dữ liệu nghiệp vụ hiện tại. Muốn giữ nguyên dữ liệu phải logical backup/restore, giữ đúng khóa mã hóa và phục hồi các cấu hình ngoài DB.
- Nên gom quy trình qua một entry point, không nối/rewrite các migration đã áp dụng.

## Phân loại để dọn

| Nhóm | Quan sát | Khuyến nghị |
| --- | --- | --- |
| `Monolithic` trên 5433 | DB vận hành, khoảng 88 MB | Giữ |
| `Monolithic` trên 5432 | Snapshot trước cutover, khoảng 87 MB, read-only | Giữ đến khi hết thời hạn rollback và đối soát delta |
| `hamlet_direct_audit`, `hamlet_liquibase_audit`, `tc2_import_audit_20261013` trên 5432 | DB audit, khoảng 10–11 MB/DB; không có session lúc kiểm tra | Ứng viên dọn sau kiểm tra tham chiếu, backup và xác nhận |
| `tc2_restore_20261020_final`, `tc2_restore_20261020_verified`, `tc2_restore_documents_20261028`, `tc2_restore_hardening_20261028`, `tc2_restore_unified_final_20261027`, `tc2_restore_unify_20261027` trên 5432 | DB restore, khoảng 67–80 MB/DB; không có session lúc kiểm tra | Ứng viên dọn; tên final/verified không tự chứng minh backup đã nghiệm thu |
| `tc2_roster_rehearsal`, `tc2_roster_validation` trên 5432 | Khoảng 74 MB và 18 MB; không có session lúc kiểm tra | Ứng viên dọn sau xác nhận không còn là đích kiểm thử |
| `tc2_restore_postgis_20261029` trên 5433 | Khoảng 87 MB, không có session; tài liệu còn dùng làm đích DB test | Chỉ dọn sau thay thế/cập nhật quy trình test |
| `postgres`, `template0`, `template1`, `template_postgis` | DB hệ thống/template | Không đưa vào danh sách dọn audit |

Không có session tại một thời điểm không có nghĩa là không còn dùng. Không cần drop database để tăng tốc query DB vận hành; lợi ích chính ở đây là giảm dung lượng và nhầm lẫn quản trị. Chưa kiểm tra hết scheduler/công cụ bên ngoài repository.

### Schema trong DB vận hành

| Schema | Kích thước bảng xấp xỉ | Vai trò |
| --- | --- | --- |
| `public` | 14 MB, 33 bảng/3 view | Core nghiệp vụ, RBAC, GIS, tài liệu, ảnh, PostGIS; giữ |
| `tc2_roster` | 63 MB, 13 bảng/2 view | Cư trú, thành viên hộ, nguồn nhập mã hóa, review/lịch sử; giữ |
| `legacy_mock_20261027` | 1168 kB, 3 bảng | Archive phục hồi mock cũ, không phải nguồn runtime |
| `database_repair` | 392 kB, 2 bảng | Snapshot gốc và bằng chứng sửa liên kết công trình |

`tc2_roster.household/resident` là projection UUID của bảng core, không phải bản sao có thể xóa. Đã xác nhận 13 quan hệ FK xuyên schema từ roster tới `public`. Hai schema archive chỉ chiếm khoảng 1,5 MB, runtime không được cấp quyền truy cập; nên giữ cho truy vết thay vì xóa để tối ưu. Migration repair còn tham chiếu archive, nên tuyệt đối không xóa file lịch sử tương ứng.

Bảng lớn nhất là `tc2_roster.import_row` (~27 MB) và `change_event` (~26 MB): dữ liệu nguồn/lịch sử, không tự động coi là rác. `pg_stat_user_tables.n_live_tup` hiện báo 0 cả bảng có dữ liệu; không dùng thống kê đó làm bằng chứng bảng trống. Đếm thực tế: **1.291 hộ, 5.074 nhân khẩu, 5.151 dòng nguồn APPLIED**.

## Init mới có tương đương hiện tại không?

| Thành phần | Chỉ chạy migration trên DB rỗng |
| --- | --- |
| Table/view/index/function/trigger theo master | Có đường định nghĩa; chưa nghiệm thu chạy từ rỗng |
| Hộ/nhân khẩu đang dùng, liên kết và lịch sử nhập/review | Không tự tái tạo từ schema |
| Giấy tờ, ảnh kiểm tra, log, dữ liệu GIS đã sửa/lưu | Cần restore dữ liệu hiện tại |
| Khóa giải mã nguồn/định danh | Cần đúng `.tc2-private/data.key`; key mới không giải mã dữ liệu cũ |
| Role runtime/grants | Phải provision/cấp lại; dump DB không mang role toàn cluster |
| Keycloak identities/roles/client secret và phân quyền hiện hành | Cần giữ/restore Keycloak riêng và cấu hình ứng dụng khớp; SQL không đủ |
| GeoJSON nền, raster/tiles, OCR models và draft trong trình duyệt | Là tài nguyên ngoài DB; phải triển khai/giữ riêng |

**Rủi ro phát hiện:** Maven Liquibase trong `pom.xml` đang đặt `<contexts>!test</contexts>`, chưa loại `faker`. Nhiều changeset `loadData` có context `faker`. Vì vậy lời mô tả CLI “no sample seed” chưa được bảo đảm khi chạy vào DB mới: cần cấu hình release loại cả `test` và `faker`, kiểm thử context và rehearsal trước khi dùng. Đợt phân tích này chưa thay cấu hình đó. Không sửa checksum hoặc xóa CSV migration để xử lý.

PostGIS extension/schema/index phải phù hợp cấu hình `gis.postgis.enabled`; backend runtime kiểm tra và có thể từ chối khởi động nếu thiếu. Không chỉ tạo PostgreSQL trống rồi bật app runtime (profile này tắt Liquibase).

## Gom script hợp lý

Giữ `master.xml` làm thứ tự duy nhất và `npm run db:status` / `npm run db:migrate` làm entry point schema. Sau khi sửa context và rehearsal, cùng chuỗi này mới được nghiệm thu cho cả cài mới và nâng cấp. Không flatten lịch sử đã chạy.

Không ghép các thao tác sau thành SQL init tự chạy: tạo role/mật khẩu, setup Keycloak, import nguồn, rollback, backup/restore hoặc cutover. Chúng có quyền và tác động khác nhau. `setup-database-runtime.ps1`/SQL hiện từ chối role đã tồn tại; khi restore sang DB khác trong cùng cluster cần cấp grants cho role sẵn có, không chạy lại tạo role hay xoay mật khẩu.

`tc2-roster-backup.ps1` sao lưu toàn DB cùng key và checksum, nhưng không phải backup đầy đủ toàn hệ thống. `tc2-roster-restore.ps1` restore vào DB mới với `--no-owner --no-privileges`, không tự đổi target runtime và không tự cài key vào runtime. Cần DBA kiểm tra owner/grants, giữ key khớp, khôi phục Keycloak/config riêng.

## Đường release an toàn đề xuất

1. Giữ DB vận hành hiện tại. Chốt retention, liệt kê DB audit/restore được phép dọn; backup và xác minh restore trước khi xin xác nhận xóa theo tên cụ thể.
2. Khóa context release không chạy faker/test; thêm test cho tham số/context thực tế. Giữ nguyên applied migrations.
3. Rehearsal trên PostGIS cách ly, không đổi manifest/credentials vận hành: một lần từ DB rỗng, một lần restore backup mới nhất. Không tạo thêm DB audit vĩnh viễn.
4. Đối soát số dòng và fingerprint từng bảng, liên kết FK, sequence, view/trigger, extension/index, grants, đọc giải mã và kiểm thử từng vai trò. Row count khớp chưa đủ.
5. Smoke test đăng nhập, danh sách/sửa hộ-nhân khẩu, cư trú/review, bản đồ và quyền địa bàn, giấy tờ/gia hạn, ảnh upload/gallery, dashboard/admin. Kiểm tra cả nghiệp vụ ghi trên bản rehearsal.
6. Chỉ cutover sau nghiệm thu và backup có thể phục hồi; phải kiểm soát thay đổi phát sinh giữa snapshot và cutover.

Đợt này không tuyên bố tất cả tính năng trên DB mới đã pass. Tài liệu triển khai 29/10 có bằng chứng restore trước đây, nhưng không thay thế rehearsal của snapshot mới nhất (đã có migration ảnh bổ sung).

## Thực hiện sau xác nhận

- Đã đổi context Maven thành `!test and !faker`, không sửa applied changelog. Test kiểm tra cấu hình plugin và CLI: **3/3 PASS**.
- Đã chạy `db:migrate` trên container PostGIS 18/3.6 cách ly, loopback `55433`, storage tmpfs, không dùng volume vận hành. **36 changeset chạy thành công, 7 bị lọc theo context**; không có changeset faker được ghi nhận; hộ/nhân khẩu đều 0. Chạy migrate lần hai thành công, không có thay đổi mới.
- Đã logical dump DB vận hành và restore `--no-owner --no-privileges --exit-on-error` vào DB cách ly. Đối soát **48 bảng nghiệp vụ/archive: count và ordered JSONB fingerprint khớp**, trừ cột spatial dẫn xuất theo hợp đồng script. Đây là snapshot kiểm thử, không phải full-system backup có key/Keycloak.
- Integrity regression trên bản restore: **7 kiểm tra PASS**, transaction rollback. Đã sửa fixture SQL cũ thiếu geometry để kiểm tra FK/unique không bị ràng buộc PostGIS chặn trước; không thay constraint nghiệp vụ.
- `db:status` trên DB vận hành vẫn **up to date**; không migrate DB vận hành, không chuyển manifest hoặc credentials.
- Container rehearsal và dump tạm được dọn sau kiểm tra, không giữ thêm DB audit vĩnh viễn.

Giới hạn: chưa provision runtime role/grants trong rehearsal, chưa thử giải mã bằng key và chưa chạy backend/browser cùng Keycloak trên DB mới. Vì vậy mới xác nhận đường init schema, restore nội dung và một nhóm constraint/trigger; chưa chứng nhận toàn bộ chức năng end-to-end. Chưa xóa bất kỳ DB audit/restore có sẵn nào; cần xác nhận danh sách và backup/retention trước thao tác đó.

### Kiểm tra tiếp: runtime, mã hóa, giấy tờ và PostGIS

Đã thực hiện thêm trên bản dump mới trong container tmpfs cách ly tại `127.0.0.1:55433`, DB `tc2_restore_release_20261103`:

- Provision `police_runtime` bằng script hiện có **chỉ trong cluster cách ly**. Chạy `test-database-runtime-role.sql` trong cùng transaction với provisioning: PASS, rollback mọi ghi thử. Xác nhận CRUD/trigger, không có DDL, không truy cập archive, không sửa migration/history. Sau đó provision lại và commit role chỉ ở cluster cách ly để test JDBC bằng đúng runtime user.
- Thêm `ReleaseRestorePostgresTest`: explicit opt-in `RUN_RELEASE_RESTORE_TESTS=true`, bắt buộc tên DB restore, cố định port cách ly 55433. Mỗi kết nối JDBC đặt read-only. Key hiện có phải tồn tại; không tạo key thay thế. Toàn bộ raw/parsed import ciphertext và identity ciphertext được giải mã/authenticate bằng `RosterCrypto`, chỉ kiểm đếm lỗi, không xuất plaintext/key/ciphertext vào log. PASS.
- Runtime SELECT được core/projection/address view, bảng ảnh kiểm tra và GIS; spatial geometry hợp lệ. PASS. Chưa thử upload/download ảnh qua HTTP.
- Cho phép test giấy tờ và PostGIS nhận `DOCUMENT_TEST_PORT` / `POSTGIS_TEST_PORT` (kiểm tra port hợp lệ), giữ default cũ và guard tên DB restore. Không thay runtime application config.
- Chạy thật trên PostgreSQL: **11/11 PASS, 0 skipped**: 3 document lifecycle, 6 PostGIS spatial, 2 runtime/crypto. Document service dùng mock RBAC trong test, không phải kiểm tra đăng nhập Keycloak hoặc full authorization end-to-end.
- Sau các test, đối soát lại **48 bảng khớp fingerprint và count** với DB nguồn. Role/grants khác theo thiết kế restore; test này không so grants/sequence hay cột geometry dẫn xuất.
- Dọn container/volume rehearsal và dump tạm sau kiểm tra; không sao chép key sang container, không đổi key/config/Keycloak/DB vận hành.

Log kiểm tra: `target/release-restored-feature-tests.log`. Còn cảnh báo Maven dependency convergence, Mockito dynamic agent và stale JaCoCo như trước; không coi là toàn repository sạch test.

Ví dụ chạy lại sau khi chuẩn bị bản restore cách ly và role:

```powershell
$env:RUN_RELEASE_RESTORE_TESTS='true'
$env:RELEASE_RESTORE_DATABASE='tc2_restore_release_20261103'
$env:RUN_DOCUMENT_DB_TESTS='true'
$env:DOCUMENT_TEST_DATABASE=$env:RELEASE_RESTORE_DATABASE
$env:DOCUMENT_TEST_PORT='55433'
$env:RUN_POSTGIS_DB_TESTS='true'
$env:POSTGIS_TEST_DATABASE=$env:RELEASE_RESTORE_DATABASE
$env:POSTGIS_TEST_PORT='55433'
.\mvnw.cmd -ntp '-Dskip.installnodenpm' '-Dskip.npm' '-Dmaven.compiler.useIncrementalCompilation=false' '-Dtest=ReleaseRestorePostgresTest,DocumentLifecyclePostgresTest,PostgisSpatialPostgresTest' test
```

Các giới hạn runtime grants/giải mã của đoạn trước đã được kiểm tra bổ sung như trên. **Vẫn chưa nghiệm thu backend/browser với Keycloak trên DB mới**, HTTP ảnh và mọi vai trò/phạm vi địa bàn. Chưa xóa DB cũ; tên DB nào được drop vẫn cần chốt retention/backup và xác nhận riêng.

### Kiểm tra MVC ảnh và security filter

- Thêm `InspectionPhotoRestoreHttpTest`, opt-in cùng `RUN_RELEASE_RESTORE_TESTS`/`RELEASE_RESTORE_DATABASE`, guard DB restore và port cách ly 55433. Dùng controller và ExceptionTranslator hiện hành, JDBC role `police_runtime`, ảnh PNG và cán bộ **synthetic**. RBAC là mock; không chạy full application context hoặc đăng nhập OIDC.
- Upload, list với `Cache-Control: no-store`, kiểm tra bytes lưu trong DB, metadata cán bộ từ server, delete và delete lần hai trả 404: PASS. Xóa cùng ID ảnh qua hộ khác trả 404, ảnh gốc vẫn còn trước bước xóa đúng hộ. Toàn bộ ghi fixture nằm trong transaction rollback.
- GET/POST/DELETE ngoài phạm vi trả 403; thiếu quyền ghi trả 403; image signature sai trả 400: PASS qua production exception advice.
- Mở rộng `GisSecurityTest` dùng production filter chain để kiểm tra endpoint ảnh: anonymous trả 401, session write thiếu CSRF trả 403. Controller trong test filter là probe; không nhầm với test controller ảnh/DB thật ở trên.
- Tổng nhóm chạy: **38/38 PASS, 0 skipped** (10 security filter, 20 RBAC service, 1 PostGIS policy, 4 photo resource, 3 photo MVC/DB). Log `target/release-photo-security-tests.log`.
- Đối soát lại sau test: **48 bảng khớp count/fingerprint**. Container/dump tạm được dọn; DB vận hành, key và Keycloak không đổi.

HTTP ảnh đã có coverage MVC+DB thật và filter security riêng. Chưa có nghiệm thu đăng nhập Keycloak/redirect/session và chuỗi authorization thật xuyên browser → filter → RBAC → DB theo từng vai trò. Cần môi trường staging cách ly và danh tính test từng vai trò để đóng gate này; không sử dụng tài khoản/ảnh/hộ thật làm fixture và không tự thay cấu hình Keycloak đang dùng.

### Gate cuối: Keycloak thật và Chrome (03/11)

Đã dựng staging **chỉ synthetic**, không clone Keycloak/hồ sơ thật: Keycloak 26.7.4 tại loopback 59080, realm `release-gate`; PostgreSQL 18/PostGIS 3.6 tại 55433, DB `release_gate`; executable backend JAR tại 58080, role `police_runtime`, Liquibase runtime tắt. DB được init từ master với context release, thêm 2 hộ synthetic tại 2 địa bàn và 4 danh tính/assignment synthetic. Key mã hóa riêng ở `target/release-gate/data.key`; không đọc/đổi key vận hành trong gate này.

**Phát hiện và sửa hai blocker lúc khởi động JAR:**

1. `WebConfigurer` xử lý URL tài nguyên trong executable JAR như filesystem, gây InvalidPathException (`nested:...`) trên Windows. Chỉ thiết lập IDE document root khi resource protocol là `file`; tài nguyên đóng gói để Spring Boot phục vụ. Không đổi đường dẫn API hay quyền.
2. `RosterCrypto` hỗ trợ `application.roster.key-file` qua `@Value`, nhưng `ApplicationProperties` strict binding chưa khai báo nhánh đó, khiến startup từ chối key path riêng. Bổ sung typed `Roster.keyFile`, giữ default cũ và `ignoreUnknownFields=false`.

**Kết quả:**

- `scripts/release-oidc-gate.mjs`: PASS cho **superadmin/admin/sub-admin/officer** bằng authorization-code login, cookie session, gọi `/api/rbac/me` qua `KeycloakAdminClient` thật. Không dùng password grant/access token giả hoặc mock RBAC.
- Cả 4 đọc được ảnh hộ trong địa bàn; chỉ superadmin đọc được hộ ngoài địa bàn. Admin/sub-admin có permission fixture được upload/list/delete PNG; officer không có quyền ghi bị 403. Truy cập ảnh qua hộ khác bị 403/404 theo vai trò, CSRF thiếu bị 403, anonymous bị 401. Session ứng dụng sau `/api/logout` bị vô hiệu hóa. Chưa kiểm tra global SSO logout/end-session tại Keycloak.
- `scripts/release-oidc-browser-gate.mjs`: PASS cả 4 vai trò trên Chrome headless thật, context mới riêng từng vai trò, điền form Keycloak, callback về app, kiểm tra role thực và đọc ảnh trong/ngoài địa bàn bằng fetch trong browser session. Không dùng profile trình duyệt người dùng, không đọc dữ liệu thật.
- Backend JAR đóng gói đã khởi động thành công với PostGIS và runtime role trên Windows. **37/37 test hồi quy PASS**, gồm 3 regression mới cho packaged resources/key binding và security/RBAC/photo tests hiện có. Packaging thành công; scripts mới ESLint PASS.

Gate này đóng phần **đăng nhập OIDC thật + session + RBAC/địa bàn + API ảnh** trên staging synthetic. Không đồng nghĩa đã nghiệm thu mọi màn hình/tác vụ GIS, camera phần cứng, global SSO logout, TLS/reverse proxy hoặc thông lượng production. Schema init + restore 48 bảng + giải mã đã được kiểm tra riêng ở các bước trên; đây không phải một rehearsal cutover production toàn bộ hệ thống.

Hai script gate cố định endpoint loopback cách ly và tài khoản thử; **không sửa để trỏ vào DB/Keycloak vận hành**. Phải dựng fixture tương ứng trước khi chạy:

```powershell
node scripts/release-oidc-gate.mjs
node scripts/release-oidc-browser-gate.mjs
```

Không thay manifest/credentials vận hành, không cấp role hoặc tạo người dùng trong Keycloak 9080, không drop DB audit/restore cũ. Dừng backend staging, dọn hai container/volume gate sau kiểm tra để không để lại endpoint trust/dev đang mở.
