export type BuildingTypeCode = 'grade4' | 'one' | 'two' | 'three' | 'four' | 'fivePlus' | 'large';
export interface BuildingTypeConfig {
  code: BuildingTypeCode;
  label: string;
  floors: number;
  height: number;
  color: string;
}

// Keep map rendering defaults separate from household data. A later admin API can replace this table.
export const BUILDING_TYPES: BuildingTypeConfig[] = [
  { code: 'grade4', label: 'Nhà cấp 4', floors: 1, height: 3.5, color: '#e9c46a' },
  { code: 'one', label: 'Nhà 1 tầng', floors: 1, height: 4, color: '#65a9db' },
  { code: 'two', label: 'Nhà 2 tầng', floors: 2, height: 7, color: '#68b884' },
  { code: 'three', label: 'Nhà 3 tầng', floors: 3, height: 10, color: '#eea25c' },
  { code: 'four', label: 'Nhà 4 tầng', floors: 4, height: 13, color: '#dc7770' },
  { code: 'fivePlus', label: 'Nhà 5+ tầng', floors: 5, height: 17, color: '#c46570' },
  { code: 'large', label: 'Tòa nhà lớn', floors: 6, height: 22, color: '#9c82bd' },
];

export const UNKNOWN_BUILDING_COLOR = '#94a3b8';
export const HOUSE_STATUS_STYLE: Record<string, { label: string; color: string }> = {
  normal: { label: 'Bình thường', color: '#10b981' },
  warning: { label: 'Cảnh báo', color: '#f59e0b' },
  alert: { label: 'Nguy cơ cao', color: '#ef4444' },
  business: { label: 'Cơ sở kinh doanh', color: '#3b82f6' },
};

export function buildingTypeFromFloors(floors: number, config: BuildingTypeConfig[] = BUILDING_TYPES): BuildingTypeConfig | undefined {
  if (!Number.isFinite(floors) || floors < 1) return undefined;
  const code: BuildingTypeCode = floors >= 5 ? 'fivePlus' : floors === 4 ? 'four' : floors === 3 ? 'three' : floors === 2 ? 'two' : 'one';
  return config.find(type => type.code === code);
}

export type RoadType = 'main' | 'secondary' | 'alley';
export const ROAD_STYLE: Record<RoadType, { label: string; defaultWidth: number; color: string }> = {
  main: { label: 'Đường chính', defaultWidth: 8, color: '#d5dde3' },
  secondary: { label: 'Đường phụ', defaultWidth: 5, color: '#e0e5e8' },
  alley: { label: 'Hẻm/ngõ', defaultWidth: 2.5, color: '#e9e8df' },
};

export function householdBuildingType(config: BuildingTypeConfig[] = BUILDING_TYPES): BuildingTypeConfig {
  // Existing Household has no floors/building type. Do not infer floors from facility type.
  return config[0] || BUILDING_TYPES[0];
}

export function pointFootprint(lng: number, lat: number, width = 6, depth = 8): number[][][] {
  const dx = width / (2 * 111_320 * Math.cos((lat * Math.PI) / 180));
  const dy = depth / (2 * 111_320);
  return [
    [
      [lng - dx, lat - dy],
      [lng + dx, lat - dy],
      [lng + dx, lat + dy],
      [lng - dx, lat + dy],
      [lng - dx, lat - dy],
    ],
  ];
}

export function roadRibbon(coordinates: number[][], width: number): number[][][] | null {
  if (coordinates.length < 2 || width <= 0) return null;
  const left: number[][] = [];
  const right: number[][] = [];
  for (let i = 0; i < coordinates.length; i++) {
    const before = coordinates[Math.max(0, i - 1)];
    const after = coordinates[Math.min(coordinates.length - 1, i + 1)];
    const lat = coordinates[i][1];
    const metersX = (after[0] - before[0]) * 111_320 * Math.cos((lat * Math.PI) / 180);
    const metersY = (after[1] - before[1]) * 111_320;
    const length = Math.hypot(metersX, metersY);
    if (length < 0.001) return null;
    const nx = ((-metersY / length) * width) / 2;
    const ny = ((metersX / length) * width) / 2;
    const deltaLng = nx / (111_320 * Math.cos((lat * Math.PI) / 180));
    const deltaLat = ny / 111_320;
    left.push([coordinates[i][0] + deltaLng, lat + deltaLat]);
    right.push([coordinates[i][0] - deltaLng, lat - deltaLat]);
  }
  const ring = [...left, ...right.reverse(), left[0]];
  return [ring];
}
