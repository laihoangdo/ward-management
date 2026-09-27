package com.policemanagement.com.web.rest;

import static com.policemanagement.com.domain.PatrolLogAsserts.*;
import static com.policemanagement.com.web.rest.TestUtil.createUpdateProxyForBean;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.policemanagement.com.IntegrationTest;
import com.policemanagement.com.domain.PatrolLog;
import com.policemanagement.com.repository.PatrolLogRepository;
import com.policemanagement.com.service.dto.PatrolLogDTO;
import com.policemanagement.com.service.mapper.PatrolLogMapper;
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
 * Integration tests for the {@link PatrolLogResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class PatrolLogResourceIT {

    private static final String DEFAULT_ACTION = "AAAAAAAAAA";
    private static final String UPDATED_ACTION = "BBBBBBBBBB";

    private static final String DEFAULT_TARGET = "AAAAAAAAAA";
    private static final String UPDATED_TARGET = "BBBBBBBBBB";

    private static final String DEFAULT_DETAILS = "AAAAAAAAAA";
    private static final String UPDATED_DETAILS = "BBBBBBBBBB";

    private static final String DEFAULT_OFFICER_NAME = "AAAAAAAAAA";
    private static final String UPDATED_OFFICER_NAME = "BBBBBBBBBB";

    private static final String DEFAULT_BADGE_NUMBER = "AAAAAAAAAA";
    private static final String UPDATED_BADGE_NUMBER = "BBBBBBBBBB";

    private static final String DEFAULT_IP_ADDRESS = "AAAAAAAAAA";
    private static final String UPDATED_IP_ADDRESS = "BBBBBBBBBB";

    private static final Instant DEFAULT_TIMESTAMP = Instant.ofEpochMilli(0L);
    private static final Instant UPDATED_TIMESTAMP = Instant.ofEpochMilli(1789810131296L);

    private static final String ENTITY_API_URL = "/api/patrol-logs";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + 2L * Integer.MAX_VALUE);

    @Autowired
    private ObjectMapper om;

    @Autowired
    private PatrolLogRepository patrolLogRepository;

    @Autowired
    private PatrolLogMapper patrolLogMapper;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restPatrolLogMockMvc;

    private PatrolLog patrolLog;

    private PatrolLog insertedPatrolLog;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static PatrolLog createEntity() {
        return new PatrolLog()
            .action(DEFAULT_ACTION)
            .target(DEFAULT_TARGET)
            .details(DEFAULT_DETAILS)
            .officerName(DEFAULT_OFFICER_NAME)
            .badgeNumber(DEFAULT_BADGE_NUMBER)
            .ipAddress(DEFAULT_IP_ADDRESS)
            .timestamp(DEFAULT_TIMESTAMP);
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static PatrolLog createUpdatedEntity() {
        return new PatrolLog()
            .action(UPDATED_ACTION)
            .target(UPDATED_TARGET)
            .details(UPDATED_DETAILS)
            .officerName(UPDATED_OFFICER_NAME)
            .badgeNumber(UPDATED_BADGE_NUMBER)
            .ipAddress(UPDATED_IP_ADDRESS)
            .timestamp(UPDATED_TIMESTAMP);
    }

    @BeforeEach
    void initTest() {
        patrolLog = createEntity();
    }

    @AfterEach
    void cleanup() {
        if (insertedPatrolLog != null) {
            patrolLogRepository.delete(insertedPatrolLog);
            insertedPatrolLog = null;
        }
    }

    @Test
    @Transactional
    void createPatrolLog() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the PatrolLog
        PatrolLogDTO patrolLogDTO = patrolLogMapper.toDto(patrolLog);
        var returnedPatrolLogDTO = om.readValue(
            restPatrolLogMockMvc
                .perform(
                    post(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(patrolLogDTO))
                )
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            PatrolLogDTO.class
        );

        // Validate the PatrolLog in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        var returnedPatrolLog = patrolLogMapper.toEntity(returnedPatrolLogDTO);
        assertPatrolLogUpdatableFieldsEquals(returnedPatrolLog, getPersistedPatrolLog(returnedPatrolLog));

        insertedPatrolLog = returnedPatrolLog;
    }

    @Test
    @Transactional
    void createPatrolLogWithExistingId() throws Exception {
        // Create the PatrolLog with an existing ID
        patrolLog.setId(1L);
        PatrolLogDTO patrolLogDTO = patrolLogMapper.toDto(patrolLog);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restPatrolLogMockMvc
            .perform(post(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(patrolLogDTO)))
            .andExpect(status().isBadRequest());

        // Validate the PatrolLog in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkActionIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        patrolLog.setAction(null);

        // Create the PatrolLog, which fails.
        PatrolLogDTO patrolLogDTO = patrolLogMapper.toDto(patrolLog);

        restPatrolLogMockMvc
            .perform(post(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(patrolLogDTO)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkOfficerNameIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        patrolLog.setOfficerName(null);

        // Create the PatrolLog, which fails.
        PatrolLogDTO patrolLogDTO = patrolLogMapper.toDto(patrolLog);

        restPatrolLogMockMvc
            .perform(post(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(patrolLogDTO)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkTimestampIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        patrolLog.setTimestamp(null);

        // Create the PatrolLog, which fails.
        PatrolLogDTO patrolLogDTO = patrolLogMapper.toDto(patrolLog);

        restPatrolLogMockMvc
            .perform(post(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(patrolLogDTO)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllPatrolLogs() throws Exception {
        // Initialize the database
        insertedPatrolLog = patrolLogRepository.saveAndFlush(patrolLog);

        // Get all the patrolLogList
        restPatrolLogMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(patrolLog.getId().intValue())))
            .andExpect(jsonPath("$.[*].action").value(hasItem(DEFAULT_ACTION)))
            .andExpect(jsonPath("$.[*].target").value(hasItem(DEFAULT_TARGET)))
            .andExpect(jsonPath("$.[*].details").value(hasItem(DEFAULT_DETAILS)))
            .andExpect(jsonPath("$.[*].officerName").value(hasItem(DEFAULT_OFFICER_NAME)))
            .andExpect(jsonPath("$.[*].badgeNumber").value(hasItem(DEFAULT_BADGE_NUMBER)))
            .andExpect(jsonPath("$.[*].ipAddress").value(hasItem(DEFAULT_IP_ADDRESS)))
            .andExpect(jsonPath("$.[*].timestamp").value(hasItem(DEFAULT_TIMESTAMP.toString())));
    }

    @Test
    @Transactional
    void getPatrolLog() throws Exception {
        // Initialize the database
        insertedPatrolLog = patrolLogRepository.saveAndFlush(patrolLog);

        // Get the patrolLog
        restPatrolLogMockMvc
            .perform(get(ENTITY_API_URL_ID, patrolLog.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(patrolLog.getId().intValue()))
            .andExpect(jsonPath("$.action").value(DEFAULT_ACTION))
            .andExpect(jsonPath("$.target").value(DEFAULT_TARGET))
            .andExpect(jsonPath("$.details").value(DEFAULT_DETAILS))
            .andExpect(jsonPath("$.officerName").value(DEFAULT_OFFICER_NAME))
            .andExpect(jsonPath("$.badgeNumber").value(DEFAULT_BADGE_NUMBER))
            .andExpect(jsonPath("$.ipAddress").value(DEFAULT_IP_ADDRESS))
            .andExpect(jsonPath("$.timestamp").value(DEFAULT_TIMESTAMP.toString()));
    }

    @Test
    @Transactional
    void getNonExistingPatrolLog() throws Exception {
        // Get the patrolLog
        restPatrolLogMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingPatrolLog() throws Exception {
        // Initialize the database
        insertedPatrolLog = patrolLogRepository.saveAndFlush(patrolLog);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the patrolLog
        PatrolLog updatedPatrolLog = patrolLogRepository.findById(patrolLog.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedPatrolLog are not directly saved in db
        em.detach(updatedPatrolLog);
        updatedPatrolLog
            .action(UPDATED_ACTION)
            .target(UPDATED_TARGET)
            .details(UPDATED_DETAILS)
            .officerName(UPDATED_OFFICER_NAME)
            .badgeNumber(UPDATED_BADGE_NUMBER)
            .ipAddress(UPDATED_IP_ADDRESS)
            .timestamp(UPDATED_TIMESTAMP);
        PatrolLogDTO patrolLogDTO = patrolLogMapper.toDto(updatedPatrolLog);

        restPatrolLogMockMvc
            .perform(
                put(ENTITY_API_URL_ID, patrolLogDTO.getId())
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(patrolLogDTO))
            )
            .andExpect(status().isOk());

        // Validate the PatrolLog in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedPatrolLogToMatchAllProperties(updatedPatrolLog);
    }

    @Test
    @Transactional
    void putNonExistingPatrolLog() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        patrolLog.setId(longCount.incrementAndGet());

        // Create the PatrolLog
        PatrolLogDTO patrolLogDTO = patrolLogMapper.toDto(patrolLog);

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restPatrolLogMockMvc
            .perform(
                put(ENTITY_API_URL_ID, patrolLogDTO.getId())
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(patrolLogDTO))
            )
            .andExpect(status().isBadRequest());

        // Validate the PatrolLog in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchPatrolLog() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        patrolLog.setId(longCount.incrementAndGet());

        // Create the PatrolLog
        PatrolLogDTO patrolLogDTO = patrolLogMapper.toDto(patrolLog);

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restPatrolLogMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(patrolLogDTO))
            )
            .andExpect(status().isBadRequest());

        // Validate the PatrolLog in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamPatrolLog() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        patrolLog.setId(longCount.incrementAndGet());

        // Create the PatrolLog
        PatrolLogDTO patrolLogDTO = patrolLogMapper.toDto(patrolLog);

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restPatrolLogMockMvc
            .perform(put(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(patrolLogDTO)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the PatrolLog in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdatePatrolLogWithPatch() throws Exception {
        // Initialize the database
        insertedPatrolLog = patrolLogRepository.saveAndFlush(patrolLog);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the patrolLog using partial update
        PatrolLog partialUpdatedPatrolLog = new PatrolLog();
        partialUpdatedPatrolLog.setId(patrolLog.getId());

        partialUpdatedPatrolLog
            .details(UPDATED_DETAILS)
            .badgeNumber(UPDATED_BADGE_NUMBER)
            .ipAddress(UPDATED_IP_ADDRESS)
            .timestamp(UPDATED_TIMESTAMP);

        restPatrolLogMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedPatrolLog.getId())
                    .with(csrf())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedPatrolLog))
            )
            .andExpect(status().isOk());

        // Validate the PatrolLog in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPatrolLogUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedPatrolLog, patrolLog),
            getPersistedPatrolLog(patrolLog)
        );
    }

    @Test
    @Transactional
    void fullUpdatePatrolLogWithPatch() throws Exception {
        // Initialize the database
        insertedPatrolLog = patrolLogRepository.saveAndFlush(patrolLog);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the patrolLog using partial update
        PatrolLog partialUpdatedPatrolLog = new PatrolLog();
        partialUpdatedPatrolLog.setId(patrolLog.getId());

        partialUpdatedPatrolLog
            .action(UPDATED_ACTION)
            .target(UPDATED_TARGET)
            .details(UPDATED_DETAILS)
            .officerName(UPDATED_OFFICER_NAME)
            .badgeNumber(UPDATED_BADGE_NUMBER)
            .ipAddress(UPDATED_IP_ADDRESS)
            .timestamp(UPDATED_TIMESTAMP);

        restPatrolLogMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedPatrolLog.getId())
                    .with(csrf())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedPatrolLog))
            )
            .andExpect(status().isOk());

        // Validate the PatrolLog in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPatrolLogUpdatableFieldsEquals(partialUpdatedPatrolLog, getPersistedPatrolLog(partialUpdatedPatrolLog));
    }

    @Test
    @Transactional
    void patchNonExistingPatrolLog() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        patrolLog.setId(longCount.incrementAndGet());

        // Create the PatrolLog
        PatrolLogDTO patrolLogDTO = patrolLogMapper.toDto(patrolLog);

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restPatrolLogMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, patrolLogDTO.getId())
                    .with(csrf())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(patrolLogDTO))
            )
            .andExpect(status().isBadRequest());

        // Validate the PatrolLog in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchPatrolLog() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        patrolLog.setId(longCount.incrementAndGet());

        // Create the PatrolLog
        PatrolLogDTO patrolLogDTO = patrolLogMapper.toDto(patrolLog);

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restPatrolLogMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .with(csrf())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(patrolLogDTO))
            )
            .andExpect(status().isBadRequest());

        // Validate the PatrolLog in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamPatrolLog() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        patrolLog.setId(longCount.incrementAndGet());

        // Create the PatrolLog
        PatrolLogDTO patrolLogDTO = patrolLogMapper.toDto(patrolLog);

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restPatrolLogMockMvc
            .perform(
                patch(ENTITY_API_URL).with(csrf()).contentType("application/merge-patch+json").content(om.writeValueAsBytes(patrolLogDTO))
            )
            .andExpect(status().isMethodNotAllowed());

        // Validate the PatrolLog in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deletePatrolLog() throws Exception {
        // Initialize the database
        insertedPatrolLog = patrolLogRepository.saveAndFlush(patrolLog);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the patrolLog
        restPatrolLogMockMvc
            .perform(delete(ENTITY_API_URL_ID, patrolLog.getId()).with(csrf()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return patrolLogRepository.count();
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

    protected PatrolLog getPersistedPatrolLog(PatrolLog patrolLog) {
        return patrolLogRepository.findById(patrolLog.getId()).orElseThrow();
    }

    protected void assertPersistedPatrolLogToMatchAllProperties(PatrolLog expectedPatrolLog) {
        assertPatrolLogAllPropertiesEquals(expectedPatrolLog, getPersistedPatrolLog(expectedPatrolLog));
    }

    protected void assertPersistedPatrolLogToMatchUpdatableProperties(PatrolLog expectedPatrolLog) {
        assertPatrolLogAllUpdatablePropertiesEquals(expectedPatrolLog, getPersistedPatrolLog(expectedPatrolLog));
    }
}
