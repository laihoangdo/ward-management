package com.policemanagement.com.service;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class OverviewDemographicsTest {

    @Test
    void agreesWithSharedFrontendLegacyFixtures() throws Exception {
        var mapper = new ObjectMapper();
        var fixtures = mapper.readTree(getClass().getResourceAsStream("/fixtures/overview-demographics.json"));
        for (var fixture : fixtures) {
            var h = fixture.get("household");
            var row = new HashMap<String, Object>();
            for (var entry : Map.of(
                "residentsCount",
                "residents_count",
                "maleCount",
                "male_count",
                "femaleCount",
                "female_count",
                "under18Count",
                "under_18_count"
            ).entrySet())
                if (h.hasNonNull(entry.getKey())) row.put(entry.getValue(), h.get(entry.getKey()).asInt());
            if (h.hasNonNull("ownerName")) row.put("owner_name", h.get("ownerName").asText());
            if (h.hasNonNull("houseNumber")) row.put("house_number", h.get("houseNumber").asText());
            var counts = OverviewDemographics.fallback(row, fixture.get("year").asInt());
            var expected = fixture.get("expected");
            assertArrayEquals(
                new long[] { expected.get(0).asLong(), expected.get(1).asLong(), expected.get(2).asLong(), expected.get(3).asLong() },
                new long[] { counts.residents(), counts.male(), counts.female(), counts.under18() },
                h.toString()
            );
        }
    }
}
