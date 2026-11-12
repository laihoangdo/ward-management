package com.policemanagement.com.web.rest;

import com.policemanagement.com.service.roster.RosterPatrolService;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/roster/patrol")
public class RosterPatrolResource {

    private final RosterPatrolService service;

    public RosterPatrolResource(RosterPatrolService service) {
        this.service = service;
    }

    /** Households within {@code radius} metres (10–200, default 50) of the officer, nearest first. */
    @GetMapping("/nearby")
    public List<Map<String, Object>> nearby(
        @RequestParam double latitude,
        @RequestParam double longitude,
        @RequestParam(required = false) Integer radius,
        @RequestParam(defaultValue = "false") boolean reliableOnly
    ) {
        return service.nearby(latitude, longitude, radius, reliableOnly);
    }

    /** Officer confirms at the door that the household belongs to its linked building. */
    @PostMapping("/confirm-position")
    public Map<String, Object> confirmPosition(@RequestBody Map<String, Object> data) {
        return service.confirmPosition(data);
    }

    @PostMapping("/check-in")
    public Map<String, Object> checkIn(@RequestBody Map<String, Object> data) {
        return service.checkIn(data);
    }
}
