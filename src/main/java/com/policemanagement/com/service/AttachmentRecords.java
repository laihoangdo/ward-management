package com.policemanagement.com.service;

import com.policemanagement.com.service.rbac.RbacService;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;

/**
 * Attachment metadata rows plus their bytes in {@link AttachmentStorage}, for any owner kind.
 *
 * <p>Callers MUST check the owner's territory and permissions first: this class trusts the owner it is given. Photos can be the
 * owner's main photo (one per owner); documents (PDF or a scan) never are. Files are removed only after the deleting
 * transaction commits, and a stored file is removed again if its insert rolls back.
 */
@Service
public class AttachmentRecords {

    public static final String PHOTO = "PHOTO";
    public static final String DOCUMENT = "DOCUMENT";

    public record Attachment(
        UUID id,
        String category,
        String caption,
        boolean primary,
        String createdAt,
        String createdBy,
        long size,
        String mime
    ) {}

    public record Content(byte[] bytes, String mime) {}

    private final JdbcTemplate db;
    private final RbacService rbac;
    private final AttachmentStorage storage;

    public AttachmentRecords(JdbcTemplate db, RbacService rbac, AttachmentStorage storage) {
        this.db = db;
        this.rbac = rbac;
        this.storage = storage;
    }

    public List<Attachment> list(String kind, UUID owner) {
        return db.query(
            "select id,category,caption,is_primary,created_at,created_by,size_bytes,mime from attachment where owner_kind=? and owner_id=?" +
                " order by is_primary desc, created_at desc",
            (rs, n) ->
                new Attachment(
                    rs.getObject("id", UUID.class),
                    rs.getString("category"),
                    rs.getString("caption"),
                    rs.getBoolean("is_primary"),
                    rs.getTimestamp("created_at").toInstant().toString(),
                    rs.getString("created_by"),
                    rs.getLong("size_bytes"),
                    rs.getString("mime")
                ),
            kind,
            owner
        );
    }

    public Content content(String kind, UUID owner, UUID id) {
        var row = find(kind, owner, id);
        return new Content(storage.read(row.get("storage_key").toString()), row.get("mime").toString());
    }

    /**
     * Stores a new attachment. {@code photoCategory} is the category used for images (PDFs are always DOCUMENT); the first image
     * of an owner becomes its main photo when {@code autoPrimary}.
     */
    public Attachment add(
        String kind,
        UUID owner,
        Long hamlet,
        byte[] bytes,
        String caption,
        String photoCategory,
        boolean allowPdf,
        int maxCount,
        boolean autoPrimary,
        String auditTarget
    ) {
        String text = caption == null ? "" : caption.strip();
        if (text.length() > 500) throw bad("Chú thích tối đa 500 ký tự");
        long count = db.queryForObject("select count(*) from attachment where owner_kind=? and owner_id=?", Long.class, kind, owner);
        if (count >= maxCount) throw bad("Tối đa " + maxCount + " tệp đính kèm; xoá bớt tệp cũ trước");
        var stored = storage.store(bytes, allowPdf);
        // The bytes are already on disk; drop them again if the metadata insert is rolled back.
        afterRollback(() -> storage.delete(stored.key()));
        boolean pdf = stored.mime().equals("application/pdf");
        String category = pdf ? DOCUMENT : photoCategory;
        boolean primary =
            autoPrimary &&
            !DOCUMENT.equals(category) &&
            db.queryForObject(
                "select count(*) from attachment where owner_kind=? and owner_id=? and is_primary",
                Long.class,
                kind,
                owner
            ) == 0;
        var user = rbac.current();
        String name = user.get("fullName") == null ? "" : user.get("fullName").toString();
        UUID id = UUID.randomUUID();
        db.update(
            "insert into attachment(id,owner_kind,owner_id,hamlet_id,category,mime,storage_key,size_bytes,sha256,caption,is_primary,created_by,created_by_subject)" +
                " values (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            id,
            kind,
            owner,
            hamlet,
            category,
            stored.mime(),
            stored.key(),
            stored.size(),
            stored.sha256(),
            text,
            primary,
            name,
            rbac.subject()
        );
        rbac.audit("attachment-upload", auditTarget, Map.of("attachment", id.toString()));
        return list(kind, owner)
            .stream()
            .filter(a -> a.id().equals(id))
            .findFirst()
            .orElseThrow();
    }

    public List<Attachment> makePrimary(String kind, UUID owner, UUID id) {
        var row = find(kind, owner, id);
        if (DOCUMENT.equals(row.get("category"))) throw bad("Chỉ ảnh mới đặt làm ảnh chính được");
        db.update("update attachment set is_primary=false where owner_kind=? and owner_id=? and is_primary", kind, owner);
        db.update("update attachment set is_primary=true where id=?", id);
        return list(kind, owner);
    }

    public void delete(String kind, UUID owner, UUID id, String auditTarget) {
        var row = find(kind, owner, id);
        db.update("delete from attachment where id=?", id);
        if (Boolean.TRUE.equals(row.get("is_primary"))) db.update(
            "update attachment set is_primary=true where id=(select id from attachment where owner_kind=? and owner_id=? and category<>? order by created_at desc limit 1)",
            kind,
            owner,
            DOCUMENT
        );
        rbac.audit("attachment-delete", auditTarget, Map.of("attachment", id.toString()));
        String key = row.get("storage_key").toString();
        afterCommit(() -> storage.delete(key));
    }

    private Map<String, Object> find(String kind, UUID owner, UUID id) {
        var rows = db.queryForList("select * from attachment where id=? and owner_kind=? and owner_id=?", id, kind, owner);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy tệp đính kèm này");
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
