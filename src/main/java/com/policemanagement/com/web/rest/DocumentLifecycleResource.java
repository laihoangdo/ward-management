package com.policemanagement.com.web.rest;

import com.policemanagement.com.service.DocumentLifecycleService;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/legal-documents")
public class DocumentLifecycleResource {

    private final DocumentLifecycleService service;

    public DocumentLifecycleResource(DocumentLifecycleService service) {
        this.service = service;
    }

    @PostMapping
    public Map<String, Long> register(@RequestBody DocumentLifecycleService.Command command) {
        return Map.of("id", service.register(command));
    }

    @PostMapping("/{id}/confirm-or-renew")
    public Map<String, Long> confirmOrRenew(@PathVariable Long id, @RequestBody DocumentLifecycleService.Command command) {
        return Map.of("id", service.confirmOrRenew(id, command));
    }

    @GetMapping("/{id}/history")
    public List<Map<String, Object>> history(@PathVariable Long id, @RequestParam(defaultValue = "0") int page) {
        return service.history(id, page);
    }
}
