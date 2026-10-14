import { DiscardChangesDialog } from './DiscardChangesDialog';
import { useDialogFocus } from '../utils/useDialogFocus';
import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, MapPin, Building, Home, Store, ShieldAlert } from 'lucide-react';
import { HouseholdCreateInput, ResidenceType } from '../types';
import { SearchableSelect } from './SearchableSelect';
import { fetchRbacAreas } from '../services/rbacApiService';
import { isCoordinateInBaDiem3dBoundary } from '../utils/household3dEligibility';
import { useUnsavedPageGuard } from '../utils/useUnsavedPageGuard';

const BADIEM_STREETS = [
  'Đường Phan Văn Hớn',
  'Đường Nguyễn Ảnh Thủ',
  'Đường Bà Điểm 4',
  'Đường Bà Điểm 5',
  'Đường Bà Điểm 6',
  'Đường Bà Điểm 7',
  'Đường Bà Điểm 8',
  'Đường Bà Điểm 12',
  'Đường Hưng Lân',
  'Đường Đông Lân - Hưng Lân',
  'Đường Quốc Lộ 1A',
  'Đường Quốc Lộ 22',
  'Đường Song Hành QL 22',
  'Đường Dương Công Khi',
  'Đường Nguyễn Thị Huê',
  'Đường Nguyễn Thị Thử',
];

interface AddHouseholdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddHousehold: (newHousehold: HouseholdCreateInput) => Promise<boolean>;
  initialCoordinates?: [number, number] | null;
}

export const AddHouseholdModal: React.FC<AddHouseholdModalProps> = ({ isOpen, onClose, onAddHousehold, initialCoordinates }) => {
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [coordinateError, setCoordinateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const locationRequestRef = useRef(0);
  useEffect(() => {
    setLocating(false);
    return () => {
      locationRequestRef.current += 1;
    };
  }, [isOpen]);
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setCoordinateError('Thiết bị không hỗ trợ vị trí. Nhập tọa độ thực tế hoặc mở form từ điểm chọn trên bản đồ 3D.');
      return;
    }
    const request = ++locationRequestRef.current;
    setLocating(true);
    setCoordinateError(null);
    navigator.geolocation.getCurrentPosition(
      position => {
        if (request !== locationRequestRef.current) return;
        setLatitude(String(position.coords.latitude));
        setLongitude(String(position.coords.longitude));
        setLocating(false);
      },
      () => {
        if (request !== locationRequestRef.current) return;
        setCoordinateError('Không lấy được vị trí. Kiểm tra quyền vị trí hoặc nhập tọa độ thực tế.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };
  useEffect(() => {
    if (!isOpen) return;
    setLatitude(initialCoordinates ? String(initialCoordinates[0]) : '');
    setLongitude(initialCoordinates ? String(initialCoordinates[1]) : '');
    setCoordinateError(null);
  }, [isOpen, initialCoordinates]);
  const [areas, setAreas] = useState<{ id: number; name: string; hamletName: string }[]>([]);
  const [areaError, setAreaError] = useState('');
  const loadAreas = async () => {
    setAreaError('');
    try {
      setAreas(await fetchRbacAreas());
    } catch {
      setAreaError('Không tải được danh sách địa bàn. Vui lòng thử lại trước khi chọn ấp.');
    }
  };
  useEffect(() => {
    if (isOpen) void loadAreas();
  }, [isOpen]);
  const [houseNumber, setHouseNumber] = useState('');
  const [street, setStreet] = useState('');
  const [hamlet, setHamlet] = useState<string>('');
  const [hamletId, setHamletId] = useState<number | undefined>(undefined);
  const [neighborhoodGroup, setNeighborhoodGroup] = useState('');
  const [alley, setAlley] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [type, setType] = useState<'household' | 'business' | 'special_monitoring'>('household');
  const [residenceType, setResidenceType] = useState<ResidenceType>('Thường trú');
  const [businessName, setBusinessName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [residentsCount, setResidentsCount] = useState<number | ''>('');
  const [maleCount, setMaleCount] = useState<number | ''>('');
  const [femaleCount, setFemaleCount] = useState<number | ''>('');
  const [above18Count, setAbove18Count] = useState<number | ''>('');
  const [under18Count, setUnder18Count] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  const [showDiscard, setShowDiscard] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const countMismatch =
    residentsCount !== '' &&
    ((maleCount !== '' && femaleCount !== '' && maleCount + femaleCount !== residentsCount) ||
      (above18Count !== '' && under18Count !== '' && above18Count + under18Count !== residentsCount));
  const dirty = Boolean(
    houseNumber ||
    street ||
    hamlet ||
    neighborhoodGroup ||
    alley ||
    ownerName ||
    ownerPhone ||
    businessName ||
    businessCategory ||
    notes ||
    residentsCount !== '' ||
    maleCount !== '' ||
    femaleCount !== '' ||
    above18Count !== '' ||
    under18Count !== '' ||
    type !== 'household' ||
    residenceType !== 'Thường trú' ||
    latitude !== (initialCoordinates ? String(initialCoordinates[0]) : '') ||
    longitude !== (initialCoordinates ? String(initialCoordinates[1]) : ''),
  );
  const resetForm = () => {
    setHouseNumber('');
    setStreet('');
    setHamlet('');
    setHamletId(undefined);
    setNeighborhoodGroup('');
    setAlley('');
    setOwnerName('');
    setOwnerPhone('');
    setBusinessName('');
    setBusinessCategory('');
    setNotes('');
    setResidentsCount('');
    setMaleCount('');
    setFemaleCount('');
    setAbove18Count('');
    setUnder18Count('');
    setType('household');
    setResidenceType('Thường trú');
    setSubmitError('');
    setCoordinateError(null);
  };
  const requestClose = () => {
    if (isSubmitting) return;
    if (dirty) setShowDiscard(true);
    else onClose();
  };
  useUnsavedPageGuard(isOpen && dirty);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || locating) return;
    locationRequestRef.current += 1;
    setSubmitError('');
    if (!houseNumber.trim() || !ownerName.trim() || !street.trim() || !hamlet.trim()) {
      setSubmitError('Nhập số nhà, chủ hộ, tuyến đường và ấp trước khi lưu.');
      return;
    }
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!latitude.trim() || !longitude.trim() || !isCoordinateInBaDiem3dBoundary(lat, lng)) {
      setCoordinateError('Nhập tọa độ hợp lệ trong ranh giới Bà Điểm hoặc chọn điểm trên bản đồ 3D.');
      document.getElementById('add-household-latitude')?.focus();
      return;
    }

    const newId = `HH-${Date.now().toString().slice(-4)}`;
    const newCode = `HK-BD-${Date.now().toString().slice(-4)}`;

    const newHousehold: HouseholdCreateInput = {
      id: newId,
      code: newCode,
      houseNumber: houseNumber.trim(),
      street,
      hamlet,
      hamletId,
      neighborhoodGroup: neighborhoodGroup.trim(),
      alley: alley.trim(),
      ownerName: ownerName.trim(),
      ownerPhone: ownerPhone.trim(),
      type,
      businessName: type === 'business' ? businessName.trim() : undefined,
      businessCategory: type === 'business' ? businessCategory.trim() : undefined,
      status: type === 'special_monitoring' ? 'alert' : type === 'business' ? 'business' : 'normal',
      residenceType,
      residentsCount: residentsCount === '' ? undefined : Number(residentsCount),
      maleCount: maleCount === '' ? undefined : Number(maleCount),
      femaleCount: femaleCount === '' ? undefined : Number(femaleCount),
      above18Count: above18Count === '' ? undefined : Number(above18Count),
      under18Count: under18Count === '' ? undefined : Number(under18Count),
      notes: notes.trim(),
      lastCheckedDate: new Date().toLocaleDateString('vi-VN'),
      officerInCharge: 'Cán bộ CSKV Xã Bà Điểm',
      coordinates: [lat, lng],
      coordinatesEstimated: false,
      gridPosition: { row: 4, col: 4 },
    };

    setIsSubmitting(true);
    try {
      if (await onAddHousehold(newHousehold)) {
        resetForm();
        onClose();
      } else setSubmitError('Chưa thể lưu hộ dân. Kiểm tra thông tin và thử lại.');
    } catch {
      setSubmitError('Không thể lưu hộ dân. Nội dung nhập được giữ lại để thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const dialogRef = useDialogFocus(isOpen, requestClose, isSubmitting);
  if (!isOpen) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Thêm hộ dân hoặc cơ sở"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
    >
      <div className="bg-white w-full max-w-xl rounded-xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[92vh] flex flex-col">
        <div className="p-4 sm:p-5 bg-blue-600 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-blue-700 flex items-center justify-center font-bold text-white shrink-0">
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold">Thêm hộ dân / Cơ sở mới</h3>
              <p className="text-[11px] sm:text-xs text-blue-100">Bổ sung vị trí quản lý thực địa trên địa bàn</p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            aria-label="Đóng biểu mẫu"
            onClick={requestClose}
            className="p-1.5 text-blue-100 hover:text-white rounded-lg hover:bg-blue-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <DiscardChangesDialog
          open={showDiscard}
          onContinue={() => setShowDiscard(false)}
          onDiscard={() => {
            setShowDiscard(false);
            resetForm();
            onClose();
          }}
        />
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 text-xs overflow-y-auto flex-1">
          <fieldset disabled={isSubmitting} className="contents">
            <p className="text-sm text-slate-600">Các trường có dấu * là bắt buộc. Thông tin chưa xác định có thể để trống.</p>
            {submitError && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {submitError}
              </p>
            )}
            {areaError && (
              <div role="alert" className="rounded-lg border border-amber-300 p-3 text-sm">
                <p>{areaError}</p>
                <button type="button" onClick={() => void loadAreas()} className="rounded-lg border px-3 py-2">
                  Tải lại địa bàn
                </button>
              </div>
            )}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Phân loại quản lý</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setType('household')}
                  aria-pressed={type === 'household'}
                  className={`py-2 px-3 rounded-xl font-bold border transition-colors ${
                    type === 'household' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  <Home aria-hidden="true" className="inline-block w-4 h-4 mr-1" /> Hộ gia đình
                </button>
                <button
                  type="button"
                  onClick={() => setType('business')}
                  aria-pressed={type === 'business'}
                  className={`py-2 px-3 rounded-xl font-bold border transition-colors ${
                    type === 'business' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  <Store aria-hidden="true" className="inline-block w-4 h-4 mr-1" /> Cơ sở KD
                </button>
                <button
                  type="button"
                  onClick={() => setType('special_monitoring')}
                  aria-pressed={type === 'special_monitoring'}
                  className={`py-2 px-3 rounded-xl font-bold border transition-colors ${
                    type === 'special_monitoring' ? 'bg-rose-600 text-white border-rose-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  <ShieldAlert aria-hidden="true" className="inline-block w-4 h-4 mr-1" /> Đối tượng chú ý
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1" htmlFor="add-household-field-1">
                  Số nhà *
                </label>
                <input
                  id="add-household-field-1"
                  type="text"
                  required
                  placeholder="VD: 156"
                  value={houseNumber}
                  onChange={e => setHouseNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 font-bold"
                />
              </div>
              <div>
                <SearchableSelect
                  label="Tuyến đường"
                  value={street}
                  onChange={val => setStreet(val)}
                  options={BADIEM_STREETS}
                  placeholder="Chọn hoặc tìm tuyến đường..."
                  searchPlaceholder="Tìm kiếm tuyến đường (VD: Phan Văn Hớn, QL 22...)"
                  icon={<MapPin className="w-3.5 h-3.5 text-blue-500" />}
                  required
                  allowCustom
                />
              </div>
              <div>
                <SearchableSelect
                  label="Ấp (51 ấp sau sáp nhập) *"
                  value={hamlet}
                  onChange={val => {
                    setHamlet(val);
                    const matched = areas.find(h => h.hamletName === val || h.name === val);
                    setHamletId(matched?.id);
                  }}
                  options={[...new Set(areas.map(h => h.hamletName))]}
                  placeholder="Chọn ấp trực thuộc Xã Bà Điểm..."
                  searchPlaceholder="Tìm kiếm 51 ấp (VD: Bắc Lân, Xuân Thới Thượng 1...)"
                  icon={<Building className="w-3.5 h-3.5 text-blue-500" />}
                  required
                  allowCustom={false}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1" htmlFor="add-household-field-2">
                  Tổ dân phố
                </label>
                <select
                  id="add-household-field-2"
                  value={neighborhoodGroup}
                  onChange={e => setNeighborhoodGroup(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 font-semibold text-slate-800"
                >
                  <option value="">Chọn tổ dân phố nếu đã xác định</option>
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
                <label className="block font-bold text-slate-700 mb-1" htmlFor="add-household-field-3">
                  Hẻm / Vị trí nhà
                </label>
                <input
                  id="add-household-field-3"
                  type="text"
                  placeholder="VD: Mặt tiền đường, Hẻm 418..."
                  value={alley}
                  onChange={e => setAlley(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1" htmlFor="add-household-field-4">
                  Khu vực CSKV phụ trách
                </label>
                <select
                  id="add-household-field-4"
                  disabled={!hamlet}
                  value={hamletId ?? ''}
                  onChange={e => {
                    const id = e.target.value ? Number(e.target.value) : undefined;
                    setHamletId(id);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 text-slate-800"
                >
                  <option value="">Chọn khu vực thuộc ấp đã chọn</option>
                  {areas
                    .filter(a => a.hamletName === hamlet)
                    .map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.hamletName})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1" htmlFor="add-household-field-5">
                  {type === 'business' ? 'Người đại diện cơ sở *' : 'Chủ hộ / Người đại diện *'}
                </label>
                <input
                  id="add-household-field-5"
                  type="text"
                  required
                  placeholder="Họ và tên..."
                  value={ownerName}
                  onChange={e => setOwnerName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1" htmlFor="add-household-field-6">
                  Số điện thoại liên lạc
                </label>
                <input
                  id="add-household-field-6"
                  type="tel"
                  placeholder="09xx..."
                  value={ownerPhone}
                  onChange={e => setOwnerPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
              <div className="mb-2 flex items-center gap-1 font-bold text-blue-800">
                <MapPin className="h-4 w-4" />
                Tọa độ vị trí hộ dân *
              </div>
              {!initialCoordinates && (
                <button
                  type="button"
                  disabled={locating}
                  onClick={getCurrentLocation}
                  className="mb-3 rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold"
                >
                  {locating ? 'Đang lấy vị trí…' : 'Lấy vị trí hiện tại'}
                </button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <label className="text-slate-700">
                  Vĩ độ
                  <input
                    id="add-household-latitude"
                    aria-invalid={Boolean(coordinateError)}
                    aria-describedby="add-household-coordinate-help"
                    type="number"
                    step="any"
                    required
                    value={latitude}
                    readOnly={!!initialCoordinates}
                    onChange={e => {
                      setLatitude(e.target.value);
                      setCoordinateError(null);
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 font-mono text-xs"
                  />
                </label>
                <label className="text-slate-700">
                  Kinh độ
                  <input
                    aria-invalid={Boolean(coordinateError)}
                    aria-describedby="add-household-coordinate-help"
                    type="number"
                    step="any"
                    required
                    value={longitude}
                    readOnly={!!initialCoordinates}
                    onChange={e => {
                      setLongitude(e.target.value);
                      setCoordinateError(null);
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 font-mono text-xs"
                  />
                </label>
              </div>
              <p id="add-household-coordinate-help" className="mt-1 text-xs text-slate-500">
                {initialCoordinates
                  ? 'Đã lấy trực tiếp từ điểm chọn trên bản đồ 3D.'
                  : 'Kiểm tra vị trí thiết bị có trùng vị trí hộ dân trước khi lưu. Có thể nhập GPS hoặc mở form từ điểm chọn trên bản đồ 3D.'}
              </p>
              {coordinateError && (
                <p role="alert" className="mt-1 text-[10px] text-red-600">
                  {coordinateError}
                </p>
              )}
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
                    <label className="block font-bold text-blue-900 mb-1" htmlFor="add-household-field-7">
                      Tên cơ sở kinh doanh
                    </label>
                    <input
                      id="add-household-field-7"
                      type="text"
                      placeholder="VD: Cà phê Hoàng Kim"
                      value={businessName}
                      onChange={e => setBusinessName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-blue-900 mb-1" htmlFor="add-household-field-8">
                      Ngành nghề
                    </label>
                    <input
                      id="add-household-field-8"
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
              <p className="text-xs text-slate-600">Để trống nếu chưa xác định; nhập 0 khi đã xác nhận không có người cư trú.</p>
              {countMismatch && (
                <p role="status" className="text-sm text-amber-700">
                  Các nhóm nhân khẩu chưa khớp tổng. Kiểm tra lại trước khi lưu.
                </p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                <div>
                  <label className="text-xs text-slate-600 font-bold block" htmlFor="add-household-field-9">
                    Tổng
                  </label>
                  <input
                    id="add-household-field-9"
                    type="number"
                    min="0"
                    value={residentsCount}
                    onChange={e => setResidentsCount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full text-center py-1 bg-white border border-slate-300 rounded-lg font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 font-bold block" htmlFor="add-household-field-10">
                    Nam
                  </label>
                  <input
                    id="add-household-field-10"
                    type="number"
                    min="0"
                    value={maleCount}
                    onChange={e => setMaleCount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full text-center py-1 bg-white border border-slate-300 rounded-lg font-bold text-blue-600"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 font-bold block" htmlFor="add-household-field-11">
                    Nữ
                  </label>
                  <input
                    id="add-household-field-11"
                    type="number"
                    min="0"
                    value={femaleCount}
                    onChange={e => setFemaleCount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full text-center py-1 bg-white border border-slate-300 rounded-lg font-bold text-pink-600"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 font-bold block" htmlFor="add-household-field-12">
                    ≥ 18t
                  </label>
                  <input
                    id="add-household-field-12"
                    type="number"
                    min="0"
                    value={above18Count}
                    onChange={e => setAbove18Count(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full text-center py-1 bg-white border border-slate-300 rounded-lg font-bold text-emerald-600"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 font-bold block" htmlFor="add-household-field-13">
                    &lt; 18t
                  </label>
                  <input
                    id="add-household-field-13"
                    type="number"
                    min="0"
                    value={under18Count}
                    onChange={e => setUnder18Count(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full text-center py-1 bg-white border border-slate-300 rounded-lg font-bold text-amber-600"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1" htmlFor="add-household-field-14">
                Ghi chú cán bộ CSKV:
              </label>
              <textarea
                id="add-household-field-14"
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 text-xs"
              />
            </div>

            <div className="sticky -bottom-4 sm:-bottom-6 bg-white dark:bg-slate-900 py-3 flex items-center justify-end gap-2 border-t border-slate-200 z-10">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={requestClose}
                className="flex-1 sm:flex-initial px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors min-h-[40px]"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={isSubmitting || locating}
                className="flex-1 sm:flex-initial px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-xs min-h-[40px]"
              >
                {isSubmitting ? 'Đang lưu...' : 'Lưu hồ sơ'}
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
};
