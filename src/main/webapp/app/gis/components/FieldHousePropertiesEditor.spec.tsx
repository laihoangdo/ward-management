import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FieldHousePropertiesEditor from './FieldHousePropertiesEditor';
import { FieldHouse, persistedHouse } from '../utils/fieldHouseGeometry';

const house: FieldHouse = {
  type: 'Feature',
  id: 'building',
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
    buildingId: 'building',
    height: 7,
    levels: 2,
    estimated: true,
    householdIds: ['12'],
    wallColor: '#d5cbb7',
    roofColor: '#727d83',
  },
};
afterEach(cleanup);

describe('Selected building property editor', () => {
  it('saves 20 floors, independent material colors and existing geometry/household links', () => {
    const save = vi.fn<(value: FieldHouse) => Promise<void>>().mockResolvedValue(undefined);
    const view = render(<FieldHousePropertiesEditor house={house} busy={false} onSave={save} />);
    fireEvent.change(screen.getByLabelText('Tên công trình'), { target: { value: 'Nhà A' } });
    fireEvent.change(screen.getByLabelText('Số tầng'), { target: { value: '20' } });
    expect(screen.getByLabelText('Chiều cao (m)')).toHaveProperty('value', '70');
    fireEvent.change(screen.getByLabelText('Màu tường'), { target: { value: '#112233' } });
    fireEvent.change(screen.getByLabelText('Màu mái'), { target: { value: '#aabbcc' } });
    fireEvent.change(screen.getByLabelText('Kiểu mái'), { target: { value: 'gable' } });
    fireEvent.submit(view.container.querySelector('form')!);
    expect(save).toHaveBeenCalledOnce();
    const updated = save.mock.calls[0][0] as FieldHouse;
    expect(updated.geometry).toBe(house.geometry);
    expect(updated.id).toBe('building');
    expect(updated.properties).toMatchObject({
      name: 'Nhà A',
      floors: 20,
      height: 70,
      wallColor: '#112233',
      roofColor: '#aabbcc',
      roofShape: 'gable',
      appearanceSource: 'manual',
      householdIds: ['12'],
      estimated: true,
    });
    expect(persistedHouse(updated).properties).toMatchObject({
      wallColor: '#112233',
      roofColor: '#aabbcc',
      roofShape: 'gable',
      floorHeight: 3.5,
      appearanceSource: 'manual',
    });
  });

  it.each(['0', '21', '1.5'])('rejects invalid floor count %s without saving', value => {
    const save = vi.fn(async () => {});
    const view = render(<FieldHousePropertiesEditor house={house} busy={false} onSave={save} />);
    fireEvent.change(screen.getByLabelText('Số tầng'), { target: { value } });
    fireEvent.submit(view.container.querySelector('form')!);
    expect(screen.getByRole('alert').textContent).toContain('1 đến 20');
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects height over 70 m and cancel restores the last saved data', () => {
    const save = vi.fn(async () => {});
    const view = render(<FieldHousePropertiesEditor house={house} busy={false} onSave={save} />);
    fireEvent.change(screen.getByLabelText('Chiều cao (m)'), { target: { value: '71' } });
    fireEvent.submit(view.container.querySelector('form')!);
    expect(screen.getByRole('alert').textContent).toContain('70 m');
    fireEvent.click(screen.getByText('Hủy sửa thuộc tính'));
    expect(screen.getByLabelText('Chiều cao (m)')).toHaveProperty('value', '7');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it('does not submit again while a save is in progress', () => {
    const save = vi.fn(async () => {});
    const view = render(<FieldHousePropertiesEditor house={house} busy onSave={save} />);
    fireEvent.submit(view.container.querySelector('form')!);
    expect(save).not.toHaveBeenCalled();
  });
});
