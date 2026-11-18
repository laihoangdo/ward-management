package com.policemanagement.com.service.rbac;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import tools.jackson.databind.ObjectMapper;

class DocumentHouseholdScopeTest {

    @Test
    void recordOwnershipCannotBypassLinkedHouseholdTerritory() {
        var db = mock(JdbcTemplate.class);
        var rbac = spy(new RbacService(db, new ObjectMapper(), mock(KeycloakAdminClient.class)));
        doReturn(false).when(rbac).global();
        doReturn(List.of(1L)).when(rbac).scopedRecordIds("document");
        when(db.queryForList("select household_id from document_record where id=?", Long.class, 1L)).thenReturn(List.of(42L));
        doThrow(new AccessDeniedException("outside territory")).when(rbac).household(42L);
        assertThrows(AccessDeniedException.class, () -> rbac.record("document", 1L));
        verify(rbac).household(42L);
    }
}
