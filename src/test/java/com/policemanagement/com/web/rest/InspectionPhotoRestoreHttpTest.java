package com.policemanagement.com.web.rest;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.policemanagement.com.service.rbac.RbacService;
import com.policemanagement.com.web.rest.errors.ExceptionTranslator;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

/** Real restored PostgreSQL + MVC/controller advice; RBAC is mocked, not a Keycloak login test. */
@EnabledIfEnvironmentVariable(named = "RUN_RELEASE_RESTORE_TESTS", matches = "true")
class InspectionPhotoRestoreHttpTest {

    private JdbcTemplate db;
    private TransactionTemplate tx;
    private RbacService rbac;
    private MockMvc mvc;
    private long household;
    private final ObjectMapper mapper = new ObjectMapper();
    private static final String PNG =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=";

    @BeforeEach
    void setup() {
        String database = System.getenv("RELEASE_RESTORE_DATABASE");
        assertNotNull(database);
        assertTrue(database.matches("tc2_restore_[A-Za-z0-9_]+"));
        var source = new DriverManagerDataSource("jdbc:postgresql://127.0.0.1:55433/" + database, "police_runtime", "");
        db = new JdbcTemplate(source);
        assertEquals(database, db.queryForObject("select current_database()", String.class));
        tx = new TransactionTemplate(new DataSourceTransactionManager(source));
        household = db.queryForObject("select min(id) from public.household", Long.class);
        rbac = mock(RbacService.class);
        when(rbac.current()).thenReturn(Map.of("id", "synthetic-photo-test", "fullName", "Synthetic Test Officer"));
        mvc = MockMvcBuilders.standaloneSetup(new GisInspectionPhotoResource(db, rbac))
            .setControllerAdvice(new ExceptionTranslator(new MockEnvironment()))
            .build();
    }

    private String path() {
        return "/api/gis/households/" + household + "/inspection-photos";
    }

    @Test
    void uploadListAndDeletePersistUsingRuntimeGrants() {
        tx.executeWithoutResult(status -> {
            status.setRollbackOnly();
            try {
                String result = mvc
                    .perform(
                        post(path())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(mapper.writeValueAsString(Map.of("url", PNG, "caption", " Synthetic fixture ", "category", "general")))
                    )
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.caption").value("Synthetic fixture"))
                    .andExpect(jsonPath("$.takenBy").value("Synthetic Test Officer"))
                    .andReturn()
                    .getResponse()
                    .getContentAsString();
                String id = mapper.readTree(result).get("id").asText();
                long otherHousehold = db.queryForObject("select min(id) from public.household where id<>?", Long.class, household);
                mvc.perform(delete("/api/gis/households/" + otherHousehold + "/inspection-photos/" + id)).andExpect(status().isNotFound());
                mvc.perform(get(path())).andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"));
                assertEquals(
                    1L,
                    db.queryForObject("select count(*) from gis_inspection_photo where id=?::uuid and image_data=?", Long.class, id, PNG)
                );
                mvc.perform(delete(path() + "/" + id)).andExpect(status().isNoContent());
                mvc.perform(delete(path() + "/" + id)).andExpect(status().isNotFound());
                assertEquals(0L, db.queryForObject("select count(*) from gis_inspection_photo where id=?::uuid", Long.class, id));
                verify(rbac, atLeastOnce()).permission("canUpdateInspection");
                verify(rbac, atLeastOnce()).household(household);
            } catch (Exception e) {
                throw new AssertionError("Synthetic photo HTTP lifecycle failed", e);
            }
        });
    }

    @Test
    void outOfScopeReadWriteAndDeleteReturnForbidden() throws Exception {
        doThrow(new AccessDeniedException("Synthetic out-of-scope fixture")).when(rbac).household(household);
        mvc.perform(get(path())).andExpect(status().isForbidden());
        mvc.perform(
            post(path())
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("url", PNG, "category", "general")))
        ).andExpect(status().isForbidden());
        mvc.perform(delete(path() + "/00000000-0000-0000-0000-000000000001")).andExpect(status().isForbidden());
    }

    @Test
    void invalidImageReturnsBadRequestAndMissingWritePermissionReturnsForbidden() throws Exception {
        mvc.perform(
            post(path())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"url\":\"data:image/png;base64,YWJj\",\"category\":\"general\"}")
        ).andExpect(status().isBadRequest());
        doThrow(new AccessDeniedException("Synthetic read-only fixture")).when(rbac).permission("canUpdateInspection");
        mvc.perform(
            post(path())
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("url", PNG, "category", "general")))
        ).andExpect(status().isForbidden());
        mvc.perform(delete(path() + "/00000000-0000-0000-0000-000000000001")).andExpect(status().isForbidden());
    }
}
