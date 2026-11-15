package com.policemanagement.com.web.rest;

import com.policemanagement.com.service.export.ListExportService;
import com.policemanagement.com.service.export.ListSheet;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Printable / Excel lists by category. Each list lives under its screen's API so the hamlet scope travels the same way as the
 * screen's own requests: /api/subjects/export, /api/facilities/export and /api/guidance-documents/export.
 */
@RestController
public class ListExportResource {

    private static final MediaType XLSX = MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    private static final Map<String, String> KIND = Map.of(
        "subjects",
        "subjects",
        "facilities",
        "facilities",
        "guidance-documents",
        "guidance"
    );

    private final ListExportService service;

    public ListExportResource(ListExportService service) {
        this.service = service;
    }

    @GetMapping("/api/{screen:subjects|facilities|guidance-documents}/export/print")
    public ResponseEntity<ListSheet> print(@PathVariable String screen, @RequestParam Map<String, String> filter) {
        return ResponseEntity.ok()
            .header(HttpHeaders.CACHE_CONTROL, "no-store")
            .body(service.sheet(KIND.get(screen), filter, "print"));
    }

    @GetMapping("/api/{screen:subjects|facilities|guidance-documents}/export/xlsx")
    public ResponseEntity<byte[]> xlsx(@PathVariable String screen, @RequestParam Map<String, String> filter) {
        var file = service.xlsx(KIND.get(screen), filter);
        return ResponseEntity.ok()
            .contentType(XLSX)
            .header(HttpHeaders.CACHE_CONTROL, "no-store")
            .header(
                HttpHeaders.CONTENT_DISPOSITION,
                ContentDisposition.attachment().filename(file.name(), StandardCharsets.UTF_8).build().toString()
            )
            .body(file.content());
    }
}
