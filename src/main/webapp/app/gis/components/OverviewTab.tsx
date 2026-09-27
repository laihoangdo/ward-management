import React from 'react';
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
import { HouseholdFacility, NavigationTab } from '../types';

interface OverviewTabProps {
  households: HouseholdFacility[];
  onNavigateTab: (tab: NavigationTab) => void;
  onSelectHousehold: (household: HouseholdFacility) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ households, onNavigateTab, onSelectHousehold }) => {
  const totalCount = households.length; // 16
  const businessCount = households.filter(h => h.type === 'business').length; // 3
  const alertCount = households.filter(h => h.type === 'special_monitoring').length; // 1
  const warningCount = households.filter(h => h.status === 'warning').length; // 2

  // Demographics calculation
  const totalResidents = households.reduce((sum, h) => sum + h.residentsCount, 0); // 59
  const totalFemale = households.reduce((sum, h) => sum + h.femaleCount, 0); // 31
  const totalMale = households.reduce((sum, h) => sum + h.maleCount, 0); // 28
  const totalUnder18 = households.reduce((sum, h) => sum + h.under18Count, 0); // 14
  const totalAbove18 = households.reduce((sum, h) => sum + h.above18Count, 0); // 45

  const femalePercent = Math.round((totalFemale / totalResidents) * 100); // 53%
  const malePercent = Math.round((totalMale / totalResidents) * 100); // 47%
  const under18Percent = Math.round((totalUnder18 / totalResidents) * 100); // 24%
  const above18Percent = Math.round((totalAbove18 / totalResidents) * 100); // 76%

  const warningHouseholds = households.filter(h => h.status === 'warning');

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Overview Title Banner */}
      <div className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <div id="overview-eyebrow" className="text-[11px] sm:text-xs font-bold text-blue-600 tracking-wider uppercase mb-1">
              TRUNG TÂM ĐIỀU HÀNH
            </div>
            <h2 id="overview-title" className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Tổng quan địa bàn
            </h2>
            <p id="overview-description" className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1">
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
              className="flex-1 sm:flex-initial px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-1.5 min-h-[40px]"
            >
              <span>Danh sách 16 hộ</span>
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
          className="bg-white p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs hover:border-blue-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span id="stat-total-label" className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
              Tổng hộ / Cơ sở
            </span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
              <Building className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2">
            <span id="stat-total-value" className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
              {totalCount}
            </span>
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium">hộ & cơ sở</span>
          </div>
          <div className="mt-2 sm:mt-3 text-[10px] sm:text-[11px] text-slate-500 flex items-center gap-1 pt-1.5 sm:pt-2 border-t border-slate-100 truncate">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
            <span className="truncate">100% đã thu thập hồ sơ</span>
          </div>
        </div>

        {/* Business card */}
        <div
          id="stat-business-card"
          onClick={() => onNavigateTab('households')}
          className="bg-white p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs hover:border-indigo-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span id="stat-business-label" className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
              CSKD có điều kiện
            </span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
              <Store className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2">
            <span id="stat-business-value" className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
              {businessCount}
            </span>
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium">điểm kinh doanh</span>
          </div>
          <div className="mt-2 sm:mt-3 text-[10px] sm:text-[11px] text-indigo-600 font-medium flex items-center gap-1 pt-1.5 sm:pt-2 border-t border-slate-100 truncate">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
            <span className="truncate">Quán net, cầm đồ, karaoke</span>
          </div>
        </div>

        {/* Warning card */}
        <div
          id="stat-warning-card"
          onClick={() => onNavigateTab('documents')}
          className="bg-white p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-amber-300 shadow-xs hover:border-amber-400 transition-all cursor-pointer group flex flex-col justify-between bg-amber-50/20"
        >
          <div className="flex items-center justify-between">
            <span id="stat-warning-label" className="text-[10px] sm:text-xs font-bold text-amber-700 uppercase tracking-wider truncate">
              Cảnh báo hồ sơ
            </span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors shrink-0">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2">
            <span id="stat-warning-value" className="text-2xl sm:text-3xl font-extrabold text-amber-900 font-mono tracking-tight">
              {warningCount}
            </span>
            <span className="text-[10px] sm:text-xs text-amber-700/80 font-medium">sắp hết hạn</span>
          </div>
          <div className="mt-2 sm:mt-3 text-[10px] sm:text-[11px] text-amber-700 flex items-center gap-1 pt-1.5 sm:pt-2 border-t border-amber-200/60 truncate">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 animate-ping"></span>
            <span className="truncate">Cần kiểm tra trước 20/09</span>
          </div>
        </div>

        {/* Population card */}
        <div
          id="stat-population-card"
          onClick={() => onNavigateTab('residents')}
          className="bg-white p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs hover:border-emerald-300 transition-all group flex flex-col justify-between cursor-pointer hover:shadow-sm"
          title="Bấm để mở danh sách Quản lý nhân khẩu & Định danh"
        >
          <div className="flex items-center justify-between">
            <span id="stat-population-label" className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
              Tổng nhân khẩu
            </span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
              <UserCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2">
            <span id="stat-population-value" className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
              {totalResidents}
            </span>
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium">người dân</span>
          </div>
          <div className="mt-2 sm:mt-3 text-[10px] sm:text-[11px] text-emerald-700 font-medium flex items-center justify-between pt-1.5 sm:pt-2 border-t border-slate-100 truncate">
            <div className="flex items-center gap-1 truncate">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
              <span className="truncate">TB ~3.8 người / hộ</span>
            </div>
            <span className="text-[10px] font-bold text-blue-600 group-hover:underline flex items-center gap-0.5">
              Tra cứu <ArrowRight className="w-2.5 h-2.5" />
            </span>
          </div>
        </div>
      </div>

      {/* Warning Box Banner */}
      {households.filter(h => h.status === 'warning').length > 0 && (
        <div id="warning-box" className="bg-[#fffbeb] border-2 border-amber-300/90 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0">
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="flex-1 w-full min-w-0">
              <h3 id="warning-title" className="text-sm sm:text-base font-bold text-[#78350f] leading-snug">
                CẢNH BÁO: {households.filter(h => h.status === 'warning').length} Cơ sở sắp hết hạn Giấy phép kinh doanh / An ninh trật tự
              </h3>
              <p className="text-xs text-amber-900/80 mt-1">
                Cán bộ CSKV cần kiểm tra thực địa, đôn đốc cơ sở nộp hồ sơ gia hạn đúng quy định trước ngày hết hiệu lực:
              </p>
              <div className="mt-3 space-y-2">
                {households
                  .filter(h => h.status === 'warning')
                  .map(item => (
                    <div
                      key={item.id}
                      id={`warning-line-${item.id}`}
                      onClick={() => onSelectHousehold(item)}
                      className="p-3 bg-white/90 border border-amber-200 rounded-xl text-xs font-semibold text-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 hover:bg-white cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                        <span className="truncate">
                          - {item.businessName || item.ownerName} - Số {item.houseNumber} {item.street}{' '}
                          {item.licenseExpiry ? `(Hết hạn: ${item.licenseExpiry})` : ''}
                        </span>
                      </div>
                      <span className="self-start sm:self-auto text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold shrink-0">
                        {item.warningMessage?.split('(')[0]?.trim() || 'Sắp hết hạn'}
                      </span>
                    </div>
                  ))}
              </div>

              <div className="mt-3.5 sm:mt-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <button
                  onClick={() => onNavigateTab('documents')}
                  className="px-3.5 py-2 bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 min-h-[40px]"
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>Xem danh sách hồ sơ cần thẩm định</span>
                </button>
                <span className="text-[10px] sm:text-[11px] text-amber-800 italic">
                  * Thông báo nhắc hạn đã được gửi tự động qua hệ thống.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Demographics & Population Stats */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div id="demographic-eyebrow" className="text-xs font-bold text-blue-600 tracking-wider uppercase mb-1">
              THỐNG KÊ NHÂN KHẨU
            </div>
            <h3 id="demographic-stats-title" className="text-xl font-bold text-[#1e293b] tracking-tight">
              Cơ cấu nhân khẩu
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tổng số <span className="font-bold text-slate-800">{totalResidents} nhân khẩu</span> đang cư trú tại 16 hộ thuộc Ấp 1 & Ấp 2,
              P. An Lạc
            </p>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold">
              <CheckCircle className="w-3.5 h-3.5" />
              Đã số hóa định danh VNeID
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Gender Card */}
          <div id="gender-orb-card" className="p-5 rounded-2xl bg-[#f8fafc] border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h4 id="gender-orb-title" className="text-base font-bold text-[#1e293b] flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Tỷ lệ nam nữ</span>
              </h4>
              <span className="text-xs font-mono font-bold text-slate-500">59 nhân khẩu</span>
            </div>

            {/* Visual ratio bar */}
            <div className="w-full h-4 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
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
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-3 rounded-full bg-pink-500 inline-block"></span>
                  <span className="text-xs text-slate-500 font-medium">Giới tính Nữ</span>
                </div>
                <div id="gender-female-label" className="text-sm font-bold text-[#334155]">
                  Nữ: {totalFemale} ({femalePercent}%)
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span>
                  <span className="text-xs text-slate-500 font-medium">Giới tính Nam</span>
                </div>
                <div id="gender-male-label" className="text-sm font-bold text-[#334155]">
                  Nam: {totalMale} ({malePercent}%)
                </div>
              </div>
            </div>
          </div>

          {/* Age Card */}
          <div id="age-orb-card" className="p-5 rounded-2xl bg-[#f8fafc] border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h4 id="age-orb-title" className="text-base font-bold text-[#1e293b] flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>Cơ cấu độ tuổi</span>
              </h4>
              <span className="text-xs font-mono font-bold text-slate-500">59 nhân khẩu</span>
            </div>

            {/* Visual ratio bar */}
            <div className="w-full h-4 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
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
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block"></span>
                  <span className="text-xs text-slate-500 font-medium">Độ tuổi trưởng thành</span>
                </div>
                <div id="age-adult-label" className="text-sm font-bold text-[#334155]">
                  Từ 18 trở lên: {totalAbove18} ({above18Percent}%)
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
                  <span className="text-xs text-slate-500 font-medium">Trẻ em & Thiếu niên</span>
                </div>
                <div id="age-under-label" className="text-sm font-bold text-[#334155]">
                  Dưới 18: {totalUnder18} ({under18Percent}%)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Status of 16 Households Preview */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 id="overview-status-title" className="text-base font-bold text-slate-800">
              Trạng thái địa bàn hôm nay
            </h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-100">
              16 vị trí giám sát
            </span>
          </div>
          <button
            onClick={() => onNavigateTab('area-map')}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            Mở sơ đồ tương tác &rarr;
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {households.map(h => {
            let badgeBg = 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100';
            let statusDot = 'bg-emerald-500';
            if (h.status === 'warning') {
              badgeBg = 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100 ring-2 ring-amber-400/50';
              statusDot = 'bg-amber-500 animate-ping';
            } else if (h.status === 'alert') {
              badgeBg = 'bg-rose-50 border-rose-300 text-rose-900 hover:bg-rose-100 ring-2 ring-rose-400/50';
              statusDot = 'bg-rose-500';
            } else if (h.status === 'business') {
              badgeBg = 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100';
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
                <div className="text-[10px] text-slate-500 truncate font-medium">{h.street}</div>
                <div className="text-[9px] text-slate-400 mt-1 font-mono">{h.hamlet}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
