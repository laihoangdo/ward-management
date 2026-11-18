#!/usr/bin/env bash
# A timed rollback is installed BEFORE reload. Cancel it only after a fresh named-user SSH test.
set -euo pipefail
[[ ${EUID} -eq 0 ]] || exit 1
source_file=${1:?Pass the reviewed SSH drop-in}
target=/etc/ssh/sshd_config.d/00-police-hardening.conf
[[ ! -e "$target" ]] || { printf '%s\n' 'Policy already exists; review instead of overwriting.' >&2; exit 1; }
checkpoint=/root/police-deployment-checkpoints/ssh-hardening-20261104
[[ ! -e "$checkpoint" ]] || exit 1
install -d -m 0700 "$checkpoint"
tar -cf "$checkpoint/previous-config.tar" -C /etc/ssh sshd_config sshd_config.d
cat > "$checkpoint/rollback.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
rm -f -- /etc/ssh/sshd_config.d/00-police-hardening.conf
/usr/sbin/sshd -t
systemctl reload ssh.service
EOF
chmod 0700 "$checkpoint/rollback.sh"
systemd-run --unit=police-ssh-hardening-rollback --on-active=3m --timer-property=AccuracySec=1s /bin/bash "$checkpoint/rollback.sh"
install -m 0644 "$source_file" "$target"
if ! /usr/sbin/sshd -t; then
    bash "$checkpoint/rollback.sh"
    exit 1
fi
systemctl reload ssh.service
printf '%s\n' 'SSH reloaded. Test a FRESH connection, verify policy, then stop police-ssh-hardening-rollback.timer.'
