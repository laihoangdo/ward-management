import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Home, Check, ChevronDown, X, MapPin, User, Building } from 'lucide-react';
import { HouseholdFacility } from './types';

export interface HouseholdSearchSelectProps {
  households: HouseholdFacility[];
  selectedId: string;
  onSelect: (householdId: string) => void;
  accentColor?: 'blue' | 'amber';
  label?: string;
  required?: boolean;
}

export const HouseholdSearchSelect: React.FC<HouseholdSearchSelectProps> = ({
  households,
  selectedId,
  onSelect,
  accentColor = 'blue',
  label = 'Chọn Hộ Dân Tiếp Nhận',
  required = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
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

  // Currently selected household
  const selectedHousehold = useMemo(() => {
    return households.find(h => h.id === selectedId) || null;
  }, [households, selectedId]);

  // Filter households by code, ownerName, houseNumber, street, hamlet, phone
  const filteredHouseholds = useMemo(() => {
    if (!searchTerm.trim()) return households;
    const q = searchTerm.toLowerCase().trim();

    return households.filter(h => {
      const code = (h.code || '').toLowerCase();
      const owner = (h.ownerName || '').toLowerCase();
      const house = (h.houseNumber || '').toLowerCase();
      const street = (h.street || '').toLowerCase();
      const hamlet = (h.hamlet || '').toLowerCase();
      const phone = (h.ownerPhone || '').toLowerCase();
      const business = (h.businessName || '').toLowerCase();

      return (
        code.includes(q) ||
        owner.includes(q) ||
        house.includes(q) ||
        street.includes(q) ||
        hamlet.includes(q) ||
        phone.includes(q) ||
        business.includes(q)
      );
    });
  }, [households, searchTerm]);

  const handleToggle = () => {
    setIsOpen(prev => {
      const next = !prev;
      if (next) {
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      return next;
    });
  };

  const handleSelect = (id: string) => {
    onSelect(id);
    setIsOpen(false);
    setSearchTerm('');
  };

  const ringColorClass = accentColor === 'amber' ? 'focus:ring-amber-500 border-amber-500' : 'focus:ring-blue-500 border-blue-500';
  const badgeColorClass =
    accentColor === 'amber'
      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border-amber-300'
      : 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 border-blue-300';

  return (
    <div ref={containerRef} className="relative w-full space-y-1">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
        <span className="text-[10px] text-slate-400 font-medium">{households.length} hộ trên địa bàn</span>
      </div>

      {/* Trigger / Display Box */}
      <div
        onClick={handleToggle}
        className={`w-full p-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs cursor-pointer transition flex items-center justify-between gap-2 shadow-xs ${
          isOpen
            ? `${ringColorClass} ring-2 ring-opacity-50`
            : 'border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
        }`}
      >
        {selectedHousehold ? (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-[11px] border shrink-0 ${badgeColorClass}`}>
              {selectedHousehold.code}
            </span>
            <div className="min-w-0 flex-1 truncate">
              <span className="font-bold text-slate-900 dark:text-white truncate">
                Số {selectedHousehold.houseNumber} {selectedHousehold.street}
              </span>
              <span className="text-slate-500 dark:text-slate-400 text-[11px] ml-1.5 truncate">
                — Chủ hộ: <strong className="text-slate-700 dark:text-slate-200">{selectedHousehold.ownerName}</strong>
                {selectedHousehold.hamlet ? ` (${selectedHousehold.hamlet})` : ''}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 italic">
            <Home className="w-4 h-4 shrink-0" />
            <span>Chưa chọn hộ dân tiếp nhận — Nhấp để tìm kiếm và chọn</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
          <span className="text-[10px] font-medium hidden sm:inline text-blue-600 dark:text-blue-400">{isOpen ? 'Đóng' : 'Tìm kiếm'}</span>
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-600 dark:text-blue-400' : ''}`}
          />
        </div>
      </div>

      {/* Hidden input for HTML form validation */}
      <input type="text" value={selectedId} onChange={() => {}} required={required} className="sr-only" tabIndex={-1} />

      {/* Searchable Dropdown Popup Panel */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-80">
          {/* Search Input Bar */}
          <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Tìm mã hộ (HK-BL-...), tên chủ hộ, số nhà, đường, ấp..."
                className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 px-1">
              <span>
                Tìm thấy <strong className="text-blue-600 dark:text-blue-400 font-bold">{filteredHouseholds.length}</strong> hộ dân phù hợp
              </span>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Hiển thị tất cả
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-slate-800/60 max-h-56">
            {filteredHouseholds.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500 space-y-1">
                <p className="font-semibold text-slate-600 dark:text-slate-300">Không tìm thấy hộ dân nào khớp với "{searchTerm}"</p>
                <p className="text-[11px]">Thử tìm theo số nhà, tên đường, tên chủ hộ hoặc mã hộ khác.</p>
              </div>
            ) : (
              filteredHouseholds.map(h => {
                const isSelected = h.id === selectedId;
                return (
                  <div
                    key={h.id}
                    onClick={() => handleSelect(h.id)}
                    className={`p-2.5 px-3 flex items-center justify-between gap-2.5 cursor-pointer transition text-xs ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-100 font-semibold'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border shrink-0 ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {h.code}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold truncate text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span className="truncate">
                            Số {h.houseNumber} {h.street}
                          </span>
                          {h.type === 'business' && (
                            <span className="text-[9px] px-1 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-normal shrink-0">
                              Kinh doanh
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-2 mt-0.5">
                          <span className="truncate flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400 shrink-0" />
                            {h.ownerName}
                          </span>
                          <span>•</span>
                          <span className="truncate flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            {h.hamlet || 'Xã Bà Điểm'}
                          </span>
                          {h.residentsCount !== undefined && (
                            <>
                              <span>•</span>
                              <span className="font-mono">{h.residentsCount} NK</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3" />
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
