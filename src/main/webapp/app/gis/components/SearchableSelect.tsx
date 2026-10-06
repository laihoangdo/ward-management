import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Check, ChevronDown, X, Plus } from 'lucide-react';

export interface SearchableSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  searchPlaceholder?: string;
  required?: boolean;
  allowCustom?: boolean;
  accentColor?: 'blue' | 'indigo' | 'emerald';
  icon?: React.ReactNode;
  hint?: string;
  className?: string;
}

function normalizeVietnamese(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder = 'Chọn một mục...',
  searchPlaceholder = 'Nhập tìm kiếm...',
  required = false,
  allowCustom = true,
  accentColor = 'blue',
  icon,
  hint,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter options based on normalized Vietnamese search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const normQ = normalizeVietnamese(searchTerm);
    return options.filter(opt => {
      const normOpt = normalizeVietnamese(opt);
      return normOpt.includes(normQ);
    });
  }, [options, searchTerm]);

  // Check if current search term is an exact match in options
  const isExactMatch = useMemo(() => {
    const normQ = normalizeVietnamese(searchTerm);
    return options.some(opt => normalizeVietnamese(opt) === normQ);
  }, [options, searchTerm]);

  const handleToggle = () => {
    setIsOpen(prev => {
      const next = !prev;
      if (next) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      return next;
    });
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions.length > 0) {
        handleSelect(filteredOptions[0]);
      } else if (allowCustom && searchTerm.trim()) {
        handleSelect(searchTerm.trim());
      }
    }
  };

  const borderFocusClass =
    accentColor === 'indigo'
      ? 'focus:border-indigo-500 border-indigo-500 ring-2 ring-indigo-100'
      : accentColor === 'emerald'
        ? 'focus:border-emerald-500 border-emerald-500 ring-2 ring-emerald-100'
        : 'focus:border-blue-500 border-blue-500 ring-2 ring-blue-100';

  const checkBadgeBg = accentColor === 'indigo' ? 'bg-indigo-600' : accentColor === 'emerald' ? 'bg-emerald-600' : 'bg-blue-600';

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <label className="block font-bold text-slate-700 text-xs">
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
          {hint && <span className="text-[10px] text-slate-400">{hint}</span>}
        </div>
      )}

      {/* Trigger Button */}
      <div
        onClick={handleToggle}
        className={`w-full px-3 py-2 bg-slate-50 border rounded-xl cursor-pointer transition flex items-center justify-between text-xs select-none ${
          isOpen ? borderFocusClass : 'border-slate-300 hover:border-slate-400 bg-slate-50'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
          {value ? (
            <span className="font-bold text-slate-900 truncate">{value}</span>
          ) : (
            <span className="text-slate-400 italic truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-600' : ''}`} />
        </div>
      </div>

      {/* Hidden input for HTML form validation */}
      <input type="text" value={value} onChange={() => {}} required={required} className="sr-only" tabIndex={-1} />

      {/* Dropdown Popup */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-64 text-xs">
          {/* Search Box */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/90">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 p-0.5 text-slate-400 hover:text-slate-600 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500 px-1">
              <span>
                Khớp <strong className="text-blue-600 font-bold">{filteredOptions.length}</strong> / {options.length}
              </span>
              {searchTerm && (
                <button type="button" onClick={() => setSearchTerm('')} className="text-blue-600 hover:underline cursor-pointer">
                  Tất cả
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="overflow-y-auto flex-1 divide-y divide-slate-100 max-h-48">
            {/* Custom option when no exact match and allowCustom is true */}
            {allowCustom && searchTerm.trim() && !isExactMatch && (
              <div
                onClick={() => handleSelect(searchTerm.trim())}
                className="p-2.5 px-3 flex items-center gap-2 cursor-pointer bg-blue-50/60 hover:bg-blue-100/70 text-blue-800 font-semibold transition"
              >
                <Plus className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="truncate">
                  Sử dụng: <strong className="underline">"{searchTerm.trim()}"</strong>
                </span>
                <span className="text-[10px] text-blue-500 ml-auto bg-blue-100 px-1.5 py-0.5 rounded shrink-0">Mới</span>
              </div>
            )}

            {filteredOptions.length === 0 && (!allowCustom || !searchTerm.trim()) ? (
              <div className="p-4 text-center text-slate-400">
                <p>Không tìm thấy mục nào khớp</p>
              </div>
            ) : (
              filteredOptions.map(opt => {
                const isSelected = opt === value;
                return (
                  <div
                    key={opt}
                    onClick={() => handleSelect(opt)}
                    className={`p-2.5 px-3 flex items-center justify-between gap-2 cursor-pointer transition ${
                      isSelected ? 'bg-blue-50 text-blue-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="truncate">{opt}</span>
                    {isSelected && (
                      <div className={`w-4 h-4 rounded-full ${checkBadgeBg} text-white flex items-center justify-center shrink-0`}>
                        <Check className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
