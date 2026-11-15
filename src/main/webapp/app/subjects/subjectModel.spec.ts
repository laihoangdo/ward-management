import { describe, expect, it } from 'vitest';
import { problemText } from './subjectModel';

describe('Server error text', () => {
  it('shows the Vietnamese reason, never a translation key', () => {
    expect(problemText({ message: 'error.http.409', detail: 'Văn bản đã có trong sổ', title: 'Conflict' })).toBe('Văn bản đã có trong sổ');
    expect(problemText({ message: 'Tối đa 30 tệp đính kèm' })).toBe('Tối đa 30 tệp đính kèm');
    expect(problemText({ message: 'error.http.400' })).toBe('');
    expect(problemText(undefined)).toBe('');
    expect(problemText({ detail: '409 CONFLICT "Văn bản đã có"', message: 'error.http.409' })).toBe('Văn bản đã có');
  });
});
