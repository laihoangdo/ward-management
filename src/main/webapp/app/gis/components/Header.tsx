import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Search, RefreshCw, Menu, X, Sun, Moon, Mic, Bell, PanelLeftClose, PanelLeftOpen, HelpCircle, Home } from 'lucide-react';
import { NavigationTab, AppUser } from '../types';
import { VoiceSearchModal } from './VoiceSearchModal';

interface HeaderProps {
  activeTab: NavigationTab;
  /** Label of the open menu, as the sidebar shows it. */
  title?: string;
  warningCount: number;
  onOpenWarnings: () => void;
  onRefresh: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onToggleMobileSidebar?: () => void;
  onToggleDesktopSidebar?: () => void;
  isDesktopSidebarOpen?: boolean;
  backendStatus?: 'checking' | 'online' | 'offline';
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onTabChange?: (tab: NavigationTab) => void;
  currentUser?: AppUser;
  /** Kept for callers; sign-out lives in the sidebar account block. */
  onLogout?: () => void;
  isRefreshing?: boolean;
  onOpenGuide?: () => void;
}

const FALLBACK_TITLES: Partial<Record<NavigationTab, string>> = {
  overview: 'Tổng quan & thống kê',
  'area-map': 'Bản đồ số hóa khu vực',
  'field-3d-map': 'Bản đồ 3D',
  'bando-3d': 'Bản đồ 3D',
  households: 'Danh sách hộ dân',
  residents: 'Quản lý nhân khẩu',
  subjects: 'Quản lý đối tượng',
  facilities: 'Cơ sở kinh doanh & DN',
  guidance: 'Văn bản hướng dẫn CSKV',
  documents: 'Quản lý giấy tờ & ANTT',
  areas: 'Quản lý khu vực & tuyến',
  logs: 'Nhật ký thao tác',
  'subadmin-delegation': 'Phân quyền cán bộ & CAV',
  'superadmin-hub': 'Trung tâm quản trị tối cao',
  settings: 'Cài đặt & tài khoản',
};

const iconButton =
  'h-10 w-10 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center shrink-0 cursor-pointer';

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  title,
  warningCount,
  onOpenWarnings,
  onRefresh,
  searchQuery,
  onSearchChange,
  onToggleMobileSidebar,
  onToggleDesktopSidebar,
  isDesktopSidebarOpen = true,
  backendStatus = 'checking',
  theme = 'light',
  onToggleTheme,
  onTabChange,
  currentUser,
  isRefreshing = false,
  onOpenGuide,
}) => {
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const pad = (n: number) => String(n).padStart(2, '0'); // taste-skill-ignore: đồng hồ thời gian thực
  const clockTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const dayNames = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  const clockDate = `${dayNames[now.getDay()]}, ${now.getDate()} tháng ${now.getMonth() + 1}, ${now.getFullYear()}`;
  const statusText =
    backendStatus === 'online' ? 'Máy chủ trực tuyến' : backendStatus === 'offline' ? 'Mất kết nối máy chủ' : 'Đang kiểm tra máy chủ';

  return (
    <header className="gis-header h-14 bg-white dark:bg-slate-900 border-b border-slate-200/90 dark:border-slate-800 px-2 sm:px-4 lg:px-5 flex items-center justify-between gap-2 sticky top-0 z-20 shrink-0 w-full transition-colors select-none">
      <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
        {onToggleDesktopSidebar && (
          <button
            type="button"
            onClick={onToggleDesktopSidebar}
            aria-label={isDesktopSidebarOpen ? 'Ẩn menu bên trái' : 'Hiện menu bên trái'}
            title={isDesktopSidebarOpen ? 'Ẩn menu bên trái' : 'Hiện menu bên trái'}
            aria-expanded={isDesktopSidebarOpen}
            aria-controls="gis-desktop-sidebar"
            className={`${iconButton} hidden md:flex`}
          >
            {isDesktopSidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
          </button>
        )}
        {onToggleMobileSidebar && (
          <button
            onClick={onToggleMobileSidebar}
            type="button"
            aria-label="Mở menu điều hành"
            className={`${iconButton} md:hidden relative h-11 w-11`}
            title="Mở menu điều hành"
          >
            <Menu className="w-5 h-5" />
            {warningCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" />
            )}
          </button>
        )}

        <Link
          to="/"
          id="btn-header-home"
          title="Quay về Trang chủ Cổng thông tin"
          className="gis-header-home hidden sm:flex items-center gap-1.5 h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-sm transition-colors shrink-0 no-underline"
          style={{ textDecoration: 'none', color: 'var(--gis-text, #172c35)' }}
        >
          <Home aria-hidden="true" className="w-4 h-4 text-[var(--gis-primary,#1c4e3a)] dark:text-emerald-400 shrink-0" />
          <span>Trang chủ</span>
        </Link>

        <div className="min-w-0 flex-1 flex items-center gap-2">
          <h1
            className="gis-header-title text-base sm:text-lg font-bold text-slate-800 dark:text-white leading-tight truncate m-0 p-0"
            style={{ margin: 0, fontWeight: 700 }}
            title={title || FALLBACK_TITLES[activeTab] || 'Quản lý địa bàn'}
          >
            {title || FALLBACK_TITLES[activeTab] || 'Quản lý địa bàn'}
          </h1>
          <span
            role="img"
            aria-label={statusText}
            title={statusText}
            className={`gis-header-connection w-2 h-2 rounded-full shrink-0 ${backendStatus === 'online' ? 'bg-emerald-500' : 'bg-amber-400'}`}
          />
          {currentUser && (
            <span className="hidden 2xl:inline text-xs text-slate-500 dark:text-slate-400 truncate">
              {currentUser.unit || currentUser.assignedWard}
            </span>
          )}
        </div>
      </div>

      <div className="gis-header-actions flex items-center gap-1 sm:gap-2 shrink-0">
        <div className="gis-header-search relative hidden md:block w-48 lg:w-64 xl:w-80 shrink-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            aria-label="Tìm hộ dân, số nhà hoặc số điện thoại"
            placeholder="Tìm hộ dân: tên, số nhà, SĐT…"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape' && searchQuery) {
                e.preventDefault();
                onSearchChange('');
              }
            }}
            className="w-full h-10 pl-9 pr-16 text-sm bg-slate-50/90 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-emerald-700 focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-white placeholder-slate-500 transition-colors"
          />
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Xóa tìm kiếm"
                className="h-8 w-8 flex items-center justify-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded-md transition-colors cursor-pointer"
                title="Xóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              id="btn-header-voice-search-desktop"
              onClick={() => setIsVoiceModalOpen(true)}
              aria-label="Tìm kiếm bằng giọng nói"
              title="Tìm kiếm bằng giọng nói Tiếng Việt"
              className="h-8 w-8 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 rounded-md transition-colors cursor-pointer"
            >
              <Mic className="w-4 h-4" />
            </button>
          </div>
        </div>

        <button
          type="button"
          aria-expanded={isMobileSearchOpen}
          aria-controls="gis-mobile-search"
          aria-label="Tìm kiếm nhanh"
          onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
          className={`gis-header-mobile-search-toggle md:hidden h-11 w-11 rounded-lg border transition-colors flex items-center justify-center cursor-pointer shrink-0 ${
            isMobileSearchOpen || searchQuery
              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700'
          }`}
          title="Tìm kiếm nhanh"
        >
          <Search className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label="Cập nhật dữ liệu"
          title="Làm mới dữ liệu địa bàn"
          className={`${iconButton} hidden sm:flex`}
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'opacity-50' : ''}`} />
        </button>

        {onOpenGuide && (
          <button
            type="button"
            id="btn-header-feature-guide"
            onClick={onOpenGuide}
            aria-label="Hướng dẫn sử dụng"
            title="Cẩm nang hướng dẫn sử dụng các chức năng"
            className={`${iconButton} hidden sm:flex`}
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        )}

        <div
          className="gis-clock flex-col items-end justify-center shrink-0 px-1 leading-tight text-right select-none"
          aria-label={`${clockTime}, ${clockDate}`}
          role="timer"
        >
          <span className="font-semibold tabular-nums text-base leading-none text-slate-900 dark:text-white">{clockTime}</span>
          <span className="hidden lg:block text-xs font-medium text-slate-600 dark:text-slate-400 mt-0.5 whitespace-nowrap">
            {clockDate}
          </span>
        </div>

        {onToggleTheme && (
          <button
            type="button"
            id="btn-toggle-dark-mode"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            title={theme === 'dark' ? 'Chuyển sang Chế độ Sáng (Ban ngày)' : 'Chuyển sang Chế độ Tối (Ban đêm)'}
            className={`${iconButton} hidden sm:flex`}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        )}

        <button
          type="button"
          onClick={onOpenWarnings}
          aria-label={`Thông báo và cảnh báo (${warningCount})`}
          title={`Thông báo & Cảnh báo an ninh địa bàn (${warningCount})`}
          className={`${iconButton} relative h-11 w-11 sm:h-10 sm:w-10`}
        >
          <Bell className={`w-4 h-4 shrink-0 ${warningCount > 0 ? 'text-amber-600 dark:text-amber-300' : ''}`} />
          {warningCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-xs font-bold tabular-nums rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900 leading-none">
              {warningCount > 99 ? '99+' : warningCount}
            </span>
          )}
        </button>
      </div>

      {/* Mobile Expandable Search Dropdown */}
      {isMobileSearchOpen && (
        <div
          id="gis-mobile-search"
          className="absolute top-full left-0 right-0 bg-white dark:bg-slate-900 p-3 border-b border-slate-200 dark:border-slate-800 md:hidden z-30 animate-in slide-in-from-top-2 duration-150"
        >
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              aria-label="Tìm hộ dân, số nhà hoặc số điện thoại"
              autoFocus
              placeholder="Tìm theo tên chủ hộ, số nhà, SĐT..."
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setIsMobileSearchOpen(false);
                }
              }}
              className="w-full h-11 pl-9 pr-20 text-base bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-emerald-700 focus:bg-white text-slate-800 dark:text-white"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Xóa tìm kiếm"
                  onClick={() => onSearchChange('')}
                  className="h-9 w-9 flex items-center justify-center text-slate-500 hover:text-slate-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsVoiceModalOpen(true)}
                className="h-9 w-9 flex items-center justify-center text-slate-500 hover:text-slate-800 rounded-md transition-colors"
                title="Bấm để nói"
                aria-label="Tìm kiếm bằng giọng nói"
              >
                <Mic className="w-4 h-4" aria-hidden="true" />
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
