import React, { useState } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Users,
  Settings2,
  MapPin,
  Mail,
  BellRing,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Upload,
  Download,
  Search,
  Filter,
  RefreshCw,
  Eye,
  EyeOff,
  Send,
  Building2,
  Ban,
  Lock,
  Unlock,
  FileCheck,
  AlertOctagon,
  Activity,
  Check,
} from 'lucide-react';
import {
  AppUser,
  AllowedEmailEntry,
  DynamicMenuItemConfig,
  HcmAdminUnit,
  SecurityAlert,
  UserRole,
  NavigationTab,
  BlacklistedIpEntry,
} from '../types';
import {
  updateDynamicMenusInFirestore,
  saveAllowedEmailInFirestore,
  deleteAllowedEmailInFirestore,
  saveUserInFirestore,
  deleteUserInFirestore,
  saveHcmAdminUnitInFirestore,
  deleteHcmAdminUnitInFirestore,
  createSecurityAlert,
  subscribeBlacklistedIps,
  addIpToBlacklist,
  removeIpFromBlacklist,
  resolveSecurityAlert,
} from './services/authService';
import { SecurityAlertsChart } from './SecurityAlertsChart';

interface SuperAdminHubTabProps {
  currentUser: AppUser;
  usersList?: AppUser[];
  allowedEmails?: AllowedEmailEntry[];
  allowedEmailsList?: AllowedEmailEntry[];
  dynamicMenus?: DynamicMenuItemConfig[];
  dynamicMenusList?: DynamicMenuItemConfig[];
  hcmUnits?: HcmAdminUnit[];
  hcmUnitsList?: HcmAdminUnit[];
  securityAlerts?: SecurityAlert[];
  securityAlertsList?: SecurityAlert[];
  onShowToast?: (msg: string) => void;
  onSwitchAccount?: () => void;
}

export const SuperAdminHubTab: React.FC<SuperAdminHubTabProps> = ({
  currentUser,
  usersList = [],
  allowedEmails,
  allowedEmailsList,
  dynamicMenus,
  dynamicMenusList,
  hcmUnits,
  hcmUnitsList,
  securityAlerts,
  securityAlertsList,
  onShowToast = (_msg: string) => {},
  onSwitchAccount,
}) => {
  const effectiveMenusList = dynamicMenusList || dynamicMenus || [];
  const effectiveUnitsList = hcmUnitsList || hcmUnits || [];
  const effectiveEmailsList = allowedEmailsList || allowedEmails || [];
  const effectiveAlertsList = securityAlertsList || securityAlerts || [];
  const effectiveUsersList = usersList || [];

  const [activeSubTab, setActiveSubTab] = useState<'menus' | 'hcm-units' | 'users' | 'whitelist' | 'security'>('menus');

  // Dynamic Menus State
  const [menus, setMenus] = useState<DynamicMenuItemConfig[]>(effectiveMenusList);

  // Synchronize when effectiveMenusList changes from parent/Firestore
  React.useEffect(() => {
    if (effectiveMenusList && effectiveMenusList.length > 0) {
      setMenus(effectiveMenusList);
    }
  }, [effectiveMenusList]);

  // Users State
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserToEdit, setSelectedUserToEdit] = useState<AppUser | null>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState<Partial<AppUser>>({
    username: '',
    fullName: '',
    role: 'officer',
    rank: 'Thượng úy',
    position: 'Công an viên Phụ trách Tuyến',
    unit: 'Công an Phường An Lạc, Quận Bình Tân, TP.HCM',
    badgeNumber: '',
    phone: '',
    assignedWard: 'Phường An Lạc',
    assignedHamlets: ['Ấp 1'],
    assignedStreets: ['Đường Kinh Dương Vương', 'Hẻm 418'],
    status: 'active',
  });

  // Whitelist State
  const [newEmailForm, setNewEmailForm] = useState<{
    email: string;
    fullName: string;
    role: UserRole;
    rank: string;
    position: string;
    assignedWard: string;
    assignedHamlets: string;
    note: string;
  }>({
    email: '',
    fullName: '',
    role: 'officer',
    rank: 'Thượng úy',
    position: 'Công an viên',
    assignedWard: 'Phường An Lạc',
    assignedHamlets: 'Ấp 1',
    note: 'Cán bộ được cấp phép truy cập Google SSO',
  });
  const [isAddEmailOpen, setIsAddEmailOpen] = useState(false);

  // HCM Units State
  const [hcmSearch, setHcmSearch] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('all');
  const [newUnitForm, setNewUnitForm] = useState<{
    district: string;
    ward: string;
    hamlet: string;
    streetsAndAlleys: string;
    officerInChargeName: string;
    totalHouseholds: number;
  }>({
    district: 'Quận Bình Tân',
    ward: 'Phường An Lạc',
    hamlet: 'Ấp 3',
    streetsAndAlleys: 'Đường Trần Đại Nghĩa, Hẻm 12 Trần Đại Nghĩa, Hẻm 45',
    officerInChargeName: 'Đại úy Lê Văn Tám',
    totalHouseholds: 160,
  });
  const [isAddUnitOpen, setIsAddUnitOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);

  // Security Alert State
  const [isSendingTestAlert, setIsSendingTestAlert] = useState(false);
  const [targetAdminEmail, setTargetAdminEmail] = useState('laihoangdo0506@gmail.com');

  // Blacklist IP State
  const [blacklistedIps, setBlacklistedIps] = useState<BlacklistedIpEntry[]>([]);
  const [newIpAddress, setNewIpAddress] = useState('');
  const [newIpReason, setNewIpReason] = useState('');
  const [newIpNotes, setNewIpNotes] = useState('');
  const [isSubmittingIp, setIsSubmittingIp] = useState(false);

  // Security Alert Resolution State
  const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null);
  const [resolveNoteText, setResolveNoteText] = useState('');

  // Subscribe to Blacklist IPs from Firestore
  React.useEffect(() => {
    const unsubscribe = subscribeBlacklistedIps(ips => {
      setBlacklistedIps(ips);
    });
    return () => unsubscribe();
  }, []);

  const handleAddBlacklistIp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIpAddress.trim()) {
      alert('Vui lòng nhập địa chỉ IP cần chặn.');
      return;
    }
    setIsSubmittingIp(true);
    try {
      await addIpToBlacklist(
        newIpAddress.trim(),
        newIpReason.trim() || 'Hành vi truy vấn bất thường / scanner bot',
        currentUser,
        undefined,
        newIpNotes.trim(),
      );
      setNewIpAddress('');
      setNewIpReason('');
      setNewIpNotes('');
      onShowToast(`Đã thêm IP ${newIpAddress.trim()} vào danh sách đen & kích hoạt tường lửa!`);
    } catch (err: any) {
      alert('Lỗi thêm IP: ' + err.message);
    } finally {
      setIsSubmittingIp(false);
    }
  };

  const handleQuickAddBlacklist = async (ip: string, reason: string, alertId: string) => {
    try {
      await addIpToBlacklist(ip, reason, currentUser, alertId, `Chặn khẩn cấp từ cảnh báo an ninh ${alertId}`);
      onShowToast(`Đã chặn khẩn cấp IP ${ip} vào Tường lửa Blacklist!`);
    } catch (err: any) {
      alert('Lỗi chặn IP: ' + err.message);
    }
  };

  const handleRemoveBlacklistIp = async (id: string, ip: string) => {
    try {
      await removeIpFromBlacklist(id, currentUser, ip);
      onShowToast(`Đã gỡ chặn địa chỉ IP ${ip}.`);
    } catch (err: any) {
      window.alert('Lỗi gỡ chặn: ' + err.message);
    }
  };

  const handleResolveAlertSubmit = async (alertItem: SecurityAlert) => {
    setResolvingAlertId(alertItem.id);
    try {
      await resolveSecurityAlert(alertItem.id, currentUser, resolveNoteText.trim() || 'Đã xác minh và xử lý xong');
      onShowToast(`Đã xác nhận xử lý xong cảnh báo ${alertItem.id} và tự động ghi Audit Log!`);
      setResolveNoteText('');
    } catch (err: any) {
      window.alert('Lỗi cập nhật cảnh báo: ' + err.message);
    } finally {
      setResolvingAlertId(null);
    }
  };

  // 1. Handlers for Dynamic Menus
  const toggleMenuRole = async (menuId: NavigationTab, role: UserRole) => {
    const updated = menus.map(m => {
      if (m.id === menuId) {
        const hasRole = m.visibleRoles.includes(role);
        const newRoles = hasRole ? m.visibleRoles.filter(r => r !== role) : [...m.visibleRoles, role];
        return { ...m, visibleRoles: newRoles };
      }
      return m;
    });
    setMenus(updated);
    try {
      await updateDynamicMenusInFirestore(updated);
      onShowToast(`Đã cập nhật hiển thị menu [${menuId}] cho vai trò ${role}.`);
    } catch (e) {
      console.warn('Update dynamic menus error:', e);
    }
  };

  // 2. Handlers for Whitelist Emails
  const handleAddAllowedEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmailForm.email.trim() || !newEmailForm.email.includes('@')) {
      alert('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }

    const hamletsArr = newEmailForm.assignedHamlets
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const entry: AllowedEmailEntry = {
      id: `WHT-${Date.now()}`,
      email: newEmailForm.email.trim().toLowerCase(),
      fullName: newEmailForm.fullName || 'Cán bộ Công an',
      role: newEmailForm.role,
      rank: newEmailForm.rank,
      position: newEmailForm.position,
      assignedWard: newEmailForm.assignedWard,
      assignedHamlets: hamletsArr.length ? hamletsArr : ['Ấp 1'],
      note: newEmailForm.note,
      addedBy: `${currentUser.rank} ${currentUser.fullName} (${currentUser.email || currentUser.username})`,
      addedAt: new Date().toLocaleString('vi-VN'),
      status: 'active',
    };

    try {
      await saveAllowedEmailInFirestore(entry);
      setIsAddEmailOpen(false);
      setNewEmailForm({
        email: '',
        fullName: '',
        role: 'officer',
        rank: 'Thượng úy',
        position: 'Công an viên',
        assignedWard: 'Phường An Lạc',
        assignedHamlets: 'Ấp 1',
        note: '',
      });
      onShowToast(`Đã thêm email ${entry.email} vào Whitelist truy cập Google.`);
    } catch (err: any) {
      alert('Lỗi khi thêm email: ' + err.message);
    }
  };

  const handleDeleteAllowedEmail = async (id: string, email: string) => {
    if (email.toLowerCase() === 'laihoangdo0506@gmail.com') {
      alert('Không thể xóa email Super Admin quản trị tối cao!');
      return;
    }
    if (window.confirm(`Bạn có chắc muốn xóa email [${email}] khỏi danh sách cấp phép?`)) {
      try {
        await deleteAllowedEmailInFirestore(id);
        onShowToast(`Đã xóa email ${email} khỏi Whitelist.`);
      } catch (err: any) {
        alert('Lỗi khi xóa email: ' + err.message);
      }
    }
  };

  // 3. Handlers for Users Management
  const handleSaveNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.username || !newUserForm.fullName) {
      alert('Vui lòng điền tên đăng nhập và họ tên cán bộ.');
      return;
    }

    const newUser: AppUser = {
      id: `USR-${Date.now()}`,
      username: newUserForm.username.trim().toLowerCase(),
      email: newUserForm.email?.trim() || `${newUserForm.username}@bocongan.gov.vn`,
      fullName: newUserForm.fullName.trim(),
      role: newUserForm.role || 'officer',
      rank: newUserForm.rank || 'Thượng úy',
      position: newUserForm.position || 'Công an viên',
      unit: newUserForm.unit || 'Công an Phường An Lạc, Quận Bình Tân, TP.HCM',
      badgeNumber: newUserForm.badgeNumber || '284-000',
      phone: newUserForm.phone || '0908.000.113',
      assignedWard: newUserForm.assignedWard || 'Phường An Lạc',
      assignedHamlets: newUserForm.assignedHamlets || ['Ấp 1'],
      assignedStreets: newUserForm.assignedStreets || ['Đường Kinh Dương Vương'],
      subAdminPermissions:
        newUserForm.role === 'officer'
          ? {
              canEditCoordinates: true,
              canAddHouseholds: true,
              canScanOcr: true,
              canRenewDocs: false,
              canExportReports: false,
              canSendReminders: true,
              canUpdateInspection: true,
              canManageStreets: false,
            }
          : undefined,
      status: 'active',
      createdAt: new Date().toLocaleDateString('vi-VN'),
      isOnline: false,
    };

    try {
      await saveUserInFirestore(newUser);
      setIsAddUserOpen(false);
      onShowToast(`Đã tạo mới tài khoản cán bộ [${newUser.fullName} - ${newUser.username}].`);
    } catch (err: any) {
      alert('Lỗi tạo tài khoản: ' + err.message);
    }
  };

  const handleToggleUserStatus = async (user: AppUser) => {
    if (user.role === 'superadmin') {
      alert('Không thể khóa tài khoản Super Admin!');
      return;
    }
    const newStatus = user.status === 'active' ? 'locked' : 'active';
    const updated = { ...user, status: newStatus as 'active' | 'locked' };
    try {
      await saveUserInFirestore(updated);
      onShowToast(`Đã chuyển trạng thái tài khoản ${user.username} sang [${newStatus}].`);
    } catch (err: any) {
      alert('Lỗi cập nhật: ' + err.message);
    }
  };

  // 4. Handlers for HCM Admin Units & Alleys
  const handleSaveNewHcmUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    const streetsArr = newUnitForm.streetsAndAlleys
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const newUnit: HcmAdminUnit = {
      id: `HCM-${Date.now()}`,
      district: newUnitForm.district,
      ward: newUnitForm.ward,
      hamlet: newUnitForm.hamlet,
      streetsAndAlleys: streetsArr,
      officerInChargeName: newUnitForm.officerInChargeName,
      totalHouseholds: Number(newUnitForm.totalHouseholds) || 100,
      updatedAt: new Date().toLocaleDateString('vi-VN'),
    };

    try {
      await saveHcmAdminUnitInFirestore(newUnit);
      setIsAddUnitOpen(false);
      onShowToast(
        `Đã lưu đơn vị hành chính [${newUnit.hamlet} - ${newUnit.ward} - ${newUnit.district}] kèm ${streetsArr.length} đường hẻm.`,
      );
    } catch (err: any) {
      alert('Lỗi lưu đơn vị: ' + err.message);
    }
  };

  const handleImportJsonUnits = async () => {
    try {
      const parsed = JSON.parse(importJsonText);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of list) {
        const u: HcmAdminUnit = {
          id: item.id || `HCM-IMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          district: item.district || 'Quận Bình Tân',
          ward: item.ward || 'Phường An Lạc',
          hamlet: item.hamlet || 'Ấp Mới',
          streetsAndAlleys: Array.isArray(item.streetsAndAlleys) ? item.streetsAndAlleys : ['Đường chính'],
          officerInChargeName: item.officerInChargeName || 'Chưa phân công',
          totalHouseholds: item.totalHouseholds || 120,
          updatedAt: new Date().toLocaleDateString('vi-VN'),
        };
        await saveHcmAdminUnitInFirestore(u);
      }
      setShowImportModal(false);
      setImportJsonText('');
      onShowToast(`Đã import thành công ${list.length} đơn vị hành chính & tuyến hẻm mới vào hệ thống TP.HCM.`);
    } catch (e: any) {
      alert('Định dạng JSON không hợp lệ: ' + e.message);
    }
  };

  // 5. Handlers for Security Alerts & Email Dispatch
  const handleTriggerTestSecurityAlert = async () => {
    setIsSendingTestAlert(true);
    try {
      const alert = await createSecurityAlert({
        severity: 'critical',
        title: 'CẢNH BÁO KIỂM THỬ: Phát hiện truy vấn bất thường vào cơ sở dữ liệu',
        details: `Cảnh báo kiểm thử bảo mật định kỳ do Super Admin phát động. Địa chỉ IP 113.161.72.19 phát hiện thực hiện 5 lần cập nhật trường đặc biệt không hợp lệ trên bảng "appUsers".`,
        sourceIp: '113.161.72.19',
        attemptedEmailOrUser: 'suspicious_scanner_bot',
        targetResource: '/api/firestore/admin-privileges',
        adminEmailTarget: targetAdminEmail,
      });

      onShowToast(`Đã kích hoạt cảnh báo an ninh & gửi thông báo đẩy tới email Admin: ${targetAdminEmail}!`);
    } catch (e: any) {
      alert('Lỗi phát tín hiệu cảnh báo: ' + e.message);
    } finally {
      setIsSendingTestAlert(false);
    }
  };

  return (
    <div id="superadmin-hub-tab" className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-red-950 via-slate-900 to-slate-900 border border-red-800/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-full bg-red-600/5 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-md bg-red-900/60 text-red-300 border border-red-700/60 text-xs font-mono font-bold flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                SUPER ADMIN EXCLUSIVE
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {currentUser.rank} {currentUser.fullName} • Số hiệu: {currentUser.badgeNumber}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Trung Tâm Quản Trị Hệ Thống Tối Cao</h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Toàn quyền cấu hình menu động theo vai trò, quản lý mạng lưới đơn vị hành chính và tuyến hẻm mới nhất TP.HCM, phân quyền tài
              khoản và giám sát an ninh dữ liệu.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              id="btn-test-security-alert"
              onClick={handleTriggerTestSecurityAlert}
              disabled={isSendingTestAlert}
              className="py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-lg shadow-red-900/40 flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              <BellRing className="w-4 h-4 text-amber-300" />
              {isSendingTestAlert ? 'Đang gửi cảnh báo...' : 'Kiểm Thử Đẩy Email Cảnh Báo'}
            </button>
          </div>
        </div>

        {/* Sub Navigation Bar */}
        <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => setActiveSubTab('menus')}
            className={`py-2 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
              activeSubTab === 'menus'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            Cài Đặt Menu Động
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('hcm-units')}
            className={`py-2 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
              activeSubTab === 'hcm-units'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            Đơn Vị HC & Đường Hẻm TP.HCM ({effectiveUnitsList.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('users')}
            className={`py-2 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
              activeSubTab === 'users'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Quản Lý Tài Khoản CAND ({effectiveUsersList.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('whitelist')}
            className={`py-2 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
              activeSubTab === 'whitelist'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            Whitelist Email Google ({effectiveEmailsList.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('security')}
            className={`py-2 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
              activeSubTab === 'security'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Cảnh Báo & Thống Kê An Ninh ({effectiveAlertsList.length})
            {effectiveAlertsList.filter(a => !a.resolved).length > 0 && <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />}
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: DYNAMIC MENUS CONFIGURATION */}
      {activeSubTab === 'menus' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-amber-400" />
                Cấu Hình Hiển Thị Menu Động Cho Từng Loại Tài Khoản
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Tích chọn các vai trò được phép nhìn thấy từng menu trên Sidebar và ứng dụng di động. Lưu ngay vào Firestore.
              </p>
            </div>
            <span className="text-xs font-mono px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-emerald-400">
              Đồng bộ Realtime Firestore
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 bg-slate-950/40">
                  <th className="py-3 px-4">Menu & Tính Năng</th>
                  <th className="py-3 px-4 text-center">Super Admin</th>
                  <th className="py-3 px-4 text-center">Admin (Trưởng CAX)</th>
                  <th className="py-3 px-4 text-center">Sub-admin (CA Phụ trách Ấp)</th>
                  <th className="py-3 px-4 text-center">Công an viên</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs">
                {menus.map(item => (
                  <tr key={item.id} className="hover:bg-slate-850/50 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-200">{item.label}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{item.description}</div>
                      <span className="inline-block mt-1 font-mono text-[10px] text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                        tabId: {item.id}
                      </span>
                    </td>

                    {/* Role: superadmin */}
                    <td className="py-3.5 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={item.visibleRoles.includes('superadmin')}
                        onChange={() => toggleMenuRole(item.id, 'superadmin')}
                        className="w-4 h-4 rounded text-red-600 bg-slate-950 border-slate-700 cursor-pointer"
                      />
                    </td>

                    {/* Role: admin */}
                    <td className="py-3.5 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={item.visibleRoles.includes('admin')}
                        onChange={() => toggleMenuRole(item.id, 'admin')}
                        className="w-4 h-4 rounded text-amber-600 bg-slate-950 border-slate-700 cursor-pointer"
                      />
                    </td>

                    {/* Role: sub-admin */}
                    <td className="py-3.5 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={item.visibleRoles.includes('sub-admin')}
                        onChange={() => toggleMenuRole(item.id, 'sub-admin')}
                        className="w-4 h-4 rounded text-blue-600 bg-slate-950 border-slate-700 cursor-pointer"
                      />
                    </td>

                    {/* Role: officer */}
                    <td className="py-3.5 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={item.visibleRoles.includes('officer')}
                        onChange={() => toggleMenuRole(item.id, 'officer')}
                        className="w-4 h-4 rounded text-emerald-600 bg-slate-950 border-slate-700 cursor-pointer"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: HCM ADMINISTRATIVE UNITS & ALLEYS */}
      {activeSubTab === 'hcm-units' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-red-400" />
                Quản Lý Đơn Vị Hành Chính & Mạng Lưới Đường Hẻm TP. Hồ Chí Minh
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Import, cập nhật danh mục phường, xã, ấp/khu phố và các tuyến đường, hẻm dân cư mới nhất ở TP.HCM.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold flex items-center gap-2 transition"
              >
                <Upload className="w-3.5 h-3.5 text-blue-400" />
                Import Dữ Liệu JSON
              </button>
              <button
                type="button"
                onClick={() => setIsAddUnitOpen(true)}
                className="py-2 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center gap-2 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm Đơn Vị & Tuyến Hẻm Mới
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={hcmSearch}
                onChange={e => setHcmSearch(e.target.value)}
                placeholder="Tìm kiếm theo tên quận, phường, ấp hoặc tên đường, hẻm (e.g. 418, Kinh Dương Vương)..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <select
              value={selectedDistrict}
              onChange={e => setSelectedDistrict(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-red-500"
            >
              <option value="all">Tất cả Quận / Huyện TP.HCM</option>
              <option value="Quận Bình Tân">Quận Bình Tân</option>
              <option value="Huyện Bình Chánh">Huyện Bình Chánh</option>
              <option value="Thành phố Thủ Đức">Thành phố Thủ Đức</option>
            </select>
          </div>

          {/* List of Units */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {effectiveUnitsList
              .filter(u => {
                const matchDist = selectedDistrict === 'all' || u.district === selectedDistrict;
                const matchSearch =
                  !hcmSearch ||
                  u.district.toLowerCase().includes(hcmSearch.toLowerCase()) ||
                  u.ward.toLowerCase().includes(hcmSearch.toLowerCase()) ||
                  u.hamlet.toLowerCase().includes(hcmSearch.toLowerCase()) ||
                  u.streetsAndAlleys.some(s => s.toLowerCase().includes(hcmSearch.toLowerCase()));
                return matchDist && matchSearch;
              })
              .map(unit => (
                <div
                  key={unit.id}
                  className="bg-slate-950/70 border border-slate-800 rounded-xl p-4.5 hover:border-slate-750 transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <span className="px-2 py-0.5 rounded bg-blue-900/40 text-blue-300 border border-blue-800/40 text-[10px] font-mono font-bold uppercase">
                          {unit.district}
                        </span>
                        <h3 className="text-sm font-bold text-white mt-1">
                          {unit.hamlet} — {unit.ward}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteHcmAdminUnitInFirestore(unit.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-900 transition"
                        title="Xóa đơn vị"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-xs text-slate-300 space-y-1 mb-3">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>
                          Cán bộ phụ trách: <strong className="text-slate-200">{unit.officerInChargeName || 'Chưa phân công'}</strong>
                        </span>
                        <span>
                          Quy mô: <strong className="text-slate-200">{unit.totalHouseholds}</strong> hộ
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] font-semibold text-amber-400 block mb-1">
                        Danh mục đường & hẻm mới nhất ({unit.streetsAndAlleys.length} tuyến):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {unit.streetsAndAlleys.map((st, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                            {st}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-2 border-t border-slate-850 text-[10px] text-slate-500 flex justify-between">
                    <span>Mã dữ liệu: {unit.id}</span>
                    <span>Cập nhật: {unit.updatedAt}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: USERS & RBAC MANAGEMENT */}
      {activeSubTab === 'users' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                Quản Lý Tất Cả Tài Khoản Cán Bộ & Chiến Sĩ CAND
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Phân quyền chức vụ rõ ràng (Super Admin, Admin Trưởng CAX, Sub-admin CA Ấp, Công an viên).
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsAddUserOpen(true)}
              className="py-2 px-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center gap-2 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Tạo Mới Tài Khoản Cán Bộ
            </button>
          </div>

          {/* User Filter */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              placeholder="Tìm kiếm theo họ tên cán bộ, số hiệu CAND, tên đăng nhập hoặc chức vụ..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 bg-slate-950/40">
                  <th className="py-3 px-4">Cán Bộ & Số Hiệu</th>
                  <th className="py-3 px-4">Vai Trò RBAC</th>
                  <th className="py-3 px-4">Chức Vụ & Đơn Vị</th>
                  <th className="py-3 px-4">Địa Bàn Phụ Trách</th>
                  <th className="py-3 px-4 text-center">Trạng Thái</th>
                  <th className="py-3 px-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs">
                {effectiveUsersList
                  .filter(u => {
                    if (!userSearch) return true;
                    const q = userSearch.toLowerCase();
                    return (
                      u.fullName.toLowerCase().includes(q) ||
                      u.username.toLowerCase().includes(q) ||
                      u.badgeNumber.toLowerCase().includes(q) ||
                      u.position.toLowerCase().includes(q)
                    );
                  })
                  .map(u => (
                    <tr key={u.id} className="hover:bg-slate-850/50 transition">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          {u.rank} {u.fullName}
                          {u.isOnline && <span className="w-2 h-2 rounded-full bg-emerald-400" title="Đang trực tuyến" />}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          Số hiệu: <strong className="text-amber-400">{u.badgeNumber}</strong> | User: {u.username}
                        </div>
                        {u.email && <div className="text-[10px] text-slate-500">{u.email}</div>}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
                            u.role === 'superadmin'
                              ? 'bg-red-950 text-red-300 border-red-700/60'
                              : u.role === 'admin'
                                ? 'bg-amber-950 text-amber-300 border-amber-700/60'
                                : u.role === 'sub-admin'
                                  ? 'bg-blue-950 text-blue-300 border-blue-700/60'
                                  : 'bg-emerald-950 text-emerald-300 border-emerald-700/60'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="text-slate-200 font-medium">{u.position}</div>
                        <div className="text-[11px] text-slate-400">{u.unit}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="text-slate-300">{u.assignedWard}</div>
                        <div className="text-[11px] text-slate-400">{u.assignedHamlets?.join(', ') || 'Chưa phân công'}</div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            u.status === 'active'
                              ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-800/50'
                              : 'bg-red-900/40 text-red-300 border border-red-800/50'
                          }`}
                        >
                          {u.status === 'active' ? 'Hoạt động' : 'Tạm khóa'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right space-x-2">
                        {u.role !== 'superadmin' && (
                          <button
                            type="button"
                            onClick={() => handleToggleUserStatus(u)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition"
                            title={u.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                          >
                            {u.status === 'active' ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        {u.role !== 'superadmin' && (
                          <button
                            type="button"
                            onClick={() => deleteUserInFirestore(u.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
                            title="Xóa tài khoản"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: ALLOWED EMAILS WHITELIST */}
      {activeSubTab === 'whitelist' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Mail className="w-5 h-5 text-amber-400" />
                Danh Sách Email Được Cấp Phép Truy Cập (Whitelist)
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Chỉ các hộp thư Gmail trong danh sách này mới có thể đăng nhập vào ứng dụng qua cổng Google SSO. Do Super Admin độc quyền
                quản lý.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsAddEmailOpen(true)}
              className="py-2 px-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-2 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Thêm Email Vào Whitelist
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {effectiveEmailsList.map(item => (
              <div
                key={item.id}
                className={`p-4 rounded-xl border transition flex flex-col justify-between ${
                  item.email === 'laihoangdo0506@gmail.com' ? 'bg-red-950/20 border-red-700/50' : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="truncate">
                      <span className="font-mono text-sm font-bold text-blue-400 truncate block">{item.email}</span>
                      <span className="text-xs font-semibold text-slate-200 block">
                        {item.fullName} ({item.position})
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-amber-900/40 text-amber-300 border border-amber-700/40">
                        {item.role}
                      </span>
                      {item.email !== 'laihoangdo0506@gmail.com' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteAllowedEmail(item.id, item.email)}
                          className="text-slate-500 hover:text-red-400 transition"
                          title="Xóa khỏi Whitelist"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 space-y-1">
                    <div>
                      Địa bàn: <strong className="text-slate-300">{item.assignedWard}</strong> ({item.assignedHamlets?.join(', ')})
                    </div>
                    {item.note && <div className="italic text-slate-500">{item.note}</div>}
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-850 text-[10px] text-slate-500 flex justify-between">
                  <span>Thêm bởi: {item.addedBy}</span>
                  <span>{item.addedAt}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 5: SECURITY ALERTS & IP BLACKLIST MANAGEMENT */}
      {activeSubTab === 'security' && (
        <div className="space-y-6">
          {/* SECTION 0: RECHARTS SECURITY ALERTS ANALYTICS */}
          <SecurityAlertsChart alerts={effectiveAlertsList} blacklistedCount={blacklistedIps.length} />

          {/* SECTION 1: SECURITY ALERTS */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-400" />
                  Giám Sát An Ninh & Cảnh Báo Cơ Sở Dữ Liệu
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Tự động phát hiện các thao tác lạ với database, cập nhật trường trái phép và gửi thông báo khẩn cấp tới email Quản trị.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Email nhận cảnh báo:</span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono font-bold text-amber-400">
                  {targetAdminEmail}
                </span>
              </div>
            </div>

            <div className="space-y-3.5">
              {effectiveAlertsList.map(alert => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-all ${
                    alert.resolved
                      ? 'bg-slate-950/70 border-slate-800 opacity-90'
                      : alert.severity === 'critical'
                        ? 'bg-red-950/40 border-red-800/70'
                        : alert.severity === 'high'
                          ? 'bg-amber-950/40 border-amber-800/70'
                          : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                            alert.severity === 'critical'
                              ? 'bg-red-900 text-red-200'
                              : alert.severity === 'high'
                                ? 'bg-amber-900 text-amber-200'
                                : 'bg-blue-900 text-blue-200'
                          }`}
                        >
                          {alert.severity}
                        </span>
                        <h4 className="text-sm font-bold text-white">{alert.title}</h4>

                        {/* Resolved Status Badge */}
                        {alert.resolved ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-700/60 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            Đã xác minh & Xử lý xong
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-950/90 text-rose-300 border border-rose-700/60 flex items-center gap-1 animate-pulse">
                            <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                            Cần xác minh & xử lý
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">{alert.details}</p>

                      <div className="text-[11px] text-slate-400 flex flex-wrap gap-3 pt-1">
                        <span>
                          Thời gian: <strong className="text-slate-200">{alert.timestamp}</strong>
                        </span>
                        <span>
                          IP nguồn: <strong className="text-rose-400 font-mono font-bold">{alert.sourceIp}</strong>
                        </span>
                        <span>
                          Đối tượng: <strong className="text-slate-200">{alert.attemptedEmailOrUser || 'Không rõ'}</strong>
                        </span>
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Đã đẩy tới {alert.adminEmailTarget}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-400">
                        {alert.id}
                      </span>
                    </div>
                  </div>

                  {/* Resolution History / Information */}
                  {alert.resolved && (
                    <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-1">
                      <div className="flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <span>
                            Biên bản xử lý hoàn tất lúc: <strong>{alert.resolvedAt}</strong>
                          </span>
                          {alert.resolvedBy && <span className="text-slate-400 block sm:inline sm:ml-2">Bởi: {alert.resolvedBy}</span>}
                          {alert.resolvedNotes && (
                            <div className="text-[11px] text-emerald-400/80 italic mt-0.5">Ghi chú: "{alert.resolvedNotes}"</div>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-900/50 text-emerald-200 border border-emerald-700/50 shrink-0">
                        Audit Log: Đã Lưu
                      </span>
                    </div>
                  )}

                  {/* Unresolved Alert Actions */}
                  {!alert.resolved && (
                    <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 mt-1">
                      <div className="flex items-center gap-2">
                        {alert.sourceIp && (
                          <button
                            type="button"
                            onClick={() => handleQuickAddBlacklist(alert.sourceIp, `Chặn từ cảnh báo ${alert.id}`, alert.id)}
                            className="py-1.5 px-3 rounded-lg bg-rose-950/60 hover:bg-rose-900/70 text-rose-300 border border-rose-800/60 text-xs font-semibold flex items-center gap-1.5 transition"
                          >
                            <Ban className="w-3.5 h-3.5 text-rose-400" />
                            Chặn IP {alert.sourceIp} vào Blacklist
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={resolvingAlertId === alert.id}
                          onClick={() => handleResolveAlertSubmit(alert)}
                          className="py-1.5 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow transition"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {resolvingAlertId === alert.id ? 'Đang xác nhận...' : 'Đã xác minh & Xử lý xong'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 2: IP BLACKLIST MANAGEMENT (TƯỜNG LỬA CHẶN TRUY CẬP) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Ban className="w-5 h-5 text-rose-400" />
                  Quản Lý Danh Sách Đen IP (IP Blacklist & Tường Lửa Realtime)
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Chặn ngay lập tức quyền truy cập vào Webapp, API và Cơ sở dữ liệu Firestore đối với các IP có hành vi tấn công, quét cổng
                  hoặc cập nhật bất thường.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-slate-400">Trạng thái Tường lửa:</span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-700/60 text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Đang Bật Bảo Vệ (Active)
                </span>
              </div>
            </div>

            {/* Quick alert banner if IP 113.161.72.19 is not blocked */}
            {!blacklistedIps.some(b => b.ip === '113.161.72.19') && (
              <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 text-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Phát hiện IP khả nghi gần nhất: <strong className="font-mono text-amber-300">113.161.72.19</strong> (Thực hiện 5 lần cập
                    nhật trường đặc biệt không hợp lệ trên bảng appUsers - Cảnh báo SEC-1789791931353).
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleQuickAddBlacklist(
                      '113.161.72.19',
                      'Cập nhật trường đặc biệt không hợp lệ trên bảng appUsers',
                      'SEC-1789791931353',
                    )
                  }
                  className="py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shrink-0 flex items-center gap-1.5 transition"
                >
                  <Ban className="w-3.5 h-3.5" />
                  Chặn Ngay IP 113.161.72.19
                </button>
              </div>
            )}

            {/* Form Add Suspicious IP */}
            <form onSubmit={handleAddBlacklistIp} className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-rose-400" />
                Thêm Địa Chỉ IP Nghi Vấn Vào Danh Sách Đen
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Địa chỉ IPv4 / IPv6 (*)</label>
                  <input
                    type="text"
                    required
                    value={newIpAddress}
                    onChange={e => setNewIpAddress(e.target.value)}
                    placeholder="e.g. 113.161.72.19 hoặc 14.161.x.x"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono placeholder:font-sans placeholder:text-slate-600 focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Lý do ngăn chặn (*)</label>
                  <input
                    type="text"
                    required
                    value={newIpReason}
                    onChange={e => setNewIpReason(e.target.value)}
                    placeholder="e.g. Quét lỗ hổng, truy vấn bất thường"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white placeholder:text-slate-600 focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Ghi chú bổ sung (tùy chọn)</label>
                  <input
                    type="text"
                    value={newIpNotes}
                    onChange={e => setNewIpNotes(e.target.value)}
                    placeholder="e.g. Bot scanner kiểm thử"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white placeholder:text-slate-600 focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingIp}
                  className="py-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-2 shadow-md transition"
                >
                  <Ban className="w-3.5 h-3.5" />
                  {isSubmittingIp ? 'Đang lưu vào Firestore & Tường lửa...' : 'Thêm Vào Blacklist & Kích Hoạt Tường Lửa'}
                </button>
              </div>
            </form>

            {/* List of Blacklisted IPs */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Danh sách IP đang bị chặn ({blacklistedIps.length})
                </h3>
                <span className="text-[11px] text-slate-500">Tự động đồng bộ với Middleware Tường lửa & Firestore Security</span>
              </div>

              {blacklistedIps.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs bg-slate-950 rounded-xl border border-slate-800">
                  Chưa có IP nào trong danh sách đen. Tường lửa đang ở chế độ giám sát tự động.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {blacklistedIps.map(entry => (
                    <div
                      key={entry.id}
                      className="p-4 rounded-xl bg-slate-950 border border-rose-900/50 hover:border-rose-700/60 transition space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 rounded-lg bg-rose-950 text-rose-400 border border-rose-800/60">
                            <Ban className="w-4 h-4" />
                          </span>
                          <div>
                            <div className="font-mono text-sm font-bold text-rose-300">{entry.ip}</div>
                            <span className="text-[10px] font-bold text-rose-400 bg-rose-950/60 px-1.5 py-0.2 rounded border border-rose-800/40">
                              CHẶN TRUY CẬP API & WEB
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveBlacklistIp(entry.id, entry.ip)}
                          className="py-1 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 transition"
                          title="Gỡ chặn IP"
                        >
                          <Unlock className="w-3 h-3 text-amber-400" />
                          Gỡ Chặn
                        </button>
                      </div>

                      <div className="text-xs text-slate-300">
                        <strong>Lý do:</strong> {entry.reason}
                      </div>

                      {entry.relatedAlertId && (
                        <div className="text-[11px] text-slate-400 font-mono">
                          Mã cảnh báo: <span className="text-amber-400">{entry.relatedAlertId}</span>
                        </div>
                      )}

                      {entry.notes && <div className="text-[11px] text-slate-500 italic">"{entry.notes}"</div>}

                      <div className="pt-2 border-t border-slate-850 flex items-center justify-between text-[10px] text-slate-500">
                        <span>
                          Chặn bởi: <strong className="text-slate-400">{entry.addedBy}</strong>
                        </span>
                        <span>{entry.createdAt}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD NEW USER */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-750 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                Tạo Mới Tài Khoản Cán Bộ & Phân Quyền
              </h3>
              <button type="button" onClick={() => setIsAddUserOpen(false)} className="text-slate-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewUser} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Tên đăng nhập (username)*</label>
                  <input
                    type="text"
                    required
                    value={newUserForm.username}
                    onChange={e => setNewUserForm({ ...newUserForm, username: e.target.value })}
                    placeholder="e.g. cav_nguyenvana"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Số hiệu CAND*</label>
                  <input
                    type="text"
                    required
                    value={newUserForm.badgeNumber}
                    onChange={e => setNewUserForm({ ...newUserForm, badgeNumber: e.target.value })}
                    placeholder="e.g. 284-789"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Họ và tên cán bộ*</label>
                <input
                  type="text"
                  required
                  value={newUserForm.fullName}
                  onChange={e => setNewUserForm({ ...newUserForm, fullName: e.target.value })}
                  placeholder="e.g. Thượng úy Nguyễn Văn A"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Cấp bậc</label>
                  <select
                    value={newUserForm.rank}
                    onChange={e => setNewUserForm({ ...newUserForm, rank: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="Đại tá">Đại tá</option>
                    <option value="Thượng tá">Thượng tá</option>
                    <option value="Trung tá">Trung tá</option>
                    <option value="Thiếu tá">Thiếu tá</option>
                    <option value="Đại úy">Đại úy</option>
                    <option value="Thượng úy">Thượng úy</option>
                    <option value="Trung úy">Trung úy</option>
                    <option value="Thiếu úy">Thiếu úy</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Vai trò phân quyền RBAC</label>
                  <select
                    value={newUserForm.role}
                    onChange={e => setNewUserForm({ ...newUserForm, role: e.target.value as UserRole })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="superadmin">Super Admin (Tối cao)</option>
                    <option value="admin">Admin (Trưởng Công an Xã)</option>
                    <option value="sub-admin">Sub-admin (Công an Quản lý Ấp)</option>
                    <option value="officer">Công an viên (Quản lý Tuyến/Hẻm)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Chức vụ cụ thể</label>
                <input
                  type="text"
                  value={newUserForm.position}
                  onChange={e => setNewUserForm({ ...newUserForm, position: e.target.value })}
                  placeholder="e.g. Cán bộ CSKV Phụ trách Ấp 2"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Phường / Xã phụ trách</label>
                  <input
                    type="text"
                    value={newUserForm.assignedWard}
                    onChange={e => setNewUserForm({ ...newUserForm, assignedWard: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Số điện thoại liên hệ</label>
                  <input
                    type="text"
                    value={newUserForm.phone}
                    onChange={e => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                    placeholder="0908.xxx.xxx"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Hủy Bỏ
                </button>
                <button type="submit" className="py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold">
                  Tạo Tài Khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD WHITELIST EMAIL */}
      {isAddEmailOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-750 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-400" />
                Thêm Email Gmail Vào Whitelist
              </h3>
              <button type="button" onClick={() => setIsAddEmailOpen(false)} className="text-slate-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAllowedEmail} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Địa chỉ Gmail (*)</label>
                <input
                  type="email"
                  required
                  value={newEmailForm.email}
                  onChange={e => setNewEmailForm({ ...newEmailForm, email: e.target.value })}
                  placeholder="e.g. canbo.anlac@gmail.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Họ tên cán bộ sở hữu</label>
                <input
                  type="text"
                  required
                  value={newEmailForm.fullName}
                  onChange={e => setNewEmailForm({ ...newEmailForm, fullName: e.target.value })}
                  placeholder="e.g. Đại úy Trần Văn Nam"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Vai trò cấp quyền</label>
                  <select
                    value={newEmailForm.role}
                    onChange={e => setNewEmailForm({ ...newEmailForm, role: e.target.value as UserRole })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="superadmin">Super Admin</option>
                    <option value="admin">Admin (Trưởng CAX)</option>
                    <option value="sub-admin">Sub-admin (Công an Quản lý Ấp)</option>
                    <option value="officer">Công an viên</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Cấp bậc</label>
                  <input
                    type="text"
                    value={newEmailForm.rank}
                    onChange={e => setNewEmailForm({ ...newEmailForm, rank: e.target.value })}
                    placeholder="Đại úy"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Chức vụ cụ thể</label>
                <input
                  type="text"
                  value={newEmailForm.position}
                  onChange={e => setNewEmailForm({ ...newEmailForm, position: e.target.value })}
                  placeholder="CSKV Phụ trách Ấp"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Ghi chú kiểm soát</label>
                <textarea
                  rows={2}
                  value={newEmailForm.note}
                  onChange={e => setNewEmailForm({ ...newEmailForm, note: e.target.value })}
                  placeholder="Ghi chú phê duyệt..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddEmailOpen(false)}
                  className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Hủy Bỏ
                </button>
                <button type="submit" className="py-2 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold">
                  Thêm Whitelist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD HCM ADMIN UNIT & ALLEYS */}
      {isAddUnitOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-750 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-red-400" />
                Thêm Đơn Vị Hành Chính & Tuyến Hẻm Mới Ở TP.HCM
              </h3>
              <button type="button" onClick={() => setIsAddUnitOpen(false)} className="text-slate-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewHcmUnit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Quận / Huyện / TP thuộc TP.HCM*</label>
                  <input
                    type="text"
                    required
                    value={newUnitForm.district}
                    onChange={e => setNewUnitForm({ ...newUnitForm, district: e.target.value })}
                    placeholder="Quận Bình Tân"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Phường / Xã / Thị trấn*</label>
                  <input
                    type="text"
                    required
                    value={newUnitForm.ward}
                    onChange={e => setNewUnitForm({ ...newUnitForm, ward: e.target.value })}
                    placeholder="Phường An Lạc"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Ấp / Khu phố / Thôn*</label>
                  <input
                    type="text"
                    required
                    value={newUnitForm.hamlet}
                    onChange={e => setNewUnitForm({ ...newUnitForm, hamlet: e.target.value })}
                    placeholder="Ấp 3"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Số lượng hộ dân ước tính</label>
                  <input
                    type="number"
                    value={newUnitForm.totalHouseholds}
                    onChange={e => setNewUnitForm({ ...newUnitForm, totalHouseholds: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Cán bộ phụ trách dự kiến</label>
                <input
                  type="text"
                  value={newUnitForm.officerInChargeName}
                  onChange={e => setNewUnitForm({ ...newUnitForm, officerInChargeName: e.target.value })}
                  placeholder="Đại úy Lê Văn Tám"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Danh sách đường & hẻm mới nhất (ngăn cách bằng dấu phẩy)*</label>
                <textarea
                  rows={3}
                  required
                  value={newUnitForm.streetsAndAlleys}
                  onChange={e => setNewUnitForm({ ...newUnitForm, streetsAndAlleys: e.target.value })}
                  placeholder="Đường Kinh Dương Vương, Hẻm 418 Kinh Dương Vương, Hẻm 432, Đường Hồ Học Lãm..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddUnitOpen(false)}
                  className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Hủy Bỏ
                </button>
                <button type="submit" className="py-2 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold">
                  Lưu Đơn Vị Hành Chính
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: IMPORT JSON DATA */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-750 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-400" />
                Import Dữ Liệu Đơn Vị Hành Chính & Tuyến Hẻm Mới TP.HCM
              </h3>
              <button type="button" onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">Dán dữ liệu JSON theo cấu trúc đơn vị hành chính TP.HCM để cập nhật hàng loạt:</p>

            <textarea
              rows={8}
              value={importJsonText}
              onChange={e => setImportJsonText(e.target.value)}
              placeholder={`[
  {
    "district": "Quận Bình Tân",
    "ward": "Phường An Lạc",
    "hamlet": "Khu phố 6",
    "streetsAndAlleys": ["Đường Lê Cơ", "Hẻm 45 Lê Cơ", "Hẻm 68"],
    "totalHouseholds": 190
  }
]`}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-mono text-white"
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleImportJsonUnits}
                className="py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs"
              >
                Bắt Đầu Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
