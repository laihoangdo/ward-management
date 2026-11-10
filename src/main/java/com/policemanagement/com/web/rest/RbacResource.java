package com.policemanagement.com.web.rest;

import com.policemanagement.com.service.HamletService;
import com.policemanagement.com.service.dto.HamletDTO;
import com.policemanagement.com.service.rbac.RbacEventHub;
import com.policemanagement.com.service.rbac.RbacService;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/rbac")
public class RbacResource {

    private final RbacService rbac;
    private final RbacEventHub events;
    private final HamletService areas;
    private final com.policemanagement.com.service.HouseholdQueryService households;
    private final com.policemanagement.com.service.ResidentQueryService residents;
    private static final Set<String> KINDS = Set.of("menus", "whitelist", "blacklist", "alerts", "units");

    public RbacResource(
        RbacService rbac,
        HamletService areas,
        com.policemanagement.com.service.HouseholdQueryService households,
        com.policemanagement.com.service.ResidentQueryService residents,
        RbacEventHub events
    ) {
        this.rbac = rbac;
        this.areas = areas;
        this.households = households;
        this.residents = residents;
        this.events = events;
    }

    @GetMapping("/export/{kind}")
    public org.springframework.http.ResponseEntity<String> export(@PathVariable String kind) {
        rbac.permission("canExportReports");
        if (!Set.of("households", "residents").contains(kind)) throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "Loại báo cáo không hợp lệ"
        );
        var lines = new StringBuilder("\uFEFF");
        List<String> fields = kind.equals("households")
            ? List.of("code", "houseNumber", "street", "hamlet", "ownerName", "ownerPhone", "type", "residentsCount", "status")
            : List.of("id", "fullName", "birthYear", "gender", "residenceType");
        lines.append(String.join(",", fields)).append("\r\n");
        for (int number = 0; ; number++) {
            var pageable = org.springframework.data.domain.PageRequest.of(number, 500, org.springframework.data.domain.Sort.by("id"));
            org.springframework.data.domain.Page<?> page = kind.equals("households")
                ? households.findByCriteria(null, pageable)
                : residents.findByCriteria(null, pageable);
            for (Object dto : page.getContent()) {
                Map<String, Object> row = rbac.decode(rbac.encode(dto));
                lines
                    .append(
                        fields
                            .stream()
                            .map(f -> csv(row.get(f)))
                            .collect(java.util.stream.Collectors.joining(","))
                    )
                    .append("\r\n");
            }
            if (!page.hasNext()) break;
        }
        rbac.audit("export", kind, Map.of("scope", "authorized"));
        return org.springframework.http.ResponseEntity.ok()
            .header("Content-Disposition", "attachment; filename=" + kind + ".csv")
            .contentType(org.springframework.http.MediaType.parseMediaType("text/csv;charset=UTF-8"))
            .body(lines.toString());
    }

    private String csv(Object value) {
        String text = Objects.toString(value, "");
        if (text.matches("^[=+@\\-\\t\\r].*")) text = "'" + text;
        return "\"" + text.replace("\"", "\"\"") + "\"";
    }

    @org.springframework.transaction.annotation.Transactional
    @PostMapping("/documents/{id}/reminder")
    public void reminder(@PathVariable Long id) {
        rbac.permission("canSendReminders");
        rbac.record("document", id);
        String key = UUID.randomUUID().toString();
        rbac.database().update(
            "insert into rbac_setting(kind,id,data) values ('reminders',?,?)",
            key,
            rbac.encode(
                Map.of("documentId", id, "createdBy", rbac.subject(), "createdAt", java.time.Instant.now().toString(), "status", "pending")
            )
        );
        rbac.audit("reminder-requested", id.toString(), Map.of("status", "pending"));
    }

    @GetMapping("/me")
    public Map<String, Object> me() {
        return rbac.current();
    }

    // Account details are separate from roles, permissions and territory assignments.
    @PutMapping("/me/account")
    public Map<String, Object> updateAccount(@RequestBody Map<String, Object> data) {
        return rbac.updateOwnAccount(data);
    }

    @GetMapping("/policy")
    public Object policy() {
        rbac.superadmin();
        return rbac
            .settings("policy")
            .stream()
            .findFirst()
            .orElse(Map.of("id", "access", "emailWhitelistEnabled", false));
    }

    @PutMapping("/policy")
    public void policy(@RequestBody Map<String, Object> data) {
        rbac.superadmin();
        rbac.saveSetting("policy", Map.of("id", "access", "emailWhitelistEnabled", Boolean.TRUE.equals(data.get("emailWhitelistEnabled"))));
    }

    @GetMapping("/users")
    public List<Map<String, Object>> users() {
        return rbac.users();
    }

    @PostMapping("/users")
    public Map<String, Object> save(@RequestBody Map<String, Object> user) {
        return rbac.saveUser(user);
    }

    @PutMapping("/users/{id}/delegation")
    public Map<String, Object> delegation(@PathVariable String id, @RequestBody Map<String, Object> data) {
        return rbac.saveProfile(id, data);
    }

    @DeleteMapping("/users/{id}")
    public void delete(@PathVariable String id) {
        rbac.deleteUser(id);
    }

    @GetMapping("/areas")
    public Object areas() {
        return areas.findAll();
    }

    @GetMapping("/delegation-areas")
    public Object delegationAreas() {
        rbac.current();
        return rbac
            .database()
            .queryForList(
                "select h.id, h.id as \"hamletId\", h.full_name as name, h.full_name as \"hamletName\", h.commune_id as \"communeId\" from hamlet h where h.valid_to is null order by h.commune_id, h.sort_order, h.id"
            );
    }

    @GetMapping("/delegation-roads")
    public List<DelegationRoad> delegationRoads() {
        rbac.current();
        return households
            .findByCriteria(
                new com.policemanagement.com.service.criteria.HouseholdCriteria(),
                org.springframework.data.domain.Pageable.unpaged()
            )
            .stream()
            .filter(h -> h.getHamletId() != null)
            .flatMap(h ->
                java.util.stream.Stream.of(h.getStreet(), h.getAlley())
                    .filter(name -> name != null && !name.isBlank())
                    .map(name -> new DelegationRoad(h.getHamletId(), name))
            )
            .distinct()
            .sorted(Comparator.comparing(DelegationRoad::name).thenComparing(DelegationRoad::hamletId))
            .toList();
    }

    public record DelegationRoad(Long hamletId, String name) {}

    @GetMapping("/audit")
    public Object audit() {
        rbac.superadmin();
        return rbac.database().queryForList("select id,actor,action,target,occurred_at from rbac_audit order by id desc limit 500");
    }

    @org.springframework.transaction.annotation.Transactional
    @PutMapping("/record-scope/{kind}/{id}/{subject}")
    public void recordScope(@PathVariable String kind, @PathVariable Long id, @PathVariable String subject) {
        rbac.superadmin();
        if (!Set.of("document", "alert", "patrol").contains(kind)) throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "Loại hồ sơ không hợp lệ"
        );
        String table = Map.of("document", "document_record", "alert", "security_alert", "patrol", "patrol_log").get(kind);
        if (
            rbac.database().queryForObject("select count(*) from " + table + " where id=?", Long.class, id) != 1
        ) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Hồ sơ không tồn tại");
        if (rbac.assignments(subject).isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cán bộ chưa có địa bàn");
        // Serialize ownership changes so the notification always includes the holder being revoked.
        rbac.database().execute("lock table rbac_record_scope in share row exclusive mode");
        var affected = new HashSet<>(
            rbac.database().queryForList("select subject from rbac_record_scope where kind=? and record_id=?", String.class, kind, id)
        );
        affected.add(subject);
        rbac.database().update(
            "insert into rbac_record_scope(kind,record_id,subject) values (?,?,?) on conflict(kind,record_id) do update set subject=excluded.subject",
            kind,
            id,
            subject
        );
        rbac.audit("record-scope", kind + ":" + id, Map.of("subject", subject));
        affected.forEach(target -> events.afterCommit(new RbacEventHub.Change(target, Set.of("me"), null, true)));
    }

    private void kind(String kind) {
        if (!KINDS.contains(kind)) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    }

    @GetMapping("/settings/{kind}")
    public Object settings(@PathVariable String kind) {
        kind(kind);
        if (kind.equals("menus")) {
            rbac.current();
            return rbac
                .settings(kind)
                .stream()
                .filter(menu -> !Set.of("spatial-3d-map", "vietmap-compare").contains(Objects.toString(menu.get("id"), "")))
                .toList();
        }
        rbac.superadmin();
        if (kind.equals("units")) {
            return areas
                .findAll()
                .stream()
                .map(area -> {
                    Map<String, Object> unit = new LinkedHashMap<>();
                    unit.put("id", area.getId().toString());
                    unit.put("hamlet", area.getHamletName());
                    unit.put("ward", area.getName());
                    unit.put("district", "");
                    unit.put("streetsAndAlleys", List.of());
                    unit.put(
                        "totalHouseholds",
                        rbac.database().queryForObject("select count(*) from household where hamlet_id=?", Long.class, area.getId())
                    );
                    unit.put("officerInChargeName", Objects.toString(area.getOfficerInCharge(), ""));
                    unit.put("updatedAt", "");
                    rbac.settings("units")
                        .stream()
                        .filter(u -> area.getId().toString().equals(u.get("id")))
                        .findFirst()
                        .ifPresent(unit::putAll);
                    unit.put(
                        "totalHouseholds",
                        rbac.database().queryForObject("select count(*) from household where hamlet_id=?", Long.class, area.getId())
                    );
                    return unit;
                })
                .toList();
        }
        return rbac.settings(kind);
    }

    @org.springframework.transaction.annotation.Transactional
    @PutMapping("/settings/menus")
    public void menus(@RequestBody List<Map<String, Object>> menus) {
        rbac.superadmin();
        for (var menu : menus) {
            if (!MenuCatalog.IDS.contains(menu.get("id"))) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Menu không hợp lệ");
        }
        for (var menu : menus) rbac.saveSetting("menus", menu);
    }

    @org.springframework.transaction.annotation.Transactional
    @PostMapping("/settings/{kind}")
    public Object setting(@PathVariable String kind, @RequestBody Map<String, Object> data) {
        kind(kind);
        rbac.superadmin();
        if (kind.equals("blacklist")) {
            String ip = String.valueOf(data.get("ipAddress"));
            if (!ip.matches("[0-9a-fA-F:.]{3,45}")) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Địa chỉ IP không hợp lệ");
            try {
                data.put("ipAddress", java.net.InetAddress.getByName(ip).getHostAddress());
            } catch (Exception ex) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Địa chỉ IP không hợp lệ");
            }
            data.put("blockedBy", rbac.current().get("username"));
            data.put("blockedAt", java.time.Instant.now().toString());
        }
        if (kind.equals("alerts")) {
            data.put("timestamp", java.time.Instant.now().toString());
            data.put("emailNotified", false);
            data.put("resolvedBy", rbac.current().get("username"));
        }
        if (kind.equals("whitelist")) {
            String email = Objects.toString(data.get("email"), "").trim().toLowerCase(Locale.ROOT);
            if (!email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")) throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Email không hợp lệ"
            );
            data.put("email", email);
            data.put("addedBy", rbac.current().get("username"));
        }
        if (kind.equals("units")) {
            HamletDTO area = new HamletDTO();
            String id = String.valueOf(data.getOrDefault("id", ""));
            if (id.matches("\\d+")) area = areas
                .findOne(Long.valueOf(id))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
            if (area.getId() == null) {
                var matches = areas
                    .findAll()
                    .stream()
                    .filter(h -> Objects.equals(h.getHamletName(), data.get("hamlet")))
                    .toList();
                if (matches.size() != 1) throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Select an existing administrative hamlet"
                );
                area = matches.getFirst();
            }
            area.setCode(area.getCode() == null ? "AREA-" + UUID.randomUUID() : area.getCode());
            // Management settings cannot rename the official administrative directory.
            data.put("ward", area.getName());
            data.put("hamlet", area.getHamletName());
            area.setOfficerInCharge(String.valueOf(data.getOrDefault("officerInChargeName", "")));
            if (area.getName().isBlank() || area.getHamletName().isBlank()) throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Nhập tên đơn vị và địa bàn"
            );
            area = area.getId() == null ? areas.save(area) : areas.update(area);
            data.put("id", area.getId().toString());
        }
        rbac.saveSetting(kind, data);
        return data;
    }

    @org.springframework.transaction.annotation.Transactional
    @DeleteMapping("/settings/{kind}/{id}")
    public void deleteSetting(@PathVariable String kind, @PathVariable String id) {
        kind(kind);
        rbac.superadmin();
        if (kind.equals("units")) areas.delete(Long.valueOf(id));
        rbac.deleteSetting(kind, id);
    }
}
