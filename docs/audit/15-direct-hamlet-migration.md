# Direct hamlet assignments ? 2026-10-12

The area_zone bridge is retired. Official administrative hamlet IDs are the authority for staff assignments, household scope, resident scope and supervised record scope. rbac_assignment.hamlet_id references hamlet directly. Household keeps its existing hamlet_id; its administrativeHamlet relation is read-only and incoming relation objects cannot override the scalar ID. Missing/retired administrative IDs and old areaZoneIds delegation payloads are rejected before assignment writes. Role hierarchy, scope subset, street restrictions, feature permissions, optimistic versions and audit remain enforced.

## Data migration

Incremental Liquibase changeset 20261014000000-1 transfers officer_in_charge, officer_phone, population_count, household_count and boundary_geo_json to hamlet. It converts assignments and GIS-building references, rekeys unit settings, removes household.area_zone_id and gis_building.area_zone_id, then drops area_zone. Historical migrations remain for fresh-database replay. Checks abort transactionally on unmapped areas, duplicate hamlet mappings, conflicting household IDs, assignment-count loss or unmapped unit settings. Foreign keys preserve reference integrity. Profile versions advance for existing assignments so stale forms must reload.

The old bridge changeset's recorded checksum differed from the current source. Its verified historical checksum 9:2d7c74fefbbc42217d934297aafd6def is explicitly accepted via validCheckSum; its SQL was not rewritten and no blanket checksum reset/ANY whitelist was used.

## Executed verification

- SQL rehearsal on a database cloned from the actual local database.
- Actual application + Liquibase startup on a second clone; new changeset registered EXECUTED.
- Local live Monolithic database migration registered EXECUTED; application health on port 8080 reports UP.
- Migration-time counts: 51 hamlets, 362 households, 2 staff assignments; zero orphan assignments; area_zone absent and no area_zone_id column in household, rbac_assignment or gis_building.
- A subsequent check while the user application remained active found 3 current assignments; both original assignments remain present and all current references are valid.
- Full-row hashes match the rehearsal for admin_province, admin_commune, hamlet, household, resident, document_record, security_alert, patrol_log, gis_map, gis_map_layer, gis_map_source, gis_road, gis_building, gis_building_type, rbac_assignment and rbac_record_scope. No actual new delegation or permissions were granted during validation.
- Maven unit tests: 36 suites / 114 tests, no failures or errors.
- Vitest: 30 suites / 208 tests, no failures. Includes native hamlet-ID roundtrip and delegation road filtering.
- Root TypeScript check and Vite build pass. Existing bundle-size warnings remain.
- Java auto-build remains enabled. Temporary validation application processes were stopped; the user's application was preserved.

## Compatibility and regeneration

Existing /area-zone UI routes and Redux names are retained for other menus. The entity reducer calls /api/hamlets. /api/area-zones is a compatibility alias of HamletResource, backed exclusively by hamlet; it does not map old area IDs to hamlet IDs. /api/rbac/areas likewise reads hamlet directly. Refresh open frontend pages to load the new hamletIds contract. Generated household forms submit hamletId and display the native administrative relation.

The shared Hamlet DTO includes administrative identity, commune, dates and business fields. Existing legacy PUT payloads preserve omitted administrative metadata; management-unit settings update business fields without renaming official administrative units. New administrative units require their actual communeId, unitType, fullName and nameNormalized. JDL/entity metadata uses Hamlet. Legacy fake area seeding has been removed while the remaining ancillary seed sections are preserved (they were not executed).

## Backup and limitations

Pre-migration local backup: backups/hamlet-direct-20261012/Monolithic-before.sql, excluded from Git because it contains private application data. Restore it into an isolated database for recovery; do not overwrite the current database casually. A rollback requires the matching pre-migration application sources as well as the database backup. Additional rehearsal databases hamlet_direct_audit and hamlet_liquibase_audit remain available for inspection.

No authenticated browser acceptance test or full backend integration-test suite was executed in this step. The delegation-road endpoint still derives available names from scoped household records; it cannot invent roads absent from those records. Populations/boundary values were preserved as supplied, not independently verified.
