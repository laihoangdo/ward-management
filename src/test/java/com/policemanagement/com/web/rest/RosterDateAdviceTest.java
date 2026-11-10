package com.policemanagement.com.web.rest;

import static org.junit.jupiter.api.Assertions.*;

import java.util.*;
import org.junit.jupiter.api.Test;

class RosterDateAdviceTest {

    @Test
    void jdbcBirthDatesKeepTheirCalendarDayInNestedResponses() {
        for (String day : List.of("1987-08-05", "2010-01-27", "1992-01-30")) {
            var timestamp = java.sql.Timestamp.valueOf("2026-10-27 12:30:00");
            var response = Map.of(
                "items",
                List.of(Map.of("birth_date", java.sql.Date.valueOf(day), "created_at", timestamp)),
                "birth_year",
                1979
            );
            var normalized = (Map<?, ?>) RosterDateAdvice.calendarDates(response);
            var person = (Map<?, ?>) ((List<?>) normalized.get("items")).getFirst();
            assertEquals(day, person.get("birth_date"));
            assertEquals(timestamp, person.get("created_at"));
            assertEquals(1979, normalized.get("birth_year"));
        }
        assertNull(RosterDateAdvice.calendarDates(null));
    }
}
