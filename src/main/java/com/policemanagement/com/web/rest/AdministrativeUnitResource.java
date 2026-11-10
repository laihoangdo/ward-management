package com.policemanagement.com.web.rest;

import com.policemanagement.com.domain.Hamlet;
import com.policemanagement.com.repository.HamletRepository;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

/**
 * REST controller for managing Administrative Units (Province, Commune, Hamlet).
 */
@RestController
@RequestMapping("/api/administrative-units")
public class AdministrativeUnitResource {

    private static final Logger LOG = LoggerFactory.getLogger(AdministrativeUnitResource.class);

    private final HamletRepository hamletRepository;
    private final JdbcTemplate jdbcTemplate;

    public record ProvinceView(Long id, String code, String name, String unitType, String fullName) {}

    @GetMapping("/provinces")
    public List<ProvinceView> getProvinces() {
        return jdbcTemplate.query(
            "SELECT id, code, name, unit_type, full_name FROM admin_province WHERE valid_to IS NULL ORDER BY id",
            (rs, rowNum) ->
                new ProvinceView(
                    rs.getLong("id"),
                    rs.getString("code"),
                    rs.getString("name"),
                    rs.getString("unit_type"),
                    rs.getString("full_name")
                )
        );
    }

    public AdministrativeUnitResource(HamletRepository hamletRepository, JdbcTemplate jdbcTemplate) {
        this.hamletRepository = hamletRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * DTO đại diện cho một Ấp / Khu phố
     */
    public record HamletView(Long id, String code, String name, String unitType, String fullName, Long communeId, Integer sortOrder) {}

    /**
     * DTO đại diện cho Xã / Phường
     */
    public record CommuneView(
        Long id,
        String code,
        String name,
        String unitType,
        String fullName,
        Long provinceId,
        Double areaKm2,
        Integer population,
        Integer hamletCount,
        String hqAddress,
        String policeHqAddress,
        String website
    ) {}

    /**
     * DTO địa chỉ chuẩn hóa của hộ dân
     */
    public record StandardHouseholdAddress(
        Long householdId,
        String householdCode,
        String houseNumber,
        String street,
        String alley,
        String neighborhoodGroup,
        String legacyAddress,
        Long hamletId,
        String hamletName,
        String hamletFullName,
        Long communeId,
        String communeFullName,
        Long provinceId,
        String provinceFullName,
        String fullAddressStandard
    ) {}

    /**
     * {@code GET  /administrative-units/hamlets} : Lấy danh sách ấp của xã (mặc định Xã Bà Điểm communeId=1).
     */
    @GetMapping("/hamlets")
    public List<HamletView> getHamlets(@RequestParam(required = false, defaultValue = "1") Long communeId) {
        LOG.debug("REST request to get Hamlets for communeId : {}", communeId);
        return hamletRepository
            .findByCommuneIdAndValidToIsNullOrderBySortOrderAsc(communeId)
            .stream()
            .map(h ->
                new HamletView(h.getId(), h.getCode(), h.getName(), h.getUnitType(), h.getFullName(), h.getCommuneId(), h.getSortOrder())
            )
            .toList();
    }

    /**
     * {@code GET  /administrative-units/communes} : Lấy danh sách xã/phường đang hiệu lực
     */
    @GetMapping("/communes")
    public List<CommuneView> getCommunes(@RequestParam(required = false, defaultValue = "1") Long provinceId) {
        String sql = """
            SELECT id, code, name, unit_type, full_name, province_id, area_km2, population,
                   hamlet_count, hq_address, police_hq_address, website
            FROM admin_commune
            WHERE province_id = ? AND valid_to IS NULL
            ORDER BY id
        """;
        return jdbcTemplate.query(
            sql,
            (rs, rowNum) ->
                new CommuneView(
                    rs.getLong("id"),
                    rs.getString("code"),
                    rs.getString("name"),
                    rs.getString("unit_type"),
                    rs.getString("full_name"),
                    rs.getLong("province_id"),
                    rs.getObject("area_km2") != null ? rs.getDouble("area_km2") : null,
                    rs.getObject("population", Integer.class),
                    rs.getObject("hamlet_count", Integer.class),
                    rs.getString("hq_address"),
                    rs.getString("police_hq_address"),
                    rs.getString("website")
                ),
            provinceId
        );
    }

    /**
     * {@code GET  /administrative-units/households/{id}/standard-address} : Lấy địa chỉ chuẩn hóa từ view v_household_address
     */
    @GetMapping("/households/{id}/standard-address")
    public ResponseEntity<StandardHouseholdAddress> getHouseholdStandardAddress(@PathVariable Long id) {
        String sql = """
            SELECT household_id, household_code, house_number, street, alley, neighborhood_group,
                   legacy_address, hamlet_id, hamlet_name, hamlet_full_name,
                   commune_id, commune_full_name, province_id, province_full_name,
                   full_address_standard
            FROM v_household_address
            WHERE household_id = ?
        """;
        List<StandardHouseholdAddress> results = jdbcTemplate.query(
            sql,
            (rs, rowNum) ->
                new StandardHouseholdAddress(
                    rs.getLong("household_id"),
                    rs.getString("household_code"),
                    rs.getString("house_number"),
                    rs.getString("street"),
                    rs.getString("alley"),
                    rs.getString("neighborhood_group"),
                    rs.getString("legacy_address"),
                    rs.getLong("hamlet_id"),
                    rs.getString("hamlet_name"),
                    rs.getString("hamlet_full_name"),
                    rs.getLong("commune_id"),
                    rs.getString("commune_full_name"),
                    rs.getLong("province_id"),
                    rs.getString("province_full_name"),
                    rs.getString("full_address_standard")
                ),
            id
        );

        if (results.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(results.get(0));
    }
}
