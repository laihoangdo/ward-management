package com.policemanagement.com.web.rest;

import com.policemanagement.com.repository.AreaZoneRepository;
import com.policemanagement.com.service.AreaZoneService;
import com.policemanagement.com.service.dto.AreaZoneDTO;
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
 * REST controller for managing {@link com.policemanagement.com.domain.AreaZone}.
 */
@RestController
@RequestMapping("/api/area-zones")
public class AreaZoneResource {

    private static final Logger LOG = LoggerFactory.getLogger(AreaZoneResource.class);

    private static final String ENTITY_NAME = "areaZone";

    @Value("${jhipster.clientApp.name:monolithic}")
    private String applicationName;

    private final AreaZoneService areaZoneService;

    private final AreaZoneRepository areaZoneRepository;

    public AreaZoneResource(AreaZoneService areaZoneService, AreaZoneRepository areaZoneRepository) {
        this.areaZoneService = areaZoneService;
        this.areaZoneRepository = areaZoneRepository;
    }

    /**
     * {@code POST  /area-zones} : Create a new areaZone.
     *
     * @param areaZoneDTO the areaZoneDTO to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new areaZoneDTO, or with status {@code 400 (Bad Request)} if the areaZone already has an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<AreaZoneDTO> createAreaZone(@Valid @RequestBody AreaZoneDTO areaZoneDTO) throws URISyntaxException {
        LOG.debug("REST request to save AreaZone : {}", areaZoneDTO);
        if (areaZoneDTO.getId() != null) {
            throw new BadRequestAlertException("A new areaZone cannot already have an ID", ENTITY_NAME, "idexists");
        }
        areaZoneDTO = areaZoneService.save(areaZoneDTO);
        return ResponseEntity.created(new URI("/api/area-zones/" + areaZoneDTO.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, areaZoneDTO.getId().toString()))
            .body(areaZoneDTO);
    }

    /**
     * {@code PUT  /area-zones/:id} : Updates an existing areaZone.
     *
     * @param id the id of the areaZoneDTO to save.
     * @param areaZoneDTO the areaZoneDTO to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated areaZoneDTO,
     * or with status {@code 400 (Bad Request)} if the areaZoneDTO is not valid,
     * or with status {@code 500 (Internal Server Error)} if the areaZoneDTO couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<AreaZoneDTO> updateAreaZone(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody AreaZoneDTO areaZoneDTO
    ) throws URISyntaxException {
        LOG.debug("REST request to update AreaZone : {}, {}", id, areaZoneDTO);
        if (areaZoneDTO.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, areaZoneDTO.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!areaZoneRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        areaZoneDTO = areaZoneService.update(areaZoneDTO);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, areaZoneDTO.getId().toString()))
            .body(areaZoneDTO);
    }

    /**
     * {@code PATCH  /area-zones/:id} : Partial updates given fields of an existing areaZone, field will ignore if it is null
     *
     * @param id the id of the areaZoneDTO to save.
     * @param areaZoneDTO the areaZoneDTO to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated areaZoneDTO,
     * or with status {@code 400 (Bad Request)} if the areaZoneDTO is not valid,
     * or with status {@code 404 (Not Found)} if the areaZoneDTO is not found,
     * or with status {@code 500 (Internal Server Error)} if the areaZoneDTO couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<AreaZoneDTO> partialUpdateAreaZone(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody AreaZoneDTO areaZoneDTO
    ) throws URISyntaxException {
        LOG.debug("REST request to partially update AreaZone : {}, {}", id, areaZoneDTO);
        if (areaZoneDTO.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, areaZoneDTO.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!areaZoneRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<AreaZoneDTO> result = areaZoneService.partialUpdate(areaZoneDTO);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, areaZoneDTO.getId().toString())
        );
    }

    /**
     * {@code GET  /area-zones} : get all the Area Zones.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Area Zones in body.
     */
    @GetMapping("")
    public List<AreaZoneDTO> getAllAreaZones() {
        LOG.debug("REST request to get all AreaZones");
        return areaZoneService.findAll();
    }

    /**
     * {@code GET  /area-zones/:id} : get the "id" areaZone.
     *
     * @param id the id of the areaZoneDTO to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the areaZoneDTO, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<AreaZoneDTO> getAreaZone(@PathVariable("id") Long id) {
        LOG.debug("REST request to get AreaZone : {}", id);
        Optional<AreaZoneDTO> areaZoneDTO = areaZoneService.findOne(id);
        return ResponseUtil.wrapOrNotFound(areaZoneDTO);
    }

    /**
     * {@code DELETE  /area-zones/:id} : delete the "id" areaZone.
     *
     * @param id the id of the areaZoneDTO to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAreaZone(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete AreaZone : {}", id);
        areaZoneService.delete(id);
        return ResponseEntity.noContent()
            .headers(HeaderUtil.createEntityDeletionAlert(applicationName, false, ENTITY_NAME, id.toString()))
            .build();
    }
}
