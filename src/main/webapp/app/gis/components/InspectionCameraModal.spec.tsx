import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { InspectionCameraModal } from './InspectionCameraModal';
import type { HouseholdFacility } from '../types';

const household = { id: 'synthetic-only', type: 'household', houseNumber: '1', street: 'Đường kiểm thử' } as HouseholdFacility;
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('explains missing hardware and keeps image upload available without retrying permission', async () => {
  const getUserMedia = vi.fn().mockRejectedValue(new DOMException('No device', 'NotFoundError'));
  vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia } });
  const warn = vi.spyOn(console, 'warn');
  const view = render(<InspectionCameraModal isOpen household={household} onClose={vi.fn()} />);
  await screen.findByText(/Không tìm thấy camera/);
  expect(getUserMedia).toHaveBeenCalledTimes(1);
  expect(view.container.querySelector('input[type="file"]')).toBeTruthy();
  expect(warn).not.toHaveBeenCalled();
});

it('stops a camera stream arriving after the modal has closed', async () => {
  let resolveStream!: (stream: MediaStream) => void;
  const getUserMedia = vi.fn(
    () =>
      new Promise<MediaStream>(resolve => {
        resolveStream = resolve;
      }),
  );
  vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia } });
  const props = { household, onClose: vi.fn() };
  const view = render(<InspectionCameraModal {...props} isOpen />);
  await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce());
  view.rerender(<InspectionCameraModal {...props} isOpen={false} />);
  const stop = vi.fn();
  await act(async () => {
    resolveStream({ getTracks: () => [{ stop }] } as unknown as MediaStream);
    await Promise.resolve();
  });
  expect(stop).toHaveBeenCalledOnce();
  expect(view.container.querySelector('video')).toBeNull();
});
