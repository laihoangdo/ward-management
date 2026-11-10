import React, { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw,
  RotateCcw,
  Building,
  Store,
  AlertOctagon,
  CheckCircle2,
  Phone,
  Users,
  MapPin,
  FileText,
  Search,
  Maximize2,
  Minimize2,
  Compass,
  Home,
  SlidersHorizontal,
  X,
  Navigation,
  User,
  AlertTriangle,
} from 'lucide-react';
import { HouseholdFacility, NavigationTab } from '../types';

interface AreaMapTabProps {
  households: HouseholdFacility[];
  onSelectHousehold: (household: HouseholdFacility) => void;
  onRefresh: () => void;
  onNavigateTab?: (tab: NavigationTab) => void;
}

// Màu purple trong tệp này là màu phân loại chiều dữ liệu "Tuyến hẻm" (alley): chấm chú thích, chip lọc,
// nhãn hẻm trên thẻ nhà, nhãn lọc đang bật và nút cô lập hẻm dùng chung một hue để cán bộ nhận diện nhanh
// nhóm hẻm. Đây là màu phân loại nghiệp vụ, không phải accent trang trí.
const ALLEY_LEGEND_DOT = 'w-2 h-2 rounded-full bg-purple-500'; // taste-skill-ignore: màu phân loại tuyến hẻm
const ALLEY_LEGEND_TEXT = 'font-semibold text-purple-600'; // taste-skill-ignore: màu phân loại tuyến hẻm
const ALLEY_ACTIVE_PILL = 'bg-purple-600 text-white'; // taste-skill-ignore: màu phân loại tuyến hẻm
const ALLEY_FILTER_TAG = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-600 text-white text-[11px] font-bold'; // taste-skill-ignore: màu phân loại tuyến hẻm
const ALLEY_CARD_BADGE =
  'inline-block text-[11px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-semibold border border-purple-150 truncate max-w-full'; // taste-skill-ignore: màu phân loại tuyến hẻm
const ALLEY_VALUE_TEXT = 'font-bold text-purple-800 text-xs truncate block'; // taste-skill-ignore: màu phân loại tuyến hẻm
const ALLEY_ISOLATE_BUTTON =
  'flex-1 py-1 px-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer text-center'; // taste-skill-ignore: màu phân loại tuyến hẻm

export const UNGROUPED = 'Chưa phân tổ';
export const UNKNOWN_LEGACY_HAMLET = 'Không rõ ấp cũ';
export const UNKNOWN_LOCATION = 'Chưa rõ vị trí';

/**
 * Tổ dân phố đã ghi trên hồ sơ hộ. Không suy đoán từ số nhà hay ghi chú: hộ chưa có dữ liệu tổ là "Chưa phân tổ".
 */
export const getHouseholdNeighborhoodGroup = (h: HouseholdFacility): string => h.neighborhoodGroup?.trim() || UNGROUPED;

/**
 * Ấp cũ trước sáp nhập (61/62/63/69…) theo nguồn nhập dữ liệu; hộ thêm thủ công hoặc không rõ nguồn là "Không rõ ấp cũ".
 */
export const getHouseholdLegacyHamlet = (h: HouseholdFacility): string =>
  h.legacyHamlet?.trim() ? `Ấp ${h.legacyHamlet.trim()} (cũ)` : UNKNOWN_LEGACY_HAMLET;

/** Tên đường thật của hộ; trống khi địa chỉ nguồn chưa được tách tên đường. */
export const getHouseholdStreet = (h: HouseholdFacility): string => h.streetName?.trim() || '';

/**
 * Tuyến hẻm / vị trí mặt tiền: ưu tiên dữ liệu hẻm đã ghi, sau đó suy từ số nhà và tên đường thật.
 * Không ghép địa chỉ nguồn nguyên văn vào nhãn hẻm; thiếu dữ liệu thì là "Chưa rõ vị trí".
 */
export const getHouseholdAlley = (h: HouseholdFacility): string => {
  if (h.alley?.trim()) return h.alley.trim();
  const street = getHouseholdStreet(h);
  const houseNumber = String(h.houseNumber ?? '').trim();
  if (houseNumber.includes('/')) return `Hẻm ${houseNumber.split('/')[0]} ${street}`.trim();
  if (street.toLowerCase().includes('hẻm')) return street;
  const noted = h.notes?.match(/Hẻm\s*(\d+)/i);
  if (noted) return `Hẻm ${noted[1]} ${street}`.trim();
  if (houseNumber && street) return `Mặt tiền ${street}`;
  return UNKNOWN_LOCATION;
};

/** Tìm theo số nhà, chủ hộ, địa chỉ, cơ sở, ấp cũ, tổ, hẻm, mã hộ và ghi chú (query đã chuẩn hóa chữ thường). */
const matchesSearch = (h: HouseholdFacility, query: string): boolean =>
  [
    h.houseNumber,
    h.ownerName,
    h.street,
    h.businessName,
    h.legacyHamlet ? getHouseholdLegacyHamlet(h) : '',
    h.neighborhoodGroup,
    getHouseholdAlley(h),
    h.code,
    h.notes,
  ].some(value => !!value && value.toLowerCase().includes(query));

/** Đếm số hộ theo nhãn, giữ nhãn "chưa có dữ liệu" ở cuối danh sách. */
const countBy = (items: HouseholdFacility[], label: (h: HouseholdFacility) => string, unknown: string) => {
  const map = new Map<string, number>();
  items.forEach(h => {
    const value = label(h);
    if (value) map.set(value, (map.get(value) || 0) + 1);
  });
  return Array.from(map, ([name, count]) => ({ name, count })).sort((a, b) => {
    if (a.name === unknown || b.name === unknown) return a.name === unknown ? 1 : -1;
    return a.name.localeCompare(b.name, 'vi', { numeric: true });
  });
};

/** Chọn tuyến đường lấy từ dữ liệu hộ; báo rõ khi địa chỉ nguồn chưa tách tên đường. */
const StreetFilter: React.FC<{
  streets: { name: string; count: number }[];
  selected: string;
  onSelect: (value: string) => void;
}> = ({ streets, selected, onSelect }) =>
  streets.length === 0 ? (
    <span id="filter-street-empty" className="text-slate-500">
      Chưa có dữ liệu tên đường (địa chỉ nguồn chưa tách tên đường)
    </span>
  ) : (
    <>
      {[{ name: 'all', count: 0 }, ...streets].map(({ name, count }) => (
        <button
          key={name}
          id={`filter-street-${name}`}
          aria-pressed={selected === name}
          onClick={() => onSelect(name)}
          className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
            selected === name ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          {name === 'all' ? 'Tất cả đường' : `${name} (${count})`}
        </button>
      ))}
    </>
  );

/** Nhãn ấp cũ và tổ dân phố trên thẻ hộ; chỉ hiện khi có dữ liệu thật. */
const HouseholdCardTags: React.FC<{ household: HouseholdFacility }> = ({ household }) => (
  <>
    {household.legacyHamlet && (
      <span className="text-[11px] px-1.5 py-0.2 rounded bg-slate-50 text-slate-700 font-semibold border border-slate-200">
        {getHouseholdLegacyHamlet(household)}
      </span>
    )}
    {household.neighborhoodGroup?.trim() && (
      <span className="text-[11px] px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 font-extrabold border border-blue-200">
        {household.neighborhoodGroup.trim()}
      </span>
    )}
  </>
);

/** Hàng lọc ấp cũ (nguồn nhập trước sáp nhập). */
const LegacyHamletFilter: React.FC<{
  options: { name: string; count: number }[];
  selected: string;
  onSelect: (value: string) => void;
}> = ({ options, selected, onSelect }) => (
  <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-2">
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="w-2 h-2 rounded-full bg-slate-500" />
      <span className="text-xs font-bold text-slate-700" title="Ấp trước sáp nhập, theo file nguồn của cán bộ quản lý ấp">
        Ấp cũ (nguồn):
      </span>
    </div>

    <div role="group" aria-label="Lọc theo ấp cũ" className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none flex-1">
      <button
        id="filter-legacy-all"
        aria-pressed={selected === 'all'}
        onClick={() => onSelect('all')}
        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors shrink-0 cursor-pointer ${
          selected === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`}
      >
        Tất cả ấp cũ
      </button>
      {options.map(({ name, count }) => (
        <button
          key={name}
          id={`filter-legacy-${name.replace(/\W+/g, '-').toLowerCase()}`}
          aria-pressed={selected === name}
          aria-label={`${name}, ${count} hộ`}
          onClick={() => onSelect(name)}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors shrink-0 cursor-pointer flex items-center gap-1.5 ${
            selected === name
              ? 'bg-slate-800 text-white font-bold'
              : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          <span>{name}</span>
          <span className="text-[11px] tabular-nums font-bold opacity-80">{count}</span>
        </button>
      ))}
    </div>
  </div>
);

/** Phân cấp quản lý địa bàn của hộ đang xem: ấp cũ, tổ dân phố, tuyến hẻm và nút lọc nhanh tương ứng. */
const HouseholdClassification: React.FC<{
  household: HouseholdFacility;
  onIsolateLegacy: (value: string) => void;
  onIsolateGroup: (value: string) => void;
  onIsolateAlley: (value: string) => void;
}> = ({ household, onIsolateLegacy, onIsolateGroup, onIsolateAlley }) => (
  <div className="p-3 bg-blue-50/80 border border-blue-200/80 rounded-xl space-y-2">
    <div className="text-xs font-semibold text-blue-900 flex items-center gap-1.5">
      <Home className="w-3.5 h-3.5 text-blue-700" />
      <span>Phân cấp quản lý địa bàn</span>
    </div>

    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="bg-white/90 p-2 rounded-lg border border-blue-100 col-span-2">
        <span className="text-[11px] text-slate-500 block font-semibold">Ấp cũ (theo nguồn nhập):</span>
        <span className="font-bold text-slate-800 text-sm">{getHouseholdLegacyHamlet(household)}</span>
      </div>
      <div className="bg-white/90 p-2 rounded-lg border border-blue-100">
        <span className="text-[11px] text-slate-500 block font-semibold">Tổ dân phố:</span>
        <span className={`font-extrabold text-sm ${household.neighborhoodGroup?.trim() ? 'text-blue-700' : 'text-slate-500'}`}>
          {getHouseholdNeighborhoodGroup(household)}
        </span>
      </div>
      <div className="bg-white/90 p-2 rounded-lg border border-blue-100">
        <span className="text-[11px] text-slate-500 block font-semibold">Vị trí / Tuyến hẻm:</span>
        <span className={ALLEY_VALUE_TEXT} title={getHouseholdAlley(household)}>
          {getHouseholdAlley(household)}
        </span>
      </div>
    </div>

    {/* Quick Isolation Buttons for this Legacy Hamlet, Group or Alley */}
    <div className="flex flex-wrap items-center gap-1.5 pt-1">
      {household.legacyHamlet && (
        <button
          id="btn-isolate-legacy"
          onClick={() => onIsolateLegacy(getHouseholdLegacyHamlet(household))}
          className="flex-1 py-1 px-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer text-center"
          title="Chỉ hiển thị các nhà cùng ấp cũ này"
        >
          Chỉ xem {getHouseholdLegacyHamlet(household)}
        </button>
      )}
      {household.neighborhoodGroup?.trim() && (
        <button
          id="btn-isolate-group"
          onClick={() => onIsolateGroup(getHouseholdNeighborhoodGroup(household))}
          className="flex-1 py-1 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer text-center"
          title="Chỉ hiển thị các nhà cùng Tổ này trên bản đồ"
        >
          Chỉ xem {getHouseholdNeighborhoodGroup(household)}
        </button>
      )}
      {getHouseholdAlley(household) !== UNKNOWN_LOCATION && (
        <button
          id="btn-isolate-alley"
          onClick={() => onIsolateAlley(getHouseholdAlley(household))}
          className={ALLEY_ISOLATE_BUTTON}
          title="Chỉ hiển thị các nhà cùng Tuyến Hẻm này trên bản đồ"
        >
          Chỉ xem Hẻm này
        </button>
      )}
    </div>
  </div>
);

export const AreaMapTab: React.FC<AreaMapTabProps> = ({ households, onSelectHousehold, onRefresh, onNavigateTab }) => {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [onlyWarnings, setOnlyWarnings] = useState<boolean>(false);
  const [selectedHamlet, setSelectedHamlet] = useState<string>('all');
  const [activeStreet, setActiveStreet] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedLegacyHamlet, setSelectedLegacyHamlet] = useState<string>('all');
  const [selectedAlley, setSelectedAlley] = useState<string>('all');
  const [filterMode, setFilterMode] = useState<'all' | 'group' | 'alley'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [inspectedHousehold, setInspectedHousehold] = useState<HouseholdFacility | null>(households[0] || null);

  const [pagination, setPagination] = useState({ key: '', page: 1 });

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

  const hamletHouseholds = useMemo(
    () => (selectedHamlet === 'all' ? households : households.filter(h => h.hamlet === selectedHamlet)),
    [households, selectedHamlet],
  );

  // Ấp cũ trước sáp nhập, lấy từ nguồn nhập; chỉ hiện khi có ít nhất một hộ có dữ liệu này
  const availableLegacyHamlets = useMemo(
    () => countBy(hamletHouseholds, getHouseholdLegacyHamlet, UNKNOWN_LEGACY_HAMLET),
    [hamletHouseholds],
  );
  const hasLegacyData = availableLegacyHamlets.some(({ name }) => name !== UNKNOWN_LEGACY_HAMLET);

  // Tuyến đường lấy từ dữ liệu hộ (cột tên đường), không dùng danh sách ghi cứng
  const streets = useMemo(() => countBy(hamletHouseholds, getHouseholdStreet, ''), [hamletHouseholds]);

  // Danh sách Tổ dân phố kèm thống kê số hộ; chỉ có tổ thật khi hồ sơ hộ đã ghi tổ
  const availableGroups = useMemo(() => countBy(hamletHouseholds, getHouseholdNeighborhoodGroup, UNGROUPED), [hamletHouseholds]);
  const hasGroupData = availableGroups.some(({ name }) => name !== UNGROUPED);

  // Danh sách Tuyến Hẻm kèm thống kê số hộ
  const availableAlleys = useMemo(
    () =>
      countBy(
        activeStreet === 'all' ? hamletHouseholds : hamletHouseholds.filter(h => getHouseholdStreet(h) === activeStreet),
        getHouseholdAlley,
        UNKNOWN_LOCATION,
      ),
    [hamletHouseholds, activeStreet],
  );

  // Lọc dữ liệu hộ dân theo các tiêu chí kết hợp
  const filteredHouseholds = useMemo(() => {
    return households.filter(h => {
      if (onlyWarnings && h.status !== 'warning' && h.status !== 'alert') return false;
      if (selectedHamlet !== 'all' && h.hamlet !== selectedHamlet) return false;
      if (activeStreet !== 'all' && getHouseholdStreet(h) !== activeStreet) return false;
      if (selectedLegacyHamlet !== 'all' && getHouseholdLegacyHamlet(h) !== selectedLegacyHamlet) return false;

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

      // Tìm kiếm từ khóa (số nhà, chủ hộ, địa chỉ, ấp cũ, tổ, hẻm, ghi chú)
      if (searchQuery.trim() && !matchesSearch(h, searchQuery.trim().toLowerCase())) return false;

      return true;
    });
  }, [households, onlyWarnings, selectedHamlet, activeStreet, selectedLegacyHamlet, selectedGroup, selectedAlley, searchQuery]);

  // Xóa toàn bộ bộ lọc về mặc định
  const pageSize = 48;
  const filterKey = JSON.stringify([
    onlyWarnings,
    selectedHamlet,
    activeStreet,
    selectedLegacyHamlet,
    selectedGroup,
    selectedAlley,
    searchQuery,
  ]);
  const pageCount = Math.max(1, Math.ceil(filteredHouseholds.length / pageSize));
  const currentPage = pagination.key === filterKey ? Math.min(pagination.page, pageCount) : 1;
  const pageHouseholds = filteredHouseholds.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => {
    setPagination(previous => (previous.key === filterKey ? previous : { key: filterKey, page: 1 }));
  }, [filterKey]);

  const handleReset = () => {
    setPagination({ key: '', page: 1 });
    setOnlyWarnings(false);
    setSelectedHamlet('all');
    setActiveStreet('all');
    setSelectedLegacyHamlet('all');
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
    onlyWarnings ||
    searchQuery.trim() !== '' ||
    [selectedHamlet, activeStreet, selectedLegacyHamlet, selectedGroup, selectedAlley].some(value => value !== 'all');

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
          ? 'fixed inset-0 z-[99999] w-screen h-screen bg-slate-900 text-slate-100 flex flex-col p-3 sm:p-4 overflow-y-auto space-y-4 m-0'
          : 'space-y-4 sm:space-y-6 max-w-7xl mx-auto'
      }
      style={
        isFullscreen
          ? {
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 99999,
              margin: 0,
            }
          : undefined
      }
    >
      {/* Fullscreen Top Navigation Bar */}
      {isFullscreen && (
        <div className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 shrink-0 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span className="font-bold text-xs sm:text-sm text-slate-100">Sơ đồ địa bàn dân cư tương tác — Toàn màn hình</span>
            <span className="hidden sm:inline-block text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 tabular-nums">
              {filteredHouseholds.length} / {households.length} vị trí
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateTab && (
              <button
                id="btn-navigate-gis-fullscreen"
                onClick={() => {
                  setIsFullscreen(false);
                  onNavigateTab('field-3d-map');
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Mở bản đồ không gian 3D thực địa"
              >
                <Compass className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Bản đồ 3D thực địa</span>
              </button>
            )}

            <button
              id="btn-exit-fullscreen"
              onClick={() => setIsFullscreen(false)}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
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
        <div className="bg-white p-3.5 sm:p-5 rounded-xl border border-slate-200/80">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3">
            <div>
              <h2 id="map-title" className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Sơ đồ địa bàn tương tác
              </h2>
              <p id="map-description" className="hidden sm:block text-sm text-slate-500 mt-0.5 mb-0">
                Lọc nhanh theo ấp cũ, tổ dân phố hoặc tuyến hẻm để quan sát khu vực phụ trách rõ nét, loại bỏ dữ liệu dư thừa.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Toggle Only Warnings */}
              <label className="gis-check-row px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors min-h-[40px]">
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
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 min-h-[40px] cursor-pointer"
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
                <RotateCcw aria-hidden="true" className="w-3.5 h-3.5" />
                <span>Xóa lọc</span>
              </button>

              {/* Navigate to GIS 3D Map */}
              {onNavigateTab && (
                <button
                  id="map-nav-gis-button"
                  onClick={() => onNavigateTab('field-3d-map')}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-colors flex items-center gap-1.5 min-h-[40px] cursor-pointer"
                  title="Chuyển sang Bản đồ không gian 3D thực địa"
                >
                  <Compass className="w-3.5 h-3.5 text-blue-600" />
                  <span>Bản đồ 3D</span>
                </button>
              )}

              {/* Fullscreen Button */}
              <button
                id="map-fullscreen-button"
                onClick={() => setIsFullscreen(true)}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 min-h-[40px] cursor-pointer"
                title="Xem toàn màn hình"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Toàn màn hình</span>
              </button>
            </div>
          </div>

          <p id="map-help" className="hidden lg:block text-xs text-slate-500 mt-2 mb-0 pt-2 border-t border-slate-100">
            Sơ đồ phân tổ và hẻm giúp cán bộ CSKV tập trung vào từng cụm dân cư phụ trách mà không bị rối mắt bởi lượng lớn dữ liệu.
          </p>
        </div>
      )}

      {/* Modern Filter Suite: Tổ Dân Phố, Tuyến Hẻm, Khu Vực & Tuyến Đường */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200/80 space-y-2.5">
        {/* Mode Selector & Search Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
          {/* Filter Mode Selector Pills */}
          <div
            role="group"
            aria-label="Chế độ lọc"
            className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl w-fit max-w-full overflow-x-auto"
          >
            <button
              id="mode-filter-all"
              onClick={() => {
                setFilterMode('all');
                setSelectedGroup('all');
                setSelectedAlley('all');
              }}
              className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'all' ? 'bg-white text-blue-700' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span>Toàn bộ địa bàn</span>
            </button>
            <button
              id="mode-filter-group"
              onClick={() => setFilterMode('group')}
              className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'group' || selectedGroup !== 'all' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Lọc theo Tổ dân phố</span>
              {selectedGroup !== 'all' && <span aria-hidden="true" className="w-2 h-2 rounded-full bg-white" />}
            </button>
            <button
              id="mode-filter-alley"
              onClick={() => setFilterMode('alley')}
              className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'alley' || selectedAlley !== 'all' ? ALLEY_ACTIVE_PILL : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Lọc theo Hẻm / Tuyến</span>
              {selectedAlley !== 'all' && <span aria-hidden="true" className="w-2 h-2 rounded-full bg-white" />}
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
              className="w-full pl-8.5 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
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
        <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
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
                  setSelectedLegacyHamlet('all');
                  setActiveStreet('all');
                }}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer shrink-0 ${
                  selectedHamlet === hamlet ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {hamlet === 'all' ? 'Toàn địa bàn' : hamlet}
              </button>
            ))}

            <span className="text-slate-300 mx-1 hidden sm:inline">|</span>

            <span className="font-bold text-slate-600 shrink-0">Đường:</span>
            <StreetFilter
              streets={streets}
              selected={activeStreet}
              onSelect={name => {
                setActiveStreet(name);
                setSelectedAlley('all');
              }}
            />
          </div>

          {/* Quick Stats on density */}
          <div className="text-[11px] text-slate-500 font-medium tabular-nums">
            Mật độ: <span className="font-bold text-slate-800">{filteredHouseholds.length}</span> / {households.length} hộ
          </div>
        </div>

        {/* Granular Filter Row 2: ẤP CŨ (nguồn nhập dữ liệu trước sáp nhập) */}
        {hasLegacyData && (
          <LegacyHamletFilter options={availableLegacyHamlets} selected={selectedLegacyHamlet} onSelect={setSelectedLegacyHamlet} />
        )}

        {/* Granular Filter Row 3: TỔ DÂN PHỐ SELECTOR */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-xs font-bold text-slate-700">Tổ dân phố:</span>
          </div>

          {!hasGroupData ? (
            <p id="filter-group-empty" className="m-0 text-xs text-slate-500">
              Chưa có dữ liệu tổ dân phố — cập nhật trường Tổ trên hồ sơ hộ khi có danh sách tổ chính thức.
            </p>
          ) : (
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
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors shrink-0 cursor-pointer flex items-center gap-1.5 ${
                    selectedGroup === name
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-blue-50/70 text-blue-900 border border-blue-200 hover:bg-blue-100'
                  }`}
                >
                  <span>{name}</span>
                  <span
                    className={`text-[11px] tabular-nums px-1.5 py-0.2 rounded-full font-bold ${
                      selectedGroup === name ? 'bg-blue-800 text-white' : 'bg-blue-200/80 text-blue-800'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Granular Filter Row 4: HẺM / VỊ TRÍ NHÀ SELECTOR */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={ALLEY_LEGEND_DOT} />
            <span className="text-xs font-bold text-slate-700">Tuyến Hẻm:</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none flex-1">
            <button
              id="filter-alley-all"
              onClick={() => setSelectedAlley('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors shrink-0 cursor-pointer ${
                selectedAlley === 'all'
                  ? 'bg-purple-600 text-white' // taste-skill-ignore: màu phân loại tuyến hẻm
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  selectedAlley === name
                    ? 'bg-purple-600 text-white font-bold' // taste-skill-ignore: màu phân loại tuyến hẻm
                    : 'bg-purple-50/70 text-purple-900 border border-purple-200 hover:bg-purple-100' // taste-skill-ignore: màu phân loại tuyến hẻm
                }`}
              >
                <span>{name}</span>
                <span
                  className={`text-[11px] tabular-nums px-1.5 py-0.2 rounded-full font-bold ${
                    selectedAlley === name
                      ? 'bg-purple-800 text-white' // taste-skill-ignore: màu phân loại tuyến hẻm
                      : 'bg-purple-200/80 text-purple-800' // taste-skill-ignore: màu phân loại tuyến hẻm
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

              {selectedLegacyHamlet !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-white text-[11px] font-bold">
                  {selectedLegacyHamlet}
                  <button onClick={() => setSelectedLegacyHamlet('all')} className="hover:text-slate-300" aria-label="Bỏ lọc ấp cũ">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {selectedGroup !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-600 text-white text-[11px] font-bold">
                  Tổ: {selectedGroup}
                  <button onClick={() => setSelectedGroup('all')} className="hover:text-slate-200">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {selectedAlley !== 'all' && (
                <span className={ALLEY_FILTER_TAG}>
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
            <span className={ALLEY_LEGEND_TEXT}>Hẻm / Tuyến</span>
          </div>
        </div>
      </div>

      {/* Main Interactive Grid & Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
        {/* Sơ đồ lưới khối nhà (Grid View) */}
        <div id="map-grid-panel" className="lg:col-span-8 bg-white p-3.5 sm:p-5 rounded-xl border border-slate-200/80">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-2">
              <h3 id="map-results-title" className="gis-panel-title text-slate-800">
                Sơ đồ vị trí các hộ dân
              </h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-100 tabular-nums">
                {filteredHouseholds.length} / {households.length} vị trí
              </span>
            </div>
            <span className="text-[11px] text-slate-500 hidden sm:inline">Chạm vào khối nhà để xem thông tin chi tiết</span>
          </div>

          {/* House Matrix Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
            {pageHouseholds.map(item => {
              const status = getStatusDetails(item.status);
              const isSelected = inspectedHousehold?.id === item.id;
              const alley = getHouseholdAlley(item);

              return (
                <div
                  key={item.id}
                  id={`house-card-${item.id}`}
                  onClick={() => setInspectedHousehold(item)}
                  className={`p-3 rounded-xl border-2 cursor-pointer transition-colors duration-150 relative flex flex-col justify-between ${status.boxBorder} ${
                    isSelected ? 'ring-3 ring-[#1c4e3a] border-[#1c4e3a] bg-emerald-50/40' : ''
                  }`}
                >
                  <div>
                    {/* Top tags: Hamlet, Group, Alley & Status Dot */}
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[11px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-bold">{item.hamlet}</span>
                        <HouseholdCardTags household={item} />
                      </div>
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${status.dot}`} />
                    </div>

                    {/* House Number and Street */}
                    <div className="mt-1">
                      {String(item.houseNumber ?? '').trim() ? (
                        <>
                          <div className="text-base font-extrabold text-slate-900 leading-tight">Số {item.houseNumber}</div>
                          <div className="text-xs font-semibold text-slate-600 truncate mt-0.5" title={item.street}>
                            Đ. {item.street}
                          </div>
                        </>
                      ) : (
                        <div className="text-sm font-bold text-slate-900 leading-snug line-clamp-2 break-words" title={item.street}>
                          {item.street || 'Chưa có địa chỉ'}
                        </div>
                      )}
                    </div>

                    {/* Alley / Location Badge */}
                    <div className="mt-1.5">
                      <span className={ALLEY_CARD_BADGE} title={alley}>
                        {alley}
                      </span>
                    </div>

                    {/* Owner or Business name */}
                    <div className="mt-2 text-xs font-bold text-slate-800 flex items-center gap-1 min-w-0">
                      {item.businessName ? (
                        <Store className="w-3 h-3 shrink-0 text-slate-400" />
                      ) : (
                        <User className="w-3 h-3 shrink-0 text-slate-400" />
                      )}
                      <span className="truncate">{item.businessName || item.ownerName}</span>
                    </div>
                  </div>

                  {/* Residents & Status subtitle */}
                  <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-1 font-medium tabular-nums">
                      <Users className="w-3 h-3 text-slate-400" />
                      {item.residentsCount} người
                    </span>
                    <span data-id className="font-mono text-[11px] font-semibold text-slate-400">
                      {item.id}
                    </span>
                  </div>

                  {/* Warning banner tag if warning */}
                  {item.status === 'warning' && (
                    <div className="mt-2 py-0.5 px-1 bg-amber-200/80 rounded text-[11px] font-bold text-amber-900 flex items-center justify-center gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span className="truncate">Hết hạn {item.licenseExpiry}</span>
                    </div>
                  )}
                  {item.status === 'alert' && (
                    <div className="mt-2 py-0.5 px-1 bg-rose-200/80 rounded text-[11px] font-bold text-rose-900 flex items-center justify-center gap-1">
                      <AlertOctagon className="w-3 h-3 shrink-0" />
                      <span className="truncate">Quản lý đối tượng</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filteredHouseholds.length > 0 && (
            <nav aria-label="Phân trang sơ đồ hộ dân" className="flex flex-wrap items-center justify-between gap-3 mt-4 text-sm">
              <span role="status" className="tabular-nums">
                {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredHouseholds.length)} /{' '}
                {filteredHouseholds.length} hộ
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setPagination({ key: filterKey, page: currentPage - 1 })}
                  className="px-3 py-2 border rounded-lg disabled:opacity-40"
                >
                  Trang trước
                </button>
                <span className="tabular-nums">
                  Trang {currentPage} / {pageCount}
                </span>
                <button
                  type="button"
                  disabled={currentPage === pageCount}
                  onClick={() => setPagination({ key: filterKey, page: currentPage + 1 })}
                  className="px-3 py-2 border rounded-lg disabled:opacity-40"
                >
                  Trang sau
                </button>
              </div>
            </nav>
          )}

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

        {/* Mobile/Tablet Quick Inspector Bar (<1024px) */}
        {inspectedHousehold && (
          <div
            role="region"
            aria-label="Chi tiết nhanh hộ đang chọn"
            className="lg:hidden sticky bottom-2 z-20 bg-white dark:bg-slate-900 border-2 border-[#1c4e3a] dark:border-emerald-600 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
                  {[
                    String(inspectedHousehold.houseNumber ?? '').trim() && `Số ${inspectedHousehold.houseNumber}`,
                    inspectedHousehold.street,
                  ]
                    .filter(Boolean)
                    .join(' ') || 'Chưa có địa chỉ'}
                </span>
                <span
                  className={`text-[11px] px-1.5 py-0.5 rounded font-semibold border ${getStatusDetails(inspectedHousehold.status).badge}`}
                >
                  {getStatusDetails(inspectedHousehold.status).label}
                </span>
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 truncate">
                Chủ hộ: <strong>{inspectedHousehold.ownerName}</strong> • {inspectedHousehold.residentsCount} nhân khẩu
                {inspectedHousehold.ownerPhone ? ` • SĐT: ${inspectedHousehold.ownerPhone}` : ''}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onSelectHousehold(inspectedHousehold)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Mở hồ sơ</span>
              </button>
            </div>
          </div>
        )}

        {/* Selected House Inspector Drawer */}
        <div className="lg:col-span-4 bg-white p-4 sm:p-5 rounded-xl border border-slate-200/80 space-y-4 sticky top-20">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <h3 id="map-summary-title" className="gis-panel-title text-slate-900 flex items-center gap-2 whitespace-nowrap">
              <Building className="w-4 h-4 text-slate-500" aria-hidden="true" />
              <span>Chi tiết khối nhà</span>
            </h3>
            {inspectedHousehold && (
              <span
                className={`shrink-0 whitespace-nowrap text-xs px-2 py-0.5 rounded-full font-semibold border ${getStatusDetails(inspectedHousehold.status).badge}`}
              >
                {getStatusDetails(inspectedHousehold.status).label}
              </span>
            )}
          </div>

          {inspectedHousehold ? (
            <div className="space-y-4 text-xs">
              {/* Basic address */}
              <div>
                <div className="text-base font-bold text-slate-900 break-words">
                  {[
                    String(inspectedHousehold.houseNumber ?? '').trim() && `Số ${inspectedHousehold.houseNumber}`,
                    inspectedHousehold.street,
                  ]
                    .filter(Boolean)
                    .join(' ') || 'Chưa có địa chỉ'}
                </div>
                <div className="text-slate-500 font-medium mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>{inspectedHousehold.hamlet}</span>
                </div>
              </div>

              <HouseholdClassification
                household={inspectedHousehold}
                onIsolateLegacy={setSelectedLegacyHamlet}
                onIsolateGroup={group => {
                  setSelectedGroup(group);
                  setFilterMode('group');
                }}
                onIsolateAlley={alley => {
                  setSelectedAlley(alley);
                  setFilterMode('alley');
                }}
              />

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
                  <span className="tabular-nums font-bold text-blue-700">{inspectedHousehold.ownerPhone}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Tổng nhân khẩu:</span>
                  <span className="font-bold text-slate-900 tabular-nums">
                    {inspectedHousehold.residentsCount} người ({inspectedHousehold.maleCount} Nam, {inspectedHousehold.femaleCount} Nữ)
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Độ tuổi:</span>
                  <span className="tabular-nums">
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
                <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                  <span>Kiểm tra gần nhất: {inspectedHousehold.lastCheckedDate}</span>
                  <span>Cán bộ: {inspectedHousehold.officerInCharge}</span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="pt-2 flex flex-col gap-2">
                <button
                  id="btn-view-household-detail"
                  onClick={() => onSelectHousehold(inspectedHousehold)}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
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
