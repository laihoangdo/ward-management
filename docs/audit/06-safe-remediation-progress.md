# Safe remediation progress

## Step 1 — Vitest import resolution (2026-10-11)

User authorized incremental safe remediation. This batch modifies only `vitest.config.ts` and adds this progress record. Existing production edits, database state, dependencies and tests/assertions are preserved. No deletion, move, rename, permission weakening or business behavior change.

Cause: Vite's application tsconfig path resolution does not cover spec files excluded from the application tsconfig. Vitest inherited that setup, leaving `app/*` imports unresolved in 12 suites. Add a test-runner-only absolute `app` alias matching the existing application path mapping; retain the production Vite configuration and test exclusions.

Verification:

- `npm.cmd exec -- vitest run --coverage=false --reporter=dot`: exit 0; 22 files, 187 tests passed.
- Direct `node node_modules/vitest/vitest.mjs run --coverage --reporter=dot`, executed through Node child-process capture: exit 0; 22 files, 187 tests passed. Capture in `target/audit-vitest-step-01-coverage.log`.
- Coverage: statements 62.04% (680/1096), branches 41.7% (171/410), functions 65.06% (190/292), lines 63.16% (643/1018). These are the files reported by the current instrumentation, not full feature or whole-codebase coverage.
- `npx.cmd prettier --check vitest.config.ts`: passed.
- `git diff --check`: passed.

First coverage invocation redirected native stderr through Windows PowerShell and returned exit 1 although Vitest reported all assertions passed. Repeated with direct Node capture to distinguish process status from PowerShell stderr handling; verified actual runner exit 0. Expected stderr from mocked offline/non-JSON health scenarios remains visible and is not suppressed.

No coverage thresholds were reduced or added. Current top-level numeric coverage options should be reviewed separately before treating them as enforced gates; this batch does not change coverage policy.

Next batch: resolve TypeScript contract errors by distinguishing active GIS code from legacy duplicate screens. Avoid deleting or excluding code merely to obtain a green typecheck. Keep each contract correction reviewable, and run affected tests/build. Authenticated E2E and integration fixture compatibility remain outstanding; Step 1 does not establish runtime security or persistence correctness.

## Step 2a — Small GIS type corrections (2026-10-11)

Changes: narrow AdvancedMapTab BaseLayerType to the two actually configured layers (osm/satellite); correct resident detail's misspelled residentType field to the existing residenceType. Both active components and their root legacy copies receive the same one-line correction; no files removed or excluded. In cryptoUtils, hexToBytes now declares Uint8Array<ArrayBuffer>, matching its actual allocation, without casts or changes to encryption/storage algorithms. Existing ResidentsTab user changes are preserved.

Added two AES-GCM regression tests using real Node WebCrypto and synthetic data: Unicode round-trip through persisted hex format without fallback, and independent IVs with successful decryption. No real credentials/personal data, key-format changes or encrypted-data migration.

Checks: all 23 suites / 189 tests passed with coverage and exit 0; Vite build passed (3292 modules; existing chunk-size warnings); new-test Prettier check and git diff --check passed. Measured reported-file coverage: statements 65.14%, branches 44.39%, functions 67.12%, lines 66.4%.

Root tsc was executed before and after and remains failing. This batch removes seven diagnostics (two layer declarations, four resident-field references, one crypto buffer annotation), from 64 to 57; no claim of a fully passing typecheck. Remaining issues include unsupported ward/city metadata, Field3D status mapping, WarningDetailModal fallback identity, legacy import/bootstrap errors and legacy residence text encoding. Investigate these contracts before changing domain types or permissions. Runtime browser acceptance remains blocked by the absent isolated backend.

## Step 2b — Legacy GIS imports and blacklist field compatibility (2026-10-11)

Corrected three root GIS type imports from nonexistent ../types to the actual ./types in AreaMapTab, LogsTab and SuperAdminHubTab. Corrected standalone main.tsx React import for classic JSX and extensionless App import. No deletion, file exclusion or weakening of type settings.

Resolving imports initially revealed hidden schema mismatches: four ward/city references in root AreaMapTab and seven old blacklist fields in root SuperAdminHubTab. Aligned blacklist display/action arguments with the existing shared interface, server adapter and active component: ipAddress, sourceAlertId, blockedBy and blockedAt. No IP-blocking backend behavior or authority changes; the pre-existing static alert banner remains a separate review item.

Verification: final Vitest run exit 0, 23 suites / 189 tests passed. Vite build passed before the final blacklist-only legacy display correction; that legacy screen is not in the active App import tree. Typecheck executed after all edits: 55 diagnostics remain versus 57 before this batch, including newly exposed ward/city errors. Intermediate count was 62 after imports exposed previously unchecked property accesses. Correct import resolution is not judged solely by a falling error count. git diff --check and main.tsx formatting check passed. Root TypeScript is still failing; runtime legacy bootstrap is not certified (it lacks the active app's provider integration).

Next: validate administrative address metadata, Field3D alert mapping and WarningDetailModal identity handling against actual service contracts. Preserve all user edits and avoid invented optional fields/fake authorities to silence errors.

## Step 2c — Field3D critical-alert display (2026-10-11)

Source evidence: mapDtoToHousehold maps backend DANGER/CRITICAL to the shared HouseholdStatus value alert; mapHouseholdToDto maps alert back to CRITICAL. Field3DMapTab instead compared danger in its building material, badge class and badge label. Those branches could not match normalized backend households. Replaced only the three comparisons with alert. Existing warning/normal/business paths and API/persistence mapping remain unchanged; no new domain enum or migration.

Added three contract tests in householdApiService.spec.ts for DANGER/CRITICAL normalization and warning/normal distinctions, including reverse DTO mapping. They validate the data contract; they do not certify rendered WebGL appearance or real browser interactions.

Checks: 24 suites / 192 tests passed, runner exit 0; Vite build passed after this correction with existing large-chunk warnings. Root tsc still exits 1, now 52 diagnostics versus 55 before this batch. New spec formatting and git diff --check passed. No files deleted, permissions changed, database writes or real E2E executed. Next priority remains removing unsupported fallback identity safely and resolving address metadata from an established source.

## Step 2d — Require actual identity for warning actions (2026-10-11)

Confirmed active App supplies its authenticated currentUser to WarningDetailModal. The resolve and quick-blacklist handlers nevertheless synthesized a named superadmin whenever the prop was absent. Removed those fallback objects in active and legacy copies. Missing identity now produces a Vietnamese sign-in-again message and returns before sending API requests; supplied identity is passed unchanged. No client role escalation or new permission rule was introduced. Server RBAC remains authoritative: rbacApiService ignores the legacy officer argument for authorization, so the previous fallback is not itself proof of a backend privilege bypass. It could misrepresent the local resolvedBy display.

Added four component cases: both missing-user actions send no request and show feedback; real supplied identity is retained; rejected backend resolution leaves the alert unresolved and does not invoke the success callback. These use mocked service responses and synthetic identities, not real OIDC/security integration.

Actual results: 25 suites / 196 tests passed, runner exit 0; frontend build passed with existing chunk warnings; root tsc still exits 1 with 48 diagnostics (52 previously). New spec formatting and git diff --check passed. An intermediate edit piped through PowerShell corrupted only the newly inserted Vietnamese message; the initial two negative tests exposed it, and the message was corrected with apply_patch before the final passing run. Existing source text was not reencoded.

No file deletion, data migration, live database write, role/policy relaxation or production credential use. Next unresolved group is administrative address fields and legacy residence string encoding. Existing hook ordering in WarningDetailModal is a separate potential issue; this batch does not certify close/reopen transitions or full browser behavior.

## Step 2e — Supported address display and legacy residence values (2026-10-11)

Verified Household entity, HouseholdDTO, frontend IHousehold and mapDtoToHousehold do not provide ward/city. Removed unsupported optional address fragments from AdvancedMapTab, AreaMapTab, InspectionCameraModal and WarningDetailModal, in active and legacy copies. Retained actual houseNumber/street/hamlet display and existing generic camera watermark. AdvancedMapTab still uses currentUser.assignedWard, otherwise its existing generic territory label. No arbitrary type fields, hardcoded municipality, migration or database changes. Older browser caches with unofficial ward/city metadata will no longer render those unsupported fragments; stored records/photos are not modified or erased. A future municipality feature needs an explicit API/schema contract.

This reduced diagnostics from 48 to 12. The last 12 were mojibake residence values in root legacy HouseholdsTab. Replaced only its three corrupted value strings with canonical strings from the existing ResidenceType declaration, preserving the type enum and current active component. No global reencoding or broad formatting.

Verification: root `node node_modules/typescript/bin/tsc --noEmit` passed, exit 0, zero diagnostics. Final Vitest run passed, 25 suites / 196 tests. Active frontend build passed after address changes (3292 modules; existing chunk warnings); subsequent legacy-only residence string correction is outside the active build tree and covered by final typecheck. Isolated E2E typecheck and git diff --check passed. Browser/user acceptance for map address display and photo watermark remains unexecuted.

The TypeScript remediation series is now green without file deletion, exclusions, ts-ignore, unsafe casts or relaxed compiler settings. Remaining priorities: establish a useful lint baseline with bounded scope, investigate integration fixture/RBAC compatibility and provision an isolated backend/IdP for real E2E. Compilation and unit/component passes do not certify runtime workflows.

## Step 3 — Read-only scoped lint and reference review

Completed ESLint checks on 197 frontend files: 619 errors / 32 warnings. The non-GIS config/shared/entities/modules scope has zero errors; GIS holds the lint debt. Additional large data/entry scope was interrupted without a result and is not counted passed. No autofix or application edit. See [lint findings](07-lint-and-reference-review.md).

Resolved static/dynamic-literal TypeScript references across 209 files and checked HTML/build/script entry strings. Found 25 root GIS screen copies outside the active entry graph, plus standalone main.tsx and Firebase initialization with no incoming imports. These remain review candidates, with exact per-file evidence in [reference inventory](08-gis-reference-inventory.md); no deletion approved or performed. Active GLB/data/provider-script references explicitly remain protected.

## Step 4 — First unused-import batch

Removed only 13 unused lucide-react named imports from active DocumentsTab (5) and LogsTab (8). Both module imports remain; state initializers, compatibility parameters, business logic, routes and assets are untouched. Services/utils warnings were reviewed first, but those concern unused parameters/local variables rather than removable icon imports; left for separate contract review.

Bounded ESLint check on these two files passed, exit 0: errors dropped from 13 to zero. Three existing date-during-render purity warnings remain (DocumentsTab 2, LogsTab 1); not suppressed or treated as fixed. Report: target/audit-lint-step04.json. No claim that the full repository lint is green.

Root tsc passed, exit 0; Vitest passed, 25 suites / 196 tests; git diff --check passed. No extra implementation-mirroring tests added for import-only edits. No database access, file deletion, broad autofix or permissions change. Next batch can remove other verified unused icon imports or inspect the AdvancedMapTab effect timeout with a lifecycle regression test.

## Step 5 — Second unused-import batch

Removed only 17 unused lucide-react named imports from active AddHouseholdModal (5), AreasTab (8), Header (1) and SettingsTab (3). Preserved existing user edits, validation, state defaults, component parameters and business logic. No files or data deleted.

Scoped ESLint errors dropped from 19 to 2 across these four files; exit 1, so this lint scope is not fully passing. AreasTab is clean. AddHouseholdModal retains the unused BADIEM_HAMLETS constant; SettingsTab retains the unused isFirestoreConnected parameter pending separate contract review. Header has zero errors and one existing date-during-render purity warning. Report: target/audit-lint-step05.json. No rules weakened or diagnostics suppressed.

Root TypeScript passed with exit 0; Vitest passed, 25 suites / 196 tests. Prettier checks for all four edited components and git diff --check passed. Import-only changes received no new implementation-mirroring tests; no frontend build or real E2E run in this batch. Full-repository lint and isolated runtime verification remain outstanding.

## Step 6 — Resize timeout lifecycle review

Inspected the active AdvancedMapTab resize effect previously flagged as missing cleanup. That earlier interpretation was incorrect: the effect collects the five timer handles (30, 100, 250, 450 and 700 ms) and returns cleanup calling timers.forEach(clearTimeout). React runs that cleanup on panel/fullscreen dependency changes and unmount. Preserved the existing implementation; no application source edit or diagnostic suppression.

Reran scoped ESLint: exit 1 with 16 errors, including the timeout rule despite the explicit cleanup. Report: target/audit-lint-advanced-map-current.json. Corrected the reference-review finding to distinguish the diagnostic from source evidence. No new test/build run for this documentation-only review; real browser lifecycle behavior remains unverified. Other event-handler timers are outside this resize-effect finding and require separate review rather than a blanket claim that all timers are safe.

## Step 7 — Coordinate notification timer replacement

Found a reproducible race in the active AdvancedMapTab coordinate notifications: an older 5-second timer could erase a newer cancel/save message before its own deadline. Added useTransientMessage and connected the three coordinate notification expiry paths. Replacing or explicitly clearing a message cancels the previous timer; unmount clears the pending timer. Preserved the existing 3/5-second durations, text, coordinate persistence and permission behavior. Legacy copy and screenshot/share timers remain unchanged.

Added three fake-timer hook regression cases covering replacement deadlines, explicit clearing/persistent replacement and unmount cancellation. Scoped lint for the new hook/test passes with zero errors/warnings; root TypeScript passes. Full Vitest passes, 26 suites / 199 tests. No browser E2E or build executed. This does not cancel in-flight coordinate saves or certify asynchronous completions after unmount; those require separate review.

## Step 8 — Screenshot share feedback timers

Connected active AdvancedMapTab screenshot/download/native-share/Zalo/Telegram/email/link feedback to useTransientMessage. Replacing or clearing feedback now cancels its earlier expiry. Preserved message text and existing 3/3.5/6-second durations. Copy confirmation uses a separate hook instance, so its expiry cannot clear a newer share message; repeated successful copies restart its 3.5-second deadline. No clipboard/share API, destination, capture, permission or storage change. Legacy copy remains unchanged.

Added two fake-timer regressions for repeated identical copy confirmation and independent copy/share expiry with unmount cleanup. Final Vitest passes, 26 suites / 201 tests; root TypeScript passes. Hook/test lint passes without errors or warnings; active AdvancedMapTab still reports 14 errors / 2 warnings (target/audit-lint-step08.json), so the component/full repository lint is not green. Test formatting and git diff --check pass. No browser E2E or build executed. In-flight asynchronous browser operations after unmount remain a separate lifecycle concern, not solved by timer cleanup.

## Step 9 — Active AdvancedMapTab lint cleanup

Removed 11 unused import bindings: nine lucide icons, InspectionPhoto type and InspectionCameraModal. Inspected the camera component before removing its import: camera operations are inside the component, with no top-level camera startup; its imported runtime modules are already directly imported by AdvancedMapTab. The camera file and other references remain intact. Converted two Array<T> declarations to equivalent T[] syntax and collapsed the hamlet span to the existing Prettier format. No component logic, contracts, assets or permissions changed.

Scoped ESLint now passes, exit 0, with zero errors and two warnings: component complexity (103 versus configured 40) and the resize timeout diagnostic whose existing cleanup was reviewed in Step 6. No rule suppression or broad autofix. Report: target/audit-lint-step09.json. Root TypeScript and all 26 suites / 201 tests pass. Component formatting and git diff --check pass. No new tests for these import/type-format edits, no build/E2E run, and no full-repository lint pass claimed.

## Step 10 — Guide, camera and access-guard icon imports

Removed 14 unused lucide icon bindings from active InspectionCameraModal (9), MapQuickGuideModal (2) and SuperAdminAccessGuard (3). Module imports remain. Formatted the shortened imports and the existing hamlet JSX span; no camera, permission, guide preference or account-switch behavior changed. Reviewed VoiceSearchModal but left its unused state/derived value untouched for separate logic review.

Final scoped lint: MapQuickGuideModal and SuperAdminAccessGuard have zero errors/warnings; InspectionCameraModal retains one unused hasPermission state-value error, with its setter/permission flow preserved. No suppression or relaxed rule. Before/after reports: target/audit-lint-step10-before.json and target/audit-lint-step10-after.json. Root TypeScript and 26 suites / 201 tests passed after import removal; subsequent edits only format imports/JSX. Formatting and git diff --check pass. No added tests for import/format-only edits, no file/data deletion and no build/E2E run.

## Step 11 — Area, overview and resident icon imports

Removed 16 unused lucide icon bindings from active AreaMapTab (5), OverviewTab (5) and ResidentsTab (6). Preserved the existing user changes and module imports. Formatted the shortened overview import, hamlet JSX and existing resident CSV handler without changing its calls or messages. No export permission, map, resident or demographic behavior change. Swagger and Keycloak files were not edited.

Scoped lint: AreaMapTab is clean; OverviewTab retains one unused alertCount error; ResidentsTab retains one unused currentUser error and two complexity warnings. No diagnostics suppressed or permissions inferred from the unused prop. Reports: target/audit-lint-step11-before.json and target/audit-lint-step11-after.json. Root TypeScript and all 26 suites / 201 tests passed after import removal; later changes only format existing expressions. Formatting and git diff --check pass. No file deletion, new implementation-mirroring tests or build/E2E run; full-project lint remains outstanding.
