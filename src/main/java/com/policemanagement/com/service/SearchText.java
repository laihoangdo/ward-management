package com.policemanagement.com.service;

import java.text.Normalizer;
import java.util.Locale;

/**
 * Accent- and case-insensitive search, the same on both sides: {@link #fold(String)} folds typed text in Java,
 * {@link #foldedSql(String)} folds a column in SQL ("Tiền Lân" and "tien lan" both become "tien lan"). Works on H2 and
 * PostgreSQL without the unaccent extension.
 */
public final class SearchText {

    private static final String ACCENTED = "àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ";
    private static final String PLAIN = "aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd";

    private SearchText() {}

    /** Lower-case, unaccented text ("Đường Trung Chánh" -> "duong trung chanh"). */
    public static String fold(String text) {
        return Normalizer.normalize(text == null ? "" : text.trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
            .replaceAll("\\p{M}", "")
            .replace('đ', 'd');
    }

    /** SQL expression folding {@code expression} the same way (composed Vietnamese letters; null -> ''). */
    public static String foldedSql(String expression) {
        return "translate(lower(coalesce(" + expression + ",'')), '" + ACCENTED + "', '" + PLAIN + "')";
    }
}
