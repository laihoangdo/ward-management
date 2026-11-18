package com.policemanagement.com.service.gis;

import com.policemanagement.com.service.AttachmentRecords;
import com.policemanagement.com.service.AttachmentStorage;
import com.policemanagement.com.service.rbac.RbacService;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Field inspection photos of a household (façade, sign, fire safety). Stored in the shared attachment store: the file in
 * the private attachment folder, the metadata in {@code attachment} with owner kind HOUSEHOLD and the household roster id
 * as owner. Photos not yet moved from the old base64 table {@code gis_inspection_photo} are still listed and served.
 */
@Service
@Transactional
public class InspectionPhotoService {

    public static final String KIND = "HOUSEHOLD";
    public static final Set<String> CATEGORIES = Set.of("facade", "business_sign", "fire_safety", "general");
    /** Plenty for years of visits to one house; keeps a runaway client from filling the disk. */
    static final int MAX_PHOTOS = 200;

    public record Upload(String url, String caption, String category) {
        @Override
        public String toString() {
            return "InspectionPhotoUpload[image redacted]";
        }
    }

    /** {@code url} is the API path of the image bytes (fetched with the user's session), never the image itself. */
    public record Photo(UUID id, String url, String caption, String category, String timestamp, String takenBy) {}

    public record Content(byte[] bytes, String mime) {}

    private record Owner(UUID roster, Long hamlet) {}

    private final JdbcTemplate db;
    private final RbacService rbac;
    private final AttachmentRecords records;

    public InspectionPhotoService(JdbcTemplate db, RbacService rbac, AttachmentRecords records) {
        this.db = db;
        this.rbac = rbac;
        this.records = records;
    }

    @Transactional(readOnly = true)
    public List<Photo> list(long householdId) {
        rbac.household(householdId);
        var owner = owner(householdId);
        var photos = new ArrayList<Photo>();
        for (var a : records.list(KIND, owner.roster()))
            photos.add(new Photo(a.id(), contentPath(householdId, a.id()), a.caption(), a.category(), a.createdAt(), a.createdBy()));
        photos.addAll(
            db.query(
                "select id,caption,category,captured_at,taken_by from gis_inspection_photo where household_id=?",
                (rs, n) -> {
                    UUID id = rs.getObject("id", UUID.class);
                    return new Photo(
                        id,
                        contentPath(householdId, id),
                        rs.getString("caption"),
                        rs.getString("category"),
                        rs.getTimestamp("captured_at").toInstant().toString(),
                        rs.getString("taken_by")
                    );
                },
                householdId
            )
        );
        photos.sort(Comparator.comparing(Photo::timestamp).reversed());
        return photos;
    }

    @Transactional(readOnly = true)
    public Content content(long householdId, UUID id) {
        rbac.household(householdId);
        var owner = owner(householdId);
        if (attachmentExists(owner, id)) {
            var content = records.content(KIND, owner.roster(), id);
            return new Content(content.bytes(), content.mime());
        }
        var legacy = db.queryForList(
            "select image_data from gis_inspection_photo where id=? and household_id=?",
            String.class,
            id,
            householdId
        );
        if (legacy.isEmpty()) throw notFound();
        byte[] bytes = decode(legacy.getFirst());
        return new Content(bytes, AttachmentStorage.detect(bytes));
    }

    public Photo save(long householdId, Upload upload) {
        rbac.permission("canUpdateInspection");
        rbac.household(householdId);
        byte[] bytes = validate(upload);
        var owner = owner(householdId);
        var a = records.add(
            KIND,
            owner.roster(),
            owner.hamlet(),
            bytes,
            upload.caption(),
            upload.category(),
            false,
            MAX_PHOTOS,
            false,
            "household:" + householdId
        );
        return new Photo(a.id(), contentPath(householdId, a.id()), a.caption(), a.category(), a.createdAt(), a.createdBy());
    }

    public void delete(long householdId, UUID id) {
        rbac.permission("canUpdateInspection");
        rbac.household(householdId);
        var owner = owner(householdId);
        if (attachmentExists(owner, id)) {
            records.delete(KIND, owner.roster(), id, "household:" + householdId);
            return;
        }
        if (db.update("delete from gis_inspection_photo where id=? and household_id=?", id, householdId) == 0) throw notFound();
        rbac.audit("attachment-delete", "household:" + householdId, Map.of("attachment", id.toString()));
    }

    /** Data URL from the camera: JPEG or PNG, at most 5 MB (the attachment store limit), caption up to 500 characters. */
    static byte[] validate(Upload upload) {
        if (
            upload == null ||
            upload.url() == null ||
            !CATEGORIES.contains(upload.category() == null ? "" : upload.category()) ||
            (upload.caption() != null && upload.caption().strip().length() > 500)
        ) throw invalid();
        String url = upload.url();
        if (!url.startsWith("data:image/png;base64,") && !url.startsWith("data:image/jpeg;base64,")) throw invalid();
        byte[] bytes = decode(url);
        String mime = AttachmentStorage.detect(bytes);
        if (mime == null || mime.equals("application/pdf") || !url.startsWith("data:" + mime + ";")) throw invalid();
        if (bytes.length > AttachmentStorage.MAX_IMAGE_BYTES) throw invalid();
        return bytes;
    }

    static byte[] decode(String dataUrl) {
        try {
            return Base64.getDecoder().decode(dataUrl.substring(dataUrl.indexOf(',') + 1));
        } catch (IllegalArgumentException e) {
            throw invalid();
        }
    }

    private boolean attachmentExists(Owner owner, UUID id) {
        return (
            db.queryForObject(
                "select count(*) from attachment where id=? and owner_kind=? and owner_id=?",
                Long.class,
                id,
                KIND,
                owner.roster()
            ) > 0
        );
    }

    private Owner owner(long householdId) {
        var rows = db.queryForList("select roster_id,hamlet_id from public.household where id=?", householdId);
        if (rows.isEmpty() || rows.getFirst().get("roster_id") == null) throw new ResponseStatusException(
            HttpStatus.NOT_FOUND,
            "Không tìm thấy hộ"
        );
        var row = rows.getFirst();
        return new Owner((UUID) row.get("roster_id"), row.get("hamlet_id") == null ? null : ((Number) row.get("hamlet_id")).longValue());
    }

    static String contentPath(long householdId, UUID id) {
        return "/api/gis/households/" + householdId + "/inspection-photos/" + id + "/content";
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy ảnh của hộ đang chọn");
    }

    private static ResponseStatusException invalid() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ảnh JPEG/PNG hợp lệ tối đa 5 MB, chú thích tối đa 500 ký tự");
    }
}
