package com.policemanagement.com.service.gis;

import com.policemanagement.com.service.AttachmentStorage;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Moves household inspection photos stored as base64 text in {@code gis_inspection_photo} into the attachment store once the
 * application has started. Each photo keeps its id, time, author and caption and moves in its own transaction: the file is
 * written first, then the attachment row is inserted and the old row deleted; a failure removes the new file and leaves the
 * old row, which {@link InspectionPhotoService} keeps serving. Running again only finds the rows not yet moved.
 */
@Component
public class InspectionPhotoMigration {

    private static final Logger LOG = LoggerFactory.getLogger(InspectionPhotoMigration.class);

    private final JdbcTemplate db;
    private final AttachmentStorage storage;
    private final TransactionTemplate tx;

    public InspectionPhotoMigration(JdbcTemplate db, AttachmentStorage storage, PlatformTransactionManager transactions) {
        this.db = db;
        this.storage = storage;
        this.tx = new TransactionTemplate(transactions);
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        try {
            migrate();
        } catch (RuntimeException e) {
            // Never block start-up: unmoved photos are still served from the old table.
            LOG.warn("Inspection photo migration did not finish: {}", e.getMessage());
        }
    }

    /** @return number of photos moved. */
    public int migrate() {
        var ids = db.queryForList(
            "select p.id from gis_inspection_photo p join public.household h on h.id=p.household_id where h.roster_id is not null order by p.captured_at",
            UUID.class
        );
        int moved = 0;
        for (UUID id : ids) {
            try {
                if (Boolean.TRUE.equals(tx.execute(s -> move(id)))) moved++;
            } catch (RuntimeException e) {
                LOG.warn("Inspection photo {} stays in gis_inspection_photo: {}", id, e.getMessage());
            }
        }
        if (moved > 0 || !ids.isEmpty()) LOG.info("Moved {} of {} household inspection photos to the attachment store", moved, ids.size());
        return moved;
    }

    private boolean move(UUID id) {
        var rows = db.queryForList(
            "select p.*, h.roster_id, h.hamlet_id hh_hamlet from gis_inspection_photo p join public.household h on h.id=p.household_id where p.id=?",
            id
        );
        if (rows.isEmpty()) return false;
        var row = rows.getFirst();
        byte[] bytes = InspectionPhotoService.decode(row.get("image_data").toString());
        var stored = storage.store(bytes, false);
        try {
            String caption = row.get("caption") == null ? "" : row.get("caption").toString().strip();
            db.update(
                "insert into attachment(id,owner_kind,owner_id,hamlet_id,category,mime,storage_key,size_bytes,sha256,caption,is_primary,created_at,created_by,created_by_subject)" +
                    " values (?,?,?,?,?,?,?,?,?,?,false,?,?,?)",
                id,
                InspectionPhotoService.KIND,
                row.get("roster_id"),
                row.get("hh_hamlet"),
                row.get("category"),
                stored.mime(),
                stored.key(),
                stored.size(),
                stored.sha256(),
                caption.length() > 500 ? caption.substring(0, 500) : caption,
                row.get("captured_at"),
                row.get("taken_by"),
                row.get("actor_subject")
            );
            // The runtime role may not lock the old table (no UPDATE grant); deleting exactly one row proves no
            // concurrent start-up moved this photo first, otherwise the insert above is rolled back.
            if (db.update("delete from gis_inspection_photo where id=?", id) != 1) throw new IllegalStateException("photo already moved");
            return true;
        } catch (RuntimeException e) {
            storage.delete(stored.key());
            throw e;
        }
    }
}
