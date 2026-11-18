package com.policemanagement.com.service.roster;

import java.nio.file.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

/** Local operator entry point; no network route. Deliberately prints only aggregate counts and collection ID. */
public final class RosterMaintenance {

    private RosterMaintenance() {}

    public static void main(String[] args) throws Exception {
        if (args.length < 2 || !args[0].equals("--import-authorized")) throw new IllegalArgumentException(
            "Usage: --import-authorized <source-directory> [jdbc-url]"
        );
        Path source = Path.of(args[1]).toRealPath();
        String url = args.length > 2 ? args[2] : "jdbc:postgresql://localhost:5432/Monolithic";
        var ds = new DriverManagerDataSource(url, "Monolithic", "");
        var db = new JdbcTemplate(ds);
        var tx = new TransactionTemplate(new DataSourceTransactionManager(ds));
        var service = new RosterService(db, new ObjectMapper(), new RosterCrypto(".tc2-private/data.key", db), null);
        var uploads = new ArrayList<RosterService.Upload>();
        try (var files = Files.list(source)) {
            for (Path p : files
                .filter(p -> p.getFileName().toString().startsWith("DSNK - TC2") && p.toString().endsWith(".xlsx"))
                .sorted()
                .toList()) {
                var match = java.util.regex.Pattern.compile("(61|62|63|69)").matcher(p.getFileName().toString());
                if (!match.find()) continue;
                uploads.add(new RosterService.Upload(p.getFileName().toString(), match.group(), Files.readAllBytes(p)));
            }
        }
        if (
            uploads.size() != 4 || uploads.stream().map(RosterService.Upload::legacy).distinct().count() != 4
        ) throw new IllegalArgumentException("Expected exactly the four authorized TC2 workbooks");
        var collection = tx.execute(status ->
            service.stageAuthorized(uploads, "TC2 — nguồn thật 61/62/63/69", null, "operator:authorized-initial-import")
        );
        UUID id = (UUID) collection.get("id");
        tx.executeWithoutResult(status -> service.applyAuthorized(id, "operator:authorized-initial-import"));
        System.out.println("TC2 collection: " + id);
        System.out.println(
            "Business rows: " + db.queryForObject("select count(*) from tc2_roster.import_row where status<>'EXCLUDED'", Long.class)
        );
        System.out.println(
            "Rows by status: " + db.queryForList("select status,count(*) amount from tc2_roster.import_row group by status order by status")
        );
        System.out.println(
            "Counts: " +
                db.queryForMap(
                    "select (select count(*) from tc2_roster.household) households,(select count(*) from tc2_roster.resident) residents,(select count(*) from tc2_roster.residence_record) records"
                )
        );
    }
}
