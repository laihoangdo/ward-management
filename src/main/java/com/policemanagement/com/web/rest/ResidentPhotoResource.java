package com.policemanagement.com.web.rest;

import com.policemanagement.com.service.roster.ResidentPhotoService;
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/** Portrait photos on the resident record ("Hình ảnh" in the resident detail). */
@RestController
@RequestMapping("/api/roster/residents/{residentId}/photos")
public class ResidentPhotoResource {

    private final ResidentPhotoService service;

    public ResidentPhotoResource(ResidentPhotoService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<ResidentPhotoService.Photo>> list(@PathVariable UUID residentId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.list(residentId));
    }

    @GetMapping("/{photoId}/content")
    public ResponseEntity<byte[]> content(@PathVariable UUID residentId, @PathVariable UUID photoId) {
        var content = service.content(residentId, photoId);
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .header("X-Content-Type-Options", "nosniff")
            .contentType(MediaType.parseMediaType(content.mime()))
            .body(content.bytes());
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ResidentPhotoService.Photo upload(
        @PathVariable UUID residentId,
        @RequestParam MultipartFile file,
        @RequestParam(required = false) String caption
    ) throws IOException {
        return service.upload(residentId, file.getBytes(), caption);
    }

    @PutMapping("/{photoId}/primary")
    public List<ResidentPhotoService.Photo> primary(@PathVariable UUID residentId, @PathVariable UUID photoId) {
        return service.makePrimary(residentId, photoId);
    }

    @DeleteMapping("/{photoId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID residentId, @PathVariable UUID photoId) {
        service.delete(residentId, photoId);
    }
}
