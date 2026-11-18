package com.policemanagement.com.web.rest;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.policemanagement.com.service.rbac.*;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

class RbacEventsResourceTest {

    @Test
    void opensOnlyTheAuthenticatedSubjectWithStreamingHeaders() throws Exception {
        var rbac = mock(RbacService.class);
        var hub = mock(RbacEventHub.class);
        var emitter = new SseEmitter(1000L);
        when(rbac.current()).thenReturn(Map.of("id", "session"));
        when(rbac.subject()).thenReturn("session");
        when(hub.open("session")).thenReturn(emitter);
        var mvc = MockMvcBuilders.standaloneSetup(new RbacEventsResource(rbac, hub)).build();
        mvc.perform(get("/api/rbac/events").param("subject", "victim"))
            .andExpect(status().isOk())
            .andExpect(request().asyncStarted())
            .andExpect(header().string("X-Accel-Buffering", "no"))
            .andExpect(header().string("Cache-Control", "no-store"));
        verify(hub).open("session");
        verify(rbac).current();
        emitter.complete();
    }

    @Test
    void rejectsAnInactiveAccountBeforeOpeningTheStream() {
        var rbac = mock(RbacService.class);
        var hub = mock(RbacEventHub.class);
        when(rbac.current()).thenThrow(new AccessDeniedException("locked"));
        assertThrows(AccessDeniedException.class, () -> new RbacEventsResource(rbac, hub).events());
        verifyNoInteractions(hub);
    }
}
