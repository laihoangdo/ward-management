# Lint and reference review — 2026-10-11

Read-only inspection: no ESLint --fix, source cleanup, dependency removal, permission changes or database writes. Existing source/user changes preserved. Reports are generated under ignored target; no application tests rerun because this batch adds documentation only.

## Executed scoped ESLint checks

Each invocation used `node node_modules/eslint/bin/eslint.js <scope> --format json --output-file target/audit-lint-<scope>.json` with the existing eslint.config.ts and TypeScript project settings.

| Scope                                 | Files | Errors | Warnings | Exit |
| ------------------------------------- | ----- | ------ | -------- | ---- |
| GIS services + utils                  | 17    | 28     | 2        | 1    |
| GIS components                        | 33    | 424    | 19       | 1    |
| GIS root TSX                          | 27    | 167    | 10       | 1    |
| app/config, shared, entities, modules | 120   | 0      | 1        | 0    |

Completed scopes above: 197 files, 619 errors, 32 warnings. These are lint diagnostics, not a count of runtime bugs. No rules were disabled and no files excluded to improve counts. Additional data/models/types/firebase/app-entry scope is recorded in the completion addendum. This is frontend scoped lint, not certification of Java/Python/scripts/root configuration or tools/e2e lint. Root ESLint lacks a TypeScript rule scope for tools/e2e.

## Findings and next safe batches

- Most GIS diagnostics concern unused bindings and formatting: components have 168 unused-variable/import diagnostics and 242 formatting diagnostics; root screens have 137 unused and 9 formatting diagnostics. Review imports versus unused state individually; removing a state initializer or side-effect import may change behavior. Do not run a broad autofix over existing user changes.
- Services/utils: require-await (5), unused bindings (10), array notation (2), formatting (7), bitwise (2), shorthand (1), useless assignment (1), complexity warnings (2). Async signature removal can affect callers; bitwise crypto code needs contract tests before any change.
- Active AdvancedMapTab line 643: ESLint reports a leaked timeout, but subsequent source review confirms all five timer handles are collected by `.map()` and cleared by `timers.forEach(clearTimeout)` in effect cleanup. Dependencies are panel/fullscreen state. Treat this diagnostic as an apparent static-analysis false positive, not evidence of absent cleanup; browser lifecycle verification remains unexecuted.
- DocumentsTab, Header, HouseholdDetailModal and LogsTab: render-time Date/Date.now purity findings. Do not freeze business expiry calculations just to appease lint; define the needed refresh/date behavior.
- SecurityAlertsChart: nested component/static-components diagnostics suggest remount/state risks; inspect behavior before extracting.
- SearchableSelect: conditional-rendering diagnostic for icon; inspect allowed input shape and explicit render guard.
- Non-GIS UI is clean except one complexity warning. Successful TypeScript/unit/build checks from preceding batches remain historical results, not a substitute for fixing lint.

## Reference evidence

[Per-file inventory](08-gis-reference-inventory.md) covers 28 GIS root candidates. AST parsing examined 209 app TS/TSX files, resolved imports with the project TypeScript settings, and followed static imports/exports plus literal dynamic imports/require. 154 files are reachable from app/index.tsx; root GIS App.tsx is reachable through routes.tsx React.lazy. Type imports are conservatively included.

25 root screen files have same-named counterparts under components and are not reachable from the active entry. They are review candidates, not approved deletions. Root main.tsx and firebase.ts also have no incoming source imports. Existing root Sidebar.tsx and other candidates include user/previous remediation edits; preserve ownership and review diffs before cleanup.

Confirmed active build entry: src/main/webapp/index.html line 17 loads app/index.tsx; vite.config.ts line 69 uses this HTML as build input. No root standalone GIS main.tsx entry was discovered in those configs. String searches over source/scripts/configuration found no named legacy root screen entry references, but that does not exclude external/manual usage.

Critical dynamic references to KEEP: Vite copies content/models/Ba_Diem_3D.glb; prepare_web_glb.cjs writes it. GIS generation scripts write runtime JSON datasets. prepare_vietmap_vectors.py, inspect_vietmap_sdk.py and prepare_vietmap_basemap.py read active components/VietMapCompareTab.tsx for provider configuration. Do not delete the active component or assets on an import-only argument. No provider key values were included in this report.

Limitations: static reachability does not establish regeneration/manual/external integration ownership. Framework scanning, nonliteral imports, asset paths, ignored local files and independent build modes need separate checks. Source graph initially used mismatched Windows path separators; normalized paths and asserted that active GIS App is reachable before generating the final inventory. The final report uses corrected graph data.

## Recommended order

1. Fix small unused import/formatting batches in active services/components, preserving side effects and user edits; run bounded lint plus relevant tests/typecheck.
2. Fix verified lifecycle issues with regression tests; define date/expiry behavior before purity changes.
3. Diagnose integration fixture compatibility and provision disposable services for authenticated E2E.
4. Present exact legacy file deletion candidates with diff/ownership and full reference evidence. Delete only after explicit approval, then compare lint/typecheck/build/unit/E2E outcomes.

No file is deleted or renamed by this review. Phase 6 deletion approval is still required.

## Completion addendum

The extra scope (GIS data/models/types/firebase and app entry/setup files) was interrupted after an extended run without output or a completed JSON report. It is INCOMPLETE, not passed, and excluded from the 197-file totals. It should be split further by file/size before retrying. `git diff --check` and formatting checks on the new report documents passed. This batch adds only reports; it does not change production source or lint policy.

Subsequent Step 4 removed 13 unused icon imports in DocumentsTab/LogsTab. Rechecked those two files: zero lint errors, three existing purity warnings, exit 0. Original totals above remain the baseline; full-scope lint has not been rerun. See [remediation log](06-safe-remediation-progress.md).
