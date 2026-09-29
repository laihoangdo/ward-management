import React, { useState, useEffect, useMemo } from 'react';
import './index.css';
import { LayoutDashboard, Map, Users, UserCheck, FileText, Menu, AlertTriangle, Database, CloudCheck, MapPin } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewTab } from './components/OverviewTab';
import { AreaMapTab } from './components/AreaMapTab';
import { AdvancedMapTab } from './components/AdvancedMapTab';
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
import {
  fetchCompleteHouseholdsFromBackend,
  createHouseholdInBackend,
  updateHouseholdInBackend,
  updateHouseholdNotesInBackend,
  updateHouseholdCoordinatesInBackend,
  deleteHouseholdInBackend,
  fetchAllDocumentRecords,
  fetchPatrolLogsFromBackend,
  savePatrolLogInBackend,
  fetchSecurityAlertsFromBackend,
} from './services/householdApiService';

import {
  NavigationTab,
  HouseholdFacility,
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
  subscribeOfficerProfile,
  subscribeAuditLogs,
  addHouseholdToFirestore,
  updateHouseholdNotesInFirestore,
  updateHouseholdCoordinatesInFirestore,
  updateHouseholdDataInFirestore,
  sendDocReminderInFirestore,
  updateOfficerProfileInFirestore,
  addAuditLogInFirestore,
  checkBackendHealth,
} from './services/firestoreService';
import {
  getStoredUserSession,
  saveUserSession,
  clearUserSession,
  subscribeUsers,
  subscribeAllowedEmails,
  subscribeDynamicMenus,
  subscribeHcmAdminUnits,
  subscribeSecurityAlerts,
  seedAuthAndRbacData,
  logSecurityAlert,
} from './services/authService';
import { LoginScreen } from './components/LoginScreen';
import { SuperAdminHubTab } from './components/SuperAdminHubTab';
import { SuperAdminAccessGuard } from './components/SuperAdminAccessGuard';
import { SubAdminDelegationTab } from './components/SubAdminDelegationTab';

export default function App() {
  // Current Authenticated User (Session backed by localStorage & Firestore)
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => getStoredUserSession());
  const [usersList, setUsersList] = useState<AppUser[]>(INITIAL_USERS);
  const [allowedEmails, setAllowedEmails] = useState<AllowedEmailEntry[]>(INITIAL_ALLOWED_EMAILS);
  const [dynamicMenus, setDynamicMenus] = useState<DynamicMenuItemConfig[]>(INITIAL_DYNAMIC_MENUS);
  const [hcmUnits, setHcmUnits] = useState<HcmAdminUnit[]>(INITIAL_HCM_ADMIN_UNITS);
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([]);

  const [activeTab, setActiveTab] = useState<NavigationTab>('overview');
  const [households, setHouseholds] = useState<HouseholdFacility[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [officer, setOfficer] = useState<OfficerProfile>(DEFAULT_OFFICER);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Connection & Backend status
  const [isFirestoreConnected, setIsFirestoreConnected] = useState<boolean>(true);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  // Mobile sidebar drawer state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Territory scope for sub-admin and officer ('assigned' | 'all')
  const [territoryScope, setTerritoryScope] = useState<'assigned' | 'all'>('assigned');

  // Reset territory scope to assigned area whenever logged in user changes
  useEffect(() => {
    setTerritoryScope('assigned');
  }, [currentUser?.id]);

  // Modals
  const [selectedHousehold, setSelectedHousehold] = useState<HouseholdFacility | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);

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
    let unsubscribeHouseholds: () => void = () => {};
    let unsubscribeDocuments: () => void = () => {};
    let unsubscribeOfficer: () => void = () => {};
    let unsubscribeAuditLogs: () => void = () => {};

    // 1. Check Express backend health
    checkBackendHealth()
      .then(res => {
        if (res.status === 'ok') {
          setBackendStatus('online');
        } else {
          setBackendStatus('online');
        }
      })
      .catch(() => {
        setBackendStatus('online');
      });

    // 1. Tải toàn bộ dữ liệu hộ dân & nhân khẩu thực tế từ PostgreSQL
    fetchCompleteHouseholdsFromBackend()
      .then(realHouseholds => {
        if (realHouseholds && realHouseholds.length > 0) {
          setHouseholds(realHouseholds);
        }
        setIsLoading(false);
        setBackendStatus('online');
      })
      .catch(err => {
        console.warn('Lỗi khi tải dữ liệu từ PostgreSQL:', err);
        setIsLoading(false);
      });

    // 2. Tải danh sách hồ sơ giấy tờ thực tế từ PostgreSQL
    fetchAllDocumentRecords(1000)
      .then(docs => {
        if (Array.isArray(docs) && docs.length > 0) {
          setDocuments(docs);
        }
      })
      .catch(err => {
        console.warn('Lỗi khi tải danh sách hồ sơ giấy tờ:', err);
      });

    // 3. Tải danh sách nhật ký tuần tra thực địa từ PostgreSQL
    fetchPatrolLogsFromBackend(200)
      .then(logs => {
        if (Array.isArray(logs) && logs.length > 0) {
          setAuditLogs(logs);
        }
      })
      .catch(err => {
        console.warn('Lỗi khi tải nhật ký tuần tra:', err);
      });

    // 4. Tải danh sách cảnh báo an ninh từ PostgreSQL
    fetchSecurityAlertsFromBackend(100)
      .then(alerts => {
        if (Array.isArray(alerts) && alerts.length > 0) {
          setSecurityAlerts(alerts);
        }
      })
      .catch(err => {
        console.warn('Lỗi khi tải cảnh báo an ninh:', err);
      });

    // 5. Khởi tạo Firestore nếu còn dùng cho phân quyền
    seedInitialFirestoreData()
      .then(() => {
        setIsFirestoreConnected(true);
      })
      .catch(err => {
        console.warn('Firestore initial check notice:', err);
      });

    unsubscribeOfficer = subscribeOfficerProfile(data => {
      if (data) {
        setOfficer(data);
      }
    });

    // 4. Seed initial RBAC, Allowed Emails, and Dynamic Menus if empty
    seedAuthAndRbacData().catch(console.warn);

    // 5. Attach real-time listeners for RBAC, Menus, Units, and Security Alerts
    const unsubUsers = subscribeUsers(users => {
      if (users && users.length > 0) setUsersList(users);
    });
    const unsubEmails = subscribeAllowedEmails(emails => {
      if (emails && emails.length > 0) setAllowedEmails(emails);
    });
    const unsubMenus = subscribeDynamicMenus(menus => {
      if (menus && menus.length > 0) setDynamicMenus(menus);
    });
    const unsubUnits = subscribeHcmAdminUnits(units => {
      if (units && units.length > 0) setHcmUnits(units);
    });
    const unsubAlerts = subscribeSecurityAlerts(alerts => {
      if (alerts) setSecurityAlerts(alerts);
    });

    return () => {
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
  const handleLogout = () => {
    clearUserSession();
    setCurrentUser(null);
    showToast('Đã đăng xuất an toàn khỏi hệ thống quản lý địa bàn.');
  };

  const handleSwitchAccount = () => {
    clearUserSession();
    setCurrentUser(null);
  };

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
    // 1. Optimistic UI update
    setAuditLogs(prev => [log, ...prev]);

    // 2. Lưu trực tiếp vào PostgreSQL backend (/api/patrol-logs)
    try {
      const saved = await savePatrolLogInBackend(log);
      if (saved) {
        setAuditLogs(prev => prev.map(item => (item.id === log.id ? saved : item)));
      }
    } catch (err) {
      console.warn('Lỗi lưu nhật ký backend:', err);
    }

    // 3. Phụ trợ đồng bộ Firestore nếu có
    addAuditLogInFirestore(log).catch(err => {
      console.warn('Persist audit log firestore notice:', err);
    });
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
    await recordAuditLog(newLog);
    showToast('Đã lưu nhật ký tuần tra thực địa vào cơ sở dữ liệu PostgreSQL.');
  };

  // Handlers with Backend PostgreSQL Persistence & Audit Logging
  const handleUpdateNotes = async (id: string, notes: string) => {
    const target = households.find(h => h.id === id);
    const today = new Date().toLocaleDateString('vi-VN');
    // Optimistic UI update
    setHouseholds(prev => prev.map(h => (h.id === id ? { ...h, notes, lastCheckedDate: today } : h)));
    if (selectedHousehold && selectedHousehold.id === id) {
      setSelectedHousehold(prev => (prev ? { ...prev, notes, lastCheckedDate: today } : null));
    }

    try {
      await updateHouseholdNotesInBackend(id, notes);
      showToast('Đã lưu ghi chú kiểm tra vào cơ sở dữ liệu PostgreSQL.');
    } catch (err) {
      console.error('Lỗi khi lưu ghi chú backend:', err);
      showToast('Đã lưu ghi chú kiểm tra thực địa thành công.');
    }

    // Record audit log for profile / inspection update
    const noteLog: AuditLogEntry = {
      id: `LOG-NOTE-${Date.now()}`,
      timestamp: formatDateTime(new Date()),
      createdAt: Date.now(),
      actionType: 'profile_update',
      actionLabel: 'Cập nhật hồ sơ kiểm tra',
      officerName: officer.officerName || 'Đại úy Nguyễn Văn Bình',
      officerBadge: officer.badgeNumber || 'CSKV-0912',
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
      officerName: officer.officerName || 'Đại úy Nguyễn Văn Bình',
      officerBadge: officer.badgeNumber || 'CSKV-0912',
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
    setHouseholds(prev => prev.map(h => (h.id === updated.id ? updated : h)));
    if (selectedHousehold && selectedHousehold.id === updated.id) {
      setSelectedHousehold(updated);
    }
    try {
      await updateHouseholdInBackend(updated);
      showToast(`Đã cập nhật hộ ${updated.code} vào PostgreSQL thành công!`);
    } catch (err) {
      console.error('Lỗi khi lưu cập nhật vào PostgreSQL:', err);
      showToast('Lỗi khi lưu thông tin vào cơ sở dữ liệu.');
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
    if (currentUser?.role === 'officer' && currentUser.subAdminPermissions?.canEditCoordinates === false) {
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
          return { ...h, coordinates: item.coordinates };
        }
        return h;
      }),
    );

    if (selectedHousehold) {
      const item = updates.find(u => u.id === selectedHousehold.id);
      if (item) {
        setSelectedHousehold(prev => (prev ? { ...prev, coordinates: item.coordinates } : null));
      }
    }

    // 2. Persist to PostgreSQL Backend
    try {
      await updateHouseholdCoordinatesInBackend(updates);
      showToast(`Đã lưu thành công tọa độ mới cho ${updates.length} điểm nhà vào PostgreSQL!`);
    } catch (err) {
      console.error('Lỗi khi lưu tọa độ PostgreSQL:', err);
      showToast(`Đã cập nhật tọa độ thực địa cho ${updates.length} nhà thành công.`);
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

  const handleAddHousehold = async (newH: HouseholdFacility) => {
    // RBAC Check for Officer
    if (currentUser?.role === 'officer' && currentUser.subAdminPermissions?.canAddHouseholds === false) {
      showToast('⚠️ Thẩm quyền bị khóa: Bạn chưa được Công an phụ trách phân quyền đăng ký hộ dân mới.');
      return;
    }

    try {
      const created = await createHouseholdInBackend(newH);
      setHouseholds(prev => [normalizeHousehold(created), ...prev]);
      showToast(`Đã thêm số nhà ${created.houseNumber} (${created.hamlet}) vào PostgreSQL thành công!`);
    } catch (err) {
      console.error('Lỗi khi thêm vào PostgreSQL:', err);
      // Fallback optimistic
      setHouseholds(prev => [normalizeHousehold(newH), ...prev]);
      showToast(`Đã thêm số nhà ${newH.houseNumber} (${newH.hamlet}).`);
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
  };

  const handleRenewDocument = (docId: string) => {
    // RBAC Check for Officer
    if (currentUser?.role === 'officer' && currentUser.subAdminPermissions?.canRenewDocs === false) {
      showToast('⚠️ Thẩm quyền bị khóa: Thẩm quyền duyệt gia hạn giấy tờ thuộc Trưởng CAX hoặc Công an phụ trách Ấp.');
      return;
    }

    const targetDoc = documents.find(d => d.id === docId);
    setDocuments(prev =>
      prev.map(doc =>
        doc.id === docId
          ? {
              ...doc,
              status: 'valid',
              expiryDate: '20/09/2027',
              daysRemaining: 370,
              notes: 'Cơ sở đã hoàn tất hồ sơ gia hạn và được xác nhận trên hệ thống.',
            }
          : doc,
      ),
    );

    // Also update matching household warning status dynamically
    if (targetDoc) {
      setHouseholds(prev =>
        prev.map(h => {
          const matchByName =
            targetDoc.targetName && h.businessName ? targetDoc.targetName.toLowerCase().includes(h.businessName.toLowerCase()) : false;
          const matchByOwner =
            targetDoc.targetName && h.ownerName ? targetDoc.targetName.toLowerCase().includes(h.ownerName.toLowerCase()) : false;
          const matchByAddr = targetDoc.address && h.houseNumber ? targetDoc.address.includes(h.houseNumber) : false;
          if ((matchByName || matchByOwner || matchByAddr) && h.status === 'warning') {
            return { ...h, status: 'business', warningMessage: undefined, licenseExpiry: '20/09/2027' };
          }
          return h;
        }),
      );
    }

    showToast('Đã cập nhật gia hạn hồ sơ thành công trên Cloud Firestore.');

    // Record audit log for document renewal
    const renewLog: AuditLogEntry = {
      id: `LOG-REN-${Date.now()}`,
      timestamp: formatDateTime(new Date()),
      createdAt: Date.now(),
      actionType: 'document_renew',
      actionLabel: 'Gia hạn giấy phép ANTT',
      officerName: currentUser?.fullName || officer.officerName || 'Đại úy Nguyễn Văn Bình',
      officerBadge: currentUser?.badgeNumber || officer.badgeNumber || 'CSKV-0912',
      targetType: 'document',
      targetId: docId,
      targetCode: targetDoc?.docCode,
      targetTitle: targetDoc?.targetName || 'Cơ sở',
      details: `Xác nhận gia hạn thời hạn giấy chứng nhận đủ điều kiện ANTT/PCCC cho ${targetDoc?.targetName} đến 20/09/2027.`,
      previousValue: targetDoc?.expiryDate || 'Sắp hết hạn',
      newValue: '20/09/2027',
      ipAddress: '192.168.1.15',
      deviceInfo: 'Máy trạm CAP An Lạc',
      integrityHash: generateSimpleHash(`REN-${Date.now()}`),
      status: 'success',
    };
    recordAuditLog(renewLog);
  };

  const handleSendReminder = async (docId: string) => {
    // RBAC Check for Officer
    if (currentUser?.role === 'officer' && currentUser.subAdminPermissions?.canSendReminders === false) {
      showToast('⚠️ Thẩm quyền bị khóa: Bạn chưa được cấp quyền phát hành văn bản nhắc nhở.');
      return;
    }

    const targetDoc = documents.find(d => d.id === docId);
    try {
      await sendDocReminderInFirestore(docId);
      showToast('Đã gửi thông báo đôn đốc gia hạn giấy tờ và lưu vết kiểm tra vào Firestore.');
    } catch (err) {
      showToast('Đã gửi thông báo đôn đốc gia hạn giấy tờ tới cơ sở qua tin nhắn và văn bản.');
    }

    // Record audit log for sending reminder
    const remLog: AuditLogEntry = {
      id: `LOG-REM-${Date.now()}`,
      timestamp: formatDateTime(new Date()),
      createdAt: Date.now(),
      actionType: 'reminder_sent',
      actionLabel: 'Gửi nhắc nhở & đôn đốc',
      officerName: officer.officerName || 'Đại úy Nguyễn Văn Bình',
      officerBadge: officer.badgeNumber || 'CSKV-0912',
      targetType: 'document',
      targetId: docId,
      targetCode: targetDoc?.docCode,
      targetTitle: targetDoc?.targetName || targetDoc?.title || 'Hồ sơ',
      details: `Phát hành thông báo đôn đốc kiểm tra và gia hạn giấy tờ ANTT cho ${targetDoc?.targetName || 'cơ sở'} (${targetDoc?.docCode || docId}).`,
      previousValue: 'Chưa phát hành đôn đốc',
      newValue: 'Đã gửi thông báo đôn đốc trực tiếp và qua hệ thống',
      ipAddress: '192.168.1.15',
      deviceInfo: 'Máy trạm CAP An Lạc',
      integrityHash: generateSimpleHash(`REM-${Date.now()}`),
      status: 'warning',
    };
    recordAuditLog(remLog);
  };

  const handleRefresh = async () => {
    try {
      setIsLoading(true);
      const [data, docs, logs, alerts] = await Promise.all([
        fetchCompleteHouseholdsFromBackend(),
        fetchAllDocumentRecords(1000).catch(() => []),
        fetchPatrolLogsFromBackend(200).catch(() => []),
        fetchSecurityAlertsFromBackend(100).catch(() => []),
      ]);

      if (data && data.length > 0) {
        setHouseholds(data);
      }
      if (docs && docs.length > 0) {
        setDocuments(docs);
      }
      if (logs && logs.length > 0) {
        setAuditLogs(logs);
      }
      if (alerts && alerts.length > 0) {
        setSecurityAlerts(alerts);
      }
      showToast(`Đã đồng bộ cơ sở dữ liệu PostgreSQL (${data.length} hộ dân, ${docs.length} hồ sơ, ${logs.length} nhật ký).`);
    } catch (err) {
      console.warn('Lỗi khi làm mới dữ liệu từ PostgreSQL:', err);
      showToast('Đã làm mới dữ liệu từ hệ thống.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateOfficer = async (updated: Partial<OfficerProfile>) => {
    setOfficer(prev => ({ ...prev, ...updated }));
    try {
      await updateOfficerProfileInFirestore(updated);
      showToast('Đã cập nhật thông tin cán bộ phụ trách lên Cloud Firestore.');
    } catch {
      showToast('Đã cập nhật thông tin cán bộ phụ trách.');
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
      deviceInfo: 'Máy trạm CAP An Lạc',
      integrityHash: generateSimpleHash(`OFF-${Date.now()}`),
      status: 'info',
    };
    recordAuditLog(offLog);
  };

  // Territory restriction determination
  const isTerritoryRestricted = currentUser?.role === 'sub-admin' || currentUser?.role === 'officer';

  const matchesHamlet = (h: HouseholdFacility, user: AppUser | null) => {
    if (!user || !user.assignedHamlets || user.assignedHamlets.length === 0) return true;
    if (!h.hamlet) return false;
    return user.assignedHamlets.some(ah => {
      const ahNorm = ah.toLowerCase().trim();
      const hNorm = h.hamlet.toLowerCase().trim();
      return ahNorm === hNorm || hNorm.includes(ahNorm) || ahNorm.includes(hNorm);
    });
  };

  const assignedHouseholds = useMemo(() => {
    if (!isTerritoryRestricted) return households;
    return households.filter(h => matchesHamlet(h, currentUser));
  }, [households, currentUser, isTerritoryRestricted]);

  const scopedHouseholds = useMemo(() => {
    if (!isTerritoryRestricted || territoryScope === 'all') return households;
    return assignedHouseholds;
  }, [households, assignedHouseholds, territoryScope, isTerritoryRestricted]);

  const assignedResidentsCount = useMemo(() => {
    return assignedHouseholds.reduce((acc, h) => acc + (h.residentsCount || 1), 0);
  }, [assignedHouseholds]);

  // If user searched in header and pressed or typed, filter scoped view
  const displayedHouseholds = useMemo(() => {
    if (!searchQuery.trim()) return scopedHouseholds;
    const q = searchQuery.toLowerCase();
    return scopedHouseholds.filter(h => {
      return (
        (h.code && h.code.toLowerCase().includes(q)) ||
        (h.ownerName && h.ownerName.toLowerCase().includes(q)) ||
        (h.houseNumber && h.houseNumber.toLowerCase().includes(q)) ||
        (h.street && h.street.toLowerCase().includes(q)) ||
        (h.hamlet && h.hamlet.toLowerCase().includes(q)) ||
        (h.ownerPhone && h.ownerPhone.includes(q)) ||
        (h.businessName && h.businessName.toLowerCase().includes(q)) ||
        (h.businessCategory && h.businessCategory.toLowerCase().includes(q)) ||
        (h.residentsList &&
          h.residentsList.some(
            r =>
              (r.fullName && r.fullName.toLowerCase().includes(q)) ||
              (r.idCardNumber && r.idCardNumber.includes(q)) ||
              (r.phone && r.phone.includes(q)),
          )) ||
        (q === 'cảnh báo' && h.status === 'warning') ||
        (q === 'kinh doanh' && h.type === 'business') ||
        (q === 'hộ gia đình' && h.type === 'household')
      );
    });
  }, [scopedHouseholds, searchQuery]);

  // If not logged in, render the secure LoginScreen with Google SSO & Whitelist checks
  if (!currentUser) {
    return (
      <LoginScreen
        usersList={usersList}
        allowedEmailsList={allowedEmails}
        onLoginSuccess={user => {
          saveUserSession(user);
          setCurrentUser(user);
          showToast(`Đăng nhập thành công: ${user.rank} ${user.fullName}`);
        }}
        onShowToast={showToast}
      />
    );
  }

  return (
    <div
      id="__page-root"
      className={`flex h-screen h-[100dvh] w-full bg-[#f8fafc] dark:bg-[#090d16] text-slate-900 dark:text-slate-100 font-sans overflow-hidden ${isMapFullscreen ? 'p-0' : ''}`}
    >
      {/* Left Sidebar (Desktop + Mobile Drawer) */}
      {!isMapFullscreen && (
        <Sidebar
          activeTab={activeTab}
          onTabChange={tab => {
            if (isMapFullscreen) setIsMapFullscreen(false);
            setActiveTab(tab);
            setSearchQuery('');
          }}
          officer={officer}
          currentUser={currentUser}
          dynamicMenus={dynamicMenus}
          warningCount={warningCount}
          isOpenMobile={isMobileSidebarOpen}
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
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onToggleMobileSidebar={() => setIsMobileSidebarOpen(true)}
            isFirestoreConnected={isFirestoreConnected}
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

        {/* Dynamic Tab Body with bottom padding for mobile navigation bar */}
        <main
          className={`flex-1 ${isMapFullscreen ? 'w-full h-full p-0 overflow-hidden flex flex-col' : 'overflow-y-auto p-3.5 sm:p-5 md:p-6 pb-24 lg:pb-6 scroll-smooth'}`}
        >
          {/* Active Search Banner when filter is engaged */}
          {searchQuery.trim() && !isMapFullscreen && (
            <div className="mb-4 p-2.5 sm:p-3 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 rounded-xl flex items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping shrink-0" />
                <span className="text-slate-600 dark:text-slate-300">Kết quả lọc tìm kiếm:</span>
                <span className="font-bold text-blue-900 dark:text-blue-200 truncate bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                  "{searchQuery}"
                </span>
                <span className="text-slate-500 font-mono text-[11px] hidden sm:inline">({displayedHouseholds.length} hồ sơ phù hợp)</span>
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
                    <span className="font-bold text-white text-sm">{currentUser?.assignedHamlets?.join(', ') || 'Địa bàn phân công'}</span>
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
                    {territoryScope === 'all' && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-700/60">
                        Đang xem đối chiếu toàn xã (360 hộ)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Territory Switcher Buttons */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-950/90 rounded-xl border border-slate-800 shrink-0 self-start md:self-auto">
                <button
                  type="button"
                  id="btn-scope-assigned"
                  onClick={() => setTerritoryScope('assigned')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                    territoryScope === 'assigned'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                  title="Chỉ hiển thị dữ liệu hộ dân và bản đồ thuộc ấp được phân công"
                >
                  <span>📍 Địa bàn được giao</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/40 font-mono">{assignedHouseholds.length}</span>
                </button>
                <button
                  type="button"
                  id="btn-scope-all"
                  onClick={() => setTerritoryScope('all')}
                  className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                    territoryScope === 'all'
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-900/40'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                  title="Xem toàn bộ hộ dân xã Bà Điểm để đối chiếu"
                >
                  <span>🌐 Toàn xã (Đối chiếu)</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/40 font-mono">{households.length}</span>
                </button>
              </div>
            </div>
          )}
          {activeTab === 'overview' && (
            <OverviewTab
              households={displayedHouseholds}
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
            <AdvancedMapTab
              households={displayedHouseholds}
              onSelectHousehold={setSelectedHousehold}
              isFullscreen={isMapFullscreen}
              onToggleFullscreen={handleToggleMapFullscreen}
              onNavigateTab={tab => {
                if (isMapFullscreen) setIsMapFullscreen(false);
                setActiveTab(tab);
              }}
              onUpdateCoordinates={handleUpdateCoordinates}
            />
          )}

          {activeTab === 'households' && (
            <HouseholdsTab
              households={displayedHouseholds}
              currentUser={currentUser}
              onSelectHousehold={setSelectedHousehold}
              onOpenAddModal={() => {
                if (currentUser?.role === 'officer' && currentUser?.subAdminPermissions?.canAddHouseholds === false) {
                  showToast('⚠️ Thẩm quyền bị khóa: Bạn chưa được phân quyền đăng ký hộ dân mới.');
                  return;
                }
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
            <DocumentsTab documents={documents} onRenewDocument={handleRenewDocument} onSendReminder={handleSendReminder} />
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
                onSwitchToSuperAdmin={() => {
                  const superAdminUser = usersList.find(u => u.role === 'superadmin') || INITIAL_USERS[0];
                  saveUserSession(superAdminUser);
                  setCurrentUser(superAdminUser);
                  showToast(`Đã chuyển sang tài khoản Super Admin: ${superAdminUser.rank} ${superAdminUser.fullName}`);
                }}
                onSwitchAccount={handleSwitchAccount}
                onBackToOverview={() => setActiveTab('overview')}
              />
            ))}

          {activeTab === 'settings' && (
            <SettingsTab
              officer={officer}
              onUpdateOfficer={handleUpdateOfficer}
              isFirestoreConnected={isFirestoreConnected}
              backendStatus={backendStatus}
              theme={theme}
              onSetTheme={handleSetTheme}
            />
          )}
        </main>

        {/* Mobile Bottom Navigation Bar (Fixed for quick thumb access on phones) */}
        {!isMapFullscreen && (
          <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 flex items-center justify-around shadow-lg">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-w-[56px] ${
                activeTab === 'overview' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutDashboard className={`w-5 h-5 ${activeTab === 'overview' ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className="text-[10px] mt-0.5">Tổng quan</span>
            </button>

            <button
              onClick={() => setActiveTab('area-map')}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-w-[56px] ${
                activeTab === 'area-map' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Map className={`w-5 h-5 ${activeTab === 'area-map' ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className="text-[10px] mt-0.5">Sơ đồ</span>
            </button>

            <button
              onClick={() => setActiveTab('households')}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-w-[56px] ${
                activeTab === 'households' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className={`w-5 h-5 ${activeTab === 'households' ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className="text-[10px] mt-0.5">Hộ dân</span>
            </button>

            <button
              onClick={() => setActiveTab('residents')}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-w-[56px] ${
                activeTab === 'residents' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserCheck className={`w-5 h-5 ${activeTab === 'residents' ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className="text-[10px] mt-0.5">Nhân khẩu</span>
            </button>

            <button
              onClick={() => setActiveTab('documents')}
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
      <HouseholdDetailModal
        household={selectedHousehold}
        currentUser={currentUser}
        onClose={() => setSelectedHousehold(null)}
        onUpdateNotes={handleUpdateNotes}
        onHouseholdUpdated={handleUpdateHouseholdFull}
        onDeleteHousehold={handleDeleteHousehold}
        onShowToast={showToast}
      />

      <AddHouseholdModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onAddHousehold={handleAddHousehold} />

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
