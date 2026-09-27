package com.policemanagement.com.service.criteria;

import com.policemanagement.com.domain.enumeration.Gender;
import com.policemanagement.com.domain.enumeration.ResidenceType;
import java.io.Serial;
import java.io.Serializable;
import java.util.Objects;
import java.util.Optional;
import org.springdoc.core.annotations.ParameterObject;
import tech.jhipster.service.Criteria;
import tech.jhipster.service.filter.*;

/**
 * Criteria class for the {@link com.policemanagement.com.domain.Resident} entity. This class is used
 * in {@link com.policemanagement.com.web.rest.ResidentResource} to receive all the possible filtering options from
 * the Http GET request parameters.
 * For example the following could be a valid request:
 * {@code /residents?id.greaterThan=5&attr1.contains=something&attr2.specified=false}
 * As Spring is unable to properly convert the types, unless specific {@link Filter} class are used, we need to use
 * fix type specific filters.
 */
@ParameterObject
@SuppressWarnings("common-java:DuplicatedBlocks")
public class ResidentCriteria implements Serializable, Criteria {

    /**
     * Class for filtering Gender
     */
    public static class GenderFilter extends Filter<Gender> {

        public GenderFilter() {}

        public GenderFilter(GenderFilter filter) {
            super(filter);
        }

        @Override
        public GenderFilter copy() {
            return new GenderFilter(this);
        }
    }

    /**
     * Class for filtering ResidenceType
     */
    public static class ResidenceTypeFilter extends Filter<ResidenceType> {

        public ResidenceTypeFilter() {}

        public ResidenceTypeFilter(ResidenceTypeFilter filter) {
            super(filter);
        }

        @Override
        public ResidenceTypeFilter copy() {
            return new ResidenceTypeFilter(this);
        }
    }

    @Serial
    private static final long serialVersionUID = 1L;

    private LongFilter id;

    private StringFilter fullName;

    private StringFilter idCardNumber;

    private IntegerFilter birthYear;

    private GenderFilter gender;

    private StringFilter relationship;

    private ResidenceTypeFilter residenceType;

    private LocalDateFilter temporaryRegisteredAt;

    private LongFilter householdId;

    private Boolean distinct;

    public ResidentCriteria() {}

    public ResidentCriteria(ResidentCriteria other) {
        this.id = other.optionalId().map(LongFilter::copy).orElse(null);
        this.fullName = other.optionalFullName().map(StringFilter::copy).orElse(null);
        this.idCardNumber = other.optionalIdCardNumber().map(StringFilter::copy).orElse(null);
        this.birthYear = other.optionalBirthYear().map(IntegerFilter::copy).orElse(null);
        this.gender = other.optionalGender().map(GenderFilter::copy).orElse(null);
        this.relationship = other.optionalRelationship().map(StringFilter::copy).orElse(null);
        this.residenceType = other.optionalResidenceType().map(ResidenceTypeFilter::copy).orElse(null);
        this.temporaryRegisteredAt = other.optionalTemporaryRegisteredAt().map(LocalDateFilter::copy).orElse(null);
        this.householdId = other.optionalHouseholdId().map(LongFilter::copy).orElse(null);
        this.distinct = other.distinct;
    }

    @Override
    public ResidentCriteria copy() {
        return new ResidentCriteria(this);
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

    public StringFilter getFullName() {
        return fullName;
    }

    public Optional<StringFilter> optionalFullName() {
        return Optional.ofNullable(fullName);
    }

    public StringFilter fullName() {
        if (fullName == null) {
            setFullName(new StringFilter());
        }
        return fullName;
    }

    public void setFullName(StringFilter fullName) {
        this.fullName = fullName;
    }

    public StringFilter getIdCardNumber() {
        return idCardNumber;
    }

    public Optional<StringFilter> optionalIdCardNumber() {
        return Optional.ofNullable(idCardNumber);
    }

    public StringFilter idCardNumber() {
        if (idCardNumber == null) {
            setIdCardNumber(new StringFilter());
        }
        return idCardNumber;
    }

    public void setIdCardNumber(StringFilter idCardNumber) {
        this.idCardNumber = idCardNumber;
    }

    public IntegerFilter getBirthYear() {
        return birthYear;
    }

    public Optional<IntegerFilter> optionalBirthYear() {
        return Optional.ofNullable(birthYear);
    }

    public IntegerFilter birthYear() {
        if (birthYear == null) {
            setBirthYear(new IntegerFilter());
        }
        return birthYear;
    }

    public void setBirthYear(IntegerFilter birthYear) {
        this.birthYear = birthYear;
    }

    public GenderFilter getGender() {
        return gender;
    }

    public Optional<GenderFilter> optionalGender() {
        return Optional.ofNullable(gender);
    }

    public GenderFilter gender() {
        if (gender == null) {
            setGender(new GenderFilter());
        }
        return gender;
    }

    public void setGender(GenderFilter gender) {
        this.gender = gender;
    }

    public StringFilter getRelationship() {
        return relationship;
    }

    public Optional<StringFilter> optionalRelationship() {
        return Optional.ofNullable(relationship);
    }

    public StringFilter relationship() {
        if (relationship == null) {
            setRelationship(new StringFilter());
        }
        return relationship;
    }

    public void setRelationship(StringFilter relationship) {
        this.relationship = relationship;
    }

    public ResidenceTypeFilter getResidenceType() {
        return residenceType;
    }

    public Optional<ResidenceTypeFilter> optionalResidenceType() {
        return Optional.ofNullable(residenceType);
    }

    public ResidenceTypeFilter residenceType() {
        if (residenceType == null) {
            setResidenceType(new ResidenceTypeFilter());
        }
        return residenceType;
    }

    public void setResidenceType(ResidenceTypeFilter residenceType) {
        this.residenceType = residenceType;
    }

    public LocalDateFilter getTemporaryRegisteredAt() {
        return temporaryRegisteredAt;
    }

    public Optional<LocalDateFilter> optionalTemporaryRegisteredAt() {
        return Optional.ofNullable(temporaryRegisteredAt);
    }

    public LocalDateFilter temporaryRegisteredAt() {
        if (temporaryRegisteredAt == null) {
            setTemporaryRegisteredAt(new LocalDateFilter());
        }
        return temporaryRegisteredAt;
    }

    public void setTemporaryRegisteredAt(LocalDateFilter temporaryRegisteredAt) {
        this.temporaryRegisteredAt = temporaryRegisteredAt;
    }

    public LongFilter getHouseholdId() {
        return householdId;
    }

    public Optional<LongFilter> optionalHouseholdId() {
        return Optional.ofNullable(householdId);
    }

    public LongFilter householdId() {
        if (householdId == null) {
            setHouseholdId(new LongFilter());
        }
        return householdId;
    }

    public void setHouseholdId(LongFilter householdId) {
        this.householdId = householdId;
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
        final ResidentCriteria that = (ResidentCriteria) o;
        return (
            Objects.equals(id, that.id) &&
            Objects.equals(fullName, that.fullName) &&
            Objects.equals(idCardNumber, that.idCardNumber) &&
            Objects.equals(birthYear, that.birthYear) &&
            Objects.equals(gender, that.gender) &&
            Objects.equals(relationship, that.relationship) &&
            Objects.equals(residenceType, that.residenceType) &&
            Objects.equals(temporaryRegisteredAt, that.temporaryRegisteredAt) &&
            Objects.equals(householdId, that.householdId) &&
            Objects.equals(distinct, that.distinct)
        );
    }

    @Override
    public int hashCode() {
        return Objects.hash(
            id,
            fullName,
            idCardNumber,
            birthYear,
            gender,
            relationship,
            residenceType,
            temporaryRegisteredAt,
            householdId,
            distinct
        );
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "ResidentCriteria{" +
            optionalId().map(f -> "id=" + f + ", ").orElse("") +
            optionalFullName().map(f -> "fullName=" + f + ", ").orElse("") +
            optionalIdCardNumber().map(f -> "idCardNumber=" + f + ", ").orElse("") +
            optionalBirthYear().map(f -> "birthYear=" + f + ", ").orElse("") +
            optionalGender().map(f -> "gender=" + f + ", ").orElse("") +
            optionalRelationship().map(f -> "relationship=" + f + ", ").orElse("") +
            optionalResidenceType().map(f -> "residenceType=" + f + ", ").orElse("") +
            optionalTemporaryRegisteredAt().map(f -> "temporaryRegisteredAt=" + f + ", ").orElse("") +
            optionalHouseholdId().map(f -> "householdId=" + f + ", ").orElse("") +
            optionalDistinct().map(f -> "distinct=" + f + ", ").orElse("") +
        "}";
    }
}
