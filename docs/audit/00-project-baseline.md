> Historical snapshot: VietMap Compare and its unused Blender pipeline were subsequently removed. See `18-remove-vietmap-pipeline.md` for current status.

# Project baseline — 2026-10-11

For final integration attempts and post-implementation checks, see [execution results](05-execution-results.md); early discovery results below are retained as the baseline.

## Scope and confidence

Source-based first audit of the current working tree, including untracked RBAC and GIS work. Runtime business correctness is not established. No application source edits, cleanup, commits, database mutations, or deployment were requested during discovery. No AGENTS.md was found by workspace file discovery. This report distinguishes successful compilation from functioning workflows.

## Stack and architecture

`pom.xml`: Java target 21, Spring Boot 4.1.1, JHipster 9.4.0, Maven wrapper, Spring MVC/Security, OAuth2 client/resource server, Hibernate/JPA, PostgreSQL, Liquibase, MapStruct, Caffeine, Actuator, mail, Jib. `package.json`: React 19.3.0, TypeScript 6.0.3, Vite 8.3.0, Redux Toolkit, React Router, Bootstrap/Tailwind, MapLibre/Leaflet/Three, Tesseract English/Vietnamese OCR. Firebase dependency and initialization code remain, but active authentication is backend OIDC and `authService.ts` reexports server RBAC APIs.

Monolith entry: `src/main/java/com/policemanagement/com/MonolithicApp.java`; servlet entry: `ApplicationWebXml.java`. Browser entry: `src/main/webapp/index.html` → `app/index.tsx` → `app/app.tsx`. `app/routes.tsx` lazily loads `gis/App.tsx` at `/dashboard` and `/gis-dashboard`; generated entity routes require ROLE_USER; `/admin/*` requires ROLE_ADMIN. GIS dashboard additionally fetches `/api/rbac/me` before rendering.

REST controllers → DTO/service/query layers → JPA repositories, plus JDBC-backed RBAC and GIS presentation configuration. `RbacBusinessAspect` protects services through AOP; query services add territorial specifications. PostgreSQL migrations include households, residents, area zones, documents, security alerts, patrol logs, spatial GIS/PostGIS foundations, and RBAC. Household has residents and an area-zone relation. Spatial model declarations do not establish a functioning database-backed 3D editing workflow.

## Repository map

| Path                                  | Purpose                                                               |
| ------------------------------------- | --------------------------------------------------------------------- |
| `src/main/java`                       | Entry, security/configuration, entities, repositories, services, REST |
| `src/main/resources`                  | Profiles, localization, templates, Liquibase schemas/data             |
| `src/main/webapp/app/entities`        | Generated CRUD UI and reducers                                        |
| `src/main/webapp/app/gis/components`  | Active GIS dashboard screens                                          |
| `src/main/webapp/app/gis/*.tsx`       | Dashboard entry plus suspected older duplicate screens                |
| `src/test/java`, `src/test/resources` | JUnit unit/integration tests, PostgreSQL Testcontainers               |
| `src/main/docker`                     | Application, PostgreSQL, Keycloak realm/themes, monitoring            |
| `scripts`, `data`, `content/models`   | GIS conversion/generation, source datasets, GLB assets                |
| `.jhipster`, JDL, `.yo-rc.json`       | Generator definitions; preserve regeneration inputs                   |
| `.mvn`, wrappers                      | Reproducible Maven bootstrap                                          |
| `.github`                             | Repository metadata; no workflows directory discovered                |
| `target`, `node_modules`              | Existing generated build/dependency trees                             |
| `.rbac`                               | Ignored local RBAC state; contents not disclosed                      |

## Environment and working tree

Detected Node 24.18.0 (below package engine >=24.21.0), Java 23.0.1 (compiles target 21), Maven wrapper 3.9.16, Docker server 27.2.0; npm available through npm.cmd. PowerShell blocks npm.ps1/npx.ps1: use `.cmd`, do not change machine policy. PostgreSQL and Keycloak containers are running on loopback ports 5432 and 9080. Read-only health probes at 8080, 8081 and 9000 found no server. Existing container data is not assumed disposable; application startup could execute Liquibase against it.

Profiles require PostgreSQL connection settings and OIDC issuer/client registration; Keycloak admin integration also requires its configured admin connection. Vite serves 9000 and proxies backend paths to 8080. See `application-dev.yml`, `application-prod.yml`, `application-secret-samples.yml`, `ApplicationProperties.java`, and `KeycloakAdminClient.java`; do not copy sample credentials into tests. Firebase config is ignored and example templates exist. VietMap uses a source-defined API key in `components/VietMapCompareTab.tsx`; value deliberately omitted. Provider ownership/restrictions require confirmation.

Initial Git status: 81 changed/untracked entries; 32 tracked changes, 858 insertions and 1149 deletions reported. Changes include configuration, query/services, dashboard, RBAC, maps, GIS data/scripts, and a pre-existing deletion of a tracked Python bytecode file. HEAD `f53c9d4` (add 3d to map), preceded by CSS/auth/OCR changes. These changes belong to the user and are preserved. See `03-working-tree-baseline.txt` for paths.

## Executed baseline

| Command                                                                            | Actual result                                                                                                      |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `node --version`, `java -version`, `.\mvnw.cmd --version`, Docker version/ps       | Available; versions above                                                                                          |
| `npm run ...`, `npx tsc --noEmit`                                                  | Initial invocation blocked by PowerShell script policy; repeated using .cmd                                        |
| Maven with unquoted dotted properties                                              | Initial invocation misparsed by PowerShell; repeated with quoted arguments                                         |
| `npm.cmd run webapp:build:dev`                                                     | PASS, 3292 modules; 38 copied assets; multiple >500 kB chunks                                                      |
| `.\mvnw.cmd -ntp '-Dskip.installnodenpm' '-Dskip.npm' '-DskipTests' compile`       | PASS, incremental: nothing to compile; not a clean compilation                                                     |
| `.\mvnw.cmd -ntp '-Dskip.installnodenpm' '-Dskip.npm' '-Dspotless.skip=true' test` | PASS, 107 tests, 0 failures/errors/skips; IT classes not run by this command                                       |
| `npx.cmd tsc --noEmit`                                                             | FAIL: missing imports, obsolete fields, enum mismatches, duplicate and active GIS code, crypto BufferSource typing |
| `npm.cmd run vitest-run -- --reporter=dot`                                         | FAIL: 12 failed / 10 passed files; 49 passed tests; failed suites cannot resolve app/* imports                     |
| `npm.cmd run lint`                                                                 | See execution addendum for completion                                                                              |

The first Maven command invoked lifecycle-bound Spotless apply; output reported zero files changed. Subsequent Maven checks explicitly skip it. Verify baseline source status before any future lifecycle command. Dependency-convergence warnings: typesafe config 1.4.7 vs 1.4.9; commons-text 1.15.0 vs 1.13.1. Ant property collisions and Mockito dynamic-agent warnings also occur. Vite transpilation success does not imply type-check success. Coverage-enabled Vitest failed; no full-coverage claim is justified.

## Existing commands and limitations

`npm.cmd run lint` and `prettier:check` are read checks; `lint:fix`, `prettier:format`, Maven Spotless apply are mutations. `start` runs Vite; `backend:start` uses Maven; Windows direct wrapper commands are more reliable than Unix-oriented npm Maven scripts. `test` runs pretest lint then coverage-enabled Vitest; direct vitest-run was used to obtain an independent baseline. `ci:e2e:*` handles packaging/services but does not provide browser specs. `scripts/test_rbac_integration.cjs` is real API integration coverage, with UUID fixtures and Keycloak mutations; not executed against existing containers. `down -v`, cleanup, clean-www and Maven clean are destructive cleanup commands and were not invoked.

Not yet verified: backend startup against an isolated database, JUnit *IT suite, authentication round trips, role/territory enforcement through real sessions, end-to-end persistence, OCR/camera/browser permissions, third-party map availability, schema upgrade compatibility, and business acceptance criteria. Explicit requirements are not sufficiently established by generator files or UI copy; inventory behavior remains inferred until confirmed.
