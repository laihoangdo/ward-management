package com.policemanagement.com.web.rest;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.policemanagement.com.service.PostgisSpatialService;
import com.policemanagement.com.service.rbac.RbacService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import tools.jackson.databind.JsonNode;

class PostgisResourceTest {

    @Test
    void viewportRequiresPermissionAndReusesExistingMasking() {
        var spatial = mock(PostgisSpatialService.class);
        var rbac = mock(RbacService.class);
        var buildings = mock(GisFieldBuildingResource.class);
        var resource = new PostgisResource(spatial, rbac, buildings);
        List<JsonNode> shapes = List.of();
        when(spatial.viewport(106, 10, 107, 11)).thenReturn(shapes);
        when(buildings.scopedView(shapes)).thenReturn(Map.of("type", "FeatureCollection"));
        assertEquals("FeatureCollection", resource.viewport(106, 10, 107, 11).get("type"));
        verify(rbac).permission("canViewField3DMap");
        verify(buildings).scopedView(shapes);
        doThrow(new AccessDeniedException("denied")).when(rbac).permission("canViewField3DMap");
        assertThrows(AccessDeniedException.class, () -> resource.viewport(106, 10, 107, 11));
        verify(spatial, times(1)).viewport(106, 10, 107, 11);
    }
}
