package com.policemanagement.com.service.roster;

import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.*;
import javax.crypto.spec.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** A separate server-side key; back it up with the recovery snapshot, never ship it to the browser. */
@Component
public class RosterCrypto {

    private final byte[] key;
    private final SecureRandom random = new SecureRandom();

    @org.springframework.beans.factory.annotation.Autowired
    public RosterCrypto(
        @Value("${application.roster.key-file:.tc2-private/data.key}") String file,
        org.springframework.jdbc.core.JdbcTemplate db
    ) {
        this(checkedKeyPath(file, db));
    }

    private static String checkedKeyPath(String file, org.springframework.jdbc.core.JdbcTemplate db) {
        if (
            !Files.exists(Path.of(file)) &&
            Boolean.TRUE.equals(
                db.execute(
                    (org.springframework.jdbc.core.ConnectionCallback<Boolean>) connection ->
                        "PostgreSQL".equals(connection.getMetaData().getDatabaseProductName())
                )
            ) &&
            db.queryForObject("select to_regclass('tc2_roster.import_row')::text", String.class) != null &&
            db.queryForObject("select count(*) from tc2_roster.import_row", Long.class) > 0
        ) throw new IllegalStateException("TC2 key missing: restore the existing key before opening encrypted data");
        return file;
    }

    public RosterCrypto(String file) {
        try {
            Path path = Path.of(file).toAbsolutePath();
            Files.createDirectories(path.getParent());
            if (!Files.exists(path)) {
                byte[] generated = new byte[32];
                random.nextBytes(generated);
                try {
                    Files.writeString(path, Base64.getEncoder().encodeToString(generated), StandardOpenOption.CREATE_NEW);
                } catch (FileAlreadyExistsException ignored) {
                    /* another instance created the same key */
                }
            }
            key = Base64.getDecoder().decode(Files.readString(path).trim());
            if (key.length != 32) throw new IllegalStateException("Invalid TC2 encryption key");
        } catch (java.io.IOException ex) {
            throw new IllegalStateException("Cannot load TC2 server encryption key", ex);
        }
    }

    public String encrypt(String text) {
        try {
            byte[] nonce = new byte[12];
            random.nextBytes(nonce);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, nonce));
            byte[] encrypted = cipher.doFinal(text.getBytes(StandardCharsets.UTF_8));
            return "v1:" + Base64.getEncoder().encodeToString(nonce) + ":" + Base64.getEncoder().encodeToString(encrypted);
        } catch (java.security.GeneralSecurityException ex) {
            throw new IllegalStateException("TC2 encryption failed", ex);
        }
    }

    public String decrypt(String text) {
        try {
            String[] parts = text.split(":");
            if (parts.length != 3 || !parts[0].equals("v1")) throw new IllegalArgumentException("Invalid ciphertext");
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(
                Cipher.DECRYPT_MODE,
                new SecretKeySpec(key, "AES"),
                new GCMParameterSpec(128, Base64.getDecoder().decode(parts[1]))
            );
            return new String(cipher.doFinal(Base64.getDecoder().decode(parts[2])), StandardCharsets.UTF_8);
        } catch (java.security.GeneralSecurityException ex) {
            throw new IllegalStateException("TC2 decryption failed", ex);
        }
    }

    public String lookup(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return java.util.HexFormat.of().formatHex(mac.doFinal(("tc2-identity-v1:" + value.trim()).getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.GeneralSecurityException ex) {
            throw new IllegalStateException(ex);
        }
    }
}
