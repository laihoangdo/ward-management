package com.policemanagement.com.service.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.Lob;
import jakarta.validation.constraints.*;
import java.io.Serializable;
import java.util.Objects;

/**
 * A DTO for the {@link com.policemanagement.com.domain.AreaZone} entity.
 */
@Schema(description = "Khu vực / Khu phố / Địa bàn quản lý")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class AreaZoneDTO implements Serializable {

    private Long id;

    @NotNull
    private String code;

    @NotNull
    private String name;

    @NotNull
    private String hamletName;

    private String officerInCharge;

    private String officerPhone;

    private Integer populationCount;

    private Integer householdCount;

    @Lob
    private String boundaryGeoJson;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getHamletName() {
        return hamletName;
    }

    public void setHamletName(String hamletName) {
        this.hamletName = hamletName;
    }

    public String getOfficerInCharge() {
        return officerInCharge;
    }

    public void setOfficerInCharge(String officerInCharge) {
        this.officerInCharge = officerInCharge;
    }

    public String getOfficerPhone() {
        return officerPhone;
    }

    public void setOfficerPhone(String officerPhone) {
        this.officerPhone = officerPhone;
    }

    public Integer getPopulationCount() {
        return populationCount;
    }

    public void setPopulationCount(Integer populationCount) {
        this.populationCount = populationCount;
    }

    public Integer getHouseholdCount() {
        return householdCount;
    }

    public void setHouseholdCount(Integer householdCount) {
        this.householdCount = householdCount;
    }

    public String getBoundaryGeoJson() {
        return boundaryGeoJson;
    }

    public void setBoundaryGeoJson(String boundaryGeoJson) {
        this.boundaryGeoJson = boundaryGeoJson;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof AreaZoneDTO)) {
            return false;
        }

        AreaZoneDTO areaZoneDTO = (AreaZoneDTO) o;
        if (this.id == null) {
            return false;
        }
        return Objects.equals(this.id, areaZoneDTO.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(this.id);
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "AreaZoneDTO{" +
            "id=" + getId() +
            ", code='" + getCode() + "'" +
            ", name='" + getName() + "'" +
            ", hamletName='" + getHamletName() + "'" +
            ", officerInCharge='" + getOfficerInCharge() + "'" +
            ", officerPhone='" + getOfficerPhone() + "'" +
            ", populationCount=" + getPopulationCount() +
            ", householdCount=" + getHouseholdCount() +
            ", boundaryGeoJson='" + getBoundaryGeoJson() + "'" +
            "}";
    }
}
