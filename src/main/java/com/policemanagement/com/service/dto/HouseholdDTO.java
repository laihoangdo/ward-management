package com.policemanagement.com.service.dto;

import com.policemanagement.com.domain.enumeration.FacilityType;
import com.policemanagement.com.domain.enumeration.SecurityStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.Lob;
import jakarta.validation.constraints.*;
import java.io.Serializable;
import java.util.Objects;

/**
 * A DTO for the {@link com.policemanagement.com.domain.Household} entity.
 */
@Schema(description = "Hộ gia đình / Cơ sở kinh doanh trên địa bàn")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class HouseholdDTO implements Serializable {

    private Long id;

    @NotNull
    private String code;

    @NotNull
    private String houseNumber;

    @NotNull
    private String street;

    @NotNull
    private String hamlet;

    private String neighborhoodGroup;

    private String alley;

    @NotNull
    private String ownerName;

    @NotNull
    private String ownerPhone;

    @NotNull
    private FacilityType type;

    private String businessName;

    private String businessCategory;

    private Integer residentsCount;

    private Integer maleCount;

    private Integer femaleCount;

    private Integer under18Count;

    private Integer above18Count;

    private SecurityStatus status;

    private String warningMessage;

    private String licenseExpiry;

    private String licenseType;

    private Double latitude;

    private Double longitude;

    @Lob
    private String notes;

    private String lastCheckedDate;

    private String officerInCharge;

    private AreaZoneDTO areaZone;

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

    public String getHouseNumber() {
        return houseNumber;
    }

    public void setHouseNumber(String houseNumber) {
        this.houseNumber = houseNumber;
    }

    public String getStreet() {
        return street;
    }

    public void setStreet(String street) {
        this.street = street;
    }

    public String getHamlet() {
        return hamlet;
    }

    public void setHamlet(String hamlet) {
        this.hamlet = hamlet;
    }

    public String getNeighborhoodGroup() {
        return neighborhoodGroup;
    }

    public void setNeighborhoodGroup(String neighborhoodGroup) {
        this.neighborhoodGroup = neighborhoodGroup;
    }

    public String getAlley() {
        return alley;
    }

    public void setAlley(String alley) {
        this.alley = alley;
    }

    public String getOwnerName() {
        return ownerName;
    }

    public void setOwnerName(String ownerName) {
        this.ownerName = ownerName;
    }

    public String getOwnerPhone() {
        return ownerPhone;
    }

    public void setOwnerPhone(String ownerPhone) {
        this.ownerPhone = ownerPhone;
    }

    public FacilityType getType() {
        return type;
    }

    public void setType(FacilityType type) {
        this.type = type;
    }

    public String getBusinessName() {
        return businessName;
    }

    public void setBusinessName(String businessName) {
        this.businessName = businessName;
    }

    public String getBusinessCategory() {
        return businessCategory;
    }

    public void setBusinessCategory(String businessCategory) {
        this.businessCategory = businessCategory;
    }

    public Integer getResidentsCount() {
        return residentsCount;
    }

    public void setResidentsCount(Integer residentsCount) {
        this.residentsCount = residentsCount;
    }

    public Integer getMaleCount() {
        return maleCount;
    }

    public void setMaleCount(Integer maleCount) {
        this.maleCount = maleCount;
    }

    public Integer getFemaleCount() {
        return femaleCount;
    }

    public void setFemaleCount(Integer femaleCount) {
        this.femaleCount = femaleCount;
    }

    public Integer getUnder18Count() {
        return under18Count;
    }

    public void setUnder18Count(Integer under18Count) {
        this.under18Count = under18Count;
    }

    public Integer getAbove18Count() {
        return above18Count;
    }

    public void setAbove18Count(Integer above18Count) {
        this.above18Count = above18Count;
    }

    public SecurityStatus getStatus() {
        return status;
    }

    public void setStatus(SecurityStatus status) {
        this.status = status;
    }

    public String getWarningMessage() {
        return warningMessage;
    }

    public void setWarningMessage(String warningMessage) {
        this.warningMessage = warningMessage;
    }

    public String getLicenseExpiry() {
        return licenseExpiry;
    }

    public void setLicenseExpiry(String licenseExpiry) {
        this.licenseExpiry = licenseExpiry;
    }

    public String getLicenseType() {
        return licenseType;
    }

    public void setLicenseType(String licenseType) {
        this.licenseType = licenseType;
    }

    public Double getLatitude() {
        return latitude;
    }

    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public String getLastCheckedDate() {
        return lastCheckedDate;
    }

    public void setLastCheckedDate(String lastCheckedDate) {
        this.lastCheckedDate = lastCheckedDate;
    }

    public String getOfficerInCharge() {
        return officerInCharge;
    }

    public void setOfficerInCharge(String officerInCharge) {
        this.officerInCharge = officerInCharge;
    }

    public AreaZoneDTO getAreaZone() {
        return areaZone;
    }

    public void setAreaZone(AreaZoneDTO areaZone) {
        this.areaZone = areaZone;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof HouseholdDTO)) {
            return false;
        }

        HouseholdDTO householdDTO = (HouseholdDTO) o;
        if (this.id == null) {
            return false;
        }
        return Objects.equals(this.id, householdDTO.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(this.id);
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "HouseholdDTO{" +
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
            ", areaZone=" + getAreaZone() +
            "}";
    }
}
