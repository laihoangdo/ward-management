package com.policemanagement.com.web.rest;

import com.policemanagement.com.service.roster.RosterMapService;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

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

    /** Saves a building drawn on the roster map, optionally linking a household to it ({@code move} confirms a move). */
    @PostMapping("/map/buildings")
    public Map<String, Object> create(@RequestBody Map<String, Object> body) {
        return service.create(body);
    }

    /** Links a household to a saved building; {@code move=true} confirms moving it out of its current building. */
    @PostMapping("/map/buildings/{buildingId}/households")
    public Map<String, Object> link(@PathVariable String buildingId, @RequestBody Map<String, Object> body) {
        UUID household;
        try {
            household = UUID.fromString(String.valueOf(body.get("householdId")));
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mã hộ không hợp lệ");
        }
        return service.link(buildingId, household, Boolean.TRUE.equals(body.get("move")));
    }

    @DeleteMapping("/map/buildings/{buildingId}/households/{householdId}")
    public ResponseEntity<Void> unlink(@PathVariable String buildingId, @PathVariable UUID householdId) {
        service.unlink(buildingId, householdId);
        return ResponseEntity.noContent().build();
    }
}
