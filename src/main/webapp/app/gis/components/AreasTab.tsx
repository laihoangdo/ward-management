import React, { useState, useMemo, useEffect } from 'react';
import { Building2, Shield, Users, MapPin, AlertTriangle, CheckCircle2, Lock, Flame, Phone, Compass, FileText, Store } from 'lucide-react';
import { HouseholdFacility } from '../types';
import { Pagination } from './Pagination';

interface AreasTabProps {
  households: HouseholdFacility[];
  onSelectHousehold: (household: HouseholdFacility) => void;
}

export const AreasTab: React.FC<AreasTabProps> = ({ households, onSelectHousehold }) => {
  const hamletList = useMemo(() => {
    const list = Array.from(new Set(households.map(h => h.hamlet).filter(Boolean))).sort();
    return list.length > 0 ? list : ['Ấp Bắc Lân', 'Ấp Nam Lân', 'Ấp Tây Lân', 'Ấp Đông Lân', 'Ấp Hậu Lân', 'Ấp Tiền Lân'];
  }, [households]);

  const [selectedHamlet, setSelectedHamlet] = useState<string>(() => hamletList[0] || 'Ấp Bắc Lân');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedHamlet]);

  const activeList = useMemo(() => {
    return households.filter(h => h.hamlet === (selectedHamlet || hamletList[0]));
  }, [households, selectedHamlet, hamletList]);

  const paginatedHouses = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return activeList.slice(start, start + pageSize);
  }, [activeList, currentPage, pageSize]);

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Banner */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <div
            id="area-eyebrow"
            className="text-[11px] sm:text-xs font-bold text-blue-600 dark:text-blue-400 tracking-wider uppercase mb-1"
          >
            PHÂN QUYỀN ĐỊA BÀN — XÃ BÀ ĐIỂM
          </div>
          <h2 id="area-title" className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Quản lý khu vực dân cư các Ấp thuộc Xã Bà Điểm
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1">
            Tổng cộng <strong>{hamletList.length} ấp</strong> với <strong>{households.length} hộ dân & cơ sở</strong> đang được theo dõi,
            quản lý an ninh trật tự trên hệ thống.
          </p>
        </div>
      </div>

      {/* Dynamic Hamlet Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {hamletList.map((hamletName, idx) => {
          const hamletHouseholds = households.filter(h => h.hamlet === hamletName);
          const totalResidents = hamletHouseholds.reduce((acc, curr) => acc + (curr.residentsCount || 0), 0);
          const bizCount = hamletHouseholds.filter(h => h.type === 'business').length;
          const warningCount = hamletHouseholds.filter(h => h.status === 'warning' || h.status === 'alert').length;
          const isSelected = (selectedHamlet || hamletList[0]) === hamletName;

          return (
            <div
              key={hamletName}
              onClick={() => setSelectedHamlet(hamletName)}
              className={`p-4 sm:p-5 rounded-xl sm:rounded-2xl border-2 transition-all cursor-pointer ${
                isSelected
                  ? 'bg-blue-50/50 dark:bg-blue-950/30 border-blue-600 dark:border-blue-500 shadow-md ring-2 ring-blue-500/20'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 shadow-xs hover:shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl text-white flex items-center justify-center font-bold text-sm shadow-xs ${
                      idx % 3 === 0 ? 'bg-blue-600' : idx % 3 === 1 ? 'bg-indigo-600' : 'bg-emerald-600'
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{hamletName.toUpperCase()}</h3>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Xã Bà Điểm, Hóc Môn</div>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {isSelected ? 'Đang chọn' : 'Xem ấp'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 py-2.5 border-y border-slate-200/80 dark:border-slate-800 my-2.5 text-center text-xs">
                <div className="p-1.5 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Hộ & CS</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{hamletHouseholds.length}</div>
                </div>
                <div className="p-1.5 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Nhân khẩu</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{totalResidents}</div>
                </div>
                <div className="p-1.5 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Cơ sở KD</div>
                  <div className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-0.5">{bizCount}</div>
                </div>
              </div>

              <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-orange-500" />
                    <span>Tổ liên gia PCCC:</span>
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Tổ 1 - {hamletName}</span>
                </div>
                {warningCount > 0 ? (
                  <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      <span>Cần kiểm tra:</span>
                    </span>
                    <span>{warningCount} vị trí</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 font-medium">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Tình trạng:</span>
                    </span>
                    <span>An toàn ANTT</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* List of Houses in Selected Hamlet */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" />
            <span>
              Danh sách {activeList.length} hộ dân & cơ sở tại {selectedHamlet || hamletList[0]}
            </span>
          </h3>
          <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
            Click vào ô để mở chi tiết hoặc chỉnh sửa / xóa
          </span>
        </div>

        {activeList.length === 0 ? (
          <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">Chưa có dữ liệu hộ dân tại ấp này.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {paginatedHouses.map(h => (
              <div
                key={h.id}
                onClick={() => onSelectHousehold(h)}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-all cursor-pointer group bg-slate-50/50 dark:bg-slate-800/40"
              >
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span className="group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
                    Số {h.houseNumber} {h.street}
                  </span>
                  <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded shrink-0 ml-1">
                    {h.code}
                  </span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 truncate">
                  {h.businessName ? `🏪 ${h.businessName}` : `👤 ${h.ownerName}`}
                </div>
                <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                  <span>{h.residentsCount} nhân khẩu</span>
                  <span className="font-mono">{h.ownerPhone}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalItems={activeList.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[8, 12, 24, 48]}
        />
      </div>
    </div>
  );
};
