const fs = require('node:fs');
const path = require('node:path');

const manifest = path.join(__dirname, '../.rbac/active-database.json');
const active = fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest, 'utf8')) : null;
const runtime = path.join(__dirname, '../.rbac/database-runtime.properties');
if (
  !active &&
  fs.existsSync(runtime) &&
  /^spring\.datasource\.url=jdbc:postgresql:\/\/localhost:5433\//m.test(fs.readFileSync(runtime, 'utf8'))
) {
  throw new Error('PostGIS runtime metadata is missing; refusing to clean fixtures in the legacy database');
}
const container = active?.container || 'monolithic-postgresql-1';
if (!/^[A-Za-z0-9_-]+$/.test(container)) throw new Error('Invalid active database container');
module.exports = { container };
