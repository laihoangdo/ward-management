package com.policemanagement.com.service.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.Lob;
import jakarta.validation.constraints.*;
import java.io.Serializable;
import java.util.Objects;

/**
 * A DTO for the {@link com.policemanagement.com.domain.Hamlet} entity.
 */
@Schema(description = "Khu vực / Khu phố / Địa bàn quản lý")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class HamletDTO implements Serializable {

    private Long communeId;

    public Long getCommuneId() {
        return communeId;
    }

    public void setCommuneId(Long value) {
        communeId = value;
    }

    private String unitType;

    public String getUnitType() {
        return unitType;
    }

    public void setUnitType(String value) {
        unitType = value;
    }

    private String nameNormalized;

    public String getNameNormalized() {
        return nameNormalized;
    }

    public void setNameNormalized(String value) {
        nameNormalized = value;
    }

    private String fullName;

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String value) {
        fullName = value;
    }

    private Integer sortOrder;

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer value) {
        sortOrder = value;
    }

    private java.time.LocalDate validFrom;

    public java.time.LocalDate getValidFrom() {
        return validFrom;
    }

    public void setValidFrom(java.time.LocalDate value) {
        validFrom = value;
    }

    private java.time.LocalDate validTo;

    public java.time.LocalDate getValidTo() {
        return validTo;
    }

    public void setValidTo(java.time.LocalDate value) {
        validTo = value;
    }

    private Long id;

    @NotNull
    private String code;

    @NotNull
    private String name;

    // Legacy display-name alias; native clients may provide fullName instead.
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
        if (!(o instanceof HamletDTO)) {
            return false;
        }

        HamletDTO administrativeHamletDTO = (HamletDTO) o;
        if (this.id == null) {
            return false;
        }
        return Objects.equals(this.id, administrativeHamletDTO.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(this.id);
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "HamletDTO{" +
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
