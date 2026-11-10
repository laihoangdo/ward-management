const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = name => fs.readFileSync(path.join(__dirname, '..', 'infra', 'vps', name), 'utf8').replace(/\r\n/g, '\n');

test('bootstrap and HTTPS maintenance never proxy application or identity data', () => {
  for (const name of ['nginx-bootstrap.conf', 'nginx-https-maintenance.conf']) {
    const config = read(name);
    assert.doesNotMatch(config, /\bproxy_pass\b/);
    assert.match(config, /return 503/);
    assert.match(config, /server_name sunnytech\.cloud;/);
    assert.doesNotMatch(config, /listen\s+(?:5432|8080|9080)/);
  }
});

test('maintenance access log excludes query strings, authorization and cookies', () => {
  for (const name of ['nginx-bootstrap.conf', 'nginx-https-maintenance.conf']) {
    const format = read(name).match(/log_format police_bootstrap[^;]+;/)?.[0];
    assert.ok(format);
    assert.match(format, /\$uri\b/);
    assert.doesNotMatch(format, /\$(?:request|request_uri|args|query_string|http_cookie|http_authorization)\b/);
  }
});

test('HTTPS requires the real certificate and rejects unknown SNI', () => {
  const config = read('nginx-https-maintenance.conf');
  assert.match(config, /ssl_certificate \/etc\/letsencrypt\/live\/sunnytech\.cloud\/fullchain\.pem;/);
  assert.match(config, /ssl_protocols TLSv1\.2 TLSv1\.3;/);
  assert.match(config, /ssl_reject_handshake on;/);
  assert.match(config, /ssl_session_tickets off;/);
  assert.match(config, /Strict-Transport-Security "max-age=86400" always;/);
  assert.doesNotMatch(config, /add_header Strict-Transport-Security[^;]*(?:includeSubDomains|preload)/);
});

test('issuance checks approved DNS before contacting ACME', () => {
  const script = read('issue-certificate.sh');
  assert.match(script, /set -euo pipefail/);
  assert.match(script, /expected_ip=34\.143\.223\.166/);
  assert.ok(script.indexOf('getent ahostsv4') < script.indexOf('certbot certonly'));
  assert.match(script, /--webroot-path \/var\/lib\/police-acme/);
  assert.doesNotMatch(script, /--force-renewal|--register-unsafely-without-email/);
});

test('renewal hook validates Nginx before reload', () => {
  const script = read('reload-nginx-after-renewal.sh');
  assert.match(script, /set -euo pipefail/);
  assert.ok(script.indexOf('nginx -t') < script.indexOf('systemctl reload'));
});

test('staging identity database has no published port and uses SCRAM file secrets', () => {
  const compose = read('staging/compose.yml');
  const database = compose.match(/ {2}database:\n([\s\S]*?)\n {2}keycloak:/)?.[1];
  assert.ok(database);
  assert.doesNotMatch(database, /^\s+ports:/m);
  assert.match(database, /--auth-host=scram-sha-256 --auth-local=scram-sha-256/);
  assert.match(database, /POSTGRES_PASSWORD_FILE:/);
  assert.doesNotMatch(database, /POSTGRES_PASSWORD:/);
  assert.match(compose, /postgis\/postgis@sha256:[a-f0-9]{64}/);
});

test('Keycloak staging uses optimized production mode, bounded logs and loopback publishing', () => {
  const compose = read('staging/compose.yml');
  assert.match(compose, /127\.0\.0\.1:18080:8080/);
  assert.doesNotMatch(compose, /start-dev/);
  assert.match(compose, /--optimized/);
  assert.match(compose, /read_only: true/);
  assert.match(compose, /KC_PROXY_TRUSTED_ADDRESSES: 172\.29\.40\.1\/32/);
  assert.match(compose, /max-size: '10m'/);
  assert.doesNotMatch(compose, /KC_DB_PASSWORD:/);
  assert.match(read('staging/Keycloak.Dockerfile'), /FROM quay\.io\/keycloak\/keycloak@sha256:[a-f0-9]{64}/);
});

test('identity staging publishes only the synthetic realm, preserves maintenance and blocks admin', () => {
  const config = read('staging/nginx-identity-staging.conf');
  assert.match(config, /location \^~ \/realms\/police-staging\//);
  assert.match(config, /location \^~ \/admin\/ \{ return 404; \}/);
  assert.match(config, /return 503/);
  assert.match(config, /limit_req_status 429/);
  const proxy = read('staging/nginx-identity-proxy.conf');
  assert.match(proxy, /proxy_set_header X-Forwarded-For \$remote_addr;/);
  assert.match(proxy, /proxy_set_header Forwarded "";/);
  assert.match(proxy, /proxy_set_header X-Forwarded-Prefix "";/);
  assert.doesNotMatch(proxy, /\$proxy_add_x_forwarded_for/);
});

test('application uses non-root pinned runtime and loopback-only backend publishing', () => {
  const dockerfile = read('staging/App.Dockerfile');
  assert.match(dockerfile, /FROM eclipse-temurin@sha256:[a-f0-9]{64}/);
  assert.match(dockerfile, /USER 1000:1000/);
  const compose = read('staging/app.compose.yml');
  assert.match(compose, /127\.0\.0\.1:18081:8080/);
  assert.match(compose, /SPRING_PROFILES_ACTIVE: prod,vps/);
  assert.doesNotMatch(compose, /SPRING_DATASOURCE_PASSWORD|secret-samples/);
  assert.match(compose, /profiles: \[tools\]/);
});

test('internal identity administration is TLS and restricted to the application address', () => {
  const config = read('staging/nginx-internal-identity.conf');
  assert.match(config, /listen 172\.29\.40\.1:18443 ssl;/);
  assert.match(config, /allow 172\.29\.40\.10\/32;/);
  assert.match(config, /deny all;/);
  assert.doesNotMatch(config, /listen (?:0\.0\.0\.0:)?18443/);
});

test('local recovery encrypts before committing a backup and does not archive its passphrase', () => {
  const backup = read('staging/backup-local.sh');
  assert.match(backup, /set -euo pipefail/);
  assert.match(backup, /flock -n 9/);
  assert.match(backup, /--symmetric --cipher-algo AES256/);
  assert.match(backup, /--passphrase-file/);
  assert.match(backup, /secrets\/staging/);
  assert.doesNotMatch(backup.match(/tar -czf[^\n]+/)?.[0] || '', /local_backup_passphrase/);
  assert.match(read('staging/restore-drill.py'), /tc2_restore_vps_/);
  assert.match(read('staging/restore-drill.py'), /--no-owner/);
  assert.doesNotMatch(read('staging/restore-drill.py'), /DROP DATABASE "Monolithic"/);
});

test('named admin provisioning is root-only, idempotent and never exposes the initial secret', () => {
  const script = read('staging/provision-named-admin.sh');
  assert.match(script, /set -euo pipefail/);
  assert.match(script, /umask 077/);
  assert.match(script, /\[\[ \$\{EUID\} -eq 0 \]\] \|\| exit 1/);
  // Refuses to regenerate over an existing credential file or existing users.
  assert.match(script, /\[\[ ! -e "\$initial" \]\]/);
  assert.match(script, /User already exists in realm/);
  // The one-time password is generated on the VPS and only ever written to the
  // root-only file; it is never echoed, logged or transmitted.
  assert.match(script, /openssl rand -hex/);
  assert.match(script, /chmod 0600 "\$initial"/);
  assert.match(script, /chown root:root "\$initial"/);
  assert.doesNotMatch(script, /(?:echo|printf)[^\n]*\$password(?![^\n]*>)/);
  assert.doesNotMatch(script, /set -x/);
  // kcadm session stays in container /tmp and is removed on exit.
  assert.match(script, /--config \/tmp\/police-kcadm\.config/);
  assert.match(script, /trap cleanup_kcadm EXIT/);
  // Regression: grep -q in a pipeline SIGPIPEs under pipefail even on match.
  assert.doesNotMatch(script, /\|\s*grep -q/);
  assert.match(script, /case "\$realm_roles" in/);
  // Keycloak 26 normalizes CONFIGURE_OTP; master needs the explicit update.
  assert.match(script, /requiredActions=\["UPDATE_PASSWORD","CONFIGURE_TOTP"\]/);
  assert.match(script, /set-password -r "\$app_realm" --userid "\$app_id" --new-password "\$password" --temporary/);
  assert.match(script, /add-roles -r "\$app_realm" --uid "\$app_id" --rolename ROLE_SUPERADMIN/);
  // Self-verification of actions and role mappings before reporting success.
  assert.match(script, /OTP enrollment action missing in master/);
  assert.match(script, /role-mappings\/realm" -r "\$app_realm"/);
  assert.match(script, /role-mappings\/realm" -r master/);
});

test('staging app update verifies the audited checksum and rolls back on failed health gate', () => {
  const script = read('staging/update-app.sh');
  assert.match(script, /set -euo pipefail/);
  assert.match(script, /umask 077/);
  assert.match(script, /\[\[ \$\{EUID\} -eq 0 \]\] \|\| exit 1/);
  // The upload directory must be normalized before cd so relative paths survive.
  assert.match(script, /source_dir=\$\(readlink -f/);
  assert.ok(script.indexOf('readlink -f') < script.indexOf('cd "$destination"'));
  assert.match(script, /\[\[ "\$expected" =~ \^\[A-Fa-f0-9\]\{64\}\$ \]\]/);
  assert.ok(script.indexOf('sha256sum') < script.indexOf('docker build'));
  assert.ok(script.indexOf('docker build') < script.indexOf('trivy') && script.indexOf('trivy') < script.indexOf('docker image tag'));
  assert.ok(script.indexOf('docker image tag') < script.indexOf('migrate-existing-staging-db.sh'));
  assert.match(script, /--severity HIGH,CRITICAL --exit-code 1/);
  assert.match(script, /Trivy is required; staging rollout blocked/);
  assert.match(script, /candidate="\$image-candidate-/);
  // Immutable release tags are never overwritten in place.
  assert.match(script, /Release tag exists; do not overwrite immutable staging release/);
  // Rollback checkpoint is created before install and restored on failure.
  assert.match(script, /checkpoint="\/root\/police-deployment-checkpoints\/app-before-20261105-3-\$stamp"/);
  assert.ok(script.indexOf('install -d -m 0700 "$checkpoint"') < script.indexOf('install -m 0444'));
  assert.ok(script.indexOf('migrate-existing-staging-db.sh') < script.indexOf('up -d --no-deps --wait'));
  assert.match(script, /Health gate failed; reverted to previous staged image\/config/);
  assert.match(script, /docker compose -f compose\.yml -f app\.compose\.yml up -d --no-deps --wait/);
  assert.match(script, /verify-app\.py/);
});

test('staging app image upgrades vulnerable Ubuntu apt packages and verifies fixed versions', () => {
  const dockerfile = read('staging/App.Dockerfile');
  assert.match(dockerfile, /apt-get update/);
  assert.match(dockerfile, /apt-get install --yes --only-upgrade apt libapt-pkg6\.0t64/);
  assert.match(dockerfile, /dpkg --compare-versions .*apt.* ge 2\.8\.4ubuntu0\.1/);
  assert.match(dockerfile, /dpkg --compare-versions .*libapt-pkg6\.0t64.* ge 2\.8\.4ubuntu0\.1/);
  assert.match(dockerfile, /rm -rf \/var\/lib\/apt\/lists\/\*/);
  assert.match(dockerfile, /USER 1000:1000/);
});

test('temporary app gate tests the local TLS origin and always restores maintenance and hosts', () => {
  const script = read('staging/run-app-gate.sh');
  assert.match(script, /set -euo pipefail/);
  assert.match(script, /Unexpected active site; refusing test routing/);
  assert.match(script, /Existing sunnytech\.cloud host mapping found/);
  assert.match(script, /127\.0\.0\.1 sunnytech\.cloud # temporary police app gate/);
  assert.match(script, /ln -sfn "\$previous" "\$site"/);
  assert.match(script, /cat "\$hosts_backup" > "\$hosts"/);
  assert.match(script, /trap cleanup EXIT/);
  assert.match(script, /python3 \/opt\/police-management\/staging\/test-app-oidc\.py/);
});

test('master console window is loopback-only and rolls back to staging maintenance', () => {
  const script = read('staging/open-master-admin-window.sh');
  assert.match(script, /set -euo pipefail/);
  assert.match(script, /Expected synthetic identity\/maintenance site is not active/);
  assert.match(script, /Keycloak must be healthy/);
  assert.match(script, /location \^~ \/admin\//);
  assert.match(script, /location \^~ \/realms\/master\//);
  assert.match(script, /admin_stub = ' {4}location \^~ \/admin\/ \{ return 404; \}'/);
  assert.match(script, /source\.replace\(admin_stub, admin_route\)/);
  assert.equal((script.match(/allow 127\.0\.0\.1;/g) || []).length, 2);
  assert.equal((script.match(/deny all;/g) || []).length, 2);
  assert.match(script, /trap cleanup EXIT/);
  assert.match(script, /ln -sfn "\$previous" "\$site"/);
  assert.match(script, /sleep 900/);
  assert.doesNotMatch(script, /allow all|0\.0\.0\.0\/0|set -x/);
});

test('bootstrap retirement requires a healthy named OTP admin and preserves public maintenance', () => {
  const script = read('staging/recover-retire-bootstrap-admin.sh');
  assert.match(script, /set -euo pipefail/);
  assert.match(script, /Public root is not 503 maintenance/);
  assert.match(script, /Keycloak requires all nodes stopped/);
  assert.match(script, /bootstrap-admin user/);
  assert.match(script, /wait_keycloak_initialized/);
  assert.match(script, /username=laihoangdo/);
  assert.match(script, /CONFIGURE_TOTP/);
  assert.match(script, /users\/\$owner_id\/credentials/);
  assert.match(script, /users\/\$owner_id\/role-mappings\/realm/);
  assert.match(script, /set-password -r master/);
  assert.match(script, /update "users\/\$bootstrap_id" -r master -s enabled=false/);
  assert.match(script, /mv -f "\$temporary_secret" "\$bootstrap_secret"/);
  assert.match(script, /--force-recreate --wait --wait-timeout 300 keycloak/);
  assert.match(script, /Public root left maintenance unexpectedly/);
  assert.match(script, /Retired bootstrap credentials still authenticate/);
  assert.match(script, /Temporary recovery credentials still authenticate/);
  assert.doesNotMatch(script, /set -x|printf '%s\\n'[^\n]*\$(?:new_password|recovery_password)/);
});

test('independent restore waits for final PostgreSQL TCP listener instead of temporary initialization server', () => {
  const script = read('staging/restore-independent.py');
  assert.match(script, /pg_isready', '-h', '127\.0\.0\.1'/);
  assert.match(script, /pg_restore', '-h', '127\.0\.0\.1'/);
  assert.match(script, /psql', '-h', '127\.0\.0\.1'/);
  assert.match(script, /'--network', 'none'/);
  assert.match(script, /restore-tcp-ready-v3/);
});

test('VPN preparation keeps existing SSH and does not silently enroll a tailnet identity', () => {
  const script = read('prepare-tailscale.sh');
  assert.match(script, /signed-by=\/usr\/share\/keyrings\/tailscale-archive-keyring.gpg/);
  assert.match(script, /ufw allow in on tailscale0 to any port 22 proto tcp/);
  assert.doesNotMatch(script, /ufw (?:delete|deny)|tailscale up|--auth-key/);
  const lockdown = read('lockdown-ssh-vpn.sh');
  assert.match(lockdown, /SSH_CONNECTION/);
  assert.match(lockdown, /systemd-run --unit=police-ssh-vpn-rollback --on-active=5m/);
  assert.ok(lockdown.indexOf('systemd-run') < lockdown.indexOf('ufw --force delete'));
  assert.match(lockdown, /ufw --force delete allow 22\/tcp comment 'SSH retained during police deployment'/);
});

test('cloud audit exporter minimizes payloads, tracks delivered IDs and emits health heartbeat', () => {
  const script = read('staging/export-cloud-audit.py');
  assert.match(script, /hmac\.new/);
  assert.match(script, /detailsOmitted/);
  assert.match(script, /partialSuccess': False/);
  assert.match(script, /INSERT OR IGNORE INTO delivered/);
  assert.match(script, /operations_heartbeat/);
  assert.match(script, /backup_age > 27 \* 3600/);
  assert.doesNotMatch(script, /SELECT \*|SELECT[^\n]*\bdetails\b|print\([^\n]*(?:token|row\[)/);
  const setup = read('cloud-shell-observability.py');
  assert.match(setup, /retentionDays': 90/);
  assert.match(setup, /conditionAbsent/);
  assert.match(setup, /conditionMatchedLog/);
  assert.match(setup, /laihoangdo0506@gmail\.com/);
  assert.match(setup, /NOT PASS YET/);
});

test('local production-source snapshot is read-only, consistent, private and encrypted without upload', () => {
  const script = fs.readFileSync(path.join(__dirname, 'snapshot-local-production-source.py'), 'utf8');
  assert.match(script, /ISOLATION LEVEL REPEATABLE READ READ ONLY/);
  assert.match(script, /pg_export_snapshot/);
  assert.match(script, /--snapshot=/);
  assert.match(script, /CryptUnprotectData/);
  assert.match(script, /\/inheritance:r/);
  assert.match(script, /--passphrase-fd/);
  assert.match(script, /--symmetric/);
  assert.match(script, /--decrypt/);
  assert.doesNotMatch(script, /(?:DROP DATABASE|TRUNCATE|ALTER TABLE|pg_restore|scp|storage cp)/i);
});

test('identity export restarts the source and exports from a separate offline clone', () => {
  const script = fs.readFileSync(path.join(__dirname, 'snapshot-local-keycloak.py'), 'utf8');
  assert.match(script, /'docker', 'stop', '--time', '45', SOURCE/);
  assert.match(script, /'docker', 'start', SOURCE/);
  assert.match(script, /'--network', 'none'/);
  assert.match(script, /subjects\.issubset\(exported_ids\)/);
  assert.match(script, /'docker', 'rm', '-f', '-v', clone/);
  assert.doesNotMatch(script, /'docker', 'rm'[^\n]*SOURCE/);
});

test('operational restore is offsite-backed, isolated, reconciled and never a public cutover', () => {
  const script = read('restore-production-candidate.py');
  assert.match(script, /Offsite upload receipt required/);
  assert.match(script, /'--network', 'none'/);
  assert.match(script, /all 51 table counts\/fingerprints match/);
  assert.match(script, /publicGoLive': False/);
  assert.match(script, /runtimeGrantsRestored': False/);
  assert.doesNotMatch(script, /DROP DATABASE|TRUNCATE|nginx -s|--publish|0\.0\.0\.0:/);
});

test('update-app release tag matches the deployed compose file', () => {
  const script = read('staging/update-app.sh');
  const compose = read('staging/app.compose.yml');
  const tag = script.match(/image=police-app-staging:([\w.-]+)/)?.[1];
  assert.ok(tag);
  const composeTags = [...compose.matchAll(/police-app-staging:([\w.-]+)/g)].map(m => m[1]);
  assert.ok(composeTags.length >= 2);
  for (const composeTag of composeTags) {
    assert.equal(composeTag, tag);
  }
});

test('existing staging DB migration requires a verified encrypted backup and Liquibase-only update', () => {
  const script = read('staging/migrate-existing-staging-db.sh');
  assert.match(script, /set -euo pipefail/);
  assert.match(script, /umask 077/);
  assert.match(script, /\[\[ \$\{EUID\} -eq 0 \]\]/);
  assert.match(script, /flock -n 9/);
  assert.ok(script.indexOf('backup-and-drill.sh') < script.indexOf('run --rm migrate'));
  assert.match(script, /PASS: encrypted backup authenticated/);
  assert.match(script, /--defaultsFile=\/run\/secrets\/migration\.properties status/);
  assert.match(script, /--defaultsFile=\/run\/secrets\/migration\.properties update/);
  assert.match(script, /is up to date/);
  assert.doesNotMatch(script, /(?:liquibase|psql|docker)[^\n]*(?:drop|reset|rollback|seed)/i);
  assert.doesNotMatch(script, /cat \/etc\/police-management\/secrets|set -x/);
});

test('offsite uploader sends only encrypted uniquely named backups with create-only VM IAM', () => {
  const script = read('upload-offsite-backup.sh');
  assert.match(script, /set -euo pipefail/);
  assert.match(script, /Only an owned encrypted staging backup path is allowed/);
  assert.match(script, /staging-\[0-9\]\{8\}T\[0-9\]\{6\}Z\\\.tar\\\.gz\\\.gpg/);
  assert.match(script, /sha256sum --check --status/);
  assert.match(script, /gs:\/\/sunnytech-backups-194646196669/);
  assert.match(script, /uploadType':'resumable/);
  assert.match(script, /Authorization','Bearer '\+token/);
  assert.match(script, /uuid4\(\)/);
  assert.match(script, /remote_object="staging\/\$\{base\}-\$\{upload_id\}\.tar\.gz\.gpg"/);
  assert.match(script, /destination="\$bucket\/\$remote_object"/);
  assert.match(script, /upload_one "\$file" "\$remote_object"/);
  assert.match(script, /BACKUP_OBJECT="\$destination"/);
  assert.doesNotMatch(script, /if-generation-match|storage cp[^\n]*(?:passphrase|\.sql|\.tar\.gz(?!\.gpg))/i);
  assert.match(script, /create-only/);
});

test('production identity preparation preserves UUIDs and hardens the realm without printing secrets', () => {
  const script = read('prepare-production-identity.py');
  assert.match(script, /Checksum mismatch/);
  assert.match(script, /SAMPLE = \{'admin', 'user'\}/);
  assert.match(script, /user\['enabled'\] = False/);
  assert.match(script, /user\['credentials'\] = \[\]/);
  assert.match(script, /'UPDATE_PASSWORD', 'CONFIGURE_OTP'/);
  assert.match(script, /'realmRoles': \['ROLE_USER', 'ROLE_ADMIN', 'ROLE_SUPERADMIN'\]/);
  assert.match(script, /redirectUris'\] = \['https:\/\/sunnytech\.cloud\/login\/oauth2\/code\/oidc'\]/);
  assert.match(script, /\['post\.logout\.redirect\.uris'\] = 'https:\/\/sunnytech\.cloud'/);
  assert.match(script, /bruteForceProtected'\] = True/);
  assert.match(script, /registrationAllowed'\] = False/);
  assert.match(script, /frontendUrl'\] = 'https:\/\/sunnytech\.cloud'/);
  assert.match(script, /operator-initial/);
  assert.doesNotMatch(script, /print\(.*(password|secret|temporary)/);
});

test('production runtime role provisioning is restricted and verified', () => {
  const script = read('provision-production-database.py');
  assert.match(script, /runtimeGrantsRestored/);
  assert.match(script, /database-runtime-role\.sql/);
  assert.match(script, /!= 'f':/);
  assert.match(script, /expect_failure=True/);
  assert.match(script, /data\.key/);
  assert.doesNotMatch(script, /DROP DATABASE|TRUNCATE|CREATE ROLE [^\n]*superuser/i);
});

test('production app deployment stays off the public route until explicit cutover', () => {
  const script = read('deploy-production-app.py');
  assert.match(script, /127\.0\.0\.1:18082:8080/);
  assert.match(script, /internal: true/);
  assert.match(script, /publicGoLive': False/);
  assert.match(script, /did not become healthy/);
  assert.doesNotMatch(script, /0\.0\.0\.0:|DROP /);
});

test('production migration backs up, drills a restore and only then runs Liquibase update', () => {
  const script = read('migrate-production-db.sh');
  assert.match(script, /set -euo pipefail/);
  assert.match(script, /flock -n 9/);
  const backup = script.indexOf('backup-production-offsite.sh');
  const drill = script.indexOf('pg_restore');
  const before = script.indexOf('liquibase status >');
  const update = script.indexOf('liquibase update >');
  const after = script.lastIndexOf('liquibase status >');
  assert.ok(backup > 0 && backup < drill && drill < before && before < update && update < after);
  assert.match(script, /--exit-on-error/);
  assert.match(script, /Restored drill counts differ/);
  assert.match(script, /contexts=!test and !faker/);
  assert.match(script, /is up to date/);
  // Credentials only on tmpfs for the run, removed on every exit; the tools container has no ports.
  assert.match(script, /mktemp -d \/run\/police-migrate\./);
  assert.match(script, /trap cleanup EXIT/);
  assert.match(script, /rm -rf -- "\$secrets_dir"/);
  assert.ok(script.indexOf('trap cleanup EXIT') < script.indexOf('secrets_dir=$(mktemp'));
  // Truncating a stream with head exits 141 under pipefail; that aborted the first production run.
  assert.doesNotMatch(script, /\|\s*head\b/);
  assert.match(script, /--network "\$network" --read-only/);
  assert.match(script, /--cap-drop ALL/);
  assert.doesNotMatch(script, /\s-p\s|--publish|dropAll|drop-all|rollback|clear-checksums|changelog-sync|DROP SCHEMA|DROP TABLE/i);
});

test('production update verifies, scans and migrates before swapping, and rolls back on failure', () => {
  const script = read('update-production-app.py');
  const checksum = script.indexOf("STAGE = 'artifact-checksum'");
  const scan = script.indexOf("STAGE = 'vulnerability-scan'");
  const migrate = script.indexOf("STAGE = 'database-migration'");
  const swap = script.indexOf("STAGE = 'swap-image'");
  assert.ok(checksum > 0 && checksum < scan && scan < migrate && migrate < swap);
  assert.match(script, /'--severity', 'HIGH,CRITICAL',\s*'--exit-code', '1'/);
  assert.match(script, /release\.jar in the image does not match the audited SHA256/);
  assert.match(script, /if rollback:\n\s+STAGE = 'backup-freshness-gate'\n\s+require_recent_backup\(\)/);
  assert.match(script, /STAGE = 'automatic-rollback'\n\s+pin\(previous\)/);
  assert.match(script, /str\(VERIFY\)/);
});

test('live production verification expects the public site and present data, not maintenance', () => {
  const script = read('verify-production-live.py');
  assert.match(script, /curl\('https:\/\/sunnytech\.cloud\/'\)\[0\] == '200'/);
  assert.match(script, /households > 0 and residents > 0/);
  assert.match(script, /police_runtime/);
  assert.match(script, /issuer'\] == 'https:\/\/sunnytech\.cloud\/realms\/jhipster'/);
  assert.doesNotMatch(script, /'503'|'1291'|'5074'/);
});

test('production verification requires real data, no synthetic marker and maintenance until cutover', () => {
  const script = read('verify-production.py');
  assert.match(script, /'1291'/);
  assert.match(script, /'5074'/);
  assert.match(script, /staging-manifest\.json'\)\[0\] == 404/);
  assert.match(script, /maintenance-still-active/);
  assert.match(script, /police_runtime/);
});

test('production realm import is idempotent and verified through discovery', () => {
  const script = read('attach-production-realm-import.py');
  assert.match(script, /realm-production\.json:ro/);
  assert.match(script, /Expected staging import mount not found exactly once/);
  assert.match(script, /State\.Health\.Status/);
  assert.match(script, /Unexpected production issuer/);
  assert.match(script, /keycloakImported'\] = True/);
});

test('production cutover is atomic with automatic rollback to maintenance', () => {
  const script = read('cutover-production.sh');
  assert.match(script, /set -euo pipefail/);
  assert.match(script, /trap rollback ERR/);
  assert.match(script, /police-production\.conf/);
  assert.match(script, /\/realms\/jhipster\//);
  assert.match(script, /nginx -t/);
  assert.match(script, /CUTOVER_ACTIVE/);
  assert.doesNotMatch(script, /rm -[^\n]*sites-available/);
});

test('production backups are encrypted, verified and uploaded create-only offsite', () => {
  const local = read('backup-production-local.sh');
  assert.match(local, /flock -n 9/);
  assert.match(local, /--passphrase-file "\$key"/);
  assert.match(local, /production-\$\(date -u \+%Y%m%dT%H%M%SZ\)\.tar\.gz\.gpg/);
  assert.match(local, /secrets\/production/);
  const uploader = read('upload-production-backup.py');
  assert.match(uploader, /production-\[0-9\]\{8\}T\[0-9\]\{6\}Z/);
  assert.match(uploader, /Checksum mismatch/);
  assert.match(uploader, /production-backups\//);
  assert.match(uploader, /'uploadType': 'resumable'/);
  assert.match(uploader, /uuid4\(\)/);
});

test('audit exporter covers both databases with namespaced delivered IDs', () => {
  const script = read('export-cloud-audit.py');
  assert.match(script, /\('staging', staging_query\), \('production', production_query\)/);
  assert.match(script, /delivered_v2/);
  assert.match(script, /rbac-prod-'/);
  assert.match(script, /18082/);
  assert.match(script, /detailsOmitted': True/);
});

test('application CSP allows maplibre data and blob fetches', () => {
  const config = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'resources', 'config', 'application.yml'), 'utf8');
  assert.match(config, /connect-src 'self' https: ws: wss: data: blob:;/);
  assert.doesNotMatch(config, /connect-src 'self' https: ws: wss:;/);
});
