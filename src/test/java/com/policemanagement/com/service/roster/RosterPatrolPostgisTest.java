package com.policemanagement.com.service.roster;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.policemanagement.com.service.PostgisSpatialService;
import com.policemanagement.com.service.rbac.RbacService;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Runs the real patrol SQL against the migrated PostGIS database (default localhost:5433/Monolithic). Every test executes inside a
 * transaction that is always rolled back, so no data changes. Enable with RUN_POSTGIS_PATROL_TESTS=true; override the connection
 * with POSTGIS_TEST_URL, POSTGIS_TEST_USER and POSTGIS_TEST_PASSWORD.
 */
@EnabledIfEnvironmentVariable(named = "RUN_POSTGIS_PATROL_TESTS", matches = "true")
class RosterPatrolPostgisTest {

    private JdbcTemplate db;
    private TransactionTemplate tx;
    private RosterService roster;
    private RbacService rbac;
    private RosterPatrolService service;

    /** A linked household and a point inside its building. */
    private record Target(long id, UUID rosterId, long hamlet, String building, double lon, double lat) {}

    @BeforeEach
    void setup() {
        var ds = new DriverManagerDataSource(
            System.getenv().getOrDefault("POSTGIS_TEST_URL", "jdbc:postgresql://localhost:5433/Monolithic"),
            System.getenv().getOrDefault("POSTGIS_TEST_USER", "Monolithic"),
            System.getenv().getOrDefault("POSTGIS_TEST_PASSWORD", "")
        );
        db = new JdbcTemplate(ds);
        tx = new TransactionTemplate(new DataSourceTransactionManager(ds));
        roster = mock(RosterService.class);
        rbac = mock(RbacService.class);
        when(rbac.subject()).thenReturn("test-officer");
        var spatial = mock(PostgisSpatialService.class);
        when(spatial.enabled()).thenReturn(true);
        service = new RosterPatrolService(db, roster, rbac, spatial);
    }

    private <T> T rolledBack(Supplier<T> work) {
        return tx.execute(status -> {
            try {
                return work.get();
            } finally {
                status.setRollbackOnly();
            }
        });
    }

    private Target household(String qualityCondition) {
        var row = db.queryForMap(
            "select h.id, h.roster_id, h.hamlet_id, b.id building, ST_X(ST_PointOnSurface(b.footprint_geom)) lon, ST_Y(ST_PointOnSurface(b.footprint_geom)) lat " +
                "from public.household h join public.gis_field_building_household l on l.household_id=h.id " +
                "join public.gis_field_building b on b.id=l.building_id " +
                "left join public.gis_field_building_household_import i on i.household_id=h.id and i.building_id=b.id " +
                "where " +
                qualityCondition +
                " order by h.id limit 1"
        );
        assertNotNull(row, "no suitable household in the test database");
        var target = new Target(
            ((Number) row.get("id")).longValue(),
            (UUID) row.get("roster_id"),
            ((Number) row.get("hamlet_id")).longValue(),
            (String) row.get("building"),
            ((Number) row.get("lon")).doubleValue(),
            ((Number) row.get("lat")).doubleValue()
        );
        when(roster.hamlet()).thenReturn(target.hamlet());
        return target;
    }

    private Map<String, Object> find(List<Map<String, Object>> rows, UUID rosterId) {
        return rows
            .stream()
            .filter(r -> rosterId.equals(r.get("id")))
            .findFirst()
            .orElseThrow(() -> new AssertionError("household not returned by nearby"));
    }

    @Test
    void nearbyReturnsTheHouseholdWithItsLinkQualityAndReliableOnlyDropsEstimates() {
        var estimated = household("i.source like '%-estimated'");
        rolledBack(() -> {
            var all = service.nearby(estimated.lat(), estimated.lon(), 50, false);
            var row = find(all, estimated.rosterId());
            assertEquals("ESTIMATED", row.get("link_quality"));
            assertEquals("BUILDING", row.get("position_source"));
            assertTrue(((Number) row.get("distance_m")).doubleValue() < 1.0, "the point is inside the building");
            assertTrue(all.size() <= RosterPatrolService.LIMIT);
            var reliable = service.nearby(estimated.lat(), estimated.lon(), 50, true);
            assertTrue(reliable.stream().noneMatch(r -> "ESTIMATED".equals(r.get("link_quality"))));
            assertTrue(reliable.stream().noneMatch(r -> estimated.rosterId().equals(r.get("id"))));
            return null;
        });
        var exact = household("i.match_tier='exact' and i.source not like '%-estimated'");
        rolledBack(() -> {
            var row = find(service.nearby(exact.lat(), exact.lon(), 50, true), exact.rosterId());
            assertEquals("EXACT", row.get("link_quality"));
            return null;
        });
    }

    @Test
    void nearbyNeverReturnsHouseholdsOutsideTheRadiusOrTheSelectedHamlet() {
        var target = household("true");
        rolledBack(() -> {
            // About 5 km from the building: nothing is within 200 m.
            assertTrue(service.nearby(target.lat() + 0.05, target.lon(), 200, false).isEmpty());
            when(roster.hamlet()).thenReturn(-1L);
            assertTrue(service.nearby(target.lat(), target.lon(), 200, false).isEmpty());
            return null;
        });
    }

    @Test
    void checkInIsIdempotentRecordsTheOfficerAndCountsConsecutiveAbsences() {
        var target = household("true");
        rolledBack(() -> {
            // Older visits written directly so their order is fixed; the API adds the newest one.
            db.update(
                "insert into household_visit(id,request_id,household_id,hamlet_id,outcome,observed_at,officer,officer_subject) values (?,?,?,?,'PRESENT',now()-interval '3 day','x','x')",
                UUID.randomUUID(),
                UUID.randomUUID(),
                target.id(),
                target.hamlet()
            );
            db.update(
                "insert into household_visit(id,request_id,household_id,hamlet_id,outcome,observed_at,officer,officer_subject) values (?,?,?,?,'ABSENT',now()-interval '2 day','x','x')",
                UUID.randomUUID(),
                UUID.randomUUID(),
                target.id(),
                target.hamlet()
            );
            UUID request = UUID.randomUUID();
            var data = new java.util.HashMap<String, Object>(
                Map.of(
                    "householdId",
                    target.rosterId().toString(),
                    "requestId",
                    request.toString(),
                    "outcome",
                    "ABSENT",
                    "latitude",
                    target.lat(),
                    "longitude",
                    target.lon(),
                    "accuracy",
                    5
                )
            );
            var first = service.checkIn(data);
            var retry = service.checkIn(new java.util.HashMap<>(data));
            assertEquals(first.get("id"), retry.get("id"));
            assertEquals("test-officer", first.get("officer"));
            assertEquals(3L, db.queryForObject("select count(*) from household_visit where household_id=?", Long.class, target.id()));
            var row = find(service.nearby(target.lat(), target.lon(), 50, false), target.rosterId());
            assertEquals(2, row.get("consecutive_absent"));
            assertEquals("ABSENT", ((Map<?, ?>) row.get("last_visit")).get("outcome"));
            var conflicting = new java.util.HashMap<>(data);
            conflicting.put("outcome", "PRESENT");
            assertThrows(Exception.class, () -> service.checkIn(conflicting));
            return null;
        });
    }

    @Test
    void visitsAndConfirmationsAreAppendOnly() {
        var target = household("true");
        for (String statement : List.of(
            "update household_visit set note='x'",
            "delete from household_visit",
            "update household_link_confirmation set officer='x'",
            "delete from household_link_confirmation"
        )) {
            rolledBack(() -> {
                service.checkIn(
                    new java.util.HashMap<>(
                        Map.of("householdId", target.rosterId().toString(), "requestId", UUID.randomUUID().toString(), "outcome", "PRESENT")
                    )
                );
                service.confirmPosition(
                    new java.util.HashMap<>(Map.of("householdId", target.rosterId().toString(), "requestId", UUID.randomUUID().toString()))
                );
                var ex = assertThrows(Exception.class, () -> db.update(statement), statement);
                assertTrue(ex.getMessage().contains("append-only"), ex.getMessage());
                return null;
            });
        }
    }

    @Test
    void confirmingAnEstimateMakesItConfirmedAndMovingTheHouseholdInvalidatesIt() {
        var target = household("i.source like '%-estimated'");
        rolledBack(() -> {
            assertEquals("ESTIMATED", find(service.nearby(target.lat(), target.lon(), 50, false), target.rosterId()).get("link_quality"));
            var confirmation = service.confirmPosition(
                new java.util.HashMap<>(
                    Map.of(
                        "householdId",
                        target.rosterId().toString(),
                        "requestId",
                        UUID.randomUUID().toString(),
                        "latitude",
                        target.lat(),
                        "longitude",
                        target.lon()
                    )
                )
            );
            assertEquals(target.building(), confirmation.get("building_id"));
            var confirmed = find(service.nearby(target.lat(), target.lon(), 50, true), target.rosterId());
            assertEquals("CONFIRMED", confirmed.get("link_quality"));

            // Same effect as the officer relinking the household to another building on the 3D map.
            String other = db.queryForObject(
                "select id from gis_field_building where id<>? order by id limit 1",
                String.class,
                target.building()
            );
            db.update(
                "update gis_field_building set feature_json=jsonb_set(feature_json::jsonb,'{properties,householdIds}',(feature_json::jsonb#>'{properties,householdIds}') - ?::text)::text where id=?",
                String.valueOf(target.id()),
                target.building()
            );
            db.update(
                "update gis_field_building set feature_json=jsonb_set(feature_json::jsonb,'{properties,householdIds}',coalesce(feature_json::jsonb#>'{properties,householdIds}','[]'::jsonb)||to_jsonb(?::text))::text where id=?",
                String.valueOf(target.id()),
                other
            );
            var point = db.queryForMap(
                "select ST_X(ST_PointOnSurface(footprint_geom)) lon, ST_Y(ST_PointOnSurface(footprint_geom)) lat from gis_field_building where id=?",
                other
            );
            var moved = find(
                service.nearby(((Number) point.get("lat")).doubleValue(), ((Number) point.get("lon")).doubleValue(), 50, false),
                target.rosterId()
            );
            assertEquals("MANUAL", moved.get("link_quality"));
            return null;
        });
    }

    @Test
    void confirmingAHouseholdWithoutABuildingIsRejected() {
        var unlinked = db.queryForList(
            "select roster_id, hamlet_id from public.household h where not exists (select 1 from gis_field_building_household l where l.household_id=h.id) limit 1"
        );
        Assumptions.assumeFalse(unlinked.isEmpty(), "every household is linked in this database");
        when(roster.hamlet()).thenReturn(((Number) unlinked.getFirst().get("hamlet_id")).longValue());
        assertThrows(Exception.class, () ->
            rolledBack(() ->
                service.confirmPosition(
                    new java.util.HashMap<>(
                        Map.of("householdId", unlinked.getFirst().get("roster_id").toString(), "requestId", UUID.randomUUID().toString())
                    )
                )
            )
        );
    }
}
