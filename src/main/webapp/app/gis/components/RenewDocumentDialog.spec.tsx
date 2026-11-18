import React from 'react';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { RenewDocumentDialog } from './RenewDocumentDialog';
import { DocumentRecord } from '../types';
import { DocumentCommand } from '../services/documentLifecycle';

vi.mock('../services/householdBrowse', () => ({
  browseHouseholds: vi.fn(() =>
    Promise.resolve({
      items: [{ id: '42', code: 'HOUSE-42', houseNumber: '1', street: 'Test street', hamlet: 'Test hamlet' }],
    }),
  ),
}));
afterEach(cleanup);

const document = {
  id: '1',
  docCode: 'DOC-1',
  title: 'License',
  targetName: 'Business',
  expiryDate: '2026-01-01',
  expiryOn: '2026-01-01',
  householdId: 42,
  version: 0,
} as DocumentRecord;
describe('Document renewal', () => {
  it('retains the entered date after a failed request and prevents duplicate submissions', async () => {
    let reject: (error: Error) => void;
    const save = vi.fn(
      () =>
        new Promise<void>((_, rejectRequest) => {
          reject = rejectRequest;
        }),
    );
    const close = vi.fn();
    render(<RenewDocumentDialog document={document} onClose={close} onSave={save} />);
    const input = screen.getByLabelText('Ngày hết hạn mới') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2027-01-01' } });
    fireEvent.change(screen.getByLabelText('Lý do / căn cứ đối chiếu'), { target: { value: 'Đã kiểm tra giấy tờ' } });
    const button = screen.getByRole('button', { name: 'Xác nhận gia hạn' }) as HTMLButtonElement;
    fireEvent.click(button);
    expect(button.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(close).not.toHaveBeenCalled();
    reject(new Error('Offline'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Chưa thể xác nhận'));
    expect(input.value).toBe('2027-01-01');
    expect(save).toHaveBeenCalledOnce();
  });

  it('requires explicit household selection for unconfirmed source documents', async () => {
    const save = vi.fn<(command: DocumentCommand) => Promise<void>>(async () => {});
    render(<RenewDocumentDialog document={{ ...document, householdId: undefined, expiryOn: undefined }} onClose={vi.fn()} onSave={save} />);
    const submit = screen.getByRole('button', { name: 'Xác nhận đối chiếu' }) as HTMLButtonElement;
    fireEvent.change(screen.getByLabelText('Ngày hết hạn mới'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Lý do / căn cứ đối chiếu'), { target: { value: 'Đối chiếu nguồn' } });
    expect(submit.disabled).toBe(true);
    fireEvent.click(await screen.findByRole('button', { name: /HOUSE-42/ }));
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0][0]).toMatchObject({ householdId: 42, expiryOn: '2026-01-01', reason: 'Đối chiếu nguồn' });
  });
});
