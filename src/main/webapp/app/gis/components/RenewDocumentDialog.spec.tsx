import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RenewDocumentDialog } from './RenewDocumentDialog';
import { DocumentRecord } from '../types';

const document = { id: '1', docCode: 'DOC-1', title: 'License', targetName: 'Business', expiryDate: '01/01/2026' } as DocumentRecord;
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
});
