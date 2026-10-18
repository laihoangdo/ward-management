package com.policemanagement.com.service.rbac;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class TerritoryGeometryTest {

    private final ObjectMapper json = new ObjectMapper();

    private JsonNode polygon(String rings) {
        return json.readTree("{\"type\":\"Polygon\",\"coordinates\":" + rings + "}");
    }

    @Test
    void requiresTheWholeFootprintInsideAssignedArea() {
        var territory = polygon("[[[0,0],[10,0],[10,10],[0,10],[0,0]]]");
        assertTrue(TerritoryGeometry.covered(polygon("[[[1,1],[2,1],[2,2],[1,2],[1,1]]]"), List.of(territory)));
        assertFalse(TerritoryGeometry.covered(polygon("[[[9,1],[11,1],[11,2],[9,2],[9,1]]]"), List.of(territory)));
        assertFalse(TerritoryGeometry.covered(territory, List.of()));
    }

    @Test
    void detectsEnclosedUnassignedHolesEvenWhenEveryFootprintVertexIsInside() {
        var territory = polygon("[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[3,3],[7,3],[7,7],[3,7],[3,3]]]");
        assertFalse(TerritoryGeometry.covered(polygon("[[[1,1],[9,1],[9,9],[1,9],[1,1]]]"), List.of(territory)));
        assertFalse(TerritoryGeometry.contains(5, 5, List.of(territory)));
    }

    @Test
    void supportsTheUnionOfAssignedHamletsAndRejectsGaps() {
        var left = polygon("[[[0,0],[2,0],[2,2],[0,2],[0,0]]]");
        var right = polygon("[[[3,0],[5,0],[5,2],[3,2],[3,0]]]");
        assertFalse(TerritoryGeometry.covered(polygon("[[[1,0],[4,0],[4,1],[1,1],[1,0]]]"), List.of(left, right)));
        var both = json.readTree(
            "{\"type\":\"MultiPolygon\",\"coordinates\":[[[[0,0],[1,0],[1,1],[0,1],[0,0]]],[[[3,0],[4,0],[4,1],[3,1],[3,0]]]]}"
        );
        assertTrue(TerritoryGeometry.covered(both, List.of(left, right)));
    }
}
