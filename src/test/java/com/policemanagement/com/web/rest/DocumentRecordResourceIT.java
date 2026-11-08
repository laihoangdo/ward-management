package com.policemanagement.com.web.rest;

import static com.policemanagement.com.domain.DocumentRecordAsserts.*;
import static com.policemanagement.com.web.rest.TestUtil.createUpdateProxyForBean;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.policemanagement.com.IntegrationTest;
import com.policemanagement.com.domain.DocumentRecord;
import com.policemanagement.com.repository.DocumentRecordRepository;
import com.policemanagement.com.service.dto.DocumentRecordDTO;
import com.policemanagement.com.service.mapper.DocumentRecordMapper;
import jakarta.persistence.EntityManager;
import java.util.Random;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * Integration tests for the {@link DocumentRecordResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class DocumentRecordResourceIT {

    private static final String DEFAULT_DOC_NAME = "AAAAAAAAAA";
    private static final String UPDATED_DOC_NAME = "BBBBBBBBBB";

    private static final String DEFAULT_DOC_TYPE = "AAAAAAAAAA";
    private static final String UPDATED_DOC_TYPE = "BBBBBBBBBB";

    private static final String DEFAULT_HOUSEHOLD_NAME = "AAAAAAAAAA";
    private static final String UPDATED_HOUSEHOLD_NAME = "BBBBBBBBBB";

    private static final String DEFAULT_ADDRESS = "AAAAAAAAAA";
    private static final String UPDATED_ADDRESS = "BBBBBBBBBB";

    private static final String DEFAULT_STATUS = "AAAAAAAAAA";
    private static final String UPDATED_STATUS = "BBBBBBBBBB";

    private static final String DEFAULT_EXPIRY_DATE = "AAAAAAAAAA";
    private static final String UPDATED_EXPIRY_DATE = "BBBBBBBBBB";

    private static final String DEFAULT_OFFICER = "AAAAAAAAAA";
    private static final String UPDATED_OFFICER = "BBBBBBBBBB";

    private static final String DEFAULT_PHONE = "AAAAAAAAAA";
    private static final String UPDATED_PHONE = "BBBBBBBBBB";

    private static final String DEFAULT_NOTES = "AAAAAAAAAA";
    private static final String UPDATED_NOTES = "BBBBBBBBBB";

    private static final Boolean DEFAULT_REMINDER_SENT = false;
    private static final Boolean UPDATED_REMINDER_SENT = true;

    private static final String ENTITY_API_URL = "/api/document-records";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + 2L * Integer.MAX_VALUE);

    @Autowired
    private ObjectMapper om;

    @Autowired
    private DocumentRecordRepository documentRecordRepository;

    @Autowired
    private DocumentRecordMapper documentRecordMapper;

    @Autowired
    private EntityManager em;

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbc;

    private Long householdId;

    @Autowired
    private MockMvc restDocumentRecordMockMvc;

    @org.springframework.test.context.bean.override.mockito.MockitoSpyBean
    private com.policemanagement.com.service.rbac.RbacService rbac;

    private DocumentRecord documentRecord;

    private DocumentRecord insertedDocumentRecord;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static DocumentRecord createEntity() {
        return new DocumentRecord()
            .docName(DEFAULT_DOC_NAME)
            .docType(DEFAULT_DOC_TYPE)
            .householdName(DEFAULT_HOUSEHOLD_NAME)
            .address(DEFAULT_ADDRESS)
            .status(DEFAULT_STATUS)
            .expiryDate(DEFAULT_EXPIRY_DATE)
            .officer(DEFAULT_OFFICER)
            .phone(DEFAULT_PHONE)
            .notes(DEFAULT_NOTES)
            .reminderSent(DEFAULT_REMINDER_SENT);
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static DocumentRecord createUpdatedEntity() {
        return new DocumentRecord()
            .docName(UPDATED_DOC_NAME)
            .docType(UPDATED_DOC_TYPE)
            .householdName(UPDATED_HOUSEHOLD_NAME)
            .address(UPDATED_ADDRESS)
            .status(UPDATED_STATUS)
            .expiryDate(UPDATED_EXPIRY_DATE)
            .officer(UPDATED_OFFICER)
            .phone(UPDATED_PHONE)
            .notes(UPDATED_NOTES)
            .reminderSent(UPDATED_REMINDER_SENT);
    }

    /**
     * Registers the fixture through the audited document workflow contract (actor, reason, request ID, REGISTER at
     * version 0, confirmed expiry, household, verifier = actor), then clears the workflow settings so REST calls in the
     * same transaction meet the database exactly as production legacy clients do.
     */
    private DocumentRecord persistDocument(DocumentRecord d) {
        em.flush();
        workflow("integration-test", "Integration test fixture", "REGISTER", java.util.UUID.randomUUID().toString(), "fixture");
        Long id = jdbc.queryForObject(
            "insert into document_record (id, doc_name, doc_type, household_name, address, status, expiry_date, officer, phone, notes," +
                " reminder_sent, household_id, expiry_on, verified_by, verified_at, version)" +
                " values (nextval('sequence_generator'),?,?,?,?,?,?,?,?,?,?,?,?,?,now(),0) returning id",
            Long.class,
            d.getDocName(),
            d.getDocType(),
            d.getHouseholdName(),
            d.getAddress(),
            d.getStatus(),
            d.getExpiryDate(),
            d.getOfficer(),
            d.getPhone(),
            d.getNotes(),
            d.getReminderSent(),
            d.getHouseholdId() == null ? householdId : d.getHouseholdId(),
            java.time.LocalDate.now().plusYears(1),
            "integration-test"
        );
        workflow("", "", "", "", "");
        d.setId(id);
        return em.find(DocumentRecord.class, id);
    }

    private void workflow(String actor, String reason, String operation, String requestId, String requestHash) {
        for (String[] entry : new String[][] {
            { "documents.actor", actor },
            { "documents.reason", reason },
            { "documents.operation", operation },
            { "documents.request_id", requestId },
            { "documents.request_hash", requestHash },
        })
            jdbc.queryForObject("select set_config(?, ?, true)", String.class, entry[0], entry[1]);
    }

    @BeforeEach
    void initTest() {
        RbacTestSupport.communeWide(rbac);
        // Documents always belong to a household (audit_document_lifecycle trigger).
        com.policemanagement.com.domain.Household household = HouseholdResourceIT.createRosterEntity(em);
        em.persist(household);
        em.flush();
        householdId = household.getId();
        documentRecord = createEntity();
    }

    @AfterEach
    void cleanup() {
        // Document history is never deleted (audit_document_lifecycle trigger); every test is @Transactional and rolls back.
        insertedDocumentRecord = null;
    }

    /*
     * Documents change only through the audited lifecycle (/api/document-lifecycle: register, confirm, renew) that sets
     * actor, reason and request ID; the database refuses legacy entity writes, which must leave the data unchanged.
     */
    @Test
    @Transactional
    void legacyCreateIsRejected() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        DocumentRecordDTO documentRecordDTO = documentRecordMapper.toDto(documentRecord);
        restDocumentRecordMockMvc
            .perform(
                post(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(documentRecordDTO))
            )
            .andExpect(status().isConflict());
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void legacyUpdateIsRejected() throws Exception {
        insertedDocumentRecord = persistDocument(documentRecord);
        DocumentRecordDTO documentRecordDTO = documentRecordMapper.toDto(insertedDocumentRecord);
        documentRecordDTO.setNotes(UPDATED_NOTES);
        restDocumentRecordMockMvc
            .perform(
                put(ENTITY_API_URL_ID, insertedDocumentRecord.getId())
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(documentRecordDTO))
            )
            .andExpect(status().isConflict());
        em.clear();
        assertThat(getPersistedDocumentRecord(insertedDocumentRecord).getNotes()).isEqualTo(DEFAULT_NOTES);
    }

    @Test
    @Transactional
    void legacyPatchIsRejected() throws Exception {
        insertedDocumentRecord = persistDocument(documentRecord);
        DocumentRecordDTO patch = new DocumentRecordDTO();
        patch.setId(insertedDocumentRecord.getId());
        patch.setNotes(UPDATED_NOTES);
        restDocumentRecordMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, insertedDocumentRecord.getId())
                    .with(csrf())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(patch))
            )
            .andExpect(status().isConflict());
        em.clear();
        assertThat(getPersistedDocumentRecord(insertedDocumentRecord).getNotes()).isEqualTo(DEFAULT_NOTES);
    }

    @Test
    @Transactional
    void legacyDeleteIsRejected() throws Exception {
        insertedDocumentRecord = persistDocument(documentRecord);
        long databaseSizeBeforeDelete = getRepositoryCount();
        restDocumentRecordMockMvc
            .perform(delete(ENTITY_API_URL_ID, insertedDocumentRecord.getId()).with(csrf()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isConflict());
        assertSameRepositoryCount(databaseSizeBeforeDelete);
    }

    @Test
    @Transactional
    void getAllDocumentRecords() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList
        restDocumentRecordMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(documentRecord.getId().intValue())))
            .andExpect(jsonPath("$.[*].docName").value(hasItem(DEFAULT_DOC_NAME)))
            .andExpect(jsonPath("$.[*].docType").value(hasItem(DEFAULT_DOC_TYPE)))
            .andExpect(jsonPath("$.[*].householdName").value(hasItem(DEFAULT_HOUSEHOLD_NAME)))
            .andExpect(jsonPath("$.[*].address").value(hasItem(DEFAULT_ADDRESS)))
            .andExpect(jsonPath("$.[*].status").value(hasItem(DEFAULT_STATUS)))
            .andExpect(jsonPath("$.[*].expiryDate").value(hasItem(DEFAULT_EXPIRY_DATE)))
            .andExpect(jsonPath("$.[*].officer").value(hasItem(DEFAULT_OFFICER)))
            .andExpect(jsonPath("$.[*].phone").value(hasItem(DEFAULT_PHONE)))
            .andExpect(jsonPath("$.[*].notes").value(hasItem(DEFAULT_NOTES)))
            .andExpect(jsonPath("$.[*].reminderSent").value(hasItem(DEFAULT_REMINDER_SENT)));
    }

    @Test
    @Transactional
    void getDocumentRecord() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get the documentRecord
        restDocumentRecordMockMvc
            .perform(get(ENTITY_API_URL_ID, documentRecord.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(documentRecord.getId().intValue()))
            .andExpect(jsonPath("$.docName").value(DEFAULT_DOC_NAME))
            .andExpect(jsonPath("$.docType").value(DEFAULT_DOC_TYPE))
            .andExpect(jsonPath("$.householdName").value(DEFAULT_HOUSEHOLD_NAME))
            .andExpect(jsonPath("$.address").value(DEFAULT_ADDRESS))
            .andExpect(jsonPath("$.status").value(DEFAULT_STATUS))
            .andExpect(jsonPath("$.expiryDate").value(DEFAULT_EXPIRY_DATE))
            .andExpect(jsonPath("$.officer").value(DEFAULT_OFFICER))
            .andExpect(jsonPath("$.phone").value(DEFAULT_PHONE))
            .andExpect(jsonPath("$.notes").value(DEFAULT_NOTES))
            .andExpect(jsonPath("$.reminderSent").value(DEFAULT_REMINDER_SENT));
    }

    @Test
    @Transactional
    void getDocumentRecordsByIdFiltering() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        Long id = documentRecord.getId();

        defaultDocumentRecordFiltering("id.equals=" + id, "id.notEquals=" + id);

        defaultDocumentRecordFiltering("id.greaterThanOrEqual=" + id, "id.greaterThan=" + id);

        defaultDocumentRecordFiltering("id.lessThanOrEqual=" + id, "id.lessThan=" + id);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByDocNameIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where docName equals to
        defaultDocumentRecordFiltering("docName.equals=" + DEFAULT_DOC_NAME, "docName.equals=" + UPDATED_DOC_NAME);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByDocNameIsInShouldWork() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where docName in
        defaultDocumentRecordFiltering("docName.in=" + DEFAULT_DOC_NAME + "," + UPDATED_DOC_NAME, "docName.in=" + UPDATED_DOC_NAME);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByDocNameIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where docName is not null
        defaultDocumentRecordFiltering("docName.specified=true", "docName.specified=false");
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByDocNameContainsSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where docName contains
        defaultDocumentRecordFiltering("docName.contains=" + DEFAULT_DOC_NAME, "docName.contains=" + UPDATED_DOC_NAME);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByDocNameNotContainsSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where docName does not contain
        defaultDocumentRecordFiltering("docName.doesNotContain=" + UPDATED_DOC_NAME, "docName.doesNotContain=" + DEFAULT_DOC_NAME);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByDocTypeIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where docType equals to
        defaultDocumentRecordFiltering("docType.equals=" + DEFAULT_DOC_TYPE, "docType.equals=" + UPDATED_DOC_TYPE);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByDocTypeIsInShouldWork() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where docType in
        defaultDocumentRecordFiltering("docType.in=" + DEFAULT_DOC_TYPE + "," + UPDATED_DOC_TYPE, "docType.in=" + UPDATED_DOC_TYPE);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByDocTypeIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where docType is not null
        defaultDocumentRecordFiltering("docType.specified=true", "docType.specified=false");
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByDocTypeContainsSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where docType contains
        defaultDocumentRecordFiltering("docType.contains=" + DEFAULT_DOC_TYPE, "docType.contains=" + UPDATED_DOC_TYPE);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByDocTypeNotContainsSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where docType does not contain
        defaultDocumentRecordFiltering("docType.doesNotContain=" + UPDATED_DOC_TYPE, "docType.doesNotContain=" + DEFAULT_DOC_TYPE);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByHouseholdNameIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where householdName equals to
        defaultDocumentRecordFiltering("householdName.equals=" + DEFAULT_HOUSEHOLD_NAME, "householdName.equals=" + UPDATED_HOUSEHOLD_NAME);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByHouseholdNameIsInShouldWork() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where householdName in
        defaultDocumentRecordFiltering(
            "householdName.in=" + DEFAULT_HOUSEHOLD_NAME + "," + UPDATED_HOUSEHOLD_NAME,
            "householdName.in=" + UPDATED_HOUSEHOLD_NAME
        );
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByHouseholdNameIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where householdName is not null
        defaultDocumentRecordFiltering("householdName.specified=true", "householdName.specified=false");
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByHouseholdNameContainsSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where householdName contains
        defaultDocumentRecordFiltering(
            "householdName.contains=" + DEFAULT_HOUSEHOLD_NAME,
            "householdName.contains=" + UPDATED_HOUSEHOLD_NAME
        );
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByHouseholdNameNotContainsSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where householdName does not contain
        defaultDocumentRecordFiltering(
            "householdName.doesNotContain=" + UPDATED_HOUSEHOLD_NAME,
            "householdName.doesNotContain=" + DEFAULT_HOUSEHOLD_NAME
        );
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByAddressIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where address equals to
        defaultDocumentRecordFiltering("address.equals=" + DEFAULT_ADDRESS, "address.equals=" + UPDATED_ADDRESS);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByAddressIsInShouldWork() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where address in
        defaultDocumentRecordFiltering("address.in=" + DEFAULT_ADDRESS + "," + UPDATED_ADDRESS, "address.in=" + UPDATED_ADDRESS);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByAddressIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where address is not null
        defaultDocumentRecordFiltering("address.specified=true", "address.specified=false");
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByAddressContainsSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where address contains
        defaultDocumentRecordFiltering("address.contains=" + DEFAULT_ADDRESS, "address.contains=" + UPDATED_ADDRESS);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByAddressNotContainsSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where address does not contain
        defaultDocumentRecordFiltering("address.doesNotContain=" + UPDATED_ADDRESS, "address.doesNotContain=" + DEFAULT_ADDRESS);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByStatusIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where status equals to
        defaultDocumentRecordFiltering("status.equals=" + DEFAULT_STATUS, "status.equals=" + UPDATED_STATUS);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByStatusIsInShouldWork() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where status in
        defaultDocumentRecordFiltering("status.in=" + DEFAULT_STATUS + "," + UPDATED_STATUS, "status.in=" + UPDATED_STATUS);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByStatusIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where status is not null
        defaultDocumentRecordFiltering("status.specified=true", "status.specified=false");
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByStatusContainsSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where status contains
        defaultDocumentRecordFiltering("status.contains=" + DEFAULT_STATUS, "status.contains=" + UPDATED_STATUS);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByStatusNotContainsSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where status does not contain
        defaultDocumentRecordFiltering("status.doesNotContain=" + UPDATED_STATUS, "status.doesNotContain=" + DEFAULT_STATUS);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByExpiryDateIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where expiryDate equals to
        defaultDocumentRecordFiltering("expiryDate.equals=" + DEFAULT_EXPIRY_DATE, "expiryDate.equals=" + UPDATED_EXPIRY_DATE);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByExpiryDateIsInShouldWork() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where expiryDate in
        defaultDocumentRecordFiltering(
            "expiryDate.in=" + DEFAULT_EXPIRY_DATE + "," + UPDATED_EXPIRY_DATE,
            "expiryDate.in=" + UPDATED_EXPIRY_DATE
        );
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByExpiryDateIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where expiryDate is not null
        defaultDocumentRecordFiltering("expiryDate.specified=true", "expiryDate.specified=false");
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByExpiryDateContainsSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where expiryDate contains
        defaultDocumentRecordFiltering("expiryDate.contains=" + DEFAULT_EXPIRY_DATE, "expiryDate.contains=" + UPDATED_EXPIRY_DATE);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByExpiryDateNotContainsSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where expiryDate does not contain
        defaultDocumentRecordFiltering(
            "expiryDate.doesNotContain=" + UPDATED_EXPIRY_DATE,
            "expiryDate.doesNotContain=" + DEFAULT_EXPIRY_DATE
        );
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByOfficerIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where officer equals to
        defaultDocumentRecordFiltering("officer.equals=" + DEFAULT_OFFICER, "officer.equals=" + UPDATED_OFFICER);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByOfficerIsInShouldWork() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where officer in
        defaultDocumentRecordFiltering("officer.in=" + DEFAULT_OFFICER + "," + UPDATED_OFFICER, "officer.in=" + UPDATED_OFFICER);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByOfficerIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where officer is not null
        defaultDocumentRecordFiltering("officer.specified=true", "officer.specified=false");
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByOfficerContainsSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where officer contains
        defaultDocumentRecordFiltering("officer.contains=" + DEFAULT_OFFICER, "officer.contains=" + UPDATED_OFFICER);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByOfficerNotContainsSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where officer does not contain
        defaultDocumentRecordFiltering("officer.doesNotContain=" + UPDATED_OFFICER, "officer.doesNotContain=" + DEFAULT_OFFICER);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByPhoneIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where phone equals to
        defaultDocumentRecordFiltering("phone.equals=" + DEFAULT_PHONE, "phone.equals=" + UPDATED_PHONE);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByPhoneIsInShouldWork() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where phone in
        defaultDocumentRecordFiltering("phone.in=" + DEFAULT_PHONE + "," + UPDATED_PHONE, "phone.in=" + UPDATED_PHONE);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByPhoneIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where phone is not null
        defaultDocumentRecordFiltering("phone.specified=true", "phone.specified=false");
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByPhoneContainsSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where phone contains
        defaultDocumentRecordFiltering("phone.contains=" + DEFAULT_PHONE, "phone.contains=" + UPDATED_PHONE);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByPhoneNotContainsSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where phone does not contain
        defaultDocumentRecordFiltering("phone.doesNotContain=" + UPDATED_PHONE, "phone.doesNotContain=" + DEFAULT_PHONE);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByReminderSentIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where reminderSent equals to
        defaultDocumentRecordFiltering("reminderSent.equals=" + DEFAULT_REMINDER_SENT, "reminderSent.equals=" + UPDATED_REMINDER_SENT);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByReminderSentIsInShouldWork() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where reminderSent in
        defaultDocumentRecordFiltering(
            "reminderSent.in=" + DEFAULT_REMINDER_SENT + "," + UPDATED_REMINDER_SENT,
            "reminderSent.in=" + UPDATED_REMINDER_SENT
        );
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByReminderSentIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedDocumentRecord = persistDocument(documentRecord);

        // Get all the documentRecordList where reminderSent is not null
        defaultDocumentRecordFiltering("reminderSent.specified=true", "reminderSent.specified=false");
    }

    private void defaultDocumentRecordFiltering(String shouldBeFound, String shouldNotBeFound) throws Exception {
        defaultDocumentRecordShouldBeFound(shouldBeFound);
        defaultDocumentRecordShouldNotBeFound(shouldNotBeFound);
    }

    /**
     * Executes the search, and checks that the default entity is returned.
     */
    private void defaultDocumentRecordShouldBeFound(String filter) throws Exception {
        restDocumentRecordMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc&" + filter))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(documentRecord.getId().intValue())))
            .andExpect(jsonPath("$.[*].docName").value(hasItem(DEFAULT_DOC_NAME)))
            .andExpect(jsonPath("$.[*].docType").value(hasItem(DEFAULT_DOC_TYPE)))
            .andExpect(jsonPath("$.[*].householdName").value(hasItem(DEFAULT_HOUSEHOLD_NAME)))
            .andExpect(jsonPath("$.[*].address").value(hasItem(DEFAULT_ADDRESS)))
            .andExpect(jsonPath("$.[*].status").value(hasItem(DEFAULT_STATUS)))
            .andExpect(jsonPath("$.[*].expiryDate").value(hasItem(DEFAULT_EXPIRY_DATE)))
            .andExpect(jsonPath("$.[*].officer").value(hasItem(DEFAULT_OFFICER)))
            .andExpect(jsonPath("$.[*].phone").value(hasItem(DEFAULT_PHONE)))
            .andExpect(jsonPath("$.[*].notes").value(hasItem(DEFAULT_NOTES)))
            .andExpect(jsonPath("$.[*].reminderSent").value(hasItem(DEFAULT_REMINDER_SENT)));

        // Check, that the count call also returns 1
        restDocumentRecordMockMvc
            .perform(get(ENTITY_API_URL + "/count?sort=id,desc&" + filter))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(content().string("1"));
    }

    /**
     * Executes the search, and checks that the default entity is not returned.
     */
    private void defaultDocumentRecordShouldNotBeFound(String filter) throws Exception {
        restDocumentRecordMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc&" + filter))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$").isArray())
            .andExpect(jsonPath("$").isEmpty());

        // Check, that the count call also returns 0
        restDocumentRecordMockMvc
            .perform(get(ENTITY_API_URL + "/count?sort=id,desc&" + filter))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(content().string("0"));
    }

    @Test
    @Transactional
    void getNonExistingDocumentRecord() throws Exception {
        // Get the documentRecord
        restDocumentRecordMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    protected long getRepositoryCount() {
        return documentRecordRepository.count();
    }

    protected void assertIncrementedRepositoryCount(long countBefore) {
        assertThat(countBefore + 1).isEqualTo(getRepositoryCount());
    }

    protected void assertDecrementedRepositoryCount(long countBefore) {
        assertThat(countBefore - 1).isEqualTo(getRepositoryCount());
    }

    protected void assertSameRepositoryCount(long countBefore) {
        assertThat(countBefore).isEqualTo(getRepositoryCount());
    }

    protected DocumentRecord getPersistedDocumentRecord(DocumentRecord documentRecord) {
        return documentRecordRepository.findById(documentRecord.getId()).orElseThrow();
    }

    protected void assertPersistedDocumentRecordToMatchAllProperties(DocumentRecord expectedDocumentRecord) {
        assertDocumentRecordAllPropertiesEquals(expectedDocumentRecord, getPersistedDocumentRecord(expectedDocumentRecord));
    }

    protected void assertPersistedDocumentRecordToMatchUpdatableProperties(DocumentRecord expectedDocumentRecord) {
        assertDocumentRecordAllUpdatablePropertiesEquals(expectedDocumentRecord, getPersistedDocumentRecord(expectedDocumentRecord));
    }
}
