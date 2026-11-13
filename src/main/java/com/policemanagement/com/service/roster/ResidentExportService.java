package com.policemanagement.com.service.roster;

import com.policemanagement.com.service.rbac.RbacService;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Filtered resident lists for download (Excel) and printing. Identity numbers are masked to their last three digits unless the
 * caller holds {@code canRevealIdentity} and asks for them; every export is audited with its filter codes and row count, never
 * with names or search text.
 */
@Service
@Transactional(readOnly = true)
public class ResidentExportService {

    static final int LIMIT = 20_000;
    static final int PREVIEW_ROWS = 20;
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    /** Exportable column: key, Vietnamese header and Excel width in characters. */
    public record Column(String key, String header, int width) {}

    static final List<Column> COLUMNS = List.of(
        new Column("stt", "STT", 7),
        new Column("fullName", "Họ và tên", 26),
        new Column("birth", "Ngày sinh", 14),
        new Column("gender", "Giới tính", 8),
        new Column("identity", "Số định danh", 16),
        new Column("kind", "Diện cư trú", 15),
        new Column("sourceStatus", "Tình trạng", 20),
        new Column("registrationDate", "Ngày đăng ký", 14),
        new Column("validTo", "Hiệu lực đến", 14),
        new Column("permanentAddress", "Địa chỉ thường trú", 36),
        new Column("temporaryAddress", "Địa chỉ tạm trú", 36),
        new Column("currentAddress", "Nơi ở hiện tại", 36),
        new Column("relationship", "Quan hệ với chủ hộ", 14),
        new Column("headName", "Chủ hộ", 24),
        new Column("householdCode", "Mã hộ", 16),
        new Column("householdAddress", "Địa chỉ hộ", 36),
        new Column("hamlet", "Ấp", 16),
        new Column("facility", "Loại hình cơ sở", 20),
        new Column("father", "Họ tên cha", 24),
        new Column("mother", "Họ tên mẹ", 24),
        new Column("classification", "Phân loại", 24),
        new Column("origin", "Nguồn", 12),
        new Column("note", "Ghi chú", 22)
    );

    static final List<String> DEFAULT_COLUMNS = List.of(
        "stt",
        "fullName",
        "birth",
        "gender",
        "identity",
        "kind",
        "sourceStatus",
        "registrationDate",
        "validTo",
        "permanentAddress",
        "currentAddress",
        "relationship",
        "headName"
    );

    private static final Map<String, String> KIND = Map.of(
        "PERMANENT",
        "Thường trú",
        "TEMPORARY",
        "Tạm trú",
        "NOHT",
        "Nơi ở hiện tại",
        "ARTICLE19",
        "Nguồn Đ19"
    );
    private static final Map<String, String> FACILITY = Map.of(
        "RESIDENTIAL",
        "Hộ gia đình",
        "BUSINESS",
        "Cơ sở kinh doanh",
        "BOARDING_HOUSE",
        "Nhà trọ / lưu trú",
        "RELIGIOUS",
        "Tôn giáo, tín ngưỡng",
        "SPECIAL",
        "Giám sát đặc biệt"
    );

    /** Count of people per hamlet, gender and residence kind, for the summary sheet. */
    public record Tally(String hamlet, long total, long male, long female, Map<String, Long> kinds) {}

    /** A rendered list: every value already formatted as display text in column order. */
    public record Export(
        String commune,
        String scope,
        String summary,
        List<Column> columns,
        List<List<String>> rows,
        long total,
        long male,
        long female,
        Long unevaluable,
        List<Tally> byHamlet,
        boolean fullIdentity,
        boolean communeWide,
        String generatedBy,
        String generatedAt
    ) {}

    private final JdbcTemplate db;
    private final RosterService roster;
    private final RosterCrypto crypto;
    private final RbacService rbac;

    public ResidentExportService(JdbcTemplate db, RosterService roster, RosterCrypto crypto, RbacService rbac) {
        this.db = db;
        this.roster = roster;
        this.crypto = crypto;
        this.rbac = rbac;
    }

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    /** Column keys from the request, in catalogue order; STT always first. Empty means the default set. */
    static List<Column> columns(String requested) {
        var keys =
            requested == null || requested.isBlank()
                ? DEFAULT_COLUMNS
                : List.of(requested.split(","))
                      .stream()
                      .map(String::strip)
                      .filter(k -> !k.isEmpty())
                      .toList();
        if (keys.size() > COLUMNS.size()) throw bad("Danh sách cột không hợp lệ");
        for (String key : keys) if (COLUMNS.stream().noneMatch(c -> c.key().equals(key))) throw bad("Cột không hợp lệ: " + key);
        return COLUMNS.stream()
            .filter(c -> c.key().equals("stt") || keys.contains(c.key()))
            .toList();
    }

    /**
     * Hamlets the export covers: the request's hamlet, or for the commune chief and the super admin every hamlet they may open.
     * Each hamlet is checked against the caller's territory.
     */
    List<Long> hamlets(ResidentFilter filter) {
        roster.authorize("canExportReports");
        if (!filter.commune()) return List.of(roster.hamlet());
        if (!rbac.global() && !"admin".equals(rbac.current().get("role"))) throw new AccessDeniedException(
            "Chỉ trưởng công an xã hoặc Super Admin được xuất toàn xã"
        );
        List<Long> ids = rbac.global()
            ? db.queryForList("select id from public.hamlet order by sort_order nulls last, id", Long.class)
            : rbac.areas();
        if (ids.isEmpty()) throw new AccessDeniedException("Chưa được giao địa bàn");
        for (Long id : ids) rbac.area(id);
        return ids;
    }

    private String marks(int n) {
        return String.join(",", Collections.nCopies(n, "?"));
    }

    /** Counts per hamlet and gender, keyed by hamlet id. */
    private Map<Long, long[]> counts(ResidentFilter filter, List<Long> hamlets) {
        var where = filter.where(hamlets, crypto.lookup(filter.search()));
        var result = new LinkedHashMap<Long, long[]>();
        db.query(
            "select r.hamlet_id, r.gender, count(*) n from tc2_roster.resident r where " + where.text() + " group by 1,2",
            rs -> {
                long[] c = result.computeIfAbsent(rs.getLong(1), k -> new long[3]);
                long n = rs.getLong(3);
                c[0] += n;
                if ("MALE".equals(rs.getString(2))) c[1] += n;
                if ("FEMALE".equals(rs.getString(2))) c[2] += n;
            },
            where.args().toArray()
        );
        return result;
    }

    private Long unevaluable(ResidentFilter filter, List<Long> hamlets) {
        if (!filter.hasAge()) return null;
        var where = filter.withoutAge().where(hamlets, crypto.lookup(filter.search()));
        return db.queryForObject(
            "select count(*) from tc2_roster.resident r where " + where.text() + " and (" + RosterCampaign.UNEVALUABLE + ")",
            Long.class,
            where.args().toArray()
        );
    }

    private static String address(String role) {
        return (
            "(select a.raw_address from tc2_roster.residence_record_address l join tc2_roster.residence_address a on a.id=l.address_id " +
            "where l.record_id=rec.id and l.address_role='" +
            role +
            "' limit 1)"
        );
    }

    private String rowSql(ResidentFilter filter, ResidentFilter.Sql where, ResidentFilter.Sql record, boolean byHamlet, int limit) {
        return (
            "select r.hamlet_id, hm.name hamlet_name, r.full_name, r.birth_date, r.birth_year, r.birth_date_precision, r.gender," +
            " r.father_name, r.mother_name, r.origin, rec.record_kind, rec.source_status, rec.registration_date, rec.valid_to," +
            " rec.classification_raw, " +
            address("permanentAddress") +
            " permanent_address, " +
            address("temporaryAddress") +
            " temporary_address, " +
            address("currentAddress") +
            " current_address, m.household_id, m.head_flag, m.relationship_code, h.code household_code, h.raw_address household_address," +
            " h.type facility_type, coalesce(head.full_name, h.representative_name) head_name," +
            " (select i.number_ciphertext from tc2_roster.resident_identity i where i.resident_id=r.id and i.active" +
            "  order by i.verified desc, i.valid_from desc nulls last limit 1) identity_ciphertext" +
            " from tc2_roster.resident r join public.hamlet hm on hm.id=r.hamlet_id" +
            " left join lateral (select rr.* from tc2_roster.residence_record rr where rr.resident_id=r.id order by " +
            (filter.hasRecordCondition() ? record.text() + " desc, " : "") +
            "(rr.valid_to is null or rr.valid_to>=current_date) desc, rr.registration_date desc nulls last, rr.id limit 1) rec on true" +
            " left join lateral (select m.*, " +
            ResidentFilter.isHead("m", "r") +
            " head_flag from tc2_roster.household_membership m where m.resident_id=r.id and m.valid_to is null" +
            "  order by head_flag desc, m.valid_from desc nulls last, m.id limit 1) m on true" +
            " left join tc2_roster.household h on h.id=m.household_id" +
            " left join lateral (select hr.full_name from tc2_roster.household_membership hm2 join tc2_roster.resident hr on hr.id=hm2.resident_id" +
            "  where hm2.household_id=m.household_id and hm2.is_head and hm2.valid_to is null limit 1) head on true" +
            " where " +
            where.text() +
            " order by " +
            filter.orderBy(byHamlet) +
            " limit " +
            limit
        );
    }

    static String mask(String number) {
        if (number == null || number.isBlank()) return "";
        String digits = number.strip();
        if (digits.length() <= 3) return "***";
        return "*".repeat(digits.length() - 3) + digits.substring(digits.length() - 3);
    }

    private static String date(java.sql.Date value) {
        return value == null ? "" : value.toLocalDate().format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
    }

    private String identity(String ciphertext, boolean full) {
        if (ciphertext == null) return "";
        String number = crypto.decrypt(ciphertext);
        return full ? number : mask(number);
    }

    private static String nz(String value) {
        return value == null ? "" : value;
    }

    /** Raw values kept per row for the summary sheet. */
    private record Raw(String hamlet, String gender, String kind) {}

    private List<List<String>> rows(
        ResidentFilter filter,
        List<Long> hamlets,
        List<Column> columns,
        boolean full,
        int limit,
        List<Raw> raw
    ) {
        var where = filter.where(hamlets, crypto.lookup(filter.search()));
        var record = filter.record("rr");
        var args = new ArrayList<Object>(record.args());
        args.addAll(where.args());
        boolean wantsIdentity = columns.stream().anyMatch(c -> c.key().equals("identity"));
        var rows = new ArrayList<List<String>>();
        db.query(
            rowSql(filter, where, record, hamlets.size() > 1, limit),
            rs -> {
                var values = new ArrayList<String>(columns.size());
                for (Column column : columns) {
                    values.add(
                        switch (column.key()) {
                            case "stt" -> Integer.toString(rows.size() + 1);
                            case "fullName" -> nz(rs.getString("full_name"));
                            case "birth" -> "DAY".equals(rs.getString("birth_date_precision")) && rs.getDate("birth_date") != null
                                ? date(rs.getDate("birth_date"))
                                : rs.getObject("birth_year") != null
                                  ? Integer.toString(rs.getInt("birth_year"))
                                  : rs.getDate("birth_date") != null
                                    ? Integer.toString(rs.getDate("birth_date").toLocalDate().getYear())
                                    : "";
                            case "gender" -> "MALE".equals(rs.getString("gender"))
                                ? "Nam"
                                : "FEMALE".equals(rs.getString("gender"))
                                  ? "Nữ"
                                  : nz(rs.getString("gender"));
                            case "identity" -> wantsIdentity ? identity(rs.getString("identity_ciphertext"), full) : "";
                            case "kind" -> KIND.getOrDefault(nz(rs.getString("record_kind")), nz(rs.getString("record_kind")));
                            case "sourceStatus" -> nz(rs.getString("source_status"));
                            case "registrationDate" -> date(rs.getDate("registration_date"));
                            case "validTo" -> date(rs.getDate("valid_to"));
                            case "permanentAddress" -> nz(rs.getString("permanent_address"));
                            case "temporaryAddress" -> nz(rs.getString("temporary_address"));
                            case "currentAddress" -> nz(rs.getString("current_address"));
                            case "relationship" -> rs.getObject("household_id") == null
                                ? ""
                                : rs.getBoolean("head_flag")
                                  ? "Chủ hộ"
                                  : rs.getString("relationship_code") == null || rs.getString("relationship_code").isBlank()
                                    ? "Thành viên"
                                    : rs.getString("relationship_code");
                            case "headName" -> nz(rs.getString("head_name"));
                            case "householdCode" -> nz(rs.getString("household_code"));
                            case "householdAddress" -> nz(rs.getString("household_address"));
                            case "hamlet" -> nz(rs.getString("hamlet_name"));
                            case "facility" -> FACILITY.getOrDefault(nz(rs.getString("facility_type")), nz(rs.getString("facility_type")));
                            case "father" -> nz(rs.getString("father_name"));
                            case "mother" -> nz(rs.getString("mother_name"));
                            case "classification" -> nz(rs.getString("classification_raw"));
                            case "origin" -> "EXCEL".equals(rs.getString("origin")) ? "Excel gốc" : "Nhập trực tiếp";
                            default -> "";
                        }
                    );
                }
                rows.add(values);
                if (raw != null) raw.add(new Raw(rs.getString("hamlet_name"), rs.getString("gender"), rs.getString("record_kind")));
            },
            args.toArray()
        );
        return rows;
    }

    private String commune(List<Long> hamlets) {
        var names = db.queryForList(
            "select coalesce(c.full_name, 'Xã ' || c.name) from public.hamlet h join public.admin_commune c on c.id=h.commune_id where h.id=?",
            String.class,
            hamlets.getFirst()
        );
        return names.isEmpty() ? "" : names.getFirst();
    }

    private String scope(ResidentFilter filter, List<Long> hamlets, String commune) {
        if (filter.commune()) {
            String name = commune.isEmpty() ? "xã" : Character.toLowerCase(commune.charAt(0)) + commune.substring(1);
            return "Toàn " + name + " (" + hamlets.size() + " ấp)";
        }
        return db.queryForObject("select coalesce(full_name, name) from public.hamlet where id=?", String.class, hamlets.getFirst());
    }

    private String hamletName(long id) {
        return db.queryForObject("select name from public.hamlet where id=?", String.class, id);
    }

    private Export build(ResidentFilter filter, String requestedColumns, boolean full, boolean preview, String format) {
        var columns = columns(requestedColumns);
        if (full) {
            if (columns.stream().noneMatch(c -> c.key().equals("identity"))) full = false;
            else rbac.permission("canRevealIdentity");
        }
        var hamlets = hamlets(filter);
        var counts = counts(filter, hamlets);
        long total = counts
            .values()
            .stream()
            .mapToLong(c -> c[0])
            .sum();
        long male = counts
            .values()
            .stream()
            .mapToLong(c -> c[1])
            .sum();
        long female = counts
            .values()
            .stream()
            .mapToLong(c -> c[2])
            .sum();
        if (!preview && total > LIMIT) throw bad(
            "Danh sách có " + total + " người, vượt giới hạn " + LIMIT + " người mỗi lần xuất; hãy thu hẹp bộ lọc"
        );
        var raw = preview ? null : new ArrayList<Raw>();
        var rows = rows(filter, hamlets, columns, full && !preview, preview ? PREVIEW_ROWS : LIMIT, raw);
        String commune = commune(hamlets);
        var tallies = new ArrayList<Tally>();
        if (raw == null) {
            for (var entry : counts.entrySet())
                tallies.add(new Tally(hamletName(entry.getKey()), entry.getValue()[0], entry.getValue()[1], entry.getValue()[2], Map.of()));
        } else {
            var byHamlet = new LinkedHashMap<String, long[]>();
            var kinds = new LinkedHashMap<String, Map<String, Long>>();
            for (Raw r : raw) {
                long[] c = byHamlet.computeIfAbsent(r.hamlet(), k -> new long[3]);
                c[0]++;
                if ("MALE".equals(r.gender())) c[1]++;
                if ("FEMALE".equals(r.gender())) c[2]++;
                kinds
                    .computeIfAbsent(r.hamlet(), k -> new LinkedHashMap<>())
                    .merge(r.kind() == null ? "" : KIND.getOrDefault(r.kind(), r.kind()), 1L, Long::sum);
            }
            for (var entry : byHamlet.entrySet())
                tallies.add(
                    new Tally(entry.getKey(), entry.getValue()[0], entry.getValue()[1], entry.getValue()[2], kinds.get(entry.getKey()))
                );
        }
        boolean disclosed = full && !preview;
        if (!preview) {
            String target = "roster-hamlets:" + String.join(",", hamlets.stream().map(String::valueOf).toList());
            var details = new LinkedHashMap<String, Object>(filter.auditDetails());
            details.put("format", format);
            details.put("rows", rows.size());
            details.put("columns", columns.stream().map(Column::key).toList());
            details.put("fullIdentity", disclosed);
            rbac.auditIndependent("resident-list-exported", target, details);
            if (disclosed) rbac.auditIndependent(
                "identity-revealed",
                target,
                Map.of("documentType", "bulk-export", "format", format, "rows", rows.size())
            );
        }
        return new Export(
            commune,
            scope(filter, hamlets, commune),
            filter.summary(),
            columns,
            rows,
            total,
            male,
            female,
            unevaluable(filter, hamlets),
            tallies,
            disclosed,
            filter.commune(),
            String.valueOf(rbac.current().getOrDefault("fullName", "")),
            LocalDateTime.now(ZONE).format(DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy"))
        );
    }

    /** Count and the first rows (identity always masked); not audited because nothing leaves as a list. */
    public Export preview(ResidentFilter filter, String columns) {
        return build(filter, columns, false, true, "preview");
    }

    /** Every matching row for the print view. */
    public Export print(ResidentFilter filter, String columns, boolean fullIdentity) {
        return build(filter, columns, fullIdentity, false, "print");
    }

    /** Download name and content of an Excel export. */
    public record Workbook(String name, byte[] content) {}

    /** Every matching row as an Excel workbook. */
    public Workbook xlsx(ResidentFilter filter, String columns, boolean fullIdentity) {
        return xlsx(filter, columns, fullIdentity, false);
    }

    /**
     * Every matching row as an Excel workbook; {@code shared} marks a file handed to the device's share sheet (Zalo, mail…),
     * so the audit trail tells a download from a list sent on to another app.
     */
    public Workbook xlsx(ResidentFilter filter, String columns, boolean fullIdentity, boolean shared) {
        var export = build(filter, columns, fullIdentity, false, shared ? "xlsx-share" : "xlsx");
        return new Workbook(fileName(export, LocalDate.now(ZONE)), ResidentExportWorkbook.write(export));
    }

    /**
     * What the export form needs: the column catalogue, the default columns, the classifications recorded in the caller's
     * hamlet, and whether the caller may export the whole commune or full identity numbers.
     */
    public Map<String, Object> options() {
        roster.authorize("canExportReports");
        var result = new LinkedHashMap<String, Object>();
        result.put("columns", COLUMNS);
        result.put("defaultColumns", DEFAULT_COLUMNS);
        result.put(
            "classifications",
            db.queryForList(
                "select distinct classification_raw from tc2_roster.residence_record where hamlet_id=? and classification_raw is not null and classification_raw<>'' order by 1 limit 50",
                String.class,
                roster.hamlet()
            )
        );
        result.put("canExportCommune", rbac.global() || "admin".equals(rbac.current().get("role")));
        var granted = rbac.current().get("subAdminPermissions") instanceof Map<?, ?> map ? map : Map.of();
        result.put("canRevealIdentity", rbac.global() || Boolean.TRUE.equals(granted.get("canRevealIdentity")));
        result.put("limit", LIMIT);
        return result;
    }

    static String fileName(Export export, LocalDate day) {
        String scope = export.communeWide()
            ? "toan-xa"
            : java.text.Normalizer.normalize(export.scope(), java.text.Normalizer.Form.NFD)
                  .replaceAll("\\p{M}", "")
                  .replace('đ', 'd')
                  .replace('Đ', 'D')
                  .toLowerCase()
                  .replaceAll("[^a-z0-9]+", "-")
                  .replaceAll("(^-|-$)", "");
        return "danh-sach-nhan-khau-" + scope + "-" + day.format(DateTimeFormatter.BASIC_ISO_DATE) + ".xlsx";
    }
}
