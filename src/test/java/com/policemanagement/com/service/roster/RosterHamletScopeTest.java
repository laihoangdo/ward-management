package com.policemanagement.com.service.roster;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.policemanagement.com.service.rbac.RbacService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

class RosterHamletScopeTest {

    private static final long DEFAULT_ID = 62L;

    private JdbcTemplate db;
    private RbacService rbac;
    private RosterService service;

    @BeforeEach
    void setUp() {
        db = mock(JdbcTemplate.class);
        rbac = mock(RbacService.class);
        service = new RosterService(db, new ObjectMapper(), mock(RosterCrypto.class), rbac);
        when(db.queryForObject(anyString(), eq(Long.class), eq(RosterService.DEFAULT_HAMLET_CODE))).thenReturn(DEFAULT_ID);
    }

    @Test
    void explicitHamletMustExist() {
        when(db.queryForObject(anyString(), eq(Long.class), eq(7L))).thenReturn(1L);
        when(db.queryForObject(anyString(), eq(Long.class), eq(99L))).thenReturn(0L);

        assertEquals(7L, service.resolveHamlet(" 7 ", true));
        var missing = assertThrows(ResponseStatusException.class, () -> service.resolveHamlet("99", true));
        assertEquals(HttpStatus.NOT_FOUND, missing.getStatusCode());
    }

    @Test
    void malformedHamletIsRejected() {
        var ex = assertThrows(ResponseStatusException.class, () -> service.resolveHamlet("abc", true));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
    }

    @Test
    void globalUserAndNonWebCallersGetTheDefaultHamlet() {
        when(rbac.global()).thenReturn(true);
        assertEquals(DEFAULT_ID, service.resolveHamlet(null, true));
        assertEquals(DEFAULT_ID, service.resolveHamlet("", false));
        verify(rbac, never()).areas();
    }

    @Test
    void officerAssignedToOneOtherHamletDefaultsToIt() {
        when(rbac.global()).thenReturn(false);
        when(rbac.areas()).thenReturn(List.of(5L));
        assertEquals(5L, service.resolveHamlet(null, true));
    }

    @Test
    void officerAssignedToTheDefaultOrSeveralHamletsKeepsTheDefault() {
        when(rbac.global()).thenReturn(false);
        when(rbac.areas()).thenReturn(List.of(DEFAULT_ID, 5L));
        assertEquals(DEFAULT_ID, service.resolveHamlet(null, true));
        when(rbac.areas()).thenReturn(List.of(5L, 6L));
        assertEquals(DEFAULT_ID, service.resolveHamlet(null, true));
    }

    @Test
    void superadminListsEveryHamletAndOfficersOnlyTheirOwn() {
        var all = List.<Map<String, Object>>of(Map.of("id", DEFAULT_ID), Map.of("id", 2L));
        when(db.queryForList(contains("order by name"))).thenReturn(all);
        when(rbac.global()).thenReturn(true);
        var listed = service.hamlets();
        assertEquals(
            List.of(DEFAULT_ID, 2L),
            listed
                .stream()
                .map(h -> h.get("id"))
                .toList()
        );
        assertEquals(
            List.of(true, false),
            listed
                .stream()
                .map(h -> h.get("is_default"))
                .toList()
        );

        when(rbac.global()).thenReturn(false);
        when(rbac.areas()).thenReturn(List.of());
        assertTrue(service.hamlets().isEmpty());
    }

    // ---- all-hamlets view (hamletId=all) ------------------------------------------------------------------------

    private void requestAll() {
        var request = new MockHttpServletRequest();
        request.setParameter("hamletId", RosterService.ALL_HAMLETS);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }

    @AfterEach
    void clearRequest() {
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void superAdminViewsEveryHamletAndTheCommuneChiefOnlyAssignedOnes() {
        requestAll();
        when(rbac.global()).thenReturn(true);
        when(db.queryForList(contains("sort_order"), eq(Long.class))).thenReturn(List.of(1L, 2L, 3L));
        assertTrue(service.allHamlets());
        assertEquals(List.of(1L, 2L, 3L), service.scopeHamlets());

        clearRequest();
        requestAll();
        when(rbac.global()).thenReturn(false);
        when(rbac.current()).thenReturn(Map.of("role", "admin"));
        when(rbac.areas()).thenReturn(List.of(5L, 7L));
        assertEquals(List.of(5L, 7L), service.scopeHamlets());
        verify(rbac).area(5L);
        verify(rbac).area(7L);
    }

    @Test
    void officersCannotOpenTheAllHamletsView() {
        requestAll();
        when(rbac.global()).thenReturn(false);
        when(rbac.current()).thenReturn(Map.of("role", "officer"));
        assertThrows(AccessDeniedException.class, () -> service.scopeHamlets());
        assertEquals(Map.of("all", false, "label", ""), service.scopeOptions());
    }

    @Test
    void anOperationNeedingOneHamletAsksForOneInsteadOfFallingBackToTheDefault() {
        requestAll();
        var ex = assertThrows(ResponseStatusException.class, () -> service.hamlet());
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
    }

    @Test
    void aRecordPinsItsOwnHamletOnlyWhenItIsInTheView() {
        requestAll();
        when(rbac.global()).thenReturn(false);
        when(rbac.current()).thenReturn(Map.of("role", "admin"));
        when(rbac.areas()).thenReturn(List.of(5L, 7L));

        var outside = assertThrows(ResponseStatusException.class, () -> service.pinHamlet(9L));
        assertEquals(HttpStatus.NOT_FOUND, outside.getStatusCode());

        service.pinHamlet(7L);
        assertFalse(service.allHamlets());
        assertEquals(7L, service.hamlet());
        // A second record of another hamlet in the same request looks absent (no cross-hamlet membership).
        var other = assertThrows(ResponseStatusException.class, () -> service.pinHamlet(5L));
        assertEquals(HttpStatus.NOT_FOUND, other.getStatusCode());
    }

    @Test
    void scopeOptionsNameTheViewByRole() {
        when(rbac.global()).thenReturn(true);
        when(rbac.current()).thenReturn(Map.of("role", "superadmin"));
        assertEquals(Map.of("all", true, "label", "Tất cả ấp"), service.scopeOptions());
        when(rbac.global()).thenReturn(false);
        when(rbac.current()).thenReturn(Map.of("role", "admin"));
        when(rbac.areas()).thenReturn(List.of(5L));
        assertEquals(Map.of("all", true, "label", "Toàn xã"), service.scopeOptions());
    }
}
