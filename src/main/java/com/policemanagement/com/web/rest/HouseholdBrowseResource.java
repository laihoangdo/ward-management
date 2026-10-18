package com.policemanagement.com.web.rest;

import com.policemanagement.com.repository.HouseholdRepository;
import com.policemanagement.com.service.mapper.HouseholdMapper;
import com.policemanagement.com.service.rbac.RbacService;
import java.text.Normalizer;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.transaction.annotation.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/** Bounded list payload; all counts, filters and search use the same server scope. */
@RestController
@RequestMapping("/api/gis/households")
public class HouseholdBrowseResource {

    private final NamedParameterJdbcTemplate db;
    private final RbacService rbac;
    private final HouseholdRepository repository;
    private final HouseholdMapper mapper;

    public HouseholdBrowseResource(
        NamedParameterJdbcTemplate db,
        RbacService rbac,
        HouseholdRepository repository,
        HouseholdMapper mapper
    ) {
        this.db = db;
        this.rbac = rbac;
        this.repository = repository;
        this.mapper = mapper;
    }

    private static final String RESIDENCE = """
    case when exists(select 1 from resident r where r.household_id=h.id and r.residence_type='STAY') then 'stay'
    when exists(select 1 from resident r where r.household_id=h.id and r.residence_type='TEMPORARY') then 'temporary'
    when exists(select 1 from resident r where r.household_id=h.id) then 'permanent'
    when lower(coalesce(h.notes,'')) like '%lưu trú%' or lower(coalesce(h.notes,'')) like '%khách sạn%' or lower(coalesce(h.notes,'')) like '%nhà nghỉ%' then 'stay'
    when lower(coalesce(h.notes,'')) like '%tạm trú%' or lower(coalesce(h.notes,'')) like '%thuê trọ%' or lower(coalesce(h.notes,'')) like '%phòng trọ%' or lower(coalesce(h.notes,'')) like '%công nhân%' then 'temporary'
    else 'permanent' end
    """;

    static String folded(String expression) {
        return (
            "translate(lower(coalesce(" +
            expression +
            ",'')), 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ', 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd')"
        );
    }

    @GetMapping("/browse")
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Map<String, Object> browse(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "12") int size,
        @RequestParam(defaultValue = "") String search,
        @RequestParam(defaultValue = "all") String hamlet,
        @RequestParam(defaultValue = "all") String type,
        @RequestParam(defaultValue = "all") String residence
    ) {
        rbac.current();
        if (
            page < 0 ||
            size < 1 ||
            size > 100 ||
            search.length() > 200 ||
            hamlet.length() > 255 ||
            !Set.of("all", "household", "business", "special_monitoring").contains(type) ||
            !Set.of("all", "permanent", "temporary", "stay").contains(residence)
        ) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        var query = query(search, hamlet, type, residence);
        var params = query.params();
        String base = query.base();
        String filter = query.filter();
        var facets = db.queryForList(
            base + "select browse_hamlet, browse_residence, count(*) as amount from scoped group by browse_hamlet,browse_residence",
            params
        );
        var hamlets = new TreeMap<String, Long>();
        var residences = new HashMap<String, Long>();
        long scopeTotal = 0;
        for (var row : facets) {
            long count = ((Number) row.get("amount")).longValue();
            scopeTotal += count;
            String name = (String) row.get("browse_hamlet");
            if (!name.isBlank()) hamlets.merge(name, count, Long::sum);
            residences.merge((String) row.get("browse_residence"), count, Long::sum);
        }
        long total = db.queryForObject(base + "select count(*) from scoped h where " + filter, params, Long.class);
        int safePage = (int) Math.min(page, Math.max(0, (total - 1) / size));
        params.put("limit", size);
        params.put("offset", (long) safePage * size);
        var rows = db.queryForList(
            base + "select h.id,h.browse_residence from scoped h where " + filter + " order by h.id limit :limit offset :offset",
            params
        );
        var ids = rows
            .stream()
            .map(row -> ((Number) row.get("id")).longValue())
            .toList();
        var entities = new HashMap<Long, com.policemanagement.com.service.dto.HouseholdDTO>();
        if (!ids.isEmpty()) repository.findAllById(ids).forEach(entity -> entities.put(entity.getId(), mapper.toDto(entity)));
        if (!ids.isEmpty()) {
            params.put("pageIds", ids);
            var counts = db.queryForList(
                "select household_id, count(*) as amount, sum(case when gender='FEMALE' then 1 else 0 end) as females, sum(case when 2026-coalesce(birth_year,1990)<18 then 1 else 0 end) as minors from resident where household_id in (:pageIds) group by household_id",
                params
            );
            for (var row : counts) {
                var dto = entities.get(((Number) row.get("household_id")).longValue());
                if (dto == null) continue;
                int count = ((Number) row.get("amount")).intValue(),
                    female = ((Number) row.get("females")).intValue(),
                    minor = ((Number) row.get("minors")).intValue();
                dto.setResidentsCount(count);
                dto.setFemaleCount(female);
                dto.setMaleCount(count - female);
                dto.setUnder18Count(minor);
                dto.setAbove18Count(count - minor);
            }
        }
        var items = new ArrayList<Map<String, Object>>();
        for (var row : rows) {
            long id = ((Number) row.get("id")).longValue();
            var dto = entities.get(id);
            if (dto != null) items.add(Map.of("household", dto, "residence", row.get("browse_residence")));
        }
        return Map.of(
            "items",
            items,
            "total",
            total,
            "page",
            safePage,
            "size",
            size,
            "scopeTotal",
            scopeTotal,
            "hamlets",
            hamlets,
            "residenceCounts",
            residences
        );
    }

    private record BrowseQuery(String base, String filter, HashMap<String, Object> params) {}

    @GetMapping("/overview")
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Map<String, Object> overview(
        @RequestParam(defaultValue = "") String search,
        @RequestParam(defaultValue = "0") int warningPage,
        @RequestParam(defaultValue = "10") int warningSize
    ) {
        rbac.current();
        if (search.length() > 200 || warningPage < 0 || !Set.of(10, 20, 50).contains(warningSize)) throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST
        );
        var query = query(search, "all", "all", "all");
        var params = query.params();
        String base = query.base();
        String selected = " from scoped h where " + query.filter();
        var metrics = db.queryForMap(
            base +
                "select count(*) as total, coalesce(sum(case when h.browse_type='business' then 1 else 0 end),0) as business, coalesce(sum(case when h.status='WARNING' then 1 else 0 end),0) as warnings" +
                selected,
            params
        );
        int year = java.time.LocalDate.now().getYear();
        params.put("year", year);
        var population = db.queryForMap(
            base +
                "select count(*) as residents, coalesce(sum(case when r.gender='FEMALE' then 1 else 0 end),0) as female, coalesce(sum(case when :year-coalesce(nullif(r.birth_year,0),1990)<18 then 1 else 0 end),0) as minors from resident r join scoped h on h.id=r.household_id where " +
                query.filter(),
            params
        );
        long residents = ((Number) population.get("residents")).longValue();
        long female = ((Number) population.get("female")).longValue();
        long minors = ((Number) population.get("minors")).longValue();
        long fallbackHouseholds = 0;
        var legacy = db.queryForList(
            base +
                "select h.residents_count,h.male_count,h.female_count,h.under_18_count,h.owner_name,h.house_number" +
                selected +
                " and not exists(select 1 from resident r where r.household_id=h.id)",
            params
        );
        for (var row : legacy) {
            var counts = com.policemanagement.com.service.OverviewDemographics.fallback(row, year);
            residents += counts.residents();
            female += counts.female();
            minors += counts.under18();
            fallbackHouseholds++;
        }
        var hamlets = db.queryForList(
            base + "select h.browse_hamlet" + selected + " and h.browse_hamlet<>'' group by h.browse_hamlet order by min(h.id)",
            params,
            String.class
        );
        // Header territory totals remain independent of the overview search.
        var scope = db.queryForMap(
            base +
                "select count(*) as total, coalesce(sum(coalesce(p.amount,nullif(h.residents_count,0),1)),0) as residents, coalesce(sum(case when h.status='WARNING' then 1 else 0 end),0) as warnings from scoped h left join (select r.household_id,count(*) as amount from resident r join scoped s on s.id=r.household_id group by r.household_id) p on p.household_id=h.id",
            params
        );
        long warnings = ((Number) metrics.get("warnings")).longValue();
        int safePage = (int) Math.min(warningPage, Math.max(0, (warnings - 1) / warningSize));
        var result = new HashMap<String, Object>();
        result.put("total", metrics.get("total"));
        result.put("business", metrics.get("business"));
        result.put("warnings", warnings);
        result.put("residents", residents);
        result.put("female", female);
        result.put("male", residents - female);
        result.put("under18", minors);
        result.put("above18", Math.max(0, residents - minors));
        result.put("fallbackHouseholds", fallbackHouseholds);
        result.put("hamlets", hamlets);
        result.put("scope", scope);
        result.put("warningPage", safePage);
        result.put("warningItems", overviewItems(query, " and h.status='WARNING'", warningSize, (long) safePage * warningSize));
        result.put("attentionItems", overviewItems(query, " and h.status='WARNING'", 5, 0));
        result.put("previewItems", overviewItems(query, "", 16, 0));
        return result;
    }

    private List<com.policemanagement.com.service.dto.HouseholdDTO> overviewItems(BrowseQuery query, String extra, int limit, long offset) {
        var params = new HashMap<>(query.params());
        params.put("limit", limit);
        params.put("offset", offset);
        var ids = db.queryForList(
            query.base() + "select h.id from scoped h where " + query.filter() + extra + " order by h.id limit :limit offset :offset",
            params,
            Long.class
        );
        var items = new HashMap<Long, com.policemanagement.com.service.dto.HouseholdDTO>();
        if (!ids.isEmpty()) repository.findAllById(ids).forEach(entity -> items.put(entity.getId(), mapper.toDto(entity)));
        return ids.stream().map(items::get).filter(Objects::nonNull).toList();
    }

    private BrowseQuery query(String search, String hamlet, String type, String residence) {
        var params = new HashMap<String, Object>();
        String scope = "1=1";
        if (!rbac.global()) {
            var ids = rbac.areas();
            scope = ids.isEmpty() ? "1=0" : "h.hamlet_id in (:areas)";
            if (!ids.isEmpty()) params.put("areas", ids);
            var streets = (List<?>) rbac.current().getOrDefault("assignedStreets", List.of());
            if (!streets.isEmpty()) {
                scope += " and (h.street in (:streets) or h.alley in (:streets))";
                params.put("streets", streets);
            }
        }
        String base =
            "with scoped as (select h.*, coalesce(h.hamlet,'') as browse_hamlet, " +
            RESIDENCE +
            " as browse_residence, case when h.type in ('BUSINESS','BOARDING_HOUSE') then 'business' when h.type='SPECIAL' then 'special_monitoring' else 'household' end as browse_type from household h where " +
            scope +
            ") ";
        String filter = "1=1";
        if (!"all".equals(hamlet)) {
            filter += " and h.browse_hamlet=:hamlet";
            params.put("hamlet", hamlet);
        }
        if (!"all".equals(type)) {
            filter += " and h.browse_type=:type";
            params.put("type", type);
        }
        if (!"all".equals(residence)) {
            filter += " and h.browse_residence=:residence";
            params.put("residence", residence);
        }
        String q = Normalizer.normalize(search.trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
            .replaceAll("\\p{M}", "")
            .replace('đ', 'd');
        if (!q.isEmpty()) {
            params.put("search", "%" + q.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%");
            var matches = new ArrayList<String>();
            for (String field : List.of(
                "owner_name",
                "house_number",
                "street",
                "browse_hamlet",
                "code",
                "owner_phone",
                "business_name",
                "business_category",
                "alley",
                "notes"
            )) {
                // Match the existing DTO mapper's display defaults as well as stored values.
                String expression = switch (field) {
                    case "owner_name" -> "coalesce(nullif(h.owner_name,''),'Chưa cập nhật')";
                    case "house_number" -> "coalesce(nullif(h.house_number,''),'1')";
                    case "street" -> "coalesce(nullif(h.street,''),'Đường Phan Văn Hớn')";
                    case "alley" -> "coalesce(nullif(h.alley,''),'Mặt tiền đường')";
                    case "notes" -> "coalesce(nullif(h.notes,''),'Hồ sơ quản lý địa bàn Xã Bà Điểm.')";
                    case "code" -> "coalesce(nullif(h.code,''),'HK-BD-' || lpad(cast(h.id as varchar),greatest(3,length(cast(h.id as varchar))),'0'))";
                    default -> "h." + field;
                };
                matches.add(folded(expression) + " like :search escape '!' ");
            }
            matches.add(
                folded("case h.browse_residence when 'stay' then 'Lưu trú' when 'temporary' then 'Tạm trú' else 'Thường trú' end") +
                    " like :search escape '!' "
            );
            matches.add(
                "exists(select 1 from resident r where r.household_id=h.id and (" +
                    folded("coalesce(nullif(r.full_name,''),'Chưa đặt tên')") +
                    " like :search escape '!' or " +
                    folded("r.id_card_number") +
                    " like :search escape '!'))"
            );
            if (q.equals("canh bao")) matches.add("h.status='WARNING'");
            if (q.equals("kinh doanh")) matches.add("h.browse_type='business'");
            if (q.equals("ho gia dinh")) matches.add("h.browse_type='household'");
            filter += " and (" + String.join(" or ", matches) + ")";
        }
        return new BrowseQuery(base, filter, params);
    }
}
