package com.policemanagement.com.web.rest;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.policemanagement.com.service.rbac.RbacService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class RbacMenuRemovalTest {

    @Test
    void hidesOnlyRetiredMenuWithoutDeletingStoredSettings() {
        var rbac = mock(RbacService.class);
        List<Map<String, Object>> retained = List.of(
            Map.of("id", "field-3d-map", "label", "Retained 3D map"),
            Map.of("id", "area-map"),
            Map.of("id", "households")
        );
        when(rbac.settings("menus")).thenReturn(
            List.of(retained.get(0), Map.of("id", "spatial-3d-map"), Map.of("id", "vietmap-compare"), retained.get(1), retained.get(2))
        );
        var resource = new RbacResource(rbac, null, null, null);
        assertEquals(retained, resource.settings("menus"));
        verify(rbac).current();
        verify(rbac).settings("menus");
        verifyNoMoreInteractions(rbac);
        assertFalse(MenuCatalog.IDS.contains("spatial-3d-map"));
        assertTrue(MenuCatalog.IDS.contains("field-3d-map"));
        assertFalse(MenuCatalog.IDS.contains("vietmap-compare"));
    }
}
