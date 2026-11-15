import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HouseholdDetailModal } from './HouseholdDetailModal';
import { HouseholdFacility, AppUser } from '../types';
import { MemoryRouter } from 'react-router';
import { mapHouseholdToDto } from '../services/householdApiService';
import axios from 'axios';

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
  it('opens the exact GIS household in the roster menu from the full-record link', () => {
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
    fireEvent.click(screen.getByRole('link', { name: /Mở hồ sơ đầy đủ/ }));
    expect(openRoster).toHaveBeenCalledWith(selected, false);
    view.unmount();
  });
  it('edits a roster-managed household in the open record through the audited roster API', async () => {
    const rosterRow = {
      id: 'roster-uuid',
      version: 4,
      raw_address: '12 Ấp 61',
      representative_name: 'Chủ hộ thử',
      phone: '',
      type: 'RESIDENTIAL',
      verification_status: 'UNVERIFIED',
    };
    const get = vi.spyOn(axios, 'get').mockResolvedValue({ data: rosterRow });
    const put = vi.spyOn(axios, 'put').mockResolvedValue({ data: { ...rosterRow, version: 5, representative_name: 'Tên mới' } });
    const openRoster = vi.fn();
    const reload = vi.fn().mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <HouseholdDetailModal
          household={{ ...household, id: '123', code: 'TC2-R-1', hamletId: 7 }}
          currentUser={{ role: 'superadmin' } as AppUser}
          onClose={vi.fn()}
          onUpdateNotes={vi.fn()}
          onOpenRoster={openRoster}
          onReloadHousehold={reload}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa thông tin hộ' }));
    const name = await screen.findByLabelText('Tên chủ hộ / người đại diện theo nguồn');
    expect(get).toHaveBeenCalledWith('/api/roster/legacy-households/123', { params: { hamletId: 7 } });
    fireEvent.change(name, { target: { value: 'Tên mới' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thông tin' }));
    expect(await screen.findByText('Còn thiếu: Lý do / nguồn kiểm chứng.')).toBeDefined();
    expect(put).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Lý do \/ nguồn kiểm chứng/), { target: { value: 'Kiểm tra thực địa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thông tin' }));
    await waitFor(() => expect(screen.getByText('Đã cập nhật thông tin hộ.')).toBeDefined());
    const [url, body, config] = put.mock.calls[0] as [string, Record<string, unknown>, unknown];
    expect(url).toBe('/api/roster/households/roster-uuid');
    expect(body).toMatchObject({ representative: 'Tên mới', reason: 'Kiểm tra thực địa', version: 4, rawAddress: '12 Ấp 61' });
    expect(config).toEqual({ params: { hamletId: 7 } });
    expect(reload).toHaveBeenCalledWith('123');
    expect(openRoster).not.toHaveBeenCalled();
    get.mockRestore();
    put.mockRestore();
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
  it('saves field-inspection notes of a roster-managed household in the open record and hides an empty call link', async () => {
    const rosterRow = { id: 'roster-uuid', version: 2, inspection_notes: null };
    const get = vi.spyOn(axios, 'get').mockResolvedValue({ data: rosterRow });
    const put = vi.spyOn(axios, 'put').mockResolvedValue({
      data: {
        ...rosterRow,
        version: 3,
        inspection_notes: 'Đã kiểm tra PCCC',
        last_checked_date: '15/11/2026',
        officer_in_charge: 'Cán bộ thử',
      },
    });
    const openRoster = vi.fn();
    const onUpdateNotes = vi.fn();
    const roster = { ...household, code: 'TC2-R-1', ownerPhone: '', notes: '' };
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
    expect(screen.queryByRole('link', { name: /^Gọi/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sửa ghi chú' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Ghi chú kiểm tra thực địa' }), { target: { value: 'Đã kiểm tra PCCC' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu ghi chú' }));
    await waitFor(() => expect(screen.getByText('Đã lưu ghi chú kiểm tra.')).toBeDefined());
    expect(put).toHaveBeenCalledWith(
      '/api/roster/households/roster-uuid/inspection-notes',
      { notes: 'Đã kiểm tra PCCC', version: 2 },
      { params: undefined },
    );
    expect(screen.getByText('Đã kiểm tra PCCC')).toBeDefined();
    expect(screen.getByText(/15\/11\/2026 · CSKV: Cán bộ thử/)).toBeDefined();
    expect(onUpdateNotes).not.toHaveBeenCalled();
    expect(openRoster).not.toHaveBeenCalled();
    get.mockRestore();
    put.mockRestore();
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
