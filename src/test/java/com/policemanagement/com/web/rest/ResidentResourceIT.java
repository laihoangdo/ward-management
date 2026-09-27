package com.policemanagement.com.web.rest;

import static com.policemanagement.com.domain.ResidentAsserts.*;
import static com.policemanagement.com.web.rest.TestUtil.createUpdateProxyForBean;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.policemanagement.com.IntegrationTest;
import com.policemanagement.com.domain.Household;
import com.policemanagement.com.domain.Resident;
import com.policemanagement.com.domain.enumeration.Gender;
import com.policemanagement.com.domain.enumeration.ResidenceType;
import com.policemanagement.com.repository.ResidentRepository;
import com.policemanagement.com.service.ResidentService;
import com.policemanagement.com.service.dto.ResidentDTO;
import com.policemanagement.com.service.mapper.ResidentMapper;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Random;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * Integration tests for the {@link ResidentResource} REST controller.
 */
@IntegrationTest
@ExtendWith(MockitoExtension.class)
@AutoConfigureMockMvc
@WithMockUser
class ResidentResourceIT {

    private static final String DEFAULT_FULL_NAME = "AAAAAAAAAA";
    private static final String UPDATED_FULL_NAME = "BBBBBBBBBB";

    private static final String DEFAULT_ID_CARD_NUMBER = "AAAAAAAAAA";
    private static final String UPDATED_ID_CARD_NUMBER = "BBBBBBBBBB";

    private static final Integer DEFAULT_BIRTH_YEAR = 1;
    private static final Integer UPDATED_BIRTH_YEAR = 2;
    private static final Integer SMALLER_BIRTH_YEAR = 1 - 1;

    private static final Gender DEFAULT_GENDER = Gender.MALE;
    private static final Gender UPDATED_GENDER = Gender.FEMALE;

    private static final String DEFAULT_RELATIONSHIP = "AAAAAAAAAA";
    private static final String UPDATED_RELATIONSHIP = "BBBBBBBBBB";

    private static final ResidenceType DEFAULT_RESIDENCE_TYPE = ResidenceType.PERMANENT;
    private static final ResidenceType UPDATED_RESIDENCE_TYPE = ResidenceType.TEMPORARY;

    private static final LocalDate DEFAULT_TEMPORARY_REGISTERED_AT = LocalDate.ofEpochDay(0L);
    private static final LocalDate UPDATED_TEMPORARY_REGISTERED_AT = LocalDate.parse("2026-09-19");
    private static final LocalDate SMALLER_TEMPORARY_REGISTERED_AT = LocalDate.ofEpochDay(-1L);

    private static final String DEFAULT_NOTES = "AAAAAAAAAA";
    private static final String UPDATED_NOTES = "BBBBBBBBBB";

    private static final String ENTITY_API_URL = "/api/residents";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + 2L * Integer.MAX_VALUE);

    @Autowired
    private ObjectMapper om;

    @Autowired
    private ResidentRepository residentRepository;

    @Mock
    private ResidentRepository residentRepositoryMock;

    @Autowired
    private ResidentMapper residentMapper;

    @Mock
    private ResidentService residentServiceMock;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restResidentMockMvc;

    private Resident resident;

    private Resident insertedResident;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static Resident createEntity() {
        return new Resident()
            .fullName(DEFAULT_FULL_NAME)
            .idCardNumber(DEFAULT_ID_CARD_NUMBER)
            .birthYear(DEFAULT_BIRTH_YEAR)
            .gender(DEFAULT_GENDER)
            .relationship(DEFAULT_RELATIONSHIP)
            .residenceType(DEFAULT_RESIDENCE_TYPE)
            .temporaryRegisteredAt(DEFAULT_TEMPORARY_REGISTERED_AT)
            .notes(DEFAULT_NOTES);
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static Resident createUpdatedEntity() {
        return new Resident()
            .fullName(UPDATED_FULL_NAME)
            .idCardNumber(UPDATED_ID_CARD_NUMBER)
            .birthYear(UPDATED_BIRTH_YEAR)
            .gender(UPDATED_GENDER)
            .relationship(UPDATED_RELATIONSHIP)
            .residenceType(UPDATED_RESIDENCE_TYPE)
            .temporaryRegisteredAt(UPDATED_TEMPORARY_REGISTERED_AT)
            .notes(UPDATED_NOTES);
    }

    @BeforeEach
    void initTest() {
        resident = createEntity();
    }

    @AfterEach
    void cleanup() {
        if (insertedResident != null) {
            residentRepository.delete(insertedResident);
            insertedResident = null;
        }
    }

    @Test
    @Transactional
    void createResident() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the Resident
        ResidentDTO residentDTO = residentMapper.toDto(resident);
        var returnedResidentDTO = om.readValue(
            restResidentMockMvc
                .perform(
                    post(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(residentDTO))
                )
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            ResidentDTO.class
        );

        // Validate the Resident in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        var returnedResident = residentMapper.toEntity(returnedResidentDTO);
        assertResidentUpdatableFieldsEquals(returnedResident, getPersistedResident(returnedResident));

        insertedResident = returnedResident;
    }

    @Test
    @Transactional
    void createResidentWithExistingId() throws Exception {
        // Create the Resident with an existing ID
        resident.setId(1L);
        ResidentDTO residentDTO = residentMapper.toDto(resident);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restResidentMockMvc
            .perform(post(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(residentDTO)))
            .andExpect(status().isBadRequest());

        // Validate the Resident in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkFullNameIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        resident.setFullName(null);

        // Create the Resident, which fails.
        ResidentDTO residentDTO = residentMapper.toDto(resident);

        restResidentMockMvc
            .perform(post(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(residentDTO)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkResidenceTypeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        resident.setResidenceType(null);

        // Create the Resident, which fails.
        ResidentDTO residentDTO = residentMapper.toDto(resident);

        restResidentMockMvc
            .perform(post(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(residentDTO)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllResidents() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList
        restResidentMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(resident.getId().intValue())))
            .andExpect(jsonPath("$.[*].fullName").value(hasItem(DEFAULT_FULL_NAME)))
            .andExpect(jsonPath("$.[*].idCardNumber").value(hasItem(DEFAULT_ID_CARD_NUMBER)))
            .andExpect(jsonPath("$.[*].birthYear").value(hasItem(DEFAULT_BIRTH_YEAR)))
            .andExpect(jsonPath("$.[*].gender").value(hasItem(DEFAULT_GENDER.toString())))
            .andExpect(jsonPath("$.[*].relationship").value(hasItem(DEFAULT_RELATIONSHIP)))
            .andExpect(jsonPath("$.[*].residenceType").value(hasItem(DEFAULT_RESIDENCE_TYPE.toString())))
            .andExpect(jsonPath("$.[*].temporaryRegisteredAt").value(hasItem(DEFAULT_TEMPORARY_REGISTERED_AT.toString())))
            .andExpect(jsonPath("$.[*].notes").value(hasItem(DEFAULT_NOTES)));
    }

    @SuppressWarnings({ "unchecked" })
    void getAllResidentsWithEagerRelationshipsIsEnabled() throws Exception {
        when(residentServiceMock.findAllWithEagerRelationships(any())).thenReturn(new PageImpl(new ArrayList<>()));

        restResidentMockMvc.perform(get(ENTITY_API_URL + "?eagerload=true")).andExpect(status().isOk());

        verify(residentServiceMock, times(1)).findAllWithEagerRelationships(any());
    }

    @SuppressWarnings({ "unchecked" })
    void getAllResidentsWithEagerRelationshipsIsNotEnabled() throws Exception {
        when(residentServiceMock.findAllWithEagerRelationships(any())).thenReturn(new PageImpl(new ArrayList<>()));

        restResidentMockMvc.perform(get(ENTITY_API_URL + "?eagerload=false")).andExpect(status().isOk());
        verify(residentRepositoryMock, times(1)).findAll(any(Pageable.class));
    }

    @Test
    @Transactional
    void getResident() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get the resident
        restResidentMockMvc
            .perform(get(ENTITY_API_URL_ID, resident.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(resident.getId().intValue()))
            .andExpect(jsonPath("$.fullName").value(DEFAULT_FULL_NAME))
            .andExpect(jsonPath("$.idCardNumber").value(DEFAULT_ID_CARD_NUMBER))
            .andExpect(jsonPath("$.birthYear").value(DEFAULT_BIRTH_YEAR))
            .andExpect(jsonPath("$.gender").value(DEFAULT_GENDER.toString()))
            .andExpect(jsonPath("$.relationship").value(DEFAULT_RELATIONSHIP))
            .andExpect(jsonPath("$.residenceType").value(DEFAULT_RESIDENCE_TYPE.toString()))
            .andExpect(jsonPath("$.temporaryRegisteredAt").value(DEFAULT_TEMPORARY_REGISTERED_AT.toString()))
            .andExpect(jsonPath("$.notes").value(DEFAULT_NOTES));
    }

    @Test
    @Transactional
    void getResidentsByIdFiltering() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        Long id = resident.getId();

        defaultResidentFiltering("id.equals=" + id, "id.notEquals=" + id);

        defaultResidentFiltering("id.greaterThanOrEqual=" + id, "id.greaterThan=" + id);

        defaultResidentFiltering("id.lessThanOrEqual=" + id, "id.lessThan=" + id);
    }

    @Test
    @Transactional
    void getAllResidentsByFullNameIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where fullName equals to
        defaultResidentFiltering("fullName.equals=" + DEFAULT_FULL_NAME, "fullName.equals=" + UPDATED_FULL_NAME);
    }

    @Test
    @Transactional
    void getAllResidentsByFullNameIsInShouldWork() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where fullName in
        defaultResidentFiltering("fullName.in=" + DEFAULT_FULL_NAME + "," + UPDATED_FULL_NAME, "fullName.in=" + UPDATED_FULL_NAME);
    }

    @Test
    @Transactional
    void getAllResidentsByFullNameIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where fullName is not null
        defaultResidentFiltering("fullName.specified=true", "fullName.specified=false");
    }

    @Test
    @Transactional
    void getAllResidentsByFullNameContainsSomething() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where fullName contains
        defaultResidentFiltering("fullName.contains=" + DEFAULT_FULL_NAME, "fullName.contains=" + UPDATED_FULL_NAME);
    }

    @Test
    @Transactional
    void getAllResidentsByFullNameNotContainsSomething() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where fullName does not contain
        defaultResidentFiltering("fullName.doesNotContain=" + UPDATED_FULL_NAME, "fullName.doesNotContain=" + DEFAULT_FULL_NAME);
    }

    @Test
    @Transactional
    void getAllResidentsByIdCardNumberIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where idCardNumber equals to
        defaultResidentFiltering("idCardNumber.equals=" + DEFAULT_ID_CARD_NUMBER, "idCardNumber.equals=" + UPDATED_ID_CARD_NUMBER);
    }

    @Test
    @Transactional
    void getAllResidentsByIdCardNumberIsInShouldWork() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where idCardNumber in
        defaultResidentFiltering(
            "idCardNumber.in=" + DEFAULT_ID_CARD_NUMBER + "," + UPDATED_ID_CARD_NUMBER,
            "idCardNumber.in=" + UPDATED_ID_CARD_NUMBER
        );
    }

    @Test
    @Transactional
    void getAllResidentsByIdCardNumberIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where idCardNumber is not null
        defaultResidentFiltering("idCardNumber.specified=true", "idCardNumber.specified=false");
    }

    @Test
    @Transactional
    void getAllResidentsByIdCardNumberContainsSomething() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where idCardNumber contains
        defaultResidentFiltering("idCardNumber.contains=" + DEFAULT_ID_CARD_NUMBER, "idCardNumber.contains=" + UPDATED_ID_CARD_NUMBER);
    }

    @Test
    @Transactional
    void getAllResidentsByIdCardNumberNotContainsSomething() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where idCardNumber does not contain
        defaultResidentFiltering(
            "idCardNumber.doesNotContain=" + UPDATED_ID_CARD_NUMBER,
            "idCardNumber.doesNotContain=" + DEFAULT_ID_CARD_NUMBER
        );
    }

    @Test
    @Transactional
    void getAllResidentsByBirthYearIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where birthYear equals to
        defaultResidentFiltering("birthYear.equals=" + DEFAULT_BIRTH_YEAR, "birthYear.equals=" + UPDATED_BIRTH_YEAR);
    }

    @Test
    @Transactional
    void getAllResidentsByBirthYearIsInShouldWork() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where birthYear in
        defaultResidentFiltering("birthYear.in=" + DEFAULT_BIRTH_YEAR + "," + UPDATED_BIRTH_YEAR, "birthYear.in=" + UPDATED_BIRTH_YEAR);
    }

    @Test
    @Transactional
    void getAllResidentsByBirthYearIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where birthYear is not null
        defaultResidentFiltering("birthYear.specified=true", "birthYear.specified=false");
    }

    @Test
    @Transactional
    void getAllResidentsByBirthYearIsGreaterThanOrEqualToSomething() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where birthYear is greater than or equal to
        defaultResidentFiltering(
            "birthYear.greaterThanOrEqual=" + DEFAULT_BIRTH_YEAR,
            "birthYear.greaterThanOrEqual=" + UPDATED_BIRTH_YEAR
        );
    }

    @Test
    @Transactional
    void getAllResidentsByBirthYearIsLessThanOrEqualToSomething() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where birthYear is less than or equal to
        defaultResidentFiltering("birthYear.lessThanOrEqual=" + DEFAULT_BIRTH_YEAR, "birthYear.lessThanOrEqual=" + SMALLER_BIRTH_YEAR);
    }

    @Test
    @Transactional
    void getAllResidentsByBirthYearIsLessThanSomething() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where birthYear is less than
        defaultResidentFiltering("birthYear.lessThan=" + UPDATED_BIRTH_YEAR, "birthYear.lessThan=" + DEFAULT_BIRTH_YEAR);
    }

    @Test
    @Transactional
    void getAllResidentsByBirthYearIsGreaterThanSomething() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where birthYear is greater than
        defaultResidentFiltering("birthYear.greaterThan=" + SMALLER_BIRTH_YEAR, "birthYear.greaterThan=" + DEFAULT_BIRTH_YEAR);
    }

    @Test
    @Transactional
    void getAllResidentsByGenderIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where gender equals to
        defaultResidentFiltering("gender.equals=" + DEFAULT_GENDER, "gender.equals=" + UPDATED_GENDER);
    }

    @Test
    @Transactional
    void getAllResidentsByGenderIsInShouldWork() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where gender in
        defaultResidentFiltering("gender.in=" + DEFAULT_GENDER + "," + UPDATED_GENDER, "gender.in=" + UPDATED_GENDER);
    }

    @Test
    @Transactional
    void getAllResidentsByGenderIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where gender is not null
        defaultResidentFiltering("gender.specified=true", "gender.specified=false");
    }

    @Test
    @Transactional
    void getAllResidentsByRelationshipIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where relationship equals to
        defaultResidentFiltering("relationship.equals=" + DEFAULT_RELATIONSHIP, "relationship.equals=" + UPDATED_RELATIONSHIP);
    }

    @Test
    @Transactional
    void getAllResidentsByRelationshipIsInShouldWork() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where relationship in
        defaultResidentFiltering(
            "relationship.in=" + DEFAULT_RELATIONSHIP + "," + UPDATED_RELATIONSHIP,
            "relationship.in=" + UPDATED_RELATIONSHIP
        );
    }

    @Test
    @Transactional
    void getAllResidentsByRelationshipIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where relationship is not null
        defaultResidentFiltering("relationship.specified=true", "relationship.specified=false");
    }

    @Test
    @Transactional
    void getAllResidentsByRelationshipContainsSomething() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where relationship contains
        defaultResidentFiltering("relationship.contains=" + DEFAULT_RELATIONSHIP, "relationship.contains=" + UPDATED_RELATIONSHIP);
    }

    @Test
    @Transactional
    void getAllResidentsByRelationshipNotContainsSomething() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where relationship does not contain
        defaultResidentFiltering(
            "relationship.doesNotContain=" + UPDATED_RELATIONSHIP,
            "relationship.doesNotContain=" + DEFAULT_RELATIONSHIP
        );
    }

    @Test
    @Transactional
    void getAllResidentsByResidenceTypeIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where residenceType equals to
        defaultResidentFiltering("residenceType.equals=" + DEFAULT_RESIDENCE_TYPE, "residenceType.equals=" + UPDATED_RESIDENCE_TYPE);
    }

    @Test
    @Transactional
    void getAllResidentsByResidenceTypeIsInShouldWork() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where residenceType in
        defaultResidentFiltering(
            "residenceType.in=" + DEFAULT_RESIDENCE_TYPE + "," + UPDATED_RESIDENCE_TYPE,
            "residenceType.in=" + UPDATED_RESIDENCE_TYPE
        );
    }

    @Test
    @Transactional
    void getAllResidentsByResidenceTypeIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where residenceType is not null
        defaultResidentFiltering("residenceType.specified=true", "residenceType.specified=false");
    }

    @Test
    @Transactional
    void getAllResidentsByTemporaryRegisteredAtIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where temporaryRegisteredAt equals to
        defaultResidentFiltering(
            "temporaryRegisteredAt.equals=" + DEFAULT_TEMPORARY_REGISTERED_AT,
            "temporaryRegisteredAt.equals=" + UPDATED_TEMPORARY_REGISTERED_AT
        );
    }

    @Test
    @Transactional
    void getAllResidentsByTemporaryRegisteredAtIsInShouldWork() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where temporaryRegisteredAt in
        defaultResidentFiltering(
            "temporaryRegisteredAt.in=" + DEFAULT_TEMPORARY_REGISTERED_AT + "," + UPDATED_TEMPORARY_REGISTERED_AT,
            "temporaryRegisteredAt.in=" + UPDATED_TEMPORARY_REGISTERED_AT
        );
    }

    @Test
    @Transactional
    void getAllResidentsByTemporaryRegisteredAtIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where temporaryRegisteredAt is not null
        defaultResidentFiltering("temporaryRegisteredAt.specified=true", "temporaryRegisteredAt.specified=false");
    }

    @Test
    @Transactional
    void getAllResidentsByTemporaryRegisteredAtIsGreaterThanOrEqualToSomething() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where temporaryRegisteredAt is greater than or equal to
        defaultResidentFiltering(
            "temporaryRegisteredAt.greaterThanOrEqual=" + DEFAULT_TEMPORARY_REGISTERED_AT,
            "temporaryRegisteredAt.greaterThanOrEqual=" + UPDATED_TEMPORARY_REGISTERED_AT
        );
    }

    @Test
    @Transactional
    void getAllResidentsByTemporaryRegisteredAtIsLessThanOrEqualToSomething() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where temporaryRegisteredAt is less than or equal to
        defaultResidentFiltering(
            "temporaryRegisteredAt.lessThanOrEqual=" + DEFAULT_TEMPORARY_REGISTERED_AT,
            "temporaryRegisteredAt.lessThanOrEqual=" + SMALLER_TEMPORARY_REGISTERED_AT
        );
    }

    @Test
    @Transactional
    void getAllResidentsByTemporaryRegisteredAtIsLessThanSomething() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where temporaryRegisteredAt is less than
        defaultResidentFiltering(
            "temporaryRegisteredAt.lessThan=" + UPDATED_TEMPORARY_REGISTERED_AT,
            "temporaryRegisteredAt.lessThan=" + DEFAULT_TEMPORARY_REGISTERED_AT
        );
    }

    @Test
    @Transactional
    void getAllResidentsByTemporaryRegisteredAtIsGreaterThanSomething() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        // Get all the residentList where temporaryRegisteredAt is greater than
        defaultResidentFiltering(
            "temporaryRegisteredAt.greaterThan=" + SMALLER_TEMPORARY_REGISTERED_AT,
            "temporaryRegisteredAt.greaterThan=" + DEFAULT_TEMPORARY_REGISTERED_AT
        );
    }

    @Test
    @Transactional
    void getAllResidentsByHouseholdIsEqualToSomething() throws Exception {
        Household household;
        if (TestUtil.findAll(em, Household.class).isEmpty()) {
            residentRepository.saveAndFlush(resident);
            household = HouseholdResourceIT.createEntity();
        } else {
            household = TestUtil.findAll(em, Household.class).getFirst();
        }
        em.persist(household);
        em.flush();
        resident.setHousehold(household);
        residentRepository.saveAndFlush(resident);
        Long householdId = household.getId();
        // Get all the residentList where household equals to householdId
        defaultResidentShouldBeFound("householdId.equals=" + householdId);

        // Get all the residentList where household equals to (householdId + 1)
        defaultResidentShouldNotBeFound("householdId.equals=" + (householdId + 1));
    }

    private void defaultResidentFiltering(String shouldBeFound, String shouldNotBeFound) throws Exception {
        defaultResidentShouldBeFound(shouldBeFound);
        defaultResidentShouldNotBeFound(shouldNotBeFound);
    }

    /**
     * Executes the search, and checks that the default entity is returned.
     */
    private void defaultResidentShouldBeFound(String filter) throws Exception {
        restResidentMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc&" + filter))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(resident.getId().intValue())))
            .andExpect(jsonPath("$.[*].fullName").value(hasItem(DEFAULT_FULL_NAME)))
            .andExpect(jsonPath("$.[*].idCardNumber").value(hasItem(DEFAULT_ID_CARD_NUMBER)))
            .andExpect(jsonPath("$.[*].birthYear").value(hasItem(DEFAULT_BIRTH_YEAR)))
            .andExpect(jsonPath("$.[*].gender").value(hasItem(DEFAULT_GENDER.toString())))
            .andExpect(jsonPath("$.[*].relationship").value(hasItem(DEFAULT_RELATIONSHIP)))
            .andExpect(jsonPath("$.[*].residenceType").value(hasItem(DEFAULT_RESIDENCE_TYPE.toString())))
            .andExpect(jsonPath("$.[*].temporaryRegisteredAt").value(hasItem(DEFAULT_TEMPORARY_REGISTERED_AT.toString())))
            .andExpect(jsonPath("$.[*].notes").value(hasItem(DEFAULT_NOTES)));

        // Check, that the count call also returns 1
        restResidentMockMvc
            .perform(get(ENTITY_API_URL + "/count?sort=id,desc&" + filter))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(content().string("1"));
    }

    /**
     * Executes the search, and checks that the default entity is not returned.
     */
    private void defaultResidentShouldNotBeFound(String filter) throws Exception {
        restResidentMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc&" + filter))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$").isArray())
            .andExpect(jsonPath("$").isEmpty());

        // Check, that the count call also returns 0
        restResidentMockMvc
            .perform(get(ENTITY_API_URL + "/count?sort=id,desc&" + filter))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(content().string("0"));
    }

    @Test
    @Transactional
    void getNonExistingResident() throws Exception {
        // Get the resident
        restResidentMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingResident() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the resident
        Resident updatedResident = residentRepository.findById(resident.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedResident are not directly saved in db
        em.detach(updatedResident);
        updatedResident
            .fullName(UPDATED_FULL_NAME)
            .idCardNumber(UPDATED_ID_CARD_NUMBER)
            .birthYear(UPDATED_BIRTH_YEAR)
            .gender(UPDATED_GENDER)
            .relationship(UPDATED_RELATIONSHIP)
            .residenceType(UPDATED_RESIDENCE_TYPE)
            .temporaryRegisteredAt(UPDATED_TEMPORARY_REGISTERED_AT)
            .notes(UPDATED_NOTES);
        ResidentDTO residentDTO = residentMapper.toDto(updatedResident);

        restResidentMockMvc
            .perform(
                put(ENTITY_API_URL_ID, residentDTO.getId())
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(residentDTO))
            )
            .andExpect(status().isOk());

        // Validate the Resident in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedResidentToMatchAllProperties(updatedResident);
    }

    @Test
    @Transactional
    void putNonExistingResident() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        resident.setId(longCount.incrementAndGet());

        // Create the Resident
        ResidentDTO residentDTO = residentMapper.toDto(resident);

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restResidentMockMvc
            .perform(
                put(ENTITY_API_URL_ID, residentDTO.getId())
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(residentDTO))
            )
            .andExpect(status().isBadRequest());

        // Validate the Resident in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchResident() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        resident.setId(longCount.incrementAndGet());

        // Create the Resident
        ResidentDTO residentDTO = residentMapper.toDto(resident);

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restResidentMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(residentDTO))
            )
            .andExpect(status().isBadRequest());

        // Validate the Resident in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamResident() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        resident.setId(longCount.incrementAndGet());

        // Create the Resident
        ResidentDTO residentDTO = residentMapper.toDto(resident);

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restResidentMockMvc
            .perform(put(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(residentDTO)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the Resident in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateResidentWithPatch() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the resident using partial update
        Resident partialUpdatedResident = new Resident();
        partialUpdatedResident.setId(resident.getId());

        partialUpdatedResident
            .idCardNumber(UPDATED_ID_CARD_NUMBER)
            .birthYear(UPDATED_BIRTH_YEAR)
            .gender(UPDATED_GENDER)
            .relationship(UPDATED_RELATIONSHIP)
            .residenceType(UPDATED_RESIDENCE_TYPE)
            .temporaryRegisteredAt(UPDATED_TEMPORARY_REGISTERED_AT);

        restResidentMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedResident.getId())
                    .with(csrf())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedResident))
            )
            .andExpect(status().isOk());

        // Validate the Resident in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertResidentUpdatableFieldsEquals(createUpdateProxyForBean(partialUpdatedResident, resident), getPersistedResident(resident));
    }

    @Test
    @Transactional
    void fullUpdateResidentWithPatch() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the resident using partial update
        Resident partialUpdatedResident = new Resident();
        partialUpdatedResident.setId(resident.getId());

        partialUpdatedResident
            .fullName(UPDATED_FULL_NAME)
            .idCardNumber(UPDATED_ID_CARD_NUMBER)
            .birthYear(UPDATED_BIRTH_YEAR)
            .gender(UPDATED_GENDER)
            .relationship(UPDATED_RELATIONSHIP)
            .residenceType(UPDATED_RESIDENCE_TYPE)
            .temporaryRegisteredAt(UPDATED_TEMPORARY_REGISTERED_AT)
            .notes(UPDATED_NOTES);

        restResidentMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedResident.getId())
                    .with(csrf())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedResident))
            )
            .andExpect(status().isOk());

        // Validate the Resident in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertResidentUpdatableFieldsEquals(partialUpdatedResident, getPersistedResident(partialUpdatedResident));
    }

    @Test
    @Transactional
    void patchNonExistingResident() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        resident.setId(longCount.incrementAndGet());

        // Create the Resident
        ResidentDTO residentDTO = residentMapper.toDto(resident);

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restResidentMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, residentDTO.getId())
                    .with(csrf())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(residentDTO))
            )
            .andExpect(status().isBadRequest());

        // Validate the Resident in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchResident() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        resident.setId(longCount.incrementAndGet());

        // Create the Resident
        ResidentDTO residentDTO = residentMapper.toDto(resident);

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restResidentMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .with(csrf())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(residentDTO))
            )
            .andExpect(status().isBadRequest());

        // Validate the Resident in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamResident() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        resident.setId(longCount.incrementAndGet());

        // Create the Resident
        ResidentDTO residentDTO = residentMapper.toDto(resident);

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restResidentMockMvc
            .perform(
                patch(ENTITY_API_URL).with(csrf()).contentType("application/merge-patch+json").content(om.writeValueAsBytes(residentDTO))
            )
            .andExpect(status().isMethodNotAllowed());

        // Validate the Resident in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteResident() throws Exception {
        // Initialize the database
        insertedResident = residentRepository.saveAndFlush(resident);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the resident
        restResidentMockMvc
            .perform(delete(ENTITY_API_URL_ID, resident.getId()).with(csrf()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return residentRepository.count();
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

    protected Resident getPersistedResident(Resident resident) {
        return residentRepository.findById(resident.getId()).orElseThrow();
    }

    protected void assertPersistedResidentToMatchAllProperties(Resident expectedResident) {
        assertResidentAllPropertiesEquals(expectedResident, getPersistedResident(expectedResident));
    }

    protected void assertPersistedResidentToMatchUpdatableProperties(Resident expectedResident) {
        assertResidentAllUpdatablePropertiesEquals(expectedResident, getPersistedResident(expectedResident));
    }
}
