import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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
