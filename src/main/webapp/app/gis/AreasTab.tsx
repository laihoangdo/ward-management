import React, { useState, useMemo } from 'react';
import { Building2, Shield, Users, MapPin, AlertTriangle, CheckCircle2, Lock, Flame, Phone, Compass, FileText, Store } from 'lucide-react';
import { HouseholdFacility } from '../types';

interface AreasTabProps {
  households: HouseholdFacility[];
  onSelectHousehold: (household: HouseholdFacility) => void;
}

export const AreasTab: React.FC<AreasTabProps> = ({ households, onSelectHousehold }) => {
  const hamletList = useMemo(() => {
    const list = Array.from(new Set(households.map(h => h.hamlet).filter(Boolean))).sort();
    return list.length > 0 ? list : ['Ấp Bắc Lân', 'Ấp Nam Lân', 'Ấp Tây Lân', 'Ấp Đông Lân', 'Ấp Hậu Lân', 'Ấp Tiền Lân'];
  }, [households]);

  const [selectedHamlet, setSelectedHamlet] = useState<string>(() => hamletList[0] || 'Ấp Bắc Lân');

  const activeList = useMemo(() => {
    return households.filter(h => h.hamlet === (selectedHamlet || hamletList[0]));
  }, [households, selectedHamlet, hamletList]);

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Banner */}
      <div className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div id="area-eyebrow" className="text-[11px] sm:text-xs font-bold text-blue-600 tracking-wider uppercase mb-1">
            PHÂN QUYỀN ĐỊA BÀN — XÃ BÀ ĐIỂM
          </div>
          <h2 id="area-title" className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Quản lý khu vực dân cư các Ấp thuộc Xã Bà Điểm
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1">
            Tổng cộng <strong>{hamletList.length} ấp</strong> với <strong>{households.length} hộ dân & cơ sở</strong> đang được theo dõi,
            quản lý an ninh trật tự trên hệ thống.
          </p>
        </div>
      </div>

      {/* Dynamic Hamlet Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {hamletList.map((hamletName, idx) => {
          const hamletHouseholds = households.filter(h => h.hamlet === hamletName);
          const totalResidents = hamletHouseholds.reduce((acc, curr) => acc + (curr.residentsCount || 0), 0);
          const bizCount = hamletHouseholds.filter(h => h.type === 'business').length;
          const warningCount = hamletHouseholds.filter(h => h.status === 'warning' || h.status === 'alert').length;
          const isSelected = (selectedHamlet || hamletList[0]) === hamletName;

          return (
            <div
              key={hamletName}
              onClick={() => setSelectedHamlet(hamletName)}
              className={`p-4 sm:p-5 rounded-xl sm:rounded-2xl border-2 transition-all cursor-pointer ${
                isSelected
                  ? 'bg-blue-50/50 border-blue-600 shadow-md ring-2 ring-blue-500/20'
                  : 'bg-white border-slate-200 hover:border-blue-300 shadow-xs hover:shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl text-white flex items-center justify-center font-bold text-sm shadow-xs ${
                      idx % 3 === 0 ? 'bg-blue-600' : idx % 3 === 1 ? 'bg-indigo-600' : 'bg-emerald-600'
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{hamletName.toUpperCase()}</h3>
                    <div className="text-[11px] text-slate-500 font-medium">Xã Bà Điểm, Hóc Môn</div>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {isSelected ? 'Đang chọn' : 'Xem ấp'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 py-2.5 border-y border-slate-200/80 my-2.5 text-center text-xs">
                <div className="p-1.5 rounded-lg bg-white border border-slate-200/60">
                  <div className="text-[10px] text-slate-500 font-medium">Hộ & CS</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">{hamletHouseholds.length}</div>
                </div>
                <div className="p-1.5 rounded-lg bg-white border border-slate-200/60">
                  <div className="text-[10px] text-slate-500 font-medium">Nhân khẩu</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">{totalResidents}</div>
                </div>
                <div className="p-1.5 rounded-lg bg-white border border-slate-200/60">
                  <div className="text-[10px] text-slate-500 font-medium">Cơ sở KD</div>
                  <div className="text-sm font-bold text-blue-600 mt-0.5">{bizCount}</div>
                </div>
              </div>

              <div className="space-y-1 text-[11px] text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-orange-500" />
                    <span>Tổ liên gia PCCC:</span>
                  </span>
                  <span className="font-semibold text-slate-800">Tổ 1 - {hamletName}</span>
                </div>
                {warningCount > 0 ? (
                  <div className="flex items-center justify-between text-amber-700 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      <span>Cần kiểm tra:</span>
                    </span>
                    <span>{warningCount} vị trí</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-emerald-700 font-medium">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Tình trạng:</span>
                    </span>
                    <span>An toàn ANTT</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* List of Houses in Selected Hamlet */}
      <div className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" />
            <span>
              Danh sách {activeList.length} hộ dân & cơ sở tại {selectedHamlet || hamletList[0]}
            </span>
          </h3>
          <span className="text-[11px] sm:text-xs text-slate-500 hidden sm:inline">Click vào ô để mở chi tiết hoặc chỉnh sửa / xóa</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {activeList.map(h => (
            <div
              key={h.id}
              onClick={() => onSelectHousehold(h)}
              className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span className="group-hover:text-blue-700">
                  Số {h.houseNumber} {h.street}
                </span>
                <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{h.code}</span>
              </div>
              <div className="text-xs text-slate-600 mt-1 truncate">{h.businessName ? `🏪 ${h.businessName}` : `👤 ${h.ownerName}`}</div>
              <div className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                <span>{h.residentsCount} nhân khẩu</span>
                <span className="font-mono">{h.ownerPhone}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
