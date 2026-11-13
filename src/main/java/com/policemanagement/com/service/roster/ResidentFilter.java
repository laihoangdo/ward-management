package com.policemanagement.com.service.roster;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * One resident filter shared by the roster list, the Excel export and the print view. Every code is checked against a fixed
 * list and every value is bound as a JDBC parameter, so no request text ever reaches the SQL text itself.
 */
public record ResidentFilter(
    boolean commune,
    String search,
    List<String> kinds,
    String origin,
    String campaign,
    String status,
    int expiringDays,
    LocalDate registeredFrom,
    LocalDate registeredTo,
    String gender,
    Integer ageMin,
    Integer ageMax,
    LocalDate refDate,
    Integer birthYearFrom,
    Integer birthYearTo,
    String identity,
    String householdRole,
    List<String> facilityTypes,
    String address,
    String classification,
    String verification,
    String sort
) {
    static final Set<String> KINDS = Set.of("PERMANENT", "TEMPORARY", "NOHT", "ARTICLE19");
    static final Set<String> FACILITY_TYPES = Set.of("RESIDENTIAL", "BUSINESS", "BOARDING_HOUSE", "RELIGIOUS", "SPECIAL");
    static final Set<String> SORTS = Set.of("HOUSEHOLD", "NAME", "ADDRESS", "BIRTH");
    private static final Pattern CODE = Pattern.compile("[A-Z_]{1,40}");

    /** SQL fragment plus its bound values, in order. */
    public record Sql(String text, List<Object> args) {}

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private static String text(Map<String, String> p, String key, int max) {
        String value = p.getOrDefault(key, "");
        value = value == null ? "" : value.strip();
        if (value.length() > max) throw bad("Bộ lọc không hợp lệ");
        return value;
    }

    private static String code(Map<String, String> p, String key, Set<String> allowed) {
        String value = text(p, key, 40);
        if (!value.isEmpty() && !allowed.contains(value)) throw bad("Bộ lọc không hợp lệ");
        return value;
    }

    private static List<String> codes(Map<String, String> p, String key, Set<String> allowed) {
        String value = text(p, key, 200);
        if (value.isEmpty()) return List.of();
        var result = new ArrayList<String>();
        for (String item : value.split(",")) {
            String code = item.strip();
            if (code.isEmpty()) continue;
            if (!allowed.contains(code)) throw bad("Bộ lọc không hợp lệ");
            if (!result.contains(code)) result.add(code);
        }
        return List.copyOf(result);
    }

    private static Integer number(Map<String, String> p, String key, int min, int max) {
        String value = text(p, key, 6);
        if (value.isEmpty()) return null;
        try {
            int n = Integer.parseInt(value);
            if (n < min || n > max) throw bad("Giá trị lọc ngoài khoảng cho phép");
            return n;
        } catch (NumberFormatException ex) {
            throw bad("Bộ lọc không hợp lệ");
        }
    }

    private static LocalDate date(Map<String, String> p, String key) {
        String value = text(p, key, 10);
        if (value.isEmpty()) return null;
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException ex) {
            throw bad("Ngày lọc không hợp lệ");
        }
    }

    /** Parses request parameters. The legacy single {@code kind} parameter is folded into {@code kinds}. */
    public static ResidentFilter parse(Map<String, String> p) {
        String scope = text(p, "scope", 10);
        if (!scope.isEmpty() && !scope.equals("hamlet") && !scope.equals("commune")) throw bad("Bộ lọc không hợp lệ");
        var kinds = new ArrayList<>(codes(p, "kinds", KINDS));
        String legacy = code(p, "kind", KINDS);
        if (!legacy.isEmpty() && !kinds.contains(legacy)) kinds.add(legacy);
        String campaign = text(p, "campaign", 40);
        if (!RosterCampaign.valid(campaign)) throw bad("Bộ lọc không hợp lệ");
        String expiring = text(p, "expiringDays", 3);
        if (!Set.of("", "0", "7", "15", "30").contains(expiring)) throw bad("Bộ lọc không hợp lệ");
        String verification = text(p, "verification", 40);
        if (!verification.isEmpty() && !CODE.matcher(verification).matches()) throw bad("Bộ lọc không hợp lệ");
        var filter = new ResidentFilter(
            scope.equals("commune"),
            text(p, "search", 200),
            List.copyOf(kinds),
            code(p, "origin", Set.of("EXCEL", "MANUAL")),
            campaign,
            code(p, "status", Set.of("ACTIVE", "ENDED")),
            expiring.isEmpty() ? 0 : Integer.parseInt(expiring),
            date(p, "registeredFrom"),
            date(p, "registeredTo"),
            code(p, "gender", Set.of("MALE", "FEMALE")),
            number(p, "ageMin", 0, 130),
            number(p, "ageMax", 0, 130),
            date(p, "refDate"),
            number(p, "birthYearFrom", 1880, 2200),
            number(p, "birthYearTo", 1880, 2200),
            code(p, "identity", Set.of("HAS", "NONE")),
            code(p, "householdRole", Set.of("HEAD", "MEMBER", "NONE")),
            codes(p, "facilityTypes", FACILITY_TYPES),
            text(p, "address", 120),
            text(p, "classification", 200),
            verification,
            code(p, "sort", SORTS)
        );
        if (filter.ageMin != null && filter.ageMax != null && filter.ageMin > filter.ageMax) throw bad("Tuổi từ phải nhỏ hơn tuổi đến");
        if (filter.birthYearFrom != null && filter.birthYearTo != null && filter.birthYearFrom > filter.birthYearTo) throw bad(
            "Năm sinh từ phải nhỏ hơn năm sinh đến"
        );
        if (filter.registeredFrom != null && filter.registeredTo != null && filter.registeredFrom.isAfter(filter.registeredTo)) throw bad(
            "Khoảng ngày đăng ký không hợp lệ"
        );
        return filter;
    }

    /** Filter for the legacy list parameters only. */
    public static ResidentFilter legacy(String search, String kind, String origin, String campaign) {
        var p = new LinkedHashMap<String, String>();
        p.put("search", search);
        p.put("kind", kind);
        p.put("origin", origin);
        p.put("campaign", campaign);
        return parse(p);
    }

    boolean hasAge() {
        return ageMin != null || ageMax != null;
    }

    /** The same filter without the age band, used to count who could not be judged for it. */
    ResidentFilter withoutAge() {
        return new ResidentFilter(
            commune,
            search,
            kinds,
            origin,
            campaign,
            status,
            expiringDays,
            registeredFrom,
            registeredTo,
            gender,
            null,
            null,
            refDate,
            birthYearFrom,
            birthYearTo,
            identity,
            householdRole,
            facilityTypes,
            address,
            classification,
            verification,
            sort
        );
    }

    LocalDate reference() {
        return refDate == null ? LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh")) : refDate;
    }

    boolean hasRecordCondition() {
        return !kinds.isEmpty() || !status.isEmpty() || expiringDays > 0 || registeredFrom != null || registeredTo != null;
    }

    private static String marks(int n) {
        return String.join(",", java.util.Collections.nCopies(n, "?"));
    }

    /** Conditions a residence record of {@code rr} must meet; "true" when the filter says nothing about records. */
    Sql record(String rr) {
        var parts = new ArrayList<String>();
        var args = new ArrayList<Object>();
        if (!kinds.isEmpty()) {
            parts.add(rr + ".record_kind in (" + marks(kinds.size()) + ")");
            args.addAll(kinds);
        }
        if (status.equals("ACTIVE")) parts.add("(" + rr + ".valid_to is null or " + rr + ".valid_to>=current_date)");
        if (status.equals("ENDED")) parts.add(rr + ".valid_to<current_date");
        if (expiringDays > 0) {
            parts.add(rr + ".record_kind='TEMPORARY' and " + rr + ".valid_to between current_date and current_date+?");
            args.add(expiringDays);
        }
        if (registeredFrom != null) {
            parts.add(rr + ".registration_date>=?");
            args.add(registeredFrom);
        }
        if (registeredTo != null) {
            parts.add(rr + ".registration_date<=?");
            args.add(registeredTo);
        }
        return new Sql(parts.isEmpty() ? "true" : "(" + String.join(" and ", parts) + ")", args);
    }

    /**
     * Where clause over {@code tc2_roster.resident r} for the given hamlets. {@code lookup} is the keyed hash of the search
     * text, so an identity number can be matched without decrypting anything.
     */
    Sql where(List<Long> hamlets, String lookup) {
        if (hamlets.isEmpty()) throw new IllegalStateException("No hamlet in scope");
        var parts = new ArrayList<String>();
        var args = new ArrayList<Object>();
        parts.add("r.hamlet_id in (" + marks(hamlets.size()) + ")");
        args.addAll(hamlets);
        if (!origin.isEmpty()) {
            parts.add("r.origin=?");
            args.add(origin);
        }
        if (!search.isEmpty()) {
            parts.add(
                "(position(lower(?) in lower(r.full_name))>0 or exists(select 1 from tc2_roster.resident_identity i where i.resident_id=r.id and i.active and i.number_lookup=?))"
            );
            args.add(search);
            args.add(lookup);
        }
        if (hasRecordCondition()) {
            var record = record("rr");
            parts.add("exists(select 1 from tc2_roster.residence_record rr where rr.resident_id=r.id and " + record.text() + ")");
            args.addAll(record.args());
        }
        if (!gender.isEmpty()) {
            parts.add("r.gender=?");
            args.add(gender);
        }
        if (hasAge()) {
            String age = "date_part('year', age(?::date, r.birth_date))";
            parts.add("r.birth_date_precision='DAY' and r.birth_date is not null");
            if (ageMin != null) {
                parts.add(age + ">=?");
                args.add(reference());
                args.add(ageMin);
            }
            if (ageMax != null) {
                parts.add(age + "<=?");
                args.add(reference());
                args.add(ageMax);
            }
        }
        if (birthYearFrom != null || birthYearTo != null) {
            String year = "coalesce(r.birth_year, extract(year from r.birth_date)::integer)";
            if (birthYearFrom != null) {
                parts.add(year + ">=?");
                args.add(birthYearFrom);
            }
            if (birthYearTo != null) {
                parts.add(year + "<=?");
                args.add(birthYearTo);
            }
        }
        String hasIdentity = "exists(select 1 from tc2_roster.resident_identity i where i.resident_id=r.id and i.active)";
        if (identity.equals("HAS")) parts.add(hasIdentity);
        if (identity.equals("NONE")) parts.add("not " + hasIdentity);
        String membership = "tc2_roster.household_membership m where m.resident_id=r.id and m.valid_to is null";
        switch (householdRole) {
            case "HEAD" -> parts.add("exists(select 1 from " + membership + " and " + isHead("m", "r") + ")");
            case "MEMBER" -> parts.add(
                "exists(select 1 from " + membership + ") and not exists(select 1 from " + membership + " and " + isHead("m", "r") + ")"
            );
            case "NONE" -> parts.add("not exists(select 1 from " + membership + ")");
            default -> {
            }
        }
        if (!facilityTypes.isEmpty()) {
            parts.add(
                "exists(select 1 from " +
                    membership.replace(" where ", " join tc2_roster.household h on h.id=m.household_id where ") +
                    " and h.type in (" +
                    marks(facilityTypes.size()) +
                    "))"
            );
            args.addAll(facilityTypes);
        }
        if (!address.isEmpty()) {
            var path = RosterCampaign.addressPathRegex(address);
            String match = path.isPresent() ? " ~* ?" : "";
            String householdAddress =
                "exists(select 1 from " +
                membership.replace(" where ", " join tc2_roster.household h on h.id=m.household_id where ") +
                " and " +
                (path.isPresent()
                    ? "h.raw_address" + match
                    : "position(lower(?) in lower(coalesce(h.raw_address,'')||' '||coalesce(h.street,'')))>0") +
                ")";
            String recordAddress =
                "exists(select 1 from tc2_roster.residence_record rr2 join tc2_roster.residence_record_address l on l.record_id=rr2.id " +
                "join tc2_roster.residence_address a on a.id=l.address_id where rr2.resident_id=r.id and " +
                (path.isPresent() ? "a.raw_address" + match : "position(lower(?) in lower(a.raw_address))>0") +
                ")";
            parts.add("(" + householdAddress + " or " + recordAddress + ")");
            String value = path.orElse(address);
            args.add(value);
            args.add(value);
        }
        if (!classification.isEmpty()) {
            parts.add("exists(select 1 from tc2_roster.residence_record rr3 where rr3.resident_id=r.id and rr3.classification_raw=?)");
            args.add(classification);
        }
        if (!verification.isEmpty()) {
            parts.add("r.verification_status=?");
            args.add(verification);
        }
        RosterCampaign.predicate(campaign).ifPresent(predicate -> parts.add("(" + predicate + ")"));
        return new Sql(String.join(" and ", parts), args);
    }

    /**
     * Whether membership {@code m} of resident {@code r} is the household head. The imported rosters rarely flag a head, so
     * when nobody in the household is flagged the person named as the household's representative counts as its head.
     */
    static String isHead(String m, String r) {
        return (
            "(" +
            m +
            ".is_head or (not exists(select 1 from tc2_roster.household_membership hx where hx.household_id=" +
            m +
            ".household_id and hx.is_head and hx.valid_to is null) and lower(btrim(" +
            r +
            ".full_name))=(select lower(btrim(hh.representative_name)) from tc2_roster.household hh where hh.id=" +
            m +
            ".household_id)))"
        );
    }

    /** Filter codes only (never the free text), for the audit trail. */
    Map<String, Object> auditDetails() {
        var details = new LinkedHashMap<String, Object>();
        details.put("scope", commune ? "commune" : "hamlet");
        if (!kinds.isEmpty()) details.put("kinds", kinds);
        if (!status.isEmpty()) details.put("status", status);
        if (expiringDays > 0) details.put("expiringDays", expiringDays);
        if (registeredFrom != null) details.put("registeredFrom", registeredFrom.toString());
        if (registeredTo != null) details.put("registeredTo", registeredTo.toString());
        if (!gender.isEmpty()) details.put("gender", gender);
        if (ageMin != null) details.put("ageMin", ageMin);
        if (ageMax != null) details.put("ageMax", ageMax);
        if (birthYearFrom != null) details.put("birthYearFrom", birthYearFrom);
        if (birthYearTo != null) details.put("birthYearTo", birthYearTo);
        if (!identity.isEmpty()) details.put("identity", identity);
        if (!householdRole.isEmpty()) details.put("householdRole", householdRole);
        if (!facilityTypes.isEmpty()) details.put("facilityTypes", facilityTypes);
        if (!origin.isEmpty()) details.put("origin", origin);
        if (!campaign.isEmpty()) details.put("campaign", campaign);
        if (!verification.isEmpty()) details.put("verification", verification);
        details.put("search", !search.isEmpty());
        details.put("address", !address.isEmpty());
        details.put("classification", !classification.isEmpty());
        return details;
    }

    private static final Map<String, String> KIND_LABELS = Map.of(
        "PERMANENT",
        "thường trú",
        "TEMPORARY",
        "tạm trú",
        "NOHT",
        "khai báo nơi ở hiện tại",
        "ARTICLE19",
        "nguồn Điều 19"
    );
    private static final Map<String, String> FACILITY_LABELS = Map.of(
        "RESIDENTIAL",
        "hộ gia đình",
        "BUSINESS",
        "cơ sở kinh doanh",
        "BOARDING_HOUSE",
        "nhà trọ / cơ sở lưu trú",
        "RELIGIOUS",
        "cơ sở tôn giáo, tín ngưỡng",
        "SPECIAL",
        "hộ cần giám sát đặc biệt"
    );
    static final Map<String, String> CAMPAIGN_LABELS = Map.ofEntries(
        Map.entry("MILITARY", "nghĩa vụ quân sự (nam 18–27, thường trú)"),
        Map.entry("ID_UNDER_6", "căn cước: dưới 6 tuổi"),
        Map.entry("ID_6_TO_14", "căn cước: từ 6 đến dưới 14 tuổi"),
        Map.entry("ID_AGE_14", "căn cước: đủ 14 tuổi trong năm"),
        Map.entry("ID_AGE_25", "căn cước: đủ 25 tuổi trong năm"),
        Map.entry("ID_AGE_40", "căn cước: đủ 40 tuổi trong năm"),
        Map.entry("ID_AGE_60", "căn cước: đủ 60 tuổi trong năm"),
        Map.entry("ELDERLY_80", "người cao tuổi từ 80 tuổi"),
        Map.entry("TEMP_EXPIRING", "tạm trú hết hạn trong 15 ngày")
    );

    private static String vn(LocalDate date) {
        return "%02d/%02d/%d".formatted(date.getDayOfMonth(), date.getMonthValue(), date.getYear());
    }

    /** Vietnamese one-line description of the filter for the export title and the print header. */
    String summary() {
        var parts = new ArrayList<String>();
        if (!gender.isEmpty()) parts.add(gender.equals("MALE") ? "nam" : "nữ");
        if (!kinds.isEmpty()) parts.add(String.join(", ", kinds.stream().map(KIND_LABELS::get).toList()));
        if (status.equals("ACTIVE")) parts.add("đang còn hiệu lực");
        if (status.equals("ENDED")) parts.add("đã hết hiệu lực");
        if (expiringDays > 0) parts.add("tạm trú hết hạn trong " + expiringDays + " ngày");
        if (ageMin != null && ageMax != null) parts.add(
            ageMin.equals(ageMax) ? "đúng " + ageMin + " tuổi" : "từ " + ageMin + " đến " + ageMax + " tuổi"
        );
        else if (ageMin != null) parts.add("từ " + ageMin + " tuổi trở lên");
        else if (ageMax != null) parts.add("không quá " + ageMax + " tuổi");
        if (hasAge() && refDate != null) parts.add("tuổi tính đến " + vn(refDate));
        if (birthYearFrom != null && birthYearFrom.equals(birthYearTo)) parts.add("sinh năm " + birthYearFrom);
        else {
            if (birthYearFrom != null) parts.add("sinh từ năm " + birthYearFrom);
            if (birthYearTo != null) parts.add("sinh đến năm " + birthYearTo);
        }
        if (registeredFrom != null) parts.add("đăng ký từ " + vn(registeredFrom));
        if (registeredTo != null) parts.add("đăng ký đến " + vn(registeredTo));
        if (identity.equals("HAS")) parts.add("đã có giấy tờ định danh");
        if (identity.equals("NONE")) parts.add("chưa có giấy tờ định danh");
        if (householdRole.equals("HEAD")) parts.add("là chủ hộ");
        if (householdRole.equals("MEMBER")) parts.add("là thành viên hộ (không phải chủ hộ)");
        if (householdRole.equals("NONE")) parts.add("chưa gắn hộ");
        if (!facilityTypes.isEmpty()) parts.add("thuộc " + String.join(", ", facilityTypes.stream().map(FACILITY_LABELS::get).toList()));
        if (!address.isEmpty()) parts.add("địa chỉ: " + address);
        if (!classification.isEmpty()) parts.add("phân loại: " + classification);
        if (!origin.isEmpty()) parts.add(origin.equals("EXCEL") ? "nguồn Excel gốc" : "nhập trực tiếp");
        if (!campaign.isEmpty()) parts.add(CAMPAIGN_LABELS.getOrDefault(campaign, campaign));
        if (!search.isEmpty()) parts.add("tìm \"" + search + "\"");
        if (parts.isEmpty()) return "Tất cả nhân khẩu";
        String text = String.join("; ", parts);
        return Character.toUpperCase(text.charAt(0)) + text.substring(1);
    }

    /** Order by clause; hamlet first when several hamlets are exported together. */
    String orderBy(boolean byHamlet) {
        String name = "regexp_replace(r.full_name,'^.*\\s','') collate \"vi-VN-x-icu\", r.full_name collate \"vi-VN-x-icu\"";
        String head = "m.head_flag desc nulls last, r.birth_date nulls last";
        String order = switch (sort.isEmpty() ? "HOUSEHOLD" : sort) {
            case "NAME" -> name;
            // Output columns of the export query: where the person actually lives, then the registered address.
            case "ADDRESS" -> "current_address nulls last, permanent_address nulls last, " + name;
            case "BIRTH" -> "coalesce(r.birth_date, make_date(r.birth_year,1,1)) nulls last, " + name;
            // Household address keeps neighbours together; the code only separates two households at one address.
            default -> "h.raw_address collate \"vi-VN-x-icu\" nulls last, h.code nulls last, " + head + ", " + name;
        };
        return (byHamlet ? "hm.sort_order nulls last, hm.name collate \"vi-VN-x-icu\", " : "") + order + ", r.id";
    }
}
