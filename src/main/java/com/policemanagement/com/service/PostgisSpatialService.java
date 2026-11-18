package com.policemanagement.com.service;

import java.util.List;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** WGS84 polygons derived from the same source boundaries as the legacy Java policy. */
@Service
public class PostgisSpatialService {

    private record Territory(String ids, byte[] geometry) {}

    private final JdbcTemplate db;
    private final ObjectMapper json;
    private final boolean enabled;

    public PostgisSpatialService(JdbcTemplate db, ObjectMapper json, @Value("${gis.postgis.enabled:false}") boolean enabled) {
        this.db = db;
        this.json = json;
        this.enabled = enabled;
    }

    public boolean enabled() {
        return enabled;
    }

    private void requireEnabled() {
        if (!enabled) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "PostGIS chưa được bật và nghiệm thu");
    }

    private byte[] territory(List<Long> ids) {
        if (ids.isEmpty()) return null;
        String array = ids
            .stream()
            .sorted()
            .map(String::valueOf)
            .collect(Collectors.joining(",", "{", "}"));
        var request = RequestContextHolder.getRequestAttributes();
        String key = "postgis.allowedTerritory";
        if (
            request != null &&
            request.getAttribute(key, RequestAttributes.SCOPE_REQUEST) instanceof Territory cached &&
            cached.ids().equals(array)
        ) {
            return cached.geometry();
        }
        byte[] geometry = db.queryForObject(
            "select ST_AsEWKB(ST_UnaryUnion(ST_Collect(boundary_geom))) from hamlet where id=any(?::bigint[]) and boundary_geom is not null",
            byte[].class,
            array
        );
        if (request != null) request.setAttribute(key, new Territory(array, geometry), RequestAttributes.SCOPE_REQUEST);
        return geometry;
    }

    public boolean covered(JsonNode geometry, List<Long> areas) {
        requireEnabled();
        byte[] allowed = territory(areas);
        if (allowed == null) return false;
        return Boolean.TRUE.equals(
            db.queryForObject(
                "select coalesce(ST_Covers(ST_GeomFromEWKB(?),public.gis_polygon(?::jsonb)),false)",
                Boolean.class,
                allowed,
                json.writeValueAsString(geometry)
            )
        );
    }

    public boolean contains(Number latitude, Number longitude, List<Long> areas) {
        requireEnabled();
        if (
            latitude == null ||
            longitude == null ||
            !Double.isFinite(latitude.doubleValue()) ||
            !Double.isFinite(longitude.doubleValue()) ||
            Math.abs(latitude.doubleValue()) > 90 ||
            Math.abs(longitude.doubleValue()) > 180
        ) return false;
        byte[] allowed = territory(areas);
        return (
            allowed != null &&
            Boolean.TRUE.equals(
                db.queryForObject(
                    "select ST_Contains(ST_GeomFromEWKB(?),ST_SetSRID(ST_MakePoint(?,?),4326))",
                    Boolean.class,
                    allowed,
                    longitude.doubleValue(),
                    latitude.doubleValue()
                )
            )
        );
    }

    public List<JsonNode> viewport(double west, double south, double east, double north) {
        requireEnabled();
        if (
            !Double.isFinite(west) ||
            !Double.isFinite(south) ||
            !Double.isFinite(east) ||
            !Double.isFinite(north) ||
            west < -180 ||
            east > 180 ||
            south < -90 ||
            north > 90 ||
            west >= east ||
            south >= north
        ) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Khung nhìn WGS84 không hợp lệ");
        }
        var rows = db.query(
            "select feature_json from gis_field_building where ST_Intersects(footprint_geom,ST_MakeEnvelope(?,?,?,?,4326)) order by id limit 1001",
            (rs, index) -> json.readTree(rs.getString(1)),
            west,
            south,
            east,
            north
        );
        if (rows.size() > 1000) throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "Thu hẹp khung nhìn để tải tối đa 1000 công trình"
        );
        return rows;
    }
}
