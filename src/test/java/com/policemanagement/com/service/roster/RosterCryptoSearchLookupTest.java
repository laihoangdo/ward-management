package com.policemanagement.com.service.roster;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class RosterCryptoSearchLookupTest {

    @TempDir
    Path temp;

    @Test
    void anIdentityTypedWithSpacesDotsOrDashesFindsTheStoredNumber() {
        var crypto = new RosterCrypto(temp.resolve("key").toString());
        String stored = crypto.lookup("079085000001");
        assertEquals(stored, crypto.searchLookup("079085000001"));
        assertEquals(stored, crypto.searchLookup(" 079 085 000 001 "));
        assertEquals(stored, crypto.searchLookup("079.085.000.001"));
        assertEquals(stored, crypto.searchLookup("079-085-000-001"));
    }

    @Test
    void otherTextIsLookedUpAsTyped() {
        var crypto = new RosterCrypto(temp.resolve("key").toString());
        assertEquals(crypto.lookup("Nguyễn Văn A"), crypto.searchLookup("Nguyễn Văn A"));
        // Too short to be an identity number: not reduced to digits.
        assertEquals(crypto.lookup("12 34"), crypto.searchLookup("12 34"));
    }
}
