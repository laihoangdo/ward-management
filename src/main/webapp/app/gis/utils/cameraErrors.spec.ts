import { expect, it } from 'vitest';
import { cameraErrorMessage, isExpectedCameraError, shouldRetryCameraConstraints } from './cameraErrors';

it('distinguishes missing hardware from blocked permission and busy devices', () => {
  expect(cameraErrorMessage({ name: 'NotFoundError' })).toContain('Không tìm thấy camera');
  expect(cameraErrorMessage({ name: 'NotAllowedError' })).toContain('Quyền truy cập camera bị chặn');
  expect(cameraErrorMessage({ name: 'NotReadableError' })).toContain('Camera đang bận');
  expect(shouldRetryCameraConstraints({ name: 'NotFoundError' })).toBe(false);
  expect(shouldRetryCameraConstraints({ name: 'NotAllowedError' })).toBe(false);
  expect(shouldRetryCameraConstraints({ name: 'OverconstrainedError' })).toBe(true);
});

it('classifies expected media errors without swallowing unexpected failures', () => {
  expect(isExpectedCameraError(new DOMException('', 'NotFoundError'))).toBe(true);
  expect(isExpectedCameraError(new TypeError('unexpected'))).toBe(false);
  expect(cameraErrorMessage(null)).toContain('tải ảnh');
});
