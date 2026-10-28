package com.policemanagement.com.service.rbac;

import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Service
public class RbacService {

    public static final List<String> PERMISSIONS = List.of(
        "canViewAdvancedMap",
        "canViewField3DMap",
        "canEditCoordinates",
        "canAddHouseholds",
        "canScanOcr",
        "canRenewDocs",
        "canExportReports",
        "canSendReminders",
        "canUpdateInspection",
        "canManageStreets"
    );
    private static final Set<String> MAP_VIEW_PERMISSIONS = Set.of("canViewAdvancedMap", "canViewField3DMap");
    private final JdbcTemplate db;
    private final ObjectMapper json;
    private final KeycloakAdminClient kc;

    @org.springframework.beans.factory.annotation.Autowired
    private RbacFailureAudit failureAudit;

    private com.policemanagement.com.service.PostgisSpatialService spatial;

    @org.springframework.beans.factory.annotation.Autowired
    public void setSpatial(com.policemanagement.com.service.PostgisSpatialService spatial) {
        this.spatial = spatial;
    }

    public RbacService(JdbcTemplate db, ObjectMapper json, KeycloakAdminClient kc) {
        this.db = db;
        this.json = json;
        this.kc = kc;
    }

    public Map<String, Object> decode(String text) {
        return json.readValue(text, Map.class);
    }

    public String encode(Object data) {
        return json.writeValueAsString(data);
    }

    public String subject() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof JwtAuthenticationToken jwt) return jwt.getToken().getSubject();
        if (auth != null && auth.getPrincipal() instanceof OidcUser oidc) return oidc.getSubject();
        throw new AccessDeniedException("Cần phiên OIDC hợp lệ");
    }

    public Map<String, Object> current() {
        var request = RequestContextHolder.getRequestAttributes();
        if (request != null && request.getAttribute("rbac.current", RequestAttributes.SCOPE_REQUEST) instanceof Map cached) return cached;
        String id = subject();
        var user = kc.user(id);
        if (!Boolean.TRUE.equals(user.get("enabled"))) throw new AccessDeniedException("Tài khoản đã bị khóa");
        Map<String, Object> result = profile(user);
        if ("none".equals(result.get("role"))) throw new AccessDeniedException("Chưa được cấp vai trò nghiệp vụ");
        if (!"active".equals(result.get("status"))) throw new AccessDeniedException("Tài khoản chưa hoàn tất cấp quyền");
        if (request != null) request.setAttribute("rbac.current", result, RequestAttributes.SCOPE_REQUEST);
        return result;
    }

    public boolean global() {
        return "superadmin".equals(current().get("role"));
    }

    public void superadmin() {
        if (!global()) throw new AccessDeniedException("Cần quyền Super Admin");
    }

    public boolean supervisor() {
        return List.of("superadmin", "admin", "sub-admin").contains(current().get("role"));
    }

    public void permission(String name) {
        if (global()) return;
        var permissions = (Map<?, ?>) current().get("subAdminPermissions");
        if (permissions == null || !Boolean.TRUE.equals(permissions.get(name))) throw new AccessDeniedException(
            "Chưa được cấp quyền: " + name
        );
    }

    public List<Long> areas() {
        return assignments((String) current().get("id"));
    }

    public List<Long> assignments(String id) {
        return db.queryForList("select hamlet_id from rbac_assignment where subject=? order by hamlet_id", Long.class, id);
    }

    public void area(Long id) {
        if (!global() && (id == null || !areas().contains(id))) throw new AccessDeniedException("Ngoài địa bàn được phân công");
    }

    public List<JsonNode> mapTerritories() {
        if (global()) return List.of();
        var request = RequestContextHolder.getRequestAttributes();
        if (
            request != null && request.getAttribute("rbac.mapTerritories", RequestAttributes.SCOPE_REQUEST) instanceof List cached
        ) return cached;
        var ids = areas();
        var result = new ArrayList<JsonNode>();
        for (var row : db.queryForList("select id, boundary_geo_json from hamlet where boundary_geo_json is not null")) {
            if (!ids.contains(((Number) row.get("id")).longValue())) continue;
            try {
                result.add(json.readTree(row.get("boundary_geo_json").toString()));
            } catch (RuntimeException ex) {
                /* Invalid or missing boundaries do not grant geographic access. */
            }
        }
        if (request != null) request.setAttribute("rbac.mapTerritories", result, RequestAttributes.SCOPE_REQUEST);
        return result;
    }

    public boolean canManageMapGeometry(JsonNode geometry) {
        if (global()) return true;
        // During cutover both engines must approve; enabling PostGIS must never widen access.
        return (
            (spatial == null || !spatial.enabled() || spatial.covered(geometry, areas())) &&
            TerritoryGeometry.covered(geometry, mapTerritories())
        );
    }

    public void mapGeometry(JsonNode geometry) {
        if (!canManageMapGeometry(geometry)) throw new AccessDeniedException(
            "Công trình ngoài địa bàn hoặc ấp chưa có ranh giới để xác minh"
        );
    }

    public void mapCoordinate(Number lat, Number lng) {
        if (
            !global() &&
            (lat == null ||
                lng == null ||
                (spatial != null && spatial.enabled() && !spatial.contains(lat, lng, areas())) ||
                !TerritoryGeometry.contains(lat.doubleValue(), lng.doubleValue(), mapTerritories()))
        ) {
            throw new AccessDeniedException("Tọa độ ngoài địa bàn hoặc ấp chưa có ranh giới để xác minh");
        }
    }

    public Set<String> visibleMapHouseholds() {
        var request = RequestContextHolder.getRequestAttributes();
        if (
            request != null && request.getAttribute("rbac.mapHouseholds", RequestAttributes.SCOPE_REQUEST) instanceof Set cached
        ) return cached;
        var streets = (List<?>) current().getOrDefault("assignedStreets", List.of());
        var result = new HashSet<String>();
        for (var row : db.queryForList(
            "select id, street, alley from household where hamlet_id in (select hamlet_id from rbac_assignment where subject = ?)",
            current().get("id")
        )) {
            if (streets.isEmpty() || streets.contains(row.get("street")) || streets.contains(row.get("alley"))) result.add(
                row.get("id").toString()
            );
        }
        if (request != null) request.setAttribute("rbac.mapHouseholds", result, RequestAttributes.SCOPE_REQUEST);
        return result;
    }

    public void household(Long id) {
        if (id == null) throw new AccessDeniedException("Hồ sơ phải liên kết với hộ dân");
        var zones = db.queryForList("select hamlet_id from household where id=?", Long.class, id);
        if (zones.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy hộ dân");
        area(zones.getFirst());
        var streets = (List<?>) current().getOrDefault("assignedStreets", List.of());
        if (!global() && !streets.isEmpty()) {
            var row = db.queryForMap("select street,alley from household where id=?", id);
            if (!streets.contains(row.get("street")) && !streets.contains(row.get("alley"))) throw new AccessDeniedException(
                "Ngoài tuyến được phân công"
            );
        }
    }

    public Map<String, Object> stored(String id) {
        var rows = db.queryForList("select data from rbac_profile where subject=?", String.class, id);
        return rows.isEmpty() ? new LinkedHashMap<>() : decode(rows.getFirst());
    }

    public Map<String, Object> profile(Map<String, Object> user) {
        String id = (String) user.get("id");
        Map<String, Object> data = stored(id);
        data.put("id", id);
        data.put("username", user.get("username"));
        data.put("email", user.getOrDefault("email", ""));
        data.putIfAbsent("fullName", (user.getOrDefault("firstName", "") + " " + user.getOrDefault("lastName", "")).trim());
        if (((String) data.get("fullName")).isBlank()) data.put("fullName", user.get("username"));
        data.put("role", kc.role(id));
        data.put("status", Boolean.TRUE.equals(user.get("enabled")) ? data.getOrDefault("status", "active") : "locked");
        for (String field : List.of("rank", "position", "unit", "badgeNumber", "phone", "assignedWard")) data.putIfAbsent(field, "");
        data.putIfAbsent("createdAt", String.valueOf(user.getOrDefault("createdTimestamp", "")));
        data.put("hamletIds", assignments(id));
        data.putIfAbsent("assignedHamlets", List.of());
        data.putIfAbsent("assignedStreets", List.of());
        Map<String, Object> permissions = new LinkedHashMap<>();
        var configured = (Map<?, ?>) data.getOrDefault("subAdminPermissions", Map.of());
        for (String key : PERMISSIONS)
            permissions.put(key, "superadmin".equals(data.get("role")) || Boolean.TRUE.equals(configured.get(key)));
        data.put("subAdminPermissions", permissions);
        data.put(
            "version",
            db.queryForList("select version from rbac_profile where subject=?", Long.class, id).stream().findFirst().orElse(0L)
        );
        return data;
    }

    @org.springframework.transaction.annotation.Transactional
    public Map<String, Object> updateOwnAccount(Map<String, Object> incoming) {
        String id = subject();
        current(); // Require an active, authenticated account.
        if (!Set.of("rank", "fullName").containsAll(incoming.keySet())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chỉ được cập nhật cấp bậc và họ tên");
        }
        Map<String, Object> data = new LinkedHashMap<>();
        for (String field : List.of("rank", "fullName")) {
            if (!incoming.containsKey(field)) continue;
            if (
                !(incoming.get(field) instanceof String value) ||
                value.trim().length() > 200 ||
                (field.equals("fullName") && value.isBlank())
            ) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Thông tin tài khoản không hợp lệ");
            }
            data.put(field, value.trim());
        }
        db.update(
            "insert into rbac_profile(subject,data) values (?,?) on conflict(subject) do update set data=(rbac_profile.data::jsonb || excluded.data::jsonb)::text,version=rbac_profile.version+1",
            id,
            encode(data)
        );
        audit("account-profile-update", id, Map.of("fields", incoming.keySet()));
        return profile(kc.user(id));
    }

    private int rank(String role) {
        return List.of("officer", "sub-admin", "admin", "superadmin").indexOf(role);
    }

    private void manage(Map<String, Object> target) {
        var actor = current();
        if (Objects.toString(target.get("username"), "").startsWith("service-account-")) throw new AccessDeniedException(
            "Không quản lý tài khoản dịch vụ qua giao diện cán bộ"
        );
        if (actor.get("id").equals(target.get("id"))) throw new AccessDeniedException("Không tự thay đổi quyền/tài khoản");
        if (global()) return;
        if (!supervisor() || rank((String) target.get("role")) >= rank((String) actor.get("role"))) throw new AccessDeniedException(
            "Không được quản trị cấp ngang hoặc cao hơn"
        );
        List<Long> targetAreas = assignments((String) target.get("id"));
        if (targetAreas.isEmpty() || !areas().containsAll(targetAreas)) throw new AccessDeniedException("Cán bộ ngoài phạm vi quản lý");
        var ownStreets = (List<?>) actor.getOrDefault("assignedStreets", List.of());
        var targetStreets = (List<?>) target.getOrDefault("assignedStreets", List.of());
        if (!ownStreets.isEmpty() && (targetStreets.isEmpty() || !ownStreets.containsAll(targetStreets))) throw new AccessDeniedException(
            "Cán bộ ngoài tuyến quản lý"
        );
    }

    public List<Map<String, Object>> users() {
        if (!supervisor()) throw new AccessDeniedException("Không được xem danh sách quản trị");
        List<Map<String, Object>> result = new ArrayList<>();
        for (var user : kc.users()) {
            if (((String) user.get("username")).startsWith("service-account-")) continue;
            var p = profile(user);
            if (global()) result.add(p);
            else try {
                manage(p);
                result.add(p);
            } catch (AccessDeniedException ignored) {}
        }
        return result;
    }

    private List<Long> resolveHamlets(Map<String, Object> data) {
        if (data.containsKey("areaZoneIds")) throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "Reload the application and use hamletIds"
        );
        Object requested = data.getOrDefault("hamletIds", List.of());
        if (!(requested instanceof List<?> selected)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "hamletIds must be a list");
        List<Long> ids = new ArrayList<>();
        for (Object value : selected) {
            Long id;
            try {
                id = Long.valueOf(value.toString());
            } catch (RuntimeException ex) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid hamlet ID");
            }
            if (
                !Long.valueOf(1).equals(db.queryForObject("select count(*) from hamlet where id=? and valid_to is null", Long.class, id))
            ) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Hamlet is missing or inactive");
            ids.add(id);
        }
        return ids.stream().distinct().toList();
    }

    @org.springframework.transaction.annotation.Transactional
    public Map<String, Object> saveProfile(String id, Map<String, Object> incoming) {
        var existing = profile(kc.user(id));
        manage(existing);
        if (
            incoming.containsKey("version") &&
            !Objects.equals(((Number) incoming.get("version")).longValue(), ((Number) existing.get("version")).longValue())
        ) throw new ResponseStatusException(HttpStatus.CONFLICT, "Quyền đã thay đổi. Tải lại trước khi lưu.");
        List<Long> areas = resolveHamlets(incoming);
        if (!global() && !areas().containsAll(areas)) throw new AccessDeniedException("Không cấp địa bàn ngoài phạm vi");
        var ownStreets = (List<?>) current().getOrDefault("assignedStreets", List.of());
        var grantedStreets = (List<?>) incoming.getOrDefault("assignedStreets", List.of());
        if (
            !global() && !ownStreets.isEmpty() && (grantedStreets.isEmpty() || !ownStreets.containsAll(grantedStreets))
        ) throw new AccessDeniedException("Không cấp tuyến ngoài phạm vi");
        Map<String, Object> permissions = new LinkedHashMap<>();
        Map<?, ?> requested = (Map<?, ?>) incoming.getOrDefault("subAdminPermissions", Map.of());
        Map<?, ?> previouslyGranted = (Map<?, ?>) existing.getOrDefault("subAdminPermissions", Map.of());
        for (String key : PERMISSIONS) {
            boolean value = Boolean.TRUE.equals(requested.get(key));
            // A supervisor may retain an existing grant without possessing that feature themselves.
            // Viewing the two maps can be delegated to a subordinate by any supervisor in scope.
            if (value && !Boolean.TRUE.equals(previouslyGranted.get(key)) && !global() && !MAP_VIEW_PERMISSIONS.contains(key)) permission(
                key
            );
            permissions.put(key, value);
        }
        Map<String, Object> data = new LinkedHashMap<>();
        if (existing.containsKey("fullName")) data.put("fullName", existing.get("fullName"));
        for (String key : List.of("rank", "position", "unit", "badgeNumber", "phone", "assignedWard", "assignedStreets"))
            data.put(key, incoming.getOrDefault(key, key.equals("assignedStreets") ? List.of() : ""));
        data.put("status", "active");
        data.put("subAdminPermissions", permissions);
        data.put(
            "assignedHamlets",
            areas
                .stream()
                .map(a -> db.queryForObject("select full_name from hamlet where id=?", String.class, a))
                .toList()
        );
        data.put("createdAt", existing.get("createdAt"));
        int changed = db.update(
            "update rbac_profile set data=?,version=version+1 where subject=? and version=?",
            encode(data),
            id,
            existing.get("version")
        );
        if (changed == 0) {
            if (((Number) existing.get("version")).longValue() != 0) throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Quyền đã thay đổi"
            );
            db.update("insert into rbac_profile(subject,data) values (?,?)", id, encode(data));
        }
        db.update("delete from rbac_assignment where subject=?", id);
        for (Long area : areas) db.update("insert into rbac_assignment(subject,hamlet_id) values (?,?)", id, area);
        audit("delegation", id, Map.of("before", existing, "after", data));
        return profile(kc.user(id));
    }

    @org.springframework.transaction.annotation.Transactional
    public Map<String, Object> saveUser(Map<String, Object> incoming) {
        superadmin();
        String id = String.valueOf(incoming.getOrDefault("id", ""));
        boolean creating = !id.matches("[a-fA-F0-9-]{36}");
        String temporary = String.valueOf(incoming.getOrDefault("temporaryPassword", ""));
        if ((creating || !temporary.isBlank()) && temporary.length() < 12) throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "Mật khẩu tạm phải có ít nhất 12 ký tự"
        );
        // Validate assignments before provisioning an identity. Never trust frontend seed IDs.
        resolveHamlets(incoming);
        String role = String.valueOf(incoming.get("role"));
        if (!KeycloakAdminClient.ROLES.containsKey(role)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vai trò không hợp lệ");
        if (creating) {
            String username = String.valueOf(incoming.getOrDefault("username", "")).trim();
            if (!username.matches("[a-zA-Z0-9._@-]{3,100}")) throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Tên đăng nhập không hợp lệ"
            );
            kc.request(
                HttpMethod.POST,
                "/users",
                Map.of(
                    "username",
                    username,
                    "enabled",
                    false,
                    "email",
                    incoming.getOrDefault("email", ""),
                    "firstName",
                    incoming.getOrDefault("fullName", username)
                ),
                Void.class
            );
            id = (String) kc
                .users()
                .stream()
                .filter(u -> username.equalsIgnoreCase((String) u.get("username")))
                .findFirst()
                .orElseThrow()
                .get("id");
            audit("identity-created-disabled", id, Map.of("username", username));
        } else manage(profile(kc.user(id)));
        var before = profile(kc.user(id));
        if (
            !creating &&
            incoming.get("version") instanceof Number version &&
            version.longValue() != ((Number) before.get("version")).longValue()
        ) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Dữ liệu đã thay đổi; tải lại trước khi lưu");
        }
        try {
            kc.enabled(id, false);
            kc.logout(id);
            kc.setRole(id, role);
            kc.request(
                HttpMethod.PUT,
                "/users/" + id,
                Map.of(
                    "email",
                    incoming.getOrDefault("email", ""),
                    "firstName",
                    incoming.getOrDefault("fullName", incoming.get("username"))
                ),
                Void.class
            );
            saveProfile(id, incoming);
            if (creating) {
                String password = String.valueOf(incoming.getOrDefault("temporaryPassword", ""));
                if (password.length() < 12) throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Mật khẩu tạm phải có ít nhất 12 ký tự. Tài khoản đang bị khóa; đặt mật khẩu rồi thử lại."
                );
                kc.request(
                    HttpMethod.PUT,
                    "/users/" + id + "/reset-password",
                    Map.of("type", "password", "value", password, "temporary", true),
                    Void.class
                );
            } else if (incoming.get("temporaryPassword") instanceof String password && !password.isBlank()) {
                if (password.length() < 12) throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Mật khẩu tạm phải có ít nhất 12 ký tự"
                );
                kc.request(
                    HttpMethod.PUT,
                    "/users/" + id + "/reset-password",
                    Map.of("type", "password", "value", password, "temporary", true),
                    Void.class
                );
            }
            kc.enabled(id, "active".equals(incoming.getOrDefault("status", "active")));
            audit("identity-synchronized", id, Map.of("role", role, "status", incoming.getOrDefault("status", "active")));
            return profile(kc.user(id));
        } catch (RuntimeException ex) {
            failureAudit.record(subject(), "identity-sync-failed-disabled", id);
            throw ex;
        }
    }

    @org.springframework.transaction.annotation.Transactional
    public void deleteUser(String id) {
        superadmin();
        var user = profile(kc.user(id));
        manage(user);
        if ("superadmin".equals(user.get("role"))) throw new AccessDeniedException("Không xóa Super Admin");
        kc.enabled(id, false);
        kc.logout(id);
        kc.request(HttpMethod.DELETE, "/users/" + id, null, Void.class);
        db.update("delete from rbac_profile where subject=?", id);
        audit("identity-deleted", id, Map.of());
    }

    @org.springframework.transaction.annotation.Transactional
    public void audit(String action, String target, Object details) {
        db.update("insert into rbac_audit(actor,action,target,details) values (?,?,?,?)", subject(), action, target, encode(details));
    }

    public List<Map<String, Object>> settings(String kind) {
        return db
            .queryForList("select data from rbac_setting where kind=? order by id", String.class, kind)
            .stream()
            .map(this::decode)
            .toList();
    }

    @org.springframework.transaction.annotation.Transactional
    public void saveSetting(String kind, Map<String, Object> data) {
        superadmin();
        String id = String.valueOf(data.get("id"));
        db.update(
            "insert into rbac_setting(kind,id,data) values (?,?,?) on conflict(kind,id) do update set data=excluded.data",
            kind,
            id,
            encode(data)
        );
        audit("setting-" + kind, id, data);
    }

    @org.springframework.transaction.annotation.Transactional
    public void deleteSetting(String kind, String id) {
        superadmin();
        db.update("delete from rbac_setting where kind=? and id=?", kind, id);
        audit("delete-" + kind, id, Map.of());
    }

    public List<Long> scopedRecordIds(String kind) {
        if (global()) return List.of();
        var actor = current();
        List<Long> areaIds = areas();
        if (areaIds.isEmpty()) return List.of();
        if (!((List<?>) actor.getOrDefault("assignedStreets", List.of())).isEmpty()) return db.queryForList(
            "select record_id from rbac_record_scope where kind=? and subject=?",
            Long.class,
            kind,
            actor.get("id")
        );
        return db.queryForList(
            "select s.record_id from rbac_record_scope s where s.kind=? and (s.subject=? or (exists(select 1 from rbac_assignment a where a.subject=s.subject) and not exists(select 1 from rbac_assignment a where a.subject=s.subject and a.hamlet_id not in (select hamlet_id from rbac_assignment where subject=?))))",
            Long.class,
            kind,
            actor.get("id"),
            supervisor() ? actor.get("id") : ""
        );
    }

    public <T> org.springframework.data.jpa.domain.Specification<T> householdScope(boolean resident) {
        if (global()) return org.springframework.data.jpa.domain.Specification.unrestricted();
        List<Long> ids = areas();
        List<?> streets = (List<?>) current().getOrDefault("assignedStreets", List.of());
        return (root, query, builder) -> {
            if (ids.isEmpty()) return builder.disjunction();
            jakarta.persistence.criteria.Path<?> h = resident ? root.join("household", jakarta.persistence.criteria.JoinType.INNER) : root;
            var area = h.get("hamletId").in(ids);
            return streets.isEmpty() ? area : builder.and(area, builder.or(h.get("street").in(streets), h.get("alley").in(streets)));
        };
    }

    public <T> org.springframework.data.jpa.domain.Specification<T> recordScope(String kind) {
        if (global()) return org.springframework.data.jpa.domain.Specification.unrestricted();
        List<Long> ids = scopedRecordIds(kind);
        List<Long> allowedAreas = areas();
        List<?> streets = (List<?>) current().getOrDefault("assignedStreets", List.of());
        return (root, query, builder) -> {
            if (ids.isEmpty()) return builder.disjunction();
            var owned = root.get("id").in(ids);
            if (!"document".equals(kind)) return owned;
            var houses = query.subquery(Long.class);
            var h = houses.from(com.policemanagement.com.domain.Household.class);
            var area = h.get("hamletId").in(allowedAreas);
            houses
                .select(h.get("id"))
                .where(streets.isEmpty() ? area : builder.and(area, builder.or(h.get("street").in(streets), h.get("alley").in(streets))));
            return builder.and(owned, builder.or(builder.isNull(root.get("householdId")), root.get("householdId").in(houses)));
        };
    }

    public void record(String kind, Long id) {
        if (!global() && !scopedRecordIds(kind).contains(id)) throw new AccessDeniedException(
            "Hồ sơ ngoài phạm vi hoặc chưa xác minh phân công"
        );
        if ("document".equals(kind)) {
            var households = db.queryForList("select household_id from document_record where id=?", Long.class, id);
            if (households.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy hồ sơ");
            if (households.getFirst() != null) household(households.getFirst());
        }
    }

    @org.springframework.transaction.annotation.Transactional
    public void recordCreated(String kind, Long id) {
        db.update(
            "insert into rbac_record_scope(kind,record_id,subject) values (?,?,?) on conflict(kind,record_id) do nothing",
            kind,
            id,
            subject()
        );
    }

    public JdbcTemplate database() {
        return db;
    }
}
