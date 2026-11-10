package com.policemanagement.com.service.roster;

import static org.junit.jupiter.api.Assertions.*;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.zip.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

class RosterWorkbookTest {

    static byte[] workbook(String rows) throws Exception {
        var out = new ByteArrayOutputStream();
        try (var zip = new ZipOutputStream(out)) {
            Map<String, String> parts = Map.of(
                "xl/workbook.xml",
                "<workbook xmlns:r='http://schemas.openxmlformats.org/officeDocument/2006/relationships'><sheets><sheet name='Thường trú' r:id='r1'/></sheets></workbook>",
                "xl/_rels/workbook.xml.rels",
                "<Relationships><Relationship Id='r1' Target='worksheets/sheet1.xml'/></Relationships>",
                "xl/styles.xml",
                "<styleSheet><cellXfs><xf numFmtId='0'/></cellXfs></styleSheet>",
                "xl/worksheets/sheet1.xml",
                "<worksheet><sheetData><row r='1'>" +
                    cell("A1", "STT") +
                    cell("B1", "Họ và tên") +
                    cell("C1", "Ngày sinh") +
                    cell("D1", "Giới tính") +
                    cell("E1", "Định danh") +
                    cell("F1", "Họ và tên chủ hộ") +
                    cell("G1", "Số HSCT") +
                    cell("H1", "Nơi thường trú") +
                    "</row>" +
                    rows +
                    "</sheetData></worksheet>"
            );
            for (var p : parts.entrySet()) {
                zip.putNextEntry(new ZipEntry(p.getKey()));
                zip.write(p.getValue().getBytes(StandardCharsets.UTF_8));
                zip.closeEntry();
            }
        }
        return out.toByteArray();
    }

    static String cell(String ref, String text) {
        return "<c r='" + ref + "' t='inlineStr'><is><t>" + text + "</t></is></c>";
    }

    static String row(int n, String name, String birth, String identity) {
        return (
            "<row r='" +
            n +
            "'>" +
            cell("A" + n, "" + (n - 1)) +
            cell("B" + n, name) +
            cell("C" + n, birth) +
            cell("D" + n, "Nam") +
            cell("E" + n, identity) +
            cell("F" + n, "Đại diện mẫu") +
            cell("G" + n, "HSCT-TEST") +
            cell("H" + n, "Địa chỉ thử nghiệm") +
            "</row>"
        );
    }

    @Test
    void preservesLeadingZerosAndYearPrecision() throws Exception {
        var p = RosterWorkbook.parse(workbook(row(2, "Người mẫu", "1979", "001079000001")), "63");
        var r = p.rows().get(1);
        assertEquals("001079000001", r.data().get("identity"));
        assertEquals("YEAR", r.data().get("birthPrecision"));
        assertEquals(1979, r.data().get("birthYear"));
        assertFalse(r.data().containsKey("birthDate"));
        assertTrue(r.errors().isEmpty());
    }

    @Test
    void rejectsInvalidCalendarDate() throws Exception {
        var p = RosterWorkbook.parse(workbook(row(2, "Người mẫu", "31/02/2000", "001000000001")), "63");
        assertTrue(p.rows().get(1).errors().contains("INVALID_BIRTH_DATE"));
    }

    @Test
    void acceptsDayAndNormalizesSex() throws Exception {
        var p = RosterWorkbook.parse(workbook(row(2, "Người mẫu", "01/02/2000", "001000000001")), "63");
        assertEquals("2000-02-01", p.rows().get(1).data().get("birthDate"));
        assertEquals("MALE", p.rows().get(1).data().get("gender"));
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "RUN_TC2_SOURCE_TESTS", matches = "true")
    void reconcilesAllFourAuthorizedWorkbookLayouts() throws Exception {
        Map<String, Integer> expected = Map.of("61", 2050, "62", 2039, "63", 383, "69", 741);
        int total = 0;
        try (var paths = Files.list(Path.of("."))) {
            for (Path p : paths
                .filter(p -> p.getFileName().toString().startsWith("DSNK - TC2") && p.toString().endsWith(".xlsx"))
                .toList()) {
                var matcher = java.util.regex.Pattern.compile("(61|62|63|69)").matcher(p.toString());
                assertTrue(matcher.find());
                String legacy = matcher.group();
                var parsed = RosterWorkbook.parse(Files.readAllBytes(p), legacy);
                var business = parsed
                    .rows()
                    .stream()
                    .filter(r -> Set.of("PERMANENT", "TEMPORARY", "NOHT", "ARTICLE19").contains(r.kind()))
                    .toList();
                assertEquals(expected.get(legacy), business.size());
                assertTrue(business.stream().allMatch(r -> r.errors().isEmpty()), "Unexpected parser validation error");
                total += business.size();
                if (legacy.equals("63")) assertEquals(
                    "YEAR",
                    business
                        .stream()
                        .filter(r -> r.sheet().equals("Thường trú") && r.number() == 280)
                        .findFirst()
                        .orElseThrow()
                        .data()
                        .get("birthPrecision")
                );
                if (legacy.equals("69")) assertTrue(
                    parsed
                        .rows()
                        .stream()
                        .filter(r -> r.sheet().equals("Sheet1"))
                        .allMatch(r -> r.kind().equals("AUXILIARY"))
                );
            }
        }
        assertEquals(5213, total);
    }
}
