package com.policemanagement.com.service.rbac;

import java.awt.geom.Area;
import java.awt.geom.Path2D;
import java.util.Collection;
import java.util.List;
import tools.jackson.databind.JsonNode;

/** Exact polygon-area subtraction: vertices alone do not detect holes or concave boundaries. */
public final class TerritoryGeometry {

    private TerritoryGeometry() {}

    public static Area area(JsonNode value) {
        var result = new Area();
        if (value == null) return result;
        String type = value.path("type").asText();
        if ("Feature".equals(type)) return area(value.path("geometry"));
        if ("FeatureCollection".equals(type)) {
            for (JsonNode feature : value.path("features")) result.add(area(feature));
        } else if ("Polygon".equals(type)) result.add(polygon(value.path("coordinates")));
        else if ("MultiPolygon".equals(type)) for (JsonNode rings : value.path("coordinates")) result.add(polygon(rings));
        return result;
    }

    private static Area polygon(JsonNode rings) {
        var path = new Path2D.Double(Path2D.WIND_EVEN_ODD);
        for (JsonNode ring : rings) {
            if (ring.size() < 4) return new Area();
            for (int i = 0; i < ring.size(); i++) {
                double x = ring.get(i).path(0).asDouble(Double.NaN),
                    y = ring.get(i).path(1).asDouble(Double.NaN);
                if (!Double.isFinite(x) || !Double.isFinite(y)) return new Area();
                if (i == 0) path.moveTo(x, y);
                else path.lineTo(x, y);
            }
            path.closePath();
        }
        return new Area(path);
    }

    public static boolean covered(JsonNode geometry, Collection<JsonNode> territories) {
        return coveredByPrepared(geometry, prepare(territories));
    }

    /** Parses boundaries once: for many footprints, parsing a hamlet outline costs far more than testing a house. */
    public static List<Area> prepare(Collection<JsonNode> territories) {
        return territories.stream().map(TerritoryGeometry::area).toList();
    }

    public static boolean coveredByPrepared(JsonNode geometry, List<Area> territories) {
        Area footprint = area(geometry);
        if (footprint.isEmpty()) return false;
        var bounds = footprint.getBounds2D();
        // Avoid an extra Area.add(empty, complexPolygon) normalization: it can
        // perturb coincident edges and make a polygon fail coverage by itself.
        Area allowed = null;
        for (Area next : territories) {
            // A territory whose box misses the footprint cannot cover any of it.
            if (!next.getBounds2D().intersects(bounds)) continue;
            Area remaining = (Area) footprint.clone();
            remaining.subtract(next);
            if (remaining.isEmpty()) return true;
            if (allowed == null) allowed = new Area(next);
            else allowed.add(next);
        }
        if (allowed == null) return false;
        footprint.subtract(allowed);
        return footprint.isEmpty();
    }

    public static boolean contains(double lat, double lng, Collection<JsonNode> territories) {
        return Double.isFinite(lat) && Double.isFinite(lng) && territories.stream().anyMatch(t -> area(t).contains(lng, lat));
    }
}
