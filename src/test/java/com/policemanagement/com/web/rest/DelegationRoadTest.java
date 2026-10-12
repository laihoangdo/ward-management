package com.policemanagement.com.web.rest;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.policemanagement.com.service.HouseholdQueryService;
import com.policemanagement.com.service.dto.HamletDTO;
import com.policemanagement.com.service.dto.HouseholdDTO;
import com.policemanagement.com.service.rbac.RbacService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;

class DelegationRoadTest {

    @Test
    void derivesDistinctRoadsFromScopedHouseholdQuery() {
        var rbac = mock(RbacService.class);
        var query = mock(HouseholdQueryService.class);
        var area = new HamletDTO();
        area.setId(7L);
        var house = new HouseholdDTO();
        house.setHamletId(7L);
        house.setStreet("Actual street");
        house.setAlley("Actual alley");
        var unassigned = new HouseholdDTO();
        unassigned.setStreet("Unassigned street");
        when(query.findByCriteria(any(), any())).thenReturn(new PageImpl<>(List.of(house, house, unassigned)));
        var result = new RbacResource(rbac, null, query, null).delegationRoads();
        assertEquals(
            List.of(new RbacResource.DelegationRoad(7L, "Actual alley"), new RbacResource.DelegationRoad(7L, "Actual street")),
            result
        );
        verify(rbac).current();
        verify(query).findByCriteria(any(), any());
    }
}
