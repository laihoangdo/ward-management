import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ALL_HAMLETS, activeHamlet, setActiveHamlet } from './hamletScope';

type HamletOption = { id: number; name: string; full_name?: string; is_default?: boolean };
/** The all-hamlets view the server offers this user: "Tất cả ấp" (super admin), "Toàn xã" (commune chief) or none. */
type ScopeOption = { all: boolean; label: string };
const NO_SCOPE: ScopeOption = { all: false, label: '' };

export type HamletScope = {
  /** Key for the screen below: changes when the view changes, so it reloads its data. */
  key: string;
  /** Viewing every hamlet the user may open (tools that need one hamlet should be hidden). */
  all: boolean;
  /** Name of the current view: the hamlet, "Toàn xã" or "Tất cả ấp". */
  label?: string;
  picker: React.ReactNode;
};

/**
 * Hamlet view shared by the roster, subjects and facilities screens: the user's hamlets plus, for the super admin and the
 * commune chief, an all-hamlets option. The choice is kept per account for the browser tab (see hamletScope); a remembered
 * view the user can no longer open falls back to the server default.
 */
export function useHamletScope(): HamletScope {
  const [hamlets, setHamlets] = useState<HamletOption[]>([]);
  const [scope, setScope] = useState<ScopeOption | null>(null);
  const [hamlet, setHamlet] = useState(activeHamlet());
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    let cancelled = false;
    Promise.all([Promise.resolve(axios.get('/api/roster/hamlets')), Promise.resolve(axios.get('/api/roster/scope')).catch(() => undefined)])
      .then(([response, scopeResponse]) => {
        const list = response?.data;
        if (cancelled || !Array.isArray(list)) return;
        const offered: ScopeOption = scopeResponse?.data?.all ? (scopeResponse.data as ScopeOption) : NO_SCOPE;
        setHamlets(list as HamletOption[]);
        setScope(offered);
        const current = activeHamlet();
        const valid = current === ALL_HAMLETS ? offered.all : list.some(h => String(h.id) === current);
        if (current && !valid) {
          setActiveHamlet('', false);
          setHamlet('');
          setEpoch(n => n + 1);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  const all = hamlet === ALL_HAMLETS && scope?.all !== false;
  const selected = all ? ALL_HAMLETS : hamlets.some(h => String(h.id) === hamlet) ? hamlet : '';
  const effective = selected || String(hamlets.find(h => h.is_default)?.id ?? '');
  const current = hamlets.find(h => String(h.id) === effective);
  const label = all ? scope?.label || undefined : current ? current.full_name || current.name : undefined;
  const choose = (value: string) => {
    setActiveHamlet(value);
    setHamlet(value);
  };
  const picker =
    hamlets.length > 1 || scope?.all ? (
      <label className="roster-hamlet-picker">
        Ấp{' '}
        <select value={effective} onChange={event => choose(event.target.value)} aria-label="Chọn ấp">
          {scope?.all && <option value={ALL_HAMLETS}>{scope.label}</option>}
          {hamlets.map(h => (
            <option key={h.id} value={String(h.id)}>
              {h.name}
            </option>
          ))}
        </select>
      </label>
    ) : null;
  return { key: `${selected || 'default'}:${epoch}`, all, label, picker };
}
