# Execution results and review checkpoint

## Outcome

Eight required audit/testing documents, a working-tree path snapshot, a per-file triage manifest and an isolated Playwright foundation have been added. The application remains unchanged. No cleanup, source rename/move, commit or deployment was performed. Existing user changes remain. This is an initial source audit and smallest safely validated E2E foundation, not complete business certification.

Confirmed architecture: Java/Spring Boot/JHipster monolith with PostgreSQL/Liquibase and Keycloak OIDC; React/TypeScript/Vite UI with generated CRUD and custom GIS dashboard. Inventory: 24 workflow groups, 22 source-implemented and 2 partially implemented. All lack executed real-session browser acceptance coverage. File manifest is directory/convention-based triage for 606 paths when generated; it is not a proof of exhaustive individual runtime/reference analysis.

## Actual results

| Check                               | Result                                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| Vite build                          | PASS, 3292 modules, large chunk warnings                                            |
| Maven incremental compile           | PASS, existing classes up to date; dependency-convergence warnings                  |
| Maven unit/architecture tests       | PASS, 107 tests, 0 failures/errors/skips                                            |
| Root TypeScript                     | FAIL, active/duplicate GIS contracts and crypto typing                              |
| Vitest coverage run                 | FAIL, 12 failed suites, 10 passed suites, 49 passed tests; unresolved app/* aliases |
| Root lint                           | INCOMPLETE: interrupted after several minutes without final output; not passed      |
| E2E install / locked npm ci         | PASS, exact Playwright 1.64.0 and lockfile                                          |
| Chromium browser installation       | PASS, Chromium/headless shell/FFmpeg/Winldd installed                               |
| E2E TypeScript                      | PASS, root TypeScript with isolated tools/e2e/tsconfig.json                         |
| Playwright discovery                | PASS, six tests in two files                                                        |
| Playwright smoke and full execution | BLOCKED, exit 1 at health preflight; 0 tests executed                               |
| New-file formatting                 | Prettier executed only on added audit/testing/E2E files                             |
| Root ESLint on tools/e2e            | No applicable TypeScript configuration; not linted                                  |
| git diff --check                    | See final verification addendum                                                     |
| Maven verify / integration          | See final verification addendum                                                     |

Initial npm/npx PowerShell invocations were rejected by execution policy; repeated with npm.cmd/npx.cmd. Maven's unquoted dotted -D properties were initially split; quoted rerun succeeded. Initial compiler lifecycle invoked Spotless apply but explicitly reported zero modified files; subsequent Maven commands used -Dspotless.skip=true. An initial E2E tsc command was rejected by TypeScript 6 because files plus an existing config require --ignoreConfig; isolated tsconfig then passed. None of these failed invocations is counted as a test pass.

## Added files and commands

`docs/audit`: baseline, inventory, cleanup plan, working-tree snapshot, file classification TSV, this execution report. `docs/testing`: strategy, feature matrix, architecture, execution guide, future-feature checklist. `tools/e2e`: package/lockfile, .gitignore, tsconfig, Playwright config, readiness setup, sanitized diagnostics fixture and anonymous/security specs. Generated ignored outputs under target include frontend build, Java reports/JAR, coverage, E2E HTML/JUnit and audit-maven-verify.log. Root package/lockfile and production source were not edited.

Commands executed: git status/log/diff, rg discovery/reference scans, Get-Content/child listing, version checks, Docker version/ps, read-only localhost health probes; npm.cmd run webapp:build:dev; quoted Maven compile and test; npx.cmd tsc --noEmit; npm.cmd run vitest-run -- --reporter=dot; npm.cmd run lint (interrupted); npm.cmd view @playwright/test version; tools/e2e npm install and npm ci --ignore-scripts --no-audit --no-fund; npx.cmd playwright install chromium; npm.cmd run list/smoke/test; node node_modules/typescript/bin/tsc -p tools/e2e/tsconfig.json; targeted new-file Prettier; git diff --check; Maven verify with install/npm/Spotless skipped and output in target/audit-maven-verify.log.

## Priority findings and next work

1. P0: diagnose type errors and Vitest alias resolution separately; retain business assertions. Validate household/resident partial-failure behavior with isolated records. Confirm provider-key ownership/restrictions without printing its value.
2. P0: provision disposable backend DB/IdP configuration, actual OIDC accounts and synthetic territorial fixtures; run real sign-in/revocation and household/resident vertical slices. Pending authentication/write helper implementation is blocked by this environment, not presented as completed.
3. P1: establish reminder queue-versus-delivery acceptance criteria; test document boundaries and append-only patrol behavior. Resolve local/server setting and security-alert source ambiguity.
4. P1/P2: review generated artifacts separately from uncertain duplicate screens, Firebase remnants and GIS source assets. None approved for deletion.
5. Add runner-specific CI service provisioning, real-session suite and cross-browser/provider regressions once environment and acceptance criteria exist. Existing test-count success does not establish production readiness or measured feature coverage.

Phase 6 cleanup awaits explicit user approval under the supplied request. Review exact paths and checks in 02-cleanup-plan.md before any removal. No speculative file removal is needed to use the new smoke framework.

## Final verification addendum

- `git diff --check` passed. Existing working-tree path/status snapshot matches current state when excluding only the new docs/audit, docs/testing and tools additions. No tracked source diff was added by this work.
- E2E isolated typecheck passed again after final test changes; npm ci and Chromium installation completed successfully. Smoke/full both exit 1 at preflight, with JUnit recording zero executed tests. That zero-count XML must not be treated as successful acceptance in CI; honor the process exit code.
- Repository lint was interrupted without a result. Root ESLint has TypeScript rules only for src/main/webapp and does not apply to tools/e2e; typecheck and targeted formatting are the validation for the new foundation.
- Maven verify was attempted with frontend installation/build and Spotless skipped. It repackaged the JAR, reran 107 passing unit tests, and launched PostgreSQL Testcontainers at an ephemeral port, distinct from the existing compose database. Five completed integration suites reported 35 tests and two failures: SpaWebFilterIT expected docs HTTP 200 but got 403; AccountResourceIT expected HTTP 200 but got 500. HibernateTimeZoneIT (7), CustomClaimConverterIT (7), UserServiceIT (6) passed; SpaWebFilterIT had 1/11 failure, AccountResourceIT 1/4 failure. AreaZoneResourceIT then repeatedly received RBAC denials, with approximately 15-second intervals. The broad run was interrupted after these repeated fixture/security failures rather than treating it as a completed full regression result. Additional failing cases observed in the unfinished suite are not included in the 35-test completed-suite count.
- Source evidence: AreaZoneResourceIT uses plain @WithMockUser, while RbacService.current expects effective RBAC identity/profile and service AOP applies territory/permission checks. This is a compatibility hypothesis requiring targeted fixture diagnosis, not proof that current authorization is wrong. Account 500 requires independent investigation.
- Existing Testcontainers configuration uses withReuse(true); test infrastructure may retain a test container. No Docker volume/container deletion was issued because Phase 6 cleanup is approval-gated. Existing compose Keycloak/PostgreSQL were not deliberately mutated by this audit.

This addendum supersedes early-phase statements that integration tests were not yet run. Full integration and authenticated browser regression remain incomplete. Generated logs/reports may contain synthetic test values; do not publish them without review.

## Subsequent safe remediation

Step 1 fixed Vitest-only `app` import resolution. All 22 suites / 187 tests now pass, including coverage execution with verified runner exit 0. Production code and assertions are unchanged. See [incremental progress and exact checks](06-safe-remediation-progress.md). The earlier failed Vitest result above is retained as the original baseline.
