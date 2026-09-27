package com.policemanagement.com.service.criteria;

import java.io.Serial;
import java.io.Serializable;
import java.util.Objects;
import java.util.Optional;
import org.springdoc.core.annotations.ParameterObject;
import tech.jhipster.service.Criteria;
import tech.jhipster.service.filter.*;

/**
 * Criteria class for the {@link com.policemanagement.com.domain.DocumentRecord} entity. This class is used
 * in {@link com.policemanagement.com.web.rest.DocumentRecordResource} to receive all the possible filtering options from
 * the Http GET request parameters.
 * For example the following could be a valid request:
 * {@code /document-records?id.greaterThan=5&attr1.contains=something&attr2.specified=false}
 * As Spring is unable to properly convert the types, unless specific {@link Filter} class are used, we need to use
 * fix type specific filters.
 */
@ParameterObject
@SuppressWarnings("common-java:DuplicatedBlocks")
public class DocumentRecordCriteria implements Serializable, Criteria {

    @Serial
    private static final long serialVersionUID = 1L;

    private LongFilter id;

    private StringFilter docName;

    private StringFilter docType;

    private StringFilter householdName;

    private StringFilter address;

    private StringFilter status;

    private StringFilter expiryDate;

    private StringFilter officer;

    private StringFilter phone;

    private BooleanFilter reminderSent;

    private Boolean distinct;

    public DocumentRecordCriteria() {}

    public DocumentRecordCriteria(DocumentRecordCriteria other) {
        this.id = other.optionalId().map(LongFilter::copy).orElse(null);
        this.docName = other.optionalDocName().map(StringFilter::copy).orElse(null);
        this.docType = other.optionalDocType().map(StringFilter::copy).orElse(null);
        this.householdName = other.optionalHouseholdName().map(StringFilter::copy).orElse(null);
        this.address = other.optionalAddress().map(StringFilter::copy).orElse(null);
        this.status = other.optionalStatus().map(StringFilter::copy).orElse(null);
        this.expiryDate = other.optionalExpiryDate().map(StringFilter::copy).orElse(null);
        this.officer = other.optionalOfficer().map(StringFilter::copy).orElse(null);
        this.phone = other.optionalPhone().map(StringFilter::copy).orElse(null);
        this.reminderSent = other.optionalReminderSent().map(BooleanFilter::copy).orElse(null);
        this.distinct = other.distinct;
    }

    @Override
    public DocumentRecordCriteria copy() {
        return new DocumentRecordCriteria(this);
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

    public StringFilter getDocName() {
        return docName;
    }

    public Optional<StringFilter> optionalDocName() {
        return Optional.ofNullable(docName);
    }

    public StringFilter docName() {
        if (docName == null) {
            setDocName(new StringFilter());
        }
        return docName;
    }

    public void setDocName(StringFilter docName) {
        this.docName = docName;
    }

    public StringFilter getDocType() {
        return docType;
    }

    public Optional<StringFilter> optionalDocType() {
        return Optional.ofNullable(docType);
    }

    public StringFilter docType() {
        if (docType == null) {
            setDocType(new StringFilter());
        }
        return docType;
    }

    public void setDocType(StringFilter docType) {
        this.docType = docType;
    }

    public StringFilter getHouseholdName() {
        return householdName;
    }

    public Optional<StringFilter> optionalHouseholdName() {
        return Optional.ofNullable(householdName);
    }

    public StringFilter householdName() {
        if (householdName == null) {
            setHouseholdName(new StringFilter());
        }
        return householdName;
    }

    public void setHouseholdName(StringFilter householdName) {
        this.householdName = householdName;
    }

    public StringFilter getAddress() {
        return address;
    }

    public Optional<StringFilter> optionalAddress() {
        return Optional.ofNullable(address);
    }

    public StringFilter address() {
        if (address == null) {
            setAddress(new StringFilter());
        }
        return address;
    }

    public void setAddress(StringFilter address) {
        this.address = address;
    }

    public StringFilter getStatus() {
        return status;
    }

    public Optional<StringFilter> optionalStatus() {
        return Optional.ofNullable(status);
    }

    public StringFilter status() {
        if (status == null) {
            setStatus(new StringFilter());
        }
        return status;
    }

    public void setStatus(StringFilter status) {
        this.status = status;
    }

    public StringFilter getExpiryDate() {
        return expiryDate;
    }

    public Optional<StringFilter> optionalExpiryDate() {
        return Optional.ofNullable(expiryDate);
    }

    public StringFilter expiryDate() {
        if (expiryDate == null) {
            setExpiryDate(new StringFilter());
        }
        return expiryDate;
    }

    public void setExpiryDate(StringFilter expiryDate) {
        this.expiryDate = expiryDate;
    }

    public StringFilter getOfficer() {
        return officer;
    }

    public Optional<StringFilter> optionalOfficer() {
        return Optional.ofNullable(officer);
    }

    public StringFilter officer() {
        if (officer == null) {
            setOfficer(new StringFilter());
        }
        return officer;
    }

    public void setOfficer(StringFilter officer) {
        this.officer = officer;
    }

    public StringFilter getPhone() {
        return phone;
    }

    public Optional<StringFilter> optionalPhone() {
        return Optional.ofNullable(phone);
    }

    public StringFilter phone() {
        if (phone == null) {
            setPhone(new StringFilter());
        }
        return phone;
    }

    public void setPhone(StringFilter phone) {
        this.phone = phone;
    }

    public BooleanFilter getReminderSent() {
        return reminderSent;
    }

    public Optional<BooleanFilter> optionalReminderSent() {
        return Optional.ofNullable(reminderSent);
    }

    public BooleanFilter reminderSent() {
        if (reminderSent == null) {
            setReminderSent(new BooleanFilter());
        }
        return reminderSent;
    }

    public void setReminderSent(BooleanFilter reminderSent) {
        this.reminderSent = reminderSent;
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
        final DocumentRecordCriteria that = (DocumentRecordCriteria) o;
        return (
            Objects.equals(id, that.id) &&
            Objects.equals(docName, that.docName) &&
            Objects.equals(docType, that.docType) &&
            Objects.equals(householdName, that.householdName) &&
            Objects.equals(address, that.address) &&
            Objects.equals(status, that.status) &&
            Objects.equals(expiryDate, that.expiryDate) &&
            Objects.equals(officer, that.officer) &&
            Objects.equals(phone, that.phone) &&
            Objects.equals(reminderSent, that.reminderSent) &&
            Objects.equals(distinct, that.distinct)
        );
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, docName, docType, householdName, address, status, expiryDate, officer, phone, reminderSent, distinct);
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "DocumentRecordCriteria{" +
            optionalId().map(f -> "id=" + f + ", ").orElse("") +
            optionalDocName().map(f -> "docName=" + f + ", ").orElse("") +
            optionalDocType().map(f -> "docType=" + f + ", ").orElse("") +
            optionalHouseholdName().map(f -> "householdName=" + f + ", ").orElse("") +
            optionalAddress().map(f -> "address=" + f + ", ").orElse("") +
            optionalStatus().map(f -> "status=" + f + ", ").orElse("") +
            optionalExpiryDate().map(f -> "expiryDate=" + f + ", ").orElse("") +
            optionalOfficer().map(f -> "officer=" + f + ", ").orElse("") +
            optionalPhone().map(f -> "phone=" + f + ", ").orElse("") +
            optionalReminderSent().map(f -> "reminderSent=" + f + ", ").orElse("") +
            optionalDistinct().map(f -> "distinct=" + f + ", ").orElse("") +
        "}";
    }
}
