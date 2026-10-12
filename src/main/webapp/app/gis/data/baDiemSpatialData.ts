import { HouseholdFacility } from '../types';
import {
  BuildingTypeConfig,
  DEFAULT_BUILDING_TYPES,
  SpatialBuilding,
  SpatialHamlet,
  SpatialPoi,
  SpatialRoad,
  BuildingTypeCode,
} from '../models/spatial3dTypes';

/**
 * Tọa độ trung tâm Xã Bà Điểm, Huyện Hóc Môn, TP. Hồ Chí Minh
 */
export const BA_DIEM_CENTER: [number, number] = [10.8525, 106.611]; // [lat, lng]

/**
 * Chuyển đổi tọa độ GPS [lat, lng] sang hệ tọa độ không gian 3D Three.js [x, z] tính bằng mét
 * với gốc tọa độ (0, 0, 0) đặt tại tâm xã Bà Điểm.
 */
export function latLngToWorld(lat: number, lng: number): [number, number] {
  const centerLat = BA_DIEM_CENTER[0];
  const centerLng = BA_DIEM_CENTER[1];
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos((centerLat * Math.PI) / 180);

  // x: Trục Đông - Tây (East-West)
  const x = (lng - centerLng) * metersPerDegLng;
  // z: Trục Bắc - Nam (Three.js: -z hướng Bắc, +z hướng Nam)
  const z = -(lat - centerLat) * metersPerDegLat;

  return [x, z];
}

/**
 * Chuyển đổi ngược từ không gian 3D [x, z] sang GPS [lat, lng]
 */
export function worldToLatLng(x: number, z: number): [number, number] {
  const centerLat = BA_DIEM_CENTER[0];
  const centerLng = BA_DIEM_CENTER[1];
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos((centerLat * Math.PI) / 180);

  const lat = centerLat - z / metersPerDegLat;
  const lng = centerLng + x / metersPerDegLng;
  return [lat, lng];
}

/**
 * Ranh giới hành chính bao phủ toàn bộ diện tích Xã Bà Điểm (~7.4 km²)
 * Phía Bắc giáp Xã Xuân Thới Thượng, phía Đông giáp Quận 12 (P. Tân Thới Nhất, Tân Hưng Thuận),
 * phía Nam giáp Xã Vĩnh Lộc A (Bình Chánh), phía Tây giáp đường Hưng Lân / Vành Đai.
 */
export const BA_DIEM_COMMUNE_BOUNDARY: [number, number][] = [
  [10.868, 106.602], // Đỉnh Bắc (gần QL22)
  [10.865, 106.618], // Đông Bắc (giáp Quận 12)
  [10.858, 106.626], // Đông (QL1A ranh giới Q12)
  [10.846, 106.623], // Đông Nam (nút giao An Sương - Phan Văn Hớn)
  [10.836, 106.615], // Cực Nam (giáp Bình Tân / Vĩnh Lộc A)
  [10.838, 106.598], // Tây Nam (kênh Tham Lương / Rạch Cầu Sa)
  [10.848, 106.592], // Tây (khu vực Hưng Lân - Vĩnh Lộc)
  [10.86, 106.595], // Tây Bắc (giáp Xuân Thới Thượng)
  [10.868, 106.602], // Khép góc
];

/**
 * Danh sách 8+ Ấp / Khu dân cư thuộc Xã Bà Điểm
 */
export const BA_DIEM_HAMLETS: SpatialHamlet[] = [
  {
    id: 'hamlet-bac-lan',
    code: 'AP-BL',
    name: 'Ấp Bắc Lân',
    center: [10.862, 106.605],
    boundary: [
      [10.868, 106.602],
      [10.865, 106.614],
      [10.858, 106.61],
      [10.859, 106.598],
      [10.868, 106.602],
    ],
    officerInCharge: 'Đại úy Nguyễn Văn Bình',
    officerPhone: '0908.123.456',
    householdCount: 520,
    populationCount: 1980,
    riskScore: 'normal',
  },
  {
    id: 'hamlet-nam-lan',
    code: 'AP-NL',
    name: 'Ấp Nam Lân',
    center: [10.841, 106.608],
    boundary: [
      [10.846, 106.602],
      [10.846, 106.616],
      [10.836, 106.615],
      [10.838, 106.598],
      [10.846, 106.602],
    ],
    officerInCharge: 'Thượng úy Trần Minh Hoàng',
    officerPhone: '0909.234.567',
    householdCount: 485,
    populationCount: 1740,
    riskScore: 'warning',
  },
  {
    id: 'hamlet-tay-lan',
    code: 'AP-TL',
    name: 'Ấp Tây Lân',
    center: [10.851, 106.596],
    boundary: [
      [10.858, 106.596],
      [10.854, 106.604],
      [10.845, 106.601],
      [10.848, 106.592],
      [10.858, 106.596],
    ],
    officerInCharge: 'Đại úy Lê Hữu Tài',
    officerPhone: '0913.345.678',
    householdCount: 430,
    populationCount: 1560,
    riskScore: 'normal',
  },
  {
    id: 'hamlet-dong-lan',
    code: 'AP-DL',
    name: 'Ấp Đông Lân',
    center: [10.856, 106.621],
    boundary: [
      [10.863, 106.616],
      [10.858, 106.626],
      [10.849, 106.622],
      [10.851, 106.614],
      [10.863, 106.616],
    ],
    officerInCharge: 'Trung tá Phạm Quốc Hùng',
    officerPhone: '0903.456.789',
    householdCount: 640,
    populationCount: 2350,
    riskScore: 'warning',
  },
  {
    id: 'hamlet-hau-lan',
    code: 'AP-HL',
    name: 'Ấp Hậu Lân',
    center: [10.849, 106.608],
    boundary: [
      [10.854, 106.605],
      [10.854, 106.614],
      [10.845, 106.613],
      [10.846, 106.604],
      [10.854, 106.605],
    ],
    officerInCharge: 'Đại úy Đặng Văn Nam',
    officerPhone: '0988.567.890',
    householdCount: 510,
    populationCount: 1890,
    riskScore: 'normal',
  },
  {
    id: 'hamlet-tien-lan',
    code: 'AP-TIL',
    name: 'Ấp Tiền Lân',
    center: [10.852, 106.616],
    boundary: [
      [10.856, 106.612],
      [10.855, 106.622],
      [10.847, 106.619],
      [10.848, 106.612],
      [10.856, 106.612],
    ],
    officerInCharge: 'Thiếu tá Nguyễn Thanh Sơn',
    officerPhone: '0977.678.901',
    householdCount: 580,
    populationCount: 2120,
    riskScore: 'normal',
  },
  {
    id: 'hamlet-ap-1',
    code: 'AP-01',
    name: 'Ấp 1',
    center: [10.863, 106.601],
    boundary: [
      [10.867, 106.598],
      [10.866, 106.606],
      [10.86, 106.604],
      [10.861, 106.596],
      [10.867, 106.598],
    ],
    officerInCharge: 'Đại úy Trần Văn Khoa',
    officerPhone: '0932.789.012',
    householdCount: 390,
    populationCount: 1420,
    riskScore: 'normal',
  },
  {
    id: 'hamlet-ap-2',
    code: 'AP-02',
    name: 'Ấp 2',
    center: [10.843, 106.618],
    boundary: [
      [10.848, 106.616],
      [10.846, 106.623],
      [10.839, 106.62],
      [10.841, 106.614],
      [10.848, 106.616],
    ],
    officerInCharge: 'Thượng úy Bùi Quốc Dũng',
    officerPhone: '0944.890.123',
    householdCount: 460,
    populationCount: 1680,
    riskScore: 'warning',
  },
];

/**
 * Mạng lưới đường giao thông 3D bao phủ Xã Bà Điểm:
 * Dữ liệu vector GPS chính xác 100% trích xuất từ OpenStreetMap / vệ tinh
 */
export { BA_DIEM_ROADS } from './baDiemRealRoads';

export const BA_DIEM_POIS: SpatialPoi[] = [
  {
    id: 'poi-police-hq',
    name: 'Trụ sở Công an Xã Bà Điểm',
    category: 'police',
    categoryLabel: 'Công an & An ninh',
    address: 'Đường Phan Văn Hớn, Ấp Tiền Lân, Xã Bà Điểm',
    hamlet: 'Ấp Tiền Lân',
    coordinates: [10.8532, 106.6125],
    description: 'Trụ sở chỉ huy Công an Xã Bà Điểm, tiếp nhận trình báo ANTT & dịch vụ công VNeID',
    icon: 'ShieldCheck',
  },
  {
    id: 'poi-police-baclan',
    name: 'Điểm CSKV Ấp Bắc Lân',
    category: 'police',
    categoryLabel: 'Công an & An ninh',
    address: 'Đường Nguyễn Ảnh Thủ, Ấp Bắc Lân',
    hamlet: 'Ấp Bắc Lân',
    coordinates: [10.8635, 106.605],
    description: 'Chốt trực CSKV và Lực lượng tham gia bảo vệ ANTT cơ sở',
    icon: 'Shield',
  },
  {
    id: 'poi-police-tienlan',
    name: 'Điểm CSKV Ấp Tiền Lân & Chợ',
    category: 'police',
    categoryLabel: 'Công an & An ninh',
    address: 'Ngã ba Phan Văn Hớn - Bà Điểm 4',
    hamlet: 'Ấp Tiền Lân',
    coordinates: [10.8515, 106.615],
    description: 'Chốt kiểm soát an ninh khu vực chợ Bà Điểm',
    icon: 'Shield',
  },
  {
    id: 'poi-police-donglan',
    name: 'Điểm CSKV Ấp Đông Lân (Giáp Q12)',
    category: 'police',
    categoryLabel: 'Công an & An ninh',
    address: 'QL1A giao Phan Văn Hớn, Ấp Đông Lân',
    hamlet: 'Ấp Đông Lân',
    coordinates: [10.8565, 106.622],
    description: 'Chốt tuần tra kiểm soát tuyến vành đai giáp ranh',
    icon: 'Shield',
  },
  {
    id: 'poi-ubnd',
    name: 'UBND Xã Bà Điểm',
    category: 'public',
    categoryLabel: 'Cơ quan hành chính',
    address: 'Đường Phan Văn Hớn, Ấp Tiền Lân, Xã Bà Điểm',
    hamlet: 'Ấp Tiền Lân',
    coordinates: [10.8538, 106.6115],
    description: 'Ủy ban Nhân dân xã Bà Điểm, Bộ phận một cửa',
    icon: 'Building2',
  },
  {
    id: 'poi-market-badiem',
    name: 'Chợ Bà Điểm',
    category: 'market',
    categoryLabel: 'Chợ & Thương mại',
    address: 'Đường Phan Văn Hớn, Ấp Hậu Lân',
    hamlet: 'Ấp Hậu Lân',
    coordinates: [10.8508, 106.6095],
    description: 'Chợ truyền thống sầm uất trung tâm xã, hơn 250 tiểu thương',
    icon: 'Store',
  },
  {
    id: 'poi-market-hocmon',
    name: 'Chợ Đầu Mối Hóc Môn (Khu vực giáp ranh)',
    category: 'market',
    categoryLabel: 'Chợ & Thương mại',
    address: 'Đường Nguyễn Thị Sóc - QL22',
    hamlet: 'Ấp Bắc Lân',
    coordinates: [10.8655, 106.609],
    description: 'Chợ đầu mối nông sản thực phẩm lớn nhất khu vực Tây Bắc TP.HCM',
    icon: 'Store',
  },
  {
    id: 'poi-school-thcs',
    name: 'Trường THCS Bà Điểm',
    category: 'school',
    categoryLabel: 'Giáo dục',
    address: 'Đường Bà Điểm 4, Ấp Tiền Lân',
    hamlet: 'Ấp Tiền Lân',
    coordinates: [10.8545, 106.614],
    description: 'Trường THCS chuẩn quốc gia, hơn 1.800 học sinh',
    icon: 'GraduationCap',
  },
  {
    id: 'poi-school-primary',
    name: 'Trường Tiểu học Tây Bắc Lân',
    category: 'school',
    categoryLabel: 'Giáo dục',
    address: 'Đường Nguyễn Ảnh Thủ, Ấp Bắc Lân',
    hamlet: 'Ấp Bắc Lân',
    coordinates: [10.861, 106.603],
    description: 'Trường tiểu học khu vực Ấp Bắc Lân',
    icon: 'GraduationCap',
  },
  {
    id: 'poi-school-kinder',
    name: 'Trường Mầm non Hướng Dương',
    category: 'school',
    categoryLabel: 'Giáo dục',
    address: 'Đường Hưng Lân, Ấp Hậu Lân',
    hamlet: 'Ấp Hậu Lân',
    coordinates: [10.8475, 106.606],
    description: 'Cơ sở giáo dục mầm non công lập',
    icon: 'GraduationCap',
  },
  {
    id: 'poi-pagoda-vp',
    name: 'Chùa Vĩnh Phước',
    category: 'religious',
    categoryLabel: 'Tôn giáo & Tín ngưỡng',
    address: 'Đường Phan Văn Hớn, Ấp Tiền Lân',
    hamlet: 'Ấp Tiền Lân',
    coordinates: [10.855, 106.618],
    description: 'Di tích văn hóa tín ngưỡng cổ kính của địa phương',
    icon: 'Landmark',
  },
  {
    id: 'poi-temple-bd',
    name: 'Đình Thần Bà Điểm',
    category: 'religious',
    categoryLabel: 'Tôn giáo & Tín ngưỡng',
    address: 'Ấp Tây Lân, Xã Bà Điểm',
    hamlet: 'Ấp Tây Lân',
    coordinates: [10.8495, 106.598],
    description: 'Đình làng lịch sử 18 Thôn Vườn Trầu anh hùng',
    icon: 'Landmark',
  },
  {
    id: 'poi-church-bd',
    name: 'Giáo xứ Bà Điểm',
    category: 'religious',
    categoryLabel: 'Tôn giáo & Tín ngưỡng',
    address: 'Đường Phan Văn Hớn, Ấp Bắc Lân',
    hamlet: 'Ấp Bắc Lân',
    coordinates: [10.858, 106.608],
    description: 'Nhà thờ Giáo xứ Bà Điểm, sinh hoạt giáo dân đông đúc',
    icon: 'Landmark',
  },
  {
    id: 'poi-health-station',
    name: 'Trạm Y Tế Xã Bà Điểm',
    category: 'public',
    categoryLabel: 'Y tế & Sức khỏe',
    address: 'Đường Bà Điểm 5, Ấp Hậu Lân',
    hamlet: 'Ấp Hậu Lân',
    coordinates: [10.8502, 106.6075],
    description: 'Trạm y tế phục vụ khám chữa bệnh ban đầu và tiêm chủng',
    icon: 'Cross',
  },
];

/**
 * Helper: Tạo danh sách các căn nhà 3D hoàn chỉnh cho Xã Bà Điểm:
 * - Tích hợp toàn bộ hộ dân thực tế từ danh sách `households` (database)
 * - Tự động bổ sung các khối nhà dân cư dọc theo các tuyến đường & ấp của xã Bà Điểm
 *   để bao phủ đầy đủ toàn bộ diện tích 7.4 km² của xã.
 */
export function generateBaDiemSpatialBuildings(
  households: HouseholdFacility[],
  buildingConfigs: BuildingTypeConfig[] = DEFAULT_BUILDING_TYPES,
): SpatialBuilding[] {
  const result: SpatialBuilding[] = [];
  const configMap = new Map<BuildingTypeCode, BuildingTypeConfig>(buildingConfigs.map(c => [c.code, c]));

  // 1. Chuyển đổi các Household thực tế trong database sang SpatialBuilding
  households.forEach((h, idx) => {
    // Xác định số tầng và loại nhà dựa trên dữ liệu hoặc phân bổ ngẫu nhiên có kiểm soát
    let typeCode: BuildingTypeCode = 'grade4';
    let floors = 1;

    if (h.type === 'business') {
      if ((h.residentsCount || 0) > 6) {
        typeCode = 'four';
        floors = 4;
      } else {
        typeCode = 'three';
        floors = 3;
      }
    } else if (h.status === 'alert' || h.type === 'special_monitoring') {
      typeCode = 'two';
      floors = 2;
    } else {
      // Phân bổ nhà dân thường:
      const mod = idx % 10;
      if (mod <= 3) {
        typeCode = 'grade4'; // 40% nhà cấp 4
        floors = 1;
      } else if (mod <= 5) {
        typeCode = 'one'; // 20% nhà 1 tầng
        floors = 1;
      } else if (mod <= 8) {
        typeCode = 'two'; // 30% nhà 2 tầng
        floors = 2;
      } else {
        typeCode = 'three'; // 10% nhà 3 tầng
        floors = 3;
      }
    }

    const cfg = configMap.get(typeCode) || DEFAULT_BUILDING_TYPES[0];
    const lat = h.coordinates?.[0] || 10.8525;
    const lng = h.coordinates?.[1] || 10.611;

    result.push({
      id: `bld-hh-${h.id || idx}`,
      code: h.code || `HK-BD-${String(idx + 1).padStart(3, '0')}`,
      address: `${h.houseNumber || `${idx + 1}`} ${h.street || 'Đường Phan Văn Hớn'}, ${h.hamlet || 'Ấp Tiền Lân'}, Xã Bà Điểm`,
      houseNumber: h.houseNumber || `${idx + 1}`,
      street: h.street || 'Đường Phan Văn Hớn',
      hamlet: h.hamlet || 'Ấp Tiền Lân',
      buildingTypeCode: typeCode,
      floors,
      height: cfg.height,
      footprint: 55 + (idx % 8) * 15,
      coordinates: [lat, lng],
      householdId: h.id,
      householdCode: h.code,
      ownerName: h.ownerName || 'Chưa cập nhật',
      ownerPhone: h.ownerPhone || '0903.000.000',
      status: h.status || 'normal',
      residentsCount: h.residentsCount || 3,
      maleCount: h.maleCount || 1,
      femaleCount: h.femaleCount || 2,
      under18Count: h.under18Count || 1,
      above18Count: h.above18Count || 2,
      businessName: h.businessName,
      businessCategory: h.businessCategory,
      lastCheckedDate: h.lastCheckedDate || '12/10/2026',
      officerInCharge: h.officerInCharge || 'Cán bộ CSKV Xã Bà Điểm',
      notes: h.notes,
    });
  });

  // 2. Sinh các dãy nhà dân cư phụ trợ (residential clusters) phủ kín 8 ấp của Xã Bà Điểm
  // Đảm bảo người dùng có thể duyệt toàn cảnh 3D sống động cả xã
  const streetsData = [
    { street: 'Đường Phan Văn Hớn', hamlet: 'Ấp Tiền Lân', baseLat: 10.853, baseLng: 106.613, count: 48, prefix: '124/' },
    { street: 'Đường Phan Văn Hớn', hamlet: 'Ấp Hậu Lân', baseLat: 10.851, baseLng: 106.608, count: 44, prefix: '418/' },
    { street: 'Đường Phan Văn Hớn', hamlet: 'Ấp Tây Lân', baseLat: 10.848, baseLng: 106.602, count: 36, prefix: '520/' },
    { street: 'Đường Quốc Lộ 22', hamlet: 'Ấp Bắc Lân', baseLat: 10.864, baseLng: 106.608, count: 52, prefix: 'QL22-' },
    { street: 'Đường Nguyễn Ảnh Thủ', hamlet: 'Ấp 1', baseLat: 10.863, baseLng: 106.602, count: 40, prefix: '82/' },
    { street: 'Đường Bà Điểm 4', hamlet: 'Ấp Hậu Lân', baseLat: 10.849, baseLng: 106.61, count: 32, prefix: '45/' },
    { street: 'Đường Hưng Lân', hamlet: 'Ấp Nam Lân', baseLat: 10.843, baseLng: 106.605, count: 38, prefix: '68/' },
    { street: 'Đường Quốc Lộ 1A', hamlet: 'Ấp Đông Lân', baseLat: 10.857, baseLng: 106.623, count: 45, prefix: '1A-' },
    { street: 'Đường Bà Điểm 12', hamlet: 'Ấp 2', baseLat: 10.844, baseLng: 106.619, count: 35, prefix: '12/' },
    { street: 'Đường Tây Lân', hamlet: 'Ấp Tây Lân', baseLat: 10.852, baseLng: 106.595, count: 30, prefix: 'TL-' },
  ];

  let synthIndex = result.length + 1;
  streetsData.forEach(st => {
    for (let i = 0; i < st.count; i++) {
      const houseNum = `${st.prefix}${i + 1}`;
      // Offset vị trí dọc hai bên tuyến đường (hai hàng nhà mặt tiền và hẻm)
      const side = i % 2 === 0 ? 1 : -1;
      const step = Math.floor(i / 2);
      const latOffset = (step * 0.00035 + side * 0.00015) * (Math.random() * 0.2 + 0.9);
      const lngOffset = (step * 0.00045 - side * 0.0002) * (Math.random() * 0.2 + 0.9);

      const lat = st.baseLat + latOffset;
      const lng = st.baseLng + lngOffset;

      // Phân bổ loại nhà thực tế ở xã Bà Điểm
      let typeCode: BuildingTypeCode;
      let floors: number;
      const rand = (i + synthIndex) % 15;

      if (rand === 0) {
        typeCode = 'large'; // Tòa nhà công cộng/trụ sở/siêu thị
        floors = 6;
      } else if (rand <= 2) {
        typeCode = 'fivePlus'; // Nhà 5 tầng
        floors = 5;
      } else if (rand <= 4) {
        typeCode = 'four'; // Nhà 4 tầng
        floors = 4;
      } else if (rand <= 7) {
        typeCode = 'three'; // Nhà 3 tầng
        floors = 3;
      } else if (rand <= 10) {
        typeCode = 'two'; // Nhà 2 tầng
        floors = 2;
      } else if (rand <= 12) {
        typeCode = 'one'; // Nhà 1 tầng
        floors = 1;
      } else {
        typeCode = 'grade4'; // Nhà cấp 4
        floors = 1;
      }

      const cfg = configMap.get(typeCode) || DEFAULT_BUILDING_TYPES[0];
      const isBiz = rand % 4 === 0;
      const isWarning = rand === 13;
      const isAlert = rand === 14;

      const owners = [
        'Nguyễn Văn Long',
        'Trần Thị Mai',
        'Lê Hoàng Nam',
        'Phạm Minh Tuấn',
        'Đặng Thu Hà',
        'Bùi Văn Hùng',
        'Võ Thị Tuyết',
        'Đỗ Thành Đạt',
      ];
      const owner = owners[synthIndex % owners.length];

      result.push({
        id: `bld-synth-${synthIndex}`,
        code: `HK-BD-${String(synthIndex).padStart(4, '0')}`,
        address: `${houseNum} ${st.street}, ${st.hamlet}, Xã Bà Điểm`,
        houseNumber: houseNum,
        street: st.street,
        hamlet: st.hamlet,
        buildingTypeCode: typeCode,
        floors,
        height: cfg.height,
        footprint: 45 + (synthIndex % 7) * 16,
        coordinates: [lat, lng],
        ownerName: owner,
        ownerPhone: `09${Math.floor(10000000 + Math.random() * 89999999)}`,
        status: isAlert ? 'alert' : isWarning ? 'warning' : isBiz ? 'business' : 'normal',
        residentsCount: floors * 2 + (synthIndex % 3),
        maleCount: Math.ceil((floors * 2) / 2),
        femaleCount: Math.floor((floors * 2) / 2) + (synthIndex % 2),
        under18Count: floors > 2 ? 1 : 0,
        above18Count: floors * 2,
        businessName: isBiz ? `Cơ sở ${st.street.split(' ')[1] || 'Kinh doanh'} #${i + 1}` : undefined,
        businessCategory: isBiz ? (i % 2 === 0 ? 'Dịch vụ ăn uống / Cà phê' : 'Tạp hóa / Bách hóa') : undefined,
        lastCheckedDate: '10/10/2026',
        officerInCharge: 'Cán bộ CSKV phụ trách',
        notes: isAlert ? 'Đối tượng cần theo dõi an ninh' : isWarning ? 'Hồ sơ PCCC sắp hết hạn' : 'Cư trú ổn định',
      });
      synthIndex++;
    }
  });

  return result;
}
