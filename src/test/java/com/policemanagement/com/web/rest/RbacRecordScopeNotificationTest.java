package com.policemanagement.com.web.rest;

import static org.mockito.Mockito.*;

import com.policemanagement.com.service.rbac.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class RbacRecordScopeNotificationTest {

    @Test
    void notifiesBothThePreviousAndNewRecordHolder() {
        var rbac = mock(RbacService.class);
        var db = mock(JdbcTemplate.class);
        var events = mock(RbacEventHub.class);
        when(rbac.database()).thenReturn(db);
        when(db.queryForObject("select count(*) from document_record where id=?", Long.class, 10L)).thenReturn(1L);
        when(rbac.assignments("new")).thenReturn(List.of(1L));
        when(
            db.queryForList("select subject from rbac_record_scope where kind=? and record_id=?", String.class, "document", 10L)
        ).thenReturn(List.of("previous"));
        new RbacResource(rbac, null, null, null, events).recordScope("document", 10L, "new");
        verify(events).afterCommit(new RbacEventHub.Change("previous", Set.of("me"), null, true));
        verify(events).afterCommit(new RbacEventHub.Change("new", Set.of("me"), null, true));
    }
}
