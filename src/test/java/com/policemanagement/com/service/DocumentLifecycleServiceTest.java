package com.policemanagement.com.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.policemanagement.com.service.rbac.RbacService;
import java.sql.Date;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

class DocumentLifecycleServiceTest {

    private final JdbcTemplate db = mock(JdbcTemplate.class);
    private final RbacService rbac = mock(RbacService.class);
    private final DocumentLifecycleService service = new DocumentLifecycleService(db, rbac, new ObjectMapper());
    private final LocalDate today = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));

    private DocumentLifecycleService.Command command(Long version, LocalDate expiry, String reason) {
        return new DocumentLifecycleService.Command(
            UUID.randomUUID(),
            version,
            42L,
            expiry,
            null,
            "S-1",
            "Agency",
            reason,
            "License",
            "PCCC"
        );
    }

    @Test
    void permissionAndHouseholdAreCheckedBeforeReadingReceipts() {
        doThrow(new AccessDeniedException("outside")).when(rbac).household(42L);
        assertThrows(AccessDeniedException.class, () -> service.register(command(null, today, "verified")));
        verify(rbac).permission("canRenewDocs");
        verifyNoInteractions(db);
    }

    @Test
    void revokedRecordAccessPreventsHistoryOrMutation() {
        doThrow(new AccessDeniedException("revoked")).when(rbac).record("document", 1L);
        assertThrows(AccessDeniedException.class, () -> service.confirmOrRenew(1L, command(0L, today, "verified")));
        assertThrows(AccessDeniedException.class, () -> service.history(1L, 0));
        verifyNoInteractions(db);
    }

    @Test
    void missingReasonCannotWrite() {
        assertEquals(
            400,
            assertThrows(ResponseStatusException.class, () -> service.register(command(null, today, "  ")))
                .getStatusCode()
                .value()
        );
        verifyNoInteractions(db);
    }

    @Test
    void staleVersionCannotWrite() {
        when(db.queryForList("select household_id,expiry_on,version from document_record where id=? for update", 1L)).thenReturn(
            List.of(Map.of("version", 2L))
        );
        assertEquals(
            409,
            assertThrows(ResponseStatusException.class, () -> service.confirmOrRenew(1L, command(1L, today, "verified")))
                .getStatusCode()
                .value()
        );
        verify(db, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void cannotMoveAlreadyConfirmedDocumentToAnotherHousehold() {
        when(db.queryForList("select household_id,expiry_on,version from document_record where id=? for update", 1L)).thenReturn(
            List.of(Map.of("version", 1L, "household_id", 99L, "expiry_on", Date.valueOf(today.minusDays(1))))
        );
        assertEquals(
            400,
            assertThrows(ResponseStatusException.class, () -> service.confirmOrRenew(1L, command(1L, today.plusDays(20), "verified")))
                .getStatusCode()
                .value()
        );
        verify(db, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void renewalMustExtendTheOldDate() {
        when(db.queryForList("select household_id,expiry_on,version from document_record where id=? for update", 1L)).thenReturn(
            List.of(Map.of("version", 1L, "household_id", 42L, "expiry_on", Date.valueOf(today.plusDays(20))))
        );
        assertThrows(ResponseStatusException.class, () -> service.confirmOrRenew(1L, command(1L, today.plusDays(10), "verified")));
        verify(db, never()).update(anyString(), any(Object[].class));
    }
}
