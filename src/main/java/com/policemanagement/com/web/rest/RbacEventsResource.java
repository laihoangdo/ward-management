package com.policemanagement.com.web.rest;

import com.policemanagement.com.service.rbac.RbacEventHub;
import com.policemanagement.com.service.rbac.RbacService;
import java.io.IOException;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/rbac")
public class RbacEventsResource {

    private final RbacService rbac;
    private final RbacEventHub events;

    public RbacEventsResource(RbacService rbac, RbacEventHub events) {
        this.rbac = rbac;
        this.events = events;
    }

    @GetMapping(value = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<SseEmitter> events() throws IOException {
        rbac.current();
        return ResponseEntity.ok()
            .contentType(MediaType.TEXT_EVENT_STREAM)
            .cacheControl(CacheControl.noStore())
            .header("X-Accel-Buffering", "no")
            .body(events.open(rbac.subject()));
    }
}
