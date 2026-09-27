package com.policemanagement.com.web.rest;

import com.policemanagement.com.repository.SecurityAlertRepository;
import com.policemanagement.com.service.SecurityAlertQueryService;
import com.policemanagement.com.service.SecurityAlertService;
import com.policemanagement.com.service.criteria.SecurityAlertCriteria;
import com.policemanagement.com.service.dto.SecurityAlertDTO;
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
 * REST controller for managing {@link com.policemanagement.com.domain.SecurityAlert}.
 */
@RestController
@RequestMapping("/api/security-alerts")
public class SecurityAlertResource {

    private static final Logger LOG = LoggerFactory.getLogger(SecurityAlertResource.class);

    private static final String ENTITY_NAME = "securityAlert";

    @Value("${jhipster.clientApp.name:monolithic}")
    private String applicationName;

    private final SecurityAlertService securityAlertService;

    private final SecurityAlertRepository securityAlertRepository;

    private final SecurityAlertQueryService securityAlertQueryService;

    public SecurityAlertResource(
        SecurityAlertService securityAlertService,
        SecurityAlertRepository securityAlertRepository,
        SecurityAlertQueryService securityAlertQueryService
    ) {
        this.securityAlertService = securityAlertService;
        this.securityAlertRepository = securityAlertRepository;
        this.securityAlertQueryService = securityAlertQueryService;
    }

    /**
     * {@code POST  /security-alerts} : Create a new securityAlert.
     *
     * @param securityAlertDTO the securityAlertDTO to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new securityAlertDTO, or with status {@code 400 (Bad Request)} if the securityAlert already has an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<SecurityAlertDTO> createSecurityAlert(@Valid @RequestBody SecurityAlertDTO securityAlertDTO)
        throws URISyntaxException {
        LOG.debug("REST request to save SecurityAlert : {}", securityAlertDTO);
        if (securityAlertDTO.getId() != null) {
            throw new BadRequestAlertException("A new securityAlert cannot already have an ID", ENTITY_NAME, "idexists");
        }
        securityAlertDTO = securityAlertService.save(securityAlertDTO);
        return ResponseEntity.created(new URI("/api/security-alerts/" + securityAlertDTO.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, securityAlertDTO.getId().toString()))
            .body(securityAlertDTO);
    }

    /**
     * {@code PUT  /security-alerts/:id} : Updates an existing securityAlert.
     *
     * @param id the id of the securityAlertDTO to save.
     * @param securityAlertDTO the securityAlertDTO to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated securityAlertDTO,
     * or with status {@code 400 (Bad Request)} if the securityAlertDTO is not valid,
     * or with status {@code 500 (Internal Server Error)} if the securityAlertDTO couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<SecurityAlertDTO> updateSecurityAlert(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody SecurityAlertDTO securityAlertDTO
    ) throws URISyntaxException {
        LOG.debug("REST request to update SecurityAlert : {}, {}", id, securityAlertDTO);
        if (securityAlertDTO.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, securityAlertDTO.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!securityAlertRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        securityAlertDTO = securityAlertService.update(securityAlertDTO);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, securityAlertDTO.getId().toString()))
            .body(securityAlertDTO);
    }

    /**
     * {@code PATCH  /security-alerts/:id} : Partial updates given fields of an existing securityAlert, field will ignore if it is null
     *
     * @param id the id of the securityAlertDTO to save.
     * @param securityAlertDTO the securityAlertDTO to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated securityAlertDTO,
     * or with status {@code 400 (Bad Request)} if the securityAlertDTO is not valid,
     * or with status {@code 404 (Not Found)} if the securityAlertDTO is not found,
     * or with status {@code 500 (Internal Server Error)} if the securityAlertDTO couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<SecurityAlertDTO> partialUpdateSecurityAlert(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody SecurityAlertDTO securityAlertDTO
    ) throws URISyntaxException {
        LOG.debug("REST request to partially update SecurityAlert : {}, {}", id, securityAlertDTO);
        if (securityAlertDTO.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, securityAlertDTO.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!securityAlertRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<SecurityAlertDTO> result = securityAlertService.partialUpdate(securityAlertDTO);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, securityAlertDTO.getId().toString())
        );
    }

    /**
     * {@code GET  /security-alerts} : get all the Security Alerts.
     *
     * @param pageable the pagination information.
     * @param criteria the criteria which the requested entities should match.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Security Alerts in body.
     */
    @GetMapping("")
    public ResponseEntity<List<SecurityAlertDTO>> getAllSecurityAlerts(
        SecurityAlertCriteria criteria,
        @org.springdoc.core.annotations.ParameterObject Pageable pageable
    ) {
        LOG.debug("REST request to get SecurityAlerts by criteria: {}", criteria);

        Page<SecurityAlertDTO> page = securityAlertQueryService.findByCriteria(criteria, pageable);
        HttpHeaders headers = PaginationUtil.generatePaginationHttpHeaders(ServletUriComponentsBuilder.fromCurrentRequest(), page);
        return ResponseEntity.ok().headers(headers).body(page.getContent());
    }

    /**
     * {@code GET  /security-alerts/count} : count all the securityAlerts.
     *
     * @param criteria the criteria which the requested entities should match.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the count in body.
     */
    @GetMapping("/count")
    public ResponseEntity<Long> countSecurityAlerts(SecurityAlertCriteria criteria) {
        LOG.debug("REST request to count SecurityAlerts by criteria: {}", criteria);
        return ResponseEntity.ok().body(securityAlertQueryService.countByCriteria(criteria));
    }

    /**
     * {@code GET  /security-alerts/:id} : get the "id" securityAlert.
     *
     * @param id the id of the securityAlertDTO to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the securityAlertDTO, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<SecurityAlertDTO> getSecurityAlert(@PathVariable("id") Long id) {
        LOG.debug("REST request to get SecurityAlert : {}", id);
        Optional<SecurityAlertDTO> securityAlertDTO = securityAlertService.findOne(id);
        return ResponseUtil.wrapOrNotFound(securityAlertDTO);
    }

    /**
     * {@code DELETE  /security-alerts/:id} : delete the "id" securityAlert.
     *
     * @param id the id of the securityAlertDTO to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteSecurityAlert(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete SecurityAlert : {}", id);
        securityAlertService.delete(id);
        return ResponseEntity.noContent()
            .headers(HeaderUtil.createEntityDeletionAlert(applicationName, false, ENTITY_NAME, id.toString()))
            .build();
    }
}
