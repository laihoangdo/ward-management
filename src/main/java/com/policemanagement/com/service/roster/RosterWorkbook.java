package com.policemanagement.com.service.roster;

import java.io.*;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.Normalizer;
import java.time.*;
import java.time.format.*;
import java.util.*;
import java.util.zip.*;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.*;

/** Bounded OOXML reader for the four existing layouts. Does not evaluate formulas or follow external links. */
public final class RosterWorkbook {

    private RosterWorkbook() {}

    public record Row(String sheet, int number, String kind, Map<String, Object> raw, Map<String, Object> data, List<String> errors) {}

    public record Parsed(String hash, List<Row> rows) {}

    public static String norm(String value) {
        return Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFC)
            .strip()
            .replaceAll("\\s+", " ")
            .toLowerCase(Locale.ROOT);
    }

    private static Document xml(byte[] bytes) throws Exception {
        var f = DocumentBuilderFactory.newInstance();
        f.setNamespaceAware(true);
        f.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        f.setFeature("http://xml.org/sax/features/external-general-entities", false);
        f.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        f.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
        f.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
        return f.newDocumentBuilder().parse(new ByteArrayInputStream(bytes));
    }

    private static List<Element> elements(Node node, String tag) {
        NodeList list = ((Element) node).getElementsByTagNameNS("*", tag);
        var result = new ArrayList<Element>();
        for (int i = 0; i < list.getLength(); i++) result.add((Element) list.item(i));
        return result;
    }

    private static String text(Element element, String tag) {
        var list = elements(element, tag);
        return list.isEmpty() ? "" : list.getFirst().getTextContent();
    }

    private static Element root(byte[] bytes) throws Exception {
        if (bytes == null) throw new IllegalArgumentException("Missing XLSX part");
        return xml(bytes).getDocumentElement();
    }

    public static Parsed parse(byte[] bytes, String legacy) {
        if (!Set.of("61", "62", "63", "69").contains(legacy)) throw new IllegalArgumentException("Unsupported source hamlet");
        if (bytes.length > 10_000_000) throw new IllegalArgumentException("XLSX exceeds 10 MB");
        try {
            Map<String, byte[]> parts = new HashMap<>();
            long total = 0;
            try (var zip = new ZipInputStream(new ByteArrayInputStream(bytes), StandardCharsets.UTF_8)) {
                ZipEntry entry;
                int count = 0;
                while ((entry = zip.getNextEntry()) != null) {
                    if (++count > 500) throw new IllegalArgumentException("Too many XLSX parts");
                    if (entry.isDirectory()) continue;
                    byte[] data = zip.readNBytes(20_000_001);
                    total += data.length;
                    if (data.length > 20_000_000 || total > 60_000_000) throw new IllegalArgumentException("Expanded XLSX limit exceeded");
                    if (parts.put(entry.getName(), data) != null) throw new IllegalArgumentException("Duplicate XLSX part");
                }
            }
            var strings = new ArrayList<String>();
            if (parts.containsKey("xl/sharedStrings.xml")) for (var si : elements(root(parts.get("xl/sharedStrings.xml")), "si")) {
                var value = new StringBuilder();
                for (var t : elements(si, "t")) value.append(t.getTextContent());
                strings.add(value.toString());
            }
            var formats = new HashMap<String, String>();
            Element styles = root(parts.get("xl/styles.xml"));
            for (var fmt : elements(styles, "numFmt")) formats.put(fmt.getAttribute("numFmtId"), fmt.getAttribute("formatCode"));
            var dateStyles = new ArrayList<Boolean>();
            var formatStyles = new ArrayList<String>();
            for (var group : elements(styles, "cellXfs"))
                for (var xf : elements(group, "xf")) {
                    int id = Integer.parseInt(xf.getAttribute("numFmtId"));
                    String format = formats.getOrDefault("" + id, "");
                    dateStyles.add(
                        (id >= 14 && id <= 22) ||
                            (id >= 27 && id <= 36) ||
                            (id >= 45 && id <= 47) ||
                            format.toLowerCase(Locale.ROOT).replaceAll("\"[^\"]*\"|\\[[^]]*]", "").matches(".*[dy].*")
                    );
                    formatStyles.add(format);
                }
            var relationships = new HashMap<String, String>();
            for (var rel : elements(root(parts.get("xl/_rels/workbook.xml.rels")), "Relationship")) {
                if ("External".equals(rel.getAttribute("TargetMode"))) continue;
                String target = rel.getAttribute("Target");
                relationships.put(rel.getAttribute("Id"), target.startsWith("/") ? target.substring(1) : "xl/" + target);
            }
            Element book = root(parts.get("xl/workbook.xml"));
            if (
                elements(book, "workbookPr")
                    .stream()
                    .anyMatch(e -> Set.of("1", "true").contains(e.getAttribute("date1904")))
            ) throw new IllegalArgumentException("1904 calendar requires a separate mapping");
            var result = new ArrayList<Row>();
            for (var sheet : elements(book, "sheet")) {
                String name = sheet.getAttribute("name");
                String kind = switch (norm(name)) {
                    case "thường trú" -> "PERMANENT";
                    case "tạm trú" -> "TEMPORARY";
                    case "khai báo noht" -> "NOHT";
                    case "nk đ19" -> "ARTICLE19";
                    default -> "AUXILIARY";
                };
                var header = new HashMap<String, String>();
                for (var row : elements(
                    root(
                        parts.get(
                            relationships.get(
                                sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id")
                            )
                        )
                    ),
                    "row"
                )) {
                    int number = Integer.parseInt(row.getAttribute("r"));
                    if (result.size() > 25000) throw new IllegalArgumentException("Too many XLSX rows");
                    Map<String, Object> raw = new LinkedHashMap<>();
                    Map<String, String> cells = new HashMap<>();
                    for (var cell : elements(row, "c")) {
                        String col = cell.getAttribute("r").replaceAll("[0-9]", "");
                        String type = cell.getAttribute("t");
                        String v = text(cell, "v");
                        String original = v;
                        int style = cell.hasAttribute("s") ? Integer.parseInt(cell.getAttribute("s")) : 0;
                        if (type.equals("s")) v = strings.get(Integer.parseInt(v));
                        else if (type.equals("inlineStr")) v = text(cell, "t");
                        else if (!v.isBlank() && !type.equals("str") && !type.equals("e")) {
                            if (style < dateStyles.size() && dateStyles.get(style)) v = LocalDate.of(1899, 12, 30)
                                .plusDays(new BigDecimal(v).longValue())
                                .toString();
                            else v = new BigDecimal(v).stripTrailingZeros().toPlainString();
                        }
                        cells.put(col, v.trim());
                        raw.put(
                            col,
                            Map.of(
                                "value",
                                v,
                                "storedValue",
                                original,
                                "type",
                                type,
                                "formula",
                                text(cell, "f"),
                                "format",
                                style < formatStyles.size() ? formatStyles.get(style) : ""
                            )
                        );
                    }
                    if (cells.values().stream().allMatch(String::isBlank)) continue;
                    if (number == 1 && !kind.equals("AUXILIARY")) {
                        cells.forEach((c, v) -> header.put(c, norm(v)));
                        result.add(new Row(name, number, "HEADER", raw, Map.of(), List.of()));
                        continue;
                    }
                    if (kind.equals("AUXILIARY")) {
                        result.add(new Row(name, number, kind, raw, Map.of(), List.of()));
                        continue;
                    }
                    if (cells.getOrDefault("A", "").isBlank()) {
                        result.add(new Row(name, number, "SUMMARY", raw, Map.of(), List.of()));
                        continue;
                    }
                    var errors = new ArrayList<String>();
                    Map<String, Object> data = new LinkedHashMap<>();
                    for (var cell : cells.entrySet()) {
                        String h = header.getOrDefault(cell.getKey(), "");
                        String v = cell.getValue();
                        String key = switch (h) {
                            case "họ và tên" -> "fullName";
                            case "ngày sinh" -> "birth";
                            case "giới tính" -> "gender";
                            case "số đdcn/cccd/ cmnd", "số đdcn/cccd/cmnd", "định danh" -> "identity";
                            case "họ và tên chủ hộ", "họ tên chủ hộ/ người đại diện" -> "representative";
                            case "số hsct" -> "caseNumber";
                            case "nơi thường trú", "địa chỉ nơi thường trú" -> "permanentAddress";
                            case "nơi ở hiện tại", "nơi ở hiện nay" -> "currentAddress";
                            case "nơi tạm trú" -> "temporaryAddress";
                            case "địa chỉ khai báo" -> "declaredAddress";
                            case "nơi cư trú trước khi chuyển đến" -> "previousAddress";
                            case "ngày đktt", "ngày đăng ký" -> "registrationDate";
                            case "thời hạn tạm trú" -> "validTo";
                            case "thời gian cư trú" -> "residenceTimeRaw";
                            case "họ tên cha" -> "fatherName";
                            case "họ tên mẹ" -> "motherName";
                            case "trạng thái", "tình trạng cư trú" -> "sourceStatus";
                            case "trạng thái nk quản lý đặc thù", "phân loại nk quản lý đặc thù" -> "classification";
                            case "phân loại nhà ở" -> "housingClassification";
                            case "loại hình đăng ký" -> "registrationForm";
                            case "đánh x nếu thực tế cư trú" -> "presence";
                            default -> "";
                        };
                        if (legacy.equals("62") && kind.equals("NOHT") && h.equals("column1")) key = "sourceStatus";
                        if (legacy.equals("62") && kind.equals("NOHT") && h.equals("column2")) key = "classification";
                        if (!key.isEmpty() && !v.isBlank()) data.put(key, v);
                    }
                    if (
                        !header.containsValue("họ và tên") ||
                        !header.containsValue("ngày sinh") ||
                        !header.containsValue("giới tính") ||
                        header
                            .values()
                            .stream()
                            .noneMatch(h -> h.contains("cccd") || h.equals("định danh"))
                    ) throw new IllegalArgumentException("Unrecognized required columns: " + name);
                    String full = Objects.toString(data.get("fullName"), "");
                    if (full.isBlank()) errors.add("MISSING_NAME");
                    String birth = Objects.toString(data.remove("birth"), "");
                    if (birth.matches("[12][0-9]{3}")) {
                        data.put("birthYear", Integer.parseInt(birth));
                        data.put("birthPrecision", "YEAR");
                    } else if (!birth.isBlank()) {
                        String parsed = parseDate(birth);
                        if (parsed == null) errors.add("INVALID_BIRTH_DATE");
                        else {
                            data.put("birthDate", parsed);
                            data.put("birthYear", LocalDate.parse(parsed).getYear());
                            data.put("birthPrecision", "DAY");
                        }
                    } else data.put("birthPrecision", "UNKNOWN");
                    for (String k : List.of("registrationDate", "validTo"))
                        if (data.containsKey(k)) {
                            String parsed = parseDate(data.get(k).toString());
                            if (parsed == null) errors.add("INVALID_" + k);
                            else data.put(k, parsed);
                        }
                    String gender = norm(Objects.toString(data.get("gender"), "")).replace("giới tính ", "");
                    if (!gender.isBlank()) {
                        if (!Set.of("nam", "nữ").contains(gender)) errors.add("INVALID_GENDER");
                        else data.put("gender", gender.equals("nam") ? "MALE" : "FEMALE");
                    }
                    String id = Objects.toString(data.get("identity"), "");
                    if (!id.isEmpty() && !id.matches("[0-9]{9,12}")) errors.add("INVALID_IDENTITY");
                    data.put("presence", norm(Objects.toString(data.get("presence"), "")).equals("x") ? "PRESENT" : "UNKNOWN");
                    data.put("kind", kind);
                    data.put("legacyHamlet", legacy);
                    result.add(new Row(name, number, kind, raw, data, errors));
                }
            }
            return new Parsed(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)), result);
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalArgumentException("Cannot read supported XLSX structure", ex);
        }
    }

    public static String parseDate(String value) {
        for (var formatter : List.of(
            DateTimeFormatter.ISO_LOCAL_DATE,
            DateTimeFormatter.ofPattern("dd/MM/uuuu").withResolverStyle(ResolverStyle.STRICT)
        )) {
            try {
                return LocalDate.parse(value, formatter).toString();
            } catch (DateTimeParseException ignored) {}
        }
        return null;
    }
}
