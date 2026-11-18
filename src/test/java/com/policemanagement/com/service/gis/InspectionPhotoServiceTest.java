package com.policemanagement.com.service.gis;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.policemanagement.com.service.AttachmentRecords;
import com.policemanagement.com.service.rbac.RbacService;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;

class InspectionPhotoServiceTest {

    private final JdbcTemplate db = mock(JdbcTemplate.class);
    private final RbacService rbac = mock(RbacService.class);
    private final AttachmentRecords records = mock(AttachmentRecords.class);
    private final InspectionPhotoService service = new InspectionPhotoService(db, rbac, records);
    static final String PNG =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=";

    @Test
    void refusesMutationOutsideTerritoryOrWithoutPermissionBeforeAnyWrite() {
        doThrow(new AccessDeniedException("outside")).when(rbac).household(123L);
        assertThrows(AccessDeniedException.class, () -> service.save(123, new InspectionPhotoService.Upload(PNG, "", "general")));
        assertThrows(AccessDeniedException.class, () -> service.list(123));
        doNothing().when(rbac).household(123L);
        doThrow(new AccessDeniedException("no")).when(rbac).permission("canUpdateInspection");
        assertThrows(AccessDeniedException.class, () -> service.delete(123, java.util.UUID.randomUUID()));
        verifyNoInteractions(db, records);
    }

    @Test
    void acceptsOnlyRealJpegOrPngDataUrlsWithKnownCategories() {
        assertTrue(InspectionPhotoService.validate(new InspectionPhotoService.Upload(PNG, "Mặt tiền", "facade")).length > 60);
        for (var bad : new InspectionPhotoService.Upload[] {
            new InspectionPhotoService.Upload("https://example.invalid/a.png", "", "general"),
            new InspectionPhotoService.Upload("data:image/png;base64,YWJj", "", "general"),
            new InspectionPhotoService.Upload(PNG.replace("image/png", "image/jpeg"), "", "general"),
            new InspectionPhotoService.Upload(PNG, "a".repeat(501), "general"),
            new InspectionPhotoService.Upload(PNG, "", "invalid"),
            null,
        })
            assertThrows(ResponseStatusException.class, () -> InspectionPhotoService.validate(bad));
    }
}
