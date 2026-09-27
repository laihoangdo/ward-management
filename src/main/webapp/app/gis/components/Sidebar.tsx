import React from 'react';
import {
  LayoutDashboard,
  Map,
  Satellite,
  Users,
  FileText,
  Building2,
  Settings,
  ShieldCheck,
  MapPin,
  History,
  LogOut,
  ShieldAlert,
  Crown,
  Grid,
  RefreshCw,
  UserCheck,
} from 'lucide-react';
import { NavigationTab, OfficerProfile, AppUser, DynamicMenuItemConfig } from '../types';
import { INITIAL_DYNAMIC_MENUS } from '../data/initialAuthData';

interface SidebarProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  officer: OfficerProfile;
  currentUser: AppUser;
  dynamicMenus: DynamicMenuItemConfig[];
  warningCount: number;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  onLogout: () => void;
  onSwitchAccount: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  officer,
  currentUser,
  dynamicMenus,
  warningCount,
  isOpenMobile = false,
  onCloseMobile,
  onLogout,
  onSwitchAccount,
}) => {
  // Map icon names to icon components
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    overview: LayoutDashboard,
    'area-map': Map,
    'advanced-map': Grid,
    households: Users,
    residents: UserCheck,
    documents: FileText,
    areas: Building2,
    logs: History,
    'subadmin-delegation': ShieldAlert,
    'superadmin-hub': Crown,
    settings: Settings,
  };

  // Ensure default menus like 'residents' are present even if dynamicMenus from older Firestore cache was missing it
  const effectiveMenus = React.useMemo(() => {
    const list = [...dynamicMenus];
    if (!list.some(m => m.id === 'residents')) {
      const defResidents = INITIAL_DYNAMIC_MENUS.find(m => m.id === 'residents');
      if (defResidents) {
        // Insert right after households (or at index 4)
        const hhIdx = list.findIndex(m => m.id === 'households');
        if (hhIdx >= 0) {
          list.splice(hhIdx + 1, 0, defResidents);
        } else {
          list.push(defResidents);
        }
      }
    }
    return list;
  }, [dynamicMenus]);

  // Filter menus based on dynamic configuration and user's role
  const visibleMenus = effectiveMenus.filter(item => {
    // Special case: Always display superadmin-hub for direct access or elevation
    if (item.id === 'superadmin-hub') {
      return true;
    }

    // Check role inclusion
    const roleAllowed = item.visibleRoles.includes(currentUser.role);
    if (!roleAllowed) return false;

    // If officer, check if subordinate feature permission is required
    if (currentUser.role === 'officer' && item.requiredPermission && currentUser.subAdminPermissions) {
      return currentUser.subAdminPermissions[item.requiredPermission] !== false;
    }
    return true;
  });

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
          label: 'SUPER ADMIN (TỐI CAO)',
          bg: 'bg-red-950/80 text-red-300 border-red-700/60',
          indicator: 'bg-red-500',
        };
      case 'admin':
        return {
          label: 'TRƯỞNG CÔNG AN XÃ',
          bg: 'bg-amber-950/80 text-amber-300 border-amber-700/60',
          indicator: 'bg-amber-500',
        };
      case 'sub-admin':
        return {
          label: 'CÔNG AN PHỤ TRÁCH ẤP',
          bg: 'bg-blue-950/80 text-blue-300 border-blue-700/60',
          indicator: 'bg-blue-500',
        };
      case 'officer':
      default:
        return {
          label: 'CÔNG AN VIÊN ĐỊA BÀN',
          bg: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60',
          indicator: 'bg-emerald-500',
        };
    }
  };

  const roleInfo = getRoleBadge();

  const sidebarContent = (
    <div className="flex flex-col h-full w-full bg-[#0f172a] text-slate-100 select-none">
      {/* Brand Header */}
      <div className="p-4 sm:p-5 border-b border-slate-800 bg-[#0a0f1d]/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-red-600 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-red-600/30 shrink-0">
            <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div id="brand-name" className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-1.5">
              🛡 QLĐB AN NINH
            </div>
            <div id="brand-subtitle" className="text-[10px] sm:text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
              CATP. HỒ CHÍ MINH • AN LẠC
            </div>
          </div>
        </div>

        {/* Mobile close button */}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Đóng menu"
          >
            ✕
          </button>
        )}
      </div>

      {/* User Account Card with Role & Status */}
      <div id="account-card" className="p-3 sm:p-4 mx-3 my-2.5 rounded-xl bg-slate-850/90 border border-slate-750 shadow-md">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className={`inline-block text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase mb-1 ${roleInfo.bg}`}>
              {roleInfo.label}
            </span>
            <div id="officer-name" className="text-xs font-bold text-white leading-tight truncate">
              {currentUser.rank} {currentUser.fullName}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 truncate">{currentUser.position}</div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition shrink-0"
            title="Đăng xuất khỏi hệ thống"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-2 pt-2 border-t border-slate-750 flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${roleInfo.indicator} animate-pulse`} />
            <span className="text-slate-300 font-mono">SH: {currentUser.badgeNumber}</span>
          </div>
          <button
            type="button"
            onClick={onSwitchAccount}
            className="text-[10px] text-amber-400 hover:underline flex items-center gap-1"
            title="Chuyển tài khoản khác"
          >
            <RefreshCw className="w-2.5 h-2.5" />
            Đổi tài khoản
          </button>
        </div>

        {/* Assigned Ward / Hamlets */}
        <div className="mt-1.5 text-[10px] text-slate-400 truncate">
          📍 {currentUser.assignedWard} {currentUser.assignedHamlets?.length > 0 ? `(${currentUser.assignedHamlets.join(', ')})` : ''}
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-1 space-y-1 overflow-y-auto">
        <div className="px-3 py-1 text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span>Menu Điều Hành</span>
          <span className="text-[10px] text-slate-500 font-mono">{visibleMenus.length} mục</span>
        </div>
        {visibleMenus.map(item => {
          const Icon = iconMap[item.id] || LayoutDashboard;
          const isActive = activeTab === item.id;
          const isSpecial = item.id === 'superadmin-hub' || item.id === 'subadmin-delegation';
          const badgeVal = item.id === 'overview' || item.id === 'documents' ? warningCount : undefined;

          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => handleSelect(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-150 min-h-[42px] cursor-pointer ${
                isActive
                  ? item.id === 'superadmin-hub'
                    ? 'bg-red-700 text-white shadow-md shadow-red-700/30'
                    : item.id === 'subadmin-delegation'
                      ? 'bg-blue-700 text-white shadow-md shadow-blue-700/30'
                      : 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : isSpecial
                    ? 'text-amber-300 hover:bg-slate-800/80 bg-slate-900/40 border border-slate-800/60'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : isSpecial ? 'text-amber-400' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </div>
              {item.id === 'superadmin-hub' && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-red-900/60 text-red-300 border border-red-700/60 shrink-0">
                  SUPER
                </span>
              )}
              {badgeVal !== undefined && badgeVal > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                    isActive ? 'bg-amber-400 text-amber-950' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  {badgeVal}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer Status */}
      <div className="p-3 sm:p-4 border-t border-slate-800 bg-[#0a0f1d]/80 text-xs">
        <div className="flex items-center justify-between">
          <span id="sidebar-status" className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[10px] sm:text-[11px]">
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            Hệ thống an ninh trực tuyến
          </span>
          <span className="text-[10px] text-slate-400 font-mono">v2.5.0-RBAC</span>
        </div>
        <div className="mt-1 text-[10px] text-slate-400">Công an P. An Lạc • (028) 3875 0272</div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-72 h-full shrink-0 border-r border-slate-800 overflow-hidden">{sidebarContent}</aside>

      {/* Mobile Drawer Backdrop & Panel */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            onClick={onCloseMobile}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          />

          {/* Drawer Panel */}
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
