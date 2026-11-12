package com.policemanagement.com.service.roster;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.policemanagement.com.service.PostgisSpatialService;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

/** Runs the roster map query against the migrated PostGIS database. Read-only; enable with RUN_POSTGIS_PATROL_TESTS=true. */
@EnabledIfEnvironmentVariable(named = "RUN_POSTGIS_PATROL_TESTS", matches = "true")
class RosterMapPostgisTest {

    @Test
    void drawsExactlyTheHouseholdsThatHaveARecordedPosition() {
        var ds = new DriverManagerDataSource(
            System.getenv().getOrDefault("POSTGIS_TEST_URL", "jdbc:postgresql://localhost:5433/Monolithic"),
            System.getenv().getOrDefault("POSTGIS_TEST_USER", "Monolithic"),
            System.getenv().getOrDefault("POSTGIS_TEST_PASSWORD", "")
        );
        var db = new JdbcTemplate(ds);
        var roster = mock(RosterService.class);
        long hamlet = db.queryForObject("select id from public.hamlet where code='27592-TRUNGCHANH-2'", Long.class);
        when(roster.hamlet()).thenReturn(hamlet);
        when(roster.boundaryGeoJson()).thenReturn(
            db.queryForObject("select boundary_geo_json from public.hamlet where id=?", String.class, hamlet)
        );
        var spatial = mock(PostgisSpatialService.class);
        when(spatial.enabled()).thenReturn(true);
        var service = new RosterMapService(db, roster, spatial, new ObjectMapper());

        var result = new TransactionTemplate(new DataSourceTransactionManager(ds)).execute(status -> {
            status.setRollbackOnly();
            return service.map();
        });

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
        assertEquals(linkedBuildings, buildings.size());
        long householdsInBuildings = 0;
        for (Object b : buildings) {
            var props = (Map<?, ?>) ((Map<?, ?>) b).get("properties");
            double height = ((Number) props.get("height")).doubleValue();
            assertTrue(height >= 3 && height <= 70, "height within the 70 m limit: " + height);
            assertTrue(Set.of("VERIFIED", "CONFIRMED", "EXACT", "DRAWING_APPROX", "MANUAL", "ESTIMATED").contains(props.get("quality")));
            var type = ((tools.jackson.databind.JsonNode) ((Map<?, ?>) b).get("geometry")).path("type").asText();
            assertTrue(type.equals("MultiPolygon") || type.equals("Polygon"), type);
            householdsInBuildings += ((List<?>) props.get("households")).size();
            assertNotNull(props.get("appearance"), "design fields are passed to the map");
        }
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
}
