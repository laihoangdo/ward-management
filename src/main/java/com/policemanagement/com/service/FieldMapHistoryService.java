package com.policemanagement.com.service;

import com.policemanagement.com.domain.PatrolLog;
import com.policemanagement.com.repository.PatrolLogRepository;
import com.policemanagement.com.service.rbac.RbacService;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Server identity and timestamps; mutations join the footprint transaction. */
@Service
@Transactional
public class FieldMapHistoryService {

    private final PatrolLogRepository repository;
    private final RbacService rbac;
    private final ObjectMapper json;

    public FieldMapHistoryService(PatrolLogRepository repository, RbacService rbac, ObjectMapper json) {
        this.repository = repository;
        this.rbac = rbac;
        this.json = json;
    }

    public void mutation(String id, JsonNode before, JsonNode after, boolean automatic) {
        var changes = new java.util.ArrayList<String>();
        if (before == null) changes.add(id.startsWith("custom-") ? "Tạo khối nhà" : "Lưu khối nhà nhập từ dữ liệu nền");
        else if (!before.path("geometry").equals(after.path("geometry"))) changes.add("Di chuyển / sửa polygon");
        if (before == null || !before.path("properties").equals(after.path("properties"))) changes.add(
            "Cập nhật thuộc tính / liên kết hộ dân"
        );
        if (changes.isEmpty()) return;
        var metadata = new LinkedHashMap<String, Object>();
        metadata.put("previousValue", before == null ? "Chưa có bản lưu công trình" : json.writeValueAsString(before));
        metadata.put("newValue", json.writeValueAsString(after));
        metadata.put("origin", "server");
        append(automatic ? "Bản đồ 3D: Tự động liên kết hộ dân" : "Bản đồ 3D: Lưu công trình", id, String.join("; ", changes), metadata);
    }

    private void append(String action, String target, String text, Map<String, Object> extra) {
        var actor = rbac.current();
        var details = new LinkedHashMap<String, Object>(extra);
        details.put("text", text);
        details.put("actionType", "map_3d");
        details.put("targetType", "system");
        details.put("targetCode", target);
        details.put("status", extra.getOrDefault("status", "success"));
        details.put("officerRank", actor.getOrDefault("rank", ""));
        details.put("deviceInfo", "Bản đồ 3D · nhật ký thao tác");
        details.put("integrityHash", "Không có chữ ký toàn vẹn");
        var log = new PatrolLog()
            .action(action)
            .target(target == null ? "Bản đồ không gian 3D thực địa" : target)
            .details(json.writeValueAsString(details))
            .officerName(String.valueOf(actor.getOrDefault("fullName", "Cán bộ CSKV")))
            .badgeNumber(String.valueOf(actor.getOrDefault("badgeNumber", "")))
            .timestamp(Instant.now());
        var saved = repository.save(log);
        rbac.recordCreated("patrol", saved.getId());
        rbac.audit("field-map-history", target == null ? "map" : target, Map.of("logId", saved.getId(), "action", action));
    }
}
