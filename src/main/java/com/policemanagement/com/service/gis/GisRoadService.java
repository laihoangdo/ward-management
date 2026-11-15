package com.policemanagement.com.service.gis;

import com.policemanagement.com.service.rbac.RbacService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Road network (OpenStreetMap import, see scripts/osm) for routing on the officer's device. Public road data with no link
 * to households; the officer's position is never sent to the server.
 */
@Service
@Transactional(readOnly = true)
public class GisRoadService {

    /** GeoJSON of the roads and a tag that changes whenever any road row changes. */
    public record Roads(String etag, String geojson) {}

    private static final String SIGNATURE =
        "select count(*) || '-' || coalesce(sum(hashtext(concat_ws('|', id, external_id, name, road_type, status, oneway, " +
        "motorcycle_allowed, foot_allowed, geometry_geojson))::bigint), 0) from public.gis_road";
    private static final String GEOJSON =
        "select json_build_object('type','FeatureCollection','features',coalesce(json_agg(json_build_object(" +
        "'type','Feature','id',id,'geometry',geometry_geojson::json,'properties',json_build_object(" +
        "'name',name,'type',road_type,'oneway',oneway,'motorcycle',motorcycle_allowed,'foot',foot_allowed)) order by id),'[]'::json))::text " +
        "from public.gis_road where coalesce(status,'ACTIVE')<>'REMOVED'";

    private final JdbcTemplate db;
    private final RbacService rbac;
    private volatile Roads cached;

    public GisRoadService(JdbcTemplate db, RbacService rbac) {
        this.db = db;
        this.rbac = rbac;
    }

    public Roads roads() {
        rbac.current();
        String signature = '"' + db.queryForObject(SIGNATURE, String.class) + '"';
        Roads current = cached;
        if (current != null && current.etag().equals(signature)) return current;
        current = new Roads(signature, db.queryForObject(GEOJSON, String.class));
        cached = current;
        return current;
    }
}
