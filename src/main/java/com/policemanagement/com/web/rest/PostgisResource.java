package com.policemanagement.com.web.rest;

import com.policemanagement.com.service.PostgisSpatialService;
import com.policemanagement.com.service.rbac.RbacService;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/gis/spatial")
public class PostgisResource {

    private final PostgisSpatialService spatial;
    private final RbacService rbac;
    private final GisFieldBuildingResource buildings;

    public PostgisResource(PostgisSpatialService spatial, RbacService rbac, GisFieldBuildingResource buildings) {
        this.spatial = spatial;
        this.rbac = rbac;
        this.buildings = buildings;
    }

    @GetMapping("/buildings")
    public Map<String, Object> viewport(
        @RequestParam double west,
        @RequestParam double south,
        @RequestParam double east,
        @RequestParam double north
    ) {
        rbac.permission("canViewField3DMap");
        // Same private-property and linked-household masking as the existing map API.
        return buildings.scopedView(spatial.viewport(west, south, east, north));
    }
}
