package com.policemanagement.com.service.criteria;

import com.policemanagement.com.domain.enumeration.FacilityType;
import com.policemanagement.com.domain.enumeration.SecurityStatus;
import java.io.Serial;
import java.io.Serializable;
import java.util.Objects;
import java.util.Optional;
import org.springdoc.core.annotations.ParameterObject;
import tech.jhipster.service.Criteria;
import tech.jhipster.service.filter.*;

/**
 * Criteria class for the {@link com.policemanagement.com.domain.Household} entity. This class is used
 * in {@link com.policemanagement.com.web.rest.HouseholdResource} to receive all the possible filtering options from
 * the Http GET request parameters.
 * For example the following could be a valid request:
 * {@code /households?id.greaterThan=5&attr1.contains=something&attr2.specified=false}
 * As Spring is unable to properly convert the types, unless specific {@link Filter} class are used, we need to use
 * fix type specific filters.
 */
@ParameterObject
@SuppressWarnings("common-java:DuplicatedBlocks")
public class HouseholdCriteria implements Serializable, Criteria {

    /**
     * Class for filtering FacilityType
     */
    public static class FacilityTypeFilter extends Filter<FacilityType> {

        public FacilityTypeFilter() {}

        public FacilityTypeFilter(FacilityTypeFilter filter) {
            super(filter);
        }

        @Override
        public FacilityTypeFilter copy() {
            return new FacilityTypeFilter(this);
        }
    }

    /**
     * Class for filtering SecurityStatus
     */
    public static class SecurityStatusFilter extends Filter<SecurityStatus> {

        public SecurityStatusFilter() {}

        public SecurityStatusFilter(SecurityStatusFilter filter) {
            super(filter);
        }

        @Override
        public SecurityStatusFilter copy() {
            return new SecurityStatusFilter(this);
        }
    }

    @Serial
    private static final long serialVersionUID = 1L;

    private LongFilter id;

    private StringFilter code;

    private StringFilter houseNumber;

    private StringFilter street;

    private StringFilter hamlet;

    private StringFilter neighborhoodGroup;

    private StringFilter alley;

    private StringFilter ownerName;

    private StringFilter ownerPhone;

    private FacilityTypeFilter type;

    private StringFilter businessName;

    private StringFilter businessCategory;

    private IntegerFilter residentsCount;

    private IntegerFilter maleCount;

    private IntegerFilter femaleCount;

    private IntegerFilter under18Count;

    private IntegerFilter above18Count;

    private SecurityStatusFilter status;

    private StringFilter warningMessage;

    private StringFilter licenseExpiry;

    private StringFilter licenseType;

    private DoubleFilter latitude;

    private DoubleFilter longitude;

    private StringFilter lastCheckedDate;

    private StringFilter officerInCharge;

    private LongFilter residentsId;

    private LongFilter areaZoneId;

    private Boolean distinct;

    public HouseholdCriteria() {}

    public HouseholdCriteria(HouseholdCriteria other) {
        this.id = other.optionalId().map(LongFilter::copy).orElse(null);
        this.code = other.optionalCode().map(StringFilter::copy).orElse(null);
        this.houseNumber = other.optionalHouseNumber().map(StringFilter::copy).orElse(null);
        this.street = other.optionalStreet().map(StringFilter::copy).orElse(null);
        this.hamlet = other.optionalHamlet().map(StringFilter::copy).orElse(null);
        this.neighborhoodGroup = other.optionalNeighborhoodGroup().map(StringFilter::copy).orElse(null);
        this.alley = other.optionalAlley().map(StringFilter::copy).orElse(null);
        this.ownerName = other.optionalOwnerName().map(StringFilter::copy).orElse(null);
        this.ownerPhone = other.optionalOwnerPhone().map(StringFilter::copy).orElse(null);
        this.type = other.optionalType().map(FacilityTypeFilter::copy).orElse(null);
        this.businessName = other.optionalBusinessName().map(StringFilter::copy).orElse(null);
        this.businessCategory = other.optionalBusinessCategory().map(StringFilter::copy).orElse(null);
        this.residentsCount = other.optionalResidentsCount().map(IntegerFilter::copy).orElse(null);
        this.maleCount = other.optionalMaleCount().map(IntegerFilter::copy).orElse(null);
        this.femaleCount = other.optionalFemaleCount().map(IntegerFilter::copy).orElse(null);
        this.under18Count = other.optionalUnder18Count().map(IntegerFilter::copy).orElse(null);
        this.above18Count = other.optionalAbove18Count().map(IntegerFilter::copy).orElse(null);
        this.status = other.optionalStatus().map(SecurityStatusFilter::copy).orElse(null);
        this.warningMessage = other.optionalWarningMessage().map(StringFilter::copy).orElse(null);
        this.licenseExpiry = other.optionalLicenseExpiry().map(StringFilter::copy).orElse(null);
        this.licenseType = other.optionalLicenseType().map(StringFilter::copy).orElse(null);
        this.latitude = other.optionalLatitude().map(DoubleFilter::copy).orElse(null);
        this.longitude = other.optionalLongitude().map(DoubleFilter::copy).orElse(null);
        this.lastCheckedDate = other.optionalLastCheckedDate().map(StringFilter::copy).orElse(null);
        this.officerInCharge = other.optionalOfficerInCharge().map(StringFilter::copy).orElse(null);
        this.residentsId = other.optionalResidentsId().map(LongFilter::copy).orElse(null);
        this.areaZoneId = other.optionalAreaZoneId().map(LongFilter::copy).orElse(null);
        this.distinct = other.distinct;
    }

    @Override
    public HouseholdCriteria copy() {
        return new HouseholdCriteria(this);
    }

    public LongFilter getId() {
        return id;
    }

    public Optional<LongFilter> optionalId() {
        return Optional.ofNullable(id);
    }

    public LongFilter id() {
        if (id == null) {
            setId(new LongFilter());
        }
        return id;
    }

    public void setId(LongFilter id) {
        this.id = id;
    }

    public StringFilter getCode() {
        return code;
    }

    public Optional<StringFilter> optionalCode() {
        return Optional.ofNullable(code);
    }

    public StringFilter code() {
        if (code == null) {
            setCode(new StringFilter());
        }
        return code;
    }

    public void setCode(StringFilter code) {
        this.code = code;
    }

    public StringFilter getHouseNumber() {
        return houseNumber;
    }

    public Optional<StringFilter> optionalHouseNumber() {
        return Optional.ofNullable(houseNumber);
    }

    public StringFilter houseNumber() {
        if (houseNumber == null) {
            setHouseNumber(new StringFilter());
        }
        return houseNumber;
    }

    public void setHouseNumber(StringFilter houseNumber) {
        this.houseNumber = houseNumber;
    }

    public StringFilter getStreet() {
        return street;
    }

    public Optional<StringFilter> optionalStreet() {
        return Optional.ofNullable(street);
    }

    public StringFilter street() {
        if (street == null) {
            setStreet(new StringFilter());
        }
        return street;
    }

    public void setStreet(StringFilter street) {
        this.street = street;
    }

    public StringFilter getHamlet() {
        return hamlet;
    }

    public Optional<StringFilter> optionalHamlet() {
        return Optional.ofNullable(hamlet);
    }

    public StringFilter hamlet() {
        if (hamlet == null) {
            setHamlet(new StringFilter());
        }
        return hamlet;
    }

    public void setHamlet(StringFilter hamlet) {
        this.hamlet = hamlet;
    }

    public StringFilter getNeighborhoodGroup() {
        return neighborhoodGroup;
    }

    public Optional<StringFilter> optionalNeighborhoodGroup() {
        return Optional.ofNullable(neighborhoodGroup);
    }

    public StringFilter neighborhoodGroup() {
        if (neighborhoodGroup == null) {
            setNeighborhoodGroup(new StringFilter());
        }
        return neighborhoodGroup;
    }

    public void setNeighborhoodGroup(StringFilter neighborhoodGroup) {
        this.neighborhoodGroup = neighborhoodGroup;
    }

    public StringFilter getAlley() {
        return alley;
    }

    public Optional<StringFilter> optionalAlley() {
        return Optional.ofNullable(alley);
    }

    public StringFilter alley() {
        if (alley == null) {
            setAlley(new StringFilter());
        }
        return alley;
    }

    public void setAlley(StringFilter alley) {
        this.alley = alley;
    }

    public StringFilter getOwnerName() {
        return ownerName;
    }

    public Optional<StringFilter> optionalOwnerName() {
        return Optional.ofNullable(ownerName);
    }

    public StringFilter ownerName() {
        if (ownerName == null) {
            setOwnerName(new StringFilter());
        }
        return ownerName;
    }

    public void setOwnerName(StringFilter ownerName) {
        this.ownerName = ownerName;
    }

    public StringFilter getOwnerPhone() {
        return ownerPhone;
    }

    public Optional<StringFilter> optionalOwnerPhone() {
        return Optional.ofNullable(ownerPhone);
    }

    public StringFilter ownerPhone() {
        if (ownerPhone == null) {
            setOwnerPhone(new StringFilter());
        }
        return ownerPhone;
    }

    public void setOwnerPhone(StringFilter ownerPhone) {
        this.ownerPhone = ownerPhone;
    }

    public FacilityTypeFilter getType() {
        return type;
    }

    public Optional<FacilityTypeFilter> optionalType() {
        return Optional.ofNullable(type);
    }

    public FacilityTypeFilter type() {
        if (type == null) {
            setType(new FacilityTypeFilter());
        }
        return type;
    }

    public void setType(FacilityTypeFilter type) {
        this.type = type;
    }

    public StringFilter getBusinessName() {
        return businessName;
    }

    public Optional<StringFilter> optionalBusinessName() {
        return Optional.ofNullable(businessName);
    }

    public StringFilter businessName() {
        if (businessName == null) {
            setBusinessName(new StringFilter());
        }
        return businessName;
    }

    public void setBusinessName(StringFilter businessName) {
        this.businessName = businessName;
    }

    public StringFilter getBusinessCategory() {
        return businessCategory;
    }

    public Optional<StringFilter> optionalBusinessCategory() {
        return Optional.ofNullable(businessCategory);
    }

    public StringFilter businessCategory() {
        if (businessCategory == null) {
            setBusinessCategory(new StringFilter());
        }
        return businessCategory;
    }

    public void setBusinessCategory(StringFilter businessCategory) {
        this.businessCategory = businessCategory;
    }

    public IntegerFilter getResidentsCount() {
        return residentsCount;
    }

    public Optional<IntegerFilter> optionalResidentsCount() {
        return Optional.ofNullable(residentsCount);
    }

    public IntegerFilter residentsCount() {
        if (residentsCount == null) {
            setResidentsCount(new IntegerFilter());
        }
        return residentsCount;
    }

    public void setResidentsCount(IntegerFilter residentsCount) {
        this.residentsCount = residentsCount;
    }

    public IntegerFilter getMaleCount() {
        return maleCount;
    }

    public Optional<IntegerFilter> optionalMaleCount() {
        return Optional.ofNullable(maleCount);
    }

    public IntegerFilter maleCount() {
        if (maleCount == null) {
            setMaleCount(new IntegerFilter());
        }
        return maleCount;
    }

    public void setMaleCount(IntegerFilter maleCount) {
        this.maleCount = maleCount;
    }

    public IntegerFilter getFemaleCount() {
        return femaleCount;
    }

    public Optional<IntegerFilter> optionalFemaleCount() {
        return Optional.ofNullable(femaleCount);
    }

    public IntegerFilter femaleCount() {
        if (femaleCount == null) {
            setFemaleCount(new IntegerFilter());
        }
        return femaleCount;
    }

    public void setFemaleCount(IntegerFilter femaleCount) {
        this.femaleCount = femaleCount;
    }

    public IntegerFilter getUnder18Count() {
        return under18Count;
    }

    public Optional<IntegerFilter> optionalUnder18Count() {
        return Optional.ofNullable(under18Count);
    }

    public IntegerFilter under18Count() {
        if (under18Count == null) {
            setUnder18Count(new IntegerFilter());
        }
        return under18Count;
    }

    public void setUnder18Count(IntegerFilter under18Count) {
        this.under18Count = under18Count;
    }

    public IntegerFilter getAbove18Count() {
        return above18Count;
    }

    public Optional<IntegerFilter> optionalAbove18Count() {
        return Optional.ofNullable(above18Count);
    }

    public IntegerFilter above18Count() {
        if (above18Count == null) {
            setAbove18Count(new IntegerFilter());
        }
        return above18Count;
    }

    public void setAbove18Count(IntegerFilter above18Count) {
        this.above18Count = above18Count;
    }

    public SecurityStatusFilter getStatus() {
        return status;
    }

    public Optional<SecurityStatusFilter> optionalStatus() {
        return Optional.ofNullable(status);
    }

    public SecurityStatusFilter status() {
        if (status == null) {
            setStatus(new SecurityStatusFilter());
        }
        return status;
    }

    public void setStatus(SecurityStatusFilter status) {
        this.status = status;
    }

    public StringFilter getWarningMessage() {
        return warningMessage;
    }

    public Optional<StringFilter> optionalWarningMessage() {
        return Optional.ofNullable(warningMessage);
    }

    public StringFilter warningMessage() {
        if (warningMessage == null) {
            setWarningMessage(new StringFilter());
        }
        return warningMessage;
    }

    public void setWarningMessage(StringFilter warningMessage) {
        this.warningMessage = warningMessage;
    }

    public StringFilter getLicenseExpiry() {
        return licenseExpiry;
    }

    public Optional<StringFilter> optionalLicenseExpiry() {
        return Optional.ofNullable(licenseExpiry);
    }

    public StringFilter licenseExpiry() {
        if (licenseExpiry == null) {
            setLicenseExpiry(new StringFilter());
        }
        return licenseExpiry;
    }

    public void setLicenseExpiry(StringFilter licenseExpiry) {
        this.licenseExpiry = licenseExpiry;
    }

    public StringFilter getLicenseType() {
        return licenseType;
    }

    public Optional<StringFilter> optionalLicenseType() {
        return Optional.ofNullable(licenseType);
    }

    public StringFilter licenseType() {
        if (licenseType == null) {
            setLicenseType(new StringFilter());
        }
        return licenseType;
    }

    public void setLicenseType(StringFilter licenseType) {
        this.licenseType = licenseType;
    }

    public DoubleFilter getLatitude() {
        return latitude;
    }

    public Optional<DoubleFilter> optionalLatitude() {
        return Optional.ofNullable(latitude);
    }

    public DoubleFilter latitude() {
        if (latitude == null) {
            setLatitude(new DoubleFilter());
        }
        return latitude;
    }

    public void setLatitude(DoubleFilter latitude) {
        this.latitude = latitude;
    }

    public DoubleFilter getLongitude() {
        return longitude;
    }

    public Optional<DoubleFilter> optionalLongitude() {
        return Optional.ofNullable(longitude);
    }

    public DoubleFilter longitude() {
        if (longitude == null) {
            setLongitude(new DoubleFilter());
        }
        return longitude;
    }

    public void setLongitude(DoubleFilter longitude) {
        this.longitude = longitude;
    }

    public StringFilter getLastCheckedDate() {
        return lastCheckedDate;
    }

    public Optional<StringFilter> optionalLastCheckedDate() {
        return Optional.ofNullable(lastCheckedDate);
    }

    public StringFilter lastCheckedDate() {
        if (lastCheckedDate == null) {
            setLastCheckedDate(new StringFilter());
        }
        return lastCheckedDate;
    }

    public void setLastCheckedDate(StringFilter lastCheckedDate) {
        this.lastCheckedDate = lastCheckedDate;
    }

    public StringFilter getOfficerInCharge() {
        return officerInCharge;
    }

    public Optional<StringFilter> optionalOfficerInCharge() {
        return Optional.ofNullable(officerInCharge);
    }

    public StringFilter officerInCharge() {
        if (officerInCharge == null) {
            setOfficerInCharge(new StringFilter());
        }
        return officerInCharge;
    }

    public void setOfficerInCharge(StringFilter officerInCharge) {
        this.officerInCharge = officerInCharge;
    }

    public LongFilter getResidentsId() {
        return residentsId;
    }

    public Optional<LongFilter> optionalResidentsId() {
        return Optional.ofNullable(residentsId);
    }

    public LongFilter residentsId() {
        if (residentsId == null) {
            setResidentsId(new LongFilter());
        }
        return residentsId;
    }

    public void setResidentsId(LongFilter residentsId) {
        this.residentsId = residentsId;
    }

    public LongFilter getAreaZoneId() {
        return areaZoneId;
    }

    public Optional<LongFilter> optionalAreaZoneId() {
        return Optional.ofNullable(areaZoneId);
    }

    public LongFilter areaZoneId() {
        if (areaZoneId == null) {
            setAreaZoneId(new LongFilter());
        }
        return areaZoneId;
    }

    public void setAreaZoneId(LongFilter areaZoneId) {
        this.areaZoneId = areaZoneId;
    }

    public Boolean getDistinct() {
        return distinct;
    }

    public Optional<Boolean> optionalDistinct() {
        return Optional.ofNullable(distinct);
    }

    public Boolean distinct() {
        if (distinct == null) {
            setDistinct(true);
        }
        return distinct;
    }

    public void setDistinct(Boolean distinct) {
        this.distinct = distinct;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        final HouseholdCriteria that = (HouseholdCriteria) o;
        return (
            Objects.equals(id, that.id) &&
            Objects.equals(code, that.code) &&
            Objects.equals(houseNumber, that.houseNumber) &&
            Objects.equals(street, that.street) &&
            Objects.equals(hamlet, that.hamlet) &&
            Objects.equals(neighborhoodGroup, that.neighborhoodGroup) &&
            Objects.equals(alley, that.alley) &&
            Objects.equals(ownerName, that.ownerName) &&
            Objects.equals(ownerPhone, that.ownerPhone) &&
            Objects.equals(type, that.type) &&
            Objects.equals(businessName, that.businessName) &&
            Objects.equals(businessCategory, that.businessCategory) &&
            Objects.equals(residentsCount, that.residentsCount) &&
            Objects.equals(maleCount, that.maleCount) &&
            Objects.equals(femaleCount, that.femaleCount) &&
            Objects.equals(under18Count, that.under18Count) &&
            Objects.equals(above18Count, that.above18Count) &&
            Objects.equals(status, that.status) &&
            Objects.equals(warningMessage, that.warningMessage) &&
            Objects.equals(licenseExpiry, that.licenseExpiry) &&
            Objects.equals(licenseType, that.licenseType) &&
            Objects.equals(latitude, that.latitude) &&
            Objects.equals(longitude, that.longitude) &&
            Objects.equals(lastCheckedDate, that.lastCheckedDate) &&
            Objects.equals(officerInCharge, that.officerInCharge) &&
            Objects.equals(residentsId, that.residentsId) &&
            Objects.equals(areaZoneId, that.areaZoneId) &&
            Objects.equals(distinct, that.distinct)
        );
    }

    @Override
    public int hashCode() {
        return Objects.hash(
            id,
            code,
            houseNumber,
            street,
            hamlet,
            neighborhoodGroup,
            alley,
            ownerName,
            ownerPhone,
            type,
            businessName,
            businessCategory,
            residentsCount,
            maleCount,
            femaleCount,
            under18Count,
            above18Count,
            status,
            warningMessage,
            licenseExpiry,
            licenseType,
            latitude,
            longitude,
            lastCheckedDate,
            officerInCharge,
            residentsId,
            areaZoneId,
            distinct
        );
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "HouseholdCriteria{" +
            optionalId().map(f -> "id=" + f + ", ").orElse("") +
            optionalCode().map(f -> "code=" + f + ", ").orElse("") +
            optionalHouseNumber().map(f -> "houseNumber=" + f + ", ").orElse("") +
            optionalStreet().map(f -> "street=" + f + ", ").orElse("") +
            optionalHamlet().map(f -> "hamlet=" + f + ", ").orElse("") +
            optionalNeighborhoodGroup().map(f -> "neighborhoodGroup=" + f + ", ").orElse("") +
            optionalAlley().map(f -> "alley=" + f + ", ").orElse("") +
            optionalOwnerName().map(f -> "ownerName=" + f + ", ").orElse("") +
            optionalOwnerPhone().map(f -> "ownerPhone=" + f + ", ").orElse("") +
            optionalType().map(f -> "type=" + f + ", ").orElse("") +
            optionalBusinessName().map(f -> "businessName=" + f + ", ").orElse("") +
            optionalBusinessCategory().map(f -> "businessCategory=" + f + ", ").orElse("") +
            optionalResidentsCount().map(f -> "residentsCount=" + f + ", ").orElse("") +
            optionalMaleCount().map(f -> "maleCount=" + f + ", ").orElse("") +
            optionalFemaleCount().map(f -> "femaleCount=" + f + ", ").orElse("") +
            optionalUnder18Count().map(f -> "under18Count=" + f + ", ").orElse("") +
            optionalAbove18Count().map(f -> "above18Count=" + f + ", ").orElse("") +
            optionalStatus().map(f -> "status=" + f + ", ").orElse("") +
            optionalWarningMessage().map(f -> "warningMessage=" + f + ", ").orElse("") +
            optionalLicenseExpiry().map(f -> "licenseExpiry=" + f + ", ").orElse("") +
            optionalLicenseType().map(f -> "licenseType=" + f + ", ").orElse("") +
            optionalLatitude().map(f -> "latitude=" + f + ", ").orElse("") +
            optionalLongitude().map(f -> "longitude=" + f + ", ").orElse("") +
            optionalLastCheckedDate().map(f -> "lastCheckedDate=" + f + ", ").orElse("") +
            optionalOfficerInCharge().map(f -> "officerInCharge=" + f + ", ").orElse("") +
            optionalResidentsId().map(f -> "residentsId=" + f + ", ").orElse("") +
            optionalAreaZoneId().map(f -> "areaZoneId=" + f + ", ").orElse("") +
            optionalDistinct().map(f -> "distinct=" + f + ", ").orElse("") +
        "}";
    }
}
