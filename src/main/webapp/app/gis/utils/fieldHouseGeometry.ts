import { HouseholdFacility } from '../types';
import { containsHousePoint } from './houseFootprints';

export type FieldHouse = GeoJSON.Feature<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  {
    buildingId: string;
    height: number;
    name?: string;
    color?: string;
    floors?: number;
    estimated?: boolean;
    householdIds?: string[];
    canManage?: boolean;
    accessReason?: 'outside-territory' | 'linked-household-outside-scope';
    levels?: number;
    floorHeight?: number;
    wallColor?: string;
    roofColor?: string;
    roofShape?: string;
    appearanceSeed?: number;
    visualizationSource?: string;
    heightSource?: string;
    appearanceSource?: 'manual';
  }
>;
export const MAX_BUILDING_FLOORS = 20;
export const DEFAULT_FLOOR_HEIGHT = 3.5;
export const MAX_BUILDING_HEIGHT = MAX_BUILDING_FLOORS * DEFAULT_FLOOR_HEIGHT;

export function validateBuildingProperties(properties: FieldHouse['properties']): string | null {
  if (
    typeof properties.floors !== 'number' ||
    !Number.isInteger(properties.floors) ||
    properties.floors < 1 ||
    properties.floors > MAX_BUILDING_FLOORS
  )
    return 'Số tầng phải là số nguyên từ 1 đến 20.';
  if (!Number.isFinite(properties.height) || properties.height < 0.5 || properties.height > MAX_BUILDING_HEIGHT)
    return 'Chiều cao phải từ 0,5 đến 70 m (tối đa 20 tầng).';
  if ((properties.name ?? '').length > 255) return 'Tên công trình không quá 255 ký tự.';
  for (const value of [properties.color, properties.wallColor, properties.roofColor]) {
    if (value !== undefined && !/^#[a-f\d]{6}$/i.test(value)) return 'Màu công trình không hợp lệ.';
  }
  if (properties.roofShape !== undefined && !['flat', 'gable'].includes(properties.roofShape)) return 'Kiểu mái không hợp lệ.';
  return null;
}
/** Saved geometry, height and permissions win; retain visual fields absent from API DTOs. */
export function mergeSavedHouse(base: FieldHouse | undefined, saved: FieldHouse): FieldHouse {
  return { ...base, ...saved, properties: { ...base?.properties, ...saved.properties } };
}

/** Keep visual-only metadata out of business persistence DTOs. */
export function persistedHouse(house: FieldHouse): FieldHouse {
  const properties = { ...house.properties };
  for (const key of [
    'levels',
    'floorHeight',
    'wallColor',
    'roofColor',
    'roofShape',
    'appearanceSeed',
    'visualizationSource',
    'heightSource',
  ] as const) {
    if (properties.appearanceSource === 'manual' && ['wallColor', 'roofColor', 'roofShape', 'floorHeight'].includes(key)) continue;
    delete properties[key];
  }
  return { ...house, properties };
}
export const houseBounds = (house: FieldHouse): [number, number, number, number] => {
  const points = house.geometry.type === 'Polygon' ? house.geometry.coordinates.flat() : house.geometry.coordinates.flat(2);
  return points.reduce<[number, number, number, number]>(
    (b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])],
    [Infinity, Infinity, -Infinity, -Infinity],
  );
};
export function moveHouse(house: FieldHouse, longitude: number, latitude: number): FieldHouse {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude) > 180 || Math.abs(latitude) > 85)
    throw Error('Tọa độ không hợp lệ.');
  const [west, south, east, north] = houseBounds(house);
  const dx = longitude - (west + east) / 2,
    dy = latitude - (south + north) / 2;
  const translate = (ring: number[][]) =>
    ring.map(([x, y]) => {
      const p = [x + dx, y + dy];
      if (Math.abs(p[0]) > 180 || Math.abs(p[1]) > 85) throw Error('Khối nhà vượt phạm vi tọa độ bản đồ.');
      return p;
    });
  return {
    ...house,
    geometry:
      house.geometry.type === 'Polygon'
        ? { type: 'Polygon', coordinates: house.geometry.coordinates.map(translate) }
        : { type: 'MultiPolygon', coordinates: house.geometry.coordinates.map(p => p.map(translate)) },
  };
}
export function validateDraft(points: number[][]): string | null {
  if (points.length < 3) return 'Cần ít nhất 3 đỉnh khác nhau.';
  if (points.some(p => !p.every(Number.isFinite) || Math.abs(p[0]) > 180 || Math.abs(p[1]) > 85)) return 'Tọa độ đỉnh không hợp lệ.';
  const cross = (a: number[], b: number[], c: number[]) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const onSegment = (a: number[], b: number[], c: number[]) =>
    Math.abs(cross(a, b, c)) < 1e-15 &&
    c[0] >= Math.min(a[0], b[0]) &&
    c[0] <= Math.max(a[0], b[0]) &&
    c[1] >= Math.min(a[1], b[1]) &&
    c[1] <= Math.max(a[1], b[1]);
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    if (a[0] === b[0] && a[1] === b[1]) return 'Hai đỉnh liên tiếp bị trùng.';
    for (let j = i + 1; j < points.length; j++) {
      if (j === i + 1 || (i === 0 && j === points.length - 1)) continue;
      const c = points[j],
        d = points[(j + 1) % points.length];
      if (
        (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) ||
        onSegment(a, b, c) ||
        onSegment(a, b, d) ||
        onSegment(c, d, a) ||
        onSegment(c, d, b)
      )
        return 'Polygon tự giao nhau hoặc có đỉnh trùng.';
    }
  }
  const [ox, oy] = points[0];
  const area = points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length];
    return sum + (p[0] - ox) * (q[1] - oy) - (q[0] - ox) * (p[1] - oy);
  }, 0);
  return Math.abs(area) < 1e-12 ? 'Mặt bằng phải có diện tích lớn hơn 0.' : null;
}
/** Grid lookup avoids scanning 79k polygons for every household. Explicit links take precedence. */
export function indexHouseholds(houses: FieldHouse[], households: HouseholdFacility[]) {
  const cells = new Map<string, FieldHouse[]>();
  const byHouse = new Map<string, HouseholdFacility[]>();
  const explicit = new Map<string, string>();
  const cell = (value: number) => Math.floor(value / 0.002);
  for (const house of houses) {
    for (const id of house.properties.householdIds ?? []) explicit.set(id, house.properties.buildingId);
    const [w, s, e, n] = houseBounds(house);
    // Imported footprints are small; extremely large polygons use a fallback cell.
    if ((cell(e) - cell(w) + 1) * (cell(n) - cell(s) + 1) > 10000) {
      const list = cells.get('*') ?? [];
      list.push(house);
      cells.set('*', list);
      continue;
    }
    for (let x = cell(w); x <= cell(e); x++)
      for (let y = cell(s); y <= cell(n); y++) {
        const key = `${x}:${y}`;
        const list = cells.get(key) ?? [];
        list.push(house);
        cells.set(key, list);
      }
  }
  for (const h of households) {
    let id = explicit.get(h.id);
    if (!id && !h.coordinatesEstimated && h.coordinateMethod !== 'RANDOM_WITHIN_TC2' && h.coordinates?.every(Number.isFinite)) {
      const [lat, lng] = h.coordinates;
      id = [...(cells.get(`${cell(lng)}:${cell(lat)}`) ?? []), ...(cells.get('*') ?? [])].find(house =>
        containsHousePoint(house.geometry, [lng, lat]),
      )?.properties.buildingId;
    }
    if (id) {
      const list = byHouse.get(id) ?? [];
      list.push(h);
      byHouse.set(id, list);
    }
  }
  return byHouse;
}
