/** How much a household's map position can be trusted, as reported by the server (`link_quality`). */
export const qualityLabel: Record<string, string> = {
  VERIFIED: 'Toạ độ đã xác minh',
  CONFIRMED: 'Vị trí đã được cán bộ xác nhận tại cửa nhà',
  EXACT: 'Vị trí chính xác theo bản vẽ',
  DRAWING_APPROX: 'Vị trí theo bản vẽ, khớp ở mức ấp',
  MANUAL: 'Vị trí do cán bộ liên kết',
  ESTIMATED: 'Vị trí ước lượng, cần xác nhận tại cửa nhà',
};

/** Short names for the map legend, where space is tight. */
export const qualityShort: Record<string, string> = {
  VERIFIED: 'Toạ độ xác minh',
  CONFIRMED: 'Đã xác nhận',
  EXACT: 'Chính xác',
  DRAWING_APPROX: 'Theo bản vẽ (mức ấp)',
  MANUAL: 'Cán bộ liên kết',
  ESTIMATED: 'Ước lượng',
};

/** Marker colours, most trustworthy first. */
export const qualityColor: Record<string, string> = {
  VERIFIED: '#0f766e',
  CONFIRMED: '#16a34a',
  EXACT: '#1c4e3a',
  DRAWING_APPROX: '#2563eb',
  MANUAL: '#7c3aed',
  ESTIMATED: '#f59e0b',
};

export const qualityOrder = Object.keys(qualityLabel);
