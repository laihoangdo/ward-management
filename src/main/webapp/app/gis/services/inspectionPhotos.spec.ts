import { beforeEach, expect, it, vi } from 'vitest';
import axios from 'axios';
import { deleteInspectionPhoto, fetchInspectionPhotos, saveInspectionPhoto } from './inspectionPhotos';
import type { InspectionPhoto } from '../types';
vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
beforeEach(() => vi.resetAllMocks());
it('uses the authorized server photo endpoints and authoritative returned metadata', async () => {
  const saved = {
    id: 'server-id',
    url: 'data:image/png;base64,synthetic',
    takenBy: 'Server user',
    timestamp: '2026-11-02T00:00:00Z',
  } as InspectionPhoto;
  vi.mocked(axios.post).mockResolvedValue({ data: saved });
  expect(await saveInspectionPhoto('123', { ...saved, id: 'client-id', takenBy: 'Untrusted user' })).toEqual(saved);
  expect(axios.post).toHaveBeenCalledWith('/api/gis/households/123/inspection-photos', {
    url: saved.url,
    caption: '',
    category: 'general',
  });
  vi.mocked(axios.get).mockResolvedValue({ data: [saved] });
  expect(await fetchInspectionPhotos('123')).toEqual([saved]);
  await deleteInspectionPhoto('123', saved.id);
  expect(axios.delete).toHaveBeenCalledWith('/api/gis/households/123/inspection-photos/server-id');
});
it('does not report a successful local save when the server fails', async () => {
  vi.mocked(axios.post).mockRejectedValue(new Error('server unavailable'));
  await expect(saveInspectionPhoto('123', {} as InspectionPhoto)).rejects.toThrow('server unavailable');
  await expect(fetchInspectionPhotos('local-id')).rejects.toThrow('ID hộ');
});
