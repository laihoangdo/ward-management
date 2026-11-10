package com.policemanagement.com.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

class PostgisSpatialServiceTest {

    @Test
    void disabledModeNeverQueriesMissingSpatialColumns() {
        var db = mock(JdbcTemplate.class);
        var spatial = new PostgisSpatialService(db, new ObjectMapper(), false);
        assertEquals(
            503,
            assertThrows(ResponseStatusException.class, () -> spatial.viewport(0, 0, 1, 1))
                .getStatusCode()
                .value()
        );
        verifyNoInteractions(db);
    }

    @Test
    void invalidViewportAndMissingAssignmentFailClosed() {
        var db = mock(JdbcTemplate.class);
        var spatial = new PostgisSpatialService(db, new ObjectMapper(), true);
        assertThrows(ResponseStatusException.class, () -> spatial.viewport(Double.NaN, 0, 1, 1));
        assertThrows(ResponseStatusException.class, () -> spatial.viewport(5, 0, 1, 1));
        assertThrows(ResponseStatusException.class, () -> spatial.viewport(-181, 0, 1, 1));
        assertFalse(spatial.covered(new ObjectMapper().readTree("{}"), List.of()));
        assertFalse(spatial.contains(10, 106, List.of()));
        assertFalse(spatial.contains(91, 106, List.of(1L)));
        verifyNoInteractions(db);
    }
}
