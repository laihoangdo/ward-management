# Owner actions required before go-live

Singapore storage was explicitly approved. GCS and Cloudflare were selected. Email alert delivery was explicitly deferred; this does not mean monitoring or audit has been accepted.

## 1. GCS backup — owner setup and archive verification complete

The owner ran both reviewed Cloud Shell scripts for project **`project-c5680fe1-4087-4ff9-829`**. The VPS was rebooted for the scope change; fresh SSH, staging health, Nginx/TLS and a synthetic Cloud Logging write probe now pass. Metadata scopes include `devstorage.read_write`, `logging.write` and `monitoring.write`; no broad `cloud-platform` scope or service-account key was introduced.

An encrypted synthetic-staging archive and checksum were uploaded successfully with the VM's bucket-scoped **Object Creator** role (no object read/list/delete). The owner downloaded both objects in Cloud Shell and confirmed the checksum returned `OK`. Verified object URI:

```text
gs://sunnytech-backups-194646196669/staging/staging-20261105T140400Z.tar.gz.gpg
```

The checksum sidecar is that URI plus `.sha256`. For reproducibility, the verification command was:

```bash
archive='staging-20261105T140400Z.tar.gz.gpg'
gcloud storage cp "gs://sunnytech-backups-194646196669/staging/$archive" .
gcloud storage cp "gs://sunnytech-backups-194646196669/staging/$archive.sha256" .
expected=$(awk '{print $1}' "$archive.sha256")
printf '%s  %s\n' "$expected" "$archive" | sha256sum -c -
```

Report only whether checksum verification passed; do not share credentials or the decryption passphrase. The VPS uploader uses the resumable JSON API because `gcloud storage cp` performs a metadata read that the deliberately narrow create-only role does not allow. The Cloud Shell setup selected Singapore, uniform access, public access prevention and a 30-day minimum retention; no retention lock or automatic object expiry was configured. Storage charges apply and the owner should monitor accumulated backups.

## 2. Cloudflare Free and Mat Bao

In **your own Cloudflare account**:

1. Add `sunnytech.cloud`, select Free, and enable MFA on the Cloudflare administrator account.
2. Preserve unrelated DNS/MX/TXT records. Set root `A @` to **34.143.223.166** and enable proxy (orange cloud). Do not add an unverified AAAA.
3. Copy the **two nameservers assigned by Cloudflare**. At Mat Bao, change the domain's authoritative nameservers to those exact two names. They are not secrets and can be shared with the deployment agent. Do not send API tokens or account passwords in chat.
4. Configure TLS **Full (strict)**, never Flexible. Existing origin certificate is valid. Keep authorization/API/login/logout responses uncached. Ensure ACME `/.well-known/acme-challenge/` can pass without caching or an interactive challenge.
5. Enable the Free Managed Ruleset if available. Use only the WAF/rate-limiting features actually offered by the current Free dashboard; do not assume the paid OWASP ruleset/advanced quotas are included. Do not apply browser challenges to token/API endpoints; use compatible rate limits/block rules instead.
6. Leave Rocket Loader and untested HTML/JS optimization off. For the initial security gate, bypass Cloudflare caching for the whole application hostname (or at minimum API/realm/OAuth/login/admin/ACME paths); application/token responses must respect `no-store` and never be edge-cached. Cache tuning for verified public hashed assets can be reviewed later.

**Do not remove broad origin firewall access before Cloudflare propagation and an end-to-end check.** After proxy routing is proven, the agent will configure trusted real-IP ranges from Cloudflare's official published CIDRs and restrict origin HTTP(S) while preserving private backend TLS/discovery and administrator SSH access. Historical origin IP exposure cannot be erased simply by enabling the proxy.

Changing nameservers is an owner-controlled operation. No Cloudflare account, DNS API token or Mat Bao password has been read or used by the agent.

### GCP VPC firewall review (read-only)

Owner-provided effective-firewall evidence shows ingress SSH 22, RDP 3389, HTTP 80 and HTTPS 443 allowed from `0.0.0.0/0`, all TCP/UDP plus ICMP from `10.128.0.0/9`, and public ICMP. Firewall logging is disabled on those rules. Review evidence is collected but remediation is **not PASS**. Target VM: `instance-household`, internal `10.148.0.3`, public `34.143.223.166`, tags `http-server` and `https-server`. Existing host UFW restricts origin HTTP(S) to Cloudflare but still allows SSH from anywhere, including IPv6.

The owner chose to retain workstation alias `ssh gcp-vps` and defer VPN; IAP is not the selected migration path. Do not cut off existing SSH or modify shared `default-*` rules without a tested replacement. Production needs an approved restricted SSH path (fixed administrator CIDR or tested VPN), and VM-scoped origin/RDP/internal-ingress remediation with rollback. Keeping an SSH alias does not require Internet-wide SSH access.

The VM OAuth scope/IAM does not permit the deployment agent to inspect project firewall rules, and this workstation has no `gcloud` CLI. In the authorized project-owner Cloud Shell, run this read-only review:

```bash
project=project-c5680fe1-4087-4ff9-829
instance=instance-household
zone=asia-southeast1-a
network=$(gcloud compute instances describe "$instance" --project="$project" --zone="$zone" --format='value(networkInterfaces[0].network)')
gcloud compute instances describe "$instance" --project="$project" --zone="$zone" \
  --format='json(name,tags.items,serviceAccounts[].email,networkInterfaces[].network,networkInterfaces[].accessConfigs[].natIP)'
gcloud compute firewall-rules list --project="$project" --filter="network=$network" \
  --format='json(name,network,direction,priority,disabled,sourceRanges,sourceTags,sourceServiceAccounts,targetTags,targetServiceAccounts,allowed,denied)'
```

Review rules that target this VM (including by network tag/service account), especially ingress ports 22, 80 and 443. Confirm source CIDRs match the approved SSH/admin ranges and Cloudflare origin CIDRs; verify organization/network firewall policies in the Console as well. Do **not** change rules blindly: preserve the verified SSH route and do not create broad `0.0.0.0/0` admin access. Report the relevant rule names, ports and whether any unexpected source range applies; avoid sharing unrelated project rules.

## 3. Named first administrator and MFA

The owner-confirmed identity **`laihoangdo` / laihoangdo0506@gmail.com** is provisioned (2026-11-05) in realm `police-staging` with `ROLE_SUPERADMIN` and in `master` with the console `admin` role. Both accounts force a password change and OTP enrollment on first sign-in; the one-time password sits in root-only `/etc/police-management/secrets/staging/admin-laihoangdo-initial` on the VPS and was never printed, copied or sent anywhere.

Owner steps:

1. Read the initial password yourself over SSH (`sudo cat /etc/police-management/secrets/staging/admin-laihoangdo-initial`), then delete the file after both accounts are set up.
2. Sign in at `https://sunnytech.cloud/realms/police-staging/account` (application) and the master console through the admin TLS path; change both passwords and enroll your own authenticator (CONFIGURE_TOTP) on both.
3. MFA metadata was verified PASS in both realms. On 2026-11-05, `staging-bootstrap` was disabled/retired, its secret replaced, and old bootstrap credentials were rejected. A short-lived Keycloak recovery admin was used after the initial token expired; it was removed and its credentials were rejected. Keycloak and the app returned healthy; public root stayed at `503`.
4. Confirm both named-admin passwords were changed from the one-time initial value, then remove the no-longer-needed root-only `/etc/police-management/secrets/staging/admin-laihoangdo-initial` file on the VPS. Do not paste its contents anywhere.

### Temporary master-console access without public admin exposure

The master console is not publicly routed. A reviewed helper on the VPS opens only `/admin/` and `/realms/master/` to loopback (`127.0.0.1`), keeps the root site in maintenance, and restores the normal Nginx route on Ctrl-C or after 15 minutes. To use it:

1. In SSH terminal A, run `sudo /opt/police-management/staging/open-master-admin-window.sh` and leave it running.
2. In an **elevated PowerShell** terminal B on your workstation, temporarily map the hostname locally and open an SSH tunnel. The `finally` block restores the original hosts file when you press Ctrl-C or the tunnel exits:

   ```powershell
   $ErrorActionPreference = 'Stop'
   $hostsPath = Join-Path $env:WINDIR 'System32\drivers\etc\hosts'
   $originalHosts = [IO.File]::ReadAllBytes($hostsPath)
   $hostsText = [Text.Encoding]::ASCII.GetString($originalHosts)
   if ($hostsText -match '(?m)^\s*[^#\r\n]+\s+sunnytech\.cloud(?:\s|$)') { throw 'Existing sunnytech.cloud hosts entry; stop and review.' }
   try {
     [IO.File]::AppendAllText($hostsPath, "`r`n127.0.0.1 sunnytech.cloud # temporary police master MFA`r`n", [Text.Encoding]::ASCII)
     Clear-DnsClientCache
     ssh -N -L 127.0.0.1:443:127.0.0.1:443 gcp-vps
   } finally {
     [IO.File]::WriteAllBytes($hostsPath, $originalHosts)
     Clear-DnsClientCache
   }
   ```

3. While the tunnel is active, open `https://sunnytech.cloud/admin/master/console/`; change the master password and enroll OTP for `laihoangdo`, then sign out and confirm you can sign in again with OTP.
4. Press Ctrl-C in terminal B to restore the workstation hosts file, then Ctrl-C in terminal A to restore Nginx sooner. Do not share the initial password, QR code, OTP seed, or codes. If local port 443 is already occupied, stop; do not change the server exposure to work around it.

The Nginx admin and master-realm routes are denied to every source except loopback; normal public routing and `/` maintenance remain in effect. If the login cannot be completed in this window, it closes automatically and can be reopened after review.

The agent does not keep any human operator's OTP seed. Credentials are delivered only through the protected server file/SSH, never chat or Git.

## Independent paper recovery escrow

The backup passphrase also has an encrypted copy at **`.tc2-private/vps-backup-passphrase.dpapi`**, ignored by Git. It is protected by Windows CurrentUser DPAPI and depends on that Windows profile; it is **not** independent escrow. The owner confirms the no-cost sealed-paper copy is stored independently and reported **GPG PASS** authenticating a downloaded GCS archive with the paper-held passphrase. This confirms the key/archive pair and owner-reported physical separation, but not alternate-custodian access or a clean-machine restore:

1. In a private, owner-controlled SSH terminal that is not screen-shared or recorded, connect with `ssh gcp-vps` and run `sudo cat /etc/police-management/secrets/local_backup_passphrase`. This displays the value only to the owner. Do not run it through the deployment agent, paste it into chat, a ticket, a command argument, clipboard history, email, or an ordinary file.
2. Transcribe it exactly onto archival paper, check the transcription twice, seal it in a tamper-evident envelope, and label only its purpose/date (never put the value on the outside).
3. The owner reports the envelope is stored in a locked location physically separate from both the VPS and this Windows workstation/profile. Still identify/validate a trusted alternate custodian under the approved access/recovery procedure. Do not store it beside the GCS archive or print additional uncontrolled copies.
4. The owner completed the independent archive decryption check from Cloud Shell. For future re-verification, use the latest encrypted GCS archive; this check writes decrypted bytes only to `/dev/null` and never puts the key in command history/arguments or a file:

   ```bash
   archive='staging-20261105T150902Z-221db1052e304b46810f139460786bc3.tar.gz.gpg'
   uri="gs://sunnytech-backups-194646196669/staging/$archive"
   gcloud storage cp "$uri" .
   gcloud storage cp "$uri.sha256" .
   expected=$(awk '{print $1}' "$archive.sha256")
   printf '%s  %s\n' "$expected" "$archive" | sha256sum -c -
   read -r -s -p 'Enter passphrase from sealed paper: ' paper_key
   printf '\n'
   if printf '%s' "$paper_key" | gpg --batch --pinentry-mode loopback --passphrase-fd 0 --decrypt --output /dev/null "$archive"; then
     unset paper_key
     printf '%s\n' 'PASS: sealed-paper key authenticated the encrypted archive.'
   else
     unset paper_key
     printf '%s\n' 'FAIL: key did not authenticate; do not discard any recovery copy.' >&2
     exit 1
   fi
   ```

   Run this yourself in Cloud Shell, not through the deployment agent; do not share the typed value or a screen recording. This command alone verifies key/archive integrity, not DB recovery. The subsequent independent DB restore below has now passed; retain the DPAPI copy until full application recovery acceptance is complete.

The 1Password-specific escrow workflow was removed from the runbook and repository after the owner selected paper. The CLI installed during the prior attempt was never signed in to and never received the key; it remains unused on the workstation.

## Other mandatory gates still being implemented

### Owner-selected VPN and observability work

The owner selected **Tailscale**, **90-day** Cloud Logging retention, Cloud Monitoring email to **laihoangdo0506@gmail.com**, and eventual production with real data. The owner requested waiving the remaining acceptance gates; those results must remain **not tested/owner risk acceptance**, never PASS. The running image/configuration is still synthetic staging; no citizen-data migration or public cutover has occurred.

- Tailscale **1.104.5** installed on both Windows desktop and Ubuntu VPS. VPS `tailscaled` enabled and an additive UFW rule allows OpenSSH on `tailscale0`. Public SSH is deliberately unchanged pending owner enrollment, tailnet access-policy review and an independent desktop VPN SSH/sudo test. No Tailscale SSH, exit node or subnet router was enabled. Alias `ssh gcp-vps` will be retained when its HostName is changed to the verified VPN address. Owner must check the Tailscale license/plan meets organizational use.
- Owner: sign in to the desktop Tailscale app with the approved MFA identity. In a private VPS SSH terminal run `sudo tailscale up --accept-dns=false --accept-routes=false --ssh=false --hostname=police-vps`, open its enrollment URL yourself, and approve the VPS in the **same approved tailnet**. Do not send enrollment URLs, auth keys or tokens to the agent. Report only enrollment PASS and the VPS address from `tailscale ip -4`. Do not change tailnet-wide policies without reviewing existing devices; restrict who can reach VPS TCP 22 before lockdown.
- `cloud-shell-observability.py` prepares a dedicated Singapore 90-day audit bucket/sink, email channel, log alerts for operational failures/test and RBAC risk signals, and a missing-heartbeat alert. Owner uploads it to Cloud Shell and runs `python3 "$HOME/cloud-shell-observability.py"`; its prompt requires `APPROVE-90-DAYS`. API creation is not yet executed/verified. It does not lock retention or alter existing default sinks; costs apply.
- `staging/export-cloud-audit.py` and `police-cloud-audit.service/.timer` were deployed after the owner reported dedicated sink creation. The exporter uses at-least-once writes with stable insert IDs and locally tracks delivered IDs. It mirrors RBAC ID/action/time and HMAC-pseudonymized actor/target, not raw audit details or citizen fields. It scans indexed source IDs in pages each run to avoid out-of-order transaction commit gaps; scan limits/timeouts and scale need operational monitoring. The pseudonymization key is included by the existing encrypted staging-secrets backup procedure.
- Heartbeat covers application health, disk-free threshold and GCS-upload age (27 hours), with an explicit synthetic alert-test flag. Missing heartbeat catches exporter/VM silence once a metric time series exists. This is **not** proof of full Keycloak login/security-event coverage, immutable retention, full detailed forensic audit, an independent legal compliance assessment, or tested email delivery. VM identity must not gain audit-bucket delete/retention-administration rights. Dedicated bucket read-back, VM IAM review and actual owner email receipt are required to close this gate.

#### Latest VPN and observability execution

- Desktop VPN `100.106.82.77` reached VPS VPN `100.127.186.19` using the existing `hoangdo` OpenSSH key and verified historical host key. Workstation alias `ssh gcp-vps` now uses `HostName 100.127.186.19` and `HostKeyAlias 34.143.223.166` (the latter retains host-key verification; it is not a public connection target).
- Removed the original all-source UFW TCP 22 allow for IPv4/IPv6, with a five-minute automatic rollback armed beforehand. Fresh VPN SSH/sudo and app verification passed; fresh public-IP SSH timed out. Rollback timer was then stopped. VPN OpenSSH allow remains on `tailscale0`; Tailscale SSH is disabled. Tailnet ACL/membership review and cloud-layer rule hardening remain separate; shared GCP default rules were not modified.
- Owner Cloud Shell output confirms the dedicated 90-day bucket/sink and two log-alert policies were created. Setup stopped with HTTP 404 while creating the missing-heartbeat policy. No existing resources were deleted. The first heartbeat metric had not yet been emitted at that point; retry setup now that the exporter has run, and inspect the specific API error if it persists.
- Exporter and service/timer are now deployed. Initial minimized audit/heartbeat writes were accepted; the systemd service returned `Result=success`, `ExecMainStatus=0`, and timer is active. An explicit `--alert-test` heartbeat was sent. Dedicated bucket read-back and actual alert email receipt are **not yet confirmed**; creation/write success alone is not alert-delivery PASS.
- App remains healthy/synthetic-only; public root remains `503`. No citizen data was migrated or enabled for public access.

Owner subsequently confirms the synthetic Cloud Monitoring alert email was received: **email delivery PASS**. The latest service probe still reports audit exporter success and both audit/backup timers active. Dedicated-bucket read-back and missing-heartbeat policy completion are still awaiting owner evidence. Production cutover scope and rollback boundaries are tracked in `PRODUCTION-CUTOVER.md`; the current synthetic artifact must not be relabeled as a real-data production release.

### Independent recovery drill — next owner action

After bootstrap retirement, a fresh encrypted backup was uploaded successfully at **2026-11-05 16:59:12 UTC**:
`gs://sunnytech-backups-194646196669/staging/staging-20261105T165858Z-28c8bd8f26774611b3d6589b96fc4afc.tar.gz.gpg`.
The same-VPS drill restored both DBs, matched the application key and all 47 application/archive table fingerprints. This is not evidence of independent-machine recovery.

On a separate trusted Linux recovery host with Python 3.11+, GPG, Docker and authorized `gcloud` access (Cloud Shell may be used if these prerequisites and sufficient disk/RAM are available), upload only `infra/vps/staging/restore-independent.py` from this workstation. The repository is not yet pushed; do not assume GitHub has this helper. Then run in a private interactive terminal:

```bash
mkdir -m 700 police-recovery-drill
cd police-recovery-drill
uri='gs://sunnytech-backups-194646196669/staging/staging-20261105T165858Z-28c8bd8f26774611b3d6589b96fc4afc.tar.gz.gpg'
gcloud storage cp "$uri" . && gcloud storage cp "$uri.sha256" .
python3 ../restore-independent.py "${uri##*/}"
```

Enter the paper-held passphrase only at the hidden prompt. The helper verifies the sidecar checksum and GPG authentication before selecting archive members, then restores both DBs into a disposable pinned PostGIS container with no network or published ports. It checks Liquibase history, identity realms and retired temporary admins. It does not restore global roles into any existing database cluster. It deletes its plaintext workspace and disposable container/volumes on ordinary success/failure. A forcibly killed process or host crash requires manual cleanup of the `police-independent-*` workspace and `police-independent-drill-*` container/volumes on that recovery host.

**Owner-reported independent Cloud Shell DB restore: PASS.** Screenshot evidence shows `restore-tcp-ready-v3` completed checksum/authenticated decryption, both database restores, Liquibase history, realm and retired-admin checks for the archive above. The application key was recovered, and the disposable container/volumes and private plaintext workspace were removed. This closes the independent DB-restore sub-gate, not full application recovery: restored application/key decryption, Keycloak login, grants/roles and independently recorded fingerprints must still be validated. No passphrase was shared with the agent.

Latest read-only metadata check before retirement: named-admin OTP enrollment passed in both `police-staging` and `master`. Retirement then verified the named master account enabled, with the `admin` role and an OTP credential. `staging-bootstrap` is now disabled/retired; its secret was replaced, old credentials were rejected, and the temporary recovery admin was removed. The owner reports independent paper-key storage, GPG authentication and independent Cloud Shell DB restore PASS; alternate-custodian validation and full application recovery acceptance remain open.

The daily backup service now invokes `backup-offsite.sh` (encrypted local backup followed by GCS upload). A post-deploy manual systemd run returned `Result=success`, `ExecMainStatus=0`; the timer remains active. It uploaded `gs://sunnytech-backups-194646196669/staging/staging-20261105T150902Z-221db1052e304b46810f139460786bc3.tar.gz.gpg`. One earlier archive was independently downloaded and checksum-verified; this does not establish alert delivery or a clean-machine restore.

The deployed `police-app-staging:20261105-3` upgrades Ubuntu `apt` and `libapt-pkg6.0t64` to `2.8.4ubuntu0.1`. Trivy 0.76.2 scan found **0 vulnerabilities** in Ubuntu and Java; the deployment script now requires a clean HIGH/CRITICAL scan before migration/rollout. Report is root-only on VPS at `/var/lib/police-management/scans/20261105-3.json`.

- Independent Cloud Shell DB restore using the paper-held passphrase is PASS. Still validate alternate-custodian recovery and full restored application/key decryption, Keycloak login, grants/roles and reference fingerprints (see Recovery escrow).
- Independently retained external copy of audit logs; anomaly alerting (SMTP deferred by owner — not accepted as monitoring).
- Continuous dependency monitoring and review of remaining development-only JHipster/Yeoman generator advisories; `public.officer_account` retention review; GCP VPC firewall review. Patched synthetic app `20261105-3` is deployed and Liquibase migration/verification on the existing synthetic staging DB completed (schema was already current); this is not a citizen-data migration or production cutover.

Dependency automation preparation: `.github/dependabot.yml` now schedules weekly npm, Maven and GitHub Actions update PRs. This is local configuration only, not an active monitoring service: it must be reviewed/committed/pushed to the GitHub default branch, Dependabot alerts/security updates enabled as appropriate, and an accountable reviewer and successful execution verified. It does not scan locally built Docker images or independently deliver security alerts. No auto-merge is configured.

- Actual staging backend OIDC/MFA, RBAC and server-side session-revocation test passed using a temporary local-origin route; Nginx and the public root were restored to maintenance afterward. An unauthenticated headless Chromium smoke test also passed via SSH loopback (HTTP 200, synthetic manifest, no page exceptions); full authenticated UI/accessibility, load and pentest acceptance remain required, along with real-data migration/keys/roles consistency and final rollback/clean-machine restore checks.

Shipped 2026-11-05: backend masking with audited full-identity disclosure (`canRevealIdentity`), read-audit entries including search-without-term-logging, and frontend human-inactivity logout (12-minute warning, 14-minute sign-out). The site remains in maintenance; no citizen-data migration or public production activation is approved merely by completing DNS or bucket setup.

## Production go-live operator actions — 2026-11-07

Production is now serving at `https://sunnytech.cloud` with the real database (realm `jhipster`). Complete these steps yourself; never paste secret values into chat.

### 1. First sign-in for the named production operator

1. In a private SSH terminal, read the one-time password yourself: `sudo cat /etc/police-management/secrets/production/operator-initial`. Do not run it through the deployment agent, paste it, or screenshot it.
2. Sign in at `https://sunnytech.cloud` as `laihoangdo`. Keycloak forces a password change and OTP enrollment (`UPDATE_PASSWORD` + `CONFIGURE_OTP`) on this first login. Enroll your own authenticator app.
3. Sign out, sign in again with the new password + OTP to confirm, then delete the one-time file on the VPS: `sudo rm /etc/police-management/secrets/production/operator-initial`.
4. The account already holds `ROLE_USER`, `ROLE_ADMIN` and `ROLE_SUPERADMIN` in the production realm.

### 2. Disabled sample accounts and the orphaned assignment

- `admin` (subject `4c973896-…`) is disabled with zero hamlet assignments — harmless, no action needed.
- `user` (subject `c4af4e2f-…`) is disabled but still holds **one hamlet assignment**. After your first sign-in, reassign that hamlet to a real account through the superadmin UI (or confirm the assignment is obsolete and remove it).
- The two real operator accounts (`cskv_thanh`, `user1`) are enabled and will be forced through password change + OTP enrollment on their first production sign-in.

### 3. Observability completion (still pending)

- The missing-heartbeat alert policy creation previously stopped with HTTP 404 and still awaits owner evidence: upload `cloud-shell-observability.py` to Cloud Shell and run `python3 "$HOME/cloud-shell-observability.py"`, entering `APPROVE-90-DAYS` at the prompt. Email delivery for other alerts is confirmed; this policy is not.
- The audit exporter now mirrors both the staging and production databases (pseudonymized, namespaced) and its heartbeat watches the production application, backup age and disk space.

### 4. Backups and recovery

- The production backup timer runs daily at 18:31 UTC (local encrypted backup + create-only GCS upload). First archive: `gs://sunnytech-backups-194646196669/production-backups/production-20261107T090242Z-9eb0461669be451383fce9f0305c707e.tar.gz.gpg`. It contains the production realm/secrets and the roster key, encrypted with the same paper-escrowed passphrase.
- The existing independent-recovery evidence covers the staging archive. Repeating the independent restore drill against a **production** archive remains an open recommendation.

### 5. Repository state

- All go-live changes (production profile, VPS scripts, systemd units, tests, documentation) are uncommitted on branch `develop/3d-map`. Commit and push them so the deployed state is reproducible; the running image embeds git metadata `e996f07-dirty`.
- The older staging one-time file `/etc/police-management/secrets/staging/admin-laihoangdo-initial` should be removed once you confirm both staging credentials were changed (see section 3 above).
