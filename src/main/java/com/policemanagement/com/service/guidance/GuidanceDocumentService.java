package com.policemanagement.com.service.guidance;

import com.policemanagement.com.service.AttachmentRecords;
import com.policemanagement.com.service.rbac.RbacService;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Commune-wide register of guidance documents for ward police officers (văn bản hướng dẫn CSKV). Every signed-in officer can
 * read it; canManageGuidanceDocs records, edits and removes documents and their scanned files.
 */
@Service
@Transactional
public class GuidanceDocumentService {

    public static final String KIND = "GUIDANCE";
    static final int MAX_FILES = 10;
    static final int PAGE_SIZE = 30;
    /** Columns of the list and of the printed register (GĐ6), in order. */
    static final String COLUMNS =
        "g.id, g.doc_number, g.issuing_authority, g.issued_on, g.title, g.received_on, g.field, g.summary, g.notes, g.version," +
        " g.created_by, g.updated_at, (select count(*) from attachment a where a.owner_kind='GUIDANCE' and a.owner_id=g.id) file_count";

    private final JdbcTemplate db;
    private final RbacService rbac;
    private final AttachmentRecords attachments;

    public GuidanceDocumentService(JdbcTemplate db, RbacService rbac, AttachmentRecords attachments) {
        this.db = db;
        this.rbac = rbac;
        this.attachments = attachments;
    }

    private boolean canManage() {
        if (rbac.global()) return true;
        try {
            rbac.permission("canManageGuidanceDocs");
            return true;
        } catch (AccessDeniedException e) {
            return false;
        }
    }

    private void authorizeView() {
        db.execute("set local time zone 'Asia/Ho_Chi_Minh'");
        rbac.current();
    }

    private void authorizeManage() {
        authorizeView();
        rbac.permission("canManageGuidanceDocs");
    }

    private record Where(String text, List<Object> args) {}

    private static Where where(Map<String, String> filter) {
        var parts = new ArrayList<String>();
        var args = new ArrayList<Object>();
        String search = s(filter, "search");
        if (!search.isEmpty()) {
            parts.add("(g.doc_number ilike ? or g.title ilike ? or g.issuing_authority ilike ? or g.field ilike ? or g.summary ilike ?)");
            String like = "%" + search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            for (int i = 0; i < 5; i++) args.add(like);
        }
        String year = s(filter, "year");
        if (!year.isEmpty()) {
            try {
                args.add(Integer.parseInt(year));
            } catch (NumberFormatException e) {
                throw bad("Năm không hợp lệ");
            }
            parts.add("extract(year from g.issued_on)=?");
        }
        String authority = s(filter, "authority");
        if (!authority.isEmpty()) {
            parts.add("g.issuing_authority=?");
            args.add(authority);
        }
        return new Where(parts.isEmpty() ? "" : " where " + String.join(" and ", parts), args);
    }

    /** All documents matching the filter, newest first; used by the printed register. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> all(Map<String, String> filter) {
        authorizeView();
        var w = where(filter);
        return db.queryForList(
            "select " + COLUMNS + " from guidance_document g" + w.text() + " order by g.issued_on desc, g.doc_number",
            w.args().toArray()
        );
    }

    @Transactional(readOnly = true)
    public Map<String, Object> list(Map<String, String> filter) {
        authorizeView();
        var w = where(filter);
        int page = page(s(filter, "page"));
        long total = db.queryForObject("select count(*) from guidance_document g" + w.text(), Long.class, w.args().toArray());
        var args = new ArrayList<>(w.args());
        args.add(PAGE_SIZE);
        args.add((long) page * PAGE_SIZE);
        var items = db.queryForList(
            "select " + COLUMNS + " from guidance_document g" + w.text() + " order by g.issued_on desc, g.doc_number limit ? offset ?",
            args.toArray()
        );
        var result = new LinkedHashMap<String, Object>();
        result.put("items", items);
        result.put("total", total);
        result.put("page", page);
        result.put("pageSize", PAGE_SIZE);
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> summary() {
        authorizeView();
        var result = new LinkedHashMap<String, Object>();
        result.put("total", db.queryForObject("select count(*) from guidance_document", Long.class));
        result.put(
            "years",
            db.queryForList("select distinct extract(year from issued_on)::int from guidance_document order by 1 desc", Integer.class)
        );
        result.put("authorities", db.queryForList("select distinct issuing_authority from guidance_document order by 1", String.class));
        result.put(
            "receivedThisMonth",
            db.queryForObject("select count(*) from guidance_document where received_on >= date_trunc('month', current_date)", Long.class)
        );
        result.put("canManage", canManage());
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> detail(UUID id) {
        authorizeView();
        return row(id);
    }

    private Map<String, Object> row(UUID id) {
        var rows = db.queryForList("select " + COLUMNS + " from guidance_document g where g.id=?", id);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy văn bản");
        return rows.getFirst();
    }

    private record Fields(
        String number,
        String authority,
        LocalDate issued,
        String title,
        LocalDate received,
        String field,
        String summary,
        String notes
    ) {}

    static Fields fields(Map<String, ?> d) {
        String number = text(d, "docNumber", 100);
        String authority = text(d, "issuingAuthority", 300);
        String title = text(d, "title", 1000);
        if (number.isEmpty()) throw bad("Nhập số, ký hiệu văn bản");
        if (authority.isEmpty()) throw bad("Nhập cơ quan ban hành");
        if (title.isEmpty()) throw bad("Nhập trích yếu / tiêu đề văn bản");
        LocalDate issued = date(d, "issuedOn", "Ngày ban hành");
        if (issued == null) throw bad("Nhập ngày ban hành");
        LocalDate received = date(d, "receivedOn", "Ngày nhận");
        if (received != null && received.isBefore(issued)) throw bad("Ngày nhận không được trước ngày ban hành");
        if (issued.isAfter(LocalDate.now().plusDays(1))) throw bad("Ngày ban hành không được ở tương lai");
        return new Fields(
            number,
            authority,
            issued,
            title,
            received,
            text(d, "field", 200),
            text(d, "summary", 4000),
            text(d, "notes", 2000)
        );
    }

    private String actor() {
        Object name = rbac.current().get("fullName");
        return name == null || name.toString().isBlank() ? rbac.subject() : name.toString();
    }

    public Map<String, Object> create(Map<String, Object> d) {
        authorizeManage();
        var f = fields(d);
        UUID id = UUID.randomUUID();
        String actor = actor();
        try {
            db.update(
                "insert into guidance_document(id,doc_number,issuing_authority,issued_on,title,received_on,field,summary,notes,created_by,updated_by)" +
                    " values (?,?,?,?,?,?,?,?,?,?,?)",
                id,
                f.number(),
                f.authority(),
                f.issued(),
                f.title(),
                f.received(),
                f.field(),
                f.summary(),
                f.notes(),
                actor,
                actor
            );
        } catch (DuplicateKeyException e) {
            throw duplicate();
        }
        rbac.audit("guidance-create", "guidance:" + id, Map.of("number", f.number()));
        return row(id);
    }

    public Map<String, Object> update(UUID id, Map<String, Object> d) {
        authorizeManage();
        row(id);
        var f = fields(d);
        long version;
        try {
            version = Long.parseLong(s(d, "version"));
        } catch (NumberFormatException e) {
            throw bad("Thiếu phiên bản hồ sơ");
        }
        int changed;
        try {
            changed = db.update(
                "update guidance_document set doc_number=?,issuing_authority=?,issued_on=?,title=?,received_on=?,field=?,summary=?,notes=?," +
                    "version=version+1,updated_at=now(),updated_by=? where id=? and version=?",
                f.number(),
                f.authority(),
                f.issued(),
                f.title(),
                f.received(),
                f.field(),
                f.summary(),
                f.notes(),
                actor(),
                id,
                version
            );
        } catch (DuplicateKeyException e) {
            throw duplicate();
        }
        if (changed == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "Văn bản đã được người khác sửa; tải lại rồi thử lại");
        rbac.audit("guidance-update", "guidance:" + id, Map.of("number", f.number()));
        return row(id);
    }

    public void delete(UUID id) {
        authorizeManage();
        var current = row(id);
        for (var file : attachments.list(KIND, id)) attachments.delete(KIND, id, file.id(), "guidance:" + id);
        db.update("delete from guidance_document where id=?", id);
        rbac.audit("guidance-delete", "guidance:" + id, Map.of("number", current.get("doc_number")));
    }

    // ---- files ----------------------------------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<AttachmentRecords.Attachment> files(UUID id) {
        authorizeView();
        row(id);
        return attachments.list(KIND, id);
    }

    @Transactional(readOnly = true)
    public AttachmentRecords.Content content(UUID id, UUID file) {
        authorizeView();
        row(id);
        return attachments.content(KIND, id, file);
    }

    public AttachmentRecords.Attachment upload(UUID id, byte[] bytes, String caption) {
        authorizeManage();
        row(id);
        return attachments.add(KIND, id, null, bytes, caption, AttachmentRecords.PHOTO, true, MAX_FILES, false, "guidance:" + id);
    }

    public List<AttachmentRecords.Attachment> makePrimary(UUID id, UUID file) {
        authorizeManage();
        row(id);
        return attachments.makePrimary(KIND, id, file);
    }

    public void deleteFile(UUID id, UUID file) {
        authorizeManage();
        row(id);
        attachments.delete(KIND, id, file, "guidance:" + id);
    }

    // ---- helpers --------------------------------------------------------------------------------------------------

    private static String s(Map<String, ?> d, String key) {
        return Objects.toString(d.get(key), "").strip();
    }

    private static String text(Map<String, ?> d, String key, int max) {
        String value = s(d, key);
        if (value.length() > max) throw bad("Quá dài (tối đa " + max + " ký tự): " + key);
        return value;
    }

    private static LocalDate date(Map<String, ?> d, String key, String label) {
        String value = s(d, key);
        if (value.isEmpty()) return null;
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException e) {
            throw bad(label + " không hợp lệ");
        }
    }

    private static int page(String value) {
        if (value.isEmpty()) return 0;
        try {
            int page = Integer.parseInt(value);
            if (page < 0) throw bad("Trang không hợp lệ");
            return page;
        } catch (NumberFormatException e) {
            throw bad("Trang không hợp lệ");
        }
    }

    private static ResponseStatusException duplicate() {
        return new ResponseStatusException(HttpStatus.CONFLICT, "Văn bản cùng số, cơ quan ban hành và ngày ban hành đã có trong sổ");
    }

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
