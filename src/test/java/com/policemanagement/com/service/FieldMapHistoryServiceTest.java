package com.policemanagement.com.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.policemanagement.com.domain.PatrolLog;
import com.policemanagement.com.repository.PatrolLogRepository;
import com.policemanagement.com.service.rbac.RbacService;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.databind.ObjectMapper;

class FieldMapHistoryServiceTest {

    private final ObjectMapper json = new ObjectMapper();

    @Test
    void storesActorFromServerAndBeforeAfterWithExistingLogVisibilityScope() {
        var repository = mock(PatrolLogRepository.class);
        var rbac = mock(RbacService.class);
        when(rbac.current()).thenReturn(Map.of("fullName", "Officer from server", "badgeNumber", "001", "rank", "Captain"));
        when(repository.save(any())).thenAnswer(call -> ((PatrolLog) call.getArgument(0)).id(12L));
        var service = new FieldMapHistoryService(repository, rbac, json);
        var before = json.readTree("{\"geometry\":{\"coordinates\":[1]},\"properties\":{\"height\":7}}");
        var after = json.readTree("{\"geometry\":{\"coordinates\":[2]},\"properties\":{\"height\":9}}");
        service.mutation("custom-1", before, after, false);
        var argument = ArgumentCaptor.forClass(PatrolLog.class);
        verify(repository).save(argument.capture());
        var saved = argument.getValue();
        assertEquals("Officer from server", saved.getOfficerName());
        assertNotNull(saved.getTimestamp());
        var details = json.readTree(saved.getDetails());
        assertEquals("map_3d", details.path("actionType").asText());
        assertEquals(before, json.readTree(details.path("previousValue").asText()));
        assertEquals(after, json.readTree(details.path("newValue").asText()));
        verify(rbac).recordCreated("patrol", 12L);
    }

    @Test
    void doesNotCreateRepeatedMutationHistoryForUnchangedData() {
        var repository = mock(PatrolLogRepository.class);
        var feature = json.readTree("{\"geometry\":{},\"properties\":{}}");
        new FieldMapHistoryService(repository, mock(RbacService.class), json).mutation("custom-1", feature, feature, false);
        verifyNoInteractions(repository);
    }
}
