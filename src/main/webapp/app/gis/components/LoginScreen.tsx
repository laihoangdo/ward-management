import React from 'react';
import { Shield, LogIn } from 'lucide-react';
import { beginBackendLogin } from '../services/backendSession';

export const LoginScreen = () => (
  <div className="gis-login min-h-screen flex items-center justify-center p-5 sm:p-8">
    <main className="gis-login-card w-full max-w-md rounded-xl p-6 sm:p-8">
      <div className="gis-login-emblem">
        <Shield aria-hidden="true" className="h-7 w-7" />
      </div>
      <p className="gis-login-eyebrow">KHÔNG GIAN LÀM VIỆC NỘI BỘ</p>
      <h1 className="text-2xl font-bold">Quản lý an ninh địa bàn</h1>
      <p className="gis-login-description mt-3">Đăng nhập bằng tài khoản được đơn vị cấp để truy cập bản đồ và dữ liệu nghiệp vụ.</p>
      <button
        type="button"
        onClick={beginBackendLogin}
        className="gis-login-submit mt-6 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold"
      >
        <LogIn className="h-5 w-5" /> Đăng nhập
      </button>
      <p className="gis-login-note">Truy cập theo phân quyền · Bảo vệ dữ liệu nghiệp vụ</p>
      <a href="/" className="mt-4 block text-center text-sm underline">
        Về trang chủ
      </a>
    </main>
  </div>
);
