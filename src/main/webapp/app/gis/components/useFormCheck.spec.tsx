import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { FormCheckSummary, useFormCheck } from './useFormCheck';

afterEach(cleanup);

function Fixture({ onValid }: { onValid: () => void }) {
  const check = useFormCheck('fixture-errors');
  return (
    <form
      noValidate
      onSubmit={check.guard(event => {
        event.preventDefault();
        onValid();
      })}
      onChange={check.onFieldChange}
    >
      <FormCheckSummary id="fixture-errors" problems={check.problems} summaryRef={check.summaryRef} />
      <label>
        Họ tên chủ hộ *
        <input name="owner" required />
      </label>
      <label>
        Số điện thoại
        <input name="phone" />
      </label>
      <button type="submit">Lưu</button>
    </form>
  );
}

it('blocks submit, lists the missing field in Vietnamese and marks it, then clears once filled', () => {
  const onValid = vi.fn();
  render(<Fixture onValid={onValid} />);

  fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));

  expect(onValid).not.toHaveBeenCalled();
  const summary = screen.getByRole('alert');
  expect(summary.textContent).toContain('Còn 1 thông tin cần nhập hoặc sửa');
  expect(summary.textContent).toContain('Họ tên chủ hộ');
  const owner = screen.getByLabelText(/Họ tên chủ hộ/);
  expect(owner.getAttribute('aria-invalid')).toBe('true');
  expect(owner.getAttribute('aria-describedby')).toBe('fixture-errors');
  expect(screen.getByLabelText('Số điện thoại').hasAttribute('aria-invalid')).toBe(false);

  fireEvent.change(owner, { target: { value: 'Nguyễn Văn A' } });
  expect(owner.hasAttribute('aria-invalid')).toBe(false);
  expect(screen.queryByRole('alert')).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
  expect(onValid).toHaveBeenCalledTimes(1);
});
