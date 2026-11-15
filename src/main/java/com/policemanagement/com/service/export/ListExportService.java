package com.policemanagement.com.service.export;

import com.policemanagement.com.service.facility.FacilityService;
import com.policemanagement.com.service.guidance.GuidanceDocumentService;
import com.policemanagement.com.service.rbac.RbacService;
import com.policemanagement.com.service.roster.RosterService;
import com.policemanagement.com.service.subject.SubjectService;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Printable and Excel lists by category (trích danh sách theo hệ loại để in, nộp): subjects under management by category,
 * establishments, and the guidance documents register. The rows come from the same queries and scope checks as the screens;
 * identity numbers stay masked. Subject and establishment lists need canExportReports; every list is written to the audit log.
 */
@Service
@Transactional
public class ListExportService {

    public static final List<String> KINDS = List.of("subjects", "facilities", "guidance");
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    static final Map<String, String> CATEGORY = Map.of(
        "AN",
        "An ninh",
        "CT",
        "Chính trị",
        "HS",
        "Hình sự",
        "MT",
        "Ma túy",
        "TNXH",
        "Tệ nạn xã hội",
        "NV",
        "Nghi vấn"
    );
    private static final Map<String, String> CATEGORY_TITLE = Map.of(
        "AN",
        "DANH SÁCH ĐỐI TƯỢNG HỆ AN NINH",
        "CT",
        "DANH SÁCH ĐỐI TƯỢNG HỆ CHÍNH TRỊ",
        "HS",
        "DANH SÁCH ĐỐI TƯỢNG HỆ HÌNH SỰ",
        "MT",
        "DANH SÁCH ĐỐI TƯỢNG HỆ MA TÚY",
        "TNXH",
        "DANH SÁCH ĐỐI TƯỢNG TỆ NẠN XÃ HỘI",
        "NV",
        "DANH SÁCH ĐỐI TƯỢNG CẦN THEO DÕI, NGHI VẤN"
    );
    static final Map<String, String> FACILITY_TYPE = Map.of(
        "BUSINESS",
        "Cơ sở kinh doanh",
        "BOARDING_HOUSE",
        "Nhà trọ / cơ sở lưu trú",
        "ENTERPRISE",
        "Doanh nghiệp",
        "RELIGIOUS",
        "Cơ sở tôn giáo, tín ngưỡng"
    );
    private static final Map<String, String> LICENSE = Map.of(
        "BUSINESS_REGISTRATION",
        "GCN đăng ký kinh doanh",
        "SECURITY_CONDITION",
        "GCN đủ điều kiện ANTT",
        "FIRE_SAFETY",
        "GCN / thẩm duyệt PCCC",
        "OTHER",
        "Giấy phép khác"
    );

    private final JdbcTemplate db;
    private final RbacService rbac;
    private final RosterService roster;
    private final SubjectService subjects;
    private final FacilityService facilities;
    private final GuidanceDocumentService guidance;

    public ListExportService(
        JdbcTemplate db,
        RbacService rbac,
        RosterService roster,
        SubjectService subjects,
        FacilityService facilities,
        GuidanceDocumentService guidance
    ) {
        this.db = db;
        this.rbac = rbac;
        this.roster = roster;
        this.subjects = subjects;
        this.facilities = facilities;
        this.guidance = guidance;
    }

    public record Workbook(String name, byte[] content) {}

    /** The list for the print view; {@code mode} is "print" or "xlsx" and goes to the audit log. */
    public ListSheet sheet(String kind, Map<String, String> filter, String mode) {
        var sheet = switch (kind) {
            case "subjects" -> {
                rbac.permission("canExportReports");
                yield subjects(filter);
            }
            case "facilities" -> {
                rbac.permission("canExportReports");
                yield facilities(filter);
            }
            case "guidance" -> guidance(filter);
            default -> throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không có loại danh sách này");
        };
        var details = new LinkedHashMap<String, Object>();
        details.put("mode", mode);
        details.put("rows", sheet.rows().size());
        details.put("filter", sheet.summary());
        rbac.audit("list-export", "list:" + kind, details);
        return sheet;
    }

    public Workbook xlsx(String kind, Map<String, String> filter) {
        var sheet = sheet(kind, filter, "xlsx");
        // Plain ASCII ("danh-sach-doi-tuong-he-hinh-su-20261115.xlsx") so every app the file is shared to keeps the name intact.
        String plain = java.text.Normalizer.normalize(
            sheet.title().replace("Đ", "D").replace("đ", "d"),
            java.text.Normalizer.Form.NFD
        ).replaceAll("\\p{M}", "");
        String name = plain.toLowerCase(java.util.Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        return new Workbook(
            name + "-" + LocalDate.now(ZONE).format(DateTimeFormatter.BASIC_ISO_DATE) + ".xlsx",
            ListSheetWorkbook.write(sheet)
        );
    }

    // ---- lists ----------------------------------------------------------------------------------------------------

    ListSheet subjects(Map<String, String> filter) {
        var rows = subjects.all(filter);
        String category = s(filter, "category");
        String status = filter.getOrDefault("status", "ACTIVE");
        var columns = List.of(
            col("stt", "STT", 6, true),
            col("name", "Họ và tên", 20, false),
            col("birth", "Ngày sinh", 15, true),
            col("gender", "Giới tính", 10, true),
            col("identity", "Số ĐDCN", 15, true),
            col("case", "Số HSCT", 11, true),
            col("address", "Địa chỉ", 24, false),
            col("category", "Hệ", 12, false),
            col("subgroup", "Diện / nhóm", 18, false),
            col("from", "Quản lý từ", 15, true),
            col("until", "Đến ngày", 15, true),
            col("lastSummon", "Gọi hỏi gần nhất", 15, true),
            col("nextSummon", "Hạn gọi hỏi", 15, true),
            col("records", "Tiền án / tiền sự / vi phạm", 12, true),
            col("notes", "Ghi chú", 22, false)
        );
        var counts = new LinkedHashMap<String, Integer>();
        var out = numbered(rows, row -> {
            counts.merge(CATEGORY.getOrDefault(str(row.get("category")), str(row.get("category"))), 1, Integer::sum);
            var notes = new ArrayList<String>();
            if (!str(row.get("suspicious_signs")).isEmpty()) notes.add("Biểu hiện: " + str(row.get("suspicious_signs")));
            if (!str(row.get("tb136_scope")).isEmpty()) notes.add("TB136: " + str(row.get("tb136_scope")));
            if ("ENDED".equals(row.get("status"))) notes.add("Đã kết thúc " + day(row.get("ended_on")));
            if (!str(row.get("notes")).isEmpty()) notes.add(str(row.get("notes")));
            if (Boolean.TRUE.equals(row.get("management_expired"))) notes.add("Hết hạn quản lý");
            else if (Boolean.TRUE.equals(row.get("management_due"))) notes.add("Sắp hết hạn quản lý");
            if (Boolean.TRUE.equals(row.get("summon_overdue"))) notes.add("Quá hạn gọi hỏi");
            return List.of(
                str(row.get("full_name")),
                birth(row),
                gender(row.get("gender")),
                str(row.get("identity_masked")),
                str(row.get("case_number")),
                str(row.get("address")),
                CATEGORY.getOrDefault(str(row.get("category")), str(row.get("category"))),
                str(row.get("subgroup")),
                day(row.get("managed_from")),
                day(row.get("managed_until")),
                day(row.get("last_summon")),
                "ACTIVE".equals(row.get("status")) ? day(row.get("next_summon_due")) : "",
                str(row.get("record_count")),
                String.join("; ", notes)
            );
        });
        var summary = new ArrayList<String>();
        summary.add(category.isEmpty() ? "Tất cả các hệ" : "Hệ " + CATEGORY.getOrDefault(category, category));
        summary.add(
            switch (status) {
                case "ENDED" -> "đã kết thúc quản lý";
                case "ALL" -> "cả đang và đã kết thúc quản lý";
                default -> "đang quản lý";
            }
        );
        if ("MANAGEMENT".equals(s(filter, "due"))) summary.add("hết / sắp hết hạn quản lý");
        if ("SUMMON".equals(s(filter, "due"))) summary.add("đến hạn gọi hỏi");
        if (!s(filter, "search").isEmpty()) summary.add("tìm \"" + s(filter, "search") + "\"");
        String byCategory =
            counts.size() > 1
                ? " (" +
                  String.join(
                      ", ",
                      counts
                          .entrySet()
                          .stream()
                          .map(e -> e.getKey() + " " + e.getValue())
                          .toList()
                  ) +
                  ")"
                : "";
        return sheet(
            "subjects",
            communeOfHamlet(),
            category.isEmpty() ? "DANH SÁCH ĐỐI TƯỢNG QUẢN LÝ" : CATEGORY_TITLE.getOrDefault(category, "DANH SÁCH ĐỐI TƯỢNG"),
            hamletName(),
            String.join(", ", summary),
            "Tổng số: " + rows.size() + " đối tượng" + byCategory,
            columns,
            out,
            rows.size() >= SubjectService.EXPORT_LIMIT
        );
    }

    ListSheet facilities(Map<String, String> filter) {
        var rows = facilities.all(filter);
        String group = s(filter, "group");
        var columns = List.of(
            col("stt", "STT", 6, true),
            col("name", "Tên cơ sở", 26, false),
            col("type", "Loại hình", 16, false),
            col("trade", "Ngành nghề", 20, false),
            col("address", "Địa chỉ", 30, false),
            col("owner", "Chủ / người đại diện", 20, false),
            col("phone", "Điện thoại", 13, true),
            col("license", "Loại giấy phép", 18, false),
            col("licenseNumber", "Số giấy phép", 14, true),
            col("expiry", "Hạn giấy phép", 15, true),
            col("employees", "Nhân viên", 9, true),
            col("violations", "Vi phạm", 8, true),
            col("notes", "Ghi chú", 22, false)
        );
        var out = numbered(rows, row -> {
            var notes = new ArrayList<String>();
            if (Boolean.TRUE.equals(row.get("is_conditional"))) notes.add("Ngành nghề có điều kiện về ANTT");
            if (Boolean.TRUE.equals(row.get("license_expired"))) notes.add("Giấy phép hết hạn");
            else if (Boolean.TRUE.equals(row.get("license_due"))) notes.add("Giấy phép sắp hết hạn");
            String expiry = row.get("license_expiry_on") != null ? day(row.get("license_expiry_on")) : str(row.get("license_expiry"));
            return List.of(
                str(row.get("business_name")),
                FACILITY_TYPE.getOrDefault(str(row.get("type")), str(row.get("type"))),
                str(row.get("business_category")),
                str(row.get("raw_address")),
                str(row.get("representative_name")),
                str(row.get("phone")),
                LICENSE.getOrDefault(str(row.get("license_type")), str(row.get("license_type"))),
                str(row.get("license_number")),
                expiry,
                str(row.get("employee_count")),
                str(row.get("violation_count")),
                String.join("; ", notes)
            );
        });
        var summary = new ArrayList<String>();
        summary.add(
            switch (group) {
                case "CONDITIONAL" -> "Cơ sở kinh doanh có điều kiện về ANTT";
                case "OTHER" -> "Cơ sở, doanh nghiệp không thuộc ngành nghề có điều kiện";
                default -> "Tất cả cơ sở, doanh nghiệp";
            }
        );
        if (!s(filter, "type").isEmpty()) summary.add(FACILITY_TYPE.getOrDefault(s(filter, "type"), s(filter, "type")));
        if ("LICENSE".equals(s(filter, "due"))) summary.add("giấy phép hết / sắp hết hạn");
        if (!s(filter, "search").isEmpty()) summary.add("tìm \"" + s(filter, "search") + "\"");
        String title = switch (group) {
            case "CONDITIONAL" -> "DANH SÁCH CƠ SỞ KINH DOANH CÓ ĐIỀU KIỆN VỀ AN NINH, TRẬT TỰ";
            case "OTHER" -> "DANH SÁCH CƠ SỞ, DOANH NGHIỆP TRÊN ĐỊA BÀN";
            default -> "DANH SÁCH CƠ SỞ KINH DOANH, DOANH NGHIỆP";
        };
        return sheet(
            "facilities",
            communeOfHamlet(),
            title,
            hamletName(),
            String.join(", ", summary),
            "Tổng số: " + rows.size() + " cơ sở",
            columns,
            out,
            rows.size() >= FacilityService.EXPORT_LIMIT
        );
    }

    ListSheet guidance(Map<String, String> filter) {
        var rows = guidance.all(filter);
        var columns = List.of(
            col("stt", "STT", 6, true),
            col("number", "Số, ký hiệu", 16, true),
            col("authority", "Cơ quan ban hành", 24, false),
            col("issued", "Ngày ban hành", 15, true),
            col("title", "Trích yếu", 44, false),
            col("received", "Ngày nhận", 15, true),
            col("field", "Lĩnh vực", 16, false),
            col("files", "Bản quét", 9, true),
            col("notes", "Ghi chú", 24, false)
        );
        var out = numbered(rows, row ->
            List.of(
                str(row.get("doc_number")),
                str(row.get("issuing_authority")),
                day(row.get("issued_on")),
                str(row.get("title")),
                day(row.get("received_on")),
                str(row.get("field")),
                str(row.get("file_count")),
                str(row.get("notes"))
            )
        );
        var summary = new ArrayList<String>();
        summary.add(s(filter, "year").isEmpty() ? "Mọi năm ban hành" : "Ban hành năm " + s(filter, "year"));
        if (!s(filter, "authority").isEmpty()) summary.add(s(filter, "authority"));
        if (!s(filter, "search").isEmpty()) summary.add("tìm \"" + s(filter, "search") + "\"");
        var communes = db.queryForList(
            "select coalesce(full_name, 'Xã ' || name) from public.admin_commune order by id limit 1",
            String.class
        );
        String commune = communes.isEmpty() ? "" : communes.getFirst();
        return sheet(
            "guidance",
            commune,
            "SỔ THEO DÕI VĂN BẢN HƯỚNG DẪN NGHIỆP VỤ CẢNH SÁT KHU VỰC",
            commune.isEmpty() ? "Toàn xã" : commune,
            String.join(", ", summary),
            "Tổng số: " + rows.size() + " văn bản",
            columns,
            out,
            false
        );
    }

    // ---- helpers --------------------------------------------------------------------------------------------------

    private ListSheet sheet(
        String kind,
        String commune,
        String title,
        String scope,
        String summary,
        String total,
        List<ListSheet.Column> columns,
        List<List<String>> rows,
        boolean truncated
    ) {
        return new ListSheet(
            kind,
            commune,
            title,
            scope,
            summary,
            total + (truncated ? " (chỉ in " + rows.size() + " dòng đầu; thu hẹp bộ lọc để in đủ)" : ""),
            columns,
            rows,
            truncated,
            str(rbac.current().getOrDefault("fullName", "")),
            LocalDateTime.now(ZONE).format(DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy"))
        );
    }

    private static ListSheet.Column col(String key, String header, int width, boolean center) {
        return new ListSheet.Column(key, header, width, center);
    }

    /** Prepends the STT column to each formatted row. */
    private static List<List<String>> numbered(List<Map<String, Object>> rows, Function<Map<String, Object>, List<String>> format) {
        var out = new ArrayList<List<String>>(rows.size());
        int n = 1;
        for (var row : rows) {
            var values = new ArrayList<String>();
            values.add(Integer.toString(n++));
            values.addAll(format.apply(row));
            out.add(values);
        }
        return out;
    }

    private String hamletName() {
        return db.queryForObject("select coalesce(full_name, name) from public.hamlet where id=?", String.class, roster.hamlet());
    }

    private String communeOfHamlet() {
        var names = db.queryForList(
            "select coalesce(c.full_name, 'Xã ' || c.name) from public.hamlet h join public.admin_commune c on c.id=h.commune_id where h.id=?",
            String.class,
            roster.hamlet()
        );
        return names.isEmpty() ? "" : names.getFirst();
    }

    static String day(Object value) {
        if (value == null) return "";
        if (value instanceof java.sql.Date d) return d.toLocalDate().format(DAY);
        if (value instanceof LocalDate d) return d.format(DAY);
        String text = value.toString();
        try {
            return LocalDate.parse(text.length() >= 10 ? text.substring(0, 10) : text).format(DAY);
        } catch (java.time.format.DateTimeParseException e) {
            return text;
        }
    }

    private static String birth(Map<String, Object> row) {
        if ("DAY".equals(row.get("birth_precision")) || "DAY".equals(row.get("birth_date_precision"))) {
            if (row.get("birth_date") != null) return day(row.get("birth_date"));
        }
        return row.get("birth_year") != null ? str(row.get("birth_year")) : day(row.get("birth_date"));
    }

    private static String gender(Object value) {
        return switch (str(value)) {
            case "MALE" -> "Nam";
            case "FEMALE" -> "Nữ";
            case "OTHER" -> "Khác";
            default -> "";
        };
    }

    private static String str(Object value) {
        return value == null ? "" : Objects.toString(value).strip();
    }

    private static String s(Map<String, String> filter, String key) {
        return Objects.toString(filter.get(key), "").strip();
    }
}
