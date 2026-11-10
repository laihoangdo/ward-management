import React from 'react';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OverviewTab } from './OverviewTab';

describe('Overview operational shortcuts', () => {
  it('opens the expiry filter and does not promise unsupported completeness', () => {
    const open = vi.fn();
    render(<OverviewTab households={[]} onNavigateTab={vi.fn()} onSelectHousehold={vi.fn()} onOpenExpiringDocuments={open} />);
    fireEvent.click(screen.getByRole('button', { name: 'Xem hồ sơ sắp hết hạn' }));
    expect(open).toHaveBeenCalledOnce();
    expect(screen.queryByText('100% đã thu thập hồ sơ')).toBeNull();
  });
  it('does not offer the work queue document shortcut without menu access', () => {
    render(<OverviewTab households={[]} onNavigateTab={vi.fn()} onSelectHousehold={vi.fn()} canNavigate={() => false} />);
    expect(screen.queryByRole('button', { name: 'Xem hồ sơ sắp hết hạn' })).toBeNull();
  });
});

describe('Overview attention block placement', () => {
  // Which block comes first in document order: the attention list or the headline figures.
  const firstBlock = () =>
    document.querySelector('[aria-labelledby="work-queue-title"], #stat-total-card')?.id === 'stat-total-card' ? 'figures' : 'attention';
  it('shows the scope and keeps a quiet attention line after the figures when nothing needs action', () => {
    render(
      <OverviewTab
        households={[{ id: '1', code: 'H1', hamlet: 'Trung Chánh 2', status: 'normal', residentsCount: 1 } as never]}
        onNavigateTab={vi.fn()}
        onSelectHousehold={vi.fn()}
      />,
    );
    expect(screen.getByText('Phạm vi đang xem: Trung Chánh 2')).toBeDefined();
    expect(screen.getByText(/Không có hộ mang trạng thái cảnh báo/)).toBeDefined();
    expect(firstBlock()).toBe('figures');
    cleanup();
  });
  it('leads with the attention list when households carry a warning', () => {
    render(
      <OverviewTab
        households={[{ id: '2', code: 'H2', hamlet: 'Trung Chánh 2', status: 'warning', ownerName: 'Hộ thử', residentsCount: 1 } as never]}
        onNavigateTab={vi.fn()}
        onSelectHousehold={vi.fn()}
      />,
    );
    expect(firstBlock()).toBe('attention');
    expect(screen.getByRole('button', { name: /Hộ thử · H2/ })).toBeDefined();
    cleanup();
  });
});
