**Historical step:** superseded by [direct hamlet migration](15-direct-hamlet-migration.md). The bridge described below no longer exists in the current schema.

# Hamlet-authoritative assignments

Added an incremental Liquibase migration linking area_zone.hamlet_id to hamlet. Legacy areas match only exact unique active hamlet names; missing bridge areas are generated from active hamlet records using the existing sequence. Existing area IDs/assignments are retained. Area labels are synchronized from hamlet. Household area references are aligned only when their existing hamlet ID and textual hamlet name agree with the active administrative record; no guessed hamlet ID is written.

The staff assignment catalog now reads active hamlet rows joined to the area bridge, rather than the temporary area-name catalog. The UI displays administrative hamlet IDs and submits hamletIds. The server resolves valid active hamlet IDs to linked area IDs, then applies existing actor-area subset, street restriction, feature-permission, identity and optimistic version checks. areaZoneIds remain a compatibility field for existing APIs; they are not interpreted as hamlet IDs. Profiles expose administrative hamletIds derived from persisted assignments.

Province/commune selection filters the assignment list by commune ID. Unlinked legacy selections block save until the user explicitly reselects administrative hamlets, avoiding silent revocation. No automatic new permissions or staff assignments were granted. Legacy areaZoneIds input remains supported for older clients; a later API deprecation may remove it after clients transition.

Live local DB verification after the running application's migration: changelog 20261013000000-1 is registered; 51 active hamlets, 51 linked hamlets, 51 canonical areas; zero unlinked area assignments, zero unlinked areas, zero retired-hamlet assignments, zero household hamlet/area mismatches. This verifies current local data, not every future source import. Synchronization is incremental at migration time; newly added hamlets later require an explicit bridge sync operation/migration before assignment.

Validation: TypeScript passed; Vite build passed; 30 Vitest suites / 207 tests passed, including distinct hamlet ID 70 versus area ID 7 in the save payload. RbacServiceTest: 13 passed, including missing/inactive bridge rejection and denial of mapped areas outside actor scope. Existing delegation-road test also passed earlier. Initial new Java tests incorrectly attempted to mock a private method; corrected fixtures exercise the actual hierarchy check, with final tests green. git diff --check passed. No authenticated browser acceptance or real delegation save executed.

Shared area/household contracts and other menus remain in place. The area bridge preserves existing server enforcement while hamlet supplies administrative identity and selection. Do not equate numeric IDs from the two tables.
