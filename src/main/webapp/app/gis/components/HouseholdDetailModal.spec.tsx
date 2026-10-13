import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HouseholdDetailModal } from './HouseholdDetailModal';
import { HouseholdFacility, AppUser } from '../types';

vi.mock('./InspectionCameraModal', () => ({ InspectionCameraModal: () => null }));
vi.mock('./OcrScanModal', () => ({ OcrScanModal: () => null }));
vi.mock('../services/firestoreService', () => ({ deleteInspectionPhotoFromHousehold: vi.fn() }));

const household = {
  id: '1',
  code: 'HH-1',
  ownerName: 'Resident',
  houseNumber: '1',
  street: 'Main',
  hamlet: 'Area',
  type: 'household',
  status: 'normal',
  notes: 'Existing notes',
  residentsList: [],
  coordinates: [10, 106],
  inspectionPhotos: [],
} as unknown as HouseholdFacility;

describe('Household save feedback', () => {
  it('preserves zero residents and blank optional address fields when editing', () => {
    render(
      <HouseholdDetailModal
        household={{ ...household, residentsCount: 0 }}
        currentUser={{ role: 'superadmin' } as AppUser}
        onClose={vi.fn()}
        onUpdateNotes={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa thông tin hộ' }));
    expect((screen.getByLabelText('Tổng nhân khẩu cư trú:') as HTMLInputElement).value).toBe('0');
    expect((screen.getByLabelText('Tổ dân phố / Tổ nhân dân:') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Tổng nhân khẩu cư trú:') as HTMLInputElement).max).toBe('');
  });
  it('confirms before closing a changed note and locks both close buttons during saving', async () => {
    let resolve: () => void;
    const close = vi.fn();
    const save = vi.fn(
      () =>
        new Promise<void>(done => {
          resolve = done;
        }),
    );
    render(
      <HouseholdDetailModal
        household={household}
        currentUser={{ role: 'officer', subAdminPermissions: { canUpdateInspection: true } } as AppUser}
        onClose={close}
        onUpdateNotes={save}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sửa ghi chú' }));
    fireEvent.change(screen.getByLabelText('Ghi chú kiểm tra thực địa'), { target: { value: 'New notes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đóng cửa sổ' }));
    expect(screen.getByRole('alertdialog')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu ghi chú' }));
    expect((screen.getByRole('button', { name: 'Đóng cửa sổ' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Đóng hồ sơ' }) as HTMLButtonElement).disabled).toBe(true);
    expect(close).not.toHaveBeenCalled();
    resolve();
    await waitFor(() => expect(screen.getByText('Đã lưu ghi chú kiểm tra.')).toBeDefined());
  });
  it('keeps entered notes editable when persistence fails', async () => {
    const save = vi.fn().mockRejectedValue(new Error('Offline'));
    render(
      <HouseholdDetailModal
        household={household}
        currentUser={{ role: 'officer', subAdminPermissions: { canUpdateInspection: true } } as AppUser}
        onClose={vi.fn()}
        onUpdateNotes={save}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sửa ghi chú' }));
    const input = screen.getByPlaceholderText('Nhập kết quả kiểm tra ANTT, PCCC hoặc di biến động nhân khẩu...');
    fireEvent.change(input, { target: { value: 'Unsaved inspection notes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu ghi chú' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Không thể lưu ghi chú'));
    expect((input as HTMLTextAreaElement).value).toBe('Unsaved inspection notes');
    expect(save).toHaveBeenCalledWith('1', 'Unsaved inspection notes');
    expect(screen.queryByText('Đã lưu ghi chú kiểm tra.')).toBeNull();
  });
});
