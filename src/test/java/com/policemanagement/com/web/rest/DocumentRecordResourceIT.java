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
    private MockMvc restDocumentRecordMockMvc;

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

    @BeforeEach
    void initTest() {
        documentRecord = createEntity();
    }

    @AfterEach
    void cleanup() {
        if (insertedDocumentRecord != null) {
            documentRecordRepository.delete(insertedDocumentRecord);
            insertedDocumentRecord = null;
        }
    }

    @Test
    @Transactional
    void createDocumentRecord() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the DocumentRecord
        DocumentRecordDTO documentRecordDTO = documentRecordMapper.toDto(documentRecord);
        var returnedDocumentRecordDTO = om.readValue(
            restDocumentRecordMockMvc
                .perform(
                    post(ENTITY_API_URL)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(om.writeValueAsBytes(documentRecordDTO))
                )
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            DocumentRecordDTO.class
        );

        // Validate the DocumentRecord in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        var returnedDocumentRecord = documentRecordMapper.toEntity(returnedDocumentRecordDTO);
        assertDocumentRecordUpdatableFieldsEquals(returnedDocumentRecord, getPersistedDocumentRecord(returnedDocumentRecord));

        insertedDocumentRecord = returnedDocumentRecord;
    }

    @Test
    @Transactional
    void createDocumentRecordWithExistingId() throws Exception {
        // Create the DocumentRecord with an existing ID
        documentRecord.setId(1L);
        DocumentRecordDTO documentRecordDTO = documentRecordMapper.toDto(documentRecord);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restDocumentRecordMockMvc
            .perform(
                post(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(documentRecordDTO))
            )
            .andExpect(status().isBadRequest());

        // Validate the DocumentRecord in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkDocNameIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        documentRecord.setDocName(null);

        // Create the DocumentRecord, which fails.
        DocumentRecordDTO documentRecordDTO = documentRecordMapper.toDto(documentRecord);

        restDocumentRecordMockMvc
            .perform(
                post(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(documentRecordDTO))
            )
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkDocTypeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        documentRecord.setDocType(null);

        // Create the DocumentRecord, which fails.
        DocumentRecordDTO documentRecordDTO = documentRecordMapper.toDto(documentRecord);

        restDocumentRecordMockMvc
            .perform(
                post(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(documentRecordDTO))
            )
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllDocumentRecords() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

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
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

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
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        Long id = documentRecord.getId();

        defaultDocumentRecordFiltering("id.equals=" + id, "id.notEquals=" + id);

        defaultDocumentRecordFiltering("id.greaterThanOrEqual=" + id, "id.greaterThan=" + id);

        defaultDocumentRecordFiltering("id.lessThanOrEqual=" + id, "id.lessThan=" + id);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByDocNameIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where docName equals to
        defaultDocumentRecordFiltering("docName.equals=" + DEFAULT_DOC_NAME, "docName.equals=" + UPDATED_DOC_NAME);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByDocNameIsInShouldWork() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where docName in
        defaultDocumentRecordFiltering("docName.in=" + DEFAULT_DOC_NAME + "," + UPDATED_DOC_NAME, "docName.in=" + UPDATED_DOC_NAME);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByDocNameIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where docName is not null
        defaultDocumentRecordFiltering("docName.specified=true", "docName.specified=false");
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByDocNameContainsSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where docName contains
        defaultDocumentRecordFiltering("docName.contains=" + DEFAULT_DOC_NAME, "docName.contains=" + UPDATED_DOC_NAME);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByDocNameNotContainsSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where docName does not contain
        defaultDocumentRecordFiltering("docName.doesNotContain=" + UPDATED_DOC_NAME, "docName.doesNotContain=" + DEFAULT_DOC_NAME);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByDocTypeIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where docType equals to
        defaultDocumentRecordFiltering("docType.equals=" + DEFAULT_DOC_TYPE, "docType.equals=" + UPDATED_DOC_TYPE);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByDocTypeIsInShouldWork() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where docType in
        defaultDocumentRecordFiltering("docType.in=" + DEFAULT_DOC_TYPE + "," + UPDATED_DOC_TYPE, "docType.in=" + UPDATED_DOC_TYPE);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByDocTypeIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where docType is not null
        defaultDocumentRecordFiltering("docType.specified=true", "docType.specified=false");
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByDocTypeContainsSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where docType contains
        defaultDocumentRecordFiltering("docType.contains=" + DEFAULT_DOC_TYPE, "docType.contains=" + UPDATED_DOC_TYPE);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByDocTypeNotContainsSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where docType does not contain
        defaultDocumentRecordFiltering("docType.doesNotContain=" + UPDATED_DOC_TYPE, "docType.doesNotContain=" + DEFAULT_DOC_TYPE);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByHouseholdNameIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where householdName equals to
        defaultDocumentRecordFiltering("householdName.equals=" + DEFAULT_HOUSEHOLD_NAME, "householdName.equals=" + UPDATED_HOUSEHOLD_NAME);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByHouseholdNameIsInShouldWork() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

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
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where householdName is not null
        defaultDocumentRecordFiltering("householdName.specified=true", "householdName.specified=false");
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByHouseholdNameContainsSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

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
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

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
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where address equals to
        defaultDocumentRecordFiltering("address.equals=" + DEFAULT_ADDRESS, "address.equals=" + UPDATED_ADDRESS);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByAddressIsInShouldWork() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where address in
        defaultDocumentRecordFiltering("address.in=" + DEFAULT_ADDRESS + "," + UPDATED_ADDRESS, "address.in=" + UPDATED_ADDRESS);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByAddressIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where address is not null
        defaultDocumentRecordFiltering("address.specified=true", "address.specified=false");
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByAddressContainsSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where address contains
        defaultDocumentRecordFiltering("address.contains=" + DEFAULT_ADDRESS, "address.contains=" + UPDATED_ADDRESS);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByAddressNotContainsSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where address does not contain
        defaultDocumentRecordFiltering("address.doesNotContain=" + UPDATED_ADDRESS, "address.doesNotContain=" + DEFAULT_ADDRESS);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByStatusIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where status equals to
        defaultDocumentRecordFiltering("status.equals=" + DEFAULT_STATUS, "status.equals=" + UPDATED_STATUS);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByStatusIsInShouldWork() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where status in
        defaultDocumentRecordFiltering("status.in=" + DEFAULT_STATUS + "," + UPDATED_STATUS, "status.in=" + UPDATED_STATUS);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByStatusIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where status is not null
        defaultDocumentRecordFiltering("status.specified=true", "status.specified=false");
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByStatusContainsSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where status contains
        defaultDocumentRecordFiltering("status.contains=" + DEFAULT_STATUS, "status.contains=" + UPDATED_STATUS);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByStatusNotContainsSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where status does not contain
        defaultDocumentRecordFiltering("status.doesNotContain=" + UPDATED_STATUS, "status.doesNotContain=" + DEFAULT_STATUS);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByExpiryDateIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where expiryDate equals to
        defaultDocumentRecordFiltering("expiryDate.equals=" + DEFAULT_EXPIRY_DATE, "expiryDate.equals=" + UPDATED_EXPIRY_DATE);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByExpiryDateIsInShouldWork() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

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
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where expiryDate is not null
        defaultDocumentRecordFiltering("expiryDate.specified=true", "expiryDate.specified=false");
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByExpiryDateContainsSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where expiryDate contains
        defaultDocumentRecordFiltering("expiryDate.contains=" + DEFAULT_EXPIRY_DATE, "expiryDate.contains=" + UPDATED_EXPIRY_DATE);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByExpiryDateNotContainsSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

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
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where officer equals to
        defaultDocumentRecordFiltering("officer.equals=" + DEFAULT_OFFICER, "officer.equals=" + UPDATED_OFFICER);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByOfficerIsInShouldWork() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where officer in
        defaultDocumentRecordFiltering("officer.in=" + DEFAULT_OFFICER + "," + UPDATED_OFFICER, "officer.in=" + UPDATED_OFFICER);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByOfficerIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where officer is not null
        defaultDocumentRecordFiltering("officer.specified=true", "officer.specified=false");
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByOfficerContainsSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where officer contains
        defaultDocumentRecordFiltering("officer.contains=" + DEFAULT_OFFICER, "officer.contains=" + UPDATED_OFFICER);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByOfficerNotContainsSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where officer does not contain
        defaultDocumentRecordFiltering("officer.doesNotContain=" + UPDATED_OFFICER, "officer.doesNotContain=" + DEFAULT_OFFICER);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByPhoneIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where phone equals to
        defaultDocumentRecordFiltering("phone.equals=" + DEFAULT_PHONE, "phone.equals=" + UPDATED_PHONE);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByPhoneIsInShouldWork() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where phone in
        defaultDocumentRecordFiltering("phone.in=" + DEFAULT_PHONE + "," + UPDATED_PHONE, "phone.in=" + UPDATED_PHONE);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByPhoneIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where phone is not null
        defaultDocumentRecordFiltering("phone.specified=true", "phone.specified=false");
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByPhoneContainsSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where phone contains
        defaultDocumentRecordFiltering("phone.contains=" + DEFAULT_PHONE, "phone.contains=" + UPDATED_PHONE);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByPhoneNotContainsSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where phone does not contain
        defaultDocumentRecordFiltering("phone.doesNotContain=" + UPDATED_PHONE, "phone.doesNotContain=" + DEFAULT_PHONE);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByReminderSentIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        // Get all the documentRecordList where reminderSent equals to
        defaultDocumentRecordFiltering("reminderSent.equals=" + DEFAULT_REMINDER_SENT, "reminderSent.equals=" + UPDATED_REMINDER_SENT);
    }

    @Test
    @Transactional
    void getAllDocumentRecordsByReminderSentIsInShouldWork() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

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
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

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

    @Test
    @Transactional
    void putExistingDocumentRecord() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the documentRecord
        DocumentRecord updatedDocumentRecord = documentRecordRepository.findById(documentRecord.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedDocumentRecord are not directly saved in db
        em.detach(updatedDocumentRecord);
        updatedDocumentRecord
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
        DocumentRecordDTO documentRecordDTO = documentRecordMapper.toDto(updatedDocumentRecord);

        restDocumentRecordMockMvc
            .perform(
                put(ENTITY_API_URL_ID, documentRecordDTO.getId())
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(documentRecordDTO))
            )
            .andExpect(status().isOk());

        // Validate the DocumentRecord in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedDocumentRecordToMatchAllProperties(updatedDocumentRecord);
    }

    @Test
    @Transactional
    void putNonExistingDocumentRecord() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        documentRecord.setId(longCount.incrementAndGet());

        // Create the DocumentRecord
        DocumentRecordDTO documentRecordDTO = documentRecordMapper.toDto(documentRecord);

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restDocumentRecordMockMvc
            .perform(
                put(ENTITY_API_URL_ID, documentRecordDTO.getId())
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(documentRecordDTO))
            )
            .andExpect(status().isBadRequest());

        // Validate the DocumentRecord in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchDocumentRecord() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        documentRecord.setId(longCount.incrementAndGet());

        // Create the DocumentRecord
        DocumentRecordDTO documentRecordDTO = documentRecordMapper.toDto(documentRecord);

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restDocumentRecordMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(documentRecordDTO))
            )
            .andExpect(status().isBadRequest());

        // Validate the DocumentRecord in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamDocumentRecord() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        documentRecord.setId(longCount.incrementAndGet());

        // Create the DocumentRecord
        DocumentRecordDTO documentRecordDTO = documentRecordMapper.toDto(documentRecord);

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restDocumentRecordMockMvc
            .perform(
                put(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(documentRecordDTO))
            )
            .andExpect(status().isMethodNotAllowed());

        // Validate the DocumentRecord in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateDocumentRecordWithPatch() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the documentRecord using partial update
        DocumentRecord partialUpdatedDocumentRecord = new DocumentRecord();
        partialUpdatedDocumentRecord.setId(documentRecord.getId());

        partialUpdatedDocumentRecord.docType(UPDATED_DOC_TYPE).householdName(UPDATED_HOUSEHOLD_NAME).status(UPDATED_STATUS);

        restDocumentRecordMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedDocumentRecord.getId())
                    .with(csrf())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedDocumentRecord))
            )
            .andExpect(status().isOk());

        // Validate the DocumentRecord in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertDocumentRecordUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedDocumentRecord, documentRecord),
            getPersistedDocumentRecord(documentRecord)
        );
    }

    @Test
    @Transactional
    void fullUpdateDocumentRecordWithPatch() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the documentRecord using partial update
        DocumentRecord partialUpdatedDocumentRecord = new DocumentRecord();
        partialUpdatedDocumentRecord.setId(documentRecord.getId());

        partialUpdatedDocumentRecord
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

        restDocumentRecordMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedDocumentRecord.getId())
                    .with(csrf())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedDocumentRecord))
            )
            .andExpect(status().isOk());

        // Validate the DocumentRecord in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertDocumentRecordUpdatableFieldsEquals(partialUpdatedDocumentRecord, getPersistedDocumentRecord(partialUpdatedDocumentRecord));
    }

    @Test
    @Transactional
    void patchNonExistingDocumentRecord() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        documentRecord.setId(longCount.incrementAndGet());

        // Create the DocumentRecord
        DocumentRecordDTO documentRecordDTO = documentRecordMapper.toDto(documentRecord);

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restDocumentRecordMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, documentRecordDTO.getId())
                    .with(csrf())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(documentRecordDTO))
            )
            .andExpect(status().isBadRequest());

        // Validate the DocumentRecord in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchDocumentRecord() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        documentRecord.setId(longCount.incrementAndGet());

        // Create the DocumentRecord
        DocumentRecordDTO documentRecordDTO = documentRecordMapper.toDto(documentRecord);

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restDocumentRecordMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .with(csrf())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(documentRecordDTO))
            )
            .andExpect(status().isBadRequest());

        // Validate the DocumentRecord in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamDocumentRecord() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        documentRecord.setId(longCount.incrementAndGet());

        // Create the DocumentRecord
        DocumentRecordDTO documentRecordDTO = documentRecordMapper.toDto(documentRecord);

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restDocumentRecordMockMvc
            .perform(
                patch(ENTITY_API_URL)
                    .with(csrf())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(documentRecordDTO))
            )
            .andExpect(status().isMethodNotAllowed());

        // Validate the DocumentRecord in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteDocumentRecord() throws Exception {
        // Initialize the database
        insertedDocumentRecord = documentRecordRepository.saveAndFlush(documentRecord);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the documentRecord
        restDocumentRecordMockMvc
            .perform(delete(ENTITY_API_URL_ID, documentRecord.getId()).with(csrf()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
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
