package com.policemanagement.com.web.rest;

import com.policemanagement.com.repository.HamletRepository;
import com.policemanagement.com.service.HamletService;
import com.policemanagement.com.service.dto.HamletDTO;
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
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tech.jhipster.web.util.HeaderUtil;
import tech.jhipster.web.util.ResponseUtil;

/**
 * REST controller for managing {@link com.policemanagement.com.domain.Hamlet}.
 */
@RestController
@RequestMapping({ "/api/hamlets", "/api/area-zones" })
public class HamletResource {

    private static final Logger LOG = LoggerFactory.getLogger(HamletResource.class);

    private static final String ENTITY_NAME = "administrativeHamlet";

    @Value("${jhipster.clientApp.name:monolithic}")
    private String applicationName;

    private final HamletService administrativeHamletService;

    private final HamletRepository administrativeHamletRepository;

    public HamletResource(HamletService administrativeHamletService, HamletRepository administrativeHamletRepository) {
        this.administrativeHamletService = administrativeHamletService;
        this.administrativeHamletRepository = administrativeHamletRepository;
    }

    /**
     * {@code POST  /area-zones} : Create a new administrativeHamlet.
     *
     * @param administrativeHamletDTO the administrativeHamletDTO to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new administrativeHamletDTO, or with status {@code 400 (Bad Request)} if the administrativeHamlet already has an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<HamletDTO> createHamlet(@Valid @RequestBody HamletDTO administrativeHamletDTO) throws URISyntaxException {
        LOG.debug("REST request to save Hamlet : {}", administrativeHamletDTO);
        if (administrativeHamletDTO.getId() != null) {
            throw new BadRequestAlertException("A new administrativeHamlet cannot already have an ID", ENTITY_NAME, "idexists");
        }
        administrativeHamletDTO = administrativeHamletService.save(administrativeHamletDTO);
        return ResponseEntity.created(new URI("/api/area-zones/" + administrativeHamletDTO.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, administrativeHamletDTO.getId().toString()))
            .body(administrativeHamletDTO);
    }

    /**
     * {@code PUT  /area-zones/:id} : Updates an existing administrativeHamlet.
     *
     * @param id the id of the administrativeHamletDTO to save.
     * @param administrativeHamletDTO the administrativeHamletDTO to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated administrativeHamletDTO,
     * or with status {@code 400 (Bad Request)} if the administrativeHamletDTO is not valid,
     * or with status {@code 500 (Internal Server Error)} if the administrativeHamletDTO couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<HamletDTO> updateHamlet(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody HamletDTO administrativeHamletDTO
    ) throws URISyntaxException {
        LOG.debug("REST request to update Hamlet : {}, {}", id, administrativeHamletDTO);
        if (administrativeHamletDTO.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, administrativeHamletDTO.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!administrativeHamletRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        administrativeHamletDTO = administrativeHamletService.update(administrativeHamletDTO);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, administrativeHamletDTO.getId().toString()))
            .body(administrativeHamletDTO);
    }

    /**
     * {@code PATCH  /area-zones/:id} : Partial updates given fields of an existing administrativeHamlet, field will ignore if it is null
     *
     * @param id the id of the administrativeHamletDTO to save.
     * @param administrativeHamletDTO the administrativeHamletDTO to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated administrativeHamletDTO,
     * or with status {@code 400 (Bad Request)} if the administrativeHamletDTO is not valid,
     * or with status {@code 404 (Not Found)} if the administrativeHamletDTO is not found,
     * or with status {@code 500 (Internal Server Error)} if the administrativeHamletDTO couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<HamletDTO> partialUpdateHamlet(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody HamletDTO administrativeHamletDTO
    ) throws URISyntaxException {
        LOG.debug("REST request to partially update Hamlet : {}, {}", id, administrativeHamletDTO);
        if (administrativeHamletDTO.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, administrativeHamletDTO.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!administrativeHamletRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<HamletDTO> result = administrativeHamletService.partialUpdate(administrativeHamletDTO);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, administrativeHamletDTO.getId().toString())
        );
    }

    /**
     * {@code GET  /area-zones} : get all the Area Zones.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Area Zones in body.
     */
    @GetMapping("")
    public List<HamletDTO> getAllHamlets() {
        LOG.debug("REST request to get all Hamlets");
        return administrativeHamletService.findAll();
    }

    /**
     * {@code GET  /area-zones/:id} : get the "id" administrativeHamlet.
     *
     * @param id the id of the administrativeHamletDTO to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the administrativeHamletDTO, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<HamletDTO> getHamlet(@PathVariable("id") Long id) {
        LOG.debug("REST request to get Hamlet : {}", id);
        Optional<HamletDTO> administrativeHamletDTO = administrativeHamletService.findOne(id);
        return ResponseUtil.wrapOrNotFound(administrativeHamletDTO);
    }

    /**
     * {@code DELETE  /area-zones/:id} : delete the "id" administrativeHamlet.
     *
     * @param id the id of the administrativeHamletDTO to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteHamlet(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete Hamlet : {}", id);
        administrativeHamletService.delete(id);
        return ResponseEntity.noContent()
            .headers(HeaderUtil.createEntityDeletionAlert(applicationName, false, ENTITY_NAME, id.toString()))
            .build();
    }
}
