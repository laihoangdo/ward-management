package com.policemanagement.com.web.rest;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.policemanagement.com.service.rbac.RbacService;
import java.sql.Connection;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

class MenuCatalogTransactionTest {

    @Test
    void initializesMenusInAnIndependentWriteTransactionInsideReadOnlyCaller() throws Exception {
        var source = mock(DataSource.class);
        var outerConnection = mock(Connection.class);
        var writeConnection = mock(Connection.class);
        when(source.getConnection()).thenReturn(outerConnection, writeConnection);
        when(outerConnection.getAutoCommit()).thenReturn(true);
        when(writeConnection.getAutoCommit()).thenReturn(true);
        var manager = new DataSourceTransactionManager(source);
        var jdbc = mock(JdbcTemplate.class);
        var rbac = mock(RbacService.class);
        when(rbac.database()).thenReturn(jdbc);
        when(rbac.encode(any())).thenReturn("{}");
        when(jdbc.update(anyString(), anyString(), anyString())).thenAnswer(invocation -> {
            assertTrue(TransactionSynchronizationManager.isActualTransactionActive());
            assertFalse(TransactionSynchronizationManager.isCurrentTransactionReadOnly());
            return 1;
        });
        var factory = new ProxyFactory(new MenuCatalog(rbac));
        factory.addAdvice(new TransactionInterceptor(manager, new AnnotationTransactionAttributeSource()));
        var catalog = (MenuCatalog) factory.getProxy();
        var outer = new TransactionTemplate(manager);
        outer.setReadOnly(true);
        outer.executeWithoutResult(status -> {
            assertTrue(TransactionSynchronizationManager.isCurrentTransactionReadOnly());
            catalog.initialize();
            assertTrue(TransactionSynchronizationManager.isCurrentTransactionReadOnly());
        });
        verify(jdbc, times(MenuCatalog.IDS.size())).update(anyString(), anyString(), anyString());
        verify(writeConnection).commit();
        verify(outerConnection).setReadOnly(true);
        assertFalse(TransactionSynchronizationManager.isActualTransactionActive());
    }
}
