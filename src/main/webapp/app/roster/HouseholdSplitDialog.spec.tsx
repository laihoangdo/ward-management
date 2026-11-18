import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import axios from 'axios';
import HouseholdSplitDialog from './HouseholdSplitDialog';

vi.mock('axios', () => ({ default: { post: vi.fn() } }));

const household = {
  id: 'h1',
  code: 'TC2-001',
  raw_address: 'Địa chỉ cũ',
  members: [
    { membership_id: 'm1', membership_version: 3, full_name: 'Người một' },
    { membership_id: 'm2', membership_version: 0, full_name: 'Người hai' },
  ],
};

describe('Household split', () => {
  beforeEach(() => vi.mocked(axios.post).mockReset());
  afterEach(cleanup);

  it('cannot be saved until members, address and a reason are given', () => {
    render(<HouseholdSplitDialog household={household} onClose={vi.fn()} onSplit={vi.fn()} />);
    const save = screen.getByRole('button', { name: 'Tách hộ' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Người một'));
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Lý do / nguồn kiểm chứng *'), { target: { value: 'Con lập gia đình' } });
    expect(save.disabled).toBe(false);
  });

  it('sends the chosen memberships with their versions and a single request id', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { id: 'new-house' } });
    const onSplit = vi.fn();
    render(<HouseholdSplitDialog household={household} onClose={vi.fn()} onSplit={onSplit} />);
    fireEvent.click(screen.getByLabelText('Người một'));
    fireEvent.change(screen.getByLabelText('Chủ hộ mới'), { target: { value: 'm1' } });
    fireEvent.change(screen.getByLabelText('Địa chỉ hộ mới *'), { target: { value: 'Địa chỉ mới' } });
    fireEvent.change(screen.getByLabelText('Lý do / nguồn kiểm chứng *'), { target: { value: 'Con lập gia đình' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tách hộ' }));
    await waitFor(() => expect(onSplit).toHaveBeenCalledWith('new-house'));
    expect(axios.post).toHaveBeenCalledWith(
      '/api/roster/households/h1/split',
      expect.objectContaining({
        rawAddress: 'Địa chỉ mới',
        reason: 'Con lập gia đình',
        headMembershipId: 'm1',
        members: [{ membershipId: 'm1', version: 3 }],
        requestId: expect.any(String),
      }),
    );
  });

  it('keeps the dialog open with a clear message when the server rejects the split', async () => {
    vi.mocked(axios.post).mockRejectedValueOnce(Error('offline'));
    const onSplit = vi.fn();
    render(<HouseholdSplitDialog household={household} onClose={vi.fn()} onSplit={onSplit} />);
    fireEvent.click(screen.getByLabelText('Người hai'));
    fireEvent.change(screen.getByLabelText('Lý do / nguồn kiểm chứng *'), { target: { value: 'Tách hộ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tách hộ' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Dữ liệu chưa được lưu');
    expect(onSplit).not.toHaveBeenCalled();
  });
});
