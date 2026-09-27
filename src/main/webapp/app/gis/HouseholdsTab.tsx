import React, { useState, useMemo } from 'react';
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
import { HouseholdFacility, ResidenceType } from './types';
import { getHouseholdResidenceType, RESIDENCE_TYPE_CONFIG } from './utils/residenceUtils';

interface HouseholdsTabProps {
  households: HouseholdFacility[];
  onSelectHousehold: (household: HouseholdFacility) => void;
  onOpenAddModal: () => void;
  onDeleteHousehold?: (id: string) => void;
}

export const HouseholdsTab: React.FC<HouseholdsTabProps> = ({ households, onSelectHousehold, onOpenAddModal, onDeleteHousehold }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHamlet, setSelectedHamlet] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<'all' | 'household' | 'business' | 'special_monitoring'>('all');
  const [selectedResidenceType, setSelectedResidenceType] = useState<'all' | ResidenceType>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const hamletList = useMemo(() => {
    return Array.from(new Set(households.map(h => h.hamlet).filter(Boolean))).sort();
  }, [households]);

  // Calculate dynamic counts for residence type quick chips
  const residenceCounts = {
    all: households.length,
    'Thường trú': households.filter(h => getHouseholdResidenceType(h) === 'Thường trú').length,
    'Tạm trú': households.filter(h => getHouseholdResidenceType(h) === 'Tạm trú').length,
    'Lưu trú': households.filter(h => getHouseholdResidenceType(h) === 'Lưu trú').length,
  };

  const filtered = households.filter(h => {
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

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedHamlet('all');
    setSelectedType('all');
    setSelectedResidenceType('all');
  };

  const isAnyFilterActive =
    searchTerm.trim() !== '' || selectedHamlet !== 'all' || selectedType !== 'all' || selectedResidenceType !== 'all';

  const handleExportCSV = () => {
    const headers = [
      'Mã Quản Lý',
      'Số Nhà',
      'Đường',
      'Khu Vực',
      'Chủ Hộ / Cơ Sở',
      'SĐT',
      'Phân Loại',
      'Loại Hình Cư Trú',
      'Tổng Nhân Khẩu',
      'Nam',
      'Nữ',
      'Trạng Thái',
      'Ghi Chú',
    ];
    const rows = filtered.map(h => [
      h.code,
      h.houseNumber,
      h.street,
      h.hamlet,
      h.businessName || h.ownerName,
      h.ownerPhone,
      h.type === 'business' ? 'Cơ sở kinh doanh' : h.type === 'special_monitoring' ? 'Đối tượng chú ý' : 'Hộ dân',
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
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
          Hết hạn: {item.licenseExpiry}
        </span>
      );
    } else if (item.status === 'alert') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-rose-50 text-rose-900 border border-rose-300 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
          Quản lý định kỳ
        </span>
      );
    } else if (item.status === 'business') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
          GPKD hợp lệ
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        Hợp lệ
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
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <div
              id="household-eyebrow"
              className="text-[11px] sm:text-xs font-bold text-blue-600 tracking-wider uppercase mb-1 flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>DỮ LIỆU ĐỊA BÀN & CƯ TRÚ</span>
            </div>
            <h2 id="household-title" className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Danh sách hộ dân & Cơ sở
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1">
              Quản lý toàn bộ {households.length} hộ dân, cơ sở kinh doanh và đối tượng theo dõi thuộc Xã Bà Điểm, Hóc Môn.
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
            <button
              id="export-csv-button"
              onClick={handleExportCSV}
              className="flex-1 sm:flex-initial px-3.5 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all duration-150 flex items-center justify-center gap-1.5 min-h-[40px] cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Xuất file (CSV)</span>
            </button>

            <button
              id="add-household-button"
              onClick={onOpenAddModal}
              className="flex-1 sm:flex-initial px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-md transition-all duration-200 flex items-center justify-center gap-1.5 min-h-[40px] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm hộ mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Filter Chips (Bộ lọc nhanh theo loại hình cư trú - optimized for mobile & desktop) */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
        {/* Header line for quick filter chips */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Bộ lọc nhanh cư trú:</span>
            </span>
            <span className="hidden sm:inline text-[11px] text-slate-400">(Chạm để lọc nhanh theo hình thức cư trú trên địa bàn)</span>
          </div>

          {isAnyFilterActive && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-700 font-bold px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
              title="Đặt lại tất cả các bộ lọc"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Xoá bộ lọc</span>
            </button>
          )}
        </div>

        {/* Scrollable Quick Filter Chips for easy touch and navigation */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 sm:pb-0 scrollbar-none -mx-1 px-1">
          {/* Chip 1: Tất cả cư trú */}
          <button
            id="residence-chip-all"
            type="button"
            onClick={() => setSelectedResidenceType('all')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 cursor-pointer flex items-center gap-2 transition-all duration-200 active:scale-95 select-none ${
              selectedResidenceType === 'all'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 ring-2 ring-blue-500/30 border border-blue-600'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
            }`}
          >
            <Home className="w-3.5 h-3.5 shrink-0" />
            <span>Tất cả cư trú</span>
            <span
              className={`px-1.5 py-0.2 text-[10px] font-mono rounded-full font-bold ${
                selectedResidenceType === 'all' ? 'bg-blue-700 text-white' : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              {residenceCounts.all}
            </span>
          </button>

          {/* Chip 2: Thường trú */}
          <button
            id="residence-chip-thuong-tru"
            type="button"
            onClick={() => setSelectedResidenceType('Thường trú')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 cursor-pointer flex items-center gap-2 transition-all duration-200 active:scale-95 select-none ${
              selectedResidenceType === 'Thường trú'
                ? RESIDENCE_TYPE_CONFIG['Thường trú'].activeChipBg +
                  ' ' +
                  RESIDENCE_TYPE_CONFIG['Thường trú'].activeChipText +
                  ' shadow-md shadow-emerald-500/20 ' +
                  RESIDENCE_TYPE_CONFIG['Thường trú'].activeChipRing +
                  ' border ' +
                  RESIDENCE_TYPE_CONFIG['Thường trú'].activeChipBorder
                : RESIDENCE_TYPE_CONFIG['Thường trú'].inactiveChipBg +
                  ' ' +
                  RESIDENCE_TYPE_CONFIG['Thường trú'].inactiveChipText +
                  ' border ' +
                  RESIDENCE_TYPE_CONFIG['Thường trú'].inactiveChipBorder +
                  ' ' +
                  RESIDENCE_TYPE_CONFIG['Thường trú'].inactiveChipHover
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Thường trú</span>
            <span
              className={`px-1.5 py-0.2 text-[10px] font-mono rounded-full font-bold ${
                selectedResidenceType === 'Thường trú' ? 'bg-emerald-700 text-white' : 'bg-white text-emerald-800 border border-emerald-200'
              }`}
            >
              {residenceCounts['Thường trú']}
            </span>
          </button>

          {/* Chip 3: Tạm trú */}
          <button
            id="residence-chip-tam-tru"
            type="button"
            onClick={() => setSelectedResidenceType('Tạm trú')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 cursor-pointer flex items-center gap-2 transition-all duration-200 active:scale-95 select-none ${
              selectedResidenceType === 'Tạm trú'
                ? RESIDENCE_TYPE_CONFIG['Tạm trú'].activeChipBg +
                  ' ' +
                  RESIDENCE_TYPE_CONFIG['Tạm trú'].activeChipText +
                  ' shadow-md shadow-amber-500/20 ' +
                  RESIDENCE_TYPE_CONFIG['Tạm trú'].activeChipRing +
                  ' border ' +
                  RESIDENCE_TYPE_CONFIG['Tạm trú'].activeChipBorder
                : RESIDENCE_TYPE_CONFIG['Tạm trú'].inactiveChipBg +
                  ' ' +
                  RESIDENCE_TYPE_CONFIG['Tạm trú'].inactiveChipText +
                  ' border ' +
                  RESIDENCE_TYPE_CONFIG['Tạm trú'].inactiveChipBorder +
                  ' ' +
                  RESIDENCE_TYPE_CONFIG['Tạm trú'].inactiveChipHover
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>Tạm trú</span>
            <span
              className={`px-1.5 py-0.2 text-[10px] font-mono rounded-full font-bold ${
                selectedResidenceType === 'Tạm trú' ? 'bg-amber-700 text-white' : 'bg-white text-amber-900 border border-amber-200'
              }`}
            >
              {residenceCounts['Tạm trú']}
            </span>
          </button>

          {/* Chip 4: Lưu trú */}
          <button
            id="residence-chip-luu-tru"
            type="button"
            onClick={() => setSelectedResidenceType('Lưu trú')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 cursor-pointer flex items-center gap-2 transition-all duration-200 active:scale-95 select-none ${
              selectedResidenceType === 'Lưu trú'
                ? RESIDENCE_TYPE_CONFIG['Lưu trú'].activeChipBg +
                  ' ' +
                  RESIDENCE_TYPE_CONFIG['Lưu trú'].activeChipText +
                  ' shadow-md shadow-purple-500/20 ' +
                  RESIDENCE_TYPE_CONFIG['Lưu trú'].activeChipRing +
                  ' border ' +
                  RESIDENCE_TYPE_CONFIG['Lưu trú'].activeChipBorder
                : RESIDENCE_TYPE_CONFIG['Lưu trú'].inactiveChipBg +
                  ' ' +
                  RESIDENCE_TYPE_CONFIG['Lưu trú'].inactiveChipText +
                  ' border ' +
                  RESIDENCE_TYPE_CONFIG['Lưu trú'].inactiveChipBorder +
                  ' ' +
                  RESIDENCE_TYPE_CONFIG['Lưu trú'].inactiveChipHover
            }`}
          >
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            <span>Lưu trú</span>
            <span
              className={`px-1.5 py-0.2 text-[10px] font-mono rounded-full font-bold ${
                selectedResidenceType === 'Lưu trú' ? 'bg-purple-700 text-white' : 'bg-white text-purple-900 border border-purple-200'
              }`}
            >
              {residenceCounts['Lưu trú']}
            </span>
          </button>
        </div>

        {/* Secondary Bar: Search & Sub-filters */}
        <div className="pt-2 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm tên chủ hộ, cơ sở, số nhà, SĐT, loại cư trú..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-colors"
            />
          </div>

          {/* Sub-filters & View Toggle */}
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 sm:pb-0 scrollbar-none">
            {/* Hamlet filter */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0 gap-1 overflow-x-auto">
              <button
                onClick={() => setSelectedHamlet('all')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer shrink-0 ${
                  selectedHamlet === 'all' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả ấp ({households.length})
              </button>
              {hamletList.map(hamlet => {
                const count = households.filter(h => h.hamlet === hamlet).length;
                return (
                  <button
                    key={hamlet}
                    onClick={() => setSelectedHamlet(hamlet)}
                    className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer shrink-0 ${
                      selectedHamlet === hamlet ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {hamlet} ({count})
                  </button>
                );
              })}
            </div>

            {/* Type filter */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0">
              <button
                onClick={() => setSelectedType('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  selectedType === 'all' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả loại
              </button>
              <button
                onClick={() => setSelectedType('household')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  selectedType === 'household' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Hộ dân
              </button>
              <button
                onClick={() => setSelectedType('business')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  selectedType === 'business' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cơ sở
              </button>
              <button
                onClick={() => setSelectedType('special_monitoring')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  selectedType === 'special_monitoring' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Chú ý
              </button>
            </div>

            {/* Desktop View Mode Toggle (Cards vs Table) */}
            <div className="hidden md:flex items-center bg-slate-100 p-1 rounded-xl shrink-0 ml-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-1 cursor-pointer ${
                  viewMode === 'grid' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Xem dạng thẻ (Cards)"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Thẻ</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-1 cursor-pointer ${
                  viewMode === 'table' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Xem dạng bảng (Table)"
              >
                <List className="w-3.5 h-3.5" />
                <span>Bảng</span>
              </button>
            </div>
          </div>
        </div>

        {/* Active Filter Summary Pill Bar */}
        {isAnyFilterActive && (
          <div className="pt-2 flex items-center gap-2 flex-wrap text-xs">
            <span className="text-slate-500 text-[11px]">Đang lọc:</span>
            {selectedResidenceType !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-semibold">
                Cư trú: <strong>{selectedResidenceType}</strong>
                <button onClick={() => setSelectedResidenceType('all')} className="hover:text-blue-900 ml-0.5 cursor-pointer">
                  ×
                </button>
              </span>
            )}
            {selectedHamlet !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-semibold">
                Khu vực: <strong>{selectedHamlet}</strong>
                <button onClick={() => setSelectedHamlet('all')} className="hover:text-slate-900 ml-0.5 cursor-pointer">
                  ×
                </button>
              </span>
            )}
            {selectedType !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-semibold">
                Loại:{' '}
                <strong>
                  {selectedType === 'business' ? 'Cơ sở KD' : selectedType === 'special_monitoring' ? 'Đối tượng chú ý' : 'Hộ gia đình'}
                </strong>
                <button onClick={() => setSelectedType('all')} className="hover:text-slate-900 ml-0.5 cursor-pointer">
                  ×
                </button>
              </span>
            )}
            {searchTerm.trim() && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-semibold">
                Từ khoá: &quot;{searchTerm}&quot;
                <button onClick={() => setSearchTerm('')} className="hover:text-slate-900 ml-0.5 cursor-pointer">
                  ×
                </button>
              </span>
            )}
            <span className="text-slate-400 text-[11px] ml-auto">
              Tìm thấy <strong className="text-slate-700 font-bold">{filtered.length}</strong> kết quả
            </span>
          </div>
        )}
      </div>

      {/* Household Content Presentation */}
      <div id="household-content-panel">
        {/* VIEW 1: CARDS GRID (Always on Mobile, selectable on Desktop) */}
        <div className={`${viewMode === 'grid' ? 'block' : 'block md:hidden'}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
            {filtered.map(item => {
              const resType = getHouseholdResidenceType(item);

              return (
                <div
                  key={item.id}
                  onClick={() => onSelectHousehold(item)}
                  className="group relative bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-4.5 shadow-xs transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl hover:border-blue-400/80 hover:bg-linear-to-b hover:from-blue-50/25 hover:to-white cursor-pointer active:scale-[0.985] flex flex-col justify-between select-none"
                >
                  {/* Top Bar: Code + Hamlet + Badges */}
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-bold text-blue-600 group-hover:text-blue-700 transition-colors">
                          {item.code}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 font-mono text-slate-600 font-semibold group-hover:bg-blue-100/60 transition-colors">
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
                        <h4 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-blue-900 transition-colors leading-snug">
                          Số {item.houseNumber} {item.street}
                        </h4>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all duration-200 shrink-0" />
                      </div>

                      {/* Business or Special marker if applicable */}
                      {item.businessName && (
                        <div className="text-xs text-blue-700 font-bold mt-0.5 flex items-center gap-1">
                          <Store className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                          <span>{item.businessName}</span>
                          {item.businessCategory && (
                            <span className="text-[10px] text-slate-400 font-normal">• {item.businessCategory}</span>
                          )}
                        </div>
                      )}
                      {item.type === 'special_monitoring' && (
                        <div className="text-[11px] text-rose-700 font-semibold mt-0.5 flex items-center gap-1">
                          <AlertOctagon className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                          <span>Diện quản lý an ninh trật tự</span>
                        </div>
                      )}
                    </div>

                    {/* Middle Info Box with smooth background transition */}
                    <div className="bg-slate-50/80 group-hover:bg-blue-50/40 border border-slate-100 group-hover:border-blue-100/60 p-2.5 sm:p-3 rounded-xl text-xs space-y-1.5 transition-all duration-200">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500 text-[11px]">Chủ hộ / Đại diện:</span>
                        <span className="font-bold text-slate-800 text-right truncate">{item.ownerName}</span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500 text-[11px]">Nhân khẩu cư trú:</span>
                        <span className="font-semibold text-slate-700">
                          {item.residentsCount} người ({item.maleCount} Nam, {item.femaleCount} Nữ)
                        </span>
                      </div>

                      {item.lastCheckedDate && (
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60 text-[11px]">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Kiểm tra gần nhất:
                          </span>
                          <span className="font-mono text-slate-600 font-medium">{item.lastCheckedDate}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100">
                    <a
                      href={`tel:${item.ownerPhone}`}
                      onClick={e => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 text-xs text-blue-700 font-semibold font-mono py-1.5 px-2.5 rounded-xl bg-blue-50 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 active:scale-95 transition-all duration-150"
                      title="Gọi điện liên hệ chủ hộ"
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
                                `Bạn có chắc chắn muốn xóa hồ sơ hộ Số ${item.houseNumber} đường ${item.street} (${item.ownerName}) khỏi PostgreSQL?`,
                              )
                            ) {
                              onDeleteHousehold(item.id);
                            }
                          }}
                          className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-600 rounded-xl text-xs font-bold transition-all duration-150 inline-flex items-center gap-1 min-h-[34px] cursor-pointer"
                          title="Xóa hộ dân này"
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
                        <span>Chi tiết</span>
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
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[11px] tracking-wider">
                    <th className="py-3.5 px-4">Mã số</th>
                    <th className="py-3.5 px-4">Địa chỉ</th>
                    <th className="py-3.5 px-4">Khu vực</th>
                    <th className="py-3.5 px-4">Cư trú</th>
                    <th className="py-3.5 px-4">Chủ hộ / Cơ sở</th>
                    <th className="py-3.5 px-4">Liên hệ</th>
                    <th className="py-3.5 px-4">Phân loại</th>
                    <th className="py-3.5 px-4 text-center">Nhân khẩu</th>
                    <th className="py-3.5 px-4">Hồ sơ</th>
                    <th className="py-3.5 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(item => {
                    const resType = getHouseholdResidenceType(item);

                    return (
                      <tr
                        key={item.id}
                        onClick={() => onSelectHousehold(item)}
                        className="hover:bg-blue-50/50 transition-all duration-150 cursor-pointer group"
                      >
                        <td className="py-3.5 px-4 font-mono font-bold text-blue-600 group-hover:text-blue-700">{item.code}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-800">
                          Số {item.houseNumber} {item.street}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold font-mono text-[11px]">
                            {item.hamlet}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">{renderResidenceBadge(resType)}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {item.businessName ? (
                            <div className="flex flex-col">
                              <span className="text-blue-900 font-extrabold">{item.businessName}</span>
                              <span className="text-[11px] text-slate-400 font-normal">Chủ: {item.ownerName}</span>
                            </div>
                          ) : (
                            item.ownerName
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">{item.ownerPhone}</td>
                        <td className="py-3.5 px-4">
                          {item.type === 'business' ? (
                            <span className="inline-flex items-center gap-1 text-blue-700 font-semibold">
                              <Store className="w-3.5 h-3.5" />
                              Cơ sở KD
                            </span>
                          ) : item.type === 'special_monitoring' ? (
                            <span className="inline-flex items-center gap-1 text-rose-700 font-semibold">
                              <AlertOctagon className="w-3.5 h-3.5" />
                              Chú ý
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                              <Building className="w-3.5 h-3.5 text-slate-400" />
                              Hộ dân
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                          <span className="px-2 py-0.5 bg-slate-100 rounded-full font-mono">
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
                                      `Bạn có chắc chắn muốn xóa hồ sơ hộ Số ${item.houseNumber} đường ${item.street} (${item.ownerName}) khỏi PostgreSQL?`,
                                    )
                                  ) {
                                    onDeleteHousehold(item.id);
                                  }
                                }}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-600 rounded-lg text-[11px] font-bold transition-all duration-150 inline-flex items-center gap-1 cursor-pointer"
                                title="Xóa hộ dân này"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Xóa</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                onSelectHousehold(item);
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 rounded-lg text-[11px] font-bold transition-all duration-150 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Xem chi tiết</span>
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
          <div className="py-16 text-center bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-800">Không tìm thấy hộ dân hoặc cơ sở phù hợp</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Không có dữ liệu nào khớp với từ khoá tìm kiếm hoặc tiêu chí lọc cư trú đang chọn. Vui lòng thử lại với tiêu chí khác.
            </p>
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all duration-150 inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Đặt lại bộ lọc</span>
            </button>
          </div>
        )}

        {/* Bottom Pagination / Count Summary */}
        <div className="mt-4 p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2 flex-wrap">
            <span>
              Đang hiển thị <strong className="text-slate-800 font-bold">{filtered.length}</strong> trên tổng số {households.length} hộ/cơ
              sở
            </span>
            {selectedResidenceType !== 'all' && (
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                Lọc cư trú: {selectedResidenceType}
              </span>
            )}
          </div>
          <span className="font-semibold text-slate-700">Phụ trách: CSKV Nguyễn Văn Bình — P. An Lạc</span>
        </div>
      </div>
    </div>
  );
};
