export type BuildingTypeCode = 'grade4' | 'one' | 'two' | 'three' | 'four' | 'fivePlus' | 'large';

export interface BuildingTypeConfig {
  code: BuildingTypeCode;
  label: string;
  floors: number;
  height: number; // mét
  color: string; // mã hex màu
  description?: string;
}

export const DEFAULT_BUILDING_TYPES: BuildingTypeConfig[] = [
  { code: 'grade4', label: 'Nhà cấp 4', floors: 1, height: 3.5, color: '#eab308', description: 'Công trình nhà cấp 4 truyền thống' },
  { code: 'one', label: 'Nhà 1 tầng', floors: 1, height: 4.5, color: '#3b82f6', description: 'Nhà 1 trệt bê tông kiên cố' },
  { code: 'two', label: 'Nhà 2 tầng', floors: 2, height: 8.0, color: '#10b981', description: 'Nhà 1 trệt 1 lầu dân cư' },
  { code: 'three', label: 'Nhà 3 tầng', floors: 3, height: 11.5, color: '#f97316', description: 'Nhà phố 1 trệt 2 lầu' },
  { code: 'four', label: 'Nhà 4 tầng', floors: 4, height: 15.0, color: '#ef4444', description: 'Nhà phố thương mại / căn hộ gia đình' },
  { code: 'fivePlus', label: 'Nhà 5+ tầng', floors: 5, height: 19.0, color: '#8b5cf6', description: 'Nhà cao tầng / căn hộ dịch vụ' },
  {
    code: 'large',
    label: 'Tòa nhà lớn',
    floors: 6,
    height: 24.0,
    color: '#ec4899',
    description: 'Cơ quan, trường học, TTTM, cơ sở công cộng',
  },
];

export type RoadType = 'main' | 'secondary' | 'alley';

export interface SpatialRoad {
  id: string;
  name: string;
  code: string;
  type: RoadType;
  width: number; // mét (ví dụ 14m, 8m, 3.5m)
  status: string; // ví dụ "Mặt đường nhựa, lưu thông tốt"
  points: [number, number][]; // Tọa độ GIS [lng, lat]
  speedLimit?: number; // km/h
  laneCount?: number;
  connectedHamlets?: string[];
}

export interface SpatialBuilding {
  id: string;
  code: string;
  address: string;
  houseNumber: string;
  street: string;
  hamlet: string;
  buildingTypeCode: BuildingTypeCode;
  floors: number;
  height: number; // mét
  footprint: number; // m²
  coordinates: [number, number]; // [lat, lng]
  householdId?: string;
  householdCode?: string;
  ownerName: string;
  ownerPhone: string;
  status: 'normal' | 'warning' | 'alert' | 'business';
  residentsCount: number;
  maleCount: number;
  femaleCount: number;
  under18Count: number;
  above18Count: number;
  businessName?: string;
  businessCategory?: string;
  lastCheckedDate?: string;
  officerInCharge?: string;
  notes?: string;
}

export interface SpatialHamlet {
  id: string;
  code: string;
  name: string;
  center: [number, number]; // [lat, lng]
  boundary: [number, number][]; // Polygon [lat, lng]
  officerInCharge: string;
  officerPhone: string;
  householdCount: number;
  populationCount: number;
  riskScore: 'normal' | 'warning' | 'high';
}

export type PoiCategory = 'police' | 'school' | 'market' | 'religious' | 'public';

export interface SpatialPoi {
  id: string;
  name: string;
  category: PoiCategory;
  categoryLabel: string;
  address: string;
  hamlet: string;
  coordinates: [number, number]; // [lat, lng]
  description: string;
  icon: string;
}

export interface SpatialMapLayer {
  id: string;
  key: string;
  label: string;
  category: 'buildings' | 'roads' | 'labels' | 'facilities' | 'boundaries';
  visible: boolean;
  color?: string;
  count?: number;
}

export type VisualizationMode = 'standard' | 'height' | 'population' | 'household' | 'risk' | 'custom';

export interface SpatialLabelOptions {
  showHouseNumber: boolean;
  showStreetName: boolean;
  showAlleyName: boolean;
  showHamletName: boolean;
  showHouseId: boolean;
  showOwnerName: boolean;
  showBuildingType: boolean;
}

// Database schema specifications (reusable with existing entities)
export interface ResidentialMapEntity {
  id: string | number;
  name: string;
  sourceMap?: string;
  status: string;
  boundsGeoJson?: string;
  centerLat: number;
  centerLng: number;
  defaultZoom: number;
}

export interface RoadEntity {
  id: string | number;
  name: string;
  code?: string;
  type: RoadType;
  width: number;
  status?: string;
  geometryGeoJson: string;
}

export interface BuildingEntity {
  id: string | number;
  code?: string;
  address: string;
  buildingTypeCode: BuildingTypeCode;
  floors: number;
  height: number;
  footprintArea?: number;
  geometryGeoJson: string;
  householdId?: number | string; // Foreign key referencing Household table
  roadId?: number | string; // Foreign key referencing Road table
  hamletId?: number | string; // Administrative hamlet identifier
}

export interface BuildingTypeEntity {
  id: string | number;
  code: string;
  name: string;
  defaultHeight: number;
  color: string;
}

export interface MapLayerEntity {
  id: string | number;
  name: string;
  code: string;
  category: string;
  visible: boolean;
}

export interface MapSourceEntity {
  id: string | number;
  fileName: string;
  fileUrl: string;
  opacity: number;
  scale: number;
  rotation: number;
  positionX: number;
  positionY: number;
  positionZ: number;
}
