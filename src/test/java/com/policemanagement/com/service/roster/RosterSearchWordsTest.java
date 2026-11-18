package com.policemanagement.com.service.roster;

import static org.junit.jupiter.api.Assertions.*;

import java.text.Normalizer;
import java.util.List;
import org.junit.jupiter.api.Test;

class RosterSearchWordsTest {

    @Test
    void splitsOnSpacesCommasAndSemicolons() {
        assertEquals(List.of("12/3A", "ấp", "trung", "chánh", "2"), RosterService.searchWords("  12/3A ấp  trung chánh 2 "));
        assertEquals(List.of("144/2", "Ấp", "61"), RosterService.searchWords("144/2, Ấp 61"));
        assertEquals(List.of("a", "b"), RosterService.searchWords("a;b"));
    }

    @Test
    void emptySearchHasNoWords() {
        assertTrue(RosterService.searchWords("   ").isEmpty());
    }

    @Test
    void decomposedTextIsComposedSoBothFormsMatch() {
        String decomposed = Normalizer.normalize("Ấp Trung Chánh 2", Normalizer.Form.NFD);
        assertEquals(List.of("Ấp", "Trung", "Chánh", "2"), RosterService.searchWords(decomposed));
    }

    @Test
    void keepsAtMostTenWords() {
        assertEquals(10, RosterService.searchWords("1 2 3 4 5 6 7 8 9 10 11 12").size());
    }
}
