package com.policemanagement.com.service;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

@EnabledIfEnvironmentVariable(named = "RUN_POSTGIS_DB_TESTS", matches = "true")
class PostgisSpatialPostgresTest {

    private JdbcTemplate db;
    private PostgisSpatialService spatial;

    @BeforeEach
    void setup() {
        String database = System.getenv("POSTGIS_TEST_DATABASE");
        assertNotNull(database);
        assertTrue(database.matches("tc2_restore_[A-Za-z0-9_]+"));
        var source = new DriverManagerDataSource("jdbc:postgresql://localhost:5433/" + database, "Monolithic", "");
        db = new JdbcTemplate(source);
        assertEquals(database, db.queryForObject("select current_database()", String.class));
        spatial = new PostgisSpatialService(db, new ObjectMapper(), true);
    }

    @Test
    void allSourcePolygonsHaveValidWgs84Projections() {
        assertEquals(
            0L,
            db.queryForObject(
                "select count(*) from hamlet where boundary_geo_json is not null and (boundary_geom is null or not ST_IsValid(boundary_geom) or ST_SRID(boundary_geom)<>4326)",
                Long.class
            )
        );
        assertEquals(
            0L,
            db.queryForObject(
                "select count(*) from gis_field_building where footprint_geom is null or not ST_IsValid(footprint_geom) or ST_SRID(footprint_geom)<>4326",
                Long.class
            )
        );
        assertEquals(
            0L,
            db.queryForObject(
                "select count(*) from household where location_geom is not null and (ST_X(location_geom)<>longitude or ST_Y(location_geom)<>latitude)",
                Long.class
            )
        );
    }

    @Test
    void coverageHonorsHolesAndWholeFootprintInsteadOfVertices() {
        assertFalse(
            db.queryForObject(
                """
                select ST_Covers(ST_GeomFromText('POLYGON((0 0,10 0,10 10,0 10,0 0),(4 4,6 4,6 6,4 6,4 4))',4326),
                  ST_GeomFromText('POLYGON((3 3,7 3,7 7,3 7,3 3))',4326))
                """,
                Boolean.class
            )
        );
        assertTrue(
            db.queryForObject(
                """
                select ST_Covers(ST_UnaryUnion(ST_Collect(ST_GeomFromText('POLYGON((0 0,1 0,1 1,0 1,0 0))',4326),
                  ST_GeomFromText('POLYGON((1 0,2 0,2 1,1 1,1 0))',4326))),
                  ST_GeomFromText('POLYGON((0.5 0.2,1.5 0.2,1.5 0.8,0.5 0.8,0.5 0.2))',4326))
                """,
                Boolean.class
            )
        );
    }

    @Test
    void serviceUsesActualBoundaryAndViewport() {
        var row = db.queryForMap("select id,boundary_geo_json from hamlet where boundary_geom is not null order by id limit 1");
        assertTrue(
            spatial.covered(
                new ObjectMapper().readTree(row.get("boundary_geo_json").toString()),
                List.of(((Number) row.get("id")).longValue())
            )
        );
        assertFalse(spatial.covered(new ObjectMapper().readTree(row.get("boundary_geo_json").toString()), List.of()));
        assertEquals(
            db.queryForObject("select count(*) from gis_field_building", Integer.class),
            spatial.viewport(-180, -90, 180, 90).size()
        );
        assertTrue(spatial.viewport(-10, -10, -9, -9).isEmpty());
    }

    @Test
    void derivedGeometryUpdatesAndInvalidSourceIsRejectedWithoutRepair() {
        var tx = new TransactionTemplate(new DataSourceTransactionManager(db.getDataSource()));
        tx.executeWithoutResult(status -> {
            db.execute(
                "create temporary table spatial_fixture(source jsonb,geom geometry(MultiPolygon,4326) generated always as(public.gis_polygon(source)) stored) on commit drop"
            );
            db.update(
                "insert into spatial_fixture(source) values(?::jsonb)",
                "{\"type\":\"Polygon\",\"coordinates\":[[[0,0],[1,0],[1,1],[0,0]]]}"
            );
            assertEquals(1.0, db.queryForObject("select ST_XMax(Box3D(geom)) from spatial_fixture", Double.class));
            db.update("update spatial_fixture set source=?::jsonb", "{\"type\":\"Polygon\",\"coordinates\":[[[0,0],[2,0],[2,1],[0,0]]]}");
            assertEquals(2.0, db.queryForObject("select ST_XMax(Box3D(geom)) from spatial_fixture", Double.class));
            assertThrows(Exception.class, () ->
                db.update(
                    "update spatial_fixture set source=?::jsonb",
                    "{\"type\":\"Polygon\",\"coordinates\":[[[0,0],[2,2],[2,0],[0,2],[0,0]]]}"
                )
            );
            status.setRollbackOnly();
        });
    }

    @Test
    void spatialIndexIsUsable() {
        var tx = new TransactionTemplate(new DataSourceTransactionManager(db.getDataSource()));
        tx.executeWithoutResult(status -> {
            db.execute("set local enable_seqscan=off");
            String plan = String.join(
                "\n",
                db.queryForList(
                    "explain select id from gis_field_building where ST_Intersects(footprint_geom,ST_MakeEnvelope(106.5,10.8,106.51,10.81,4326))",
                    String.class
                )
            );
            assertTrue(plan.contains("ix_field_building_footprint_geom"));
            status.setRollbackOnly();
        });
    }

    @Test
    void generatedFunctionWorksWithPgRestoreEmptySearchPath() {
        var tx = new TransactionTemplate(new DataSourceTransactionManager(db.getDataSource()));
        tx.executeWithoutResult(status -> {
            db.execute("set local search_path=''");
            assertTrue(
                db.queryForObject(
                    "select public.ST_IsValid(public.gis_polygon(?::jsonb))",
                    Boolean.class,
                    "{\"type\":\"Polygon\",\"coordinates\":[[[0,0],[1,0],[1,1],[0,0]]]}"
                )
            );
            status.setRollbackOnly();
        });
    }
}
