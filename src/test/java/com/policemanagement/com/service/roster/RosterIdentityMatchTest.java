package com.policemanagement.com.service.roster;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.policemanagement.com.service.rbac.RbacService;
import java.sql.ResultSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import tools.jackson.databind.ObjectMapper;

class RosterIdentityMatchTest {

    private static final UUID FIRST = UUID.randomUUID();
    private static final UUID SECOND = UUID.randomUUID();

    private JdbcTemplate db;
    private RbacService rbac;
    private RosterService service;

    @BeforeEach
    void setUp() throws Exception {
        db = mock(JdbcTemplate.class);
        rbac = mock(RbacService.class);
        var crypto = mock(RosterCrypto.class);
        when(crypto.searchLookup(anyString())).thenReturn("hash");
        // Ciphertext stands for itself in this test.
        when(crypto.decrypt(anyString())).thenAnswer(call -> call.getArgument(0));
        service = new RosterService(db, new ObjectMapper(), crypto, rbac);
        doAnswer(call -> {
            RowCallbackHandler handler = call.getArgument(1);
            for (var row : List.of(new Object[] { FIRST, "079085000001" }, new Object[] { SECOND, "079099123456" })) {
                var rs = mock(ResultSet.class);
                when(rs.getObject(1, UUID.class)).thenReturn((UUID) row[0]);
                when(rs.getString(2)).thenReturn((String) row[1]);
                handler.processRow(rs);
            }
            return null;
        })
            .when(db)
            .query(contains("resident_identity"), any(RowCallbackHandler.class), any(Object[].class));
    }

    @Test
    void findsResidentsWhoseNumberContainsTheDigitsTyped() {
        var match = service.identityMatch("0001", List.of(28L));
        assertEquals(List.of(FIRST), match.residents());
        assertEquals("hash", match.lookup());
        assertEquals(List.of(FIRST), service.identityMatch("085 000", List.of(28L)).residents());
        assertEquals(List.of(FIRST, SECOND), service.identityMatch("0790", List.of(28L)).residents());
    }

    @Test
    void auditsEachPartialSearchWithoutTheDigits() {
        service.identityMatch("123456", List.of(28L));
        verify(rbac).auditIndependent("identity-partial-search", "roster-residents", Map.of("digits", 6, "matches", 1));
    }

    @Test
    void decryptsNothingForShortNumbersOrNames() {
        assertTrue(service.identityMatch("001", List.of(28L)).residents().isEmpty());
        assertTrue(service.identityMatch("Nguyễn Văn A", List.of(28L)).residents().isEmpty());
        verify(db, never()).query(anyString(), any(RowCallbackHandler.class), any(Object[].class));
        verify(rbac, never()).auditIndependent(anyString(), anyString(), any());
    }
}
