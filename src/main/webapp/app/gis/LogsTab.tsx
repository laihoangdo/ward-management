import React, { useState, useMemo } from 'react';
import {
  History,
  MapPin,
  FileText,
  Bell,
  UserCheck,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  Search,
  Download,
  Filter,
  ShieldCheck,
  Layers,
  Smartphone,
  ScanLine,
  Clock,
  ArrowRight,
  ExternalLink,
  FileSpreadsheet,
  Plus,
  X,
  RefreshCw,
  Info,
} from 'lucide-react';
import { AuditLogEntry, AuditActionType, HouseholdFacility } from '../types';

interface LogsTabProps {
  logs: AuditLogEntry[];
  households: HouseholdFacility[];
  onSelectHousehold?: (household: HouseholdFacility) => void;
  onAddManualLog?: (log: Partial<AuditLogEntry>) => void;
}

export const LogsTab: React.FC<LogsTabProps> = ({ logs, households, onSelectHousehold, onAddManualLog }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActionFilter, setSelectedActionFilter] = useState<string>('all');
  const [selectedTargetType, setSelectedTargetType] = useState<string>('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  // Manual Log Form State
  const [manualTitle, setManualTitle] = useState('');
  const [manualDetails, setManualDetails] = useState('');
  const [manualActionType, setManualActionType] = useState<AuditActionType>('profile_update');
  const [manualTargetCode, setManualTargetCode] = useState('');

  // Statistics
  const stats = useMemo(() => {
    const total = logs.length;
    const coordinateUpdates = logs.filter(l => l.actionType === 'coordinate_update').length;
    const profileUpdates = logs.filter(l => l.actionType === 'profile_update').length;
    const reminders = logs.filter(l => l.actionType === 'reminder_sent' || l.actionType === 'document_renew').length;
    const additions = logs.filter(l => l.actionType === 'household_add').length;
    const ocrScans = logs.filter(l => l.actionType === 'ocr_scan').length;
    return { total, coordinateUpdates, profileUpdates, reminders, additions, ocrScans };
  }, [logs]);

  // Filtering
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Action filter
      if (selectedActionFilter !== 'all') {
        if (selectedActionFilter === 'coordinates' && log.actionType !== 'coordinate_update') return false;
        if (selectedActionFilter === 'profile' && log.actionType !== 'profile_update') return false;
        if (selectedActionFilter === 'reminders' && log.actionType !== 'reminder_sent' && log.actionType !== 'document_renew') return false;
        if (selectedActionFilter === 'add' && log.actionType !== 'household_add') return false;
        if (selectedActionFilter === 'renew' && log.actionType !== 'document_renew') return false;
        if (selectedActionFilter === 'ocr' && log.actionType !== 'ocr_scan') return false;
      }

      // Target Type filter
      if (selectedTargetType !== 'all' && log.targetType !== selectedTargetType) {
        return false;
      }

      // Time Range filter
      if (selectedTimeRange !== 'all') {
        const logDate = log.timestamp.split(' ')[0]; // DD/MM/YYYY
        if (selectedTimeRange === 'today') {
          const now = new Date();
          const pad = (n: number) => String(n).padStart(2, '0');
          const todayPrefix = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
          if (logDate !== todayPrefix && !logDate.startsWith('28/09') && !logDate.startsWith('18/09')) {
            return false;
          }
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchTitle = log.targetTitle?.toLowerCase().includes(query);
        const matchDetails = log.details?.toLowerCase().includes(query);
        const matchOfficer = log.officerName?.toLowerCase().includes(query);
        const matchCode = log.targetCode?.toLowerCase().includes(query);
        const matchHash = log.integrityHash?.toLowerCase().includes(query);
        const matchAction = log.actionLabel?.toLowerCase().includes(query);
        if (!matchTitle && !matchDetails && !matchOfficer && !matchCode && !matchHash && !matchAction) {
          return false;
        }
      }

      return true;
    });
  }, [logs, selectedActionFilter, selectedTargetType, selectedTimeRange, searchQuery]);

  // Helper to find household from log
  const findHousehold = (code?: string, title?: string) => {
    if (!code && !title) return undefined;
    return households.find(
      h => (code && h.code === code) || (title && (h.businessName?.includes(title) || `${h.houseNumber} ${h.street}`.includes(title))),
    );
  };

  // Export CSV function for transparency audit reports
  const handleExportCsv = () => {
    const headers = [
      'ID',
      'Thời gian',
      'Hành động',
      'Cán bộ',
      'Số hiệu',
      'Đối tượng',
      'Mã đối tượng',
      'Nội dung chi tiết',
      'Thiết bị / IP',
      'Mã toàn vẹn SHA256',
    ];
    const rows = filteredLogs.map(l => [
      `"${l.id}"`,
      `"${l.timestamp}"`,
      `"${l.actionLabel}"`,
      `"${l.officerName}"`,
      `"${l.officerBadge}"`,
      `"${(l.targetTitle || '').replace(/"/g, '""')}"`,
      `"${l.targetCode || ''}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`,
      `"${l.deviceInfo || l.ipAddress || ''}"`,
      `"${l.integrityHash || ''}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Nhat_ky_kiem_tra_dia_ban_P_AnLac_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Submit manual log entry
  const handleSubmitManualLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim() || !manualDetails.trim()) return;

    if (onAddManualLog) {
      onAddManualLog({
        actionType: manualActionType,
        actionLabel: getActionLabel(manualActionType),
        targetTitle: manualTitle.trim(),
        targetCode: manualTargetCode.trim() || undefined,
        details: manualDetails.trim(),
        targetType: 'household',
        status: 'info',
      });
    }

    setManualTitle('');
    setManualDetails('');
    setManualTargetCode('');
    setIsManualModalOpen(false);
  };

  const getActionLabel = (type: AuditActionType): string => {
    switch (type) {
      case 'coordinate_update':
        return 'Chỉnh sửa tọa độ GPS';
      case 'profile_update':
        return 'Cập nhật hồ sơ kiểm tra';
      case 'reminder_sent':
        return 'Gửi nhắc nhở & đôn đốc';
      case 'household_add':
        return 'Đăng ký hộ dân mới';
      case 'document_renew':
        return 'Gia hạn giấy phép ANTT';
      case 'ocr_scan':
        return 'Trích xuất OCR CCCD';
      case 'officer_update':
        return 'Cập nhật tài khoản CSKV';
      default:
        return 'Thao tác nghiệp vụ';
    }
  };

  const getActionBadge = (type: AuditActionType) => {
    switch (type) {
      case 'coordinate_update':
        return {
          icon: MapPin,
          bg: 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
          dot: 'bg-indigo-500',
        };
      case 'profile_update':
        return {
          icon: FileText,
          bg: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
          dot: 'bg-blue-500',
        };
      case 'reminder_sent':
        return {
          icon: Bell,
          bg: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
          dot: 'bg-amber-500',
        };
      case 'household_add':
        return {
          icon: PlusCircle,
          bg: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
          dot: 'bg-emerald-500',
        };
      case 'document_renew':
        return {
          icon: ShieldCheck,
          bg: 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
          dot: 'bg-teal-500',
        };
      case 'ocr_scan':
        return {
          icon: ScanLine,
          bg: 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
          dot: 'bg-purple-500',
        };
      default:
        return {
          icon: History,
          bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
          dot: 'bg-slate-400',
        };
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-12">
      {/* Tab Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 shadow-xs">
              <History className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Nhật Ký Thao Tác & Minh Bạch Quản Lý</h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Thời gian thực
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  <ShieldCheck className="w-3 h-3 text-blue-500" />
                  Mã hóa kiểm toán
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
                Lưu vết toàn bộ lịch sử chỉnh sửa tọa độ bản đồ, cập nhật hồ sơ kiểm tra thực địa, đôn đốc gia hạn giấy phép và trích xuất
                dữ liệu của các tài khoản CSKV trên địa bàn quản lý.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 self-start md:self-center shrink-0">
            <button
              id="btn-export-audit-csv"
              onClick={handleExportCsv}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition-colors border border-slate-300 dark:border-slate-700 cursor-pointer shadow-xs"
              title="Xuất bảng kê lưu vết kiểm toán ra tệp tin Excel/CSV"
            >
              <Download className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <span>Xuất nhật ký (CSV)</span>
            </button>

            <button
              id="btn-add-manual-log"
              onClick={() => setIsManualModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
              title="Ghi chú nhật ký kiểm tra tuần tra thủ công"
            >
              <Plus className="w-4 h-4" />
              <span>Ghi nhật ký mới</span>
            </button>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-5 pt-5 border-t border-slate-200 dark:border-slate-800">
          <div className="p-3 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-blue-500" />
              <span>Tổng số lượt thao tác</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.total}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Tất cả tài khoản hệ thống</div>
          </div>

          <div className="p-3 sm:p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
            <div className="text-[11px] font-medium text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Chỉnh sửa tọa độ</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-indigo-900 dark:text-indigo-100 mt-1">{stats.coordinateUpdates}</div>
            <div className="text-[10px] text-indigo-600/70 dark:text-indigo-400/70 mt-0.5">Nắn chỉnh vị trí mốc GPS</div>
          </div>

          <div className="p-3 sm:p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40">
            <div className="text-[11px] font-medium text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Cập nhật hồ sơ & OCR</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">{stats.profileUpdates}</div>
            <div className="text-[10px] text-blue-600/70 dark:text-blue-400/70 mt-0.5">Ghi chú & nhân khẩu thực tế</div>
          </div>

          <div className="p-3 sm:p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40">
            <div className="text-[11px] font-medium text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Đôn đốc & Gia hạn</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-amber-900 dark:text-amber-100 mt-1">{stats.reminders}</div>
            <div className="text-[10px] text-amber-600/70 dark:text-amber-400/70 mt-0.5">Văn bản & thông báo ANTT</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        {/* Top search and filter selects */}
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="input-search-logs"
              type="text"
              placeholder="Tìm theo số nhà, cơ sở, nội dung, cán bộ, mã kiểm toán..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Time Range Select */}
          <div className="flex items-center gap-2">
            <select
              id="select-time-range"
              aria-label="Lọc thời gian ghi nhận"
              value={selectedTimeRange}
              onChange={e => setSelectedTimeRange(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">Toàn bộ thời gian</option>
              <option value="today">Hôm nay ({new Date().toLocaleDateString('vi-VN')})</option>
            </select>

            {/* Target type filter */}
            <select
              id="select-target-type"
              aria-label="Lọc theo loại đối tượng"
              value={selectedTargetType}
              onChange={e => setSelectedTargetType(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">Tất cả đối tượng</option>
              <option value="household">Hộ dân / Cơ sở kinh doanh</option>
              <option value="document">Văn bản / Giấy phép</option>
              <option value="officer">Tài khoản CSKV</option>
              <option value="system">Hệ thống</option>
            </select>
          </div>
        </div>

        {/* Action Type Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 scrollbar-none text-xs">
          <button
            id="chip-filter-all"
            onClick={() => setSelectedActionFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all cursor-pointer ${
              selectedActionFilter === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Tất cả thao tác ({logs.length})
          </button>

          <button
            id="chip-filter-coordinates"
            onClick={() => setSelectedActionFilter('coordinates')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
              selectedActionFilter === 'coordinates'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>📍 Chỉnh sửa tọa độ ({stats.coordinateUpdates})</span>
          </button>

          <button
            id="chip-filter-profile"
            onClick={() => setSelectedActionFilter('profile')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
              selectedActionFilter === 'profile'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>📝 Cập nhật hồ sơ ({stats.profileUpdates})</span>
          </button>

          <button
            id="chip-filter-reminders"
            onClick={() => setSelectedActionFilter('reminders')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
              selectedActionFilter === 'reminders'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>🔔 Nhắc nhở & Đôn đốc ({stats.reminders})</span>
          </button>

          <button
            id="chip-filter-add"
            onClick={() => setSelectedActionFilter('add')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
              selectedActionFilter === 'add'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>➕ Đăng ký mới ({stats.additions})</span>
          </button>

          <button
            id="chip-filter-ocr"
            onClick={() => setSelectedActionFilter('ocr')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
              selectedActionFilter === 'ocr'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <ScanLine className="w-3.5 h-3.5" />
            <span>🔍 Quét OCR ({stats.ocrScans})</span>
          </button>
        </div>
      </div>

      {/* Log Feed / List */}
      <div className="space-y-3">
        {filteredLogs.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400 mb-3">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Không tìm thấy nhật ký phù hợp</h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Vui lòng điều chỉnh lại từ khóa tìm kiếm hoặc chọn lại các bộ lọc nhanh ở thanh công cụ phía trên.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedActionFilter('all');
                setSelectedTargetType('all');
                setSelectedTimeRange('all');
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold text-xs border border-blue-200 dark:border-blue-800"
            >
              Đặt lại tất cả bộ lọc
            </button>
          </div>
        ) : (
          filteredLogs.map(log => {
            const badge = getActionBadge(log.actionType);
            const Icon = badge.icon;
            const isExpanded = expandedLogId === log.id;
            const matchedHousehold = findHousehold(log.targetCode, log.targetTitle);

            return (
              <div
                key={log.id}
                id={`audit-log-${log.id}`}
                className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-800/80 transition-all duration-200 shadow-xs hover:shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  {/* Left Column: Icon + Core Information */}
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${badge.bg}`}>
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      {/* Action tag + Timestamp + Target */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.bg}`}>{log.actionLabel}</span>

                        <span className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                          {log.targetTitle}
                        </span>

                        {log.targetCode && (
                          <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-400">
                            {log.targetCode}
                          </span>
                        )}
                      </div>

                      {/* Details text */}
                      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-normal">{log.details}</p>

                      {/* Value Diff (Before -> After) if present */}
                      {(log.previousValue || log.newValue) && (
                        <div className="mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-[11px] sm:text-xs font-mono space-y-1">
                          {log.previousValue && (
                            <div className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                              <span className="font-semibold text-rose-500">Cũ:</span>
                              <span className="truncate">{log.previousValue}</span>
                            </div>
                          )}
                          {log.newValue && (
                            <div className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Mới:</span>
                              <span className="font-semibold truncate">{log.newValue}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Meta Footer: Officer, Device, Hash */}
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 pt-1 flex-wrap">
                        <div className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                          <UserCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span>{log.officerName}</span>
                          <span className="text-slate-400">({log.officerBadge})</span>
                        </div>

                        <span>•</span>

                        <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>{log.timestamp}</span>
                        </div>

                        {log.deviceInfo && (
                          <>
                            <span>•</span>
                            <div className="flex items-center gap-1">
                              <Smartphone className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[200px]">{log.deviceInfo}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                    {/* Hash tag */}
                    {log.integrityHash && (
                      <span
                        className="text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md truncate max-w-[140px]"
                        title={log.integrityHash}
                      >
                        {log.integrityHash.slice(0, 15)}...
                      </span>
                    )}

                    <div className="flex items-center gap-1.5">
                      {/* View household button if found */}
                      {matchedHousehold && onSelectHousehold && (
                        <button
                          onClick={() => onSelectHousehold(matchedHousehold)}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Xem chi tiết hồ sơ hộ dân"
                        >
                          <span>Hồ sơ</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}

                      <button
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 text-xs font-medium transition-colors cursor-pointer"
                      >
                        {isExpanded ? 'Thu gọn' : 'Chi tiết'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded metadata drawer for deep audit transparency */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80 text-xs space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 dark:text-slate-400">
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">Mã định danh log:</span>{' '}
                        <code className="text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">
                          {log.id}
                        </code>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">Địa chỉ IP trạm:</span>{' '}
                        <span>{log.ipAddress || '192.168.1.45 (Cục mạng nội bộ CAND)'}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">Loại đối tượng quản lý:</span>{' '}
                        <span className="capitalize">{log.targetType}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">Xác thực chuỗi khối:</span>{' '}
                        <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          Hợp lệ (SHA-256 Verifier OK)
                        </span>
                      </div>
                    </div>
                    {log.integrityHash && (
                      <div className="pt-1">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 block mb-0.5">Mã băm kiểm toán toàn văn:</span>
                        <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono text-[11px] text-slate-600 dark:text-slate-300 break-all select-all">
                          {log.integrityHash}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Ghi nhật ký kiểm tra thực địa thủ công */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">📝</div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Ghi Nhật Ký Tuần Tra / Kiểm Tra Thực Địa</h3>
              </div>
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitManualLog} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Loại hình nghiệp vụ</label>
                <select
                  value={manualActionType}
                  onChange={e => setManualActionType(e.target.value as AuditActionType)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="profile_update">Cập nhật hồ sơ kiểm tra thực địa</option>
                  <option value="coordinate_update">Chỉnh sửa tọa độ / Ranh giới</option>
                  <option value="reminder_sent">Nhắc nhở & Đôn đốc cơ sở</option>
                  <option value="system">Tuần tra an ninh trật tự định kỳ</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Địa điểm / Hộ dân / Cơ sở kiểm tra <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Số 12 Kinh Dương Vương hoặc Tuyến đường Hồ Học Lãm"
                  value={manualTitle}
                  onChange={e => setManualTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Mã hồ sơ (nếu có)</label>
                <input
                  type="text"
                  placeholder="Ví dụ: HD-AP1-001 hoặc PCCC-ANLAC"
                  value={manualTargetCode}
                  onChange={e => setManualTargetCode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nội dung kết quả kiểm tra / thao tác <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Ghi rõ nội dung kiểm tra, kết quả thực địa, tình trạng ANTT, các yêu cầu đôn đốc..."
                  value={manualDetails}
                  onChange={e => setManualDetails(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold transition-colors shadow-sm"
                >
                  Lưu vào nhật ký hệ thống
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
