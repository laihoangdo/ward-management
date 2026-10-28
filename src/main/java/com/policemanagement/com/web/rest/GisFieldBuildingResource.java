package com.policemanagement.com.web.rest;

import com.policemanagement.com.service.FieldMapHistoryService;
import com.policemanagement.com.service.rbac.RbacService;
import java.awt.geom.Line2D;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

/** Persistent user-created footprints and overrides for the imported field map. */
@RestController
@RequestMapping("/api/gis/field-buildings")
public class GisFieldBuildingResource {

    private final JdbcTemplate db;
    private final ObjectMapper json;
    private final RbacService rbac;
    private final FieldMapHistoryService history;

    public GisFieldBuildingResource(JdbcTemplate db, ObjectMapper json, RbacService rbac, FieldMapHistoryService history) {
        this.db = db;
        this.json = json;
        this.rbac = rbac;
        this.history = history;
    }

    @GetMapping
    public Map<String, Object> list() {
        rbac.permission("canViewField3DMap");
        List<JsonNode> features = db.query("select feature_json from gis_field_building order by id", (rs, row) ->
            json.readTree(rs.getString(1))
        );
        return scopedView(features);
    }

    @GetMapping("/access")
    public Map<String, Object> access() {
        rbac.permission("canViewField3DMap");
        return Map.of("global", rbac.global(), "territories", rbac.mapTerritories());
    }

    /** Commune-wide public outlines only; never expose arbitrary stored feature properties. */
    @GetMapping("/boundaries")
    public Map<String, Object> boundaries() {
        rbac.permission("canViewField3DMap");
        var features = new ArrayList<JsonNode>();
        for (var row : db.queryForList(
            "select id, code, name, boundary_geo_json from hamlet where boundary_geo_json is not null order by id"
        )) {
            JsonNode stored = json.readTree(row.get("boundary_geo_json").toString());
            JsonNode geometry = "Feature".equals(stored.path("type").asText()) ? stored.path("geometry") : stored;
            if (!List.of("Polygon", "MultiPolygon").contains(geometry.path("type").asText())) continue;
            ObjectNode feature = json.createObjectNode();
            feature.put("type", "Feature");
            feature.set("geometry", geometry);
            ObjectNode properties = feature.putObject("properties");
            properties.put("hamletId", ((Number) row.get("id")).longValue());
            properties.put("code", row.get("code").toString());
            properties.put("name", row.get("name").toString());
            properties.put("provisional", stored.path("properties").path("provisional").asBoolean(false));
            properties.put("boundaryVersion", stored.path("properties").path("boundaryVersion").asText(""));
            features.add(feature);
        }
        return Map.of("type", "FeatureCollection", "features", features);
    }

    @PostMapping("/access/check")
    public Map<String, Boolean> checkAccess(@RequestBody JsonNode geometry) {
        rbac.permission("canViewField3DMap");
        return Map.of("allowed", rbac.canManageMapGeometry(geometry));
    }

    Map<String, Object> scopedView(List<JsonNode> features) {
        if (rbac.global()) return Map.of("type", "FeatureCollection", "features", features);
        var visible = rbac.visibleMapHouseholds();
        var masked = features
            .stream()
            .map(feature -> {
                ObjectNode copy = (ObjectNode) feature.deepCopy();
                boolean inside = rbac.canManageMapGeometry(feature.path("geometry"));
                ObjectNode properties = inside ? (ObjectNode) copy.path("properties") : json.createObjectNode();
                if (!inside) {
                    properties.put("buildingId", feature.path("id").asText());
                    properties.set("height", feature.path("properties").path("height"));
                    properties.put("estimated", feature.path("properties").path("estimated").asBoolean(false));
                }
                var links = properties.putArray("householdIds");
                boolean allVisible = true;
                for (JsonNode link : feature.path("properties").path("householdIds")) {
                    if (inside && visible.contains(link.asText())) links.add(link.asText());
                    else allVisible = false;
                }
                if (!allVisible) {
                    properties = json.createObjectNode();
                    properties.put("buildingId", feature.path("id").asText());
                    properties.set("height", feature.path("properties").path("height"));
                    properties.put("estimated", feature.path("properties").path("estimated").asBoolean(false));
                    properties.set("householdIds", links);
                }
                properties.put("canManage", inside && allVisible);
                properties.remove("accessReason");
                if (!inside) properties.put("accessReason", "outside-territory");
                else if (!allVisible) properties.put("accessReason", "linked-household-outside-scope");
                copy.set("properties", properties);
                return (JsonNode) copy;
            })
            .toList();
        return Map.of("type", "FeatureCollection", "features", masked);
    }

    @PutMapping("/{id}")
    @Transactional
    public JsonNode save(@PathVariable String id, @RequestBody JsonNode feature) {
        rbac.permission("canViewField3DMap");
        rbac.permission("canEditCoordinates");
        validate(id, feature);
        // Serialize footprint edits so concurrent requests cannot link one household twice.
        db.execute("lock table gis_field_building in share row exclusive mode");
        rbac.mapGeometry(feature.path("geometry"));
        JsonNode before = null;
        for (String stored : db.queryForList("select feature_json from gis_field_building where id = ?", String.class, id)) {
            JsonNode previous = json.readTree(stored);
            before = previous;
            rbac.mapGeometry(previous.path("geometry"));
            for (JsonNode link : previous.path("properties").path("householdIds")) rbac.household(Long.parseLong(link.asText()));
        }
        var requested = new HashSet<String>();
        for (JsonNode link : feature.path("properties").path("householdIds")) {
            try {
                long householdId = Long.parseLong(link.asText());
                rbac.household(householdId);
                requested.add(link.asText());
            } catch (NumberFormatException ex) {
                invalid();
            }
        }
        List<JsonNode> existing = db.query(
            "select feature_json from gis_field_building where id <> ?",
            (rs, row) -> json.readTree(rs.getString(1)),
            id
        );
        for (JsonNode other : existing) {
            for (JsonNode link : other.path("properties").path("householdIds")) {
                if (requested.contains(link.asText())) throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Household already linked to another building"
                );
            }
        }
        String encoded = json.writeValueAsString(feature);
        db.update(
            "insert into gis_field_building (id, feature_json) values (?, ?) on conflict (id) do update set feature_json = excluded.feature_json",
            id,
            encoded
        );
        history.mutation(id, before, feature, false);
        return feature;
    }

    /** Materialize coordinate matches without overwriting saved footprints or manual links. */
    @PostMapping("/auto-link")
    @Transactional
    public Map<String, Object> autoLink(@RequestBody List<JsonNode> candidates) {
        rbac.permission("canViewField3DMap");
        rbac.permission("canEditCoordinates");
        if (candidates == null || candidates.size() > 50) invalid();
        for (JsonNode candidate : candidates) {
            if (candidate == null) invalid();
            validate(candidate.path("id").asText(), candidate);
        }
        db.execute("lock table gis_field_building in share row exclusive mode");
        List<JsonNode> saved = db.query("select feature_json from gis_field_building order by id", (rs, row) ->
            json.readTree(rs.getString(1))
        );
        var buildings = new LinkedHashMap<String, JsonNode>();
        var assigned = new HashSet<String>();
        for (JsonNode feature : saved) {
            buildings.put(feature.path("id").asText(), feature);
            for (JsonNode link : feature.path("properties").path("householdIds")) assigned.add(link.asText());
        }
        for (JsonNode candidate : candidates) {
            String id = candidate.path("id").asText();
            JsonNode current = buildings.getOrDefault(id, candidate);
            if (!rbac.canManageMapGeometry(current.path("geometry"))) continue;
            if (!rbac.global()) {
                boolean foreignLink = false;
                for (JsonNode link : current.path("properties").path("householdIds")) {
                    if (buildings.containsKey(id) && !rbac.visibleMapHouseholds().contains(link.asText())) foreignLink = true;
                }
                if (foreignLink) continue;
            }
            var links = new LinkedHashSet<String>();
            if (buildings.containsKey(id)) for (JsonNode link : current.path("properties").path("householdIds")) links.add(link.asText());
            boolean changed = false;
            for (JsonNode link : candidate.path("properties").path("householdIds")) {
                String householdId = link.asText();
                if (assigned.contains(householdId)) continue;
                long numericId;
                try {
                    numericId = Long.parseLong(householdId);
                } catch (NumberFormatException ex) {
                    invalid();
                    return Map.of();
                }
                rbac.household(numericId);
                var household = db.queryForMap("select latitude, longitude, coordinate_method from household where id = ?", numericId);
                if (
                    "RANDOM_WITHIN_TC2".equals(household.get("coordinate_method")) ||
                    !(household.get("latitude") instanceof Number lat) ||
                    !(household.get("longitude") instanceof Number lng) ||
                    !Double.isFinite(lat.doubleValue()) ||
                    !Double.isFinite(lng.doubleValue()) ||
                    !containsCoordinate(current.path("geometry"), lng.doubleValue(), lat.doubleValue())
                ) continue;
                links.add(householdId);
                assigned.add(householdId);
                changed = true;
            }
            if (!changed) continue;
            ObjectNode merged = (ObjectNode) current.deepCopy();
            ((ObjectNode) merged.path("properties")).set("householdIds", json.valueToTree(links));
            db.update(
                "insert into gis_field_building (id, feature_json) values (?, ?) on conflict (id) do update set feature_json = excluded.feature_json",
                id,
                json.writeValueAsString(merged)
            );
            history.mutation(id, buildings.containsKey(id) ? current : null, merged, true);
            buildings.put(id, merged);
        }
        return scopedView(List.copyOf(buildings.values()));
    }

    static boolean containsCoordinate(JsonNode geometry, double lng, double lat) {
        JsonNode coordinates = geometry.path("coordinates");
        if ("Polygon".equals(geometry.path("type").asText())) return containsPolygon(coordinates, lng, lat);
        for (JsonNode polygon : coordinates) if (containsPolygon(polygon, lng, lat)) return true;
        return false;
    }

    private static boolean containsPolygon(JsonNode rings, double lng, double lat) {
        if (!containsRing(rings.path(0), lng, lat)) return false;
        for (int i = 1; i < rings.size(); i++) if (containsRing(rings.get(i), lng, lat)) return false;
        return true;
    }

    private static boolean containsRing(JsonNode ring, double lng, double lat) {
        boolean inside = false;
        for (int i = 0, j = ring.size() - 1; i < ring.size(); j = i++) {
            double x = ring.get(i).get(0).asDouble(),
                y = ring.get(i).get(1).asDouble();
            double px = ring.get(j).get(0).asDouble(),
                py = ring.get(j).get(1).asDouble();
            if (y > lat != py > lat && lng < ((px - x) * (lat - y)) / (py - y) + x) inside = !inside;
        }
        return inside;
    }

    static void validate(String id, JsonNode feature) {
        if (feature == null || !feature.isObject()) invalid();
        if (
            !id.matches("[a-zA-Z0-9_-]{1,120}") ||
            !"Feature".equals(feature.path("type").asText()) ||
            !id.equals(feature.path("id").asText()) ||
            !id.equals(feature.path("properties").path("buildingId").asText())
        ) invalid();
        JsonNode properties = feature.path("properties");
        double height = properties.path("height").asDouble(-1);
        if (
            !Double.isFinite(height) ||
            !properties.path("height").isNumber() ||
            height < 0.5 ||
            height > 300 ||
            properties.path("name").asText("").length() > 255 ||
            !properties.path("color").asText("#b6c9d6").matches("#[a-fA-F0-9]{6}")
        ) invalid();
        JsonNode floors = properties.path("floors");
        if (!floors.isMissingNode() && (!floors.isIntegralNumber() || floors.asInt() < 1 || floors.asInt() > 100)) invalid();
        JsonNode geometry = feature.path("geometry");
        JsonNode coordinates = geometry.path("coordinates");
        if (!coordinates.isArray() || coordinates.isEmpty() || coordinates.size() > 1000) invalid();
        if ("Polygon".equals(geometry.path("type").asText())) validatePolygon(coordinates);
        else if ("MultiPolygon".equals(geometry.path("type").asText())) {
            for (JsonNode polygon : coordinates) validatePolygon(polygon);
        } else invalid();
        JsonNode links = properties.path("householdIds");
        if (!links.isMissingNode()) {
            if (!links.isArray() || links.size() > 1000) invalid();
            for (JsonNode link : links) if (!link.isString() || !link.asText().matches("[a-zA-Z0-9_-]{1,120}")) invalid();
        }
        if (feature.toString().length() > 1000000) invalid();
    }

    private static void validatePolygon(JsonNode polygon) {
        if (!polygon.isArray() || polygon.isEmpty() || polygon.size() > 100) invalid();
        for (JsonNode ring : polygon) {
            if (!ring.isArray() || ring.size() < 4 || ring.size() > 10000 || !ring.get(0).equals(ring.get(ring.size() - 1))) invalid();
            double area = 0;
            for (int i = 0; i < ring.size(); i++) {
                JsonNode point = ring.get(i);
                if (!point.isArray() || point.size() != 2 || !point.get(0).isNumber() || !point.get(1).isNumber()) invalid();
                double x = point.get(0).asDouble(),
                    y = point.get(1).asDouble();
                if (!Double.isFinite(x) || !Double.isFinite(y) || Math.abs(x) > 180 || Math.abs(y) > 90) invalid();
                JsonNode next = ring.get((i + 1) % ring.size());
                double ox = ring.get(0).get(0).asDouble(),
                    oy = ring.get(0).get(1).asDouble();
                area += (x - ox) * (next.path(1).asDouble() - oy) - (next.path(0).asDouble() - ox) * (y - oy);
            }
            if (Math.abs(area) < 1e-12) invalid();
            for (int i = 0; i < ring.size() - 1; i++) {
                JsonNode a = ring.get(i),
                    b = ring.get(i + 1);
                if (a.equals(b)) invalid();
                for (int j = i + 2; j < ring.size() - 1; j++) {
                    if (i == 0 && j == ring.size() - 2) continue;
                    JsonNode c = ring.get(j),
                        d = ring.get(j + 1);
                    if (
                        Line2D.linesIntersect(
                            a.get(0).asDouble(),
                            a.get(1).asDouble(),
                            b.get(0).asDouble(),
                            b.get(1).asDouble(),
                            c.get(0).asDouble(),
                            c.get(1).asDouble(),
                            d.get(0).asDouble(),
                            d.get(1).asDouble()
                        )
                    ) invalid();
                }
            }
        }
    }

    private static void invalid() {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid building GeoJSON polygon or properties");
    }
}
