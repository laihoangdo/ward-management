package com.policemanagement.com.service.subject;

import com.policemanagement.com.service.CccdProtection;
import com.policemanagement.com.service.rbac.RbacService;
import com.policemanagement.com.service.roster.RosterCrypto;
import com.policemanagement.com.service.roster.RosterService;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Subjects under management (đối tượng) of the current hamlet.
 *
 * <p>Categories follow the officers' list: AN an ninh, CT chính trị, HS hình sự, MT ma túy, TNXH tệ nạn xã hội, NV nghi vấn /
 * cần theo dõi (TB136). Personal data, photos and addresses are read from the resident record. Viewing needs canViewSubjects
 * (or canManageSubjects); writing needs canManageSubjects; the political category additionally needs canViewPoliticalSubjects
 * and is left out of every list and count without it. Every detail read and every change is written to rbac_audit.
 */
@Service
@Transactional
public class SubjectService {

    public static final List<String> CATEGORIES = List.of("AN", "CT", "HS", "MT", "TNXH", "NV");
    /** Categories whose officers' list has no criminal record section: only violations are recorded. */
    static final Set<String> VIOLATIONS_ONLY = Set.of("AN", "NV");
    static final Set<String> RECORD_KINDS = Set.of("TIEN_AN", "TIEN_SU", "VI_PHAM");
    /** Days before the end of the management period that it is flagged as due. */
    public static final int MANAGEMENT_WARNING_DAYS = 30;
    /** Days before the next warning interview that it is flagged as due. */
    public static final int SUMMON_WARNING_DAYS = 7;
    static final int PAGE_SIZE = 30;

    /** Next interview: last interview (or the management start) plus the interval, as SQL over alias {@code s}. */
    static final String NEXT_SUMMON =
        "(coalesce((select max(ss.summoned_on) from subject_summon ss where ss.subject_id=s.id), s.managed_from)" +
        " + make_interval(months => s.summon_interval_months::int))::date";

    private final JdbcTemplate db;
    private final RosterService roster;
    private final RosterCrypto crypto;
    private final RbacService rbac;

    public SubjectService(JdbcTemplate db, RosterService roster, RosterCrypto crypto, RbacService rbac) {
        this.db = db;
        this.roster = roster;
        this.crypto = crypto;
        this.rbac = rbac;
    }

    // ---- access -------------------------------------------------------------------------------------------------

    private boolean has(String permission) {
        if (rbac.global()) return true;
        try {
            rbac.permission(permission);
            return true;
        } catch (AccessDeniedException e) {
            return false;
        }
    }

    /** Hamlet scope plus the view permission; returns whether political subjects are visible. */
    boolean authorizeView() {
        roster.authorize(null);
        if (!has("canViewSubjects") && !has("canManageSubjects")) throw new AccessDeniedException("Chưa được cấp quyền: canViewSubjects");
        return has("canViewPoliticalSubjects");
    }

    private boolean authorizeManage() {
        roster.authorize("canManageSubjects");
        return has("canViewPoliticalSubjects");
    }

    private static void requireCategory(String category, boolean political) {
        if (!CATEGORIES.contains(category)) throw bad("Hệ đối tượng không hợp lệ");
        if ("CT".equals(category) && !political) throw new AccessDeniedException("Chưa được cấp quyền: canViewPoliticalSubjects");
    }

    /** The subject row in the current hamlet; political subjects look absent without the permission. */
    private Map<String, Object> subject(UUID id, boolean political) {
        var rows = roster.allHamlets()
            ? db.queryForList("select * from subject where id=?", id)
            : db.queryForList("select * from subject where id=? and hamlet_id=?", id, roster.hamlet());
        // All-hamlets view: the subject's own hamlet must be in the caller's view; later writes then use it.
        if (!rows.isEmpty()) roster.pinHamlet(((Number) rows.getFirst().get("hamlet_id")).longValue());
        if (rows.isEmpty() || ("CT".equals(rows.getFirst().get("category")) && !political)) throw new ResponseStatusException(
            HttpStatus.NOT_FOUND,
            "Không tìm thấy đối tượng trong địa bàn"
        );
        return rows.getFirst();
    }

    // ---- queries ------------------------------------------------------------------------------------------------

    /** Resident summary columns shared by list and detail; alias {@code r} is tc2_roster.resident. */
    private static final String PERSON =
        "r.full_name, r.birth_date, r.birth_year, r.birth_date_precision, r.gender, r.occupation," +
        " (select x.name from public.hamlet x where x.id=r.hamlet_id) hamlet_name," +
        " (select i.number_ciphertext from tc2_roster.resident_identity i where i.resident_id=r.id and i.active" +
        "  order by i.verified desc, i.valid_from desc nulls last limit 1) identity_ciphertext," +
        " (select h.raw_address from tc2_roster.household_membership m join tc2_roster.household h on h.id=m.household_id" +
        "  where m.resident_id=r.id and m.valid_to is null order by m.is_head desc, m.valid_from desc nulls last, m.id limit 1) address," +
        " (select h.source_case_number from tc2_roster.household_membership m join tc2_roster.household h on h.id=m.household_id" +
        "  where m.resident_id=r.id and m.valid_to is null order by m.is_head desc, m.valid_from desc nulls last, m.id limit 1) case_number";

    private static final String DUE =
        NEXT_SUMMON +
        " next_summon_due, (select max(ss.summoned_on) from subject_summon ss where ss.subject_id=s.id) last_summon," +
        " (select count(*) from subject_record sr where sr.subject_id=s.id) record_count";

    private void person(Map<String, Object> row) {
        Object cipher = row.remove("identity_ciphertext");
        row.put("identity_masked", cipher == null ? null : CccdProtection.mask(crypto.decrypt(cipher.toString())));
    }

    /** Adds the due flags the list and detail show (computed in Java so they are tested without a database). */
    static void flags(Map<String, Object> row, LocalDate today) {
        LocalDate until = date(row.get("managed_until"));
        LocalDate next = date(row.get("next_summon_due"));
        boolean active = "ACTIVE".equals(row.get("status"));
        row.put("management_expired", active && until != null && until.isBefore(today));
        row.put(
            "management_due",
            active && until != null && !until.isBefore(today) && !until.isAfter(today.plusDays(MANAGEMENT_WARNING_DAYS))
        );
        row.put("summon_overdue", active && next != null && next.isBefore(today));
        row.put("summon_due", active && next != null && !next.isBefore(today) && !next.isAfter(today.plusDays(SUMMON_WARNING_DAYS)));
    }

    private static LocalDate date(Object value) {
        if (value == null) return null;
        if (value instanceof java.sql.Date d) return d.toLocalDate();
        if (value instanceof LocalDate d) return d;
        return LocalDate.parse(value.toString());
    }

    /** Filter for list and summary: hamlet, visible categories, optional category/status/due/search/resident. */
    private record Where(String text, List<Object> args) {}

    private Where where(Map<String, String> filter, boolean political) {
        var text = new StringBuilder("s.hamlet_id=any(?::bigint[])");
        var args = new ArrayList<Object>(List.of(RosterService.idArray(roster.scopeHamlets())));
        if (!political) text.append(" and s.category<>'CT'");
        String category = filter.getOrDefault("category", "");
        if (!category.isBlank()) {
            requireCategory(category, political);
            text.append(" and s.category=?");
            args.add(category);
        }
        String status = filter.getOrDefault("status", "ACTIVE");
        if (!status.equals("ALL")) {
            if (!Set.of("ACTIVE", "ENDED").contains(status)) throw bad("Trạng thái không hợp lệ");
            text.append(" and s.status=?");
            args.add(status);
        }
        String due = filter.getOrDefault("due", "");
        if (!due.isBlank()) {
            LocalDate today = LocalDate.now();
            switch (due) {
                case "MANAGEMENT" -> {
                    text.append(" and s.status='ACTIVE' and s.managed_until<=?");
                    args.add(today.plusDays(MANAGEMENT_WARNING_DAYS));
                }
                case "SUMMON" -> {
                    text.append(" and s.status='ACTIVE' and ").append(NEXT_SUMMON).append("<=?");
                    args.add(today.plusDays(SUMMON_WARNING_DAYS));
                }
                default -> throw bad("Bộ lọc đến hạn không hợp lệ");
            }
        }
        String resident = filter.getOrDefault("residentId", "");
        if (!resident.isBlank()) {
            text.append(" and s.resident_id=?");
            args.add(uuid(resident));
        }
        String search = filter.getOrDefault("search", "").strip();
        if (!search.isEmpty()) {
            if (search.length() > 100) throw bad("Từ khóa tối đa 100 ký tự");
            text.append(
                " and (position(lower(?) in lower(r.full_name))>0 or exists(select 1 from tc2_roster.resident_identity i" +
                    " where i.resident_id=r.id and i.active and i.number_lookup=?))"
            );
            args.add(search);
            args.add(crypto.lookup(search));
        }
        return new Where(text.toString(), args);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> list(Map<String, String> filter) {
        boolean political = authorizeView();
        int page = parsePage(filter.getOrDefault("page", "0"));
        var where = where(filter, political);
        long total = db.queryForObject("select count(*)" + from(where), Long.class, where.args().toArray());
        var items = rows(where, PAGE_SIZE, (long) page * PAGE_SIZE);
        return new LinkedHashMap<>(Map.of("items", items, "total", total, "page", page, "pageSize", PAGE_SIZE));
    }

    /** Most rows a printed or exported list holds. */
    public static final int EXPORT_LIMIT = 5000;

    /** Every subject matching the filter (up to {@link #EXPORT_LIMIT}), in list order, for the printed list. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> all(Map<String, String> filter) {
        boolean political = authorizeView();
        var where = where(filter, political);
        var items = rows(where, EXPORT_LIMIT, 0);
        return items;
    }

    private static String from(Where where) {
        return " from subject s join tc2_roster.resident r on r.id=s.resident_id where " + where.text();
    }

    private List<Map<String, Object>> rows(Where where, int limit, long offset) {
        var args = new ArrayList<>(where.args());
        args.add(offset);
        var items = db.queryForList(
            "select s.id, s.resident_id, s.category, s.subgroup, s.managed_from, s.managed_until, s.summon_interval_months, s.status," +
                " s.ended_on, s.notes, s.suspicious_signs, s.tb136_scope, " +
                PERSON +
                ", " +
                DUE +
                from(where) +
                " order by s.status, r.full_name, s.id limit " +
                limit +
                " offset ?",
            args.toArray()
        );
        LocalDate today = LocalDate.now();
        for (var row : items) {
            person(row);
            flags(row, today);
        }
        return items;
    }

    /** Active subjects per category and due counts of the visible categories, for the tab header and the warning bell. */
    @Transactional(readOnly = true)
    public Map<String, Object> summary() {
        boolean political = authorizeView();
        String hamlet = RosterService.idArray(roster.scopeHamlets());
        String visible = political ? "" : " and s.category<>'CT'";
        var byCategory = new LinkedHashMap<String, Long>();
        for (String c : CATEGORIES) if (political || !c.equals("CT")) byCategory.put(c, 0L);
        db.query(
            "select s.category, count(*) from subject s where s.hamlet_id=any(?::bigint[]) and s.status='ACTIVE'" + visible + " group by 1",
            rs -> {
                byCategory.put(rs.getString(1), rs.getLong(2));
            },
            hamlet
        );
        LocalDate today = LocalDate.now();
        long managementDue = db.queryForObject(
            "select count(*) from subject s where s.hamlet_id=any(?::bigint[]) and s.status='ACTIVE' and s.managed_until<=?" + visible,
            Long.class,
            hamlet,
            today.plusDays(MANAGEMENT_WARNING_DAYS)
        );
        long summonDue = db.queryForObject(
            "select count(*) from subject s where s.hamlet_id=any(?::bigint[]) and s.status='ACTIVE' and " + NEXT_SUMMON + "<=?" + visible,
            Long.class,
            hamlet,
            today.plusDays(SUMMON_WARNING_DAYS)
        );
        var result = new LinkedHashMap<String, Object>();
        result.put("byCategory", byCategory);
        result.put("active", byCategory.values().stream().mapToLong(Long::longValue).sum());
        result.put("managementDue", managementDue);
        result.put("summonDue", summonDue);
        result.put("managementWarningDays", MANAGEMENT_WARNING_DAYS);
        result.put("summonWarningDays", SUMMON_WARNING_DAYS);
        result.put("canManage", has("canManageSubjects"));
        result.put("canViewPolitical", political);
        return result;
    }

    // Writable: opening a record is written to the audit log in the same transaction.
    @Transactional
    public Map<String, Object> detail(UUID id) {
        boolean political = authorizeView();
        subject(id, political);
        var row = db.queryForMap(
            "select s.*, " + PERSON + ", " + DUE + " from subject s join tc2_roster.resident r on r.id=s.resident_id where s.id=?",
            id
        );
        person(row);
        flags(row, LocalDate.now());
        row.put(
            "records",
            db.queryForList("select * from subject_record where subject_id=? order by occurred_on desc nulls last, created_at desc", id)
        );
        row.put(
            "summons",
            db.queryForList("select * from subject_summon where subject_id=? order by summoned_on desc, created_at desc", id)
        );
        rbac.audit("read", "subject:" + id, Map.of("category", row.get("category")));
        return row;
    }

    // ---- writes -------------------------------------------------------------------------------------------------

    private String actor() {
        Object name = rbac.current().get("fullName");
        return name == null || name.toString().isBlank() ? rbac.subject() : name.toString();
    }

    public Map<String, Object> create(Map<String, Object> d) {
        boolean political = authorizeManage();
        String category = s(d, "category");
        requireCategory(category, political);
        UUID resident = uuid(s(d, "residentId"));
        long hamlet = roster.requireResident(resident, "canManageSubjects");
        var fields = fields(d, category);
        if (
            db.queryForObject(
                "select count(*) from subject where resident_id=? and category=? and status='ACTIVE'",
                Long.class,
                resident,
                category
            ) > 0
        ) throw new ResponseStatusException(HttpStatus.CONFLICT, "Nhân khẩu này đang trong diện quản lý của hệ đã chọn");
        UUID id = UUID.randomUUID();
        String actor = actor();
        db.update(
            "insert into subject(id,resident_id,hamlet_id,category,subgroup,managed_from,managed_until,summon_interval_months," +
                "suspicious_signs,tb136_scope,notes,created_by,updated_by) values (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            id,
            resident,
            hamlet,
            category,
            fields.subgroup(),
            fields.from(),
            fields.until(),
            fields.interval(),
            fields.signs(),
            fields.tb136(),
            fields.notes(),
            actor,
            actor
        );
        rbac.audit("subject-create", "subject:" + id, Map.of("category", category, "resident", resident.toString()));
        return detail(id);
    }

    public Map<String, Object> update(UUID id, Map<String, Object> d) {
        boolean political = authorizeManage();
        var current = subject(id, political);
        if (!"ACTIVE".equals(current.get("status"))) throw bad("Đối tượng đã kết thúc quản lý; không sửa được");
        String category = current.get("category").toString();
        var fields = fields(d, category);
        int changed = db.update(
            "update subject set subgroup=?,managed_from=?,managed_until=?,summon_interval_months=?,suspicious_signs=?,tb136_scope=?," +
                "notes=?,version=version+1,updated_at=now(),updated_by=? where id=? and version=?",
            fields.subgroup(),
            fields.from(),
            fields.until(),
            fields.interval(),
            fields.signs(),
            fields.tb136(),
            fields.notes(),
            actor(),
            id,
            version(d)
        );
        if (changed == 0) throw conflict();
        rbac.audit("subject-update", "subject:" + id, Map.of("category", category));
        return detail(id);
    }

    /** Ends the management period; the record and its history stay. */
    public Map<String, Object> end(UUID id, Map<String, Object> d) {
        boolean political = authorizeManage();
        var current = subject(id, political);
        if (!"ACTIVE".equals(current.get("status"))) throw bad("Đối tượng đã kết thúc quản lý");
        LocalDate ended = requiredDate(d, "endedOn", "Ngày kết thúc");
        if (ended.isAfter(LocalDate.now())) throw bad("Ngày kết thúc không được ở tương lai");
        if (ended.isBefore(date(current.get("managed_from")))) throw bad("Ngày kết thúc trước ngày đưa vào quản lý");
        String reason = text(d, "reason", 500);
        if (reason.isBlank()) throw bad("Nhập lý do kết thúc quản lý");
        int changed = db.update(
            "update subject set status='ENDED',ended_on=?,end_reason=?,version=version+1,updated_at=now(),updated_by=? where id=? and version=?",
            ended,
            reason,
            actor(),
            id,
            version(d)
        );
        if (changed == 0) throw conflict();
        rbac.audit("subject-end", "subject:" + id, Map.of("category", current.get("category")));
        return detail(id);
    }

    public Map<String, Object> addRecord(UUID id, Map<String, Object> d) {
        boolean political = authorizeManage();
        var current = subject(id, political);
        String kind = s(d, "kind");
        if (!RECORD_KINDS.contains(kind)) throw bad("Loại thông tin không hợp lệ");
        if (VIOLATIONS_ONLY.contains(current.get("category").toString()) && !kind.equals("VI_PHAM")) throw bad(
            "Hệ này chỉ ghi thông tin vi phạm, không ghi tiền án / tiền sự"
        );
        String offense = text(d, "offense", 1000);
        if (offense.isBlank()) throw bad("Nhập nội dung tội danh / hành vi vi phạm");
        LocalDate occurred = optionalDate(d, "occurredOn", "Ngày");
        if (occurred != null && occurred.isAfter(LocalDate.now())) throw bad("Ngày không được ở tương lai");
        UUID record = UUID.randomUUID();
        db.update(
            "insert into subject_record(id,subject_id,kind,occurred_on,decision_no,authority,offense,penalty,notes,created_by) values (?,?,?,?,?,?,?,?,?,?)",
            record,
            id,
            kind,
            occurred,
            text(d, "decisionNo", 100),
            text(d, "authority", 200),
            offense,
            text(d, "penalty", 1000),
            text(d, "notes", 2000),
            actor()
        );
        rbac.audit("subject-record", "subject:" + id, Map.of("kind", kind, "record", record.toString()));
        return detail(id);
    }

    public Map<String, Object> addSummon(UUID id, Map<String, Object> d) {
        boolean political = authorizeManage();
        var current = subject(id, political);
        if (!"ACTIVE".equals(current.get("status"))) throw bad("Đối tượng đã kết thúc quản lý");
        LocalDate on = requiredDate(d, "summonedOn", "Ngày gọi hỏi");
        if (on.isAfter(LocalDate.now())) throw bad("Ngày gọi hỏi không được ở tương lai");
        String content = text(d, "content", 2000);
        if (content.isBlank()) throw bad("Nhập nội dung gọi hỏi, răn đe");
        String officer = text(d, "officer", 255);
        UUID summon = UUID.randomUUID();
        db.update(
            "insert into subject_summon(id,subject_id,summoned_on,officer,content,result,created_by) values (?,?,?,?,?,?,?)",
            summon,
            id,
            on,
            officer.isBlank() ? actor() : officer,
            content,
            text(d, "result", 2000),
            actor()
        );
        rbac.audit("subject-summon", "subject:" + id, Map.of("summon", summon.toString()));
        return detail(id);
    }

    // ---- validation helpers -------------------------------------------------------------------------------------

    record Fields(String subgroup, LocalDate from, LocalDate until, int interval, String signs, String tb136, String notes) {}

    static Fields fields(Map<String, Object> d, String category) {
        LocalDate from = requiredDate(d, "managedFrom", "Ngày đưa vào quản lý");
        if (from.isAfter(LocalDate.now())) throw bad("Ngày đưa vào quản lý không được ở tương lai");
        LocalDate until = optionalDate(d, "managedUntil", "Thời hạn quản lý");
        if (until != null && until.isBefore(from)) throw bad("Thời hạn quản lý phải sau ngày đưa vào quản lý");
        int interval;
        try {
            interval = s(d, "summonIntervalMonths").isBlank() ? 1 : Integer.parseInt(s(d, "summonIntervalMonths"));
        } catch (NumberFormatException e) {
            throw bad("Chu kỳ gọi hỏi phải là số tháng");
        }
        if (interval < 1 || interval > 12) throw bad("Chu kỳ gọi hỏi từ 1 đến 12 tháng");
        boolean suspect = "NV".equals(category);
        return new Fields(
            text(d, "subgroup", 200),
            from,
            until,
            interval,
            suspect ? text(d, "suspiciousSigns", 2000) : "",
            suspect ? text(d, "tb136Scope", 200) : "",
            text(d, "notes", 2000)
        );
    }

    private static String s(Map<String, ?> d, String key) {
        return Objects.toString(d.get(key), "").strip();
    }

    static String text(Map<String, ?> d, String key, int max) {
        String value = s(d, key);
        if (value.length() > max) throw bad("Quá dài (tối đa " + max + " ký tự): " + key);
        return value;
    }

    static LocalDate optionalDate(Map<String, ?> d, String key, String label) {
        String value = s(d, key);
        if (value.isEmpty()) return null;
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException e) {
            throw bad(label + " không hợp lệ");
        }
    }

    static LocalDate requiredDate(Map<String, ?> d, String key, String label) {
        LocalDate value = optionalDate(d, key, label);
        if (value == null) throw bad("Nhập " + label.toLowerCase());
        return value;
    }

    private static long version(Map<String, ?> d) {
        try {
            return Long.parseLong(s(d, "version"));
        } catch (NumberFormatException e) {
            throw bad("Thiếu phiên bản hồ sơ");
        }
    }

    private static UUID uuid(String value) {
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException e) {
            throw bad("Mã hồ sơ không hợp lệ");
        }
    }

    private static int parsePage(String value) {
        try {
            int page = Integer.parseInt(value);
            if (page < 0) throw bad("Trang không hợp lệ");
            return page;
        } catch (NumberFormatException e) {
            throw bad("Trang không hợp lệ");
        }
    }

    private static ResponseStatusException conflict() {
        return new ResponseStatusException(HttpStatus.CONFLICT, "Hồ sơ đã được người khác sửa; tải lại rồi thử lại");
    }

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
