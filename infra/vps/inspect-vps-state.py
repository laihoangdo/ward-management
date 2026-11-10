#!/usr/bin/env python3
"""Read-only VPS state inventory for the production cutover. No secrets are printed."""
import json
import subprocess


def run(args, stdin=None):
    result = subprocess.run(args, capture_output=True, input=stdin)
    if result.returncode:
        return {'error': 'command failed: ' + args[0]}
    return result.stdout.decode(errors='replace')


def psql(container, database, statement):
    command = ['sudo', '-n', 'docker', 'exec', '-i', container, 'bash', '-c',
               'export PGPASSWORD="$(cat /run/secrets/database_owner)"; '
               'exec psql -X -q -At -h 127.0.0.1 -U Monolithic -v ON_ERROR_STOP=1 -d ' + database]
    return run(command, stdin=statement.encode()).strip()


def tables(database):
    raw = psql('police-staging-database-1', database,
               "SELECT schemaname||'.'||tablename FROM pg_tables "
               "WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY 1;")
    return [line for line in raw.splitlines() if line]


state = {}
state['containers'] = run(['sudo', '-n', 'docker', 'ps', '--format',
                           '{{.Names}}\t{{.Image}}\t{{.Status}}']).strip().splitlines()
keycloak = run(['sudo', '-n', 'docker', 'inspect', 'police-staging-keycloak-1', '--format',
                '{{json .Config.Cmd}}\n{{json .Config.Entrypoint}}'])
state['keycloak_cmd_and_entrypoint'] = keycloak.strip().splitlines()
mounts = run(['sudo', '-n', 'docker', 'inspect', 'police-staging-keycloak-1', '--format',
              '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{\"\\n\"}}{{end}}'])
state['keycloak_mounts'] = [line for line in mounts.strip().splitlines() if line]
state['keycloak_version'] = run(['sudo', '-n', 'docker', 'exec', 'police-staging-keycloak-1',
                                 '/opt/keycloak/bin/kc.sh', '--version']).strip()
state['staging_files'] = run(['sudo', '-n', 'ls', '-la', '/opt/police-management/staging']).strip().splitlines()
state['nginx_enabled'] = run(['sudo', '-n', 'ls', '-la', '/etc/nginx/sites-enabled']).strip().splitlines()
state['nginx_staging_conf'] = run(['sudo', '-n', 'cat',
                                   '/etc/nginx/sites-available/police-identity-staging.conf']).strip()
timers = run(['sudo', '-n', 'systemctl', 'list-timers', '--all', '--no-pager'])
state['police_timers'] = [line.strip() for line in timers.splitlines() if 'police' in line.lower()]

staging_tables = tables('Monolithic')
candidate_tables = [line for line in psql('police-production-candidate-db-20261105', 'Monolithic',
                   "SELECT schemaname||'.'||tablename FROM pg_tables "
                   "WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY 1;").splitlines() if line]
state['table_set_equal'] = staging_tables == candidate_tables
state['staging_only_tables'] = sorted(set(staging_tables) - set(candidate_tables))
state['candidate_only_tables'] = sorted(set(candidate_tables) - set(staging_tables))
state['staging_changelog'] = psql('police-staging-database-1', 'Monolithic', 'SELECT count(*) FROM databasechangelog;')
state['candidate_changelog'] = psql('police-production-candidate-db-20261105', 'Monolithic', 'SELECT count(*) FROM databasechangelog;')
state['keycloak_realms'] = psql('police-staging-database-1', 'keycloak', 'SELECT name FROM realm ORDER BY name;').splitlines()
state['candidate_marker'] = run(['sudo', '-n', 'cat',
                                 '/var/lib/police-management/production-candidate-20261105.json']).strip()
state['nginx_identity_snippet'] = run(['sudo', '-n', 'cat',
                                       '/etc/nginx/snippets/police-staging-identity-proxy.conf']).strip()
state['candidate_households'] = psql('police-production-candidate-db-20261105', 'Monolithic',
                                     'SELECT count(*) FROM public.household;')
state['candidate_residents'] = psql('police-production-candidate-db-20261105', 'Monolithic',
                                    'SELECT count(*) FROM public.resident;')
state['candidate_police_runtime_exists'] = psql('police-production-candidate-db-20261105', 'postgres',
                                                "SELECT count(*) FROM pg_roles WHERE rolname='police_runtime';")
state['candidate_container'] = run(['sudo', '-n', 'docker', 'inspect', 'police-production-candidate-db-20261105',
                                    '--format', '{{.State.Status}} {{json .NetworkSettings.Networks}}']).strip()
state['secrets_dirs'] = run(['sudo', '-n', 'ls', '-la', '/etc/police-management/secrets']).strip().splitlines()
print(json.dumps(state, indent=1))
