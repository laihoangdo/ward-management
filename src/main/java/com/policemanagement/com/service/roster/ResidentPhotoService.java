package com.policemanagement.com.service.roster;

import com.policemanagement.com.service.AttachmentStorage;
import com.policemanagement.com.service.rbac.RbacService;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;

/**
 * Portrait photos of a resident. Metadata lives in {@code attachment} (owner_kind RESIDENT), bytes in {@link AttachmentStorage}.
 * Every call re-checks that the resident belongs to the caller's hamlet; uploads and deletes need canUpdateInspection.
 */
@Service
@Transactional
public class ResidentPhotoService {

    static final int MAX_PHOTOS = 10;
    private static final String KIND = "RESIDENT";

    public record Photo(UUID id, String caption, boolean primary, String createdAt, String createdBy, long size, String mime) {}

    public record Content(byte[] bytes, String mime) {}

    private final JdbcTemplate db;
    private final RosterService roster;
    private final RbacService rbac;
    private final AttachmentStorage storage;

    public ResidentPhotoService(JdbcTemplate db, RosterService roster, RbacService rbac, AttachmentStorage storage) {
        this.db = db;
        this.roster = roster;
        this.rbac = rbac;
        this.storage = storage;
    }

    @Transactional(readOnly = true)
    public List<Photo> list(UUID resident) {
        roster.requireResident(resident, null);
        return db.query(
            "select id,caption,is_primary,created_at,created_by,size_bytes,mime from attachment where owner_kind=? and owner_id=?" +
                " order by is_primary desc, created_at desc",
            (rs, n) ->
                new Photo(
                    rs.getObject("id", UUID.class),
                    rs.getString("caption"),
                    rs.getBoolean("is_primary"),
                    rs.getTimestamp("created_at").toInstant().toString(),
                    rs.getString("created_by"),
                    rs.getLong("size_bytes"),
                    rs.getString("mime")
                ),
            KIND,
            resident
        );
    }

    @Transactional(readOnly = true)
    public Content content(UUID resident, UUID photo) {
        roster.requireResident(resident, null);
        var row = find(resident, photo);
        return new Content(storage.read(row.get("storage_key").toString()), row.get("mime").toString());
    }

    public Photo upload(UUID resident, byte[] bytes, String caption) {
        long hamlet = roster.requireResident(resident, "canUpdateInspection");
        String text = caption == null ? "" : caption.strip();
        if (text.length() > 500) throw bad("Chú thích tối đa 500 ký tự");
        long count = db.queryForObject("select count(*) from attachment where owner_kind=? and owner_id=?", Long.class, KIND, resident);
        if (count >= MAX_PHOTOS) throw bad("Mỗi nhân khẩu tối đa " + MAX_PHOTOS + " ảnh; xoá bớt ảnh cũ trước");
        var stored = storage.store(bytes, false);
        // The bytes are already on disk; drop them again if the metadata insert is rolled back.
        afterRollback(() -> storage.delete(stored.key()));
        var user = rbac.current();
        String name = user.get("fullName") == null ? "" : user.get("fullName").toString();
        UUID id = UUID.randomUUID();
        db.update(
            "insert into attachment(id,owner_kind,owner_id,hamlet_id,category,mime,storage_key,size_bytes,sha256,caption,is_primary,created_by,created_by_subject)" +
                " values (?,?,?,?,'PORTRAIT',?,?,?,?,?,?,?,?)",
            id,
            KIND,
            resident,
            hamlet,
            stored.mime(),
            stored.key(),
            stored.size(),
            stored.sha256(),
            text,
            count == 0,
            name,
            rbac.subject()
        );
        rbac.audit("attachment-upload", "roster-resident:" + resident, Map.of("attachment", id.toString()));
        return list(resident)
            .stream()
            .filter(p -> p.id().equals(id))
            .findFirst()
            .orElseThrow();
    }

    public List<Photo> makePrimary(UUID resident, UUID photo) {
        roster.requireResident(resident, "canUpdateInspection");
        find(resident, photo);
        db.update("update attachment set is_primary=false where owner_kind=? and owner_id=? and is_primary", KIND, resident);
        db.update("update attachment set is_primary=true where id=?", photo);
        return list(resident);
    }

    public void delete(UUID resident, UUID photo) {
        roster.requireResident(resident, "canUpdateInspection");
        var row = find(resident, photo);
        db.update("delete from attachment where id=?", photo);
        if (Boolean.TRUE.equals(row.get("is_primary"))) db.update(
            "update attachment set is_primary=true where id=(select id from attachment where owner_kind=? and owner_id=? order by created_at desc limit 1)",
            KIND,
            resident
        );
        rbac.audit("attachment-delete", "roster-resident:" + resident, Map.of("attachment", photo.toString()));
        String key = row.get("storage_key").toString();
        afterCommit(() -> storage.delete(key));
    }

    private Map<String, Object> find(UUID resident, UUID photo) {
        var rows = db.queryForList("select * from attachment where id=? and owner_kind=? and owner_id=?", photo, KIND, resident);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy ảnh của nhân khẩu này");
        return rows.getFirst();
    }

    private static void afterRollback(Runnable action) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) return;
        TransactionSynchronizationManager.registerSynchronization(
            new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    if (status != STATUS_COMMITTED) action.run();
                }
            }
        );
    }

    private static void afterCommit(Runnable action) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            action.run();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(
            new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            }
        );
    }

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
