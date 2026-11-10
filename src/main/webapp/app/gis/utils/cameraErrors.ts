const cameraErrorName = (error: unknown): string => (error && typeof error === 'object' && 'name' in error ? String(error.name) : '');

export function cameraErrorMessage(error: unknown): string {
  switch (cameraErrorName(error)) {
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'Không tìm thấy camera trên thiết bị. Hãy kết nối camera hoặc tải ảnh có sẵn từ thiết bị.';
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'Quyền truy cập camera bị chặn. Hãy cho phép máy ảnh trong trình duyệt hoặc tải ảnh có sẵn từ thiết bị.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Camera đang bận hoặc không thể sử dụng. Hãy đóng ứng dụng đang dùng camera, thử lại hoặc tải ảnh có sẵn.';
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return 'Camera không hỗ trợ cấu hình yêu cầu. Hãy chọn camera khác hoặc tải ảnh có sẵn từ thiết bị.';
    case 'AbortError':
      return 'Việc mở camera đã bị gián đoạn. Hãy thử lại hoặc tải ảnh có sẵn từ thiết bị.';
    default:
      return 'Không thể mở camera. Hãy thử lại hoặc tải ảnh có sẵn từ thiết bị.';
  }
}

export function isExpectedCameraError(error: unknown): boolean {
  return /^(NotFoundError|DevicesNotFoundError|NotAllowedError|PermissionDeniedError|SecurityError|NotReadableError|TrackStartError|OverconstrainedError|ConstraintNotSatisfiedError|AbortError)$/.test(
    cameraErrorName(error),
  );
}

export function shouldRetryCameraConstraints(error: unknown): boolean {
  return !/^(NotFoundError|DevicesNotFoundError|NotAllowedError|PermissionDeniedError|SecurityError)$/.test(cameraErrorName(error));
}
