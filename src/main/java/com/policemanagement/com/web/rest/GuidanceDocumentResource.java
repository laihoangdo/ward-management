package com.policemanagement.com.web.rest;

import com.policemanagement.com.service.AttachmentRecords;
import com.policemanagement.com.service.guidance.GuidanceDocumentService;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/** Commune-wide register of guidance documents for ward police officers (văn bản hướng dẫn CSKV). */
@RestController
@RequestMapping("/api/guidance-documents")
public class GuidanceDocumentResource {

    private final GuidanceDocumentService service;

    public GuidanceDocumentResource(GuidanceDocumentService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> list(@RequestParam Map<String, String> filter) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.list(filter));
    }

    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> summary() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.summary());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> detail(@PathVariable UUID id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.detail(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@RequestBody Map<String, Object> body) {
        return service.create(body);
    }

    @PutMapping("/{id}")
    public Map<String, Object> update(@PathVariable UUID id, @RequestBody Map<String, Object> body) {
        return service.update(id, body);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        service.delete(id);
    }

    @GetMapping("/{id}/files")
    public ResponseEntity<List<AttachmentRecords.Attachment>> files(@PathVariable UUID id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.files(id));
    }

    @GetMapping("/{id}/files/{fileId}/content")
    public ResponseEntity<byte[]> content(@PathVariable UUID id, @PathVariable UUID fileId) {
        var content = service.content(id, fileId);
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .header("X-Content-Type-Options", "nosniff")
            // PDFs open inline in the browser viewer, never as a page of this origin.
            .header("Content-Security-Policy", "sandbox")
            .header(
                "Content-Disposition",
                ContentDisposition.inline()
                    .filename(fileId + (content.mime().equals("application/pdf") ? ".pdf" : ""))
                    .build()
                    .toString()
            )
            .contentType(MediaType.parseMediaType(content.mime()))
            .body(content.bytes());
    }

    @PostMapping(value = "/{id}/files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public AttachmentRecords.Attachment upload(
        @PathVariable UUID id,
        @RequestParam MultipartFile file,
        @RequestParam(required = false) String caption
    ) throws IOException {
        return service.upload(id, file.getBytes(), caption);
    }

    @PutMapping("/{id}/files/{fileId}/primary")
    public List<AttachmentRecords.Attachment> primary(@PathVariable UUID id, @PathVariable UUID fileId) {
        return service.makePrimary(id, fileId);
    }

    @DeleteMapping("/{id}/files/{fileId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteFile(@PathVariable UUID id, @PathVariable UUID fileId) {
        service.deleteFile(id, fileId);
    }
}
