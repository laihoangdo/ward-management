import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getSession } from 'app/shared/reducers/authentication';
import { mapAccountToGisUser, logoutBackendSession } from './services/backendSession';
import './index.css';
import { RenewDocumentDialog } from './components/RenewDocumentDialog';
import { matchesHouseholdSearch } from './utils/householdSearch';
import { loadOperationalData, OPERATIONAL_DATA_LABELS } from './utils/operationalData';
import { LayoutDashboard, Map, Users, UserCheck, FileText, Menu, AlertTriangle, Database, CloudCheck, MapPin } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewTab } from './components/OverviewTab';
import { AreaMapTab } from './components/AreaMapTab';
import { BaDiem3DMapEditor } from './components/BaDiem3DMapEditor';
const FieldHouseMap = React.lazy(() => import('./components/FieldHouseMap'));
const MapLibreAreaMap = React.lazy(() => import('./components/MapLibreAreaMap'));
import { HouseholdsTab } from './components/HouseholdsTab';
import { ResidentsTab } from './components/ResidentsTab';
import { DocumentsTab } from './components/DocumentsTab';
import { AreasTab } from './components/AreasTab';
import { LogsTab } from './components/LogsTab';
import { SettingsTab } from './components/SettingsTab';
import { HouseholdDetailModal } from './components/HouseholdDetailModal';
import { AddHouseholdModal } from './components/AddHouseholdModal';
import { WarningDetailModal } from './components/WarningDetailModal';
import { normalizeHousehold, normalizeHouseholdList } from './utils/householdUtils';
import { canViewMapTab } from './utils/mapViewAccess';
import {
  createHouseholdInBackend,
  updateHouseholdInBackend,
  updateHouseholdNotesInBackend,
  updateHouseholdCoordinatesInBackend,
  deleteHouseholdInBackend,
  fetchAllDocumentRecords,
  renewDocumentInBackend,
  savePatrolLogInBackend,
  fetchPatrolLogsFromBackend,
} from './services/householdApiService';

import {
  NavigationTab,
  HouseholdFacility,
  HouseholdCreateInput,
  DocumentRecord,
  OfficerProfile,
  DEFAULT_OFFICER,
  AuditLogEntry,
  AppUser,
  AllowedEmailEntry,
  DynamicMenuItemConfig,
  HcmAdminUnit,
  SecurityAlert,
} from './types';
import { INITIAL_AUDIT_LOGS } from './data/initialAuditLogs';
import { INITIAL_USERS, INITIAL_DYNAMIC_MENUS, INITIAL_ALLOWED_EMAILS, INITIAL_HCM_ADMIN_UNITS } from './data/initialAuthData';
import {
  seedInitialFirestoreData,
  subscribeHouseholds,
  subscribeDocuments,
  subscribeAuditLogs,
  addHouseholdToFirestore,
  updateHouseholdNotesInFirestore,
  updateHouseholdCoordinatesInFirestore,
  updateHouseholdDataInFirestore,
  sendDocReminderInFirestore,
  addAuditLogInFirestore,
  checkBackendHealth,
} from './services/firestoreService';
import {
  subscribeUsers,
  subscribeAllowedEmails,
  subscribeDynamicMenus,
  subscribeHcmAdminUnits,
  subscribeSecurityAlerts,
  seedAuthAndRbacData,
  fetchRbacMe,
  updateOwnAccount,
  logSecurityAlert,
} from './services/authService';
import { LoginScreen } from './components/LoginScreen';
import { SuperAdminHubTab } from './components/SuperAdminHubTab';
import { SuperAdminAccessGuard } from './components/SuperAdminAccessGuard';
import { SubAdminDelegationTab } from './components/SubAdminDelegationTab';

export default function App() {
  const dispatch = useAppDispatch();
  const { account, isAuthenticated, sessionHasBeenFetched, errorMessage } = useAppSelector(state => state.authentication);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [policyError, setPolicyError] = useState('');
  useEffect(() => {
    let active = true;
    if (!isAuthenticated) {
      setCurrentUser(null);
      return;
    }
    const load = async () => {
      try {
        const user = await fetchRbacMe();
        if (active) {
          setCurrentUser(user);
          setPolicyError('');
        }
      } catch {
        if (active) {
          setCurrentUser(null);
          setPolicyError('Không thể xác nhận quyền truy cập. Liên hệ quản trị đơn vị hoặc thử đăng nhập lại.');
        }
      }
    };
    void load();
    const timer = window.setInterval(load, 30000);
    window.addEventListener('rbac-changed', load);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('rbac-changed', load);
    };
  }, [isAuthenticated, account.login]);
  if (!sessionHasBeenFetched)
    return (
      <div role="status" className="p-8">
        Đang xác thực phiên đăng nhập...
      </div>
    );
  if (!isAuthenticated && /timeout|network|ECONN|502|503/i.test(errorMessage || ''))
    return (
      <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-center text-white">
        <h1 className="text-xl font-bold">Không thể kết nối máy chủ</h1>
        <p>Máy chủ chưa phản hồi yêu cầu xác thực. Vui lòng thử lại sau khi dịch vụ hoạt động.</p>
        <button type="button" className="rounded bg-blue-600 px-5 py-2 font-semibold" onClick={() => dispatch(getSession())}>
          Thử kết nối lại
        </button>
      </div>
    );
  if (!isAuthenticated) return <LoginScreen />;
  if (!currentUser)
    return (
      <div role="alert" className="p-8">
        {policyError || 'Đang tải quyền truy cập từ máy chủ...'}
      </div>
    );
  return <AuthenticatedDashboard key={`${currentUser.id}:${currentUser.version}:${currentUser.role}`} currentUser={currentUser} />;
}

function AuthenticatedDashboard({ currentUser }: { currentUser: AppUser }) {
  const [usersList, setUsersList] = useState<AppUser[]>([]);
  const [allowedEmails, setAllowedEmails] = useState<AllowedEmailEntry[]>([]);
  const [dynamicMenus, setDynamicMenus] = useState<DynamicMenuItemConfig[]>([]);

  // Supplement default system menus when the database has not yet been synchronized.
  const effectiveDynamicMenus = useMemo(() => {
    const list = [...dynamicMenus];
    INITIAL_DYNAMIC_MENUS.forEach(def => {
      const existingIdx = list.findIndex(m => m.id === def.id);
      if (existingIdx === -1) {
        list.push(def);
      }
    });
    return list;
  }, [dynamicMenus]);

  const canOpenMenu = (id: NavigationTab) =>
    effectiveDynamicMenus.some(
      menu =>
        menu.id === id &&
        canViewMapTab(currentUser, id) &&
        menu.visibleRoles.includes(currentUser.role) &&
        (currentUser.role === 'superadmin' ||
          !menu.requiredPermission ||
          currentUser.subAdminPermissions?.[menu.requiredPermission] === true),
    );

  useEffect(() => {
    if (effectiveDynamicMenus.length && !canOpenMenu(activeTab)) {
      const first = effectiveDynamicMenus.find(menu => canOpenMenu(menu.id));
      if (first) setActiveTab(first.id);
    }
  }, [effectiveDynamicMenus]);
  const [hcmUnits, setHcmUnits] = useState<HcmAdminUnit[]>([]);
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([]);

  const [activeTab, setActiveTab] = useState<NavigationTab>('overview');
  const [households, setHouseholds] = useState<HouseholdFacility[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [officer, setOfficer] = useState<OfficerProfile>(DEFAULT_OFFICER);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  useEffect(() => {
    if (activeTab !== 'logs' || !currentUser) return;
    let active = true;
    void (async () => {
      if (!active) return;
      const logs = await fetchPatrolLogsFromBackend();
      if (active) setAuditLogs(logs);
    })();
    return () => {
      active = false;
    };
  }, [activeTab, currentUser?.id]);
  const [renewingDocument, setRenewingDocument] = useState<DocumentRecord | null>(null);
  const [dataErrors, setDataErrors] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [documentFilter, setDocumentFilter] = useState<'all' | 'expiring_soon' | 'valid'>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Connection & Backend status
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  // Mobile sidebar drawer state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [selectedHousehold, setSelectedHousehold] = useState<HouseholdFacility | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedMapCoordinates, setSelectedMapCoordinates] = useState<[number, number] | null>(null);
  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
  useEffect(() => {
    setSelectedHousehold(null);
    setIsAddModalOpen(false);
    setSelectedMapCoordinates(null);
  }, [currentUser.id, currentUser.version]);

  // Fullscreen map mode for Advanced Map
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

  // Toggle map fullscreen safely via pure viewport mode (no browser gesture restrictions)
  const handleToggleMapFullscreen = () => {
    setIsMapFullscreen(prev => !prev);
  };

  // Hide outer JHipster elements and remove padding during map fullscreen if present
  useEffect(() => {
    const appHeader = document.getElementById('app-header');
    const appContainer = document.querySelector('.app-container') as HTMLElement | null;
    const viewContainer = document.querySelector('#app-view-container') as HTMLElement | null;
    const jhCard = document.querySelector('.jh-card') as HTMLElement | null;

    if (isMapFullscreen) {
      if (appHeader) appHeader.style.display = 'none';
      if (appContainer) {
        appContainer.style.paddingTop = '0px';
        appContainer.style.height = '100vh';
      }
      if (viewContainer) {
        viewContainer.style.padding = '0px';
        viewContainer.style.height = '100vh';
        viewContainer.style.maxWidth = '100vw';
      }
      if (jhCard) {
        jhCard.style.padding = '0px';
        jhCard.style.border = 'none';
        jhCard.style.boxShadow = 'none';
        jhCard.style.borderRadius = '0px';
      }
    } else {
      if (appHeader) appHeader.style.display = '';
      if (appContainer) {
        appContainer.style.paddingTop = '';
        appContainer.style.height = '';
      }
      if (viewContainer) {
        viewContainer.style.padding = '';
        viewContainer.style.height = '';
        viewContainer.style.maxWidth = '';
      }
      if (jhCard) {
        jhCard.style.padding = '';
        jhCard.style.border = '';
        jhCard.style.boxShadow = '';
        jhCard.style.borderRadius = '';
      }
    }
  }, [isMapFullscreen]);

  // Exit fullscreen on Esc key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMapFullscreen) {
        handleToggleMapFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMapFullscreen]);

  // Toast / notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Dark/Light Theme state with localStorage persistence & system preference fallback
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const savedTheme = localStorage.getItem('app_theme');
      if (savedTheme === 'dark' || savedTheme === 'light') {
        return savedTheme;
      }
      if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch {
      // ignore storage errors
    }
    return 'light';
  });

  // Apply 'dark' class to root html element and persist preference
  useEffect(() => {
    try {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('app_theme', theme);
    } catch (e) {
      console.warn('Could not persist theme:', e);
    }
  }, [theme]);

  const handleToggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    showToast(nextTheme === 'dark' ? 'Đã bật Chế độ Tối (Dark Mode) - Dịu mắt khi thiếu sáng' : 'Đã bật Chế độ Sáng (Light Mode)');
  };

  const handleSetTheme = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    showToast(newTheme === 'dark' ? 'Đã bật Chế độ Tối (Dark Mode) - Dịu mắt khi thiếu sáng' : 'Đã bật Chế độ Sáng (Light Mode)');
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Initialize Firestore and Backend on app load
  useEffect(() => {
    const onRbacError = (event: Event) => showToast((event as CustomEvent<string>).detail);
    window.addEventListener('rbac-error', onRbacError);
    let unsubscribeHouseholds: () => void = () => {};
    let unsubscribeDocuments: () => void = () => {};
    let unsubscribeOfficer: () => void = () => {};
    let unsubscribeAuditLogs: () => void = () => {};

    let cancelled = false;
    const refreshHealth = async () => {
      const result = await checkBackendHealth();
      if (!cancelled) {
        setBackendStatus(result.status === 'ok' ? 'online' : 'offline');
      }
    };
    void refreshHealth();
    const healthTimer = window.setInterval(refreshHealth, 30000);

    void loadOperationalData().then(results => {
      if (cancelled) return;
      applyOperationalData(results);
      setIsLoading(false);
    });

    // 4. Seed initial RBAC, Allowed Emails, and Dynamic Menus if empty
    seedAuthAndRbacData().catch(console.warn);

    // 5. Attach real-time listeners for RBAC, Menus, Units, and Security Alerts
    const unsubUsers = ['superadmin', 'admin', 'sub-admin'].includes(currentUser.role)
      ? subscribeUsers(users => {
          setUsersList(users);
        })
      : () => {};
    const unsubEmails =
      currentUser.role === 'superadmin'
        ? subscribeAllowedEmails(emails => {
            setAllowedEmails(emails);
          })
        : () => {};
    const unsubMenus = subscribeDynamicMenus(menus => {
      setDynamicMenus(menus);
    });
    const unsubUnits =
      currentUser.role === 'superadmin'
        ? subscribeHcmAdminUnits(units => {
            setHcmUnits(units);
          })
        : () => {};
    const unsubAlerts =
      currentUser.role === 'superadmin'
        ? subscribeSecurityAlerts(alerts => {
            if (alerts) setSecurityAlerts(alerts);
          })
        : () => {};

    return () => {
      cancelled = true;
      window.removeEventListener('rbac-error', onRbacError);
      window.clearInterval(healthTimer);
      unsubscribeHouseholds();
      unsubscribeDocuments();
      unsubscribeOfficer();
      unsubscribeAuditLogs();
      unsubUsers();
      unsubEmails();
      unsubMenus();
      unsubUnits();
      unsubAlerts();
    };
  }, []);

  // Synchronize officer profile card with current logged-in user
  useEffect(() => {
    if (currentUser) {
      setOfficer(prev => ({
        ...prev,
        officerName: currentUser.fullName,
        rank: currentUser.rank,
        unit: currentUser.unit,
        badgeNumber: currentUser.badgeNumber,
        username: currentUser.username,
        permissions: currentUser.position,
        assignedArea: `${currentUser.assignedWard}${
          currentUser.assignedHamlets && currentUser.assignedHamlets.length > 0 ? ` (${currentUser.assignedHamlets.join(', ')})` : ''
        }`,
      }));
    }
  }, [currentUser]);

  // Session actions
  const handleLogout = async () => {
    try {
      await logoutBackendSession();
    } catch {
      showToast('Không thể đăng xuất trên máy chủ. Vui lòng thử lại.');
    }
  };
  const handleSwitchAccount = handleLogout;

  const warningCount = households.filter(h => h.status === 'warning').length;

  // Helper date-time and integrity hash generators for audit logs
  const formatDateTime = (d: Date): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  const generateSimpleHash = (seed: string): string => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    const rand = Math.floor(Math.random() * 0xffffff)
      .toString(16)
      .padStart(6, '0');
    return `SHA256: ${hex}${rand}...${hex.slice(0, 4)}`;
  };

  // Record audit log helper with PostgreSQL Backend Persistence
  const recordAuditLog = async (log: AuditLogEntry) => {
    // 2. Lưu trực tiếp vào PostgreSQL backend (/api/patrol-logs)
    try {
      const saved = await savePatrolLogInBackend(log);
      if (saved) {
        setAuditLogs(prev => [saved, ...prev]);
      } else {
        showToast('Máy chủ chưa xác nhận lưu nhật ký. Vui lòng kiểm tra lại.');
        return false;
      }
    } catch (err) {
      console.warn('Lỗi lưu nhật ký backend:', err);
      showToast('Không thể lưu nhật ký kiểm tra. Vui lòng thử lại.');
      return false;
    }

    // 3. Phụ trợ đồng bộ Firestore nếu có
    addAuditLogInFirestore(log).catch(err => {
      console.warn('Persist audit log firestore notice:', err);
    });
    return true;
  };

  const handleAddManualLog = async (partial: Partial<AuditLogEntry>) => {
    const now = new Date();
    const newLog: AuditLogEntry = {
      id: `LOG-MAN-${Date.now()}`,
      timestamp: formatDateTime(now),
      createdAt: Date.now(),
      actionType: partial.actionType || 'profile_update',
      actionLabel: partial.actionLabel || 'Tuần tra thực địa',
      officerName: currentUser?.fullName || officer.officerName || 'Đại úy Nguyễn Văn Bình',
      officerBadge: currentUser?.badgeNumber || officer.badgeNumber || 'CSKV-0912',
      targetType: partial.targetType || 'household',
      targetCode: partial.targetCode,
      targetTitle: partial.targetTitle || 'Địa bàn Xã Bà Điểm',
      details: partial.details || 'Ghi nhận tuần tra thực địa',
      ipAddress: '192.168.1.45',
      deviceInfo: 'Tablet tuần tra chuyên dụng CSKV #01',
      integrityHash: generateSimpleHash(`MAN-${Date.now()}`),
      status: partial.status || 'info',
    };
    const saved = await recordAuditLog(newLog);
    if (saved) showToast('Đã lưu nhật ký tuần tra thực địa vào cơ sở dữ liệu PostgreSQL.');
    return saved;
  };

  // Handlers with Backend PostgreSQL Persistence & Audit Logging
  const handleUpdateNotes = async (id: string, notes: string) => {
    const target = households.find(h => h.id === id);
    const today = new Date().toLocaleDateString('vi-VN');
    try {
      await updateHouseholdNotesInBackend(id, notes);
      setHouseholds(prev => prev.map(h => (h.id === id ? { ...h, notes, lastCheckedDate: today } : h)));
      setSelectedHousehold(prev => (prev?.id === id ? { ...prev, notes, lastCheckedDate: today } : prev));
      showToast('Đã lưu ghi chú kiểm tra vào cơ sở dữ liệu PostgreSQL.');
    } catch (err) {
      console.error('Lỗi khi lưu ghi chú backend:', err);
      showToast('Không thể lưu ghi chú. Nội dung nhập được giữ lại để thử lại.');
      throw err;
    }

    // Record audit log for profile / inspection update
    const noteLog: AuditLogEntry = {
      id: `LOG-NOTE-${Date.now()}`,
      timestamp: formatDateTime(new Date()),
      createdAt: Date.now(),
      actionType: 'profile_update',
      actionLabel: 'Cập nhật hồ sơ kiểm tra',
      officerName: currentUser?.fullName || officer.officerName || 'Cán bộ CSKV',
      officerBadge: currentUser?.badgeNumber || officer.badgeNumber || 'CSKV',
      targetType: 'household',
      targetId: id,
      targetCode: target?.code,
      targetTitle: target ? `${target.houseNumber} ${target.street} (${target.ownerName})` : id,
      details: `Cập nhật kết quả kiểm tra thực địa định kỳ: "${notes}"`,
      previousValue: target?.notes || 'Chưa có ghi chú',
      newValue: notes,
      ipAddress: '192.168.1.45',
      deviceInfo: 'Tablet tuần tra chuyên dụng CSKV #01',
      integrityHash: generateSimpleHash(`NOTE-${Date.now()}`),
      status: 'success',
    };
    recordAuditLog(noteLog);
  };

  const handleHouseholdUpdated = async (updated: HouseholdFacility) => {
    setHouseholds(prev => prev.map(h => (h.id === updated.id ? updated : h)));
    setSelectedHousehold(updated);

    try {
      await updateHouseholdInBackend(updated);
      showToast(`Đã đồng bộ hồ sơ hộ ${updated.code} vào PostgreSQL.`);
    } catch (err) {
      console.error('Lỗi khi đồng bộ OCR vào backend:', err);
      showToast(`Đã đồng bộ thông tin hồ sơ hộ ${updated.code} từ kết quả quét OCR.`);
    }

    // Record audit log for OCR scan / profile sync
    const ocrLog: AuditLogEntry = {
      id: `LOG-OCR-${Date.now()}`,
      timestamp: formatDateTime(new Date()),
      createdAt: Date.now(),
      actionType: 'ocr_scan',
      actionLabel: 'Trích xuất OCR CCCD',
      officerName: currentUser?.fullName || officer.officerName || 'Cán bộ CSKV',
      officerBadge: currentUser?.badgeNumber || officer.badgeNumber || 'CSKV',
      targetType: 'household',
      targetId: updated.id,
      targetCode: updated.code,
      targetTitle: `${updated.houseNumber} ${updated.street} (${updated.ownerName})`,
      details: `Trích xuất dữ liệu thẻ CCCD/giấy phép, đồng bộ nhân khẩu cư trú: ${updated.residentsCount} nhân khẩu.`,
      newValue: `Chủ hộ: ${updated.ownerName}, SĐT: ${updated.ownerPhone}`,
      ipAddress: '192.168.1.45',
      deviceInfo: 'Camera quét di động thiết bị CSKV',
      integrityHash: generateSimpleHash(`OCR-${Date.now()}`),
      status: 'info',
    };
    recordAuditLog(ocrLog);
  };

  const handleUpdateHouseholdFull = async (updated: HouseholdFacility) => {
    try {
      const persisted = await updateHouseholdInBackend(updated);
      // These presentation/capture fields are held outside the household API.
      const saved = { ...persisted, gridPosition: updated.gridPosition, inspectionPhotos: updated.inspectionPhotos };
      setHouseholds(prev => prev.map(h => (h.id === saved.id ? saved : h)));
      setSelectedHousehold(prev => (prev?.id === saved.id ? saved : prev));
      showToast(`Đã cập nhật hộ ${updated.code} vào PostgreSQL thành công!`);
    } catch (err) {
      console.error('Lỗi khi lưu cập nhật vào PostgreSQL:', err);
      showToast('Chưa lưu đầy đủ hồ sơ. Kiểm tra lại dữ liệu trước khi thử lại.');
      throw err;
    }

    // Audit log
    const log: AuditLogEntry = {
      id: `LOG-RES-${Date.now()}`,
      timestamp: formatDateTime(new Date()),
      createdAt: Date.now(),
      actionType: 'profile_update',
      actionLabel: 'Cập nhật nhân khẩu hộ',
      officerName: currentUser?.fullName || officer.officerName || 'Đại úy Nguyễn Văn Bình',
      officerBadge: currentUser?.badgeNumber || officer.badgeNumber || 'CSKV-0912',
      targetType: 'household',
      targetId: updated.id,
      targetCode: updated.code,
      targetTitle: `${updated.houseNumber} ${updated.street} (${updated.ownerName})`,
      details: `Cập nhật danh sách nhân khẩu: ${updated.residentsList?.length || updated.residentsCount} người.`,
      newValue: `Nhân khẩu: ${updated.residentsCount} (Nam: ${updated.maleCount}, Nữ: ${updated.femaleCount})`,
      ipAddress: '192.168.1.45',
      deviceInfo: 'Thiết bị quản lý nhân khẩu CSKV',
      integrityHash: generateSimpleHash(`RES-${Date.now()}`),
      status: 'success',
    };
    recordAuditLog(log);
  };

  const handleDeleteHousehold = async (id: string | number) => {
    const idStr = String(id);
    const target = households.find(h => h.id === idStr);

    // Optimistic UI update
    setHouseholds(prev => prev.filter(h => h.id !== idStr));
    if (selectedHousehold && selectedHousehold.id === idStr) {
      setSelectedHousehold(null);
    }

    try {
      await deleteHouseholdInBackend(id);
      showToast(`Đã xóa hộ ${target?.code || idStr} khỏi PostgreSQL thành công.`);
    } catch (err) {
      console.error('Lỗi khi xóa hộ trong backend:', err);
      showToast('Lỗi khi xóa hộ dân khỏi cơ sở dữ liệu.');
    }

    // Audit log
    const delLog: AuditLogEntry = {
      id: `LOG-DEL-${Date.now()}`,
      timestamp: formatDateTime(new Date()),
      createdAt: Date.now(),
      actionType: 'system',
      actionLabel: 'Xóa hộ dân',
      officerName: currentUser?.fullName || officer.officerName || 'Đại úy Nguyễn Văn Bình',
      officerBadge: currentUser?.badgeNumber || officer.badgeNumber || 'CSKV-0912',
      targetType: 'household',
      targetId: idStr,
      targetCode: target?.code,
      targetTitle: target ? `${target.houseNumber} ${target.street} (${target.ownerName})` : idStr,
      details: `Xóa hộ dân ${target?.ownerName || idStr} khỏi cơ sở dữ liệu quản lý.`,
      ipAddress: '192.168.1.45',
      deviceInfo: 'Thiết bị quản lý CSKV',
      integrityHash: generateSimpleHash(`DEL-${Date.now()}`),
      status: 'warning',
    };
    recordAuditLog(delLog);
  };

  const handleUpdateCoordinates = async (updates: Array<{ id: string; coordinates: [number, number] }>) => {
    // RBAC Check for Officer
    if (currentUser?.role !== 'superadmin' && currentUser.subAdminPermissions?.canEditCoordinates !== true) {
      showToast('⚠️ Thẩm quyền bị khóa: Bạn chưa được Công an phụ trách phân quyền nắn chỉnh tọa độ.');
      logSecurityAlert({
        level: 'warning',
        title: 'Cố gắng sửa đổi tọa độ ngoài thẩm quyền',
        description: `Tài khoản ${currentUser.fullName} (${currentUser.badgeNumber}) đã thử nắn chỉnh tọa độ mà chưa có quyền canEditCoordinates.`,
        sourceIp: '192.168.1.45',
        actorId: currentUser.id,
        actorName: currentUser.fullName,
      }).catch(console.warn);
      return;
    }

    // 1. Optimistic UI update
    setHouseholds(prev =>
      prev.map(h => {
        const item = updates.find(u => u.id === h.id);
        if (item) {
          return { ...h, coordinates: item.coordinates, coordinatesEstimated: false };
        }
        return h;
      }),
    );

    if (selectedHousehold) {
      const item = updates.find(u => u.id === selectedHousehold.id);
      if (item) {
        setSelectedHousehold(prev => (prev ? { ...prev, coordinates: item.coordinates, coordinatesEstimated: false } : null));
      }
    }

    // 2. Persist to PostgreSQL Backend
    try {
      await updateHouseholdCoordinatesInBackend(updates);
      showToast(`Đã lưu thành công tọa độ mới cho ${updates.length} điểm nhà vào PostgreSQL!`);
    } catch (err) {
      console.error('Lỗi khi lưu tọa độ PostgreSQL:', err);
      setHouseholds(prev =>
        prev.map(h => households.find(original => original.id === h.id && updates.some(update => update.id === h.id)) ?? h),
      );
      showToast('Không lưu được tọa độ vào PostgreSQL. Vui lòng thử lại.');
      throw err;
    }

    // Record audit log for coordinate change
    const targetHouses = households.filter(h => updates.some(u => u.id === h.id));
    const targetTitles = targetHouses.map(h => `${h.houseNumber} ${h.street}`).join(', ') || `${updates.length} điểm nhà`;
    const geoLog: AuditLogEntry = {
      id: `LOG-GEO-${Date.now()}`,
      timestamp: formatDateTime(new Date()),
      createdAt: Date.now(),
      actionType: 'coordinate_update',
      actionLabel: 'Chỉnh sửa tọa độ GPS',
      officerName: currentUser?.fullName || officer.officerName || 'Đại úy Nguyễn Văn Bình',
      officerBadge: currentUser?.badgeNumber || officer.badgeNumber || 'CSKV-0912',
      targetType: 'household',
      targetCode: targetHouses[0]?.code,
      targetTitle: targetTitles,
      details: `Hiệu chỉnh mốc tọa độ thực địa cho ${updates.length} vị trí nhà tại Xã Bà Điểm (${targetTitles}).`,
      previousValue: 'Tọa độ ước lượng ban đầu',
      newValue: updates.map(u => `[${u.coordinates.map(c => c.toFixed(5)).join(', ')}]`).join('; '),
      ipAddress: '192.168.1.45',
      deviceInfo: 'Tablet tuần tra chuyên dụng CSKV #01',
      integrityHash: generateSimpleHash(`GEO-${Date.now()}`),
      status: 'success',
    };
    recordAuditLog(geoLog);
  };

  const handleAddHousehold = async (newH: HouseholdCreateInput) => {
    // RBAC Check for Officer
    if (currentUser?.role !== 'superadmin' && currentUser?.subAdminPermissions?.canAddHouseholds !== true) {
      showToast('⚠️ Thẩm quyền bị khóa: Bạn chưa được Công an phụ trách phân quyền đăng ký hộ dân mới.');
      return false;
    }

    try {
      const created = await createHouseholdInBackend(newH);
      setHouseholds(prev => [normalizeHousehold(created), ...prev]);
      showToast(`Đã thêm số nhà ${created.houseNumber} (${created.hamlet}) vào PostgreSQL thành công!`);
    } catch (err) {
      console.error('Lỗi khi thêm vào PostgreSQL:', err);
      showToast('Không thể lưu hộ dân vào cơ sở dữ liệu. Vui lòng kiểm tra thông tin và thử lại.');
      return false;
    }

    // Record audit log for adding new household
    const addLog: AuditLogEntry = {
      id: `LOG-ADD-${Date.now()}`,
      timestamp: formatDateTime(new Date()),
      createdAt: Date.now(),
      actionType: 'household_add',
      actionLabel: 'Đăng ký hộ dân mới',
      officerName: currentUser?.fullName || officer.officerName || 'Đại úy Nguyễn Văn Bình',
      officerBadge: currentUser?.badgeNumber || officer.badgeNumber || 'CSKV-0912',
      targetType: 'household',
      targetId: newH.id,
      targetCode: newH.code,
      targetTitle: `${newH.houseNumber} ${newH.street} (${newH.ownerName})`,
      details: `Lập hồ sơ quản lý cư trú mới cho hộ ${newH.ownerName}, ${newH.residentsCount} nhân khẩu tại ${newH.hamlet}, Xã Bà Điểm.`,
      newValue: `Mã hồ sơ: ${newH.code}, Số nhà: ${newH.houseNumber} ${newH.street}`,
      ipAddress: '192.168.1.15',
      deviceInfo: 'Máy trạm CSKV Bà Điểm',
      integrityHash: generateSimpleHash(`ADD-${Date.now()}`),
      status: 'success',
    };
    recordAuditLog(addLog);
    return true;
  };

  const handleRenewDocument = (docId: string) => {
    if (currentUser.role !== 'superadmin' && currentUser.subAdminPermissions?.canRenewDocs !== true) {
      showToast('Chưa được cấp quyền gia hạn hồ sơ');
      return;
    }
    const record = documents.find(document => document.id === docId);
    if (record) setRenewingDocument(record);
  };
  const saveDocumentRenewal = async (date: string) => {
    if (!renewingDocument) return;
    await renewDocumentInBackend(renewingDocument.id, date);
    try {
      setDocuments(await fetchAllDocumentRecords());
    } catch {
      showToast('Đã lưu gia hạn, nhưng chưa tải lại được danh sách. Vui lòng cập nhật dữ liệu.');
      return;
    }
    showToast('Đã lưu gia hạn hồ sơ.');
  };

  const handleSendReminder = async (docId: string) => {
    try {
      await sendDocReminderInFirestore(docId);
      showToast('Đã lưu yêu cầu nhắc nhở; đang chờ gửi');
    } catch {
      showToast('Không thể lưu yêu cầu nhắc nhở');
    }
  };

  const applyOperationalData = (results: Awaited<ReturnType<typeof loadOperationalData>>) => {
    const [householdResult, documentResult, logResult, alertResult] = results;
    if (householdResult.status === 'fulfilled') setHouseholds(householdResult.value);
    if (documentResult.status === 'fulfilled') setDocuments(documentResult.value);
    if (logResult.status === 'fulfilled') setAuditLogs(logResult.value);
    if (alertResult.status === 'fulfilled') setSecurityAlerts(alertResult.value);
    const failed = results.flatMap((result, index) => (result.status === 'rejected' ? [OPERATIONAL_DATA_LABELS[index]] : []));
    setDataErrors(failed);
    if (!failed.length) setLastUpdated(new Date());
    return failed;
  };

  const handleRefresh = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const failed = applyOperationalData(await loadOperationalData());
      showToast(failed.length ? 'Một số dữ liệu chưa cập nhật. Xem thông báo để thử lại.' : 'Đã cập nhật đầy đủ dữ liệu địa bàn.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateOfficer = async (updated: Partial<OfficerProfile>) => {
    try {
      const user = await updateOwnAccount(updated.officerName ?? currentUser?.fullName ?? '', updated.rank ?? currentUser?.rank ?? '');
      setOfficer(prev => ({ ...prev, officerName: user.fullName, rank: user.rank }));
      showToast('Đã lưu thông tin tài khoản vào database.');
    } catch (error) {
      showToast('Không thể lưu thông tin tài khoản. Vui lòng thử lại.');
      throw error;
    }

    // Record audit log for officer profile update
    const offLog: AuditLogEntry = {
      id: `LOG-OFF-${Date.now()}`,
      timestamp: formatDateTime(new Date()),
      createdAt: Date.now(),
      actionType: 'officer_update',
      actionLabel: 'Cập nhật tài khoản CSKV',
      officerName: updated.officerName || officer.officerName,
      officerBadge: updated.badgeNumber || officer.badgeNumber,
      targetType: 'officer',
      targetTitle: updated.officerName || officer.officerName,
      details: `Cập nhật thông tin hồ sơ cán bộ phụ trách địa bàn (${updated.rank || officer.rank})`,
      ipAddress: '192.168.1.15',
      deviceInfo: 'Máy trạm chuyên dụng CSKV',
      integrityHash: generateSimpleHash(`OFF-${Date.now()}`),
      status: 'info',
    };
    recordAuditLog(offLog);
  };

  // Territory restriction determination
  const isTerritoryRestricted = currentUser?.role === 'sub-admin' || currentUser?.role === 'officer';

  const matchesHamlet = (h: HouseholdFacility, user: AppUser | null) => {
    if (user?.hamletIds) return h.hamletId != null && user.hamletIds.includes(h.hamletId);
    if (!user || !user.assignedHamlets || user.assignedHamlets.length === 0) return false;
    if (!h.hamlet) return false;
    return user.assignedHamlets.some(ah => {
      const ahNorm = ah.toLowerCase().trim();
      const hNorm = h.hamlet.toLowerCase().trim();
      return ahNorm === hNorm;
    });
  };

  const assignedHouseholds = useMemo(() => {
    if (!isTerritoryRestricted) return households;
    return households.filter(h => matchesHamlet(h, currentUser));
  }, [households, currentUser, isTerritoryRestricted]);

  const scopedHouseholds = useMemo(() => {
    if (!isTerritoryRestricted) return households;
    return assignedHouseholds;
  }, [households, assignedHouseholds, isTerritoryRestricted]);

  const assignedResidentsCount = useMemo(() => {
    return assignedHouseholds.reduce((acc, h) => acc + (h.residentsCount || 1), 0);
  }, [assignedHouseholds]);

  // If user searched in header and pressed or typed, filter scoped view
  const displayedHouseholds = useMemo(() => {
    if (!searchQuery.trim()) return scopedHouseholds;
    return scopedHouseholds.filter(household => matchesHouseholdSearch(household, searchQuery));
  }, [scopedHouseholds, searchQuery]);

  return (
    <div
      id="__page-root"
      className={`flex h-screen h-[100dvh] w-full bg-[#f8fafc] dark:bg-[#090d16] text-slate-900 dark:text-slate-100 font-sans overflow-hidden ${isMapFullscreen ? 'p-0' : ''}`}
    >
      {/* Left Sidebar (Desktop + Mobile Drawer) */}
      {!isMapFullscreen && (
        <Sidebar
          backendStatus={backendStatus}
          activeTab={activeTab}
          onTabChange={tab => {
            if (isMapFullscreen) setIsMapFullscreen(false);
            setActiveTab(tab);
            setSearchQuery('');
          }}
          officer={officer}
          currentUser={currentUser}
          dynamicMenus={effectiveDynamicMenus}
          warningCount={warningCount}
          isOpenMobile={isMobileSidebarOpen}
          isOpenDesktop={isDesktopSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          onLogout={handleLogout}
          onSwitchAccount={handleSwitchAccount}
        />
      )}

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 h-full overflow-hidden relative ${isMapFullscreen ? 'w-full' : ''}`}>
        {/* Top Header */}
        {!isMapFullscreen && (
          <Header
            activeTab={activeTab}
            warningCount={warningCount}
            onOpenWarnings={() => setIsWarningModalOpen(true)}
            onRefresh={handleRefresh}
            isRefreshing={isLoading}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onToggleMobileSidebar={() => setIsMobileSidebarOpen(true)}
            onToggleDesktopSidebar={() => setIsDesktopSidebarOpen(open => !open)}
            isDesktopSidebarOpen={isDesktopSidebarOpen}
            backendStatus={backendStatus}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            onTabChange={tab => {
              if (isMapFullscreen) setIsMapFullscreen(false);
              setActiveTab(tab);
            }}
            currentUser={currentUser}
            onLogout={handleLogout}
          />
        )}

        <main
          id="gis-main-content"
          tabIndex={-1}
          className={`flex-1 min-w-0 min-h-0 ${
            isMapFullscreen || activeTab === 'field-3d-map'
              ? 'w-full h-full p-0 overflow-hidden flex flex-col'
              : 'overflow-y-auto p-3.5 sm:p-5 md:p-6 pb-24 lg:pb-6 scroll-smooth'
          }`}
        >
          {!isMapFullscreen && (
            <div className="mb-4 space-y-2">
              {isLoading && (
                <p role="status" className="text-sm text-slate-600 dark:text-slate-300">
                  Đang tải dữ liệu địa bàn…
                </p>
              )}
              {dataErrors.length > 0 && (
                <div
                  role="alert"
                  className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 flex flex-wrap items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <strong>Chưa tải được: {dataErrors.join(', ')}.</strong>
                    <p className="mb-0 mt-1">
                      Dữ liệu đã tải trước đó được giữ lại và có thể chưa cập nhật. Kiểm tra kết nối hoặc quyền truy cập.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => void handleRefresh()}
                    className="rounded-lg border border-amber-400 px-3 py-2 font-semibold"
                  >
                    Thử lại
                  </button>
                </div>
              )}
              {lastUpdated && <p className="mb-0 text-xs text-slate-500">Lần cập nhật đầy đủ: {lastUpdated.toLocaleString('vi-VN')}</p>}
            </div>
          )}
          {canOpenMenu(activeTab) ? (
            <>
              {/* Active Search Banner when filter is engaged */}
              {searchQuery.trim() && !isMapFullscreen && (
                <div className="mb-4 p-2.5 sm:p-3 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 rounded-xl flex items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping shrink-0" />
                    <span className="text-slate-600 dark:text-slate-300">Kết quả lọc tìm kiếm:</span>
                    <span className="font-bold text-blue-900 dark:text-blue-200 truncate bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                      "{searchQuery}"
                    </span>
                    <span className="text-slate-500 font-mono text-[11px] hidden sm:inline">
                      ({displayedHouseholds.length} hồ sơ phù hợp)
                    </span>
                  </div>
                  <button
                    type="button"
                    id="btn-clear-active-search"
                    onClick={() => setSearchQuery('')}
                    className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 text-slate-700 dark:text-slate-300 font-semibold rounded-lg border border-slate-200 dark:border-slate-700 transition-colors shrink-0 text-[11px] flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    <span>Xóa bộ lọc</span>
                  </button>
                </div>
              )}

              {/* Territory Scope Control Bar for Sub-Admin and Officer */}
              {isTerritoryRestricted && !isMapFullscreen && (
                <div className="mb-4 p-3.5 sm:p-4 bg-gradient-to-r from-blue-900/30 via-slate-900/70 to-indigo-950/40 dark:from-blue-950/60 dark:via-slate-900/80 dark:to-indigo-950/60 border border-blue-700/40 dark:border-blue-800/60 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs animate-in fade-in duration-200">
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0 mt-0.5 sm:mt-0">
                      <MapPin className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-sm">
                          {currentUser?.assignedHamlets?.join(', ') || 'Địa bàn phân công'}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono bg-blue-500/20 text-blue-300 border border-blue-400/30">
                          {currentUser?.role === 'sub-admin' ? 'Sub-Admin Quản Lý Ấp' : 'Công An Viên Tuyến'}
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          • {currentUser?.rank} {currentUser?.fullName}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 mt-1 flex items-center gap-2 flex-wrap">
                        <span>
                          Tuyến phụ trách:{' '}
                          <strong className="text-slate-100 font-medium">
                            {currentUser?.assignedStreets && currentUser.assignedStreets.length > 0
                              ? currentUser.assignedStreets.join(', ')
                              : 'Toàn bộ địa bàn ấp'}
                          </strong>
                        </span>
                        <span>•</span>
                        <span className="text-emerald-400 font-semibold">
                          {assignedHouseholds.length} hộ dân / {assignedResidentsCount} nhân khẩu
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'overview' && (
                <OverviewTab
                  households={displayedHouseholds}
                  canNavigate={canOpenMenu}
                  onOpenExpiringDocuments={() => {
                    setDocumentFilter('expiring_soon');
                    setActiveTab('documents');
                  }}
                  onNavigateTab={tab => {
                    if (isMapFullscreen) setIsMapFullscreen(false);
                    setActiveTab(tab);
                  }}
                  onSelectHousehold={setSelectedHousehold}
                />
              )}

              {activeTab === 'area-map' && (
                <AreaMapTab
                  households={displayedHouseholds}
                  onSelectHousehold={setSelectedHousehold}
                  onRefresh={handleRefresh}
                  onNavigateTab={tab => {
                    if (isMapFullscreen) setIsMapFullscreen(false);
                    setActiveTab(tab);
                  }}
                />
              )}

              {activeTab === 'advanced-map' && (
                <Suspense
                  fallback={
                    <div role="status" className="p-6">
                      Đang tải bản đồ 2D/3D...
                    </div>
                  }
                >
                  <MapLibreAreaMap
                    households={displayedHouseholds}
                    onSelectHousehold={setSelectedHousehold}
                    onUpdateCoordinates={handleUpdateCoordinates}
                  />
                </Suspense>
              )}

              {(activeTab === 'field-3d-map' || (activeTab === 'bando-3d' && currentUser?.role !== 'superadmin')) && (
                <Suspense
                  fallback={
                    <div role="status" className="p-6">
                      Đang tải bản đồ 3D...
                    </div>
                  }
                >
                  <FieldHouseMap
                    captureOfficer={{
                      fullName: currentUser.fullName,
                      rank: currentUser.rank,
                      unit: currentUser.unit,
                      area: currentUser.assignedHamlets?.join(', ') || currentUser.assignedWard,
                    }}
                    key={`${currentUser.id}:${currentUser.version ?? 0}`}
                    households={displayedHouseholds}
                    canAdd={currentUser?.role === 'superadmin' || currentUser?.subAdminPermissions?.canAddHouseholds === true}
                    canLink={currentUser?.role === 'superadmin' || currentUser?.subAdminPermissions?.canEditCoordinates === true}
                    onSelect={setSelectedHousehold}
                    onAdd={coordinates => {
                      setSelectedMapCoordinates(coordinates);
                      setIsAddModalOpen(true);
                    }}
                    isFullscreen={isMapFullscreen}
                    onToggleFullscreen={handleToggleMapFullscreen}
                  />
                </Suspense>
              )}
              {activeTab === 'bando-3d' && currentUser?.role === 'superadmin' && (
                <BaDiem3DMapEditor
                  isFullscreen={isMapFullscreen}
                  onToggleFullscreen={handleToggleMapFullscreen}
                  onNavigateTab={tab => {
                    if (isMapFullscreen) setIsMapFullscreen(false);
                    setActiveTab(tab);
                  }}
                  onShowToast={showToast}
                />
              )}

              {activeTab === 'households' && (
                <HouseholdsTab
                  households={scopedHouseholds}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  isLoading={isLoading}
                  currentUser={currentUser}
                  onSelectHousehold={setSelectedHousehold}
                  onOpenAddModal={() => {
                    if (currentUser?.role !== 'superadmin' && currentUser?.subAdminPermissions?.canAddHouseholds !== true) {
                      showToast('⚠️ Thẩm quyền bị khóa: Bạn chưa được phân quyền đăng ký hộ dân mới.');
                      return;
                    }
                    setSelectedMapCoordinates(null);
                    setIsAddModalOpen(true);
                  }}
                  onDeleteHousehold={handleDeleteHousehold}
                  onShowToast={showToast}
                />
              )}

              {activeTab === 'residents' && (
                <ResidentsTab
                  households={displayedHouseholds}
                  allHouseholds={households}
                  onSelectHousehold={setSelectedHousehold}
                  onUpdateHousehold={handleUpdateHouseholdFull}
                  currentUser={currentUser}
                  onShowToast={showToast}
                />
              )}

              {activeTab === 'documents' && (
                <DocumentsTab
                  canRenew={currentUser.role === 'superadmin' || currentUser.subAdminPermissions?.canRenewDocs === true}
                  canRemind={currentUser.role === 'superadmin' || currentUser.subAdminPermissions?.canSendReminders === true}
                  filterStatus={documentFilter}
                  onFilterStatusChange={setDocumentFilter}
                  documents={documents}
                  onRenewDocument={handleRenewDocument}
                  onSendReminder={handleSendReminder}
                />
              )}

              {activeTab === 'areas' && <AreasTab households={displayedHouseholds} onSelectHousehold={setSelectedHousehold} />}

              {activeTab === 'logs' && (
                <LogsTab
                  logs={auditLogs}
                  households={households}
                  onSelectHousehold={setSelectedHousehold}
                  onAddManualLog={handleAddManualLog}
                />
              )}

              {activeTab === 'subadmin-delegation' && (
                <SubAdminDelegationTab currentUser={currentUser} usersList={usersList} onShowToast={showToast} />
              )}

              {activeTab === 'superadmin-hub' &&
                (currentUser.role === 'superadmin' ? (
                  <SuperAdminHubTab
                    currentUser={currentUser}
                    dynamicMenus={dynamicMenus}
                    dynamicMenusList={dynamicMenus}
                    hcmUnits={hcmUnits}
                    hcmUnitsList={hcmUnits}
                    usersList={usersList}
                    allowedEmails={allowedEmails}
                    allowedEmailsList={allowedEmails}
                    securityAlerts={securityAlerts}
                    securityAlertsList={securityAlerts}
                    onShowToast={showToast}
                    onSwitchAccount={handleSwitchAccount}
                  />
                ) : (
                  <SuperAdminAccessGuard
                    currentUser={currentUser}
                    onSwitchToSuperAdmin={handleSwitchAccount}
                    onSwitchAccount={handleSwitchAccount}
                    onBackToOverview={() => setActiveTab('overview')}
                  />
                ))}

              {activeTab === 'settings' && (
                <SettingsTab
                  officer={officer}
                  onUpdateOfficer={handleUpdateOfficer}
                  backendStatus={backendStatus}
                  theme={theme}
                  onSetTheme={handleSetTheme}
                />
              )}
            </>
          ) : (
            <div role="status" className="p-6">
              Menu chưa được cấp phép hoặc đang tải cấu hình từ máy chủ.
            </div>
          )}
        </main>

        {/* Mobile Bottom Navigation Bar (Fixed for quick thumb access on phones) */}
        {!isMapFullscreen && (
          <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 flex items-center justify-around shadow-lg">
            <button
              onClick={() => setActiveTab('overview')}
              style={{ display: canOpenMenu('overview') ? undefined : 'none' }}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-w-[56px] ${
                activeTab === 'overview' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutDashboard className={`w-5 h-5 ${activeTab === 'overview' ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className="text-[10px] mt-0.5">Tổng quan</span>
            </button>

            <button
              onClick={() => setActiveTab('area-map')}
              style={{ display: canOpenMenu('area-map') ? undefined : 'none' }}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-w-[56px] ${
                activeTab === 'area-map' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Map className={`w-5 h-5 ${activeTab === 'area-map' ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className="text-[10px] mt-0.5">Sơ đồ</span>
            </button>

            <button
              onClick={() => setActiveTab('households')}
              style={{ display: canOpenMenu('households') ? undefined : 'none' }}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-w-[56px] ${
                activeTab === 'households' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className={`w-5 h-5 ${activeTab === 'households' ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className="text-[10px] mt-0.5">Hộ dân</span>
            </button>

            <button
              onClick={() => setActiveTab('residents')}
              style={{ display: canOpenMenu('residents') ? undefined : 'none' }}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-w-[56px] ${
                activeTab === 'residents' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserCheck className={`w-5 h-5 ${activeTab === 'residents' ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className="text-[10px] mt-0.5">Nhân khẩu</span>
            </button>

            <button
              onClick={() => setActiveTab('documents')}
              style={{ display: canOpenMenu('documents') ? undefined : 'none' }}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-w-[56px] relative ${
                activeTab === 'documents' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className={`w-5 h-5 ${activeTab === 'documents' ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className="text-[10px] mt-0.5">Hồ sơ</span>
              {warningCount > 0 && <span className="absolute top-0.5 right-2 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white" />}
            </button>

            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-w-[56px] text-slate-500 hover:text-slate-800"
            >
              <Menu className="w-5 h-5 text-slate-400" />
              <span className="text-[10px] mt-0.5">Thêm</span>
            </button>
          </nav>
        )}
      </div>

      {/* Modals & Dialogs */}
      {renewingDocument && (
        <RenewDocumentDialog document={renewingDocument} onClose={() => setRenewingDocument(null)} onSave={saveDocumentRenewal} />
      )}
      <HouseholdDetailModal
        presentation={['area-map', 'advanced-map', 'field-3d-map'].includes(activeTab) ? 'drawer' : 'dialog'}
        household={selectedHousehold}
        currentUser={currentUser}
        onClose={() => setSelectedHousehold(null)}
        onUpdateNotes={handleUpdateNotes}
        onHouseholdUpdated={handleUpdateHouseholdFull}
        onDeleteHousehold={handleDeleteHousehold}
        onShowToast={showToast}
      />

      <AddHouseholdModal
        allowedHamletIds={currentUser.role === 'superadmin' ? undefined : (currentUser.hamletIds ?? [])}
        isOpen={isAddModalOpen}
        initialCoordinates={selectedMapCoordinates}
        onClose={() => {
          setIsAddModalOpen(false);
          setSelectedMapCoordinates(null);
        }}
        onAddHousehold={handleAddHousehold}
      />

      <WarningDetailModal
        isOpen={isWarningModalOpen}
        onClose={() => setIsWarningModalOpen(false)}
        households={households}
        onSelectHousehold={setSelectedHousehold}
        securityAlerts={securityAlerts}
        currentUser={currentUser}
        onAlertResolved={alertId => {
          showToast(`Đã hoàn tất xử lý cảnh báo ${alertId} và tạo Audit Log thành công.`);
        }}
        onIpBlacklisted={ip => {
          showToast(`Đã đưa địa chỉ IP ${ip} vào danh sách đen & chặn quyền truy cập!`);
        }}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-slate-700 text-xs font-semibold flex items-center gap-2.5 animate-in slide-in-from-bottom-3 duration-200 max-w-[90vw]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-ping"></span>
          <span className="truncate">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
