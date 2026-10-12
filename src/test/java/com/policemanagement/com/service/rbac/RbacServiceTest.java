package com.policemanagement.com.service.rbac;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import tools.jackson.databind.ObjectMapper;

class RbacServiceTest {

    private RbacService rbac;
    private JdbcTemplate db;
    private KeycloakAdminClient kc;
    private final String actor = "00000000-0000-0000-0000-000000000001";
    private final String target = "00000000-0000-0000-0000-000000000002";

    @BeforeEach
    void setup() {
        db = mock(JdbcTemplate.class);
        kc = mock(KeycloakAdminClient.class);
        rbac = spy(new RbacService(db, new ObjectMapper(), kc));
        doReturn(
            new LinkedHashMap<>(
                Map.of(
                    "id",
                    actor,
                    "role",
                    "sub-admin",
                    "subAdminPermissions",
                    Map.of("canAddHouseholds", true),
                    "assignedStreets",
                    List.of()
                )
            )
        )
            .when(rbac)
            .current();
        doReturn(actor).when(rbac).subject();
        when(db.queryForList("select hamlet_id from rbac_assignment where subject=? order by hamlet_id", Long.class, actor)).thenReturn(
            List.of(10L)
        );
        when(kc.user(target)).thenReturn(Map.of("id", target, "username", "officer", "enabled", true));
        when(kc.role(target)).thenReturn("officer");
        when(db.queryForList("select data from rbac_profile where subject=?", String.class, target)).thenReturn(List.of());
        when(db.queryForList("select version from rbac_profile where subject=?", Long.class, target)).thenReturn(List.of());
    }

    @Test
    void missingPermissionDenies() {
        assertThrows(AccessDeniedException.class, () -> rbac.permission("canExportReports"));
    }

    @Test
    void ownAccountRejectsPrivilegeAndTerritoryFields() {
        for (String field : List.of("role", "hamletIds", "subAdminPermissions", "id", "badgeNumber")) {
            assertThrows(org.springframework.web.server.ResponseStatusException.class, () ->
                rbac.updateOwnAccount(Map.of(field, "unauthorized"))
            );
        }
        verify(db, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void ownAccountStoresOnlyRankAndNameWithoutChangingAssignments() {
        doReturn(Map.of()).when(rbac).stored(actor);
        doReturn(Map.of("id", actor)).when(rbac).profile(anyMap());
        when(kc.user(actor)).thenReturn(Map.of("id", actor));
        rbac.updateOwnAccount(Map.of("fullName", "  Thanh Trung  ", "rank", "  Đại úy  "));
        verify(db).update(
            startsWith("insert into rbac_profile"),
            eq(actor),
            argThat((String json) -> json.contains("Thanh Trung") && json.contains("Đại úy") && !json.contains("role"))
        );
        verify(db, never()).update(startsWith("delete from rbac_assignment"), any(Object[].class));
    }

    @Test
    void hamletAssignmentCannotGrantAnAreaOutsideActorScope() {
        when(db.queryForList("select hamlet_id from rbac_assignment where subject=? order by hamlet_id", Long.class, target)).thenReturn(
            List.of(10L)
        );
        when(db.queryForObject("select count(*) from hamlet where id=? and valid_to is null", Long.class, 51L)).thenReturn(1L);
        assertThrows(AccessDeniedException.class, () -> rbac.saveProfile(target, Map.of("hamletIds", List.of(51L))));
        verify(db, never()).update(startsWith("delete from rbac_assignment"), any(Object[].class));
    }

    @Test
    void missingOrRetiredHamletRejectsAssignment() {
        when(db.queryForList("select hamlet_id from rbac_assignment where subject=? order by hamlet_id", Long.class, target)).thenReturn(
            List.of(10L)
        );
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () ->
            rbac.saveProfile(target, Map.of("hamletIds", List.of(999L)))
        );
    }

    @Test
    void grantedPermissionWorks() {
        assertDoesNotThrow(() -> rbac.permission("canAddHouseholds"));
    }

    @Test
    void hamletManagerCanGrantMapViewingAndRetainExistingRights() {
        when(db.queryForList("select hamlet_id from rbac_assignment where subject=? order by hamlet_id", Long.class, target)).thenReturn(
            List.of(10L)
        );
        when(db.queryForObject("select count(*) from hamlet where id=? and valid_to is null", Long.class, 10L)).thenReturn(1L);
        when(db.queryForObject("select full_name from hamlet where id=?", String.class, 10L)).thenReturn("Hamlet");
        when(db.queryForList("select data from rbac_profile where subject=?", String.class, target)).thenReturn(
            List.of("{\"subAdminPermissions\":{\"canExportReports\":true}}")
        );
        assertDoesNotThrow(() ->
            rbac.saveProfile(
                target,
                Map.of(
                    "hamletIds",
                    List.of(10L),
                    "subAdminPermissions",
                    Map.of("canViewAdvancedMap", true, "canViewField3DMap", true, "canExportReports", true)
                )
            )
        );
        verify(db).update("insert into rbac_assignment(subject,hamlet_id) values (?,?)", target, 10L);
    }

    @Test
    void hamletManagerCannotGrantAnUnrelatedPermissionTheyDoNotHave() {
        when(db.queryForList("select hamlet_id from rbac_assignment where subject=? order by hamlet_id", Long.class, target)).thenReturn(
            List.of(10L)
        );
        when(db.queryForObject("select count(*) from hamlet where id=? and valid_to is null", Long.class, 10L)).thenReturn(1L);
        assertThrows(AccessDeniedException.class, () ->
            rbac.saveProfile(target, Map.of("hamletIds", List.of(10L), "subAdminPermissions", Map.of("canExportReports", true)))
        );
        verify(db, never()).update(startsWith("delete from rbac_assignment"), any(Object[].class));
    }

    @Test
    void outsideAreaDenies() {
        assertThrows(AccessDeniedException.class, () -> rbac.area(11L));
    }

    @Test
    void nullAreaDenies() {
        assertThrows(AccessDeniedException.class, () -> rbac.area(null));
    }

    @Test
    void assignedAreaWorks() {
        assertDoesNotThrow(() -> rbac.area(10L));
    }

    @Test
    void noAssignmentDoesNotOpenEverything() {
        when(db.queryForList("select hamlet_id from rbac_assignment where subject=? order by hamlet_id", Long.class, actor)).thenReturn(
            List.of()
        );
        assertThrows(AccessDeniedException.class, () -> rbac.area(10L));
        assertEquals(List.of(), rbac.scopedRecordIds("document"));
    }

    @Test
    void cannotDelegateOutsideOwnArea() {
        when(db.queryForList("select hamlet_id from rbac_assignment where subject=? order by hamlet_id", Long.class, target)).thenReturn(
            List.of(10L)
        );
        when(db.queryForObject("select count(*) from hamlet where id=? and valid_to is null", Long.class, 11L)).thenReturn(1L);
        assertThrows(AccessDeniedException.class, () -> rbac.saveProfile(target, Map.of("hamletIds", List.of(11L))));
        verify(db, never()).update(startsWith("delete from"), any(Object[].class));
    }

    @Test
    void cannotManageEqualOrHigherRole() {
        when(kc.role(target)).thenReturn("admin");
        assertThrows(AccessDeniedException.class, () -> rbac.saveProfile(target, Map.of("hamletIds", List.of(10L))));
    }

    @Test
    void cannotSelfAssign() {
        when(kc.user(actor)).thenReturn(Map.of("id", actor, "username", "actor", "enabled", true));
        when(kc.role(actor)).thenReturn("sub-admin");
        when(db.queryForList("select data from rbac_profile where subject=?", String.class, actor)).thenReturn(List.of());
        when(db.queryForList("select version from rbac_profile where subject=?", Long.class, actor)).thenReturn(List.of());
        assertThrows(AccessDeniedException.class, () -> rbac.saveProfile(actor, Map.of("hamletIds", List.of(10L))));
    }

    @Test
    void localOrNonOidcIdentityIsNotTrusted() {
        org.springframework.security.core.context.SecurityContextHolder.clearContext();
        var actual = new RbacService(db, new ObjectMapper(), kc);
        assertThrows(AccessDeniedException.class, actual::subject);
    }

    @Test
    void officerCannotCallKeycloakProvisioning() {
        assertThrows(AccessDeniedException.class, () -> rbac.saveUser(Map.of("username", "new-officer", "role", "superadmin")));
        verifyNoInteractions(kc);
    }

    @Test
    void writesTheNativeHamletIdWithoutAnAreaLookup() {
        when(db.queryForList("select hamlet_id from rbac_assignment where subject=? order by hamlet_id", Long.class, target)).thenReturn(
            List.of(10L)
        );
        when(db.queryForObject("select count(*) from hamlet where id=? and valid_to is null", Long.class, 10L)).thenReturn(1L);
        when(db.queryForObject("select full_name from hamlet where id=?", String.class, 10L)).thenReturn("Official hamlet");
        assertDoesNotThrow(() -> rbac.saveProfile(target, Map.of("hamletIds", List.of(10L))));
        verify(db).update("insert into rbac_assignment(subject,hamlet_id) values (?,?)", target, 10L);
    }

    @Test
    void rejectsStaleAreaPayloadBeforeAnyAssignmentWrite() {
        when(db.queryForList("select hamlet_id from rbac_assignment where subject=? order by hamlet_id", Long.class, target)).thenReturn(
            List.of(10L)
        );
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () ->
            rbac.saveProfile(target, Map.of("areaZoneIds", List.of(10L)))
        );
        verify(db, never()).update(startsWith("delete from rbac_assignment"), any(Object[].class));
    }
}
