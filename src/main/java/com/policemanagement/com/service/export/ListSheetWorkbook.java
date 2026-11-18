package com.policemanagement.com.service.export;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;
import java.util.Locale;
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
 * Writes a {@link ListSheet} as an A4 landscape workbook laid out like the resident export: official heading, title, scope and
 * filter, a frozen and filterable header row repeated on every printed page, plain-text rows and signature lines.
 */
public final class ListSheetWorkbook {

    private static final String FONT = "Times New Roman";

    private ListSheetWorkbook() {}

    /** Keeps a spreadsheet from treating a cell as a formula. */
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

    public static byte[] write(ListSheet list) {
        var book = new SXSSFWorkbook(200);
        try (var out = new ByteArrayOutputStream()) {
            Font normal = font(book, 11, false, false);
            Font bold = font(book, 11, true, false);
            Font title = font(book, 14, true, false);
            Font italic = font(book, 10, false, true);
            CellStyle left = style(book, normal, HorizontalAlignment.LEFT, false, false);
            CellStyle centerBold = style(book, bold, HorizontalAlignment.CENTER, false, false);
            CellStyle center = style(book, normal, HorizontalAlignment.CENTER, false, false);
            CellStyle titleStyle = style(book, title, HorizontalAlignment.CENTER, false, true);
            CellStyle note = style(book, italic, HorizontalAlignment.CENTER, false, true);
            CellStyle header = style(book, bold, HorizontalAlignment.CENTER, true, true);
            header.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            header.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            CellStyle cell = style(book, normal, HorizontalAlignment.LEFT, true, true);
            CellStyle cellCenter = style(book, normal, HorizontalAlignment.CENTER, true, false);

            var columns = list.columns();
            int last = Math.max(columns.size() - 1, 5);
            int half = last / 2;
            SXSSFSheet sheet = book.createSheet("Danh sách");
            for (int i = 0; i < columns.size(); i++) sheet.setColumnWidth(i, columns.get(i).width() * 256);
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

            String agency = "CÔNG AN " + (list.commune().isEmpty() ? "XÃ" : list.commune().toUpperCase(Locale.ROOT));
            text(sheet, 0, 0, half, agency, centerBold);
            text(sheet, 0, half + 1, last, "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", centerBold);
            text(sheet, 1, half + 1, last, "Độc lập - Tự do - Hạnh phúc", centerBold);
            text(sheet, 3, 0, last, list.title(), titleStyle);
            text(sheet, 4, 0, last, list.scope(), center);
            text(sheet, 5, 0, last, "Điều kiện lọc: " + list.summary(), note);
            text(sheet, 6, 0, last, list.totalLine(), center);
            int head = 8;
            Row headerRow = sheet.createRow(head);
            headerRow.setHeightInPoints(30);
            for (int i = 0; i < columns.size(); i++) {
                var c = headerRow.createCell(i);
                c.setCellValue(columns.get(i).header());
                c.setCellStyle(header);
            }
            int r = head + 1;
            for (List<String> values : list.rows()) {
                Row row = sheet.createRow(r++);
                for (int i = 0; i < values.size(); i++) {
                    var c = row.createCell(i);
                    c.setCellValue(safe(values.get(i)));
                    c.setCellStyle(columns.get(i).center() ? cellCenter : cell);
                }
            }
            sheet.createFreezePane(0, head + 1);
            if (!list.rows().isEmpty()) sheet.setAutoFilter(new CellRangeAddress(head, r - 1, 0, columns.size() - 1));
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
            text(sheet, r, 0, last, "Xuất lúc " + list.generatedAt() + " bởi " + list.generatedBy(), left);
            book.write(out);
            return out.toByteArray();
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        } finally {
            // Streaming rows are buffered in temp files that may hold personal data; delete them now, even after a failure.
            book.dispose();
            try {
                book.close();
            } catch (IOException ignored) {
                // Nothing left to release once the temp files are gone.
            }
        }
    }
}
