import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SearchableSelect } from './SearchableSelect';

describe('Searchable selection keyboard access', () => {
  it('opens from the keyboard and selects the highlighted option', () => {
    const change = vi.fn();
    render(<SearchableSelect label="Ấp" value="" onChange={change} options={['Bắc Lân', 'Đông Lân']} allowCustom={false} />);
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Ấp' }), { key: 'ArrowDown' });
    const search = screen.getByRole('combobox', { name: 'Nhập tìm kiếm...' });
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(change).toHaveBeenCalledWith('Đông Lân');
  });
  it('consumes Escape while closing its popup', () => {
    const parent = vi.fn();
    render(
      <div onKeyDown={parent}>
        <SearchableSelect label="Ấp" value="" onChange={vi.fn()} options={['Bắc Lân']} />
      </div>,
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Ấp' }));
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Nhập tìm kiếm...' }), { key: 'Escape' });
    expect(parent).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
