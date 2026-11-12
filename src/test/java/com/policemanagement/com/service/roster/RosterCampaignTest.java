package com.policemanagement.com.service.roster;

import static org.junit.jupiter.api.Assertions.*;

import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

class RosterCampaignTest {

    @Test
    void knownCampaignsHaveConstantPredicatesAndUnknownOnesAreRejected() {
        for (String code : new String[] {
            "MILITARY",
            "ID_UNDER_6",
            "ID_6_TO_14",
            "ID_AGE_14",
            "ID_AGE_25",
            "ID_AGE_40",
            "ID_AGE_60",
            "ELDERLY_80",
            "TEMP_EXPIRING",
        }) {
            assertTrue(RosterCampaign.valid(code), code);
            assertTrue(RosterCampaign.predicate(code).isPresent(), code);
            assertFalse(RosterCampaign.predicate(code).get().contains("?"), "no bind placeholders or user input: " + code);
        }
        assertTrue(RosterCampaign.valid(""));
        assertTrue(RosterCampaign.predicate("").isEmpty());
        assertFalse(RosterCampaign.valid("1=1; drop table x"));
        assertFalse(RosterCampaign.valid("military"));
    }

    @Test
    void ageBandsNeedAnExactBirthDateButYearMilestonesDoNot() {
        assertTrue(RosterCampaign.needsExactBirthDate("MILITARY"));
        assertTrue(RosterCampaign.needsExactBirthDate("ID_UNDER_6"));
        assertTrue(RosterCampaign.needsExactBirthDate("ID_6_TO_14"));
        assertTrue(RosterCampaign.needsExactBirthDate("ELDERLY_80"));
        assertFalse(RosterCampaign.needsExactBirthDate("ID_AGE_25"));
        assertFalse(RosterCampaign.needsExactBirthDate("TEMP_EXPIRING"));
        assertFalse(RosterCampaign.needsExactBirthDate(""));
    }

    @Test
    void militaryRequiresMalePermanentResidentAged18To27() {
        String sql = RosterCampaign.predicate("MILITARY").orElseThrow();
        assertTrue(sql.contains("r.gender='MALE'"));
        assertTrue(sql.contains("between 18 and 27"));
        assertTrue(sql.contains("record_kind='PERMANENT'"));
    }

    @Test
    void addressPathMatchesWholeSegmentsFromTheStart() {
        var regex = Pattern.compile(RosterCampaign.addressPathRegex("120/45").orElseThrow(), Pattern.CASE_INSENSITIVE);
        assertTrue(regex.matcher("120/45").find());
        assertTrue(regex.matcher("120/45/8/2A").find());
        assertTrue(regex.matcher("Số 120/45/8 Phan Văn Hớn").find());
        assertTrue(regex.matcher("120/45, ấp 62").find());
        assertFalse(regex.matcher("1120/45").find());
        assertFalse(regex.matcher("120/450").find());
        assertFalse(regex.matcher("20/120/45x").find());
        assertFalse(regex.matcher("12/120").find());
    }

    @Test
    void trailingSlashIsIgnoredAndTextSearchIsNotTreatedAsAPath() {
        assertEquals(RosterCampaign.addressPathRegex("120/45"), RosterCampaign.addressPathRegex("120/45/"));
        assertTrue(RosterCampaign.addressPathRegex("Nguyễn Văn A").isEmpty());
        assertTrue(RosterCampaign.addressPathRegex("120/").isPresent());
        assertTrue(RosterCampaign.addressPathRegex("12a%").isEmpty());
        assertTrue(RosterCampaign.addressPathRegex("").isEmpty());
    }
}
