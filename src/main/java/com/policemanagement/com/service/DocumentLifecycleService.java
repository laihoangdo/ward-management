package com.policemanagement.com.service;

import com.policemanagement.com.service.rbac.RbacService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

@Service
@Transactional
public class DocumentLifecycleService {

    public record Command(
        UUID requestId,
        Long version,
        Long householdId,
        LocalDate expiryOn,
        LocalDate issuedOn,
        String documentNumber,
        String issuingAuthority,
        String reason,
        String docName,
        String docType
    ) {}

    private final JdbcTemplate db;
    private final RbacService rbac;
    private final ObjectMapper json;

    public DocumentLifecycleService(JdbcTemplate db, RbacService rbac, ObjectMapper json) {
        this.db = db;
        this.rbac = rbac;
        this.json = json;
    }

    private ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private String bounded(String value, int maximum) {
        String text = value == null ? "" : value.strip();
        if (text.length() > maximum) throw bad("Nội dung quá dài");
        return text;
    }

    private void validate(Command command) {
        if (
            command.requestId() == null ||
            command.householdId() == null ||
            command.expiryOn() == null ||
            bounded(command.reason(), 2000).isEmpty()
        ) throw bad("Cần hộ đã chọn, ngày hết hạn, lý do và mã yêu cầu");
        if (command.issuedOn() != null && command.issuedOn().isAfter(command.expiryOn())) throw bad("Ngày cấp sau ngày hết hạn");
        bounded(command.documentNumber(), 255);
        bounded(command.issuingAuthority(), 255);
        if (
            command.expiryOn().getYear() < 1900 ||
            command.expiryOn().getYear() > 2200 ||
            (command.issuedOn() != null && (command.issuedOn().getYear() < 1900 || command.issuedOn().getYear() > 2200))
        ) throw bad("Ngày ngoài phạm vi hỗ trợ");
    }

    private String hash(Long id, Command command) {
        try {
            return HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(
                    (Objects.toString(id, "register") + ":" + json.writeValueAsString(command)).getBytes(StandardCharsets.UTF_8)
                )
            );
        } catch (java.security.NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private Long replay(Command command, String hash) {
        // Serialize identical retry IDs, including concurrent registrations; held until transaction end.
        db.queryForObject("select pg_advisory_xact_lock(hashtextextended(?,0))", Object.class, command.requestId().toString());
        var rows = db.queryForList(
            "select document_id,actor,request_hash from document_record_history where request_id=?",
            command.requestId()
        );
        if (rows.isEmpty()) return null;
        var receipt = rows.getFirst();
        if (!Objects.equals(receipt.get("actor"), rbac.subject()) || !Objects.equals(receipt.get("request_hash"), hash)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Mã yêu cầu đã dùng với nội dung khác");
        }
        Long documentId = ((Number) receipt.get("document_id")).longValue();
        rbac.record("document", documentId);
        return documentId;
    }

    private void context(Command command, String operation, String hash) {
        for (var entry : Map.of(
            "actor",
            rbac.subject(),
            "reason",
            command.reason().strip(),
            "operation",
            operation,
            "request_id",
            command.requestId().toString(),
            "request_hash",
            hash
        ).entrySet())
            db.queryForObject("select set_config(?,?,true)", String.class, "documents." + entry.getKey(), entry.getValue());
    }

    public Long register(Command command) {
        rbac.permission("canRenewDocs");
        validate(command);
        rbac.household(command.householdId());
        String name = bounded(command.docName(), 255),
            type = bounded(command.docType(), 255);
        if (name.isEmpty() || type.isEmpty()) throw bad("Cần tên và loại hồ sơ");
        String hash = hash(null, command);
        Long retry = replay(command, hash);
        if (retry != null) return retry;
        context(command, "REGISTER", hash);
        Long id = db.queryForObject(
            """
            insert into document_record(id,doc_name,doc_type,household_id,expiry_on,issued_on,document_number,issuing_authority,verified_by,verified_at)
            values(nextval('sequence_generator'),?,?,?,?,?,?,?,?,clock_timestamp()) returning id
            """,
            Long.class,
            name,
            type,
            command.householdId(),
            command.expiryOn(),
            command.issuedOn(),
            bounded(command.documentNumber(), 255),
            bounded(command.issuingAuthority(), 255),
            rbac.subject()
        );
        rbac.recordCreated("document", id);
        rbac.audit("document-registered", id.toString(), Map.of("requestId", command.requestId()));
        return id;
    }

    public Long confirmOrRenew(Long id, Command command) {
        rbac.permission("canRenewDocs");
        rbac.record("document", id);
        validate(command);
        rbac.household(command.householdId());
        String hash = hash(id, command);
        Long retry = replay(command, hash);
        if (retry != null) return retry;
        var rows = db.queryForList("select household_id,expiry_on,version from document_record where id=? for update", id);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        var old = rows.getFirst();
        if (command.version() == null || command.version() != ((Number) old.get("version")).longValue()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Hồ sơ đã thay đổi; tải lại trước khi lưu");
        }
        if (old.get("household_id") != null && !Objects.equals(((Number) old.get("household_id")).longValue(), command.householdId())) {
            throw bad("Không chuyển giấy phép đã xác nhận sang hộ khác");
        }
        LocalDate previous = old.get("expiry_on") == null ? null : ((java.sql.Date) old.get("expiry_on")).toLocalDate();
        if (
            previous != null &&
            (!command.expiryOn().isAfter(previous) || command.expiryOn().isBefore(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"))))
        ) {
            throw bad("Ngày gia hạn phải sau hạn cũ và không trước hôm nay");
        }
        context(command, previous == null ? "CONFIRM" : "RENEW", hash);
        int changed = db.update(
            """
            update document_record set household_id=?,expiry_on=?,issued_on=?,document_number=?,issuing_authority=?,
            verified_by=?,verified_at=clock_timestamp(),version=version+1 where id=? and version=?
            """,
            command.householdId(),
            command.expiryOn(),
            command.issuedOn(),
            bounded(command.documentNumber(), 255),
            bounded(command.issuingAuthority(), 255),
            rbac.subject(),
            id,
            command.version()
        );
        if (changed != 1) throw new ResponseStatusException(HttpStatus.CONFLICT, "Hồ sơ đã thay đổi");
        rbac.audit(previous == null ? "document-confirmed" : "document-renewed", id.toString(), Map.of("requestId", command.requestId()));
        return id;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> history(Long id, int page) {
        rbac.current();
        rbac.record("document", id);
        if (page < 0 || page > 100000) throw bad("Trang không hợp lệ");
        return db.queryForList(
            """
            select id,operation,actor,reason,recorded_at,before_data->>'expiry_on' previous_expiry,
            after_data->>'expiry_on' expiry_on,after_data->>'issued_on' issued_on,
            after_data->>'document_number' document_number,after_data->>'issuing_authority' issuing_authority
            from document_record_history where document_id=? order by id desc limit 50 offset ?
            """,
            id,
            (long) page * 50
        );
    }
}
