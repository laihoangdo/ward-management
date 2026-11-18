package com.policemanagement.com.config;

import javax.sql.DataSource;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.DependsOn;

@Configuration
@ConditionalOnProperty(name = "gis.postgis.enabled", havingValue = "true")
public class PostgisConfiguration {

    @Bean
    @DependsOn("liquibase")
    InitializingBean postgisSchemaGuard(DataSource source) {
        return () -> {
            try (
                var connection = source.getConnection();
                var statement = connection.createStatement();
                var rows = statement.executeQuery(
                    """
                    select exists(select 1 from pg_extension where extname='postgis')
                    and exists(select 1 from information_schema.columns where table_schema='public' and table_name='hamlet' and column_name='boundary_geom')
                    and exists(select 1 from information_schema.columns where table_schema='public' and table_name='gis_field_building' and column_name='footprint_geom')
                    and to_regprocedure('public.gis_polygon(jsonb)') is not null
                    and (select count(*) from pg_proc where oid in
                        (to_regprocedure('public.gis_polygon(jsonb)'),to_regprocedure('public.sync_legacy_gis_geometry()'))
                        and 'search_path=pg_catalog, public'=any(proconfig))=2
                    and exists(select 1 from pg_indexes where schemaname='public' and indexname='ix_field_building_footprint_geom')
                    """
                )
            ) {
                if (!rows.next() || !rows.getBoolean(1)) throw new IllegalStateException(
                    "PostGIS is enabled but its reviewed schema is missing; run spatial migrations first"
                );
            }
        };
    }
}
