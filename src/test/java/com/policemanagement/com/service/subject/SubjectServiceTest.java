package com.policemanagement.com.service.subject;

import static org.junit.jupiter.api.Assertions.*;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class SubjectServiceTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 15);

    private static Map<String, Object> row(String status, LocalDate until, LocalDate next) {
        var row = new HashMap<String, Object>();
        row.put("status", status);
        row.put("managed_until", until == null ? null : java.sql.Date.valueOf(until));
        row.put("next_summon_due", next == null ? null : java.sql.Date.valueOf(next));
        return row;
    }

    @Test
    void managementDeadlineIsDueWithinThirtyDaysAndExpiredAfter() {
        var due = row("ACTIVE", TODAY.plusDays(30), null);
        SubjectService.flags(due, TODAY);
        assertEquals(true, due.get("management_due"));
        assertEquals(false, due.get("management_expired"));

        var later = row("ACTIVE", TODAY.plusDays(31), null);
        SubjectService.flags(later, TODAY);
        assertEquals(false, later.get("management_due"));

        var expired = row("ACTIVE", TODAY.minusDays(1), null);
        SubjectService.flags(expired, TODAY);
        assertEquals(true, expired.get("management_expired"));
        assertEquals(false, expired.get("management_due"));

        var open = row("ACTIVE", null, null);
        SubjectService.flags(open, TODAY);
        assertEquals(false, open.get("management_due"));
        assertEquals(false, open.get("management_expired"));
    }

    @Test
    void summonIsDueWithinSevenDaysOverdueAfterAndNeverForEndedSubjects() {
        var due = row("ACTIVE", null, TODAY.plusDays(7));
        SubjectService.flags(due, TODAY);
        assertEquals(true, due.get("summon_due"));
        var overdue = row("ACTIVE", null, TODAY.minusDays(1));
        SubjectService.flags(overdue, TODAY);
        assertEquals(true, overdue.get("summon_overdue"));
        var ended = row("ENDED", TODAY.minusDays(1), TODAY.minusDays(1));
        SubjectService.flags(ended, TODAY);
        assertEquals(false, ended.get("summon_overdue"));
        assertEquals(false, ended.get("management_expired"));
    }

    private static Map<String, Object> input(String... pairs) {
        var d = new HashMap<String, Object>();
        for (int i = 0; i < pairs.length; i += 2) d.put(pairs[i], pairs[i + 1]);
        return d;
    }

    @Test
    void suspicionFieldsAreKeptOnlyForTheSuspectCategory() {
        var d = input("managedFrom", "2026-01-01", "suspiciousSigns", "Hay tụ tập đêm", "tb136Scope", "Diện 1");
        var suspect = SubjectService.fields(d, "NV");
        assertEquals("Hay tụ tập đêm", suspect.signs());
        assertEquals("Diện 1", suspect.tb136());
        var criminal = SubjectService.fields(d, "HS");
        assertEquals("", criminal.signs());
        assertEquals("", criminal.tb136());
        assertEquals(1, criminal.interval());
    }

    @Test
    void periodAndIntervalAreValidated() {
        assertThrows(ResponseStatusException.class, () -> SubjectService.fields(input(), "HS"));
        assertThrows(ResponseStatusException.class, () ->
            SubjectService.fields(input("managedFrom", LocalDate.now().plusDays(1).toString()), "HS")
        );
        assertThrows(ResponseStatusException.class, () ->
            SubjectService.fields(input("managedFrom", "2026-05-01", "managedUntil", "2026-04-30"), "HS")
        );
        assertThrows(ResponseStatusException.class, () ->
            SubjectService.fields(input("managedFrom", "2026-05-01", "summonIntervalMonths", "13"), "HS")
        );
        assertThrows(ResponseStatusException.class, () ->
            SubjectService.fields(input("managedFrom", "2026-05-01", "summonIntervalMonths", "abc"), "HS")
        );
        assertThrows(ResponseStatusException.class, () -> SubjectService.fields(input("managedFrom", "15/05/2026"), "HS"));
        assertEquals(3, SubjectService.fields(input("managedFrom", "2026-05-01", "summonIntervalMonths", "3"), "MT").interval());
    }

    @Test
    void securityAndSuspectCategoriesRecordViolationsOnly() {
        assertEquals(java.util.Set.of("AN", "NV"), SubjectService.VIOLATIONS_ONLY);
        assertEquals(6, SubjectService.CATEGORIES.size());
    }
}
