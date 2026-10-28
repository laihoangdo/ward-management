package com.policemanagement.com.service.roster;

import com.policemanagement.com.service.rbac.RbacService;
import com.policemanagement.com.service.rbac.TerritoryGeometry;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

@Service
@Transactional
public class RosterService {

    public record Upload(String name, String legacy, byte[] bytes) {}

    private final JdbcTemplate db;
    private final ObjectMapper json;
    private final RosterCrypto crypto;
    private final RbacService rbac;

    private record BoundaryCache(String raw, java.awt.geom.Area area) {}

    private volatile BoundaryCache boundaryCache;

    public RosterService(JdbcTemplate db, ObjectMapper json, RosterCrypto crypto, RbacService rbac) {
        this.db = db;
        this.json = json;
        this.crypto = crypto;
        this.rbac = rbac;
    }

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private String encode(Object value) {
        return json.writeValueAsString(value);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> decode(String value) {
        return json.readValue(value, Map.class);
    }

    private String s(Map<String, ?> data, String key) {
        return Objects.toString(data.get(key), "").strip();
    }

    private Object nullable(Map<String, ?> data, String key) {
        String value = s(data, key);
        return value.isBlank() ? null : value;
    }

    public long hamlet() {
        return db.queryForObject("select id from public.hamlet where code='27592-TRUNGCHANH-2'", Long.class);
    }

    public void authorize(String permission) {
        db.execute("set local time zone 'Asia/Ho_Chi_Minh'");
        rbac.current();
        rbac.area(hamlet());
        if (permission != null) rbac.permission(permission);
        if (
            !rbac.global() && !((List<?>) rbac.current().getOrDefault("assignedStreets", List.of())).isEmpty()
        ) throw new AccessDeniedException("Bộ hồ sơ TC2 chưa có tuyến đường được xác minh; cần cán bộ được giao toàn ấp");
    }

    private void context(String actor, String kind, String reason, String effective, UUID collection) {
        db.execute("set local time zone 'Asia/Ho_Chi_Minh'");
        db.queryForObject("select set_config('tc2.actor',?,true)", String.class, actor);
        db.queryForObject("select set_config('tc2.change_kind',?,true)", String.class, kind);
        db.queryForObject("select set_config('tc2.reason',?,true)", String.class, reason);
        db.queryForObject("select set_config('tc2.effective_date',?,true)", String.class, effective == null ? "" : effective);
        db.queryForObject("select set_config('tc2.collection_id',?,true)", String.class, collection == null ? "" : collection.toString());
    }

    private void lock() {
        db.queryForObject("select pg_advisory_xact_lock(27592,28)", Object.class);
    }

    private Map<String, Object> get(String table, UUID id) {
        if (!Set.of("household", "resident", "residence_record", "household_membership").contains(table)) throw bad("Invalid entity");
        var rows = db.queryForList("select * from tc2_roster." + table + " where id=? and hamlet_id=?", id, hamlet());
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy hồ sơ");
        return rows.getFirst();
    }

    private void required(Map<String, ?> data, String key) {
        if (s(data, key).isEmpty() || s(data, key).length() > 2000) throw bad("Thiếu hoặc quá dài: " + key);
    }

    public Map<String, Object> stage(List<Upload> files, String label, String sourceDate) {
        authorize("canAddHouseholds");
        return stageAuthorized(files, label, sourceDate, rbac.subject());
    }

    /** Also used by the explicitly enabled local bootstrap, not exposed as an unauthenticated endpoint. */
    public Map<String, Object> stageAuthorized(List<Upload> files, String label, String sourceDate, String actor) {
        if (files.isEmpty() || files.size() > 8 || label.isBlank() || label.length() > 200) throw bad("Chọn 1–8 file và tên đợt nhập");
        if (sourceDate != null && !sourceDate.isBlank()) LocalDate.parse(sourceDate);
        lock();
        var parsed = files
            .stream()
            .map(f -> RosterWorkbook.parse(f.bytes(), f.legacy()))
            .toList();
        var fingerprint = parsed.stream().map(RosterWorkbook.Parsed::hash).sorted().toList();
        if (new HashSet<>(fingerprint).size() != fingerprint.size()) throw bad("File bị chọn lặp");
        // Retry returns the same collection even after application, rather than creating duplicate source rows.
        for (var old : db.queryForList(
            "select id from tc2_roster.import_collection where hamlet_id=? and mapping_version='tc2-v1'",
            hamlet()
        )) {
            UUID oid = (UUID) old.get("id");
            var hashes = db.queryForList(
                "select file_sha256::text from tc2_roster.import_batch where collection_id=? order by file_sha256",
                String.class,
                oid
            );
            if (hashes.equals(fingerprint)) return collectionInternal(oid);
        }
        UUID collection = UUID.randomUUID();
        db.update(
            "insert into tc2_roster.import_collection(id,hamlet_id,label,mapping_version,source_date,created_by) values (?,?,?,'tc2-v1',?::date,?)",
            collection,
            hamlet(),
            label,
            sourceDate == null || sourceDate.isBlank() ? null : sourceDate,
            actor
        );
        for (int index = 0; index < files.size(); index++) {
            Upload upload = files.get(index);
            UUID batch = UUID.randomUUID();
            db.update(
                "insert into tc2_roster.import_batch(id,collection_id,file_name,file_sha256,legacy_hamlet,source_extent) values (?,?,?,?,?,?)",
                batch,
                collection,
                upload.name(),
                parsed.get(index).hash(),
                upload.legacy(),
                upload.legacy().equals("62") ? "FULL" : "PARTIAL"
            );
            for (var row : parsed.get(index).rows()) {
                boolean business = Set.of("PERMANENT", "TEMPORARY", "NOHT", "ARTICLE19").contains(row.kind());
                String id = s(row.data(), "identity");
                db.update(
                    "insert into tc2_roster.import_row(id,batch_id,sheet,row_number,raw_ciphertext,parsed_ciphertext,row_kind,status,errors,identity_lookup) values (?,?,?,?,?,?,?,?,?::jsonb,?)",
                    UUID.randomUUID(),
                    batch,
                    row.sheet(),
                    row.number(),
                    crypto.encrypt(encode(row.raw())),
                    crypto.encrypt(encode(row.data())),
                    row.kind(),
                    !business ? "EXCLUDED" : row.errors().isEmpty() ? "READY" : "REVIEW",
                    encode(row.errors()),
                    id.isEmpty() ? null : crypto.lookup(id)
                );
            }
        }
        // Resolve across all uploaded files. Inconsistent demographics block automatic merging of the entire group.
        var groups = new HashMap<String, List<Map<String, Object>>>();
        for (var row : db.queryForList(
            "select r.* from tc2_roster.import_row r join tc2_roster.import_batch b on b.id=r.batch_id where b.collection_id=? and r.status<>'EXCLUDED'",
            collection
        )) {
            if (row.get("identity_lookup") != null) groups
                .computeIfAbsent(row.get("identity_lookup").toString(), k -> new ArrayList<>())
                .add(row);
        }
        for (var group : groups.values()) {
            var signatures = new HashSet<String>();
            for (var row : group) {
                var d = decode(crypto.decrypt(row.get("parsed_ciphertext").toString()));
                signatures.add(signature(d));
            }
            if (signatures.size() > 1) for (var row : group)
                db.update(
                    "update tc2_roster.import_row set status='REVIEW',errors=errors || '[\"IDENTITY_DEMOGRAPHIC_CONFLICT\"]'::jsonb where id=?",
                    row.get("id")
                );
        }
        return collectionInternal(collection);
    }

    private String signature(Map<String, ?> d) {
        return RosterWorkbook.norm(s(d, "fullName")) + "|" + s(d, "birthDate") + "|" + s(d, "birthYear") + "|" + s(d, "gender");
    }

    private Map<String, Object> collectionInternal(UUID id) {
        var c = db.queryForMap("select * from tc2_roster.import_collection where id=? and hamlet_id=?", id, hamlet());
        c.put(
            "batches",
            db.queryForList(
                "select b.*, (select count(*) from tc2_roster.import_row r where r.batch_id=b.id and r.status<>'EXCLUDED') business_rows from tc2_roster.import_batch b where collection_id=? order by legacy_hamlet",
                id
            )
        );
        c.put(
            "counts",
            db.queryForList(
                "select r.status,r.row_kind,count(*) amount from tc2_roster.import_row r join tc2_roster.import_batch b on b.id=r.batch_id where b.collection_id=? group by r.status,r.row_kind order by 1,2",
                id
            )
        );
        return c;
    }

    public List<Map<String, Object>> collections() {
        authorize(null);
        return db.queryForList("select * from tc2_roster.import_collection where hamlet_id=? order by created_at desc", hamlet());
    }

    public Map<String, Object> collection(UUID id) {
        authorize(null);
        return collectionInternal(id);
    }

    public List<Map<String, Object>> rows(UUID collection, String status, int page) {
        authorize(null);
        collectionInternal(collection);
        if (page < 0 || !Set.of("REVIEW", "READY", "APPLIED", "EXCLUDED").contains(status)) throw bad("Invalid page/status");
        var rows = db.queryForList(
            "select r.id,r.sheet,r.row_number,r.row_kind,r.status,r.errors::text,r.resident_id,r.household_id,r.record_id,b.legacy_hamlet,b.file_name,coalesce(r.resolution_ciphertext,r.parsed_ciphertext) parsed_ciphertext from tc2_roster.import_row r join tc2_roster.import_batch b on b.id=r.batch_id where b.collection_id=? and r.status=? order by b.legacy_hamlet,r.sheet,r.row_number limit 50 offset ?",
            collection,
            status,
            (long) page * 50
        );
        for (var row : rows) {
            var data = decode(crypto.decrypt(row.remove("parsed_ciphertext").toString()));
            data.remove("identity");
            row.put("data", data);
        }
        return rows;
    }

    public Map<String, Object> source(UUID id) {
        authorize(null);
        var row = db.queryForMap(
            "select r.*,b.file_name,b.legacy_hamlet,c.hamlet_id from tc2_roster.import_row r join tc2_roster.import_batch b on b.id=r.batch_id join tc2_roster.import_collection c on c.id=b.collection_id where r.id=? and c.hamlet_id=?",
            id,
            hamlet()
        );
        rbac.permission("canUpdateInspection"); // originals contain sensitive identities; never return them in lists
        row.put("raw", decode(crypto.decrypt(row.remove("raw_ciphertext").toString())));
        row.put("parsed", decode(crypto.decrypt(row.remove("parsed_ciphertext").toString())));
        row.remove("resolution_ciphertext");
        row.remove("identity_lookup");
        return row;
    }

    public Map<String, Object> apply(UUID id) {
        authorize("canAddHouseholds");
        return applyAuthorized(id, rbac.subject());
    }

    public Map<String, Object> applyAuthorized(UUID id, String actor) {
        lock();
        var collection = collectionInternal(id);
        context(actor, "BASELINE_IMPORT", "Nhập nguồn Excel; chưa xác minh", null, id);
        for (var row : db.queryForList(
            "select r.* from tc2_roster.import_row r join tc2_roster.import_batch b on b.id=r.batch_id where b.collection_id=? and r.status='READY' order by b.legacy_hamlet,r.sheet,r.row_number for update of r",
            id
        )) {
            UUID source = (UUID) row.get("id");
            var d = decode(crypto.decrypt(Objects.toString(row.get("resolution_ciphertext"), row.get("parsed_ciphertext").toString())));
            String lookup = s(d, "identity").isBlank() ? "" : crypto.lookup(s(d, "identity"));
            var candidates = lookup.isBlank()
                ? List.<Map<String, Object>>of()
                : db.queryForList(
                      "select distinct r.* from tc2_roster.resident r join tc2_roster.resident_identity i on i.resident_id=r.id where i.number_lookup=? and i.active and r.hamlet_id=?",
                      lookup,
                      hamlet()
                  );
            boolean separate = "SEPARATE".equals(row.get("resolution_action"));
            UUID linked = (UUID) row.get("resolution_resident_id");
            if (
                !separate &&
                linked == null &&
                candidates.isEmpty() &&
                !lookup.isBlank() &&
                !db.queryForList("select id from tc2_roster.resident_identity where number_lookup=? and not active", lookup).isEmpty()
            ) {
                db.update(
                    "update tc2_roster.import_row set status='REVIEW',errors=errors || '[\"RETIRED_IDENTITY_REQUIRES_REVIEW\"]'::jsonb where id=?",
                    source
                );
                continue;
            }
            if (
                !separate &&
                linked == null &&
                (candidates.size() > 1 || (candidates.size() == 1 && !signature(d).equals(residentSignature(candidates.getFirst()))))
            ) {
                db.update(
                    "update tc2_roster.import_row set status='REVIEW',errors=errors || '[\"EXISTING_IDENTITY_CONFLICT\"]'::jsonb where id=?",
                    source
                );
                continue;
            }
            UUID resident =
                linked != null
                    ? linked
                    : separate || candidates.isEmpty()
                      ? insertResident(d, "EXCEL", source)
                      : (UUID) candidates.getFirst().get("id");
            UUID household = importHousehold(d);
            UUID record = importRecord(d, resident, household, source);
            if (household != null) membership(household, resident, source, null, false, null);
            db.update(
                "insert into tc2_roster.source_link(source_row_id,resident_id,household_id,record_id) values (?,?,?,?)",
                source,
                resident,
                household,
                record
            );
            db.update(
                "update tc2_roster.import_row set status='APPLIED',resident_id=?,household_id=?,record_id=? where id=?",
                resident,
                household,
                record,
                source
            );
        }
        reconcileSourceHeads();
        db.update("update tc2_roster.import_collection set status='APPLIED',applied_at=coalesce(applied_at,now()) where id=?", id);
        return collectionInternal(id);
    }

    private String residentSignature(Map<String, Object> r) {
        return RosterWorkbook.norm(s(r, "full_name")) + "|" + s(r, "birth_date") + "|" + s(r, "birth_year") + "|" + s(r, "gender");
    }

    private void reconcileSourceHeads() {
        var names = new HashMap<UUID, Set<String>>();
        for (var row : db.queryForList(
            "select l.household_id,r.parsed_ciphertext from tc2_roster.source_link l join tc2_roster.import_row r on r.id=l.source_row_id join tc2_roster.household h on h.id=l.household_id where h.hamlet_id=? and h.source_case_number is not null",
            hamlet()
        )) {
            var d = decode(crypto.decrypt(row.get("parsed_ciphertext").toString()));
            String name = RosterWorkbook.norm(s(d, "representative"));
            if (!name.isBlank()) names.computeIfAbsent((UUID) row.get("household_id"), k -> new HashSet<>()).add(name);
        }
        for (var entry : names.entrySet())
            if (entry.getValue().size() > 1) db.update(
                "update tc2_roster.household set representative_name=null,verification_status='HEAD_CONFLICT',version=version+1,updated_at=now() where id=? and verification_status='UNVERIFIED' and origin='EXCEL'",
                entry.getKey()
            );
    }

    public void review(UUID source, Map<String, Object> input) {
        authorize("canUpdateInspection");
        required(input, "reason");
        lock();
        var rows = db.queryForList(
            "select r.* from tc2_roster.import_row r join tc2_roster.import_batch b on b.id=r.batch_id join tc2_roster.import_collection c on c.id=b.collection_id where r.id=? and c.hamlet_id=? for update of r",
            source,
            hamlet()
        );
        if (rows.isEmpty()) throw bad("Không tìm thấy dòng nguồn");
        var row = rows.getFirst();
        if (!"REVIEW".equals(row.get("status"))) throw bad("Chỉ xử lý dòng đang chờ đối soát");
        String action = s(input, "action");
        if (!Set.of("CORRECT", "SEPARATE", "LINK").contains(action)) throw bad("Chọn cách xử lý");
        var d = decode(crypto.decrypt(row.get("parsed_ciphertext").toString()));
        // Corrections are a new encrypted decision, never a replacement of the original source.
        for (String field : List.of(
            "fullName",
            "birthDate",
            "birthYear",
            "birthPrecision",
            "gender",
            "identity",
            "fatherName",
            "motherName"
        ))
            if (input.containsKey(field) && (!field.equals("identity") || !s(input, "identity").isBlank())) d.put(field, input.get(field));
        validatePerson(d);
        UUID resident = null;
        if (action.equals("LINK")) {
            resident = UUID.fromString(s(input, "residentId"));
            get("resident", resident);
        }
        db.update(
            "insert into tc2_roster.review_event(id,source_row_id,actor,reason,action) values (?,?,?,?,?)",
            UUID.randomUUID(),
            source,
            rbac.subject(),
            s(input, "reason"),
            action
        );
        db.update(
            "update tc2_roster.import_row set resolution_ciphertext=?,resolution_action=?,resolution_resident_id=?,status='READY',decision=?,reviewed_by=?,reviewed_at=now() where id=?",
            crypto.encrypt(encode(d)),
            action,
            resident,
            s(input, "reason"),
            rbac.subject(),
            source
        );
    }

    private UUID insertResident(Map<String, ?> d, String origin, UUID source) {
        required(d, "fullName");
        UUID id = UUID.randomUUID();
        db.update(
            "insert into tc2_roster.resident(id,hamlet_id,full_name,birth_date,birth_year,birth_date_precision,gender,father_name,mother_name,origin) values (?,?,?,?::date,?::integer,?,?,?,?,?)",
            id,
            hamlet(),
            s(d, "fullName"),
            nullable(d, "birthDate"),
            nullable(d, "birthYear"),
            s(d, "birthPrecision").isBlank() ? "UNKNOWN" : s(d, "birthPrecision"),
            nullable(d, "gender"),
            nullable(d, "fatherName"),
            nullable(d, "motherName"),
            origin
        );
        String identity = s(d, "identity");
        if (!identity.isEmpty()) db.update(
            "insert into tc2_roster.resident_identity(id,resident_id,number_ciphertext,number_lookup,source_row_id) values (?,?,?,?,?)",
            UUID.randomUUID(),
            id,
            crypto.encrypt(identity),
            crypto.lookup(identity),
            source
        );
        return id;
    }

    private UUID importHousehold(Map<String, Object> d) {
        String number = s(d, "caseNumber"),
            kind = s(d, "kind");
        String address = kind.equals("PERMANENT")
            ? s(d, "permanentAddress")
            : kind.equals("TEMPORARY")
              ? s(d, "temporaryAddress")
              : s(d, "declaredAddress");
        if (address.isBlank()) address = s(d, "currentAddress");
        if (address.isBlank()) return null;
        // Registered case numbers are household candidates. For other records keep provisional address/representative groupings distinct.
        String key = number.isBlank()
            ? "provisional:" + kind + ":" + RosterWorkbook.norm(address) + ":" + RosterWorkbook.norm(s(d, "representative"))
            : "case:" + number;
        String code = "TC2-R-" + digest(key).substring(0, 24);
        var ids = db.queryForList("select id from tc2_roster.household where code=?", UUID.class, code);
        if (!ids.isEmpty()) return ids.getFirst();
        UUID id = UUID.randomUUID();
        double[] point = point(address + "|" + key);
        db.update(
            "insert into tc2_roster.household(id,hamlet_id,code,source_case_number,case_scope,representative_name,raw_address,origin,latitude,longitude,coordinate_method,coordinate_seed,boundary_hash) values (?,?,?,?,?,?,?,'EXCEL',?,?,'RANDOM_WITHIN_TC2',?,?)",
            id,
            hamlet(),
            code,
            number.isBlank() ? null : number,
            "TC2_SOURCE_UNCONFIRMED",
            nullable(d, "representative"),
            address,
            point[1],
            point[0],
            digest(address + "|" + key),
            boundaryHash()
        );
        return id;
    }

    private UUID importRecord(Map<String, ?> d, UUID resident, UUID household, UUID source) {
        // Only identical source semantics collapse into one event. Missing dates do not imply an end to another event.
        String fingerprint = encode(new TreeMap<>(d));
        for (var existing : db.queryForList(
            "select l.record_id,r.parsed_ciphertext from tc2_roster.source_link l join tc2_roster.import_row r on r.id=l.source_row_id where l.resident_id=?",
            resident
        )) {
            if (
                fingerprint.equals(encode(new TreeMap<>(decode(crypto.decrypt(existing.get("parsed_ciphertext").toString())))))
            ) return (UUID) existing.get("record_id");
        }
        UUID id = UUID.randomUUID();
        db.update(
            "insert into tc2_roster.residence_record(id,hamlet_id,resident_id,household_id,record_kind,registration_date,valid_from,valid_to,source_status,source_residence_time_raw,representative_name_raw,classification_raw,housing_classification_raw,registration_form,source_row_id) values (?,?,?,?,?,?::date,?::date,?::date,?,?,?,?,?,?,?)",
            id,
            hamlet(),
            resident,
            household,
            s(d, "kind"),
            nullable(d, "registrationDate"),
            nullable(d, "validFrom"),
            nullable(d, "validTo"),
            nullable(d, "sourceStatus"),
            nullable(d, "residenceTimeRaw"),
            nullable(d, "representative"),
            nullable(d, "classification"),
            nullable(d, "housingClassification"),
            nullable(d, "registrationForm"),
            source
        );
        for (String role : List.of("permanentAddress", "temporaryAddress", "currentAddress", "declaredAddress", "previousAddress")) {
            if (s(d, role).isBlank()) continue;
            UUID address = UUID.randomUUID();
            db.update("insert into tc2_roster.residence_address(id,raw_address) values (?,?)", address, s(d, role));
            db.update(
                "insert into tc2_roster.residence_record_address(record_id,address_id,address_role) values (?,?,?)",
                id,
                address,
                role
            );
        }
        db.update(
            "insert into tc2_roster.residence_verification(id,resident_id,record_id,presence_status,method,source_row_id) values (?,?,?,?,?,?)",
            UUID.randomUUID(),
            resident,
            id,
            s(d, "presence").isBlank() ? "UNKNOWN" : s(d, "presence"),
            source == null ? "MANUAL" : "EXCEL_UNDATED",
            source
        );
        return id;
    }

    private void membership(UUID household, UUID resident, UUID source, String relation, boolean head, String validFrom) {
        db.update(
            "insert into tc2_roster.household_membership(id,hamlet_id,household_id,resident_id,relationship_code,is_head,valid_from,source_row_id) values (?,?,?,?,?,?,?::date,?) on conflict (household_id,resident_id) where valid_to is null do nothing",
            UUID.randomUUID(),
            hamlet(),
            household,
            resident,
            relation,
            head,
            validFrom,
            source
        );
    }

    private String boundary() {
        return db.queryForObject("select boundary_geo_json from public.hamlet where id=?", String.class, hamlet());
    }

    private String boundaryHash() {
        return digest(boundary());
    }

    public static String digest(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }

    private double[] point(String seed) {
        String geometry = boundary();
        if (geometry == null) throw bad("TC2 chưa có ranh giới để tạo điểm tạm");
        var cache = boundaryCache;
        if (cache == null || !geometry.equals(cache.raw())) {
            cache = new BoundaryCache(geometry, TerritoryGeometry.area(json.readTree(geometry)));
            boundaryCache = cache;
        }
        var area = cache.area();
        if (area.isEmpty()) throw bad("Ranh giới TC2 không hợp lệ");
        var box = area.getBounds2D();
        var random = new Random(Long.parseUnsignedLong(digest(seed + "|" + digest(geometry)).substring(0, 16), 16));
        for (int i = 0; i < 100000; i++) {
            double x = box.getMinX() + random.nextDouble() * box.getWidth(),
                y = box.getMinY() + random.nextDouble() * box.getHeight();
            if (area.contains(x, y)) return new double[] { x, y };
        }
        throw bad("Không tạo được tọa độ tạm trong TC2");
    }

    public Map<String, Object> overview() {
        authorize(null);
        return db.queryForMap(
            "select (select count(*) from tc2_roster.household where hamlet_id=?) households,(select count(*) from tc2_roster.resident where hamlet_id=?) residents,(select count(*) from tc2_roster.residence_record where hamlet_id=?) records,(select count(*) from tc2_roster.import_row r join tc2_roster.import_batch b on b.id=r.batch_id join tc2_roster.import_collection c on c.id=b.collection_id where c.hamlet_id=? and r.status='REVIEW') review_rows",
            hamlet(),
            hamlet(),
            hamlet(),
            hamlet()
        );
    }

    public Map<String, Object> households(String search, int page) {
        return households(search, page, "", "");
    }

    public Map<String, Object> households(String search, int page, String origin, String category) {
        authorize(null);
        if (
            page < 0 ||
            search.length() > 200 ||
            !Set.of("", "EXCEL", "MANUAL").contains(origin) ||
            !Set.of("", "HSCT", "PROVISIONAL").contains(category)
        ) throw bad("Bộ lọc hộ không hợp lệ");
        String pattern = "%" + search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        String where =
            " from tc2_roster.household h where hamlet_id=? and (raw_address ilike ? or coalesce(representative_name,'') ilike ? or code ilike ? or coalesce(source_case_number,'') ilike ?)" +
            " and (?='' or origin=?) and (?='' or (?='HSCT' and source_case_number is not null) or (?='PROVISIONAL' and source_case_number is null))";
        var args = new ArrayList<Object>(
            Arrays.asList(hamlet(), pattern, pattern, pattern, pattern, origin, origin, category, category, category)
        );
        long total = db.queryForObject("select count(*)" + where, Long.class, args.toArray());
        args.add((long) page * 30);
        var rows = db.queryForList(
            "select h.*,(select count(*) from tc2_roster.household_membership m where m.household_id=h.id and m.valid_to is null) member_count" +
                where +
                " order by code limit 30 offset ?",
            args.toArray()
        );
        return Map.of("items", rows, "total", total, "page", page);
    }

    public Map<String, Object> residents(String search, String kind, String origin, int page) {
        authorize(null);
        if (
            page < 0 ||
            search.length() > 200 ||
            !Set.of("", "PERMANENT", "TEMPORARY", "NOHT", "ARTICLE19").contains(kind) ||
            !Set.of("", "EXCEL", "MANUAL").contains(origin)
        ) throw bad("Bộ lọc không hợp lệ");
        String where =
            " from tc2_roster.resident r where r.hamlet_id=? and (?='' or r.origin=?) " +
            "and (?='' or position(lower(?) in lower(r.full_name))>0 or exists(select 1 from tc2_roster.resident_identity i where i.resident_id=r.id and i.active and i.number_lookup=?)) " +
            "and (?='' or exists(select 1 from tc2_roster.residence_record rr where rr.resident_id=r.id and rr.record_kind=?))";
        Object[] args = { hamlet(), origin, origin, search, search, crypto.lookup(search), kind, kind };
        long total = db.queryForObject("select count(*)" + where, Long.class, args);
        var params = new ArrayList<>(Arrays.asList(args));
        params.add((long) page * 30);
        var items = db.queryForList(
            "select r.*,(select count(*) from tc2_roster.residence_record rr where rr.resident_id=r.id) record_count," +
                "(select count(*) from tc2_roster.household_membership m where m.resident_id=r.id and m.valid_to is null) household_count" +
                where +
                " order by r.full_name,r.id limit 30 offset ?",
            params.toArray()
        );
        return Map.of("items", items, "total", total, "page", page);
    }

    public Map<String, Object> createResident(Map<String, Object> d) {
        authorize("canAddHouseholds");
        required(d, "reason");
        lock();
        UUID previous = receipt(d, "CREATE_RESIDENT");
        if (previous != null) return resident(previous);
        validatePerson(d);
        if (
            !s(d, "identity").isBlank() &&
            !db
                .queryForList(
                    "select id from tc2_roster.resident_identity where active and number_lookup=?",
                    crypto.lookup(s(d, "identity"))
                )
                .isEmpty()
        ) throw new ResponseStatusException(HttpStatus.CONFLICT, "Định danh đã có; tìm và dùng lại hồ sơ");
        context(rbac.subject(), "RESIDENT_CREATED", s(d, "reason"), s(d, "effectiveDate"), null);
        UUID id = insertResident(d, "MANUAL", null);
        remember(d, "CREATE_RESIDENT", id);
        return resident(id);
    }

    public Map<String, Object> transferMember(UUID membershipId, Map<String, Object> d) {
        authorize("canUpdateInspection");
        required(d, "reason");
        required(d, "effectiveDate");
        lock();
        UUID previous = receipt(d, "TRANSFER:" + membershipId);
        if (previous != null) return resident(previous);
        var old = get("household_membership", membershipId);
        UUID target = UUID.fromString(s(d, "householdId"));
        get("household", target);
        if (target.equals(old.get("household_id")) || old.get("valid_to") != null) throw bad("Chọn hộ khác và quan hệ đang hiện hành");
        LocalDate date = LocalDate.parse(s(d, "effectiveDate"));
        if (date.isAfter(LocalDate.now())) throw bad("Chưa hỗ trợ chuyển hộ trong tương lai");
        if (old.get("valid_from") != null && date.isBefore(LocalDate.parse(old.get("valid_from").toString()))) throw bad(
            "Ngày chuyển trước ngày tham gia hộ"
        );
        UUID person = (UUID) old.get("resident_id");
        if (
            !db
                .queryForList(
                    "select id from tc2_roster.household_membership where resident_id=? and household_id=? and valid_to is null",
                    person,
                    target
                )
                .isEmpty()
        ) throw new ResponseStatusException(HttpStatus.CONFLICT, "Người đã là thành viên hộ đích");
        context(rbac.subject(), "MEMBER_TRANSFER", s(d, "reason"), date.toString(), null);
        changed(
            db.update(
                "update tc2_roster.household_membership set valid_to=?::date,version=version+1 where id=? and version=?",
                date.toString(),
                membershipId,
                version(d)
            )
        );
        membership(
            target,
            person,
            null,
            nullable(d, "relationship") == null ? null : s(d, "relationship"),
            Boolean.TRUE.equals(d.get("isHead")),
            date.toString()
        );
        remember(d, "TRANSFER:" + membershipId, person);
        return resident(person);
    }

    public List<Map<String, Object>> entityHistory(String type, UUID id, int page) {
        authorize(null);
        if (!Set.of("resident", "household").contains(type) || page < 0) throw bad("Hồ sơ không hợp lệ");
        get(type, id);
        String key = type + "_id";
        var rows = db.queryForList(
            "select *,before_data::text before_json,after_data::text after_json from tc2_roster.change_event where hamlet_id=? " +
                "and ((entity_type=? and entity_id=?) or before_data->>?=? or after_data->>?=?) order by id desc limit 100 offset ?",
            hamlet(),
            type,
            id,
            key,
            id.toString(),
            key,
            id.toString(),
            (long) page * 100
        );
        return sanitizeHistory(rows);
    }

    public Map<String, Object> household(UUID id) {
        authorize(null);
        var h = get("household", id);
        h.put(
            "members",
            db.queryForList(
                "select m.id membership_id,m.relationship_code,m.is_head,m.valid_from,m.valid_to,m.version membership_version,r.* from tc2_roster.household_membership m join tc2_roster.resident r on r.id=m.resident_id where m.household_id=? order by m.is_head desc,r.full_name",
                id
            )
        );
        h.put(
            "sources",
            db.queryForList(
                "select r.id,r.sheet,r.row_number,b.file_name,b.legacy_hamlet from tc2_roster.source_link l join tc2_roster.import_row r on r.id=l.source_row_id join tc2_roster.import_batch b on b.id=r.batch_id where l.household_id=? order by b.file_name,r.row_number",
                id
            )
        );
        return h;
    }

    public Map<String, Object> legacyHousehold(long id) {
        authorize(null);
        var ids = db.queryForList("select roster_id from public.household where id=? and hamlet_id=?", UUID.class, id, hamlet());
        if (ids.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy hộ");
        return household(ids.getFirst());
    }

    public Map<String, Object> resident(UUID id) {
        authorize(null);
        var r = get("resident", id);
        r.put(
            "memberships",
            db.queryForList(
                "select m.*,h.code,h.raw_address from tc2_roster.household_membership m join tc2_roster.household h on h.id=m.household_id where m.resident_id=? order by m.valid_to nulls first,h.code",
                id
            )
        );
        var identities = db.queryForList(
            "select id,document_type,verified,active,valid_from,valid_to,source_row_id,number_ciphertext from tc2_roster.resident_identity where resident_id=?",
            id
        );
        for (var identity : identities) identity.put("number", crypto.decrypt(identity.remove("number_ciphertext").toString()));
        r.put("identities", identities);
        var records = db.queryForList(
            "select *, case when valid_to is null then 'UNKNOWN' when valid_to<current_date then 'EXPIRED' else 'WITHIN_TERM' end expiry_status from tc2_roster.residence_record where resident_id=? order by created_at",
            id
        );
        for (var rec : records)
            rec.put(
                "addresses",
                db.queryForList(
                    "select a.*,ra.address_role from tc2_roster.residence_record_address ra join tc2_roster.residence_address a on a.id=ra.address_id where record_id=?",
                    rec.get("id")
                )
            );
        r.put("records", records);
        r.put(
            "verifications",
            db.queryForList("select * from tc2_roster.residence_verification where resident_id=? order by recorded_at desc", id)
        );
        r.put(
            "sources",
            db.queryForList(
                "select s.id,s.sheet,s.row_number,b.file_name,b.legacy_hamlet from tc2_roster.source_link l join tc2_roster.import_row s on s.id=l.source_row_id join tc2_roster.import_batch b on b.id=s.batch_id where l.resident_id=?",
                id
            )
        );
        return r;
    }

    public List<Map<String, Object>> findPeople(String search) {
        authorize(null);
        if (search.length() < 2 || search.length() > 100) throw bad("Nhập từ 2 đến 100 ký tự");
        return db.queryForList(
            "select distinct r.id,r.full_name,r.birth_date,r.birth_year,r.gender,r.version from tc2_roster.resident r left join tc2_roster.resident_identity i on i.resident_id=r.id and i.active where r.hamlet_id=? and (i.number_lookup=? or position(lower(?) in lower(r.full_name))>0) order by r.full_name limit 30",
            hamlet(),
            crypto.lookup(search),
            search
        );
    }

    public Map<String, Object> createHousehold(Map<String, Object> d) {
        authorize("canAddHouseholds");
        required(d, "reason");
        required(d, "rawAddress");
        lock();
        UUID previous = receipt(d, "CREATE_HOUSEHOLD");
        if (previous != null) return household(previous);
        context(rbac.subject(), "HOUSEHOLD_CREATED", s(d, "reason"), s(d, "effectiveDate"), null);
        UUID id = UUID.randomUUID();
        double[] p = point(s(d, "rawAddress") + "|" + id);
        db.update(
            "insert into tc2_roster.household(id,hamlet_id,code,source_case_number,case_scope,representative_name,phone,raw_address,origin,latitude,longitude,coordinate_method,coordinate_seed,boundary_hash) values (?,?,?,?,?,?,?,?,'MANUAL',?,?,'RANDOM_WITHIN_TC2',?,?)",
            id,
            hamlet(),
            "TC2-M-" + id.toString().substring(0, 12),
            nullable(d, "caseNumber"),
            "TC2_SOURCE_UNCONFIRMED",
            nullable(d, "representative"),
            nullable(d, "phone"),
            s(d, "rawAddress"),
            p[1],
            p[0],
            digest(s(d, "rawAddress") + "|" + id),
            boundaryHash()
        );
        remember(d, "CREATE_HOUSEHOLD", id);
        return household(id);
    }

    private void validatePerson(Map<String, Object> d) {
        required(d, "fullName");
        String precision = s(d, "birthPrecision");
        if (!Set.of("DAY", "YEAR", "UNKNOWN").contains(precision)) throw bad("Chọn độ đầy đủ ngày sinh");
        if (precision.equals("DAY")) {
            LocalDate date = LocalDate.parse(s(d, "birthDate"));
            if (date.isAfter(LocalDate.now())) throw bad("Ngày sinh ở tương lai");
            d.put("birthYear", date.getYear());
        } else d.remove("birthDate");
        if (precision.equals("UNKNOWN")) d.remove("birthYear");
        if (precision.equals("YEAR")) {
            try {
                int year = Integer.parseInt(s(d, "birthYear"));
                if (year < 1850 || year > LocalDate.now().getYear()) throw bad("Năm sinh không hợp lệ");
            } catch (NumberFormatException ex) {
                throw bad("Cần năm sinh bốn chữ số");
            }
        }
        if (!s(d, "gender").isBlank() && !Set.of("MALE", "FEMALE", "OTHER").contains(s(d, "gender"))) throw bad("Giới tính không hợp lệ");
        if (!s(d, "identity").isBlank() && !s(d, "identity").matches("[0-9]{9,12}")) throw bad("Định danh phải giữ dạng text 9–12 chữ số");
    }

    public Map<String, Object> addMember(UUID household, Map<String, Object> d) {
        authorize("canAddHouseholds");
        required(d, "reason");
        get("household", household);
        lock();
        UUID previous = receipt(d, "ADD_MEMBER:" + household);
        if (previous != null) return resident(previous);
        context(rbac.subject(), "MEMBER_ADDED", s(d, "reason"), s(d, "effectiveDate"), null);
        UUID resident;
        if (!s(d, "residentId").isBlank()) {
            resident = UUID.fromString(s(d, "residentId"));
            get("resident", resident);
        } else {
            validatePerson(d);
            if (
                !s(d, "identity").isBlank() &&
                !db
                    .queryForList(
                        "select id from tc2_roster.resident_identity where number_lookup=? and active",
                        crypto.lookup(s(d, "identity"))
                    )
                    .isEmpty()
            ) throw new ResponseStatusException(HttpStatus.CONFLICT, "Định danh đã có; tìm và dùng lại hồ sơ");
            resident = insertResident(d, "MANUAL", null);
        }
        if (
            !db
                .queryForList(
                    "select id from tc2_roster.household_membership where household_id=? and resident_id=? and valid_to is null",
                    household,
                    resident
                )
                .isEmpty()
        ) throw new ResponseStatusException(HttpStatus.CONFLICT, "Người đã là thành viên hộ");
        membership(
            household,
            resident,
            null,
            nullable(d, "relationship") == null ? null : s(d, "relationship"),
            Boolean.TRUE.equals(d.get("isHead")),
            nullable(d, "effectiveDate") == null ? null : s(d, "effectiveDate")
        );
        if (!s(d, "kind").isBlank()) {
            validateRecord(d);
            importRecord(d, resident, household, null);
        }
        remember(d, "ADD_MEMBER:" + household, resident);
        return resident(resident);
    }

    private UUID receipt(Map<String, Object> data, String operation) {
        var original = new TreeMap<>(data);
        original.remove("_requestHash");
        data.put("_requestHash", digest(encode(original)));
        if (s(data, "requestId").isBlank()) throw bad("Thiếu mã yêu cầu chống nhập lặp");
        UUID id = UUID.fromString(s(data, "requestId"));
        var rows = db.queryForList("select * from tc2_roster.request_receipt where id=?", id);
        if (rows.isEmpty()) return null;
        var row = rows.getFirst();
        if (
            !operation.equals(row.get("operation")) ||
            !rbac.subject().equals(row.get("actor")) ||
            !s(data, "_requestHash").equals(row.get("request_hash"))
        ) throw new ResponseStatusException(HttpStatus.CONFLICT, "Mã yêu cầu đã dùng cho nội dung khác");
        return (UUID) row.get("entity_id");
    }

    private void remember(Map<String, Object> data, String operation, UUID entity) {
        db.update(
            "insert into tc2_roster.request_receipt(id,actor,operation,request_hash,entity_id) values (?,?,?,?,?)",
            UUID.fromString(s(data, "requestId")),
            rbac.subject(),
            operation,
            s(data, "_requestHash"),
            entity
        );
    }

    private long version(Map<String, Object> d) {
        if (!(d.get("version") instanceof Number n)) throw bad("Thiếu phiên bản hồ sơ");
        return n.longValue();
    }

    private void changed(int count) {
        if (count != 1) throw new ResponseStatusException(HttpStatus.CONFLICT, "Hồ sơ đã được cập nhật; tải lại để đối chiếu");
    }

    public Map<String, Object> updateHousehold(UUID id, Map<String, Object> d) {
        authorize("canUpdateInspection");
        var old = get("household", id);
        required(d, "rawAddress");
        String verification = d.containsKey("verificationStatus") ? s(d, "verificationStatus") : old.get("verification_status").toString();
        if (!Set.of("UNVERIFIED", "VERIFIED", "HEAD_CONFLICT").contains(verification)) throw bad("Trạng thái xác minh hộ không hợp lệ");
        required(d, "reason");
        context(rbac.subject(), "CORRECTION", s(d, "reason"), s(d, "effectiveDate"), null);
        changed(
            db.update(
                "update tc2_roster.household set representative_name=?,phone=?,raw_address=?,source_case_number=?,verification_status=?,version=version+1,updated_at=now() where id=? and version=?",
                nullable(d, "representative"),
                nullable(d, "phone"),
                s(d, "rawAddress"),
                d.containsKey("caseNumber") ? nullable(d, "caseNumber") : old.get("source_case_number"),
                verification,
                id,
                version(d)
            )
        );
        return household(id);
    }

    public Map<String, Object> updateResident(UUID id, Map<String, Object> d) {
        authorize("canUpdateInspection");
        get("resident", id);
        required(d, "reason");
        validatePerson(d);
        context(rbac.subject(), "CORRECTION", s(d, "reason"), s(d, "effectiveDate"), null);
        changed(
            db.update(
                "update tc2_roster.resident set full_name=?,birth_date=?::date,birth_year=?::integer,birth_date_precision=?,gender=?,father_name=?,mother_name=?,version=version+1,updated_at=now() where id=? and version=?",
                s(d, "fullName"),
                nullable(d, "birthDate"),
                nullable(d, "birthYear"),
                s(d, "birthPrecision"),
                nullable(d, "gender"),
                nullable(d, "fatherName"),
                nullable(d, "motherName"),
                id,
                version(d)
            )
        );
        return resident(id);
    }

    private void validateRecord(Map<String, Object> d) {
        if (!Set.of("PERMANENT", "TEMPORARY", "NOHT", "ARTICLE19").contains(s(d, "kind"))) throw bad("Loại hồ sơ không hợp lệ");
    }

    public Map<String, Object> addRecord(UUID resident, Map<String, Object> d) {
        authorize("canUpdateInspection");
        get("resident", resident);
        required(d, "reason");
        validateRecord(d);
        lock();
        UUID household = s(d, "householdId").isBlank() ? null : UUID.fromString(s(d, "householdId"));
        if (household != null) get("household", household);
        UUID previous = receipt(d, "ADD_RECORD:" + resident);
        if (previous != null) return resident(resident);
        context(rbac.subject(), "RESIDENCE_ADDED", s(d, "reason"), s(d, "effectiveDate"), null);
        UUID record = importRecord(d, resident, household, null);
        remember(d, "ADD_RECORD:" + resident, record);
        return resident(resident);
    }

    public Map<String, Object> addIdentity(UUID resident, Map<String, Object> d) {
        authorize("canUpdateInspection");
        get("resident", resident);
        required(d, "reason");
        required(d, "identity");
        lock();
        String number = s(d, "identity");
        if (!number.matches("[0-9]{9,12}")) throw bad("Giấy tờ phải là text 9–12 chữ số");
        String type = s(d, "documentType");
        if (!Set.of("CCCD", "CMND", "SOURCE_UNCONFIRMED").contains(type)) throw bad("Loại giấy tờ không hợp lệ");
        if (
            !db
                .queryForList(
                    "select id from tc2_roster.resident_identity where number_lookup=? and active and resident_id<>?",
                    crypto.lookup(number),
                    resident
                )
                .isEmpty()
        ) throw new ResponseStatusException(HttpStatus.CONFLICT, "Giấy tờ đã gắn người khác; cần đối soát");
        context(rbac.subject(), "IDENTITY_UPDATE", s(d, "reason"), s(d, "effectiveDate"), null);
        changed(
            db.update("update tc2_roster.resident set version=version+1,updated_at=now() where id=? and version=?", resident, version(d))
        );
        if (!s(d, "replaceIdentityId").isBlank()) {
            UUID old = UUID.fromString(s(d, "replaceIdentityId"));
            var previous = db.queryForList(
                "select number_lookup from tc2_roster.resident_identity where id=? and resident_id=? and active",
                String.class,
                old,
                resident
            );
            if (previous.isEmpty()) throw bad("Giấy tờ thay thế không thuộc người này hoặc đã kết thúc");
            if (!previous.getFirst().equals(crypto.lookup(number))) db.update(
                "update tc2_roster.resident_identity set active=false,valid_to=?::date where id=?",
                nullable(d, "effectiveDate"),
                old
            );
        }
        db.update(
            "insert into tc2_roster.resident_identity(id,resident_id,document_type,number_ciphertext,number_lookup,verified) values (?,?,?,?,?,?) on conflict(resident_id,number_lookup) do update set document_type=excluded.document_type,verified=excluded.verified,active=true,valid_to=null",
            UUID.randomUUID(),
            resident,
            type,
            crypto.encrypt(number),
            crypto.lookup(number),
            Boolean.TRUE.equals(d.get("verified"))
        );
        return resident(resident);
    }

    public Map<String, Object> updateRecord(UUID id, Map<String, Object> d) {
        authorize("canUpdateInspection");
        var old = get("residence_record", id);
        required(d, "reason");
        String kind = s(d, "changeKind");
        if (!Set.of("CORRECTION", "RENEWAL", "RESIDENCE_ENDED").contains(kind)) throw bad("Chọn loại thay đổi");
        if (!kind.equals("CORRECTION") && (s(d, "effectiveDate").isBlank() || s(d, "validTo").isBlank())) throw bad(
            "Gia hạn/kết thúc cần ngày hiệu lực và ngày kết thúc"
        );
        context(rbac.subject(), kind, s(d, "reason"), s(d, "effectiveDate"), null);
        changed(
            db.update(
                "update tc2_roster.residence_record set registration_date=?::date,valid_from=?::date,valid_to=?::date,source_status=?,version=version+1,updated_at=now() where id=? and version=?",
                nullable(d, "registrationDate"),
                nullable(d, "validFrom"),
                nullable(d, "validTo"),
                nullable(d, "sourceStatus"),
                id,
                version(d)
            )
        );
        for (String role : List.of("permanentAddress", "temporaryAddress", "currentAddress", "declaredAddress", "previousAddress")) {
            if (!d.containsKey(role)) continue;
            var current = db.queryForList(
                "select a.raw_address from tc2_roster.residence_record_address l join tc2_roster.residence_address a on a.id=l.address_id where l.record_id=? and l.address_role=?",
                String.class,
                id,
                role
            );
            if (current.size() == 1 && current.getFirst().equals(s(d, role))) continue;
            db.update("delete from tc2_roster.residence_record_address where record_id=? and address_role=?", id, role);
            if (!s(d, role).isBlank()) {
                UUID address = UUID.randomUUID();
                db.update("insert into tc2_roster.residence_address(id,raw_address) values (?,?)", address, s(d, role));
                db.update(
                    "insert into tc2_roster.residence_record_address(record_id,address_id,address_role) values (?,?,?)",
                    id,
                    address,
                    role
                );
            }
        }
        return resident((UUID) old.get("resident_id"));
    }

    public Map<String, Object> updateMembership(UUID id, Map<String, Object> d) {
        authorize("canUpdateInspection");
        var m = get("household_membership", id);
        required(d, "reason");
        lock();
        context(rbac.subject(), "MEMBERSHIP_CHANGE", s(d, "reason"), s(d, "effectiveDate"), null);
        changed(
            db.update(
                "update tc2_roster.household_membership set relationship_code=?,is_head=?,valid_from=?::date,valid_to=?::date,version=version+1 where id=? and version=?",
                nullable(d, "relationship"),
                Boolean.TRUE.equals(d.get("isHead")),
                nullable(d, "validFrom"),
                nullable(d, "validTo"),
                id,
                version(d)
            )
        );
        return household((UUID) m.get("household_id"));
    }

    public void verify(UUID resident, Map<String, Object> d) {
        authorize("canUpdateInspection");
        get("resident", resident);
        required(d, "reason");
        String status = s(d, "presence");
        if (!Set.of("PRESENT", "ABSENT", "UNKNOWN").contains(status)) throw bad("Trạng thái không hợp lệ");
        if (s(d, "observedAt").isBlank()) throw bad("Cần ngày kiểm tra");
        if (LocalDate.parse(s(d, "observedAt")).isAfter(LocalDate.now())) throw bad("Ngày kiểm tra ở tương lai");
        context(rbac.subject(), "VERIFICATION", s(d, "reason"), s(d, "observedAt"), null);
        db.update(
            "insert into tc2_roster.residence_verification(id,resident_id,presence_status,observed_at,verified_by,method) values (?,?,?,?::date,?,'MANUAL')",
            UUID.randomUUID(),
            resident,
            status,
            s(d, "observedAt"),
            rbac.subject()
        );
    }

    public List<Map<String, Object>> history(String from, String to, int page) {
        authorize(null);
        LocalDate.parse(from);
        LocalDate.parse(to);
        if (page < 0) throw bad("Invalid page");
        var rows = db.queryForList(
            "select *,before_data::text before_json,after_data::text after_json from tc2_roster.change_event where hamlet_id=? and recorded_at>=?::date and recorded_at<(?::date+interval '1 day') order by id desc limit 100 offset ?",
            hamlet(),
            from,
            to,
            (long) page * 100
        );
        return sanitizeHistory(rows);
    }

    private List<Map<String, Object>> sanitizeHistory(List<Map<String, Object>> rows) {
        for (var row : rows) {
            for (String side : List.of("before", "after")) {
                Object value = row.remove(side + "_json");
                var data = value == null ? null : decode(value.toString());
                if (data != null) {
                    data.remove("number_ciphertext");
                    data.remove("number_lookup");
                    if ("residence_record_address".equals(row.get("entity_type")) && data.get("address_id") != null) {
                        var addresses = db.queryForList(
                            "select raw_address from tc2_roster.residence_address where id=?",
                            String.class,
                            UUID.fromString(data.get("address_id").toString())
                        );
                        if (!addresses.isEmpty()) data.put("raw_address", addresses.getFirst());
                    }
                }
                row.put(side + "_data", data);
            }
        }
        return rows;
    }

    @Transactional(readOnly = true, isolation = org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public Map<String, Object> report(String from, String to) {
        authorize("canExportReports");
        LocalDate start = LocalDate.parse(from),
            end = LocalDate.parse(to);
        if (start.isAfter(end)) throw bad("Khoảng ngày không hợp lệ");
        var result = new LinkedHashMap<String, Object>();
        result.put("from", from);
        result.put("to", to);
        result.put("timeBasis", "RECORDED_AT");
        result.put(
            "changes",
            db.queryForList(
                "select change_kind,entity_type,operation,count(*) amount from tc2_roster.change_event where hamlet_id=? and recorded_at>=?::date and recorded_at<(?::date+interval '1 day') group by 1,2,3 order by 1,2,3",
                hamlet(),
                from,
                to
            )
        );
        for (String table : List.of("household", "resident")) {
            result.put(table + "Opening", snapshotCount(table, from));
            result.put(table + "Closing", snapshotCount(table, end.plusDays(1).toString()));
        }
        return result;
    }

    private long snapshotCount(String table, String date) {
        return db.queryForObject(
            "select count(*) from (select distinct on(entity_id) operation from tc2_roster.change_event where hamlet_id=? and entity_type=? and recorded_at<?::date order by entity_id,id desc) t where operation<>'DELETE'",
            Long.class,
            hamlet(),
            table,
            date
        );
    }

    @Transactional(readOnly = true, isolation = org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public String reportCsv(String from, String to) {
        var report = report(from, to);
        var out = new StringBuilder("\ufefffrom,to,time_basis,change_kind,entity_type,operation,amount\r\n");
        @SuppressWarnings("unchecked")
        var rows = (List<Map<String, Object>>) report.get("changes");
        for (var row : rows)
            out.append(from)
                .append(',')
                .append(to)
                .append(",RECORDED_AT,")
                .append(row.get("change_kind"))
                .append(',')
                .append(row.get("entity_type"))
                .append(',')
                .append(row.get("operation"))
                .append(',')
                .append(row.get("amount"))
                .append("\r\n");
        for (String entity : List.of("household", "resident"))
            for (String end : List.of("Opening", "Closing"))
                out.append(from)
                    .append(',')
                    .append(to)
                    .append(",RECORDED_AT,SNAPSHOT_")
                    .append(end.toUpperCase(Locale.ROOT))
                    .append(',')
                    .append(entity)
                    .append(",COUNT,")
                    .append(report.get(entity + end))
                    .append("\r\n");
        return out.toString();
    }

    @Transactional(readOnly = true, isolation = org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public String detailedCsv(String from, String to) {
        authorize("canExportReports");
        LocalDate start = LocalDate.parse(from),
            end = LocalDate.parse(to);
        if (start.isAfter(end)) throw bad("Khoảng ngày không hợp lệ");
        long count = db.queryForObject(
            "select count(*) from tc2_roster.change_event where hamlet_id=? and recorded_at>=?::date and recorded_at<(?::date+interval '1 day')",
            Long.class,
            hamlet(),
            from,
            to
        );
        if (count > 100000) throw bad("Báo cáo vượt 100.000 thay đổi; chọn khoảng ngày ngắn hơn");
        var out = new StringBuilder(
            "\ufeffrecorded_at,effective_date,actor,change_kind,entity_type,entity_id,operation,reason,before,after\r\n"
        );
        for (int page = 0; page * 100L < count; page++) for (var event : history(from, to, page)) {
            var cells = new ArrayList<String>();
            for (String key : List.of(
                "recorded_at",
                "effective_date",
                "actor",
                "change_kind",
                "entity_type",
                "entity_id",
                "operation",
                "reason"
            ))
                cells.add(csvCell(Objects.toString(event.get(key), "")));
            cells.add(csvCell(encode(event.get("before_data"))));
            cells.add(csvCell(encode(event.get("after_data"))));
            out.append(String.join(",", cells)).append("\r\n");
        }
        return out.toString();
    }

    private String csvCell(String text) {
        if (text.matches("(?s)^[\\s]*[=+@-].*")) text = "'" + text;
        return "\"" + text.replace("\"", "\"\"") + "\"";
    }

    public Map<String, Object> map() {
        authorize("canViewAdvancedMap");
        var features = new ArrayList<Map<String, Object>>();
        for (var h : db.queryForList(
            "select id,code,raw_address,longitude,latitude,coordinate_method from tc2_roster.household where hamlet_id=? and latitude is not null",
            hamlet()
        )) {
            features.add(
                Map.of(
                    "type",
                    "Feature",
                    "geometry",
                    Map.of("type", "Point", "coordinates", List.of(h.get("longitude"), h.get("latitude"))),
                    "properties",
                    h
                )
            );
        }
        return Map.of("type", "FeatureCollection", "features", features, "boundary", json.readTree(boundary()));
    }
}
