package com.policemanagement.com.service;

import com.policemanagement.com.service.dto.HouseholdDTO;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Adds the pre-merger hamlet ("ấp cũ", e.g. 61/62/63/69) that each roster-backed household was imported from.
 *
 * <p>The value comes only from import provenance (batch of the source rows), never from parsing address text. A household
 * whose source rows point at more than one legacy hamlet gets no value instead of an arbitrary pick. It only enriches DTOs the
 * caller already loaded through the scoped query, so it cannot widen what a user may see.
 */
@Service
public class HouseholdLegacyHamletLookup {

    private static final String SQL =
        "select ir.household_id, min(b.legacy_hamlet) as legacy_hamlet " +
        "from tc2_roster.import_row ir join tc2_roster.import_batch b on b.id = ir.batch_id " +
        "where ir.household_id in (:ids) group by ir.household_id having count(distinct b.legacy_hamlet) = 1";

    private final NamedParameterJdbcTemplate db;

    public HouseholdLegacyHamletLookup(NamedParameterJdbcTemplate db) {
        this.db = db;
    }

    public void enrich(List<HouseholdDTO> households) {
        List<UUID> ids = households.stream().map(HouseholdDTO::getRosterId).filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) return;
        Map<UUID, String> byRoster = new HashMap<>();
        db.query(SQL, Map.of("ids", ids), rs -> {
            byRoster.put(rs.getObject("household_id", UUID.class), rs.getString("legacy_hamlet"));
        });
        for (HouseholdDTO household : households) {
            if (household.getRosterId() != null) household.setLegacyHamlet(byRoster.get(household.getRosterId()));
        }
    }
}
