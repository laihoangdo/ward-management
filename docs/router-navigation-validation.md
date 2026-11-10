# URL navigation audit — 2026-11-02

## Findings and changes

The top-level application already uses React Router, but dashboard menus, roster selection/editing and administration hub sections were React state only. A reload lost those screens and browser Back did not undo those selections.

The dashboard and roster now read navigable state from the URL. Navigation uses React Router (not raw `history.pushState`), combines same-action query updates into one history entry, preserves unrelated query parameters and avoids adding history entries for URL normalization.

| Area | URL contract |
| --- | --- |
| Dashboard, including `/gis-dashboard` alias | `?tab=overview`, `area-map`, `advanced-map`, `field-3d-map`, `bando-3d`, `households`, `residents`, `documents`, `areas`, `logs`, `settings`, `superadmin-hub`, `subadmin-delegation` |
| GIS household detail | `?tab=area-map&gisHousehold=<numeric GIS ID>`; loads full detail through the existing authorized API, independently of the map/list page |
| Household roster detail | `?tab=households&household=<roster UUID>` |
| GIS → roster mapping | `?tab=households&legacyHousehold=<numeric GIS ID>`; uses the existing mapping endpoint, never address matching |
| Household edit | Add `&edit=true`; closing the editor removes edit mode from the URL |
| Resident detail | `?tab=residents&resident=<roster UUID>`; optional `household=<UUID>` preserves the parent-household context |
| Roster pagination | `&page=2` (one-based URL, zero-based API); invalid/nonpositive page values fall back to the first page |
| Embedded roster subpages | `?tab=households&rosterTab=import`, `map`, `history` |
| Import collection | `?tab=households&rosterTab=import&collection=<UUID>` |
| Standalone roster | `/roster?tab=households`, `residents`, `import`, `map`, `history`, with the same record/page parameters |
| Administration hub | `?tab=superadmin-hub&section=menus`, `hcm-units`, `users`, `whitelist`, `security` |
| JHipster administration | Existing `/admin/health`, `/admin/metrics`, `/admin/configuration`, `/admin/logs`, `/admin/docs` remain router paths |
| JHipster entities | Existing area-zone, document-record, security-alert and patrol-log nested routers remain unchanged |

`/household/*` and `/resident/*` remain legacy roster entry aliases. This change does not reinterpret old numeric resident IDs as roster UUIDs or introduce new backend ID mappings; use the query contracts above for record-level links.

## Preservation and boundaries

- Menu access is checked before rendering a requested dashboard tab. Unknown/inaccessible tabs fall back to an available menu with a replace navigation. Direct record URLs still go through backend authorization/territory checks.
- A failed/missing/unauthorized record request is reported; an unrelated household is never substituted. Abort/request guards prevent a late response from replacing a newer selection.
- Menu changes clear record-specific query keys. Closing details removes their keys. Back/Forward restores the URL-selected detail rather than a stale local target.
- Map rendering, building persistence, filters, screenshots and editing limits are unchanged. Only menu/household navigation is router-backed; viewport orientation/zoom, map editing drafts and transient capture/OCR/add dialogs are not serialized.
- Search strings, CCCD/identity numbers, names, addresses, credentials and unsaved form values are **not** written to URLs. Local search/filter state and draft-only dialogs are not promised to survive reload. The selected household is loaded afresh, not restored from browser storage.
- Existing entity path routers were inspected, not comprehensively exercised against live backend data. No real household data was used by browser fixtures, and no save/import mutation was executed in browser checks.

## Validation

- TypeScript: PASS.
- Production build: PASS (`target/router-validation-build`); existing chunk-size/dynamic-import warnings remain.
- Targeted routing/roster/modal/server-paging suite: **23/23 PASS**.
- Full frontend: **386/388 PASS**. Only the two previously known service tests fail: `operationalLoading.spec.ts`, `overviewDemographics.spec.ts`.
- Chrome fixtures: menu → household detail → edit → browser Back → Back → Forward; menu → resident detail → close: PASS, no runtime errors.
- Independent Chrome navigation directly to a household edit URL: PASS, correct detail and form restored without prior list selection.
- Fixtures: `target/router-navigation-smoke.html`, `target/router-navigation-smoke-entry.mjs`, using synthetic IDs/data and local API adapters only. These exercise the shared routing helper and real roster components; they do not represent an authenticated end-to-end test of every dashboard menu or live RBAC policy.
