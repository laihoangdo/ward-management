import React from 'react';
import { MapPin } from 'lucide-react';
import type { AppUser } from '../types';

const ROLE_LABEL: Partial<Record<AppUser['role'], string>> = {
  'sub-admin': 'Công an phụ trách ấp',
  officer: 'Công an viên địa bàn',
};

interface TerritoryScopeBarProps {
  user: Pick<AppUser, 'role' | 'assignedHamlets' | 'assignedStreets'>;
  /** Households in the user's scope; undefined when the current screen has not loaded them. */
  householdCount?: number;
}

/**
 * One quiet line telling a field officer which territory every screen is scoped to.
 * Only the household count is shown: it is the same figure on every screen, while resident totals
 * depend on how people in several households are counted and live on the overview instead.
 */
export const TerritoryScopeBar: React.FC<TerritoryScopeBarProps> = ({ user, householdCount }) => {
  const hamlets = user.assignedHamlets?.length ? user.assignedHamlets.join(', ') : 'Địa bàn phân công';
  const streets = user.assignedStreets?.length ? user.assignedStreets.join(', ') : 'Toàn bộ địa bàn ấp';
  return (
    <section
      aria-label="Phạm vi địa bàn được giao"
      className="gis-territory-scope mb-2.5 sm:mb-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
    >
      <span className="flex min-w-0 items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
        <MapPin aria-hidden="true" className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-emerald-800 dark:text-emerald-400" />
        <span className="truncate max-w-[220px] sm:max-w-none">{hamlets}</span>
      </span>
      <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
        ·
      </span>
      <span className="font-medium text-slate-700 dark:text-slate-300">{ROLE_LABEL[user.role] ?? 'Cán bộ địa bàn'}</span>
      <span aria-hidden="true" className="hidden sm:inline text-slate-300 dark:text-slate-700">
        ·
      </span>
      <span className="min-w-0 truncate max-w-full sm:max-w-md">
        Tuyến: <strong className="font-medium text-slate-800 dark:text-slate-100">{streets}</strong>
      </span>
      {/* Screens that do not load households have no count; omit it rather than show a loading state that never ends. */}
      {householdCount !== undefined && (
        <span className="ml-auto rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800 tabular-nums dark:bg-slate-800 dark:text-slate-200">
          {householdCount} hộ trong phạm vi
        </span>
      )}
    </section>
  );
};
