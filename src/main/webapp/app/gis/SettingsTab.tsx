import React, { useState } from 'react';
import { User, Shield, Key, Bell, Moon, Sun, Monitor, Database, CheckCircle, Save, Lock, BadgeCheck, RefreshCw } from 'lucide-react';
import { OfficerProfile } from './types';

interface SettingsTabProps {
  officer: OfficerProfile;
  onUpdateOfficer: (updated: Partial<OfficerProfile>) => void;
  isFirestoreConnected?: boolean;
  backendStatus?: 'checking' | 'online' | 'offline';
  theme?: 'light' | 'dark';
  onSetTheme?: (theme: 'light' | 'dark') => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  officer,
  onUpdateOfficer,
  isFirestoreConnected = true,
  backendStatus = 'checking',
  theme = 'light',
  onSetTheme,
}) => {
  const [officerName, setOfficerName] = useState(officer.officerName);
  const [rank, setRank] = useState(officer.rank);
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState('60');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateOfficer({
      officerName,
      rank,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto">
      {/* Banner */}
      <div className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div id="settings-eyebrow" className="text-[11px] sm:text-xs font-bold text-blue-600 tracking-wider uppercase mb-1">
            TÙY CHỈNH HỆ THỐNG
          </div>
          <h2 id="settings-title" className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Cài đặt
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1">
            Quản lý thông tin hồ sơ cán bộ CSKV và tùy biến hiển thị trung tâm điều hành.
          </p>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-3.5 sm:p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Thông tin tài khoản đã được lưu thành công vào phiên làm việc!</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Account Card */}
        <div id="account-card" className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 id="account-title" className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              <span>Thông tin tài khoản</span>
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
              <BadgeCheck className="w-3.5 h-3.5 text-blue-600" />
              Đã xác thực CAND
            </span>
          </div>

          <form onSubmit={handleSave} className="space-y-3.5 sm:space-y-4 text-xs">
            <div>
              <label className="block text-slate-600 font-bold mb-1">Tài khoản đăng nhập (Hệ thống điều hành):</label>
              <input
                type="text"
                disabled
                value={officer.username}
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-mono text-slate-500 cursor-not-allowed text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-bold mb-1">Cấp bậc / Chức vụ:</label>
                <input
                  type="text"
                  value={rank}
                  onChange={e => setRank(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 text-slate-800 font-semibold text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-bold mb-1">Số hiệu CAND:</label>
                <input
                  type="text"
                  disabled
                  value={officer.badgeNumber}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-mono text-slate-500 cursor-not-allowed text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-600 font-bold mb-1">Họ và tên cán bộ CSKV:</label>
              <input
                type="text"
                value={officerName}
                onChange={e => setOfficerName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 text-slate-800 font-bold text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-bold mb-1">Đơn vị công tác:</label>
              <input
                type="text"
                disabled
                value={officer.unit}
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 cursor-not-allowed font-medium text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-bold mb-1">Phân quyền địa bàn được cấp:</label>
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-900 font-semibold leading-relaxed text-xs">
                {officer.permissions}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-xs min-h-[42px]"
              >
                <Save className="w-4 h-4" />
                <span>Cập nhật thông tin cán bộ</span>
              </button>
            </div>
          </form>
        </div>

        {/* Appearance Card */}
        <div id="appearance-card" className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 id="appearance-title" className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <Monitor className="w-4 h-4 text-blue-600" />
              <span>Tùy chọn giao diện</span>
            </h3>
            <span className="text-xs text-slate-400 font-medium">Bản v2.4.0</span>
          </div>

          <div className="space-y-3.5 sm:space-y-4 text-xs">
            {/* Sound alert notification */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2.5">
                <Bell className="w-4 h-4 text-amber-600" />
                <div>
                  <div className="font-bold text-slate-800">Cảnh báo âm thanh hồ sơ quá hạn</div>
                  <div className="text-slate-500 text-[11px]">Phát âm báo khi có cơ sở chạm ngưỡng 7 ngày hết hạn</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={soundAlerts}
                onChange={e => setSoundAlerts(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
            </div>

            {/* Auto refresh rate */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-bold text-slate-800 flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                  <span>Tần suất đồng bộ dữ liệu thực địa:</span>
                </div>
                <span className="font-mono font-bold text-blue-600">{autoRefreshInterval} giây</span>
              </div>
              <select
                value={autoRefreshInterval}
                onChange={e => setAutoRefreshInterval(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-semibold"
              >
                <option value="30">30 giây (Thời gian thực)</option>
                <option value="60">60 giây (Mặc định)</option>
                <option value="300">5 phút (Tiết kiệm băng thông)</option>
              </select>
            </div>

            {/* Dark Mode / Light Mode Theme Selector */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-bold text-slate-800 flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-blue-600" />
                  <span>Chế độ giao diện (Dark / Light Mode):</span>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  {theme === 'dark' ? 'Đang bật: Chế độ Tối' : 'Đang bật: Chế độ Sáng'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {/* Light Mode Option */}
                <button
                  type="button"
                  id="theme-select-light"
                  onClick={() => onSetTheme && onSetTheme('light')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    theme === 'light'
                      ? 'bg-white border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
                      : 'bg-white/60 border-slate-200 hover:border-slate-300 opacity-80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                      <Sun className="w-4 h-4 text-amber-500" />
                    </div>
                    {theme === 'light' && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-600 text-white">Đang chọn</span>
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-xs">Chế độ Sáng (Light)</div>
                    <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                      Độ tương phản cao, tối ưu hiển thị ngoài trời nắng khi CSKV đi tuần tra, kiểm tra thực địa.
                    </div>
                  </div>
                </button>

                {/* Dark Mode Option */}
                <button
                  type="button"
                  id="theme-select-dark"
                  onClick={() => onSetTheme && onSetTheme('dark')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    theme === 'dark'
                      ? 'bg-slate-900 border-amber-400 ring-2 ring-amber-400/30 text-white shadow-xs'
                      : 'bg-slate-800/80 border-slate-700 hover:border-slate-600 text-slate-200 opacity-80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold">
                      <Moon className="w-4 h-4 text-indigo-400" />
                    </div>
                    {theme === 'dark' && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-slate-950">Đang chọn</span>
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-white text-xs">Chế độ Tối (Dark)</div>
                    <div className="text-[11px] text-slate-300 mt-1 leading-snug">
                      Dịu mắt, bảo vệ thị lực trong môi trường thiếu sáng hoặc khi trực ca đêm tại địa bàn.
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Server & Security Status */}
            <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 text-slate-700 space-y-2">
              <div className="font-bold text-blue-900 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-blue-600" />
                  <span>Máy chủ Backend & Database Engine</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    backendStatus === 'online' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {backendStatus === 'online' ? '● Backend Online' : backendStatus === 'offline' ? '○ Mất kết nối' : '○ Đang kiểm tra'}
                </span>
              </div>
              <div className="text-[11px] text-slate-600 flex justify-between">
                <span>Hỗ trợ hệ cơ sở dữ liệu:</span>
                <span className="font-bold text-emerald-600 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  PostgreSQL qua API Spring Boot
                </span>
              </div>
              <div className="text-[11px] text-slate-600 flex justify-between">
                <span>Chuẩn công nghệ đích (JHipster 9.4):</span>
                <span className="font-mono text-slate-700 font-semibold text-[10px]">Spring Boot 3 • PostGIS GIS ST_* • Liquibase</span>
              </div>
              <div className="text-[11px] text-slate-600 flex justify-between">
                <span>Trạng thái kết nối Realtime / SQL:</span>
                <span className="font-mono text-slate-700 font-semibold text-[10px] text-emerald-700">
                  Sẵn sàng nhận URL mọi môi trường (Docker/Cloud)
                </span>
              </div>
              <div className="text-[11px] text-slate-600 flex justify-between">
                <span>Mã hóa bảo mật đường truyền:</span>
                <span className="font-mono text-slate-700">AES-256 GCM • SSL/TLS (sslmode=require/disable)</span>
              </div>
            </div>

            {/* REST API Endpoints Catalog */}
            <div className="p-3.5 rounded-xl bg-slate-900 text-white space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200">Danh mục API Backend (Express REST)</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-blue-900/80 text-blue-300 rounded font-mono">8 Endpoints</span>
              </div>
              <div className="space-y-1.5 font-mono text-[10px]">
                <div className="flex items-center justify-between p-1.5 bg-slate-800/80 rounded border border-slate-700">
                  <span className="text-emerald-400 font-bold">GET</span>
                  <span className="text-slate-300">/api/households (Hồ sơ địa bàn)</span>
                </div>
                <div className="flex items-center justify-between p-1.5 bg-slate-800/80 rounded border border-slate-700">
                  <span className="text-blue-400 font-bold">POST</span>
                  <span className="text-slate-300">/api/households (Thêm hộ dân/cơ sở)</span>
                </div>
                <div className="flex items-center justify-between p-1.5 bg-slate-800/80 rounded border border-slate-700">
                  <span className="text-emerald-400 font-bold">GET</span>
                  <span className="text-slate-300">/api/documents (Hồ sơ cấp phép)</span>
                </div>
                <div className="flex items-center justify-between p-1.5 bg-slate-800/80 rounded border border-slate-700">
                  <span className="text-amber-400 font-bold">PATCH</span>
                  <span className="text-slate-300">/api/documents/:id/remind</span>
                </div>
                <div className="flex items-center justify-between p-1.5 bg-slate-800/80 rounded border border-slate-700">
                  <span className="text-emerald-400 font-bold">GET</span>
                  <span className="text-slate-300">/api/stats/overview (Thống kê)</span>
                </div>
                <div className="flex items-center justify-between p-1.5 bg-slate-800/80 rounded border border-slate-700">
                  <span className="text-purple-400 font-bold">GET</span>
                  <span className="text-slate-300">/api/audit-logs (Nhật ký công tác)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
