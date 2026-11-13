package com.policemanagement.com.service.roster;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.PrintSetup;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.streaming.SXSSFSheet;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;

/**
 * Writes a resident list as an A4 landscape workbook: an official heading, the filter summary, a frozen and filterable header
 * row repeated on every printed page, the rows as plain text, signature lines and a per-hamlet summary sheet.
 */
final class ResidentExportWorkbook {

    private static final String FONT = "Times New Roman";

    private ResidentExportWorkbook() {}

    /** Keeps a spreadsheet from treating a cell as a formula, like the CSV exports do. */
    static String safe(String text) {
        if (text == null) return "";
        return text.matches("(?s)^[\\s]*[=+@-].*") ? "'" + text : text;
    }

    private static Font font(SXSSFWorkbook book, int points, boolean bold, boolean italic) {
        Font font = book.createFont();
        font.setFontName(FONT);
        font.setFontHeightInPoints((short) points);
        font.setBold(bold);
        font.setItalic(italic);
        return font;
    }

    private static CellStyle style(SXSSFWorkbook book, Font font, HorizontalAlignment align, boolean border, boolean wrap) {
        CellStyle style = book.createCellStyle();
        style.setFont(font);
        style.setAlignment(align);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setWrapText(wrap);
        if (border) {
            style.setBorderTop(BorderStyle.THIN);
            style.setBorderBottom(BorderStyle.THIN);
            style.setBorderLeft(BorderStyle.THIN);
            style.setBorderRight(BorderStyle.THIN);
        }
        return style;
    }

    private static void text(Sheet sheet, int row, int col, int lastCol, String value, CellStyle style) {
        Row r = sheet.getRow(row) == null ? sheet.createRow(row) : sheet.getRow(row);
        var cell = r.createCell(col);
        cell.setCellValue(safe(value));
        cell.setCellStyle(style);
        if (lastCol > col) sheet.addMergedRegion(new CellRangeAddress(row, row, col, lastCol));
    }

    private static void page(Sheet sheet) {
        PrintSetup print = sheet.getPrintSetup();
        print.setPaperSize(PrintSetup.A4_PAPERSIZE);
        print.setLandscape(true);
        print.setFitWidth((short) 1);
        print.setFitHeight((short) 0);
        sheet.setFitToPage(true);
        sheet.setAutobreaks(true);
        sheet.setHorizontallyCenter(true);
        sheet.setMargin(Sheet.LeftMargin, 0.4);
        sheet.setMargin(Sheet.RightMargin, 0.4);
        sheet.setMargin(Sheet.TopMargin, 0.5);
        sheet.setMargin(Sheet.BottomMargin, 0.6);
        sheet.getFooter().setCenter("Trang &P/&N");
    }

    static byte[] write(ResidentExportService.Export export) {
        var book = new SXSSFWorkbook(200);
        try (var out = new ByteArrayOutputStream()) {
            Font normal = font(book, 11, false, false);
            Font bold = font(book, 11, true, false);
            Font title = font(book, 14, true, false);
            Font italic = font(book, 10, false, true);
            CellStyle left = style(book, normal, HorizontalAlignment.LEFT, false, false);
            CellStyle centerBold = style(book, bold, HorizontalAlignment.CENTER, false, false);
            CellStyle center = style(book, normal, HorizontalAlignment.CENTER, false, false);
            CellStyle titleStyle = style(book, title, HorizontalAlignment.CENTER, false, false);
            CellStyle note = style(book, italic, HorizontalAlignment.CENTER, false, true);
            CellStyle header = style(book, bold, HorizontalAlignment.CENTER, true, true);
            header.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            header.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            CellStyle cell = style(book, normal, HorizontalAlignment.LEFT, true, true);
            CellStyle cellCenter = style(book, normal, HorizontalAlignment.CENTER, true, false);

            var columns = export.columns();
            int last = Math.max(columns.size() - 1, 5);
            int half = last / 2;
            SXSSFSheet sheet = book.createSheet("Danh sách");
            for (int i = 0; i < columns.size(); i++) sheet.setColumnWidth(i, columns.get(i).width() * 256);
            page(sheet);

            String agency = "CÔNG AN " + (export.commune().isEmpty() ? "XÃ" : export.commune().toUpperCase(java.util.Locale.ROOT));
            text(sheet, 0, 0, half, agency, centerBold);
            text(sheet, 0, half + 1, last, "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", centerBold);
            text(sheet, 1, half + 1, last, "Độc lập - Tự do - Hạnh phúc", centerBold);
            text(sheet, 3, 0, last, "DANH SÁCH NHÂN KHẨU", titleStyle);
            text(sheet, 4, 0, last, export.scope(), center);
            text(sheet, 5, 0, last, "Điều kiện lọc: " + export.summary(), note);
            text(
                sheet,
                6,
                0,
                last,
                "Tổng số: " +
                    export.total() +
                    " người (nam " +
                    export.male() +
                    ", nữ " +
                    export.female() +
                    ")" +
                    (export.fullIdentity() ? " · Có số định danh đầy đủ — tài liệu mật, không sao chép" : ""),
                center
            );
            int head = 8;
            Row headerRow = sheet.createRow(head);
            headerRow.setHeightInPoints(30);
            for (int i = 0; i < columns.size(); i++) {
                var c = headerRow.createCell(i);
                c.setCellValue(columns.get(i).header());
                c.setCellStyle(header);
            }
            int r = head + 1;
            for (List<String> values : export.rows()) {
                Row row = sheet.createRow(r++);
                for (int i = 0; i < values.size(); i++) {
                    var c = row.createCell(i);
                    c.setCellValue(safe(values.get(i)));
                    String key = columns.get(i).key();
                    c.setCellStyle(List.of("stt", "birth", "gender", "registrationDate", "validTo").contains(key) ? cellCenter : cell);
                }
            }
            sheet.createFreezePane(0, head + 1);
            if (!export.rows().isEmpty()) sheet.setAutoFilter(new CellRangeAddress(head, r - 1, 0, columns.size() - 1));
            sheet.setRepeatingRows(new CellRangeAddress(head, head, 0, columns.size() - 1));

            r++;
            text(sheet, r, half + 1, last, "......., ngày ..... tháng ..... năm .......", note);
            r++;
            text(sheet, r, 0, half, "NGƯỜI LẬP DANH SÁCH", centerBold);
            text(sheet, r, half + 1, last, "TRƯỞNG CÔNG AN XÃ", centerBold);
            r++;
            text(sheet, r, 0, half, "(Ký, ghi rõ họ tên)", note);
            text(sheet, r, half + 1, last, "(Ký, ghi rõ họ tên, đóng dấu)", note);
            r += 5;
            text(sheet, r, 0, last, "Xuất lúc " + export.generatedAt() + " bởi " + export.generatedBy(), left);

            summary(book, export, header, cell, cellCenter, titleStyle, center);
            book.write(out);
            return out.toByteArray();
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        } finally {
            // Streaming rows are buffered in temp files holding personal data; delete them now, even after a failure.
            book.dispose();
            try {
                book.close();
            } catch (IOException ignored) {
                // Nothing left to release once the temp files are gone.
            }
        }
    }

    private static void summary(
        SXSSFWorkbook book,
        ResidentExportService.Export export,
        CellStyle header,
        CellStyle cell,
        CellStyle number,
        CellStyle title,
        CellStyle center
    ) {
        var kinds = new LinkedHashSet<String>();
        for (var tally : export.byHamlet()) kinds.addAll(tally.kinds().keySet());
        kinds.remove("");
        var headers = new ArrayList<>(List.of("Ấp", "Tổng số", "Nam", "Nữ"));
        headers.addAll(kinds);
        headers.add("Chưa có hồ sơ cư trú");
        SXSSFSheet sheet = book.createSheet("Tổng hợp");
        page(sheet);
        sheet.setColumnWidth(0, 24 * 256);
        for (int i = 1; i < headers.size(); i++) sheet.setColumnWidth(i, 14 * 256);
        text(sheet, 0, 0, headers.size() - 1, "TỔNG HỢP SỐ NHÂN KHẨU THEO ẤP", title);
        text(sheet, 1, 0, headers.size() - 1, export.scope(), center);
        Row h = sheet.createRow(3);
        for (int i = 0; i < headers.size(); i++) {
            var c = h.createCell(i);
            c.setCellValue(headers.get(i));
            c.setCellStyle(header);
        }
        int r = 4;
        long[] sums = new long[headers.size()];
        for (var tally : export.byHamlet()) {
            Row row = sheet.createRow(r++);
            var name = row.createCell(0);
            name.setCellValue(safe(tally.hamlet()));
            name.setCellStyle(cell);
            long[] values = new long[headers.size()];
            values[1] = tally.total();
            values[2] = tally.male();
            values[3] = tally.female();
            int i = 4;
            for (String kind : kinds) values[i++] = tally.kinds().getOrDefault(kind, 0L);
            values[i] = tally.kinds().getOrDefault("", 0L);
            for (int k = 1; k < values.length; k++) {
                var c = row.createCell(k);
                c.setCellValue(values[k]);
                c.setCellStyle(number);
                sums[k] += values[k];
            }
        }
        Row total = sheet.createRow(r);
        var label = total.createCell(0);
        label.setCellValue("Cộng");
        label.setCellStyle(header);
        for (int k = 1; k < sums.length; k++) {
            var c = total.createCell(k);
            c.setCellValue(sums[k]);
            c.setCellStyle(header);
        }
        sheet.createFreezePane(1, 4);
        sheet.setRepeatingRows(new CellRangeAddress(3, 3, 0, headers.size() - 1));
    }
}
