# Release source cleanup — 2026-11-03

## Scope and database decision

The existing database and its data must be retained. This cleanup therefore consolidates the **database entry point**, not applied migration contents. `config/liquibase/master.xml` remains the authoritative schema/upgrade order.

Do not concatenate/rewrite applied SQL/XML changesets, remove their referenced CSV/data resources, clear Liquibase checksums, reset the database or replay old seed scripts. Those operations would break migration history and can destroy real records. No applied migration was modified in this cleanup.

## Unified database commands

```sh
npm run db:status
npm run db:migrate
```

- `db:status` checks pending migrations without applying schema/application-data changes.
- `db:migrate` explicitly applies only pending changes through the existing Liquibase master, for an existing or empty target database. Review pending migrations and take a verified backup first.
- Local defaults come only from ignored `.rbac/active-database.json`. Missing metadata fails closed rather than falling back to the legacy port 5432 cluster.
- Other environments must supply an explicit target, for example:

```sh
npm run db:status -- --url jdbc:postgresql://localhost:5433/Monolithic
npm run db:migrate -- --url jdbc:postgresql://localhost:5433/Monolithic
```

Use the existing Maven migration-account configuration / secure Maven environment configuration for credentials; never commit passwords or put credentials in the URL. The runtime role is deliberately not a schema owner. Resources are refreshed and frontend installation/build is skipped by these database commands.

### SQL / operation ownership

| Files                                                                                                | Release handling                                                                                                                            |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/main/resources/config/liquibase/master.xml`, `changelog/*`, referenced `sql/*` / `data/*` / CSV | Keep immutable history; execute only through the unified commands                                                                           |
| `scripts/database-runtime-role.sql`, `setup-database-runtime.ps1`                                    | Keep separate explicit **one-time role provisioning**; not an init-table script and must not rotate/recreate an existing role automatically |
| `scripts/test-database-integrity.sql`, `test-database-runtime-role.sql`                              | Keep database verification tests; not schema initialization                                                                                 |
| `data/tc2_household_import/import_households.sql`, `rollback_import.sql`                             | Keep source/import recovery artifacts; never run as general schema initialization                                                           |
| PostGIS activation/restore, roster backup/import/restore tools                                       | Keep separate maintenance operations; never silently invoke from migrations                                                                 |
| Removed legacy `seed_ancillary_data.{cjs,sql}`                                                       | Unreferenced destructive sample-data seeders (contained DELETEs); not valid release initialization                                          |
| Removed `generate_badiem_data.cjs`                                                                   | Unreferenced fictional resident/household CSV generator; historical migration resources are retained unchanged                              |

## Proven unused source removed

- `gis/data/initialAuthData.ts`, `initialAuditLogs.ts`: runtime no longer imports them. The remaining sidebar test now uses the real product menu definitions from `defaultMenus.ts` rather than an old sample dataset.
- `gis/HouseholdSearchSelect.tsx`: unreferenced duplicate. `gis/components/HouseholdSearchSelect.tsx`, which is used by resident forms, is retained.
- `App.tsx` unused `handleHouseholdUpdated`: no call sites; the active persisted-update/OCR flow is retained. The unused version also contained an incorrect success message on failure.
- Unused icons/imports, unused camera/support state and unused local OCR computations. Camera request/stream cleanup, permission error messages and upload paths are retained.
- Legacy editor grid state with no reads/writes and a leave-dialog branch that could never open (`isConfirmLeaveOpen` initialized false and only ever set false; `pendingTab` never set). This does **not** add a navigation/unsaved-changes guarantee the editor did not previously implement.
- Unused callback parameters retained where needed for callback/service signature compatibility are explicitly underscore-prefixed; no server paging semantics changed.

`npm run source:check` checks TypeScript with `noUnusedLocals` and `noUnusedParameters` as a repeatable cleanup gate. This catches unused bindings, **not** every unused export, asset or reflectively loaded Java class.

## Regression-test contract correction

An existing document-loading test expected `EXPIRED` from an unlinked legacy status string with no confirmed expiry. The runtime deliberately treats that record as unverified. The test now checks that existing contract, and an additional test checks that a linked record with a confirmed past expiry is expired even when its legacy label says VALID. Runtime document lifecycle code was not changed to make tests pass.

## Release gates

```sh
npm run source:check
npm run db:command:test
node node_modules/vitest/vitest.mjs run --coverage.enabled=false
npm run webapp:build:prod
```

Backend packaging / unit verification continues using Maven. Database command tests do not connect to or mutate a database. Inspect the release validation results before considering this a release approval.

## Deliberately not removed

Imported GIS/GeoJSON/raster assets, OCR models, active components, backend endpoints, tests, backup/restore tools, schema history and administrative reference/import data remain. Runtime and migration credentials remain in ignored local configuration; no VPS deployment, data reset or production migration is part of this cleanup.

Historical documents under `docs/audit/` described earlier snapshots and were not runtime dependencies. Their deletion appeared externally in the working tree during this task; it was not performed or reverted by this cleanup. Those deletions should be reviewed separately before committing.

## Validation results

- TypeScript including unused locals/parameters: PASS (baseline had 73 unused-binding diagnostics; no such diagnostics remain).
- Full frontend: **403/403 tests PASS** on 75 files. The document contract correction is documented above; runtime lifecycle semantics were not changed.
- Database command tests: **2/2 PASS**; new command files ESLint: PASS.
- Frontend production build: PASS (`target/release-validation-build`).
- Backend JAR packaging: PASS with **7/7 targeted tests**, covering menu initialization/removal, inspection-photo authorization/validation and recorded demographics. This was not a run of the full backend integration suite.
- Unified `db:status`: PASS against the active PostGIS database at port 5433, **up to date**. No `db:migrate`, provisioning, reset, rollback or seed command was run during this cleanup. `git diff` confirms no changes under `src/main/resources/config/liquibase`.
- Browser synthetic roster navigation/detail/edit/Back/Forward: PASS, no runtime errors.
- Browser field map: PASS with 79,109 imported footprints, attribute edit through fixture API adapters, shared canvas, original picking/draw controls, native fallback, no render errors. The first run was interrupted by browser target navigation/closure; a repeat completed successfully. No live household or geometry records were mutated.

Remaining release review items: existing frontend chunk-size / ineffective dynamic-import warnings, Maven dependency-convergence warnings (`com.typesafe:config`, `commons-text`), Mockito dynamic-agent warnings and stale JaCoCo execution-data warnings. These were not suppressed or treated as proof of a clean release.

Unit/build checks and synthetic browser fixtures reduce regression risk but do not prove every live-user role, hardware/camera or production deployment combination works. Live staging smoke testing and a verified backup remain required before release.
