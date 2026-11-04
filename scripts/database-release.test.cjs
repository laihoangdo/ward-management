const { test } = require('node:test');
const assert = require('node:assert/strict');
const { migrationArguments } = require('./database-release.cjs');
const fs = require('node:fs');
const path = require('node:path');

test('Maven migration execution excludes both test and faker contexts', () => {
  const pom = fs.readFileSync(path.join(__dirname, '..', 'pom.xml'), 'utf8');
  const plugin = pom.match(/<artifactId>liquibase-maven-plugin<\/artifactId>[\s\S]*?<\/configuration>/)?.[0];
  assert.ok(plugin);
  assert.match(plugin, /<contexts>!test and !faker<\/contexts>/);
});

test('status and migrate retain the existing Liquibase upgrade chain', () => {
  for (const action of ['status', 'migrate']) {
    const args = migrationArguments(action, 'jdbc:postgresql://localhost:5433/Monolithic');
    assert.ok(args.includes('process-resources'));
    assert.ok(args.includes('-Dskip.npm'));
    assert.equal(args.at(-1), action === 'migrate' ? 'liquibase:update' : 'liquibase:status');
    assert.ok(!args.some(arg => /drop|clearCheck|rollback|seed/i.test(arg)));
  }
});
test('rejects destructive actions and unsafe connection strings', () => {
  assert.throws(() => migrationArguments('reset', 'jdbc:postgresql://localhost/db'));
  for (const url of ['jdbc:postgresql://localhost/db?password=secret', 'jdbc:postgresql://localhost/db&whoami', 'https://localhost/db']) {
    assert.throws(() => migrationArguments('migrate', url));
  }
});
