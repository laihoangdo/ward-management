package com.policemanagement.com.service.roster;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Peak-campaign filters over recorded roster data. Each campaign is a constant SQL predicate over {@code tc2_roster.resident r};
 * no user input is ever interpolated. Ages come only from an exact recorded birth date (precision DAY): a year-only or unknown
 * birth date is never guessed into an age band, so those people are reported as "not evaluable" instead.
 */
final class RosterCampaign {

    private static final String AGE = "date_part('year', age(current_date, r.birth_date))";
    private static final String EXACT = "r.birth_date_precision='DAY' and r.birth_date is not null";

    /** Campaign code to predicate. */
    private static final Map<String, String> PREDICATES = new LinkedHashMap<>();

    static {
        // Nam đủ 18 đến hết 27 tuổi có đăng ký thường trú.
        PREDICATES.put(
            "MILITARY",
            EXACT +
                " and r.gender='MALE' and " +
                AGE +
                " between 18 and 27 and exists(select 1 from tc2_roster.residence_record p where p.resident_id=r.id and p.record_kind='PERMANENT')"
        );
        PREDICATES.put("ID_UNDER_6", EXACT + " and " + AGE + " < 6");
        PREDICATES.put("ID_6_TO_14", EXACT + " and " + AGE + " >= 6 and " + AGE + " < 14");
        // Các mốc đổi/cấp căn cước: người đủ N tuổi trong năm nay (chỉ cần năm sinh đã ghi nhận).
        for (int milestone : new int[] { 14, 25, 40, 60 }) {
            PREDICATES.put(
                "ID_AGE_" + milestone,
                "r.birth_year is not null and date_part('year', current_date) - r.birth_year = " + milestone
            );
        }
        PREDICATES.put("ELDERLY_80", EXACT + " and " + AGE + " >= 80");
        // Tạm trú hết hạn trong 15 ngày tới (kể cả hôm nay).
        PREDICATES.put(
            "TEMP_EXPIRING",
            "exists(select 1 from tc2_roster.residence_record t where t.resident_id=r.id and t.record_kind='TEMPORARY' " +
                "and t.valid_to between current_date and current_date + 15)"
        );
    }

    private RosterCampaign() {}

    static boolean valid(String code) {
        return code.isEmpty() || PREDICATES.containsKey(code);
    }

    /** SQL predicate for a campaign, or empty when none is selected. */
    static Optional<String> predicate(String code) {
        return Optional.ofNullable(PREDICATES.get(code));
    }

    /** Campaigns whose age band depends on an exact birth date; people without one cannot be evaluated for them. */
    static boolean needsExactBirthDate(String code) {
        return PREDICATES.containsKey(code) && PREDICATES.get(code).startsWith(EXACT);
    }

    static final String UNEVALUABLE = "r.birth_date_precision<>'DAY' or r.birth_date is null";

    private static final Pattern ADDRESS_PATH = Pattern.compile("[0-9]+[A-Za-z]?(/[0-9]+[A-Za-z]?)*/?");

    /**
     * Regex matching an address whose house or alley path starts with the given segments, so {@code 120/45} finds
     * {@code 120/45}, {@code 120/45/8/2A} but neither {@code 1120/45} nor {@code 120/450}. Empty when the text is not an address path.
     */
    static Optional<String> addressPathRegex(String search) {
        String text = search.strip();
        if (!ADDRESS_PATH.matcher(text).matches()) return Optional.empty();
        if (text.endsWith("/")) text = text.substring(0, text.length() - 1);
        return Optional.of("(^|[^0-9A-Za-z/])" + text + "(/|[^0-9A-Za-z]|$)");
    }
}
