import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  MapPin,
  Users,
  Phone,
  Building,
  Store,
  AlertOctagon,
  AlertTriangle,
  Calendar,
  Edit3,
  Save,
  CheckCircle2,
  FileText,
  UserCheck,
  Camera,
  Trash2,
  ZoomIn,
  Image as ImageIcon,
  Clock,
  ShieldCheck,
  Tag,
  ScanLine,
  Lock,
  Eye,
  EyeOff,
  RotateCcw,
} from 'lucide-react';
import { HouseholdFacility, InspectionPhoto, AppUser } from './types';
import { getHouseholdResidenceType, RESIDENCE_TYPE_CONFIG } from './utils/residenceUtils';
import { getEffectiveResidentsList } from './utils/residentRosterUtils';
import { InspectionCameraModal } from './InspectionCameraModal';
import { OcrScanModal } from './OcrScanModal';
import { deleteInspectionPhotoFromHousehold } from './services/firestoreService';
import { decryptCccd, maskCccd, isEncryptedAes } from './utils/cryptoUtils';

const BADIEM_HAMLETS = ['Ấp Bắc Lân', 'Ấp Nam Lân', 'Ấp Tây Lân', 'Ấp Đông Lân', 'Ấp Hậu Lân', 'Ấp Tiền Lân'];

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
];

interface HouseholdDetailModalProps {
  household: HouseholdFacility | null;
  currentUser?: AppUser | null;
  onClose: () => void;
  onUpdateNotes: (id: string, notes: string) => void;
  onPhotoAdded?: (photo: InspectionPhoto) => void;
  onHouseholdUpdated?: (updatedHousehold: HouseholdFacility) => void;
  onDeleteHousehold?: (id: string) => void;
  onShowToast?: (msg: string) => void;
}

export const HouseholdDetailModal: React.FC<HouseholdDetailModalProps> = ({
  household,
  currentUser,
  onClose,
  onUpdateNotes,
  onPhotoAdded,
  onHouseholdUpdated,
  onDeleteHousehold,
  onShowToast,
}) => {
  if (!household) return null;

  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState(household.notes || '');
  const [savedAlert, setSavedAlert] = useState<string | null>(null);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [selectedPhotoForView, setSelectedPhotoForView] = useState<InspectionPhoto | null>(null);
  const [isDeletingPhotoId, setIsDeletingPhotoId] = useState<string | null>(null);

  const handleTriggerCamera = () => {
    if (currentUser?.role === 'officer' && currentUser?.subAdminPermissions?.canUpdateInspection === false) {
      const msg = '⚠️ Thẩm quyền bị khóa: Bạn chưa được phân quyền ghi nhận kết quả kiểm tra thực địa.';
      if (onShowToast) onShowToast(msg);
      else alert(msg);
      return;
    }
    setIsCameraModalOpen(true);
  };

  const handleTriggerEditNotes = () => {
    if (currentUser?.role === 'officer' && currentUser?.subAdminPermissions?.canUpdateInspection === false) {
      const msg = '⚠️ Thẩm quyền bị khóa: Bạn chưa được phân quyền ghi nhận kết quả kiểm tra thực địa.';
      if (onShowToast) onShowToast(msg);
      else alert(msg);
      return;
    }
    setIsEditingNotes(true);
  };

  const handleTriggerOcr = () => {
    if (currentUser?.role === 'officer' && currentUser?.subAdminPermissions?.canScanOcr === false) {
      const msg = '⚠️ Thẩm quyền bị khóa: Bạn chưa được phân quyền quét OCR Căn cước công dân.';
      if (onShowToast) onShowToast(msg);
      else alert(msg);
      return;
    }
    setIsOcrModalOpen(true);
  };
  const [decryptedCccds, setDecryptedCccds] = useState<Record<string, string>>({});
  const [showCccdMap, setShowCccdMap] = useState<Record<string, boolean>>({});
  const [isDecryptingId, setIsDecryptingId] = useState<string | null>(null);

  // Edit Household Information State
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editForm, setEditForm] = useState({
    ownerName: household.ownerName || '',
    ownerPhone: household.ownerPhone || '',
    houseNumber: household.houseNumber || '',
    street: household.street || 'Đường Phan Văn Hớn',
    hamlet: household.hamlet || 'Ấp Bắc Lân',
    neighborhoodGroup: household.neighborhoodGroup || 'Tổ 1',
    alley: household.alley || 'Mặt tiền đường',
    type: household.type || 'household',
    businessName: household.businessName || '',
    businessCategory: household.businessCategory || '',
    status: household.status || 'normal',
    warningMessage: household.warningMessage || '',
    residentsCount: household.residentsCount || 1,
    maleCount: household.maleCount || 1,
    femaleCount: household.femaleCount || 0,
  });

  useEffect(() => {
    if (household) {
      setNotesText(household.notes || '');
      setEditForm({
        ownerName: household.ownerName || '',
        ownerPhone: household.ownerPhone || '',
        houseNumber: household.houseNumber || '',
        street: household.street || 'Đường Phan Văn Hớn',
        hamlet: household.hamlet || 'Ấp Bắc Lân',
        neighborhoodGroup: household.neighborhoodGroup || 'Tổ 1',
        alley: household.alley || 'Mặt tiền đường',
        type: household.type || 'household',
        businessName: household.businessName || '',
        businessCategory: household.businessCategory || '',
        status: household.status || 'normal',
        warningMessage: household.warningMessage || '',
        residentsCount: household.residentsCount || 1,
        maleCount: household.maleCount || 1,
        femaleCount: household.femaleCount || 0,
      });
      setIsEditingInfo(false);
      setIsEditingNotes(false);
    }
  }, [household]);

  const toggleDecryptCccd = async (residentId: string, rawEncryptedVal?: string) => {
    if (showCccdMap[residentId]) {
      setShowCccdMap(prev => ({ ...prev, [residentId]: false }));
      return;
    }

    if (decryptedCccds[residentId]) {
      setShowCccdMap(prev => ({ ...prev, [residentId]: true }));
      return;
    }

    if (!rawEncryptedVal) return;

    setIsDecryptingId(residentId);
    try {
      const decrypted = await decryptCccd(rawEncryptedVal);
      setDecryptedCccds(prev => ({ ...prev, [residentId]: decrypted }));
      setShowCccdMap(prev => ({ ...prev, [residentId]: true }));
    } catch {
      setSavedAlert('Không thể giải mã CCCD!');
    } finally {
      setIsDecryptingId(null);
    }
  };

  const handleHouseholdOcrUpdated = (updated: HouseholdFacility) => {
    setSavedAlert('Đã cập nhật dữ liệu hồ sơ từ ảnh quét OCR thành công!');
    setTimeout(() => setSavedAlert(null), 3000);
    if (onHouseholdUpdated) {
      onHouseholdUpdated(updated);
    }
  };

  const handleSaveNotes = () => {
    onUpdateNotes(household.id, notesText);
    setIsEditingNotes(false);
    setSavedAlert('Đã lưu ghi chú kiểm tra thực địa vào database thành công!');
    setTimeout(() => setSavedAlert(null), 2500);
  };

  const handleSaveInfo = () => {
    if (!editForm.ownerName.trim() || !editForm.houseNumber.trim()) {
      alert('Vui lòng nhập đầy đủ tên chủ hộ và số nhà!');
      return;
    }

    const updatedResidentsList = (household.residentsList || []).map(r => {
      if (r.relationship === 'Chủ hộ') {
        return { ...r, fullName: editForm.ownerName.trim(), phone: editForm.ownerPhone.trim() };
      }
      return r;
    });

    const updated: HouseholdFacility = {
      ...household,
      ownerName: editForm.ownerName.trim(),
      ownerPhone: editForm.ownerPhone.trim(),
      houseNumber: editForm.houseNumber.trim(),
      street: editForm.street,
      hamlet: editForm.hamlet,
      neighborhoodGroup: editForm.neighborhoodGroup,
      alley: editForm.alley,
      type: editForm.type as any,
      businessName: editForm.type === 'business' ? editForm.businessName.trim() : undefined,
      businessCategory: editForm.type === 'business' ? editForm.businessCategory.trim() : undefined,
      status: editForm.status as any,
      warningMessage: editForm.warningMessage.trim() || undefined,
      residentsCount: Number(editForm.residentsCount) || 1,
      maleCount: Number(editForm.maleCount) || 0,
      femaleCount: Number(editForm.femaleCount) || 0,
      residentsList: updatedResidentsList,
    };

    if (onHouseholdUpdated) {
      onHouseholdUpdated(updated);
    }
    setIsEditingInfo(false);
    setSavedAlert('Đã cập nhật thông tin hộ dân vào database PostgreSQL thành công!');
    setTimeout(() => setSavedAlert(null), 3000);
  };

  const handleDeleteHouseholdClick = () => {
    if (
      window.confirm(
        `Bạn có chắc chắn muốn xóa vĩnh viễn hồ sơ hộ Số ${household.houseNumber} đường ${household.street} (${household.ownerName}) khỏi cơ sở dữ liệu PostgreSQL không?`,
      )
    ) {
      if (onDeleteHousehold) {
        onDeleteHousehold(household.id);
        onClose();
      }
    }
  };

  const handlePhotoSaved = (newPhoto: InspectionPhoto) => {
    setSavedAlert('Đã lưu ảnh hiện trạng thành công!');
    setTimeout(() => setSavedAlert(null), 3000);
    if (onPhotoAdded) {
      onPhotoAdded(newPhoto);
    }
  };

  const handleDeletePhoto = async (photoId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Bạn có chắc chắn muốn xóa ảnh kiểm tra này khỏi hồ sơ không?')) {
      return;
    }

    try {
      setIsDeletingPhotoId(photoId);
      await deleteInspectionPhotoFromHousehold(household.id, photoId, household.inspectionPhotos || []);
      if (onHouseholdUpdated) {
        const remaining = (household.inspectionPhotos || []).filter(p => p.id !== photoId);
        onHouseholdUpdated({ ...household, inspectionPhotos: remaining });
      }
      setSavedAlert('Đã xóa ảnh kiểm tra khỏi hồ sơ.');
      setTimeout(() => setSavedAlert(null), 2500);
    } catch (err) {
      console.error('Lỗi khi xóa ảnh:', err);
      alert('Không thể xóa ảnh. Vui lòng thử lại.');
    } finally {
      setIsDeletingPhotoId(null);
    }
  };

  const photos = household.inspectionPhotos || [];
  const effectiveResidents = useMemo(() => getEffectiveResidentsList(household), [household]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-md shrink-0">
              {household.type === 'business' ? (
                <Store className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : household.type === 'special_monitoring' ? (
                <AlertOctagon className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <Building className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="text-[10px] sm:text-xs font-mono font-bold text-blue-400 bg-blue-950 px-2 py-0.5 rounded border border-blue-800">
                  {household.code}
                </span>
                <span className="text-[11px] sm:text-xs text-slate-300 font-semibold">
                  {household.hamlet} • {household.neighborhoodGroup || 'Tổ 1'} • Xã Bà Điểm, Hóc Môn
                </span>
                {household.alley && (
                  <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full font-bold bg-purple-900/60 text-purple-200 border border-purple-700">
                    {household.alley}
                  </span>
                )}
                {(() => {
                  const resType = getHouseholdResidenceType(household);
                  const config = RESIDENCE_TYPE_CONFIG[resType];
                  return (
                    <span
                      className={`text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1 ${config.badgeBg} ${config.badgeText} border ${config.badgeBorder}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${config.dotBg}`}></span>
                      {resType}
                    </span>
                  );
                })()}
              </div>
              <h3 className="text-sm sm:text-lg font-bold text-white mt-0.5 leading-snug">
                {household.businessName
                  ? `${household.businessName} (Số ${household.houseNumber})`
                  : `Số ${household.houseNumber} ${household.street}`}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              id="btn-open-ocr-header"
              onClick={() => setIsOcrModalOpen(true)}
              className="px-2.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-lg text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              title="Quét OCR CCCD"
            >
              <ScanLine className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Quét OCR</span>
            </button>

            <button
              id="btn-open-camera-header"
              onClick={() => setIsCameraModalOpen(true)}
              className="px-2.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold rounded-lg text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              title="Bật Camera chụp ảnh hiện trạng"
            >
              <Camera className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Chụp ảnh</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 text-xs overflow-y-auto flex-1">
          {savedAlert && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 font-bold flex items-center gap-2 animate-in fade-in duration-150">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{savedAlert}</span>
            </div>
          )}

          {/* Action Toolbar: Edit Info & Delete */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditingInfo(!isEditingInfo)}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isEditingInfo
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isEditingInfo ? 'Hủy chỉnh sửa' : 'Chỉnh sửa thông tin hộ'}</span>
              </button>

              <button
                onClick={handleDeleteHouseholdClick}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Xóa vĩnh viễn hộ dân khỏi cơ sở dữ liệu PostgreSQL"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Xóa hộ</span>
              </button>
            </div>

            <div className="text-[11px] text-slate-500 font-mono">
              ID: {household.id} | GPS: [{household.coordinates[0].toFixed(4)}, {household.coordinates[1].toFixed(4)}]
            </div>
          </div>

          {/* INLINE EDIT FORM */}
          {isEditingInfo ? (
            <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200 space-y-3 animate-in fade-in duration-150">
              <div className="font-bold text-blue-900 text-xs flex items-center justify-between">
                <span>CHỈNH SỬA THÔNG TIN HỘ DÂN (LƯU VÀO DATABASE POSTGRESQL)</span>
                <span className="text-[10px] font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Mã: {household.code}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Chủ hộ / Đại diện:</label>
                  <input
                    type="text"
                    value={editForm.ownerName}
                    onChange={e => setEditForm({ ...editForm, ownerName: e.target.value })}
                    className="w-full p-2 bg-white rounded-lg border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Số điện thoại liên lạc:</label>
                  <input
                    type="text"
                    value={editForm.ownerPhone}
                    onChange={e => setEditForm({ ...editForm, ownerPhone: e.target.value })}
                    className="w-full p-2 bg-white rounded-lg border border-slate-300 text-xs font-mono font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Số nhà:</label>
                  <input
                    type="text"
                    value={editForm.houseNumber}
                    onChange={e => setEditForm({ ...editForm, houseNumber: e.target.value })}
                    className="w-full p-2 bg-white rounded-lg border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Tuyến đường:</label>
                  <select
                    value={editForm.street}
                    onChange={e => setEditForm({ ...editForm, street: e.target.value })}
                    className="w-full p-2 bg-white rounded-lg border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {BADIEM_STREETS.map(st => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Ấp trực thuộc (Xã Bà Điểm):</label>
                  <select
                    value={editForm.hamlet}
                    onChange={e => setEditForm({ ...editForm, hamlet: e.target.value })}
                    className="w-full p-2 bg-white rounded-lg border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {BADIEM_HAMLETS.map(h => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Tổ dân phố / Tổ nhân dân:</label>
                  <input
                    type="text"
                    value={editForm.neighborhoodGroup}
                    onChange={e => setEditForm({ ...editForm, neighborhoodGroup: e.target.value })}
                    className="w-full p-2 bg-white rounded-lg border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Loại hình cơ sở:</label>
                  <select
                    value={editForm.type}
                    onChange={e => setEditForm({ ...editForm, type: e.target.value as any })}
                    className="w-full p-2 bg-white rounded-lg border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="household">Hộ dân cư (Nhà ở gia đình)</option>
                    <option value="business">Hộ kinh doanh / Cơ sở có ĐK</option>
                    <option value="special_monitoring">Diện theo dõi trọng điểm ANTT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Tình trạng ANTT & PCCC:</label>
                  <select
                    value={editForm.status}
                    onChange={e => setEditForm({ ...editForm, status: e.target.value as any })}
                    className="w-full p-2 bg-white rounded-lg border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="normal">Bình thường (Hợp lệ)</option>
                    <option value="warning">Cảnh báo (Hết hạn / Cần kiểm tra)</option>
                    <option value="alert">Trọng điểm (Chú ý ANTT)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Tổng nhân khẩu cư trú:</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={editForm.residentsCount}
                    onChange={e => setEditForm({ ...editForm, residentsCount: Number(e.target.value) })}
                    className="w-full p-2 bg-white rounded-lg border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Cảnh báo / Nhắc nhở nghiệp vụ:</label>
                  <input
                    type="text"
                    value={editForm.warningMessage}
                    onChange={e => setEditForm({ ...editForm, warningMessage: e.target.value })}
                    placeholder="VD: Cần gia hạn tạm trú..."
                    className="w-full p-2 bg-white rounded-lg border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-blue-200">
                <button
                  onClick={() => setIsEditingInfo(false)}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSaveInfo}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Lưu vào database PostgreSQL</span>
                </button>
              </div>
            </div>
          ) : (
            /* Basic Details Grid */
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
              <div className="p-2.5 sm:p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-medium text-[10px] sm:text-[11px]">Chủ hộ / Quản lý:</span>
                <div className="text-slate-900 font-bold text-xs mt-0.5 sm:mt-1">{household.ownerName}</div>
              </div>
              <div className="p-2.5 sm:p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-medium text-[10px] sm:text-[11px]">Số điện thoại:</span>
                <div className="text-blue-600 font-mono font-bold text-xs mt-0.5 sm:mt-1">{household.ownerPhone}</div>
              </div>
              <div className="p-2.5 sm:p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-medium text-[10px] sm:text-[11px]">Loại hình cơ sở:</span>
                <div className="text-slate-900 font-bold text-xs mt-0.5 sm:mt-1">
                  {household.type === 'business'
                    ? 'Cơ sở kinh doanh'
                    : household.type === 'special_monitoring'
                      ? 'Diện theo dõi ANTT'
                      : 'Hộ gia đình'}
                </div>
              </div>
            </div>
          )}

          {/* Warning Banner if applicable */}
          {household.status === 'warning' && (
            <div className="p-3 sm:p-3.5 bg-amber-50 border-2 border-amber-300 rounded-xl flex items-start gap-2.5 sm:gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-amber-950 text-xs">CẢNH BÁO GIẤY PHÉP SẮP HẾT HẠN</div>
                <div className="text-amber-900 text-[11px] mt-0.5">
                  {household.warningMessage || 'Cần kiểm tra định kỳ an toàn PCCC và tạm trú.'}{' '}
                  {household.licenseExpiry && `• Hạn chót: ${household.licenseExpiry}`}
                </div>
              </div>
            </div>
          )}

          {/* Special monitoring banner if applicable */}
          {household.type === 'special_monitoring' && (
            <div className="p-3 sm:p-3.5 bg-rose-50 border-2 border-rose-300 rounded-xl flex items-start gap-2.5 sm:gap-3">
              <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-rose-950 text-xs">ĐỐI TƯỢNG TRONG DIỆN QUẢN LÝ NGHIỆP VỤ ANTT</div>
                <div className="text-rose-900 text-[11px] mt-0.5">
                  {household.warningMessage || 'Hồ sơ thuộc diện theo dõi chuyên sâu của CSKV.'}
                </div>
              </div>
            </div>
          )}

          {/* CAMERA & INSPECTION PHOTOS SECTION */}
          <div className="p-3.5 sm:p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span>Ảnh chụp hiện trạng thực tế</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                      {photos.length} ảnh
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">Minh chứng kiểm tra thực địa lưu trữ đồng bộ</div>
                </div>
              </div>

              <button
                id="btn-trigger-inspection-camera"
                onClick={handleTriggerCamera}
                className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer min-h-[36px]"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Chụp ảnh mới</span>
              </button>
            </div>

            {/* Photo Gallery Grid */}
            {photos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                {photos.map(photo => (
                  <div
                    key={photo.id}
                    onClick={() => setSelectedPhotoForView(photo)}
                    className="group relative rounded-xl overflow-hidden border border-slate-200 bg-white aspect-4/3 cursor-pointer hover:shadow-md transition-all"
                  >
                    <img
                      src={photo.url}
                      alt={photo.caption || 'Ảnh hiện trạng'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-between">
                      <div className="flex justify-end">
                        <button
                          onClick={e => handleDeletePhoto(photo.id, e)}
                          disabled={isDeletingPhotoId === photo.id}
                          className="p-1 rounded-md bg-rose-600/90 text-white hover:bg-rose-600 transition-colors shadow-xs"
                          title="Xóa ảnh này"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-white truncate">{photo.caption}</div>
                        <div className="text-[9px] text-slate-300 font-mono">{photo.timestamp}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 bg-white rounded-xl border border-dashed border-slate-300 text-center space-y-1.5">
                <ImageIcon className="w-8 h-8 text-slate-300 mx-auto stroke-1" />
                <div className="text-slate-600 font-bold text-xs">Chưa có ảnh chụp thực tế</div>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Cán bộ CSKV có thể bật Camera thiết bị để lưu lại minh chứng kiểm tra số nhà, bảng hiệu hoặc an toàn PCCC.
                </p>
              </div>
            )}
          </div>

          {/* RESIDENTS ROSTER TABLE */}
          <div className="p-3.5 sm:p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span>Danh sách nhân khẩu cư trú</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                      {household.residentsCount} nhân khẩu ({household.maleCount} Nam, {household.femaleCount} Nữ)
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">Dữ liệu cư dân quản lý tại địa bàn Xã Bà Điểm</div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                  <tr>
                    <th className="p-2.5">Họ và tên</th>
                    <th className="p-2.5">Quan hệ</th>
                    <th className="p-2.5">Năm sinh</th>
                    <th className="p-2.5">Giới tính</th>
                    <th className="p-2.5">Số CCCD</th>
                    <th className="p-2.5">Cư trú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {effectiveResidents.map((r, idx) => {
                    const isEncrypted = isEncryptedAes(r.idCardNumber);
                    const isDecrypted = showCccdMap[r.id];
                    const displayedCccd = isDecrypted
                      ? decryptedCccds[r.id]
                      : isEncrypted
                        ? maskCccd(r.idCardNumber)
                        : r.idCardNumber || 'Chưa nộp';

                    return (
                      <tr key={r.id || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-2.5 font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{r.fullName}</span>
                          {r.relationship === 'Chủ hộ' && (
                            <span className="text-[9px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.2 rounded">Chủ hộ</span>
                          )}
                        </td>
                        <td className="p-2.5 text-slate-600">{r.relationship}</td>
                        <td className="p-2.5 font-mono text-slate-700">{r.birthYear}</td>
                        <td className="p-2.5">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${r.gender === 'Nam' ? 'bg-sky-50 text-sky-700' : 'bg-rose-50 text-rose-700'}`}
                          >
                            {r.gender}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono text-slate-600">
                          <div className="flex items-center gap-1">
                            <span>{displayedCccd}</span>
                            {isEncrypted && (
                              <button
                                onClick={() => toggleDecryptCccd(r.id, r.idCardNumber)}
                                disabled={isDecryptingId === r.id}
                                className="p-0.5 text-blue-600 hover:text-blue-800 cursor-pointer"
                                title={isDecrypted ? 'Ẩn số CCCD' : 'Xem số CCCD đầy đủ'}
                              >
                                {isDecrypted ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            {r.residenceType || 'Thường trú'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* INSPECTION NOTES SECTION */}
          <div className="p-3.5 sm:p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-xs">Ghi chú kiểm tra thực địa</div>
                  <div className="text-[11px] text-slate-500">
                    Cập nhật lần cuối: {household.lastCheckedDate} • CSKV: {household.officerInCharge || 'CSKV Nguyễn Văn Bình'}
                  </div>
                </div>
              </div>

              {!isEditingNotes && (
                <button
                  onClick={handleTriggerEditNotes}
                  className="px-2.5 py-1 text-blue-600 hover:bg-blue-50 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Sửa ghi chú</span>
                </button>
              )}
            </div>

            {isEditingNotes ? (
              <div className="space-y-2 pt-1">
                <textarea
                  value={notesText}
                  onChange={e => setNotesText(e.target.value)}
                  rows={3}
                  className="w-full p-2.5 bg-white rounded-xl border border-slate-300 text-xs leading-relaxed focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Nhập kết quả kiểm tra ANTT, PCCC hoặc di biến động nhân khẩu..."
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setNotesText(household.notes || '');
                      setIsEditingNotes(false);
                    }}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleSaveNotes}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Lưu vào database</span>
                  </button>
                </div>
              </div>
            ) : (
              <p className="p-3 bg-white rounded-xl text-slate-700 text-xs leading-relaxed border border-slate-200/80 italic">
                &quot;{household.notes || 'Chưa có ghi chú kiểm tra nào.'}&quot;
              </p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <a
              href={`tel:${household.ownerPhone}`}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 text-xs min-h-[40px]"
            >
              <Phone className="w-3.5 h-3.5 text-blue-600" />
              <span>Gọi ({household.ownerPhone})</span>
            </a>

            <button
              onClick={handleTriggerCamera}
              className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 text-xs min-h-[40px] cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Chụp ảnh</span>
            </button>

            <button
              id="btn-footer-ocr-scan"
              onClick={handleTriggerOcr}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 text-xs min-h-[40px] cursor-pointer border border-emerald-200"
              title="Quét OCR CCCD"
            >
              <ScanLine className="w-3.5 h-3.5 text-emerald-600" />
              <span>Quét OCR</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-colors text-xs min-h-[40px] cursor-pointer"
          >
            Đóng cửa sổ
          </button>
        </div>
      </div>

      {/* INSPECTION CAMERA MODAL */}
      <InspectionCameraModal
        isOpen={isCameraModalOpen}
        household={household}
        officerName={household.officerInCharge || 'CSKV Nguyễn Văn Bình'}
        onClose={() => setIsCameraModalOpen(false)}
        onPhotoSaved={handlePhotoSaved}
      />

      {/* OCR DOCUMENT SCANNER MODAL */}
      <OcrScanModal
        isOpen={isOcrModalOpen}
        household={household}
        officerName={household.officerInCharge || 'CSKV Nguyễn Văn Bình'}
        onClose={() => setIsOcrModalOpen(false)}
        onHouseholdUpdated={handleHouseholdOcrUpdated}
      />

      {/* FULLSIZE PHOTO VIEWER MODAL */}
      {selectedPhotoForView && (
        <div
          className="fixed inset-0 z-[11000] bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150"
          onClick={() => setSelectedPhotoForView(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl flex flex-col max-h-[92vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Viewer Header */}
            <div className="p-3 sm:p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-white">
              <div>
                <h4 className="font-bold text-sm text-white">{selectedPhotoForView.caption || 'Ảnh kiểm tra hiện trạng thực tế'}</h4>
                <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                  <span>Chụp lúc: {selectedPhotoForView.timestamp}</span>
                  <span>•</span>
                  <span>Người chụp: {selectedPhotoForView.takenBy}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDeletePhoto(selectedPhotoForView.id)}
                  className="px-3 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                  title="Xóa ảnh này"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa ảnh</span>
                </button>

                <button
                  onClick={() => setSelectedPhotoForView(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Viewer Image Display */}
            <div className="flex-1 bg-black flex items-center justify-center p-2 overflow-hidden min-h-[300px]">
              <img
                src={selectedPhotoForView.url}
                alt={selectedPhotoForView.caption}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>

            {/* Viewer Footer */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
              <span className="font-mono text-[11px]">
                Hồ sơ: {household.code} - {household.houseNumber} {household.street}
              </span>
              <a
                href={selectedPhotoForView.url}
                download={`hien_trang_${household.code}_${Date.now()}.jpg`}
                className="text-blue-400 hover:underline font-semibold"
              >
                Tải ảnh gốc về máy
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
