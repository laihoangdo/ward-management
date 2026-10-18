import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface Unit {
  id: number;
  fullName: string;
}

function useUnits(path: string | null) {
  const [state, setState] = useState<{ units: Unit[]; loading: boolean; error: boolean }>({ units: [], loading: false, error: false });
  useEffect(() => {
    let active = true;
    setState({ units: [], loading: path !== null, error: false });
    if (path)
      void axios
        .get<Unit[]>(path)
        .then(({ data }) => {
          if (active) setState({ units: data, loading: false, error: false });
        })
        .catch(() => {
          if (active) setState({ units: [], loading: false, error: true });
        });
    return () => {
      active = false;
    };
  }, [path]);
  return state;
}

export function AdministrativeDirectory({ onCommuneChange }: { onCommuneChange?: (id: number | null) => void }) {
  const [provinceId, setProvinceId] = useState('');
  const [communeId, setCommuneId] = useState('');
  const [hamletId, setHamletId] = useState('');
  const provinces = useUnits('/api/administrative-units/provinces');
  const communes = useUnits(provinceId ? `/api/administrative-units/communes?provinceId=${provinceId}` : null);
  const hamlets = useUnits(communeId ? `/api/administrative-units/hamlets?communeId=${communeId}` : null);
  return (
    <section className="space-y-3 rounded-xl border border-slate-700 p-4">
      <h3 className="text-sm font-semibold text-blue-300">Danh mục hành chính từ DB</h3>
      <div className="grid gap-3 md:grid-cols-3">
        {[
          {
            label: 'Tỉnh / Thành phố',
            state: provinces,
            value: provinceId,
            change(value: string) {
              setProvinceId(value);
              setCommuneId('');
              setHamletId('');
              onCommuneChange?.(null);
            },
            enabled: true,
          },
          {
            label: 'Xã / Phường',
            state: communes,
            value: communeId,
            change(value: string) {
              setCommuneId(value);
              setHamletId('');
              onCommuneChange?.(value ? Number(value) : null);
            },
            enabled: !!provinceId,
          },
          { label: 'Ấp / Khu phố', state: hamlets, value: hamletId, change: setHamletId, enabled: !!communeId },
        ].map(item => (
          <label key={item.label} className="text-xs text-slate-300">
            {item.label}
            <select
              aria-label={item.label}
              value={item.value}
              disabled={!item.enabled || item.state.loading || item.state.error}
              onChange={event => item.change(event.target.value)}
              className="mt-2 w-full rounded-lg bg-slate-950 p-2 text-white"
            >
              <option value="">{item.state.loading ? 'Đang tải...' : 'Chọn ' + item.label}</option>
              {item.state.units.map(unit => (
                <option key={unit.id} value={unit.id}>
                  {unit.fullName}
                </option>
              ))}
            </select>
            {item.state.error && <span role="alert">Không thể tải danh mục.</span>}
          </label>
        ))}
      </div>
      <p className="text-xs text-slate-400">
        Danh mục hành chính để đối chiếu. Quyền truy cập vẫn được lưu theo các khu vực phân quyền bên dưới.
      </p>
    </section>
  );
}
