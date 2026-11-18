import { describe, expect, it } from 'vitest';
import { readAppearance } from './appearance.js';
import { appendGableRoof, createStreams } from './geometry.js';

describe('Illustrative building appearance', () => {
  it('is deterministic and never labels inferred heights as measured', () => {
    expect(readAppearance({}, 'house')).toEqual(readAppearance({}, 'house'));
    for (let i = 0; i < 100; i++) {
      const style = readAppearance({ height: 7, estimated: true }, String(i));
      expect(style.estimated).toBe(true);
      expect(style.height).toBeGreaterThanOrEqual(3.2);
      expect(style.height).toBeLessThanOrEqual(12.8);
    }
    expect(readAppearance({ height: 15, wallColor: '#aabbcc', roofShape: 'flat' }, 'measured')).toMatchObject({
      height: 15,
      estimated: false,
      wall: 0xaabbcc,
      roofShape: 'flat',
    });
    expect(readAppearance({}, 'large', 1000).height).toBe(3.2);
    expect(readAppearance({ 'building:levels': 3, 'roof:colour': '#112233' }, 'osm')).toMatchObject({
      height: 9.600000000000001,
      roof: 0x112233,
    });
  });
  it('creates an upward-facing ridge with outward gables within the footprint', () => {
    const streams = createStreams();
    appendGableRoof(
      streams,
      [
        [0, 0],
        [10, 0],
        [10, 4],
        [0, 4],
      ],
      6,
      2,
      3,
    );
    expect(streams.indices).toHaveLength(18);
    expect(Math.max(...streams.positions.filter((_, i) => i % 3 === 1))).toBe(8);
    for (let i = 0; i < 12; i++) expect(streams.normals[i * 3 + 1]).toBeGreaterThan(0);
    expect(streams.normals[12 * 3]).toBe(-1);
    expect(streams.normals[15 * 3]).toBe(1);
    expect(new Set(streams.features)).toEqual(new Set([3]));
  });
});
