package com.policemanagement.com.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.policemanagement.com.domain.enumeration.Gender;
import com.policemanagement.com.domain.enumeration.ResidenceType;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDate;
import org.hibernate.annotations.Cache;
import org.hibernate.annotations.CacheConcurrencyStrategy;

/**
 * Nhân khẩu / Cư dân cư trú
 */
@Entity
@Table(name = "resident")
@Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
@SuppressWarnings("common-java:DuplicatedBlocks")
public class Resident implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Column(name = "full_name", nullable = false)
    private String fullName;

    @Column(name = "id_card_number", unique = true)
    private String idCardNumber;

    @Column(name = "birth_year")
    private Integer birthYear;

    @Enumerated(EnumType.STRING)
    @Column(name = "gender")
    private Gender gender;

    @Column(name = "relationship")
    private String relationship;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "residence_type", nullable = false)
    private ResidenceType residenceType;

    @Column(name = "temporary_registered_at")
    private LocalDate temporaryRegisteredAt;

    @Lob
    @Column(name = "notes", columnDefinition = "text")
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.LONGVARCHAR)
    private String notes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JsonIgnoreProperties(value = { "residentses", "areaZone" }, allowSetters = true)
    private Household household;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public Resident id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getFullName() {
        return this.fullName;
    }

    public Resident fullName(String fullName) {
        this.setFullName(fullName);
        return this;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getIdCardNumber() {
        return this.idCardNumber;
    }

    public Resident idCardNumber(String idCardNumber) {
        this.setIdCardNumber(idCardNumber);
        return this;
    }

    public void setIdCardNumber(String idCardNumber) {
        this.idCardNumber = idCardNumber;
    }

    public Integer getBirthYear() {
        return this.birthYear;
    }

    public Resident birthYear(Integer birthYear) {
        this.setBirthYear(birthYear);
        return this;
    }

    public void setBirthYear(Integer birthYear) {
        this.birthYear = birthYear;
    }

    public Gender getGender() {
        return this.gender;
    }

    public Resident gender(Gender gender) {
        this.setGender(gender);
        return this;
    }

    public void setGender(Gender gender) {
        this.gender = gender;
    }

    public String getRelationship() {
        return this.relationship;
    }

    public Resident relationship(String relationship) {
        this.setRelationship(relationship);
        return this;
    }

    public void setRelationship(String relationship) {
        this.relationship = relationship;
    }

    public ResidenceType getResidenceType() {
        return this.residenceType;
    }

    public Resident residenceType(ResidenceType residenceType) {
        this.setResidenceType(residenceType);
        return this;
    }

    public void setResidenceType(ResidenceType residenceType) {
        this.residenceType = residenceType;
    }

    public LocalDate getTemporaryRegisteredAt() {
        return this.temporaryRegisteredAt;
    }

    public Resident temporaryRegisteredAt(LocalDate temporaryRegisteredAt) {
        this.setTemporaryRegisteredAt(temporaryRegisteredAt);
        return this;
    }

    public void setTemporaryRegisteredAt(LocalDate temporaryRegisteredAt) {
        this.temporaryRegisteredAt = temporaryRegisteredAt;
    }

    public String getNotes() {
        return this.notes;
    }

    public Resident notes(String notes) {
        this.setNotes(notes);
        return this;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public Household getHousehold() {
        return this.household;
    }

    public void setHousehold(Household household) {
        this.household = household;
    }

    public Resident household(Household household) {
        this.setHousehold(household);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof Resident)) {
            return false;
        }
        return getId() != null && getId().equals(((Resident) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "Resident{" +
            "id=" + getId() +
            ", fullName='" + getFullName() + "'" +
            ", idCardNumber='" + getIdCardNumber() + "'" +
            ", birthYear=" + getBirthYear() +
            ", gender='" + getGender() + "'" +
            ", relationship='" + getRelationship() + "'" +
            ", residenceType='" + getResidenceType() + "'" +
            ", temporaryRegisteredAt='" + getTemporaryRegisteredAt() + "'" +
            ", notes='" + getNotes() + "'" +
            "}";
    }
}
