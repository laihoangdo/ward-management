package com.policemanagement.com.service.rbac;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.*;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.Signature;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class RbacChangeAspectTest {

    @Test
    void emitsTheSavedTargetVersionAfterSuccess() throws Throwable {
        var hub = mock(RbacEventHub.class);
        var point = point("saveProfile", "target", Map.of());
        when(point.proceed()).thenReturn(Map.of("id", "target", "version", 8L));
        new RbacChangeAspect(hub).changed(point);
        verify(hub).afterCommit(new RbacEventHub.Change("target", Set.of("me", "users"), 8L, true));
    }

    @Test
    void failedMutationDoesNotPublishSuccess() throws Throwable {
        var hub = mock(RbacEventHub.class);
        var point = point("saveProfile", "target", Map.of());
        when(point.proceed()).thenThrow(new IllegalStateException("rollback"));
        assertThrows(IllegalStateException.class, () -> new RbacChangeAspect(hub).changed(point));
        verifyNoInteractions(hub);
    }

    @Test
    void settingsInvalidateOnlyTheirChannelUnlessTheyAffectAccess() throws Throwable {
        var hub = mock(RbacEventHub.class);
        new RbacChangeAspect(hub).changed(point("saveSetting", "alerts", Map.of()));
        new RbacChangeAspect(hub).changed(point("saveSetting", "whitelist", Map.of()));
        var captured = ArgumentCaptor.forClass(RbacEventHub.Change.class);
        verify(hub, times(2)).afterCommit(captured.capture());
        assertEquals(Set.of("alerts"), captured.getAllValues().get(0).topics());
        assertEquals(Set.of("whitelist", "me"), captured.getAllValues().get(1).topics());
    }

    private ProceedingJoinPoint point(String name, Object... args) {
        var point = mock(ProceedingJoinPoint.class);
        var signature = mock(Signature.class);
        when(signature.getName()).thenReturn(name);
        when(point.getSignature()).thenReturn(signature);
        when(point.getArgs()).thenReturn(args);
        when(point.getTarget()).thenReturn(mock(RbacService.class));
        return point;
    }

    @Test
    void revalidatesTheFailClosedIdentityAfterAnIndependentIdentityFailureAudit() throws Throwable {
        var hub = mock(RbacEventHub.class);
        var point = point("record", "actor", "identity-sync-failed-disabled", "target");
        when(point.getTarget()).thenReturn(mock(RbacFailureAudit.class));
        new RbacChangeAspect(hub).changed(point);
        verify(hub).publish(new RbacEventHub.Change("target", Set.of("me", "users"), null, true));
        verify(hub, never()).afterCommit(any());
    }
}
