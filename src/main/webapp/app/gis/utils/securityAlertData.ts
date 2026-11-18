import type { SecurityAlert } from '../types';

export function buildSecurityTimeline(
  alerts: SecurityAlert[],
  mode: 'week' | 'month',
  categorize: (alert: SecurityAlert) => string,
  now = new Date(),
) {
  const key = (date: Date) =>
    mode === 'week' ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` : `${date.getFullYear()}-${date.getMonth()}`;
  const buckets = Array.from({ length: mode === 'week' ? 7 : 6 }, (_, index) => {
    const date =
      mode === 'week'
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + index)
        : new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    return {
      key: key(date),
      timeLabel: mode === 'week' ? date.toLocaleDateString('vi-VN') : `${date.getMonth() + 1}/${date.getFullYear()}`,
      total: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      resolved: 0,
      unresolved: 0,
      database: 0,
      auth: 0,
      whitelist: 0,
      other: 0,
    };
  });
  for (const alert of alerts) {
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s|$)/.exec(alert.timestamp || '');
    const date = match ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])) : new Date(alert.timestamp || NaN);
    if (!Number.isFinite(date.getTime()) || (match && (date.getDate() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1)))
      continue;
    const point = buckets.find(bucket => bucket.key === key(date));
    if (!point) continue;
    point.total++;
    if (alert.severity === 'critical') point.critical++;
    else if (alert.severity === 'high') point.high++;
    else if (alert.severity === 'medium') point.medium++;
    else point.low++;
    if (alert.resolved) point.resolved++;
    else point.unresolved++;
    const category = categorize(alert);
    if (category === 'Cơ sở dữ liệu') point.database++;
    else if (category === 'Xác thực / Đăng nhập') point.auth++;
    else if (category === 'Vi phạm Whitelist') point.whitelist++;
    else point.other++;
  }
  return buckets;
}
