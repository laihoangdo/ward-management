package com.policemanagement.com.service;

import com.policemanagement.com.config.ApplicationProperties;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * Attachment bytes on the server filesystem. Files are named by a random key (never the uploaded name) and sharded into
 * two-character folders; callers check the owner's territory before reading or writing and keep metadata in the
 * {@code attachment} table.
 */
@Service
public class AttachmentStorage {

    public static final long MAX_IMAGE_BYTES = 5L * 1024 * 1024;
    public static final long MAX_PDF_BYTES = 20L * 1024 * 1024;

    /** What was written: key, detected type, size and SHA-256. */
    public record Stored(String key, String mime, long size, String sha256) {}

    private final Path root;

    public AttachmentStorage(ApplicationProperties properties) {
        this.root = Path.of(properties.getAttachments().getRoot()).toAbsolutePath().normalize();
    }

    /** MIME type from the file signature (JPEG, PNG or PDF), or null when the bytes are none of them. */
    public static String detect(byte[] bytes) {
        if (bytes == null) return null;
        if (bytes.length >= 3 && bytes[0] == (byte) 0xff && bytes[1] == (byte) 0xd8 && bytes[2] == (byte) 0xff) return "image/jpeg";
        if (
            bytes.length >= 8 &&
            bytes[0] == (byte) 0x89 &&
            bytes[1] == 0x50 &&
            bytes[2] == 0x4e &&
            bytes[3] == 0x47 &&
            bytes[4] == 0x0d &&
            bytes[5] == 0x0a &&
            bytes[6] == 0x1a &&
            bytes[7] == 0x0a
        ) return "image/png";
        if (
            bytes.length >= 5 && bytes[0] == '%' && bytes[1] == 'P' && bytes[2] == 'D' && bytes[3] == 'F' && bytes[4] == '-'
        ) return "application/pdf";
        return null;
    }

    /** Validates type and size against what the caller allows, then writes the bytes atomically under a new key. */
    public Stored store(byte[] bytes, boolean allowPdf) {
        String mime = detect(bytes);
        if (mime == null || (!allowPdf && mime.equals("application/pdf"))) throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            allowPdf ? "Chỉ nhận ảnh JPEG/PNG hoặc tệp PDF" : "Chỉ nhận ảnh JPEG hoặc PNG"
        );
        long limit = mime.equals("application/pdf") ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
        if (bytes.length > limit) throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            mime.equals("application/pdf") ? "Tệp PDF tối đa 20 MB" : "Ảnh tối đa 5 MB"
        );
        String key = UUID.randomUUID().toString().replace("-", "");
        Path target = path(key);
        try {
            Files.createDirectories(target.getParent());
            Path temp = Files.createTempFile(target.getParent(), key, ".part");
            Files.write(temp, bytes);
            Files.move(temp, target, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException e) {
            throw new UncheckedIOException("Không ghi được tệp đính kèm", e);
        }
        return new Stored(key, mime, bytes.length, sha256(bytes));
    }

    public byte[] read(String key) {
        try {
            return Files.readAllBytes(path(key));
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Tệp đính kèm không còn trên máy chủ");
        }
    }

    /** Removes the bytes; a missing file is ignored so a retried delete still succeeds. */
    public void delete(String key) {
        try {
            Files.deleteIfExists(path(key));
        } catch (IOException e) {
            throw new UncheckedIOException("Không xoá được tệp đính kèm", e);
        }
    }

    Path path(String key) {
        if (key == null || !key.matches("[0-9a-f]{32}")) throw new IllegalArgumentException("Invalid attachment key");
        return root.resolve(key.substring(0, 2)).resolve(key);
    }

    static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
