package com.policemanagement.com.web.rest;

import static com.policemanagement.com.domain.HouseholdAsserts.*;
import static com.policemanagement.com.web.rest.TestUtil.createUpdateProxyForBean;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.policemanagement.com.IntegrationTest;
import com.policemanagement.com.domain.AreaZone;
import com.policemanagement.com.domain.Household;
import com.policemanagement.com.domain.enumeration.FacilityType;
import com.policemanagement.com.domain.enumeration.SecurityStatus;
import com.policemanagement.com.repository.HouseholdRepository;
import com.policemanagement.com.service.HouseholdService;
import com.policemanagement.com.service.dto.HouseholdDTO;
import com.policemanagement.com.service.mapper.HouseholdMapper;
import jakarta.persistence.EntityManager;
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
 * Integration tests for the {@link HouseholdResource} REST controller.
 */
@IntegrationTest
@ExtendWith(MockitoExtension.class)
@AutoConfigureMockMvc
@WithMockUser
class HouseholdResourceIT {

    private static final String DEFAULT_CODE = "AAAAAAAAAA";
    private static final String UPDATED_CODE = "BBBBBBBBBB";

    private static final String DEFAULT_HOUSE_NUMBER = "AAAAAAAAAA";
    private static final String UPDATED_HOUSE_NUMBER = "BBBBBBBBBB";

    private static final String DEFAULT_STREET = "AAAAAAAAAA";
    private static final String UPDATED_STREET = "BBBBBBBBBB";

    private static final String DEFAULT_HAMLET = "AAAAAAAAAA";
    private static final String UPDATED_HAMLET = "BBBBBBBBBB";

    private static final String DEFAULT_NEIGHBORHOOD_GROUP = "AAAAAAAAAA";
    private static final String UPDATED_NEIGHBORHOOD_GROUP = "BBBBBBBBBB";

    private static final String DEFAULT_ALLEY = "AAAAAAAAAA";
    private static final String UPDATED_ALLEY = "BBBBBBBBBB";

    private static final String DEFAULT_OWNER_NAME = "AAAAAAAAAA";
    private static final String UPDATED_OWNER_NAME = "BBBBBBBBBB";

    private static final String DEFAULT_OWNER_PHONE = "AAAAAAAAAA";
    private static final String UPDATED_OWNER_PHONE = "BBBBBBBBBB";

    private static final FacilityType DEFAULT_TYPE = FacilityType.RESIDENTIAL;
    private static final FacilityType UPDATED_TYPE = FacilityType.BUSINESS;

    private static final String DEFAULT_BUSINESS_NAME = "AAAAAAAAAA";
    private static final String UPDATED_BUSINESS_NAME = "BBBBBBBBBB";

    private static final String DEFAULT_BUSINESS_CATEGORY = "AAAAAAAAAA";
    private static final String UPDATED_BUSINESS_CATEGORY = "BBBBBBBBBB";

    private static final Integer DEFAULT_RESIDENTS_COUNT = 1;
    private static final Integer UPDATED_RESIDENTS_COUNT = 2;
    private static final Integer SMALLER_RESIDENTS_COUNT = 1 - 1;

    private static final Integer DEFAULT_MALE_COUNT = 1;
    private static final Integer UPDATED_MALE_COUNT = 2;
    private static final Integer SMALLER_MALE_COUNT = 1 - 1;

    private static final Integer DEFAULT_FEMALE_COUNT = 1;
    private static final Integer UPDATED_FEMALE_COUNT = 2;
    private static final Integer SMALLER_FEMALE_COUNT = 1 - 1;

    private static final Integer DEFAULT_UNDER_18_COUNT = 1;
    private static final Integer UPDATED_UNDER_18_COUNT = 2;
    private static final Integer SMALLER_UNDER_18_COUNT = 1 - 1;

    private static final Integer DEFAULT_ABOVE_18_COUNT = 1;
    private static final Integer UPDATED_ABOVE_18_COUNT = 2;
    private static final Integer SMALLER_ABOVE_18_COUNT = 1 - 1;

    private static final SecurityStatus DEFAULT_STATUS = SecurityStatus.NORMAL;
    private static final SecurityStatus UPDATED_STATUS = SecurityStatus.WARNING;

    private static final String DEFAULT_WARNING_MESSAGE = "AAAAAAAAAA";
    private static final String UPDATED_WARNING_MESSAGE = "BBBBBBBBBB";

    private static final String DEFAULT_LICENSE_EXPIRY = "AAAAAAAAAA";
    private static final String UPDATED_LICENSE_EXPIRY = "BBBBBBBBBB";

    private static final String DEFAULT_LICENSE_TYPE = "AAAAAAAAAA";
    private static final String UPDATED_LICENSE_TYPE = "BBBBBBBBBB";

    private static final Double DEFAULT_LATITUDE = 1D;
    private static final Double UPDATED_LATITUDE = 2D;
    private static final Double SMALLER_LATITUDE = 1D - 1D;

    private static final Double DEFAULT_LONGITUDE = 1D;
    private static final Double UPDATED_LONGITUDE = 2D;
    private static final Double SMALLER_LONGITUDE = 1D - 1D;

    private static final String DEFAULT_NOTES = "AAAAAAAAAA";
    private static final String UPDATED_NOTES = "BBBBBBBBBB";

    private static final String DEFAULT_LAST_CHECKED_DATE = "AAAAAAAAAA";
    private static final String UPDATED_LAST_CHECKED_DATE = "BBBBBBBBBB";

    private static final String DEFAULT_OFFICER_IN_CHARGE = "AAAAAAAAAA";
    private static final String UPDATED_OFFICER_IN_CHARGE = "BBBBBBBBBB";

    private static final String ENTITY_API_URL = "/api/households";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + 2L * Integer.MAX_VALUE);

    @Autowired
    private ObjectMapper om;

    @Autowired
    private HouseholdRepository householdRepository;

    @Mock
    private HouseholdRepository householdRepositoryMock;

    @Autowired
    private HouseholdMapper householdMapper;

    @Mock
    private HouseholdService householdServiceMock;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restHouseholdMockMvc;

    private Household household;

    private Household insertedHousehold;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static Household createEntity() {
        return new Household()
            .code(DEFAULT_CODE)
            .houseNumber(DEFAULT_HOUSE_NUMBER)
            .street(DEFAULT_STREET)
            .hamlet(DEFAULT_HAMLET)
            .neighborhoodGroup(DEFAULT_NEIGHBORHOOD_GROUP)
            .alley(DEFAULT_ALLEY)
            .ownerName(DEFAULT_OWNER_NAME)
            .ownerPhone(DEFAULT_OWNER_PHONE)
            .type(DEFAULT_TYPE)
            .businessName(DEFAULT_BUSINESS_NAME)
            .businessCategory(DEFAULT_BUSINESS_CATEGORY)
            .residentsCount(DEFAULT_RESIDENTS_COUNT)
            .maleCount(DEFAULT_MALE_COUNT)
            .femaleCount(DEFAULT_FEMALE_COUNT)
            .under18Count(DEFAULT_UNDER_18_COUNT)
            .above18Count(DEFAULT_ABOVE_18_COUNT)
            .status(DEFAULT_STATUS)
            .warningMessage(DEFAULT_WARNING_MESSAGE)
            .licenseExpiry(DEFAULT_LICENSE_EXPIRY)
            .licenseType(DEFAULT_LICENSE_TYPE)
            .latitude(DEFAULT_LATITUDE)
            .longitude(DEFAULT_LONGITUDE)
            .notes(DEFAULT_NOTES)
            .lastCheckedDate(DEFAULT_LAST_CHECKED_DATE)
            .officerInCharge(DEFAULT_OFFICER_IN_CHARGE);
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static Household createUpdatedEntity() {
        return new Household()
            .code(UPDATED_CODE)
            .houseNumber(UPDATED_HOUSE_NUMBER)
            .street(UPDATED_STREET)
            .hamlet(UPDATED_HAMLET)
            .neighborhoodGroup(UPDATED_NEIGHBORHOOD_GROUP)
            .alley(UPDATED_ALLEY)
            .ownerName(UPDATED_OWNER_NAME)
            .ownerPhone(UPDATED_OWNER_PHONE)
            .type(UPDATED_TYPE)
            .businessName(UPDATED_BUSINESS_NAME)
            .businessCategory(UPDATED_BUSINESS_CATEGORY)
            .residentsCount(UPDATED_RESIDENTS_COUNT)
            .maleCount(UPDATED_MALE_COUNT)
            .femaleCount(UPDATED_FEMALE_COUNT)
            .under18Count(UPDATED_UNDER_18_COUNT)
            .above18Count(UPDATED_ABOVE_18_COUNT)
            .status(UPDATED_STATUS)
            .warningMessage(UPDATED_WARNING_MESSAGE)
            .licenseExpiry(UPDATED_LICENSE_EXPIRY)
            .licenseType(UPDATED_LICENSE_TYPE)
            .latitude(UPDATED_LATITUDE)
            .longitude(UPDATED_LONGITUDE)
            .notes(UPDATED_NOTES)
            .lastCheckedDate(UPDATED_LAST_CHECKED_DATE)
            .officerInCharge(UPDATED_OFFICER_IN_CHARGE);
    }

    @BeforeEach
    void initTest() {
        household = createEntity();
    }

    @AfterEach
    void cleanup() {
        if (insertedHousehold != null) {
            householdRepository.delete(insertedHousehold);
            insertedHousehold = null;
        }
    }

    @Test
    @Transactional
    void createHousehold() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the Household
        HouseholdDTO householdDTO = householdMapper.toDto(household);
        var returnedHouseholdDTO = om.readValue(
            restHouseholdMockMvc
                .perform(
                    post(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(householdDTO))
                )
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            HouseholdDTO.class
        );

        // Validate the Household in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        var returnedHousehold = householdMapper.toEntity(returnedHouseholdDTO);
        assertHouseholdUpdatableFieldsEquals(returnedHousehold, getPersistedHousehold(returnedHousehold));

        insertedHousehold = returnedHousehold;
    }

    @Test
    @Transactional
    void createHouseholdWithExistingId() throws Exception {
        // Create the Household with an existing ID
        household.setId(1L);
        HouseholdDTO householdDTO = householdMapper.toDto(household);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restHouseholdMockMvc
            .perform(post(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(householdDTO)))
            .andExpect(status().isBadRequest());

        // Validate the Household in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkCodeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        household.setCode(null);

        // Create the Household, which fails.
        HouseholdDTO householdDTO = householdMapper.toDto(household);

        restHouseholdMockMvc
            .perform(post(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(householdDTO)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkHouseNumberIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        household.setHouseNumber(null);

        // Create the Household, which fails.
        HouseholdDTO householdDTO = householdMapper.toDto(household);

        restHouseholdMockMvc
            .perform(post(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(householdDTO)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkStreetIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        household.setStreet(null);

        // Create the Household, which fails.
        HouseholdDTO householdDTO = householdMapper.toDto(household);

        restHouseholdMockMvc
            .perform(post(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(householdDTO)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkHamletIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        household.setHamlet(null);

        // Create the Household, which fails.
        HouseholdDTO householdDTO = householdMapper.toDto(household);

        restHouseholdMockMvc
            .perform(post(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(householdDTO)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkOwnerNameIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        household.setOwnerName(null);

        // Create the Household, which fails.
        HouseholdDTO householdDTO = householdMapper.toDto(household);

        restHouseholdMockMvc
            .perform(post(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(householdDTO)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkOwnerPhoneIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        household.setOwnerPhone(null);

        // Create the Household, which fails.
        HouseholdDTO householdDTO = householdMapper.toDto(household);

        restHouseholdMockMvc
            .perform(post(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(householdDTO)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkTypeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        household.setType(null);

        // Create the Household, which fails.
        HouseholdDTO householdDTO = householdMapper.toDto(household);

        restHouseholdMockMvc
            .perform(post(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(householdDTO)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllHouseholds() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList
        restHouseholdMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(household.getId().intValue())))
            .andExpect(jsonPath("$.[*].code").value(hasItem(DEFAULT_CODE)))
            .andExpect(jsonPath("$.[*].houseNumber").value(hasItem(DEFAULT_HOUSE_NUMBER)))
            .andExpect(jsonPath("$.[*].street").value(hasItem(DEFAULT_STREET)))
            .andExpect(jsonPath("$.[*].hamlet").value(hasItem(DEFAULT_HAMLET)))
            .andExpect(jsonPath("$.[*].neighborhoodGroup").value(hasItem(DEFAULT_NEIGHBORHOOD_GROUP)))
            .andExpect(jsonPath("$.[*].alley").value(hasItem(DEFAULT_ALLEY)))
            .andExpect(jsonPath("$.[*].ownerName").value(hasItem(DEFAULT_OWNER_NAME)))
            .andExpect(jsonPath("$.[*].ownerPhone").value(hasItem(DEFAULT_OWNER_PHONE)))
            .andExpect(jsonPath("$.[*].type").value(hasItem(DEFAULT_TYPE.toString())))
            .andExpect(jsonPath("$.[*].businessName").value(hasItem(DEFAULT_BUSINESS_NAME)))
            .andExpect(jsonPath("$.[*].businessCategory").value(hasItem(DEFAULT_BUSINESS_CATEGORY)))
            .andExpect(jsonPath("$.[*].residentsCount").value(hasItem(DEFAULT_RESIDENTS_COUNT)))
            .andExpect(jsonPath("$.[*].maleCount").value(hasItem(DEFAULT_MALE_COUNT)))
            .andExpect(jsonPath("$.[*].femaleCount").value(hasItem(DEFAULT_FEMALE_COUNT)))
            .andExpect(jsonPath("$.[*].under18Count").value(hasItem(DEFAULT_UNDER_18_COUNT)))
            .andExpect(jsonPath("$.[*].above18Count").value(hasItem(DEFAULT_ABOVE_18_COUNT)))
            .andExpect(jsonPath("$.[*].status").value(hasItem(DEFAULT_STATUS.toString())))
            .andExpect(jsonPath("$.[*].warningMessage").value(hasItem(DEFAULT_WARNING_MESSAGE)))
            .andExpect(jsonPath("$.[*].licenseExpiry").value(hasItem(DEFAULT_LICENSE_EXPIRY)))
            .andExpect(jsonPath("$.[*].licenseType").value(hasItem(DEFAULT_LICENSE_TYPE)))
            .andExpect(jsonPath("$.[*].latitude").value(hasItem(DEFAULT_LATITUDE)))
            .andExpect(jsonPath("$.[*].longitude").value(hasItem(DEFAULT_LONGITUDE)))
            .andExpect(jsonPath("$.[*].notes").value(hasItem(DEFAULT_NOTES)))
            .andExpect(jsonPath("$.[*].lastCheckedDate").value(hasItem(DEFAULT_LAST_CHECKED_DATE)))
            .andExpect(jsonPath("$.[*].officerInCharge").value(hasItem(DEFAULT_OFFICER_IN_CHARGE)));
    }

    @SuppressWarnings({ "unchecked" })
    void getAllHouseholdsWithEagerRelationshipsIsEnabled() throws Exception {
        when(householdServiceMock.findAllWithEagerRelationships(any())).thenReturn(new PageImpl(new ArrayList<>()));

        restHouseholdMockMvc.perform(get(ENTITY_API_URL + "?eagerload=true")).andExpect(status().isOk());

        verify(householdServiceMock, times(1)).findAllWithEagerRelationships(any());
    }

    @SuppressWarnings({ "unchecked" })
    void getAllHouseholdsWithEagerRelationshipsIsNotEnabled() throws Exception {
        when(householdServiceMock.findAllWithEagerRelationships(any())).thenReturn(new PageImpl(new ArrayList<>()));

        restHouseholdMockMvc.perform(get(ENTITY_API_URL + "?eagerload=false")).andExpect(status().isOk());
        verify(householdRepositoryMock, times(1)).findAll(any(Pageable.class));
    }

    @Test
    @Transactional
    void getHousehold() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get the household
        restHouseholdMockMvc
            .perform(get(ENTITY_API_URL_ID, household.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(household.getId().intValue()))
            .andExpect(jsonPath("$.code").value(DEFAULT_CODE))
            .andExpect(jsonPath("$.houseNumber").value(DEFAULT_HOUSE_NUMBER))
            .andExpect(jsonPath("$.street").value(DEFAULT_STREET))
            .andExpect(jsonPath("$.hamlet").value(DEFAULT_HAMLET))
            .andExpect(jsonPath("$.neighborhoodGroup").value(DEFAULT_NEIGHBORHOOD_GROUP))
            .andExpect(jsonPath("$.alley").value(DEFAULT_ALLEY))
            .andExpect(jsonPath("$.ownerName").value(DEFAULT_OWNER_NAME))
            .andExpect(jsonPath("$.ownerPhone").value(DEFAULT_OWNER_PHONE))
            .andExpect(jsonPath("$.type").value(DEFAULT_TYPE.toString()))
            .andExpect(jsonPath("$.businessName").value(DEFAULT_BUSINESS_NAME))
            .andExpect(jsonPath("$.businessCategory").value(DEFAULT_BUSINESS_CATEGORY))
            .andExpect(jsonPath("$.residentsCount").value(DEFAULT_RESIDENTS_COUNT))
            .andExpect(jsonPath("$.maleCount").value(DEFAULT_MALE_COUNT))
            .andExpect(jsonPath("$.femaleCount").value(DEFAULT_FEMALE_COUNT))
            .andExpect(jsonPath("$.under18Count").value(DEFAULT_UNDER_18_COUNT))
            .andExpect(jsonPath("$.above18Count").value(DEFAULT_ABOVE_18_COUNT))
            .andExpect(jsonPath("$.status").value(DEFAULT_STATUS.toString()))
            .andExpect(jsonPath("$.warningMessage").value(DEFAULT_WARNING_MESSAGE))
            .andExpect(jsonPath("$.licenseExpiry").value(DEFAULT_LICENSE_EXPIRY))
            .andExpect(jsonPath("$.licenseType").value(DEFAULT_LICENSE_TYPE))
            .andExpect(jsonPath("$.latitude").value(DEFAULT_LATITUDE))
            .andExpect(jsonPath("$.longitude").value(DEFAULT_LONGITUDE))
            .andExpect(jsonPath("$.notes").value(DEFAULT_NOTES))
            .andExpect(jsonPath("$.lastCheckedDate").value(DEFAULT_LAST_CHECKED_DATE))
            .andExpect(jsonPath("$.officerInCharge").value(DEFAULT_OFFICER_IN_CHARGE));
    }

    @Test
    @Transactional
    void getHouseholdsByIdFiltering() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        Long id = household.getId();

        defaultHouseholdFiltering("id.equals=" + id, "id.notEquals=" + id);

        defaultHouseholdFiltering("id.greaterThanOrEqual=" + id, "id.greaterThan=" + id);

        defaultHouseholdFiltering("id.lessThanOrEqual=" + id, "id.lessThan=" + id);
    }

    @Test
    @Transactional
    void getAllHouseholdsByCodeIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where code equals to
        defaultHouseholdFiltering("code.equals=" + DEFAULT_CODE, "code.equals=" + UPDATED_CODE);
    }

    @Test
    @Transactional
    void getAllHouseholdsByCodeIsInShouldWork() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where code in
        defaultHouseholdFiltering("code.in=" + DEFAULT_CODE + "," + UPDATED_CODE, "code.in=" + UPDATED_CODE);
    }

    @Test
    @Transactional
    void getAllHouseholdsByCodeIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where code is not null
        defaultHouseholdFiltering("code.specified=true", "code.specified=false");
    }

    @Test
    @Transactional
    void getAllHouseholdsByCodeContainsSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where code contains
        defaultHouseholdFiltering("code.contains=" + DEFAULT_CODE, "code.contains=" + UPDATED_CODE);
    }

    @Test
    @Transactional
    void getAllHouseholdsByCodeNotContainsSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where code does not contain
        defaultHouseholdFiltering("code.doesNotContain=" + UPDATED_CODE, "code.doesNotContain=" + DEFAULT_CODE);
    }

    @Test
    @Transactional
    void getAllHouseholdsByHouseNumberIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where houseNumber equals to
        defaultHouseholdFiltering("houseNumber.equals=" + DEFAULT_HOUSE_NUMBER, "houseNumber.equals=" + UPDATED_HOUSE_NUMBER);
    }

    @Test
    @Transactional
    void getAllHouseholdsByHouseNumberIsInShouldWork() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where houseNumber in
        defaultHouseholdFiltering(
            "houseNumber.in=" + DEFAULT_HOUSE_NUMBER + "," + UPDATED_HOUSE_NUMBER,
            "houseNumber.in=" + UPDATED_HOUSE_NUMBER
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByHouseNumberIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where houseNumber is not null
        defaultHouseholdFiltering("houseNumber.specified=true", "houseNumber.specified=false");
    }

    @Test
    @Transactional
    void getAllHouseholdsByHouseNumberContainsSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where houseNumber contains
        defaultHouseholdFiltering("houseNumber.contains=" + DEFAULT_HOUSE_NUMBER, "houseNumber.contains=" + UPDATED_HOUSE_NUMBER);
    }

    @Test
    @Transactional
    void getAllHouseholdsByHouseNumberNotContainsSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where houseNumber does not contain
        defaultHouseholdFiltering(
            "houseNumber.doesNotContain=" + UPDATED_HOUSE_NUMBER,
            "houseNumber.doesNotContain=" + DEFAULT_HOUSE_NUMBER
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByStreetIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where street equals to
        defaultHouseholdFiltering("street.equals=" + DEFAULT_STREET, "street.equals=" + UPDATED_STREET);
    }

    @Test
    @Transactional
    void getAllHouseholdsByStreetIsInShouldWork() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where street in
        defaultHouseholdFiltering("street.in=" + DEFAULT_STREET + "," + UPDATED_STREET, "street.in=" + UPDATED_STREET);
    }

    @Test
    @Transactional
    void getAllHouseholdsByStreetIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where street is not null
        defaultHouseholdFiltering("street.specified=true", "street.specified=false");
    }

    @Test
    @Transactional
    void getAllHouseholdsByStreetContainsSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where street contains
        defaultHouseholdFiltering("street.contains=" + DEFAULT_STREET, "street.contains=" + UPDATED_STREET);
    }

    @Test
    @Transactional
    void getAllHouseholdsByStreetNotContainsSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where street does not contain
        defaultHouseholdFiltering("street.doesNotContain=" + UPDATED_STREET, "street.doesNotContain=" + DEFAULT_STREET);
    }

    @Test
    @Transactional
    void getAllHouseholdsByHamletIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where hamlet equals to
        defaultHouseholdFiltering("hamlet.equals=" + DEFAULT_HAMLET, "hamlet.equals=" + UPDATED_HAMLET);
    }

    @Test
    @Transactional
    void getAllHouseholdsByHamletIsInShouldWork() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where hamlet in
        defaultHouseholdFiltering("hamlet.in=" + DEFAULT_HAMLET + "," + UPDATED_HAMLET, "hamlet.in=" + UPDATED_HAMLET);
    }

    @Test
    @Transactional
    void getAllHouseholdsByHamletIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where hamlet is not null
        defaultHouseholdFiltering("hamlet.specified=true", "hamlet.specified=false");
    }

    @Test
    @Transactional
    void getAllHouseholdsByHamletContainsSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where hamlet contains
        defaultHouseholdFiltering("hamlet.contains=" + DEFAULT_HAMLET, "hamlet.contains=" + UPDATED_HAMLET);
    }

    @Test
    @Transactional
    void getAllHouseholdsByHamletNotContainsSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where hamlet does not contain
        defaultHouseholdFiltering("hamlet.doesNotContain=" + UPDATED_HAMLET, "hamlet.doesNotContain=" + DEFAULT_HAMLET);
    }

    @Test
    @Transactional
    void getAllHouseholdsByNeighborhoodGroupIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where neighborhoodGroup equals to
        defaultHouseholdFiltering(
            "neighborhoodGroup.equals=" + DEFAULT_NEIGHBORHOOD_GROUP,
            "neighborhoodGroup.equals=" + UPDATED_NEIGHBORHOOD_GROUP
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByNeighborhoodGroupIsInShouldWork() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where neighborhoodGroup in
        defaultHouseholdFiltering(
            "neighborhoodGroup.in=" + DEFAULT_NEIGHBORHOOD_GROUP + "," + UPDATED_NEIGHBORHOOD_GROUP,
            "neighborhoodGroup.in=" + UPDATED_NEIGHBORHOOD_GROUP
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByNeighborhoodGroupIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where neighborhoodGroup is not null
        defaultHouseholdFiltering("neighborhoodGroup.specified=true", "neighborhoodGroup.specified=false");
    }

    @Test
    @Transactional
    void getAllHouseholdsByNeighborhoodGroupContainsSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where neighborhoodGroup contains
        defaultHouseholdFiltering(
            "neighborhoodGroup.contains=" + DEFAULT_NEIGHBORHOOD_GROUP,
            "neighborhoodGroup.contains=" + UPDATED_NEIGHBORHOOD_GROUP
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByNeighborhoodGroupNotContainsSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where neighborhoodGroup does not contain
        defaultHouseholdFiltering(
            "neighborhoodGroup.doesNotContain=" + UPDATED_NEIGHBORHOOD_GROUP,
            "neighborhoodGroup.doesNotContain=" + DEFAULT_NEIGHBORHOOD_GROUP
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByAlleyIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where alley equals to
        defaultHouseholdFiltering("alley.equals=" + DEFAULT_ALLEY, "alley.equals=" + UPDATED_ALLEY);
    }

    @Test
    @Transactional
    void getAllHouseholdsByAlleyIsInShouldWork() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where alley in
        defaultHouseholdFiltering("alley.in=" + DEFAULT_ALLEY + "," + UPDATED_ALLEY, "alley.in=" + UPDATED_ALLEY);
    }

    @Test
    @Transactional
    void getAllHouseholdsByAlleyIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where alley is not null
        defaultHouseholdFiltering("alley.specified=true", "alley.specified=false");
    }

    @Test
    @Transactional
    void getAllHouseholdsByAlleyContainsSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where alley contains
        defaultHouseholdFiltering("alley.contains=" + DEFAULT_ALLEY, "alley.contains=" + UPDATED_ALLEY);
    }

    @Test
    @Transactional
    void getAllHouseholdsByAlleyNotContainsSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where alley does not contain
        defaultHouseholdFiltering("alley.doesNotContain=" + UPDATED_ALLEY, "alley.doesNotContain=" + DEFAULT_ALLEY);
    }

    @Test
    @Transactional
    void getAllHouseholdsByOwnerNameIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where ownerName equals to
        defaultHouseholdFiltering("ownerName.equals=" + DEFAULT_OWNER_NAME, "ownerName.equals=" + UPDATED_OWNER_NAME);
    }

    @Test
    @Transactional
    void getAllHouseholdsByOwnerNameIsInShouldWork() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where ownerName in
        defaultHouseholdFiltering("ownerName.in=" + DEFAULT_OWNER_NAME + "," + UPDATED_OWNER_NAME, "ownerName.in=" + UPDATED_OWNER_NAME);
    }

    @Test
    @Transactional
    void getAllHouseholdsByOwnerNameIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where ownerName is not null
        defaultHouseholdFiltering("ownerName.specified=true", "ownerName.specified=false");
    }

    @Test
    @Transactional
    void getAllHouseholdsByOwnerNameContainsSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where ownerName contains
        defaultHouseholdFiltering("ownerName.contains=" + DEFAULT_OWNER_NAME, "ownerName.contains=" + UPDATED_OWNER_NAME);
    }

    @Test
    @Transactional
    void getAllHouseholdsByOwnerNameNotContainsSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where ownerName does not contain
        defaultHouseholdFiltering("ownerName.doesNotContain=" + UPDATED_OWNER_NAME, "ownerName.doesNotContain=" + DEFAULT_OWNER_NAME);
    }

    @Test
    @Transactional
    void getAllHouseholdsByOwnerPhoneIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where ownerPhone equals to
        defaultHouseholdFiltering("ownerPhone.equals=" + DEFAULT_OWNER_PHONE, "ownerPhone.equals=" + UPDATED_OWNER_PHONE);
    }

    @Test
    @Transactional
    void getAllHouseholdsByOwnerPhoneIsInShouldWork() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where ownerPhone in
        defaultHouseholdFiltering(
            "ownerPhone.in=" + DEFAULT_OWNER_PHONE + "," + UPDATED_OWNER_PHONE,
            "ownerPhone.in=" + UPDATED_OWNER_PHONE
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByOwnerPhoneIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where ownerPhone is not null
        defaultHouseholdFiltering("ownerPhone.specified=true", "ownerPhone.specified=false");
    }

    @Test
    @Transactional
    void getAllHouseholdsByOwnerPhoneContainsSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where ownerPhone contains
        defaultHouseholdFiltering("ownerPhone.contains=" + DEFAULT_OWNER_PHONE, "ownerPhone.contains=" + UPDATED_OWNER_PHONE);
    }

    @Test
    @Transactional
    void getAllHouseholdsByOwnerPhoneNotContainsSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where ownerPhone does not contain
        defaultHouseholdFiltering("ownerPhone.doesNotContain=" + UPDATED_OWNER_PHONE, "ownerPhone.doesNotContain=" + DEFAULT_OWNER_PHONE);
    }

    @Test
    @Transactional
    void getAllHouseholdsByTypeIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where type equals to
        defaultHouseholdFiltering("type.equals=" + DEFAULT_TYPE, "type.equals=" + UPDATED_TYPE);
    }

    @Test
    @Transactional
    void getAllHouseholdsByTypeIsInShouldWork() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where type in
        defaultHouseholdFiltering("type.in=" + DEFAULT_TYPE + "," + UPDATED_TYPE, "type.in=" + UPDATED_TYPE);
    }

    @Test
    @Transactional
    void getAllHouseholdsByTypeIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where type is not null
        defaultHouseholdFiltering("type.specified=true", "type.specified=false");
    }

    @Test
    @Transactional
    void getAllHouseholdsByBusinessNameIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where businessName equals to
        defaultHouseholdFiltering("businessName.equals=" + DEFAULT_BUSINESS_NAME, "businessName.equals=" + UPDATED_BUSINESS_NAME);
    }

    @Test
    @Transactional
    void getAllHouseholdsByBusinessNameIsInShouldWork() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where businessName in
        defaultHouseholdFiltering(
            "businessName.in=" + DEFAULT_BUSINESS_NAME + "," + UPDATED_BUSINESS_NAME,
            "businessName.in=" + UPDATED_BUSINESS_NAME
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByBusinessNameIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where businessName is not null
        defaultHouseholdFiltering("businessName.specified=true", "businessName.specified=false");
    }

    @Test
    @Transactional
    void getAllHouseholdsByBusinessNameContainsSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where businessName contains
        defaultHouseholdFiltering("businessName.contains=" + DEFAULT_BUSINESS_NAME, "businessName.contains=" + UPDATED_BUSINESS_NAME);
    }

    @Test
    @Transactional
    void getAllHouseholdsByBusinessNameNotContainsSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where businessName does not contain
        defaultHouseholdFiltering(
            "businessName.doesNotContain=" + UPDATED_BUSINESS_NAME,
            "businessName.doesNotContain=" + DEFAULT_BUSINESS_NAME
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByBusinessCategoryIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where businessCategory equals to
        defaultHouseholdFiltering(
            "businessCategory.equals=" + DEFAULT_BUSINESS_CATEGORY,
            "businessCategory.equals=" + UPDATED_BUSINESS_CATEGORY
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByBusinessCategoryIsInShouldWork() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where businessCategory in
        defaultHouseholdFiltering(
            "businessCategory.in=" + DEFAULT_BUSINESS_CATEGORY + "," + UPDATED_BUSINESS_CATEGORY,
            "businessCategory.in=" + UPDATED_BUSINESS_CATEGORY
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByBusinessCategoryIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where businessCategory is not null
        defaultHouseholdFiltering("businessCategory.specified=true", "businessCategory.specified=false");
    }

    @Test
    @Transactional
    void getAllHouseholdsByBusinessCategoryContainsSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where businessCategory contains
        defaultHouseholdFiltering(
            "businessCategory.contains=" + DEFAULT_BUSINESS_CATEGORY,
            "businessCategory.contains=" + UPDATED_BUSINESS_CATEGORY
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByBusinessCategoryNotContainsSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where businessCategory does not contain
        defaultHouseholdFiltering(
            "businessCategory.doesNotContain=" + UPDATED_BUSINESS_CATEGORY,
            "businessCategory.doesNotContain=" + DEFAULT_BUSINESS_CATEGORY
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByResidentsCountIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where residentsCount equals to
        defaultHouseholdFiltering("residentsCount.equals=" + DEFAULT_RESIDENTS_COUNT, "residentsCount.equals=" + UPDATED_RESIDENTS_COUNT);
    }

    @Test
    @Transactional
    void getAllHouseholdsByResidentsCountIsInShouldWork() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where residentsCount in
        defaultHouseholdFiltering(
            "residentsCount.in=" + DEFAULT_RESIDENTS_COUNT + "," + UPDATED_RESIDENTS_COUNT,
            "residentsCount.in=" + UPDATED_RESIDENTS_COUNT
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByResidentsCountIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where residentsCount is not null
        defaultHouseholdFiltering("residentsCount.specified=true", "residentsCount.specified=false");
    }

    @Test
    @Transactional
    void getAllHouseholdsByResidentsCountIsGreaterThanOrEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where residentsCount is greater than or equal to
        defaultHouseholdFiltering(
            "residentsCount.greaterThanOrEqual=" + DEFAULT_RESIDENTS_COUNT,
            "residentsCount.greaterThanOrEqual=" + UPDATED_RESIDENTS_COUNT
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByResidentsCountIsLessThanOrEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where residentsCount is less than or equal to
        defaultHouseholdFiltering(
            "residentsCount.lessThanOrEqual=" + DEFAULT_RESIDENTS_COUNT,
            "residentsCount.lessThanOrEqual=" + SMALLER_RESIDENTS_COUNT
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByResidentsCountIsLessThanSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where residentsCount is less than
        defaultHouseholdFiltering(
            "residentsCount.lessThan=" + UPDATED_RESIDENTS_COUNT,
            "residentsCount.lessThan=" + DEFAULT_RESIDENTS_COUNT
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByResidentsCountIsGreaterThanSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where residentsCount is greater than
        defaultHouseholdFiltering(
            "residentsCount.greaterThan=" + SMALLER_RESIDENTS_COUNT,
            "residentsCount.greaterThan=" + DEFAULT_RESIDENTS_COUNT
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByMaleCountIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where maleCount equals to
        defaultHouseholdFiltering("maleCount.equals=" + DEFAULT_MALE_COUNT, "maleCount.equals=" + UPDATED_MALE_COUNT);
    }

    @Test
    @Transactional
    void getAllHouseholdsByMaleCountIsInShouldWork() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where maleCount in
        defaultHouseholdFiltering("maleCount.in=" + DEFAULT_MALE_COUNT + "," + UPDATED_MALE_COUNT, "maleCount.in=" + UPDATED_MALE_COUNT);
    }

    @Test
    @Transactional
    void getAllHouseholdsByMaleCountIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where maleCount is not null
        defaultHouseholdFiltering("maleCount.specified=true", "maleCount.specified=false");
    }

    @Test
    @Transactional
    void getAllHouseholdsByMaleCountIsGreaterThanOrEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where maleCount is greater than or equal to
        defaultHouseholdFiltering(
            "maleCount.greaterThanOrEqual=" + DEFAULT_MALE_COUNT,
            "maleCount.greaterThanOrEqual=" + UPDATED_MALE_COUNT
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByMaleCountIsLessThanOrEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where maleCount is less than or equal to
        defaultHouseholdFiltering("maleCount.lessThanOrEqual=" + DEFAULT_MALE_COUNT, "maleCount.lessThanOrEqual=" + SMALLER_MALE_COUNT);
    }

    @Test
    @Transactional
    void getAllHouseholdsByMaleCountIsLessThanSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where maleCount is less than
        defaultHouseholdFiltering("maleCount.lessThan=" + UPDATED_MALE_COUNT, "maleCount.lessThan=" + DEFAULT_MALE_COUNT);
    }

    @Test
    @Transactional
    void getAllHouseholdsByMaleCountIsGreaterThanSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where maleCount is greater than
        defaultHouseholdFiltering("maleCount.greaterThan=" + SMALLER_MALE_COUNT, "maleCount.greaterThan=" + DEFAULT_MALE_COUNT);
    }

    @Test
    @Transactional
    void getAllHouseholdsByFemaleCountIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where femaleCount equals to
        defaultHouseholdFiltering("femaleCount.equals=" + DEFAULT_FEMALE_COUNT, "femaleCount.equals=" + UPDATED_FEMALE_COUNT);
    }

    @Test
    @Transactional
    void getAllHouseholdsByFemaleCountIsInShouldWork() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where femaleCount in
        defaultHouseholdFiltering(
            "femaleCount.in=" + DEFAULT_FEMALE_COUNT + "," + UPDATED_FEMALE_COUNT,
            "femaleCount.in=" + UPDATED_FEMALE_COUNT
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByFemaleCountIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where femaleCount is not null
        defaultHouseholdFiltering("femaleCount.specified=true", "femaleCount.specified=false");
    }

    @Test
    @Transactional
    void getAllHouseholdsByFemaleCountIsGreaterThanOrEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where femaleCount is greater than or equal to
        defaultHouseholdFiltering(
            "femaleCount.greaterThanOrEqual=" + DEFAULT_FEMALE_COUNT,
            "femaleCount.greaterThanOrEqual=" + UPDATED_FEMALE_COUNT
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByFemaleCountIsLessThanOrEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where femaleCount is less than or equal to
        defaultHouseholdFiltering(
            "femaleCount.lessThanOrEqual=" + DEFAULT_FEMALE_COUNT,
            "femaleCount.lessThanOrEqual=" + SMALLER_FEMALE_COUNT
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByFemaleCountIsLessThanSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where femaleCount is less than
        defaultHouseholdFiltering("femaleCount.lessThan=" + UPDATED_FEMALE_COUNT, "femaleCount.lessThan=" + DEFAULT_FEMALE_COUNT);
    }

    @Test
    @Transactional
    void getAllHouseholdsByFemaleCountIsGreaterThanSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where femaleCount is greater than
        defaultHouseholdFiltering("femaleCount.greaterThan=" + SMALLER_FEMALE_COUNT, "femaleCount.greaterThan=" + DEFAULT_FEMALE_COUNT);
    }

    @Test
    @Transactional
    void getAllHouseholdsByUnder18CountIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where under18Count equals to
        defaultHouseholdFiltering("under18Count.equals=" + DEFAULT_UNDER_18_COUNT, "under18Count.equals=" + UPDATED_UNDER_18_COUNT);
    }

    @Test
    @Transactional
    void getAllHouseholdsByUnder18CountIsInShouldWork() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where under18Count in
        defaultHouseholdFiltering(
            "under18Count.in=" + DEFAULT_UNDER_18_COUNT + "," + UPDATED_UNDER_18_COUNT,
            "under18Count.in=" + UPDATED_UNDER_18_COUNT
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByUnder18CountIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where under18Count is not null
        defaultHouseholdFiltering("under18Count.specified=true", "under18Count.specified=false");
    }

    @Test
    @Transactional
    void getAllHouseholdsByUnder18CountIsGreaterThanOrEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where under18Count is greater than or equal to
        defaultHouseholdFiltering(
            "under18Count.greaterThanOrEqual=" + DEFAULT_UNDER_18_COUNT,
            "under18Count.greaterThanOrEqual=" + UPDATED_UNDER_18_COUNT
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByUnder18CountIsLessThanOrEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where under18Count is less than or equal to
        defaultHouseholdFiltering(
            "under18Count.lessThanOrEqual=" + DEFAULT_UNDER_18_COUNT,
            "under18Count.lessThanOrEqual=" + SMALLER_UNDER_18_COUNT
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByUnder18CountIsLessThanSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where under18Count is less than
        defaultHouseholdFiltering("under18Count.lessThan=" + UPDATED_UNDER_18_COUNT, "under18Count.lessThan=" + DEFAULT_UNDER_18_COUNT);
    }

    @Test
    @Transactional
    void getAllHouseholdsByUnder18CountIsGreaterThanSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where under18Count is greater than
        defaultHouseholdFiltering(
            "under18Count.greaterThan=" + SMALLER_UNDER_18_COUNT,
            "under18Count.greaterThan=" + DEFAULT_UNDER_18_COUNT
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByAbove18CountIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where above18Count equals to
        defaultHouseholdFiltering("above18Count.equals=" + DEFAULT_ABOVE_18_COUNT, "above18Count.equals=" + UPDATED_ABOVE_18_COUNT);
    }

    @Test
    @Transactional
    void getAllHouseholdsByAbove18CountIsInShouldWork() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where above18Count in
        defaultHouseholdFiltering(
            "above18Count.in=" + DEFAULT_ABOVE_18_COUNT + "," + UPDATED_ABOVE_18_COUNT,
            "above18Count.in=" + UPDATED_ABOVE_18_COUNT
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByAbove18CountIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where above18Count is not null
        defaultHouseholdFiltering("above18Count.specified=true", "above18Count.specified=false");
    }

    @Test
    @Transactional
    void getAllHouseholdsByAbove18CountIsGreaterThanOrEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where above18Count is greater than or equal to
        defaultHouseholdFiltering(
            "above18Count.greaterThanOrEqual=" + DEFAULT_ABOVE_18_COUNT,
            "above18Count.greaterThanOrEqual=" + UPDATED_ABOVE_18_COUNT
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByAbove18CountIsLessThanOrEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where above18Count is less than or equal to
        defaultHouseholdFiltering(
            "above18Count.lessThanOrEqual=" + DEFAULT_ABOVE_18_COUNT,
            "above18Count.lessThanOrEqual=" + SMALLER_ABOVE_18_COUNT
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByAbove18CountIsLessThanSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where above18Count is less than
        defaultHouseholdFiltering("above18Count.lessThan=" + UPDATED_ABOVE_18_COUNT, "above18Count.lessThan=" + DEFAULT_ABOVE_18_COUNT);
    }

    @Test
    @Transactional
    void getAllHouseholdsByAbove18CountIsGreaterThanSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where above18Count is greater than
        defaultHouseholdFiltering(
            "above18Count.greaterThan=" + SMALLER_ABOVE_18_COUNT,
            "above18Count.greaterThan=" + DEFAULT_ABOVE_18_COUNT
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByStatusIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where status equals to
        defaultHouseholdFiltering("status.equals=" + DEFAULT_STATUS, "status.equals=" + UPDATED_STATUS);
    }

    @Test
    @Transactional
    void getAllHouseholdsByStatusIsInShouldWork() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where status in
        defaultHouseholdFiltering("status.in=" + DEFAULT_STATUS + "," + UPDATED_STATUS, "status.in=" + UPDATED_STATUS);
    }

    @Test
    @Transactional
    void getAllHouseholdsByStatusIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where status is not null
        defaultHouseholdFiltering("status.specified=true", "status.specified=false");
    }

    @Test
    @Transactional
    void getAllHouseholdsByWarningMessageIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where warningMessage equals to
        defaultHouseholdFiltering("warningMessage.equals=" + DEFAULT_WARNING_MESSAGE, "warningMessage.equals=" + UPDATED_WARNING_MESSAGE);
    }

    @Test
    @Transactional
    void getAllHouseholdsByWarningMessageIsInShouldWork() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where warningMessage in
        defaultHouseholdFiltering(
            "warningMessage.in=" + DEFAULT_WARNING_MESSAGE + "," + UPDATED_WARNING_MESSAGE,
            "warningMessage.in=" + UPDATED_WARNING_MESSAGE
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByWarningMessageIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where warningMessage is not null
        defaultHouseholdFiltering("warningMessage.specified=true", "warningMessage.specified=false");
    }

    @Test
    @Transactional
    void getAllHouseholdsByWarningMessageContainsSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where warningMessage contains
        defaultHouseholdFiltering(
            "warningMessage.contains=" + DEFAULT_WARNING_MESSAGE,
            "warningMessage.contains=" + UPDATED_WARNING_MESSAGE
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByWarningMessageNotContainsSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where warningMessage does not contain
        defaultHouseholdFiltering(
            "warningMessage.doesNotContain=" + UPDATED_WARNING_MESSAGE,
            "warningMessage.doesNotContain=" + DEFAULT_WARNING_MESSAGE
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByLicenseExpiryIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where licenseExpiry equals to
        defaultHouseholdFiltering("licenseExpiry.equals=" + DEFAULT_LICENSE_EXPIRY, "licenseExpiry.equals=" + UPDATED_LICENSE_EXPIRY);
    }

    @Test
    @Transactional
    void getAllHouseholdsByLicenseExpiryIsInShouldWork() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where licenseExpiry in
        defaultHouseholdFiltering(
            "licenseExpiry.in=" + DEFAULT_LICENSE_EXPIRY + "," + UPDATED_LICENSE_EXPIRY,
            "licenseExpiry.in=" + UPDATED_LICENSE_EXPIRY
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByLicenseExpiryIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where licenseExpiry is not null
        defaultHouseholdFiltering("licenseExpiry.specified=true", "licenseExpiry.specified=false");
    }

    @Test
    @Transactional
    void getAllHouseholdsByLicenseExpiryContainsSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where licenseExpiry contains
        defaultHouseholdFiltering("licenseExpiry.contains=" + DEFAULT_LICENSE_EXPIRY, "licenseExpiry.contains=" + UPDATED_LICENSE_EXPIRY);
    }

    @Test
    @Transactional
    void getAllHouseholdsByLicenseExpiryNotContainsSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where licenseExpiry does not contain
        defaultHouseholdFiltering(
            "licenseExpiry.doesNotContain=" + UPDATED_LICENSE_EXPIRY,
            "licenseExpiry.doesNotContain=" + DEFAULT_LICENSE_EXPIRY
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByLicenseTypeIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where licenseType equals to
        defaultHouseholdFiltering("licenseType.equals=" + DEFAULT_LICENSE_TYPE, "licenseType.equals=" + UPDATED_LICENSE_TYPE);
    }

    @Test
    @Transactional
    void getAllHouseholdsByLicenseTypeIsInShouldWork() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where licenseType in
        defaultHouseholdFiltering(
            "licenseType.in=" + DEFAULT_LICENSE_TYPE + "," + UPDATED_LICENSE_TYPE,
            "licenseType.in=" + UPDATED_LICENSE_TYPE
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByLicenseTypeIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where licenseType is not null
        defaultHouseholdFiltering("licenseType.specified=true", "licenseType.specified=false");
    }

    @Test
    @Transactional
    void getAllHouseholdsByLicenseTypeContainsSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where licenseType contains
        defaultHouseholdFiltering("licenseType.contains=" + DEFAULT_LICENSE_TYPE, "licenseType.contains=" + UPDATED_LICENSE_TYPE);
    }

    @Test
    @Transactional
    void getAllHouseholdsByLicenseTypeNotContainsSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where licenseType does not contain
        defaultHouseholdFiltering(
            "licenseType.doesNotContain=" + UPDATED_LICENSE_TYPE,
            "licenseType.doesNotContain=" + DEFAULT_LICENSE_TYPE
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByLatitudeIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where latitude equals to
        defaultHouseholdFiltering("latitude.equals=" + DEFAULT_LATITUDE, "latitude.equals=" + UPDATED_LATITUDE);
    }

    @Test
    @Transactional
    void getAllHouseholdsByLatitudeIsInShouldWork() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where latitude in
        defaultHouseholdFiltering("latitude.in=" + DEFAULT_LATITUDE + "," + UPDATED_LATITUDE, "latitude.in=" + UPDATED_LATITUDE);
    }

    @Test
    @Transactional
    void getAllHouseholdsByLatitudeIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where latitude is not null
        defaultHouseholdFiltering("latitude.specified=true", "latitude.specified=false");
    }

    @Test
    @Transactional
    void getAllHouseholdsByLatitudeIsGreaterThanOrEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where latitude is greater than or equal to
        defaultHouseholdFiltering("latitude.greaterThanOrEqual=" + DEFAULT_LATITUDE, "latitude.greaterThanOrEqual=" + UPDATED_LATITUDE);
    }

    @Test
    @Transactional
    void getAllHouseholdsByLatitudeIsLessThanOrEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where latitude is less than or equal to
        defaultHouseholdFiltering("latitude.lessThanOrEqual=" + DEFAULT_LATITUDE, "latitude.lessThanOrEqual=" + SMALLER_LATITUDE);
    }

    @Test
    @Transactional
    void getAllHouseholdsByLatitudeIsLessThanSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where latitude is less than
        defaultHouseholdFiltering("latitude.lessThan=" + UPDATED_LATITUDE, "latitude.lessThan=" + DEFAULT_LATITUDE);
    }

    @Test
    @Transactional
    void getAllHouseholdsByLatitudeIsGreaterThanSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where latitude is greater than
        defaultHouseholdFiltering("latitude.greaterThan=" + SMALLER_LATITUDE, "latitude.greaterThan=" + DEFAULT_LATITUDE);
    }

    @Test
    @Transactional
    void getAllHouseholdsByLongitudeIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where longitude equals to
        defaultHouseholdFiltering("longitude.equals=" + DEFAULT_LONGITUDE, "longitude.equals=" + UPDATED_LONGITUDE);
    }

    @Test
    @Transactional
    void getAllHouseholdsByLongitudeIsInShouldWork() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where longitude in
        defaultHouseholdFiltering("longitude.in=" + DEFAULT_LONGITUDE + "," + UPDATED_LONGITUDE, "longitude.in=" + UPDATED_LONGITUDE);
    }

    @Test
    @Transactional
    void getAllHouseholdsByLongitudeIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where longitude is not null
        defaultHouseholdFiltering("longitude.specified=true", "longitude.specified=false");
    }

    @Test
    @Transactional
    void getAllHouseholdsByLongitudeIsGreaterThanOrEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where longitude is greater than or equal to
        defaultHouseholdFiltering("longitude.greaterThanOrEqual=" + DEFAULT_LONGITUDE, "longitude.greaterThanOrEqual=" + UPDATED_LONGITUDE);
    }

    @Test
    @Transactional
    void getAllHouseholdsByLongitudeIsLessThanOrEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where longitude is less than or equal to
        defaultHouseholdFiltering("longitude.lessThanOrEqual=" + DEFAULT_LONGITUDE, "longitude.lessThanOrEqual=" + SMALLER_LONGITUDE);
    }

    @Test
    @Transactional
    void getAllHouseholdsByLongitudeIsLessThanSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where longitude is less than
        defaultHouseholdFiltering("longitude.lessThan=" + UPDATED_LONGITUDE, "longitude.lessThan=" + DEFAULT_LONGITUDE);
    }

    @Test
    @Transactional
    void getAllHouseholdsByLongitudeIsGreaterThanSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where longitude is greater than
        defaultHouseholdFiltering("longitude.greaterThan=" + SMALLER_LONGITUDE, "longitude.greaterThan=" + DEFAULT_LONGITUDE);
    }

    @Test
    @Transactional
    void getAllHouseholdsByLastCheckedDateIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where lastCheckedDate equals to
        defaultHouseholdFiltering(
            "lastCheckedDate.equals=" + DEFAULT_LAST_CHECKED_DATE,
            "lastCheckedDate.equals=" + UPDATED_LAST_CHECKED_DATE
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByLastCheckedDateIsInShouldWork() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where lastCheckedDate in
        defaultHouseholdFiltering(
            "lastCheckedDate.in=" + DEFAULT_LAST_CHECKED_DATE + "," + UPDATED_LAST_CHECKED_DATE,
            "lastCheckedDate.in=" + UPDATED_LAST_CHECKED_DATE
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByLastCheckedDateIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where lastCheckedDate is not null
        defaultHouseholdFiltering("lastCheckedDate.specified=true", "lastCheckedDate.specified=false");
    }

    @Test
    @Transactional
    void getAllHouseholdsByLastCheckedDateContainsSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where lastCheckedDate contains
        defaultHouseholdFiltering(
            "lastCheckedDate.contains=" + DEFAULT_LAST_CHECKED_DATE,
            "lastCheckedDate.contains=" + UPDATED_LAST_CHECKED_DATE
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByLastCheckedDateNotContainsSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where lastCheckedDate does not contain
        defaultHouseholdFiltering(
            "lastCheckedDate.doesNotContain=" + UPDATED_LAST_CHECKED_DATE,
            "lastCheckedDate.doesNotContain=" + DEFAULT_LAST_CHECKED_DATE
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByOfficerInChargeIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where officerInCharge equals to
        defaultHouseholdFiltering(
            "officerInCharge.equals=" + DEFAULT_OFFICER_IN_CHARGE,
            "officerInCharge.equals=" + UPDATED_OFFICER_IN_CHARGE
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByOfficerInChargeIsInShouldWork() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where officerInCharge in
        defaultHouseholdFiltering(
            "officerInCharge.in=" + DEFAULT_OFFICER_IN_CHARGE + "," + UPDATED_OFFICER_IN_CHARGE,
            "officerInCharge.in=" + UPDATED_OFFICER_IN_CHARGE
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByOfficerInChargeIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where officerInCharge is not null
        defaultHouseholdFiltering("officerInCharge.specified=true", "officerInCharge.specified=false");
    }

    @Test
    @Transactional
    void getAllHouseholdsByOfficerInChargeContainsSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where officerInCharge contains
        defaultHouseholdFiltering(
            "officerInCharge.contains=" + DEFAULT_OFFICER_IN_CHARGE,
            "officerInCharge.contains=" + UPDATED_OFFICER_IN_CHARGE
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByOfficerInChargeNotContainsSomething() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        // Get all the householdList where officerInCharge does not contain
        defaultHouseholdFiltering(
            "officerInCharge.doesNotContain=" + UPDATED_OFFICER_IN_CHARGE,
            "officerInCharge.doesNotContain=" + DEFAULT_OFFICER_IN_CHARGE
        );
    }

    @Test
    @Transactional
    void getAllHouseholdsByAreaZoneIsEqualToSomething() throws Exception {
        AreaZone areaZone;
        if (TestUtil.findAll(em, AreaZone.class).isEmpty()) {
            householdRepository.saveAndFlush(household);
            areaZone = AreaZoneResourceIT.createEntity();
        } else {
            areaZone = TestUtil.findAll(em, AreaZone.class).getFirst();
        }
        em.persist(areaZone);
        em.flush();
        household.setAreaZone(areaZone);
        householdRepository.saveAndFlush(household);
        Long areaZoneId = areaZone.getId();
        // Get all the householdList where areaZone equals to areaZoneId
        defaultHouseholdShouldBeFound("areaZoneId.equals=" + areaZoneId);

        // Get all the householdList where areaZone equals to (areaZoneId + 1)
        defaultHouseholdShouldNotBeFound("areaZoneId.equals=" + (areaZoneId + 1));
    }

    private void defaultHouseholdFiltering(String shouldBeFound, String shouldNotBeFound) throws Exception {
        defaultHouseholdShouldBeFound(shouldBeFound);
        defaultHouseholdShouldNotBeFound(shouldNotBeFound);
    }

    /**
     * Executes the search, and checks that the default entity is returned.
     */
    private void defaultHouseholdShouldBeFound(String filter) throws Exception {
        restHouseholdMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc&" + filter))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(household.getId().intValue())))
            .andExpect(jsonPath("$.[*].code").value(hasItem(DEFAULT_CODE)))
            .andExpect(jsonPath("$.[*].houseNumber").value(hasItem(DEFAULT_HOUSE_NUMBER)))
            .andExpect(jsonPath("$.[*].street").value(hasItem(DEFAULT_STREET)))
            .andExpect(jsonPath("$.[*].hamlet").value(hasItem(DEFAULT_HAMLET)))
            .andExpect(jsonPath("$.[*].neighborhoodGroup").value(hasItem(DEFAULT_NEIGHBORHOOD_GROUP)))
            .andExpect(jsonPath("$.[*].alley").value(hasItem(DEFAULT_ALLEY)))
            .andExpect(jsonPath("$.[*].ownerName").value(hasItem(DEFAULT_OWNER_NAME)))
            .andExpect(jsonPath("$.[*].ownerPhone").value(hasItem(DEFAULT_OWNER_PHONE)))
            .andExpect(jsonPath("$.[*].type").value(hasItem(DEFAULT_TYPE.toString())))
            .andExpect(jsonPath("$.[*].businessName").value(hasItem(DEFAULT_BUSINESS_NAME)))
            .andExpect(jsonPath("$.[*].businessCategory").value(hasItem(DEFAULT_BUSINESS_CATEGORY)))
            .andExpect(jsonPath("$.[*].residentsCount").value(hasItem(DEFAULT_RESIDENTS_COUNT)))
            .andExpect(jsonPath("$.[*].maleCount").value(hasItem(DEFAULT_MALE_COUNT)))
            .andExpect(jsonPath("$.[*].femaleCount").value(hasItem(DEFAULT_FEMALE_COUNT)))
            .andExpect(jsonPath("$.[*].under18Count").value(hasItem(DEFAULT_UNDER_18_COUNT)))
            .andExpect(jsonPath("$.[*].above18Count").value(hasItem(DEFAULT_ABOVE_18_COUNT)))
            .andExpect(jsonPath("$.[*].status").value(hasItem(DEFAULT_STATUS.toString())))
            .andExpect(jsonPath("$.[*].warningMessage").value(hasItem(DEFAULT_WARNING_MESSAGE)))
            .andExpect(jsonPath("$.[*].licenseExpiry").value(hasItem(DEFAULT_LICENSE_EXPIRY)))
            .andExpect(jsonPath("$.[*].licenseType").value(hasItem(DEFAULT_LICENSE_TYPE)))
            .andExpect(jsonPath("$.[*].latitude").value(hasItem(DEFAULT_LATITUDE)))
            .andExpect(jsonPath("$.[*].longitude").value(hasItem(DEFAULT_LONGITUDE)))
            .andExpect(jsonPath("$.[*].notes").value(hasItem(DEFAULT_NOTES)))
            .andExpect(jsonPath("$.[*].lastCheckedDate").value(hasItem(DEFAULT_LAST_CHECKED_DATE)))
            .andExpect(jsonPath("$.[*].officerInCharge").value(hasItem(DEFAULT_OFFICER_IN_CHARGE)));

        // Check, that the count call also returns 1
        restHouseholdMockMvc
            .perform(get(ENTITY_API_URL + "/count?sort=id,desc&" + filter))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(content().string("1"));
    }

    /**
     * Executes the search, and checks that the default entity is not returned.
     */
    private void defaultHouseholdShouldNotBeFound(String filter) throws Exception {
        restHouseholdMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc&" + filter))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$").isArray())
            .andExpect(jsonPath("$").isEmpty());

        // Check, that the count call also returns 0
        restHouseholdMockMvc
            .perform(get(ENTITY_API_URL + "/count?sort=id,desc&" + filter))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(content().string("0"));
    }

    @Test
    @Transactional
    void getNonExistingHousehold() throws Exception {
        // Get the household
        restHouseholdMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingHousehold() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the household
        Household updatedHousehold = householdRepository.findById(household.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedHousehold are not directly saved in db
        em.detach(updatedHousehold);
        updatedHousehold
            .code(UPDATED_CODE)
            .houseNumber(UPDATED_HOUSE_NUMBER)
            .street(UPDATED_STREET)
            .hamlet(UPDATED_HAMLET)
            .neighborhoodGroup(UPDATED_NEIGHBORHOOD_GROUP)
            .alley(UPDATED_ALLEY)
            .ownerName(UPDATED_OWNER_NAME)
            .ownerPhone(UPDATED_OWNER_PHONE)
            .type(UPDATED_TYPE)
            .businessName(UPDATED_BUSINESS_NAME)
            .businessCategory(UPDATED_BUSINESS_CATEGORY)
            .residentsCount(UPDATED_RESIDENTS_COUNT)
            .maleCount(UPDATED_MALE_COUNT)
            .femaleCount(UPDATED_FEMALE_COUNT)
            .under18Count(UPDATED_UNDER_18_COUNT)
            .above18Count(UPDATED_ABOVE_18_COUNT)
            .status(UPDATED_STATUS)
            .warningMessage(UPDATED_WARNING_MESSAGE)
            .licenseExpiry(UPDATED_LICENSE_EXPIRY)
            .licenseType(UPDATED_LICENSE_TYPE)
            .latitude(UPDATED_LATITUDE)
            .longitude(UPDATED_LONGITUDE)
            .notes(UPDATED_NOTES)
            .lastCheckedDate(UPDATED_LAST_CHECKED_DATE)
            .officerInCharge(UPDATED_OFFICER_IN_CHARGE);
        HouseholdDTO householdDTO = householdMapper.toDto(updatedHousehold);

        restHouseholdMockMvc
            .perform(
                put(ENTITY_API_URL_ID, householdDTO.getId())
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(householdDTO))
            )
            .andExpect(status().isOk());

        // Validate the Household in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedHouseholdToMatchAllProperties(updatedHousehold);
    }

    @Test
    @Transactional
    void putNonExistingHousehold() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        household.setId(longCount.incrementAndGet());

        // Create the Household
        HouseholdDTO householdDTO = householdMapper.toDto(household);

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restHouseholdMockMvc
            .perform(
                put(ENTITY_API_URL_ID, householdDTO.getId())
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(householdDTO))
            )
            .andExpect(status().isBadRequest());

        // Validate the Household in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchHousehold() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        household.setId(longCount.incrementAndGet());

        // Create the Household
        HouseholdDTO householdDTO = householdMapper.toDto(household);

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restHouseholdMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(householdDTO))
            )
            .andExpect(status().isBadRequest());

        // Validate the Household in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamHousehold() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        household.setId(longCount.incrementAndGet());

        // Create the Household
        HouseholdDTO householdDTO = householdMapper.toDto(household);

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restHouseholdMockMvc
            .perform(put(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(householdDTO)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the Household in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateHouseholdWithPatch() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the household using partial update
        Household partialUpdatedHousehold = new Household();
        partialUpdatedHousehold.setId(household.getId());

        partialUpdatedHousehold
            .houseNumber(UPDATED_HOUSE_NUMBER)
            .street(UPDATED_STREET)
            .neighborhoodGroup(UPDATED_NEIGHBORHOOD_GROUP)
            .ownerName(UPDATED_OWNER_NAME)
            .residentsCount(UPDATED_RESIDENTS_COUNT)
            .under18Count(UPDATED_UNDER_18_COUNT)
            .above18Count(UPDATED_ABOVE_18_COUNT)
            .status(UPDATED_STATUS)
            .latitude(UPDATED_LATITUDE)
            .longitude(UPDATED_LONGITUDE)
            .notes(UPDATED_NOTES)
            .lastCheckedDate(UPDATED_LAST_CHECKED_DATE)
            .officerInCharge(UPDATED_OFFICER_IN_CHARGE);

        restHouseholdMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedHousehold.getId())
                    .with(csrf())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedHousehold))
            )
            .andExpect(status().isOk());

        // Validate the Household in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertHouseholdUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedHousehold, household),
            getPersistedHousehold(household)
        );
    }

    @Test
    @Transactional
    void fullUpdateHouseholdWithPatch() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the household using partial update
        Household partialUpdatedHousehold = new Household();
        partialUpdatedHousehold.setId(household.getId());

        partialUpdatedHousehold
            .code(UPDATED_CODE)
            .houseNumber(UPDATED_HOUSE_NUMBER)
            .street(UPDATED_STREET)
            .hamlet(UPDATED_HAMLET)
            .neighborhoodGroup(UPDATED_NEIGHBORHOOD_GROUP)
            .alley(UPDATED_ALLEY)
            .ownerName(UPDATED_OWNER_NAME)
            .ownerPhone(UPDATED_OWNER_PHONE)
            .type(UPDATED_TYPE)
            .businessName(UPDATED_BUSINESS_NAME)
            .businessCategory(UPDATED_BUSINESS_CATEGORY)
            .residentsCount(UPDATED_RESIDENTS_COUNT)
            .maleCount(UPDATED_MALE_COUNT)
            .femaleCount(UPDATED_FEMALE_COUNT)
            .under18Count(UPDATED_UNDER_18_COUNT)
            .above18Count(UPDATED_ABOVE_18_COUNT)
            .status(UPDATED_STATUS)
            .warningMessage(UPDATED_WARNING_MESSAGE)
            .licenseExpiry(UPDATED_LICENSE_EXPIRY)
            .licenseType(UPDATED_LICENSE_TYPE)
            .latitude(UPDATED_LATITUDE)
            .longitude(UPDATED_LONGITUDE)
            .notes(UPDATED_NOTES)
            .lastCheckedDate(UPDATED_LAST_CHECKED_DATE)
            .officerInCharge(UPDATED_OFFICER_IN_CHARGE);

        restHouseholdMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedHousehold.getId())
                    .with(csrf())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedHousehold))
            )
            .andExpect(status().isOk());

        // Validate the Household in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertHouseholdUpdatableFieldsEquals(partialUpdatedHousehold, getPersistedHousehold(partialUpdatedHousehold));
    }

    @Test
    @Transactional
    void patchNonExistingHousehold() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        household.setId(longCount.incrementAndGet());

        // Create the Household
        HouseholdDTO householdDTO = householdMapper.toDto(household);

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restHouseholdMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, householdDTO.getId())
                    .with(csrf())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(householdDTO))
            )
            .andExpect(status().isBadRequest());

        // Validate the Household in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchHousehold() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        household.setId(longCount.incrementAndGet());

        // Create the Household
        HouseholdDTO householdDTO = householdMapper.toDto(household);

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restHouseholdMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .with(csrf())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(householdDTO))
            )
            .andExpect(status().isBadRequest());

        // Validate the Household in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamHousehold() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        household.setId(longCount.incrementAndGet());

        // Create the Household
        HouseholdDTO householdDTO = householdMapper.toDto(household);

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restHouseholdMockMvc
            .perform(
                patch(ENTITY_API_URL).with(csrf()).contentType("application/merge-patch+json").content(om.writeValueAsBytes(householdDTO))
            )
            .andExpect(status().isMethodNotAllowed());

        // Validate the Household in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteHousehold() throws Exception {
        // Initialize the database
        insertedHousehold = householdRepository.saveAndFlush(household);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the household
        restHouseholdMockMvc
            .perform(delete(ENTITY_API_URL_ID, household.getId()).with(csrf()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return householdRepository.count();
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

    protected Household getPersistedHousehold(Household household) {
        return householdRepository.findById(household.getId()).orElseThrow();
    }

    protected void assertPersistedHouseholdToMatchAllProperties(Household expectedHousehold) {
        assertHouseholdAllPropertiesEquals(expectedHousehold, getPersistedHousehold(expectedHousehold));
    }

    protected void assertPersistedHouseholdToMatchUpdatableProperties(Household expectedHousehold) {
        assertHouseholdAllUpdatablePropertiesEquals(expectedHousehold, getPersistedHousehold(expectedHousehold));
    }
}
