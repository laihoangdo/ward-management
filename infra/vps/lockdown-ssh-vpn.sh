#!/usr/bin/env bash
# Run only after a fresh desktop VPN SSH/sudo test. Timed rollback restores the old SSH rule.
set -euo pipefail
[[ ${EUID} -eq 0 ]] || { echo 'Run via sudo.' >&2; exit 1; }
[[ $(tailscale ip -4) == 100.127.186.19 ]] || { echo 'Unexpected VPN address; refusing.' >&2; exit 1; }
[[ ${SSH_CONNECTION:-} == '100.106.82.77 '* ]] || {
    echo 'Must run through the approved desktop VPN SSH connection.' >&2; exit 1;
}
ufw status | grep -q '^Status: active$'
ufw status | grep -q 'SSH retained during police deployment' || {
    echo 'Expected original SSH rule missing; review instead of mutating.' >&2; exit 1;
}
systemctl is-active --quiet police-ssh-vpn-rollback.timer && { echo 'Rollback already armed; inspect.' >&2; exit 1; }
systemd-run --unit=police-ssh-vpn-rollback --on-active=5m \
    /usr/sbin/ufw allow 22/tcp comment 'SSH retained during police deployment'
ufw allow in on tailscale0 to any port 22 proto tcp comment 'police VPN OpenSSH'
ufw --force delete allow 22/tcp comment 'SSH retained during police deployment'
printf '%s\n' 'Public UFW SSH allow removed; rollback armed for five minutes. Verify fresh VPN SSH/sudo, then cancel police-ssh-vpn-rollback.timer.'
