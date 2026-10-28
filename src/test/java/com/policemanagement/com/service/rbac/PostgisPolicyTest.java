package com.policemanagement.com.service.rbac;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.policemanagement.com.service.PostgisSpatialService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.ObjectMapper;

class PostgisPolicyTest {

    @Test
    void eitherEngineCanDenyAndPostgisDoesNotWidenExistingRights() {
        var json = new ObjectMapper();
        var rbac = spy(new RbacService(mock(JdbcTemplate.class), json, mock(KeycloakAdminClient.class)));
        var spatial = mock(PostgisSpatialService.class);
        rbac.setSpatial(spatial);
        doReturn(false).when(rbac).global();
        doReturn(List.of(1L)).when(rbac).areas();
        var shape = json.readTree("{\"type\":\"Polygon\",\"coordinates\":[[[0,0],[1,0],[1,1],[0,0]]]}");
        doReturn(List.of(shape)).when(rbac).mapTerritories();
        when(spatial.enabled()).thenReturn(true);
        when(spatial.covered(shape, List.of(1L))).thenReturn(false);
        assertFalse(rbac.canManageMapGeometry(shape));
        when(spatial.covered(shape, List.of(1L))).thenReturn(true);
        assertTrue(rbac.canManageMapGeometry(shape));
        doReturn(List.of()).when(rbac).mapTerritories();
        assertFalse(rbac.canManageMapGeometry(shape));
    }
}
