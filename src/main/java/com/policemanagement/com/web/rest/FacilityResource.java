package com.policemanagement.com.web.rest;

import com.policemanagement.com.service.AttachmentRecords;
import com.policemanagement.com.service.facility.FacilityService;
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

/** Establishments (CSKD có điều kiện, cơ sở và doanh nghiệp) of the hamlet named by {@code hamletId}. */
@RestController
@RequestMapping("/api/facilities")
public class FacilityResource {

    private final FacilityService service;

    public FacilityResource(FacilityService service) {
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

    @PostMapping("/{id}/employees")
    public Map<String, Object> addEmployee(@PathVariable UUID id, @RequestBody Map<String, Object> data) {
        return service.addEmployee(id, data);
    }

    @PostMapping("/{id}/employees/{employeeId}/end")
    public Map<String, Object> endEmployee(@PathVariable UUID id, @PathVariable UUID employeeId, @RequestBody Map<String, Object> data) {
        return service.endEmployee(id, employeeId, data);
    }

    @PostMapping("/{id}/violations")
    public Map<String, Object> addViolation(@PathVariable UUID id, @RequestBody Map<String, Object> data) {
        return service.addViolation(id, data);
    }

    @GetMapping("/{id}/attachments")
    public ResponseEntity<List<AttachmentRecords.Attachment>> attachments(@PathVariable UUID id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.attachments(id));
    }

    @GetMapping("/{id}/attachments/{attachmentId}/content")
    public ResponseEntity<byte[]> content(@PathVariable UUID id, @PathVariable UUID attachmentId) {
        var content = service.attachment(id, attachmentId);
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .header("X-Content-Type-Options", "nosniff")
            // PDFs open inline in the browser viewer, never as a page of this origin.
            .header("Content-Security-Policy", "sandbox")
            .header(
                "Content-Disposition",
                ContentDisposition.inline()
                    .filename(attachmentId + (content.mime().equals("application/pdf") ? ".pdf" : ""))
                    .build()
                    .toString()
            )
            .contentType(MediaType.parseMediaType(content.mime()))
            .body(content.bytes());
    }

    @PostMapping(value = "/{id}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public AttachmentRecords.Attachment upload(
        @PathVariable UUID id,
        @RequestParam MultipartFile file,
        @RequestParam(required = false) String caption
    ) throws IOException {
        return service.upload(id, file.getBytes(), caption);
    }

    @PutMapping("/{id}/attachments/{attachmentId}/primary")
    public List<AttachmentRecords.Attachment> primary(@PathVariable UUID id, @PathVariable UUID attachmentId) {
        return service.makePrimary(id, attachmentId);
    }

    @DeleteMapping("/{id}/attachments/{attachmentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, @PathVariable UUID attachmentId) {
        service.deleteAttachment(id, attachmentId);
    }
}
