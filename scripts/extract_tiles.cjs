const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

function extractMBTiles(mbtilesPath, outputDir, defaultExt = 'png') {
  console.log(`Extracting ${mbtilesPath} to ${outputDir}...`);
  const db = new DatabaseSync(mbtilesPath);

  let format = defaultExt;
  try {
    const row = db.prepare("SELECT value FROM metadata WHERE name = 'format'").get();
    if (row && row.value) {
      format = row.value.toLowerCase();
    }
  } catch (err) {
    console.error('Error reading metadata format:', err);
  }
  console.log(`Detected format: .${format}`);

  const tiles = db.prepare('SELECT zoom_level, tile_column, tile_row, tile_data FROM tiles').all();
  console.log(`Found ${tiles.length} tiles.`);

  let count = 0;
  for (const tile of tiles) {
    const z = tile.zoom_level;
    const x = tile.tile_column;
    const y = tile.tile_row;

    const dir = path.join(outputDir, String(z), String(x));
    fs.mkdirSync(dir, { recursive: true });

    const filePath = path.join(dir, `${y}.${format}`);
    fs.writeFileSync(filePath, tile.tile_data);
    count++;
  }
  console.log(`Finished extracting ${count} tiles.`);
  return format;
}

const baseDir = path.resolve(__dirname, '../src/main/webapp/content/assets');
const mapFormat = extractMBTiles(path.join(baseDir, 'badiem_map.mbtiles'), path.join(baseDir, 'badiem_map'), 'png');
const satFormat = extractMBTiles(path.join(baseDir, 'badiem_satellite.mbtiles'), path.join(baseDir, 'badiem_satellite'), 'jpg');

console.log(`Done! Map format: .${mapFormat}, Satellite format: .${satFormat}`);
