package com.policemanagement.com.service.roster;

import static org.junit.jupiter.api.Assertions.*;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class ResidentFilterTest {

    private static ResidentFilter parse(String... pairs) {
        var p = new HashMap<String, String>();
        for (int i = 0; i < pairs.length; i += 2) p.put(pairs[i], pairs[i + 1]);
        return ResidentFilter.parse(p);
    }

    @Test
    void rejectsUnknownCodesAndInvalidRanges() {
        for (String[] bad : new String[][] {
            { "kinds", "PERMANENT,DROP TABLE" },
            { "kind", "X" },
            { "gender", "M" },
            { "status", "OPEN" },
            { "expiringDays", "10" },
            { "ageMin", "-1" },
            { "ageMax", "131" },
            { "ageMin", "abc" },
            { "refDate", "2026-13-01" },
            { "householdRole", "OWNER" },
            { "facilityTypes", "HOTEL" },
            { "verification", "a;b" },
            { "sort", "random()" },
            { "scope", "province" },
            { "campaign", "1=1" },
        })
            assertThrows(ResponseStatusException.class, () -> parse(bad), String.join("=", bad));
        assertThrows(ResponseStatusException.class, () -> parse("ageMin", "30", "ageMax", "18"));
        assertThrows(ResponseStatusException.class, () -> parse("birthYearFrom", "2000", "birthYearTo", "1990"));
        assertThrows(ResponseStatusException.class, () -> parse("registeredFrom", "2026-02-01", "registeredTo", "2026-01-01"));
        assertThrows(ResponseStatusException.class, () -> parse("search", "x".repeat(201)));
    }

    @Test
    void userTextIsOnlyEverBoundNeverPartOfTheSql() {
        var filter = parse(
            "search",
            "Nguyễn' or 1=1 --",
            "address",
            "Trưng Vương'; drop table x",
            "classification",
            "Diện A' --",
            "kinds",
            "PERMANENT,TEMPORARY",
            "gender",
            "MALE",
            "ageMin",
            "18",
            "ageMax",
            "27",
            "householdRole",
            "HEAD",
            "facilityTypes",
            "BOARDING_HOUSE"
        );
        var sql = filter.where(List.of(28L, 29L), "lookup");
        assertFalse(sql.text().contains("Nguyễn"));
        assertFalse(sql.text().contains("Trưng"));
        assertFalse(sql.text().contains("Diện A"));
        assertTrue(sql.args().contains("Nguyễn' or 1=1 --"));
        assertTrue(sql.args().contains("Trưng Vương'; drop table x"));
        assertEquals(
            sql
                .text()
                .chars()
                .filter(c -> c == '?')
                .count(),
            sql.args().size()
        );
        assertTrue(sql.text().startsWith("r.hamlet_id in (?,?)"));
    }

    @Test
    void addressPathUsesTheAnchoredRegexAndRecordConditionsShareOneRecord() {
        var path = parse("address", "36/4").where(List.of(28L), "x");
        assertTrue(path.args().contains("(^|[^0-9A-Za-z/])36/4"));
        assertTrue(path.text().contains("~* ?"));
        var record = parse("kinds", "TEMPORARY", "status", "ACTIVE", "expiringDays", "15").record("rr");
        assertTrue(record.text().contains("rr.record_kind in (?)"));
        assertTrue(record.text().contains("current_date+?"));
        assertEquals(List.of("TEMPORARY", 15), record.args());
        assertEquals("true", parse().record("rr").text());
    }

    @Test
    void legacyKindJoinsTheKindListAndAgeCanBeDroppedForTheUnevaluableCount() {
        var filter = ResidentFilter.legacy("", "PERMANENT", "EXCEL", "MILITARY");
        assertEquals(List.of("PERMANENT"), filter.kinds());
        var aged = parse("ageMin", "60", "gender", "FEMALE");
        assertTrue(aged.hasAge());
        assertFalse(aged.withoutAge().hasAge());
        assertEquals("FEMALE", aged.withoutAge().gender());
    }

    @Test
    void summaryDescribesTheFilterInVietnamese() {
        assertEquals("Tất cả nhân khẩu", parse().summary());
        assertEquals(
            "Nam; thường trú; đang còn hiệu lực; từ 18 đến 27 tuổi; tuổi tính đến 01/01/2027",
            parse(
                "gender",
                "MALE",
                "kinds",
                "PERMANENT",
                "status",
                "ACTIVE",
                "ageMin",
                "18",
                "ageMax",
                "27",
                "refDate",
                "2027-01-01"
            ).summary()
        );
        assertEquals("Sinh năm 2012; là chủ hộ", parse("birthYearFrom", "2012", "birthYearTo", "2012", "householdRole", "HEAD").summary());
        assertTrue(parse("facilityTypes", "BOARDING_HOUSE").summary().contains("nhà trọ"));
    }

    @Test
    void auditDetailsNeverCarryFreeText() {
        var details = parse("search", "Nguyễn Văn A", "address", "12 Trưng Vương", "classification", "X", "gender", "MALE").auditDetails();
        assertEquals(true, details.get("search"));
        assertEquals(true, details.get("address"));
        assertEquals("MALE", details.get("gender"));
        assertFalse(details.toString().contains("Nguyễn"));
        assertFalse(details.toString().contains("Trưng"));
    }

    @Test
    void ordersByGivenNameTheVietnameseWayAndGroupsByHamletWhenNeeded() {
        assertTrue(parse("sort", "NAME").orderBy(false).startsWith("regexp_replace(r.full_name"));
        assertTrue(parse().orderBy(true).startsWith("hm.sort_order"));
        assertTrue(parse().orderBy(false).startsWith("h.raw_address"));
    }

    @Test
    void masksIdentityToTheLastThreeDigitsAndValidatesColumns() {
        assertEquals("*********123", ResidentExportService.mask("079000000123"));
        assertEquals("***", ResidentExportService.mask("12"));
        assertEquals("", ResidentExportService.mask(null));
        var columns = ResidentExportService.columns("fullName,identity");
        assertEquals(List.of("stt", "fullName", "identity"), columns.stream().map(ResidentExportService.Column::key).toList());
        assertEquals(ResidentExportService.DEFAULT_COLUMNS.size(), ResidentExportService.columns("").size());
        assertThrows(ResponseStatusException.class, () -> ResidentExportService.columns("fullName,password"));
    }

    @Test
    void spreadsheetTextIsProtectedAndFileNamesAreAscii() {
        assertEquals("'=HYPERLINK(1)", ResidentExportWorkbook.safe("=HYPERLINK(1)"));
        assertEquals("'-1", ResidentExportWorkbook.safe("-1"));
        assertEquals("Nguyễn", ResidentExportWorkbook.safe("Nguyễn"));
        var export = new ResidentExportService.Export(
            "Xã Bà Điểm",
            "Ấp Trung Chánh 2",
            "",
            List.of(),
            List.of(),
            0,
            0,
            0,
            null,
            List.of(),
            false,
            false,
            "",
            ""
        );
        assertEquals(
            "danh-sach-nhan-khau-ap-trung-chanh-2-20261113.xlsx",
            ResidentExportService.fileName(export, LocalDate.of(2026, 11, 13))
        );
    }
}
