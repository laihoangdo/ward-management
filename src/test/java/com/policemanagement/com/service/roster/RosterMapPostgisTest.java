package com.policemanagement.com.service.roster;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.policemanagement.com.service.FieldBuildingWriter;
import com.policemanagement.com.service.FieldMapHistoryService;
import com.policemanagement.com.service.PostgisSpatialService;
import com.policemanagement.com.service.rbac.RbacService;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

/**
 * Runs the roster map against the migrated PostGIS database. Every test rolls back, so the database is left unchanged; enable with
 * RUN_POSTGIS_PATROL_TESTS=true.
 */
@EnabledIfEnvironmentVariable(named = "RUN_POSTGIS_PATROL_TESTS", matches = "true")
class RosterMapPostgisTest {

    JdbcTemplate db;
    TransactionTemplate tx;
    RosterService roster;
    FieldMapHistoryService history;
    RosterMapService service;
    long hamlet;

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
        hamlet = db.queryForObject("select id from public.hamlet where code='27592-TRUNGCHANH-2'", Long.class);
        when(roster.hamlet()).thenReturn(hamlet);
        when(roster.boundaryGeoJson()).thenReturn(
            db.queryForObject("select boundary_geo_json from public.hamlet where id=?", String.class, hamlet)
        );
        var spatial = mock(PostgisSpatialService.class);
        when(spatial.enabled()).thenReturn(true);
        history = mock(FieldMapHistoryService.class);
        var json = new ObjectMapper();
        var writer = new FieldBuildingWriter(db, json, mock(RbacService.class), history);
        service = new RosterMapService(db, roster, spatial, json, writer);
    }

    /** Runs {@code work} in a transaction that is always rolled back. */
    private <T> T rolledBack(java.util.function.Supplier<T> work) {
        return tx.execute(status -> {
            status.setRollbackOnly();
            return work.get();
        });
    }

    private String buildingOf(UUID household) {
        return db
            .queryForList(
                "select l.building_id from public.gis_field_building_household l join public.household h on h.id=l.household_id where h.roster_id=?",
                String.class,
                household
            )
            .stream()
            .findFirst()
            .orElse(null);
    }

    @Test
    void drawsExactlyTheHouseholdsThatHaveARecordedPosition() {
        var result = rolledBack(service::map);

        long linked = db.queryForObject(
            "select count(distinct h.id) from public.household h join public.gis_field_building_household l on l.household_id=h.id where h.hamlet_id=?",
            Long.class,
            hamlet
        );
        long verified = db.queryForObject(
            "select count(*) from public.household h where h.hamlet_id=? and h.coordinate_method='VERIFIED' and h.latitude is not null and not exists (select 1 from public.gis_field_building_household l where l.household_id=h.id)",
            Long.class,
            hamlet
        );
        long total = db.queryForObject("select count(*) from public.household where hamlet_id=?", Long.class, hamlet);
        var features = (List<?>) result.get("features");
        assertEquals(linked + verified, features.size());
        assertEquals(total, result.get("households"));
        assertEquals((long) features.size(), result.get("positioned"));
        var buildings = (List<?>) result.get("buildings");
        long linkedBuildings = db.queryForObject(
            "select count(distinct l.building_id) from public.gis_field_building_household l join public.household h on h.id=l.household_id where h.hamlet_id=?",
            Long.class,
            hamlet
        );
        long emptyBuildings = db.queryForObject(
            "select count(*) from public.gis_field_building b join public.hamlet hm on hm.id=? where ST_Intersects(b.footprint_geom, hm.boundary_geom) and not exists (select 1 from public.gis_field_building_household l where l.building_id=b.id)",
            Long.class,
            hamlet
        );
        assertEquals(linkedBuildings + emptyBuildings, buildings.size());
        long householdsInBuildings = 0;
        long withoutHouseholds = 0;
        for (Object b : buildings) {
            var props = (Map<?, ?>) ((Map<?, ?>) b).get("properties");
            double height = ((Number) props.get("height")).doubleValue();
            assertTrue(height >= 3 && height <= 70, "height within the 70 m limit: " + height);
            var households = (List<?>) props.get("households");
            if (households.isEmpty()) {
                withoutHouseholds++;
                assertEquals("NONE", props.get("quality"));
            } else assertTrue(
                Set.of("VERIFIED", "CONFIRMED", "EXACT", "DRAWING_APPROX", "MANUAL", "ESTIMATED").contains(props.get("quality"))
            );
            var type = ((tools.jackson.databind.JsonNode) ((Map<?, ?>) b).get("geometry")).path("type").asText();
            assertTrue(type.equals("MultiPolygon") || type.equals("Polygon"), type);
            householdsInBuildings += households.size();
            for (Object h : households) assertNotNull(((Map<?, ?>) h).get("pinned"), "each household says whether it can be unlinked");
            assertNotNull(props.get("appearance"), "design fields are passed to the map");
        }
        assertEquals(emptyBuildings, withoutHouseholds);
        assertEquals(linked, householdsInBuildings, "every linked household appears in exactly one building");
        var ids = new HashSet<Object>();
        var qualities = Set.of("VERIFIED", "CONFIRMED", "EXACT", "DRAWING_APPROX", "MANUAL", "ESTIMATED");
        for (Object f : features) {
            var props = (Map<?, ?>) ((Map<?, ?>) f).get("properties");
            assertTrue(ids.add(props.get("id")), "one point per household");
            assertTrue(qualities.contains(props.get("link_quality")), String.valueOf(props.get("link_quality")));
            var coordinates = (List<?>) ((Map<?, ?>) ((Map<?, ?>) f).get("geometry")).get("coordinates");
            double lon = ((Number) coordinates.get(0)).doubleValue();
            double lat = ((Number) coordinates.get(1)).doubleValue();
            assertTrue(lon > 106.5 && lon < 106.7 && lat > 10.8 && lat < 10.95, "inside Ba Diem: " + lon + "," + lat);
        }
    }

    /** A small square inside the hamlet, around a point on the boundary's surface, in degrees. */
    private Map<String, Object> squareInHamlet(double size) {
        var centre = db.queryForMap(
            "select ST_X(ST_PointOnSurface(boundary_geom)) x, ST_Y(ST_PointOnSurface(boundary_geom)) y from public.hamlet where id=?",
            hamlet
        );
        double x = ((Number) centre.get("x")).doubleValue(),
            y = ((Number) centre.get("y")).doubleValue();
        return Map.of(
            "type",
            "Polygon",
            "coordinates",
            List.of(List.of(List.of(x, y), List.of(x + size, y), List.of(x + size, y + size), List.of(x, y + size), List.of(x, y)))
        );
    }

    @Test
    void movesLinksAndUnlinksAHouseholdOnlyAfterConfirmationAndRollsBackCleanly() {
        var pair = db.queryForMap(
            "select h.roster_id household, l.building_id building from public.household h join public.gis_field_building_household l on l.household_id=h.id where h.hamlet_id=? order by h.code limit 1",
            hamlet
        );
        UUID household = (UUID) pair.get("household");
        String original = pair.get("building").toString();
        rolledBack(() -> {
            // A drawn building in the hamlet, saved empty first.
            var body = new HashMap<String, Object>();
            body.put("geometry", squareInHamlet(0.00005));
            body.put("floors", 2);
            body.put("name", "Công trình thử");
            String drawn = service.create(body).get("buildingId").toString();
            assertTrue(drawn.startsWith("custom-"));
            assertEquals(
                7.0,
                db.queryForObject(
                    "select (feature_json::jsonb #>> '{properties,height}')::float from gis_field_building where id=?",
                    Double.class,
                    drawn
                )
            );

            // Linking a household that already has a building needs confirmation, then moves it in one save.
            var conflict = assertThrows(ResponseStatusException.class, () -> service.link(drawn, household, false));
            assertEquals(409, conflict.getStatusCode().value());
            assertEquals(original, buildingOf(household));
            assertEquals(Boolean.TRUE, service.link(drawn, household, true).get("moved"));
            assertEquals(drawn, buildingOf(household));
            assertFalse(
                db
                    .queryForObject("select feature_json from gis_field_building where id=?", String.class, original)
                    .contains("\"" + db.queryForObject("select id from public.household where roster_id=?", Long.class, household) + "\""),
                "the old building no longer lists the household"
            );
            verify(history, atLeast(2)).mutation(anyString(), any(), any(), eq(false));

            // Unlinking removes the household from the building.
            service.unlink(drawn, household);
            assertNull(buildingOf(household));
            assertThrows(ResponseStatusException.class, () -> service.unlink(drawn, household));

            // A building drawn together with a household links it straight away.
            var withHousehold = new HashMap<String, Object>(body);
            withHousehold.put("geometry", squareInHamlet(0.00004));
            withHousehold.put("householdId", household.toString());
            String second = service.create(withHousehold).get("buildingId").toString();
            assertEquals(second, buildingOf(household));
            return null;
        });
        assertEquals(original, buildingOf(household), "everything was rolled back");
    }

    @Test
    void rejectsTallOrOutsideBuildingsAndOfficersWithoutCoordinateEditing() {
        rolledBack(() -> {
            var tall = new HashMap<String, Object>();
            tall.put("geometry", squareInHamlet(0.00005));
            tall.put("floors", 21);
            assertThrows(ResponseStatusException.class, () -> service.create(tall));
            var high = new HashMap<String, Object>(tall);
            high.put("floors", 5);
            high.put("height", 71.0);
            assertThrows(ResponseStatusException.class, () -> service.create(high));
            var outside = new HashMap<String, Object>();
            outside.put(
                "geometry",
                Map.of(
                    "type",
                    "Polygon",
                    "coordinates",
                    List.of(List.of(List.of(105.0, 20.0), List.of(105.001, 20.0), List.of(105.001, 20.001), List.of(105.0, 20.0)))
                )
            );
            outside.put("floors", 1);
            var error = assertThrows(ResponseStatusException.class, () -> service.create(outside));
            assertTrue(error.getReason().contains("ranh ấp"));
            doThrow(new AccessDeniedException("no")).when(roster).authorize("canEditCoordinates");
            assertThrows(AccessDeniedException.class, () -> service.create(outside));
            assertThrows(AccessDeniedException.class, () -> service.unlink("x", UUID.randomUUID()));
            return null;
        });
    }
}
