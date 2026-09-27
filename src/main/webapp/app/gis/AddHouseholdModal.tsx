import React, { useState } from 'react';
import { X, Plus, Building, Store, AlertOctagon, CheckCircle2 } from 'lucide-react';
import { HouseholdFacility, ResidenceType } from '../types';

interface AddHouseholdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddHousehold: (newHousehold: HouseholdFacility) => void;
}

export const AddHouseholdModal: React.FC<AddHouseholdModalProps> = ({ isOpen, onClose, onAddHousehold }) => {
  if (!isOpen) return null;

  const [houseNumber, setHouseNumber] = useState('');
  const [street, setStreet] = useState('Đường Phan Văn Hớn');
  const [hamlet, setHamlet] = useState<string>('Ấp Bắc Lân');
  const [neighborhoodGroup, setNeighborhoodGroup] = useState('Tổ 1');
  const [alley, setAlley] = useState('Mặt tiền đường');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('0908');
  const [type, setType] = useState<'household' | 'business' | 'special_monitoring'>('household');
  const [residenceType, setResidenceType] = useState<ResidenceType>('Thường trú');
  const [businessName, setBusinessName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [residentsCount, setResidentsCount] = useState(4);
  const [maleCount, setMaleCount] = useState(2);
  const [femaleCount, setFemaleCount] = useState(2);
  const [above18Count, setAbove18Count] = useState(3);
  const [under18Count, setUnder18Count] = useState(1);
  const [notes, setNotes] = useState('Hồ sơ quản lý nhân khẩu cư trú Xã Bà Điểm.');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!houseNumber.trim() || !ownerName.trim()) return;

    const newId = `HH-${Date.now().toString().slice(-4)}`;
    const newCode = `HK-BD-${Date.now().toString().slice(-4)}`;

    const newHousehold: HouseholdFacility = {
      id: newId,
      code: newCode,
      houseNumber: houseNumber.trim(),
      street,
      hamlet,
      neighborhoodGroup: neighborhoodGroup.trim() || 'Tổ 1',
      alley: alley.trim() || 'Mặt tiền đường',
      ownerName: ownerName.trim(),
      ownerPhone: ownerPhone.trim(),
      type,
      businessName: type === 'business' ? businessName.trim() : undefined,
      businessCategory: type === 'business' ? businessCategory.trim() : undefined,
      status: type === 'special_monitoring' ? 'alert' : type === 'business' ? 'business' : 'normal',
      residenceType,
      residentsCount: Number(residentsCount) || 1,
      maleCount: Number(maleCount) || 0,
      femaleCount: Number(femaleCount) || 0,
      above18Count: Number(above18Count) || 0,
      under18Count: Number(under18Count) || 0,
      notes: notes.trim(),
      lastCheckedDate: new Date().toLocaleDateString('vi-VN'),
      officerInCharge: 'Cán bộ CSKV Xã Bà Điểm',
      coordinates: [10.854 + (Math.random() - 0.5) * 0.008, 106.612 + (Math.random() - 0.5) * 0.008],
      gridPosition: { row: 4, col: 4 },
    };

    onAddHousehold(newHousehold);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[92vh] flex flex-col">
        <div className="p-4 sm:p-5 bg-blue-600 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-blue-700 flex items-center justify-center font-bold text-white shrink-0">
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold">Thêm hộ dân / Cơ sở mới</h3>
              <p className="text-[11px] sm:text-xs text-blue-100">Bổ sung vị trí quản lý thực địa tại Ấp 1 hoặc Ấp 2, P. An Lạc</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-blue-100 hover:text-white rounded-lg hover:bg-blue-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 text-xs overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Số nhà *</label>
              <input
                type="text"
                required
                placeholder="VD: 156"
                value={houseNumber}
                onChange={e => setHouseNumber(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Tuyến đường</label>
              <select
                value={street}
                onChange={e => setStreet(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 font-semibold"
              >
                <option value="Đường Phan Văn Hớn">Đường Phan Văn Hớn</option>
                <option value="Đường Nguyễn Ảnh Thủ">Đường Nguyễn Ảnh Thủ</option>
                <option value="Đường Bà Điểm 4">Đường Bà Điểm 4</option>
                <option value="Đường Bà Điểm 5">Đường Bà Điểm 5</option>
                <option value="Đường Bà Điểm 6">Đường Bà Điểm 6</option>
                <option value="Đường Bà Điểm 7">Đường Bà Điểm 7</option>
                <option value="Đường Bà Điểm 8">Đường Bà Điểm 8</option>
                <option value="Đường Bà Điểm 12">Đường Bà Điểm 12</option>
                <option value="Đường Hưng Lân">Đường Hưng Lân</option>
                <option value="Đường Quốc Lộ 1A">Đường Quốc Lộ 1A</option>
                <option value="Đường Quốc Lộ 22">Đường Quốc Lộ 22</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Khu vực ấp (Xã Bà Điểm)</label>
              <select
                value={hamlet}
                onChange={e => {
                  setHamlet(e.target.value);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 font-bold text-blue-700"
              >
                <option value="Ấp Bắc Lân">Ấp Bắc Lân</option>
                <option value="Ấp Nam Lân">Ấp Nam Lân</option>
                <option value="Ấp Tây Lân">Ấp Tây Lân</option>
                <option value="Ấp Đông Lân">Ấp Đông Lân</option>
                <option value="Ấp Hậu Lân">Ấp Hậu Lân</option>
                <option value="Ấp Tiền Lân">Ấp Tiền Lân</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Tổ dân phố</label>
              <select
                value={neighborhoodGroup}
                onChange={e => setNeighborhoodGroup(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 font-semibold text-slate-800"
              >
                <option value="Tổ 1">Tổ 1</option>
                <option value="Tổ 2">Tổ 2</option>
                <option value="Tổ 3">Tổ 3</option>
                <option value="Tổ 4">Tổ 4</option>
                <option value="Tổ 5">Tổ 5</option>
                <option value="Tổ 6">Tổ 6</option>
                <option value="Tổ 7">Tổ 7</option>
                <option value="Tổ 8">Tổ 8</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Hẻm / Vị trí nhà</label>
              <input
                type="text"
                placeholder="VD: Mặt tiền đường, Hẻm 418, Hẻm 432..."
                value={alley}
                onChange={e => setAlley(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Chủ hộ / Người đại diện *</label>
              <input
                type="text"
                required
                placeholder="Họ và tên..."
                value={ownerName}
                onChange={e => setOwnerName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Số điện thoại liên lạc</label>
              <input
                type="text"
                placeholder="09xx..."
                value={ownerPhone}
                onChange={e => setOwnerPhone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Phân loại quản lý</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setType('household')}
                className={`py-2 px-3 rounded-xl font-bold border transition-colors ${
                  type === 'household' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                🏠 Hộ gia đình
              </button>
              <button
                type="button"
                onClick={() => setType('business')}
                className={`py-2 px-3 rounded-xl font-bold border transition-colors ${
                  type === 'business' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                🏪 Cơ sở KD
              </button>
              <button
                type="button"
                onClick={() => setType('special_monitoring')}
                className={`py-2 px-3 rounded-xl font-bold border transition-colors ${
                  type === 'special_monitoring' ? 'bg-rose-600 text-white border-rose-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                🚨 Đối tượng chú ý
              </button>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Hình thức cư trú</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setResidenceType('Thường trú')}
                className={`py-2 px-2.5 rounded-xl font-bold border text-xs transition-all flex items-center justify-center gap-1.5 ${
                  residenceType === 'Thường trú'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-500/20'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${residenceType === 'Thường trú' ? 'bg-white' : 'bg-emerald-500'}`}></span>
                <span>Thường trú</span>
              </button>
              <button
                type="button"
                onClick={() => setResidenceType('Tạm trú')}
                className={`py-2 px-2.5 rounded-xl font-bold border text-xs transition-all flex items-center justify-center gap-1.5 ${
                  residenceType === 'Tạm trú'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs ring-2 ring-amber-500/20'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${residenceType === 'Tạm trú' ? 'bg-white' : 'bg-amber-500'}`}></span>
                <span>Tạm trú</span>
              </button>
              <button
                type="button"
                onClick={() => setResidenceType('Lưu trú')}
                className={`py-2 px-2.5 rounded-xl font-bold border text-xs transition-all flex items-center justify-center gap-1.5 ${
                  residenceType === 'Lưu trú'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs ring-2 ring-purple-500/20'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${residenceType === 'Lưu trú' ? 'bg-white' : 'bg-purple-500'}`}></span>
                <span>Lưu trú</span>
              </button>
            </div>
          </div>

          {type === 'business' && (
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-blue-900 mb-1">Tên cơ sở kinh doanh</label>
                  <input
                    type="text"
                    placeholder="VD: Cà phê Hoàng Kim"
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-blue-900 mb-1">Ngành nghề</label>
                  <input
                    type="text"
                    placeholder="Dịch vụ giải khát..."
                    value={businessCategory}
                    onChange={e => setBusinessCategory(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="block font-bold text-slate-700 mb-2">Số lượng nhân khẩu cư trú:</span>
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2 text-center">
              <div>
                <label className="text-[10px] text-slate-500 font-bold block">Tổng</label>
                <input
                  type="number"
                  min="1"
                  value={residentsCount}
                  onChange={e => setResidentsCount(Number(e.target.value))}
                  className="w-full text-center py-1 bg-white border border-slate-300 rounded-lg font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-bold block">Nam</label>
                <input
                  type="number"
                  min="0"
                  value={maleCount}
                  onChange={e => setMaleCount(Number(e.target.value))}
                  className="w-full text-center py-1 bg-white border border-slate-300 rounded-lg font-bold text-blue-600"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-bold block">Nữ</label>
                <input
                  type="number"
                  min="0"
                  value={femaleCount}
                  onChange={e => setFemaleCount(Number(e.target.value))}
                  className="w-full text-center py-1 bg-white border border-slate-300 rounded-lg font-bold text-pink-600"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-bold block">≥ 18t</label>
                <input
                  type="number"
                  min="0"
                  value={above18Count}
                  onChange={e => setAbove18Count(Number(e.target.value))}
                  className="w-full text-center py-1 bg-white border border-slate-300 rounded-lg font-bold text-emerald-600"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-bold block">&lt; 18t</label>
                <input
                  type="number"
                  min="0"
                  value={under18Count}
                  onChange={e => setUnder18Count(Number(e.target.value))}
                  className="w-full text-center py-1 bg-white border border-slate-300 rounded-lg font-bold text-amber-600"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Ghi chú cán bộ CSKV:</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 text-xs"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors min-h-[40px]"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="flex-1 sm:flex-initial px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-xs min-h-[40px]"
            >
              Lưu hồ sơ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
