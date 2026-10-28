import { describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { documentExpiry, mapDocumentDto, saveLegalDocument, DocumentCommand, hcmToday } from './documentLifecycle';

vi.mock('axios', () => ({ default: { post: vi.fn() } }));

describe('Confirmed document dates', () => {
  it('uses the Vietnamese calendar day across UTC midnight boundaries', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-10-27T17:05:00Z'));
      expect(hcmToday()).toBe('2026-10-28');
    } finally {
      vi.useRealTimers();
    }
  });
  it('never treats legacy source dates/status as verified or invents dates or territory', () => {
    const document = mapDocumentDto({ id: 1, expiryDate: '01/02/2027', status: 'VALID' }, '2026-10-28');
    expect(document.status).toBe('unverified');
    expect(document.expiryDate).toBe('');
    expect(document.issueDate).toBe('');
    expect(document.legacyExpiryDate).toBe('01/02/2027');
    expect(document.householdId).toBeUndefined();
    expect(document.hamlet).not.toContain('Bắc Lân');
  });
  it.each([
    ['2026-10-27', 'expired', -1],
    ['2026-10-28', 'expiring_soon', 0],
    ['2026-11-27', 'expiring_soon', 30],
    ['2026-11-28', 'valid', 31],
  ])('uses whole calendar days including the expiry day: %s', (date, status, remaining) => {
    expect(documentExpiry(date, '2026-10-28')).toEqual({ status, daysRemaining: remaining });
  });
  it('rejects invalid and missing dates without JS rollover', () => {
    expect(documentExpiry('2026-02-30')).toEqual({ status: 'unverified' });
    expect(documentExpiry(null)).toEqual({ status: 'unverified' });
  });
  it('writes through the audited workflow, not the old merge patch API', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { id: 1 } });
    const command = { requestId: 'request', version: 3, householdId: 42, expiryOn: '2027-01-01', reason: 'Checked' } as DocumentCommand;
    await saveLegalDocument('1', command);
    expect(axios.post).toHaveBeenCalledWith('/api/legal-documents/1/confirm-or-renew', command);
  });
});
