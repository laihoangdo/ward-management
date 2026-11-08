package com.policemanagement.com.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * Citizen identity-number protection shared by every response path.
 *
 * Full numbers must only leave the server through the audited reveal endpoints;
 * list/detail responses use {@link #display(String)} which always masks.
 * The legacy client-side AES scheme is kept ONLY so the server can mask and
 * reveal values that were stored encrypted by the old bundle; the legacy
 * secret is already public in shipped bundles, so it provides no ongoing
 * confidentiality and must be removed once stored values are re-encrypted
 * with the server-side roster key.
 */
public final class CccdProtection {

    public static final String LEGACY_PREFIX = "ENC_AES256:";

    private static final String LEGACY_SECRET = "CAND_AN_NINH_DIA_BAN_AES_2026_MASTER_SECRET_KEY";

    private CccdProtection() {}

    /** Same convention as the former client-side maskCccd so screens stay consistent. */
    public static String mask(String value) {
        if (value == null || value.isBlank()) return null;
        String clean = value.replaceAll("\\s+", "");
        if (clean.length() <= 4) return clean;
        if (clean.length() == 12) return clean.substring(0, 3) + "••••••" + clean.substring(9);
        if (clean.length() == 9) return clean.substring(0, 2) + "•••••" + clean.substring(7);
        return clean.substring(0, 2) + "••••" + clean.substring(clean.length() - 2);
    }

    /** Value safe for list/detail responses: decrypts legacy ciphertext when needed, then masks. */
    public static String display(String stored) {
        if (stored == null || stored.isBlank()) return null;
        if (stored.startsWith(LEGACY_PREFIX)) {
            String plain = decryptLegacy(stored);
            return plain == null ? "Đã mã hóa" : mask(plain);
        }
        return mask(stored);
    }

    /** Full number, for the audited reveal endpoints only; never use in list responses. */
    public static String reveal(String stored) {
        if (stored == null || stored.isBlank()) return null;
        return stored.startsWith(LEGACY_PREFIX) ? decryptLegacy(stored) : stored;
    }

    /** True when a client sent back a masked value instead of a real number. */
    public static boolean isMasked(String value) {
        return value != null && value.indexOf('•') >= 0;
    }

    private static String decryptLegacy(String stored) {
        try {
            String[] parts = stored.substring(LEGACY_PREFIX.length()).split(":");
            if (parts.length != 2) return null;
            if ("FALLBACK".equals(parts[0])) {
                return java.net.URLDecoder.decode(
                    new String(Base64.getDecoder().decode(parts[1]), StandardCharsets.UTF_8).replace("+", "%2B"),
                    StandardCharsets.UTF_8
                );
            }
            byte[] key = MessageDigest.getInstance("SHA-256").digest(LEGACY_SECRET.getBytes(StandardCharsets.UTF_8));
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, hex(parts[0])));
            return new String(cipher.doFinal(hex(parts[1])), StandardCharsets.UTF_8);
        } catch (Exception runtimeFailure) {
            return null;
        }
    }

    private static byte[] hex(String text) {
        byte[] out = new byte[text.length() / 2];
        for (int index = 0; index < out.length; index++) out[index] = (byte) Integer.parseInt(text.substring(index * 2, index * 2 + 2), 16);
        return out;
    }
}
