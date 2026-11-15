package com.policemanagement.com.service.facility;

import com.policemanagement.com.service.AttachmentRecords;
import com.policemanagement.com.service.CccdProtection;
import com.policemanagement.com.service.rbac.RbacService;
import com.policemanagement.com.service.roster.RosterCrypto;
import com.policemanagement.com.service.roster.RosterService;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Establishments of the current hamlet: conditional business lines (CSKD có điều kiện về ANTT) and other businesses and
 * enterprises (cơ sở, doanh nghiệp). An establishment is a roster household whose type is BUSINESS, BOARDING_HOUSE, RELIGIOUS or
 * ENTERPRISE; its name, trade, licence and owner are edited through the roster household form. This service adds employees,
 * violation history, papers and photos. Viewing follows the roster scope; writing needs canManageFacilities.
 */
@Service
@Transactional
public class FacilityService {

    public static final List<String> TYPES = List.of("BUSINESS", "BOARDING_HOUSE", "RELIGIOUS", "ENTERPRISE");
    /** Days before the licence end date that it is flagged as due. */
    public static final int LICENSE_WARNING_DAYS = 30;
    static final int PAGE_SIZE = 30;
    static final int MAX_ATTACHMENTS = 30;
    static final String KIND = "FACILITY";
    private static final String TYPE_SQL = "h.type in ('BUSINESS','BOARDING_HOUSE','RELIGIOUS','ENTERPRISE')";
    /** Licence end date; the roster form only stores ISO dates, older free text is ignored. */
    static final String EXPIRY = "(case when h.license_expiry ~ '^\\d{4}-\\d{2}-\\d{2}$' then h.license_expiry::date end)";

    private final JdbcTemplate db;
    private final RosterService roster;
    private final RosterCrypto crypto;
    private final RbacService rbac;
    private final AttachmentRecords attachments;

    public FacilityService(JdbcTemplate db, RosterService roster, RosterCrypto crypto, RbacService rbac, AttachmentRecords attachments) {
        this.db = db;
        this.roster = roster;
        this.crypto = crypto;
        this.rbac = rbac;
        this.attachments = attachments;
    }

    /** The establishment in the caller's hamlet (and the permission when given); a plain household looks absent. */
    private Map<String, Object> facility(UUID id, String permission) {
        var row = roster.requireHousehold(id, permission);
        if (!TYPES.contains(Objects.toString(row.get("type"), ""))) throw new ResponseStatusException(
            HttpStatus.NOT_FOUND,
            "Hộ này không phải cơ sở kinh doanh / doanh nghiệp"
        );
        return row;
    }

    static void flags(Map<String, Object> row, LocalDate today) {
        Object value = row.get("license_expiry_on");
        LocalDate until = value instanceof java.sql.Date d ? d.toLocalDate() : value == null ? null : LocalDate.parse(value.toString());
        row.put("license_expired", until != null && until.isBefore(today));
        row.put("license_due", until != null && !until.isBefore(today) && !until.isAfter(today.plusDays(LICENSE_WARNING_DAYS)));
    }

    private static final String COLUMNS =
        "h.id, h.code, h.raw_address, h.type, h.business_name, h.business_category, h.is_conditional, h.license_type," +
        " h.license_number, h.license_expiry, " +
        EXPIRY +
        " license_expiry_on, h.representative_name, h.phone, h.source_case_number, h.version," +
        " (select count(*) from facility_employee e where e.household_id=h.id and e.ended_on is null) employee_count," +
        " (select count(*) from facility_violation v where v.household_id=h.id) violation_count," +
        " (select max(v.occurred_on) from facility_violation v where v.household_id=h.id) last_violation";

    private record Where(String text, List<Object> args) {}

    private Where where(Map<String, String> filter) {
        var text = new StringBuilder("h.hamlet_id=? and " + TYPE_SQL);
        var args = new ArrayList<Object>(List.of(roster.hamlet()));
        switch (filter.getOrDefault("group", "")) {
            case "" -> {
            }
            case "CONDITIONAL" -> text.append(" and h.is_conditional");
            case "OTHER" -> text.append(" and not h.is_conditional");
            default -> throw bad("Nhóm cơ sở không hợp lệ");
        }
        String type = filter.getOrDefault("type", "");
        if (!type.isBlank()) {
            if (!TYPES.contains(type)) throw bad("Loại hình không hợp lệ");
            text.append(" and h.type=?");
            args.add(type);
        }
        if ("LICENSE".equals(filter.getOrDefault("due", ""))) {
            text.append(" and ").append(EXPIRY).append("<=?");
            args.add(LocalDate.now().plusDays(LICENSE_WARNING_DAYS));
        } else if (!filter.getOrDefault("due", "").isBlank()) throw bad("Bộ lọc đến hạn không hợp lệ");
        String search = filter.getOrDefault("search", "").strip();
        if (!search.isEmpty()) {
            if (search.length() > 100) throw bad("Từ khóa tối đa 100 ký tự");
            text.append(
                " and (position(lower(?) in lower(coalesce(h.business_name,'')))>0 or position(lower(?) in lower(coalesce(h.raw_address,'')))>0" +
                    " or position(lower(?) in lower(coalesce(h.representative_name,'')))>0 or position(lower(?) in lower(coalesce(h.license_number,'')))>0)"
            );
            for (int i = 0; i < 4; i++) args.add(search);
        }
        return new Where(text.toString(), args);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> list(Map<String, String> filter) {
        roster.authorize(null);
        int page = page(filter.getOrDefault("page", "0"));
        var where = where(filter);
        String from = " from tc2_roster.household h where " + where.text();
        long total = db.queryForObject("select count(*)" + from, Long.class, where.args().toArray());
        var items = rows(from, where.args(), PAGE_SIZE, (long) page * PAGE_SIZE);
        return new LinkedHashMap<>(Map.of("items", items, "total", total, "page", page, "pageSize", PAGE_SIZE));
    }

    /** Most rows a printed or exported list holds. */
    public static final int EXPORT_LIMIT = 5000;

    /** Every establishment matching the filter (up to {@link #EXPORT_LIMIT}), in list order, for the printed list. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> all(Map<String, String> filter) {
        roster.authorize(null);
        var where = where(filter);
        return rows(" from tc2_roster.household h where " + where.text(), where.args(), EXPORT_LIMIT, 0);
    }

    private List<Map<String, Object>> rows(String from, List<Object> whereArgs, int limit, long offset) {
        var args = new ArrayList<>(whereArgs);
        args.add(offset);
        var items = db.queryForList(
            "select " + COLUMNS + from + " order by h.business_name nulls last, h.raw_address, h.id limit " + limit + " offset ?",
            args.toArray()
        );
        LocalDate today = LocalDate.now();
        for (var row : items) flags(row, today);
        return items;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> summary() {
        roster.authorize(null);
        long hamlet = roster.hamlet();
        var counts = db.queryForMap(
            "select count(*) filter (where h.is_conditional) conditional, count(*) filter (where not h.is_conditional) other," +
                " count(*) filter (where " +
                EXPIRY +
                "<=?) license_due from tc2_roster.household h where h.hamlet_id=? and " +
                TYPE_SQL,
            LocalDate.now().plusDays(LICENSE_WARNING_DAYS),
            hamlet
        );
        var byType = new LinkedHashMap<String, Long>();
        for (String t : TYPES) byType.put(t, 0L);
        db.query(
            "select h.type, count(*) from tc2_roster.household h where h.hamlet_id=? and " + TYPE_SQL + " group by 1",
            rs -> {
                byType.put(rs.getString(1), rs.getLong(2));
            },
            hamlet
        );
        var result = new LinkedHashMap<String, Object>(counts);
        result.put("byType", byType);
        result.put("licenseWarningDays", LICENSE_WARNING_DAYS);
        result.put("canManage", has("canManageFacilities"));
        result.put("canEditHousehold", has("canUpdateInspection"));
        return result;
    }

    private boolean has(String permission) {
        if (rbac.global()) return true;
        try {
            rbac.permission(permission);
            return true;
        } catch (org.springframework.security.access.AccessDeniedException e) {
            return false;
        }
    }

    @Transactional(readOnly = true)
    public Map<String, Object> detail(UUID id) {
        facility(id, null);
        var row = db.queryForMap("select " + COLUMNS + " from tc2_roster.household h where h.id=?", id);
        flags(row, LocalDate.now());
        // Owner: the verified head of the household when there is one; the representative name and phone otherwise.
        var heads = db.queryForList(
            "select r.id, r.full_name, r.birth_date, r.birth_year, r.birth_date_precision, r.gender, r.occupation," +
                " (select i.number_ciphertext from tc2_roster.resident_identity i where i.resident_id=r.id and i.active" +
                "  order by i.verified desc, i.valid_from desc nulls last limit 1) identity_ciphertext" +
                " from tc2_roster.household_membership m join tc2_roster.resident r on r.id=m.resident_id" +
                " where m.household_id=? and m.is_head and m.valid_to is null limit 1",
            id
        );
        for (var head : heads) {
            Object cipher = head.remove("identity_ciphertext");
            head.put("identity_masked", cipher == null ? null : CccdProtection.mask(crypto.decrypt(cipher.toString())));
        }
        row.put("owner", heads.isEmpty() ? null : heads.getFirst());
        var employees = db.queryForList(
            "select * from facility_employee where household_id=? order by ended_on nulls first, full_name",
            id
        );
        for (var e : employees) {
            Object cipher = e.remove("identity_ciphertext");
            e.remove("identity_lookup");
            e.put("identity_masked", cipher == null ? null : CccdProtection.mask(crypto.decrypt(cipher.toString())));
        }
        row.put("employees", employees);
        row.put(
            "violations",
            db.queryForList(
                "select * from facility_violation where household_id=? order by occurred_on desc nulls last, created_at desc",
                id
            )
        );
        // Papers registered in "Quản lý giấy tờ & ANTT" are linked by the legacy numeric household id.
        row.put(
            "documents",
            db.queryForList(
                "select d.id, d.doc_name, d.doc_type, d.document_number, d.issuing_authority, d.issued_on, d.expiry_on, d.status" +
                    " from document_record d join public.household ph on ph.id=d.household_id where ph.roster_id=? order by d.expiry_on nulls last",
                id
            )
        );
        row.put("attachments", attachments.list(KIND, id));
        rbac.audit("read", "facility:" + id, Map.of());
        return row;
    }

    // ---- employees and violations ------------------------------------------------------------------------------

    private String actor() {
        Object name = rbac.current().get("fullName");
        return name == null || name.toString().isBlank() ? rbac.subject() : name.toString();
    }

    public Map<String, Object> addEmployee(UUID id, Map<String, Object> d) {
        facility(id, "canManageFacilities");
        long hamlet = roster.hamlet();
        String residentText = s(d, "residentId");
        UUID resident = null;
        String name = text(d, "fullName", 255);
        Integer birthYear = null;
        String gender = text(d, "gender", 10);
        if (!residentText.isEmpty()) {
            // A resident of this hamlet: name, birth year and gender come from the roster, the identity stays there.
            resident = uuid(residentText);
            roster.requireResident(resident, "canManageFacilities");
            var person = db.queryForMap("select full_name, birth_year, gender from tc2_roster.resident where id=?", resident);
            name = person.get("full_name").toString();
            birthYear = person.get("birth_year") == null ? null : ((Number) person.get("birth_year")).intValue();
            gender = Objects.toString(person.get("gender"), "");
        } else if (!s(d, "birthYear").isEmpty()) {
            try {
                birthYear = Integer.parseInt(s(d, "birthYear"));
            } catch (NumberFormatException e) {
                throw bad("Năm sinh phải là số");
            }
            if (birthYear < 1900 || birthYear > LocalDate.now().getYear()) throw bad("Năm sinh không hợp lệ");
        }
        if (name.isBlank()) throw bad("Nhập họ tên nhân viên");
        if (!gender.isEmpty() && !Set.of("MALE", "FEMALE", "OTHER").contains(gender)) throw bad("Giới tính không hợp lệ");
        String identity = resident == null ? s(d, "identity") : "";
        if (!identity.isEmpty() && !identity.matches("[0-9]{9,12}")) throw bad("Số giấy tờ phải là 9–12 chữ số");
        LocalDate started = date(d, "startedOn", "Ngày bắt đầu làm việc");
        if (started != null && started.isAfter(LocalDate.now())) throw bad("Ngày bắt đầu không được ở tương lai");
        UUID employee = UUID.randomUUID();
        String actor = actor();
        db.update(
            "insert into facility_employee(id,household_id,hamlet_id,resident_id,full_name,birth_year,gender,identity_ciphertext,identity_lookup," +
                "phone,position,home_address,started_on,notes,created_by,updated_by) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            employee,
            id,
            hamlet,
            resident,
            name,
            birthYear,
            gender.isEmpty() ? null : gender,
            identity.isEmpty() ? null : crypto.encrypt(identity),
            identity.isEmpty() ? null : crypto.lookup(identity),
            text(d, "phone", 30),
            text(d, "position", 200),
            text(d, "homeAddress", 500),
            started,
            text(d, "notes", 2000),
            actor,
            actor
        );
        rbac.audit("facility-employee-add", "facility:" + id, Map.of("employee", employee.toString()));
        return detail(id);
    }

    /** Records that an employee left; the row and its history stay. */
    public Map<String, Object> endEmployee(UUID id, UUID employee, Map<String, Object> d) {
        facility(id, "canManageFacilities");
        var rows = db.queryForList("select * from facility_employee where id=? and household_id=?", employee, id);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy nhân viên của cơ sở này");
        if (rows.getFirst().get("ended_on") != null) throw bad("Nhân viên đã nghỉ việc");
        LocalDate ended = date(d, "endedOn", "Ngày nghỉ việc");
        if (ended == null) throw bad("Nhập ngày nghỉ việc");
        if (ended.isAfter(LocalDate.now())) throw bad("Ngày nghỉ việc không được ở tương lai");
        Object started = rows.getFirst().get("started_on");
        if (started != null && ended.isBefore(LocalDate.parse(started.toString()))) throw bad("Ngày nghỉ việc trước ngày bắt đầu");
        db.update("update facility_employee set ended_on=?,updated_at=now(),updated_by=? where id=?", ended, actor(), employee);
        rbac.audit("facility-employee-end", "facility:" + id, Map.of("employee", employee.toString()));
        return detail(id);
    }

    public Map<String, Object> addViolation(UUID id, Map<String, Object> d) {
        facility(id, "canManageFacilities");
        String content = text(d, "content", 1000);
        if (content.isBlank()) throw bad("Nhập nội dung vi phạm");
        LocalDate occurred = date(d, "occurredOn", "Ngày vi phạm");
        if (occurred != null && occurred.isAfter(LocalDate.now())) throw bad("Ngày vi phạm không được ở tương lai");
        UUID violation = UUID.randomUUID();
        db.update(
            "insert into facility_violation(id,household_id,hamlet_id,occurred_on,content,decision_no,authority,penalty,notes,created_by) values (?,?,?,?,?,?,?,?,?,?)",
            violation,
            id,
            roster.hamlet(),
            occurred,
            content,
            text(d, "decisionNo", 100),
            text(d, "authority", 200),
            text(d, "penalty", 1000),
            text(d, "notes", 2000),
            actor()
        );
        rbac.audit("facility-violation", "facility:" + id, Map.of("violation", violation.toString()));
        return detail(id);
    }

    // ---- attachments (papers and photos) -----------------------------------------------------------------------

    @Transactional(readOnly = true)
    public AttachmentRecords.Content attachment(UUID id, UUID attachment) {
        facility(id, null);
        return attachments.content(KIND, id, attachment);
    }

    public AttachmentRecords.Attachment upload(UUID id, byte[] bytes, String caption) {
        facility(id, "canManageFacilities");
        return attachments.add(
            KIND,
            id,
            roster.hamlet(),
            bytes,
            caption,
            AttachmentRecords.PHOTO,
            true,
            MAX_ATTACHMENTS,
            true,
            "facility:" + id
        );
    }

    public List<AttachmentRecords.Attachment> makePrimary(UUID id, UUID attachment) {
        facility(id, "canManageFacilities");
        return attachments.makePrimary(KIND, id, attachment);
    }

    public void deleteAttachment(UUID id, UUID attachment) {
        facility(id, "canManageFacilities");
        attachments.delete(KIND, id, attachment, "facility:" + id);
    }

    @Transactional(readOnly = true)
    public List<AttachmentRecords.Attachment> attachments(UUID id) {
        facility(id, null);
        return attachments.list(KIND, id);
    }

    // ---- helpers ------------------------------------------------------------------------------------------------

    private static String s(Map<String, ?> d, String key) {
        return Objects.toString(d.get(key), "").strip();
    }

    static String text(Map<String, ?> d, String key, int max) {
        String value = s(d, key);
        if (value.length() > max) throw bad("Quá dài (tối đa " + max + " ký tự): " + key);
        return value;
    }

    static LocalDate date(Map<String, ?> d, String key, String label) {
        String value = s(d, key);
        if (value.isEmpty()) return null;
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException e) {
            throw bad(label + " không hợp lệ");
        }
    }

    private static UUID uuid(String value) {
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException e) {
            throw bad("Mã hồ sơ không hợp lệ");
        }
    }

    private static int page(String value) {
        try {
            int page = Integer.parseInt(value);
            if (page < 0) throw bad("Trang không hợp lệ");
            return page;
        } catch (NumberFormatException e) {
            throw bad("Trang không hợp lệ");
        }
    }

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
