#!/usr/bin/env bash
# Additive installation only; never close public SSH or enroll an unattended identity.
set -euo pipefail
umask 077
[[ ${EUID} -eq 0 ]] || { echo 'Run via sudo.' >&2; exit 1; }
. /etc/os-release
[[ "$ID" == ubuntu && "$VERSION_CODENAME" == noble ]] || { echo 'Only reviewed Ubuntu noble is supported.' >&2; exit 1; }
key=/usr/share/keyrings/tailscale-archive-keyring.gpg
list=/etc/apt/sources.list.d/tailscale.list
if [[ ! -e "$key" && ! -e "$list" ]]; then
    work=$(mktemp -d)
    trap 'rm -f "$work/key"; rmdir "$work"' EXIT
    curl --fail --silent --show-error --proto '=https' --tlsv1.2 \
        https://pkgs.tailscale.com/stable/ubuntu/noble.noarmor.gpg -o "$work/key"
    gpg --batch --show-keys "$work/key" >/dev/null
    install -m 0644 "$work/key" "$key"
    printf '%s\n' 'deb [signed-by=/usr/share/keyrings/tailscale-archive-keyring.gpg] https://pkgs.tailscale.com/stable/ubuntu noble main' > "$list"
elif [[ ! -f "$key" || ! -f "$list" ]]; then
    echo 'Partial repository configuration exists; review before continuing.' >&2; exit 1
else
    grep -Fxq 'deb [signed-by=/usr/share/keyrings/tailscale-archive-keyring.gpg] https://pkgs.tailscale.com/stable/ubuntu noble main' "$list" || {
        echo 'Existing Tailscale repository differs; refusing overwrite.' >&2; exit 1;
    }
fi
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install --yes --no-install-recommends tailscale
systemctl enable --now tailscaled
# Only standard OpenSSH over VPN; Tailscale SSH, exit node and subnet routing are not enabled.
ufw allow in on tailscale0 to any port 22 proto tcp comment 'police VPN OpenSSH'
tailscale version
printf '%s\n' 'PASS: client installed; public SSH unchanged. Owner must enroll VPS and desktop, review tailnet ACLs, and test a new SSH connection before lockdown.'
