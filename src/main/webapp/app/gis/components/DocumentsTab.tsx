import React, { useState, useEffect, useMemo } from 'react';
import { FileText, AlertTriangle, CheckCircle2, Clock, Send, Printer, Plus, Search, FileCheck, Building2, Calendar } from 'lucide-react';
import { DocumentRecord } from '../types';
import { Pagination } from './Pagination';

interface DocumentsTabProps {
  documents: DocumentRecord[];
  onRenewDocument: (id: string) => void;
  onSendReminder: (id: string) => void;
}

export const DocumentsTab: React.FC<DocumentsTabProps> = ({ documents, onRenewDocument, onSendReminder }) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'expiring_soon' | 'valid'>('all');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, search]);

  const filteredDocs = useMemo(() => {
    return documents.filter(doc => {
      if (filterStatus !== 'all' && doc.status !== filterStatus) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          doc.title.toLowerCase().includes(q) ||
          doc.targetName.toLowerCase().includes(q) ||
          doc.docCode.toLowerCase().includes(q) ||
          doc.address.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [documents, filterStatus, search]);

  const paginatedDocs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDocs.slice(start, start + pageSize);
  }, [filteredDocs, currentPage, pageSize]);

  const expiringCount = documents.filter(d => d.status === 'expiring_soon').length;

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Banner */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div>
            <div
              id="document-eyebrow"
              className="text-[11px] sm:text-xs font-bold text-blue-600 dark:text-blue-400 tracking-wider uppercase mb-1"
            >
              KIỂM SOÁT HỒ SƠ
            </div>
            <h2 id="document-title" className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Quản lý hồ sơ & Giấy tờ an ninh
            </h2>
            <p id="document-description" className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1">
              Theo dõi tình trạng giấy phép, hồ sơ cư trú và thông báo hành chính.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 rounded-xl text-xs font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>
                {expiringCount} giấy phép cần xử lý trong tháng {String(new Date().getMonth() + 1).padStart(2, '0')}/
                {new Date().getFullYear()}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Filter and search bar */}
      <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm số hiệu, cơ sở, người đại diện..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
              filterStatus === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Tất cả ({documents.length})
          </button>
          <button
            onClick={() => setFilterStatus('expiring_soon')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 ${
              filterStatus === 'expiring_soon'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 hover:bg-amber-100 border border-amber-300 dark:border-amber-700/60'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Sắp hết hạn ({expiringCount})</span>
          </button>
          <button
            onClick={() => setFilterStatus('valid')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
              filterStatus === 'valid'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Hợp lệ ({documents.length - expiringCount})
          </button>
        </div>
      </div>

      {/* Document List */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <h3 id="document-list-title" className="text-sm sm:text-base font-bold text-[#1e293b] dark:text-white flex items-center gap-2">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            <span>Danh sách giấy tờ đang theo dõi ({filteredDocs.length})</span>
          </h3>
          <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
            Cập nhật tự động theo mốc thời gian hành chính
          </span>
        </div>

        <div className="space-y-3">
          {paginatedDocs.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">Không tìm thấy hồ sơ nào phù hợp.</div>
          ) : (
            paginatedDocs.map(doc => {
              const isExpiring = doc.status === 'expiring_soon';
              return (
                <div
                  key={doc.id}
                  className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                    isExpiring
                      ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700/60 hover:border-amber-400'
                      : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-mono text-[11px] font-bold border border-slate-200 dark:border-slate-700">
                          {doc.docCode}
                        </span>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">• {doc.categoryLabel}</span>
                        <span className="text-xs font-bold text-slate-400 font-mono">({doc.hamlet})</span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">{doc.title}</h4>

                      <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                        Đối tượng / Cơ sở: <strong className="text-slate-900 dark:text-white">{doc.targetName}</strong> ({doc.address})
                      </div>
                    </div>

                    {/* Expiry Badge and Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between lg:justify-end gap-2.5 sm:gap-3 lg:self-center shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-700/60">
                      <div className="flex items-center justify-between sm:block sm:text-right">
                        <div className="text-[11px] text-slate-400">Hạn hiệu lực:</div>
                        <div
                          className={`text-xs font-bold font-mono ${isExpiring ? 'text-amber-900 dark:text-amber-300' : 'text-slate-700 dark:text-slate-200'}`}
                        >
                          {doc.expiryDate}
                          {doc.daysRemaining !== undefined && (
                            <span
                              className={`ml-1.5 text-[10px] font-bold ${isExpiring ? 'text-amber-800 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}
                            >
                              {isExpiring ? `(⚠️ Còn ${doc.daysRemaining} ngày)` : `(+${doc.daysRemaining} ngày)`}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onSendReminder(doc.id)}
                          className={`flex-1 sm:flex-initial px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 min-h-[38px] ${
                            isExpiring
                              ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <Send className="w-3 h-3" />
                          <span>Đôn đốc</span>
                        </button>

                        <button
                          onClick={() => onRenewDocument(doc.id)}
                          className="flex-1 sm:flex-initial px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs min-h-[38px]"
                        >
                          <FileCheck className="w-3 h-3" />
                          <span>Gia hạn</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Notes and instructions */}
                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-slate-800 dark:text-slate-200">Chỉ đạo CSKV:</strong> {doc.notes}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalItems={filteredDocs.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[5, 10, 20, 50]}
        />
      </div>
    </div>
  );
};
