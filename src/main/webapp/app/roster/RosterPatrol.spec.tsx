import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import axios from 'axios';
import RosterPatrol from './RosterPatrol';

vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn(), isAxiosError: (e: any) => Boolean(e?.isAxiosError) } }));

const nearby = [
  {
    id: 'h1',
    code: 'TC2-001',
    raw_address: '120/45 Đường thử nghiệm',
    distance_m: 12.4,
    position_source: 'BUILDING',
    link_quality: 'ESTIMATED',
    last_visit: { outcome: 'ABSENT', observed_at: '2026-11-01T03:00:00Z' },
    consecutive_absent: 2,
  },
];

function allowLocation() {
  Object.defineProperty(globalThis.navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (ok: PositionCallback) =>
        ok({ coords: { latitude: 10.85, longitude: 106.6, accuracy: 8 } } as GeolocationPosition),
    },
  });
}

describe('Field patrol', () => {
  beforeEach(() => {
    vi.mocked(axios.get).mockReset();
    vi.mocked(axios.post).mockReset();
  });
  afterEach(cleanup);

  it('reads the position only on request and lists recorded households nearest first', async () => {
    allowLocation();
    vi.mocked(axios.get).mockResolvedValue({ data: nearby });
    render(<RosterPatrol />);
    expect(axios.get).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu tuần tra' }));
    await screen.findByText(/TC2-001 · 12 m/);
    expect(axios.get).toHaveBeenCalledWith('/api/roster/patrol/nearby', { params: { latitude: 10.85, longitude: 106.6, radius: 50 } });
    expect(screen.getByText(/vắng 2 lần liên tiếp/)).toBeDefined();
    expect(screen.getByText('Vị trí ước lượng, cần xác nhận tại cửa nhà')).toBeDefined();
  });

  it('records a visit with the officer position and one request id, then refreshes', async () => {
    allowLocation();
    vi.mocked(axios.get).mockResolvedValue({ data: nearby });
    vi.mocked(axios.post).mockResolvedValue({ data: {} });
    render(<RosterPatrol />);
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu tuần tra' }));
    await screen.findByText(/TC2-001/);
    fireEvent.click(screen.getByRole('button', { name: 'Đã kiểm tra' }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledOnce());
    expect(vi.mocked(axios.post).mock.calls[0][1]).toMatchObject({
      householdId: 'h1',
      outcome: 'PRESENT',
      latitude: 10.85,
      longitude: 106.6,
      accuracy: 8,
      requestId: expect.any(String),
    });
    await screen.findByRole('status');
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  it('can ask the server for reliable positions only', async () => {
    allowLocation();
    vi.mocked(axios.get).mockResolvedValue({ data: [] });
    render(<RosterPatrol />);
    fireEvent.click(screen.getByLabelText('Chỉ hộ có vị trí đáng tin'));
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu tuần tra' }));
    await waitFor(() =>
      expect(axios.get).toHaveBeenCalledWith('/api/roster/patrol/nearby', {
        params: { latitude: 10.85, longitude: 106.6, radius: 50, reliableOnly: true },
      }),
    );
  });

  it('lets an officer confirm an estimated position, then reloads the list', async () => {
    allowLocation();
    vi.mocked(axios.get).mockResolvedValue({ data: nearby });
    vi.mocked(axios.post).mockResolvedValue({ data: {} });
    render(<RosterPatrol />);
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu tuần tra' }));
    await screen.findByText(/TC2-001/);
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận vị trí' }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledOnce());
    expect(vi.mocked(axios.post).mock.calls[0][0]).toBe('/api/roster/patrol/confirm-position');
    expect(vi.mocked(axios.post).mock.calls[0][1]).toMatchObject({ householdId: 'h1', latitude: 10.85, requestId: expect.any(String) });
    await screen.findByRole('status');
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  it('does not offer to confirm a position that is already confirmed', async () => {
    allowLocation();
    vi.mocked(axios.get).mockResolvedValue({ data: [{ ...nearby[0], link_quality: 'CONFIRMED' }] });
    render(<RosterPatrol />);
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu tuần tra' }));
    await screen.findByText('Vị trí đã được cán bộ xác nhận tại cửa nhà');
    expect(screen.queryByRole('button', { name: 'Xác nhận vị trí' })).toBeNull();
  });

  it('says so when nothing with a recorded position is nearby instead of inventing rows', async () => {
    allowLocation();
    vi.mocked(axios.get).mockResolvedValue({ data: [] });
    render(<RosterPatrol />);
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu tuần tra' }));
    await screen.findByText(/Không có hộ nào có vị trí ghi nhận trong bán kính 50 m/);
  });

  it('explains a denied location permission and a disabled PostGIS', async () => {
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (_ok: PositionCallback, fail: PositionErrorCallback) =>
          fail({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError),
      },
    });
    render(<RosterPatrol />);
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu tuần tra' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Chưa được cấp quyền vị trí');
    cleanup();

    allowLocation();
    vi.mocked(axios.get).mockRejectedValueOnce(Object.assign(Error('unavailable'), { isAxiosError: true, response: { status: 503 } }));
    render(<RosterPatrol />);
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu tuần tra' }));
    expect((await screen.findByRole('alert')).textContent).toContain('PostGIS');
  });
});
