package com.policemanagement.com.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.policemanagement.com.domain.enumeration.FacilityType;
import com.policemanagement.com.domain.enumeration.SecurityStatus;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.util.HashSet;
import java.util.Set;
import org.hibernate.annotations.Cache;
import org.hibernate.annotations.CacheConcurrencyStrategy;

/**
 * Hộ gia đình / Cơ sở kinh doanh trên địa bàn
 */
@Entity
@Table(name = "household")
@Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
@SuppressWarnings("common-java:DuplicatedBlocks")
public class Household implements Serializable {

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
    @Column(name = "house_number", nullable = false)
    private String houseNumber;

    @NotNull
    @Column(name = "street", nullable = false)
    private String street;

    @NotNull
    @Column(name = "hamlet", nullable = false)
    private String hamlet;

    @Column(name = "neighborhood_group")
    private String neighborhoodGroup;

    @Column(name = "alley")
    private String alley;

    @NotNull
    @Column(name = "owner_name", nullable = false)
    private String ownerName;

    @NotNull
    @Column(name = "owner_phone", nullable = false)
    private String ownerPhone;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false)
    private FacilityType type;

    @Column(name = "business_name")
    private String businessName;

    @Column(name = "business_category")
    private String businessCategory;

    @Column(name = "residents_count")
    private Integer residentsCount;

    @Column(name = "male_count")
    private Integer maleCount;

    @Column(name = "female_count")
    private Integer femaleCount;

    @Column(name = "under_18_count")
    private Integer under18Count;

    @Column(name = "above_18_count")
    private Integer above18Count;

    @Enumerated(EnumType.STRING)
    @Column(name = "status")
    private SecurityStatus status;

    @Column(name = "warning_message")
    private String warningMessage;

    @Column(name = "license_expiry")
    private String licenseExpiry;

    @Column(name = "license_type")
    private String licenseType;

    @Column(name = "latitude")
    private Double latitude;

    @Column(name = "longitude")
    private Double longitude;

    @Lob
    @Column(name = "notes", columnDefinition = "text")
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.LONGVARCHAR)
    private String notes;

    @Column(name = "last_checked_date")
    private String lastCheckedDate;

    @Column(name = "officer_in_charge")
    private String officerInCharge;

    @OneToMany(fetch = FetchType.LAZY, mappedBy = "household")
    @Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
    @JsonIgnoreProperties(value = { "household" }, allowSetters = true)
    private Set<Resident> residentses = new HashSet<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JsonIgnoreProperties(value = { "householdses" }, allowSetters = true)
    private AreaZone areaZone;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public Household id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getCode() {
        return this.code;
    }

    public Household code(String code) {
        this.setCode(code);
        return this;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getHouseNumber() {
        return this.houseNumber;
    }

    public Household houseNumber(String houseNumber) {
        this.setHouseNumber(houseNumber);
        return this;
    }

    public void setHouseNumber(String houseNumber) {
        this.houseNumber = houseNumber;
    }

    public String getStreet() {
        return this.street;
    }

    public Household street(String street) {
        this.setStreet(street);
        return this;
    }

    public void setStreet(String street) {
        this.street = street;
    }

    public String getHamlet() {
        return this.hamlet;
    }

    public Household hamlet(String hamlet) {
        this.setHamlet(hamlet);
        return this;
    }

    public void setHamlet(String hamlet) {
        this.hamlet = hamlet;
    }

    public String getNeighborhoodGroup() {
        return this.neighborhoodGroup;
    }

    public Household neighborhoodGroup(String neighborhoodGroup) {
        this.setNeighborhoodGroup(neighborhoodGroup);
        return this;
    }

    public void setNeighborhoodGroup(String neighborhoodGroup) {
        this.neighborhoodGroup = neighborhoodGroup;
    }

    public String getAlley() {
        return this.alley;
    }

    public Household alley(String alley) {
        this.setAlley(alley);
        return this;
    }

    public void setAlley(String alley) {
        this.alley = alley;
    }

    public String getOwnerName() {
        return this.ownerName;
    }

    public Household ownerName(String ownerName) {
        this.setOwnerName(ownerName);
        return this;
    }

    public void setOwnerName(String ownerName) {
        this.ownerName = ownerName;
    }

    public String getOwnerPhone() {
        return this.ownerPhone;
    }

    public Household ownerPhone(String ownerPhone) {
        this.setOwnerPhone(ownerPhone);
        return this;
    }

    public void setOwnerPhone(String ownerPhone) {
        this.ownerPhone = ownerPhone;
    }

    public FacilityType getType() {
        return this.type;
    }

    public Household type(FacilityType type) {
        this.setType(type);
        return this;
    }

    public void setType(FacilityType type) {
        this.type = type;
    }

    public String getBusinessName() {
        return this.businessName;
    }

    public Household businessName(String businessName) {
        this.setBusinessName(businessName);
        return this;
    }

    public void setBusinessName(String businessName) {
        this.businessName = businessName;
    }

    public String getBusinessCategory() {
        return this.businessCategory;
    }

    public Household businessCategory(String businessCategory) {
        this.setBusinessCategory(businessCategory);
        return this;
    }

    public void setBusinessCategory(String businessCategory) {
        this.businessCategory = businessCategory;
    }

    public Integer getResidentsCount() {
        return this.residentsCount;
    }

    public Household residentsCount(Integer residentsCount) {
        this.setResidentsCount(residentsCount);
        return this;
    }

    public void setResidentsCount(Integer residentsCount) {
        this.residentsCount = residentsCount;
    }

    public Integer getMaleCount() {
        return this.maleCount;
    }

    public Household maleCount(Integer maleCount) {
        this.setMaleCount(maleCount);
        return this;
    }

    public void setMaleCount(Integer maleCount) {
        this.maleCount = maleCount;
    }

    public Integer getFemaleCount() {
        return this.femaleCount;
    }

    public Household femaleCount(Integer femaleCount) {
        this.setFemaleCount(femaleCount);
        return this;
    }

    public void setFemaleCount(Integer femaleCount) {
        this.femaleCount = femaleCount;
    }

    public Integer getUnder18Count() {
        return this.under18Count;
    }

    public Household under18Count(Integer under18Count) {
        this.setUnder18Count(under18Count);
        return this;
    }

    public void setUnder18Count(Integer under18Count) {
        this.under18Count = under18Count;
    }

    public Integer getAbove18Count() {
        return this.above18Count;
    }

    public Household above18Count(Integer above18Count) {
        this.setAbove18Count(above18Count);
        return this;
    }

    public void setAbove18Count(Integer above18Count) {
        this.above18Count = above18Count;
    }

    public SecurityStatus getStatus() {
        return this.status;
    }

    public Household status(SecurityStatus status) {
        this.setStatus(status);
        return this;
    }

    public void setStatus(SecurityStatus status) {
        this.status = status;
    }

    public String getWarningMessage() {
        return this.warningMessage;
    }

    public Household warningMessage(String warningMessage) {
        this.setWarningMessage(warningMessage);
        return this;
    }

    public void setWarningMessage(String warningMessage) {
        this.warningMessage = warningMessage;
    }

    public String getLicenseExpiry() {
        return this.licenseExpiry;
    }

    public Household licenseExpiry(String licenseExpiry) {
        this.setLicenseExpiry(licenseExpiry);
        return this;
    }

    public void setLicenseExpiry(String licenseExpiry) {
        this.licenseExpiry = licenseExpiry;
    }

    public String getLicenseType() {
        return this.licenseType;
    }

    public Household licenseType(String licenseType) {
        this.setLicenseType(licenseType);
        return this;
    }

    public void setLicenseType(String licenseType) {
        this.licenseType = licenseType;
    }

    public Double getLatitude() {
        return this.latitude;
    }

    public Household latitude(Double latitude) {
        this.setLatitude(latitude);
        return this;
    }

    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }

    public Double getLongitude() {
        return this.longitude;
    }

    public Household longitude(Double longitude) {
        this.setLongitude(longitude);
        return this;
    }

    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }

    public String getNotes() {
        return this.notes;
    }

    public Household notes(String notes) {
        this.setNotes(notes);
        return this;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public String getLastCheckedDate() {
        return this.lastCheckedDate;
    }

    public Household lastCheckedDate(String lastCheckedDate) {
        this.setLastCheckedDate(lastCheckedDate);
        return this;
    }

    public void setLastCheckedDate(String lastCheckedDate) {
        this.lastCheckedDate = lastCheckedDate;
    }

    public String getOfficerInCharge() {
        return this.officerInCharge;
    }

    public Household officerInCharge(String officerInCharge) {
        this.setOfficerInCharge(officerInCharge);
        return this;
    }

    public void setOfficerInCharge(String officerInCharge) {
        this.officerInCharge = officerInCharge;
    }

    public Set<Resident> getResidentses() {
        return this.residentses;
    }

    public void setResidentses(Set<Resident> residents) {
        if (this.residentses != null) {
            this.residentses.forEach(i -> i.setHousehold(null));
        }
        if (residents != null) {
            residents.forEach(i -> i.setHousehold(this));
        }
        this.residentses = residents;
    }

    public Household residentses(Set<Resident> residents) {
        this.setResidentses(residents);
        return this;
    }

    public Household addResidents(Resident resident) {
        this.residentses.add(resident);
        resident.setHousehold(this);
        return this;
    }

    public Household removeResidents(Resident resident) {
        this.residentses.remove(resident);
        resident.setHousehold(null);
        return this;
    }

    public AreaZone getAreaZone() {
        return this.areaZone;
    }

    public void setAreaZone(AreaZone areaZone) {
        this.areaZone = areaZone;
    }

    public Household areaZone(AreaZone areaZone) {
        this.setAreaZone(areaZone);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof Household)) {
            return false;
        }
        return getId() != null && getId().equals(((Household) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "Household{" +
            "id=" + getId() +
            ", code='" + getCode() + "'" +
            ", houseNumber='" + getHouseNumber() + "'" +
            ", street='" + getStreet() + "'" +
            ", hamlet='" + getHamlet() + "'" +
            ", neighborhoodGroup='" + getNeighborhoodGroup() + "'" +
            ", alley='" + getAlley() + "'" +
            ", ownerName='" + getOwnerName() + "'" +
            ", ownerPhone='" + getOwnerPhone() + "'" +
            ", type='" + getType() + "'" +
            ", businessName='" + getBusinessName() + "'" +
            ", businessCategory='" + getBusinessCategory() + "'" +
            ", residentsCount=" + getResidentsCount() +
            ", maleCount=" + getMaleCount() +
            ", femaleCount=" + getFemaleCount() +
            ", under18Count=" + getUnder18Count() +
            ", above18Count=" + getAbove18Count() +
            ", status='" + getStatus() + "'" +
            ", warningMessage='" + getWarningMessage() + "'" +
            ", licenseExpiry='" + getLicenseExpiry() + "'" +
            ", licenseType='" + getLicenseType() + "'" +
            ", latitude=" + getLatitude() +
            ", longitude=" + getLongitude() +
            ", notes='" + getNotes() + "'" +
            ", lastCheckedDate='" + getLastCheckedDate() + "'" +
            ", officerInCharge='" + getOfficerInCharge() + "'" +
            "}";
    }
}
