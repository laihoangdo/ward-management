import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import type { AuditLogEntry } from '../types';
import { LogsTab } from './LogsTab';

afterEach(cleanup);

const entry = (over: Partial<AuditLogEntry>): AuditLogEntry =>
  ({
    id: 'log-1',
    timestamp: '18/10/2026 15:38:23',
    createdAt: 1,
    actionType: 'coordinate_update',
    actionLabel: 'Sửa tọa độ',
    officerName: 'Cán bộ thử nghiệm',
    officerBadge: '',
    targetType: 'household',
    targetTitle: 'Hộ thử nghiệm',
    details: 'Di chuyển / sửa polygon',
    ...over,
  }) as AuditLogEntry;

it('folds raw JSON changes, shows plain values in full and makes no unbacked claims', () => {
  render(
    <LogsTab
      households={[]}
      logs={[
        entry({ id: 'a', previousValue: '{"type":"Feature","height":7}', newValue: '{"type":"Feature","height":8}' }),
        entry({ id: 'b', previousValue: 'Ghi chú cũ', newValue: 'Ghi chú mới đầy đủ không bị cắt' }),
      ]}
    />,
  );
  const folded = screen.getByText('Xem dữ liệu thay đổi').closest('details') as HTMLDetailsElement;
  expect(folded.open).toBe(false);
  expect(folded.textContent).toContain('"height":8');
  expect(screen.getByText('Ghi chú mới đầy đủ không bị cắt').closest('details')).toBeNull();
  expect(screen.queryByText('Thời gian thực')).toBeNull();
  expect(screen.queryByText('Mã hóa kiểm toán')).toBeNull();
  expect(screen.queryAllByText('()')).toHaveLength(0);
});
