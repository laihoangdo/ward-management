package com.policemanagement.com.web.rest;

import com.policemanagement.com.repository.DocumentRecordRepository;
import com.policemanagement.com.service.DocumentRecordQueryService;
import com.policemanagement.com.service.DocumentRecordService;
import com.policemanagement.com.service.criteria.DocumentRecordCriteria;
import com.policemanagement.com.service.dto.DocumentRecordDTO;
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
 * REST controller for managing {@link com.policemanagement.com.domain.DocumentRecord}.
 */
@RestController
@RequestMapping("/api/document-records")
public class DocumentRecordResource {

    private static final Logger LOG = LoggerFactory.getLogger(DocumentRecordResource.class);

    private static final String ENTITY_NAME = "documentRecord";

    @Value("${jhipster.clientApp.name:monolithic}")
    private String applicationName;

    private final DocumentRecordService documentRecordService;

    private final DocumentRecordRepository documentRecordRepository;

    private final DocumentRecordQueryService documentRecordQueryService;

    public DocumentRecordResource(
        DocumentRecordService documentRecordService,
        DocumentRecordRepository documentRecordRepository,
        DocumentRecordQueryService documentRecordQueryService
    ) {
        this.documentRecordService = documentRecordService;
        this.documentRecordRepository = documentRecordRepository;
        this.documentRecordQueryService = documentRecordQueryService;
    }

    /**
     * {@code POST  /document-records} : Create a new documentRecord.
     *
     * @param documentRecordDTO the documentRecordDTO to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new documentRecordDTO, or with status {@code 400 (Bad Request)} if the documentRecord already has an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<DocumentRecordDTO> createDocumentRecord(@Valid @RequestBody DocumentRecordDTO documentRecordDTO)
        throws URISyntaxException {
        LOG.debug("REST request to save DocumentRecord : {}", documentRecordDTO);
        if (documentRecordDTO.getId() != null) {
            throw new BadRequestAlertException("A new documentRecord cannot already have an ID", ENTITY_NAME, "idexists");
        }
        documentRecordDTO = documentRecordService.save(documentRecordDTO);
        return ResponseEntity.created(new URI("/api/document-records/" + documentRecordDTO.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, documentRecordDTO.getId().toString()))
            .body(documentRecordDTO);
    }

    /**
     * {@code PUT  /document-records/:id} : Updates an existing documentRecord.
     *
     * @param id the id of the documentRecordDTO to save.
     * @param documentRecordDTO the documentRecordDTO to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated documentRecordDTO,
     * or with status {@code 400 (Bad Request)} if the documentRecordDTO is not valid,
     * or with status {@code 500 (Internal Server Error)} if the documentRecordDTO couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<DocumentRecordDTO> updateDocumentRecord(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody DocumentRecordDTO documentRecordDTO
    ) throws URISyntaxException {
        LOG.debug("REST request to update DocumentRecord : {}, {}", id, documentRecordDTO);
        if (documentRecordDTO.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, documentRecordDTO.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!documentRecordRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        documentRecordDTO = documentRecordService.update(documentRecordDTO);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, documentRecordDTO.getId().toString()))
            .body(documentRecordDTO);
    }

    /**
     * {@code PATCH  /document-records/:id} : Partial updates given fields of an existing documentRecord, field will ignore if it is null
     *
     * @param id the id of the documentRecordDTO to save.
     * @param documentRecordDTO the documentRecordDTO to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated documentRecordDTO,
     * or with status {@code 400 (Bad Request)} if the documentRecordDTO is not valid,
     * or with status {@code 404 (Not Found)} if the documentRecordDTO is not found,
     * or with status {@code 500 (Internal Server Error)} if the documentRecordDTO couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<DocumentRecordDTO> partialUpdateDocumentRecord(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody DocumentRecordDTO documentRecordDTO
    ) throws URISyntaxException {
        LOG.debug("REST request to partially update DocumentRecord : {}, {}", id, documentRecordDTO);
        if (documentRecordDTO.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, documentRecordDTO.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!documentRecordRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<DocumentRecordDTO> result = documentRecordService.partialUpdate(documentRecordDTO);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, documentRecordDTO.getId().toString())
        );
    }

    /**
     * {@code GET  /document-records} : get all the Document Records.
     *
     * @param pageable the pagination information.
     * @param criteria the criteria which the requested entities should match.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Document Records in body.
     */
    @GetMapping("")
    public ResponseEntity<List<DocumentRecordDTO>> getAllDocumentRecords(
        DocumentRecordCriteria criteria,
        @org.springdoc.core.annotations.ParameterObject Pageable pageable
    ) {
        LOG.debug("REST request to get DocumentRecords by criteria: {}", criteria);

        Page<DocumentRecordDTO> page = documentRecordQueryService.findByCriteria(criteria, pageable);
        HttpHeaders headers = PaginationUtil.generatePaginationHttpHeaders(ServletUriComponentsBuilder.fromCurrentRequest(), page);
        return ResponseEntity.ok().headers(headers).body(page.getContent());
    }

    /**
     * {@code GET  /document-records/count} : count all the documentRecords.
     *
     * @param criteria the criteria which the requested entities should match.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the count in body.
     */
    @GetMapping("/count")
    public ResponseEntity<Long> countDocumentRecords(DocumentRecordCriteria criteria) {
        LOG.debug("REST request to count DocumentRecords by criteria: {}", criteria);
        return ResponseEntity.ok().body(documentRecordQueryService.countByCriteria(criteria));
    }

    /**
     * {@code GET  /document-records/:id} : get the "id" documentRecord.
     *
     * @param id the id of the documentRecordDTO to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the documentRecordDTO, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<DocumentRecordDTO> getDocumentRecord(@PathVariable("id") Long id) {
        LOG.debug("REST request to get DocumentRecord : {}", id);
        Optional<DocumentRecordDTO> documentRecordDTO = documentRecordService.findOne(id);
        return ResponseUtil.wrapOrNotFound(documentRecordDTO);
    }

    /**
     * {@code DELETE  /document-records/:id} : delete the "id" documentRecord.
     *
     * @param id the id of the documentRecordDTO to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteDocumentRecord(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete DocumentRecord : {}", id);
        documentRecordService.delete(id);
        return ResponseEntity.noContent()
            .headers(HeaderUtil.createEntityDeletionAlert(applicationName, false, ENTITY_NAME, id.toString()))
            .build();
    }
}
