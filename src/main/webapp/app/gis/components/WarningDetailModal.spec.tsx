import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppUser, SecurityAlert } from '../types';
import { addIpToBlacklist, resolveSecurityAlert } from '../services/authService';
import { WarningDetailModal } from './WarningDetailModal';

vi.mock('../services/authService', () => ({
  addIpToBlacklist: vi.fn(),
  resolveSecurityAlert: vi.fn(),
}));

const alert: SecurityAlert = {
  id: 'synthetic-alert',
  timestamp: '2026-10-11',
  severity: 'high',
  title: 'Synthetic test alert',
  details: 'Synthetic only',
  sourceIp: '192.0.2.1',
  targetResource: 'test',
  emailNotified: false,
  adminEmailTarget: 'test@example.invalid',
  resolved: false,
};
const user: AppUser = {
  id: 'synthetic-officer',
  username: 'test-officer',
  fullName: 'Synthetic Officer',
  role: 'officer',
  rank: '',
  position: '',
  unit: '',
  badgeNumber: '',
  phone: '',
  assignedWard: '',
  assignedHamlets: [],
  assignedStreets: [],
  status: 'active',
  createdAt: '2026-10-11',
};

function openModal(currentUser?: AppUser) {
  return render(
    <WarningDetailModal
      isOpen
      onClose={vi.fn()}
      households={[]}
      onSelectHousehold={vi.fn()}
      securityAlerts={[alert]}
      currentUser={currentUser}
    />,
  );
}

describe('warning actions require actual user identity', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it.each(['resolve', 'blacklist'])('does not send %s requests without a user', action => {
    openModal();
    fireEvent.click(screen.getByRole('button', { name: action === 'resolve' ? 'Đã xác minh & Xử lý xong' : /Thêm IP.*Blacklist/ }));
    expect(resolveSecurityAlert).not.toHaveBeenCalled();
    expect(addIpToBlacklist).not.toHaveBeenCalled();
    expect(screen.getByText('Không xác định được người dùng. Vui lòng đăng nhập lại.')).toBeTruthy();
  });

  it('passes the supplied identity unchanged when resolving an alert', async () => {
    vi.mocked(resolveSecurityAlert).mockResolvedValue(undefined);
    openModal(user);
    fireEvent.click(screen.getByRole('button', { name: 'Đã xác minh & Xử lý xong' }));
    await waitFor(() => expect(resolveSecurityAlert).toHaveBeenCalledWith(alert.id, user, expect.any(String)));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Đã xác minh & Xử lý xong' })).toBeNull());
  });

  it('keeps an alert unresolved when the backend rejects the action', async () => {
    vi.mocked(resolveSecurityAlert).mockRejectedValue(new Error('Forbidden'));
    const onAlertResolved = vi.fn();
    render(
      <WarningDetailModal
        isOpen
        onClose={vi.fn()}
        households={[]}
        onSelectHousehold={vi.fn()}
        securityAlerts={[alert]}
        currentUser={user}
        onAlertResolved={onAlertResolved}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Đã xác minh & Xử lý xong' }));
    await waitFor(() => expect(screen.getByText(/Forbidden/)).toBeTruthy());
    expect(onAlertResolved).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Đã xác minh & Xử lý xong' })).toBeTruthy();
  });
});
