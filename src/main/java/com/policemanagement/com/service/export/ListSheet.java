package com.policemanagement.com.service.export;

import java.util.List;

/**
 * A printable list (danh sách trích để in, nộp): official heading, title, scope, filter line, columns and rows already formatted
 * as display text, plus who produced it and when. Rendered both as the A4 print view and as an Excel workbook.
 */
public record ListSheet(
    String kind,
    String commune,
    String title,
    String scope,
    String summary,
    String totalLine,
    List<Column> columns,
    List<List<String>> rows,
    boolean truncated,
    String generatedBy,
    String generatedAt
) {
    /** {@code center} keeps short values (STT, dates, gender) centred on paper and in the sheet. */
    public record Column(String key, String header, int width, boolean center) {}
}
