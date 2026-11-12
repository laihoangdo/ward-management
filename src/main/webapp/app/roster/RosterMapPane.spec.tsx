import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup, act, fireEvent } from '@testing-library/react';
import axios from 'axios';
import RosterMapPane from './RosterMapPane';

vi.mock('axios', () => ({ default: { get: vi.fn(), isAxiosError: (e: any) => Boolean(e?.isAxiosError) } }));

const mapState = vi.hoisted(() => ({
  instance: null as any,
  handlers: {} as Record<string, (e?: any) => void>,
  layerHandlers: {} as Record<string, (e?: any) => void>,
}));

const effects = vi.hoisted(() => ({
  attach: vi.fn(),
  dispose: vi.fn(),
  setDisplayState: vi.fn(),
  failToAttach: false,
}));

vi.mock('../gis/three/field-effects.js', () => ({
  attachFieldEffects(...args: any[]) {
    effects.attach(...args);
    if (effects.failToAttach) throw new Error('no WebGL');
    return { ready: Promise.resolve({}), setDisplayState: effects.setDisplayState, dispose: effects.dispose };
  },
}));

vi.mock('maplibre-gl', () => {
  class Map {
    layers: any[] = [];
    setFilter = vi.fn();
    setPaintProperty = vi.fn();
    getLayer = vi.fn((id: string) => this.layers.find(l => l.id === id));
    flyTo = vi.fn();
    easeTo = vi.fn();
    fitBounds = vi.fn();
    remove = vi.fn();
    triggerRepaint = vi.fn();
    constructor() {
      mapState.instance = this;
    }
    addControl() {}
    addSource() {}
    addLayer(layer: any) {
      this.layers.push(layer);
    }
    on(event: string, layerOrHandler: any, handler?: any) {
      if (typeof layerOrHandler === 'function') mapState.handlers[event] = layerOrHandler;
      else mapState.layerHandlers[`${event}:${layerOrHandler}`] = handler;
    }
    getCanvas() {
      return { style: {} };
    }
    getZoom() {
      return 14;
    }
  }
  class LngLatBounds {
    n = 0;
    extend() {
      this.n++;
    }
    isEmpty() {
      return this.n === 0;
    }
  }
  class NavigationControl {}
  return { Map, LngLatBounds, NavigationControl, setWorkerUrl: vi.fn(), default: {} };
});

const point = (id: string, code: string, quality: string, lon: number, lat: number) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [lon, lat] },
  properties: { id, code, raw_address: `${code} Ấp 62`, link_quality: quality, position_source: 'BUILDING' },
});

const square = (lon: number, lat: number) => ({
  type: 'MultiPolygon',
  coordinates: [
    [
      [
        [lon, lat],
        [lon + 0.0001, lat],
        [lon + 0.0001, lat + 0.0001],
        [lon, lat + 0.0001],
        [lon, lat],
      ],
    ],
  ],
});

const house = (id: string, code: string, quality: string) => ({ id, code, raw_address: `${code} Ấp 62`, link_quality: quality });

const payload = {
  data: {
    type: 'FeatureCollection',
    features: [
      point('h1', 'TC2-001', 'EXACT', 106.6, 10.85),
      point('h2', 'TC2-002', 'ESTIMATED', 106.61, 10.86),
      point('h3', 'TC2-003', 'EXACT', 106.61, 10.86),
    ],
    households: 6,
    positioned: 3,
    buildings: [
      {
        type: 'Feature',
        id: 'b1',
        geometry: square(106.6, 10.85),
        properties: {
          id: 'b1',
          height: 6.4,
          quality: 'EXACT',
          household_count: 1,
          appearance: { estimated: true },
          households: [house('h1', 'TC2-001', 'EXACT')],
        },
      },
      {
        type: 'Feature',
        id: 'b2',
        geometry: square(106.61, 10.86),
        properties: {
          id: 'b2',
          height: 9.6,
          quality: 'ESTIMATED',
          household_count: 2,
          appearance: { estimated: false, levels: 3, wallColor: '#e8dccb', roofColor: '#b85c42', roofShape: 'gable' },
          households: [house('h2', 'TC2-002', 'ESTIMATED'), house('h3', 'TC2-003', 'EXACT')],
        },
      },
    ],
    boundary: { type: 'Polygon', coordinates: [[[106, 10]]] },
  },
};

async function loaded(ui: React.ReactElement) {
  const view = render(ui);
  await waitFor(() => expect(mapState.instance).not.toBeNull());
  await act(async () => mapState.handlers.load());
  return view;
}

describe('Roster map pane', () => {
  beforeEach(() => {
    mapState.instance = null;
    mapState.handlers = {};
    mapState.layerHandlers = {};
    effects.attach.mockReset();
    effects.dispose.mockReset();
    effects.setDisplayState.mockReset();
    effects.failToAttach = false;
    vi.mocked(axios.get).mockReset();
  });
  afterEach(cleanup);

  it('says how many households have a recorded position and explains the footprint outline colours', async () => {
    vi.mocked(axios.get).mockResolvedValue(payload);
    render(<RosterMapPane selectedId={null} onSelect={vi.fn()} />);
    const status = (await screen.findAllByRole('status'))[0].textContent;
    expect(status).toContain('3 / 6 hộ có vị trí ghi nhận · 2 khối nhà');
    expect(status).toContain('3 hộ chưa có vị trí nên không hiện trên bản đồ');
    const legend = screen.getByRole('list', { name: 'Chú giải độ tin cậy vị trí' });
    expect(legend.textContent).toContain('Chính xác (2)');
    expect(legend.textContent).toContain('Ước lượng (1)');
    expect(screen.getByText(/Chiều cao và màu mái chỉ để minh hoạ/)).toBeDefined();
    expect(axios.get).toHaveBeenCalledWith('/api/roster/map');
  });

  it('draws the buildings with the shared Three.js field effects, on by default, with the 3D map design', async () => {
    vi.mocked(axios.get).mockResolvedValue(payload);
    await loaded(<RosterMapPane selectedId={null} onSelect={vi.fn()} />);
    await waitFor(() => expect(effects.attach).toHaveBeenCalledTimes(1));
    const [map, options] = effects.attach.mock.calls[0];
    expect(map).toBe(mapState.instance);
    const features = options.collection.features;
    expect(features.map((f: any) => f.id)).toEqual(['b1', 'b2']);
    // An estimated footprint gets the 3D map's natural 1-5 floor height, a roof and wall colour.
    const estimated = features[0].properties;
    expect(estimated.levels).toBeGreaterThanOrEqual(1);
    expect(estimated.levels).toBeLessThanOrEqual(5);
    expect(['gable', 'flat']).toContain(estimated.roofShape);
    expect(estimated.wallColor).toMatch(/^#[0-9a-f]{6}$/i);
    // A building with its own saved design keeps it.
    expect(features[1].properties).toMatchObject({
      levels: 3,
      wallColor: '#e8dccb',
      roofColor: '#b85c42',
      roofShape: 'gable',
      height: 9.6,
    });
    expect(options.anchor).toHaveLength(2);
    // The effects layer is inserted before this layer, so it must exist.
    expect(mapState.instance.layers.some((l: any) => l.id === 'house-points')).toBe(true);
    await waitFor(() => expect(mapState.instance.setPaintProperty).toHaveBeenCalledWith('roster-buildings', 'fill-extrusion-opacity', 0));
    expect(screen.getByRole('button', { name: 'Tắt hiệu ứng Three.js' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('shows the position reliability as a coloured footprint outline and keeps native blocks as the fallback', async () => {
    vi.mocked(axios.get).mockResolvedValue(payload);
    await loaded(<RosterMapPane selectedId={null} onSelect={vi.fn()} />);
    const outline = mapState.instance.layers.find((l: any) => l.id === 'roster-quality-outline');
    expect(outline.type).toBe('line');
    expect(outline.paint['line-color'][0]).toBe('match');
    const native = mapState.instance.layers.find((l: any) => l.id === 'roster-buildings');
    expect(native.type).toBe('fill-extrusion');
    expect(native.paint['fill-extrusion-height']).toEqual(['get', 'height']);
  });

  it('selects the only household of a building when it is clicked', async () => {
    vi.mocked(axios.get).mockResolvedValue(payload);
    const onSelect = vi.fn();
    await loaded(<RosterMapPane selectedId={null} onSelect={onSelect} />);
    act(() => mapState.layerHandlers['click:roster-buildings']({ features: [{ properties: { id: 'b1' } }] }));
    expect(onSelect).toHaveBeenCalledWith('h1');
  });

  it('lists every household of a shared building so the officer can pick one', async () => {
    vi.mocked(axios.get).mockResolvedValue(payload);
    const onSelect = vi.fn();
    await loaded(<RosterMapPane selectedId={null} onSelect={onSelect} />);
    act(() => mapState.layerHandlers['click:roster-buildings']({ features: [{ properties: { id: 'b2' } }] }));
    expect(onSelect).not.toHaveBeenCalled();
    const group = await screen.findByRole('group', { name: 'Các hộ trong cùng một nhà' });
    expect(group.textContent).toContain('Nhà này có 2 hộ');
    fireEvent.click(screen.getByRole('button', { name: 'TC2-003' }));
    expect(onSelect).toHaveBeenCalledWith('h3');
  });

  it('paints the selected household building gold, highlights it natively and flies to it', async () => {
    vi.mocked(axios.get).mockResolvedValue(payload);
    const { rerender } = await loaded(<RosterMapPane selectedId={null} onSelect={vi.fn()} />);
    await waitFor(() => expect(effects.attach).toHaveBeenCalled());
    rerender(<RosterMapPane selectedId="h1" onSelect={vi.fn()} onOpenDetail={vi.fn()} />);
    await waitFor(() => expect(mapState.instance.flyTo).toHaveBeenCalled());
    const move = mapState.instance.flyTo.mock.calls.at(-1)[0];
    expect(move.center[0]).toBeCloseTo(106.60005, 4);
    expect(move.pitch).toBe(55);
    expect(mapState.instance.setFilter).toHaveBeenLastCalledWith('roster-building-selected', ['==', ['get', 'id'], 'b1']);
    await waitFor(() =>
      expect(effects.setDisplayState).toHaveBeenLastCalledWith([
        { id: 'b1', visible: true, color: '#fbbf24' },
        { id: 'b2', visible: true, color: undefined },
      ]),
    );
    expect(screen.getByText('TC2-001')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Mở chi tiết hộ' })).toBeDefined();
  });

  it('never invents a place for a household that has no recorded position', async () => {
    vi.mocked(axios.get).mockResolvedValue(payload);
    const { rerender } = await loaded(<RosterMapPane selectedId={null} onSelect={vi.fn()} />);
    rerender(<RosterMapPane selectedId="unlocated" onSelect={vi.fn()} />);
    expect(await screen.findByText('Hộ đang chọn chưa có vị trí thật trên bản đồ.')).toBeDefined();
    expect(mapState.instance.flyTo).not.toHaveBeenCalled();
  });

  it('switches between the tilted view and top-down, and turns the effects off and back on', async () => {
    vi.mocked(axios.get).mockResolvedValue(payload);
    await loaded(<RosterMapPane selectedId={null} onSelect={vi.fn()} />);
    await waitFor(() => expect(effects.attach).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Nhìn từ trên (2D)' }));
    await waitFor(() => expect(mapState.instance.easeTo).toHaveBeenLastCalledWith(expect.objectContaining({ pitch: 0 })));
    fireEvent.click(screen.getByRole('button', { name: 'Nhìn nghiêng (3D)' }));
    await waitFor(() => expect(mapState.instance.easeTo).toHaveBeenLastCalledWith(expect.objectContaining({ pitch: 55 })));
    fireEvent.click(screen.getByRole('button', { name: 'Tắt hiệu ứng Three.js' }));
    await waitFor(() => expect(effects.dispose).toHaveBeenCalled());
    await waitFor(() =>
      expect(mapState.instance.setPaintProperty).toHaveBeenLastCalledWith('roster-buildings', 'fill-extrusion-opacity', 0.86),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Bật hiệu ứng Three.js' }));
    await waitFor(() => expect(effects.attach).toHaveBeenCalledTimes(2));
  });

  it('falls back to the native blocks and says so when the effects cannot start', async () => {
    effects.failToAttach = true;
    vi.mocked(axios.get).mockResolvedValue(payload);
    await loaded(<RosterMapPane selectedId={null} onSelect={vi.fn()} />);
    expect(await screen.findByText(/vẫn dùng khối nhà cơ bản/)).toBeDefined();
    expect(mapState.instance.layers.some((l: any) => l.id === 'roster-buildings')).toBe(true);
    expect(screen.getByRole('button', { name: 'Bật hiệu ứng Three.js' })).toBeDefined();
  });

  it('explains a missing permission and a disabled PostGIS instead of drawing anything', async () => {
    vi.mocked(axios.get).mockRejectedValueOnce(Object.assign(Error('forbidden'), { isAxiosError: true, response: { status: 403 } }));
    render(<RosterMapPane selectedId={null} onSelect={vi.fn()} />);
    expect((await screen.findByRole('alert')).textContent).toContain('chưa được cấp quyền');
    expect(mapState.instance).toBeNull();
    cleanup();
    vi.mocked(axios.get).mockRejectedValueOnce(Object.assign(Error('unavailable'), { isAxiosError: true, response: { status: 503 } }));
    render(<RosterMapPane selectedId={null} onSelect={vi.fn()} />);
    expect((await screen.findByRole('alert')).textContent).toContain('PostGIS');
  });
});
