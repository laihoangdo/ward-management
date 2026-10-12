package com.policemanagement.com.domain;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDate;
import java.util.Objects;
import org.hibernate.annotations.Cache;
import org.hibernate.annotations.CacheConcurrencyStrategy;

/**
 * Đơn vị hành chính cấp Ấp / Khu phố
 */
@Entity
@Table(name = "hamlet")
@Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
public class Hamlet implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @NotNull
    @Column(name = "code", nullable = false, unique = true)
    private String code;

    @NotNull
    @Column(name = "name", nullable = false)
    private String name;

    @NotNull
    @Column(name = "unit_type", nullable = false)
    private String unitType;

    @NotNull
    @Column(name = "full_name", nullable = false)
    private String fullName;

    @NotNull
    @Column(name = "commune_id", nullable = false)
    private Long communeId;

    @Column(name = "sort_order")
    private Integer sortOrder;

    @NotNull
    @Column(name = "name_normalized", nullable = false)
    private String nameNormalized;

    @Column(name = "valid_from")
    private LocalDate validFrom;

    @Column(name = "valid_to")
    private LocalDate validTo;

    @Column(name = "officer_in_charge")
    private String officerInCharge;

    @Column(name = "officer_phone")
    private String officerPhone;

    @Column(name = "population_count")
    private Integer populationCount;

    @Column(name = "household_count")
    private Integer householdCount;

    @Lob
    @Column(name = "boundary_geo_json", columnDefinition = "text")
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.LONGVARCHAR)
    private String boundaryGeoJson;

    public String getHamletName() {
        return fullName;
    }

    public void setHamletName(String value) {
        fullName = value;
    }

    public String getOfficerInCharge() {
        return this.officerInCharge;
    }

    public Hamlet officerInCharge(String officerInCharge) {
        this.setOfficerInCharge(officerInCharge);
        return this;
    }

    public void setOfficerInCharge(String officerInCharge) {
        this.officerInCharge = officerInCharge;
    }

    public String getOfficerPhone() {
        return this.officerPhone;
    }

    public Hamlet officerPhone(String officerPhone) {
        this.setOfficerPhone(officerPhone);
        return this;
    }

    public void setOfficerPhone(String officerPhone) {
        this.officerPhone = officerPhone;
    }

    public Integer getPopulationCount() {
        return this.populationCount;
    }

    public Hamlet populationCount(Integer populationCount) {
        this.setPopulationCount(populationCount);
        return this;
    }

    public void setPopulationCount(Integer populationCount) {
        this.populationCount = populationCount;
    }

    public Integer getHouseholdCount() {
        return this.householdCount;
    }

    public Hamlet householdCount(Integer householdCount) {
        this.setHouseholdCount(householdCount);
        return this;
    }

    public void setHouseholdCount(Integer householdCount) {
        this.householdCount = householdCount;
    }

    public String getBoundaryGeoJson() {
        return this.boundaryGeoJson;
    }

    public Hamlet boundaryGeoJson(String boundaryGeoJson) {
        this.setBoundaryGeoJson(boundaryGeoJson);
        return this;
    }

    public void setBoundaryGeoJson(String boundaryGeoJson) {
        this.boundaryGeoJson = boundaryGeoJson;
    }

    @com.fasterxml.jackson.annotation.JsonIgnore
    @OneToMany(fetch = FetchType.LAZY, mappedBy = "administrativeHamlet")
    private java.util.Set<Household> householdses = new java.util.HashSet<>();

    public java.util.Set<Household> getHouseholdses() {
        return householdses;
    }

    public void setHouseholdses(java.util.Set<Household> values) {
        if (householdses != null) householdses.forEach(h -> h.setAdministrativeHamlet(null));
        if (values != null) values.forEach(h -> h.setAdministrativeHamlet(this));
        householdses = values;
    }

    public Hamlet householdses(java.util.Set<Household> values) {
        setHouseholdses(values);
        return this;
    }

    public Hamlet addHouseholds(Household value) {
        householdses.add(value);
        value.setAdministrativeHamlet(this);
        return this;
    }

    public Hamlet removeHouseholds(Household value) {
        householdses.remove(value);
        value.setAdministrativeHamlet(null);
        return this;
    }

    public Hamlet communeId(Long value) {
        setCommuneId(value);
        return this;
    }

    public Hamlet unitType(String value) {
        setUnitType(value);
        return this;
    }

    public Hamlet nameNormalized(String value) {
        setNameNormalized(value);
        return this;
    }

    public Hamlet id(Long value) {
        setId(value);
        return this;
    }

    public Hamlet code(String value) {
        setCode(value);
        return this;
    }

    public Hamlet name(String value) {
        setName(value);
        return this;
    }

    public Hamlet hamletName(String value) {
        setHamletName(value);
        return this;
    }

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

    public String getUnitType() {
        return unitType;
    }

    public void setUnitType(String unitType) {
        this.unitType = unitType;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public Long getCommuneId() {
        return communeId;
    }

    public void setCommuneId(Long communeId) {
        this.communeId = communeId;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }

    public String getNameNormalized() {
        return nameNormalized;
    }

    public void setNameNormalized(String nameNormalized) {
        this.nameNormalized = nameNormalized;
    }

    public LocalDate getValidFrom() {
        return validFrom;
    }

    public void setValidFrom(LocalDate validFrom) {
        this.validFrom = validFrom;
    }

    public LocalDate getValidTo() {
        return validTo;
    }

    public void setValidTo(LocalDate validTo) {
        this.validTo = validTo;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Hamlet hamlet)) return false;
        return id != null && Objects.equals(id, hamlet.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }

    @Override
    public String toString() {
        return (
            "Hamlet{" +
            "id=" +
            id +
            ", code='" +
            code +
            '\'' +
            ", name='" +
            name +
            '\'' +
            ", fullName='" +
            fullName +
            '\'' +
            ", communeId=" +
            communeId +
            '}'
        );
    }
}
