package com.policemanagement.com.web.rest;

import com.policemanagement.com.service.subject.SubjectService;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Subjects under management (Quản lý đối tượng) of the hamlet named by {@code hamletId}. */
@RestController
@RequestMapping("/api/subjects")
public class SubjectResource {

    private final SubjectService service;

    public SubjectResource(SubjectService service) {
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
    public Map<String, Object> create(@RequestBody Map<String, Object> data) {
        return service.create(data);
    }

    @PutMapping("/{id}")
    public Map<String, Object> update(@PathVariable UUID id, @RequestBody Map<String, Object> data) {
        return service.update(id, data);
    }

    @PostMapping("/{id}/end")
    public Map<String, Object> end(@PathVariable UUID id, @RequestBody Map<String, Object> data) {
        return service.end(id, data);
    }

    @PostMapping("/{id}/records")
    public Map<String, Object> addRecord(@PathVariable UUID id, @RequestBody Map<String, Object> data) {
        return service.addRecord(id, data);
    }

    @PostMapping("/{id}/summons")
    public Map<String, Object> addSummon(@PathVariable UUID id, @RequestBody Map<String, Object> data) {
        return service.addSummon(id, data);
    }
}
