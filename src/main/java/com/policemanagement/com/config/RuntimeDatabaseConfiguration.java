package com.policemanagement.com.config;

import javax.sql.DataSource;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;

/** Fail closed if external configuration accidentally restores an administrative connection. */
@Configuration
@Profile("db-runtime")
public class RuntimeDatabaseConfiguration {

    @Bean
    InitializingBean runtimeDatabaseGuard(DataSource dataSource, Environment environment) {
        return () -> {
            if (environment.getProperty("spring.liquibase.enabled", Boolean.class, true)) {
                throw new IllegalStateException("db-runtime requires separate migrations: Liquibase must be disabled");
            }
            try (
                var connection = dataSource.getConnection();
                var statement = connection.createStatement();
                var result = statement.executeQuery(
                    """
                    select current_user='police_runtime' and not (rolsuper or rolcreatedb or rolcreaterole or rolbypassrls)
                      and not has_schema_privilege(current_user,'public','CREATE')
                      and not has_schema_privilege(current_user,'tc2_roster','CREATE')
                      and not has_table_privilege(current_user,'public.databasechangelog','UPDATE')
                      and not has_table_privilege(current_user,'tc2_roster.change_event','UPDATE')
                      and not has_table_privilege(current_user,'tc2_roster.change_event','DELETE')
                    from pg_roles where rolname=current_user
                    """
                )
            ) {
                if (!result.next() || !result.getBoolean(1)) {
                    throw new IllegalStateException("db-runtime requires the restricted police_runtime database role");
                }
            }
        };
    }
}
