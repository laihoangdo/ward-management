package com.policemanagement.com.web.rest;

import com.policemanagement.com.domain.Resident;
import com.policemanagement.com.repository.ResidentRepository;
import com.policemanagement.com.service.CccdProtection;
import com.policemanagement.com.service.ResidentQueryService;
import com.policemanagement.com.service.ResidentService;
import com.policemanagement.com.service.criteria.ResidentCriteria;
import com.policemanagement.com.service.dto.ResidentDTO;
import com.policemanagement.com.service.rbac.RbacService;
import com.policemanagement.com.web.rest.errors.BadRequestAlertException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import tech.jhipster.web.util.HeaderUtil;
import tech.jhipster.web.util.PaginationUtil;
import tech.jhipster.web.util.ResponseUtil;

/**
 * REST controller for managing {@link com.policemanagement.com.domain.Resident}.
 */
@RestController
@RequestMapping("/api/residents")
public class ResidentResource {

    private static final Logger LOG = LoggerFactory.getLogger(ResidentResource.class);

    private static final String ENTITY_NAME = "resident";

    @Value("${jhipster.clientApp.name:monolithic}")
    private String applicationName;

    private final ResidentService residentService;

    private final ResidentRepository residentRepository;

    private final ResidentQueryService residentQueryService;

    private final RbacService rbac;

    public ResidentResource(
        ResidentService residentService,
        ResidentRepository residentRepository,
        ResidentQueryService residentQueryService,
        RbacService rbac
    ) {
        this.residentService = residentService;
        this.residentRepository = residentRepository;
        this.residentQueryService = residentQueryService;
        this.rbac = rbac;
    }

    /**
     * {@code POST  /residents} : Create a new resident.
     *
     * @param residentDTO the residentDTO to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new residentDTO, or with status {@code 400 (Bad Request)} if the resident already has an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<ResidentDTO> createResident(@Valid @RequestBody ResidentDTO residentDTO) throws URISyntaxException {
        LOG.debug("REST request to save Resident : {}", residentDTO);
        if (residentDTO.getId() != null) {
            throw new BadRequestAlertException("A new resident cannot already have an ID", ENTITY_NAME, "idexists");
        }
        if (CccdProtection.isMasked(residentDTO.getIdCardNumber())) {
            throw new BadRequestAlertException("Số CCCD đã bị che; nhập số đầy đủ hoặc bỏ trống", ENTITY_NAME, "maskedcccd");
        }
        residentDTO = residentService.save(residentDTO);
        return ResponseEntity.created(new URI("/api/residents/" + residentDTO.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, residentDTO.getId().toString()))
            .body(residentDTO);
    }

    /**
     * {@code PUT  /residents/:id} : Updates an existing resident.
     *
     * @param id the id of the residentDTO to save.
     * @param residentDTO the residentDTO to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated residentDTO,
     * or with status {@code 400 (Bad Request)} if the residentDTO is not valid,
     * or with status {@code 500 (Internal Server Error)} if the residentDTO couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<ResidentDTO> updateResident(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody ResidentDTO residentDTO
    ) throws URISyntaxException {
        LOG.debug("REST request to update Resident : {}, {}", id, residentDTO);
        if (residentDTO.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, residentDTO.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!residentRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        preserveMaskedIdentity(id, residentDTO);
        residentDTO = residentService.update(residentDTO);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, residentDTO.getId().toString()))
            .body(residentDTO);
    }

    /**
     * {@code PATCH  /residents/:id} : Partial updates given fields of an existing resident, field will ignore if it is null
     *
     * @param id the id of the residentDTO to save.
     * @param residentDTO the residentDTO to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated residentDTO,
     * or with status {@code 400 (Bad Request)} if the residentDTO is not valid,
     * or with status {@code 404 (Not Found)} if the residentDTO is not found,
     * or with status {@code 500 (Internal Server Error)} if the residentDTO couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<ResidentDTO> partialUpdateResident(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody ResidentDTO residentDTO
    ) throws URISyntaxException {
        LOG.debug("REST request to partially update Resident : {}, {}", id, residentDTO);
        if (residentDTO.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, residentDTO.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!residentRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        preserveMaskedIdentity(id, residentDTO);
        Optional<ResidentDTO> result = residentService.partialUpdate(residentDTO);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, residentDTO.getId().toString())
        );
    }

    /**
     * {@code GET  /residents} : get all the Residents.
     *
     * @param pageable the pagination information.
     * @param criteria the criteria which the requested entities should match.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Residents in body.
     */
    @GetMapping("")
    public ResponseEntity<List<ResidentDTO>> getAllResidents(
        ResidentCriteria criteria,
        @org.springdoc.core.annotations.ParameterObject Pageable pageable
    ) {
        LOG.debug("REST request to get Residents by criteria: {}", criteria);

        rbac.audit("read", "residents:list", Map.of());
        Page<ResidentDTO> page = residentQueryService.findByCriteria(criteria, pageable);
        page.getContent().forEach(dto -> dto.setIdCardNumber(CccdProtection.display(dto.getIdCardNumber())));
        HttpHeaders headers = PaginationUtil.generatePaginationHttpHeaders(ServletUriComponentsBuilder.fromCurrentRequest(), page);
        return ResponseEntity.ok().headers(headers).body(page.getContent());
    }

    /**
     * {@code GET  /residents/count} : count all the residents.
     *
     * @param criteria the criteria which the requested entities should match.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the count in body.
     */
    @GetMapping("/count")
    public ResponseEntity<Long> countResidents(ResidentCriteria criteria) {
        LOG.debug("REST request to count Residents by criteria: {}", criteria);
        return ResponseEntity.ok().body(residentQueryService.countByCriteria(criteria));
    }

    /**
     * {@code GET  /residents/:id} : get the "id" resident.
     *
     * @param id the id of the residentDTO to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the residentDTO, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<ResidentDTO> getResident(@PathVariable("id") Long id) {
        LOG.debug("REST request to get Resident : {}", id);
        rbac.audit("read", "resident:" + id, Map.of());
        Optional<ResidentDTO> residentDTO = residentService.findOne(id);
        residentDTO.ifPresent(dto -> dto.setIdCardNumber(CccdProtection.display(dto.getIdCardNumber())));
        return ResponseUtil.wrapOrNotFound(residentDTO);
    }

    /**
     * {@code POST  /residents/:id/reveal-id} : audited disclosure of the full identity number.
     * Requires the {@code canRevealIdentity} permission; every disclosure is written to rbac_audit.
     */
    @PostMapping("/{id}/reveal-id")
    public ResponseEntity<Map<String, Object>> revealIdCard(@PathVariable("id") Long id) {
        rbac.permission("canRevealIdentity");
        ResidentDTO residentDTO = residentService
            .findOne(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy nhân khẩu"));
        String full = CccdProtection.reveal(residentDTO.getIdCardNumber());
        rbac.audit("identity-revealed", "resident:" + id, Map.of("source", "legacy"));
        return ResponseEntity.ok(Map.of("idCardNumber", full == null ? "" : full));
    }

    /** A masked round-trip (edited screens load masked values) must never overwrite the stored number. */
    private void preserveMaskedIdentity(Long id, ResidentDTO residentDTO) {
        if (CccdProtection.isMasked(residentDTO.getIdCardNumber())) {
            residentDTO.setIdCardNumber(residentRepository.findById(id).map(Resident::getIdCardNumber).orElse(null));
        }
    }

    /**
     * {@code DELETE  /residents/:id} : delete the "id" resident.
     *
     * @param id the id of the residentDTO to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteResident(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete Resident : {}", id);
        residentService.delete(id);
        return ResponseEntity.noContent()
            .headers(HeaderUtil.createEntityDeletionAlert(applicationName, false, ENTITY_NAME, id.toString()))
            .build();
    }
}
