package com.policemanagement.com.service;

import static org.junit.jupiter.api.Assertions.*;

import com.policemanagement.com.config.ApplicationProperties;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.web.server.ResponseStatusException;

class AttachmentStorageTest {

    private static final byte[] JPEG = { (byte) 0xff, (byte) 0xd8, (byte) 0xff, 0x00, 0x01 };
    private static final byte[] PNG = { (byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00 };
    private static final byte[] PDF = { '%', 'P', 'D', 'F', '-', '1', '.', '7' };

    @TempDir
    Path root;

    private AttachmentStorage storage() {
        var properties = new ApplicationProperties();
        properties.getAttachments().setRoot(root.toString());
        return new AttachmentStorage(properties);
    }

    @Test
    void detectsTypeFromSignatureNotName() {
        assertEquals("image/jpeg", AttachmentStorage.detect(JPEG));
        assertEquals("image/png", AttachmentStorage.detect(PNG));
        assertEquals("application/pdf", AttachmentStorage.detect(PDF));
        assertNull(AttachmentStorage.detect("<svg/>".getBytes()));
        assertNull(AttachmentStorage.detect(new byte[0]));
    }

    @Test
    void storesUnderRandomKeyAndReadsBack() {
        var storage = storage();
        var stored = storage.store(JPEG, false);
        assertTrue(stored.key().matches("[0-9a-f]{32}"));
        assertEquals("image/jpeg", stored.mime());
        assertEquals(JPEG.length, stored.size());
        assertEquals(64, stored.sha256().length());
        assertArrayEquals(JPEG, storage.read(stored.key()));
        assertTrue(Files.exists(root.resolve(stored.key().substring(0, 2)).resolve(stored.key())));
        storage.delete(stored.key());
        assertThrows(ResponseStatusException.class, () -> storage.read(stored.key()));
        storage.delete(stored.key());
    }

    @Test
    void rejectsPdfWhereOnlyImagesAllowedAndOversizedImages() {
        var storage = storage();
        assertThrows(ResponseStatusException.class, () -> storage.store(PDF, false));
        assertEquals("application/pdf", storage.store(PDF, true).mime());
        byte[] big = new byte[(int) AttachmentStorage.MAX_IMAGE_BYTES + 1];
        System.arraycopy(JPEG, 0, big, 0, JPEG.length);
        assertThrows(ResponseStatusException.class, () -> storage.store(big, false));
        assertThrows(ResponseStatusException.class, () -> storage.store("hello".getBytes(), true));
    }

    @Test
    void refusesKeysThatCouldEscapeTheFolder() {
        var storage = storage();
        assertThrows(IllegalArgumentException.class, () -> storage.read("../../etc/passwd"));
        assertThrows(IllegalArgumentException.class, () -> storage.path("ABCDEF"));
    }
}
