import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  Users,
  MapPin,
  Check,
  X,
  Sliders,
  Award,
  FileText,
  Camera,
  Map,
  Download,
  BellRing,
  Building,
  Building2,
  Edit3,
  Filter,
} from 'lucide-react';
import { AppUser, SubAdminFeaturePermissions } from '../types';
import { saveUserInFirestore } from '../services/authService';

interface SubAdminDelegationTabProps {
  currentUser: AppUser;
  usersList: AppUser[];
  onShowToast: (msg: string) => void;
}

export const SubAdminDelegationTab: React.FC<SubAdminDelegationTabProps> = ({ currentUser, usersList, onShowToast }) => {
  const isSuperAdmin = currentUser.role === 'superadmin';
  const isAdmin = currentUser.role === 'admin';
  const isSubAdmin = currentUser.role === 'sub-admin';

  // Hamlet filter for Admin and Super Admin
  const [hamletDelegationFilter, setHamletDelegationFilter] = useState<string>('all');

  // Subordinates filtering based on RBAC hierarchy:
  // - superadmin can manage admin, sub-admin, and officer
  // - admin (Trưởng CAX) can manage sub-admin (Cán bộ quản lý ấp) and officer (Công an viên)
  // - sub-admin (Cán bộ quản lý ấp) can manage officer (Công an viên) in their specific hamlet
  const subordinates = usersList.filter(u => {
    if (u.id === currentUser.id) return false;
    if (isSuperAdmin) return u.role !== 'superadmin';
    if (isAdmin) return u.role === 'sub-admin' || u.role === 'officer';
    if (isSubAdmin) {
      // Sub-admin of a specific hamlet exclusively manages officers within their assigned hamlet(s)
      const matchesHamlet = u.assignedHamlets?.some(h =>
        currentUser.assignedHamlets?.some(
          ch =>
            ch.toLowerCase().trim() === h.toLowerCase().trim() ||
            h.toLowerCase().includes(ch.toLowerCase()) ||
            ch.toLowerCase().includes(h.toLowerCase()),
        ),
      );
      const isUnassigned = !u.assignedHamlets || u.assignedHamlets.length === 0;
      return u.role === 'officer' && (matchesHamlet || isUnassigned);
    }
    return false;
  });

  const [roleFilter, setRoleFilter] = useState<'all' | 'sub-admin' | 'officer'>('all');
  const displayedSubordinates = subordinates.filter(u => {
    const roleMatch = roleFilter === 'all' || u.role === roleFilter;
    const hamletMatch =
      hamletDelegationFilter === 'all' ||
      u.assignedHamlets?.some(
        h =>
          h.toLowerCase().includes(hamletDelegationFilter.toLowerCase()) || hamletDelegationFilter.toLowerCase().includes(h.toLowerCase()),
      );
    return roleMatch && hamletMatch;
  });

  const [selectedOfficer, setSelectedOfficer] = useState<AppUser | null>(displayedSubordinates[0] || null);

  const [permissions, setPermissions] = useState<SubAdminFeaturePermissions>(
    selectedOfficer?.subAdminPermissions || {
      canEditCoordinates: true,
      canAddHouseholds: true,
      canScanOcr: true,
      canRenewDocs: false,
      canExportReports: false,
      canSendReminders: true,
      canUpdateInspection: true,
      canManageStreets: false,
    },
  );

  const [assignedHamletsInput, setAssignedHamletsInput] = useState<string>(selectedOfficer?.assignedHamlets?.join(', ') || 'Ấp 1');

  const [assignedStreetsInput, setAssignedStreetsInput] = useState<string>(
    selectedOfficer?.assignedStreets?.join(', ') || 'Hẻm 418 Kinh Dương Vương, Hẻm 432',
  );

  // Sync selection if subordinates change
  useEffect(() => {
    if (!selectedOfficer && displayedSubordinates.length > 0) {
      handleSelectOfficer(displayedSubordinates[0]);
    } else if (selectedOfficer && !displayedSubordinates.some(s => s.id === selectedOfficer.id) && displayedSubordinates.length > 0) {
      handleSelectOfficer(displayedSubordinates[0]);
    }
  }, [displayedSubordinates.length, roleFilter]);

  const handleSelectOfficer = (officer: AppUser) => {
    setSelectedOfficer(officer);
    setPermissions(
      officer.subAdminPermissions || {
        canEditCoordinates: true,
        canAddHouseholds: true,
        canScanOcr: true,
        canRenewDocs: false,
        canExportReports: false,
        canSendReminders: true,
        canUpdateInspection: true,
        canManageStreets: false,
      },
    );
    setAssignedHamletsInput(officer.assignedHamlets?.join(', ') || '');
    setAssignedStreetsInput(officer.assignedStreets?.join(', ') || '');
  };

  const handleTogglePermission = (key: keyof SubAdminFeaturePermissions) => {
    setPermissions(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSaveDelegation = async () => {
    if (!selectedOfficer) return;

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
      subAdminPermissions: permissions,
      assignedStreets: streets,
      assignedHamlets: hamlets.length > 0 ? hamlets : selectedOfficer.assignedHamlets,
    };

    try {
      await saveUserInFirestore(updatedOfficer);
      onShowToast(`Đã lưu phân quyền & phân công địa bàn cho ${selectedOfficer.rank} ${selectedOfficer.fullName}.`);
    } catch (err: any) {
      alert('Lỗi lưu phân quyền: ' + err.message);
    }
  };

  const permissionItems: {
    key: keyof SubAdminFeaturePermissions;
    title: string;
    desc: string;
    icon: any;
  }[] = [
    {
      key: 'canEditCoordinates',
      title: 'Hiệu chỉnh tọa độ nhà trên Bản đồ Leaflet',
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
  ];

  const subAdminCount = subordinates.filter(u => u.role === 'sub-admin').length;
  const officerCount = subordinates.filter(u => u.role === 'officer').length;

  return (
    <div id="subadmin-delegation-tab" className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-slate-900 border border-blue-800/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-md bg-blue-900/60 text-blue-300 border border-blue-700/60 text-xs font-mono font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                {isAdmin
                  ? 'TRƯỞNG CÔNG AN XÃ / PHƯỜNG ĐIỀU HÀNH'
                  : isSubAdmin
                    ? 'CÁN BỘ QUẢN LÝ ẤP ĐIỀU HÀNH'
                    : 'QUẢN TRỊ VIÊN TỐI CAO ĐIỀU HÀNH'}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {currentUser.position} • {currentUser.fullName}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {isAdmin
                ? 'Quản Lý & Phân Quyền Cán Bộ Quản Lý Ấp & Công An Viên'
                : isSubAdmin
                  ? 'Phân Quyền Tuyến Địa Bàn Cho Công An Viên Cấp Dưới'
                  : 'Ủy Quyền Thẩm Quyền Nghiệp Vụ Toàn Diện Các Cấp'}
            </h1>
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
            className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-blue-900/40 flex items-center gap-2 transition cursor-pointer self-start md:self-auto"
          >
            <ShieldCheck className="w-4 h-4" />
            Lưu Cấu Hình Phân Quyền
          </button>
        </div>
      </div>

      {/* Main Layout: List of Officers + Delegation Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Officer Selector */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
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
                  className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition text-[11px] ${
                    roleFilter === 'all' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Tất cả ({subordinates.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('sub-admin')}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition text-[11px] ${
                    roleFilter === 'sub-admin' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  QL Ấp ({subAdminCount})
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('officer')}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition text-[11px] ${
                    roleFilter === 'officer' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  CA Viên ({officerCount})
                </button>
              </div>

              {/* Filter by Hamlet */}
              <div className="flex flex-wrap gap-1 p-1 bg-slate-900/60 rounded-xl border border-slate-800 text-[11px]">
                {[
                  { id: 'all', label: 'Tất cả ấp' },
                  { id: 'Bắc Lân', label: 'Ấp Bắc Lân' },
                  { id: 'Nam Lân', label: 'Ấp Nam Lân' },
                  { id: 'Đông Lân', label: 'Ấp Đông Lân' },
                  { id: 'Tiền Lân', label: 'Ấp Tiền Lân' },
                ].map(h => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setHamletDelegationFilter(h.id)}
                    className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                      hamletDelegationFilter === h.id
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {displayedSubordinates.length === 0 ? (
            <div className="p-6 text-center rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-400">
              Không có cán bộ nào phù hợp với bộ lọc.
            </div>
          ) : (
            <div className="space-y-2">
              {displayedSubordinates.map(off => {
                const isSelected = selectedOfficer?.id === off.id;
                const isSubAdminRole = off.role === 'sub-admin';
                return (
                  <button
                    key={off.id}
                    type="button"
                    onClick={() => handleSelectOfficer(off)}
                    className={`w-full text-left p-4 rounded-xl border transition-all flex items-start justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-blue-950/60 border-blue-500 text-white shadow-lg'
                        : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">
                          {off.rank} {off.fullName}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase font-mono ${
                            isSubAdminRole
                              ? 'bg-blue-900/80 text-blue-200 border border-blue-700'
                              : 'bg-emerald-900/80 text-emerald-200 border border-emerald-700'
                          }`}
                        >
                          {isSubAdminRole ? 'CÁN BỘ QL ẤP' : 'CÔNG AN VIÊN'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{off.position}</div>
                      <div className="text-[11px] text-slate-400 mt-1 font-mono">
                        Số hiệu: <strong className="text-amber-400">{off.badgeNumber}</strong> • {off.assignedWard} (
                        {off.assignedHamlets?.join(', ') || 'Chưa gán ấp'})
                      </div>
                      {off.assignedStreets && off.assignedStreets.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {off.assignedStreets.map((st, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-300">
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
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-blue-400 font-bold uppercase">ĐANG THIẾT LẬP THẨM QUYỀN CHO:</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase font-mono ${
                        selectedOfficer.role === 'sub-admin'
                          ? 'bg-blue-900/80 text-blue-200 border border-blue-700'
                          : 'bg-emerald-900/80 text-emerald-200 border border-emerald-700'
                      }`}
                    >
                      {selectedOfficer.role === 'sub-admin' ? 'CÁN BỘ QUẢN LÝ ẤP (SUB-ADMIN)' : 'CÔNG AN VIÊN (OFFICER)'}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2 mt-1">
                    <Award className="w-5 h-5 text-amber-400" />
                    {selectedOfficer.rank} {selectedOfficer.fullName}
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-slate-300 font-mono">
                      SH: {selectedOfficer.badgeNumber}
                    </span>
                  </h2>
                </div>

                <div className="text-xs text-slate-400">
                  Đơn vị: <strong className="text-slate-200">{selectedOfficer.unit}</strong>
                </div>
              </div>

              {/* Assignment of Hamlets (Địa bàn Ấp/Khu phố) */}
              <div className="space-y-2 p-4 rounded-xl bg-slate-950 border border-slate-800">
                <label className="block text-xs font-bold text-blue-400 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  {selectedOfficer.role === 'sub-admin'
                    ? 'Phân Bổ Địa Bàn Ấp / Khu Phố Quản Lý Toàn Diện:'
                    : 'Phân Bổ Ấp / Khu Phố Trực Thuộc Thực Nhiệm:'}
                </label>
                <p className="text-[11px] text-slate-400">
                  {selectedOfficer.role === 'sub-admin'
                    ? 'Chỉ định các ấp do cán bộ này trực tiếp quản lý dân cư và giám sát công an viên (ngăn cách bằng dấu phẩy):'
                    : 'Chỉ định ấp mà công an viên này thực hiện tuần tra kiểm soát (ngăn cách bằng dấu phẩy):'}
                </p>
                <input
                  type="text"
                  value={assignedHamletsInput}
                  onChange={e => setAssignedHamletsInput(e.target.value)}
                  placeholder="e.g. Ấp 1, Ấp 2 hoặc Ấp Bắc Lân, Ấp Nam Lân..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-400"
                />
              </div>

              {/* Assignment of Streets and Alleys */}
              <div className="space-y-2 p-4 rounded-xl bg-slate-950 border border-slate-800">
                <label className="block text-xs font-bold text-amber-400 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {selectedOfficer.role === 'sub-admin'
                    ? 'Tuyến Đường Trọng Điểm & Mạng Lưới Hẻm Thuộc Ấp:'
                    : 'Tuyến Đường, Đoạn Phố & Tuyến Hẻm Phụ Trách Tuần Tra Trực Tiếp:'}
                </label>
                <p className="text-[11px] text-slate-400">
                  Giao cụ thể các tuyến đường hoặc hẻm thuộc ấp để thực hiện tuần tra, giám sát an ninh trật tự (ngăn cách bằng dấu phẩy):
                </p>
                <input
                  type="text"
                  value={assignedStreetsInput}
                  onChange={e => setAssignedStreetsInput(e.target.value)}
                  placeholder="e.g. Đường Kinh Dương Vương (số 380-450), Hẻm 418 Kinh Dương Vương, Hẻm 432..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-400"
                />
              </div>

              {/* Toggles for Feature permissions */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-blue-400" />
                    Bảng Phân Quyền Tính Năng Nghiệp Vụ
                  </h3>
                  <span className="text-[11px] text-slate-400">Bật để cấp quyền, Tắt để khóa tính năng</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {permissionItems.map(item => {
                    const isGranted = !!permissions[item.key];
                    const IconComp = item.icon;
                    return (
                      <div
                        key={item.key}
                        onClick={() => handleTogglePermission(item.key)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                          isGranted ? 'bg-blue-950/40 border-blue-700/60' : 'bg-slate-950 border-slate-800 opacity-60'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg mt-0.5 ${isGranted ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                            <IconComp className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">{item.title}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{item.desc}</div>
                          </div>
                        </div>

                        <div className="shrink-0 mt-1">
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center border transition ${
                              isGranted ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-700 bg-slate-900 text-transparent'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
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
                  className="py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition cursor-pointer"
                >
                  Xác Nhận & Cập Nhật Quyền Hạn
                </button>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 text-xs">
              Vui lòng chọn một cán bộ ở danh sách bên trái để phân quyền.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
