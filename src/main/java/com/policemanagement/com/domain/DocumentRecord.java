package com.policemanagement.com.domain;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import org.hibernate.annotations.Cache;
import org.hibernate.annotations.CacheConcurrencyStrategy;

/**
 * Hồ sơ / Biên bản kiểm tra an ninh trật tự & PCCC
 */
@Entity
@Table(name = "document_record")
@Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
@SuppressWarnings("common-java:DuplicatedBlocks")
public class DocumentRecord implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Column(name = "doc_name", nullable = false)
    private String docName;

    @NotNull
    @Column(name = "doc_type", nullable = false)
    private String docType;

    @Column(name = "household_name")
    private String householdName;

    @Column(name = "address")
    private String address;

    @Column(name = "status")
    private String status;

    @Column(name = "expiry_date")
    private String expiryDate;

    @Column(name = "officer")
    private String officer;

    @Column(name = "phone")
    private String phone;

    @Lob
    @Column(name = "notes", columnDefinition = "text")
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.LONGVARCHAR)
    private String notes;

    @Column(name = "reminder_sent")
    private Boolean reminderSent;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public DocumentRecord id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getDocName() {
        return this.docName;
    }

    public DocumentRecord docName(String docName) {
        this.setDocName(docName);
        return this;
    }

    public void setDocName(String docName) {
        this.docName = docName;
    }

    public String getDocType() {
        return this.docType;
    }

    public DocumentRecord docType(String docType) {
        this.setDocType(docType);
        return this;
    }

    public void setDocType(String docType) {
        this.docType = docType;
    }

    public String getHouseholdName() {
        return this.householdName;
    }

    public DocumentRecord householdName(String householdName) {
        this.setHouseholdName(householdName);
        return this;
    }

    public void setHouseholdName(String householdName) {
        this.householdName = householdName;
    }

    public String getAddress() {
        return this.address;
    }

    public DocumentRecord address(String address) {
        this.setAddress(address);
        return this;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getStatus() {
        return this.status;
    }

    public DocumentRecord status(String status) {
        this.setStatus(status);
        return this;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getExpiryDate() {
        return this.expiryDate;
    }

    public DocumentRecord expiryDate(String expiryDate) {
        this.setExpiryDate(expiryDate);
        return this;
    }

    public void setExpiryDate(String expiryDate) {
        this.expiryDate = expiryDate;
    }

    public String getOfficer() {
        return this.officer;
    }

    public DocumentRecord officer(String officer) {
        this.setOfficer(officer);
        return this;
    }

    public void setOfficer(String officer) {
        this.officer = officer;
    }

    public String getPhone() {
        return this.phone;
    }

    public DocumentRecord phone(String phone) {
        this.setPhone(phone);
        return this;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getNotes() {
        return this.notes;
    }

    public DocumentRecord notes(String notes) {
        this.setNotes(notes);
        return this;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public Boolean getReminderSent() {
        return this.reminderSent;
    }

    public DocumentRecord reminderSent(Boolean reminderSent) {
        this.setReminderSent(reminderSent);
        return this;
    }

    public void setReminderSent(Boolean reminderSent) {
        this.reminderSent = reminderSent;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof DocumentRecord)) {
            return false;
        }
        return getId() != null && getId().equals(((DocumentRecord) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "DocumentRecord{" +
            "id=" + getId() +
            ", docName='" + getDocName() + "'" +
            ", docType='" + getDocType() + "'" +
            ", householdName='" + getHouseholdName() + "'" +
            ", address='" + getAddress() + "'" +
            ", status='" + getStatus() + "'" +
            ", expiryDate='" + getExpiryDate() + "'" +
            ", officer='" + getOfficer() + "'" +
            ", phone='" + getPhone() + "'" +
            ", notes='" + getNotes() + "'" +
            ", reminderSent='" + getReminderSent() + "'" +
            "}";
    }
}
