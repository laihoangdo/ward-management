package com.policemanagement.com.service.dto;

import com.policemanagement.com.domain.enumeration.Gender;
import com.policemanagement.com.domain.enumeration.ResidenceType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.Lob;
import jakarta.validation.constraints.*;
import java.io.Serializable;
import java.time.LocalDate;
import java.util.Objects;

/**
 * A DTO for the {@link com.policemanagement.com.domain.Resident} entity.
 */
@Schema(description = "Nhân khẩu / Cư dân cư trú")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class ResidentDTO implements Serializable {

    private Long id;

    @NotNull
    private String fullName;

    private String idCardNumber;

    private Integer birthYear;

    private Gender gender;

    private String relationship;

    @NotNull
    private ResidenceType residenceType;

    private LocalDate temporaryRegisteredAt;

    @Lob
    private String notes;

    private HouseholdDTO household;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getIdCardNumber() {
        return idCardNumber;
    }

    public void setIdCardNumber(String idCardNumber) {
        this.idCardNumber = idCardNumber;
    }

    public Integer getBirthYear() {
        return birthYear;
    }

    public void setBirthYear(Integer birthYear) {
        this.birthYear = birthYear;
    }

    public Gender getGender() {
        return gender;
    }

    public void setGender(Gender gender) {
        this.gender = gender;
    }

    public String getRelationship() {
        return relationship;
    }

    public void setRelationship(String relationship) {
        this.relationship = relationship;
    }

    public ResidenceType getResidenceType() {
        return residenceType;
    }

    public void setResidenceType(ResidenceType residenceType) {
        this.residenceType = residenceType;
    }

    public LocalDate getTemporaryRegisteredAt() {
        return temporaryRegisteredAt;
    }

    public void setTemporaryRegisteredAt(LocalDate temporaryRegisteredAt) {
        this.temporaryRegisteredAt = temporaryRegisteredAt;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public HouseholdDTO getHousehold() {
        return household;
    }

    public void setHousehold(HouseholdDTO household) {
        this.household = household;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof ResidentDTO)) {
            return false;
        }

        ResidentDTO residentDTO = (ResidentDTO) o;
        if (this.id == null) {
            return false;
        }
        return Objects.equals(this.id, residentDTO.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(this.id);
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "ResidentDTO{" +
            "id=" + getId() +
            ", fullName='" + getFullName() + "'" +
            ", idCardNumber='" + getIdCardNumber() + "'" +
            ", birthYear=" + getBirthYear() +
            ", gender='" + getGender() + "'" +
            ", relationship='" + getRelationship() + "'" +
            ", residenceType='" + getResidenceType() + "'" +
            ", temporaryRegisteredAt='" + getTemporaryRegisteredAt() + "'" +
            ", notes='" + getNotes() + "'" +
            ", household=" + getHousehold() +
            "}";
    }
}
