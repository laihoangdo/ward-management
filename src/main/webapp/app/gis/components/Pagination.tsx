import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [12, 24, 48, 96],
  itemLabel = 'bản ghi',
  className = '',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIndex = Math.min(totalItems, safePage * pageSize);

  const handlePageClick = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== safePage) {
      onPageChange(page);
    }
  };

  // Generate pagination numbers with ellipsis
  const getPageNumbers = (): (number | string)[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (safePage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }

    if (safePage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, '...', safePage - 1, safePage, safePage + 1, '...', totalPages];
  };

  const pages = getPageNumbers();

  const effectivePageSizeOptions = React.useMemo(() => {
    if (pageSizeOptions.includes(pageSize)) {
      return pageSizeOptions;
    }
    return [...pageSizeOptions, pageSize].sort((a, b) => a - b);
  }, [pageSizeOptions, pageSize]);

  return (
    <div
      className={`p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300 select-none ${className}`}
    >
      {/* Left: Summary and Page Size Selector */}
      <div className="flex items-center justify-between sm:justify-start gap-3 flex-wrap">
        <div>
          <span>
            Hiển thị{' '}
            <strong className="text-slate-900 dark:text-white font-bold font-mono">
              {startIndex}-{endIndex}
            </strong>{' '}
            trên <strong className="text-slate-900 dark:text-white font-bold font-mono">{totalItems}</strong> {itemLabel}
          </span>
        </div>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px] hidden xs:inline">Mỗi trang:</span>
            <select
              value={pageSize}
              onChange={e => onPageSizeChange(Number(e.target.value))}
              aria-label="Số bản ghi mỗi trang"
              className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 font-semibold focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              {effectivePageSizeOptions.map(opt => (
                <option key={opt} value={opt}>
                  {opt} / trang
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Page Navigation Buttons */}
      <div className="flex items-center justify-center sm:justify-end gap-1">
        {/* First Page Button */}
        <button
          type="button"
          onClick={() => handlePageClick(1)}
          disabled={safePage === 1}
          className={`p-1.5 rounded-lg border text-xs transition-colors flex items-center justify-center min-w-[32px] min-h-[32px] cursor-pointer ${
            safePage === 1
              ? 'border-slate-200 dark:border-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed'
              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-750 hover:text-blue-600'
          }`}
          title="Trang đầu"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        {/* Previous Page Button */}
        <button
          type="button"
          onClick={() => handlePageClick(safePage - 1)}
          disabled={safePage === 1}
          className={`px-2 py-1.5 rounded-lg border text-xs font-semibold transition-colors flex items-center justify-center gap-1 min-h-[32px] cursor-pointer ${
            safePage === 1
              ? 'border-slate-200 dark:border-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed'
              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-750 hover:text-blue-600'
          }`}
          title="Trang trước"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden md:inline">Trước</span>
        </button>

        {/* Page Numbers (Desktop & Tablet) */}
        <div className="hidden sm:flex items-center gap-1">
          {pages.map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`ellipsis-${idx}`} className="px-1.5 text-slate-400 font-mono">
                  …
                </span>
              );
            }

            const pageNum = Number(p);
            const isActive = pageNum === safePage;

            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => handlePageClick(pageNum)}
                className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs font-mono scale-105'
                    : 'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-blue-600 font-mono'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* Mobile Page Indicator */}
        <div className="sm:hidden px-2 py-1 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          {safePage} / {totalPages}
        </div>

        {/* Next Page Button */}
        <button
          type="button"
          onClick={() => handlePageClick(safePage + 1)}
          disabled={safePage === totalPages}
          className={`px-2 py-1.5 rounded-lg border text-xs font-semibold transition-colors flex items-center justify-center gap-1 min-h-[32px] cursor-pointer ${
            safePage === totalPages
              ? 'border-slate-200 dark:border-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed'
              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-750 hover:text-blue-600'
          }`}
          title="Trang tiếp theo"
        >
          <span className="hidden md:inline">Sau</span>
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Last Page Button */}
        <button
          type="button"
          onClick={() => handlePageClick(totalPages)}
          disabled={safePage === totalPages}
          className={`p-1.5 rounded-lg border text-xs transition-colors flex items-center justify-center min-w-[32px] min-h-[32px] cursor-pointer ${
            safePage === totalPages
              ? 'border-slate-200 dark:border-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed'
              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-750 hover:text-blue-600'
          }`}
          title="Trang cuối"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
