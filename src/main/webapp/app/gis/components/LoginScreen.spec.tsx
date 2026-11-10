import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LoginScreen } from './LoginScreen';
import { beginBackendLogin } from '../services/backendSession';

vi.mock('../services/backendSession', () => ({ beginBackendLogin: vi.fn() }));
afterEach(cleanup);
it('keeps backend authentication and the portal link unchanged', () => {
  render(<LoginScreen />);
  fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
  expect(beginBackendLogin).toHaveBeenCalledOnce();
  expect(screen.getByRole('link', { name: 'Về trang chủ' }).getAttribute('href')).toBe('/');
});
