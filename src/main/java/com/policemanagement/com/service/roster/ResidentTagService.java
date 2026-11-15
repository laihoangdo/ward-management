package com.policemanagement.com.service.roster;

import com.policemanagement.com.service.rbac.RbacService;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Social standing of residents (diện xã hội: đảng viên, cán bộ hưu trí, cựu chiến binh) and the per-household categories the
 * area map colours by: red for a household with an active subject under management, blue for a party member, purple for a
 * retired cadre or veteran.
 */
@Service
@Transactional
public class ResidentTagService {

    public static final List<String> TAGS = List.of("DANG_VIEN", "CB_HUU_TRI", "CCB");
    /** Map categories, highest priority first. */
    public static final List<String> CATEGORIES = List.of("SUBJECT", "PARTY", "RETIRED");

    private final JdbcTemplate db;
    private final RosterService roster;
    private final RbacService rbac;

    public ResidentTagService(JdbcTemplate db, RosterService roster, RbacService rbac) {
        this.db = db;
        this.roster = roster;
        this.rbac = rbac;
    }

    private boolean has(String permission) {
        if (rbac.global()) return true;
        try {
            rbac.permission(permission);
            return true;
        } catch (AccessDeniedException e) {
            return false;
        }
    }

    @Transactional(readOnly = true)
    public List<String> tags(UUID resident) {
        roster.requireResident(resident, null);
        return read(resident);
    }

    private List<String> read(UUID resident) {
        var stored = db.queryForList("select tag from resident_tag where resident_id=?", String.class, resident);
        return TAGS.stream().filter(stored::contains).toList();
    }

    /** Replaces the resident's tags; needs the resident edit permission and is written to the audit log. */
    public List<String> save(UUID resident, List<?> incoming) {
        long hamlet = roster.requireResident(resident, "canUpdateInspection");
        var wanted = new LinkedHashSet<String>();
        for (Object value : incoming == null ? List.of() : incoming) {
            String tag = String.valueOf(value);
            if (!TAGS.contains(tag)) throw new ResponseStatusException(
                org.springframework.http.HttpStatus.BAD_REQUEST,
                "Diện không hợp lệ"
            );
            wanted.add(tag);
        }
        var before = read(resident);
        if (before.equals(TAGS.stream().filter(wanted::contains).toList())) return before;
        db.update("delete from resident_tag where resident_id=? and tag <> all(?::varchar[])", resident, wanted.toArray(String[]::new));
        for (String tag : wanted)
            db.update(
                "insert into resident_tag(resident_id, hamlet_id, tag, created_by) values (?,?,?,?) on conflict do nothing",
                resident,
                hamlet,
                tag,
                rbac.subject()
            );
        var after = read(resident);
        rbac.audit("update-resident-tags", "resident:" + resident, Map.of("before", before, "after", after));
        return after;
    }

    /**
     * Categories of every household the caller may see on the area map, keyed by the map's household id. Subjects are only
     * included with a subject view permission, and political subjects only with canViewPoliticalSubjects.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> mapCategories() {
        rbac.current();
        boolean global = rbac.global();
        boolean subjects = has("canViewSubjects") || has("canManageSubjects");
        boolean political = has("canViewPoliticalSubjects");
        var args = new ArrayList<Object>();
        String subjectSql = subjects
            ? "exists (select 1 from subject s where s.resident_id=m.resident_id and s.status='ACTIVE'" +
              (political ? "" : " and s.category <> 'CT'") +
              ")"
            : "false";
        String sql =
            "select * from (select h.id," +
            " bool_or(" +
            subjectSql +
            ") subject," +
            " bool_or(exists (select 1 from resident_tag t where t.resident_id=m.resident_id and t.tag='DANG_VIEN')) party," +
            " bool_or(exists (select 1 from resident_tag t where t.resident_id=m.resident_id and t.tag in ('CB_HUU_TRI','CCB'))) retired" +
            " from public.household h join tc2_roster.household_membership m on m.household_id=h.roster_id and m.valid_to is null";
        if (!global) {
            sql += " where h.hamlet_id in (select hamlet_id from rbac_assignment where subject=?)";
            args.add(rbac.current().get("id"));
        }
        sql += " group by h.id) x where subject or party or retired";
        var visible = global ? null : rbac.visibleMapHouseholds();
        var households = new LinkedHashMap<String, List<String>>();
        var counts = new LinkedHashMap<String, Integer>();
        CATEGORIES.forEach(category -> counts.put(category, 0));
        for (var row : db.queryForList(sql, args.toArray())) {
            String id = row.get("id").toString();
            if (visible != null && !visible.contains(id)) continue;
            var list = new ArrayList<String>();
            if (Boolean.TRUE.equals(row.get("subject"))) list.add("SUBJECT");
            if (Boolean.TRUE.equals(row.get("party"))) list.add("PARTY");
            if (Boolean.TRUE.equals(row.get("retired"))) list.add("RETIRED");
            if (list.isEmpty()) continue;
            households.put(id, list);
            counts.merge(list.getFirst(), 1, Integer::sum);
        }
        var result = new LinkedHashMap<String, Object>();
        result.put("households", households);
        result.put("counts", counts);
        result.put("subjectsVisible", subjects);
        return result;
    }
}
