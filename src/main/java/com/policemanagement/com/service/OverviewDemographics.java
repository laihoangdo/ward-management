package com.policemanagement.com.service;

import java.util.Map;
import java.util.regex.Pattern;

/** Compatibility counts for the frontend's legacy getEffectiveResidentsList fallback. No people are persisted. */
public final class OverviewDemographics {

    private static final Pattern FEMALE_OWNER = Pattern.compile(
        "thị|hoa|mai|loan|tuyết|hương|nga|dung|trâm|linh",
        Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );

    private OverviewDemographics() {}

    public record Counts(long residents, long male, long female, long under18) {}

    public static Counts fallback(Map<String, Object> row, int year) {
        int storedTotal = number(row, "residents_count", 1);
        int total = Math.max(1, storedTotal);
        int targetMale = number(row, "male_count", (int) Math.ceil(storedTotal / 2.0));
        int targetFemale = number(row, "female_count", storedTotal - targetMale);
        int targetUnder = number(row, "under_18_count", 0);
        boolean ownerFemale = FEMALE_OWNER.matcher(String.valueOf(row.getOrDefault("owner_name", ""))).find();
        long female = ownerFemale ? 1 : 0;
        int remainingMale = ownerFemale ? targetMale : Math.max(0, targetMale - 1);
        int remainingFemale = ownerFemale ? Math.max(0, targetFemale - 1) : targetFemale;
        String digits = String.valueOf(row.getOrDefault("house_number", "1")).replaceAll("\\D", "");
        double houseNumber = digits.isEmpty() ? 0 : Double.parseDouble(digits);
        long minors = year - (1978 + (houseNumber % 15)) < 18 ? 1 : 0;
        for (int index = 2; index <= total; index++) {
            boolean isFemale = remainingMale > 0 && remainingFemale > 0 ? index % 2 == 0 : remainingFemale > 0;
            if (isFemale) {
                female++;
                remainingFemale = Math.max(0, remainingFemale - 1);
            } else remainingMale = Math.max(0, remainingMale - 1);
            boolean isMinor = targetUnder > 0;
            if (isMinor) targetUnder--;
            int birthYear = isMinor ? 2012 + (index % 10) : 1982 + (index % 20);
            if (year - birthYear < 18) minors++;
        }
        return new Counts(total, total - female, female, minors);
    }

    private static int number(Map<String, Object> row, String name, int fallback) {
        return row.get(name) instanceof Number value ? value.intValue() : fallback;
    }
}
