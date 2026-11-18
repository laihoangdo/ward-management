package com.policemanagement.com.web.rest;

import com.policemanagement.com.service.roster.ResidentTagService;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Social standing tags of a resident, and the household categories the area map colours by. */
@RestController
public class ResidentTagResource {

    private final ResidentTagService service;

    public ResidentTagResource(ResidentTagService service) {
        this.service = service;
    }

    @GetMapping("/api/roster/residents/{residentId}/tags")
    public List<String> tags(@PathVariable UUID residentId) {
        return service.tags(residentId);
    }

    @PutMapping("/api/roster/residents/{residentId}/tags")
    public List<String> save(@PathVariable UUID residentId, @RequestBody Map<String, Object> body) {
        return service.save(residentId, body.get("tags") instanceof List<?> list ? list : List.of());
    }

    @GetMapping("/api/gis/household-categories")
    public ResponseEntity<Map<String, Object>> mapCategories() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.mapCategories());
    }
}
