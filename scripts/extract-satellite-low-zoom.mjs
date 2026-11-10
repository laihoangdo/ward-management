import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('src/main/webapp/content/assets/badiem_satellite_1_9.mbtiles', { readOnly: true });
try {
  const metadata = Object.fromEntries(
    db
      .prepare('select name, value from metadata')
      .all()
      .map(row => [row.name, row.value]),
  );
  if (metadata.format !== 'jpg' || !['xyz', 'tms'].includes(metadata.scheme)) throw Error('Unsupported tile format or scheme');
  const tiles = db.prepare('select zoom_level, tile_column, tile_row, tile_data from tiles where zoom_level between 1 and 9').all();
  for (const tile of tiles) {
    const z = tile.zoom_level;
    const y = metadata.scheme === 'tms' ? 2 ** z - 1 - tile.tile_row : tile.tile_row;
    const bytes = Buffer.from(tile.tile_data);
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw Error(`Invalid JPEG at zoom ${z}`);
    const directory = path.join('src/main/webapp/content/assets/badiem_satellite', String(z), String(tile.tile_column));
    const filename = path.join(directory, `${y}.jpg`);
    fs.mkdirSync(directory, { recursive: true });
    if (fs.existsSync(filename)) {
      if (!fs.readFileSync(filename).equals(bytes)) throw Error(`Existing tile differs: ${filename}`);
    } else fs.writeFileSync(filename, bytes, { flag: 'wx' });
    console.log(filename);
  }
  console.log(`Extracted ${tiles.length} tiles.`);
} finally {
  db.close();
}
