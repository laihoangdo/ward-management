import React from 'react';
import { Shield, LogIn } from 'lucide-react';
import { beginBackendLogin } from '../services/backendSession';

export const LoginScreen = () => (
  <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
    <main className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-xl">
      <Shield className="mb-4 h-10 w-10 text-amber-400" />
      <h1 className="text-2xl font-bold">Quản lý an ninh địa bàn</h1>
      <p className="mt-3 text-slate-300">Đăng nhập bằng tài khoản được đơn vị cấp để truy cập bản đồ và dữ liệu nghiệp vụ.</p>
      <button
        type="button"
        onClick={beginBackendLogin}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-500"
      >
        <LogIn className="h-5 w-5" /> Đăng nhập
      </button>
      <a href="/" className="mt-4 block text-center text-sm text-slate-400 underline">
        Về trang chủ
      </a>
    </main>
  </div>
);
