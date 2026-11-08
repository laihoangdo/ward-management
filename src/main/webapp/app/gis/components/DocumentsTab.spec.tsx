import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DocumentsTab } from './DocumentsTab';

afterEach(cleanup);

const props = { onRenewDocument: vi.fn(), onSendReminder: vi.fn() };

it('keeps the expiry summary neutral when nothing is expiring', () => {
  render(<DocumentsTab documents={[]} {...props} />);
  const summary = screen.getByText('Không có hồ sơ hết hạn trong 30 ngày tới');
  expect(summary.parentElement?.className).not.toMatch(/amber/);
  expect(screen.getByRole('button', { name: /Sắp hết hạn \(0\)/ }).className).not.toMatch(/amber-50/);
  expect(screen.queryByText('Kiểm soát hồ sơ')).toBeNull();
});
