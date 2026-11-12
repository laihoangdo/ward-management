package com.policemanagement.com.service.roster;

import com.policemanagement.com.service.PostgisSpatialService;
import com.policemanagement.com.service.rbac.RbacService;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Field patrol: households near the officer and door check-ins. Only positions that are really recorded are used: a linked
 * building footprint or a household coordinate verified on site. Random or unlocated coordinates are never returned.
 */
@Service
@Transactional
public class RosterPatrolService {

    static final int MIN_RADIUS = 10;
    static final int MAX_RADIUS = 200;
    static final int DEFAULT_RADIUS = 50;
    static final int LIMIT = 20;

    private final JdbcTemplate db;
    private final RosterService roster;
    private final RbacService rbac;
    private final PostgisSpatialService spatial;

    public RosterPatrolService(JdbcTemplate db, RosterService roster, RbacService rbac, PostgisSpatialService spatial) {
        this.db = db;
        this.roster = roster;
        this.rbac = rbac;
        this.spatial = spatial;
    }

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    static void validatePosition(double latitude, double longitude) {
        if (!Double.isFinite(latitude) || !Double.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw bad(
            "Toạ độ không hợp lệ"
        );
    }

    static int radius(Integer requested) {
        int value = requested == null ? DEFAULT_RADIUS : requested;
        if (value < MIN_RADIUS || value > MAX_RADIUS) throw bad("Bán kính phải từ " + MIN_RADIUS + " đến " + MAX_RADIUS + " mét");
        return value;
    }

    /** Number of most recent visits that were all ABSENT, newest first; stops at the first PRESENT visit. */
    static int consecutiveAbsent(List<String> outcomesNewestFirst) {
        int count = 0;
        for (String outcome : outcomesNewestFirst) {
            if (!"ABSENT".equals(outcome)) break;
            count++;
        }
        return count;
    }

    /**
     * {@code reliableOnly} drops households whose building link is only a best-effort estimate; every row says how reliable
     * its position is ({@code link_quality}: VERIFIED, CONFIRMED, EXACT, DRAWING_APPROX, MANUAL or ESTIMATED).
     */
    public List<Map<String, Object>> nearby(double latitude, double longitude, Integer requestedRadius, boolean reliableOnly) {
        roster.authorize(null);
        if (!spatial.enabled()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "PostGIS chưa được bật và nghiệm thu");
        validatePosition(latitude, longitude);
        int meters = radius(requestedRadius);
        long hamlet = roster.hamlet();
        var rows = db.queryForList(
            "with me as (select ST_SetSRID(ST_MakePoint(?,?),4326)::geography g), cand as (" +
                " select h.id hid, h.roster_id id, h.code, h.raw_address, 'BUILDING' position_source, ST_Distance(b.footprint_geom::geography, me.g) distance_m," +
                " case when exists(select 1 from household_link_confirmation c where c.household_id=h.id and c.building_id=b.id) then 'CONFIRMED'" +
                " when i.source like '%-estimated' then 'ESTIMATED' when i.match_tier='exact' then 'EXACT' when i.match_tier is not null then 'DRAWING_APPROX' else 'MANUAL' end link_quality" +
                " from me, public.gis_field_building_household bh join public.gis_field_building b on b.id=bh.building_id" +
                " join public.household h on h.id=bh.household_id" +
                " left join public.gis_field_building_household_import i on i.household_id=h.id and i.building_id=b.id" +
                " where h.hamlet_id=? and ST_DWithin(b.footprint_geom::geography, me.g, ?)" +
                " union all" +
                " select h.id, h.roster_id, h.code, h.raw_address, 'VERIFIED_COORDINATE', ST_Distance(ST_SetSRID(ST_MakePoint(h.longitude,h.latitude),4326)::geography, me.g), 'VERIFIED'" +
                " from me, public.household h where h.hamlet_id=? and h.coordinate_method='VERIFIED' and h.latitude is not null and h.longitude is not null" +
                " and ST_DWithin(ST_SetSRID(ST_MakePoint(h.longitude,h.latitude),4326)::geography, me.g, ?)" +
                ") select * from (select distinct on (hid) * from cand order by hid, distance_m) x where (? = false or link_quality <> 'ESTIMATED') order by distance_m, code limit " +
                LIMIT,
            longitude,
            latitude,
            hamlet,
            meters,
            hamlet,
            meters,
            reliableOnly
        );
        var result = new ArrayList<Map<String, Object>>();
        for (var row : rows) {
            var item = new LinkedHashMap<String, Object>(row);
            var visits = db.queryForList(
                "select outcome, observed_at from household_visit where household_id=? order by observed_at desc limit 10",
                row.get("hid")
            );
            item.remove("hid");
            item.put("last_visit", visits.isEmpty() ? null : visits.getFirst());
            item.put(
                "consecutive_absent",
                consecutiveAbsent(
                    visits
                        .stream()
                        .map(v -> Objects.toString(v.get("outcome")))
                        .toList()
                )
            );
            result.add(item);
        }
        return result;
    }

    /** Records one door check-in. A retry with the same requestId returns the stored visit instead of adding another. */
    public Map<String, Object> checkIn(Map<String, Object> data) {
        roster.authorize("canUpdateInspection");
        UUID household = uuid(data.get("householdId"), "Thiếu mã hộ");
        UUID request = uuid(data.get("requestId"), "Thiếu mã yêu cầu chống ghi lặp");
        String outcome = Objects.toString(data.get("outcome"), "");
        if (!outcome.equals("PRESENT") && !outcome.equals("ABSENT")) throw bad("Kết quả phải là PRESENT hoặc ABSENT");
        Double latitude = number(data.get("latitude")),
            longitude = number(data.get("longitude")),
            accuracy = number(data.get("accuracy"));
        if ((latitude == null) != (longitude == null)) throw bad("Cần cả vĩ độ và kinh độ");
        if (latitude != null) validatePosition(latitude, longitude);
        if (accuracy != null && (accuracy < 0 || !Double.isFinite(accuracy))) throw bad("Độ chính xác không hợp lệ");
        String note = Objects.toString(data.get("note"), "").strip();
        if (note.length() > 500) throw bad("Ghi chú tối đa 500 ký tự");
        long hamlet = roster.hamlet();
        var houses = db.queryForList("select id from public.household where roster_id=? and hamlet_id=?", Long.class, household, hamlet);
        if (houses.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy hộ trong ấp đang chọn");
        long houseId = houses.getFirst();
        String officer = rbac.subject();
        var existing = db.queryForList("select * from household_visit where request_id=?", request);
        if (!existing.isEmpty()) {
            var old = existing.getFirst();
            if (
                !Objects.equals(old.get("household_id"), houseId) ||
                !officer.equals(old.get("officer_subject")) ||
                !outcome.equals(old.get("outcome"))
            ) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Mã yêu cầu đã dùng cho nội dung khác");
            }
            return visit(old, household);
        }
        UUID id = UUID.randomUUID();
        db.update(
            "insert into household_visit(id,request_id,household_id,hamlet_id,outcome,officer,officer_subject,latitude,longitude,accuracy_m,note) values (?,?,?,?,?,?,?,?,?,?,?)",
            id,
            request,
            houseId,
            hamlet,
            outcome,
            officer,
            officer,
            latitude,
            longitude,
            accuracy,
            note
        );
        return visit(db.queryForMap("select * from household_visit where id=?", id), household);
    }

    /**
     * An officer confirms at the door that the household belongs to the building it is linked to. The confirmation is kept as an
     * append-only record and stops counting if the household is later linked to a different building.
     */
    public Map<String, Object> confirmPosition(Map<String, Object> data) {
        roster.authorize("canUpdateInspection");
        UUID household = uuid(data.get("householdId"), "Thiếu mã hộ");
        UUID request = uuid(data.get("requestId"), "Thiếu mã yêu cầu chống ghi lặp");
        Double latitude = number(data.get("latitude")),
            longitude = number(data.get("longitude")),
            accuracy = number(data.get("accuracy"));
        if ((latitude == null) != (longitude == null)) throw bad("Cần cả vĩ độ và kinh độ");
        if (latitude != null) validatePosition(latitude, longitude);
        if (accuracy != null && (accuracy < 0 || !Double.isFinite(accuracy))) throw bad("Độ chính xác không hợp lệ");
        long hamlet = roster.hamlet();
        var houses = db.queryForList("select id from public.household where roster_id=? and hamlet_id=?", Long.class, household, hamlet);
        if (houses.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy hộ trong ấp đang chọn");
        long houseId = houses.getFirst();
        var buildings = db.queryForList("select building_id from gis_field_building_household where household_id=?", String.class, houseId);
        if (buildings.isEmpty()) throw new ResponseStatusException(HttpStatus.CONFLICT, "Hộ chưa được liên kết với công trình nào");
        String building = buildings.getFirst();
        String officer = rbac.subject();
        var existing = db.queryForList("select * from household_link_confirmation where request_id=?", request);
        if (!existing.isEmpty()) {
            var old = existing.getFirst();
            if (!Objects.equals(old.get("household_id"), houseId) || !officer.equals(old.get("officer_subject"))) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Mã yêu cầu đã dùng cho nội dung khác");
            }
            return confirmation(old, household);
        }
        UUID id = UUID.randomUUID();
        db.update(
            "insert into household_link_confirmation(id,request_id,household_id,hamlet_id,building_id,officer,officer_subject,latitude,longitude,accuracy_m) values (?,?,?,?,?,?,?,?,?,?)",
            id,
            request,
            houseId,
            hamlet,
            building,
            officer,
            officer,
            latitude,
            longitude,
            accuracy
        );
        return confirmation(db.queryForMap("select * from household_link_confirmation where id=?", id), household);
    }

    private static Map<String, Object> confirmation(Map<String, Object> row, UUID household) {
        var result = new LinkedHashMap<String, Object>();
        result.put("id", row.get("id"));
        result.put("household_id", household);
        result.put("building_id", row.get("building_id"));
        result.put("confirmed_at", row.get("confirmed_at"));
        result.put("officer", row.get("officer"));
        return result;
    }

    private static Map<String, Object> visit(Map<String, Object> row, UUID household) {
        var result = new LinkedHashMap<String, Object>();
        result.put("id", row.get("id"));
        result.put("household_id", household);
        result.put("outcome", row.get("outcome"));
        result.put("observed_at", row.get("observed_at"));
        result.put("officer", row.get("officer"));
        result.put("latitude", row.get("latitude"));
        result.put("longitude", row.get("longitude"));
        result.put("accuracy_m", row.get("accuracy_m"));
        result.put("note", row.get("note"));
        return result;
    }

    private static UUID uuid(Object value, String message) {
        try {
            return UUID.fromString(Objects.toString(value, ""));
        } catch (IllegalArgumentException ex) {
            throw bad(message);
        }
    }

    private static Double number(Object value) {
        if (value == null || Objects.toString(value).isBlank()) return null;
        if (value instanceof Number n) return n.doubleValue();
        try {
            return Double.parseDouble(value.toString());
        } catch (NumberFormatException ex) {
            throw bad("Giá trị số không hợp lệ");
        }
    }
}
