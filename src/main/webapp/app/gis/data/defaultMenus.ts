import type { DynamicMenuItemConfig } from '../types';

// Product navigation configuration only, not users, residents, audit logs or access grants.
const allRoles: DynamicMenuItemConfig['visibleRoles'] = ['superadmin', 'admin', 'sub-admin', 'officer'];
export const DEFAULT_MENUS: DynamicMenuItemConfig[] = [
  {
    id: 'overview',
    label: 'Tổng quan & Thống kê',
    description: 'Chỉ số từ dữ liệu đã ghi nhận',
    iconName: 'LayoutDashboard',
    visibleRoles: allRoles,
  },
  {
    id: 'area-map',
    label: 'Bản đồ số hóa khu vực',
    description: 'Bản đồ địa bàn với tọa độ nhà đã lưu',
    iconName: 'Map',
    visibleRoles: allRoles,
  },
  {
    id: 'advanced-map',
    label: 'Bản đồ lưới chuyên sâu',
    description: 'Lưới số nhà và dữ liệu địa bàn',
    iconName: 'Grid',
    visibleRoles: allRoles,
  },
  { id: 'field-3d-map', label: 'Bản Đồ 3D', description: 'Dữ liệu GIS và chỉnh sửa công trình', iconName: 'Boxes', visibleRoles: allRoles },
  { id: 'households', label: 'Danh sách hộ dân', description: 'Hồ sơ hộ từ cơ sở dữ liệu', iconName: 'Building', visibleRoles: allRoles },
  {
    id: 'residents',
    label: 'Quản lý nhân khẩu',
    description: 'Hồ sơ nhân khẩu và nguồn kiểm chứng',
    iconName: 'UserCheck',
    visibleRoles: allRoles,
  },
  {
    id: 'documents',
    label: 'Quản lý giấy tờ & ANTT',
    description: 'Hồ sơ và thời hạn đã ghi nhận',
    iconName: 'FileText',
    visibleRoles: allRoles,
  },
  {
    id: 'areas',
    label: 'Quản lý khu vực & Tuyến',
    description: 'Địa bàn, tuyến đường và cán bộ',
    iconName: 'Building2',
    visibleRoles: ['superadmin', 'admin', 'sub-admin'],
  },
  {
    id: 'logs',
    label: 'Nhật ký thao tác',
    description: 'Lịch sử thao tác đã lưu trên máy chủ',
    iconName: 'History',
    visibleRoles: allRoles,
  },
  {
    id: 'subadmin-delegation',
    label: 'Phân quyền Cán bộ & CAV',
    description: 'Phân công địa bàn và ủy quyền nghiệp vụ',
    iconName: 'ShieldAlert',
    visibleRoles: ['superadmin', 'admin', 'sub-admin'],
  },
  {
    id: 'superadmin-hub',
    label: 'Trung tâm Quản trị Tối cao',
    description: 'Tài khoản, cấu hình và bảo mật',
    iconName: 'ShieldCheck',
    visibleRoles: ['superadmin'],
  },
  {
    id: 'settings',
    label: 'Cài đặt & Tài khoản',
    description: 'Thông tin tài khoản từ máy chủ',
    iconName: 'Settings',
    visibleRoles: allRoles,
  },
];
