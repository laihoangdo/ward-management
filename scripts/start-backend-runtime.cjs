const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
if (!fs.existsSync(path.join(root, '.rbac/database-runtime.properties'))) {
  console.error('Runtime credentials are missing. Apply migrations and provision the runtime role before starting the app.');
  process.exit(1);
}
const windows = process.platform === 'win32';
const result = spawnSync(
  windows ? 'mvnw.cmd' : './mvnw',
  [
    '-Dskip.installnodenpm',
    '-Dskip.npm',
    '-Dmaven.compiler.useIncrementalCompilation=false',
    '-Dspring-boot.run.profiles=dev,db-runtime',
    '-ntp',
    '--batch-mode',
  ],
  { cwd: root, stdio: 'inherit', shell: windows },
);
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
