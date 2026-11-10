import fs from 'node:fs';
import { createHash } from 'node:crypto';
const data = JSON.parse(fs.readFileSync('badiem_houses.geojson', 'utf8'));
const seen = new Set();
data.features = data.features.filter(f => {
  if (!['Polygon', 'MultiPolygon'].includes(f.geometry?.type)) throw Error('Unsupported geometry');
  const hash = createHash('sha256').update(JSON.stringify(f.geometry)).digest('hex');
  const id = `badiem-${hash.slice(0, 24)}`;
  if (seen.has(id)) return false;
  seen.add(id);
  f.id = id;
  f.properties = { buildingId: id, height: 3.5 * (1 + (parseInt(hash.slice(0, 8), 16) % 5)), estimated: true };
  return true;
});
delete data.crs;
fs.mkdirSync('src/main/webapp/content/data', { recursive: true });
fs.writeFileSync('src/main/webapp/content/data/badiem-houses.geojson', JSON.stringify(data));
console.log('Prepared', seen.size, 'unique buildings');
