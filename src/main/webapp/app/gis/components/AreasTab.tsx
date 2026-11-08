import React, { useState, useMemo, useEffect } from 'react';
import { Building2, AlertTriangle, CheckCircle2, Store, User } from 'lucide-react';
import { HouseholdFacility } from '../types';
import { Pagination } from './Pagination';

interface AreasTabProps {
  households: HouseholdFacility[];
  onSelectHousehold: (household: HouseholdFacility) => void;
}

/** "Số 12 Đường A" when a house number exists; otherwise the street/address text alone. */
const householdAddress = (h: HouseholdFacility) => {
  const houseNumber = String(h.houseNumber ?? '').trim();
  const street = String(h.street ?? '').trim();
  return [houseNumber && `Số ${houseNumber}`, street].filter(Boolean).join(' ');
};

/** Long technical codes are shortened for display; the full code stays in the tooltip. */
const shortCode = (code: string) => (code.length > 16 ? `${code.slice(0, 12)}…` : code);

export const AreasTab: React.FC<AreasTabProps> = ({ households, onSelectHousehold }) => {
  const hamletList = useMemo(() => {
    const list = Array.from(new Set(households.map(h => h.hamlet).filter(Boolean))).sort();
    return list;
  }, [households]);

  const [selectedHamlet, setSelectedHamlet] = useState<string>(() => hamletList[0] || '');
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
          <div id="area-eyebrow" className="text-[11px] sm:text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
            Phân quyền địa bàn xã Bà Điểm
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
        {hamletList.map(hamletName => {
          const hamletHouseholds = households.filter(h => h.hamlet === hamletName);
          const totalResidents = hamletHouseholds.reduce((acc, curr) => acc + (curr.residentsCount || 0), 0);
          const bizCount = hamletHouseholds.filter(h => h.type === 'business').length;
          const warningCount = hamletHouseholds.filter(h => h.status === 'warning' || h.status === 'alert').length;
          const isSelected = (selectedHamlet || hamletList[0]) === hamletName;

          return (
            <button
              type="button"
              key={hamletName}
              aria-pressed={isSelected}
              onClick={() => setSelectedHamlet(hamletName)}
              className={`gis-area-card w-full text-left p-4 sm:p-5 rounded-lg border transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-[var(--gis-selected)] border-[var(--gis-primary)]'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="gis-area-card-title text-slate-900 dark:text-white">{hamletName}</h3>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Xã Bà Điểm, TP. Hồ Chí Minh</div>
                </div>
                {isSelected && (
                  <span className="shrink-0 whitespace-nowrap rounded-full border border-[var(--gis-primary)] px-2 py-0.5 text-xs font-medium text-[var(--gis-accent-text)]">
                    Đang xem
                  </span>
                )}
              </div>

              <dl className="my-3 grid grid-cols-3 divide-x divide-slate-200 dark:divide-slate-700 border-y border-slate-200 dark:border-slate-800 py-2.5">
                <div className="px-2 first:pl-0">
                  <dt className="text-xs text-slate-500 dark:text-slate-400">Hộ & cơ sở</dt>
                  <dd className="m-0 text-lg font-semibold tabular-nums text-slate-900 dark:text-white">{hamletHouseholds.length}</dd>
                </div>
                <div className="px-2">
                  <dt className="text-xs text-slate-500 dark:text-slate-400">Nhân khẩu</dt>
                  <dd className="m-0 text-lg font-semibold tabular-nums text-slate-900 dark:text-white">{totalResidents}</dd>
                </div>
                <div className="px-2">
                  <dt className="text-xs text-slate-500 dark:text-slate-400">Cơ sở KD</dt>
                  <dd className="m-0 text-lg font-semibold tabular-nums text-slate-900 dark:text-white">{bizCount}</dd>
                </div>
              </dl>

              <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
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
            </button>
          );
        })}
      </div>

      {/* List of Houses in Selected Hamlet */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="gis-area-list-title text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 shrink-0 text-slate-500" aria-hidden="true" />
            <span>
              Hộ dân & cơ sở tại {selectedHamlet || hamletList[0]}{' '}
              <span className="font-normal text-slate-500 dark:text-slate-400 tabular-nums">({activeList.length})</span>
            </span>
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">Chọn một hộ để xem chi tiết hoặc chỉnh sửa</span>
        </div>

        {activeList.length === 0 ? (
          <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">Chưa có dữ liệu hộ dân tại ấp này.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {paginatedHouses.map(h => {
              const address = householdAddress(h);
              const name = h.businessName || h.ownerName;
              return (
                <button
                  type="button"
                  key={h.id}
                  onClick={() => onSelectHousehold(h)}
                  className="flex flex-col text-left p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 transition-colors cursor-pointer bg-white dark:bg-slate-900"
                >
                  <span className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-slate-100 break-words">
                    {address || <span className="font-normal text-slate-500">Chưa có địa chỉ</span>}
                  </span>
                  <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                    {h.businessName ? (
                      <Store className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    ) : (
                      <User className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    )}
                    <span className="truncate">{name || 'Chưa có tên chủ hộ'}</span>
                  </span>
                  {h.code && (
                    <span className="mt-1 truncate font-mono text-xs text-slate-500 dark:text-slate-400" title={h.code}>
                      Mã {shortCode(h.code)}
                    </span>
                  )}
                  <span className="mt-auto flex items-center justify-between gap-2 border-t border-slate-200 dark:border-slate-700 pt-2 mt-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="tabular-nums whitespace-nowrap">{h.residentsCount ?? 0} nhân khẩu</span>
                    <span className="tabular-nums truncate">{h.ownerPhone || '—'}</span>
                  </span>
                </button>
              );
            })}
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
