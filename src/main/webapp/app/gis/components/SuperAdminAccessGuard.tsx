import React from 'react';
import { Shield, ShieldAlert, ArrowRight, RefreshCw, KeyRound, LogIn, Lock } from 'lucide-react';
import { AppUser } from '../types';

interface SuperAdminAccessGuardProps {
  currentUser: AppUser;
  onSwitchToSuperAdmin: () => void;
  onSwitchAccount: () => void;
  onBackToOverview: () => void;
}

export const SuperAdminAccessGuard: React.FC<SuperAdminAccessGuardProps> = ({
  currentUser,
  onSwitchToSuperAdmin,
  onSwitchAccount,
  onBackToOverview,
}) => {
  return (
    <div id="superadmin-access-guard" className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
      <div className="bg-slate-900 border border-red-800/50 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-64 h-64 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-red-950 border border-red-700/60 flex items-center justify-center text-red-400 shadow-lg shadow-red-900/30">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <span className="px-2.5 py-0.5 rounded text-[10px] uppercase font-mono font-bold bg-red-950 text-red-300 border border-red-700/60">
              Yêu Cầu Thẩm Quyền Tối Cao
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-white mt-0.5 tracking-tight">Trung Tâm Quản Trị Hệ Thống Tối Cao</h2>
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 mb-6">
          <div className="text-xs text-slate-400 mb-1">Tài khoản đang đăng nhập:</div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-sm font-bold text-white">
                {currentUser.rank} {currentUser.fullName}
              </span>
              <span className="text-xs text-slate-400 ml-2">
                (Số hiệu: <strong className="text-amber-400">{currentUser.badgeNumber}</strong> • Vai trò:{' '}
                <span className="uppercase font-semibold text-blue-400">{currentUser.role}</span>)
              </span>
            </div>
            <span className="px-2.5 py-1 rounded text-xs font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/40">
              {currentUser.position}
            </span>
          </div>
        </div>

        <div className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed mb-8">
          <p>
            Khu vực <strong>Trung tâm Quản trị Tối cao (Super Admin Hub)</strong> chứa các chức năng bảo mật cốt lõi:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-400 text-xs sm:text-xs">
            <li>Cấu hình hiển thị menu động theo từng vai trò trên toàn hệ thống CATP</li>
            <li>Quản lý danh mục Đơn vị hành chính và mạng lưới Đường Hẻm mới nhất TP.HCM</li>
            <li>Phân quyền, tạo mới và khóa tài khoản cán bộ CAND các cấp</li>
            <li>Quản lý Whitelist Email Google SSO độc quyền</li>
            <li>
              Theo dõi cảnh báo an ninh và cấu hình thông báo đẩy Email Admin (
              <span className="text-amber-400 font-mono">laihoangdo0506@gmail.com</span>)
            </li>
          </ul>
          <p className="text-xs text-amber-300/90 pt-1">
            ⚠️ Để thao tác các tính năng trên, bạn cần đăng nhập với tài khoản <strong>Super Admin</strong> hoặc email quản trị viên tối
            cao.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
          <button
            type="button"
            id="btn-switch-to-superadmin"
            onClick={onSwitchToSuperAdmin}
            className="py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-red-900/40 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Shield className="w-4 h-4" />
            Đăng nhập bằng tài khoản quản trị
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            id="btn-switch-another-account"
            onClick={onSwitchAccount}
            className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs sm:text-sm font-semibold border border-slate-700 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            Đăng Nhập Tài Khoản Khác / Google SSO
          </button>
        </div>

        <div className="mt-4 text-center">
          <button type="button" onClick={onBackToOverview} className="text-xs text-slate-400 hover:text-slate-200 underline transition">
            ← Quay lại trang Tổng quan nghiệp vụ
          </button>
        </div>
      </div>
    </div>
  );
};
