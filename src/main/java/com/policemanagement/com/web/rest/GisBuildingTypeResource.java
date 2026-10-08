package com.policemanagement.com.web.rest;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Map presentation configuration, separate from household records. */
@RestController
@RequestMapping("/api/gis/building-types")
public class GisBuildingTypeResource {

    private final JdbcTemplate jdbc;

    public GisBuildingTypeResource(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record BuildingTypeView(Long id, String code, String name, double defaultHeightM, String color, Integer floorCount) {}

    public record UpdateBuildingTypeRequest(String name, Double defaultHeightM, String color, Integer floorCount) {}

    @GetMapping
    public List<BuildingTypeView> list() {
        return jdbc.query("select id, code, name, default_height_m, color, floor_count from gis_building_type order by id", (rs, rowNum) ->
            new BuildingTypeView(
                rs.getLong("id"),
                rs.getString("code"),
                rs.getString("name"),
                rs.getDouble("default_height_m"),
                rs.getString("color"),
                rs.getObject("floor_count", Integer.class)
            )
        );
    }

    @PutMapping("/{code}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPERADMIN')")
    public BuildingTypeView update(@PathVariable String code, @RequestBody UpdateBuildingTypeRequest request) {
        if (
            request.name() == null ||
            request.name().isBlank() ||
            request.name().length() > 120 ||
            request.defaultHeightM() == null ||
            request.defaultHeightM() < 2 ||
            request.defaultHeightM() > 300 ||
            request.color() == null ||
            !request.color().matches("#[0-9a-fA-F]{6}") ||
            request.floorCount() == null ||
            request.floorCount() < 1 ||
            request.floorCount() > 100
        ) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid building type settings");
        }
        int updated = jdbc.update(
            "update gis_building_type set name = ?, default_height_m = ?, color = ?, floor_count = ? where code = ?",
            request.name().trim(),
            request.defaultHeightM(),
            request.color(),
            request.floorCount(),
            code
        );
        if (updated == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown building type");
        return list()
            .stream()
            .filter(item -> item.code().equals(code))
            .findFirst()
            .orElseThrow();
    }
}
