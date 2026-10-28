package com.policemanagement.com.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.policemanagement.com.service.rbac.RbacService;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

/** Never resets a schema or commits fixtures. Must point at a restored database. */
@EnabledIfEnvironmentVariable(named = "RUN_DOCUMENT_DB_TESTS", matches = "true")
class DocumentLifecyclePostgresTest {

    private JdbcTemplate db;
    private TransactionTemplate tx;
    private DocumentLifecycleService service;
    private Long house;
    private final LocalDate today = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));

    @BeforeEach
    void setup() {
        String database = System.getenv("DOCUMENT_TEST_DATABASE");
        assertNotNull(database);
        assertTrue(database.matches("tc2_restore_[A-Za-z0-9_]+"), "Test database must be an isolated restore");
        var source = new DriverManagerDataSource("jdbc:postgresql://localhost:5432/" + database, "Monolithic", "");
        db = new JdbcTemplate(source);
        assertEquals(database, db.queryForObject("select current_database()", String.class));
        tx = new TransactionTemplate(new DataSourceTransactionManager(source));
        var rbac = mock(RbacService.class);
        when(rbac.subject()).thenReturn("document-regression-test");
        service = new DocumentLifecycleService(db, rbac, new ObjectMapper());
        house = db.queryForObject("select min(id) from household", Long.class);
    }

    private DocumentLifecycleService.Command command(UUID request, Long version, LocalDate expiry) {
        return new DocumentLifecycleService.Command(
            request,
            version,
            house,
            expiry,
            null,
            "TEST",
            "Test agency",
            "Regression fixture",
            "Test only",
            "PCCC"
        );
    }

    @Test
    void registerRetryAndRenewalAreAtomicAndAudited() {
        tx.executeWithoutResult(status -> {
            var original = command(UUID.randomUUID(), null, today.minusDays(1));
            Long id = service.register(original);
            assertEquals(id, service.register(original));
            assertEquals(1L, db.queryForObject("select count(*) from document_record_history where document_id=?", Long.class, id));
            var renewal = command(UUID.randomUUID(), 0L, today.plusDays(30));
            assertEquals(id, service.confirmOrRenew(id, renewal));
            assertEquals(id, service.confirmOrRenew(id, renewal));
            assertEquals(2L, db.queryForObject("select count(*) from document_record_history where document_id=?", Long.class, id));
            assertEquals(1L, db.queryForObject("select version from document_record where id=?", Long.class, id));
            assertNull(db.queryForObject("select expiry_date from document_record where id=?", String.class, id));
            assertEquals(2, service.history(id, 0).size());
            assertThrows(ResponseStatusException.class, () ->
                service.confirmOrRenew(id, command(UUID.randomUUID(), 0L, today.plusDays(60)))
            );
            status.setRollbackOnly();
        });
    }

    @Test
    void confirmationPreservesLegacySourceAndRetriesRejectDifferentContent() {
        tx.executeWithoutResult(status -> {
            Long id = db.queryForObject("select min(id) from document_record where expiry_on is null", Long.class);
            assertNotNull(id, "Rehearsal requires an unconfirmed source document");
            String sourceDate = db.queryForObject("select expiry_date from document_record where id=?", String.class, id);
            var first = command(UUID.randomUUID(), 0L, today.minusDays(30));
            service.confirmOrRenew(id, first);
            assertEquals(sourceDate, db.queryForObject("select expiry_date from document_record where id=?", String.class, id));
            assertEquals(
                "CONFIRM",
                db.queryForObject("select operation from document_record_history where document_id=?", String.class, id)
            );
            assertThrows(ResponseStatusException.class, () ->
                service.confirmOrRenew(id, command(first.requestId(), 1L, today.plusDays(30)))
            );
            assertEquals(1L, db.queryForObject("select version from document_record where id=?", Long.class, id));
            status.setRollbackOnly();
        });
    }

    @Test
    void directSqlCannotSilentlyModifySourceOrDeleteDocuments() {
        assertThrows(Exception.class, () ->
            tx.executeWithoutResult(status -> db.update("update document_record set expiry_date='invented'"))
        );
        assertThrows(Exception.class, () -> tx.executeWithoutResult(status -> db.update("delete from document_record")));
    }
}
