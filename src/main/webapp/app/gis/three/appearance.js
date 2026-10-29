// Illustrative local low-rise palette, NOT classified from satellite imagery.
const WALLS = [0xd5cbb7, 0xc8c4b5, 0xe2d9c8, 0xb8bdb5, 0xcab99f, 0xb4bac0];
const ROOFS = [0x8a8d87, 0x727d83, 0xa85d49, 0x737f75, 0x977b68, 0x526d80];
export function stableSeed(id) {
  let hash = 2166136261;
  for (const character of String(id)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967296;
}
function color(value, fallback) {
  return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value) ? Number.parseInt(value.slice(1), 16) : fallback;
}
export function readAppearance(properties, id, area = 80) {
  const seed = stableSeed(id);
  const floors = area > 350 ? 1 : seed < 0.28 ? 1 : seed < 0.76 ? 2 : seed < 0.96 ? 3 : 4;
  const measured = Number(properties.height) > 0 && properties.estimated !== true;
  const levels = Number(properties.levels ?? properties['building:levels']);
  const height = measured ? Number(properties.height) : levels > 0 && levels <= 100 ? levels * 3.2 : floors * 3.2;
  const roofShape = properties.roofShape ?? properties['roof:shape'] ?? (area > 350 || seed < 0.36 ? 'gable' : 'flat');
  return {
    height,
    roofShape,
    seed,
    wall: color(properties.wallColor ?? properties['building:colour'], WALLS[Math.floor(seed * WALLS.length)]),
    roof: color(properties.roofColor ?? properties['roof:colour'], ROOFS[Math.floor(stableSeed(`${id}:roof`) * ROOFS.length)]),
    estimated: !measured,
  };
}
