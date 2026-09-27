package com.policemanagement.com.web.rest;

import static com.policemanagement.com.domain.AreaZoneAsserts.*;
import static com.policemanagement.com.web.rest.TestUtil.createUpdateProxyForBean;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.policemanagement.com.IntegrationTest;
import com.policemanagement.com.domain.AreaZone;
import com.policemanagement.com.repository.AreaZoneRepository;
import com.policemanagement.com.service.dto.AreaZoneDTO;
import com.policemanagement.com.service.mapper.AreaZoneMapper;
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
 * Integration tests for the {@link AreaZoneResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class AreaZoneResourceIT {

    private static final String DEFAULT_CODE = "AAAAAAAAAA";
    private static final String UPDATED_CODE = "BBBBBBBBBB";

    private static final String DEFAULT_NAME = "AAAAAAAAAA";
    private static final String UPDATED_NAME = "BBBBBBBBBB";

    private static final String DEFAULT_HAMLET_NAME = "AAAAAAAAAA";
    private static final String UPDATED_HAMLET_NAME = "BBBBBBBBBB";

    private static final String DEFAULT_OFFICER_IN_CHARGE = "AAAAAAAAAA";
    private static final String UPDATED_OFFICER_IN_CHARGE = "BBBBBBBBBB";

    private static final String DEFAULT_OFFICER_PHONE = "AAAAAAAAAA";
    private static final String UPDATED_OFFICER_PHONE = "BBBBBBBBBB";

    private static final Integer DEFAULT_POPULATION_COUNT = 1;
    private static final Integer UPDATED_POPULATION_COUNT = 2;

    private static final Integer DEFAULT_HOUSEHOLD_COUNT = 1;
    private static final Integer UPDATED_HOUSEHOLD_COUNT = 2;

    private static final String DEFAULT_BOUNDARY_GEO_JSON = "AAAAAAAAAA";
    private static final String UPDATED_BOUNDARY_GEO_JSON = "BBBBBBBBBB";

    private static final String ENTITY_API_URL = "/api/area-zones";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + 2L * Integer.MAX_VALUE);

    @Autowired
    private ObjectMapper om;

    @Autowired
    private AreaZoneRepository areaZoneRepository;

    @Autowired
    private AreaZoneMapper areaZoneMapper;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restAreaZoneMockMvc;

    private AreaZone areaZone;

    private AreaZone insertedAreaZone;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static AreaZone createEntity() {
        return new AreaZone()
            .code(DEFAULT_CODE)
            .name(DEFAULT_NAME)
            .hamletName(DEFAULT_HAMLET_NAME)
            .officerInCharge(DEFAULT_OFFICER_IN_CHARGE)
            .officerPhone(DEFAULT_OFFICER_PHONE)
            .populationCount(DEFAULT_POPULATION_COUNT)
            .householdCount(DEFAULT_HOUSEHOLD_COUNT)
            .boundaryGeoJson(DEFAULT_BOUNDARY_GEO_JSON);
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static AreaZone createUpdatedEntity() {
        return new AreaZone()
            .code(UPDATED_CODE)
            .name(UPDATED_NAME)
            .hamletName(UPDATED_HAMLET_NAME)
            .officerInCharge(UPDATED_OFFICER_IN_CHARGE)
            .officerPhone(UPDATED_OFFICER_PHONE)
            .populationCount(UPDATED_POPULATION_COUNT)
            .householdCount(UPDATED_HOUSEHOLD_COUNT)
            .boundaryGeoJson(UPDATED_BOUNDARY_GEO_JSON);
    }

    @BeforeEach
    void initTest() {
        areaZone = createEntity();
    }

    @AfterEach
    void cleanup() {
        if (insertedAreaZone != null) {
            areaZoneRepository.delete(insertedAreaZone);
            insertedAreaZone = null;
        }
    }

    @Test
    @Transactional
    void createAreaZone() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the AreaZone
        AreaZoneDTO areaZoneDTO = areaZoneMapper.toDto(areaZone);
        var returnedAreaZoneDTO = om.readValue(
            restAreaZoneMockMvc
                .perform(
                    post(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(areaZoneDTO))
                )
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            AreaZoneDTO.class
        );

        // Validate the AreaZone in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        var returnedAreaZone = areaZoneMapper.toEntity(returnedAreaZoneDTO);
        assertAreaZoneUpdatableFieldsEquals(returnedAreaZone, getPersistedAreaZone(returnedAreaZone));

        insertedAreaZone = returnedAreaZone;
    }

    @Test
    @Transactional
    void createAreaZoneWithExistingId() throws Exception {
        // Create the AreaZone with an existing ID
        areaZone.setId(1L);
        AreaZoneDTO areaZoneDTO = areaZoneMapper.toDto(areaZone);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restAreaZoneMockMvc
            .perform(post(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(areaZoneDTO)))
            .andExpect(status().isBadRequest());

        // Validate the AreaZone in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkCodeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        areaZone.setCode(null);

        // Create the AreaZone, which fails.
        AreaZoneDTO areaZoneDTO = areaZoneMapper.toDto(areaZone);

        restAreaZoneMockMvc
            .perform(post(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(areaZoneDTO)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkNameIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        areaZone.setName(null);

        // Create the AreaZone, which fails.
        AreaZoneDTO areaZoneDTO = areaZoneMapper.toDto(areaZone);

        restAreaZoneMockMvc
            .perform(post(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(areaZoneDTO)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkHamletNameIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        areaZone.setHamletName(null);

        // Create the AreaZone, which fails.
        AreaZoneDTO areaZoneDTO = areaZoneMapper.toDto(areaZone);

        restAreaZoneMockMvc
            .perform(post(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(areaZoneDTO)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllAreaZones() throws Exception {
        // Initialize the database
        insertedAreaZone = areaZoneRepository.saveAndFlush(areaZone);

        // Get all the areaZoneList
        restAreaZoneMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(areaZone.getId().intValue())))
            .andExpect(jsonPath("$.[*].code").value(hasItem(DEFAULT_CODE)))
            .andExpect(jsonPath("$.[*].name").value(hasItem(DEFAULT_NAME)))
            .andExpect(jsonPath("$.[*].hamletName").value(hasItem(DEFAULT_HAMLET_NAME)))
            .andExpect(jsonPath("$.[*].officerInCharge").value(hasItem(DEFAULT_OFFICER_IN_CHARGE)))
            .andExpect(jsonPath("$.[*].officerPhone").value(hasItem(DEFAULT_OFFICER_PHONE)))
            .andExpect(jsonPath("$.[*].populationCount").value(hasItem(DEFAULT_POPULATION_COUNT)))
            .andExpect(jsonPath("$.[*].householdCount").value(hasItem(DEFAULT_HOUSEHOLD_COUNT)))
            .andExpect(jsonPath("$.[*].boundaryGeoJson").value(hasItem(DEFAULT_BOUNDARY_GEO_JSON)));
    }

    @Test
    @Transactional
    void getAreaZone() throws Exception {
        // Initialize the database
        insertedAreaZone = areaZoneRepository.saveAndFlush(areaZone);

        // Get the areaZone
        restAreaZoneMockMvc
            .perform(get(ENTITY_API_URL_ID, areaZone.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(areaZone.getId().intValue()))
            .andExpect(jsonPath("$.code").value(DEFAULT_CODE))
            .andExpect(jsonPath("$.name").value(DEFAULT_NAME))
            .andExpect(jsonPath("$.hamletName").value(DEFAULT_HAMLET_NAME))
            .andExpect(jsonPath("$.officerInCharge").value(DEFAULT_OFFICER_IN_CHARGE))
            .andExpect(jsonPath("$.officerPhone").value(DEFAULT_OFFICER_PHONE))
            .andExpect(jsonPath("$.populationCount").value(DEFAULT_POPULATION_COUNT))
            .andExpect(jsonPath("$.householdCount").value(DEFAULT_HOUSEHOLD_COUNT))
            .andExpect(jsonPath("$.boundaryGeoJson").value(DEFAULT_BOUNDARY_GEO_JSON));
    }

    @Test
    @Transactional
    void getNonExistingAreaZone() throws Exception {
        // Get the areaZone
        restAreaZoneMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingAreaZone() throws Exception {
        // Initialize the database
        insertedAreaZone = areaZoneRepository.saveAndFlush(areaZone);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the areaZone
        AreaZone updatedAreaZone = areaZoneRepository.findById(areaZone.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedAreaZone are not directly saved in db
        em.detach(updatedAreaZone);
        updatedAreaZone
            .code(UPDATED_CODE)
            .name(UPDATED_NAME)
            .hamletName(UPDATED_HAMLET_NAME)
            .officerInCharge(UPDATED_OFFICER_IN_CHARGE)
            .officerPhone(UPDATED_OFFICER_PHONE)
            .populationCount(UPDATED_POPULATION_COUNT)
            .householdCount(UPDATED_HOUSEHOLD_COUNT)
            .boundaryGeoJson(UPDATED_BOUNDARY_GEO_JSON);
        AreaZoneDTO areaZoneDTO = areaZoneMapper.toDto(updatedAreaZone);

        restAreaZoneMockMvc
            .perform(
                put(ENTITY_API_URL_ID, areaZoneDTO.getId())
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(areaZoneDTO))
            )
            .andExpect(status().isOk());

        // Validate the AreaZone in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedAreaZoneToMatchAllProperties(updatedAreaZone);
    }

    @Test
    @Transactional
    void putNonExistingAreaZone() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        areaZone.setId(longCount.incrementAndGet());

        // Create the AreaZone
        AreaZoneDTO areaZoneDTO = areaZoneMapper.toDto(areaZone);

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restAreaZoneMockMvc
            .perform(
                put(ENTITY_API_URL_ID, areaZoneDTO.getId())
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(areaZoneDTO))
            )
            .andExpect(status().isBadRequest());

        // Validate the AreaZone in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchAreaZone() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        areaZone.setId(longCount.incrementAndGet());

        // Create the AreaZone
        AreaZoneDTO areaZoneDTO = areaZoneMapper.toDto(areaZone);

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restAreaZoneMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(areaZoneDTO))
            )
            .andExpect(status().isBadRequest());

        // Validate the AreaZone in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamAreaZone() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        areaZone.setId(longCount.incrementAndGet());

        // Create the AreaZone
        AreaZoneDTO areaZoneDTO = areaZoneMapper.toDto(areaZone);

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restAreaZoneMockMvc
            .perform(put(ENTITY_API_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(areaZoneDTO)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the AreaZone in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateAreaZoneWithPatch() throws Exception {
        // Initialize the database
        insertedAreaZone = areaZoneRepository.saveAndFlush(areaZone);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the areaZone using partial update
        AreaZone partialUpdatedAreaZone = new AreaZone();
        partialUpdatedAreaZone.setId(areaZone.getId());

        partialUpdatedAreaZone.name(UPDATED_NAME).officerPhone(UPDATED_OFFICER_PHONE).populationCount(UPDATED_POPULATION_COUNT);

        restAreaZoneMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedAreaZone.getId())
                    .with(csrf())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedAreaZone))
            )
            .andExpect(status().isOk());

        // Validate the AreaZone in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertAreaZoneUpdatableFieldsEquals(createUpdateProxyForBean(partialUpdatedAreaZone, areaZone), getPersistedAreaZone(areaZone));
    }

    @Test
    @Transactional
    void fullUpdateAreaZoneWithPatch() throws Exception {
        // Initialize the database
        insertedAreaZone = areaZoneRepository.saveAndFlush(areaZone);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the areaZone using partial update
        AreaZone partialUpdatedAreaZone = new AreaZone();
        partialUpdatedAreaZone.setId(areaZone.getId());

        partialUpdatedAreaZone
            .code(UPDATED_CODE)
            .name(UPDATED_NAME)
            .hamletName(UPDATED_HAMLET_NAME)
            .officerInCharge(UPDATED_OFFICER_IN_CHARGE)
            .officerPhone(UPDATED_OFFICER_PHONE)
            .populationCount(UPDATED_POPULATION_COUNT)
            .householdCount(UPDATED_HOUSEHOLD_COUNT)
            .boundaryGeoJson(UPDATED_BOUNDARY_GEO_JSON);

        restAreaZoneMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedAreaZone.getId())
                    .with(csrf())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedAreaZone))
            )
            .andExpect(status().isOk());

        // Validate the AreaZone in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertAreaZoneUpdatableFieldsEquals(partialUpdatedAreaZone, getPersistedAreaZone(partialUpdatedAreaZone));
    }

    @Test
    @Transactional
    void patchNonExistingAreaZone() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        areaZone.setId(longCount.incrementAndGet());

        // Create the AreaZone
        AreaZoneDTO areaZoneDTO = areaZoneMapper.toDto(areaZone);

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restAreaZoneMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, areaZoneDTO.getId())
                    .with(csrf())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(areaZoneDTO))
            )
            .andExpect(status().isBadRequest());

        // Validate the AreaZone in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchAreaZone() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        areaZone.setId(longCount.incrementAndGet());

        // Create the AreaZone
        AreaZoneDTO areaZoneDTO = areaZoneMapper.toDto(areaZone);

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restAreaZoneMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .with(csrf())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(areaZoneDTO))
            )
            .andExpect(status().isBadRequest());

        // Validate the AreaZone in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamAreaZone() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        areaZone.setId(longCount.incrementAndGet());

        // Create the AreaZone
        AreaZoneDTO areaZoneDTO = areaZoneMapper.toDto(areaZone);

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restAreaZoneMockMvc
            .perform(
                patch(ENTITY_API_URL).with(csrf()).contentType("application/merge-patch+json").content(om.writeValueAsBytes(areaZoneDTO))
            )
            .andExpect(status().isMethodNotAllowed());

        // Validate the AreaZone in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteAreaZone() throws Exception {
        // Initialize the database
        insertedAreaZone = areaZoneRepository.saveAndFlush(areaZone);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the areaZone
        restAreaZoneMockMvc
            .perform(delete(ENTITY_API_URL_ID, areaZone.getId()).with(csrf()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return areaZoneRepository.count();
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

    protected AreaZone getPersistedAreaZone(AreaZone areaZone) {
        return areaZoneRepository.findById(areaZone.getId()).orElseThrow();
    }

    protected void assertPersistedAreaZoneToMatchAllProperties(AreaZone expectedAreaZone) {
        assertAreaZoneAllPropertiesEquals(expectedAreaZone, getPersistedAreaZone(expectedAreaZone));
    }

    protected void assertPersistedAreaZoneToMatchUpdatableProperties(AreaZone expectedAreaZone) {
        assertAreaZoneAllUpdatablePropertiesEquals(expectedAreaZone, getPersistedAreaZone(expectedAreaZone));
    }
}
