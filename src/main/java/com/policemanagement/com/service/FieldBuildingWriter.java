package com.policemanagement.com.service;

import com.policemanagement.com.service.rbac.RbacService;
import java.awt.geom.Line2D;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * Writes field-map buildings and their household links. Shared by the 3D field map and the roster map so both apply the same
 * checks: valid footprint (at most 20 floors / 70 m), territory of the footprint and of every linked household, one building
 * per household, and a history entry per change. Callers check the feature permissions first.
 */
@Service
@Transactional
public class FieldBuildingWriter {

    private final JdbcTemplate db;
    private final ObjectMapper json;
    private final RbacService rbac;
    private final FieldMapHistoryService history;

    public FieldBuildingWriter(JdbcTemplate db, ObjectMapper json, RbacService rbac, FieldMapHistoryService history) {
        this.db = db;
        this.json = json;
        this.rbac = rbac;
        this.history = history;
    }

    /** Saves a building as given; a household linked to another building is a conflict. */
    public JsonNode save(String id, JsonNode feature) {
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

    /** Stored feature of a building, if saved. */
    public Optional<JsonNode> find(String id) {
        return db
            .queryForList("select feature_json from gis_field_building where id = ?", String.class, id)
            .stream()
            .findFirst()
            .map(json::readTree);
    }

    /** Building a household is linked to, if any. */
    public Optional<String> buildingOf(long householdId) {
        return db
            .queryForList("select building_id from gis_field_building_household where household_id = ?", String.class, householdId)
            .stream()
            .findFirst();
    }

    /** Copy of a feature with one household added to or removed from its links. */
    public JsonNode withLink(JsonNode feature, long householdId, boolean linked) {
        ObjectNode copy = (ObjectNode) feature.deepCopy();
        ObjectNode properties =
            copy.has("properties") && copy.get("properties").isObject()
                ? (ObjectNode) copy.get("properties")
                : copy.putObject("properties");
        ArrayNode links = properties.putArray("householdIds");
        String target = Long.toString(householdId);
        for (JsonNode link : feature.path("properties").path("householdIds")) if (!link.asText().equals(target)) links.add(link.asText());
        if (linked) links.add(target);
        return copy;
    }

    /**
     * Moves a household from the building it is linked to (if any) into {@code targetFeature}, in one transaction: the old
     * building is saved without it first, then the target with it, each with its own history entry.
     */
    public JsonNode relink(long householdId, String targetId, JsonNode targetFeature) {
        db.execute("lock table gis_field_building in share row exclusive mode");
        String current = buildingOf(householdId).orElse(null);
        if (current != null && !current.equals(targetId)) {
            var old = find(current).orElseThrow();
            save(current, withLink(old, householdId, false));
        }
        return save(targetId, withLink(targetFeature, householdId, true));
    }

    public static void validate(String id, JsonNode feature) {
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
            height > 70 ||
            properties.path("name").asText("").length() > 255 ||
            !properties.path("color").asText("#b6c9d6").matches("#[a-fA-F0-9]{6}")
        ) invalid();
        for (String key : List.of("floors", "levels")) {
            JsonNode floors = properties.path(key);
            if (!floors.isMissingNode() && (!floors.isIntegralNumber() || floors.asInt() < 1 || floors.asInt() > 20)) invalid();
        }
        for (String key : List.of("wallColor", "roofColor")) {
            JsonNode value = properties.path(key);
            if (!value.isMissingNode() && (!value.isString() || !value.asText().matches("#[a-fA-F0-9]{6}"))) invalid();
        }
        JsonNode roof = properties.path("roofShape");
        if (!roof.isMissingNode() && !List.of("flat", "gable").contains(roof.asText())) invalid();
        JsonNode floorHeight = properties.path("floorHeight");
        if (
            !floorHeight.isMissingNode() &&
            (!floorHeight.isNumber() ||
                !Double.isFinite(floorHeight.asDouble()) ||
                floorHeight.asDouble() <= 0 ||
                floorHeight.asDouble() > 70)
        ) invalid();
        JsonNode appearanceSource = properties.path("appearanceSource");
        if (!appearanceSource.isMissingNode() && !"manual".equals(appearanceSource.asText())) invalid();
        JsonNode estimated = properties.path("estimated");
        if (!estimated.isMissingNode() && !estimated.isBoolean()) invalid();
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
