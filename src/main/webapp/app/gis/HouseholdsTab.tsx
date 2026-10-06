import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Filter,
  Eye,
  Phone,
  Building,
  Store,
  AlertOctagon,
  CheckCircle,
  FileSpreadsheet,
  Home,
  Clock,
  Building2,
  ShieldCheck,
  ChevronRight,
  LayoutGrid,
  List,
  RotateCcw,
  Sparkles,
  MapPin,
  Calendar,
  Trash2,
} from 'lucide-react';
import { HouseholdFacility, ResidenceType, AppUser } from './types';
import { getHouseholdResidenceType, RESIDENCE_TYPE_CONFIG } from './utils/residenceUtils';
import { Pagination } from './components/Pagination';

interface HouseholdsTabProps {
  households: HouseholdFacility[];
  currentUser?: AppUser | null;
  onSelectHousehold: (household: HouseholdFacility) => void;
  onOpenAddModal: () => void;
  onDeleteHousehold?: (id: string) => void;
  onShowToast?: (msg: string) => void;
}

export const HouseholdsTab: React.FC<HouseholdsTabProps> = ({
  households,
  currentUser,
  onSelectHousehold,
  onOpenAddModal,
  onDeleteHousehold,
  onShowToast,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHamlet, setSelectedHamlet] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<'all' | 'household' | 'business' | 'special_monitoring'>('all');
  const [selectedResidenceType, setSelectedResidenceType] = useState<'all' | ResidenceType>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const hamletList = useMemo(() => {
    return Array.from(new Set(households.map(h => h.hamlet).filter(Boolean))).sort();
  }, [households]);

  // Calculate dynamic counts for residence type quick chips
  const residenceCounts = {
    all: households.length,
    'ThÆ°á»ng trÃº': households.filter(h => getHouseholdResidenceType(h) === 'ThÆ°á»ng trÃº').length,
    'Táº¡m trÃº': households.filter(h => getHouseholdResidenceType(h) === 'Táº¡m trÃº').length,
    'LÆ°u trÃº': households.filter(h => getHouseholdResidenceType(h) === 'LÆ°u trÃº').length,
  };

  const filtered = useMemo(() => {
    return households.filter(h => {
      if (selectedHamlet !== 'all' && h.hamlet !== selectedHamlet) return false;
      if (selectedType !== 'all' && h.type !== selectedType) return false;
      if (selectedResidenceType !== 'all' && getHouseholdResidenceType(h) !== selectedResidenceType) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchOwner = h.ownerName ? h.ownerName.toLowerCase().includes(q) : false;
        const matchHouse = h.houseNumber ? h.houseNumber.toLowerCase().includes(q) : false;
        const matchStreet = h.street ? h.street.toLowerCase().includes(q) : false;
        const matchPhone = h.ownerPhone ? h.ownerPhone.includes(q) : false;
        const matchBiz = h.businessName?.toLowerCase().includes(q) || false;
        const matchCode = h.code ? h.code.toLowerCase().includes(q) : false;
        const resType = getHouseholdResidenceType(h);
        const matchRes = resType ? resType.toLowerCase().includes(q) : false;
        if (!matchOwner && !matchHouse && !matchStreet && !matchPhone && !matchBiz && !matchCode && !matchRes) {
          return false;
        }
      }
      return true;
    });
  }, [households, selectedHamlet, selectedType, selectedResidenceType, searchTerm]);

  // Reset pagination to first page when filtering
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedHamlet, selectedType, selectedResidenceType]);

  // Slice paginated items for smooth and fast rendering
  const paginatedHouseholds = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedHamlet('all');
    setSelectedType('all');
    setSelectedResidenceType('all');
    setCurrentPage(1);
  };

  const isAnyFilterActive =
    searchTerm.trim() !== '' || selectedHamlet !== 'all' || selectedType !== 'all' || selectedResidenceType !== 'all';

  const handleExportCSV = () => {
    if (currentUser?.role === 'officer' && currentUser?.subAdminPermissions?.canExportReports === false) {
      const msg = 'âš ï¸ Tháº©m quyá»n bá»‹ khÃ³a: Báº¡n chÆ°a Ä‘Æ°á»£c phÃ¢n quyá»n xuáº¥t bÃ¡o cÃ¡o danh sÃ¡ch CSV/Excel.';
      if (onShowToast) onShowToast(msg);
      else alert(msg);
      return;
    }

    const headers = [
      'MÃ£ Quáº£n LÃ½',
      'Sá»‘ NhÃ ',
      'ÄÆ°á»ng',
      'Khu Vá»±c',
      'Chá»§ Há»™ / CÆ¡ Sá»Ÿ',
      'SÄT',
      'PhÃ¢n Loáº¡i',
      'Loáº¡i HÃ¬nh CÆ° TrÃº',
      'Tá»•ng NhÃ¢n Kháº©u',
      'Nam',
      'Ná»¯',
      'Tráº¡ng ThÃ¡i',
      'Ghi ChÃº',
    ];
    const rows = filtered.map(h => [
      h.code,
      h.houseNumber,
      h.street,
      h.hamlet,
      h.businessName || h.ownerName,
      h.ownerPhone,
      h.type === 'business' ? 'CÆ¡ sá»Ÿ kinh doanh' : h.type === 'special_monitoring' ? 'Äá»‘i tÆ°á»£ng chÃº Ã½' : 'Há»™ dÃ¢n',
      getHouseholdResidenceType(h),
      h.residentsCount,
      h.maleCount,
      h.femaleCount,
      h.status,
      `"${(h.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `danh_sach_dia_ban_P_An_Lac_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper renderer for status badge
  const renderStatusBadge = (item: HouseholdFacility) => {
    if (item.status === 'warning') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
          Háº¿t háº¡n: {item.licenseExpiry}
        </span>
      );
    } else if (item.status === 'alert') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-300 border border-rose-300 dark:border-rose-700 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
          Quáº£n lÃ½ Ä‘á»‹nh ká»³
        </span>
      );
    } else if (item.status === 'business') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-700 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
          GPKD há»£p lá»‡
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        Há»£p lá»‡
      </span>
    );
  };

  // Helper renderer for residence type badge
  const renderResidenceBadge = (resType: ResidenceType) => {
    const config = RESIDENCE_TYPE_CONFIG[resType];
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold ${config.badgeBg} ${config.badgeText} border ${config.badgeBorder} shadow-2xs`}
        title={config.description}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${config.dotBg}`}></span>
        {config.label}
      </span>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-5 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <div
              id="household-eyebrow"
              className="text-[11px] sm:text-xs font-bold text-blue-600 dark:text-blue-400 tracking-wider uppercase mb-1 flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Dá»® LIá»†U Äá»ŠA BÃ€N & CÆ¯ TRÃš</span>
            </div>
            <h2 id="household-title" className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Danh sÃ¡ch há»™ dÃ¢n & CÆ¡ sá»Ÿ
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1">
              Quáº£n lÃ½ toÃ n bá»™ {households.length} há»™ dÃ¢n, cÆ¡ sá»Ÿ kinh doanh vÃ  Ä‘á»‘i tÆ°á»£ng theo dÃµi thuá»™c XÃ£ BÃ  Äiá»ƒm,
              HÃ³c MÃ´n.
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
            <button
              id="export-csv-button"
              onClick={handleExportCSV}
              className="flex-1 sm:flex-initial px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 transition-all duration-150 flex items-center justify-center gap-1.5 min-h-[40px] cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Xuáº¥t file (CSV)</span>
            </button>

            <button
              id="add-household-button"
              onClick={onOpenAddModal}
              className="flex-1 sm:flex-initial px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-md transition-all duration-200 flex items-center justify-center gap-1.5 min-h-[40px] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>ThÃªm há»™ má»›i</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Filter Chips (Bá»™ lá»c nhanh theo loáº¡i hÃ¬nh cÆ° trÃº - optimized for mobile & desktop) */}
      <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3">
        {/* Header line for quick filter chips */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Bá»™ lá»c nhanh cÆ° trÃº:</span>
            </span>
            <span className="hidden sm:inline text-[11px] text-slate-400 dark:text-slate-400">
              (Cháº¡m Ä‘á»ƒ lá»c nhanh theo hÃ¬nh thá»©c cÆ° trÃº trÃªn Ä‘á»‹a bÃ n)
            </span>
          </div>

          {isAnyFilterActive && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 font-bold px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
              title="Äáº·t láº¡i táº¥t cáº£ cÃ¡c bá»™ lá»c"
            >
              <RotateCcw className="w-3 h-3" />
              <span>XoÃ¡ bá»™ lá»c</span>
            </button>
          )}
        </div>

        {/* Scrollable Quick Filter Chips for easy touch and navigation */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 sm:pb-0 scrollbar-none -mx-1 px-1">
          {/* Chip 1: Táº¥t cáº£ cÆ° trÃº */}
          <button
            id="residence-chip-all"
            type="button"
            onClick={() => setSelectedResidenceType('all')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 cursor-pointer flex items-center gap-2 transition-all duration-200 active:scale-95 select-none ${
              selectedResidenceType === 'all'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 ring-2 ring-blue-500/30 border border-blue-600'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <Home className="w-3.5 h-3.5 shrink-0" />
            <span>Táº¥t cáº£ cÆ° trÃº</span>
            <span
              className={`px-1.5 py-0.2 text-[10px] font-mono rounded-full font-bold ${
                selectedResidenceType === 'all'
                  ? 'bg-blue-700 text-white'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {residenceCounts.all}
            </span>
          </button>

          {/* Chip 2: ThÆ°á»ng trÃº */}
          <button
            id="residence-chip-thuong-tru"
            type="button"
            onClick={() => setSelectedResidenceType('ThÆ°á»ng trÃº')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 cursor-pointer flex items-center gap-2 transition-all duration-200 active:scale-95 select-none ${
              selectedResidenceType === 'ThÆ°á»ng trÃº'
                ? RESIDENCE_TYPE_CONFIG['ThÆ°á»ng trÃº'].activeChipBg +
                  ' ' +
                  RESIDENCE_TYPE_CONFIG['ThÆ°á»ng trÃº'].activeChipText +
                  ' shadow-md shadow-emerald-500/20 ' +
                  RESIDENCE_TYPE_CONFIG['ThÆ°á»ng trÃº'].activeChipRing +
                  ' border ' +
                  RESIDENCE_TYPE_CONFIG['ThÆ°á»ng trÃº'].activeChipBorder
                : RESIDENCE_TYPE_CONFIG['ThÆ°á»ng trÃº'].inactiveChipBg +
                  ' ' +
                  RESIDENCE_TYPE_CONFIG['ThÆ°á»ng trÃº'].inactiveChipText +
                  ' border ' +
                  RESIDENCE_TYPE_CONFIG['ThÆ°á»ng trÃº'].inactiveChipBorder +
                  ' ' +
                  RESIDENCE_TYPE_CONFIG['ThÆ°á»ng trÃº'].inactiveChipHover
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>ThÆ°á»ng trÃº</span>
            <span
              className={`px-1.5 py-0.2 text-[10px] font-mono rounded-full font-bold ${
                selectedResidenceType === 'ThÆ°á»ng trÃº'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              }`}
            >
              {residenceCounts['ThÆ°á»ng trÃº']}
            </span>
          </button>

          {/* Chip 3: Táº¡m trÃº */}
          <button
            id="residence-chip-tam-tru"
            type="button"
            onClick={() => setSelectedResidenceType('Táº¡m trÃº')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 cursor-pointer flex items-center gap-2 transition-all duration-200 active:scale-95 select-none ${
              selectedResidenceType === 'Táº¡m trÃº'
                ? RESIDENCE_TYPE_CONFIG['Táº¡m trÃº'].activeChipBg +
                  ' ' +
                  RESIDENCE_TYPE_CONFIG['Táº¡m trÃº'].activeChipText +
                  ' shadow-md shadow-amber-500/20 ' +
                  RESIDENCE_TYPE_CONFIG['Táº¡m trÃº'].activeChipRing +
                  ' border ' +
                  RESIDENCE_TYPE_CONFIG['Táº¡m trÃº'].activeChipBorder
                : RESIDENCE_TYPE_CONFIG['Táº¡m trÃº'].inactiveChipBg +
                  ' ' +
                  RESIDENCE_TYPE_CONFIG['Táº¡m trÃº'].inactiveChipText +
                  ' border ' +
                  RESIDENCE_TYPE_CONFIG['Táº¡m trÃº'].inactiveChipBorder +
                  ' ' +
                  RESIDENCE_TYPE_CONFIG['Táº¡m trÃº'].inactiveChipHover
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>Táº¡m trÃº</span>
            <span
              className={`px-1.5 py-0.2 text-[10px] font-mono rounded-full font-bold ${
                selectedResidenceType === 'Táº¡m trÃº'
                  ? 'bg-amber-700 text-white'
                  : 'bg-white dark:bg-slate-900 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
              }`}
            >
              {residenceCounts['Táº¡m trÃº']}
            </span>
          </button>

          {/* Chip 4: LÆ°u trÃº */}
          <button
            id="residence-chip-luu-tru"
            type="button"
            onClick={() => setSelectedResidenceType('LÆ°u trÃº')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 cursor-pointer flex items-center gap-2 transition-all duration-200 active:scale-95 select-none ${
              selectedResidenceType === 'LÆ°u trÃº'
                ? RESIDENCE_TYPE_CONFIG['LÆ°u trÃº'].activeChipBg +
                  ' ' +
                  RESIDENCE_TYPE_CONFIG['LÆ°u trÃº'].activeChipText +
                  ' shadow-md shadow-purple-500/20 ' +
                  RESIDENCE_TYPE_CONFIG['LÆ°u trÃº'].activeChipRing +
                  ' border ' +
                  RESIDENCE_TYPE_CONFIG['LÆ°u trÃº'].activeChipBorder
                : RESIDENCE_TYPE_CONFIG['LÆ°u trÃº'].inactiveChipBg +
                  ' ' +
                  RESIDENCE_TYPE_CONFIG['LÆ°u trÃº'].inactiveChipText +
                  ' border ' +
                  RESIDENCE_TYPE_CONFIG['LÆ°u trÃº'].inactiveChipBorder +
                  ' ' +
                  RESIDENCE_TYPE_CONFIG['LÆ°u trÃº'].inactiveChipHover
            }`}
          >
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            <span>LÆ°u trÃº</span>
            <span
              className={`px-1.5 py-0.2 text-[10px] font-mono rounded-full font-bold ${
                selectedResidenceType === 'LÆ°u trÃº'
                  ? 'bg-purple-700 text-white'
                  : 'bg-white dark:bg-slate-900 text-purple-900 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
              }`}
            >
              {residenceCounts['LÆ°u trÃº']}
            </span>
          </button>
        </div>

        {/* Secondary Bar: Search & Sub-filters */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="TÃ¬m tÃªn chá»§ há»™, cÆ¡ sá»Ÿ, sá»‘ nhÃ , SÄT, loáº¡i cÆ° trÃº..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-colors"
            />
          </div>

          {/* Sub-filters & View Toggle */}
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 sm:pb-0 scrollbar-none">
            {/* Hamlet filter */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0 gap-1 overflow-x-auto border border-transparent dark:border-slate-700/60">
              <button
                onClick={() => setSelectedHamlet('all')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer shrink-0 ${
                  selectedHamlet === 'all'
                    ? 'bg-white dark:bg-blue-600 text-blue-700 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Táº¥t cáº£ áº¥p ({households.length})
              </button>
              {hamletList.map(hamlet => {
                const count = households.filter(h => h.hamlet === hamlet).length;
                return (
                  <button
                    key={hamlet}
                    onClick={() => setSelectedHamlet(hamlet)}
                    className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer shrink-0 ${
                      selectedHamlet === hamlet
                        ? 'bg-white dark:bg-blue-600 text-blue-700 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {hamlet} ({count})
                  </button>
                );
              })}
            </div>

            {/* Type filter */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0 border border-transparent dark:border-slate-700/60">
              <button
                onClick={() => setSelectedType('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  selectedType === 'all'
                    ? 'bg-white dark:bg-blue-600 text-blue-700 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Táº¥t cáº£ loáº¡i
              </button>
              <button
                onClick={() => setSelectedType('household')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  selectedType === 'household'
                    ? 'bg-white dark:bg-blue-600 text-blue-700 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Há»™ dÃ¢n
              </button>
              <button
                onClick={() => setSelectedType('business')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  selectedType === 'business'
                    ? 'bg-white dark:bg-blue-600 text-blue-700 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                CÆ¡ sá»Ÿ
              </button>
              <button
                onClick={() => setSelectedType('special_monitoring')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  selectedType === 'special_monitoring'
                    ? 'bg-white dark:bg-rose-600 text-rose-700 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                ChÃº Ã½
              </button>
            </div>

            {/* Desktop View Mode Toggle (Cards vs Table) */}
            <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0 ml-1 border border-transparent dark:border-slate-700/60">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-1 cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-blue-600 text-blue-700 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Xem dáº¡ng tháº» (Cards)"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Tháº»</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-1 cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-blue-600 text-blue-700 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Xem dáº¡ng báº£ng (Table)"
              >
                <List className="w-3.5 h-3.5" />
                <span>Báº£ng</span>
              </button>
            </div>
          </div>
        </div>

        {/* Active Filter Summary Pill Bar */}
        {isAnyFilterActive && (
          <div className="pt-2 flex items-center gap-2 flex-wrap text-xs">
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">Äang lá»c:</span>
            {selectedResidenceType !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] font-semibold">
                CÆ° trÃº: <strong>{selectedResidenceType}</strong>
                <button
                  onClick={() => setSelectedResidenceType('all')}
                  className="hover:text-blue-900 dark:hover:text-white ml-0.5 cursor-pointer"
                >
                  Ã—
                </button>
              </span>
            )}
            {selectedHamlet !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold">
                Khu vá»±c: <strong>{selectedHamlet}</strong>
                <button
                  onClick={() => setSelectedHamlet('all')}
                  className="hover:text-slate-900 dark:hover:text-white ml-0.5 cursor-pointer"
                >
                  Ã—
                </button>
              </span>
            )}
            {selectedType !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold">
                Loáº¡i:{' '}
                <strong>
                  {selectedType === 'business'
                    ? 'CÆ¡ sá»Ÿ KD'
                    : selectedType === 'special_monitoring'
                      ? 'Äá»‘i tÆ°á»£ng chÃº Ã½'
                      : 'Há»™ gia Ä‘Ã¬nh'}
                </strong>
                <button onClick={() => setSelectedType('all')} className="hover:text-slate-900 dark:hover:text-white ml-0.5 cursor-pointer">
                  Ã—
                </button>
              </span>
            )}
            {searchTerm.trim() && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold">
                Tá»« khoÃ¡: &quot;{searchTerm}&quot;
                <button onClick={() => setSearchTerm('')} className="hover:text-slate-900 dark:hover:text-white ml-0.5 cursor-pointer">
                  Ã—
                </button>
              </span>
            )}
            <span className="text-slate-400 text-[11px] ml-auto">
              TÃ¬m tháº¥y <strong className="text-slate-700 dark:text-slate-200 font-bold">{filtered.length}</strong> káº¿t quáº£
            </span>
          </div>
        )}
      </div>

      {/* Household Content Presentation */}
      <div id="household-content-panel">
        {/* VIEW 1: CARDS GRID (Always on Mobile, selectable on Desktop) */}
        <div className={`${viewMode === 'grid' ? 'block' : 'block md:hidden'}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
            {paginatedHouseholds.map(item => {
              const resType = getHouseholdResidenceType(item);

              return (
                <div
                  key={item.id}
                  onClick={() => onSelectHousehold(item)}
                  className="group relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-4.5 shadow-xs transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl hover:border-blue-400/80 dark:hover:border-blue-500/80 hover:bg-linear-to-b hover:from-blue-50/25 dark:hover:from-blue-950/30 hover:to-white dark:hover:to-slate-900 cursor-pointer active:scale-[0.985] flex flex-col justify-between select-none"
                >
                  {/* Top Bar: Code + Hamlet + Badges */}
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                          {item.code}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono text-slate-600 dark:text-slate-300 font-semibold group-hover:bg-blue-100/60 dark:group-hover:bg-blue-900/40 transition-colors">
                          {item.hamlet}
                        </span>
                        {/* Residence Type Badge */}
                        {renderResidenceBadge(resType)}
                      </div>

                      {/* Status badge */}
                      <div className="shrink-0">{renderStatusBadge(item)}</div>
                    </div>

                    {/* Address Title */}
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-900 dark:group-hover:text-blue-300 transition-colors leading-snug">
                          Sá»‘ {item.houseNumber} {item.street}
                        </h4>
                        <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-1 transition-all duration-200 shrink-0" />
                      </div>

                      {/* Business or Special marker if applicable */}
                      {item.businessName && (
                        <div className="text-xs text-blue-700 dark:text-blue-400 font-bold mt-0.5 flex items-center gap-1">
                          <Store className="w-3.5 h-3.5 shrink-0 text-blue-500 dark:text-blue-400" />
                          <span>{item.businessName}</span>
                          {item.businessCategory && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">â€¢ {item.businessCategory}</span>
                          )}
                        </div>
                      )}
                      {item.type === 'special_monitoring' && (
                        <div className="text-[11px] text-rose-700 dark:text-rose-400 font-semibold mt-0.5 flex items-center gap-1">
                          <AlertOctagon className="w-3.5 h-3.5 shrink-0 text-rose-500 dark:text-rose-400" />
                          <span>Diá»‡n quáº£n lÃ½ an ninh tráº­t tá»±</span>
                        </div>
                      )}
                    </div>

                    {/* Middle Info Box with smooth background transition */}
                    <div className="bg-slate-50/80 dark:bg-slate-800/80 group-hover:bg-blue-50/40 dark:group-hover:bg-blue-950/40 border border-slate-100 dark:border-slate-700/80 group-hover:border-blue-100/60 dark:group-hover:border-blue-900/60 p-2.5 sm:p-3 rounded-xl text-xs space-y-1.5 transition-all duration-200">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">Chá»§ há»™ / Äáº¡i diá»‡n:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-100 text-right truncate">{item.ownerName}</span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">NhÃ¢n kháº©u cÆ° trÃº:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {item.residentsCount} ngÆ°á»i ({item.maleCount} Nam, {item.femaleCount} Ná»¯)
                        </span>
                      </div>

                      {item.lastCheckedDate && (
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px]">
                          <span className="text-slate-400 dark:text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Kiá»ƒm tra gáº§n nháº¥t:
                          </span>
                          <span className="font-mono text-slate-600 dark:text-slate-300 font-medium">{item.lastCheckedDate}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 dark:border-slate-800">
                    <a
                      href={`tel:${item.ownerPhone}`}
                      onClick={e => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-300 font-semibold font-mono py-1.5 px-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800/80 hover:bg-blue-100 dark:hover:bg-blue-900/80 active:scale-95 transition-all duration-150"
                      title="Gá»i Ä‘iá»‡n liÃªn há»‡ chá»§ há»™"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>{item.ownerPhone}</span>
                    </a>

                    <div className="flex items-center gap-1.5">
                      {onDeleteHousehold && (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            if (
                              window.confirm(
                                `Báº¡n cÃ³ cháº¯c cháº¯n muá»‘n xÃ³a há»“ sÆ¡ há»™ Sá»‘ ${item.houseNumber} Ä‘Æ°á»ng ${item.street} (${item.ownerName}) khá»i PostgreSQL?`,
                              )
                            ) {
                              onDeleteHousehold(item.id);
                            }
                          }}
                          className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-600 dark:hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold border border-rose-200 dark:border-rose-900/60 transition-all duration-150 inline-flex items-center gap-1 min-h-[34px] cursor-pointer"
                          title="XÃ³a há»™ dÃ¢n nÃ y"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onSelectHousehold(item);
                        }}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all duration-200 shadow-xs hover:shadow-md inline-flex items-center gap-1.5 min-h-[34px] cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Chi tiáº¿t</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* VIEW 2: DESKTOP TABLE (When table mode is selected on >= md screens) */}
        {viewMode === 'table' && (
          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold uppercase text-[11px] tracking-wider">
                    <th className="py-3.5 px-4">MÃ£ sá»‘</th>
                    <th className="py-3.5 px-4">Äá»‹a chá»‰</th>
                    <th className="py-3.5 px-4">Khu vá»±c</th>
                    <th className="py-3.5 px-4">CÆ° trÃº</th>
                    <th className="py-3.5 px-4">Chá»§ há»™ / CÆ¡ sá»Ÿ</th>
                    <th className="py-3.5 px-4">LiÃªn há»‡</th>
                    <th className="py-3.5 px-4">PhÃ¢n loáº¡i</th>
                    <th className="py-3.5 px-4 text-center">NhÃ¢n kháº©u</th>
                    <th className="py-3.5 px-4">Há»“ sÆ¡</th>
                    <th className="py-3.5 px-4 text-right">Thao tÃ¡c</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedHouseholds.map(item => {
                    const resType = getHouseholdResidenceType(item);

                    return (
                      <tr
                        key={item.id}
                        onClick={() => onSelectHousehold(item)}
                        className="hover:bg-blue-50/50 dark:hover:bg-blue-950/40 transition-all duration-150 cursor-pointer group"
                      >
                        <td className="py-3.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300">
                          {item.code}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-100">
                          Sá»‘ {item.houseNumber} {item.street}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold font-mono text-[11px] border border-slate-200 dark:border-slate-700">
                            {item.hamlet}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">{renderResidenceBadge(resType)}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                          {item.businessName ? (
                            <div className="flex flex-col">
                              <span className="text-blue-900 dark:text-blue-300 font-extrabold">{item.businessName}</span>
                              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">Chá»§: {item.ownerName}</span>
                            </div>
                          ) : (
                            item.ownerName
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400">{item.ownerPhone}</td>
                        <td className="py-3.5 px-4">
                          {item.type === 'business' ? (
                            <span className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-400 font-semibold">
                              <Store className="w-3.5 h-3.5" />
                              CÆ¡ sá»Ÿ KD
                            </span>
                          ) : item.type === 'special_monitoring' ? (
                            <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-400 font-semibold">
                              <AlertOctagon className="w-3.5 h-3.5" />
                              ChÃº Ã½
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 font-medium">
                              <Building className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                              Há»™ dÃ¢n
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full font-mono border border-slate-200 dark:border-slate-700">
                            {item.residentsCount} ({item.maleCount}N - {item.femaleCount}F)
                          </span>
                        </td>
                        <td className="py-3.5 px-4">{renderStatusBadge(item)}</td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {onDeleteHousehold && (
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  if (
                                    window.confirm(
                                      `Báº¡n cÃ³ cháº¯c cháº¯n muá»‘n xÃ³a há»“ sÆ¡ há»™ Sá»‘ ${item.houseNumber} Ä‘Æ°á»ng ${item.street} (${item.ownerName}) khá»i PostgreSQL?`,
                                    )
                                  ) {
                                    onDeleteHousehold(item.id);
                                  }
                                }}
                                className="px-2 py-1 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-600 dark:hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 rounded-lg text-[11px] font-bold border border-rose-200 dark:border-rose-900/60 transition-all duration-150 inline-flex items-center gap-1 cursor-pointer"
                                title="XÃ³a há»™ dÃ¢n nÃ y"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>XÃ³a</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                onSelectHousehold(item);
                              }}
                              className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-700 dark:text-slate-200 rounded-lg text-[11px] font-bold border border-slate-200 dark:border-slate-700 transition-all duration-150 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Xem chi tiáº¿t</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty state when no households match filters */}
        {filtered.length === 0 && (
          <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-6 space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100">
              KhÃ´ng tÃ¬m tháº¥y há»™ dÃ¢n hoáº·c cÆ¡ sá»Ÿ phÃ¹ há»£p
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              KhÃ´ng cÃ³ dá»¯ liá»‡u nÃ o khá»›p vá»›i tá»« khoÃ¡ tÃ¬m kiáº¿m hoáº·c tiÃªu chÃ­ lá»c cÆ° trÃº Ä‘ang chá»n. Vui lÃ²ng thá»­
              láº¡i vá»›i tiÃªu chÃ­ khÃ¡c.
            </p>
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all duration-150 inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Äáº·t láº¡i bá»™ lá»c</span>
            </button>
          </div>
        )}

        {/* Bottom Pagination Control */}
        {filtered.length > 0 && (
          <div className="mt-4 space-y-3">
            <Pagination
              currentPage={currentPage}
              totalItems={filtered.length}
              pageSize={pageSize}
              onPageChange={page => {
                setCurrentPage(page);
                const el = document.getElementById('household-content-panel');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              onPageSizeChange={size => {
                setPageSize(size);
                setCurrentPage(1);
              }}
              pageSizeOptions={[12, 24, 48, 96]}
              itemLabel="há»™ dÃ¢n & cÆ¡ sá»Ÿ"
            />
            <div className="px-3 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
              <span>
                Phá»¥ trÃ¡ch:{' '}
                {currentUser
                  ? `${currentUser.position || 'CSKV'} ${currentUser.fullName}${currentUser.unit ? ` â€” ${currentUser.unit}` : ''}`
                  : 'CÃ¡n bá»™ CSKV phá»¥ trÃ¡ch Ä‘á»‹a bÃ n'}
              </span>
              {selectedResidenceType !== 'all' && (
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800">
                  Lá»c cÆ° trÃº: {selectedResidenceType}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
