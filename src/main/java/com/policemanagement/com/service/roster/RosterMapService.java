package com.policemanagement.com.service.roster;

import com.policemanagement.com.service.PostgisSpatialService;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

/**
 * Household points for the roster map. Only recorded positions are returned: the centre of the building a household is linked to,
 * or a coordinate verified on site. Random placeholder coordinates are never drawn; households without a real position are
 * counted so the UI can say so.
 */
@Service
@Transactional
public class RosterMapService {

    private final JdbcTemplate db;
    private final RosterService roster;
    private final PostgisSpatialService spatial;
    private final ObjectMapper json;

    public RosterMapService(JdbcTemplate db, RosterService roster, PostgisSpatialService spatial, ObjectMapper json) {
        this.db = db;
        this.roster = roster;
        this.spatial = spatial;
        this.json = json;
    }

    public Map<String, Object> map() {
        roster.authorize("canViewAdvancedMap");
        if (!spatial.enabled()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "PostGIS chưa được bật và nghiệm thu");
        long hamlet = roster.hamlet();
        var rows = db.queryForList(
            "select h.roster_id id, h.code, h.raw_address, 'BUILDING' position_source, " +
                RosterPatrolService.LINK_QUALITY_SQL +
                " link_quality, ST_X(ST_PointOnSurface(b.footprint_geom)) lon, ST_Y(ST_PointOnSurface(b.footprint_geom)) lat" +
                " from public.household h join public.gis_field_building_household l on l.household_id=h.id" +
                " join public.gis_field_building b on b.id=l.building_id" +
                " left join public.gis_field_building_household_import i on i.household_id=h.id and i.building_id=b.id" +
                " where h.hamlet_id=?" +
                " union all" +
                " select h.roster_id, h.code, h.raw_address, 'VERIFIED_COORDINATE', 'VERIFIED', h.longitude, h.latitude" +
                " from public.household h where h.hamlet_id=? and h.coordinate_method='VERIFIED' and h.latitude is not null and h.longitude is not null" +
                " and not exists (select 1 from public.gis_field_building_household l where l.household_id=h.id)" +
                " order by code",
            hamlet,
            hamlet
        );
        var features = new ArrayList<Map<String, Object>>();
        for (var row : rows) {
            var properties = new LinkedHashMap<String, Object>();
            properties.put("id", row.get("id").toString());
            properties.put("code", row.get("code"));
            properties.put("raw_address", row.get("raw_address"));
            properties.put("position_source", row.get("position_source"));
            properties.put("link_quality", row.get("link_quality"));
            features.add(
                Map.of(
                    "type",
                    "Feature",
                    "geometry",
                    Map.of("type", "Point", "coordinates", List.of(row.get("lon"), row.get("lat"))),
                    "properties",
                    properties
                )
            );
        }
        var buildings = buildings(hamlet);
        long households = db.queryForObject("select count(*) from public.household where hamlet_id=?", Long.class, hamlet);
        var result = new LinkedHashMap<String, Object>();
        result.put("type", "FeatureCollection");
        result.put("features", features);
        result.put("households", households);
        result.put("positioned", (long) features.size());
        result.put("buildings", buildings);
        result.put("boundary", json.readTree(roster.boundaryGeoJson()));
        return result;
    }

    /** Lowest confidence first: a building is only as trustworthy as its least certain household link. */
    private static final List<String> WORST_FIRST = List.of("ESTIMATED", "MANUAL", "DRAWING_APPROX", "EXACT", "CONFIRMED", "VERIFIED");

    /** Saved design fields passed to the map so it can draw the same walls, roofs and floors as the 3D field map. */
    static final List<String> APPEARANCE_KEYS = List.of(
        "estimated",
        "levels",
        "floors",
        "floorHeight",
        "wallColor",
        "roofColor",
        "roofShape",
        "appearanceSeed",
        "appearanceSource"
    );

    static final double MIN_HEIGHT_M = 3;
    /** Same ceiling the building editor enforces (20 floors / 70 m). */
    static final double MAX_HEIGHT_M = 70;

    static double clampHeight(Double height) {
        if (height == null || !Double.isFinite(height)) return MIN_HEIGHT_M;
        return Math.max(MIN_HEIGHT_M, Math.min(MAX_HEIGHT_M, height));
    }

    static String worst(List<String> qualities) {
        return qualities
            .stream()
            .min(java.util.Comparator.comparingInt(q -> WORST_FIRST.indexOf(q) < 0 ? WORST_FIRST.size() : WORST_FIRST.indexOf(q)))
            .orElse("ESTIMATED");
    }

    /** Footprints of the buildings that hold this hamlet's households, with each building's height and its households. */
    private List<Map<String, Object>> buildings(long hamlet) {
        var rows = db.queryForList(
            "select b.id building_id, ST_AsGeoJSON(b.footprint_geom) geometry, " +
                "nullif(b.feature_json::jsonb #>> '{properties,height}', '')::double precision height, " +
                "jsonb_strip_nulls(jsonb_build_object(" +
                APPEARANCE_KEYS.stream()
                    .map(key -> "'" + key + "', b.feature_json::jsonb #> '{properties," + key + "}'")
                    .collect(java.util.stream.Collectors.joining(", ")) +
                "))::text appearance, " +
                "json_agg(json_build_object('id', h.roster_id, 'code', h.code, 'raw_address', h.raw_address, 'link_quality', " +
                RosterPatrolService.LINK_QUALITY_SQL +
                ") order by h.code)::text households " +
                "from public.gis_field_building b join public.gis_field_building_household l on l.building_id=b.id " +
                "join public.household h on h.id=l.household_id " +
                "left join public.gis_field_building_household_import i on i.household_id=h.id and i.building_id=b.id " +
                "where h.hamlet_id=? group by b.id, b.footprint_geom, b.feature_json order by b.id",
            hamlet
        );
        var result = new ArrayList<Map<String, Object>>();
        for (var row : rows) {
            var households = new ArrayList<Map<String, Object>>();
            var qualities = new ArrayList<String>();
            for (var household : json.readTree(row.get("households").toString())) {
                var item = new LinkedHashMap<String, Object>();
                item.put("id", household.path("id").asText());
                item.put("code", household.path("code").asText());
                item.put("raw_address", household.path("raw_address").asText());
                item.put("link_quality", household.path("link_quality").asText());
                qualities.add(household.path("link_quality").asText());
                households.add(item);
            }
            var properties = new LinkedHashMap<String, Object>();
            properties.put("id", row.get("building_id").toString());
            properties.put("height", clampHeight(row.get("height") instanceof Number n ? n.doubleValue() : null));
            properties.put("quality", worst(qualities));
            properties.put("household_count", households.size());
            properties.put("appearance", json.readTree(Objects.toString(row.get("appearance"), "{}")));
            properties.put("households", households);
            result.add(
                Map.of(
                    "type",
                    "Feature",
                    "id",
                    row.get("building_id").toString(),
                    "geometry",
                    json.readTree(row.get("geometry").toString()),
                    "properties",
                    properties
                )
            );
        }
        return result;
    }
}
