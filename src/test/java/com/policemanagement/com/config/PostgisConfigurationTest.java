package com.policemanagement.com.config;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;

class PostgisConfigurationTest {

    @Test
    void refusesIncompleteOrUnsafeSpatialSchema() throws Exception {
        verifyGuard(false);
    }

    @Test
    void acceptsReviewedSpatialSchema() throws Exception {
        verifyGuard(true);
    }

    private void verifyGuard(boolean complete) throws Exception {
        var source = mock(DataSource.class);
        var connection = mock(Connection.class);
        var statement = mock(Statement.class);
        var rows = mock(ResultSet.class);
        when(source.getConnection()).thenReturn(connection);
        when(connection.createStatement()).thenReturn(statement);
        when(statement.executeQuery(anyString())).thenReturn(rows);
        when(rows.next()).thenReturn(true);
        when(rows.getBoolean(1)).thenReturn(complete);
        var guard = new PostgisConfiguration().postgisSchemaGuard(source);
        if (complete) assertDoesNotThrow(guard::afterPropertiesSet);
        else assertThrows(IllegalStateException.class, guard::afterPropertiesSet);
        verify(rows).close();
        verify(statement).close();
        verify(connection).close();
    }
}
