package com.policemanagement.com.web.rest;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.policemanagement.com.service.rbac.RbacService;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;

class GisInspectionPhotoResourceTest {

    private final JdbcTemplate db = mock(JdbcTemplate.class);
    private final RbacService rbac = mock(RbacService.class);
    private final GisInspectionPhotoResource resource = new GisInspectionPhotoResource(db, rbac);
    private final String png =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=";

    @Test
    void savesServerIdentityAndGeneratedMetadata() {
        when(rbac.current()).thenReturn(Map.of("id", "synthetic-actor", "fullName", "Test Officer"));
        var photo = resource.save(123, new GisInspectionPhotoResource.Upload(png, "test", "general"));
        assertEquals("Test Officer", photo.takenBy());
        assertNotNull(photo.id());
        assertNotNull(photo.timestamp());
        verify(rbac).permission("canUpdateInspection");
        verify(rbac).household(123L);
        verify(db).update(
            anyString(),
            eq(photo.id()),
            eq(123L),
            eq(png),
            eq("test"),
            eq("general"),
            eq(photo.timestamp()),
            eq("Test Officer"),
            eq("synthetic-actor")
        );
        assertFalse(photo.toString().contains(png));
    }

    @Test
    void refusesMutationOutsideTerritoryBeforeAnyDatabaseWrite() {
        doThrow(new AccessDeniedException("outside")).when(rbac).household(123L);
        assertThrows(AccessDeniedException.class, () -> resource.save(123, new GisInspectionPhotoResource.Upload(png, "", "general")));
        verifyNoInteractions(db);
    }

    @Test
    void rejectsNonImageDataAndOversizedCaption() {
        assertThrows(ResponseStatusException.class, () ->
            GisInspectionPhotoResource.validate(new GisInspectionPhotoResource.Upload("https://example.invalid/a.png", "", "general"))
        );
        assertThrows(ResponseStatusException.class, () ->
            GisInspectionPhotoResource.validate(new GisInspectionPhotoResource.Upload("data:image/png;base64,YWJj", "", "general"))
        );
        assertThrows(ResponseStatusException.class, () ->
            GisInspectionPhotoResource.validate(new GisInspectionPhotoResource.Upload(png, "a".repeat(2001), "general"))
        );
        assertThrows(ResponseStatusException.class, () ->
            GisInspectionPhotoResource.validate(new GisInspectionPhotoResource.Upload(png, "", "invalid"))
        );
    }

    @Test
    void deleteRequiresMatchingHouseholdAndExistingPhoto() {
        var id = UUID.randomUUID();
        assertThrows(ResponseStatusException.class, () -> resource.delete(123, id));
        verify(db).update("delete from gis_inspection_photo where id=? and household_id=?", id, 123L);
    }
}
