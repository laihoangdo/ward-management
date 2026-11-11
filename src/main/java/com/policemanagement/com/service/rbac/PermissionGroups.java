package com.policemanagement.com.service.rbac;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * Permission groups set by the super admin as a ceiling, not as the permissions themselves.
 *
 * <p>A group lists the business permissions its members may hold ({@code ceiling}) and the ones a new member starts
 * with ({@code defaults}). Each member's actual permissions stay the choice of their direct supervisor; the effective
 * set is that choice clipped by the ceiling. Widening a ceiling therefore grants nothing by itself, and only narrowing
 * it revokes, which the super admin confirms explicitly.
 */
public final class PermissionGroups {

    public static final String KIND = "permission-groups";
    public static final List<String> ROLES = List.of("officer", "sub-admin", "admin");
    private static final Map<String, String> BUILT_IN_NAMES = Map.of(
        "officer",
        "Công an viên",
        "sub-admin",
        "Cán bộ quản lý ấp",
        "admin",
        "Trưởng Công an xã"
    );

    private PermissionGroups() {}

    public static String builtInId(String role) {
        return "builtin-" + role;
    }

    /** Built-in group of a role: every permission allowed so existing grants survive, defaults from the role preset. */
    public static Map<String, Object> builtIn(String role) {
        Map<String, Object> group = new LinkedHashMap<>();
        group.put("id", builtInId(role));
        group.put("name", BUILT_IN_NAMES.get(role));
        group.put("description", "Nhóm gốc của vai trò; không xóa được.");
        group.put("role", role);
        group.put("ceiling", RbacService.PERMISSIONS);
        group.put("defaults", RbacService.PERMISSION_PRESETS.get(role));
        group.put("builtIn", true);
        return group;
    }

    public static List<String> ceiling(Map<String, Object> group) {
        return strings(group.get("ceiling"));
    }

    public static List<String> defaults(Map<String, Object> group) {
        return strings(group.get("defaults"));
    }

    /** Effective permissions: what was chosen for the member, limited to the group's ceiling. */
    public static Map<String, Boolean> clip(Map<?, ?> chosen, List<String> ceiling) {
        Map<String, Boolean> result = new LinkedHashMap<>();
        for (String key : RbacService.PERMISSIONS) result.put(key, Boolean.TRUE.equals(chosen.get(key)) && ceiling.contains(key));
        return result;
    }

    public static Map<String, Boolean> flags(List<String> granted) {
        Map<String, Boolean> result = new LinkedHashMap<>();
        for (String key : RbacService.PERMISSIONS) result.put(key, granted.contains(key));
        return result;
    }

    /** Permissions present in the old ceiling but missing from the new one. */
    public static List<String> removed(Map<String, Object> before, Map<String, Object> after) {
        if (before == null) return List.of();
        var kept = ceiling(after);
        return ceiling(before)
            .stream()
            .filter(key -> !kept.contains(key))
            .toList();
    }

    /** Validates a group sent by the super admin; built-in groups keep their id, role and flag. */
    public static Map<String, Object> normalize(Map<String, Object> incoming, Map<String, Object> existing) {
        String name = String.valueOf(incoming.getOrDefault("name", "")).trim();
        if (name.isEmpty() || name.length() > 80) throw invalid("Tên nhóm phải có từ 1 đến 80 ký tự");
        String description = String.valueOf(incoming.getOrDefault("description", "")).trim();
        if (description.length() > 300) throw invalid("Mô tả tối đa 300 ký tự");
        boolean builtIn = existing != null && Boolean.TRUE.equals(existing.get("builtIn"));
        String role = builtIn ? String.valueOf(existing.get("role")) : String.valueOf(incoming.get("role"));
        if (!ROLES.contains(role)) throw invalid("Vai trò của nhóm không hợp lệ");
        List<String> ceiling = known(incoming.get("ceiling"));
        List<String> defaults = known(incoming.get("defaults"));
        if (!ceiling.containsAll(defaults)) throw invalid("Quyền mặc định phải nằm trong phạm vi được phép của nhóm");
        Map<String, Object> group = new LinkedHashMap<>();
        group.put("id", existing != null ? existing.get("id") : "group-" + UUID.randomUUID());
        group.put("name", name);
        group.put("description", description);
        group.put("role", role);
        group.put("ceiling", ceiling);
        group.put("defaults", defaults);
        group.put("builtIn", builtIn);
        return group;
    }

    private static List<String> known(Object value) {
        if (value == null) return List.of();
        if (!(value instanceof List<?> list)) throw invalid("Danh sách quyền không hợp lệ");
        List<String> result = new ArrayList<>();
        for (Object item : list) {
            String key = String.valueOf(item);
            if (!RbacService.PERMISSIONS.contains(key)) throw invalid("Quyền không tồn tại: " + key);
            if (!result.contains(key)) result.add(key);
        }
        // Keep the catalogue order so stored groups compare and display consistently.
        return RbacService.PERMISSIONS.stream().filter(result::contains).toList();
    }

    private static List<String> strings(Object value) {
        return value instanceof List<?> list ? list.stream().map(String::valueOf).toList() : List.of();
    }

    private static ResponseStatusException invalid(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
