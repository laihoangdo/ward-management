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

    private static final String GROUP_SQL = "select data from rbac_setting where kind=? order by id";

    private void groups(String... json) {
        when(db.queryForList(GROUP_SQL, String.class, PermissionGroups.KIND)).thenReturn(List.of(json));
    }

    private void targetInHamlet(String storedProfile) {
        when(db.queryForList("select hamlet_id from rbac_assignment where subject=? order by hamlet_id", Long.class, target)).thenReturn(
            List.of(10L)
        );
        when(db.queryForObject("select count(*) from hamlet where id=? and valid_to is null", Long.class, 10L)).thenReturn(1L);
        when(db.queryForObject("select full_name from hamlet where id=?", String.class, 10L)).thenReturn("Hamlet");
        when(db.queryForList("select data from rbac_profile where subject=?", String.class, target)).thenReturn(List.of(storedProfile));
    }

    @Test
    void newAccountsStartFromTheirGroupDefaultsAndEditsKeepExistingPermissions() {
        var defaults = PermissionGroups.flags(PermissionGroups.defaults(PermissionGroups.builtIn("officer")));
        @SuppressWarnings("unchecked")
        var granted = (Map<String, Boolean>) RbacService.withPermissions(Map.of("role", "officer"), defaults, true, Map.of()).get(
            "subAdminPermissions"
        );
        assertTrue(granted.get("canUpdateInspection"));
        assertTrue(granted.get("canScanOcr"));
        assertFalse(granted.get("canAddHouseholds"));
        assertFalse(granted.get("canRevealIdentity"));
        assertFalse(PermissionGroups.defaults(PermissionGroups.builtIn("sub-admin")).contains("canRevealIdentity"));
        assertEquals(RbacService.PERMISSIONS, PermissionGroups.defaults(PermissionGroups.builtIn("admin")));
        // Built-in ceilings allow everything, so seeding them revokes nothing that is already granted.
        for (String role : PermissionGroups.ROLES)
            assertEquals(RbacService.PERMISSIONS, PermissionGroups.ceiling(PermissionGroups.builtIn(role)));

        Map<String, Object> existing = Map.of("subAdminPermissions", Map.of("canRenewDocs", true));
        assertEquals(
            existing.get("subAdminPermissions"),
            RbacService.withPermissions(Map.of(), defaults, false, existing).get("subAdminPermissions")
        );
        Map<String, Object> explicit = Map.of("subAdminPermissions", Map.of("canScanOcr", false));
        assertSame(explicit, RbacService.withPermissions(explicit, defaults, true, Map.of()));
    }

    @Test
    void effectivePermissionsAreTheSupervisorsChoiceLimitedByTheGroupCeiling() {
        groups("{\"id\":\"g1\",\"name\":\"CAV tuần tra\",\"role\":\"officer\",\"ceiling\":[\"canUpdateInspection\"],\"defaults\":[]}");
        when(db.queryForList("select data from rbac_profile where subject=?", String.class, target)).thenReturn(
            List.of("{\"permissionGroupId\":\"g1\",\"subAdminPermissions\":{\"canUpdateInspection\":true,\"canScanOcr\":true}}")
        );
        var profile = rbac.profile(Map.of("id", target, "username", "officer", "enabled", true));
        @SuppressWarnings("unchecked")
        var effective = (Map<String, Boolean>) profile.get("subAdminPermissions");
        assertTrue(effective.get("canUpdateInspection"));
        assertFalse(effective.get("canScanOcr"));
        assertEquals("g1", profile.get("permissionGroupId"));
        assertEquals("CAV tuần tra", profile.get("permissionGroupName"));
    }

    @Test
    void aGroupOfAnotherRoleFallsBackToTheBuiltInGroup() {
        groups("{\"id\":\"g2\",\"name\":\"Quản lý\",\"role\":\"sub-admin\",\"ceiling\":[],\"defaults\":[]}");
        when(db.queryForList("select data from rbac_profile where subject=?", String.class, target)).thenReturn(
            List.of("{\"permissionGroupId\":\"g2\",\"subAdminPermissions\":{\"canScanOcr\":true}}")
        );
        var profile = rbac.profile(Map.of("id", target, "username", "officer", "enabled", true));
        assertEquals("builtin-officer", profile.get("permissionGroupId"));
        assertEquals(Boolean.TRUE, ((Map<?, ?>) profile.get("subAdminPermissions")).get("canScanOcr"));
    }

    @Test
    void aDelegateCannotGrantAPermissionOutsideTheGroupCeiling() {
        groups("{\"id\":\"g1\",\"name\":\"CAV tuần tra\",\"role\":\"officer\",\"ceiling\":[\"canUpdateInspection\"],\"defaults\":[]}");
        targetInHamlet("{\"permissionGroupId\":\"g1\",\"subAdminPermissions\":{}}");
        var denied = assertThrows(AccessDeniedException.class, () ->
            rbac.saveProfile(target, Map.of("hamletIds", List.of(10L), "subAdminPermissions", Map.of("canViewField3DMap", true)))
        );
        assertTrue(denied.getMessage().contains("ngoài phạm vi nhóm"));
    }

    @Test
    void savingAGroupThatNarrowsTheCeilingAsksBeforeRevokingAndThenRevokesOnlyHolders() {
        doReturn(true).when(rbac).global();
        groups(
            "{\"id\":\"g1\",\"name\":\"CAV\",\"role\":\"officer\",\"ceiling\":[\"canUpdateInspection\",\"canScanOcr\"],\"defaults\":[],\"builtIn\":false}"
        );
        when(kc.users()).thenReturn(List.of(Map.of("id", target, "username", "officer", "enabled", true)));
        when(db.queryForList("select data from rbac_profile where subject=?", String.class, target)).thenReturn(
            List.of("{\"permissionGroupId\":\"g1\",\"subAdminPermissions\":{\"canScanOcr\":true}}")
        );
        Map<String, Object> narrowed = Map.of(
            "id",
            "g1",
            "name",
            "CAV",
            "role",
            "officer",
            "ceiling",
            List.of("canUpdateInspection"),
            "defaults",
            List.of()
        );

        var preview = rbac.savePermissionGroup(narrowed, false);
        assertEquals(true, preview.get("requiresConfirmation"));
        assertEquals(1, preview.get("affected"));
        verify(db, never()).update(eq("update rbac_profile set data=?,version=version+1 where subject=?"), any(), any());

        var saved = rbac.savePermissionGroup(narrowed, true);
        assertEquals(1, saved.get("revoked"));
        verify(db).update(
            eq("update rbac_profile set data=?,version=version+1 where subject=?"),
            argThat(data -> data.toString().contains("\"canScanOcr\":false")),
            eq(target)
        );
    }

    @Test
    void wideningACeilingGrantsNobodyAnything() {
        doReturn(true).when(rbac).global();
        groups(
            "{\"id\":\"g1\",\"name\":\"CAV\",\"role\":\"officer\",\"ceiling\":[\"canUpdateInspection\"],\"defaults\":[],\"builtIn\":false}"
        );
        when(kc.users()).thenReturn(List.of(Map.of("id", target, "username", "officer", "enabled", true)));
        when(db.queryForList("select data from rbac_profile where subject=?", String.class, target)).thenReturn(
            List.of("{\"permissionGroupId\":\"g1\",\"subAdminPermissions\":{}}")
        );
        var saved = rbac.savePermissionGroup(
            Map.of(
                "id",
                "g1",
                "name",
                "CAV",
                "role",
                "officer",
                "ceiling",
                List.of("canUpdateInspection", "canScanOcr"),
                "defaults",
                List.of()
            ),
            false
        );
        assertEquals(0, saved.get("revoked"));
        verify(db, never()).update(eq("update rbac_profile set data=?,version=version+1 where subject=?"), any(), any());
    }

    @Test
    void builtInGroupsAndGroupsWithMembersCannotBeDeleted() {
        doReturn(true).when(rbac).global();
        groups(
            "{\"id\":\"builtin-officer\",\"name\":\"Công an viên\",\"role\":\"officer\",\"ceiling\":[],\"defaults\":[],\"builtIn\":true}",
            "{\"id\":\"g1\",\"name\":\"CAV\",\"role\":\"officer\",\"ceiling\":[],\"defaults\":[],\"builtIn\":false}"
        );
        when(kc.users()).thenReturn(List.of(Map.of("id", target, "username", "officer", "enabled", true)));
        when(db.queryForList("select data from rbac_profile where subject=?", String.class, target)).thenReturn(
            List.of("{\"permissionGroupId\":\"g1\"}")
        );
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> rbac.deletePermissionGroup("builtin-officer"));
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> rbac.deletePermissionGroup("g1"));
        verify(db, never()).update(eq("delete from rbac_setting where kind=? and id=?"), any(), any());
    }

    @Test
    void groupValidationRejectsDefaultsOutsideTheCeilingAndUnknownPermissions() {
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () ->
            PermissionGroups.normalize(
                Map.of("name", "X", "role", "officer", "ceiling", List.of(), "defaults", List.of("canScanOcr")),
                null
            )
        );
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () ->
            PermissionGroups.normalize(Map.of("name", "X", "role", "officer", "ceiling", List.of("canFly")), null)
        );
        var builtIn = PermissionGroups.builtIn("officer");
        var renamed = PermissionGroups.normalize(Map.of("name", "CAV", "role", "admin", "ceiling", List.of()), builtIn);
        assertEquals("officer", renamed.get("role"));
        assertEquals(true, renamed.get("builtIn"));
    }

    @Test
    void permissionPresetsAreOnlyForSupervisors() {
        assertEquals(Set.of("officer", "sub-admin", "admin"), rbac.permissionPresets().keySet());
        doReturn(Map.of("id", actor, "role", "officer"))
            .when(rbac)
            .current();
        assertThrows(AccessDeniedException.class, () -> rbac.permissionPresets());
    }

    @Test
    void missingPermissionDenies() {
        assertThrows(AccessDeniedException.class, () -> rbac.permission("canExportReports"));
    }

    @Test
    void mapScopeUsesOnlyAssignedHamletBoundariesAndFailsClosedWhenMissing() {
        var json = new ObjectMapper();
        var geometry = json.readTree("{\"type\":\"Polygon\",\"coordinates\":[[[1,1],[2,1],[2,2],[1,2],[1,1]]]}");
        assertFalse(rbac.canManageMapGeometry(geometry));
        assertThrows(AccessDeniedException.class, () -> rbac.mapCoordinate(1.5, 1.5));
        when(db.queryForList("select id, boundary_geo_json from hamlet where boundary_geo_json is not null")).thenReturn(
            List.of(
                Map.of("id", 10L, "boundary_geo_json", "{\"type\":\"Polygon\",\"coordinates\":[[[0,0],[3,0],[3,3],[0,3],[0,0]]]}"),
                Map.of("id", 20L, "boundary_geo_json", "{\"type\":\"Polygon\",\"coordinates\":[[[10,10],[13,10],[13,13],[10,13],[10,10]]]}")
            )
        );
        assertTrue(rbac.canManageMapGeometry(geometry));
        assertDoesNotThrow(() -> rbac.mapCoordinate(1.5, 1.5));
        assertThrows(AccessDeniedException.class, () -> rbac.mapCoordinate(11, 11));
        doReturn(true).when(rbac).global();
        assertDoesNotThrow(() -> rbac.mapCoordinate(11, 11));
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
