package com.policemanagement.com.service.roster;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.policemanagement.com.service.PostgisSpatialService;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

class RosterMapServiceTest {

    private JdbcTemplate db;
    private RosterService roster;
    private PostgisSpatialService spatial;
    private RosterMapService service;

    @BeforeEach
    void setUp() {
        db = mock(JdbcTemplate.class);
        roster = mock(RosterService.class);
        spatial = mock(PostgisSpatialService.class);
        service = new RosterMapService(db, roster, spatial, new ObjectMapper());
        when(roster.hamlet()).thenReturn(28L);
        when(roster.boundaryGeoJson()).thenReturn("{\"type\":\"Polygon\",\"coordinates\":[]}");
    }

    @Test
    void needsThePermissionAndPostgis() {
        when(spatial.enabled()).thenReturn(false);
        var ex = assertThrows(ResponseStatusException.class, () -> service.map());
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, ex.getStatusCode());
        verify(roster).authorize("canViewAdvancedMap");
    }

    @Test
    void returnsOnlyRecordedPositionsAndCountsTheRest() {
        when(spatial.enabled()).thenReturn(true);
        UUID one = UUID.randomUUID();
        when(db.queryForList(startsWith("select h.roster_id id"), any(Object[].class))).thenReturn(
            List.of(
                Map.<String, Object>of(
                    "id",
                    one,
                    "code",
                    "TC2-1",
                    "raw_address",
                    "1 Ấp 62",
                    "position_source",
                    "BUILDING",
                    "link_quality",
                    "EXACT",
                    "lon",
                    106.6,
                    "lat",
                    10.85
                )
            )
        );
        when(db.queryForObject(startsWith("select count(*) from public.household"), eq(Long.class), any(Object[].class))).thenReturn(4L);

        var result = service.map();

        assertEquals(4L, result.get("households"));
        assertEquals(1L, result.get("positioned"));
        var features = (List<?>) result.get("features");
        assertEquals(1, features.size());
        var feature = (Map<?, ?>) features.getFirst();
        assertEquals(List.of(106.6, 10.85), ((Map<?, ?>) feature.get("geometry")).get("coordinates"));
        var properties = (Map<?, ?>) feature.get("properties");
        assertEquals(one.toString(), properties.get("id"));
        assertEquals("EXACT", properties.get("link_quality"));
        assertNotNull(result.get("boundary"));
    }

    @Test
    void aBuildingIsColouredByItsLeastCertainHouseholdAndHeightIsClamped() {
        assertEquals("ESTIMATED", RosterMapService.worst(List.of("EXACT", "ESTIMATED", "CONFIRMED")));
        assertEquals("EXACT", RosterMapService.worst(List.of("EXACT", "CONFIRMED", "VERIFIED")));
        assertEquals("MANUAL", RosterMapService.worst(List.of("DRAWING_APPROX", "MANUAL")));
        assertEquals("ESTIMATED", RosterMapService.worst(List.of()));
        assertEquals(3.0, RosterMapService.clampHeight(null));
        assertEquals(3.0, RosterMapService.clampHeight(0.4));
        assertEquals(9.6, RosterMapService.clampHeight(9.6));
        assertEquals(70.0, RosterMapService.clampHeight(250.0));
        assertEquals(3.0, RosterMapService.clampHeight(Double.NaN));
    }

    @Test
    void returnsBuildingFootprintsWithTheirHouseholds() {
        when(spatial.enabled()).thenReturn(true);
        String households =
            "[{\"id\":\"a\",\"code\":\"TC2-1\",\"raw_address\":\"1 Ấp 62\",\"link_quality\":\"EXACT\"},{\"id\":\"b\",\"code\":\"TC2-2\",\"raw_address\":\"2 Ấp 62\",\"link_quality\":\"ESTIMATED\"}]";
        when(db.queryForList(startsWith("select b.id building_id"), any(Object[].class))).thenReturn(
            List.of(
                Map.<String, Object>of(
                    "building_id",
                    "badiem-1",
                    "geometry",
                    "{\"type\":\"MultiPolygon\",\"coordinates\":[[[[106.6,10.85],[106.601,10.85],[106.601,10.851],[106.6,10.85]]]]}",
                    "height",
                    9.6,
                    "appearance",
                    "{\"estimated\":true,\"levels\":3,\"roofShape\":\"gable\"}",
                    "households",
                    households
                )
            )
        );
        when(db.queryForList(startsWith("select h.roster_id id"), any(Object[].class))).thenReturn(List.of());
        when(db.queryForObject(anyString(), eq(Long.class), any(Object[].class))).thenReturn(2L);

        var buildings = (List<?>) service.map().get("buildings");

        assertEquals(1, buildings.size());
        var building = (Map<?, ?>) buildings.getFirst();
        assertEquals("badiem-1", building.get("id"));
        assertEquals("MultiPolygon", ((tools.jackson.databind.JsonNode) building.get("geometry")).path("type").asText());
        var properties = (Map<?, ?>) building.get("properties");
        assertEquals(9.6, properties.get("height"));
        assertEquals("ESTIMATED", properties.get("quality"));
        assertEquals(2, properties.get("household_count"));
        var appearance = (tools.jackson.databind.JsonNode) properties.get("appearance");
        assertTrue(appearance.path("estimated").asBoolean());
        assertEquals(3, appearance.path("levels").asInt());
        assertEquals("gable", appearance.path("roofShape").asText());
        assertEquals(2, ((List<?>) properties.get("households")).size());
    }

    @Test
    void neverReadsTheRandomHouseholdCoordinates() {
        when(spatial.enabled()).thenReturn(true);
        when(db.queryForList(anyString(), any(Object[].class))).thenReturn(List.of());
        when(db.queryForObject(anyString(), eq(Long.class), any(Object[].class))).thenReturn(0L);
        service.map();
        var sql = ArgumentCaptor.forClass(String.class);
        verify(db, atLeastOnce()).queryForList(sql.capture(), any(Object[].class));
        // Only linked buildings and coordinates verified on site are drawn.
        var all = String.join(" ", sql.getAllValues());
        assertTrue(all.contains("gis_field_building"));
        assertTrue(all.contains("coordinate_method='VERIFIED'"));
        assertFalse(all.contains("RANDOM"));
    }
}
