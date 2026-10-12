// Keep the editable Blender scene's pale paint while exporting dark lettering
// for the web map, whose road surfaces are white in its default presentation.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'Ba_Diem_3D.glb');
const destination = path.join(root, 'data/hcmc_assets/web_public/content/models/Ba_Diem_3D.glb');
const input = fs.readFileSync(source);
if (input.toString('ascii', 0, 4) !== 'glTF' || input.readUInt32LE(4) !== 2) {
  throw new Error('Expected a GLB version 2 file');
}

const chunks = [];
let offset = 12;
let updated = 0;
while (offset < input.length) {
  const length = input.readUInt32LE(offset);
  const type = input.readUInt32LE(offset + 4);
  let data = input.subarray(offset + 8, offset + 8 + length);
  if (type === 0x4e4f534a) {
    const document = JSON.parse(data.toString('utf8'));
    for (const paint of document.materials || []) {
      if (paint.name === 'Mat_Road_Marking_Paint' || paint.name?.startsWith('Road_Paint_')) {
        paint.pbrMetallicRoughness ||= {};
        paint.pbrMetallicRoughness.baseColorFactor = [0.035, 0.055, 0.095, 1];
        updated++;
      }
    }
    data = Buffer.from(JSON.stringify(document), 'utf8');
    data = Buffer.concat([data, Buffer.alloc((4 - (data.length % 4)) % 4, 0x20)]);
  }
  const header = Buffer.alloc(8);
  header.writeUInt32LE(data.length, 0);
  header.writeUInt32LE(type, 4);
  chunks.push(header, data);
  offset += 8 + length;
}
if (!updated || offset !== input.length) throw new Error('Invalid GLB or missing road paint');

const totalLength = 12 + chunks.reduce((sum, chunk) => sum + chunk.length, 0);
const header = Buffer.alloc(12);
header.write('glTF', 0, 'ascii');
header.writeUInt32LE(2, 4);
header.writeUInt32LE(totalLength, 8);
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, Buffer.concat([header, ...chunks], totalLength));
console.log(`Prepared ${updated} dark road paint materials: ${destination}`);
