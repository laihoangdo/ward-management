# VPS deployment safety boundary

Use this directory for production infrastructure, not the generated development Compose files.

## Confirmed operator choices (2026-11-04)

- Internet-facing application with mandatory MFA; not VPN-only.
- Approved hostname: `sunnytech.cloud`, DNS managed at Mat Bao. Certificate/notification contact: `laihoangdo0506@gmail.com`.
- Operator confirms Google Cloud Console/rescue access.
- Backup requested on the same VPS. This is **local recovery only**, not disaster recovery or an offsite backup. Do not migrate citizen data or declare production ready without an independently stored encrypted copy and tested key recovery.

## Read-only inventory

```bash
sudo bash preflight.sh
```

Do not print `.env`, key files, service-account credentials or raw `docker inspect` into logs/support reports. Never upload a repository-wide archive: it may contain ignored credentials, source imports, images, keys and backups.

## Current VPS observation

SSH alias `gcp-vps`, host `instance-household`, Ubuntu 24.04 LTS, about 8 GB RAM and a 38 GB root disk (about 34 GB available at inspection). SSH password and keyboard-interactive login disabled. Root key login still allowed; X11 forwarding enabled. UFW installed but inactive. Google Ops Agent listeners on 20201/20202 bind non-loopback; external reachability has not been established. NTP synchronized. Docker/Nginx absent at the initial inventory.

## Execution order

1. Install container tooling, preserve existing SSH/rescue access; never grant a routine application user membership in the root-equivalent `docker` group.
2. Use the explicitly approved `sunnytech.cloud` hostname. Application/authentication routing and production OAuth redirect URIs still need deployment tests; do not add unrelated domains automatically.
3. Confirm GCP VPC firewall rules separately from UFW. Confirm a second SSH session and rescue access before enforcing firewall/sshd changes. Docker-published ports need separate review; UFW alone is insufficient.
4. Prepare dedicated root-managed configuration/secret directories. Deploy only explicit artifacts/configs; never copy local `.rbac` or `.tc2-private` wholesale.
5. Stage synthetic data first. Bind DB, backend and Keycloak backend listeners to private networks/loopback. Publish only the reverse proxy after TLS works. Do not publish PostgreSQL, management endpoints, Keycloak admin console or monitoring listeners.
6. Keycloak production mode, unique named accounts, enforced MFA and recovery workflow. Test forced enrollment, invalid OTP, brute force, idle/max session expiry, revocation and global SSO logout. Previous local OIDC tests did not prove these policies.
7. Close application security gaps: audit reads/exports, immutable external audit copy, data masking, private image delivery, detection/alerts. Do not label source fully hardened based only on role/IDOR regression tests.
8. Establish encrypted offsite DB/Keycloak/object/key/config backup and restore drill. Retention, recipients and ownership must be agreed; never keep the only decryption key on the source VPS.
9. Only then schedule real-data cutover, final verified backup, ownership/grants/sequence checks and rollback/delta procedure. No existing DB is dropped automatically.

## Blocked until operator input

- Approved off-VPS destination for encrypted backups and key escrow. Same-VPS snapshots/dumps cannot meet this requirement.
- Named security operator/alert recipient, retention policy and MFA enrollment/recovery owner.

Until these gates close, only infrastructure preparation or synthetic staging is allowed; not a production deployment containing citizen data.

## Applied foundation — 2026-11-04

- Installed Ubuntu-maintained Docker 29.1.3 and Compose 2.40.3. No application containers started; no user added to the Docker group.
- Created root-managed `/opt/police-management`, `/etc/police-management/secrets` and `/var/backups/police-management`; secret and backup directories are `0700 root:root`.
- Backed up prior UFW configuration to `/root/police-deployment-checkpoints/ufw-before-20261104.tar`.
- Enabled UFW: deny incoming/routed, allow outgoing, retain TCP 22 for IPv4/IPv6. No application/HTTPS ports opened yet. Confirmed a fresh SSH connection and `sshd -t` after activation. GCP VPC firewall has not been modified or verified.
- Installed and ran the read-only inventory at `/opt/police-management/preflight.sh`; shell syntax check passed. Google Ops Agent still binds 20201/20202, but these ports have no UFW allow rule. Docker bypass caveat still applies to future published container ports.
- No SSH root-login policy changed yet; `PermitRootLogin without-password` and X11 forwarding remain open hardening items. No Nginx/TLS, MFA configuration, database, backup job or live application deployment has been installed. No citizen data or existing local secrets transferred.

This is infrastructure preparation, **not a production go-live or security compliance approval**. Next blocker: actual domain/DNS and certificate contact. Offsite recovery remains blocked by the same-VPS-only backup choice.

## DNS and HTTPS — 2026-11-04

- Operator confirmed `sunnytech.cloud`, Mat Bao DNS and certificate contact above. VPS metadata reports public IPv4 `34.143.223.166`; stable/static reservation has not been verified through GCP APIs.
- Initial DNS lookup had no A/AAAA. Later public DNS and successful ACME validation confirm `A sunnytech.cloud → 34.143.223.166`. No AAAA was configured by this task. No DNS credentials were requested or used.
- Attempt to read GCP firewall rules was denied due to insufficient instance authentication scopes. No GCP firewall/IAM rules were changed. External HTTP and HTTPS probes subsequently succeeded, proving those paths reachable at test time, not proving all cloud rules safe.
- Installed Ubuntu Nginx/Certbot. Masked Nginx during package installation to avoid publishing the default welcome site. Archived initial config under `/root/police-deployment-checkpoints/nginx-before-<UTC timestamp>.tar` before switching.
- Served HTTP-01 from `/var/lib/police-acme`, verified a synthetic challenge externally and removed the probe. Real Let's Encrypt certificate issued for `sunnytech.cloud`, valid until **2027-02-02**. Private key stays on VPS and was never printed/copied to the repository.
- Activated `nginx-https-maintenance.conf`: HTTP redirects 308 to the fixed approved HTTPS host; HTTPS returns intentional **503 maintenance**, not the application. Unknown TLS hostnames are rejected. TLS 1.2/1.3, session tickets disabled, short initial HSTS (`max-age=86400`, no subdomain/preload commitment), no-store, CSP and other maintenance headers are set. The maintenance CSP is intentionally not an application-ready CSP.
- UFW now permits TCP **22/80/443** only (IPv4/IPv6). Public-IP HTTP probe returned 308; HTTPS probe validated the certificate without bypassing TLS checks and returned the expected 503/security headers.
- Access logging omits query strings/cookies/Authorization. A synthetic query-marker probe verified that marker was absent from the custom access log. This does not yet prove application/Keycloak log redaction.
- `certbot.timer` active. Installed root-only deploy hook to validate and reload Nginx after certificate renewal. Certificate contact registration is **not** an SMTP/incident alert setup; no alert delivery has been configured or tested yet.
- Renewal dry-run and one validation retry both failed because the ACME staging resolver timed out looking up A/AAAA. Independent Google and Cloudflare DNS lookups returned the expected A and a normal empty AAAA answer. An intervening noninteractive retry hit the SSH timeout while Certbot was in its randomized delay; its owned process was terminated and the actual bounded retry used `--no-random-sleep-on-renew`. No additional certificate orders should be spammed to work around DNS failures. The live certificate remains valid; **automatic renewal is not yet verified**. Investigate authoritative DNS/ACME resolver reachability before closing this gate. No DNS provider change was made.
- Ran the deploy hook explicitly: Nginx config validation and reload PASS, service/timer active and certificate expiry unchanged. This checks the reload hook only, not ACME renewal.
- External TCP probes to 20201, 20202, 5432, 8080 and 9080 timed out (not reachable from the test client); 80/443 probes succeeded. This is a point-in-time test, not a substitute for reviewing GCP rules.
- Local infrastructure policy tests: `node --test scripts/vps-deployment.test.cjs`, **5/5 PASS**. Actual server Nginx syntax validation passed before each activation. ACME probe files were removed after testing.
- No database, application or Keycloak container is running on VPS. No citizen data was uploaded. MFA, per-record access audit, immutable logs, image storage, backup encryption/offsite recovery and production application deployment remain separate gates.

### Reviewed operator scripts

- `activate-bootstrap.sh <source-directory>`: first-install guard, archive initial Nginx config, validate before starting; only ACME/maintenance.
- `issue-certificate.sh`: explicit sudo invocation; refuses missing/wrong IPv4 DNS or unresolved IPv6 reachability. Uses webroot, not an automatically rewritten application proxy configuration.
- `activate-https-maintenance.sh <source-directory>`: requires the owned bootstrap symlink and existing certificate; rolls symlink back if `nginx -t` fails; opens 443 only after successful validation/reload.
- `reload-nginx-after-renewal.sh`: renew deploy hook, validates Nginx configuration before reload.

These scripts are not an automatic production cutover, cloud-firewall manager or backup solution.

## Synthetic identity staging and MFA — 2026-11-04

**Deployed:** `police-staging` Compose project on VPS, sources under `infra/vps/staging/` and runtime configuration in `/opt/police-management/staging`. This is not a citizen-data deployment.

- Pinned PostGIS/PostgreSQL and Keycloak base images by digest. Keycloak is built for PostgreSQL then runs `start --optimized`, **not** `start-dev`; read-only root filesystem, bounded tmpfs, dropped capabilities, no-new-privileges, bounded container logs and memory limits.
- PostgreSQL has **no published host port**. Separate `keycloak` database/user with no superuser/createdb/createrole/bypassrls privileges. Host and local database authentication require SCRAM. Application DB `Monolithic` is newly initialized by the image only; application migrations/data have **not** been deployed here.
- Keycloak publishes only `127.0.0.1:18080`; management port 9000 is not published. Host Nginx exposes only `/realms/police-staging/` and login static `/resources/`. `/admin/` and `/management/` return 404; master realm is not routed; application root still returns 503.
- Nginx overwrites forwarding headers and Keycloak trusts the dedicated host gateway only (`172.29.40.1/32`). Public login requests are rate-limited; access logs exclude query strings, cookies and Authorization. Login locations retain Keycloak's own CSP rather than inheriting the maintenance `default-src 'none'` policy.
- Credentials generated **on VPS**, no operational secrets imported or printed. Host parent `/etc/police-management/secrets/staging` is root-only `0700`; selected file-backed Compose secrets are readable by container UID 1000 through explicitly mounted files. Passwords are loaded by entrypoint, not embedded in Compose environment values or shell arguments. Root on the VPS remains able to access these secrets; this is not an external secret manager.

### Enforced policy and actual protocol results

Realm `police-staging`: mandatory username/password + **REQUIRED OTP execution**, default OTP enrollment, no self-registration, no remember-me. Access token 300 seconds, SSO idle 900 seconds, maximum session 28,800 seconds; temporary brute-force lockout after repeated failures. Human clients disable direct password grants. Events/admin events enabled; admin representation details disabled. These are staging policy values, not approval of production retention or alert delivery.

`test-mfa.py` ran against the real HTTPS endpoint, using a generated synthetic account and PKCE client, with no browser mocks:

1. First login required OTP enrollment; password alone never yielded an authorization code.
2. Wrong OTP rejected; correct OTP produced code/state and successful PKCE token exchange; token lifetime <= 300 seconds.
3. Logout invalidated refresh token; silent SSO (`prompt=none`) returned `login_required`.
4. Second, independent login required the persisted OTP credential instead of reenrollment; wrong/correct OTP and logout tests passed again.

The first harness attempts incorrectly interpreted Keycloak's hidden **raw** `totpSecret` as its displayed base32 representation. Fixed the test client, not the authentication policy; added public RFC6238 OTP vectors as regression coverage. No seed, password, auth code or token was printed. OTP escrow exists only for this synthetic test identity under the root-only staging secret directory.

`audit-and-close-gate.py` authenticated through the **loopback-only master admin API**, verified the live policy/executions/client flags, confirmed stored OTP and demonstrated temporary lockout after six bad-password attempts. Then revoked sessions and **disabled both the synthetic user and `mfa-gate` client**. No live test login remains enabled.

A follow-up audit also verified actual `rbac-admin` client-credentials exchange and realm-read permission, and an actual `web_app` password-grant request was rejected as `unauthorized_client`. On repeat audit an already-disabled synthetic user is not reenabled; the lockout test correctly reports `SKIPPED_ALREADY_DISABLED` rather than claiming a new lockout test passed. External forged Host/proto/prefix forwarding-header probe preserved the exact approved issuer and authorization endpoint. Nginx clears incoming Forwarded/X-Forwarded-Prefix and overwrites the trusted forwarding values.

Removed the test user and `mfa-gate` client from the host's import fixture after disabling them in the live DB, preventing a future clean import from recreating enabled test access. Recreated **only the owned staging Keycloak container**, waited for healthy, and reran policy/service-account/disabled-identity audits successfully. PostgreSQL and its persistent volume were not recreated or reset. Reviewed infrastructure files are installed root-owned; temporary upload copies in the SSH user's home were removed. `.dockerignore` restricts the Keycloak build context to its Dockerfile, excluding future accidental secret files.

**Validation:** 8/8 original infrastructure policy tests, 5/5 offline Python gate-helper tests, `docker compose config --quiet`, healthy database/Keycloak containers, Nginx syntax and external TLS/route probes PASS. The later `test-app-oidc.py` run against deployed staging also passed: required MFA, real backend RBAC, empty household API, secure session cookie, CSRF logout, and server-side session revocation. `run-app-gate.sh` temporarily routed the test client to the local TLS origin, then restored `/etc/hosts`, Nginx routing, and root maintenance. A separate headless Chromium smoke test through an SSH loopback tunnel rendered the unauthenticated staging home page at 1440×1000: HTTP 200, synthetic manifest confirmed, zero page exceptions. Screenshot is at `C:\Users\admin\AppData\Local\Temp\opencode\police-staging-20261105-3.png`. This is not full authenticated visual/accessibility/load/pentest acceptance; no public production route was opened. Existing browser instructions prohibit automating non-local URLs; no operational browser profile was used. Discovery may advertise the provider's generic password grant capability; per-client direct grant flags were checked disabled.

### Important remaining gates

- No production/citizen records or production schema have been deployed. Synthetic-only backend image `20261105-3` is on the VPS; main site remains maintenance.
- Temporary `staging-bootstrap` master administrator was disabled/retired on 2026-11-05; its secret was replaced and retired credentials rejected. The named `laihoangdo` master admin was verified enabled with the `admin` role and configured OTP. The temporary Keycloak recovery admin was removed. Production still requires approved operator/recovery ownership and independently delivered anomaly alerts.
- Idle/max session lifetimes were verified in live configuration, not by waiting the entire 15-minute/8-hour interval. Actual staging backend session revocation was exercised and passed; rendered-browser acceptance remains open.
- Application masking, audited reveal and read-audit entries shipped 2026-11-05 (see the 2026-11-05 section). Independently retained external audit copy, continuous dependency monitoring and operational alerting remain open gates. Pinned digests prove artifact identity, **not** absence of vulnerabilities; current staging image scan is clean.
- Encrypted local + GCS backups and authenticated staging restore drills are complete. The owner confirms independent paper-key storage and independent Cloud Shell DB restore PASS (details below); alternate-custodian validation and full restored application/login/key/roles acceptance remain required. Let’s Encrypt renewal dry-run DNS failure was resolved on 2026-11-05 through Cloudflare DNS delegation; dry-run PASS.

Gate scripts require the synthetic fixture created by `generate-secrets.py`. Bootstrap refuses existing credentials/config instead of silently rotating them. After the test account/client are disabled, the live MFA test intentionally cannot be rerun without an explicit reviewed reset/new synthetic identity. Do not enable the test identity for cán bộ use or weaken MFA to make automation pass.

## Application staging and local encrypted recovery — 2026-11-04

### Artifact/data boundary

- Audited JSON property metadata without printing records. Legacy `baDiemBuildingsGis.backup.json` contains 360 owner/contact fields; unused `baDiemBoundaryGis.json` contains 8 contact fields. These datasets were **not removed/rewritten** and are not allowed in the synthetic bundle.
- `POLICE_STAGING_SYNTHETIC=true` replaces **only in the staging build** the TC2 schematic/DXF modules with empty, explicitly synthetic fixtures. A Vite input-graph guard refuses known excluded operational/legacy modules; normal builds keep their original datasets/features.
- Maven `prod,vps` packaging excludes sample TLS keystore and dev/sample/TLS config files, retaining original Liquibase history/CSV resources. `audit-staging-artifact.ps1` requires a synthetic manifest, rejects private/sample files/source maps, and verifies that **368 legacy contact strings** do not appear in public JS/JSON. This targeted test is not a comprehensive legal/privacy certification of every reference map asset.
- Uploaded **only the audited JAR and reviewed infrastructure files**, never a repository archive, local `.rbac`, private roster key, source imports or operational database dump. Fresh application key/credentials were generated on VPS.

### Runtime and integration

- `prod,vps` Spring profile uses required configtree secrets, disables Docker lifecycle/Liquibase and activates the existing restricted runtime DB guard. Backend runs as UID 1000, read-only root filesystem, bounded memory/logs, loopback `127.0.0.1:18081` only. No migration/admin credential is mounted into the long-running app.
- Admin migrations run once through the JAR's Liquibase CLI launcher in a short-lived tools container with `!test and !faker`; role provisioning uses the existing SQL and refuses credential overwrite. Fresh staging has **0 households, 0 residents, 0 faker changesets**.
- Added TLS internal identity/admin listener **only** on Docker-host gateway `172.29.40.1:18443`, restricted by Nginx and UFW to the app's fixed private address `172.29.40.10`. Public `/admin/` remains blocked. Actual backend RBAC requests to Keycloak through this TLS path succeeded.
- First image build safely failed because the legacy Docker builder did not recognize per-Dockerfile `.dockerignore`; installed Ubuntu Buildx and require it in bootstrap. No ignore-policy bypass was used.
- Actual deployed backend OAuth → required OTP enrollment → application session → real `/api/rbac/me` role lookup → empty household API → CSRF-protected logout passed. Gate used a fresh synthetic identity, then disabled it. Temporary public OAuth/API routes are restored to maintenance in an EXIT trap on both success and failure; frontend root is not opened publicly.
- Added production-resource HEAD checks. They found a real issue hidden by Vite dev: Spring Security denied signed-in `/content/` map requests. Fixed by allowing authenticated **GET/HEAD only** for the three shared GeoJSON/raster path families; other content and writes remain denied. Added regression tests and deployed immutable image **`police-app-staging:20261104-2`**; image v1/previous JAR/config are retained for rollback. Business/territory APIs were not relaxed.
- V2 actual backend gate PASS, including Secure/HttpOnly JSESSIONID, authenticated GeoJSON + raster + Vietnamese OCR resource responses, real admin-TLS RBAC and session logout. No camera/GIS visual/hardware test is implied by resource HEAD checks. The synthetic gate user was disabled, and temporary public routes reverted after each test, including failures.
- Audited deployed JAR SHA256: `66940b24bb4226624c7e2797b7daefcaedea136fa4fff2577b45c842eef61c35`. Backend package: **21/21 targeted tests PASS** (including new map-resource security regression); frontend: **403/403 PASS**, strict source check PASS, infrastructure policy: **11/11 PASS**. ESLint passes the infrastructure test file; `vite.config.ts` is ignored by the repository's ESLint matching rules and was validated through Vite build instead.

### Encrypted local backup/drill

- `backup-local.sh`: explicit root execution and locking, >=1 GiB free-space guard, full custom dumps of app/Keycloak DBs, role definitions, app key/config/secrets, Nginx and certificate files. Streams archive into **GPG AES-256 symmetric encryption** before publishing the final file; partial files are not successful backups. Backup passphrase is not included in its archive.
- Passphrase stays separately under root-only `/etc/police-management/secrets/local_backup_passphrase`, but **on the same VPS**. This does not protect against loss of the host or root compromise and is not external key escrow. The SHA256 sidecar detects accidental changes; it is not independently anchored tamper evidence.
- `restore-drill.py` authenticated/decrypted a backup, restored app and Keycloak into **new, randomly named** `tc2_restore_vps_*` DBs, checked the application key, matched **47 application/archive table counts/fingerprints** (excluding derived spatial columns), and verified restored realm/disabled-test-identity state. Temporary DBs/plaintext files were removed. It never switched app targets or applied global roles to the active cluster. This is not a clean-machine or live Keycloak-login-from-restore drill.
- Repeated the backup/drill after the v2 update: **PASS** for backup `staging-20261104T160950Z.tar.gz.gpg`; app remains healthy, timer active and Compose validation passes. No production/citizen DB was used in this drill.
- Fresh master initialization produces 47 compared tables; the local operational DB has 48 because of an extra unmanaged **`public.officer_account` (6 rows)** absent from master/source references. Read-only checks found no referencing FK or public/roster function. The old table/data were neither dropped nor transferred. Their retention/purpose needs explicit review before actual cutover; do not recreate a legacy authentication source merely to match table counts.
- Installed daily systemd timer at **17:30 UTC plus up to 5 minutes jitter** (00:30–00:35 Vietnam time), persistent across downtime. The configured oneshot service was run successfully (`Result=success`, `ExecMainStatus=0`) before enabling the timer. No automatic deletion/retention policy was invented. Disk and backup failures are not yet delivered by email.
- Dumps across the two DBs are **not cross-database atomic**. This is daily logical local recovery, not WAL/PITR or a 15-minute RPO. Offsite backup and an independently held recovery key remain mandatory before real-data go-live.

### Historical baseline (2026-11-04; superseded by the 2026-11-05 sections below)

- At this checkpoint frontend **403/403** tests had passed; later work raised the suite to **407/407** and shipped masking/reveal, read auditing and human-inactivity logout (see below).
- The main domain remains a **503 maintenance page**. App/frontend can be inspected through SSH forwarding to loopback 18081; public production onboarding is not approved.
- VPS metadata confirms **`asia-southeast1-a` (Singapore region)**. This region choice is not, by itself, legal approval for citizen-data migration.
- Offsite recovery/key escrow, independent audit retention, alert delivery, cloud firewall review, dependency/image scanning, CVE triage and rendered-browser/load/pentest acceptance were open at this historical checkpoint. See the latest state below; email alert delivery remains deferred by the owner.

## Masking, audited reveal, idle logout and named admin — 2026-11-05

### Identity masking and audited disclosure

- New `CccdProtection` service: every GET response masks citizen identity numbers with the same convention the former client-side code used; full numbers leave the server only through audited reveal endpoints. Legacy client-side AES ciphertext is decrypted server-side for masking/reveal only; the legacy secret is public in shipped bundles, provides no ongoing confidentiality, and must be removed after stored values are re-encrypted with the server-side roster key.
- `RosterService` masks resident identity numbers in detail responses and writes `read` audit entries for household/resident/source access; source originals stay behind `canUpdateInspection`. `ResidentResource` masks list/detail DTOs, rejects masked values on create, and preserves the stored number when an edited screen round-trips a masked value (PUT/PATCH).
- Disclosure endpoints require the new `canRevealIdentity` permission and write `identity-revealed` audit entries with actor/target: `POST /api/residents/{id}/reveal-id` (legacy JPA store) and `POST /api/roster/residents/{id}/identities/{identityId}/reveal` (roster store). `RbacService.auditIndependent` (REQUIRES_NEW) lets read-only transactions persist audit rows. GIS household search writes an audit entry without logging the search term itself.
- Frontend reveal buttons (household modal, residents tab, roster person detail) call only the audited endpoints; the client-side AES decrypt path was removed from the bundle. Idle logout: `useIdleSessionTimeout` warns at 12 minutes and signs out at 14 minutes of real input inactivity — background polling/SSE never resets the timer — in front of the 15-minute server session.

### Tests and artifact

- Artifact audit **PASS** (4872 entries, synthetic manifest, no source maps/private files, 368 legacy contact strings absent). Deployed immutable image **`police-app-staging:20261105-3`**, audited JAR SHA256 `d3a4b4642abcf09c9dcc97f81c91c58d54e97149c4945add54fb3940c3e04a8c`; rollback checkpoint saved under `/root/police-deployment-checkpoints/`. `update-app.sh` verifies the checksum, builds a candidate, requires a clean HIGH/CRITICAL Trivy scan, then invokes the backup/drill + Liquibase migration gate before app rollout. Post-deploy `verify-app.py`: backend UP, frontend 200, synthetic manifest, anonymous RBAC 401, 0 households/residents/faker changesets, restricted runtime active, public go-live still false.
- Build note: IDE Java language servers (Eclipse JDT) compile the project into `target/classes`/`target/test-classes` and their full builds clean those directories, which intermittently broke `testCompile` (`cannot find symbol` / `NoSuchFileException ... templates`) during release builds. Language servers were stopped for the release build. Do **not** use `-Dmaven.compiler.useIncrementalCompilation=false` here: with a clean `target` it produces spurious `cannot find symbol` failures in this setup.

### Named administrator, TLS and edge

- Named first administrator `laihoangdo` was provisioned in realm `police-staging` (`ROLE_SUPERADMIN`) and `master` (`admin`); metadata confirmed OTP enrollment in both. The initial credential remains at root-only `/etc/police-management/secrets/staging/admin-laihoangdo-initial`; owner should remove it after confirming both realm passwords were changed. `staging-bootstrap` was disabled/retired, its secret replaced, and old credentials rejected after named master admin OTP/role prechecks passed.
- Let’s Encrypt renewal dry-run **PASS** through Cloudflare DNS delegation. Origin lockdown verified: UFW 80/443 restricted to official Cloudflare CIDRs, `real_ip` from `CF-Connecting-IP`, external edge + fresh SSH + backend checks PASS (`confirm-cloudflare-origin.py --external-verified`).
- Security note: a `bash -x` debug run of the provisioning script printed the former `staging-bootstrap` master password into the agent transcript. The account was disabled, its secret replaced, and retired credentials rejected; never use `bash -x` on secret-handling scripts.
- Independent Cloud Shell DB restore is owner-reported **PASS** with `restore-tcp-ready-v3` against `staging-20261105T165858Z-28c8bd8f26774611b3d6589b96fc4afc.tar.gz.gpg`: checksum/authentication, both DB restores, Liquibase/realm/retired-admin checks and cleanup passed. Full restored application/key decryption, Keycloak login, grants/roles, reference fingerprints and alternate-custodian access remain open.
- Still open: full application recovery acceptance described above, GCP VPC firewall review, independent audit retention/anomaly alerting (SMTP deferred by owner), continuous dependency monitoring and remaining development-only generator advisory review, `public.officer_account` retention review, rendered-browser/load/pentest acceptance.

## Dependency CVE triage — 2026-11-05

- Frontend dependency remediation is deployed in image `20261105-2`. `npm audit` went from 78 findings to 20 (16 moderate, 2 high, 2 critical); `npm audit --omit=dev` reports **0 production findings**. The remaining high/critical findings are in the development-only JHipster/Yeoman/simple-git generator chain; npm's suggested fix downgrades `generator-jhipster` to 6.10.5, so it was not applied. Track upstream remediation before using the generator on untrusted repositories.
- Addressed frontend findings by updating MapLibre (5.0.0 → 6.16.0; includes fix for CVE-2026-85061), Vite (8.3.0 → 8.3.5), Vitest/coverage (5.0.0 → 5.1.0), concurrently (10.0.5 → 10.0.6), happy-dom (20.14.5 → 21.0.4), and patched transitives including `@grpc/grpc-js`, `re2js`, `follow-redirects`, `minimatch`, and `rimraf`. Updated imports/types for MapLibre 6.
- OSV Maven batch scan of 223 resolved artifacts initially found vulnerable compile-scope Tomcat 11.0.24 and Jackson 2.21.5/3.1.5 (including critical Tomcat authentication/access-control issues and high Jackson DoS issues). Updated Spring Boot parent 4.1.1 → 4.1.2; resolved versions are Tomcat 11.0.27, Jackson 2.21.7 and 3.1.7. Repeat OSV scan: **0 affected Maven package versions** across the resolved tree.
- Verification after frontend updates: Vitest **407/407**, `source:check` PASS, Vite production build PASS, deployment script tests **14/14**, Prettier PASS. Maven's broad Surefire run compiled and ran 242 tests (29 skipped) but retained one `LoggingAspectTest` failure and one `RbacNotificationIntegrationTest` missing-bean error; both failures reproduce with the prior Boot 4.1.1 parent, so they are baseline test issues, not introduced by 4.1.2. Targeted backend security tests rerun against Boot 4.1.2: **23/23 PASS**.
- **Staging migration/deploy complete:** fresh encrypted backup + authenticated restore drill passed (`47` application/archive tables matched); Liquibase `status → update → status` ran against the existing `Monolithic` staging database and reported it already up to date, so no changesets/data were altered. App `20261105-3` is healthy. Its image contains `apt` and `libapt-pkg6.0t64` `2.8.4ubuntu0.1`; Trivy 0.76.2 found **0 vulnerabilities** in the deployed image (Ubuntu and Java). The deployment script now blocks rollout on HIGH/CRITICAL findings. Post-deploy verification still shows 0 households/residents/faker changesets, restricted runtime active, public go-live false. No citizen data was migrated; production remains in maintenance. Continuous dependency monitoring and the remaining owner/security gates are still open.
- **GCS backup verified and scheduled:** VM metadata scopes include `devstorage.read_write`, `logging.write` and `monitoring.write`; fresh SSH, app verify, Nginx/TLS and synthetic Cloud Logging write probe PASS. The owner downloaded an encrypted archive and sidecar in Cloud Shell; `sha256sum -c` returned **OK** for `gs://sunnytech-backups-194646196669/staging/staging-20261105T140400Z.tar.gz.gpg`. The daily systemd backup service now performs local encryption plus create-only GCS upload; a post-deploy manual run succeeded and uploaded `staging-20261105T150902Z-221db1052e304b46810f139460786bc3.tar.gz.gpg`. The VM cannot read/list objects by design. The owner confirms independent paper-key storage and reports GPG PASS; alternate-custodian validation and a clean-machine restore remain required for real-data go-live.

## Production go-live — 2026-11-07

- **Production is serving at `https://sunnytech.cloud`** with the real database. Full evidence trail: `PRODUCTION-CUTOVER.md` (2026-11-07 section); owner steps: `OWNER-ACTIONS.md`.
- Deployed state: image `police-app-production:20261107-2` (JAR SHA256 `23840572f2bc5b114812711f282579d9793bc7eb3ce546e6822787dc77189fc0`; supersedes `20261107-1`, which stays on the host for rollback), profiles `prod,vps,vps-prod`, loopback port `127.0.0.1:18082`, database container `police-production-candidate-db-20261105` on the internal `police-production_database` network, restricted `police_runtime` role, realm `jhipster` imported into the owned Keycloak 26.7.4 with sample accounts disabled, the named operator forced through password+OTP enrollment, `rbac-admin` secret rotated and brute-force protection enabled.
- Pre-cutover `verify-production.py` **PASS** (health, real-data counts 1,291/5,074, no synthetic manifest, anonymous RBAC 401, public realm discovery issuer, internal RBAC gateway 401, maintenance 503). `cutover-production.sh` flipped nginx atomically with auto-rollback (prior configs under `/root/police-nginx-cutover-20261107T090301Z`, marker `CUTOVER_ACTIVE` 2026-11-07T09:03:04Z); independent workstation checks through Cloudflare confirmed root 200, correct issuer, RBAC 401, manifest 404.
- Production backups: daily timer at 18:31 UTC (`police-production-backup.timer`), local encrypted archive + create-only GCS upload; first archive `production-20261107T090242Z-9eb0461669be451383fce9f0305c707e.tar.gz.gpg` uploaded with receipt. The audit exporter now mirrors both databases and its heartbeat watches the production app.
- Operational notes for future runs: local Keycloak realm exports carry a dev `frontendUrl` that must be normalized to the production hostname (strict hostname mode rejects mismatches); Cloudflare rejects default `Python-urllib` user agents, so public-route checks use curl; host-originated probes of the internal gateway must run inside the app's network namespace (`nsenter`) to match the allow-list; a `--network none` container cannot be connected to another network and must be recreated (named volume keeps the data); the application CSP `connect-src` must keep `data: blob:` because the local raster pipeline rewrites out-of-catalog tiles to a transparent PNG data URL that MapLibre fetches.
- Post-cutover hotfix (2026-11-07): `connect-src` gained `data: blob:` and the app rolled to `20261107-2` via `update-production-app.py` after a fresh offsite backup; details in `PRODUCTION-CUTOVER.md`. A stricter follow-up (MapLibre `addProtocol` returning the placeholder bytes directly, allowing `data:` to be dropped again) remains open.
- Still open: missing-heartbeat alert policy owner evidence, uncommitted repository state on `develop/3d-map`, owner first-login completion and the disabled `user` account's hamlet reassignment, independent restore drill against a production archive, and the previously recorded not-tested/owner-risk-acceptance gates.
