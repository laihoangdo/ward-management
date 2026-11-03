package com.policemanagement.com.web.rest;

import com.policemanagement.com.service.rbac.RbacService;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/** Inspection evidence is stored in PostgreSQL, never in a browser-local business cache. */
@RestController
@RequestMapping("/api/gis/households/{householdId}/inspection-photos")
public class GisInspectionPhotoResource {

    private final JdbcTemplate db;
    private final RbacService rbac;

    public GisInspectionPhotoResource(JdbcTemplate db, RbacService rbac) {
        this.db = db;
        this.rbac = rbac;
    }

    public record Upload(String url, String caption, String category) {
        @Override
        public String toString() {
            return "InspectionPhotoUpload[image redacted]";
        }
    }

    public record Photo(UUID id, String url, String caption, String category, String timestamp, String takenBy) {
        @Override
        public String toString() {
            return "InspectionPhoto[id=" + id + ", image redacted]";
        }
    }

    @GetMapping
    public ResponseEntity<List<Photo>> list(@PathVariable long householdId) {
        rbac.household(householdId);
        var photos = db.query(
            "select * from gis_inspection_photo where household_id=? order by captured_at desc",
            (rs, row) ->
                new Photo(
                    rs.getObject("id", UUID.class),
                    rs.getString("image_data"),
                    rs.getString("caption"),
                    rs.getString("category"),
                    rs.getTimestamp("captured_at").toInstant().toString(),
                    rs.getString("taken_by")
                ),
            householdId
        );
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(photos);
    }

    @PostMapping
    @Transactional
    public Photo save(@PathVariable long householdId, @RequestBody Upload upload) {
        rbac.permission("canUpdateInspection");
        rbac.household(householdId);
        validate(upload);
        var user = rbac.current();
        String actor = String.valueOf(user.get("id"));
        String name = user.get("fullName") == null ? "" : user.get("fullName").toString();
        var photo = new Photo(
            UUID.randomUUID(),
            upload.url(),
            upload.caption() == null ? "" : upload.caption().trim(),
            upload.category(),
            Instant.now().toString(),
            name
        );
        db.update(
            "insert into gis_inspection_photo(id,household_id,image_data,caption,category,captured_at,taken_by,actor_subject) values (?,?,?,?,?,?::timestamptz,?,?)",
            photo.id(),
            householdId,
            photo.url(),
            photo.caption(),
            photo.category(),
            photo.timestamp(),
            photo.takenBy(),
            actor
        );
        return photo;
    }

    @DeleteMapping("/{id}")
    @Transactional
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable long householdId, @PathVariable UUID id) {
        rbac.permission("canUpdateInspection");
        rbac.household(householdId);
        if (
            db.update("delete from gis_inspection_photo where id=? and household_id=?", id, householdId) == 0
        ) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy ảnh của hộ đang chọn");
    }

    static void validate(Upload upload) {
        if (
            upload == null ||
            upload.url() == null ||
            upload.url().length() > 12_000_000 ||
            !Set.of("facade", "business_sign", "fire_safety", "general").contains(upload.category() == null ? "" : upload.category()) ||
            (upload.caption() != null && upload.caption().length() > 2000)
        ) invalid();
        String url = upload.url();
        boolean png = url.startsWith("data:image/png;base64,");
        boolean jpeg = url.startsWith("data:image/jpeg;base64,");
        if (!png && !jpeg) invalid();
        try {
            byte[] bytes = Base64.getDecoder().decode(url.substring(url.indexOf(',') + 1));
            boolean signature = png
                ? bytes.length >= 8 &&
                  bytes[0] == (byte) 0x89 &&
                  bytes[1] == 0x50 &&
                  bytes[2] == 0x4e &&
                  bytes[3] == 0x47 &&
                  bytes[4] == 0x0d &&
                  bytes[5] == 0x0a &&
                  bytes[6] == 0x1a &&
                  bytes[7] == 0x0a
                : bytes.length >= 3 && bytes[0] == (byte) 0xff && bytes[1] == (byte) 0xd8 && bytes[2] == (byte) 0xff;
            if (!signature || bytes.length > 8_000_000) invalid();
        } catch (IllegalArgumentException e) {
            invalid();
        }
    }

    private static void invalid() {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ảnh JPEG/PNG hợp lệ tối đa 8 MB, chú thích tối đa 2000 ký tự");
    }
}
