import { expect, it } from 'vitest';
import { buildSecurityTimeline } from './securityAlertData';
import type { SecurityAlert } from '../types';

const now = new Date(2026, 10, 2, 12);
const alert = (timestamp: string) => ({ timestamp, severity: 'critical', resolved: false }) as SecurityAlert;
it('does not fabricate historical incidents when the server returns no alerts', () => {
  for (const mode of ['week', 'month'] as const) {
    const result = buildSecurityTimeline([], mode, () => 'Cơ sở dữ liệu', now);
    expect(result.reduce((total, point) => total + point.total, 0)).toBe(0);
    expect(result.every(point => point.resolved === 0 && point.unresolved === 0)).toBe(true);
  }
});
it('counts only recorded timestamps in the requested period, without mixing dates from another year', () => {
  const result = buildSecurityTimeline(
    [alert('02/11/2026'), alert('2026-11-01T12:00:00'), alert('02/11/2025'), alert(''), alert('31/02/2026')],
    'week',
    () => 'Cơ sở dữ liệu',
    now,
  );
  expect(result.reduce((total, point) => total + point.total, 0)).toBe(2);
  expect(result.reduce((total, point) => total + point.critical, 0)).toBe(2);
  expect(result.reduce((total, point) => total + point.database, 0)).toBe(2);
  expect(result.reduce((total, point) => total + point.unresolved, 0)).toBe(2);
});
