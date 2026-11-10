# Production cutover state

## Owner decisions and verified evidence

- Owner selected real-data production, Tailscale for administration, 90-day Cloud Logging audit storage and Cloud Monitoring notifications to `laihoangdo0506@gmail.com`.
- Owner requested skipping the remaining acceptance gates. Record them as not tested / owner risk acceptance, never PASS. This request does not specify a database import source, grant permission to discard existing data, or establish legal approval to transfer citizen data.
- VPN desktop-to-VPS fresh OpenSSH/sudo test passed with the historical SSH host key. Alias `ssh gcp-vps` points to the VPN address. Host UFW public SSH allow was removed; fresh direct-public-IP SSH timed out. Shared GCP firewall rules were not changed.
- Independent Cloud Shell DB restore passed for the documented GCS archive. This is not a full restored-app login/decryption acceptance result.
- Owner confirms receiving the Cloud Monitoring synthetic alert email. Email delivery sub-gate is PASS. Exporter timer is active and latest service result is success.
- Missing-heartbeat policy creation previously stopped with HTTP 404. Policy retry and dedicated 90-day bucket read-back are not yet evidenced. Email receipt alone does not prove either.

Update: owner subsequently supplied dedicated-bucket read-back showing normal heartbeat and the synthetic alert-test heartbeat, with `unhealthy=false`. Dedicated-bucket read-back is PASS. Missing-heartbeat policy completion still awaits evidence.

## Confirmed Windows source and preflight snapshot

- Owner identified local Docker PostgreSQL on `127.0.0.1:5433` and authorized all business data. Read-only inspection identifies `police-postgis-1`, database `Monolithic`, PostgreSQL 18.6/PostGIS 3.6.4 (~92 MB).
- Source counts: 1,291 public households, 5,074 public residents, 10,835 roster import rows, 5,073 roster identities, 46 Liquibase changesets and zero active migration locks. Preserve all schemas, history, views, sequences and the six existing `public.officer_account` rows in the migration snapshot; do not enable that legacy table as an authentication source.
- Local encrypted preflight snapshot: `.tc2-private/production-source-20261105T180724Z/source-20261105T180724Z.tar.gz.gpg` with SHA256 sidecar. The helper holds a read-only repeatable-read exported snapshot while producing the dump and fingerprints for all 51 source tables. The archive includes the existing roster data key. Encryption and GPG authentication passed using the previously escrowed recovery key, decrypted from Windows DPAPI only in memory. Private temporary plaintext was removed; output directory has explicit current-user/SYSTEM ACLs. This backup has not been uploaded or independently restored, and is **not** a final cutover snapshot.
- Source roster key authenticated **26,743 encrypted fields** read-only (import raw/parsed/resolution fields and identity numbers). No plaintext was emitted. Do not replace this key with the staging-generated key.
- All four unique RBAC subjects match users in local Keycloak realm `jhipster` (4/4 matched, no unmatched subjects). That Keycloak uses `dev-file` storage in the container layer, **without a persistent data mount**. Do not recreate/remove the source Keycloak container. Its identity data must be exported consistently before transfer; a short source-identity outage needs owner coordination. Do not map by display name or replace source UUIDs with staging UUIDs.
- No source DB/schema/history was changed. No citizen data or production key has been uploaded to the VPS. A final coordinated write freeze, fresh snapshot, source/target reconciliation and production-specific artifact/configuration are still required for the cutover itself.

### Subsequent owner-authorized identity export and encrypted transfer

- Owner explicitly approved the brief local Keycloak outage, then encrypted transfer toward production. Local Keycloak was stopped for its H2 copy and restarted; original container is preserved and OIDC discovery responds. A separate network-isolated clone exported the realm; clone/H2/plaintext workspace were removed after encrypted packaging. Local export archive: `.tc2-private/identity-source-20261105T181353Z/identity-20261105T181353Z.tar.gz.gpg`.
- Portable identity export contains all four business-subject UUIDs plus the RBAC service identity. Import must preserve those UUIDs. Snapshot includes credentials only inside the encrypted archive, never terminal/chat output.
- Encrypted DB/key and identity archives were transferred over the verified VPN into root-only `/var/backups/police-management/migration-source/` on VPS. They were also uploaded create-only to GCS:
  - `gs://sunnytech-backups-194646196669/migration-source/source-20261105T180724Z-cd87e9d088e543569fc1b4a5d10af7fa.tar.gz.gpg`
  - `gs://sunnytech-backups-194646196669/migration-source/identity-20261105T181353Z-520f674ac338493c8130737b35d6cffd.tar.gz.gpg`
- Application dump restored successfully into new container/volume `police-production-candidate-db-20261105` with **network none and no published ports**. All **51** source table counts and fingerprints matched, including Liquibase/history and legacy tables. Existing staging/source were not overwritten. Restore deliberately omits source ownership/grants; the restricted runtime grants must be provisioned before any app connection.
- Candidate secret directory `/etc/police-management/secrets/production-candidate-20261105` holds the preserved source roster key and a newly generated candidate DB-owner password; none are printed. Candidate reconciliation marker is `/var/lib/police-management/production-candidate-20261105.json`.
- **New identity cutover blocker:** source realm has four human users with zero OTP credentials, enabled default-name `admin` and `user` accounts, and no named `laihoangdo` user. Master/staging OTP evidence does not establish MFA for this production source realm. Do not publish the source identities unchanged. Create/enroll a named production operator, disable default/sample accounts on the candidate, rotate app/service client secrets, and require MFA for remaining human users while preserving business UUID references. Do not change the local source accounts or rewrite existing business subject IDs automatically.
- Public site remains maintenance. Production realm import, restricted app runtime, production artifact/configuration and cutover are **not complete**; no claim of go-live is supported by candidate DB restore alone.

## Production deployment and public cutover — 2026-11-07

All steps below were executed on the VPS with root-only scripts; no secret material was printed. Skipped acceptance gates remain **not tested / owner risk acceptance** as previously recorded.

### Production identity and runtime database

- Production realm `jhipster` was imported into the owned Keycloak 26.7.4 (state persisted in PostgreSQL): `Realm 'jhipster' imported`; import is idempotent on later restarts. Marker `production-identity-20261107.json` records `PRODUCTION_REALM_PREPARED` + `keycloakImported: true`.
- **Defect found and fixed:** the local realm export carried `attributes.frontendUrl: http://localhost:9080`. With `KC_HOSTNAME_STRICT=true` this produced a wrong issuer through the proxy (403 on discovery) and would have failed Spring's issuer match at startup. Fixed in the live realm (SQL update of `realm_attribute`, then container restart), in the on-disk `realm.json`, and in `prepare-production-identity.py` so future preparations normalize it to `https://sunnytech.cloud`.
- Runtime role `police_runtime` was provisioned inside the candidate from the reviewed `database-runtime-role.sql`; verification confirmed non-superuser, household reads (1,291), `rbac_profile` reads (4) and denied `databasechangelog`. App secrets live under `/etc/police-management/secrets/production/app/` (readable by the app uid only).
- The candidate container was recreated attached to the `police-production_database` network: a container created with `--network none` cannot be connected to another network. Data remained intact (1,291 households, 46 changesets, runtime role present).

### Production artifact and application

- Non-synthetic production JAR built with `POLICE_STAGING_SYNTHETIC` unset (`-Pprod,vps -Dmaven.test.skip=true -Dskip.npm` after the Vite production build had completed; the `webapp:test` ESLint run is pre-existing lint debt in the tree, with `NO_SRC_CHANGES_SINCE_STAGING_BUILD` verified by mtime cutoff). `scripts/audit-production-artifact.ps1` returned **PRODUCTION_ARTIFACT_AUDIT_PASS**; JAR SHA256 `d58392b2434004916d0f390f46f28594968ad412e6d46eb4c286ba572c88f341`; image `police-app-production:20261107-1`, image ID `sha256:165fb96e319b2d3dd6b98415f80c173dbb49c513e03a999980853b948217d3df`.
- `deploy-production-app.py` brought up `police-production-app-1` (profiles `prod,vps,vps-prod`, loopback-only `127.0.0.1:18082`, internal database network, read-only root filesystem, dropped capabilities) and wrote marker `production-app-20261107.json` = `PRODUCTION_APP_DEPLOYED` with `publicGoLive: false`.
- UFW gained two rules allowing the production app address `172.29.41.10` to the host gateway for OIDC discovery (443) and the RBAC admin gateway (18443).

### Pre-cutover routing (maintenance preserved)

- `stage-production-realm-route.py` staged the production realm routes without touching the maintenance root: public `/realms/jhipster/` proxied (root stayed 503), and the internal gateway gained the `172.29.41.1:18443` listener, the `172.29.41.10`/gateway allow entries and the production token/admin routes.
- Operational findings recorded for future runs: Cloudflare rejects default `Python-urllib` user agents with 403, so public-route checks must use curl; host-originated connections to `172.29.41.1:18443` arrive with source `10.148.0.3`, so gateway verification runs inside the application's network namespace (`nsenter`) to mirror the application's own source address.

### Verification and backup before cutover

- `verify-production.py` **PASS**: backend health UP, frontend 200, `staging-manifest.json` 404, anonymous RBAC 401, households 1,291 / residents 5,074, active `police_runtime` connections, public realm discovery with issuer `https://sunnytech.cloud/realms/jhipster`, internal RBAC gateway enforcing 401, maintenance root still 503.
- The dual-source audit exporter was installed over the staging copy (staging + production scan, namespaced delivered IDs, heartbeat on the production port) and a manual run was accepted by Cloud Logging.
- Production backup timer `police-production-backup.timer` enabled (daily 18:31 UTC). First manual run uploaded `gs://sunnytech-backups-194646196669/production-backups/production-20261107T090242Z-9eb0461669be451383fce9f0305c707e.tar.gz.gpg` (SHA256 `c56b112173d411a593443dec14a3d4cea28330c72a9d32bdaff4843591c267f5`) with receipt and upload marker written.

### Public cutover

- `cutover-production.sh` **PASS**: atomic nginx flip with automatic rollback, prior configurations saved under `/root/police-nginx-cutover-20261107T090301Z`, marker `production-cutover-20261107.json` = `CUTOVER_ACTIVE` at `2026-11-07T09:03:04Z`.
- Post-cutover script checks passed (public root 200, production realm discovery 200, anonymous RBAC 401, staging manifest 404), and an independent check from the owner's workstation through Cloudflare confirmed the same results with the correct issuer.
- The staging application remains deployed on its own port/realm and unaffected; its realm routes stay available.

### Post-cutover hotfix — CSP and MapLibre placeholder tiles (2026-11-07)

- The production dashboard logged thousands of `Fetch API cannot load data:image/png;base64… Refused to connect` console errors from the MapLibre bundle. Root cause: the application CSP (`application.yml`) declared `connect-src 'self' https: ws: wss:` without `data:`, while `gis/utils/localRasterRequest.ts` rewrites every out-of-catalog raster tile to a 1×1 transparent PNG data URL that MapLibre fetches. Staging never exercised this path because the synthetic build excludes the operational GIS pipeline.
- Fix: `connect-src` now allows `data: blob:` (one-line configuration change; `connect-src` already permitted every https host, so the relaxation is marginal). `blob:` was added preemptively to avoid a second redeploy cycle.
- Rollout: JAR SHA256 `23840572f2bc5b114812711f282579d9793bc7eb3ce546e6822787dc77189fc0`, image `police-app-production:20261107-2` (image ID `sha256:f11d56ce702302377ce0564b41bdd3d07de0cfe0b8f8f14cf81b8fb5fee750a8`), deployed via the new `update-production-app.py` (fresh offsite backup gate, pinned-image swap, health wait, marker update). A pre-rollout encrypted backup was uploaded: `production-20261107T092238Z-488cdf8542b94a78921d95877e1393fb.tar.gz.gpg` (SHA256 `5ff820eb4873fe440e2ee49a2901385491fd9c847d21e93b1c6effbf0ee4e7a1`). The previous image `20261107-1` remains on the host for rollback (`update-production-app.py police-app-production:20261107-1`).
- Post-rollout verification: container healthy with zero error logs, public CSP header contains `data: blob:` in `connect-src`, root 200, anonymous RBAC 401, staging manifest 404, issuer unchanged, households 1,291 / residents 5,074 intact. A new infrastructure test asserts the CSP directive. Final acceptance is the owner's browser console check on the 3D map tab.

### Post-cutover hotfix — MapLibre 6 worker 404, 3D field buildings missing (2026-11-08)

- Symptom: the 3D field map tab (`field-3d-map`) rendered raster tiles but no buildings, in production and local dev alike. Server-side was proven clean (JAR carried the full 47.9 MB `badiem-houses.geojson`, `/api/gis/field-buildings` returned all 392 saved features, `/access` resolved the owner as superadmin, every request 200).
- Root cause: the `maplibre-gl` 5.0.0 → 6.16.0 upgrade changed worker delivery. v6 loads its Web Worker from a separate `maplibre-gl-worker.mjs`, resolving the URL at runtime through `import.meta.url` — a dynamic URL the bundler cannot rewrite inside a chunk. The Vite build therefore never emitted the worker file; the browser fetched `/assets/maplibre-gl-worker.mjs` → **404** (captured in the nginx access log at every owner session reload on 2026-11-07), so every GeoJSON source silently never parsed (raster tiles still render because MapLibre 6 fetches/decodes images on the main thread). `maplibre-gl-shared.mjs` being 0 bytes is normal package design (verified against the official npm tarball), not node_modules corruption.
- Fix: new `src/main/webapp/app/gis/utils/maplibreWorkerUrl.ts` calls the official `maplibregl.setWorkerUrl()` with a `?url` import so Vite emits the worker as a hashed asset; wired into all three map components (`FieldHouseMap`, `MapLibreAreaMap`, `RosterPage`) plus a `*?url` ambient module declaration in `typings.d.ts`.
- Build: Vite production build with `NODE_ENV=production APP_VERSION=0.0.1-SNAPSHOT` (worker emitted as `assets/maplibre-gl-worker-CMkqA50c.mjs`, 519,372 bytes; `setWorkerUrl` executes at the app chunk top level), then `mvn -Pprod,vps package -Dmaven.test.skip=true -Dskip.npm` (the `webapp:test` ESLint run remains pre-existing lint debt). `scripts/audit-production-artifact.ps1` returned **PRODUCTION_ARTIFACT_AUDIT_PASS**.
- Rollout: JAR SHA256 `a866e084e9fe9204e1bf0243b51cfc2bc6e29f8401f2e185f945bffbc45e74b9`, image `police-app-production:20261108-1` (image ID `sha256:e189cde963e813d0871094b7f01b719bcfbb25a87d53f42c6b2eeb0f61aa7939`), deployed via `update-production-app.py` after a fresh offsite backup `production-20261108T012839Z-04015a0bbf074f878a28fb67cdaf2a8b.tar.gz.gpg` (SHA256 `af6af86261e5632a19571a1400e7965002d9d45b1fda9a0bf0f3bf37a375a1e1`). The previous image `20261107-2` remains on the host for rollback (`update-production-app.py police-app-production:20261107-2`).
- Post-rollout verification: container healthy, zero error logs, marker updated to `20261108-1`; public root 200, anonymous RBAC 401, staging manifest 404, CSP unchanged (`frame-ancestors 'none'`), **`/assets/maplibre-gl-worker-CMkqA50c.mjs` returns 200 with `text/javascript`**, households 1,291 / residents 5,074 / field buildings 392 intact. Final acceptance is the owner's browser check of the 3D field map tab.

### Still open after go-live

- Missing-heartbeat alert policy creation still awaits owner evidence (`cloud-shell-observability.py` with `APPROVE-90-DAYS`).
- Owner must complete first production sign-in for the named operator, remove the one-time credential file, and reassign the disabled `user` account's hamlet assignment (see `OWNER-ACTIONS.md`).
- The go-live repository changes were committed afterwards (`f458d81`, 2026-11-08). The running image was built from an uncommitted tree (`e996f07-dirty`) with tests skipped, so it is not proven identical to any commit; the next release must follow the procedure below.

## Current serving state (reviewed 2026-11-10)

- Public site serves production: image `police-app-production:20261108-1` (rollback candidates `20261107-2`, `20261107-1` stay on the host), realm `jhipster`, database container `police-production-candidate-db-20261105` with the restricted `police_runtime` role.
- Read-only review evidence: public root 200, issuer `https://sunnytech.cloud/realms/jhipster`, anonymous RBAC 401, `staging-manifest.json`, `/admin/` and `/management/health` 404, MapLibre worker asset 200. `/realms/master/*` reaches only the application's SPA fallback, not Keycloak. Production, staging, audit-export and certbot units last ran with `Result=success`; root disk 52% used.
- The staging application and realm `police-staging` remain publicly discoverable on the same host. Decide whether staging should stay public now that production is live.
- Duplicate response headers: Cloudflare adds `Strict-Transport-Security: max-age=31536000; includeSubDomains` while the origin sends `max-age=86400`, and both the application CSP and an Nginx `frame-ancestors 'none'` CSP are present beside `X-Frame-Options: SAMEORIGIN`. Not a functional fault; unify deliberately (the Cloudflare value commits every subdomain to HTTPS for a year).

## Logout fix — 2026-11-10

- Symptom: signing out in production stopped on a Keycloak error page. The app sends its origin `https://sunnytech.cloud` as `post_logout_redirect_uri`, but realm `jhipster` client `web_app` had `post.logout.redirect.uris = +` (reuse redirect URIs), and its only redirect URI is the login callback, so Keycloak answered 400 "invalid redirect URI". Local realms allow every `localhost`, which hid the problem.
- Live fix: set `post.logout.redirect.uris` to exactly `https://sunnytech.cloud` (previous value `+`, one row changed) in the identity database, then restarted `police-staging-keycloak-1` (healthy after ~21 s). Verified: logout with `https://sunnytech.cloud` → 302 to the site; a foreign URI is still rejected (400); public root 200, anonymous RBAC 401, both realm discoveries 200, production app UP with no new error logs. Rollback: set the value back to `+` and restart Keycloak.
- `prepare-production-identity.py` now sets the attribute so a future realm preparation keeps logout working.
- Application-side hardening (URL-encoded redirect with a fallback when the browser sends no usable Origin; frontend still ends the Keycloak session when the app session has already expired) is in the repository and reaches production with the next release.
- Not changed: realm `police-staging` client `web_app` uses `https://sunnytech.cloud/` (trailing slash) for the same attribute.

## Release procedure for later production updates (from 2026-11-10)

The 2026-11-07/08 rollouts used `update-production-app.py` as an image swap only: the `vps` profile disables Liquibase and nothing ran production migrations, so a release that adds changesets would have started against an old schema. The script now enforces the staging-equivalent gates:

1. Commit a clean tree; build the frontend and `mvn -Pprod,vps package` **with tests**; run `scripts/audit-production-artifact.ps1`; record the JAR SHA256.
2. Upload only the JAR, build the immutable image `police-app-production:YYYYMMDD-N` from `App.Dockerfile` on the VPS. Install `migrate-production-db.sh` and `verify-production-live.py` under `/opt/police-management/production/` (root-owned).
3. `sudo python3 update-production-app.py police-app-production:YYYYMMDD-N <sha256>`: checks the JAR inside the image, requires a clean HIGH/CRITICAL Trivy scan, runs `migrate-production-db.sh` (fresh offsite backup → restore drill into a disposable database with matching counts → Liquibase `status → update → status`), swaps the pinned image, waits for health, runs `verify-production-live.py` and returns to the previous image on failure.
4. Rollback: `update-production-app.py <older tag> --rollback` (needs an offsite backup from the last 6 hours, runs no migrations). Applied changesets stay applied; only roll back to code that works with the current schema. Data recovery after real writes still follows the rollback boundary below.

`verify-production.py` stays as the historical pre-cutover check (it requires maintenance and the 1,291/5,074 source counts) and must not be used after go-live.

## Required cutover inputs (historical, satisfied by the 2026-11-07 cutover)

1. Owner chooses whether production starts **empty** for later authorized entry/import, or receives a specifically identified operational source DB. Do not infer the source from local files.
2. Prepare a production artifact/configuration appropriate to that scope; exclude operational/citizen material from public static bundles, retain server-side keys and restricted runtime privileges, and keep Keycloak admin endpoints private.
3. Before any DB change: fresh encrypted backup, offsite success, preserved old configuration/image and explicit restore/rollback targets. Never reset/rewrite Liquibase history, drop existing tables or import legacy authentication data just to match table counts.
4. Complete the selected monitoring setup: owner read-back from the dedicated 90-day bucket and confirmation of missing-heartbeat policy creation. Tailnet membership/access review remains necessary for the chosen administration path.
5. Stage the production candidate behind maintenance, verify the intended target DB/image/keys/roles, then perform an explicitly identified cutover. No public-route flip against the synthetic staging candidate.

## Rollback boundary

Before writes are enabled, traffic/configuration can be reverted to the preserved maintenance configuration and previous artifact. After real writes begin, image rollback alone is not data rollback: stop writes, preserve the new state and use the approved DB recovery target. Do not restore over a live DB or discard newly entered citizen records automatically.
