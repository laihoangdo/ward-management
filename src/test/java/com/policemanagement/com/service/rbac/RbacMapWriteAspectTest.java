package com.policemanagement.com.service.rbac;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.policemanagement.com.service.dto.HamletDTO;
import com.policemanagement.com.service.dto.HouseholdDTO;
import com.policemanagement.com.service.impl.HamletServiceImpl;
import com.policemanagement.com.service.impl.HouseholdServiceImpl;
import java.util.List;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.Signature;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

class RbacMapWriteAspectTest {

    private ProceedingJoinPoint call(Object target, String name, Object dto) {
        var point = mock(ProceedingJoinPoint.class);
        var signature = mock(Signature.class);
        when(point.getTarget()).thenReturn(target);
        when(point.getSignature()).thenReturn(signature);
        when(signature.getName()).thenReturn(name);
        when(point.getArgs()).thenReturn(new Object[] { dto });
        return point;
    }

    @Test
    void creatingHouseholdOutsideTerritoryNeverReachesTheService() throws Throwable {
        var rbac = mock(RbacService.class);
        var manager = mock(PlatformTransactionManager.class);
        when(manager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        var dto = new HouseholdDTO();
        dto.setHamletId(10L);
        dto.setLatitude(20.0);
        dto.setLongitude(110.0);
        var point = call(mock(HouseholdServiceImpl.class), "save", dto);
        doThrow(new AccessDeniedException("outside")).when(rbac).mapCoordinate(20.0, 110.0);
        assertThrows(AccessDeniedException.class, () -> new RbacBusinessAspect(rbac, manager).protect(point));
        verify(point, never()).proceed();
        verify(rbac).area(10L);
    }

    @Test
    void streetPermissionCannotExpandTheHamletBoundary() throws Throwable {
        var rbac = mock(RbacService.class);
        var db = mock(JdbcTemplate.class);
        when(rbac.database()).thenReturn(db);
        var manager = mock(PlatformTransactionManager.class);
        when(manager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        var dto = new HamletDTO();
        dto.setId(10L);
        dto.setBoundaryGeoJson("expanded boundary");
        when(db.queryForList(anyString(), eq(String.class), nullable(Long.class))).thenReturn(List.of("original boundary"));
        var point = call(mock(HamletServiceImpl.class), "partialUpdate", dto);
        doThrow(new AccessDeniedException("only superadmin")).when(rbac).superadmin();
        assertThrows(AccessDeniedException.class, () -> new RbacBusinessAspect(rbac, manager).protect(point));
        verify(point, never()).proceed();
    }
}
