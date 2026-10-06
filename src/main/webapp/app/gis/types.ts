export type NavigationTab =
  | 'overview'
  | 'area-map'
  | 'advanced-map'
  | 'households'
  | 'residents'
  | 'documents'
  | 'areas'
  | 'logs'
  | 'settings'
  | 'superadmin-hub'
  | 'subadmin-delegation';

export type UserRole = 'superadmin' | 'admin' | 'sub-admin' | 'officer';

export interface SubAdminFeaturePermissions {
  canEditCoordinates: boolean; // Được hiệu chỉnh tọa độ nhà trên bản đồ
  canAddHouseholds: boolean; // Được đăng ký hồ sơ hộ dân mới
  canScanOcr: boolean; // Được sử dụng camera quét căn cước / OCR
  canRenewDocs: boolean; // Được duyệt gia hạn giấy tờ ANTT
  canExportReports: boolean; // Được xuất báo cáo danh sách CSV/Excel
  canSendReminders: boolean; // Được phát hành thông báo đôn đốc
  canUpdateInspection: boolean; // Được ghi nhận kết quả kiểm tra thực địa
  canManageStreets: boolean; // Được phân tuyến đường hẻm phụ trách
}

export interface AppUser {
  id: string;
  username: string;
  email?: string;
  fullName: string;
  role: UserRole;
  rank: string; // Cấp bậc CAND: Đại tá, Thượng tá, Thiếu tá, Đại úy, Thượng úy, Trung úy...
  position: string; // Chức vụ: Quản trị viên tối cao, Trưởng Công an Xã, CSKV Quản lý Ấp, Công an viên Phụ trách Tuyến
  unit: string; // Đơn vị: CATP.HCM / Công an Quận Bình Tân / Công an Xã (Phường) An Lạc
  badgeNumber: string; // Số hiệu CAND
  phone: string;
  assignedWard: string; // Phường/Xã phụ trách (e.g. "Phường An Lạc")
  assignedHamlets: string[]; // Các ấp phụ trách (e.g. ['Ấp 1', 'Ấp 2'])
  assignedStreets: string[]; // Các tuyến đường, hẻm phụ trách (e.g. ['Đường Kinh Dương Vương', 'Hẻm 418', 'Đường Hồ Học Lãm'])
  subAdminPermissions?: SubAdminFeaturePermissions; // Áp dụng cho cấp dưới (officer) do sub-admin phân quyền
  status: 'active' | 'suspended' | 'locked';
  createdAt: string;
  lastLogin?: string;
  isOnline?: boolean;
  avatarUrl?: string;
}

export interface AllowedEmailEntry {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  rank: string;
  position: string;
  assignedWard: string;
  assignedHamlets: string[];
  assignedStreets?: string[];
  note?: string;
  addedBy: string;
  addedAt: string;
  status: 'active' | 'revoked';
}

export interface DynamicMenuItemConfig {
  id: NavigationTab;
  label: string;
  description: string;
  iconName: string;
  visibleRoles: UserRole[]; // Danh sách các vai trò được phép nhìn thấy menu này
  requiredPermission?: keyof SubAdminFeaturePermissions; // Yêu cầu quyền phụ (đối với officer)
  badgeKey?: string;
}

export interface HcmAdminUnit {
  id: string;
  district: string; // Quận/Huyện TP.HCM (e.g. "Quận Bình Tân", "Huyện Bình Chánh", "TP. Thủ Đức")
  ward: string; // Phường/Xã (e.g. "Phường An Lạc", "Phường An Lạc A", "Xã Vĩnh Lộc A")
  hamlet: string; // Ấp/Khu phố (e.g. "Ấp 1", "Ấp 2", "Khu phố 3")
  streetsAndAlleys: string[]; // Tuyến đường & danh mục hẻm mới nhất (e.g. ["Đường Kinh Dương Vương", "Hẻm 418 KDV", "Hẻm 432", "Đường Hồ Học Lãm"])
  totalHouseholds: number;
  officerInChargeId?: string;
  officerInChargeName?: string;
  updatedAt: string;
}

export type SecurityAlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'warning' | 'info';

export interface SecurityAlert {
  id: string;
  timestamp: string;
  severity: SecurityAlertSeverity;
  title: string;
  details: string;
  sourceIp: string;
  attemptedEmailOrUser?: string;
  targetResource: string;
  emailNotified: boolean;
  adminEmailTarget: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  resolvedNotes?: string;
}

export interface BlacklistedIpEntry {
  id: string;
  ipAddress: string;
  reason: string;
  blockedAt: string;
  blockedBy: string;
  status: 'blocked' | 'unblocked';
  sourceAlertId?: string;
  notes?: string;
  hitCount?: number;
}

export type HouseholdStatus = 'normal' | 'warning' | 'alert' | 'business';

export type ResidenceType = 'Thường trú' | 'Tạm trú' | 'Lưu trú';

export interface Resident {
  id: string;
  fullName: string;
  birthYear: number;
  gender: 'Nam' | 'Nữ';
  relationship: string;
  idCardNumber?: string;
  residenceType: 'Thường trú' | 'Tạm trú' | 'Lưu trú';
  isMonitored?: boolean;
  phone?: string;
  occupation?: string;
  ethnicity?: string;
  notes?: string;
  startDate?: string;
}

export interface InspectionPhoto {
  id: string;
  url: string; // Base64 data image or image link
  caption?: string;
  timestamp: string; // e.g., '16/09/2026 15:30'
  takenBy: string; // Officer name
  category?: 'facade' | 'business_sign' | 'fire_safety' | 'general';
}

export type HamletName =
  'Ấp Bắc Lân' | 'Ấp Nam Lân' | 'Ấp Tây Lân' | 'Ấp Đông Lân' | 'Ấp Hậu Lân' | 'Ấp Tiền Lân' | 'Ấp 1' | 'Ấp 2' | string;

export interface HouseholdFacility {
  id: string;
  code: string;
  houseNumber: string;
  street: string;
  hamlet: HamletName;
  neighborhoodGroup?: string; // Tổ dân phố (e.g. 'Tổ 1', 'Tổ 2', 'Tổ 3', 'Tổ 4'...)
  alley?: string; // Tuyến hẻm (e.g. 'Mặt tiền đường', 'Hẻm 418', 'Hẻm 432'...)
  ownerName: string;
  ownerPhone: string;
  type: 'household' | 'business' | 'special_monitoring';
  businessName?: string;
  businessCategory?: string;
  residentsCount: number;
  maleCount: number;
  femaleCount: number;
  under18Count: number;
  above18Count: number;
  status: HouseholdStatus;
  warningMessage?: string;
  licenseExpiry?: string;
  licenseType?: string;
  coordinates: [number, number]; // Latitude, Longitude in An Lac, Binh Tan
  gridPosition: {
    row: number;
    col: number;
  };
  notes: string;
  lastCheckedDate: string;
  officerInCharge: string;
  residenceType?: ResidenceType;
  residentsList?: Resident[];
  inspectionPhotos?: InspectionPhoto[];
}

export interface DocumentRecord {
  id: string;
  docCode: string;
  title: string;
  targetName: string;
  address: string;
  hamlet: HamletName;
  category: 'license_security' | 'business_permit' | 'temporary_stay' | 'special_record' | 'fire_safety';
  categoryLabel: string;
  issueDate: string;
  expiryDate: string;
  status: 'valid' | 'expiring_soon' | 'expired' | 'pending_renewal';
  urgency: 'high' | 'medium' | 'normal';
  notes: string;
  daysRemaining?: number;
}

export interface OfficerProfile {
  officerName: string;
  rank: string;
  unit: string;
  badgeNumber: string;
  username: string;
  permissions: string;
  isOnline: boolean;
  phone: string;
  assignedHamlets: string[];
}

export const DEFAULT_OFFICER: OfficerProfile = {
  officerName: 'Nguyễn Văn Bình',
  rank: 'CSKV — P.An Lạc',
  unit: 'Công an Phường An Lạc, Quận Bình Tân, TP.HCM',
  badgeNumber: '284-912',
  username: 'cskv_binh',
  permissions: 'Chỉ xem và quản lý [ẤP 1 & ẤP 2] thuộc P. An Lạc',
  isOnline: true,
  phone: '0908.123.456',
  assignedHamlets: ['Ấp 1', 'Ấp 2'],
};

export interface OcrExtractedData {
  documentType: 'cccd' | 'business_license' | 'other';
  rawText?: string;
  confidence?: number;
  // CCCD fields
  idCardNumber?: string;
  fullName?: string;
  dateOfBirth?: string;
  birthYear?: number;
  gender?: 'Nam' | 'Nữ';
  hometown?: string;
  permanentAddress?: string;
  issueDate?: string;
  expiryDate?: string;

  // Business license fields
  businessName?: string;
  taxCode?: string;
  legalRepresentative?: string;
  businessAddress?: string;
  businessLines?: string;
  registeredDate?: string;

  notes?: string;
}

export type AuditActionType =
  | 'coordinate_update' // Chỉnh sửa tọa độ
  | 'profile_update' // Cập nhật hồ sơ / ghi chú kiểm tra
  | 'reminder_sent' // Nhắc nhở & đôn đốc
  | 'household_add' // Thêm hộ dân / cơ sở mới
  | 'document_renew' // Gia hạn văn bản / giấy phép
  | 'ocr_scan' // Trích xuất OCR / CCCD
  | 'officer_update' // Cập nhật tài khoản cán bộ
  | 'system'; // Thao tác hệ thống

export interface AuditLogEntry {
  id: string;
  timestamp: string; // Định dạng ngày giờ: DD/MM/YYYY HH:mm:ss
  createdAt: number; // Epoch timestamp để sắp xếp chính xác
  actionType: AuditActionType;
  actionLabel: string; // Tên hành động hiển thị
  officerName: string; // Tên cán bộ thao tác
  officerBadge: string; // Số hiệu cán bộ
  targetType: 'household' | 'document' | 'officer' | 'system';
  targetId?: string; // ID đối tượng (nếu có)
  targetCode?: string; // Mã đối tượng (e.g. HD-AP1-001)
  targetTitle: string; // Tên đối tượng hoặc số nhà
  details: string; // Nội dung chi tiết thao tác
  previousValue?: string; // Giá trị trước thay đổi
  newValue?: string; // Giá trị sau thay đổi
  ipAddress?: string; // Địa chỉ IP
  deviceInfo?: string; // Thông tin thiết bị tuần tra
  integrityHash?: string; // Mã băm toàn vẹn (SHA-256)
  status?: 'success' | 'warning' | 'info';
}
