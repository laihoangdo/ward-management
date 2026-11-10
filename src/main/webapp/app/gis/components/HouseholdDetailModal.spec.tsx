import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HouseholdDetailModal } from './HouseholdDetailModal';
import { HouseholdFacility, AppUser } from '../types';
import { MemoryRouter } from 'react-router';
import { mapHouseholdToDto } from '../services/householdApiService';

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
  it('shows missing relationship as unverified instead of labelling every resident as household head', () => {
    const view = render(
      <HouseholdDetailModal
        household={{
          ...household,
          neighborhoodGroup: '',
          residentsList: [
            {
              id: 'resident-synthetic',
              fullName: 'Người kiểm thử',
              gender: 'Chưa cập nhật',
              relationship: '',
              residenceType: 'Chưa xác minh',
            },
          ],
        }}
        currentUser={{ role: 'superadmin' } as AppUser}
        onClose={vi.fn()}
        onUpdateNotes={vi.fn()}
      />,
    );
    expect(screen.queryByText('Chủ hộ', { exact: true })).toBeNull();
    expect(screen.getAllByText('Chưa xác minh').length).toBeGreaterThan(0);
    expect(view.container.textContent).toContain('Chưa có tổ dân phố');
    expect(view.container.textContent).not.toContain('Tổ 1');
    view.unmount();
  });
  it.each([false, true])('opens the exact GIS household in the roster menu (edit=%s)', edit => {
    const openRoster = vi.fn();
    const selected = { ...household, id: '123', code: 'TC2-SYNTHETIC', locationStatus: 'PROVISIONAL' };
    const view = render(
      <MemoryRouter>
        <HouseholdDetailModal
          household={selected}
          currentUser={{ role: 'superadmin' } as AppUser}
          onClose={vi.fn()}
          onUpdateNotes={vi.fn()}
          onOpenRoster={openRoster}
        />
      </MemoryRouter>,
    );
    fireEvent.click(
      edit ? screen.getByRole('button', { name: 'Chỉnh sửa thông tin hộ' }) : screen.getByRole('link', { name: /Mở hồ sơ đầy đủ/ }),
    );
    expect(openRoster).toHaveBeenCalledWith(selected, edit);
    view.unmount();
  });
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
  it('does not offer or write the source address as a street when the household has no parsed street', async () => {
    const onHouseholdUpdated = vi.fn().mockResolvedValue(undefined);
    const raw = '12/3A ấp 62, xã Bà Điểm';
    render(
      <HouseholdDetailModal
        household={{ ...household, street: raw, rawAddress: raw, streetName: undefined }}
        currentUser={{ role: 'superadmin' } as AppUser}
        onClose={vi.fn()}
        onUpdateNotes={vi.fn()}
        onHouseholdUpdated={onHouseholdUpdated}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa thông tin hộ' }));
    const street = screen.getByLabelText('Tuyến đường:') as HTMLSelectElement;
    expect(street.value).toBe('');
    expect([...street.options].some(option => option.value === raw)).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Lưu thông tin' }));
    await waitFor(() => expect(onHouseholdUpdated).toHaveBeenCalled());
    const saved = onHouseholdUpdated.mock.calls[0][0] as HouseholdFacility;
    expect(JSON.parse(JSON.stringify(mapHouseholdToDto(saved)))).not.toHaveProperty('street');
  });
  it('sends roster-managed households to the roster to update notes and hides an empty call link', () => {
    const openRoster = vi.fn();
    const onUpdateNotes = vi.fn();
    const roster = { ...household, code: 'TC2-R-1', ownerPhone: '' };
    render(
      <MemoryRouter>
        <HouseholdDetailModal
          household={roster}
          currentUser={{ role: 'superadmin' } as AppUser}
          onClose={vi.fn()}
          onUpdateNotes={onUpdateNotes}
          onOpenRoster={openRoster}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('button', { name: 'Sửa ghi chú' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật trong hồ sơ hộ' }));
    expect(openRoster).toHaveBeenCalledWith(roster, false);
    expect(onUpdateNotes).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: /^Gọi/ })).toBeNull();
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
