package com.policemanagement.com.config;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class RuntimeDatabaseConfigurationTest {

    @Test
    void refusesLiquibaseBeforeOpeningConnection() {
        var source = mock(DataSource.class);
        var guard = new RuntimeDatabaseConfiguration().runtimeDatabaseGuard(source, new MockEnvironment());
        assertThrows(IllegalStateException.class, guard::afterPropertiesSet);
        verifyNoInteractions(source);
    }

    @Test
    void refusesAdministrativeConnectionAndClosesResources() throws Exception {
        checkConnection(false);
    }

    @Test
    void acceptsRestrictedConnectionAndClosesResources() throws Exception {
        checkConnection(true);
    }

    private void checkConnection(boolean restricted) throws Exception {
        var source = mock(DataSource.class);
        var connection = mock(Connection.class);
        var statement = mock(Statement.class);
        var result = mock(ResultSet.class);
        when(source.getConnection()).thenReturn(connection);
        when(connection.createStatement()).thenReturn(statement);
        when(statement.executeQuery(anyString())).thenReturn(result);
        when(result.next()).thenReturn(true);
        when(result.getBoolean(1)).thenReturn(restricted);
        var guard = new RuntimeDatabaseConfiguration().runtimeDatabaseGuard(
            source,
            new MockEnvironment().withProperty("spring.liquibase.enabled", "false")
        );
        if (restricted) assertDoesNotThrow(guard::afterPropertiesSet);
        else assertThrows(IllegalStateException.class, guard::afterPropertiesSet);
        verify(result).close();
        verify(statement).close();
        verify(connection).close();
    }
}
