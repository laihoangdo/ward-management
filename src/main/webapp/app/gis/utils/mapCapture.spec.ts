import { afterEach, expect, it, vi } from 'vitest';
import { frameMapCapture } from './mapCapture';

afterEach(() => vi.restoreAllMocks());

it('embeds officer identity and extraction details in the exported image with space for wrapped text', () => {
  const context = {
    measureText: (text: string) => ({ width: text.length * 12 }),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  const source = document.createElement('canvas');
  source.width = 780;
  source.height = 1000;
  const result = frameMapCapture(
    source,
    { fullName: 'Nguyễn Văn An', rank: 'Đại úy', unit: 'Công an xã Bà Điểm', area: 'Ấp Trung Chánh 2' },
    ['Trích xuất: 18/10/2026', 'Ranh giới ấp tạm dựng từ PDF.'],
  );
  const text = context.fillText.mock.calls.map(call => call[0]).join(' ');
  expect(text).toContain('Đại úy · Nguyễn Văn An');
  expect(text).toContain('Công an xã Bà Điểm');
  expect(text).toContain('Ấp Trung Chánh 2');
  expect(text).toContain('18/10/2026');
  expect(result.width).toBe(780);
  expect(result.height).toBeGreaterThan(source.height);
  expect(context.drawImage).toHaveBeenCalledWith(source, 0, expect.any(Number));
});

it('marks missing officer information rather than inserting a sample identity', () => {
  const fillText = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    measureText: () => ({ width: 10 }),
    fillRect: vi.fn(),
    fillText,
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  frameMapCapture(document.createElement('canvas'), undefined, []);
  expect(fillText.mock.calls.map(call => call[0]).join(' ')).toContain('Chưa có thông tin');
});
