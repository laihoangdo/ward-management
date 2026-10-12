package com.policemanagement.com.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.policemanagement.com.IntegrationTest;
import com.policemanagement.com.domain.Hamlet;
import com.policemanagement.com.domain.Household;
import com.policemanagement.com.domain.enumeration.FacilityType;
import com.policemanagement.com.domain.enumeration.SecurityStatus;
import com.policemanagement.com.repository.HamletRepository;
import com.policemanagement.com.repository.HouseholdRepository;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration tests for {@link AdministrativeUnitResource}.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class AdministrativeUnitResourceIT {

    @Autowired
    private MockMvc restMockMvc;

    @Autowired
    private HamletRepository hamletRepository;

    @Autowired
    private HouseholdRepository householdRepository;

    @BeforeEach
    void initTest() {
        if (hamletRepository.count() == 0) {
            Hamlet h = new Hamlet();
            h.setCode("27592-BACLAN");
            h.setName("Bắc Lân");
            h.setUnitType("HAMLET");
            h.setFullName("Ấp Bắc Lân");
            h.setCommuneId(1L);
            h.setSortOrder(1);
            h.setNameNormalized("bac lan");
            hamletRepository.save(h);
        }
    }

    @Test
    @Transactional
    void getHamletsShouldReturnActiveHamlets() throws Exception {
        restMockMvc
            .perform(get("/api/administrative-units/hamlets?communeId=1").accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());
    }

    @Test
    @Transactional
    void getCommunesShouldReturnActiveCommunes() throws Exception {
        restMockMvc
            .perform(get("/api/administrative-units/communes?provinceId=1").accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());
    }
}
