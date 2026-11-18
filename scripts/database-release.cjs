const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');

function migrationArguments(action, url) {
  if (!['status', 'migrate'].includes(action))
    throw new Error('Use status or migrate. Reset, rollback and seed are intentionally unsupported.');
  // Keep Windows shell invocation free from URL options, credentials and shell metacharacters.
  if (!/^jdbc:postgresql:\/\/[a-zA-Z0-9_.:-]+\/[a-zA-Z0-9_]+$/.test(url))
    throw new Error('Expected jdbc:postgresql://host:port/database without credentials or query options.');
  return [
    '-ntp',
    '--batch-mode',
    '-Dskip.installnodenpm',
    '-Dskip.npm',
    `-Dliquibase-plugin.url=${url}`,
    'process-resources',
    `liquibase:${action === 'migrate' ? 'update' : 'status'}`,
  ];
}

function databaseUrl(argv) {
  if (argv.length === 2 && argv[0] === '--url') return argv[1];
  if (argv.length)
    throw new Error('Usage: node scripts/database-release.cjs [status|migrate] [--url jdbc:postgresql://host:port/database]');
  const manifest = path.join(root, '.rbac/active-database.json');
  if (!fs.existsSync(manifest))
    throw new Error('Active database metadata is missing. Supply --url explicitly; no legacy database fallback is used.');
  const active = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  if (!Number.isInteger(active.port) || active.port < 1 || active.port > 65535 || !/^[a-zA-Z0-9_]+$/.test(active.database || ''))
    throw new Error('Invalid active database metadata.');
  return `jdbc:postgresql://localhost:${active.port}/${active.database}`;
}

if (require.main === module) {
  try {
    const [action = 'status', ...options] = process.argv.slice(2);
    const args = migrationArguments(action, databaseUrl(options));
    console.log(
      action === 'migrate'
        ? 'Applying pending Liquibase migrations only (no reset or sample seed).'
        : 'Checking pending Liquibase migrations (no application data changes).',
    );
    const windows = process.platform === 'win32';
    const result = windows
      ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `mvnw.cmd ${args.join(' ')}`], { cwd: root, stdio: 'inherit' })
      : spawnSync('./mvnw', args, { cwd: root, stdio: 'inherit' });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { migrationArguments };
