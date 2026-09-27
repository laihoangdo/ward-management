import React, { useState } from 'react';
import {
  Shield,
  ShieldCheck,
  Lock,
  User,
  Mail,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  HelpCircle,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { auth } from './firebase';
import { AppUser, AllowedEmailEntry, UserRole } from './types';
import { INITIAL_USERS, INITIAL_ALLOWED_EMAILS } from './data/initialAuthData';
import { loginWithCredentials, verifyAndLoginGoogleEmail, loginWithGooglePopup } from './services/authService';

interface LoginScreenProps {
  usersList?: AppUser[];
  allowedEmailsList?: AllowedEmailEntry[];
  onLoginSuccess: (user: AppUser) => void;
  onShowToast?: (msg: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  usersList = INITIAL_USERS,
  allowedEmailsList = INITIAL_ALLOWED_EMAILS,
  onLoginSuccess,
  onShowToast = (_msg: string) => {},
}) => {
  const [activeTab, setActiveTab] = useState<'credentials' | 'google'>('credentials');

  // Credentials state
  const [username, setUsername] = useState('cskv_ap1');
  const [password, setPassword] = useState('Ap1@2026');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Google email input state for direct whitelist verify
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [googleStatus, setGoogleStatus] = useState<'idle' | 'checking' | 'rejected' | 'accepted'>('idle');
  const [googleRejectedEmail, setGoogleRejectedEmail] = useState<string | null>(null);

  // Demo accounts quick select
  const demoAccounts = [
    {
      role: 'superadmin' as UserRole,
      title: 'Super Admin (Tối cao)',
      user: 'superadmin',
      pass: 'Admin@2026',
      name: 'Đại tá Trần Quốc Huy',
      pos: 'Quản trị viên Tối cao / Cục Tham mưu CATP',
      badge: '001-999',
      color: 'border-red-500/40 bg-red-500/5 hover:bg-red-500/10 text-red-700 dark:text-red-300',
    },
    {
      role: 'admin' as UserRole,
      title: 'Admin (Trưởng CAX)',
      user: 'truong_cax',
      pass: 'Cax@2026',
      name: 'Thiếu tá Lê Quốc Tuấn',
      pos: 'Trưởng Công an Phường/Xã An Lạc',
      badge: '284-001',
      color: 'border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 text-amber-700 dark:text-amber-300',
    },
    {
      role: 'sub-admin' as UserRole,
      title: 'Sub-admin (CA Quản lý Ấp)',
      user: 'cskv_ap1',
      pass: 'Ap1@2026',
      name: 'Đại úy Nguyễn Văn Bình',
      pos: 'CSKV Phụ trách Ấp 1 & Ấp 2',
      badge: '284-912',
      color: 'border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/10 text-blue-700 dark:text-blue-300',
    },
    {
      role: 'officer' as UserRole,
      title: 'Công an viên (Quản lý Tuyến/Hẻm)',
      user: 'cav_duongpho',
      pass: 'Cav@2026',
      name: 'Thượng úy Trần Minh Quân',
      pos: 'CAV Phụ trách Hẻm 418 & Tuyến KDV',
      badge: '284-755',
      color: 'border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    },
  ];

  const handleSelectDemo = (acc: (typeof demoAccounts)[0]) => {
    setUsername(acc.user);
    setPassword(acc.pass);
    setErrorMessage(null);
  };

  const handleSubmitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMessage('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await loginWithCredentials(username, password, usersList);
      if (res.success && res.user) {
        onShowToast(`Đăng nhập thành công! Chào mừng ${res.user.rank} ${res.user.fullName}.`);
        onLoginSuccess(res.user);
      } else {
        setErrorMessage(res.error || 'Đăng nhập không thành công.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi hệ thống trong quá trình xác thực.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGooglePopupClick = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setGoogleStatus('checking');

    try {
      const res = await loginWithGooglePopup(allowedEmailsList, usersList);
      if (res.success && res.user) {
        setGoogleStatus('accepted');
        onShowToast(`Xác thực Google Whitelist thành công! Chào mừng ${res.user.fullName}.`);
        onLoginSuccess(res.user);
      } else {
        setGoogleStatus('rejected');
        setGoogleRejectedEmail(auth.currentUser?.email || 'Hộp thư hiện tại');
        setErrorMessage(res.error || 'Xác thực Google thất bại hoặc không nằm trong danh sách cấp phép.');
      }
    } catch (err: any) {
      setGoogleStatus('rejected');
      setErrorMessage(err.message || 'Lỗi kết nối dịch vụ Google Auth.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCustomEmail = async (emailToVerify: string) => {
    if (!emailToVerify.trim()) {
      setErrorMessage('Vui lòng nhập địa chỉ Gmail cần xác thực.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    setGoogleStatus('checking');

    try {
      const res = await verifyAndLoginGoogleEmail(emailToVerify, allowedEmailsList, usersList);
      if (res.success && res.user) {
        setGoogleStatus('accepted');
        onShowToast(`Email ${emailToVerify} đã được xác thực trong Whitelist.`);
        onLoginSuccess(res.user);
      } else {
        setGoogleStatus('rejected');
        setGoogleRejectedEmail(emailToVerify);
        setErrorMessage(res.error || 'Email không được cấp phép.');
      }
    } catch (err: any) {
      setGoogleStatus('rejected');
      setErrorMessage(err.message || 'Lỗi xác thực email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="login-container" className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between relative overflow-hidden">
      {/* Background Security Pattern & Glows */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/30 via-slate-900/80 to-slate-950 pointer-events-none" />
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Banner */}
      <header className="relative z-10 w-full border-b border-slate-800 bg-slate-950/60 backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center shadow-lg shadow-red-600/20 border border-amber-400/30">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-wide uppercase text-amber-400 flex items-center gap-2">
                Bộ Công An • CATP. Hồ Chí Minh
                <span className="text-xs px-2 py-0.5 rounded bg-red-900/40 text-red-300 border border-red-700/50 font-mono">
                  BẢO MẬT CẤP II
                </span>
              </div>
              <h1 className="text-base font-semibold text-slate-200">Hệ Thống Số Hóa Bản Đồ & Quản Lý An Ninh Địa Bàn</h1>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-4 text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              MÁY CHỦ BẢO MẬT ONLINE
            </span>
            <span>|</span>
            <span>FIREBASE FIRESTORE ENCRYPTED</span>
          </div>
        </div>
      </header>

      {/* Main Form Center */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 my-4">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Column: Login Card */}
          <div className="lg:col-span-7 bg-slate-900/90 border border-slate-750 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Lock className="w-5 h-5 text-amber-400" />
                    Cổng Đăng Nhập Xác Thực
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">Hệ thống phân quyền RBAC: Super Admin, Admin, Sub-admin & Công an viên.</p>
                </div>
              </div>

              {/* Login Method Tabs */}
              <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 mb-6">
                <button
                  type="button"
                  id="tab-btn-credentials"
                  onClick={() => {
                    setActiveTab('credentials');
                    setErrorMessage(null);
                  }}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    activeTab === 'credentials'
                      ? 'bg-gradient-to-r from-red-700 to-red-800 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  Tài khoản CAND & Mật khẩu
                </button>
                <button
                  type="button"
                  id="tab-btn-google"
                  onClick={() => {
                    setActiveTab('google');
                    setErrorMessage(null);
                  }}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    activeTab === 'google'
                      ? 'bg-gradient-to-r from-blue-700 to-indigo-800 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  Google / Gmail (Whitelist)
                </button>
              </div>

              {/* Error Message Box */}
              {errorMessage && (
                <div className="mb-5 p-3.5 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-xs flex items-start gap-2.5 leading-relaxed">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block mb-0.5">Xác thực không thành công:</span>
                    {errorMessage}
                  </div>
                </div>
              )}

              {/* Credentials Form */}
              {activeTab === 'credentials' && (
                <form onSubmit={handleSubmitCredentials} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Tên đăng nhập CAND / Mã định danh cán bộ</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        id="login-username-input"
                        type="text"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        placeholder="e.g. superadmin, truong_cax, cskv_ap1..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Mật khẩu bảo mật</label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        id="login-password-input"
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    id="btn-submit-credentials"
                    disabled={isSubmitting}
                    className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 via-amber-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-semibold text-sm shadow-lg shadow-red-900/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Đang đối soát an ninh...
                      </span>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        Đăng Nhập Vào Hệ Thống
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Google Whitelist Form */}
              {activeTab === 'google' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800/40 text-xs text-blue-200 leading-relaxed flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-blue-300">Cơ chế Kiểm soát Email Whitelist:</span>
                      Chỉ những hộp thư Gmail được <strong>Super Admin</strong> phê duyệt trước mới được phép cấp quyền truy cập. Mọi nỗ lực
                      truy cập ngoài danh sách sẽ bị chặn và kích hoạt cảnh báo an ninh về email Admin.
                    </div>
                  </div>

                  {/* Google SSO Button */}
                  <button
                    type="button"
                    id="btn-google-sso"
                    onClick={handleGooglePopupClick}
                    disabled={isSubmitting}
                    className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-semibold text-sm shadow-lg flex items-center justify-center gap-3 transition-all cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    Xác thực bằng Google SSO Popup
                  </button>

                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-slate-800" />
                    <span className="flex-shrink mx-3 text-xs text-slate-500 uppercase tracking-wider font-mono">
                      hoặc kiểm tra email trong Whitelist
                    </span>
                    <div className="flex-grow border-t border-slate-800" />
                  </div>

                  {/* Manual verify email in whitelist */}
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-slate-300">Nhập địa chỉ Gmail cán bộ:</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          type="email"
                          id="input-custom-google-email"
                          value={customGoogleEmail}
                          onChange={e => setCustomGoogleEmail(e.target.value)}
                          placeholder="e.g. laihoangdo0506@gmail.com"
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-400"
                        />
                      </div>
                      <button
                        type="button"
                        id="btn-verify-whitelist-email"
                        onClick={() => handleVerifyCustomEmail(customGoogleEmail)}
                        disabled={isSubmitting || !customGoogleEmail.trim()}
                        className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50 transition cursor-pointer"
                      >
                        Kiểm Tra & Vào
                      </button>
                    </div>
                  </div>

                  {/* Quick Select Whitelisted Email Pills */}
                  <div className="mt-3">
                    <span className="text-xs text-slate-400 font-medium block mb-2">
                      Các tài khoản Gmail đã được duyệt trong Whitelist của Super Admin:
                    </span>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {allowedEmailsList.map(entry => (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => {
                            setCustomGoogleEmail(entry.email);
                            handleVerifyCustomEmail(entry.email);
                          }}
                          className="w-full text-left p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-850 flex items-center justify-between text-xs transition"
                        >
                          <div className="truncate pr-2">
                            <span className="font-mono text-blue-400 block truncate">{entry.email}</span>
                            <span className="text-[11px] text-slate-400 truncate block">
                              {entry.fullName} ({entry.position})
                            </span>
                          </div>
                          <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-blue-900/40 text-blue-300 border border-blue-700/40">
                            {entry.role}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Security Footer Notice */}
            <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Mã hóa đầu cuối SHA-256
              </span>
              <span>Phiên bản 2.5 • CATP.HCM</span>
            </div>
          </div>

          {/* Right Column: Quick Role Switcher & RBAC Guide */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
                <Sparkles className="w-4 h-4" />
                Thử Nghiệm Nhanh Các Cấp Bậc RBAC
              </div>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Nhấp chuột vào một trong 4 cấp bậc tài khoản bên dưới để tự động điền thông tin và trải nghiệm giao diện phân quyền tương
                ứng:
              </p>

              <div className="space-y-2.5">
                {demoAccounts.map(acc => (
                  <button
                    key={acc.role}
                    type="button"
                    id={`demo-acc-${acc.role}`}
                    onClick={() => {
                      setActiveTab('credentials');
                      handleSelectDemo(acc);
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-start justify-between cursor-pointer ${acc.color}`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs">{acc.title}</span>
                      </div>
                      <div className="text-xs font-medium mt-0.5 text-slate-200">
                        {acc.name} ({acc.pos})
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                        User: <strong className="text-slate-300">{acc.user}</strong> | Pass:{' '}
                        <strong className="text-slate-300">{acc.pass}</strong>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-70 shrink-0 mt-2" />
                  </button>
                ))}
              </div>
            </div>

            {/* RBAC Role Architecture Explanatory Card */}
            <div className="bg-slate-950/80 border border-slate-850 rounded-2xl p-5 text-xs text-slate-400 space-y-2">
              <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                Cơ Cấu Thẩm Quyền Hệ Thống:
              </div>
              <ul className="space-y-1.5 text-[11px] leading-relaxed list-disc list-inside">
                <li>
                  <strong className="text-red-400">Super Admin</strong>: Toàn quyền, menu riêng quản lý menu động, cập nhật đường hẻm
                  TP.HCM, whitelist email và nhận cảnh báo bảo mật.
                </li>
                <li>
                  <strong className="text-amber-400">Admin (Trưởng CAX)</strong>: Quản lý toàn xã, giám sát các ấp và chỉ đạo cán bộ phụ
                  trách ấp.
                </li>
                <li>
                  <strong className="text-blue-400">Sub-admin (CA Quản lý Ấp)</strong>: Phụ trách ấp, phân quyền nghiệp vụ cụ thể cho các
                  công an viên cấp dưới.
                </li>
                <li>
                  <strong className="text-emerald-400">Công an viên</strong>: Trực tiếp quản lý các tuyến đường hẻm được giao, thực hiện
                  kiểm tra thực địa.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="relative z-10 w-full border-t border-slate-850 py-3 px-6 text-center text-xs text-slate-500 font-mono">
        Bản quyền thuộc Công an TP. Hồ Chí Minh • Phục vụ công tác bảo đảm an ninh trật tự địa bàn cơ sở
      </footer>
    </div>
  );
};
