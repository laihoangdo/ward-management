package com.policemanagement.com.web.rest;

import com.policemanagement.com.repository.PatrolLogRepository;
import com.policemanagement.com.service.PatrolLogService;
import com.policemanagement.com.service.dto.PatrolLogDTO;
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
 * REST controller for managing {@link com.policemanagement.com.domain.PatrolLog}.
 */
@RestController
@RequestMapping("/api/patrol-logs")
public class PatrolLogResource {

    private static final Logger LOG = LoggerFactory.getLogger(PatrolLogResource.class);

    private static final String ENTITY_NAME = "patrolLog";

    @Value("${jhipster.clientApp.name:monolithic}")
    private String applicationName;

    private final PatrolLogService patrolLogService;

    private final PatrolLogRepository patrolLogRepository;

    public PatrolLogResource(PatrolLogService patrolLogService, PatrolLogRepository patrolLogRepository) {
        this.patrolLogService = patrolLogService;
        this.patrolLogRepository = patrolLogRepository;
    }

    /**
     * {@code POST  /patrol-logs} : Create a new patrolLog.
     *
     * @param patrolLogDTO the patrolLogDTO to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new patrolLogDTO, or with status {@code 400 (Bad Request)} if the patrolLog already has an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<PatrolLogDTO> createPatrolLog(@Valid @RequestBody PatrolLogDTO patrolLogDTO) throws URISyntaxException {
        LOG.debug("REST request to save PatrolLog : {}", patrolLogDTO);
        if (patrolLogDTO.getId() != null) {
            throw new BadRequestAlertException("A new patrolLog cannot already have an ID", ENTITY_NAME, "idexists");
        }
        patrolLogDTO = patrolLogService.save(patrolLogDTO);
        return ResponseEntity.created(new URI("/api/patrol-logs/" + patrolLogDTO.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, patrolLogDTO.getId().toString()))
            .body(patrolLogDTO);
    }

    /**
     * {@code PUT  /patrol-logs/:id} : Updates an existing patrolLog.
     *
     * @param id the id of the patrolLogDTO to save.
     * @param patrolLogDTO the patrolLogDTO to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated patrolLogDTO,
     * or with status {@code 400 (Bad Request)} if the patrolLogDTO is not valid,
     * or with status {@code 500 (Internal Server Error)} if the patrolLogDTO couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<PatrolLogDTO> updatePatrolLog(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody PatrolLogDTO patrolLogDTO
    ) throws URISyntaxException {
        LOG.debug("REST request to update PatrolLog : {}, {}", id, patrolLogDTO);
        if (patrolLogDTO.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, patrolLogDTO.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!patrolLogRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        patrolLogDTO = patrolLogService.update(patrolLogDTO);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, patrolLogDTO.getId().toString()))
            .body(patrolLogDTO);
    }

    /**
     * {@code PATCH  /patrol-logs/:id} : Partial updates given fields of an existing patrolLog, field will ignore if it is null
     *
     * @param id the id of the patrolLogDTO to save.
     * @param patrolLogDTO the patrolLogDTO to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated patrolLogDTO,
     * or with status {@code 400 (Bad Request)} if the patrolLogDTO is not valid,
     * or with status {@code 404 (Not Found)} if the patrolLogDTO is not found,
     * or with status {@code 500 (Internal Server Error)} if the patrolLogDTO couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<PatrolLogDTO> partialUpdatePatrolLog(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody PatrolLogDTO patrolLogDTO
    ) throws URISyntaxException {
        LOG.debug("REST request to partially update PatrolLog : {}, {}", id, patrolLogDTO);
        if (patrolLogDTO.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, patrolLogDTO.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!patrolLogRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<PatrolLogDTO> result = patrolLogService.partialUpdate(patrolLogDTO);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, patrolLogDTO.getId().toString())
        );
    }

    /**
     * {@code GET  /patrol-logs} : get all the Patrol Logs.
     *
     * @param pageable the pagination information.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Patrol Logs in body.
     */
    @GetMapping("")
    public ResponseEntity<List<PatrolLogDTO>> getAllPatrolLogs(@org.springdoc.core.annotations.ParameterObject Pageable pageable) {
        LOG.debug("REST request to get a page of PatrolLogs");
        Page<PatrolLogDTO> page = patrolLogService.findAll(pageable);
        HttpHeaders headers = PaginationUtil.generatePaginationHttpHeaders(ServletUriComponentsBuilder.fromCurrentRequest(), page);
        return ResponseEntity.ok().headers(headers).body(page.getContent());
    }

    /**
     * {@code GET  /patrol-logs/:id} : get the "id" patrolLog.
     *
     * @param id the id of the patrolLogDTO to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the patrolLogDTO, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<PatrolLogDTO> getPatrolLog(@PathVariable("id") Long id) {
        LOG.debug("REST request to get PatrolLog : {}", id);
        Optional<PatrolLogDTO> patrolLogDTO = patrolLogService.findOne(id);
        return ResponseUtil.wrapOrNotFound(patrolLogDTO);
    }

    /**
     * {@code DELETE  /patrol-logs/:id} : delete the "id" patrolLog.
     *
     * @param id the id of the patrolLogDTO to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePatrolLog(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete PatrolLog : {}", id);
        patrolLogService.delete(id);
        return ResponseEntity.noContent()
            .headers(HeaderUtil.createEntityDeletionAlert(applicationName, false, ENTITY_NAME, id.toString()))
            .build();
    }
}
