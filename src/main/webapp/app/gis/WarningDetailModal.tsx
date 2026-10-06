import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  Send,
  CheckCircle2,
  Clock,
  MapPin,
  Store,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Ban,
  Lock,
  UserCheck,
  Check,
  AlertOctagon,
  FileCheck,
} from 'lucide-react';
import { HouseholdFacility, SecurityAlert, AppUser } from './types';
import { resolveSecurityAlert, addIpToBlacklist } from './services/authService';
import { Pagination } from './components/Pagination';

interface WarningDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  households: HouseholdFacility[];
  onSelectHousehold: (household: HouseholdFacility) => void;
  securityAlerts?: SecurityAlert[];
  currentUser?: AppUser;
  onAlertResolved?: (alertId: string) => void;
  onIpBlacklisted?: (ip: string) => void;
}

export const WarningDetailModal: React.FC<WarningDetailModalProps> = ({
  isOpen,
  onClose,
  households,
  onSelectHousehold,
  securityAlerts = [],
  currentUser,
  onAlertResolved,
  onIpBlacklisted,
}) => {
  if (!isOpen) return null;

  const warningHouseholds = households.filter(h => h.status === 'warning');
  const [remindedList, setRemindedList] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'security' | 'licenses'>('security');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState<string>('');
  const [blockingIp, setBlockingIp] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Local state for alerts to give instant feedback
  const [localAlerts, setLocalAlerts] = useState<SecurityAlert[]>(securityAlerts);

  // Pagination states with 10/20/50 format
  const [licensePage, setLicensePage] = useState<number>(1);
  const [licensePageSize, setLicensePageSize] = useState<number>(10);
  const [alertPage, setAlertPage] = useState<number>(1);
  const [alertPageSize, setAlertPageSize] = useState<number>(10);

  React.useEffect(() => {
    setLicensePage(1);
  }, [warningHouseholds.length, licensePageSize]);

  React.useEffect(() => {
    setAlertPage(1);
  }, [localAlerts.length, alertPageSize]);

  const paginatedLicenses = React.useMemo(() => {
    const start = (licensePage - 1) * licensePageSize;
    return warningHouseholds.slice(start, start + licensePageSize);
  }, [warningHouseholds, licensePage, licensePageSize]);

  const paginatedAlerts = React.useMemo(() => {
    const start = (alertPage - 1) * alertPageSize;
    return localAlerts.slice(start, start + alertPageSize);
  }, [localAlerts, alertPage, alertPageSize]);

  React.useEffect(() => {
    if (securityAlerts && securityAlerts.length > 0) {
      setLocalAlerts(securityAlerts);
    }
  }, [securityAlerts]);

  const handleRemind = (id: string) => {
    if (!remindedList.includes(id)) {
      setRemindedList(prev => [...prev, id]);
    }
  };

  const handleConfirmResolve = async (alert: SecurityAlert) => {
    const adminUser = currentUser || {
      id: 'USR-SUPERADMIN-01',
      username: 'superadmin',
      fullName: 'Đại tá Trần Quốc Huy',
      role: 'superadmin',
      rank: 'Đại tá',
      position: 'Trưởng Công an Quận',
      badgeNumber: '001-999',
      assignedDistrict: 'Quận Bình Tân',
      status: 'active',
    };

    setResolvingId(alert.id);
    try {
      await resolveSecurityAlert(alert.id, adminUser, resolveNotes || 'Đã xác minh và hoàn tất xử lý');

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const timeStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

      setLocalAlerts(prev =>
        prev.map(a =>
          a.id === alert.id
            ? {
                ...a,
                resolved: true,
                resolvedAt: timeStr,
                resolvedBy: `${adminUser.rank} ${adminUser.fullName} (ID: ${adminUser.id})`,
                resolvedNotes: resolveNotes || 'Đã xác minh và hoàn tất xử lý',
              }
            : a,
        ),
      );

      setFeedbackMsg(`Đã xác nhận hoàn tất xử lý cảnh báo ${alert.id} và tự động lưu Audit Log hệ thống!`);
      setTimeout(() => setFeedbackMsg(null), 3500);

      if (onAlertResolved) {
        onAlertResolved(alert.id);
      }
      setResolveNotes('');
    } catch (err: any) {
      setFeedbackMsg('Lỗi khi giải quyết cảnh báo: ' + err.message);
    } finally {
      setResolvingId(null);
    }
  };

  const handleQuickBlacklist = async (alert: SecurityAlert) => {
    if (!alert.sourceIp) return;
    const adminUser = currentUser || {
      id: 'USR-SUPERADMIN-01',
      username: 'superadmin',
      fullName: 'Đại tá Trần Quốc Huy',
      role: 'superadmin',
      rank: 'Đại tá',
      position: 'Trưởng Công an Quận',
      badgeNumber: '001-999',
      assignedDistrict: 'Quận Bình Tân',
      status: 'active',
    };

    setBlockingIp(alert.sourceIp);
    try {
      await addIpToBlacklist(
        alert.sourceIp,
        `Chặn khẩn cấp từ cảnh báo ${alert.id}: ${alert.title}`,
        adminUser,
        alert.id,
        `Tự động chặn tường lửa cho IP ${alert.sourceIp}`,
      );
      setFeedbackMsg(`Đã đưa địa chỉ IP ${alert.sourceIp} vào Blacklist để chặn truy cập API và ứng dụng ngay lập tức!`);
      setTimeout(() => setFeedbackMsg(null), 3500);
      if (onIpBlacklisted) {
        onIpBlacklisted(alert.sourceIp);
      }
    } catch (err: any) {
      setFeedbackMsg('Lỗi khi chặn IP: ' + err.message);
    } finally {
      setBlockingIp(null);
    }
  };

  const unresolvedCount = localAlerts.filter(a => !a.resolved).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-red-700 via-amber-700 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-red-800/90 flex items-center justify-center font-bold text-white shadow-sm shrink-0">
              <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold flex items-center gap-2">
                Trung Tâm Cảnh Báo An Ninh & Giám Sát Địa Bàn
                {unresolvedCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-extrabold animate-pulse">
                    {unresolvedCount} cần xử lý
                  </span>
                )}
              </h3>
              <p className="text-[11px] sm:text-xs text-amber-100">
                Xác minh cảnh báo cơ sở dữ liệu, chặn IP nghi vấn & đôn đốc giấy phép an ninh
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-200 bg-slate-100/80 px-4 pt-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`py-2 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'security'
                ? 'border-red-600 text-red-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
            Cảnh Báo An Ninh & Database ({localAlerts.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('licenses')}
            className={`py-2 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'licenses'
                ? 'border-amber-600 text-amber-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Cảnh Báo Giấy Phép Cơ Sở ({warningHouseholds.length})
          </button>
        </div>

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div className="mx-4 mt-3 p-2.5 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* Tab Content: Security Alerts */}
        {activeTab === 'security' && (
          <div className="p-4 sm:p-6 space-y-4 text-xs overflow-y-auto flex-1">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 text-[11px] leading-relaxed flex items-start gap-2">
              <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <strong>Chính sách Bảo mật CAND:</strong> Quản trị viên sau khi kiểm tra nhật ký truy vấn bất thường cần nhấn{' '}
                <strong>"Đã xác minh & Xử lý xong"</strong> để hoàn tất quy trình an ninh. Hệ thống sẽ tự động ghi nhật ký Audit Log bảo mật
                kèm chữ ký định danh.
              </div>
            </div>

            <div className="space-y-3.5">
              {paginatedAlerts.map(alert => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-xl border-2 transition-all space-y-3 ${
                    alert.resolved
                      ? 'bg-slate-50/80 border-slate-200 opacity-90'
                      : alert.severity === 'critical'
                        ? 'bg-red-50/70 border-red-300'
                        : alert.severity === 'high'
                          ? 'bg-amber-50/70 border-amber-300'
                          : 'bg-blue-50/70 border-blue-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] uppercase font-black ${
                            alert.severity === 'critical'
                              ? 'bg-red-700 text-white'
                              : alert.severity === 'high'
                                ? 'bg-amber-700 text-white'
                                : 'bg-blue-700 text-white'
                          }`}
                        >
                          {alert.severity}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-700">Mã sự cố: {alert.id}</span>

                        {/* Resolved Status Badge */}
                        {alert.resolved ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Đã xác minh & Xử lý xong
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-bold flex items-center gap-1 animate-pulse">
                            <AlertOctagon className="w-3 h-3 text-rose-600" />
                            Chưa xử lý
                          </span>
                        )}
                      </div>

                      <h4 className="font-extrabold text-sm text-slate-900 pt-0.5">{alert.title}</h4>
                    </div>

                    <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap">{alert.timestamp}</span>
                  </div>

                  <p className="text-slate-700 text-xs leading-relaxed bg-white/70 p-2.5 rounded-lg border border-slate-200/80">
                    {alert.details}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 bg-white/40 p-2 rounded">
                    <div>
                      IP nguồn: <strong className="font-mono text-rose-700">{alert.sourceIp}</strong>
                    </div>
                    <div>
                      Đối tượng: <strong className="text-slate-800">{alert.attemptedEmailOrUser || 'Không rõ'}</strong>
                    </div>
                    <div>
                      Tài nguyên đích: <strong className="text-slate-800">{alert.targetResource}</strong>
                    </div>
                    <div>
                      Email nhận cảnh báo: <strong className="text-blue-700">{alert.adminEmailTarget}</strong>
                    </div>
                  </div>

                  {/* Resolution Detail Stamp if resolved */}
                  {alert.resolved && (
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Biên bản hoàn tất xử lý sự cố an ninh:</span>
                      </div>
                      <div className="text-[10px] text-emerald-800">
                        Thời gian giải quyết: <strong>{alert.resolvedAt || 'Vừa xong'}</strong>
                      </div>
                      {alert.resolvedBy && (
                        <div className="text-[10px] text-emerald-800">
                          Cán bộ xác nhận: <strong>{alert.resolvedBy}</strong>
                        </div>
                      )}
                      {alert.resolvedNotes && <div className="text-[10px] italic text-emerald-700">Ghi chú: "{alert.resolvedNotes}"</div>}
                    </div>
                  )}

                  {/* Actions for unresolved alerts */}
                  {!alert.resolved && (
                    <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleQuickBlacklist(alert)}
                        disabled={blockingIp === alert.sourceIp}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-rose-300 border border-rose-500/40 rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-colors"
                      >
                        <Ban className="w-3.5 h-3.5 text-rose-400" />
                        <span>{blockingIp === alert.sourceIp ? 'Đang chặn...' : `Thêm IP ${alert.sourceIp} vào Blacklist`}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleConfirmResolve(alert)}
                        disabled={resolvingId === alert.id}
                        className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-[11px] flex items-center gap-1.5 shadow-xs transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{resolvingId === alert.id ? 'Đang ghi nhận...' : 'Đã xác minh & Xử lý xong'}</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {localAlerts.length > 0 && (
              <div className="pt-2">
                <Pagination
                  currentPage={alertPage}
                  totalItems={localAlerts.length}
                  pageSize={alertPageSize}
                  pageSizeOptions={[10, 20, 50]}
                  onPageChange={setAlertPage}
                  onPageSizeChange={setAlertPageSize}
                  itemLabel="cảnh báo an ninh"
                />
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Business License Warnings */}
        {activeTab === 'licenses' && (
          <div className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 text-xs overflow-y-auto flex-1">
            <p className="text-slate-600 text-[11px] sm:text-xs leading-relaxed">
              Theo quy định an ninh trật tự và PCCC, các cơ sở kinh doanh có điều kiện phải nộp hồ sơ gia hạn tối thiểu 15 ngày trước thời
              hạn hết hiệu lực.
            </p>

            <div className="space-y-3">
              {paginatedLicenses.map(h => {
                const isReminded = remindedList.includes(h.id);
                return (
                  <div key={h.id} className="p-3.5 sm:p-4 rounded-xl border-2 border-amber-300 bg-amber-50/70 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Store className="w-4 h-4 text-amber-800 shrink-0" />
                        <span className="font-extrabold text-xs sm:text-sm text-slate-900">{h.businessName}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-900 font-bold text-[10px] shrink-0">
                        Hạn: {h.licenseExpiry}
                      </span>
                    </div>

                    <div className="text-slate-600 flex items-center gap-1 text-[11px] sm:text-xs">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        Số {h.houseNumber} {h.street}, {h.hamlet}
                        {h.ward ? `, ${h.ward}` : ''}
                      </span>
                    </div>

                    <div className="text-slate-600 flex items-center justify-between text-[11px] sm:text-xs">
                      <span>
                        Đại diện: <strong>{h.ownerName}</strong>
                      </span>
                      <span className="font-mono font-bold text-blue-700">{h.ownerPhone}</span>
                    </div>

                    <div className="pt-2 border-t border-amber-200 flex items-center justify-between gap-2">
                      <button
                        onClick={() => {
                          onClose();
                          onSelectHousehold(h);
                        }}
                        className="text-blue-700 hover:underline font-bold text-xs"
                      >
                        Chi tiết hồ sơ &rarr;
                      </button>

                      <div className="flex items-center gap-2">
                        {isReminded ? (
                          <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Đã gửi đôn đốc
                          </span>
                        ) : (
                          <button
                            onClick={() => handleRemind(h.id)}
                            className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg font-bold text-[11px] transition-colors flex items-center gap-1 min-h-[36px]"
                          >
                            <Send className="w-3 h-3" />
                            <span>Gửi nhắc hẹn</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {warningHouseholds.length > 0 && (
              <div className="pt-2">
                <Pagination
                  currentPage={licensePage}
                  totalItems={warningHouseholds.length}
                  pageSize={licensePageSize}
                  pageSizeOptions={[10, 20, 50]}
                  onPageChange={setLicensePage}
                  onPageSizeChange={setLicensePageSize}
                  itemLabel="cơ sở cảnh báo"
                />
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">Hệ thống An ninh Địa bàn CAND - Bảo mật 24/7</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs min-h-[38px]"
          >
            Đóng bảng cảnh báo
          </button>
        </div>
      </div>
    </div>
  );
};
