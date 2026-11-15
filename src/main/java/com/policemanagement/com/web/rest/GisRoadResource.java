package com.policemanagement.com.web.rest;

import com.policemanagement.com.service.gis.GisRoadService;
import java.util.concurrent.TimeUnit;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

/** Road network for on-device routing on the field map (© OpenStreetMap contributors, ODbL). */
@RestController
public class GisRoadResource {

    private final GisRoadService service;

    public GisRoadResource(GisRoadService service) {
        this.service = service;
    }

    @GetMapping("/api/gis/roads")
    public ResponseEntity<String> roads(@RequestHeader(value = "If-None-Match", required = false) String ifNoneMatch) {
        var roads = service.roads();
        var cache = CacheControl.maxAge(1, TimeUnit.DAYS).cachePrivate();
        if (roads.etag().equals(ifNoneMatch)) return ResponseEntity.status(HttpStatus.NOT_MODIFIED)
            .eTag(roads.etag())
            .cacheControl(cache)
            .build();
        return ResponseEntity.ok().eTag(roads.etag()).cacheControl(cache).contentType(MediaType.APPLICATION_JSON).body(roads.geojson());
    }
}
