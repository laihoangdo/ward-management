package com.policemanagement.com.service.roster;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

/** Read-only checks: fixed isolated port, explicit restore name, no plaintext in test output. */
@EnabledIfEnvironmentVariable(named = "RUN_RELEASE_RESTORE_TESTS", matches = "true")
class ReleaseRestorePostgresTest {

    private JdbcTemplate db;

    @BeforeEach
    void setup() {
        String database = System.getenv("RELEASE_RESTORE_DATABASE");
        assertNotNull(database);
        assertTrue(database.matches("tc2_restore_[A-Za-z0-9_]+"));
        var source = new DriverManagerDataSource("jdbc:postgresql://127.0.0.1:55433/" + database, "police_runtime", "");
        var properties = new java.util.Properties();
        properties.setProperty("options", "-c default_transaction_read_only=on");
        source.setConnectionProperties(properties);
        db = new JdbcTemplate(source);
        assertEquals(database, db.queryForObject("select current_database()", String.class));
        assertEquals("police_runtime", db.queryForObject("select current_user", String.class));
        assertEquals("on", db.queryForObject("show default_transaction_read_only", String.class));
    }

    @Test
    void restoredCiphertextsDecryptWithExistingKeyWithoutExposingPersonalData() {
        Path key = Path.of(".tc2-private/data.key");
        assertTrue(Files.isRegularFile(key), "Existing encryption key required; never generate a replacement");
        var crypto = new RosterCrypto(key.toString(), db);
        var checked = new AtomicInteger();
        var failures = new AtomicInteger();
        db.query(
            "select raw_ciphertext as ciphertext from tc2_roster.import_row " +
                "union all select parsed_ciphertext from tc2_roster.import_row " +
                "union all select number_ciphertext from tc2_roster.resident_identity",
            (RowCallbackHandler) row -> {
                checked.incrementAndGet();
                try {
                    crypto.decrypt(row.getString("ciphertext"));
                } catch (RuntimeException ignored) {
                    failures.incrementAndGet();
                }
            }
        );
        assertTrue(checked.get() > 0, "Restore must contain encrypted records");
        assertEquals(0, failures.get(), "Restored ciphertext authentication/decryption failures");
    }

    @Test
    void runtimeCanReadCoreViewsAndSpatialDataWithoutAdministrativePrivileges() {
        assertFalse(
            db.queryForObject(
                "select rolsuper or rolcreatedb or rolcreaterole or rolbypassrls from pg_roles where rolname=current_user",
                Boolean.class
            )
        );
        assertFalse(db.queryForObject("select has_schema_privilege(current_user,'public','CREATE')", Boolean.class));
        assertFalse(db.queryForObject("select has_schema_privilege(current_user,'database_repair','USAGE')", Boolean.class));
        assertFalse(db.queryForObject("select has_table_privilege(current_user,'public.databasechangelog','UPDATE')", Boolean.class));
        for (String table : new String[] {
            "tc2_roster.household",
            "tc2_roster.resident",
            "public.v_household_address",
            "public.gis_field_building",
            "public.gis_inspection_photo",
        }) {
            assertNotNull(db.queryForObject("select count(*) from " + table, Long.class));
        }
        assertEquals(
            0L,
            db.queryForObject(
                "select count(*) from public.gis_field_building where footprint_geom is null or not public.ST_IsValid(footprint_geom)",
                Long.class
            )
        );
    }
}
