package com.policemanagement.com.web.rest;

import com.policemanagement.com.repository.HouseholdRepository;
import com.policemanagement.com.service.HouseholdQueryService;
import com.policemanagement.com.service.HouseholdService;
import com.policemanagement.com.service.criteria.HouseholdCriteria;
import com.policemanagement.com.service.dto.HouseholdDTO;
import com.policemanagement.com.web.rest.errors.BadRequestAlertException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import tech.jhipster.web.util.HeaderUtil;
import tech.jhipster.web.util.PaginationUtil;
import tech.jhipster.web.util.ResponseUtil;

/**
 * REST controller for managing {@link com.policemanagement.com.domain.Household}.
 */
@RestController
@RequestMapping("/api/households")
public class HouseholdResource {

    private static final Logger LOG = LoggerFactory.getLogger(HouseholdResource.class);

    private static final String ENTITY_NAME = "household";

    @Value("${jhipster.clientApp.name:monolithic}")
    private String applicationName;

    private final HouseholdService householdService;

    private final HouseholdRepository householdRepository;

    private final HouseholdQueryService householdQueryService;

    public HouseholdResource(
        HouseholdService householdService,
        HouseholdRepository householdRepository,
        HouseholdQueryService householdQueryService
    ) {
        this.householdService = householdService;
        this.householdRepository = householdRepository;
        this.householdQueryService = householdQueryService;
    }

    /**
     * {@code POST  /households} : Create a new household.
     *
     * @param householdDTO the householdDTO to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new householdDTO, or with status {@code 400 (Bad Request)} if the household already has an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<HouseholdDTO> createHousehold(@Valid @RequestBody HouseholdDTO householdDTO) throws URISyntaxException {
        LOG.debug("REST request to save Household : {}", householdDTO);
        if (householdDTO.getId() != null) {
            throw new BadRequestAlertException("A new household cannot already have an ID", ENTITY_NAME, "idexists");
        }
        householdDTO = householdService.save(householdDTO);
        return ResponseEntity.created(new URI("/api/households/" + householdDTO.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, householdDTO.getId().toString()))
            .body(householdDTO);
    }

    /**
     * {@code PUT  /households/:id} : Updates an existing household.
     *
     * @param id the id of the householdDTO to save.
     * @param householdDTO the householdDTO to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated householdDTO,
     * or with status {@code 400 (Bad Request)} if the householdDTO is not valid,
     * or with status {@code 500 (Internal Server Error)} if the householdDTO couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<HouseholdDTO> updateHousehold(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody HouseholdDTO householdDTO
    ) throws URISyntaxException {
        LOG.debug("REST request to update Household : {}, {}", id, householdDTO);
        if (householdDTO.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, householdDTO.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!householdRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        householdDTO = householdService.update(householdDTO);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, householdDTO.getId().toString()))
            .body(householdDTO);
    }

    /**
     * {@code PATCH  /households/:id} : Partial updates given fields of an existing household, field will ignore if it is null
     *
     * @param id the id of the householdDTO to save.
     * @param householdDTO the householdDTO to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated householdDTO,
     * or with status {@code 400 (Bad Request)} if the householdDTO is not valid,
     * or with status {@code 404 (Not Found)} if the householdDTO is not found,
     * or with status {@code 500 (Internal Server Error)} if the householdDTO couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<HouseholdDTO> partialUpdateHousehold(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody HouseholdDTO householdDTO
    ) throws URISyntaxException {
        LOG.debug("REST request to partially update Household : {}, {}", id, householdDTO);
        if (householdDTO.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, householdDTO.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!householdRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<HouseholdDTO> result = householdService.partialUpdate(householdDTO);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, householdDTO.getId().toString())
        );
    }

    /**
     * {@code GET  /households} : get all the Households.
     *
     * @param pageable the pagination information.
     * @param criteria the criteria which the requested entities should match.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Households in body.
     */
    @GetMapping("")
    public ResponseEntity<List<HouseholdDTO>> getAllHouseholds(
        HouseholdCriteria criteria,
        @org.springdoc.core.annotations.ParameterObject Pageable pageable
    ) {
        LOG.debug("REST request to get Households by criteria: {}", criteria);

        Page<HouseholdDTO> page = householdQueryService.findByCriteria(criteria, pageable);
        HttpHeaders headers = PaginationUtil.generatePaginationHttpHeaders(ServletUriComponentsBuilder.fromCurrentRequest(), page);
        return ResponseEntity.ok().headers(headers).body(page.getContent());
    }

    /**
     * {@code GET  /households/count} : count all the households.
     *
     * @param criteria the criteria which the requested entities should match.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the count in body.
     */
    @GetMapping("/count")
    public ResponseEntity<Long> countHouseholds(HouseholdCriteria criteria) {
        LOG.debug("REST request to count Households by criteria: {}", criteria);
        return ResponseEntity.ok().body(householdQueryService.countByCriteria(criteria));
    }

    /**
     * {@code GET  /households/:id} : get the "id" household.
     *
     * @param id the id of the householdDTO to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the householdDTO, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<HouseholdDTO> getHousehold(@PathVariable("id") Long id) {
        LOG.debug("REST request to get Household : {}", id);
        Optional<HouseholdDTO> householdDTO = householdService.findOne(id);
        return ResponseUtil.wrapOrNotFound(householdDTO);
    }

    /**
     * {@code DELETE  /households/:id} : delete the "id" household.
     *
     * @param id the id of the householdDTO to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteHousehold(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete Household : {}", id);
        householdService.delete(id);
        return ResponseEntity.noContent()
            .headers(HeaderUtil.createEntityDeletionAlert(applicationName, false, ENTITY_NAME, id.toString()))
            .build();
    }
}
