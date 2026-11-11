import type { SubAdminFeaturePermissions, UserRole } from '../types';

export type PermissionKey = keyof SubAdminFeaturePermissions;

/** Short Vietnamese labels for the 11 business permissions, in the server's catalogue order. */
export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  canViewAdvancedMap: 'Xem bản đồ lưới chuyên sâu',
  canViewField3DMap: 'Xem bản đồ không gian 3D',
  canEditCoordinates: 'Hiệu chỉnh tọa độ nhà',
  canAddHouseholds: 'Đăng ký hộ dân & cơ sở mới',
  canScanOcr: 'Quét camera / OCR CCCD',
  canRenewDocs: 'Duyệt gia hạn giấy chứng nhận',
  canExportReports: 'Xuất báo cáo dữ liệu',
  canSendReminders: 'Phát hành văn bản đôn đốc',
  canUpdateInspection: 'Ghi nhận kết quả kiểm tra thực địa',
  canManageStreets: 'Phân chia tuyến đường & hẻm',
  canRevealIdentity: 'Xem số CCCD đầy đủ',
};

export const PERMISSION_KEYS = Object.keys(PERMISSION_LABELS) as PermissionKey[];

/** Viewing the two maps can be delegated by any supervisor in scope, even one who lacks it (server rule). */
export const MAP_VIEW_PERMISSIONS: PermissionKey[] = ['canViewAdvancedMap', 'canViewField3DMap'];

export const GROUP_ROLE_LABELS: Record<Exclude<UserRole, 'superadmin'>, string> = {
  officer: 'Công an viên',
  'sub-admin': 'Cán bộ quản lý ấp',
  admin: 'Trưởng Công an xã',
};
