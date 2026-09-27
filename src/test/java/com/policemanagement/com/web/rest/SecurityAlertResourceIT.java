package com.policemanagement.com.web.rest;

import static com.policemanagement.com.domain.SecurityAlertAsserts.*;
import static com.policemanagement.com.web.rest.TestUtil.createUpdateProxyForBean;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.policemanagement.com.IntegrationTest;
import com.policemanagement.com.domain.SecurityAlert;
import com.policemanagement.com.domain.enumeration.AlertSeverity;
import com.policemanagement.com.repository.SecurityAlertRepository;
import com.policemanagement.com.service.dto.SecurityAlertDTO;
import com.policemanagement.com.service.mapper.SecurityAlertMapper;
import jakarta.persistence.EntityManager;
import java.time.Instant;
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
 * Integration tests for the {@link SecurityAlertResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class SecurityAlertResourceIT {

    private static final String DEFAULT_ALERT_TYPE = "AAAAAAAAAA";
    private static final String UPDATED_ALERT_TYPE = "BBBBBBBBBB";

    private static final AlertSeverity DEFAULT_SEVERITY = AlertSeverity.INFO;
    private static final AlertSeverity UPDATED_SEVERITY = AlertSeverity.LOW;

    private static final String DEFAULT_TITLE = "AAAAAAAAAA";
    private static final String UPDATED_TITLE = "BBBBBBBBBB";

    private static final String DEFAULT_DESCRIPTION = "AAAAAAAAAA";
    private static final String UPDATED_DESCRIPTION = "BBBBBBBBBB";

    private static final String DEFAULT_LOCATION = "AAAAAAAAAA";
    private static final String UPDATED_LOCATION = "BBBBBBBBBB";

    private static final Boolean DEFAULT_IS_RESOLVED = false;
    private static final Boolean UPDATED_IS_RESOLVED = true;

    private static final Instant DEFAULT_REPORTED_AT = Instant.ofEpochMilli(0L);
    private static final Instant UPDATED_REPORTED_AT = Instant.ofEpochMilli(1789810131296L);

    private static final Instant DEFAULT_RESOLVED_AT = Instant.ofEpochMilli(0L);
    private static final Instant UPDATED_RESOLVED_AT = Instant.ofEpochMilli(1789810131296L);

    private static final String ENTITY_API_URL = "/api/security-alerts";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + 2L * Integer.MAX_VALUE);

    @Autowired
    private ObjectMapper om;

    @Autowired
    private SecurityAlertRepository securityAlertRepository;

    @Autowired
    private SecurityAlertMapper securityAlertMapper;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restSecurityAlertMockMvc;

    private SecurityAlert securityAlert;

    private SecurityAlert insertedSecurityAlert;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static SecurityAlert createEntity() {
        return new SecurityAlert()
            .alertType(DEFAULT_ALERT_TYPE)
            .severity(DEFAULT_SEVERITY)
            .title(DEFAULT_TITLE)
            .description(DEFAULT_DESCRIPTION)
            .location(DEFAULT_LOCATION)
            .isResolved(DEFAULT_IS_RESOLVED)
            .reportedAt(DEFAULT_REPORTED_AT)
            .resolvedAt(DEFAULT_RESOLVED_AT);
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static SecurityAlert createUpdatedEntity() {
        return new SecurityAlert()
            .alertType(UPDATED_ALERT_TYPE)
            .severity(UPDATED_SEVERITY)
            .title(UPDATED_TITLE)
            .description(UPDATED_DESCRIPTION)
            .location(UPDATED_LOCATION)
            .isResolved(UPDATED_IS_RESOLVED)
            .reportedAt(UPDATED_REPORTED_AT)
            .resolvedAt(UPDATED_RESOLVED_AT);
    }

    @BeforeEach
    void initTest() {
        securityAlert = createEntity();
    }

    @AfterEach
    void cleanup() {
        if (insertedSecurityAlert != null) {
            securityAlertRepository.delete(insertedSecurityAlert);
            insertedSecurityAlert = null;
        }
    }

    @Test
    @Transactional
    void createSecurityAlert() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the SecurityAlert
        SecurityAlertDTO securityAlertDTO = securityAlertMapper.toDto(securityAlert);
        var returnedSecurityAlertDTO = om.readValue(
            restSecurityAlertMockMvc
                .perform(
                    post(ENTITY_API_URL)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(om.writeValueAsBytes(securityAlertDTO))
                )
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            SecurityAlertDTO.class
        );

        // Validate the SecurityAlert in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        var returnedSecurityAlert = securityAlertMapper.toEntity(returnedSecurityAlertDTO);
        assertSecurityAlertUpdatableFieldsEquals(returnedSecurityAlert, getPersistedSecurityAlert(returnedSecurityAlert));

        insertedSecurityAlert = returnedSecurityAlert;
    }

    @Test
    @Transactional
    void createSecurityAlertWithExistingId() throws Exception {
        // Create the SecurityAlert with an existing ID
        securityAlert.setId(1L);
        SecurityAlertDTO securityAlertDTO = securityAlertMapper.toDto(securityAlert);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restSecurityAlertMockMvc
            .perform(
                post(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(securityAlertDTO))
            )
            .andExpect(status().isBadRequest());

        // Validate the SecurityAlert in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkAlertTypeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        securityAlert.setAlertType(null);

        // Create the SecurityAlert, which fails.
        SecurityAlertDTO securityAlertDTO = securityAlertMapper.toDto(securityAlert);

        restSecurityAlertMockMvc
            .perform(
                post(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(securityAlertDTO))
            )
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkSeverityIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        securityAlert.setSeverity(null);

        // Create the SecurityAlert, which fails.
        SecurityAlertDTO securityAlertDTO = securityAlertMapper.toDto(securityAlert);

        restSecurityAlertMockMvc
            .perform(
                post(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(securityAlertDTO))
            )
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkTitleIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        securityAlert.setTitle(null);

        // Create the SecurityAlert, which fails.
        SecurityAlertDTO securityAlertDTO = securityAlertMapper.toDto(securityAlert);

        restSecurityAlertMockMvc
            .perform(
                post(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(securityAlertDTO))
            )
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllSecurityAlerts() throws Exception {
        // Initialize the database
        insertedSecurityAlert = securityAlertRepository.saveAndFlush(securityAlert);

        // Get all the securityAlertList
        restSecurityAlertMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(securityAlert.getId().intValue())))
            .andExpect(jsonPath("$.[*].alertType").value(hasItem(DEFAULT_ALERT_TYPE)))
            .andExpect(jsonPath("$.[*].severity").value(hasItem(DEFAULT_SEVERITY.toString())))
            .andExpect(jsonPath("$.[*].title").value(hasItem(DEFAULT_TITLE)))
            .andExpect(jsonPath("$.[*].description").value(hasItem(DEFAULT_DESCRIPTION)))
            .andExpect(jsonPath("$.[*].location").value(hasItem(DEFAULT_LOCATION)))
            .andExpect(jsonPath("$.[*].isResolved").value(hasItem(DEFAULT_IS_RESOLVED)))
            .andExpect(jsonPath("$.[*].reportedAt").value(hasItem(DEFAULT_REPORTED_AT.toString())))
            .andExpect(jsonPath("$.[*].resolvedAt").value(hasItem(DEFAULT_RESOLVED_AT.toString())));
    }

    @Test
    @Transactional
    void getSecurityAlert() throws Exception {
        // Initialize the database
        insertedSecurityAlert = securityAlertRepository.saveAndFlush(securityAlert);

        // Get the securityAlert
        restSecurityAlertMockMvc
            .perform(get(ENTITY_API_URL_ID, securityAlert.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(securityAlert.getId().intValue()))
            .andExpect(jsonPath("$.alertType").value(DEFAULT_ALERT_TYPE))
            .andExpect(jsonPath("$.severity").value(DEFAULT_SEVERITY.toString()))
            .andExpect(jsonPath("$.title").value(DEFAULT_TITLE))
            .andExpect(jsonPath("$.description").value(DEFAULT_DESCRIPTION))
            .andExpect(jsonPath("$.location").value(DEFAULT_LOCATION))
            .andExpect(jsonPath("$.isResolved").value(DEFAULT_IS_RESOLVED))
            .andExpect(jsonPath("$.reportedAt").value(DEFAULT_REPORTED_AT.toString()))
            .andExpect(jsonPath("$.resolvedAt").value(DEFAULT_RESOLVED_AT.toString()));
    }

    @Test
    @Transactional
    void getSecurityAlertsByIdFiltering() throws Exception {
        // Initialize the database
        insertedSecurityAlert = securityAlertRepository.saveAndFlush(securityAlert);

        Long id = securityAlert.getId();

        defaultSecurityAlertFiltering("id.equals=" + id, "id.notEquals=" + id);

        defaultSecurityAlertFiltering("id.greaterThanOrEqual=" + id, "id.greaterThan=" + id);

        defaultSecurityAlertFiltering("id.lessThanOrEqual=" + id, "id.lessThan=" + id);
    }

    @Test
    @Transactional
    void getAllSecurityAlertsByAlertTypeIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedSecurityAlert = securityAlertRepository.saveAndFlush(securityAlert);

        // Get all the securityAlertList where alertType equals to
        defaultSecurityAlertFiltering("alertType.equals=" + DEFAULT_ALERT_TYPE, "alertType.equals=" + UPDATED_ALERT_TYPE);
    }

    @Test
    @Transactional
    void getAllSecurityAlertsByAlertTypeIsInShouldWork() throws Exception {
        // Initialize the database
        insertedSecurityAlert = securityAlertRepository.saveAndFlush(securityAlert);

        // Get all the securityAlertList where alertType in
        defaultSecurityAlertFiltering(
            "alertType.in=" + DEFAULT_ALERT_TYPE + "," + UPDATED_ALERT_TYPE,
            "alertType.in=" + UPDATED_ALERT_TYPE
        );
    }

    @Test
    @Transactional
    void getAllSecurityAlertsByAlertTypeIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedSecurityAlert = securityAlertRepository.saveAndFlush(securityAlert);

        // Get all the securityAlertList where alertType is not null
        defaultSecurityAlertFiltering("alertType.specified=true", "alertType.specified=false");
    }

    @Test
    @Transactional
    void getAllSecurityAlertsByAlertTypeContainsSomething() throws Exception {
        // Initialize the database
        insertedSecurityAlert = securityAlertRepository.saveAndFlush(securityAlert);

        // Get all the securityAlertList where alertType contains
        defaultSecurityAlertFiltering("alertType.contains=" + DEFAULT_ALERT_TYPE, "alertType.contains=" + UPDATED_ALERT_TYPE);
    }

    @Test
    @Transactional
    void getAllSecurityAlertsByAlertTypeNotContainsSomething() throws Exception {
        // Initialize the database
        insertedSecurityAlert = securityAlertRepository.saveAndFlush(securityAlert);

        // Get all the securityAlertList where alertType does not contain
        defaultSecurityAlertFiltering("alertType.doesNotContain=" + UPDATED_ALERT_TYPE, "alertType.doesNotContain=" + DEFAULT_ALERT_TYPE);
    }

    @Test
    @Transactional
    void getAllSecurityAlertsBySeverityIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedSecurityAlert = securityAlertRepository.saveAndFlush(securityAlert);

        // Get all the securityAlertList where severity equals to
        defaultSecurityAlertFiltering("severity.equals=" + DEFAULT_SEVERITY, "severity.equals=" + UPDATED_SEVERITY);
    }

    @Test
    @Transactional
    void getAllSecurityAlertsBySeverityIsInShouldWork() throws Exception {
        // Initialize the database
        insertedSecurityAlert = securityAlertRepository.saveAndFlush(securityAlert);

        // Get all the securityAlertList where severity in
        defaultSecurityAlertFiltering("severity.in=" + DEFAULT_SEVERITY + "," + UPDATED_SEVERITY, "severity.in=" + UPDATED_SEVERITY);
    }

    @Test
    @Transactional
    void getAllSecurityAlertsBySeverityIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedSecurityAlert = securityAlertRepository.saveAndFlush(securityAlert);

        // Get all the securityAlertList where severity is not null
        defaultSecurityAlertFiltering("severity.specified=true", "severity.specified=false");
    }

    @Test
    @Transactional
    void getAllSecurityAlertsByTitleIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedSecurityAlert = securityAlertRepository.saveAndFlush(securityAlert);

        // Get all the securityAlertList where title equals to
        defaultSecurityAlertFiltering("title.equals=" + DEFAULT_TITLE, "title.equals=" + UPDATED_TITLE);
    }

    @Test
    @Transactional
    void getAllSecurityAlertsByTitleIsInShouldWork() throws Exception {
        // Initialize the database
        insertedSecurityAlert = securityAlertRepository.saveAndFlush(securityAlert);

        // Get all the securityAlertList where title in
        defaultSecurityAlertFiltering("title.in=" + DEFAULT_TITLE + "," + UPDATED_TITLE, "title.in=" + UPDATED_TITLE);
    }

    @Test
    @Transactional
    void getAllSecurityAlertsByTitleIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedSecurityAlert = securityAlertRepository.saveAndFlush(securityAlert);

        // Get all the securityAlertList where title is not null
        defaultSecurityAlertFiltering("title.specified=true", "title.specified=false");
    }

    @Test
    @Transactional
    void getAllSecurityAlertsByTitleContainsSomething() throws Exception {
        // Initialize the database
        insertedSecurityAlert = securityAlertRepository.saveAndFlush(securityAlert);

        // Get all the securityAlertList where title contains
        defaultSecurityAlertFiltering("title.contains=" + DEFAULT_TITLE, "title.contains=" + UPDATED_TITLE);
    }

    @Test
    @Transactional
    void getAllSecurityAlertsByTitleNotContainsSomething() throws Exception {
        // Initialize the database
        insertedSecurityAlert = securityAlertRepository.saveAndFlush(securityAlert);

        // Get all the securityAlertList where title does not contain
        defaultSecurityAlertFiltering("title.doesNotContain=" + UPDATED_TITLE, "title.doesNotContain=" + DEFAULT_TITLE);
    }

    @Test
    @Transactional
    void getAllSecurityAlertsByLocationIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedSecurityAlert = securityAlertRepository.saveAndFlush(securityAlert);

        // Get all the securityAlertList where location equals to
        defaultSecurityAlertFiltering("location.equals=" + DEFAULT_LOCATION, "location.equals=" + UPDATED_LOCATION);
    }

    @Test
    @Transactional
    void getAllSecurityAlertsByLocationIsInShouldWork() throws Exception {
        // Initialize the database
        insertedSecurityAlert = securityAlertRepository.saveAndFlush(securityAlert);

        // Get all the securityAlertList where location in
        defaultSecurityAlertFiltering("location.in=" + DEFAULT_LOCATION + "," + UPDATED_LOCATION, "location.in=" + UPDATED_LOCATION);
    }

    @Test
    @Transactional
    void getAllSecurityAlertsByLocationIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedSecurityAlert = securityAlertRepository.saveAndFlush(securityAlert);

        // Get all the securityAlertList where location is not null
        defaultSecurityAlertFiltering("location.specified=true", "location.specified=false");
    }

    @Test
    @Transactional
    void getAllSecurityAlertsByLocationContainsSomething() throws Exception {
        // Initialize the database
        insertedSecurityAlert = securityAlertRepository.saveAndFlush(securityAlert);

        // Get all the securityAlertList where location contains
        defaultSecurityAlertFiltering("location.contains=" + DEFAULT_LOCATION, "location.contains=" + UPDATED_LOCATION);
    }

    @Test
    @Transactional
    void getAllSecurityAlertsByLocationNotContainsSomething() throws Exception {
        // Initialize the database
        insertedSecurityAlert = securityAlertRepository.saveAndFlush(securityAlert);

        // Get all the securityAlertList where location does not contain
        defaultSecurityAlertFiltering("location.doesNotContain=" + UPDATED_LOCATION, "location.doesNotContain=" + DEFAULT_LOCATION);
    }

    @Test
    @Transactional
    void getAllSecurityAlertsByIsResolvedIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedSecurityAlert = securityAlertRepository.saveAndFlush(securityAlert);

        // Get all the securityAlertList where isResolved equals to
        defaultSecurityAlertFiltering("isResolved.equals=" + DEFAULT_IS_RESOLVED, "isResolved.equals=" + UPDATED_IS_RESOLVED);
    }

    @Test
    @Transactional
    void getAllSecurityAlertsByIsResolvedIsInShouldWork() throws Exception {
        // Initialize the database
        insertedSecurityAlert = securityAlertRepository.saveAndFlush(securityAlert);

        // Get all the securityAlertList where isResolved in
        defaultSecurityAlertFiltering(
            "isResolved.in=" + DEFAULT_IS_RESOLVED + "," + UPDATED_IS_RESOLVED,
            "isResolved.in=" + UPDATED_IS_RESOLVED
        );
    }

    @Test
    @Transactional
    void getAllSecurityAlertsByIsResolvedIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedSecurityAlert = securityAlertRepository.saveAndFlush(securityAlert);

        // Get all the securityAlertList where isResolved is not null
        defaultSecurityAlertFiltering("isResolved.specified=true", "isResolved.specified=false");
    }

    @Test
    @Transactional
    void getAllSecurityAlertsByReportedAtIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedSecurityAlert = securityAlertRepository.saveAndFlush(securityAlert);

        // Get all the securityAlertList where reportedAt equals to
        defaultSecurityAlertFiltering("reportedAt.equals=" + DEFAULT_REPORTED_AT, "reportedAt.equals=" + UPDATED_REPORTED_AT);
    }

    @Test
    @Transactional
    void getAllSecurityAlertsByReportedAtIsInShouldWork() throws Exception {
        // Initialize the database
        insertedSecurityAlert = securityAlertRepository.saveAndFlush(securityAlert);

        // Get all the securityAlertList where reportedAt in
        defaultSecurityAlertFiltering(
            "reportedAt.in=" + DEFAULT_REPORTED_AT + "," + UPDATED_REPORTED_AT,
            "reportedAt.in=" + UPDATED_REPORTED_AT
        );
    }

    @Test
    @Transactional
    void getAllSecurityAlertsByReportedAtIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedSecurityAlert = securityAlertRepository.saveAndFlush(securityAlert);

        // Get all the securityAlertList where reportedAt is not null
        defaultSecurityAlertFiltering("reportedAt.specified=true", "reportedAt.specified=false");
    }

    @Test
    @Transactional
    void getAllSecurityAlertsByResolvedAtIsEqualToSomething() throws Exception {
        // Initialize the database
        insertedSecurityAlert = securityAlertRepository.saveAndFlush(securityAlert);

        // Get all the securityAlertList where resolvedAt equals to
        defaultSecurityAlertFiltering("resolvedAt.equals=" + DEFAULT_RESOLVED_AT, "resolvedAt.equals=" + UPDATED_RESOLVED_AT);
    }

    @Test
    @Transactional
    void getAllSecurityAlertsByResolvedAtIsInShouldWork() throws Exception {
        // Initialize the database
        insertedSecurityAlert = securityAlertRepository.saveAndFlush(securityAlert);

        // Get all the securityAlertList where resolvedAt in
        defaultSecurityAlertFiltering(
            "resolvedAt.in=" + DEFAULT_RESOLVED_AT + "," + UPDATED_RESOLVED_AT,
            "resolvedAt.in=" + UPDATED_RESOLVED_AT
        );
    }

    @Test
    @Transactional
    void getAllSecurityAlertsByResolvedAtIsNullOrNotNull() throws Exception {
        // Initialize the database
        insertedSecurityAlert = securityAlertRepository.saveAndFlush(securityAlert);

        // Get all the securityAlertList where resolvedAt is not null
        defaultSecurityAlertFiltering("resolvedAt.specified=true", "resolvedAt.specified=false");
    }

    private void defaultSecurityAlertFiltering(String shouldBeFound, String shouldNotBeFound) throws Exception {
        defaultSecurityAlertShouldBeFound(shouldBeFound);
        defaultSecurityAlertShouldNotBeFound(shouldNotBeFound);
    }

    /**
     * Executes the search, and checks that the default entity is returned.
     */
    private void defaultSecurityAlertShouldBeFound(String filter) throws Exception {
        restSecurityAlertMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc&" + filter))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(securityAlert.getId().intValue())))
            .andExpect(jsonPath("$.[*].alertType").value(hasItem(DEFAULT_ALERT_TYPE)))
            .andExpect(jsonPath("$.[*].severity").value(hasItem(DEFAULT_SEVERITY.toString())))
            .andExpect(jsonPath("$.[*].title").value(hasItem(DEFAULT_TITLE)))
            .andExpect(jsonPath("$.[*].description").value(hasItem(DEFAULT_DESCRIPTION)))
            .andExpect(jsonPath("$.[*].location").value(hasItem(DEFAULT_LOCATION)))
            .andExpect(jsonPath("$.[*].isResolved").value(hasItem(DEFAULT_IS_RESOLVED)))
            .andExpect(jsonPath("$.[*].reportedAt").value(hasItem(DEFAULT_REPORTED_AT.toString())))
            .andExpect(jsonPath("$.[*].resolvedAt").value(hasItem(DEFAULT_RESOLVED_AT.toString())));

        // Check, that the count call also returns 1
        restSecurityAlertMockMvc
            .perform(get(ENTITY_API_URL + "/count?sort=id,desc&" + filter))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(content().string("1"));
    }

    /**
     * Executes the search, and checks that the default entity is not returned.
     */
    private void defaultSecurityAlertShouldNotBeFound(String filter) throws Exception {
        restSecurityAlertMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc&" + filter))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$").isArray())
            .andExpect(jsonPath("$").isEmpty());

        // Check, that the count call also returns 0
        restSecurityAlertMockMvc
            .perform(get(ENTITY_API_URL + "/count?sort=id,desc&" + filter))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(content().string("0"));
    }

    @Test
    @Transactional
    void getNonExistingSecurityAlert() throws Exception {
        // Get the securityAlert
        restSecurityAlertMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingSecurityAlert() throws Exception {
        // Initialize the database
        insertedSecurityAlert = securityAlertRepository.saveAndFlush(securityAlert);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the securityAlert
        SecurityAlert updatedSecurityAlert = securityAlertRepository.findById(securityAlert.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedSecurityAlert are not directly saved in db
        em.detach(updatedSecurityAlert);
        updatedSecurityAlert
            .alertType(UPDATED_ALERT_TYPE)
            .severity(UPDATED_SEVERITY)
            .title(UPDATED_TITLE)
            .description(UPDATED_DESCRIPTION)
            .location(UPDATED_LOCATION)
            .isResolved(UPDATED_IS_RESOLVED)
            .reportedAt(UPDATED_REPORTED_AT)
            .resolvedAt(UPDATED_RESOLVED_AT);
        SecurityAlertDTO securityAlertDTO = securityAlertMapper.toDto(updatedSecurityAlert);

        restSecurityAlertMockMvc
            .perform(
                put(ENTITY_API_URL_ID, securityAlertDTO.getId())
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(securityAlertDTO))
            )
            .andExpect(status().isOk());

        // Validate the SecurityAlert in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedSecurityAlertToMatchAllProperties(updatedSecurityAlert);
    }

    @Test
    @Transactional
    void putNonExistingSecurityAlert() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        securityAlert.setId(longCount.incrementAndGet());

        // Create the SecurityAlert
        SecurityAlertDTO securityAlertDTO = securityAlertMapper.toDto(securityAlert);

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restSecurityAlertMockMvc
            .perform(
                put(ENTITY_API_URL_ID, securityAlertDTO.getId())
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(securityAlertDTO))
            )
            .andExpect(status().isBadRequest());

        // Validate the SecurityAlert in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchSecurityAlert() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        securityAlert.setId(longCount.incrementAndGet());

        // Create the SecurityAlert
        SecurityAlertDTO securityAlertDTO = securityAlertMapper.toDto(securityAlert);

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restSecurityAlertMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(securityAlertDTO))
            )
            .andExpect(status().isBadRequest());

        // Validate the SecurityAlert in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamSecurityAlert() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        securityAlert.setId(longCount.incrementAndGet());

        // Create the SecurityAlert
        SecurityAlertDTO securityAlertDTO = securityAlertMapper.toDto(securityAlert);

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restSecurityAlertMockMvc
            .perform(
                put(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(securityAlertDTO))
            )
            .andExpect(status().isMethodNotAllowed());

        // Validate the SecurityAlert in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateSecurityAlertWithPatch() throws Exception {
        // Initialize the database
        insertedSecurityAlert = securityAlertRepository.saveAndFlush(securityAlert);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the securityAlert using partial update
        SecurityAlert partialUpdatedSecurityAlert = new SecurityAlert();
        partialUpdatedSecurityAlert.setId(securityAlert.getId());

        partialUpdatedSecurityAlert.alertType(UPDATED_ALERT_TYPE).description(UPDATED_DESCRIPTION).location(UPDATED_LOCATION);

        restSecurityAlertMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedSecurityAlert.getId())
                    .with(csrf())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedSecurityAlert))
            )
            .andExpect(status().isOk());

        // Validate the SecurityAlert in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertSecurityAlertUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedSecurityAlert, securityAlert),
            getPersistedSecurityAlert(securityAlert)
        );
    }

    @Test
    @Transactional
    void fullUpdateSecurityAlertWithPatch() throws Exception {
        // Initialize the database
        insertedSecurityAlert = securityAlertRepository.saveAndFlush(securityAlert);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the securityAlert using partial update
        SecurityAlert partialUpdatedSecurityAlert = new SecurityAlert();
        partialUpdatedSecurityAlert.setId(securityAlert.getId());

        partialUpdatedSecurityAlert
            .alertType(UPDATED_ALERT_TYPE)
            .severity(UPDATED_SEVERITY)
            .title(UPDATED_TITLE)
            .description(UPDATED_DESCRIPTION)
            .location(UPDATED_LOCATION)
            .isResolved(UPDATED_IS_RESOLVED)
            .reportedAt(UPDATED_REPORTED_AT)
            .resolvedAt(UPDATED_RESOLVED_AT);

        restSecurityAlertMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedSecurityAlert.getId())
                    .with(csrf())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedSecurityAlert))
            )
            .andExpect(status().isOk());

        // Validate the SecurityAlert in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertSecurityAlertUpdatableFieldsEquals(partialUpdatedSecurityAlert, getPersistedSecurityAlert(partialUpdatedSecurityAlert));
    }

    @Test
    @Transactional
    void patchNonExistingSecurityAlert() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        securityAlert.setId(longCount.incrementAndGet());

        // Create the SecurityAlert
        SecurityAlertDTO securityAlertDTO = securityAlertMapper.toDto(securityAlert);

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restSecurityAlertMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, securityAlertDTO.getId())
                    .with(csrf())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(securityAlertDTO))
            )
            .andExpect(status().isBadRequest());

        // Validate the SecurityAlert in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchSecurityAlert() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        securityAlert.setId(longCount.incrementAndGet());

        // Create the SecurityAlert
        SecurityAlertDTO securityAlertDTO = securityAlertMapper.toDto(securityAlert);

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restSecurityAlertMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .with(csrf())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(securityAlertDTO))
            )
            .andExpect(status().isBadRequest());

        // Validate the SecurityAlert in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamSecurityAlert() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        securityAlert.setId(longCount.incrementAndGet());

        // Create the SecurityAlert
        SecurityAlertDTO securityAlertDTO = securityAlertMapper.toDto(securityAlert);

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restSecurityAlertMockMvc
            .perform(
                patch(ENTITY_API_URL)
                    .with(csrf())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(securityAlertDTO))
            )
            .andExpect(status().isMethodNotAllowed());

        // Validate the SecurityAlert in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteSecurityAlert() throws Exception {
        // Initialize the database
        insertedSecurityAlert = securityAlertRepository.saveAndFlush(securityAlert);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the securityAlert
        restSecurityAlertMockMvc
            .perform(delete(ENTITY_API_URL_ID, securityAlert.getId()).with(csrf()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return securityAlertRepository.count();
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

    protected SecurityAlert getPersistedSecurityAlert(SecurityAlert securityAlert) {
        return securityAlertRepository.findById(securityAlert.getId()).orElseThrow();
    }

    protected void assertPersistedSecurityAlertToMatchAllProperties(SecurityAlert expectedSecurityAlert) {
        assertSecurityAlertAllPropertiesEquals(expectedSecurityAlert, getPersistedSecurityAlert(expectedSecurityAlert));
    }

    protected void assertPersistedSecurityAlertToMatchUpdatableProperties(SecurityAlert expectedSecurityAlert) {
        assertSecurityAlertAllUpdatablePropertiesEquals(expectedSecurityAlert, getPersistedSecurityAlert(expectedSecurityAlert));
    }
}
