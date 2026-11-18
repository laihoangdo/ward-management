package com.policemanagement.com.service.roster;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.policemanagement.com.service.PostgisSpatialService;
import com.policemanagement.com.service.rbac.RbacService;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

class RosterPatrolServiceTest {

    private JdbcTemplate db;
    private RosterService roster;
    private RbacService rbac;
    private PostgisSpatialService spatial;
    private RosterPatrolService service;
    private final UUID household = UUID.randomUUID();
    private final UUID request = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        db = mock(JdbcTemplate.class);
        roster = mock(RosterService.class);
        rbac = mock(RbacService.class);
        spatial = mock(PostgisSpatialService.class);
        service = new RosterPatrolService(db, roster, rbac, spatial);
        when(roster.hamlet()).thenReturn(62L);
        when(rbac.subject()).thenReturn("officer-1");
    }

    private Map<String, Object> input(Object... overrides) {
        var data = new HashMap<String, Object>(
            Map.of("householdId", household.toString(), "requestId", request.toString(), "outcome", "PRESENT")
        );
        for (int i = 0; i < overrides.length; i += 2) data.put((String) overrides[i], overrides[i + 1]);
        return data;
    }

    private void houseExists() {
        when(db.queryForList(startsWith("select id from public.household"), eq(Long.class), any(), any())).thenReturn(List.of(7L));
    }

    @Test
    void radiusAndPositionAreBounded() {
        assertEquals(50, RosterPatrolService.radius(null));
        assertEquals(10, RosterPatrolService.radius(10));
        assertEquals(200, RosterPatrolService.radius(200));
        assertThrows(ResponseStatusException.class, () -> RosterPatrolService.radius(9));
        assertThrows(ResponseStatusException.class, () -> RosterPatrolService.radius(201));
        assertThrows(ResponseStatusException.class, () -> RosterPatrolService.validatePosition(91, 10));
        assertThrows(ResponseStatusException.class, () -> RosterPatrolService.validatePosition(10, Double.NaN));
        assertDoesNotThrow(() -> RosterPatrolService.validatePosition(10.8, 106.6));
    }

    @Test
    void consecutiveAbsentStopsAtTheFirstPresentVisit() {
        assertEquals(0, RosterPatrolService.consecutiveAbsent(List.of()));
        assertEquals(0, RosterPatrolService.consecutiveAbsent(List.of("PRESENT", "ABSENT")));
        assertEquals(2, RosterPatrolService.consecutiveAbsent(List.of("ABSENT", "ABSENT", "PRESENT", "ABSENT")));
    }

    @Test
    void nearbyNeedsPostgis() {
        when(spatial.enabled()).thenReturn(false);
        var ex = assertThrows(ResponseStatusException.class, () -> service.nearby(10.8, 106.6, 50, false));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, ex.getStatusCode());
    }

    @Test
    void checkInRejectsInvalidInputBeforeTouchingTheDatabase() {
        assertThrows(ResponseStatusException.class, () -> service.checkIn(input("outcome", "MOVED")));
        assertThrows(ResponseStatusException.class, () -> service.checkIn(input("requestId", "nope")));
        assertThrows(ResponseStatusException.class, () -> service.checkIn(input("householdId", null)));
        assertThrows(ResponseStatusException.class, () -> service.checkIn(input("latitude", 10.8)));
        assertThrows(ResponseStatusException.class, () -> service.checkIn(input("latitude", 95, "longitude", 10)));
        assertThrows(ResponseStatusException.class, () -> service.checkIn(input("accuracy", -1)));
        assertThrows(ResponseStatusException.class, () -> service.checkIn(input("note", "x".repeat(501))));
        verify(db, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void checkInRequiresInspectionPermissionAndAHouseholdInTheSelectedHamlet() {
        when(db.queryForList(startsWith("select id from public.household"), eq(Long.class), any(), any())).thenReturn(List.of());
        var ex = assertThrows(ResponseStatusException.class, () -> service.checkIn(input()));
        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
        verify(roster).authorize("canUpdateInspection");
        verify(db, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void checkInStoresOneVisitForTheOfficerAndReturnsIt() {
        houseExists();
        when(db.queryForList(startsWith("select * from household_visit"), eq(request))).thenReturn(List.of());
        when(db.queryForMap(startsWith("select * from household_visit"), any(Object[].class))).thenReturn(
            Map.of("id", UUID.randomUUID(), "outcome", "PRESENT", "officer", "officer-1", "note", "")
        );
        var result = service.checkIn(input("latitude", 10.8, "longitude", 106.6, "accuracy", 12));
        assertEquals("PRESENT", result.get("outcome"));
        assertEquals(household, result.get("household_id"));
        verify(db, times(1)).update(startsWith("insert into household_visit"), any(Object[].class));
    }

    @Test
    void retryWithTheSameRequestIdDoesNotAddAnotherVisit() {
        houseExists();
        var stored = Map.<String, Object>of(
            "id",
            UUID.randomUUID(),
            "household_id",
            7L,
            "officer_subject",
            "officer-1",
            "outcome",
            "PRESENT",
            "officer",
            "officer-1",
            "note",
            ""
        );
        when(db.queryForList(startsWith("select * from household_visit"), eq(request))).thenReturn(List.of(stored));
        var result = service.checkIn(input());
        assertEquals(stored.get("id"), result.get("id"));
        verify(db, never()).update(startsWith("insert into household_visit"), any(Object[].class));
    }

    @Test
    void requestIdReusedForDifferentContentIsAConflict() {
        houseExists();
        var stored = Map.<String, Object>of(
            "id",
            UUID.randomUUID(),
            "household_id",
            7L,
            "officer_subject",
            "officer-1",
            "outcome",
            "ABSENT"
        );
        when(db.queryForList(startsWith("select * from household_visit"), eq(request))).thenReturn(List.of(stored));
        var ex = assertThrows(ResponseStatusException.class, () -> service.checkIn(input("outcome", "PRESENT")));
        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
    }

    private void linkedTo(String building) {
        when(db.queryForList(startsWith("select building_id from gis_field_building_household"), eq(String.class), any())).thenReturn(
            building == null ? List.of() : List.of(building)
        );
    }

    @Test
    void confirmingNeedsALinkedBuildingAndTheInspectionPermission() {
        houseExists();
        linkedTo(null);
        var ex = assertThrows(ResponseStatusException.class, () -> service.confirmPosition(input()));
        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        verify(roster).authorize("canUpdateInspection");
        verify(db, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void confirmingStoresTheBuildingTheHouseholdIsCurrentlyLinkedTo() {
        houseExists();
        linkedTo("badiem-b1");
        when(db.queryForList(startsWith("select * from household_link_confirmation"), eq(request))).thenReturn(List.of());
        when(db.queryForMap(startsWith("select * from household_link_confirmation"), any(Object[].class))).thenReturn(
            Map.of("id", UUID.randomUUID(), "building_id", "badiem-b1", "officer", "officer-1")
        );
        var result = service.confirmPosition(input("latitude", 10.8, "longitude", 106.6));
        assertEquals("badiem-b1", result.get("building_id"));
        assertEquals(household, result.get("household_id"));
        verify(db, times(1)).update(startsWith("insert into household_link_confirmation"), any(Object[].class));
    }

    @Test
    void confirmingTwiceWithTheSameRequestIdKeepsOneRecordAndRejectsAnotherOfficer() {
        houseExists();
        linkedTo("badiem-b1");
        var stored = Map.<String, Object>of(
            "id",
            UUID.randomUUID(),
            "household_id",
            7L,
            "officer_subject",
            "officer-1",
            "building_id",
            "badiem-b1"
        );
        when(db.queryForList(startsWith("select * from household_link_confirmation"), eq(request))).thenReturn(List.of(stored));
        assertEquals(stored.get("id"), service.confirmPosition(input()).get("id"));
        verify(db, never()).update(startsWith("insert into household_link_confirmation"), any(Object[].class));
        when(rbac.subject()).thenReturn("someone-else");
        assertEquals(
            HttpStatus.CONFLICT,
            assertThrows(ResponseStatusException.class, () -> service.confirmPosition(input())).getStatusCode()
        );
    }
}
