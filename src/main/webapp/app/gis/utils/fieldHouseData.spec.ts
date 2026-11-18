import { describe, expect, it } from 'vitest';
import { FieldHouse, mergeSavedHouse, persistedHouse } from './fieldHouseGeometry';

const base: FieldHouse = {
  type: 'Feature',
  id: 'base-id',
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
  properties: {
    buildingId: 'house',
    height: 9.6,
    estimated: true,
    wallColor: '#d5cbb7',
    roofColor: '#727d83',
    roofShape: 'flat',
    levels: 3,
    floorHeight: 3.2,
    appearanceSeed: 0.3,
    visualizationSource: 'synthetic-visual-v1',
    heightSource: 'synthetic-visual-v1',
  },
};

describe('Unified building data and API overrides', () => {
  it('retains manually edited materials across saves, linking and movement', () => {
    const edited: FieldHouse = {
      ...base,
      properties: {
        ...base.properties,
        floors: 3,
        height: 10.5,
        appearanceSource: 'manual',
        wallColor: '#112233',
        roofColor: '#aabbcc',
        roofShape: 'gable',
        floorHeight: 3.5,
        householdIds: ['1'],
      },
    };
    const dto = persistedHouse(edited);
    expect(dto.properties).toMatchObject({
      wallColor: '#112233',
      roofColor: '#aabbcc',
      roofShape: 'gable',
      floorHeight: 3.5,
      floors: 3,
      householdIds: ['1'],
    });
    expect(dto.properties).not.toHaveProperty('appearanceSeed');
    const loaded = mergeSavedHouse(base, dto);
    expect(persistedHouse(loaded).properties).toEqual(dto.properties);
  });
  it('prioritizes saved geometry, height, links and permissions without losing base materials', () => {
    const saved: FieldHouse = {
      ...base,
      id: 'saved-id',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [107, 11],
            [107.001, 11],
            [107.001, 11.001],
            [107, 11],
          ],
        ],
      },
      properties: { buildingId: 'house', height: 19, estimated: false, householdIds: ['household'], canManage: false },
    };
    const merged = mergeSavedHouse(base, saved);
    expect(merged.geometry).toBe(saved.geometry);
    expect(merged.properties).toMatchObject({
      height: 19,
      estimated: false,
      householdIds: ['household'],
      canManage: false,
      wallColor: '#d5cbb7',
      roofShape: 'flat',
    });
    expect(base.properties.height).toBe(9.6);
    expect(mergeSavedHouse(undefined, saved)).toEqual(saved);
  });
  it('sends the shared height but not material fields, and retains materials after API replies', () => {
    const dto = persistedHouse(base);
    expect(dto.properties).toEqual({ buildingId: 'house', height: 9.6, estimated: true });
    expect(base.properties.wallColor).toBe('#d5cbb7');
    expect(mergeSavedHouse(base, dto).properties).toEqual(base.properties);
  });
});
