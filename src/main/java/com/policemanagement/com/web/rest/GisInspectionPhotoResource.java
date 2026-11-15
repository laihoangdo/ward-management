package com.policemanagement.com.web.rest;

import com.policemanagement.com.service.gis.InspectionPhotoService;
import java.util.List;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Household inspection photos taken in the field. The files live in the private attachment store on the server and are
 * read only through these permission-checked endpoints.
 */
@RestController
@RequestMapping("/api/gis/households/{householdId}/inspection-photos")
public class GisInspectionPhotoResource {

    private final InspectionPhotoService service;

    public GisInspectionPhotoResource(InspectionPhotoService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<InspectionPhotoService.Photo>> list(@PathVariable long householdId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.list(householdId));
    }

    @GetMapping("/{id}/content")
    public ResponseEntity<byte[]> content(@PathVariable long householdId, @PathVariable UUID id) {
        var content = service.content(householdId, id);
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .header("X-Content-Type-Options", "nosniff")
            .contentType(MediaType.parseMediaType(content.mime()))
            .body(content.bytes());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public InspectionPhotoService.Photo save(@PathVariable long householdId, @RequestBody InspectionPhotoService.Upload upload) {
        return service.save(householdId, upload);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable long householdId, @PathVariable UUID id) {
        service.delete(householdId, id);
    }
}
