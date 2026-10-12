# E2E execution guide

## Current verified state

Playwright 1.64.0 is pinned in an isolated npm package/lockfile. `npm.cmd install --ignore-scripts --no-audit --no-fund` succeeded, adding three packages. `npm.cmd run list` discovered six cases in two files. `npm.cmd run smoke` was executed and exited 1 at the real `/management/health` readiness check: no application server is listening at the default loopback 8080. Zero browser/API journeys executed or passed. See `../../target/e2e/report/index.html` and `../../target/e2e/junit.xml` from the tools/e2e directory. Browser installation status is in the audit execution addendum.

Locked `npm.cmd ci` and `npx.cmd playwright install chromium` completed successfully. E2E TypeScript passed with `node node_modules/typescript/bin/tsc -p tools/e2e/tsconfig.json` from repository root. `npm.cmd test` was also attempted and hit the same readiness blocker. A zero-test JUnit report is not a pass: CI must honor exit 1.

## Install and enumerate (PowerShell)

From repository root:

```powershell
Set-Location tools/e2e
npm.cmd ci --ignore-scripts --no-audit --no-fund
npx.cmd playwright install chromium
npm.cmd run list
```

Initial install used npm install to create the lockfile; subsequent npm ci is validated in the execution addendum. Keep Node at the root project's engine >=24.21.0; the detected host 24.18.0 is below that requirement even though baseline frontend build ran.

## Environment/startup

Tests default to http://127.0.0.1:8080. Override only with a loopback origin:

```powershell
$env:E2E_BASE_URL = 'http://127.0.0.1:8080'
```

Required running services: isolated PostgreSQL with project migrations, dedicated Keycloak realm/client, configured OIDC issuer/admin integration and backend serving compiled web assets. **Do not assume current monolithic-postgresql/keycloak containers are disposable.** Automatic application startup is intentionally absent: it can run Liquibase against existing user data.

Existing configuration-derived startup commands, not executed/verified as a working runtime in this audit:

```powershell
# From repository root after configuring an isolated database and IdP
npm.cmd run webapp:build:dev
.\mvnw.cmd -ntp '-Dskip.installnodenpm' '-Dskip.npm' '-Dspotless.skip=true' spring-boot:run
# Optional separate Vite development server on 9000, proxies to backend 8080
npm.cmd run start
```

Provide Spring datasource and OAuth client/provider settings through the project's configuration mechanism; see baseline report. Existing compose services: `src/main/docker/postgresql.yml`, `keycloak.yml`, `services.yml`; these names/ports may conflict with running user containers. Creating dedicated compose/database/realm fixtures remains required before authenticated write tests. The six smoke cases need no credentials and perform no writes.

## Run, debug and reports

From tools/e2e:

```powershell
npm.cmd run smoke
npm.cmd test
npm.cmd test -- --debug
npm.cmd run report
# Or open target/e2e/report/index.html from repository root
```

Smoke and full currently select the same six baseline tests. Debug/report are configured Playwright commands, not exercised as interactive sessions during the audit. Full runtime remains blocked by missing isolated backend; no retries or silent skipping. A future full suite must add real OIDC sign-in and persisted scoped CRUD, rather than counting these anonymous tests as complete coverage.

Outputs: `target/e2e/junit.xml`, `target/e2e/report`, `target/e2e/results`. On test failure screenshots and traces are retained; preflight failure has no browser screenshot because no browser started. Browser diagnostic text omits content and URL queries. Traces can still capture sensitive payloads: use synthetic data and restrict CI artifact access/retention.

## CI and cleanup

Reproducible sequence: root npm ci + relevant Java/frontend gates; tools/e2e npm ci; Playwright Chromium install (Linux runner `npx playwright install --with-deps chromium`); provision job-owned DB/IdP; compile/serve backend; smoke; authenticated suite when implemented; restricted report upload. There is no existing CI workflow to extend. Runner-specific isolated service provisioning and automated CI integration are proposed, not implemented.

No teardown command deletes existing databases/volumes. Dispose only explicitly job-owned services and uniquely tracked fixtures. Existing npm `docker:*:down`, `ci:e2e:teardown` and `cleanup` scripts can remove volumes/output and must not be blindly used. Artifact deletion and source cleanup require Phase 6 approval.
