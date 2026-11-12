/**
 * Illustrative building design shared by the field map and the roster map: natural 1–5 floor heights, tiled or flat roofs and
 * wall colours for footprints that have no surveyed values. These are visualization inputs, not surveyed facts.
 */
export const REALISTIC_WALLS = ['#f2ece1', '#e8dccb', '#dfd1bc', '#dce4dd', '#ebe1d3', '#ead8c8', '#e3e8ec', '#d8e0e5'];
export const REALISTIC_GABLE_ROOFS = ['#b85c42', '#a34832', '#c26a4a', '#486578', '#3f5c6e', '#496957'];
export const REALISTIC_FLAT_ROOFS = ['#7a8288', '#6c757d', '#868e88', '#737b80'];

export function hashUnit(text: string): number {
  let h = 2166136261;
  /* eslint-disable no-bitwise */
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
  /* eslint-enable no-bitwise */
}

type Shape = { id?: string | number; properties: Record<string, any> };

/**
 * Gives an estimated, unedited footprint a natural undulating height (1–5 floors) and an architectural roof. Surveyed or manually
 * edited buildings are returned unchanged. `centre` is the footprint centre [lng, lat], used to vary neighbouring heights smoothly.
 */
export function enrichForThree<T extends Shape>(house: T, centre: [number, number]): T {
  const p = house.properties;
  if (!p.estimated || p.appearanceSource === 'manual') return house;
  const id = String(house.id ?? p.buildingId ?? '');
  const h1 = hashUnit(id);
  const h2 = hashUnit(`${id}:f`);
  const h3 = hashUnit(`${id}:r`);
  const [lng, lat] = centre;
  const wave = 0.5 + 0.5 * Math.sin(lng * 3800 + lat * 2900) * Math.cos(lat * 4100 - lng * 2100);
  const score = h1 * 0.68 + wave * 0.32;
  const levels = score < 0.2 ? 1 : score < 0.52 ? 2 : score < 0.78 ? 3 : score < 0.93 ? 4 : 5;
  const floorHeight = Math.round((3.15 + h2 * 0.55) * 100) / 100;
  const height = Math.max(3.5, Math.min(20, Math.round((levels * floorHeight + (h3 - 0.35) * 1.3) * 10) / 10));
  const isGable = levels <= 3 ? h2 < 0.58 : h2 < 0.28;
  const roofShape = isGable ? 'gable' : 'flat';
  const wallColor = REALISTIC_WALLS[Math.floor(h1 * REALISTIC_WALLS.length)];
  const roofPalette = isGable ? REALISTIC_GABLE_ROOFS : REALISTIC_FLAT_ROOFS;
  const roofColor = roofPalette[Math.floor(h3 * roofPalette.length)];
  return {
    ...house,
    properties: { ...p, levels, floors: levels, floorHeight, height, roofShape, wallColor, roofColor, appearanceSeed: h1 },
  };
}
