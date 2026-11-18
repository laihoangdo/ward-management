# Operational data source audit — 2026-11-02

## Confirmed screenshot issue

A read-only query against the active database selected by `.rbac/active-database.json` (PostGIS on port 5433) found the screenshot household and its four recorded residents. Their birth years and gender fields are stored in PostgreSQL. All four relationship fields are empty. The frontend mapper had substituted `Chủ hộ` for every empty relationship. It was not evidence that all four people are household heads.

The same database snapshot contains 1,291 households, 5,074 residents and 5,151 applied source rows. 5,073 residents have an empty relationship. Those missing relationships must be verified against the source; names, age, list order or address are not sufficient to assign a head of household.

Only aggregate values and the fields needed to confirm this issue were inspected. Resident names/identity numbers are not reproduced in this report.

## Runtime sources reviewed

| Screen / data                                          | Source and outcome                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home / login                                           | `/api/account`, authenticated identity provider; static navigation/product copy is not a business dataset                                                                                                                                                                                                                             |
| Dashboard totals and charts                            | `/api/gis/households/overview`, PostgreSQL SQL counts, scoped by RBAC. Frontend now respects the server's adult count instead of classifying every non-minor/unknown-age person as an adult                                                                                                                                           |
| GIS household lists / detail                           | `/api/households`, `/api/residents`, bounded browse/detail APIs. No browser household cache, generated roster or positive default population is used                                                                                                                                                                                  |
| Household / resident roster, sources, history, imports | `/api/roster/*`, `public.household` / `public.resident` and the linked `tc2_roster` tables/views. Existing server authorization and source-review workflow remain                                                                                                                                                                     |
| Documents                                              | `/api/document-records` and lifecycle APIs; no replacement sample documents. Missing/unverified records remain distinguishable from valid/expired legal records                                                                                                                                                                       |
| Patrol logs                                            | `/api/patrol-logs`. Removed invented IPs, badge defaults, synthetic SHA claims and current-time replacements for missing timestamps; removed duplicate log persistence in the dashboard                                                                                                                                               |
| Security alerts / chart                                | Server alert APIs/settings. Removed fixed September week / April–September month history and artificial category counts for small datasets. Timeline buckets count actual timestamps in the last seven days / six months; missing/invalid timestamps are not assigned a fictional date. No-alert resolution rate is unknown, not 100% |
| Officer / settings / delegation                        | `/api/rbac/*` and Keycloak identity/profile data. Removed sample officer name, badge, phone and assignments from the default profile. Keycloak is the authenticated identity source, not a hardcoded frontend user list                                                                                                               |
| Administrative units                                   | Server settings/delegation APIs. Removed realistic prefilled officer/hamlet/street/count samples and the 100/120-household substitution from create/import forms                                                                                                                                                                      |
| Inspection photographs                                 | Newly persisted in PostgreSQL through `/api/gis/households/{id}/inspection-photos`, not localStorage. Household detail loads the database gallery; photo failures are reported separately and do not masquerade as an empty gallery or prevent opening the resident roster                                                            |
| GIS geometry / offline map                             | Existing imported GIS geometry, boundaries and offline raster assets remain. Static geographic reference data and explicitly estimated visual materials are **not** resident identity records; renderer/geometry pipeline was preserved                                                                                               |
| Legacy superadmin 3D editor                            | Its local save is a **device-only draft**, now labelled explicitly before/after saving. It is not claimed to be a database commit. The operational field map continues using its existing permission-checked database save endpoint                                                                                                   |
| JHipster administration / entities                     | Existing server-backed REST reducers and actuator/admin endpoints remain; source audit did not find runtime sample operational datasets in those entry points                                                                                                                                                                         |

## Removed unsafe fallbacks

- Removed the generator that invented names, CCCD numbers, birth years, sex, occupation and relationships from household totals.
- Missing resident birth year, sex, relationship and residence type stay unknown. Missing sex is not mapped to male; missing residence type is not permanent residence. A business name or a word in notes is not proof of legal residence status.
- Blank ward-group/address/alley/notes/officer/check-date fields are no longer replaced with `Tổ 1`, a named street/hamlet, a current check date or a fictional officer. Zero demographic values remain zero.
- Creating an empty household no longer automatically persists a male head born in 1980.
- Viewport fallback coordinates stay marked estimated and are not written back as confirmed GPS by unrelated profile edits. The detail UI labels estimated coordinates rather than showing them as measured GPS.
- Removed the unused synthetic-building/owner/phone generator from `baDiemSpatialData.ts`; only the existing coordinate transforms remain. Existing imported footprints and native/Three.js rendering are unchanged.
- Production imports no longer reference `initialAuthData.ts` / `initialAuditLogs.ts`. These old source files are not runtime business feeds. Default **menu definitions** were isolated into `defaultMenus.ts`; they are product navigation configuration, not records or a substitute for backend access checks.
- Removed legacy localStorage business subscriptions and local-only photo/officer persistence from the compatibility `firestoreService.ts` path. The filename remains only for existing callers.

The legacy aggregate compatibility helper/test fixture was deliberately updated: it now returns only recorded aggregate fields and does not infer sex/age from owner name or house number. This is a business-correctness change required by this audit, not an attempt to preserve the old fabricated-data semantics.

## Photograph database change

- Additive Liquibase change `20261102000000_inspection_photos.xml` creates `gis_inspection_photo`, an indexed household FK, and the runtime role's required SELECT/INSERT/DELETE grants. It was the only pending changeset and has been applied successfully to the active database.
- API read/write checks household territory. Mutations additionally require `canUpdateInspection`; image metadata uses server identity/time/UUID, not caller-provided officer/id/time.
- JPEG/PNG uploads are bounded to 8 MB decoded data, checked for allowed signatures/base64/category, with captions bounded to 2,000 characters. Image-bearing DTO `toString()` methods redact image bodies from debug aspect logging. Gallery responses use `Cache-Control: no-store`.
- API errors propagate to the capture dialog. A photo is shown as saved only after the server returns the stored record. Photo add/delete no longer triggers a full household/resident-roster rewrite just to refresh the gallery.
- Existing browser-local photographs are **not automatically uploaded, deleted or migrated**. Previously stored database data is not rewritten. After migration the photo table is empty; that does not prove that a user has no old device-only images.

## Validation and limits

- Read-only database checks before/after: household/resident counts unchanged; new photo table exists, runtime permissions verified, no photo records inserted during this audit.
- TypeScript and production build: PASS (`target/database-source-validation-build`). Existing chunk-size/dynamic-import build warnings remain.
- Frontend: **401/402 tests PASS** on 75 files. Only the previously known `operationalLoading.spec.ts` document-status assertion fails; document lifecycle semantics were not weakened to satisfy it.
- Backend targeted tests: **5/5 PASS** (`GisInspectionPhotoResourceTest`, `OverviewDemographicsTest`), including server-generated identity, territory refusal, validation and household-bound deletion.
- Chrome synthetic fixture: API-loaded roster, missing relationship/year, stale browser cache ignored, no generated residents from totals, estimated GPS label: PASS, no runtime errors. Fixture: `target/recorded-data-smoke.html`; no live resident data or live-user photo mutation was used in browser tests.
- Added a source guard against runtime imports of legacy sample datasets/business caches, plus recorded-data and security-chart regression tests.

**This audit establishes and improves the code's data sources, not the factual truth of every historical database row.** Data that may have been imported, entered or saved by older code still requires provenance/history review. No existing household/person/source row was automatically corrected or deleted. Also, not every screen/permission combination was exercised end-to-end with a live authenticated session; photo CRUD was validated with backend unit tests plus the real database migration/schema checks, not by adding a photo to a real resident's record.
