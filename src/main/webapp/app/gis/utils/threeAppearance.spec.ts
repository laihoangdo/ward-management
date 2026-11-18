import { describe, expect, it } from 'vitest';
import { REALISTIC_FLAT_ROOFS, REALISTIC_GABLE_ROOFS, REALISTIC_WALLS, enrichForThree, hashUnit } from './threeAppearance';

const house = (id: string, extra: Record<string, unknown> = {}) => ({ id, properties: { buildingId: id, estimated: true, ...extra } });

describe('shared building design', () => {
  it('is deterministic per building', () => {
    const a = enrichForThree(house('badiem-1'), [106.6, 10.85]);
    const b = enrichForThree(house('badiem-1'), [106.6, 10.85]);
    expect(a).toEqual(b);
    expect(hashUnit('x')).toBe(hashUnit('x'));
  });

  it('gives estimated buildings a 1-5 floor undulating height, a roof and a wall colour', () => {
    const heights = new Set<number>();
    const levels = new Set<number>();
    for (let i = 0; i < 200; i++) {
      // Real building ids are hex digests, so spread the sample ids the same way.
      const p = enrichForThree(house(`badiem-${(i * 2654435761).toString(16)}${(i * 40503).toString(36)}`), [
        106.6 + i * 0.0003,
        10.85 + (i % 7) * 0.0004,
      ]).properties;
      expect(p.levels).toBeGreaterThanOrEqual(1);
      expect(p.levels).toBeLessThanOrEqual(5);
      expect(p.height).toBeGreaterThanOrEqual(3.5);
      expect(p.height).toBeLessThanOrEqual(20);
      expect(REALISTIC_WALLS).toContain(p.wallColor);
      expect(p.roofShape === 'gable' ? REALISTIC_GABLE_ROOFS : REALISTIC_FLAT_ROOFS).toContain(p.roofColor);
      heights.add(p.height);
      levels.add(p.levels);
    }
    expect(levels.size).toBe(5);
    expect(heights.size).toBeGreaterThan(20);
  });

  it('leaves surveyed and manually edited buildings alone', () => {
    const surveyed = { id: 's', properties: { buildingId: 's', estimated: false, height: 12.4 } };
    expect(enrichForThree(surveyed, [106.6, 10.85])).toBe(surveyed);
    const manual = house('m', { appearanceSource: 'manual', height: 9 });
    expect(enrichForThree(manual, [106.6, 10.85])).toBe(manual);
  });
});
