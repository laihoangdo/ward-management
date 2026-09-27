import React, { useState, useEffect, useMemo } from 'react';
import {
  Filter,
  RefreshCw,
  RotateCcw,
  AlertTriangle,
  Building,
  Store,
  AlertOctagon,
  CheckCircle2,
  Phone,
  User,
  Users,
  Calendar,
  MapPin,
  Eye,
  FileText,
  Search,
  Maximize2,
  Minimize2,
  Compass,
  Layers,
  Home,
  SlidersHorizontal,
  X,
  Navigation,
} from 'lucide-react';
import { HouseholdFacility, NavigationTab } from '../types';

interface AreaMapTabProps {
  households: HouseholdFacility[];
  onSelectHousehold: (household: HouseholdFacility) => void;
  onRefresh: () => void;
  onNavigateTab?: (tab: NavigationTab) => void;
}

/**
 * Trích xuất hoặc chuẩn hóa Tổ dân phố của hộ dân
 */
export const getHouseholdNeighborhoodGroup = (h: HouseholdFacility): string => {
  if (h.neighborhoodGroup && h.neighborhoodGroup.trim()) {
    return h.neighborhoodGroup.trim();
  }
  if (h.notes && /Tổ\s*\d+/i.test(h.notes)) {
    const match = h.notes.match(/Tổ\s*(\d+)/i);
    if (match) return `Tổ ${match[1]}`;
  }
  // Mặc định phân chia đồng đều theo Ấp và Số nhà
  const num = parseInt(h.houseNumber.replace(/\D/g, '') || '1', 10);
  if (h.hamlet === 'Ấp 1') {
    const groupNum = ((num - 1) % 4) + 1; // Tổ 1 - Tổ 4
    return `Tổ ${groupNum}`;
  } else {
    const groupNum = ((num - 1) % 4) + 5; // Tổ 5 - Tổ 8
    return `Tổ ${groupNum}`;
  }
};

/**
 * Trích xuất hoặc chuẩn hóa Tuyến Hẻm / Vị trí mặt tiền của hộ dân
 */
export const getHouseholdAlley = (h: HouseholdFacility): string => {
  if (h.alley && h.alley.trim()) {
    return h.alley.trim();
  }
  if (h.houseNumber && h.houseNumber.includes('/')) {
    const alleyNum = h.houseNumber.split('/')[0];
    return `Hẻm ${alleyNum} ${h.street || ''}`;
  }
  if (h.street && h.street.toLowerCase().includes('hẻm')) {
    return h.street;
  }
  if (h.notes && /Hẻm\s*\d+/i.test(h.notes)) {
    const match = h.notes.match(/Hẻm\s*(\d+)/i);
    if (match) return `Hẻm ${match[1]} ${h.street || ''}`;
  }
  // Vị trí mặc định
  return `Mặt tiền ${h.street || ''}`;
};

export const AreaMapTab: React.FC<AreaMapTabProps> = ({ households, onSelectHousehold, onRefresh, onNavigateTab }) => {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [onlyWarnings, setOnlyWarnings] = useState<boolean>(false);
  const [selectedHamlet, setSelectedHamlet] = useState<string>('all');
  const [activeStreet, setActiveStreet] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedAlley, setSelectedAlley] = useState<string>('all');
  const [filterMode, setFilterMode] = useState<'all' | 'group' | 'alley'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [inspectedHousehold, setInspectedHousehold] = useState<HouseholdFacility | null>(households[0] || null);

  const hamletList = useMemo(() => {
    return Array.from(new Set(households.map(h => h.hamlet).filter(Boolean))).sort();
  }, [households]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Keep inspected household valid if households change
  useEffect(() => {
    if (!inspectedHousehold && households.length > 0) {
      setInspectedHousehold(households[0]);
    }
  }, [households, inspectedHousehold]);

  const streets = ['all', 'Lê Lợi', 'Nguyễn Văn Cừ', 'Kinh Dương Vương', 'Hồ Học Lãm'];

  // Danh sách Tổ dân phố kèm thống kê số hộ
  const availableGroups = useMemo(() => {
    const map = new Map<string, number>();
    households.forEach(h => {
      if (selectedHamlet !== 'all' && h.hamlet !== selectedHamlet) return;
      const g = getHouseholdNeighborhoodGroup(h);
      map.set(g, (map.get(g) || 0) + 1);
    });

    const list = Array.from(map.entries()).map(([name, count]) => ({
      name,
      count,
    }));

    // Sắp xếp theo số thứ tự Tổ
    list.sort((a, b) => {
      const numA = parseInt(a.name.replace(/\D/g, '') || '0', 10);
      const numB = parseInt(b.name.replace(/\D/g, '') || '0', 10);
      return numA - numB;
    });

    return list;
  }, [households, selectedHamlet]);

  // Danh sách Tuyến Hẻm kèm thống kê số hộ
  const availableAlleys = useMemo(() => {
    const map = new Map<string, number>();
    households.forEach(h => {
      if (selectedHamlet !== 'all' && h.hamlet !== selectedHamlet) return;
      if (activeStreet !== 'all' && h.street !== activeStreet) return;
      const a = getHouseholdAlley(h);
      map.set(a, (map.get(a) || 0) + 1);
    });

    const list = Array.from(map.entries()).map(([name, count]) => ({
      name,
      count,
    }));

    // Đưa 'Mặt tiền' lên trước, sau đó sắp xếp theo tên
    list.sort((a, b) => {
      if (a.name.startsWith('Mặt tiền') && !b.name.startsWith('Mặt tiền')) return -1;
      if (!a.name.startsWith('Mặt tiền') && b.name.startsWith('Mặt tiền')) return 1;
      return a.name.localeCompare(b.name, 'vi');
    });

    return list;
  }, [households, selectedHamlet, activeStreet]);

  // Lọc dữ liệu hộ dân theo các tiêu chí kết hợp
  const filteredHouseholds = useMemo(() => {
    return households.filter(h => {
      if (onlyWarnings && h.status !== 'warning' && h.status !== 'alert') return false;
      if (selectedHamlet !== 'all' && h.hamlet !== selectedHamlet) return false;
      if (activeStreet !== 'all' && h.street !== activeStreet) return false;

      // Lọc theo Tổ dân phố
      if (selectedGroup !== 'all') {
        const group = getHouseholdNeighborhoodGroup(h);
        if (group !== selectedGroup) return false;
      }

      // Lọc theo Hẻm
      if (selectedAlley !== 'all') {
        const alley = getHouseholdAlley(h);
        if (alley !== selectedAlley) return false;
      }

      // Tìm kiếm từ khóa (số nhà, chủ hộ, tổ, hẻm, ghi chú)
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const group = getHouseholdNeighborhoodGroup(h).toLowerCase();
        const alley = getHouseholdAlley(h).toLowerCase();
        const match =
          (h.houseNumber && h.houseNumber.toLowerCase().includes(query)) ||
          (h.ownerName && h.ownerName.toLowerCase().includes(query)) ||
          (h.street && h.street.toLowerCase().includes(query)) ||
          (h.businessName && h.businessName.toLowerCase().includes(query)) ||
          (group && group.includes(query)) ||
          (alley && alley.includes(query)) ||
          (h.code && h.code.toLowerCase().includes(query)) ||
          (h.notes && h.notes.toLowerCase().includes(query));
        if (!match) return false;
      }

      return true;
    });
  }, [households, onlyWarnings, selectedHamlet, activeStreet, selectedGroup, selectedAlley, searchQuery]);

  // Xóa toàn bộ bộ lọc về mặc định
  const handleReset = () => {
    setOnlyWarnings(false);
    setSelectedHamlet('all');
    setActiveStreet('all');
    setSelectedGroup('all');
    setSelectedAlley('all');
    setFilterMode('all');
    setSearchQuery('');
    if (households.length > 0) {
      setInspectedHousehold(households[0]);
    }
  };

  // Tính tỷ lệ giảm bớt dữ liệu để thông báo cho cán bộ
  const reductionPercentage = useMemo(() => {
    if (households.length === 0) return 0;
    const reduced = households.length - filteredHouseholds.length;
    return Math.round((reduced / households.length) * 100);
  }, [households.length, filteredHouseholds.length]);

  const hasActiveFilters =
    selectedHamlet !== 'all' ||
    activeStreet !== 'all' ||
    selectedGroup !== 'all' ||
    selectedAlley !== 'all' ||
    onlyWarnings ||
    searchQuery.trim() !== '';

  const getStatusDetails = (status: string) => {
    switch (status) {
      case 'warning':
        return {
          label: 'Cảnh báo sắp hết hạn',
          badge: 'bg-amber-100 text-amber-900 border-amber-300',
          dot: 'bg-amber-500',
          boxBorder: 'border-amber-400 bg-amber-50/70 hover:bg-amber-100/80',
        };
      case 'alert':
        return {
          label: 'Đối tượng chú ý quản lý',
          badge: 'bg-rose-100 text-rose-900 border-rose-300',
          dot: 'bg-rose-600',
          boxBorder: 'border-rose-400 bg-rose-50/70 hover:bg-rose-100/80',
        };
      case 'business':
        return {
          label: 'Cơ sở kinh doanh có ĐK',
          badge: 'bg-blue-100 text-blue-900 border-blue-300',
          dot: 'bg-blue-600',
          boxBorder: 'border-blue-300 bg-blue-50/70 hover:bg-blue-100/80',
        };
      default:
        return {
          label: 'Bình thường / Hợp lệ',
          badge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
          dot: 'bg-emerald-600',
          boxBorder: 'border-slate-200 bg-white hover:border-slate-300',
        };
    }
  };

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 w-screen h-screen bg-slate-900 text-slate-100 flex flex-col p-3 sm:p-4 overflow-y-auto space-y-4'
          : 'space-y-4 sm:space-y-6 max-w-7xl mx-auto'
      }
    >
      {/* Fullscreen Top Navigation Bar */}
      {isFullscreen && (
        <div className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 shrink-0 text-white shadow-lg">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-xs sm:text-sm text-slate-100">SƠ ĐỒ ĐỊA BÀN DÂN CƯ TƯƠNG TÁC — TOÀN MÀN HÌNH</span>
            <span className="hidden sm:inline-block text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
              {filteredHouseholds.length} / {households.length} vị trí
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateTab && (
              <button
                id="btn-navigate-gis-fullscreen"
                onClick={() => {
                  setIsFullscreen(false);
                  onNavigateTab('advanced-map');
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Mở bản đồ vệ tinh GIS nâng cao"
              >
                <Compass className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Bản đồ GIS nâng cao</span>
              </button>
            )}

            <button
              id="btn-exit-fullscreen"
              onClick={() => setIsFullscreen(false)}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-md cursor-pointer"
              title="Thoát chế độ toàn màn hình (Esc)"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Thoát (Esc)</span>
            </button>
          </div>
        </div>
      )}

      {/* Header Banner */}
      {!isFullscreen && (
        <div className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
            <div>
              <div
                id="map-eyebrow"
                className="text-[11px] sm:text-xs font-bold text-blue-600 tracking-wider uppercase mb-1 flex items-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>BẢN ĐỒ DÂN CƯ & PHÂN VÙNG QUẢN LÝ</span>
              </div>
              <h2 id="map-title" className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Sơ đồ địa bàn tương tác
              </h2>
              <p id="map-description" className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1">
                Lọc nhanh theo Tổ dân phố hoặc Tuyến Hẻm để quan sát khu vực phụ trách rõ nét, loại bỏ dữ liệu dư thừa.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              {/* Toggle Only Warnings */}
              <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors min-h-[40px]">
                <input
                  type="checkbox"
                  id="map-alert-toggle"
                  checked={onlyWarnings}
                  onChange={e => setOnlyWarnings(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                />
                <span id="map-alert-toggle-label" className="text-xs font-semibold text-slate-700">
                  Chỉ hiện cảnh báo
                </span>
              </label>

              {/* Refresh Button */}
              <button
                id="map-refresh-button"
                onClick={onRefresh}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs min-h-[40px] cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Cập nhật</span>
              </button>

              {/* Reset Button */}
              <button
                id="map-reset-button"
                onClick={handleReset}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-colors flex items-center gap-1.5 min-h-[40px] cursor-pointer"
                title="Xóa toàn bộ bộ lọc"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>

              {/* Navigate to GIS Advanced Map */}
              {onNavigateTab && (
                <button
                  id="map-nav-gis-button"
                  onClick={() => onNavigateTab('advanced-map')}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-colors flex items-center gap-1.5 min-h-[40px] cursor-pointer"
                  title="Chuyển sang bản đồ số GIS vệ tinh"
                >
                  <Compass className="w-3.5 h-3.5 text-blue-600" />
                  <span>Bản đồ GIS</span>
                </button>
              )}

              {/* Fullscreen Button */}
              <button
                id="map-fullscreen-button"
                onClick={() => setIsFullscreen(true)}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs min-h-[40px] cursor-pointer"
                title="Xem toàn màn hình"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Toàn màn hình</span>
              </button>
            </div>
          </div>

          <p id="map-help" className="text-[11px] sm:text-xs text-slate-500 mt-2.5 pt-2.5 border-t border-slate-100 italic">
            💡 Sơ đồ phân tổ và hẻm giúp cán bộ CSKV tập trung vào từng cụm dân cư phụ trách mà không bị rối mắt bởi lượng lớn dữ liệu.
          </p>
        </div>
      )}

      {/* Modern Filter Suite: Tổ Dân Phố, Tuyến Hẻm, Khu Vực & Tuyến Đường */}
      <div className="bg-white p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs space-y-3.5">
        {/* Mode Selector & Search Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          {/* Filter Mode Selector Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl w-fit">
            <button
              id="mode-filter-all"
              onClick={() => {
                setFilterMode('all');
                setSelectedGroup('all');
                setSelectedAlley('all');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'all' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span>Toàn bộ địa bàn</span>
            </button>
            <button
              id="mode-filter-group"
              onClick={() => setFilterMode('group')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'group' || selectedGroup !== 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Lọc theo Tổ dân phố</span>
              {selectedGroup !== 'all' && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
            </button>
            <button
              id="mode-filter-alley"
              onClick={() => setFilterMode('alley')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'alley' || selectedAlley !== 'all'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Lọc theo Hẻm / Tuyến</span>
              {selectedAlley !== 'all' && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              id="map-search-input"
              placeholder="Tìm số nhà, chủ hộ, tổ, hẻm..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8.5 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Granular Filter Row 1: Hamlet & Street */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-600 shrink-0 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              <span>Khu vực:</span>
            </span>
            {['all', ...hamletList].map(hamlet => (
              <button
                key={hamlet}
                id={`filter-hamlet-${hamlet}`}
                onClick={() => {
                  setSelectedHamlet(hamlet);
                  setSelectedGroup('all');
                }}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer shrink-0 ${
                  selectedHamlet === hamlet ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {hamlet === 'all' ? 'Toàn địa bàn' : hamlet}
              </button>
            ))}

            <span className="text-slate-300 mx-1 hidden sm:inline">|</span>

            <span className="font-bold text-slate-600 shrink-0">Đường:</span>
            {streets.map(st => (
              <button
                key={st}
                id={`filter-street-${st}`}
                onClick={() => setActiveStreet(st)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer shrink-0 ${
                  activeStreet === st
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {st === 'all' ? 'Tất cả đường' : st}
              </button>
            ))}
          </div>

          {/* Quick Stats on density */}
          <div className="text-[11px] text-slate-500 font-medium">
            Mật độ: <span className="font-bold text-slate-800">{filteredHouseholds.length}</span> / {households.length} hộ
          </div>
        </div>

        {/* Granular Filter Row 2: TỔ DÂN PHỐ SELECTOR */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-xs font-bold text-slate-700">Tổ dân phố:</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none flex-1">
            <button
              id="filter-group-all"
              onClick={() => setSelectedGroup('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors shrink-0 cursor-pointer ${
                selectedGroup === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất cả các tổ
            </button>

            {availableGroups.map(({ name, count }) => (
              <button
                key={name}
                id={`filter-group-${name.replace(/\s+/g, '-').toLowerCase()}`}
                onClick={() => {
                  setSelectedGroup(name);
                  setFilterMode('group');
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  selectedGroup === name
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'bg-blue-50/70 text-blue-900 border border-blue-200 hover:bg-blue-100'
                }`}
              >
                <span>{name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    selectedGroup === name ? 'bg-blue-800 text-white' : 'bg-blue-200/80 text-blue-800'
                  }`}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Granular Filter Row 3: HẺM / VỊ TRÍ NHÀ SELECTOR */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span className="text-xs font-bold text-slate-700">Tuyến Hẻm:</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none flex-1">
            <button
              id="filter-alley-all"
              onClick={() => setSelectedAlley('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors shrink-0 cursor-pointer ${
                selectedAlley === 'all' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất cả vị trí / hẻm
            </button>

            {availableAlleys.map(({ name, count }) => (
              <button
                key={name}
                id={`filter-alley-${name.replace(/\s+/g, '-').toLowerCase()}`}
                onClick={() => {
                  setSelectedAlley(name);
                  setFilterMode('alley');
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  selectedAlley === name
                    ? 'bg-purple-600 text-white font-bold shadow-xs'
                    : 'bg-purple-50/70 text-purple-900 border border-purple-200 hover:bg-purple-100'
                }`}
              >
                <span>{name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    selectedAlley === name ? 'bg-purple-800 text-white' : 'bg-purple-200/80 text-purple-800'
                  }`}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Active Filter Tags & Focus Feedback Bar */}
        {hasActiveFilters && (
          <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mr-1">
                <SlidersHorizontal className="w-3 h-3" />
                <span>Đang lọc:</span>
              </span>

              {selectedHamlet !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[11px] font-bold">
                  {selectedHamlet}
                  <button onClick={() => setSelectedHamlet('all')} className="hover:text-blue-950">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {selectedGroup !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-600 text-white text-[11px] font-bold shadow-xs">
                  Tổ: {selectedGroup}
                  <button onClick={() => setSelectedGroup('all')} className="hover:text-slate-200">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {selectedAlley !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-600 text-white text-[11px] font-bold shadow-xs">
                  Hẻm: {selectedAlley}
                  <button onClick={() => setSelectedAlley('all')} className="hover:text-slate-200">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {activeStreet !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-white text-[11px] font-bold">
                  Đường: {activeStreet}
                  <button onClick={() => setActiveStreet('all')} className="hover:text-slate-300">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {onlyWarnings && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[11px] font-bold">
                  Chỉ cảnh báo
                  <button onClick={() => setOnlyWarnings(false)} className="hover:text-amber-950">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {searchQuery && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 text-[11px] font-bold">
                  Tìm: "{searchQuery}"
                  <button onClick={() => setSearchQuery('')} className="hover:text-slate-950">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              <button
                id="btn-clear-all-filters"
                onClick={handleReset}
                className="text-[11px] text-rose-600 hover:text-rose-700 font-bold ml-1.5 underline cursor-pointer"
              >
                Xóa tất cả bộ lọc
              </button>
            </div>

            {/* Visual clutter reduction note */}
            <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>
                Giảm <strong>{reductionPercentage}%</strong> dữ liệu gây rối mắt • Quan sát tập trung
              </span>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span id="map-legend-title" className="text-[11px] sm:text-xs font-bold text-slate-700">
              Trạng thái:
            </span>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>Bình thường</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span>Cảnh báo hết hạn</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <span>Đối tượng chú ý</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span>Cơ sở KD</span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400">
            Ký hiệu: <span className="font-semibold text-blue-600">Tổ X</span> (Tổ dân phố) •{' '}
            <span className="font-semibold text-purple-600">Hẻm / Tuyến</span>
          </div>
        </div>
      </div>

      {/* Main Interactive Grid & Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        {/* Sơ đồ lưới khối nhà (Grid View) */}
        <div
          id="map-grid-panel"
          className="lg:col-span-8 bg-white p-3.5 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs"
        >
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-2">
              <h3 id="map-results-title" className="text-xs sm:text-sm font-bold text-slate-800">
                Sơ đồ vị trí các hộ dân
              </h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-100">
                {filteredHouseholds.length} / {households.length} vị trí
              </span>
            </div>
            <span className="text-[11px] text-slate-400 hidden sm:inline">Chạm vào khối nhà để xem thông tin chi tiết</span>
          </div>

          {/* House Matrix Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
            {filteredHouseholds.map(item => {
              const status = getStatusDetails(item.status);
              const isSelected = inspectedHousehold?.id === item.id;
              const group = getHouseholdNeighborhoodGroup(item);
              const alley = getHouseholdAlley(item);

              return (
                <div
                  key={item.id}
                  id={`house-card-${item.id}`}
                  onClick={() => setInspectedHousehold(item)}
                  className={`p-3 rounded-xl border-2 cursor-pointer transition-all duration-150 relative flex flex-col justify-between ${status.boxBorder} ${
                    isSelected ? 'ring-3 ring-blue-500 shadow-md scale-[1.02]' : 'hover:shadow-sm'
                  }`}
                >
                  <div>
                    {/* Top tags: Hamlet, Group, Alley & Status Dot */}
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-bold">
                          {item.hamlet}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 font-extrabold border border-blue-200">
                          {group}
                        </span>
                      </div>
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${status.dot} ${item.status === 'warning' ? 'animate-pulse' : ''}`}
                      />
                    </div>

                    {/* House Number and Street */}
                    <div className="mt-1">
                      <div className="text-base font-extrabold text-slate-900 leading-tight">Số {item.houseNumber}</div>
                      <div className="text-xs font-semibold text-slate-600 truncate mt-0.5">Đ. {item.street}</div>
                    </div>

                    {/* Alley / Location Badge */}
                    <div className="mt-1.5">
                      <span
                        className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-semibold border border-purple-150 truncate max-w-full"
                        title={alley}
                      >
                        {alley}
                      </span>
                    </div>

                    {/* Owner or Business name */}
                    <div className="mt-2 text-xs font-bold text-slate-800 truncate">
                      {item.businessName ? `🏪 ${item.businessName}` : `👤 ${item.ownerName}`}
                    </div>
                  </div>

                  {/* Residents & Status subtitle */}
                  <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-1 font-medium">
                      <Users className="w-3 h-3 text-slate-400" />
                      {item.residentsCount} người
                    </span>
                    <span className="font-mono text-[10px] font-semibold text-slate-400">{item.id}</span>
                  </div>

                  {/* Warning banner tag if warning */}
                  {item.status === 'warning' && (
                    <div className="mt-2 py-0.5 px-1 bg-amber-200/80 rounded text-[10px] font-bold text-amber-900 text-center truncate">
                      ⚠️ Hết hạn {item.licenseExpiry}
                    </div>
                  )}
                  {item.status === 'alert' && (
                    <div className="mt-2 py-0.5 px-1 bg-rose-200/80 rounded text-[10px] font-bold text-rose-900 text-center truncate">
                      🚨 Quản lý đối tượng
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filteredHouseholds.length === 0 && (
            <div className="text-center py-12 text-slate-500 text-xs space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Search className="w-6 h-6" />
              </div>
              <p className="font-medium">Không tìm thấy vị trí nào phù hợp với bộ lọc hiện tại.</p>
              <button
                onClick={handleReset}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Khôi phục toàn bộ bản đồ
              </button>
            </div>
          )}
        </div>

        {/* Selected House Inspector Drawer */}
        <div className="lg:col-span-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 sticky top-20">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 id="map-summary-title" className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-600" />
              <span>Chi tiết khối nhà</span>
            </h3>
            {inspectedHousehold && (
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${getStatusDetails(inspectedHousehold.status).badge}`}
              >
                {getStatusDetails(inspectedHousehold.status).label}
              </span>
            )}
          </div>

          {inspectedHousehold ? (
            <div className="space-y-4 text-xs">
              {/* Basic address */}
              <div>
                <div className="text-lg font-extrabold text-slate-900">
                  Số {inspectedHousehold.houseNumber} {inspectedHousehold.street}
                </div>
                <div className="text-slate-500 font-medium mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>{inspectedHousehold.hamlet}, P. An Lạc, Q. Bình Tân</span>
                </div>
              </div>

              {/* Administrative Classification (Tổ dân phố & Hẻm) */}
              <div className="p-3 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-200/80 rounded-xl space-y-2">
                <div className="text-[11px] font-bold text-blue-900 flex items-center gap-1.5 uppercase tracking-wide">
                  <Home className="w-3.5 h-3.5 text-blue-700" />
                  <span>Phân cấp quản lý địa bàn</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white/90 p-2 rounded-lg border border-blue-100">
                    <span className="text-[10px] text-slate-500 block font-semibold">Tổ dân phố:</span>
                    <span className="font-extrabold text-blue-700 text-sm">{getHouseholdNeighborhoodGroup(inspectedHousehold)}</span>
                  </div>
                  <div className="bg-white/90 p-2 rounded-lg border border-blue-100">
                    <span className="text-[10px] text-slate-500 block font-semibold">Vị trí / Tuyến hẻm:</span>
                    <span className="font-bold text-purple-800 text-xs truncate block" title={getHouseholdAlley(inspectedHousehold)}>
                      {getHouseholdAlley(inspectedHousehold)}
                    </span>
                  </div>
                </div>

                {/* Quick Isolation Buttons for this Group or Alley */}
                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    id="btn-isolate-group"
                    onClick={() => {
                      const grp = getHouseholdNeighborhoodGroup(inspectedHousehold);
                      setSelectedGroup(grp);
                      setFilterMode('group');
                    }}
                    className="flex-1 py-1 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer text-center"
                    title="Chỉ hiển thị các nhà cùng Tổ này trên bản đồ"
                  >
                    Chỉ xem {getHouseholdNeighborhoodGroup(inspectedHousehold)}
                  </button>
                  <button
                    id="btn-isolate-alley"
                    onClick={() => {
                      const al = getHouseholdAlley(inspectedHousehold);
                      setSelectedAlley(al);
                      setFilterMode('alley');
                    }}
                    className="flex-1 py-1 px-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer text-center"
                    title="Chỉ hiển thị các nhà cùng Tuyến Hẻm này trên bản đồ"
                  >
                    Chỉ xem Hẻm này
                  </button>
                </div>
              </div>

              {/* Business Details if applicable */}
              {inspectedHousehold.businessName && (
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1">
                  <div className="font-bold text-blue-950 text-xs flex items-center gap-1.5">
                    <Store className="w-4 h-4 text-blue-700" />
                    <span>{inspectedHousehold.businessName}</span>
                  </div>
                  <div className="text-[11px] text-blue-800">Ngành nghề: {inspectedHousehold.businessCategory}</div>
                  {inspectedHousehold.licenseExpiry && (
                    <div className="text-[11px] font-bold text-amber-900 mt-1">
                      Hạn giấy phép: {inspectedHousehold.licenseExpiry} ({inspectedHousehold.warningMessage})
                    </div>
                  )}
                </div>
              )}

              {/* Special Monitored Details */}
              {inspectedHousehold.type === 'special_monitoring' && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                  <div className="font-bold text-rose-950 text-xs flex items-center gap-1.5">
                    <AlertOctagon className="w-4 h-4 text-rose-700" />
                    <span>Hồ sơ quản lý nghiệp vụ ANTT</span>
                  </div>
                  <div className="text-[11px] text-rose-900 font-medium">{inspectedHousehold.warningMessage}</div>
                </div>
              )}

              {/* Resident Demographics */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between font-bold text-slate-700">
                  <span>Chủ hộ / Quản lý:</span>
                  <span className="text-slate-900">{inspectedHousehold.ownerName}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Số điện thoại:</span>
                  <span className="font-mono font-bold text-blue-700">{inspectedHousehold.ownerPhone}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Tổng nhân khẩu:</span>
                  <span className="font-bold text-slate-900">
                    {inspectedHousehold.residentsCount} người ({inspectedHousehold.maleCount} Nam, {inspectedHousehold.femaleCount} Nữ)
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Độ tuổi:</span>
                  <span>
                    {inspectedHousehold.above18Count} người lớn, {inspectedHousehold.under18Count} trẻ em
                  </span>
                </div>
              </div>

              {/* Officer Field Inspection Notes */}
              <div className="space-y-1">
                <span className="font-bold text-slate-700">Ghi chú cán bộ CSKV:</span>
                <p className="p-3 bg-amber-50/50 border border-amber-200/60 rounded-xl text-slate-700 leading-relaxed text-[11px]">
                  {inspectedHousehold.notes}
                </p>
                <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                  <span>Kiểm tra gần nhất: {inspectedHousehold.lastCheckedDate}</span>
                  <span>Cán bộ: {inspectedHousehold.officerInCharge}</span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="pt-2 flex flex-col gap-2">
                <button
                  id="btn-view-household-detail"
                  onClick={() => onSelectHousehold(inspectedHousehold)}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Xem hồ sơ hộ dân & cập nhật</span>
                </button>
                <a
                  id="btn-call-household-owner"
                  href={`tel:${inspectedHousehold.ownerPhone}`}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors flex items-center justify-center gap-1.5 border border-slate-200 cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5 text-blue-600" />
                  <span>Gọi liên hệ ({inspectedHousehold.ownerPhone})</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">Chưa chọn khối nhà nào</div>
          )}
        </div>
      </div>
    </div>
  );
};
