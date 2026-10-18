import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import FieldHouseMap from './FieldHouseMap';
import { FieldHouse } from '../utils/fieldHouseGeometry';
import { HouseholdFacility } from '../types';

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (event?: unknown) => void>(),
  setLayoutProperty: vi.fn(),
  setFilter: vi.fn(),
  queryRenderedFeatures: vi.fn(),
  setData: vi.fn(),
  setHouseholdData: vi.fn(),
  setHamletData: vi.fn(),
  setTerritoryData: vi.fn(),
  fitBounds: vi.fn(),
  mapOptions: vi.fn(),
  missingSources: new Set<string>(),
  addSource: vi.fn(),
}));
vi.mock('axios', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), isAxiosError: vi.fn(() => false) } }));
vi.mock('maplibre-gl', () => ({
  default: {
    Map: class {
      addControl = vi.fn();
      addSource = mocks.addSource;
      addLayer = vi.fn();
      remove = vi.fn();
      resize = vi.fn();
      easeTo = vi.fn();
      doubleClickZoom = { enable: vi.fn(), disable: vi.fn() };
      scrollZoom = { setWheelZoomRate: vi.fn(), setZoomRate: vi.fn() };
      setPaintProperty = vi.fn();
      setLayoutProperty = mocks.setLayoutProperty;
      setFilter = mocks.setFilter;
      queryRenderedFeatures = mocks.queryRenderedFeatures;
      fitBounds = mocks.fitBounds;
      constructor(options: unknown) {
        mocks.mapOptions(options);
      }
      on = (name: string, handler: (event?: unknown) => void) => {
        mocks.handlers.set(name, handler);
        return this;
      };
      getCanvas = () => ({ style: {} });
      getLayer = () => ({});
      getSource = (id: string) =>
        mocks.missingSources.has(id)
          ? undefined
          : {
              setData:
                id === 'households'
                  ? mocks.setHouseholdData
                  : id === 'hamlets'
                    ? mocks.setHamletData
                    : id === 'assigned-territories'
                      ? mocks.setTerritoryData
                      : mocks.setData,
            };
    },
    NavigationControl: class {},
  },
}));
const house: FieldHouse = {
  type: 'Feature',
  id: 'badiem-test',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [106, 10],
        [106.001, 10],
        [106.001, 10.001],
        [106, 10],
      ],
    ],
  },
  properties: { buildingId: 'badiem-test', height: 7 },
};
const household = {
  id: '1',
  code: 'HK-1',
  ownerName: 'Nguyễn A',
  houseNumber: '1',
  street: 'Đường A',
  coordinates: [11, 107],
  coordinatesEstimated: false,
  status: 'normal',
} as HouseholdFacility;
async function mount(households = [household], canLink = true) {
  render(<FieldHouseMap households={households} canAdd canLink={canLink} onAdd={vi.fn()} onSelect={vi.fn()} />);
  act(() => {
    mocks.handlers.get('load')?.();
  });
  await screen.findByText('1 công trình');
}
function selectHouse() {
  mocks.queryRenderedFeatures.mockReturnValue([{ layer: { id: 'houses-3d' }, properties: { buildingId: 'badiem-test' } }]);
  act(() => {
    mocks.handlers.get('click')?.({ point: {}, lngLat: { lng: 106.0005, lat: 10.0004 } });
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.handlers.clear();
  mocks.missingSources.clear();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.mocked(axios.get).mockImplementation(url =>
    Promise.resolve({
      data: String(url).endsWith('/access')
        ? { global: true, territories: [] }
        : { type: 'FeatureCollection', features: String(url).includes('/api/') ? [] : [house] },
    }),
  );
  vi.mocked(axios.put).mockImplementation((_url, data) => Promise.resolve({ data }));
  vi.mocked(axios.post).mockImplementation((_url, data) => Promise.resolve({ data: { type: 'FeatureCollection', features: data } }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe('field map controls', () => {
  it('does not update missing sources while the map style is being recreated', async () => {
    const view = render(<FieldHouseMap households={[]} canAdd canLink onAdd={vi.fn()} onSelect={vi.fn()} />);
    act(() => {
      mocks.handlers.get('load')?.();
    });
    await screen.findByText('1 công trình');
    for (const source of ['houses', 'house-points', 'hamlets', 'assigned-territories', 'households', 'draft'])
      mocks.missingSources.add(source);
    expect(() => view.rerender(<FieldHouseMap households={[household]} canAdd canLink onAdd={vi.fn()} onSelect={vi.fn()} />)).not.toThrow();
    mocks.missingSources.clear();
    view.rerender(<FieldHouseMap households={[]} canAdd canLink onAdd={vi.fn()} onSelect={vi.fn()} />);
    expect(mocks.setData).toHaveBeenCalled();
  });

  it('ignores a delayed load callback from a removed map instance', async () => {
    const view = render(<FieldHouseMap households={[]} canAdd canLink onAdd={vi.fn()} onSelect={vi.fn()} />);
    const oldLoad = mocks.handlers.get('load');
    view.unmount();
    render(<FieldHouseMap households={[]} canAdd canLink onAdd={vi.fn()} onSelect={vi.fn()} />);
    mocks.addSource.mockClear();
    act(() => {
      oldLoad?.();
    });
    expect(mocks.addSource).not.toHaveBeenCalled();
    act(() => {
      mocks.handlers.get('load')?.();
    });
    await screen.findByText('1 công trình');
    expect(mocks.addSource).toHaveBeenCalled();
  });

  it('explains a foreign household link separately from building geometry access', async () => {
    const restricted = {
      ...house,
      properties: { ...house.properties, canManage: false, accessReason: 'linked-household-outside-scope' },
    };
    vi.mocked(axios.get).mockImplementation(url =>
      Promise.resolve({
        data: String(url).endsWith('/access')
          ? { global: false, territories: [house] }
          : { type: 'FeatureCollection', features: String(url).endsWith('/boundaries') ? [] : [restricted] },
      }),
    );
    vi.mocked(axios.post).mockResolvedValue({ data: { allowed: true } });
    await mount([]);
    selectHouse();
    expect(await screen.findByText(/Công trình có liên kết hộ dân ngoài phạm vi hồ sơ được giao/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Lưu liên kết hộ dân' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Di chuyển khối nhà' })).toBeNull();
  });

  it('enables two-finger 3D gestures and caps high-DPI touch rendering with layers initially collapsed', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    );
    vi.stubGlobal('devicePixelRatio', 3);
    await mount([]);
    expect(mocks.mapOptions).toHaveBeenCalledWith(
      expect.objectContaining({ touchZoomRotate: true, touchPitch: true, pixelRatio: 1.5, clickTolerance: 8 }),
    );
    expect(screen.getByText('Layer & bộ lọc').closest('details').open).toBe(false);
    expect(screen.getByText(/Một ngón: di chuyển/)).toBeTruthy();
  });

  it('keeps selected building zoom padding proportional to the mobile map height', async () => {
    await mount([]);
    const canvas = document.querySelector('.field-map-canvas');
    Object.defineProperties(canvas, { clientWidth: { value: 390 }, clientHeight: { value: 400 } });
    selectHouse();
    fireEvent.click(await screen.findByRole('button', { name: 'Zoom tới khối nhà' }));
    expect(mocks.fitBounds).toHaveBeenLastCalledWith(
      expect.any(Array),
      expect.objectContaining({ padding: { top: 48, bottom: 216, left: 20, right: 20 } }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByLabelText('Thông tin công trình')).toBeNull();
  });

  it('shows all hamlet outlines, highlights only assigned territory and marks provisional boundaries', async () => {
    const outlines = {
      type: 'FeatureCollection',
      features: [{ ...house, properties: { hamletId: 1, name: 'Bắc Lân', provisional: true } }],
    };
    vi.mocked(axios.get).mockImplementation(url =>
      Promise.resolve({
        data: String(url).endsWith('/boundaries')
          ? outlines
          : String(url).endsWith('/access')
            ? { global: false, territories: [house] }
            : { type: 'FeatureCollection', features: String(url).includes('/api/') ? [] : [house] },
      }),
    );
    await mount([]);
    expect(await screen.findByText(/Ranh giới ấp tạm dựng từ PDF/)).toBeTruthy();
    await waitFor(() => expect(mocks.setHamletData).toHaveBeenCalledWith(outlines));
    expect(mocks.setTerritoryData.mock.calls.at(-1)[0].features).toEqual([{ type: 'Feature', properties: {}, geometry: house.geometry }]);
    fireEvent.click(screen.getByLabelText('Ranh giới ấp / phạm vi được giao'));
    expect(mocks.setLayoutProperty).toHaveBeenCalledWith('hamlet-boundaries', 'visibility', 'none');
    expect(mocks.setLayoutProperty).toHaveBeenCalledWith('assigned-territories', 'visibility', 'none');
  });

  it('keeps all building shapes visible but hides household actions outside assigned hamlets', async () => {
    vi.mocked(axios.get).mockImplementation(url =>
      Promise.resolve({
        data: String(url).endsWith('/access')
          ? { global: false, territories: [] }
          : { type: 'FeatureCollection', features: String(url).includes('/api/') ? [] : [house] },
      }),
    );
    vi.mocked(axios.post).mockResolvedValue({ data: { allowed: false } });
    await mount();
    selectHouse();
    expect(await screen.findByText('Công trình · Chỉ xem hình khối')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zoom tới khối nhà' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Thêm hộ dân tại công trình' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Lưu liên kết hộ dân' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Di chuyển khối nhà' })).toBeNull();
    expect(screen.queryByRole('button', { name: '+ Vẽ khối nhà' })).toBeNull();
    expect(screen.queryByText(/Nguyễn A/)).toBeNull();
    expect(mocks.setHouseholdData.mock.calls.at(-1)[0].features).toEqual([]);
    expect(mocks.setData.mock.calls.some(([data]) => data.features.some(feature => feature.properties?.buildingId === 'badiem-test'))).toBe(
      true,
    );
    expect(axios.put).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalledWith('/api/gis/field-buildings/auto-link', expect.anything());
  });
  it('enables household actions only after the backend confirms assigned geometry', async () => {
    vi.mocked(axios.get).mockImplementation(url =>
      Promise.resolve({
        data: String(url).endsWith('/access')
          ? { global: false, territories: [house.geometry] }
          : { type: 'FeatureCollection', features: String(url).includes('/api/') ? [] : [house] },
      }),
    );
    vi.mocked(axios.post).mockResolvedValue({ data: { allowed: true } });
    await mount();
    selectHouse();
    expect(await screen.findByRole('button', { name: 'Thêm hộ dân tại công trình' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Di chuyển khối nhà' })).toBeTruthy();
    expect(axios.post).toHaveBeenCalledWith('/api/gis/field-buildings/access/check', house.geometry, expect.any(Object));
  });
  it('materializes coordinate matches once and hides the point only after confirmation', async () => {
    const inferred = { ...household, coordinates: [10.0002, 106.0005] as [number, number] };
    await mount([inferred]);
    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.setHouseholdData.mock.calls.at(-1)[0].features).toEqual([]));
    selectHouse();
    expect(await screen.findByText('1 hộ dân đã liên kết')).toBeTruthy();
    expect(axios.post).toHaveBeenCalledWith('/api/gis/field-buildings/auto-link', [
      expect.objectContaining({
        properties: expect.objectContaining({ householdIds: ['1'] }),
      }),
    ]);
    expect(axios.post).toHaveBeenCalledTimes(1);
  });
  it('keeps inferred matches visibly unsaved on API failure and retries explicitly', async () => {
    vi.mocked(axios.post).mockRejectedValueOnce(Error('offline'));
    await mount([{ ...household, coordinates: [10.0002, 106.0005] as [number, number] }]);
    await screen.findByText(/Chưa lưu được liên kết tự nhận diện/);
    selectHouse();
    expect(await screen.findByText('Chưa có liên kết hộ dân đã lưu')).toBeTruthy();
    expect(mocks.setHouseholdData.mock.calls.at(-1)[0].features).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lưu lại' }));
    await screen.findByText('1 hộ dân đã liên kết');
    expect(mocks.setHouseholdData.mock.calls.at(-1)[0].features).toEqual([]);
    expect(axios.post).toHaveBeenCalledTimes(2);
  });
  it('does not auto-write without coordinate permission', async () => {
    await mount([{ ...household, coordinates: [10.0002, 106.0005] as [number, number] }], false);
    selectHouse();
    expect(screen.getByText(/Cần quyền chỉnh sửa tọa độ/)).toBeTruthy();
    expect(axios.post).not.toHaveBeenCalled();
    expect(mocks.setHouseholdData.mock.calls.at(-1)[0].features).toHaveLength(1);
  });
  it('switches basemap, representation and status filters', async () => {
    await mount();
    fireEvent.click(screen.getByLabelText('Ảnh vệ tinh'));
    expect(mocks.setLayoutProperty).toHaveBeenCalledWith('satellite', 'visibility', 'none');
    fireEvent.change(screen.getByLabelText('Hiển thị công trình'), { target: { value: 'point' } });
    expect(mocks.setLayoutProperty).toHaveBeenCalledWith('house-points', 'visibility', 'visible');
    expect(mocks.setLayoutProperty).toHaveBeenCalledWith('houses-3d', 'visibility', 'none');
    fireEvent.change(screen.getByLabelText('Trạng thái hộ dân'), { target: { value: 'alert' } });
    expect(mocks.setFilter).toHaveBeenCalledWith('households', ['==', ['get', 'status'], 'alert']);
  });
  it('saves explicit household links and reports API failures without a success message', async () => {
    await mount();
    expect(mocks.setHouseholdData.mock.calls.at(-1)[0].features.map(feature => feature.properties.id)).toEqual(['1']);
    selectHouse();
    const select = screen.getByLabelText('Chọn hộ dân để liên kết');
    fireEvent.change(select, { target: { value: '1' } });
    vi.mocked(axios.put).mockRejectedValueOnce(Error('API unavailable'));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu liên kết hộ dân' }));
    await screen.findByRole('alert');
    expect(screen.queryByText('Đã lưu liên kết hộ dân vào công trình.')).toBeNull();
    expect(mocks.setHouseholdData.mock.calls.at(-1)[0].features.map(feature => feature.properties.id)).toEqual(['1']);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu liên kết hộ dân' }));
    await screen.findByText('Đã lưu liên kết hộ dân vào công trình.');
    await waitFor(() => expect(mocks.setHouseholdData.mock.calls.at(-1)[0].features).toEqual([]));
    expect(screen.getByRole('button', { name: /Nguyễn A · HK-1/ })).toBeTruthy();
    expect(axios.put).toHaveBeenLastCalledWith(
      '/api/gis/field-buildings/badiem-test',
      expect.objectContaining({ properties: expect.objectContaining({ householdIds: ['1'] }) }),
    );
  });
  it('draws and persists a closed polygon', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: '+ Vẽ khối nhà' }));
    for (const [lng, lat] of [
      [106, 10],
      [106.001, 10],
      [106.001, 10.001],
    ])
      act(() => {
        mocks.handlers.get('click')?.({ lngLat: { lng, lat } });
      });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu khối nhà' }));
    await screen.findByText('Đã lưu khối nhà vào cơ sở dữ liệu.');
    const saved = vi.mocked(axios.put).mock.calls[0][1] as FieldHouse;
    expect(saved.geometry.coordinates[0]).toEqual([
      [106, 10],
      [106.001, 10],
      [106.001, 10.001],
      [106, 10],
    ]);
    expect(saved.id).toMatch(/^custom-/);
  });
  it('previews and saves a new footprint location', async () => {
    await mount();
    selectHouse();
    fireEvent.click(screen.getByRole('button', { name: 'Di chuyển khối nhà' }));
    fireEvent.change(screen.getByLabelText('Vĩ độ'), { target: { value: '11' } });
    fireEvent.change(screen.getByLabelText('Kinh độ'), { target: { value: '107' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu vị trí khối nhà' }));
    await waitFor(() => expect(axios.put).toHaveBeenCalled());
    const saved = vi.mocked(axios.put).mock.calls[0][1] as FieldHouse;
    expect(saved.geometry.coordinates[0][0][0]).toBeGreaterThan(106.99);
    await screen.findByText('Đã lưu vị trí mới và giữ liên kết hộ dân.');
  });
});
