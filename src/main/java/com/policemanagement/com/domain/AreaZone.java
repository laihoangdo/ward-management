package com.policemanagement.com.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.util.HashSet;
import java.util.Set;
import org.hibernate.annotations.Cache;
import org.hibernate.annotations.CacheConcurrencyStrategy;

/**
 * Khu vực / Khu phố / Địa bàn quản lý
 */
@Entity
@Table(name = "area_zone")
@Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
@SuppressWarnings("common-java:DuplicatedBlocks")
public class AreaZone implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Column(name = "code", nullable = false, unique = true)
    private String code;

    @NotNull
    @Column(name = "name", nullable = false)
    private String name;

    @NotNull
    @Column(name = "hamlet_name", nullable = false)
    private String hamletName;

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

    @OneToMany(fetch = FetchType.LAZY, mappedBy = "areaZone")
    @Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
    @JsonIgnoreProperties(value = { "residentses", "areaZone" }, allowSetters = true)
    private Set<Household> householdses = new HashSet<>();

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public AreaZone id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getCode() {
        return this.code;
    }

    public AreaZone code(String code) {
        this.setCode(code);
        return this;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getName() {
        return this.name;
    }

    public AreaZone name(String name) {
        this.setName(name);
        return this;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getHamletName() {
        return this.hamletName;
    }

    public AreaZone hamletName(String hamletName) {
        this.setHamletName(hamletName);
        return this;
    }

    public void setHamletName(String hamletName) {
        this.hamletName = hamletName;
    }

    public String getOfficerInCharge() {
        return this.officerInCharge;
    }

    public AreaZone officerInCharge(String officerInCharge) {
        this.setOfficerInCharge(officerInCharge);
        return this;
    }

    public void setOfficerInCharge(String officerInCharge) {
        this.officerInCharge = officerInCharge;
    }

    public String getOfficerPhone() {
        return this.officerPhone;
    }

    public AreaZone officerPhone(String officerPhone) {
        this.setOfficerPhone(officerPhone);
        return this;
    }

    public void setOfficerPhone(String officerPhone) {
        this.officerPhone = officerPhone;
    }

    public Integer getPopulationCount() {
        return this.populationCount;
    }

    public AreaZone populationCount(Integer populationCount) {
        this.setPopulationCount(populationCount);
        return this;
    }

    public void setPopulationCount(Integer populationCount) {
        this.populationCount = populationCount;
    }

    public Integer getHouseholdCount() {
        return this.householdCount;
    }

    public AreaZone householdCount(Integer householdCount) {
        this.setHouseholdCount(householdCount);
        return this;
    }

    public void setHouseholdCount(Integer householdCount) {
        this.householdCount = householdCount;
    }

    public String getBoundaryGeoJson() {
        return this.boundaryGeoJson;
    }

    public AreaZone boundaryGeoJson(String boundaryGeoJson) {
        this.setBoundaryGeoJson(boundaryGeoJson);
        return this;
    }

    public void setBoundaryGeoJson(String boundaryGeoJson) {
        this.boundaryGeoJson = boundaryGeoJson;
    }

    public Set<Household> getHouseholdses() {
        return this.householdses;
    }

    public void setHouseholdses(Set<Household> households) {
        if (this.householdses != null) {
            this.householdses.forEach(i -> i.setAreaZone(null));
        }
        if (households != null) {
            households.forEach(i -> i.setAreaZone(this));
        }
        this.householdses = households;
    }

    public AreaZone householdses(Set<Household> households) {
        this.setHouseholdses(households);
        return this;
    }

    public AreaZone addHouseholds(Household household) {
        this.householdses.add(household);
        household.setAreaZone(this);
        return this;
    }

    public AreaZone removeHouseholds(Household household) {
        this.householdses.remove(household);
        household.setAreaZone(null);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof AreaZone)) {
            return false;
        }
        return getId() != null && getId().equals(((AreaZone) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "AreaZone{" +
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
