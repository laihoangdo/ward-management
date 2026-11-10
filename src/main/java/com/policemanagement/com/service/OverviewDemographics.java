package com.policemanagement.com.service;

import java.util.Map;

/** Legacy aggregate compatibility only. Never infer residents, gender or age from names/addresses. */
public final class OverviewDemographics {

    private OverviewDemographics() {}

    public record Counts(long residents, long male, long female, long under18) {}

    public static Counts fallback(Map<String, Object> row, int year) {
        return new Counts(
            number(row, "residents_count"),
            number(row, "male_count"),
            number(row, "female_count"),
            number(row, "under_18_count")
        );
    }

    private static long number(Map<String, Object> row, String name) {
        return row.get(name) instanceof Number value ? Math.max(0, value.longValue()) : 0;
    }
}
