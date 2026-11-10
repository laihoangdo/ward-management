package com.policemanagement.com.service;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;

class CccdProtectionTest {

    @Test
    void masksLikeTheFormerClientConvention() {
        assertEquals("001••••••001", CccdProtection.mask("001079000001"));
        assertEquals("01•••••78", CccdProtection.mask("012345678"));
        assertEquals("00••••12", CccdProtection.mask("0012345612"));
        assertEquals("1234", CccdProtection.mask("1234"));
        assertNull(CccdProtection.mask(null));
        assertNull(CccdProtection.mask("  "));
        assertEquals("001••••••456", CccdProtection.mask("0010 7912 3456"));
    }

    @Test
    void displayMasksLegacyClientCiphertextAndPlaintext() throws Exception {
        assertEquals("001••••••001", CccdProtection.display("001079000001"));
        assertEquals("001••••••001", CccdProtection.display(legacyEncrypt("001079000001")));
        assertEquals("Đã mã hóa", CccdProtection.display("ENC_AES256:00:deadbeef"));
        assertNull(CccdProtection.display(null));
    }

    @Test
    void revealReturnsTheFullNumberOnlyForAuditedEndpoints() throws Exception {
        assertEquals("001079000001", CccdProtection.reveal("001079000001"));
        assertEquals("001079000001", CccdProtection.reveal(legacyEncrypt("001079000001")));
        assertNull(CccdProtection.reveal("ENC_AES256:00:deadbeef"));
        assertNull(CccdProtection.reveal(null));
    }

    @Test
    void maskedRoundTripsAreDetectedBeforeTheyCanOverwriteStoredValues() {
        assertTrue(CccdProtection.isMasked("001••••••001"));
        assertFalse(CccdProtection.isMasked("001079000001"));
        assertFalse(CccdProtection.isMasked(null));
    }

    @Test
    void legacyFallbackPayloadsStillDecrypt() {
        String plain = "001079000001";
        String fallback = "ENC_AES256:FALLBACK:" + Base64.getEncoder().encodeToString(plain.getBytes(StandardCharsets.UTF_8));
        assertEquals("001••••••001", CccdProtection.display(fallback));
        assertEquals(plain, CccdProtection.reveal(fallback));
    }

    private static String legacyEncrypt(String plain) throws Exception {
        byte[] key = MessageDigest.getInstance("SHA-256").digest(
            "CAND_AN_NINH_DIA_BAN_AES_2026_MASTER_SECRET_KEY".getBytes(StandardCharsets.UTF_8)
        );
        byte[] iv = new byte[12];
        new java.security.SecureRandom().nextBytes(iv);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, iv));
        byte[] ciphertext = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
        return CccdProtection.LEGACY_PREFIX + hex(iv) + ":" + hex(ciphertext);
    }

    private static String hex(byte[] bytes) {
        StringBuilder out = new StringBuilder(bytes.length * 2);
        for (byte item : bytes) out.append("%02x".formatted(item));
        return out.toString();
    }
}
