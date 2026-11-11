import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  ShieldCheck,
  Users,
  MapPin,
  Check,
  Sliders,
  Award,
  FileText,
  Camera,
  Map,
  Grid3X3,
  Boxes,
  Download,
  BellRing,
  Building,
  Building2,
  Edit3,
  Eye,
  Lock,
} from 'lucide-react';
import { AppUser, SubAdminFeaturePermissions } from '../types';
import { saveDelegation, fetchRbacAreas, fetchDelegationRoads, fetchPermissionGroups } from '../services/authService';
import { MAP_VIEW_PERMISSIONS } from '../data/permissionCatalog';
import type { PermissionGroup } from '../types';
import { AdministrativeDirectory } from './AdministrativeDirectory';

interface SubAdminDelegationTabProps {
  currentUser: AppUser;
  usersList: AppUser[];
  onShowToast: (msg: string) => void;
}

interface AssignmentOption {
  value: string;
  label: string;
}

/** Multi-choice list with visible checkboxes; the result keeps the option order, like a multi-select. */
const AssignmentChecklist: React.FC<{
  label: string;
  options: AssignmentOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  emptyText: string;
}> = ({ label, options, selected, onChange, disabled, emptyText }) => {
  const chosen = new Set(selected);
  const toggle = (value: string, checked: boolean) => {
    const next = new Set(chosen);
    if (checked) next.add(value);
    else next.delete(value);
    onChange(options.filter(option => next.has(option.value)).map(option => option.value));
  };
  const count = options.filter(option => chosen.has(option.value)).length;
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="sr-only">{label}</legend>
      <div className="mb-1 text-xs text-slate-400 tabular-nums">
        Đã chọn {count}/{options.length}
      </div>
      <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-1">
        {options.length === 0 ? (
          <p className="px-2 py-2 text-xs text-slate-400">{emptyText}</p>
        ) : (
          options.map(option => (
            <label
              key={option.value}
              className="gis-assignment-option min-h-[36px] cursor-pointer rounded-md px-2 py-1.5 text-sm text-slate-200 transition-colors hover:bg-slate-800"
            >
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 accent-[#1c4e3a]"
                checked={chosen.has(option.value)}
                onChange={e => toggle(option.value, e.target.checked)}
              />
              <span className="min-w-0 break-words">{option.label}</span>
            </label>
          ))
        )}
      </div>
    </fieldset>
  );
};

export const SubAdminDelegationTab: React.FC<SubAdminDelegationTabProps> = ({ currentUser, usersList, onShowToast }) => {
  const [areas, setAreas] = useState<{ id: number; hamletId: number; communeId: number; name: string; hamletName: string }[]>([]);
  const [selectedHamletIds, setSelectedHamletIds] = useState<number[]>([]);
  const [selectedCommuneId, setSelectedCommuneId] = useState<number | null>(null);
  const [roads, setRoads] = useState<{ hamletId: number; name: string }[]>([]);
  const [roadsLoading, setRoadsLoading] = useState(true);
  const [roadsError, setRoadsError] = useState(false);
  useEffect(() => {
    let active = true;
    void fetchDelegationRoads()
      .then(data => {
        if (active) setRoads(data);
      })
      .catch(() => {
        if (active) setRoadsError(true);
      })
      .finally(() => {
        if (active) setRoadsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  useEffect(() => {
    void fetchPermissionGroups()
      .then(setGroups)
      .catch(() => {
        /* The editor still works flag by flag without the group list. */
      });
  }, [usersList]);
  useEffect(() => {
    void fetchRbacAreas()
      .then(setAreas)
      .catch(() => onShowToast('Không thể tải danh mục địa bàn.'));
  }, []);
  const isSuperAdmin = currentUser.role === 'superadmin';
  const isAdmin = currentUser.role === 'admin';
  const isSubAdmin = currentUser.role === 'sub-admin';

  // Hamlet filter for Admin and Super Admin
  const [hamletDelegationFilter, setHamletDelegationFilter] = useState<string>('all');

  // Subordinates filtering based on RBAC hierarchy:
  // - superadmin can manage admin, sub-admin, and officer
  // - admin (Trưởng CAX) can manage sub-admin (Cán bộ quản lý ấp) and officer (Công an viên)
  // - sub-admin (Cán bộ quản lý ấp) can manage officer (Công an viên) in their specific hamlet
  const subordinates = usersList.filter(u => u.id !== currentUser.id && u.role !== 'superadmin');

  const [roleFilter, setRoleFilter] = useState<'all' | 'sub-admin' | 'officer'>('all');
  const displayedSubordinates = subordinates.filter(u => {
    const roleMatch = roleFilter === 'all' || u.role === roleFilter;
    const hamletMatch = hamletDelegationFilter === 'all' || u.assignedHamlets?.some(h => h === hamletDelegationFilter);
    return roleMatch && hamletMatch;
  });

  const [selectedOfficer, setSelectedOfficer] = useState<AppUser | null>(null);

  const [permissions, setPermissions] = useState<SubAdminFeaturePermissions>(
    selectedOfficer?.subAdminPermissions || {
      canViewAdvancedMap: false,
      canViewField3DMap: false,
      canEditCoordinates: false,
      canAddHouseholds: false,
      canScanOcr: false,
      canRenewDocs: false,
      canExportReports: false,
      canSendReminders: false,
      canUpdateInspection: false,
      canManageStreets: false,
      canRevealIdentity: false,
    },
  );

  const [assignedHamletsInput, setAssignedHamletsInput] = useState<string>('');

  const [assignedStreetsInput, setAssignedStreetsInput] = useState<string>('');
  const assignedRoads = assignedStreetsInput
    .split(',')
    .map(name => name.trim())
    .filter(Boolean);
  const availableRoads = Array.from(new Set(roads.filter(road => selectedHamletIds.includes(road.hamletId)).map(road => road.name)));
  const roadOptions = Array.from(new Set([...availableRoads, ...assignedRoads]));

  // Sync selection if subordinates change
  useEffect(() => {
    if (!selectedOfficer && displayedSubordinates.length > 0) {
      handleSelectOfficer(displayedSubordinates[0]);
    } else if (selectedOfficer && !displayedSubordinates.some(s => s.id === selectedOfficer.id) && displayedSubordinates.length > 0) {
      handleSelectOfficer(displayedSubordinates[0]);
    }
  }, [displayedSubordinates.length, roleFilter]);

  const handleSelectOfficer = (officer: AppUser) => {
    setSelectedHamletIds(officer.hamletIds || []);
    setSelectedOfficer(officer);
    setPermissions(
      officer.subAdminPermissions || {
        canViewAdvancedMap: false,
        canViewField3DMap: false,
        canEditCoordinates: false,
        canAddHouseholds: false,
        canScanOcr: false,
        canRenewDocs: false,
        canExportReports: false,
        canSendReminders: false,
        canUpdateInspection: false,
        canManageStreets: false,
        canRevealIdentity: false,
      },
    );
    setAssignedHamletsInput(officer.assignedHamlets?.join(', ') || '');
    setAssignedStreetsInput(officer.assignedStreets?.join(', ') || '');
  };

  /**
   * Why a permission cannot be switched on for the selected officer, mirroring the server: it is outside the group
   * ceiling set by the super admin, or the delegate does not hold it (map viewing and existing grants excepted).
   */
  const lockReason = (key: keyof SubAdminFeaturePermissions): string | null => {
    const ceiling = selectedOfficer?.permissionCeiling;
    if (ceiling && !ceiling.includes(key)) return 'Ngoài phạm vi nhóm do Super Admin đặt';
    const canGrant =
      isSuperAdmin ||
      MAP_VIEW_PERMISSIONS.includes(key) ||
      currentUser.subAdminPermissions?.[key] === true ||
      selectedOfficer?.subAdminPermissions?.[key] === true;
    return canGrant ? null : 'Bạn chưa có quyền này nên không thể cấp';
  };
  const selectedGroup = groups.find(group => group.id === selectedOfficer?.permissionGroupId);

  const handleTogglePermission = (key: keyof SubAdminFeaturePermissions) => {
    if (!permissions[key] && lockReason(key)) return;
    setPermissions(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSaveDelegation = async () => {
    if (!selectedOfficer) return;
    if (selectedHamletIds.some(id => !areas.some(area => area.id === id))) {
      onShowToast('Phân công cũ chưa liên kết với ấp mới. Hãy chọn lại các ấp hành chính trước khi lưu.');
      return;
    }

    const streets = assignedStreetsInput
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const hamlets = assignedHamletsInput
      .split(',')
      .map(h => h.trim())
      .filter(Boolean);

    const updatedOfficer: AppUser = {
      ...selectedOfficer,
      hamletIds: selectedHamletIds,
      subAdminPermissions: permissions,
      assignedStreets: streets,
      assignedHamlets: hamlets.length > 0 ? hamlets : selectedOfficer.assignedHamlets,
    };

    try {
      const saved = await saveDelegation(updatedOfficer);
      setSelectedOfficer(saved);
      onShowToast(`Đã lưu phân quyền & phân công địa bàn cho ${selectedOfficer.rank} ${selectedOfficer.fullName}.`);
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : undefined;
      alert('Lỗi lưu phân quyền: ' + (typeof detail === 'string' ? detail : err instanceof Error ? err.message : 'Không xác định'));
    }
  };

  const permissionItems: {
    key: keyof SubAdminFeaturePermissions;
    title: string;
    desc: string;
    icon: any;
  }[] = [
    {
      key: 'canViewAdvancedMap',
      title: 'Xem bản đồ lưới chuyên sâu',
      desc: 'Cho phép mở bản đồ địa bàn MapLibre 2D/3D và xem các lớp thông tin.',
      icon: Grid3X3,
    },
    {
      key: 'canViewField3DMap',
      title: 'Xem bản đồ không gian 3D',
      desc: 'Cho phép mở bản đồ thực địa 3D và xem mô hình nhà, đường, khu vực.',
      icon: Boxes,
    },
    {
      key: 'canEditCoordinates',
      title: 'Hiệu chỉnh tọa độ nhà trên bản đồ địa bàn',
      desc: 'Cho phép nắn chỉnh vị trí số nhà thực tế và lưu tọa độ GPS mới vào hệ thống',
      icon: Map,
    },
    {
      key: 'canAddHouseholds',
      title: 'Đăng ký thêm hồ sơ Hộ dân & Cơ sở mới',
      desc: 'Cho phép khởi tạo hồ sơ nhân khẩu, cơ sở kinh doanh có điều kiện ANTT',
      icon: Users,
    },
    {
      key: 'canScanOcr',
      title: 'Quét Camera / OCR Căn cước công dân (CCCD)',
      desc: 'Tự động trích xuất thông tin nhân khẩu từ hình ảnh thẻ căn cước',
      icon: Camera,
    },
    {
      key: 'canRenewDocs',
      title: 'Duyệt Gia hạn Giấy chứng nhận ANTT / PCCC',
      desc: 'Quyền phê duyệt gia hạn giấy phép cho các cơ sở kinh doanh trên địa bàn',
      icon: FileText,
    },
    {
      key: 'canExportReports',
      title: 'Xuất Báo cáo Danh sách Dữ liệu (CSV/Excel)',
      desc: 'Tải dữ liệu danh sách hộ dân, nhân khẩu, văn bản hoặc lịch sử kiểm toán phục vụ thanh tra',
      icon: Download,
    },
    {
      key: 'canSendReminders',
      title: 'Phát hành Văn bản Nhắc nhở & Đôn đốc',
      desc: 'Gửi văn bản đôn đốc kiểm tra an toàn PCCC, an ninh trật tự tới chủ hộ',
      icon: BellRing,
    },
    {
      key: 'canUpdateInspection',
      title: 'Ghi nhận Kết quả Kiểm tra Thực địa',
      desc: 'Cập nhật ghi chú tuần tra, chụp ảnh hiện trường và lập biên bản nhắc nhở',
      icon: Edit3,
    },
    {
      key: 'canManageStreets',
      title: 'Tự phân chia Tuyến đường & Đường hẻm phụ trách',
      desc: 'Cán bộ được phép tự gắn tuyến đường hoặc hẻm mới vào danh mục theo dõi',
      icon: Building,
    },
    {
      key: 'canRevealIdentity',
      title: 'Xem số CCCD đầy đủ (có kiểm soát)',
      desc: 'Cho phép mở số định danh đầy đủ của nhân khẩu; mỗi lần xem đều được ghi nhật ký kiểm tra',
      icon: Eye,
    },
  ];

  const subAdminCount = subordinates.filter(u => u.role === 'sub-admin').length;
  const officerCount = subordinates.filter(u => u.role === 'officer').length;

  return (
    <div id="subadmin-delegation-tab" className="space-y-5">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 sm:p-5 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-900/60 text-emerald-300 border border-emerald-700/60 text-xs font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                {isAdmin
                  ? 'Trưởng Công an xã / phường điều hành'
                  : isSubAdmin
                    ? 'Cán bộ quản lý ấp điều hành'
                    : 'Quản trị viên tối cao điều hành'}
              </span>
              <span className="text-xs text-slate-400">
                {currentUser.position} • {currentUser.fullName}
              </span>
            </div>
            <h2 className="gis-admin-title text-2xl font-bold text-white tracking-tight">
              {isAdmin ? 'Quản lý và phân quyền cán bộ' : isSubAdmin ? 'Phân quyền địa bàn' : 'Phân quyền nghiệp vụ'}
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl">
              {isAdmin
                ? 'Trưởng Công an Xã trực tiếp phân công địa bàn ấp, phân quyền nghiệp vụ cho Cán bộ Quản lý Ấp (Sub-Admin) và giám sát phân bổ quyền cho Công an viên cấp dưới.'
                : isSubAdmin
                  ? 'Cán bộ Quản lý Ấp trực tiếp phân công tuyến đường/hẻm và ủy quyền các tính năng nghiệp vụ cho Công an viên cấp dưới trong ca trực.'
                  : 'Quản trị viên Tối cao phân bổ địa bàn và phân quyền nghiệp vụ cho toàn bộ cán bộ các cấp trên hệ thống.'}
            </p>
          </div>

          <button
            type="button"
            id="btn-save-delegation"
            onClick={handleSaveDelegation}
            className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm flex items-center gap-2 transition-colors cursor-pointer self-start md:self-auto"
          >
            <ShieldCheck className="w-4 h-4" />
            Lưu Cấu Hình Phân Quyền
          </button>
        </div>
      </div>

      {/* Main Layout: List of Officers + Delegation Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Officer Selector */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="gis-admin-list-heading text-sm font-semibold text-slate-300 tabular-nums">
              Cán bộ cấp dưới thuộc thẩm quyền ({subordinates.length})
            </h3>
          </div>

          {/* Filter by role for Admin & Super Admin */}
          {(isAdmin || isSuperAdmin) && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-xl border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setRoleFilter('all')}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-colors text-[11px] tabular-nums ${
                    roleFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Tất cả ({subordinates.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('sub-admin')}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-colors text-[11px] tabular-nums ${
                    roleFilter === 'sub-admin' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  QL Ấp ({subAdminCount})
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('officer')}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-colors text-[11px] tabular-nums ${
                    roleFilter === 'officer' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  CA Viên ({officerCount})
                </button>
              </div>

              {/* Filter by Hamlet */}
              <div
                role="group"
                aria-label="Lọc theo ấp"
                className="flex max-h-40 flex-wrap gap-1 overflow-y-auto p-1 bg-slate-900/60 rounded-xl border border-slate-800 text-xs"
              >
                {[
                  { id: 'all', label: 'Tất cả ấp' },
                  ...Array.from(new Set(areas.map(a => a.hamletName).filter(Boolean))).map(name => ({ id: name, label: name })),
                ].map(h => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setHamletDelegationFilter(h.id)}
                    aria-pressed={hamletDelegationFilter === h.id}
                    className={`px-2 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                      hamletDelegationFilter === h.id ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {displayedSubordinates.length === 0 ? (
            <div className="p-6 text-center rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400">
              Không có cán bộ nào phù hợp với bộ lọc.
            </div>
          ) : (
            <div className="space-y-2 max-h-[420px] lg:max-h-[680px] overflow-y-auto pr-0.5">
              {displayedSubordinates.map(off => {
                const isSelected = selectedOfficer?.id === off.id;
                const isSubAdminRole = off.role === 'sub-admin';
                return (
                  <button
                    key={off.id}
                    type="button"
                    onClick={() => handleSelectOfficer(off)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-colors flex items-start justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800 border-emerald-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm">
                          {off.rank} {off.fullName}
                        </span>
                        <span
                          className={`text-[11px] px-1.5 py-0.5 rounded font-bold ${
                            isSubAdminRole
                              ? 'bg-blue-900/80 text-blue-200 border border-blue-700'
                              : 'bg-emerald-900/80 text-emerald-200 border border-emerald-700'
                          }`}
                        >
                          {isSubAdminRole ? 'Cán bộ QL ấp' : 'Công an viên'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{off.position}</div>
                      {/* Only the facts the profile has: no empty "Số hiệu:" or bare separators. */}
                      <div className="text-xs text-slate-400 mt-1">
                        {[
                          off.badgeNumber && `Số hiệu ${off.badgeNumber}`,
                          off.assignedWard,
                          off.assignedHamlets?.length ? off.assignedHamlets.join(', ') : 'Chưa gán ấp',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                      {off.assignedStreets && off.assignedStreets.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {off.assignedStreets.map((st, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
                              {st}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Permission Checklist & Road Assignment */}
        <div className="lg:col-span-8">
          {selectedOfficer ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] text-emerald-400 font-bold">Đang thiết lập thẩm quyền cho</span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded font-bold ${
                        selectedOfficer.role === 'sub-admin'
                          ? 'bg-blue-900/80 text-blue-200 border border-blue-700'
                          : 'bg-emerald-900/80 text-emerald-200 border border-emerald-700'
                      }`}
                    >
                      {selectedOfficer.role === 'sub-admin' ? 'Cán bộ quản lý ấp (sub-admin)' : 'Công an viên (officer)'}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2 mt-1 flex-wrap">
                    <Award className="w-5 h-5 text-amber-400" />
                    {selectedOfficer.rank} {selectedOfficer.fullName}
                    {selectedOfficer.badgeNumber && (
                      <span data-id className="text-xs px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-slate-300 font-mono">
                        Số hiệu {selectedOfficer.badgeNumber}
                      </span>
                    )}
                  </h2>
                </div>

                <div className="text-xs text-slate-400">
                  Đơn vị: <strong className="text-slate-200">{selectedOfficer.unit}</strong>
                </div>
              </div>

              {/* Assignment of Hamlets (Địa bàn Ấp/Khu phố) */}
              <div className="space-y-2 p-4 rounded-xl bg-slate-950 border border-slate-800">
                <label className="block text-xs font-bold text-emerald-400 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  {selectedOfficer.role === 'sub-admin'
                    ? 'Phân bổ địa bàn ấp / khu phố quản lý toàn diện:'
                    : 'Phân bổ ấp / khu phố trực thuộc thực nhiệm:'}
                </label>
                <p className="text-[11px] text-slate-400">
                  {selectedOfficer.role === 'sub-admin'
                    ? 'Chỉ định các ấp do cán bộ này trực tiếp quản lý dân cư và giám sát công an viên:'
                    : 'Chỉ định ấp mà công an viên này thực hiện tuần tra kiểm soát:'}
                </p>
                <AssignmentChecklist
                  label="Area assignments"
                  options={areas
                    .filter(area => selectedCommuneId === null || area.communeId === selectedCommuneId)
                    .map(area => ({ value: String(area.id), label: `${area.hamletName} (ID ấp ${area.hamletId})` }))}
                  selected={selectedHamletIds.map(String)}
                  onChange={values => setSelectedHamletIds(values.map(Number))}
                  emptyText="Chưa có ấp nào trong đơn vị đã chọn."
                />
              </div>

              {/* Assignment of Streets and Alleys */}
              <div className="space-y-2 p-4 rounded-xl bg-slate-950 border border-slate-800">
                <label className="block text-xs font-bold text-amber-400 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {selectedOfficer.role === 'sub-admin'
                    ? 'Tuyến đường trọng điểm & mạng lưới hẻm thuộc ấp:'
                    : 'Tuyến đường, đoạn phố & tuyến hẻm phụ trách tuần tra trực tiếp:'}
                </label>
                <p className="text-[11px] text-slate-400">
                  Giao cụ thể các tuyến đường hoặc hẻm thuộc ấp để thực hiện tuần tra, giám sát an ninh trật tự:
                </p>
                <AssignmentChecklist
                  label="Road assignments from database"
                  disabled={roadsLoading || roadsError}
                  options={roadOptions.map(name => ({ value: name, label: name }))}
                  selected={assignedRoads}
                  onChange={values => setAssignedStreetsInput(values.join(', '))}
                  emptyText="Chưa có tuyến đường/hẻm trong các ấp đã chọn."
                />
                <p className="text-xs text-slate-400 tabular-nums" role="status">
                  {roadsLoading
                    ? 'Đang tải tuyến đường từ DB...'
                    : roadsError
                      ? 'Không thể tải tuyến đường. Phân công hiện tại được giữ nguyên.'
                      : `${availableRoads.length} tuyến đường/hẻm có trong hồ sơ hộ dân của các địa bàn đã chọn.`}
                </p>
              </div>

              <AdministrativeDirectory onCommuneChange={setSelectedCommuneId} />

              {/* Toggles for Feature permissions */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-emerald-400" />
                    Bảng phân quyền tính năng nghiệp vụ
                  </h3>
                  <span className="text-[11px] text-slate-400">Bật để cấp quyền, Tắt để khóa tính năng</span>
                </div>
                {selectedOfficer?.permissionGroupName && (
                  <p className="text-[11px] text-slate-400">
                    Nhóm quyền: <span className="font-semibold text-slate-200">{selectedOfficer.permissionGroupName}</span> (Super Admin đặt
                    phạm vi được phép; quyền cụ thể do bạn chọn)
                  </p>
                )}
                {selectedOfficer && selectedGroup && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = { ...permissions };
                      for (const item of permissionItems)
                        next[item.key] = selectedGroup.defaults.includes(item.key) && !lockReason(item.key);
                      setPermissions(next);
                      onShowToast('Đã điền quyền mặc định của nhóm. Bấm "Xác nhận & cập nhật quyền hạn" để lưu.');
                    }}
                    className="py-2 px-3 rounded-lg border border-emerald-600/70 text-emerald-300 hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Áp dụng mặc định của nhóm
                  </button>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {permissionItems.map(item => {
                    const isGranted = !!permissions[item.key];
                    const locked = !isGranted ? lockReason(item.key) : null;
                    const IconComp = item.icon;
                    return (
                      <div
                        key={item.key}
                        role="checkbox"
                        aria-checked={isGranted}
                        aria-disabled={locked ? true : undefined}
                        aria-label={item.title}
                        title={locked ?? undefined}
                        tabIndex={0}
                        onKeyDown={event => {
                          if (event.key === ' ' || event.key === 'Enter') {
                            event.preventDefault();
                            handleTogglePermission(item.key);
                          }
                        }}
                        onClick={() => handleTogglePermission(item.key)}
                        className={`p-3.5 rounded-xl border transition-colors flex items-start justify-between gap-3 ${
                          locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                        } ${isGranted ? 'bg-slate-800 border-emerald-600/70' : 'bg-slate-950 border-slate-800'}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 mt-0.5 text-slate-300">
                            <IconComp className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">{item.title}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{item.desc}</div>
                            {locked && (
                              <div className="text-[11px] text-amber-300 mt-1 flex items-center gap-1">
                                <Lock className="w-3 h-3" aria-hidden="true" />
                                {locked}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 mt-1">
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                              isGranted ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-700 bg-slate-900'
                            }`}
                          >
                            <Check className={`w-3.5 h-3.5 ${isGranted ? 'visible' : 'invisible'}`} aria-hidden="true" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveDelegation}
                  className="py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Xác nhận & cập nhật quyền hạn
                </button>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-xs">
              Vui lòng chọn một cán bộ ở danh sách bên trái để phân quyền.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
