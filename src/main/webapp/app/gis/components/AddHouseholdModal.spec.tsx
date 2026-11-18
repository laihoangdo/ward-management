import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AddHouseholdModal } from './AddHouseholdModal';

vi.mock('../services/rbacApiService', () => ({ fetchRbacAreas: vi.fn().mockResolvedValue([]) }));
describe('New household input', () => {
  it('warns about inconsistent complete counts without filling unknown groups', async () => {
    await act(async () => {
      render(<AddHouseholdModal isOpen onClose={vi.fn()} onAddHousehold={vi.fn()} />);
      await Promise.resolve();
    });
    fireEvent.change(screen.getByLabelText('Tổng'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Nam'), { target: { value: '1' } });
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.change(screen.getByLabelText('Nữ'), { target: { value: '1' } });
    expect(screen.getByRole('status').textContent).toContain('chưa khớp tổng');
    expect((screen.getByLabelText('≥ 18t') as HTMLInputElement).value).toBe('');
  });
  it('does not prefill unknown population counts or telephone data', async () => {
    await act(async () => {
      render(<AddHouseholdModal isOpen onClose={vi.fn()} onAddHousehold={vi.fn()} />);
      await Promise.resolve();
    });
    expect((screen.getByLabelText('Số điện thoại liên lạc') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Tổng') as HTMLInputElement).value).toBe('');
  });
  it('asks before discarding edits and supports continuing', async () => {
    const close = vi.fn();
    await act(async () => {
      render(<AddHouseholdModal isOpen onClose={close} onAddHousehold={vi.fn()} />);
      await Promise.resolve();
    });
    fireEvent.change(screen.getByPlaceholderText('Họ và tên...'), { target: { value: 'New owner' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hủy bỏ' }));
    expect(screen.getByRole('alertdialog')).toBeDefined();
    expect(close).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }));
    expect((screen.getByPlaceholderText('Họ và tên...') as HTMLInputElement).value).toBe('New owner');
    fireEvent.click(screen.getByRole('button', { name: 'Hủy bỏ' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ thay đổi' }));
    expect(close).toHaveBeenCalledOnce();
  });
});
