import React, { useState } from 'react';
import {
  LayoutDashboard,
  Map,
  Users,
  FileText,
  Building2,
  Settings,
  ShieldCheck,
  History,
  LogOut,
  ShieldAlert,
  Crown,
  Grid,
  RefreshCw,
  UserCheck,
  UserSearch,
  Store,
  Boxes,
  MapPin,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  BookOpen,
} from 'lucide-react';
import { Link } from 'react-router';
import { NavigationTab, OfficerProfile, AppUser, DynamicMenuItemConfig } from '../types';
import { DEFAULT_MENUS as INITIAL_DYNAMIC_MENUS } from '../data/defaultMenus';
import { canViewMapTab } from '../utils/mapViewAccess';

interface SidebarProps {
  backendStatus?: 'checking' | 'online' | 'offline';
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  officer: OfficerProfile;
  currentUser: AppUser;
  dynamicMenus: DynamicMenuItemConfig[];
  warningCount: number;
  isOpenMobile?: boolean;
  isOpenDesktop?: boolean;
  onCloseMobile?: () => void;
  onLogout: () => void;
  onSwitchAccount: () => void;
  onOpenGuide?: () => void;
}

/** Assigned territory: a short list is shown in full; a commune-wide list folds behind a count. */
const TerritorySummary: React.FC<{ ward?: string; hamlets: string[] }> = ({ ward, hamlets }) => {
  const label = [ward, hamlets.length > 3 ? `${hamlets.length} ấp được giao` : hamlets.join(', ')].filter(Boolean).join(' · ');
  if (hamlets.length <= 3) return <span className="min-w-0 break-words">{label}</span>;
  return (
    <details className="min-w-0">
      <summary className="cursor-pointer">{label}</summary>
      <p className="m-0 mt-1 break-words">{hamlets.join(', ')}</p>
    </details>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({
  backendStatus = 'checking',
  activeTab,
  onTabChange,
  currentUser,
  dynamicMenus,
  warningCount,
  isOpenMobile = false,
  isOpenDesktop = true,
  onCloseMobile,
  onLogout,
  onSwitchAccount,
  onOpenGuide,
}) => {
  const [isTabletExpanded, setIsTabletExpanded] = useState(false);

  // Map icon names to icon components
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    overview: LayoutDashboard,
    'area-map': Map,
    'advanced-map': Grid,
    'field-3d-map': Boxes,
    'bando-3d': Boxes,
    households: Users,
    residents: UserCheck,
    subjects: UserSearch,
    facilities: Store,
    guidance: BookOpen,
    documents: FileText,
    areas: Building2,
    logs: History,
    'subadmin-delegation': ShieldAlert,
    'superadmin-hub': Crown,
    settings: Settings,
  };

  const effectiveMenus = React.useMemo(() => {
    const list = dynamicMenus.filter(menu => !['spatial-3d-map', 'vietmap-compare', 'advanced-map'].includes(String(menu.id)));
    if (!list.some(m => m.id === 'field-3d-map')) {
      const defF3D = INITIAL_DYNAMIC_MENUS.find(m => m.id === 'field-3d-map');
      if (defF3D) {
        const idxArea = list.findIndex(m => m.id === 'area-map');
        if (idxArea >= 0) list.splice(idxArea + 1, 0, defF3D);
        else list.push(defF3D);
      }
    }
    return list;
  }, [dynamicMenus]);

  // Filter menus based on dynamic configuration and user's role
  const visibleMenus = effectiveMenus.filter(item => {
    if (!canViewMapTab(currentUser, item.id)) return false;
    // Check role inclusion
    const roleAllowed = item.visibleRoles.includes(currentUser.role);
    if (!roleAllowed) return false;

    // If officer, check if subordinate feature permission is required
    if (currentUser.role !== 'superadmin' && item.requiredPermission) {
      return currentUser.subAdminPermissions?.[item.requiredPermission] === true;
    }
    return true;
  });

  const menuGroup = (id: NavigationTab) => {
    if (['overview', 'households', 'residents', 'subjects', 'facilities', 'guidance', 'documents'].includes(id))
      return 'Công việc hằng ngày';
    if (['area-map', 'advanced-map', 'field-3d-map', 'bando-3d', 'areas'].includes(id)) return 'Địa bàn và bản đồ';
    if (id === 'logs') return 'Lịch sử kiểm tra';
    if (id === 'settings') return 'Tài khoản của tôi';
    return 'Quản trị và phân quyền';
  };
  const groups = ['Công việc hằng ngày', 'Địa bàn và bản đồ', 'Lịch sử kiểm tra', 'Quản trị và phân quyền', 'Tài khoản của tôi'];
  // Display order follows daily work, whatever order the server's menu configuration stores.
  const workOrder: string[] = [
    'overview',
    'households',
    'residents',
    'subjects',
    'facilities',
    'documents',
    'guidance',
    'area-map',
    'field-3d-map',
    'bando-3d',
    'advanced-map',
    'areas',
    'logs',
    'subadmin-delegation',
    'superadmin-hub',
    'settings',
  ];
  const rank = (id: NavigationTab) => {
    const i = workOrder.indexOf(id);
    return i < 0 ? workOrder.length : i;
  };
  const groupedMenus = groups.flatMap(group =>
    visibleMenus.filter(menu => menuGroup(menu.id) === group).sort((x, y) => rank(x.id) - rank(y.id)),
  );

  const handleSelect = (id: NavigationTab) => {
    onTabChange(id);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  // Role styling helper
  const getRoleBadge = () => {
    switch (currentUser.role) {
      case 'superadmin':
        return {
          label: 'Quản trị hệ thống',
          bg: 'bg-red-950/80 text-red-300 border-red-700/60',
          indicator: 'bg-red-500',
        };
      case 'admin':
        return {
          label: 'Trưởng Công an xã',
          bg: 'bg-amber-950/80 text-amber-300 border-amber-700/60',
          indicator: 'bg-amber-500',
        };
      case 'sub-admin':
        return {
          label: 'Công an phụ trách ấp',
          bg: 'bg-blue-950/80 text-blue-300 border-blue-700/60',
          indicator: 'bg-blue-500',
        };
      case 'officer':
      default:
        return {
          label: 'Công an viên địa bàn',
          bg: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60',
          indicator: 'bg-emerald-500',
        };
    }
  };

  const roleInfo = getRoleBadge();

  const renderSidebarContent = (isMobileDrawer = false) => (
    <div className="gis-sidebar flex flex-col h-full w-full bg-[var(--gis-sidebar-background,#122e35)] text-[var(--gis-sidebar-text,#f1f7f5)] select-none">
      {/* Brand Header */}
      <div className="gis-sidebar-brand px-3.5 py-3 border-b border-slate-800 flex items-center justify-between gap-2">
        <Link
          to="/dashboard?tab=overview"
          className="gis-sidebar-brand-link flex items-center gap-3 group hover:opacity-90 transition-opacity cursor-pointer min-w-0"
          title="Về Tổng quan"
        >
          <div
            aria-label="Biểu tượng ứng dụng"
            className="gis-brand-icon w-9 h-9 rounded-md flex items-center justify-center text-white shrink-0"
          >
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="gis-sidebar-brand-text min-w-0">
            <div id="brand-name" className="text-sm font-bold text-white flex items-center gap-1.5 transition-colors">
              QLĐB An ninh
            </div>
            <div id="brand-subtitle" className="text-xs font-medium text-slate-400 leading-snug mt-0.5 whitespace-normal break-words">
              {currentUser.unit || currentUser.assignedWard || 'Quản lý địa bàn'}
            </div>
          </div>
        </Link>

        {/* Tablet rail expand/collapse button */}
        {!isMobileDrawer && (
          <button
            type="button"
            aria-label={isTabletExpanded ? 'Thu gọn thanh điều hướng' : 'Mở rộng thanh điều hướng'}
            title={isTabletExpanded ? 'Thu gọn thành thanh biểu tượng' : 'Mở rộng nhãn điều hướng'}
            onClick={() => setIsTabletExpanded(prev => !prev)}
            className="gis-tablet-rail-toggle hidden md:inline-flex xl:hidden h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
          >
            {isTabletExpanded ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </button>
        )}

        {/* Mobile close button */}
        {isMobileDrawer && onCloseMobile && (
          <button
            type="button"
            aria-label="Đóng menu"
            onClick={onCloseMobile}
            className="md:hidden h-11 w-11 flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0"
            title="Đóng menu"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav aria-label="Menu điều hành" className="gis-sidebar-nav flex-1 min-h-0 px-2.5 py-1 space-y-0.5 overflow-y-auto">
        {groupedMenus.map((item, index) => {
          const Icon = iconMap[item.id] || LayoutDashboard;
          const isActive = activeTab === item.id;
          const badgeVal = item.id === 'overview' || item.id === 'documents' ? warningCount : undefined;

          return (
            <React.Fragment key={item.id}>
              {(index === 0 || menuGroup(groupedMenus[index - 1].id) !== menuGroup(item.id)) && (
                <div className="gis-menu-group px-3 pt-3 pb-1 text-xs font-semibold text-slate-400">{menuGroup(item.id)}</div>
              )}
              <button
                type="button"
                aria-current={isActive ? 'page' : undefined}
                id={`nav-${item.id}`}
                title={item.label}
                onClick={() => handleSelect(item.id)}
                className={`gis-nav-item w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 min-h-[44px] cursor-pointer ${
                  isActive
                    ? 'bg-[var(--gis-sidebar-active,#e8f1ec)] text-[var(--gis-on-selected,#153c2c)]'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 text-left">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span className="gis-nav-item-label whitespace-normal break-words leading-snug">{item.label}</span>
                </div>
                {badgeVal !== undefined && badgeVal > 0 && (
                  <span
                    className={`gis-nav-item-badge px-1.5 py-0.5 rounded-full text-xs font-bold tabular-nums shrink-0 ${
                      isActive ? 'bg-amber-400 text-amber-950' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {badgeVal}
                  </span>
                )}
              </button>
            </React.Fragment>
          );
        })}
        {onOpenGuide && (
          <button
            type="button"
            id="sidebar-btn-feature-guide"
            onClick={() => {
              onOpenGuide();
              if (onCloseMobile) onCloseMobile();
            }}
            className="gis-nav-guide gis-nav-item w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 min-h-[44px] cursor-pointer text-slate-300 hover:bg-slate-800 hover:text-white"
            title="Cẩm nang hướng dẫn sử dụng các chức năng"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="gis-nav-item-label truncate">Hướng dẫn sử dụng</span>
            </div>
          </button>
        )}
      </nav>

      {/* Account: one compact block at the foot of the menu (was a tall card above the menu). */}
      <div id="account-card" className="gis-sidebar-footer gis-account-card px-3 py-2.5 border-t border-slate-800 text-xs">
        <div className="gis-account-header flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="gis-account-avatar w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 bg-slate-800 text-emerald-200"
          >
            {(currentUser.fullName || currentUser.username || '?').trim().charAt(0).toUpperCase()}
          </span>
          <div className="gis-account-details min-w-0 flex-1">
            <div
              id="officer-name"
              className="text-sm font-semibold text-white leading-snug truncate"
              title={`${currentUser.rank} ${currentUser.fullName}`.trim()}
            >
              {currentUser.rank} {currentUser.fullName}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 min-w-0">
              <span
                id="sidebar-status"
                aria-label={
                  backendStatus === 'online'
                    ? 'Máy chủ trực tuyến'
                    : backendStatus === 'offline'
                      ? 'Mất kết nối máy chủ'
                      : 'Đang kiểm tra máy chủ'
                }
                title={
                  backendStatus === 'online'
                    ? 'Máy chủ trực tuyến'
                    : backendStatus === 'offline'
                      ? 'Mất kết nối máy chủ'
                      : 'Đang kiểm tra máy chủ'
                }
                className={`h-2 w-2 rounded-full inline-block shrink-0 ${backendStatus === 'online' ? 'bg-emerald-500' : 'bg-amber-400'}`}
              />
              <span className="gis-role-label truncate">{roleInfo.label}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Đăng xuất khỏi hệ thống"
            className="gis-account-logout h-10 w-10 rounded-lg text-slate-400 hover:text-red-300 hover:bg-slate-800 transition-colors shrink-0 flex items-center justify-center"
            title="Đăng xuất khỏi hệ thống"
          >
            <LogOut aria-hidden="true" className="w-4 h-4" />
          </button>
        </div>
        <div className="gis-account-meta mt-1.5 flex items-center justify-between gap-2 text-xs text-slate-400">
          {/* Only facts the profile actually has: no empty "SH:" or bare location pin. */}
          {currentUser.badgeNumber ? (
            <span className="text-slate-300 tabular-nums truncate">Số hiệu: {currentUser.badgeNumber}</span>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onSwitchAccount}
            className="min-h-[36px] px-1 text-xs text-amber-300 hover:underline flex items-center gap-1 shrink-0"
            title="Chuyển tài khoản khác"
          >
            <RefreshCw aria-hidden="true" className="w-3 h-3" />
            Đổi tài khoản
          </button>
        </div>
        {(currentUser.assignedWard || currentUser.assignedHamlets?.length > 0) && (
          <div className="gis-sidebar-territory mt-1 text-xs text-slate-400 flex items-start gap-1.5">
            <MapPin aria-hidden="true" className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <TerritorySummary ward={currentUser.assignedWard} hamlets={currentUser.assignedHamlets ?? []} />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Full Sidebar (>=1280px) & Tablet Navigation Rail (768px-1279px) */}
      {isOpenDesktop && (
        <aside
          id="gis-desktop-sidebar"
          className={`hidden md:flex ${isTabletExpanded ? 'md:w-64 gis-sidebar--tablet-expanded' : 'md:w-[4.5rem] gis-sidebar--rail-tablet'} xl:w-64 h-full shrink-0 border-r border-slate-800 overflow-hidden`}
        >
          {renderSidebarContent(false)}
        </aside>
      )}

      {/* Mobile Drawer Backdrop & Panel (<768px) */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Đóng menu điều hành"
            onClick={onCloseMobile}
            className="fixed inset-0 gis-modal-scrim transition-opacity animate-in fade-in duration-200"
          />

          {/* Drawer Panel */}
          <div className="gis-mobile-drawer relative w-72 max-w-[85vw] h-full z-10 animate-in slide-in-from-left duration-200">
            {renderSidebarContent(true)}
          </div>
        </div>
      )}
    </>
  );
};
