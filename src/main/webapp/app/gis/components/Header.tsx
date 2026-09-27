import React, { useState } from 'react';
import { Search, RefreshCw, Shield, AlertTriangle, Menu, X, Sun, Moon, Mic, LogOut, ShieldCheck, UserCheck } from 'lucide-react';
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
  isFirestoreConnected?: boolean;
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
  isFirestoreConnected = true,
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
        return 'Bản Đồ Nâng Cao P. An Lạc';
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
    <header className="h-14 sm:h-16 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between sticky top-0 z-20 shadow-xs">
      {/* Title / Hamburger menu for mobile */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile Hamburger Toggle Button */}
        {onToggleMobileSidebar && (
          <button
            onClick={onToggleMobileSidebar}
            className="lg:hidden p-2 text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors relative min-h-[40px] min-w-[40px] flex items-center justify-center"
            title="Mở menu điều hành"
          >
            <Menu className="w-5 h-5 text-slate-700" />
            {warningCount > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white" />}
          </button>
        )}

        <div className="hidden sm:flex w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-blue-50 text-blue-600 items-center justify-center border border-blue-100 shrink-0">
          <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>

        <div className="min-w-0">
          <h1 className="text-xs sm:text-sm font-bold text-slate-800 leading-tight truncate">{getTabTitle()}</h1>
          <div className="text-[10px] sm:text-[11px] text-slate-500 hidden xs:flex items-center gap-1.5 truncate">
            <span className="hidden md:inline">TP.HCM • Bình Tân • An Lạc</span>
            <span className="hidden md:inline">•</span>
            <span className="text-blue-600 font-medium">15/09/2026</span>
          </div>
        </div>
      </div>

      {/* Action shortcuts & Search */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Desktop Quick Search with Voice Search trigger */}
        <div className="relative hidden md:block w-52 lg:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm tên, số nhà, SĐT..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-16 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-colors"
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                title="Xóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              id="btn-header-voice-search-desktop"
              onClick={() => setIsVoiceModalOpen(true)}
              title="Tìm kiếm bằng giọng nói Tiếng Việt (Nói tên chủ hộ, số nhà, cơ sở...)"
              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all cursor-pointer group flex items-center justify-center"
            >
              <Mic className="w-4 h-4 text-slate-500 group-hover:text-rose-600 transition-colors" />
            </button>
          </div>
        </div>

        {/* Mobile Dedicated Voice Search Quick Button */}
        <button
          id="btn-header-voice-search-mobile"
          onClick={() => setIsVoiceModalOpen(true)}
          className="md:hidden p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
          title="Tìm kiếm bằng giọng nói Tiếng Việt"
        >
          <Mic className="w-4 h-4 text-rose-600" />
        </button>

        {/* Mobile Search Toggle Icon */}
        <button
          onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
          className={`md:hidden p-2 rounded-lg border transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center ${
            isMobileSearchOpen || searchQuery
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'text-slate-600 hover:text-blue-600 hover:bg-slate-100 border-slate-200'
          }`}
          title="Tìm kiếm nhanh"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Database & Cloud status badge */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-[11px] font-medium">
          <span className={`w-2 h-2 rounded-full ${isFirestoreConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'} shrink-0`} />
          <span>Firestore DB</span>
        </div>

        {/* Quick Nav: Residents Shortcut */}
        {onTabChange && (
          <button
            onClick={() => onTabChange('residents')}
            title="Mở nhanh module Quản lý nhân khẩu & Định danh"
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs min-h-[40px] cursor-pointer ${
              activeTab === 'residents'
                ? 'bg-blue-600 text-white border-blue-600 shadow-blue-500/20'
                : 'bg-blue-50/80 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
            }`}
          >
            <UserCheck className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Nhân khẩu</span>
          </button>
        )}

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          title="Làm mới dữ liệu địa bàn"
          className="p-2 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors flex items-center gap-1.5 text-xs font-semibold min-h-[40px] cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          <span className="hidden sm:inline">Cập nhật</span>
        </button>

        {/* Dark/Light Mode Toggle Switch */}
        {onToggleTheme && (
          <button
            id="btn-toggle-dark-mode"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Chuyển sang Chế độ Sáng (Ban ngày)' : 'Chuyển sang Chế độ Tối (Ban đêm / Thiếu sáng)'}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs min-h-[40px] cursor-pointer ${
              theme === 'dark'
                ? 'bg-amber-950/40 border-amber-500/50 text-amber-300 hover:bg-amber-950/60'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-indigo-600'
            }`}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-amber-400 shrink-0 animate-in spin-in-180 duration-300" />
                <span className="hidden sm:inline">Chế độ Sáng</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="hidden sm:inline">Chế độ Tối</span>
              </>
            )}
          </button>
        )}

        {/* Urgent Warning notification button */}
        <button
          onClick={onOpenWarnings}
          className={`px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs min-h-[40px] cursor-pointer ${
            warningCount > 0
              ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}
        >
          <AlertTriangle className={`w-4 h-4 shrink-0 ${warningCount > 0 ? 'text-amber-600 animate-bounce' : 'text-slate-400'}`} />
          <span className="hidden xs:inline">Cảnh báo</span>
          {warningCount > 0 && (
            <span className="bg-amber-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">{warningCount}</span>
          )}
        </button>

        {/* Current User Quick Badge & Logout */}
        {currentUser && (
          <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
            <div className="text-right">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                {currentUser.rank} {currentUser.fullName}
              </div>
              <div className="text-[10px] text-blue-600 dark:text-blue-400 font-mono font-semibold uppercase">
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
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition"
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
