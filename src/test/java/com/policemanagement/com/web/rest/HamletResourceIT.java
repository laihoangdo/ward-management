package com.policemanagement.com.web.rest;

import static com.policemanagement.com.domain.HamletAsserts.*;
import static com.policemanagement.com.web.rest.TestUtil.createUpdateProxyForBean;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.policemanagement.com.IntegrationTest;
import com.policemanagement.com.domain.Hamlet;
import com.policemanagement.com.repository.HamletRepository;
import com.policemanagement.com.service.dto.HamletDTO;
import com.policemanagement.com.service.mapper.HamletMapper;
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
 * Integration tests for the {@link HamletResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class HamletResourceIT {

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
    private HamletRepository administrativeHamletRepository;

    @Autowired
    private HamletMapper administrativeHamletMapper;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restHamletMockMvc;

    private Hamlet administrativeHamlet;

    private Hamlet insertedHamlet;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static Hamlet createEntity() {
        return new Hamlet()
            .communeId(1L)
            .unitType("AP")
            .nameNormalized("synthetic test hamlet")
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
    public static Hamlet createUpdatedEntity() {
        return new Hamlet()
            .communeId(1L)
            .unitType("AP")
            .nameNormalized("synthetic test hamlet")
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
        administrativeHamlet = createEntity();
    }

    @AfterEach
    void cleanup() {
        if (insertedHamlet != null) {
            administrativeHamletRepository.delete(insertedHamlet);
            insertedHamlet = null;
        }
    }

    @Test
    @Transactional
    void createHamlet() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the Hamlet
        HamletDTO administrativeHamletDTO = administrativeHamletMapper.toDto(administrativeHamlet);
        var returnedHamletDTO = om.readValue(
            restHamletMockMvc
                .perform(
                    post(ENTITY_API_URL)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(om.writeValueAsBytes(administrativeHamletDTO))
                )
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            HamletDTO.class
        );

        // Validate the Hamlet in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        var returnedHamlet = administrativeHamletMapper.toEntity(returnedHamletDTO);
        assertHamletUpdatableFieldsEquals(returnedHamlet, getPersistedHamlet(returnedHamlet));

        insertedHamlet = returnedHamlet;
    }

    @Test
    @Transactional
    void createHamletWithExistingId() throws Exception {
        // Create the Hamlet with an existing ID
        administrativeHamlet.setId(1L);
        HamletDTO administrativeHamletDTO = administrativeHamletMapper.toDto(administrativeHamlet);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restHamletMockMvc
            .perform(
                post(ENTITY_API_URL)
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(administrativeHamletDTO))
            )
            .andExpect(status().isBadRequest());

        // Validate the Hamlet in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkCodeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        administrativeHamlet.setCode(null);

        // Create the Hamlet, which fails.
        HamletDTO administrativeHamletDTO = administrativeHamletMapper.toDto(administrativeHamlet);

        restHamletMockMvc
            .perform(
                post(ENTITY_API_URL)
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(administrativeHamletDTO))
            )
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkNameIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        administrativeHamlet.setName(null);

        // Create the Hamlet, which fails.
        HamletDTO administrativeHamletDTO = administrativeHamletMapper.toDto(administrativeHamlet);

        restHamletMockMvc
            .perform(
                post(ENTITY_API_URL)
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(administrativeHamletDTO))
            )
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkHamletNameIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        administrativeHamlet.setHamletName(null);

        // Create the Hamlet, which fails.
        HamletDTO administrativeHamletDTO = administrativeHamletMapper.toDto(administrativeHamlet);

        restHamletMockMvc
            .perform(
                post(ENTITY_API_URL)
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(administrativeHamletDTO))
            )
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllHamlets() throws Exception {
        // Initialize the database
        insertedHamlet = administrativeHamletRepository.saveAndFlush(administrativeHamlet);

        // Get all the administrativeHamletList
        restHamletMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(administrativeHamlet.getId().intValue())))
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
    void getAdministrativeHamlet() throws Exception {
        // Initialize the database
        insertedHamlet = administrativeHamletRepository.saveAndFlush(administrativeHamlet);

        // Get the administrativeHamlet
        restHamletMockMvc
            .perform(get(ENTITY_API_URL_ID, administrativeHamlet.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(administrativeHamlet.getId().intValue()))
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
    void getNonExistingHamlet() throws Exception {
        // Get the administrativeHamlet
        restHamletMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingHamlet() throws Exception {
        // Initialize the database
        insertedHamlet = administrativeHamletRepository.saveAndFlush(administrativeHamlet);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the administrativeHamlet
        Hamlet updatedHamlet = administrativeHamletRepository.findById(administrativeHamlet.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedHamlet are not directly saved in db
        em.detach(updatedHamlet);
        updatedHamlet
            .code(UPDATED_CODE)
            .name(UPDATED_NAME)
            .hamletName(UPDATED_HAMLET_NAME)
            .officerInCharge(UPDATED_OFFICER_IN_CHARGE)
            .officerPhone(UPDATED_OFFICER_PHONE)
            .populationCount(UPDATED_POPULATION_COUNT)
            .householdCount(UPDATED_HOUSEHOLD_COUNT)
            .boundaryGeoJson(UPDATED_BOUNDARY_GEO_JSON);
        HamletDTO administrativeHamletDTO = administrativeHamletMapper.toDto(updatedHamlet);

        restHamletMockMvc
            .perform(
                put(ENTITY_API_URL_ID, administrativeHamletDTO.getId())
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(administrativeHamletDTO))
            )
            .andExpect(status().isOk());

        // Validate the Hamlet in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedHamletToMatchAllProperties(updatedHamlet);
    }

    @Test
    @Transactional
    void putNonExistingHamlet() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        administrativeHamlet.setId(longCount.incrementAndGet());

        // Create the Hamlet
        HamletDTO administrativeHamletDTO = administrativeHamletMapper.toDto(administrativeHamlet);

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restHamletMockMvc
            .perform(
                put(ENTITY_API_URL_ID, administrativeHamletDTO.getId())
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(administrativeHamletDTO))
            )
            .andExpect(status().isBadRequest());

        // Validate the Hamlet in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchHamlet() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        administrativeHamlet.setId(longCount.incrementAndGet());

        // Create the Hamlet
        HamletDTO administrativeHamletDTO = administrativeHamletMapper.toDto(administrativeHamlet);

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restHamletMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(administrativeHamletDTO))
            )
            .andExpect(status().isBadRequest());

        // Validate the Hamlet in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamHamlet() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        administrativeHamlet.setId(longCount.incrementAndGet());

        // Create the Hamlet
        HamletDTO administrativeHamletDTO = administrativeHamletMapper.toDto(administrativeHamlet);

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restHamletMockMvc
            .perform(
                put(ENTITY_API_URL)
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(administrativeHamletDTO))
            )
            .andExpect(status().isMethodNotAllowed());

        // Validate the Hamlet in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateHamletWithPatch() throws Exception {
        // Initialize the database
        insertedHamlet = administrativeHamletRepository.saveAndFlush(administrativeHamlet);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the administrativeHamlet using partial update
        Hamlet partialUpdatedHamlet = new Hamlet();
        partialUpdatedHamlet.setId(administrativeHamlet.getId());

        partialUpdatedHamlet.name(UPDATED_NAME).officerPhone(UPDATED_OFFICER_PHONE).populationCount(UPDATED_POPULATION_COUNT);

        restHamletMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedHamlet.getId())
                    .with(csrf())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedHamlet))
            )
            .andExpect(status().isOk());

        // Validate the Hamlet in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertHamletUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedHamlet, administrativeHamlet),
            getPersistedHamlet(administrativeHamlet)
        );
    }

    @Test
    @Transactional
    void fullUpdateHamletWithPatch() throws Exception {
        // Initialize the database
        insertedHamlet = administrativeHamletRepository.saveAndFlush(administrativeHamlet);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the administrativeHamlet using partial update
        Hamlet partialUpdatedHamlet = new Hamlet();
        partialUpdatedHamlet.setId(administrativeHamlet.getId());

        partialUpdatedHamlet
            .code(UPDATED_CODE)
            .name(UPDATED_NAME)
            .hamletName(UPDATED_HAMLET_NAME)
            .officerInCharge(UPDATED_OFFICER_IN_CHARGE)
            .officerPhone(UPDATED_OFFICER_PHONE)
            .populationCount(UPDATED_POPULATION_COUNT)
            .householdCount(UPDATED_HOUSEHOLD_COUNT)
            .boundaryGeoJson(UPDATED_BOUNDARY_GEO_JSON);

        restHamletMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedHamlet.getId())
                    .with(csrf())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedHamlet))
            )
            .andExpect(status().isOk());

        // Validate the Hamlet in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertHamletUpdatableFieldsEquals(partialUpdatedHamlet, getPersistedHamlet(partialUpdatedHamlet));
    }

    @Test
    @Transactional
    void patchNonExistingHamlet() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        administrativeHamlet.setId(longCount.incrementAndGet());

        // Create the Hamlet
        HamletDTO administrativeHamletDTO = administrativeHamletMapper.toDto(administrativeHamlet);

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restHamletMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, administrativeHamletDTO.getId())
                    .with(csrf())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(administrativeHamletDTO))
            )
            .andExpect(status().isBadRequest());

        // Validate the Hamlet in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchHamlet() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        administrativeHamlet.setId(longCount.incrementAndGet());

        // Create the Hamlet
        HamletDTO administrativeHamletDTO = administrativeHamletMapper.toDto(administrativeHamlet);

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restHamletMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .with(csrf())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(administrativeHamletDTO))
            )
            .andExpect(status().isBadRequest());

        // Validate the Hamlet in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamHamlet() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        administrativeHamlet.setId(longCount.incrementAndGet());

        // Create the Hamlet
        HamletDTO administrativeHamletDTO = administrativeHamletMapper.toDto(administrativeHamlet);

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restHamletMockMvc
            .perform(
                patch(ENTITY_API_URL)
                    .with(csrf())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(administrativeHamletDTO))
            )
            .andExpect(status().isMethodNotAllowed());

        // Validate the Hamlet in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteHamlet() throws Exception {
        // Initialize the database
        insertedHamlet = administrativeHamletRepository.saveAndFlush(administrativeHamlet);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the administrativeHamlet
        restHamletMockMvc
            .perform(delete(ENTITY_API_URL_ID, administrativeHamlet.getId()).with(csrf()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return administrativeHamletRepository.count();
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

    protected Hamlet getPersistedHamlet(Hamlet administrativeHamlet) {
        return administrativeHamletRepository.findById(administrativeHamlet.getId()).orElseThrow();
    }

    protected void assertPersistedHamletToMatchAllProperties(Hamlet expectedHamlet) {
        assertHamletAllPropertiesEquals(expectedHamlet, getPersistedHamlet(expectedHamlet));
    }

    protected void assertPersistedHamletToMatchUpdatableProperties(Hamlet expectedHamlet) {
        assertHamletAllUpdatablePropertiesEquals(expectedHamlet, getPersistedHamlet(expectedHamlet));
    }
}
