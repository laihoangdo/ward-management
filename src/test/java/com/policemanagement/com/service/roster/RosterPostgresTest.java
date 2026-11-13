package com.policemanagement.com.service.roster;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.policemanagement.com.service.rbac.RbacService;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

@EnabledIfEnvironmentVariable(named = "RUN_TC2_DB_TESTS", matches = "true")
class RosterPostgresTest {

    @Test
    void correctingIdentityKeepsOldNumberAsInactiveHistory() throws Exception {
        stageAndApply();
        UUID resident = db.queryForObject("select id from tc2_roster.resident", UUID.class),
            old = db.queryForObject("select id from tc2_roster.resident_identity", UUID.class);
        var d = new HashMap<String, Object>(
            Map.of(
                "identity",
                "001079000002",
                "documentType",
                "CCCD",
                "verified",
                true,
                "replaceIdentityId",
                old.toString(),
                "version",
                0,
                "reason",
                "Đã đối chiếu giấy tờ"
            )
        );
        tx.execute(s -> service.addIdentity(resident, d));
        assertEquals(2L, db.queryForObject("select count(*) from tc2_roster.resident_identity", Long.class));
        assertEquals(false, db.queryForObject("select active from tc2_roster.resident_identity where id=?", Boolean.class, old));
        assertEquals(
            "001079000001",
            crypto.decrypt(db.queryForObject("select number_ciphertext from tc2_roster.resident_identity where id=?", String.class, old))
        );
    }

    @Test
    void everyCampaignFilterRunsAgainstRealSchemaAndAddressPathSearchWorks() throws Exception {
        stageAndApply();
        for (String campaign : List.of(
            "MILITARY",
            "ID_UNDER_6",
            "ID_6_TO_14",
            "ID_AGE_14",
            "ID_AGE_25",
            "ID_AGE_40",
            "ID_AGE_60",
            "ELDERLY_80",
            "TEMP_EXPIRING"
        )) {
            var result = tx.execute(s -> service.residents("", "", "", 0, campaign));
            assertNotNull(result.get("total"), campaign);
        }
        var ageBand = tx.execute(s -> service.residents("", "", "", 0, "MILITARY"));
        assertTrue(ageBand.containsKey("unevaluable"));
        assertFalse(tx.execute(s -> service.residents("", "", "", 0, "")).containsKey("unevaluable"));
        assertThrows(Exception.class, () -> tx.execute(s -> service.residents("", "", "", 0, "NOT_A_CAMPAIGN")));
        assertNotNull(tx.execute(s -> service.households("120/45", 0, "", "")).get("total"));
    }

    @Test
    void missingKeyCannotSilentlyReplaceExistingSourceEncryption() throws Exception {
        stageAndApply();
        assertThrows(IllegalStateException.class, () -> new RosterCrypto(temp.resolve("missing-key").toString(), db));
    }

    @Test
    void detailedExportIncludesSnapshotsAndProtectsSpreadsheetText() throws Exception {
        stageAndApply();
        UUID resident = db.queryForObject("select id from tc2_roster.resident", UUID.class);
        var d = new HashMap<String, Object>();
        d.put("fullName", "Người mẫu");
        d.put("birthPrecision", "YEAR");
        d.put("birthYear", 1979);
        d.put("version", 0);
        d.put("reason", "=HYPERLINK(\"bad\")");
        tx.execute(s -> service.updateResident(resident, d));
        String today = java.time.LocalDate.now().toString();
        String csv = tx.execute(s -> service.detailedCsv(today, today));
        assertTrue(csv.contains("'=HYPERLINK"));
        assertFalse(csv.contains("number_ciphertext"));
        assertFalse(csv.contains("number_lookup"));
        assertTrue(tx.execute(s -> service.reportCsv(today, today)).contains("SNAPSHOT_CLOSING"));
    }

    @Test
    void manualCreationRetriesDoNotDuplicateAndReportsDistinguishBaseline() throws Exception {
        stageAndApply();
        var h = new HashMap<String, Object>();
        h.put("requestId", UUID.randomUUID().toString());
        h.put("rawAddress", "Địa chỉ nhập tay");
        h.put("reason", "Nhập mới");
        var first = tx.execute(s -> service.createHousehold(h));
        var second = tx.execute(s -> service.createHousehold(h));
        assertEquals(first.get("id"), second.get("id"));
        var d = new HashMap<String, Object>();
        d.put("requestId", UUID.randomUUID().toString());
        d.put("fullName", "Thành viên mới");
        d.put("birthPrecision", "YEAR");
        d.put("birthYear", "2001");
        d.put("reason", "Bổ sung");
        UUID household = (UUID) first.get("id");
        var person = tx.execute(s -> service.addMember(household, d));
        var retry = new HashMap<String, Object>();
        retry.put("requestId", d.get("requestId"));
        retry.put("fullName", "Thành viên mới");
        retry.put("birthPrecision", "YEAR");
        retry.put("birthYear", "2001");
        retry.put("reason", "Bổ sung");
        assertEquals(person.get("id"), tx.execute(s -> service.addMember(household, retry)).get("id"));
        var report = tx.execute(s -> service.report(java.time.LocalDate.now().toString(), java.time.LocalDate.now().toString()));
        assertEquals(2L, report.get("residentClosing"));
        assertEquals(2L, report.get("householdClosing"));
        assertTrue(
            tx
                .execute(s -> service.reportCsv(java.time.LocalDate.now().toString(), java.time.LocalDate.now().toString()))
                .contains("BASELINE_IMPORT")
        );
    }

    @Test
    void facilityDetailsAreValidatedStoredAuditedAndClearedForAPlainHousehold() throws Exception {
        stageAndApply();
        var h = new HashMap<String, Object>();
        h.put("requestId", UUID.randomUUID().toString());
        h.put("rawAddress", "12 Trưng Vương 3");
        h.put("reason", "Khảo sát");
        h.put("facilityType", "BUSINESS");
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> tx.execute(s -> service.createHousehold(h)));
        h.put("businessName", "Quán cà phê A");
        h.put("businessCategory", "Ăn uống");
        h.put("licenseType", "SECURITY_CONDITION");
        h.put("licenseNumber", "15/GCN");
        h.put("licenseExpiry", "2027-06-30");
        var created = tx.execute(s -> service.createHousehold(h));
        assertEquals("BUSINESS", created.get("type"));
        assertEquals("Quán cà phê A", created.get("business_name"));
        assertEquals("15/GCN", created.get("license_number"));
        assertEquals("2027-06-30", created.get("license_expiry"));

        UUID id = (UUID) created.get("id");
        var edit = new HashMap<String, Object>();
        edit.put("rawAddress", "12 Trưng Vương 3");
        edit.put("reason", "Đóng cửa kinh doanh");
        edit.put("version", created.get("version"));
        edit.put("facilityType", "RESIDENTIAL");
        var updated = tx.execute(s -> service.updateHousehold(id, edit));
        assertEquals("RESIDENTIAL", updated.get("type"));
        assertNull(updated.get("business_name"));
        assertNull(updated.get("license_number"));
        assertTrue(
            db
                .queryForObject(
                    "select before_data::text from tc2_roster.change_event where entity_id=? and operation='UPDATE' order by id desc limit 1",
                    String.class,
                    id
                )
                .contains("Quán cà phê A")
        );

        var invalid = new HashMap<String, Object>(edit);
        invalid.put("version", updated.get("version"));
        invalid.put("facilityType", "FACTORY");
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () ->
            tx.execute(s -> service.updateHousehold(id, invalid))
        );
    }

    @Test
    void reviewingAConflictPreservesOriginalIdentityAndLogsDecision() throws Exception {
        UUID collection = (UUID) stage(
            RosterWorkbookTest.row(2, "Người A", "1979", "001079000001") + RosterWorkbookTest.row(3, "Người B", "1980", "001079000001")
        ).get("id");
        UUID source = db.queryForObject("select id from tc2_roster.import_row where row_number=2", UUID.class);
        tx.executeWithoutResult(s ->
            service.review(source, new HashMap<>(Map.of("action", "SEPARATE", "reason", "Đối soát riêng", "identity", "")))
        );
        tx.execute(s -> service.apply(collection));
        assertEquals(1L, db.queryForObject("select count(*) from tc2_roster.review_event", Long.class));
        assertEquals(
            "001079000001",
            crypto.decrypt(db.queryForObject("select number_ciphertext from tc2_roster.resident_identity", String.class))
        );
        assertEquals(1L, db.queryForObject("select count(*) from tc2_roster.import_row where status='REVIEW'", Long.class));
    }

    @Test
    void updatesOfAddressesAndRenewalsKeepHistoricalValues() throws Exception {
        stageAndApply();
        UUID record = db.queryForObject("select id from tc2_roster.residence_record", UUID.class);
        var d = new HashMap<String, Object>();
        d.put("changeKind", "CORRECTION");
        d.put("reason", "Sửa địa chỉ");
        d.put("version", 0);
        d.put("permanentAddress", "Địa chỉ đã đối soát");
        tx.execute(s -> service.updateRecord(record, d));
        assertEquals(2L, db.queryForObject("select count(*) from tc2_roster.residence_address", Long.class));
        assertEquals(
            1L,
            db.queryForObject(
                "select count(*) from tc2_roster.change_event where entity_type='residence_record_address' and operation='DELETE'",
                Long.class
            )
        );
        d.put("version", 1);
        d.put("changeKind", "RENEWAL");
        assertThrows(Exception.class, () -> tx.execute(s -> service.updateRecord(record, d)));
    }

    @TempDir
    Path temp;

    JdbcTemplate db;
    TransactionTemplate tx;
    RosterService service;
    RbacService rbac;
    RosterCrypto crypto;

    @BeforeEach
    void setup() throws Exception {
        var ds = new DriverManagerDataSource("jdbc:postgresql://localhost:5432/tc2_roster_validation", "Monolithic", "");
        db = new JdbcTemplate(ds);
        assertEquals("tc2_roster_validation", db.queryForObject("select current_database()", String.class));
        db.execute("create table if not exists public.hamlet(id bigint primary key,code text unique,boundary_geo_json text)");
        db.update(
            "insert into public.hamlet(id,code,boundary_geo_json) values (28,'27592-TRUNGCHANH-2',?) on conflict(id) do nothing",
            "{\"type\":\"Polygon\",\"coordinates\":[[[106,10],[107,10],[107,11],[106,11],[106,10]],[[106.4,10.4],[106.6,10.4],[106.6,10.6],[106.4,10.6],[106.4,10.4]]]}"
        );
        db.execute("drop schema if exists tc2_roster cascade");
        db.execute("drop schema if exists legacy_mock_20261027 cascade");
        db.execute("drop table if exists public.resident,public.household,public.gis_building cascade");
        db.execute("alter table public.hamlet add column if not exists full_name text default 'Trung Chánh 2'");
        db.execute(
            "alter table public.hamlet add column if not exists name text default 'Trung Chánh 2', add column if not exists sort_order integer, add column if not exists commune_id bigint"
        );
        db.execute("create table if not exists public.admin_commune(id bigint primary key,name text,full_name text)");
        db.update("insert into public.admin_commune values (1,'Bà Điểm','Xã Bà Điểm') on conflict(id) do nothing");
        db.update("update public.hamlet set commune_id=1 where id=28");
        db.execute("create sequence if not exists public.sequence_generator start 10000 increment 50");
        db.execute(
            """
            create table public.household(id bigint primary key,code text not null unique,house_number text not null,
            street text not null,hamlet text not null,owner_name text not null,owner_phone text not null,type text not null,
            alley text,hamlet_id bigint references public.hamlet(id),legacy_address text,latitude double precision,
            longitude double precision,residents_count integer,male_count integer,female_count integer,
            under_18_count integer,above_18_count integer);
            create table public.resident(id bigint primary key,full_name text not null,id_card_number text unique,
            birth_year integer,gender text,relationship text,residence_type text not null,temporary_registered_at date,
            household_id bigint references public.household(id));
            create table public.gis_building(id bigint primary key,household_id bigint references public.household(id));
            insert into public.household(id,code,house_number,street,hamlet,owner_name,owner_phone,type,hamlet_id)
            values(1,'MOCK','1','Mock','Mock','Mock','Mock','RESIDENTIAL',28);
            insert into public.resident(id,full_name,residence_type,household_id) values(1,'Mock','UNVERIFIED',1);
            insert into public.gis_building values(1,1);
            """
        );
        db.execute(Files.readString(Path.of("src/main/resources/config/liquibase/sql/tc2_roster.sql")));
        String review = Files.readString(Path.of("src/main/resources/config/liquibase/changelog/20261020010000_tc2_review.xml"));
        db.execute(review.substring(review.indexOf("<![CDATA[") + 9, review.indexOf("]]></sql>")));
        String identityMigration = Files.readString(
            Path.of("src/main/resources/config/liquibase/changelog/20261020020000_tc2_identity_validity.xml")
        );
        db.execute(identityMigration.substring(identityMigration.indexOf("<![CDATA[") + 9, identityMigration.indexOf("]]></sql>")));
        String unify =
            Files.readString(unifySql()) + Files.readString(Path.of("src/main/resources/config/liquibase/sql/tc2_legacy_projections.sql"));
        new TransactionTemplate(new DataSourceTransactionManager(ds)).executeWithoutResult(s -> db.execute(unify));
        // The JHipster changelog creates these legacy columns in the real schema; the facility migration exposes them.
        db.execute(
            "alter table public.household add column if not exists business_name varchar(255), add column if not exists business_category varchar(255), add column if not exists license_type varchar(255), add column if not exists license_expiry varchar(255)"
        );
        String facility = Files.readString(Path.of("src/main/resources/config/liquibase/changelog/20261112000000_household_facility.xml"));
        db.execute(facility.substring(facility.indexOf("<sql>") + 5, facility.indexOf("</sql>")));
        tx = new TransactionTemplate(new DataSourceTransactionManager(ds));
        crypto = new RosterCrypto(temp.resolve("key").toString());
        rbac = mock(RbacService.class);
        when(rbac.current()).thenReturn(Map.of());
        when(rbac.global()).thenReturn(true);
        when(rbac.subject()).thenReturn("test-officer");
        service = new RosterService(db, new ObjectMapper(), crypto, rbac);
    }

    private Path unifySql() {
        return Path.of("src/main/resources/config/liquibase/sql/tc2_unify_core.sql");
    }

    @Test
    void unificationRemovesMockAndUsesOnlyOnePhysicalCore() throws Exception {
        assertEquals(0L, db.queryForObject("select count(*) from public.household", Long.class));
        assertEquals(1L, db.queryForObject("select count(*) from legacy_mock_20261027.household", Long.class));
        assertNull(db.queryForObject("select household_id from public.gis_building where id=1", Long.class));
        stageAndApply();
        assertEquals(1L, db.queryForObject("select count(*) from public.resident", Long.class));
        assertEquals("v", db.queryForObject("select relkind::text from pg_class where oid='tc2_roster.resident'::regclass", String.class));
        assertEquals(0L, db.queryForObject("select count(*) from public.resident where full_name='Mock'", Long.class));
        assertThrows(Exception.class, () -> tx.execute(s -> db.update("update public.resident set full_name='bypass'")));
    }

    @Test
    void splittingAHouseholdMovesMembersKeepsHistoryAndIsIdempotent() throws Exception {
        stageAndApply();
        UUID source = db.queryForObject("select household_id from tc2_roster.household_membership", UUID.class);
        UUID membership = db.queryForObject("select id from tc2_roster.household_membership", UUID.class);
        var split = new HashMap<String, Object>(
            Map.of(
                "requestId",
                UUID.randomUUID().toString(),
                "rawAddress",
                "Hộ tách mới",
                "reason",
                "Con lập gia đình",
                "effectiveDate",
                java.time.LocalDate.now().toString(),
                "headMembershipId",
                membership.toString(),
                "members",
                List.of(Map.of("membershipId", membership.toString(), "version", 0))
            )
        );
        var created = tx.execute(s -> service.splitHousehold(source, split));
        var retry = tx.execute(s -> service.splitHousehold(source, new HashMap<>(split)));
        assertEquals(created.get("id"), retry.get("id"));
        assertEquals(2L, db.queryForObject("select count(*) from tc2_roster.household", Long.class));
        assertEquals(2L, db.queryForObject("select count(*) from tc2_roster.household_membership", Long.class));
        assertEquals(
            1L,
            db.queryForObject(
                "select count(*) from tc2_roster.household_membership where household_id=? and valid_to is null and is_head",
                Long.class,
                created.get("id")
            )
        );
        assertEquals(
            0L,
            db.queryForObject(
                "select count(*) from tc2_roster.household_membership where household_id=? and valid_to is null",
                Long.class,
                source
            )
        );
        var empty = new HashMap<String, Object>(split);
        empty.put("requestId", UUID.randomUUID().toString());
        empty.put("members", List.of());
        assertThrows(Exception.class, () -> tx.execute(s -> service.splitHousehold(source, empty)));
    }

    @Test
    void independentPeopleAndAtomicTransferKeepSourceAndHistory() throws Exception {
        stageAndApply();
        UUID person = db.queryForObject("select id from tc2_roster.resident", UUID.class);
        UUID membership = db.queryForObject("select id from tc2_roster.household_membership", UUID.class);
        var target = tx.execute(s ->
            service.createHousehold(
                new HashMap<>(Map.of("requestId", UUID.randomUUID().toString(), "rawAddress", "Hộ đích", "reason", "Bổ sung hộ"))
            )
        );
        var move = new HashMap<String, Object>(
            Map.of(
                "requestId",
                UUID.randomUUID().toString(),
                "householdId",
                target.get("id").toString(),
                "version",
                0,
                "effectiveDate",
                java.time.LocalDate.now().toString(),
                "reason",
                "Chuyển hộ đã đối chiếu"
            )
        );
        tx.execute(s -> service.transferMember(membership, move));
        tx.execute(s -> service.transferMember(membership, new HashMap<>(move)));
        assertEquals(
            1L,
            db.queryForObject(
                "select count(*) from tc2_roster.household_membership where resident_id=? and valid_to is null",
                Long.class,
                person
            )
        );
        assertEquals(2L, db.queryForObject("select count(*) from tc2_roster.household_membership where resident_id=?", Long.class, person));
        assertEquals(1L, db.queryForObject("select count(*) from tc2_roster.source_link", Long.class));
        assertEquals(1L, tx.execute(s -> service.residents("", "PERMANENT", "EXCEL", 0)).get("total"));
        assertFalse(tx.execute(s -> service.entityHistory("resident", person, 0)).isEmpty());
        assertTrue(
            tx
                .execute(s -> service.entityHistory("resident", person, 0))
                .stream()
                .noneMatch(e -> e.toString().contains("number_ciphertext"))
        );
        var badMove = new HashMap<>(move);
        badMove.put("requestId", UUID.randomUUID().toString());
        assertThrows(Exception.class, () -> tx.execute(s -> service.transferMember(membership, badMove)));
        var d = new HashMap<String, Object>(
            Map.of(
                "requestId",
                UUID.randomUUID().toString(),
                "fullName",
                "Người chưa gắn hộ",
                "birthPrecision",
                "UNKNOWN",
                "reason",
                "Bổ sung nhân khẩu"
            )
        );
        var independent = tx.execute(s -> service.createResident(d));
        assertEquals(independent.get("id"), tx.execute(s -> service.createResident(new HashMap<>(d))).get("id"));
        assertEquals(1L, tx.execute(s -> service.residents("", "", "MANUAL", 0)).get("total"));
    }

    @Test
    void residentDetailMasksIdentitiesAndRevealIsAudited() throws Exception {
        stageAndApply();
        UUID person = db.queryForObject("select id from tc2_roster.resident", UUID.class);
        var detail = tx.execute(s -> service.resident(person));
        assertFalse(detail.toString().contains("001079000001"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> identities = (List<Map<String, Object>>) detail.get("identities");
        assertEquals("001••••••001", identities.getFirst().get("number"));
        verify(rbac).audit(eq("read"), eq("roster-resident:" + person), any());
        UUID identity = db.queryForObject("select id from tc2_roster.resident_identity", UUID.class);
        var revealed = tx.execute(s -> service.revealIdentity(person, identity));
        assertEquals("001079000001", revealed.get("number"));
        verify(rbac).audit(eq("identity-revealed"), eq("roster-resident:" + person + "/identity:" + identity), any());
    }

    private Map<String, Object> stage(String rows) throws Exception {
        byte[] bytes = RosterWorkbookTest.workbook(rows);
        return tx.execute(s -> service.stage(List.of(new RosterService.Upload("source63.xlsx", "63", bytes)), "Test source", null));
    }

    private Map<String, String> filter(String... pairs) {
        var p = new HashMap<String, String>();
        for (int i = 0; i < pairs.length; i += 2) p.put(pairs[i], pairs[i + 1]);
        return p;
    }

    @Test
    void residentExportFiltersMasksAuditsAndWritesAPrintableWorkbook() throws Exception {
        UUID id = (UUID) stage(
            RosterWorkbookTest.row(2, "Nguyễn Văn An", "15/03/2000", "079200000101") +
                RosterWorkbookTest.row(3, "Trần Thị Bình", "1990", "079190000202") +
                RosterWorkbookTest.row(4, "Lê Văn Cường", "01/01/1940", "079140000303")
        ).get("id");
        tx.execute(s -> service.apply(id));
        assertEquals(3L, db.queryForObject("select count(*) from tc2_roster.resident", Long.class));
        var binh = db.queryForMap("select id,version from tc2_roster.resident where full_name='Trần Thị Bình'");
        var female = new HashMap<String, Object>();
        female.put("fullName", "Trần Thị Bình");
        female.put("birthPrecision", "YEAR");
        female.put("birthYear", 1990);
        female.put("gender", "FEMALE");
        female.put("version", binh.get("version"));
        female.put("reason", "Đối chiếu giới tính");
        tx.execute(s -> service.updateResident((UUID) binh.get("id"), female));
        when(rbac.current()).thenReturn(Map.of("fullName", "Cán bộ thử", "role", "superadmin"));
        var export = new ResidentExportService(db, service, crypto, rbac);
        var ro = new TransactionTemplate(tx.getTransactionManager());
        ro.setReadOnly(true);

        // Nam 18–30 tuổi tính tại một ngày cố định: chỉ An (26 tuổi).
        var military = ro.execute(s ->
            export.preview(ResidentFilter.parse(filter("gender", "MALE", "ageMin", "18", "ageMax", "30", "refDate", "2026-11-13")), "")
        );
        assertEquals(1L, military.total());
        assertEquals("Nguyễn Văn An", military.rows().getFirst().get(1));
        assertEquals(
            "*********101",
            military.rows().getFirst().get(military.columns().stream().map(ResidentExportService.Column::key).toList().indexOf("identity"))
        );
        assertEquals(0L, military.unevaluable());
        // Không lọc giới tính: Bình chỉ có năm sinh nên được báo là không xác định được tuổi thay vì bị bỏ qua.
        var adults = ro.execute(s -> export.preview(ResidentFilter.parse(filter("ageMin", "18", "refDate", "2026-11-13")), ""));
        assertEquals(2L, adults.total());
        assertEquals(1L, adults.unevaluable());
        assertEquals(
            1L,
            ro.execute(s -> export.preview(ResidentFilter.parse(filter("birthYearFrom", "1990", "birthYearTo", "1990")), "")).total()
        );
        assertEquals(1L, ro.execute(s -> export.preview(ResidentFilter.parse(filter("gender", "FEMALE")), "")).female());
        assertEquals(3L, ro.execute(s -> export.preview(ResidentFilter.parse(filter("address", "Địa chỉ thử")), "")).total());
        assertEquals(0L, ro.execute(s -> export.preview(ResidentFilter.parse(filter("facilityTypes", "BOARDING_HOUSE")), "")).total());
        for (String role : List.of("HEAD", "MEMBER", "NONE"))
            assertNotNull(
                ro.execute(s ->
                    export.preview(
                        ResidentFilter.parse(filter("householdRole", role, "status", "ACTIVE", "kinds", "PERMANENT,TEMPORARY")),
                        ""
                    )
                )
            );
        // Sắp xếp theo tên (chữ cuối): An, Bình, Cường.
        var byName = ro.execute(s -> export.preview(ResidentFilter.parse(filter("sort", "NAME")), "fullName"));
        assertEquals(
            List.of("Nguyễn Văn An", "Trần Thị Bình", "Lê Văn Cường"),
            byName
                .rows()
                .stream()
                .map(r -> r.get(1))
                .toList()
        );
        verify(rbac, never()).auditIndependent(eq("resident-list-exported"), anyString(), any());

        // Bản in có đủ số chỉ khi xin và có quyền; mỗi lần xuất đều ghi nhật ký, lộ số đầy đủ thì ghi thêm identity-revealed.
        var printed = ro.execute(s -> export.print(ResidentFilter.parse(filter()), "fullName,identity", true));
        assertTrue(printed.fullIdentity());
        assertTrue(
            printed
                .rows()
                .stream()
                .anyMatch(r -> r.get(2).equals("079200000101"))
        );
        verify(rbac).auditIndependent(eq("resident-list-exported"), eq("roster-hamlets:28"), any());
        verify(rbac).auditIndependent(eq("identity-revealed"), eq("roster-hamlets:28"), any());
        doThrow(new org.springframework.security.access.AccessDeniedException("no")).when(rbac).permission("canRevealIdentity");
        assertThrows(Exception.class, () -> ro.execute(s -> export.print(ResidentFilter.parse(filter()), "fullName,identity", true)));

        var file = ro.execute(s -> export.xlsx(ResidentFilter.parse(filter("kinds", "PERMANENT")), "", false));
        assertTrue(file.name().startsWith("danh-sach-nhan-khau-trung-chanh-2-"));
        try (var book = new org.apache.poi.xssf.usermodel.XSSFWorkbook(new java.io.ByteArrayInputStream(file.content()))) {
            var sheet = book.getSheet("Danh sách");
            assertEquals("CÔNG AN XÃ BÀ ĐIỂM", sheet.getRow(0).getCell(0).getStringCellValue());
            assertEquals("DANH SÁCH NHÂN KHẨU", sheet.getRow(3).getCell(0).getStringCellValue());
            assertEquals("STT", sheet.getRow(8).getCell(0).getStringCellValue());
            assertEquals("Họ và tên", sheet.getRow(8).getCell(1).getStringCellValue());
            long people = db.queryForObject(
                "select count(distinct resident_id) from tc2_roster.residence_record where record_kind='PERMANENT'",
                Long.class
            );
            assertEquals(
                String.valueOf(people),
                sheet
                    .getRow(8 + (int) people)
                    .getCell(0)
                    .getStringCellValue()
            );
            assertTrue(sheet.getPrintSetup().getLandscape());
            assertEquals(org.apache.poi.ss.usermodel.PrintSetup.A4_PAPERSIZE, sheet.getPrintSetup().getPaperSize());
            assertTrue(
                sheet
                    .getRow(8 + 1)
                    .getCell(4)
                    .getStringCellValue()
                    .startsWith("*********")
            );
            assertNotNull(book.getSheet("Tổng hợp"));
        }

        // Gửi qua ứng dụng chia sẻ được ghi nhật ký riêng với tải về.
        ro.execute(s -> export.xlsx(ResidentFilter.parse(filter()), "fullName", false, true));
        verify(rbac).auditIndependent(
            eq("resident-list-exported"),
            eq("roster-hamlets:28"),
            argThat(d -> "xlsx-share".equals(((Map<?, ?>) d).get("format")))
        );

        // Toàn xã: chỉ trưởng công an xã (hoặc super admin), và chỉ các ấp được giao.
        when(rbac.global()).thenReturn(false);
        when(rbac.current()).thenReturn(Map.of("fullName", "Quản lý ấp", "role", "sub-admin"));
        assertThrows(Exception.class, () -> ro.execute(s -> export.preview(ResidentFilter.parse(filter("scope", "commune")), "")));
        when(rbac.current()).thenReturn(Map.of("fullName", "Trưởng công an xã", "role", "admin"));
        when(rbac.areas()).thenReturn(List.of(28L));
        var commune = ro.execute(s -> export.preview(ResidentFilter.parse(filter("scope", "commune")), ""));
        assertEquals(3L, commune.total());
        assertEquals("Toàn xã Bà Điểm (1 ấp)", commune.scope());
        verify(rbac, atLeastOnce()).area(28L);
    }

    private UUID stageAndApply() throws Exception {
        UUID id = (UUID) stage(RosterWorkbookTest.row(2, "Người mẫu", "1979", "001079000001")).get("id");
        tx.execute(s -> service.apply(id));
        return id;
    }

    @Test
    void importIsEncryptedIdempotentAndKeepsSourceHistory() throws Exception {
        UUID collection = stageAndApply();
        tx.execute(s -> service.apply(collection));
        assertEquals(1L, db.queryForObject("select count(*) from tc2_roster.resident", Long.class));
        assertEquals(1L, db.queryForObject("select count(*) from tc2_roster.source_link", Long.class));
        String encrypted = db.queryForObject("select number_ciphertext from tc2_roster.resident_identity", String.class);
        assertFalse(encrypted.contains("001079000001"));
        assertEquals("001079000001", crypto.decrypt(encrypted));
        assertTrue(db.queryForObject("select count(*) from tc2_roster.change_event where change_kind='BASELINE_IMPORT'", Long.class) > 0);
        assertThrows(Exception.class, () -> tx.execute(s -> db.update("update tc2_roster.import_row set raw_ciphertext='changed'")));
        assertThrows(Exception.class, () -> tx.execute(s -> db.update("delete from tc2_roster.change_event")));
        var point = db.queryForMap("select latitude,longitude from tc2_roster.household");
        double lat = ((Number) point.get("latitude")).doubleValue(),
            lng = ((Number) point.get("longitude")).doubleValue();
        assertTrue(lat > 10 && lat < 11 && lng > 106 && lng < 107);
        assertFalse(lat > 10.4 && lat < 10.6 && lng > 106.4 && lng < 106.6);
    }

    @Test
    void conflictsRemainInReviewWithoutInventingPeople() throws Exception {
        UUID id = (UUID) stage(
            RosterWorkbookTest.row(2, "Người A", "1979", "001079000001") + RosterWorkbookTest.row(3, "Người B", "1980", "001079000001")
        ).get("id");
        tx.execute(s -> service.apply(id));
        assertEquals(2L, db.queryForObject("select count(*) from tc2_roster.import_row where status='REVIEW'", Long.class));
        assertEquals(0L, db.queryForObject("select count(*) from tc2_roster.resident", Long.class));
    }

    @Test
    void correctionRequiresVersionAndAuditAndPreservesBaseline() throws Exception {
        stageAndApply();
        UUID id = db.queryForObject("select id from tc2_roster.resident", UUID.class);
        var d = new HashMap<String, Object>();
        d.put("fullName", "Người mẫu đã sửa");
        d.put("birthPrecision", "YEAR");
        d.put("birthYear", 1979);
        d.put("version", 0);
        d.put("reason", "Đối soát tài liệu");
        tx.execute(s -> service.updateResident(id, d));
        assertEquals(1L, db.queryForObject("select version from tc2_roster.resident", Long.class));
        assertThrows(Exception.class, () -> tx.execute(s -> service.updateResident(id, d)));
        assertEquals(
            1L,
            db.queryForObject(
                "select count(*) from tc2_roster.change_event where entity_type='resident' and change_kind='CORRECTION'",
                Long.class
            )
        );
        assertThrows(Exception.class, () -> tx.execute(s -> db.update("update tc2_roster.resident set full_name='bypass' where id=?", id)));
    }

    @Test
    void permissionsAndStreetAssignmentsFailClosed() {
        when(rbac.global()).thenReturn(false);
        when(rbac.current()).thenReturn(Map.of("assignedStreets", List.of("Restricted street")));
        assertThrows(org.springframework.security.access.AccessDeniedException.class, () -> service.households("", 0));
        doThrow(new org.springframework.security.access.AccessDeniedException("outside")).when(rbac).area(28L);
        assertThrows(org.springframework.security.access.AccessDeniedException.class, () -> service.overview());
    }

    @Test
    void failureRollsBackAllEntities() throws Exception {
        UUID id = (UUID) stage(RosterWorkbookTest.row(2, "Người mẫu", "1979", "001079000001")).get("id");
        assertThrows(IllegalStateException.class, () ->
            tx.execute(s -> {
                service.apply(id);
                throw new IllegalStateException("simulate failure");
            })
        );
        assertEquals(0L, db.queryForObject("select count(*) from tc2_roster.resident", Long.class));
        assertEquals(0L, db.queryForObject("select count(*) from tc2_roster.change_event", Long.class));
        assertEquals(1L, db.queryForObject("select count(*) from tc2_roster.import_row where status='READY'", Long.class));
    }
}
