package com.policemanagement.com.service.roster;

import com.policemanagement.com.service.rbac.TerritoryGeometry;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

/** Read-only reconciliation, prints no names, addresses or identities. */
public final class RosterVerify {

    private RosterVerify() {}

    public static void main(String[] args) {
        String database = args.length > 0 ? args[0] : "Monolithic";
        if (!database.matches("[A-Za-z0-9_]+")) throw new IllegalArgumentException("Invalid database");
        var ds = new DriverManagerDataSource("jdbc:postgresql://localhost:5432/" + database, "Monolithic", "");
        var db = new JdbcTemplate(ds);
        var json = new ObjectMapper();
        var crypto = new RosterCrypto(".tc2-private/data.key", db);
        var tx = new TransactionTemplate(new DataSourceTransactionManager(ds));
        tx.setReadOnly(true);
        var report = tx.execute(s -> {
            var out = new LinkedHashMap<String, Object>();
            out.put("database", database);
            out.put(
                "sourceStatus",
                db.queryForList("select status,count(*) amount from tc2_roster.import_row group by status order by status")
            );
            out.put(
                "counts",
                db.queryForMap(
                    "select (select count(*) from tc2_roster.resident) residents,(select count(*) from tc2_roster.household) households,(select count(*) from tc2_roster.residence_record) records,(select count(*) from tc2_roster.change_event) history_events"
                )
            );
            long outside = 0;
            String boundary = db.queryForObject(
                "select boundary_geo_json from public.hamlet where code='27592-TRUNGCHANH-2'",
                String.class
            );
            var area = TerritoryGeometry.area(json.readTree(boundary));
            for (var row : db.queryForList("select latitude,longitude,coordinate_method from tc2_roster.household")) {
                if (
                    row.get("latitude") == null ||
                    row.get("longitude") == null ||
                    !area.contains(((Number) row.get("longitude")).doubleValue(), ((Number) row.get("latitude")).doubleValue())
                ) outside++;
            }
            out.put("pointsOutsideBoundary", outside);
            if (outside != 0) throw new IllegalStateException("Temporary point containment failed");
            long decrypted = 0;
            for (var row : db.queryForList("select raw_ciphertext,parsed_ciphertext from tc2_roster.import_row")) {
                json.readTree(crypto.decrypt(row.get("raw_ciphertext").toString()));
                json.readTree(crypto.decrypt(row.get("parsed_ciphertext").toString()));
                decrypted++;
            }
            out.put("sourceRowsDecryptable", decrypted);
            out.put(
                "sourceCoverageErrors",
                db.queryForObject(
                    "select count(*) from tc2_roster.import_row r left join tc2_roster.source_link l on l.source_row_id=r.id where r.status='APPLIED' and (l.source_row_id is null or r.resident_id is distinct from l.resident_id or r.record_id is distinct from l.record_id)",
                    Long.class
                )
            );
            out.put(
                "legacy",
                db.queryForMap("select (select count(*) from public.household) households,(select count(*) from public.resident) residents")
            );
            out.put(
                "legacyHouseholdHash",
                db.queryForObject("select md5(string_agg(row_to_json(h)::text,'' order by id)) from public.household h", String.class)
            );
            out.put(
                "legacyResidentHash",
                db.queryForObject("select md5(string_agg(row_to_json(r)::text,'' order by id)) from public.resident r", String.class)
            );
            out.put(
                "headConflicts",
                db.queryForObject("select count(*) from tc2_roster.household where verification_status='HEAD_CONFLICT'", Long.class)
            );
            return out;
        });
        System.out.println(json.writerWithDefaultPrettyPrinter().writeValueAsString(report));
    }
}
