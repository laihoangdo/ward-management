import fs from 'node:fs';
const catalog = {};
for (const [key, directory] of [
  ['satellite', 'badiem_satellite'],
  ['map', 'badiem_map'],
]) {
  const root = `src/main/webapp/content/assets/${directory}`;
  catalog[key] = fs
    .readdirSync(root, { recursive: true })
    .map(file => file.replaceAll('\\', '/'))
    .filter(file => /^\d+\/\d+\/\d+\.(jpg|png)$/.test(file))
    .map(file => file.replace(/\.(jpg|png)$/, ''))
    .sort();
}
fs.writeFileSync('src/main/webapp/app/gis/data/localRasterTiles.json', JSON.stringify(catalog));
console.log('Indexed tile coverage:', Object.fromEntries(Object.entries(catalog).map(([key, tiles]) => [key, tiles.length])));
