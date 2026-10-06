import React, { useState, useMemo, useEffect } from 'react';
import {
  Building,
  Store,
  AlertOctagon,
  CalendarClock,
  AlertTriangle,
  Users,
  ArrowRight,
  FileCheck,
  PhoneCall,
  Clock,
  CheckCircle,
  MapPin,
  UserCheck,
} from 'lucide-react';
import { HouseholdFacility, NavigationTab } from './types';
import { getEffectiveResidentsList } from './utils/residentRosterUtils';
import { Pagination } from './components/Pagination';

interface OverviewTabProps {
  households: HouseholdFacility[];
  onNavigateTab: (tab: NavigationTab) => void;
  onSelectHousehold: (household: HouseholdFacility) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ households, onNavigateTab, onSelectHousehold }) => {
  const totalCount = households.length;
  const businessCount = households.filter(h => h.type === 'business').length;
  const alertCount = households.filter(h => h.type === 'special_monitoring').length;
  const warningCount = households.filter(h => h.status === 'warning').length;

  // Demographics calculation grounded in real resident records
  const allResidents = useMemo(() => {
    return households.flatMap(h => getEffectiveResidentsList(h));
  }, [households]);

  const totalResidents = allResidents.length > 0 ? allResidents.length : households.reduce((sum, h) => sum + (h.residentsCount || 0), 0);

  const totalFemale =
    allResidents.length > 0
      ? allResidents.filter(r => r.gender === 'Nữ').length
      : households.reduce((sum, h) => sum + (h.femaleCount || 0), 0);

  const totalMale =
    allResidents.length > 0
      ? allResidents.filter(r => r.gender === 'Nam').length
      : households.reduce((sum, h) => sum + (h.maleCount || 0), 0);

  const totalUnder18 =
    allResidents.length > 0
      ? allResidents.filter(r => 2026 - (r.birthYear || 2000) < 18).length
      : households.reduce((sum, h) => sum + (h.under18Count || 0), 0);

  const totalAbove18 = Math.max(0, totalResidents - totalUnder18);

  const femalePercent = totalResidents > 0 ? Math.round((totalFemale / totalResidents) * 100) : 0;
  const malePercent = totalResidents > 0 ? Math.round((totalMale / totalResidents) * 100) : 0;
  const under18Percent = totalResidents > 0 ? Math.round((totalUnder18 / totalResidents) * 100) : 0;
  const above18Percent = totalResidents > 0 ? Math.round((totalAbove18 / totalResidents) * 100) : 0;

  const hamletNames = useMemo(() => {
    return Array.from(new Set(households.map(h => h.hamlet).filter(Boolean)));
  }, [households]);

  const warningHouseholds = households.filter(h => h.status === 'warning');
  const [warningCurrentPage, setWarningCurrentPage] = useState<number>(1);
  const [warningPageSize, setWarningPageSize] = useState<number>(10);

  useEffect(() => {
    setWarningCurrentPage(1);
  }, [warningHouseholds.length, warningPageSize]);

  const paginatedWarnings = useMemo(() => {
    const start = (warningCurrentPage - 1) * warningPageSize;
    return warningHouseholds.slice(start, start + warningPageSize);
  }, [warningHouseholds, warningCurrentPage, warningPageSize]);

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Overview Title Banner */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <div
              id="overview-eyebrow"
              className="text-[11px] sm:text-xs font-bold text-blue-600 dark:text-blue-400 tracking-wider uppercase mb-1"
            >
              TRUNG TÂM ĐIỀU HÀNH
            </div>
            <h2 id="overview-title" className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Tổng quan địa bàn
            </h2>
            <p id="overview-description" className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1">
              Theo dõi nhanh tình hình an ninh, dân cư và cơ sở kinh doanh.
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => onNavigateTab('area-map')}
              className="flex-1 sm:flex-initial px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 min-h-[40px]"
            >
              <span>Xem sơ đồ khối</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onNavigateTab('households')}
              className="flex-1 sm:flex-initial px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center gap-1.5 min-h-[40px]"
            >
              <span>Danh sách {totalCount} hộ</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top 4 Key Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Total card */}
        <div
          id="stat-total-card"
          onClick={() => onNavigateTab('households')}
          className="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span id="stat-total-label" className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
              Tổng hộ / Cơ sở
            </span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
              <Building className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2">
            <span
              id="stat-total-value"
              className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono tracking-tight"
            >
              {totalCount}
            </span>
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium">hộ & cơ sở</span>
          </div>
          <div className="mt-2 sm:mt-3 text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 pt-1.5 sm:pt-2 border-t border-slate-100 dark:border-slate-800 truncate">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
            <span className="truncate">100% đã thu thập hồ sơ</span>
          </div>
        </div>

        {/* Business card */}
        <div
          id="stat-business-card"
          onClick={() => onNavigateTab('households')}
          className="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span id="stat-business-label" className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
              CSKD có điều kiện
            </span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
              <Store className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2">
            <span
              id="stat-business-value"
              className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono tracking-tight"
            >
              {businessCount}
            </span>
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium">điểm kinh doanh</span>
          </div>
          <div className="mt-2 sm:mt-3 text-[10px] sm:text-[11px] text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1 pt-1.5 sm:pt-2 border-t border-slate-100 dark:border-slate-800 truncate">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
            <span className="truncate">Quán net, cầm đồ, karaoke</span>
          </div>
        </div>

        {/* Warning card */}
        <div
          id="stat-warning-card"
          onClick={() => onNavigateTab('documents')}
          className="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-amber-300 dark:border-amber-700/80 shadow-xs hover:border-amber-400 transition-all cursor-pointer group flex flex-col justify-between bg-amber-50/20 dark:bg-amber-950/20"
        >
          <div className="flex items-center justify-between">
            <span
              id="stat-warning-label"
              className="text-[10px] sm:text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider truncate"
            >
              Cảnh báo hồ sơ
            </span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors shrink-0">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2">
            <span
              id="stat-warning-value"
              className="text-2xl sm:text-3xl font-extrabold text-amber-900 dark:text-amber-200 font-mono tracking-tight"
            >
              {warningCount}
            </span>
            <span className="text-[10px] sm:text-xs text-amber-700/80 dark:text-amber-400/80 font-medium">sắp hết hạn</span>
          </div>
          <div className="mt-2 sm:mt-3 text-[10px] sm:text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1 pt-1.5 sm:pt-2 border-t border-amber-200/60 dark:border-amber-800/60 truncate">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 animate-ping"></span>
            <span className="truncate">Cần kiểm tra gia hạn</span>
          </div>
        </div>

        {/* Population card */}
        <div
          id="stat-population-card"
          onClick={() => onNavigateTab('residents')}
          className="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-emerald-300 dark:hover:border-emerald-700 transition-all group flex flex-col justify-between cursor-pointer hover:shadow-sm"
          title="Bấm để mở danh sách Quản lý nhân khẩu & Định danh"
        >
          <div className="flex items-center justify-between">
            <span id="stat-population-label" className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
              Tổng nhân khẩu
            </span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
              <UserCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2">
            <span
              id="stat-population-value"
              className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono tracking-tight"
            >
              {totalResidents.toLocaleString('vi-VN')}
            </span>
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium">người dân</span>
          </div>
          <div className="mt-2 sm:mt-3 text-[10px] sm:text-[11px] text-emerald-700 dark:text-emerald-400 font-medium flex items-center justify-between pt-1.5 sm:pt-2 border-t border-slate-100 dark:border-slate-800 truncate">
            <div className="flex items-center gap-1 truncate">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
              <span className="truncate">TB ~{totalCount > 0 ? (totalResidents / totalCount).toFixed(1) : 0} người / hộ</span>
            </div>
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 group-hover:underline flex items-center gap-0.5">
              Tra cứu <ArrowRight className="w-2.5 h-2.5" />
            </span>
          </div>
        </div>
      </div>

      {/* Warning Box Banner */}
      {warningHouseholds.length > 0 && (
        <div
          id="warning-box"
          className="bg-[#fffbeb] dark:bg-amber-950/30 border-2 border-amber-300/90 dark:border-amber-700/80 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xs"
        >
          <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-100 dark:bg-amber-900/60 border border-amber-300 dark:border-amber-700 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0">
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="flex-1 w-full min-w-0">
              <h3 id="warning-title" className="text-sm sm:text-base font-bold text-[#78350f] dark:text-amber-200 leading-snug">
                CẢNH BÁO: {warningHouseholds.length} Cơ sở sắp hết hạn Giấy phép kinh doanh / An ninh trật tự
              </h3>
              <p className="text-xs text-amber-900/80 dark:text-amber-300/80 mt-1">
                Cán bộ CSKV cần kiểm tra thực địa, đôn đốc cơ sở nộp hồ sơ gia hạn đúng quy định trước ngày hết hiệu lực:
              </p>
              <div className="mt-3 space-y-2">
                {paginatedWarnings.map(item => (
                  <div
                    key={item.id}
                    id={`warning-line-${item.id}`}
                    onClick={() => onSelectHousehold(item)}
                    className="p-3 bg-white/90 dark:bg-slate-900/90 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 hover:bg-white dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                      <span className="truncate">
                        - {item.businessName || item.ownerName} - Số {item.houseNumber} {item.street}{' '}
                        {item.licenseExpiry ? `(Hết hạn: ${item.licenseExpiry})` : ''}
                      </span>
                    </div>
                    <span className="self-start sm:self-auto text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 font-bold shrink-0">
                      {item.warningMessage?.split('(')[0]?.trim() || 'Sắp hết hạn'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Pagination controls with 10/20/50 format */}
              {warningHouseholds.length > 0 && (
                <div className="mt-3">
                  <Pagination
                    currentPage={warningCurrentPage}
                    totalItems={warningHouseholds.length}
                    pageSize={warningPageSize}
                    pageSizeOptions={[10, 20, 50]}
                    onPageChange={setWarningCurrentPage}
                    onPageSizeChange={setWarningPageSize}
                    itemLabel="cơ sở cảnh báo"
                    className="!bg-white/80 dark:!bg-slate-900/80 !border-amber-300/80 dark:!border-amber-700/80 shadow-xs"
                  />
                </div>
              )}

              <div className="mt-3.5 sm:mt-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <button
                  onClick={() => onNavigateTab('documents')}
                  className="px-3.5 py-2 bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 min-h-[40px]"
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>Xem danh sách hồ sơ cần thẩm định</span>
                </button>
                <span className="text-[10px] sm:text-[11px] text-amber-800 dark:text-amber-400 italic">
                  * Thông báo nhắc hạn đã được gửi tự động qua hệ thống.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Demographics & Population Stats */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <div id="demographic-eyebrow" className="text-xs font-bold text-blue-600 dark:text-blue-400 tracking-wider uppercase mb-1">
              THỐNG KÊ NHÂN KHẨU
            </div>
            <h3 id="demographic-stats-title" className="text-xl font-bold text-[#1e293b] dark:text-white tracking-tight">
              Cơ cấu nhân khẩu
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Tổng số{' '}
              <span className="font-bold text-slate-800 dark:text-slate-200">{totalResidents.toLocaleString('vi-VN')} nhân khẩu</span> đang
              cư trú tại <strong className="text-slate-800 dark:text-slate-200">{totalCount} hộ & cơ sở</strong>
              {hamletNames.length > 0
                ? ` thuộc ${hamletNames.slice(0, 3).join(', ')}${hamletNames.length > 3 ? ` và ${hamletNames.length - 3} ấp khác` : ''}`
                : ' thuộc địa bàn quản lý'}
            </p>
          </div>
          <div className="self-start sm:self-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-full text-xs font-bold">
              <CheckCircle className="w-3.5 h-3.5" />
              Đã số hóa định danh VNeID
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Gender Card */}
          <div
            id="gender-orb-card"
            className="p-5 rounded-2xl bg-[#f8fafc] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 id="gender-orb-title" className="text-base font-bold text-[#1e293b] dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Tỷ lệ nam nữ</span>
              </h4>
              <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                {totalResidents.toLocaleString('vi-VN')} nhân khẩu
              </span>
            </div>

            {/* Visual ratio bar */}
            <div className="w-full h-4 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex shadow-inner">
              <div
                className="h-full bg-pink-500 transition-all duration-500"
                style={{ width: `${femalePercent}%` }}
                title={`Nữ: ${totalFemale} (${femalePercent}%)`}
              />
              <div
                className="h-full bg-blue-600 transition-all duration-500"
                style={{ width: `${malePercent}%` }}
                title={`Nam: ${totalMale} (${malePercent}%)`}
              />
            </div>

            {/* Gender labels */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-3 rounded-full bg-pink-500 inline-block"></span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Giới tính Nữ</span>
                </div>
                <div id="gender-female-label" className="text-sm font-bold text-[#334155] dark:text-white">
                  Nữ: {totalFemale.toLocaleString('vi-VN')} ({femalePercent}%)
                </div>
              </div>

              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Giới tính Nam</span>
                </div>
                <div id="gender-male-label" className="text-sm font-bold text-[#334155] dark:text-white">
                  Nam: {totalMale.toLocaleString('vi-VN')} ({malePercent}%)
                </div>
              </div>
            </div>
          </div>

          {/* Age Card */}
          <div
            id="age-orb-card"
            className="p-5 rounded-2xl bg-[#f8fafc] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 id="age-orb-title" className="text-base font-bold text-[#1e293b] dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>Cơ cấu độ tuổi</span>
              </h4>
              <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                {totalResidents.toLocaleString('vi-VN')} nhân khẩu
              </span>
            </div>

            {/* Visual ratio bar */}
            <div className="w-full h-4 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex shadow-inner">
              <div
                className="h-full bg-emerald-600 transition-all duration-500"
                style={{ width: `${above18Percent}%` }}
                title={`Từ 18 trở lên: ${totalAbove18} (${above18Percent}%)`}
              />
              <div
                className="h-full bg-amber-500 transition-all duration-500"
                style={{ width: `${under18Percent}%` }}
                title={`Dưới 18: ${totalUnder18} (${under18Percent}%)`}
              />
            </div>

            {/* Age labels */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block"></span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Độ tuổi trưởng thành</span>
                </div>
                <div id="age-adult-label" className="text-sm font-bold text-[#334155] dark:text-white">
                  Từ 18 trở lên: {totalAbove18.toLocaleString('vi-VN')} ({above18Percent}%)
                </div>
              </div>

              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Trẻ em & Thiếu niên</span>
                </div>
                <div id="age-under-label" className="text-sm font-bold text-[#334155] dark:text-white">
                  Dưới 18: {totalUnder18.toLocaleString('vi-VN')} ({under18Percent}%)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Status of Households Preview */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 id="overview-status-title" className="text-base font-bold text-slate-800 dark:text-white">
              Trạng thái địa bàn hôm nay
            </h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold border border-blue-100 dark:border-blue-900">
              {totalCount} vị trí giám sát
            </span>
          </div>
          <button
            onClick={() => onNavigateTab('area-map')}
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1"
          >
            Mở sơ đồ tương tác &rarr;
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {households.slice(0, 16).map(h => {
            let badgeBg =
              'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100';
            let statusDot = 'bg-emerald-500';
            if (h.status === 'warning') {
              badgeBg =
                'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-300 hover:bg-amber-100 ring-2 ring-amber-400/50';
              statusDot = 'bg-amber-500 animate-ping';
            } else if (h.status === 'alert') {
              badgeBg =
                'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-300 hover:bg-rose-100 ring-2 ring-rose-400/50';
              statusDot = 'bg-rose-500';
            } else if (h.status === 'business') {
              badgeBg =
                'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 hover:bg-blue-100';
              statusDot = 'bg-blue-500';
            }

            return (
              <div
                key={h.id}
                onClick={() => onSelectHousehold(h)}
                className={`p-2.5 rounded-xl border text-center cursor-pointer transition-all ${badgeBg}`}
                title={`${h.houseNumber} ${h.street} - ${h.ownerName}`}
              >
                <div className="flex items-center justify-center gap-1 mb-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`}></span>
                  <span className="text-[11px] font-bold truncate">Số {h.houseNumber}</span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate font-medium">{h.street}</div>
                <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 font-mono">{h.hamlet}</div>
              </div>
            );
          })}

          {households.length > 16 && (
            <div
              onClick={() => onNavigateTab('households')}
              className="p-2.5 rounded-xl border border-dashed border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/20 text-center cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all flex flex-col items-center justify-center col-span-2 sm:col-span-4 lg:col-span-8 py-3"
            >
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                + Xem toàn bộ {totalCount} hộ dân và cơ sở trên địa bàn &rarr;
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
