// Adds surrounding-area satellite context around Ba Diem from a local archive. Existing tiles are never replaced.
// Usage: node scripts/extract-satellite-regional.mjs [path/to/hcm_satellite.mbtiles]
// Then rebuild the catalog: node scripts/index-local-raster-tiles.mjs
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const ARCHIVE = process.argv[2] ?? '../backup-blender/hcm_satellite.mbtiles';
const OUTPUT = 'src/main/webapp/content/assets/badiem_satellite';
const AREA = { west: 106.4, east: 106.75, south: 10.72, north: 10.98 };
const MIN_ZOOM = 8;
const MAX_ZOOM = 15;

const tileX = (lng, z) => Math.floor(((lng + 180) / 360) * 2 ** z);
const tileY = (lat, z) => {
  const radians = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * 2 ** z);
};

const db = new DatabaseSync(ARCHIVE, { readOnly: true });
try {
  const metadata = Object.fromEntries(
    db
      .prepare('select name, value from metadata')
      .all()
      .map(row => [row.name, row.value]),
  );
  if (metadata.format !== 'jpg' || metadata.scheme !== 'xyz') throw Error('Expected an XYZ JPEG archive');
  const query = db.prepare(
    'select tile_column x, tile_row y, tile_data data from tiles where zoom_level = ? and tile_column between ? and ? and tile_row between ? and ?',
  );
  let added = 0;
  let kept = 0;
  let bytesAdded = 0;
  for (let z = MIN_ZOOM; z <= MAX_ZOOM; z++) {
    for (const { x, y, data } of query.all(z, tileX(AREA.west, z), tileX(AREA.east, z), tileY(AREA.north, z), tileY(AREA.south, z))) {
      const bytes = Buffer.from(data);
      if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw Error(`Invalid JPEG at ${z}/${x}/${y}`);
      const directory = path.join(OUTPUT, String(z), String(x));
      const filename = path.join(directory, `${y}.jpg`);
      if (fs.existsSync(filename)) {
        kept++;
        continue;
      }
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(filename, bytes, { flag: 'wx' });
      added++;
      bytesAdded += bytes.length;
    }
  }
  console.log(`Added ${added} tiles (${(bytesAdded / 1048576).toFixed(1)} MB); kept ${kept} existing tiles.`);
} finally {
  db.close();
}
