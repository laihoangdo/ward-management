import React, { useState } from 'react';
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
  Edit3,
} from 'lucide-react';
import { AppUser, SubAdminFeaturePermissions } from '../types';
import { updateOfficerPermissions, saveUserInFirestore } from '../services/authService';

interface SubAdminDelegationTabProps {
  currentUser: AppUser;
  usersList: AppUser[];
  onShowToast: (msg: string) => void;
}

export const SubAdminDelegationTab: React.FC<SubAdminDelegationTabProps> = ({ currentUser, usersList, onShowToast }) => {
  // Filter officers under this sub-admin's hamlets (or all if admin/superadmin)
  const isSuperOrAdmin = currentUser.role === 'superadmin' || currentUser.role === 'admin';

  const subordinates = usersList.filter(u => {
    if (u.id === currentUser.id) return false;
    if (isSuperOrAdmin) return u.role === 'sub-admin' || u.role === 'officer';
    // Sub-admin manages officers in their assigned hamlets
    return u.role === 'officer' && u.assignedHamlets?.some(h => currentUser.assignedHamlets?.includes(h));
  });

  const [selectedOfficer, setSelectedOfficer] = useState<AppUser | null>(subordinates[0] || null);

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

  const [assignedStreetsInput, setAssignedStreetsInput] = useState<string>(
    selectedOfficer?.assignedStreets?.join(', ') || 'Hẻm 418 Kinh Dương Vương, Hẻm 432',
  );

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

    const updatedOfficer: AppUser = {
      ...selectedOfficer,
      subAdminPermissions: permissions,
      assignedStreets: streets,
    };

    try {
      await saveUserInFirestore(updatedOfficer);
      onShowToast(`Đã lưu phân quyền tính năng & tuyến địa bàn cho ${selectedOfficer.rank} ${selectedOfficer.fullName}.`);
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
      title: 'Xuất Báo cáo Danh sách Dữ liệu (CSV)',
      desc: 'Tải dữ liệu danh sách hộ dân, văn bản hoặc lịch sử kiểm toán phục vụ thanh tra',
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

  return (
    <div id="subadmin-delegation-tab" className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-slate-900 border border-blue-800/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-md bg-blue-900/60 text-blue-300 border border-blue-700/60 text-xs font-mono font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                ỦY QUYỀN TÍNH NĂNG CẤP DƯỚI
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {currentUser.position} • {currentUser.fullName}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Phân Quyền Tính Năng Cho Công An Viên Cấp Dưới</h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Cán bộ quản lý ấp trực tiếp quyết định công an viên phụ trách địa bàn đường xá nào và được quyền sử dụng các tính năng nghiệp
              vụ nào trong ca trực.
            </p>
          </div>

          <button
            type="button"
            id="btn-save-delegation"
            onClick={handleSaveDelegation}
            className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-blue-900/40 flex items-center gap-2 transition cursor-pointer"
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
              Công An Viên Cấp Dưới Thuộc Quản Lý ({subordinates.length})
            </h3>
          </div>

          {subordinates.length === 0 ? (
            <div className="p-6 text-center rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-400">
              Chưa có công an viên nào được gán vào ấp của bạn.
            </div>
          ) : (
            <div className="space-y-2">
              {subordinates.map(off => {
                const isSelected = selectedOfficer?.id === off.id;
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
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{off.position}</div>
                      <div className="text-[11px] text-slate-400 mt-1 font-mono">
                        Số hiệu: <strong className="text-amber-400">{off.badgeNumber}</strong> • {off.assignedWard} (
                        {off.assignedHamlets?.join(', ')})
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
                  <span className="text-[11px] font-mono text-blue-400 font-bold uppercase">ĐANG THIẾT LẬP THẨM QUYỀN CHO:</span>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2 mt-0.5">
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

              {/* Assignment of Streets and Alleys */}
              <div className="space-y-2 p-4 rounded-xl bg-slate-950 border border-slate-800">
                <label className="block text-xs font-bold text-amber-400 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Tuyến Đường, Đoạn Phố & Danh Mục Hẻm Phụ Trách:
                </label>
                <p className="text-[11px] text-slate-400">
                  Giao cụ thể các tuyến đường hoặc hẻm thuộc ấp để công an viên này thực hiện tuần tra, giám sát an ninh trật tự (ngăn cách
                  bằng dấu phẩy):
                </p>
                <input
                  type="text"
                  value={assignedStreetsInput}
                  onChange={e => setAssignedStreetsInput(e.target.value)}
                  placeholder="e.g. Hẻm 418 Kinh Dương Vương, Hẻm 432 Kinh Dương Vương, Đoạn Hồ Học Lãm..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-400"
                />
              </div>

              {/* Toggles for Sub-Admin permissions */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-blue-400" />
                    Bảng Phân Quyền Chức Năng Nghiệp Vụ
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
              Vui lòng chọn một công an viên ở danh sách bên trái để phân quyền.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
