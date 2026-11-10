package com.policemanagement.com.web.rest;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.policemanagement.com.domain.Household;
import com.policemanagement.com.repository.HouseholdRepository;
import com.policemanagement.com.service.dto.HouseholdDTO;
import com.policemanagement.com.service.mapper.HouseholdMapper;
import com.policemanagement.com.service.rbac.RbacService;
import java.util.*;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.web.server.ResponseStatusException;

class HouseholdBrowseResourceTest {

    private JdbcTemplate db;
    private RbacService rbac;
    private HouseholdBrowseResource resource;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setup() {
        db = new JdbcTemplate(
            new DriverManagerDataSource(
                "jdbc:h2:mem:browse" + UUID.randomUUID() + ";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
                "sa",
                ""
            )
        );
        db.execute(
            "create table household(id bigint primary key, hamlet_id bigint,hamlet varchar,street varchar,alley varchar,type varchar,status varchar,notes varchar,owner_name varchar,house_number varchar,code varchar,owner_phone varchar,business_name varchar,business_category varchar)"
        );
        db.execute(
            "create table resident(id bigint,household_id bigint,residence_type varchar,full_name varchar,id_card_number varchar,gender varchar,birth_year int)"
        );
        for (String column : List.of("residents_count", "male_count", "female_count", "under_18_count"))
            db.execute("alter table household add " + column + " int");
        db.execute("alter table household add roster_id bigint generated always as (id)");
        db.execute("alter table resident add roster_id bigint generated always as (id)");
        db.execute("alter table resident add birth_date date");
        db.execute("alter table resident add birth_date_precision varchar default 'UNKNOWN'");
        db.execute("create schema tc2_roster");
        db.execute("create table tc2_roster.household_membership(resident_id bigint,household_id bigint,valid_to date)");
        db.execute("create table tc2_roster.residence_record(household_id bigint,record_kind varchar)");
        rbac = mock(RbacService.class);
        when(rbac.current()).thenReturn(Map.of());
        when(rbac.global()).thenReturn(true);
        var repository = mock(HouseholdRepository.class);
        var mapper = mock(HouseholdMapper.class);
        when(repository.findAllById(any())).thenAnswer(call ->
            StreamSupport.stream(((Iterable<Long>) call.getArgument(0)).spliterator(), false)
                .map(id -> new Household().id(id))
                .toList()
        );
        when(mapper.toDto(any(Household.class))).thenAnswer(call -> {
            var dto = new HouseholdDTO();
            dto.setId(((Household) call.getArgument(0)).getId());
            return dto;
        });
        resource = new HouseholdBrowseResource(new NamedParameterJdbcTemplate(db), rbac, repository, mapper);
    }

    private void add(long id, long hamlet, String street) {
        db.update(
            "insert into household(id,hamlet_id,hamlet,street,type,owner_name,notes) values (?,?,?,?,'RESIDENTIAL','Nguyễn Văn An','')",
            id,
            hamlet,
            "Area " + hamlet,
            street
        );
    }

    private Map<String, Object> page(int page, int size, String search, String residence) {
        syncFixtures();
        return resource.browse(page, size, search, "all", "all", residence);
    }

    private void syncFixtures() {
        db.execute("delete from tc2_roster.household_membership");
        db.execute("delete from tc2_roster.residence_record");
        db.execute("insert into tc2_roster.household_membership select id,household_id,null from resident where household_id is not null");
        db.execute(
            "insert into tc2_roster.residence_record select household_id,residence_type from resident where household_id is not null"
        );
    }

    private Map<String, Object> overview(String search, int page, int size) {
        syncFixtures();
        return resource.overview(search, page, size);
    }

    @Test
    void emptyAndOutOfRangePagesAreClamped() {
        var result = page(30, 12, "", "all");
        assertEquals(0L, result.get("total"));
        assertEquals(0, result.get("page"));
        assertEquals(List.of(), result.get("items"));
    }

    @ParameterizedTest
    @ValueSource(ints = { 0, 500, 501 })
    @SuppressWarnings("unchecked")
    void traversesAllPagesWithoutLosingOrDuplicatingHouseholds(int count) {
        for (int i = 1; i <= count; i++) add(i, 28, "Allowed");
        var seen = new HashSet<Long>();
        for (int index = 0; index < Math.max(1, (count + 95) / 96); index++) {
            var result = page(index, 96, "", "all");
            assertEquals((long) count, result.get("total"));
            for (var item : (List<Map<String, Object>>) result.get("items"))
                assertTrue(seen.add(((HouseholdDTO) item.get("household")).getId()));
        }
        assertEquals(count, seen.size());
    }

    @Test
    @SuppressWarnings("unchecked")
    void pagesAndFacetsCannotEscapeHamletAndStreetScope() {
        for (int i = 1; i <= 501; i++) add(i, 28, "Allowed");
        add(502, 29, "Allowed");
        add(503, 28, "Foreign street");
        when(rbac.global()).thenReturn(false);
        when(rbac.areas()).thenReturn(List.of(28L));
        when(rbac.current()).thenReturn(Map.of("assignedStreets", List.of("Allowed")));
        var first = page(0, 96, "", "all");
        assertEquals(501L, first.get("total"));
        assertEquals(501L, first.get("scopeTotal"));
        assertEquals(96, ((List<?>) first.get("items")).size());
        var last = page(99, 96, "", "all");
        assertEquals(5, last.get("page"));
        assertEquals(21, ((List<?>) last.get("items")).size());
        assertEquals(Map.of("Area 28", 501L), last.get("hamlets"));
        var item = (Map<String, Object>) ((List<?>) last.get("items")).getFirst();
        assertEquals(481L, ((HouseholdDTO) item.get("household")).getId());
    }

    @Test
    void zeroAssignmentsCannotReadFacetsOrRows() {
        add(1, 28, "Allowed");
        when(rbac.global()).thenReturn(false);
        when(rbac.areas()).thenReturn(List.of());
        assertEquals(0L, page(0, 12, "", "all").get("scopeTotal"));
        assertEquals(Map.of(), page(0, 12, "", "all").get("hamlets"));
    }

    @Test
    void searchAndResidenceAreEvaluatedBeforePagingIncludingResidentNames() {
        add(1, 28, "Allowed");
        add(2, 28, "Allowed");
        db.update(
            "insert into resident(id,household_id,residence_type,full_name,id_card_number,gender,birth_year) values(1,2,'TEMPORARY','Trần Thị Bình','TEST-ID','FEMALE',2015)"
        );
        assertEquals(2L, page(0, 12, "NGUYEN", "all").get("total"));
        assertEquals(1L, page(0, 12, "tran thi binh", "temporary").get("total"));
        assertEquals(0L, page(0, 12, "%", "all").get("total"));
        assertEquals(0L, page(0, 12, "' OR 1=1 --", "all").get("total"));
    }

    @Test
    void rejectsUnboundedOrInvalidPaging() {
        assertThrows(ResponseStatusException.class, () -> page(0, 500, "", "all"));
        assertThrows(ResponseStatusException.class, () -> page(-1, 12, "", "all"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void overviewCountsOnlyLinkedPeopleAndDoesNotInventDemographics() {
        add(1, 28, "Allowed");
        add(2, 28, "Allowed");
        db.update("update household set residents_count=99,male_count=99 where id=1");
        db.update(
            "update household set residents_count=4,male_count=2,female_count=2,under_18_count=2,status='WARNING',type='BUSINESS' where id=2"
        );
        db.update(
            "insert into resident(id,household_id,residence_type,full_name,id_card_number,gender,birth_year) values(1,1,'PERMANENT','A','ID','FEMALE',?)",
            java.time.LocalDate.now().getYear() - 5
        );
        db.update(
            "insert into resident(id,household_id,residence_type,full_name,id_card_number,gender,birth_year) values(2,1,'PERMANENT','B','ID',null,null)"
        );
        var result = overview("", 0, 10);
        assertEquals(2L, ((Number) result.get("total")).longValue());
        assertEquals(1L, ((Number) result.get("business")).longValue());
        assertEquals(1L, result.get("warnings"));
        assertEquals(2L, result.get("residents"));
        assertEquals(1L, result.get("female"));
        assertEquals(0L, result.get("male"));
        assertEquals(1L, result.get("unknownGender"));
        assertEquals(2L, result.get("unknownAge"));
        assertEquals(0L, result.get("fallbackHouseholds"));
        assertEquals(2L, ((Number) ((Map<?, ?>) result.get("scope")).get("residents")).longValue());
        assertEquals(2, ((List<?>) result.get("previewItems")).size());
        assertEquals(1, ((List<?>) result.get("warningItems")).size());
    }

    @Test
    @SuppressWarnings("unchecked")
    void overviewSearchAndWarningPaginationRespectScopeAndBoundPayload() {
        for (int i = 1; i <= 51; i++) add(i, 28, "Allowed");
        add(52, 29, "Allowed");
        add(53, 28, "Other");
        db.update("update household set status='WARNING'");
        when(rbac.global()).thenReturn(false);
        when(rbac.areas()).thenReturn(List.of(28L));
        when(rbac.current()).thenReturn(Map.of("assignedStreets", List.of("Allowed")));
        var result = overview("", 999, 20);
        assertEquals(51L, ((Number) result.get("total")).longValue());
        assertEquals(51L, result.get("warnings"));
        assertEquals(2, result.get("warningPage"));
        assertEquals(11, ((List<?>) result.get("warningItems")).size());
        assertEquals(16, ((List<?>) result.get("previewItems")).size());
        assertEquals(5, ((List<?>) result.get("attentionItems")).size());
        var missing = overview("unmatched", 0, 10);
        assertEquals(0L, ((Number) missing.get("total")).longValue());
        assertEquals(51L, ((Number) ((Map<?, ?>) missing.get("scope")).get("total")).longValue());
        when(rbac.areas()).thenReturn(List.of());
        assertEquals(0L, overview("", 0, 10).get("residents"));
        assertEquals(List.of(), overview("", 0, 10).get("hamlets"));
    }

    @Test
    void overviewRejectsInvalidQueries() {
        assertThrows(ResponseStatusException.class, () -> overview("", -1, 10));
        assertThrows(ResponseStatusException.class, () -> overview("", 0, 500));
        assertThrows(ResponseStatusException.class, () -> overview("x".repeat(201), 0, 10));
    }

    @Test
    void overviewSearchKeepsMapperDefaultsAndResidentNameMatches() {
        add(1, 28, "Allowed");
        add(2, 28, "Allowed");
        db.update("update household set owner_name=null where id=1");
        db.update(
            "insert into resident(id,household_id,residence_type,full_name,id_card_number,gender,birth_year) values(1,2,'PERMANENT','Trần Thị Bình','ID','FEMALE',2015)"
        );
        assertEquals(1L, ((Number) overview("chua cap nhat", 0, 10).get("total")).longValue());
        assertEquals(1L, ((Number) overview("hk-bd-001", 0, 10).get("total")).longValue());
        assertEquals(1L, ((Number) overview("tran thi binh", 0, 10).get("total")).longValue());
        assertEquals(1L, overview("tran thi binh", 0, 10).get("residents"));
    }
}
