package com.policemanagement.com.web.rest;

import com.policemanagement.com.service.roster.RosterService;
import java.io.IOException;
import java.util.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/roster")
public class RosterResource {

    private final RosterService service;

    public RosterResource(RosterService service) {
        this.service = service;
    }

    @GetMapping("/overview")
    public Map<String, Object> overview() {
        return service.overview();
    }

    @GetMapping("/collections")
    public List<Map<String, Object>> collections() {
        return service.collections();
    }

    @PostMapping(value = "/collections", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> upload(
        @RequestParam MultipartFile[] files,
        @RequestParam List<String> legacyHamlets,
        @RequestParam String label,
        @RequestParam(required = false) String sourceDate
    ) throws IOException {
        service.authorize("canAddHouseholds");
        if (files.length != legacyHamlets.size()) throw new IllegalArgumentException("Thiếu mapping ấp nguồn");
        var uploads = new ArrayList<RosterService.Upload>();
        for (int i = 0; i < files.length; i++) {
            String name = Objects.toString(files[i].getOriginalFilename(), "source.xlsx");
            if (!name.toLowerCase(Locale.ROOT).endsWith(".xlsx") || files[i].getSize() > 10_000_000) throw new IllegalArgumentException(
                "Chỉ hỗ trợ XLSX tối đa 10 MB/file"
            );
            uploads.add(new RosterService.Upload(name, legacyHamlets.get(i), files[i].getBytes()));
        }
        return service.stage(uploads, label, sourceDate);
    }

    @GetMapping("/collections/{id}")
    public Map<String, Object> collection(@PathVariable UUID id) {
        return service.collection(id);
    }

    @GetMapping("/collections/{id}/rows")
    public List<Map<String, Object>> rows(
        @PathVariable UUID id,
        @RequestParam(defaultValue = "REVIEW") String status,
        @RequestParam(defaultValue = "0") int page
    ) {
        return service.rows(id, status, page);
    }

    @PostMapping("/collections/{id}/apply")
    public Map<String, Object> apply(@PathVariable UUID id) {
        return service.apply(id);
    }

    @GetMapping("/source/{id}")
    public Map<String, Object> source(@PathVariable UUID id) {
        return service.source(id);
    }

    @PostMapping("/source/{id}/review")
    public void review(@PathVariable UUID id, @RequestBody Map<String, Object> input) {
        service.review(id, input);
    }

    @GetMapping("/households")
    public Map<String, Object> households(
        @RequestParam(defaultValue = "") String search,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "") String origin,
        @RequestParam(defaultValue = "") String category
    ) {
        return service.households(search, page, origin, category);
    }

    @GetMapping("/households/{id}")
    public Map<String, Object> household(@PathVariable UUID id) {
        return service.household(id);
    }

    @GetMapping("/legacy-households/{id}")
    public Map<String, Object> legacyHousehold(@PathVariable long id) {
        return service.legacyHousehold(id);
    }

    @PostMapping("/households")
    public Map<String, Object> createHousehold(@RequestBody Map<String, Object> data) {
        return service.createHousehold(data);
    }

    @PutMapping("/households/{id}")
    public Map<String, Object> updateHousehold(@PathVariable UUID id, @RequestBody Map<String, Object> data) {
        return service.updateHousehold(id, data);
    }

    @PostMapping("/households/{id}/members")
    public Map<String, Object> addMember(@PathVariable UUID id, @RequestBody Map<String, Object> data) {
        return service.addMember(id, data);
    }

    @GetMapping("/residents/search")
    public List<Map<String, Object>> find(@RequestParam String search) {
        return service.findPeople(search);
    }

    @GetMapping("/residents")
    public Map<String, Object> residents(
        @RequestParam(defaultValue = "") String search,
        @RequestParam(defaultValue = "") String kind,
        @RequestParam(defaultValue = "") String origin,
        @RequestParam(defaultValue = "0") int page
    ) {
        return service.residents(search, kind, origin, page);
    }

    @PostMapping("/residents")
    public Map<String, Object> createResident(@RequestBody Map<String, Object> data) {
        return service.createResident(data);
    }

    @PostMapping("/memberships/{id}/transfer")
    public Map<String, Object> transfer(@PathVariable UUID id, @RequestBody Map<String, Object> data) {
        return service.transferMember(id, data);
    }

    @GetMapping("/entity-history/{type}/{id}")
    public List<Map<String, Object>> entityHistory(
        @PathVariable String type,
        @PathVariable UUID id,
        @RequestParam(defaultValue = "0") int page
    ) {
        return service.entityHistory(type, id, page);
    }

    @GetMapping("/residents/{id}")
    public Map<String, Object> resident(@PathVariable UUID id) {
        return service.resident(id);
    }

    @PostMapping("/residents/{id}/records")
    public Map<String, Object> addRecord(@PathVariable UUID id, @RequestBody Map<String, Object> data) {
        return service.addRecord(id, data);
    }

    @PostMapping("/residents/{id}/identities")
    public Map<String, Object> addIdentity(@PathVariable UUID id, @RequestBody Map<String, Object> data) {
        return service.addIdentity(id, data);
    }

    @PutMapping("/residents/{id}")
    public Map<String, Object> updateResident(@PathVariable UUID id, @RequestBody Map<String, Object> data) {
        return service.updateResident(id, data);
    }

    @PutMapping("/memberships/{id}")
    public Map<String, Object> updateMembership(@PathVariable UUID id, @RequestBody Map<String, Object> data) {
        return service.updateMembership(id, data);
    }

    @PutMapping("/records/{id}")
    public Map<String, Object> updateRecord(@PathVariable UUID id, @RequestBody Map<String, Object> data) {
        return service.updateRecord(id, data);
    }

    @PostMapping("/residents/{id}/verifications")
    public void verify(@PathVariable UUID id, @RequestBody Map<String, Object> data) {
        service.verify(id, data);
    }

    @GetMapping("/history")
    public List<Map<String, Object>> history(
        @RequestParam String from,
        @RequestParam String to,
        @RequestParam(defaultValue = "0") int page
    ) {
        return service.history(from, to, page);
    }

    @GetMapping("/report")
    public Map<String, Object> report(@RequestParam String from, @RequestParam String to) {
        return service.report(from, to);
    }

    @GetMapping(value = "/report.csv", produces = "text/csv;charset=UTF-8")
    public ResponseEntity<String> csv(@RequestParam String from, @RequestParam String to) {
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=tc2-changes.csv")
            .body(service.reportCsv(from, to));
    }

    @GetMapping("/map")
    public Map<String, Object> map() {
        return service.map();
    }

    @GetMapping(value = "/report-detail.csv", produces = "text/csv;charset=UTF-8")
    public ResponseEntity<String> detailedCsv(@RequestParam String from, @RequestParam String to) {
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=tc2-change-details.csv")
            .body(service.detailedCsv(from, to));
    }

    @ExceptionHandler({ IllegalArgumentException.class, java.time.DateTimeException.class })
    public ResponseEntity<Map<String, String>> invalid(RuntimeException ex) {
        return ResponseEntity.badRequest().body(
            Map.of("message", "Dữ liệu hoặc cấu trúc file không hợp lệ. Kiểm tra trường nhập và mapping.")
        );
    }

    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> conflict() {
        return ResponseEntity.status(409).body(
            Map.of("message", "Trùng khóa hoặc quan hệ/ngày tháng không hợp lệ. Dữ liệu chưa được lưu; hãy đối chiếu lại.")
        );
    }
}
