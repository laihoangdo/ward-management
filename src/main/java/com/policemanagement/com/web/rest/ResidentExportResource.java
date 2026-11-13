package com.policemanagement.com.web.rest;

import com.policemanagement.com.service.roster.ResidentExportService;
import com.policemanagement.com.service.roster.ResidentFilter;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Filtered resident lists: live preview, Excel download and print view. All require {@code canExportReports}. */
@RestController
@RequestMapping("/api/roster/residents/export")
public class ResidentExportResource {

    private static final MediaType XLSX = MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private final ResidentExportService service;

    public ResidentExportResource(ResidentExportService service) {
        this.service = service;
    }

    @GetMapping("/preview")
    public ResidentExportService.Export preview(@RequestParam Map<String, String> params) {
        return service.preview(ResidentFilter.parse(params), params.get("columns"));
    }

    @GetMapping("/print")
    public ResponseEntity<ResidentExportService.Export> print(@RequestParam Map<String, String> params) {
        var export = service.print(ResidentFilter.parse(params), params.get("columns"), "true".equals(params.get("fullIdentity")));
        return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL, "no-store").body(export);
    }

    @GetMapping("/xlsx")
    public ResponseEntity<byte[]> xlsx(@RequestParam Map<String, String> params) {
        var file = service.xlsx(
            ResidentFilter.parse(params),
            params.get("columns"),
            "true".equals(params.get("fullIdentity")),
            "share".equals(params.get("purpose"))
        );
        return ResponseEntity.ok()
            .contentType(XLSX)
            .header(HttpHeaders.CACHE_CONTROL, "no-store")
            .header(
                HttpHeaders.CONTENT_DISPOSITION,
                ContentDisposition.attachment().filename(file.name(), StandardCharsets.UTF_8).build().toString()
            )
            .body(file.content());
    }

    /** Column catalogue, default columns and the hamlet's recorded classifications for the export form. */
    @GetMapping("/options")
    public Map<String, Object> options() {
        return service.options();
    }
}
