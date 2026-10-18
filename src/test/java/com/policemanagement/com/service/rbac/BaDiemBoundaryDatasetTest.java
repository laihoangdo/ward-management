package com.policemanagement.com.service.rbac;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class BaDiemBoundaryDatasetTest {

    @Test
    void everyImportedHamletHasItsOwnUsableScopeAndCannotGrantANeighboursScope() throws Exception {
        var mapper = new ObjectMapper();
        try (var input = getClass().getResourceAsStream("/config/liquibase/data/badiem-hamlet-boundaries-20261018.geojson")) {
            assertNotNull(input);
            var data = mapper.readTree(new String(input.readAllBytes(), StandardCharsets.UTF_8));
            assertEquals(51, data.path("features").size());
            var codes = new HashSet<String>();
            var territories = new ArrayList<JsonNode>();
            for (var feature : data.path("features")) {
                assertTrue(codes.add(feature.path("properties").path("code").asText()));
                assertTrue(feature.path("properties").path("provisional").asBoolean());
                assertFalse(TerritoryGeometry.area(feature).isEmpty());
                assertTrue(
                    TerritoryGeometry.covered(feature.path("geometry"), List.of(feature)),
                    feature.path("properties").path("code").asText()
                );
                territories.add(feature);
            }
            for (int i = 0; i < territories.size(); i++) {
                var own = territories.get(i);
                var other = territories.get((i + 1) % territories.size());
                assertTrue(
                    TerritoryGeometry.covered(own.path("geometry"), List.of(own, other)),
                    own.path("properties").path("code").asText()
                );
                assertFalse(TerritoryGeometry.covered(other.path("geometry"), List.of(own)), own.path("properties").toString());
                var area = TerritoryGeometry.area(own);
                var bounds = area.getBounds2D();
                boolean found = false;
                for (int x = 1; x < 40 && !found; x++) for (int y = 1; y < 40 && !found; y++) {
                    double lng = bounds.getMinX() + (bounds.getWidth() * x) / 40;
                    double lat = bounds.getMinY() + (bounds.getHeight() * y) / 40;
                    if (area.contains(lng, lat)) {
                        assertTrue(TerritoryGeometry.contains(lat, lng, List.of(own)));
                        assertFalse(TerritoryGeometry.contains(lat, lng, List.of(other)));
                        found = true;
                    }
                }
                assertTrue(found, "Each hamlet needs a usable interior");
            }
        }
    }
}
