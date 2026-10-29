import React, { useState } from 'react';
import {
  DEFAULT_FLOOR_HEIGHT,
  FieldHouse,
  MAX_BUILDING_FLOORS,
  MAX_BUILDING_HEIGHT,
  validateBuildingProperties,
} from '../utils/fieldHouseGeometry';

interface Props {
  house: FieldHouse;
  busy: boolean;
  onSave: (house: FieldHouse) => Promise<void>;
}

function defaults(house: FieldHouse) {
  return {
    name: house.properties.name ?? '',
    floors:
      house.properties.floors ??
      house.properties.levels ??
      Math.max(1, Math.min(MAX_BUILDING_FLOORS, Math.round(house.properties.height / DEFAULT_FLOOR_HEIGHT))),
    height: house.properties.height,
    wallColor: house.properties.wallColor ?? house.properties.color ?? '#b6c9d6',
    roofColor: house.properties.roofColor ?? '#727d83',
    roofShape: house.properties.roofShape === 'gable' ? 'gable' : 'flat',
    estimated: house.properties.estimated ?? false,
  };
}

export default function FieldHousePropertiesEditor({ house, busy, onSave }: Props) {
  const [draft, setDraft] = useState(() => defaults(house));
  const [error, setError] = useState('');
  return (
    <details className="field-property-editor">
      <summary>Sửa thuộc tính khối nhà</summary>
      <form
        noValidate
        onSubmit={event => {
          event.preventDefault();
          if (busy) return;
          const next: FieldHouse = {
            ...house,
            properties: {
              ...house.properties,
              ...draft,
              name: draft.name.trim(),
              color: draft.wallColor,
              levels: draft.floors,
              floorHeight: draft.height / draft.floors,
              appearanceSource: 'manual',
            },
          };
          const problem = validateBuildingProperties(next.properties);
          if (problem) {
            setError(problem);
            return;
          }
          setError('');
          void onSave(next);
        }}
      >
        <fieldset disabled={busy}>
          <label>
            Tên công trình
            <input maxLength={255} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} />
          </label>
          <label>
            Số tầng
            <input
              type="number"
              min={1}
              max={MAX_BUILDING_FLOORS}
              step={1}
              value={draft.floors}
              onChange={event => {
                const floors = Number(event.target.value);
                setDraft({ ...draft, floors, height: floors * DEFAULT_FLOOR_HEIGHT });
              }}
            />
          </label>
          <label>
            Chiều cao (m)
            <input
              type="number"
              min={0.5}
              max={MAX_BUILDING_HEIGHT}
              step={0.1}
              value={draft.height}
              onChange={event => setDraft({ ...draft, height: Number(event.target.value) })}
            />
          </label>
          <small>Tối đa 20 tầng / 70 m. Đổi số tầng tự gợi ý 3,5 m mỗi tầng; có thể chỉnh chiều cao trong giới hạn.</small>
          <label>
            Màu tường
            <input type="color" value={draft.wallColor} onChange={event => setDraft({ ...draft, wallColor: event.target.value })} />
          </label>
          <label>
            Màu mái
            <input type="color" value={draft.roofColor} onChange={event => setDraft({ ...draft, roofColor: event.target.value })} />
          </label>
          <label>
            Kiểu mái
            <select value={draft.roofShape} onChange={event => setDraft({ ...draft, roofShape: event.target.value })}>
              <option value="flat">Mái bằng</option>
              <option value="gable">Mái hai dốc</option>
            </select>
          </label>
          <small>Mái hai dốc chỉ áp dụng cho mặt bằng chữ nhật; mặt bằng khác giữ mái bằng.</small>
          <label>
            <input type="checkbox" checked={draft.estimated} onChange={event => setDraft({ ...draft, estimated: event.target.checked })} />
            Chiều cao ước lượng
          </label>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <button type="submit" className="field-primary">
            {busy ? 'Đang lưu…' : 'Lưu thuộc tính khối nhà'}
          </button>
          <button
            type="button"
            onClick={event => {
              setDraft(defaults(house));
              setError('');
              event.currentTarget.closest('details')?.removeAttribute('open');
            }}
          >
            Hủy sửa thuộc tính
          </button>
        </fieldset>
      </form>
    </details>
  );
}
