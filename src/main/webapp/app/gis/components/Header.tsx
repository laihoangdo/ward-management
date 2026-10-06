import React, { useState } from 'react';
import { Search, RefreshCw, Shield, AlertTriangle, Menu, X, Sun, Moon, Mic, LogOut, ShieldCheck, UserCheck, Home } from 'lucide-react';
import { Link } from 'react-router';
import { NavigationTab, AppUser } from '../types';
import { VoiceSearchModal } from './VoiceSearchModal';

interface HeaderProps {
  activeTab: NavigationTab;
  warningCount: number;
  onOpenWarnings: () => void;
  onRefresh: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onToggleMobileSidebar?: () => void;
  backendStatus?: 'checking' | 'online' | 'offline';
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onTabChange?: (tab: NavigationTab) => void;
  currentUser?: AppUser;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  warningCount,
  onOpenWarnings,
  onRefresh,
  searchQuery,
  onSearchChange,
  onToggleMobileSidebar,
  backendStatus = 'checking',
  theme = 'light',
  onToggleTheme,
  onTabChange,
  currentUser,
  onLogout,
}) => {
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  const getTabTitle = () => {
    switch (activeTab) {
      case 'overview':
        return 'Tổng Quan An Ninh Địa Bàn';
      case 'area-map':
        return 'Sơ Đồ Địa Bàn Tương Tác';
      case 'advanced-map':
        return currentUser?.assignedWard ? `Bản Đồ Nâng Cao ${currentUser.assignedWard}` : 'Bản Đồ Nâng Cao Địa Bàn';
      case 'households':
        return 'Dữ Liệu Hộ Dân & Cơ Sở';
      case 'residents':
        return 'Quản Lý Nhân Khẩu & Định Danh';
      case 'documents':
        return 'Hồ Sơ & Giấy Tờ An Ninh';
      case 'areas':
        return 'Phân Quyền & Tuyến Quản Lý';
      case 'logs':
        return 'Nhật Ký Thao Tác & Minh Bạch Quản Lý';
      case 'subadmin-delegation':
        return 'Phân Quyền Tính Năng Cho Công An Viên';
      case 'superadmin-hub':
        return 'Trung Tâm Quản Trị Hệ Thống Tối Cao';
      case 'settings':
        return 'Cài Đặt & Tài Khoản CSKV';
      default:
        return 'Hệ Thống Quản Lý Địa Bàn';
    }
  };

  return (
    <header className="h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800 px-2.5 sm:px-4 lg:px-5 flex items-center justify-between sticky top-0 z-20 shadow-xs shrink-0 w-full transition-colors select-none">
      {/* Title / Hamburger menu / Home button */}
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 shrink-0">
        {/* Mobile/Tablet Hamburger Toggle Button */}
        {onToggleMobileSidebar && (
          <button
            onClick={onToggleMobileSidebar}
            className="lg:hidden h-9 w-9 text-slate-700 dark:text-slate-200 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors relative flex items-center justify-center shrink-0 cursor-pointer"
            title="Mở menu điều hành"
          >
            <Menu className="w-4 h-4 text-slate-700 dark:text-slate-200" />
            {warningCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" />
            )}
          </button>
        )}

        {/* Nút Về Trang Chủ (Home Portal) */}
        <Link
          to="/"
          id="btn-header-home"
          title="Quay về Trang chủ Cổng thông tin Monolithic"
          className="flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-lg border border-slate-200/90 dark:border-slate-700 bg-slate-50 hover:bg-blue-50/80 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-300 font-semibold text-xs transition-colors shadow-xs shrink-0 cursor-pointer no-underline"
          style={{ textDecoration: 'none' }}
        >
          <Home className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="hidden sm:inline">Trang chủ</span>
        </Link>

        {/* Shield Icon */}
        <div className="hidden sm:flex w-8 h-8 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 items-center justify-center border border-blue-500/20 shrink-0">
          <Shield className="w-4 h-4" />
        </div>

        {/* Module Title & Breadcrumb */}
        <div className="min-w-0 pr-1">
          <h1
            className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white leading-tight truncate m-0 p-0"
            style={{ fontSize: '13.5px', lineHeight: '18px', margin: 0, fontWeight: 700 }}
          >
            {getTabTitle()}
          </h1>
          <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 hidden xs:flex items-center gap-1.5 truncate leading-tight mt-0.5">
            <span className="hidden md:inline font-medium">
              {currentUser?.unit || (currentUser?.assignedWard ? `TP.HCM • ${currentUser.assignedWard}` : 'TP.HCM • Quản lý địa bàn')}
            </span>
            <span className="hidden md:inline text-slate-300 dark:text-slate-600">•</span>
            <span className="text-blue-600 dark:text-blue-400 font-semibold">{new Date().toLocaleDateString('vi-VN')}</span>
          </div>
        </div>
      </div>

      {/* Action shortcuts & Search */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Desktop & Tablet Quick Search with Voice Search trigger */}
        <div className="relative hidden md:block w-36 lg:w-56 xl:w-64 shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm tên, số nhà, SĐT..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full h-9 pl-8 pr-14 text-xs bg-slate-50/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-white placeholder-slate-400 transition-colors"
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition-colors cursor-pointer"
                title="Xóa tìm kiếm"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            <button
              type="button"
              id="btn-header-voice-search-desktop"
              onClick={() => setIsVoiceModalOpen(true)}
              title="Tìm kiếm bằng giọng nói Tiếng Việt"
              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-all cursor-pointer group flex items-center justify-center"
            >
              <Mic className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:text-rose-600 transition-colors" />
            </button>
          </div>
        </div>

        {/* Mobile Dedicated Voice Search Quick Button */}
        <button
          id="btn-header-voice-search-mobile"
          onClick={() => setIsVoiceModalOpen(true)}
          className="md:hidden h-9 w-9 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex items-center justify-center cursor-pointer shrink-0"
          title="Tìm kiếm bằng giọng nói Tiếng Việt"
        >
          <Mic className="w-4 h-4 text-rose-600" />
        </button>

        {/* Mobile Search Toggle Icon */}
        <button
          onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
          className={`md:hidden h-9 w-9 rounded-lg border transition-colors flex items-center justify-center cursor-pointer shrink-0 ${
            isMobileSearchOpen || searchQuery
              ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
              : 'text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700'
          }`}
          title="Tìm kiếm nhanh"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Database & Cloud status badge - ALWAYS single line */}
        <div className="hidden xl:flex items-center gap-1.5 h-9 px-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 text-[11px] font-medium whitespace-nowrap shrink-0">
          <span
            className={`w-2 h-2 rounded-full ${backendStatus === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'} shrink-0`}
          />
          <span className="whitespace-nowrap">
            {backendStatus === 'online'
              ? 'Máy chủ trực tuyến'
              : backendStatus === 'offline'
                ? 'Mất kết nối máy chủ'
                : 'Đang kiểm tra máy chủ'}
          </span>
        </div>

        {/* Quick Nav: Residents Shortcut */}
        {onTabChange && (
          <button
            onClick={() => onTabChange('residents')}
            title="Mở nhanh module Quản lý nhân khẩu & Định danh"
            className={`hidden sm:flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-lg border text-xs font-semibold whitespace-nowrap shrink-0 transition-all shadow-xs cursor-pointer ${
              activeTab === 'residents'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20'
                : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60'
            }`}
          >
            <UserCheck className="w-4 h-4 shrink-0" />
            <span className="hidden md:inline whitespace-nowrap">Nhân khẩu</span>
          </button>
        )}

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          title="Làm mới dữ liệu địa bàn"
          className="h-9 px-2 sm:px-3 text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
          <span className="hidden md:inline whitespace-nowrap">Cập nhật</span>
        </button>

        {/* Dark/Light Mode Toggle Switch */}
        {onToggleTheme && (
          <button
            id="btn-toggle-dark-mode"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Chuyển sang Chế độ Sáng (Ban ngày)' : 'Chuyển sang Chế độ Tối (Ban đêm / Thiếu sáng)'}
            className={`h-9 px-2 sm:px-3 rounded-lg border text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all shadow-xs cursor-pointer ${
              theme === 'dark'
                ? 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-200 hover:text-amber-300'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 hover:text-indigo-600'
            }`}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-amber-400 shrink-0 animate-in spin-in-180 duration-300" />
                <span className="hidden md:inline whitespace-nowrap">Chế độ Sáng</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="hidden md:inline whitespace-nowrap">Chế độ Tối</span>
              </>
            )}
          </button>
        )}

        {/* Urgent Warning notification button */}
        <button
          onClick={onOpenWarnings}
          className={`h-9 px-2 sm:px-3 rounded-lg border text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all shadow-xs cursor-pointer ${
            warningCount > 0
              ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-700 dark:text-amber-300'
              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-750'
          }`}
        >
          <AlertTriangle
            className={`w-4 h-4 shrink-0 ${warningCount > 0 ? 'text-amber-600 dark:text-amber-400 animate-bounce' : 'text-slate-400'}`}
          />
          <span className="hidden xs:inline whitespace-nowrap">Cảnh báo</span>
          {warningCount > 0 && (
            <span className="bg-amber-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold leading-none">
              {warningCount}
            </span>
          )}
        </button>

        {/* Current User Quick Badge & Logout */}
        {currentUser && (
          <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs shrink-0">
              {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="text-right leading-tight min-w-0">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate whitespace-nowrap max-w-[120px]">
                {currentUser.fullName || currentUser.username}
              </div>
              <div className="text-[10px] text-blue-600 dark:text-blue-400 font-mono font-semibold uppercase truncate whitespace-nowrap">
                {currentUser.role === 'superadmin'
                  ? 'Super Admin'
                  : currentUser.role === 'admin'
                    ? 'Trưởng CAX'
                    : currentUser.role === 'sub-admin'
                      ? 'CA Phụ trách Ấp'
                      : 'Công an viên'}
              </div>
            </div>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Mobile Expandable Search Dropdown */}
      {isMobileSearchOpen && (
        <div className="absolute top-14 sm:top-16 left-0 right-0 bg-white dark:bg-slate-900 p-3 border-b border-slate-200 dark:border-slate-800 shadow-md md:hidden z-30 animate-in slide-in-from-top-2 duration-150">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              autoFocus
              placeholder="Tìm theo tên chủ hộ, số nhà, SĐT..."
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-16 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white text-slate-800 dark:text-white"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchQuery && (
                <button type="button" onClick={() => onSearchChange('')} className="text-slate-400 hover:text-slate-600 p-1">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsVoiceModalOpen(true)}
                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-700 rounded-md transition-colors"
                title="Bấm để nói"
              >
                <Mic className="w-4 h-4 text-rose-600" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOICE SEARCH MODAL DIALOG */}
      <VoiceSearchModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onApplySearch={query => {
          onSearchChange(query);
          setIsMobileSearchOpen(false);
        }}
        currentQuery={searchQuery}
        onAutoNavigateHouseholds={() => {
          if (onTabChange && activeTab !== 'households') {
            onTabChange('households');
          }
        }}
      />
    </header>
  );
};
