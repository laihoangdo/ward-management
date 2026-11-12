package com.policemanagement.com.web.rest;

import com.policemanagement.com.service.roster.RosterMapService;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/roster")
public class RosterMapResource {

    private final RosterMapService service;

    public RosterMapResource(RosterMapService service) {
        this.service = service;
    }

    /** Households with a recorded position (linked building or verified coordinate), the hamlet boundary and the unlocated count. */
    @GetMapping("/map")
    public Map<String, Object> map() {
        return service.map();
    }
}
