package com.policemanagement.com.web.rest;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.policemanagement.com.service.rbac.RbacService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class GisFieldBuildingResourceTest {

    private final ObjectMapper json = new ObjectMapper();

    @Test
    void validatesTwentyFloorLimitAndEditedMaterials() {
        var feature = feature("[[0,0],[1,0],[1,1],[0,0]]");
        var properties = (tools.jackson.databind.node.ObjectNode) feature.path("properties");
        properties.put("floors", 20);
        properties.put("height", 70);
        properties.put("wallColor", "#112233");
        properties.put("roofColor", "#aabbcc");
        properties.put("roofShape", "gable");
        properties.put("appearanceSource", "manual");
        properties.put("floorHeight", 3.5);
        properties.put("estimated", true);
        assertDoesNotThrow(() -> GisFieldBuildingResource.validate("custom-1", feature));
        properties.put("floors", 21);
        assertThrows(ResponseStatusException.class, () -> GisFieldBuildingResource.validate("custom-1", feature));
        properties.put("floors", 1.5);
        assertThrows(ResponseStatusException.class, () -> GisFieldBuildingResource.validate("custom-1", feature));
        properties.put("floors", 20);
        properties.put("height", 70.1);
        assertThrows(ResponseStatusException.class, () -> GisFieldBuildingResource.validate("custom-1", feature));
        properties.put("height", 70);
        properties.put("levels", 21);
        assertThrows(ResponseStatusException.class, () -> GisFieldBuildingResource.validate("custom-1", feature));
        properties.remove("levels");
        properties.put("wallColor", "invalid");
        assertThrows(ResponseStatusException.class, () -> GisFieldBuildingResource.validate("custom-1", feature));
        properties.put("wallColor", "#112233");
        properties.put("roofShape", "unknown");
        assertThrows(ResponseStatusException.class, () -> GisFieldBuildingResource.validate("custom-1", feature));
    }

    @Test
    void savesAndReturnsManuallyEditedAppearanceWithExistingHouseholdLinks() {
        var feature = feature("[[0,0],[1,0],[1,1],[0,0]]");
        var properties = (tools.jackson.databind.node.ObjectNode) feature.path("properties");
        properties.put("floors", 20);
        properties.put("height", 70);
        properties.put("wallColor", "#112233");
        properties.put("roofColor", "#aabbcc");
        properties.put("roofShape", "gable");
        properties.put("appearanceSource", "manual");
        var db = mock(JdbcTemplate.class);
        var rbac = mock(RbacService.class);
        var saved = new GisFieldBuildingResource(db, json, rbac, history).save("custom-1", feature);
        assertEquals("#aabbcc", saved.path("properties").path("roofColor").asText());
        assertEquals("1", saved.path("properties").path("householdIds").path(0).asText());
        verify(db).update(
            "insert into gis_field_building (id, feature_json) values (?, ?) on conflict (id) do update set feature_json = excluded.feature_json",
            "custom-1",
            json.writeValueAsString(feature)
        );
        verify(rbac).permission("canEditCoordinates");
        verify(history).mutation("custom-1", null, feature, false);
    }

    private final com.policemanagement.com.service.FieldMapHistoryService history = mock(
        com.policemanagement.com.service.FieldMapHistoryService.class
    );

    @Test
    @SuppressWarnings("unchecked")
    void showsCommuneWideBoundariesWithoutLeakingStoredPrivateProperties() {
        var db = mock(JdbcTemplate.class);
        var rbac = mock(RbacService.class);
        var stored = feature("[[0,0],[1,0],[1,1],[0,0]]");
        ((tools.jackson.databind.node.ObjectNode) stored.path("properties")).put("ownerName", "PRIVATE");
        when(db.queryForList(anyString())).thenReturn(
            List.of(Map.of("id", 1L, "code", "27592-BACLAN", "name", "Bac Lan", "boundary_geo_json", stored.toString()))
        );
        var result = new GisFieldBuildingResource(db, json, rbac, history).boundaries();
        var features = (List<JsonNode>) result.get("features");
        assertEquals(1, features.size());
        assertEquals(stored.path("geometry"), features.get(0).path("geometry"));
        assertFalse(features.get(0).path("properties").has("householdIds"));
        assertFalse(features.get(0).path("properties").has("ownerName"));
        assertEquals(1, features.get(0).path("properties").path("hamletId").asInt());
        verify(rbac).permission("canViewField3DMap");
    }

    @Test
    @SuppressWarnings("unchecked")
    void listsAllShapesButRemovesForeignHouseholdIdsAndPrivateProperties() {
        var db = mock(JdbcTemplate.class);
        var rbac = mock(RbacService.class);
        when(rbac.visibleMapHouseholds()).thenReturn(java.util.Set.of("1"));
        var own = feature("[[0,0],[1,0],[1,1],[0,0]]");
        when(rbac.canManageMapGeometry(own.path("geometry"))).thenReturn(true);
        var foreign = json.readTree(
            own
                .toString()
                .replace("custom-1", "custom-2")
                .replace("[[0,0],[1,0],[1,1],[0,0]]", "[[10,10],[11,10],[11,11],[10,10]]")
                .replace("[\"1\"]", "[\"2\"]")
                .replace("\"height\":7", "\"name\":\"PRIVATE OWNER\",\"height\":7")
        );
        doReturn(List.of(own, foreign)).when(db).query(anyString(), any(RowMapper.class));
        var result = new GisFieldBuildingResource(db, json, rbac, history).list();
        var features = (List<JsonNode>) result.get("features");
        assertEquals(2, features.size());
        assertEquals("1", features.get(0).path("properties").path("householdIds").path(0).asText());
        assertTrue(features.get(1).path("properties").path("householdIds").isEmpty());
        assertFalse(features.get(1).path("properties").has("name"));
        assertEquals(foreign.path("geometry"), features.get(1).path("geometry"));
        assertFalse(features.get(1).path("properties").path("canManage").asBoolean());
        assertEquals("outside-territory", features.get(1).path("properties").path("accessReason").asText());
        when(rbac.canManageMapGeometry(any())).thenReturn(true);
        var insideButForeign = (List<JsonNode>) new GisFieldBuildingResource(db, json, rbac, history).list().get("features");
        assertFalse(insideButForeign.get(1).path("properties").has("name"));
        assertTrue(insideButForeign.get(1).path("properties").path("householdIds").isEmpty());
        assertEquals("linked-household-outside-scope", insideButForeign.get(1).path("properties").path("accessReason").asText());
    }

    @Test
    void rejectsOutOfAreaFootprintBeforeAnyWriteEvenWithCoordinatePermission() {
        var db = mock(JdbcTemplate.class);
        var rbac = mock(RbacService.class);
        doThrow(new AccessDeniedException("outside assigned hamlets")).when(rbac).mapGeometry(any());
        var resource = new GisFieldBuildingResource(db, json, rbac, history);
        assertThrows(AccessDeniedException.class, () -> resource.save("custom-1", feature("[[0,0],[1,0],[1,1],[0,0]]")));
        verify(db, never()).update(anyString(), any(Object[].class));
        verifyNoInteractions(history);
    }

    @Test
    void cannotMoveAnOutsideBuildingIntoOnesOwnAreaToTakeOwnership() {
        var db = mock(JdbcTemplate.class);
        var rbac = mock(RbacService.class);
        var old = feature("[[10,10],[11,10],[11,11],[10,10]]");
        var inside = feature("[[0,0],[1,0],[1,1],[0,0]]");
        when(db.queryForList(anyString(), eq(String.class), eq("custom-1"))).thenReturn(List.of(old.toString()));
        doThrow(new AccessDeniedException("original building outside")).when(rbac).mapGeometry(old.path("geometry"));
        assertThrows(AccessDeniedException.class, () -> new GisFieldBuildingResource(db, json, rbac, history).save("custom-1", inside));
        verify(db, never()).update(anyString(), any(Object[].class));
    }

    @Test
    @SuppressWarnings("unchecked")
    void automaticLinkingCannotModifyARecordWithForeignHouseholdLinks() {
        var db = mock(JdbcTemplate.class);
        var rbac = mock(RbacService.class);
        when(rbac.canManageMapGeometry(any())).thenReturn(true);
        when(rbac.visibleMapHouseholds()).thenReturn(java.util.Set.of("1"));
        var candidate = feature("[[0,0],[1,0],[1,1],[0,0]]");
        var foreign = json.readTree(candidate.toString().replace("[\"1\"]", "[\"2\"]"));
        doReturn(List.of(foreign)).when(db).query(anyString(), any(RowMapper.class));
        new GisFieldBuildingResource(db, json, rbac, history).autoLink(List.of(candidate));
        verify(db, never()).update(anyString(), any(Object[].class));
    }

    @Test
    @SuppressWarnings("unchecked")
    void cannotEraseExistingForeignLinksToBypassScopeChecks() {
        var db = mock(JdbcTemplate.class);
        var rbac = mock(RbacService.class);
        var previous = feature("[[0,0],[1,0],[1,1],[0,0]]");
        var incoming = json.readTree(previous.toString().replace("[\"1\"]", "[]"));
        when(db.queryForList(anyString(), eq(String.class), eq("custom-1"))).thenReturn(List.of(previous.toString()));
        doThrow(new AccessDeniedException("foreign household")).when(rbac).household(1L);
        assertThrows(AccessDeniedException.class, () -> new GisFieldBuildingResource(db, json, rbac, history).save("custom-1", incoming));
        verify(db, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void automaticLinkingDoesNotWriteOutsideAssignedGeometry() {
        var db = mock(JdbcTemplate.class);
        var rbac = mock(RbacService.class);
        new GisFieldBuildingResource(db, json, rbac, history).autoLink(List.of(feature("[[0,0],[1,0],[1,1],[0,0]]")));
        verify(db, never()).queryForMap(anyString(), any(Object[].class));
        verify(db, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void autoLinkCreatesMissingRecordUsingDatabaseCoordinates() {
        var db = mock(JdbcTemplate.class);
        var rbac = mock(RbacService.class);
        when(rbac.global()).thenReturn(true);
        when(rbac.canManageMapGeometry(any())).thenReturn(true);
        var candidate = feature("[[0,0],[1,0],[1,1],[0,0]]");
        when(db.queryForMap(anyString(), eq(1L))).thenReturn(Map.of("latitude", 0.2, "longitude", 0.5));
        var result = new GisFieldBuildingResource(db, json, rbac, history).autoLink(List.of(candidate));
        assertTrue(result.get("features").toString().contains("custom-1"));
        verify(rbac).household(1L);
        verify(db).update(contains("on conflict"), eq("custom-1"), eq(json.writeValueAsString(candidate)));
    }

    @Test
    void randomTc2CoordinatesAreNotAutomaticallyLinkedEvenWhenInsideBuilding() {
        var db = mock(JdbcTemplate.class);
        var rbac = mock(RbacService.class);
        when(rbac.global()).thenReturn(true);
        when(rbac.canManageMapGeometry(any())).thenReturn(true);
        when(db.queryForMap(anyString(), eq(1L))).thenReturn(
            Map.of("latitude", 0.2, "longitude", 0.5, "coordinate_method", "RANDOM_WITHIN_TC2")
        );
        new GisFieldBuildingResource(db, json, rbac, history).autoLink(List.of(feature("[[0,0],[1,0],[1,1],[0,0]]")));
        verify(db, never()).update(anyString(), any(Object[].class));
    }

    @Test
    @SuppressWarnings("unchecked")
    void autoLinkMergesIntoExistingRecordWithoutOverwritingItsProperties() {
        var db = mock(JdbcTemplate.class);
        var rbac = mock(RbacService.class);
        when(rbac.global()).thenReturn(true);
        when(rbac.canManageMapGeometry(any())).thenReturn(true);
        var candidate = feature("[[0,0],[1,0],[1,1],[0,0]]");
        var existing = json.readTree(candidate.toString().replace("\"height\":7", "\"height\":30").replace("[\"1\"]", "[\"2\"]"));
        doReturn(List.of(existing)).when(db).query(anyString(), any(RowMapper.class));
        when(db.queryForMap(anyString(), eq(1L))).thenReturn(Map.of("latitude", 0.2, "longitude", 0.5));
        var expected = json.readTree(existing.toString().replace("[\"2\"]", "[\"2\",\"1\"]"));
        new GisFieldBuildingResource(db, json, rbac, history).autoLink(List.of(candidate));
        verify(db).update(contains("on conflict"), eq("custom-1"), eq(json.writeValueAsString(expected)));
        verify(rbac).household(1L);
    }

    @Test
    @SuppressWarnings("unchecked")
    void autoLinkIsIdempotentAndDoesNotReplaceExistingManualLinks() {
        var db = mock(JdbcTemplate.class);
        var rbac = mock(RbacService.class);
        when(rbac.global()).thenReturn(true);
        when(rbac.canManageMapGeometry(any())).thenReturn(true);
        var candidate = feature("[[0,0],[1,0],[1,1],[0,0]]");
        var existing = json.readTree(candidate.toString().replace("custom-1", "manual-house"));
        doReturn(List.of(existing)).when(db).query(anyString(), any(RowMapper.class));
        var result = new GisFieldBuildingResource(db, json, rbac, history).autoLink(List.of(candidate));
        assertEquals(List.of(existing).toString(), result.get("features").toString());
        verify(db, never()).queryForMap(anyString(), any(Object[].class));
        verify(db, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void autoLinkRejectsUnverifiedCoordinateMatchesAndUnauthorizedWrites() {
        var db = mock(JdbcTemplate.class);
        var rbac = mock(RbacService.class);
        when(rbac.global()).thenReturn(true);
        when(rbac.canManageMapGeometry(any())).thenReturn(true);
        var candidate = feature("[[0,0],[1,0],[1,1],[0,0]]");
        when(db.queryForMap(anyString(), eq(1L))).thenReturn(Map.of("latitude", 10, "longitude", 106));
        var resource = new GisFieldBuildingResource(db, json, rbac, history);
        resource.autoLink(List.of(candidate));
        verify(db, never()).update(anyString(), any(Object[].class));
        doThrow(new AccessDeniedException("denied")).when(rbac).permission("canEditCoordinates");
        assertThrows(AccessDeniedException.class, () -> resource.autoLink(List.of(candidate)));
    }

    @Test
    void coordinateMatchingRespectsPolygonHolesAndMultipolygonParts() {
        var geometry = json.readTree(
            """
            {"type":"MultiPolygon","coordinates":[[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[3,3],[7,3],[7,7],[3,7],[3,3]]],[[[20,20],[21,20],[21,21],[20,21],[20,20]]]]}
            """
        );
        assertTrue(GisFieldBuildingResource.containsCoordinate(geometry, 1, 1));
        assertFalse(GisFieldBuildingResource.containsCoordinate(geometry, 5, 5));
        assertTrue(GisFieldBuildingResource.containsCoordinate(geometry, 20.5, 20.5));
        assertFalse(GisFieldBuildingResource.containsCoordinate(geometry, 30, 30));
    }

    private JsonNode feature(String ring) {
        return json.readTree(
            """
            {"type":"Feature","id":"custom-1","properties":{"buildingId":"custom-1","height":7,"householdIds":["1"]},"geometry":{"type":"Polygon","coordinates":[%s]}}
            """.formatted(ring)
        );
    }

    @Test
    void acceptsClosedPolygonAndRejectsInvalidRingsAndMismatchedIds() {
        var valid = feature("[[106,10],[106.001,10],[106.001,10.001],[106,10]]");
        assertDoesNotThrow(() -> GisFieldBuildingResource.validate("custom-1", valid));
        assertThrows(ResponseStatusException.class, () -> GisFieldBuildingResource.validate("other", valid));
        assertThrows(ResponseStatusException.class, () ->
            GisFieldBuildingResource.validate("custom-1", feature("[[0,0],[1,0],[1,1],[0,1]]"))
        );
        assertThrows(ResponseStatusException.class, () ->
            GisFieldBuildingResource.validate("custom-1", feature("[[0,0],[1,1],[0,1],[1,0],[0,0]]"))
        );
        assertThrows(ResponseStatusException.class, () ->
            GisFieldBuildingResource.validate("custom-1", feature("[[181,0],[182,0],[182,1],[181,0]]"))
        );
    }

    @Test
    void cannotWriteWithoutCoordinatePermission() {
        var db = mock(JdbcTemplate.class);
        var rbac = mock(RbacService.class);
        when(rbac.global()).thenReturn(true);
        when(rbac.canManageMapGeometry(any())).thenReturn(true);
        doThrow(new AccessDeniedException("denied")).when(rbac).permission("canEditCoordinates");
        var resource = new GisFieldBuildingResource(db, json, rbac, history);
        assertThrows(AccessDeniedException.class, () -> resource.save("custom-1", feature("[[0,0],[1,0],[1,1],[0,0]]")));
        verifyNoInteractions(db);
    }

    @Test
    @SuppressWarnings("unchecked")
    void rejectsDuplicateHouseholdLinkBeforeWritingAndChecksScope() {
        var db = mock(JdbcTemplate.class);
        var rbac = mock(RbacService.class);
        when(rbac.global()).thenReturn(true);
        when(rbac.canManageMapGeometry(any())).thenReturn(true);
        var linked = feature("[[0,0],[1,0],[1,1],[0,0]]");
        doReturn(List.of(linked)).when(db).query(anyString(), any(RowMapper.class), eq("custom-1"));
        var resource = new GisFieldBuildingResource(db, json, rbac, history);
        var failure = assertThrows(ResponseStatusException.class, () -> resource.save("custom-1", linked));
        assertEquals(409, failure.getStatusCode().value());
        verify(rbac).household(1L);
        verify(db, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void retainsWholeFeatureWhenSaving() {
        var db = mock(JdbcTemplate.class);
        var rbac = mock(RbacService.class);
        when(rbac.global()).thenReturn(true);
        when(rbac.canManageMapGeometry(any())).thenReturn(true);
        var input = feature("[[0,0],[1,0],[1,1],[0,0]]");
        var resource = new GisFieldBuildingResource(db, json, rbac, history);
        assertEquals(input, resource.save("custom-1", input));
        verify(rbac).permission("canViewField3DMap");
        verify(rbac).permission("canEditCoordinates");
        verify(rbac).household(1L);
        verify(db).update(contains("on conflict"), eq("custom-1"), eq(json.writeValueAsString(input)));
    }
}
