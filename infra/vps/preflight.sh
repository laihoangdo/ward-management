#!/usr/bin/env bash
# Read-only host inventory. Never print environment files, keys, tokens or container inspect output.
set -euo pipefail
if [[ ${EUID} -ne 0 ]]; then
  printf '%s\n' 'Run via sudo; this script only reads host state.' >&2
  exit 1
fi
printf '\nHost and capacity\n'
hostname
uname -sr
free -m
df -hT / /var
printf '\nClock\n'
timedatectl show -p NTPSynchronized -p Timezone
printf '\nListening sockets (verify provider firewall separately)\n'
ss -lntup
printf '\nEffective SSH policy\n'
sshd -T | grep -E '^(port|permitrootlogin|passwordauthentication|kbdinteractiveauthentication|pubkeyauthentication|maxauthtries|x11forwarding) '
printf '\nHost firewall\n'
if command -v ufw >/dev/null; then ufw status verbose; fi
printf '\nContainer engine\n'
if command -v docker >/dev/null; then
  docker --version
  docker compose version
  docker ps --format '{{.Names}} {{.Ports}}'
else
  printf '%s\n' 'Docker not installed'
fi
printf '\nPatch/reboot state\n'
if [[ -f /var/run/reboot-required ]]; then cat /var/run/reboot-required; fi
printf '\nNOTE: this inventory does not prove disk encryption, cloud firewall, MFA or offsite backup compliance.\n'
