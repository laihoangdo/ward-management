import { Link } from 'react-router';
import { DiscardChangesDialog } from './DiscardChangesDialog';
import { useUnsavedPageGuard } from '../utils/useUnsavedPageGuard';
import { useDialogFocus } from '../utils/useDialogFocus';
import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import { createPortal } from 'react-dom';
import {
  X,
  Phone,
  AlertOctagon,
  AlertTriangle,
  Edit3,
  Save,
  CheckCircle2,
  FileText,
  Camera,
  Trash2,
  Image as ImageIcon,
  ScanLine,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Navigation,
} from 'lucide-react';
import { HouseholdFacility, InspectionPhoto, AppUser } from '../types';
import { getHouseholdResidenceType, RESIDENCE_TYPE_CONFIG } from '../utils/residenceUtils';
import { getEffectiveResidentsList } from '../utils/residentRosterUtils';
import { InspectionCameraModal } from './InspectionCameraModal';
import { OcrScanModal } from './OcrScanModal';
import { deleteInspectionPhotoFromHousehold } from '../services/firestoreService';
import { showsSourceAddress } from '../services/householdApiService';
import { BADIEM_51_HAMLETS } from '../data/baDiemHamlets';
import { RosterHouseholdInlineEdit } from './RosterHouseholdInlineEdit';
import { errorText } from '../../subjects/subjectModel';

const ALLEY_BADGE_CLASS =
  'text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full font-bold bg-purple-900/60 text-purple-200 border border-purple-700'; // taste-skill-ignore: màu phân loại tuyến hẻm đồng bộ sơ đồ địa bàn
const PHOTO_SCRIM_CLASS =
  'absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-between'; // taste-skill-ignore: scrim trung tính trên ảnh thật để đọc caption và nút xoá

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
  presentation?: 'dialog' | 'drawer';
  currentUser?: AppUser | null;
  onClose: () => void;
  onUpdateNotes: (id: string, notes: string) => Promise<void>;
  onPhotoAdded?: (photo: InspectionPhoto) => void;
  onHouseholdUpdated?: (updatedHousehold: HouseholdFacility) => Promise<void>;
  onDeleteHousehold?: (id: string) => void;
  onShowToast?: (msg: string) => void;
  onOpenRoster?: (household: HouseholdFacility, edit: boolean) => void;
  /** Route from the officer's position to this household on the 3D field map (only offered there). */
  onNavigate?: (household: HouseholdFacility) => void;
  /** Re-reads the household after a roster write so the map and lists show the saved values. */
  onReloadHousehold?: (id: string) => Promise<void>;
}

export const HouseholdDetailModal: React.FC<HouseholdDetailModalProps> = props =>
  props.household ? <HouseholdDetailModalContent key={props.household.id} {...props} household={props.household} /> : null;

const HouseholdDetailModalContent: React.FC<HouseholdDetailModalProps & { household: HouseholdFacility }> = ({
  household,
  presentation = 'dialog',
  currentUser,
  onClose,
  onUpdateNotes,
  onPhotoAdded,
  onHouseholdUpdated,
  onDeleteHousehold,
  onShowToast,
  onOpenRoster,
  onReloadHousehold,
  onNavigate,
}) => {
  // Roster-managed (TC2) households are written only through the audited roster API; the legacy household API refuses
  // every write. Their record is loaded on the first edit and kept as the source of truth for the version and notes.
  const unified = household.code.startsWith('TC2');
  const [roster, setRoster] = useState<Record<string, any> | null>(null);
  const [rosterDirty, setRosterDirty] = useState(false);
  const currentNotes: string = (roster ? roster.inspection_notes : household.notes) || '';
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState(currentNotes);
  const [savedAlert, setSavedAlert] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [selectedPhotoForView, setSelectedPhotoForView] = useState<InspectionPhoto | null>(null);
  const [isDeletingPhotoId, setIsDeletingPhotoId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<InspectionPhoto[]>(household.inspectionPhotos || []);
  useEffect(() => {
    setPhotos(household.inspectionPhotos || []);
  }, [household.inspectionPhotos]);

  const handleTriggerCamera = () => {
    if (currentUser?.role !== 'superadmin' && currentUser?.subAdminPermissions?.canUpdateInspection !== true) {
      const msg = 'Thẩm quyền bị khóa: Bạn chưa được phân quyền ghi nhận kết quả kiểm tra thực địa.';
      if (onShowToast) onShowToast(msg);
      else alert(msg);
      return;
    }
    setIsCameraModalOpen(true);
  };

  const handleTriggerEditNotes = () => {
    if (currentUser?.role !== 'superadmin' && currentUser?.subAdminPermissions?.canUpdateInspection !== true) {
      const msg = 'Thẩm quyền bị khóa: Bạn chưa được phân quyền ghi nhận kết quả kiểm tra thực địa.';
      if (onShowToast) onShowToast(msg);
      else alert(msg);
      return;
    }
    setIsEditingNotes(true);
  };

  const handleTriggerOcr = () => {
    if (currentUser?.role !== 'superadmin' && currentUser?.subAdminPermissions?.canScanOcr !== true) {
      const msg = 'Thẩm quyền bị khóa: Bạn chưa được phân quyền quét OCR Căn cước công dân.';
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
  const originalForm = {
    ownerName: household.ownerName || '',
    ownerPhone: household.ownerPhone || '',
    houseNumber: household.houseNumber || '',
    // Hộ chưa có tên đường: không đưa địa chỉ nguồn vào ô chọn tuyến đường.
    street: showsSourceAddress(household) ? '' : household.street || '',
    hamlet: household.hamlet || '',
    hamletId: household.hamletId,
    neighborhoodGroup: household.neighborhoodGroup || '',
    alley: household.alley || '',
    type: household.type || 'household',
    businessName: household.businessName || '',
    businessCategory: household.businessCategory || '',
    status: household.status || 'normal',
    warningMessage: household.warningMessage || '',
    residentsCount: household.residentsCount ?? 0,
    maleCount: household.maleCount ?? 0,
    femaleCount: household.femaleCount || 0,
  };
  const [editForm, setEditForm] = useState(originalForm);
  const [showDiscard, setShowDiscard] = useState(false);
  const [discardAction, setDiscardAction] = useState<'close' | 'info' | 'notes'>('close');
  const infoDirty = isEditingInfo && (unified ? rosterDirty : JSON.stringify(editForm) !== JSON.stringify(originalForm));
  const notesDirty = isEditingNotes && notesText !== currentNotes;
  useUnsavedPageGuard(infoDirty || notesDirty);
  const requestDiscard = (action: 'close' | 'info' | 'notes') => {
    if (isSaving) return;
    const changed = action === 'close' ? infoDirty || notesDirty : action === 'info' ? infoDirty : notesDirty;
    if (changed) {
      setDiscardAction(action);
      setShowDiscard(true);
      return;
    }
    if (action === 'close') onClose();
    if (action === 'info') {
      setEditForm(originalForm);
      setRosterDirty(false);
      setIsEditingInfo(false);
    }
    if (action === 'notes') {
      setNotesText(currentNotes);
      setIsEditingNotes(false);
    }
  };
  const confirmDiscard = () => {
    setShowDiscard(false);
    if (discardAction === 'close') onClose();
    if (discardAction === 'info') {
      setEditForm(originalForm);
      setRosterDirty(false);
      setIsEditingInfo(false);
    }
    if (discardAction === 'notes') {
      setNotesText(currentNotes);
      setIsEditingNotes(false);
    }
  };
  const canInspect = currentUser?.role === 'superadmin' || currentUser?.subAdminPermissions?.canUpdateInspection === true;
  const canScan = currentUser?.role === 'superadmin' || currentUser?.subAdminPermissions?.canScanOcr === true;
  const canReveal = currentUser?.role === 'superadmin' || currentUser?.subAdminPermissions?.canRevealIdentity === true;
  useEffect(() => {
    if (!isEditingNotes) setNotesText(currentNotes);
  }, [currentNotes, isEditingNotes]);
  const hamletParams = household.hamletId ? { hamletId: household.hamletId } : undefined;
  const loadRoster = async () => {
    if (roster) return roster;
    const { data } = await axios.get<Record<string, any>>(`/api/roster/legacy-households/${encodeURIComponent(household.id)}`, {
      params: hamletParams,
    });
    setRoster(data);
    return data;
  };
  const reloadHousehold = async () => {
    try {
      await onReloadHousehold?.(household.id);
    } catch {
      // The write succeeded; the map refreshes on the next load.
    }
  };

  // Full identity numbers come only from the audited backend endpoint; the client never holds the key.
  const revealCccd = async (residentId: string) => {
    if (showCccdMap[residentId]) {
      setShowCccdMap(prev => ({ ...prev, [residentId]: false }));
      return;
    }

    if (decryptedCccds[residentId]) {
      setShowCccdMap(prev => ({ ...prev, [residentId]: true }));
      return;
    }

    setIsDecryptingId(residentId);
    try {
      const { data } = await axios.post<{ idCardNumber: string }>(`/api/residents/${residentId}/reveal-id`, {});
      setDecryptedCccds(prev => ({ ...prev, [residentId]: data.idCardNumber }));
      setShowCccdMap(prev => ({ ...prev, [residentId]: true }));
    } catch {
      setSavedAlert('Không thể xem số CCCD. Cần quyền xem số định danh đầy đủ.');
    } finally {
      setIsDecryptingId(null);
    }
  };

  const handleHouseholdOcrUpdated = async (updated: HouseholdFacility) => {
    if (!onHouseholdUpdated || isSaving) return;
    setIsSaving(true);
    setSaveError('');
    try {
      await onHouseholdUpdated(updated);
      setSavedAlert('Đã lưu dữ liệu hồ sơ từ ảnh quét OCR.');
      setTimeout(() => setSavedAlert(null), 3000);
    } catch (error) {
      setSaveError('Chưa lưu đầy đủ dữ liệu OCR. Kiểm tra lại hồ sơ trước khi thử lại.');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotes = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveError('');
    try {
      if (unified) {
        const current = await loadRoster();
        const { data } = await axios.put<Record<string, any>>(
          `/api/roster/households/${encodeURIComponent(String(current.id))}/inspection-notes`,
          { notes: notesText, version: current.version },
          { params: hamletParams },
        );
        setRoster(data);
        void reloadHousehold();
      } else {
        await onUpdateNotes(household.id, notesText);
      }
      setIsEditingNotes(false);
      setSavedAlert('Đã lưu ghi chú kiểm tra.');
      setTimeout(() => setSavedAlert(null), 2500);
    } catch (error) {
      // A newer version on the server: drop the cached record so the next try works on the current one.
      if (unified && axios.isAxiosError(error) && error.response?.status === 409) setRoster(null);
      setSaveError(
        unified && axios.isAxiosError(error) && error.response
          ? `Không thể lưu ghi chú: ${errorText(error)} Nội dung nhập được giữ lại.`
          : 'Không thể lưu ghi chú. Nội dung nhập được giữ lại; vui lòng thử lại.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveInfo = async () => {
    if (isSaving) return;
    if (!editForm.ownerName.trim() || !editForm.houseNumber.trim()) {
      setSaveError('Nhập đầy đủ tên chủ hộ và số nhà trước khi lưu.');
      return;
    }

    if (!Number.isInteger(editForm.residentsCount) || editForm.residentsCount < 0) {
      setSaveError('Tổng nhân khẩu phải là số nguyên từ 0 trở lên.');
      document.getElementById('household-edit-field-9')?.focus();
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
      // Không chọn đường mới thì giữ địa chỉ nguồn để hiển thị; mapper sẽ không ghi nó vào cột street.
      street: editForm.street || (showsSourceAddress(household) ? household.street : ''),
      hamlet: editForm.hamlet,
      hamletId: editForm.hamletId,
      neighborhoodGroup: editForm.neighborhoodGroup,
      alley: editForm.alley,
      type: editForm.type as any,
      businessName: editForm.type === 'business' ? editForm.businessName.trim() : undefined,
      businessCategory: editForm.type === 'business' ? editForm.businessCategory.trim() : undefined,
      status: editForm.status as any,
      warningMessage: editForm.warningMessage.trim() || undefined,
      residentsCount: Number(editForm.residentsCount),
      maleCount: Number(editForm.maleCount) || 0,
      femaleCount: Number(editForm.femaleCount) || 0,
      residentsList: updatedResidentsList,
    };

    if (!onHouseholdUpdated) return;
    setIsSaving(true);
    setSaveError('');
    try {
      await onHouseholdUpdated(updated);
      setIsEditingInfo(false);
      setSavedAlert('Đã cập nhật thông tin hộ dân.');
      setTimeout(() => setSavedAlert(null), 3000);
    } catch {
      setSaveError('Chưa lưu đầy đủ hồ sơ. Nội dung nhập được giữ lại. Kiểm tra dữ liệu trước khi thử lại.');
    } finally {
      setIsSaving(false);
    }
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
    setPhotos(previous => [newPhoto, ...previous]);
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
      setPhotos(previous => previous.filter(p => p.id !== photoId));
      setSavedAlert('Đã xóa ảnh kiểm tra khỏi hồ sơ.');
      setTimeout(() => setSavedAlert(null), 2500);
    } catch (err) {
      console.error('Lỗi khi xóa ảnh:', err);
      alert('Không thể xóa ảnh. Vui lòng thử lại.');
    } finally {
      setIsDeletingPhotoId(null);
    }
  };

  const effectiveResidents = useMemo(() => getEffectiveResidentsList(household), [household]);

  const dialogRef = useDialogFocus(true, () => requestDiscard('close'), isSaving);
  // On the map the record is a side panel (bottom sheet on phones) that leaves the map usable: clicking another building
  // swaps the record. While an edit is unsaved or a save runs, the panel becomes modal again so nothing is lost by a stray click.
  const drawer = presentation === 'drawer';
  const locked = infoDirty || notesDirty || isSaving;
  const modal = !drawer || locked;
  const [collapsed, setCollapsed] = useState(false);
  const showBody = !(drawer && collapsed);
  const residenceType = getHouseholdResidenceType(household);
  const residenceConfig = RESIDENCE_TYPE_CONFIG[residenceType];
  const phone = household.ownerPhone?.trim();
  const maleCount = effectiveResidents.filter(r => r.gender === 'Nam').length;
  const femaleCount = effectiveResidents.filter(r => r.gender === 'Nữ').length;
  const typeLabel =
    household.type === 'business' ? 'Cơ sở kinh doanh' : household.type === 'special_monitoring' ? 'Diện theo dõi ANTT' : 'Hộ gia đình';
  const title = household.businessName
    ? `${household.businessName} (Số ${household.houseNumber})`
    : `Số ${household.houseNumber} ${household.street}`;
  const bodyId = `household-record-${household.id}`;
  const jumpTo = (id: string) => {
    const section = document.getElementById(id);
    section?.scrollIntoView({ block: 'start' });
    section?.focus({ preventScroll: true });
  };
  const [rosterLoading, setRosterLoading] = useState(false);
  const toggleEditInfo = async () => {
    if (isEditingInfo) {
      requestDiscard('info');
      return;
    }
    if (unified) {
      setSaveError('');
      setRosterLoading(true);
      try {
        await loadRoster();
        setRosterDirty(false);
        setIsEditingInfo(true);
      } catch (error) {
        setSaveError(`Không tải được hồ sơ hộ để chỉnh sửa: ${errorText(error)}`);
      } finally {
        setRosterLoading(false);
      }
      return;
    }
    setEditForm(originalForm);
    setIsEditingInfo(true);
  };
  const content = (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal={modal ? 'true' : 'false'}
      aria-label={`Hồ sơ ${household.code}`}
      tabIndex={-1}
      className={
        drawer
          ? `gis-household-dialog gis-household-drawer fixed inset-0 z-50 flex${locked ? ' is-locked' : ''}${collapsed ? ' is-collapsed' : ''}`
          : 'gis-household-dialog fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto'
      }
    >
      <div
        className={`gis-hh-panel${drawer ? '' : ' w-full max-w-2xl rounded-xl sm:rounded-2xl shadow-2xl my-auto max-h-[92vh] animate-in fade-in zoom-in-95 duration-150'}`}
      >
        <div className="gis-hh-head">
          <div className="gis-hh-heading">
            <p className="gis-hh-meta">
              <span className="gis-hh-code">{household.code}</span>
              <span>
                {household.hamlet || 'Chưa có địa bàn'} · {household.neighborhoodGroup || 'Chưa có tổ dân phố'} · Xã Bà Điểm, TP. Hồ Chí
                Minh
              </span>
            </p>
            <h2 className="gis-dialog-title gis-hh-title">{title}</h2>
            <div className="gis-hh-badges">
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1 ${residenceConfig.badgeBg} ${residenceConfig.badgeText} border ${residenceConfig.badgeBorder}`}
              >
                <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full ${residenceConfig.dotBg}`}></span>
                {residenceType}
              </span>
              {household.alley && <span className={ALLEY_BADGE_CLASS}>{household.alley}</span>}
              {household.status === 'warning' && <span className="gis-hh-chip is-warning">Cần kiểm tra</span>}
              {household.type === 'special_monitoring' && <span className="gis-hh-chip is-danger">Diện theo dõi</span>}
            </div>
          </div>
          <div className="gis-hh-head-actions">
            {drawer && (
              <button
                type="button"
                className="gis-hh-icon-btn"
                disabled={locked}
                aria-expanded={!collapsed}
                aria-controls={bodyId}
                aria-label={collapsed ? 'Mở rộng hồ sơ' : 'Thu gọn hồ sơ'}
                title={collapsed ? 'Mở rộng hồ sơ' : 'Thu gọn để xem bản đồ'}
                onClick={() => setCollapsed(value => !value)}
              >
                {collapsed ? <ChevronUp aria-hidden="true" className="w-5 h-5" /> : <ChevronDown aria-hidden="true" className="w-5 h-5" />}
              </button>
            )}
            <button
              type="button"
              className="gis-hh-icon-btn"
              disabled={isSaving}
              aria-label="Đóng hồ sơ"
              title="Đóng hồ sơ"
              onClick={() => requestDiscard('close')}
            >
              <X aria-hidden="true" className="w-5 h-5" />
            </button>
          </div>
        </div>

        <DiscardChangesDialog open={showDiscard} onContinue={() => setShowDiscard(false)} onDiscard={confirmDiscard} />
        {showBody && (
          <div id={bodyId} className="gis-hh-main">
            <div className="gis-hh-toolbar">
              {unified && (
                <Link
                  className="gis-hh-btn is-primary"
                  title="Chỉnh sửa, nguồn dữ liệu và lịch sử thay đổi"
                  to={`/dashboard?tab=households&legacyHousehold=${encodeURIComponent(household.id)}`}
                  onClick={event => {
                    if (onOpenRoster && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
                      event.preventDefault();
                      onOpenRoster(household, false);
                    }
                  }}
                >
                  <FileText aria-hidden="true" className="w-4 h-4" />
                  <span>Mở hồ sơ đầy đủ</span>
                </Link>
              )}
              <button
                type="button"
                className={`gis-hh-btn${isEditingInfo ? ' is-active' : ''}`}
                disabled={isSaving || rosterLoading || !canInspect}
                onClick={() => void toggleEditInfo()}
              >
                <Edit3 aria-hidden="true" className="w-4 h-4" />
                <span>{isEditingInfo ? 'Hủy chỉnh sửa' : 'Chỉnh sửa thông tin hộ'}</span>
              </button>
              {onNavigate && (
                <button
                  type="button"
                  className="gis-hh-btn"
                  disabled={isSaving || locked}
                  title="Chỉ đường từ vị trí của bạn tới hộ này trên bản đồ"
                  onClick={() => onNavigate(household)}
                >
                  <Navigation aria-hidden="true" className="w-4 h-4" />
                  <span>Chỉ đường</span>
                </button>
              )}
              <button
                type="button"
                id="btn-trigger-inspection-camera"
                className="gis-hh-btn"
                disabled={isSaving || !canInspect}
                onClick={handleTriggerCamera}
                title="Bật camera chụp ảnh hiện trạng"
              >
                <Camera aria-hidden="true" className="w-4 h-4" />
                <span>Chụp ảnh</span>
              </button>
              <button
                type="button"
                id="btn-open-ocr-header"
                className="gis-hh-btn"
                disabled={isSaving || !canScan}
                onClick={handleTriggerOcr}
                title="Quét OCR căn cước công dân"
              >
                <ScanLine aria-hidden="true" className="w-4 h-4" />
                <span>Quét OCR</span>
              </button>
              {/* No number on file: no empty "Gọi ()" link that dials nothing. */}
              {phone && (
                <a className="gis-hh-btn" href={`tel:${phone}`}>
                  <Phone aria-hidden="true" className="w-4 h-4" />
                  <span>Gọi ({phone})</span>
                </a>
              )}
              {!unified && (
                <button
                  type="button"
                  className="gis-hh-btn is-danger"
                  title="Dữ liệu thật được giữ lịch sử; không xóa cứng"
                  disabled={isSaving}
                  onClick={() => {
                    if (infoDirty || notesDirty) {
                      setSaveError('Lưu hoặc bỏ nội dung đang chỉnh sửa trước khi xóa hồ sơ.');
                      return;
                    }
                    handleDeleteHouseholdClick();
                  }}
                >
                  <Trash2 aria-hidden="true" className="w-4 h-4" />
                  <span>Xóa hộ</span>
                </button>
              )}
            </div>
            {(unified || !canInspect || !canScan) && (
              <p className="gis-hh-note">
                {unified ? 'Vị trí tạm; thông tin hộ và nhân khẩu cần đối chiếu nguồn. ' : ''}
                {!canInspect ? 'Bạn chưa được cấp quyền chỉnh sửa hoặc ghi nhận kiểm tra. ' : ''}
                {!canScan ? 'Bạn chưa được cấp quyền quét OCR.' : ''}
              </p>
            )}
            <nav aria-label="Mục hồ sơ hộ dân" className="gis-record-sections gis-hh-tabs">
              {[
                ['household-info', 'Thông tin', ''],
                ['household-residents', 'Nhân khẩu', String(effectiveResidents.length)],
                ['household-photos', 'Ảnh kiểm tra', household.inspectionPhotosError ? '' : String(photos.length)],
                ['household-notes', 'Ghi chú', ''],
              ].map(([id, label, count]) => (
                <button type="button" key={id} className="gis-hh-tab" onClick={() => jumpTo(id)}>
                  {label}
                  {count && <span className="gis-hh-count">{count}</span>}
                </button>
              ))}
            </nav>

            <div className="gis-hh-body">
              {saveError && (
                <p role="alert" className="gis-hh-alert is-error">
                  {saveError}
                </p>
              )}
              {isSaving && (
                <p role="status" className="gis-hh-note">
                  Đang lưu hồ sơ…
                </p>
              )}
              {savedAlert && (
                <p role="status" className="gis-hh-alert is-success">
                  <CheckCircle2 aria-hidden="true" className="w-4 h-4 shrink-0" />
                  <span>{savedAlert}</span>
                </p>
              )}

              <section id="household-info" tabIndex={-1} className="gis-hh-section">
                <h3 id="household-info-title" className="gis-item-title gis-hh-section-title">
                  {isEditingInfo ? 'Chỉnh sửa thông tin hộ dân' : 'Thông tin hộ'}
                </h3>
                {isEditingInfo && unified ? (
                  roster && (
                    <RosterHouseholdInlineEdit
                      household={roster}
                      hamletId={household.hamletId}
                      onDirtyChange={setRosterDirty}
                      onCancel={() => requestDiscard('info')}
                      onSaved={updated => {
                        setRoster(updated);
                        setRosterDirty(false);
                        setIsEditingInfo(false);
                        setSavedAlert('Đã cập nhật thông tin hộ.');
                        setTimeout(() => setSavedAlert(null), 3000);
                        void reloadHousehold();
                      }}
                    />
                  )
                ) : isEditingInfo ? (
                  <div className="gis-hh-form space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1" htmlFor="household-edit-field-1">
                          Chủ hộ / Đại diện:
                        </label>
                        <input
                          disabled={isSaving}
                          id="household-edit-field-1"
                          type="text"
                          value={editForm.ownerName}
                          onChange={e => setEditForm({ ...editForm, ownerName: e.target.value })}
                          className="w-full p-2 bg-white rounded-lg border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1" htmlFor="household-edit-field-2">
                          Số điện thoại liên lạc:
                        </label>
                        <input
                          disabled={isSaving}
                          id="household-edit-field-2"
                          type="text"
                          value={editForm.ownerPhone}
                          onChange={e => setEditForm({ ...editForm, ownerPhone: e.target.value })}
                          className="w-full p-2 bg-white rounded-lg border border-slate-300 text-xs font-mono font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1" htmlFor="household-edit-field-3">
                          Số nhà:
                        </label>
                        <input
                          disabled={isSaving}
                          id="household-edit-field-3"
                          type="text"
                          value={editForm.houseNumber}
                          onChange={e => setEditForm({ ...editForm, houseNumber: e.target.value })}
                          className="w-full p-2 bg-white rounded-lg border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1" htmlFor="household-edit-field-4">
                          Tuyến đường:
                        </label>
                        <select
                          disabled={isSaving}
                          id="household-edit-field-4"
                          value={editForm.street}
                          onChange={e => setEditForm({ ...editForm, street: e.target.value })}
                          className="w-full p-2 bg-white rounded-lg border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          <option value="">Chưa xác định tuyến đường</option>
                          {editForm.street && !BADIEM_STREETS.includes(editForm.street) && (
                            <option value={editForm.street}>{editForm.street}</option>
                          )}
                          {BADIEM_STREETS.map(st => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1" htmlFor="household-edit-field-5">
                          Ấp trực thuộc (51 ấp sau sáp nhập):
                        </label>
                        <select
                          disabled={isSaving}
                          id="household-edit-field-5"
                          value={editForm.hamlet}
                          onChange={e => {
                            const selectedFullName = e.target.value;
                            const matched = BADIEM_51_HAMLETS.find(h => h.fullName === selectedFullName);
                            setEditForm({
                              ...editForm,
                              hamlet: selectedFullName,
                              hamletId: matched?.id || editForm.hamletId,
                            });
                          }}
                          className="w-full p-2 bg-white rounded-lg border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          <option value="">Chưa xác định ấp</option>
                          {editForm.hamlet && !BADIEM_51_HAMLETS.some(h => h.fullName === editForm.hamlet) && (
                            <option value={editForm.hamlet}>{editForm.hamlet}</option>
                          )}
                          {BADIEM_51_HAMLETS.map(h => (
                            <option key={h.id} value={h.fullName}>
                              {h.fullName} ({h.group})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1" htmlFor="household-edit-field-6">
                          Tổ dân phố / Tổ nhân dân:
                        </label>
                        <input
                          disabled={isSaving}
                          id="household-edit-field-6"
                          type="text"
                          value={editForm.neighborhoodGroup}
                          onChange={e => setEditForm({ ...editForm, neighborhoodGroup: e.target.value })}
                          className="w-full p-2 bg-white rounded-lg border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1" htmlFor="household-edit-field-7">
                          Loại hình cơ sở:
                        </label>
                        <select
                          disabled={isSaving}
                          id="household-edit-field-7"
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
                        <label className="block text-[11px] font-bold text-slate-700 mb-1" htmlFor="household-edit-field-8">
                          Tình trạng ANTT & PCCC:
                        </label>
                        <select
                          disabled={isSaving}
                          id="household-edit-field-8"
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
                        <label className="block text-[11px] font-bold text-slate-700 mb-1" htmlFor="household-edit-field-9">
                          Tổng nhân khẩu cư trú:
                        </label>
                        <input
                          disabled={isSaving}
                          id="household-edit-field-9"
                          type="number"
                          min={0}
                          step={1}
                          value={editForm.residentsCount}
                          onChange={e => setEditForm({ ...editForm, residentsCount: Number(e.target.value) })}
                          className="w-full p-2 bg-white rounded-lg border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1" htmlFor="household-edit-field-10">
                          Cảnh báo / Nhắc nhở nghiệp vụ:
                        </label>
                        <input
                          disabled={isSaving}
                          id="household-edit-field-10"
                          type="text"
                          value={editForm.warningMessage}
                          onChange={e => setEditForm({ ...editForm, warningMessage: e.target.value })}
                          placeholder="VD: Cần gia hạn tạm trú..."
                          className="w-full p-2 bg-white rounded-lg border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                      <button
                        disabled={isSaving}
                        onClick={() => requestDiscard('info')}
                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={handleSaveInfo}
                        disabled={isSaving}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Lưu thông tin</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <dl className="gis-hh-facts">
                    <div>
                      <dt>Chủ hộ / Quản lý</dt>
                      <dd>{household.ownerName || 'Chưa cập nhật'}</dd>
                    </div>
                    {phone && (
                      <div>
                        <dt>Số điện thoại</dt>
                        <dd className="tabular-nums">{phone}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Loại hình</dt>
                      <dd>{typeLabel}</dd>
                    </div>
                    {household.businessCategory && (
                      <div>
                        <dt>Ngành nghề</dt>
                        <dd>{household.businessCategory}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Vị trí</dt>
                      <dd className="tabular-nums">
                        {household.coordinatesEstimated
                          ? 'Vị trí tạm, chưa xác minh'
                          : `${household.coordinates[0].toFixed(5)}, ${household.coordinates[1].toFixed(5)}`}
                      </dd>
                    </div>
                    <div>
                      <dt>Mã nội bộ</dt>
                      <dd className="tabular-nums">{household.id}</dd>
                    </div>
                  </dl>
                )}

                {household.status === 'warning' && (
                  <div className="gis-hh-alert is-warning">
                    <AlertTriangle aria-hidden="true" className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <strong>Cảnh báo giấy phép sắp hết hạn</strong>
                      <div>
                        {household.warningMessage || 'Cần kiểm tra định kỳ an toàn PCCC và tạm trú.'}{' '}
                        {household.licenseExpiry && `· Hạn chót: ${household.licenseExpiry}`}
                      </div>
                    </div>
                  </div>
                )}
                {household.type === 'special_monitoring' && (
                  <div className="gis-hh-alert is-danger">
                    <AlertOctagon aria-hidden="true" className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <strong>Đối tượng trong diện quản lý nghiệp vụ ANTT</strong>
                      <div>{household.warningMessage || 'Hồ sơ thuộc diện theo dõi chuyên sâu của CSKV.'}</div>
                    </div>
                  </div>
                )}
              </section>

              <section id="household-residents" tabIndex={-1} className="gis-hh-section">
                <div className="gis-hh-section-head">
                  <h3 id="household-residents-title" className="gis-item-title gis-hh-section-title">
                    Nhân khẩu cư trú
                  </h3>
                  <span className="gis-hh-subtle tabular-nums">
                    {effectiveResidents.length} người · {maleCount} nam, {femaleCount} nữ
                  </span>
                </div>
                {effectiveResidents.length === 0 ? (
                  <p className="gis-hh-empty">Chưa có danh sách nhân khẩu từ cơ sở dữ liệu. Không tự tạo nhân khẩu từ số liệu tổng hợp.</p>
                ) : (
                  <ul className="gis-hh-people">
                    {effectiveResidents.map((r, idx) => {
                      const isDecrypted = showCccdMap[r.id];
                      const displayedCccd = isDecrypted ? decryptedCccds[r.id] : r.idCardNumber || 'Chưa có dữ liệu';
                      const head = r.relationship === 'Chủ hộ';
                      return (
                        <li key={r.id || idx}>
                          <div className="gis-hh-person-name">
                            <span>{r.fullName}</span>
                            {head && <span className="gis-hh-chip">Chủ hộ</span>}
                          </div>
                          <div className="gis-hh-person-meta">
                            {[
                              head ? '' : r.relationship || 'Chưa xác minh',
                              r.birthYear ? `Sinh ${r.birthYear}` : 'Chưa có năm sinh',
                              r.gender,
                              r.residenceType || 'Chưa xác minh',
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                          <div className="gis-hh-person-id">
                            <span>
                              CCCD: <span className="tabular-nums">{displayedCccd}</span>
                            </span>
                            {canReveal && r.idCardNumber && (
                              <button
                                type="button"
                                className="gis-hh-link-btn"
                                onClick={() => revealCccd(r.id)}
                                disabled={isDecryptingId === r.id}
                                aria-label={
                                  isDecrypted ? `Ẩn số CCCD của ${r.fullName}` : `Xem số CCCD đầy đủ của ${r.fullName} (ghi nhật ký)`
                                }
                                title={isDecrypted ? 'Ẩn số CCCD' : 'Xem số CCCD đầy đủ (ghi nhật ký)'}
                              >
                                {isDecrypted ? (
                                  <EyeOff aria-hidden="true" className="w-4 h-4" />
                                ) : (
                                  <Eye aria-hidden="true" className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section id="household-photos" tabIndex={-1} className="gis-hh-section">
                <div className="gis-hh-section-head">
                  <h3 id="household-photos-title" className="gis-item-title gis-hh-section-title">
                    Ảnh hiện trạng
                  </h3>
                  <span className="gis-hh-subtle">{household.inspectionPhotosError ? 'Chưa tải đầy đủ' : `${photos.length} ảnh`}</span>
                </div>
                {household.inspectionPhotosError && (
                  <p role="alert" className="gis-hh-alert is-warning">
                    {household.inspectionPhotosError}
                  </p>
                )}
                {photos.length > 0 ? (
                  <div className="gis-hh-photos">
                    {photos.map(photo => (
                      <div
                        key={photo.id}
                        onClick={() => setSelectedPhotoForView(photo)}
                        className="group relative rounded-lg overflow-hidden border border-slate-200 bg-white aspect-4/3 cursor-pointer"
                      >
                        <img src={photo.url} alt={photo.caption || 'Ảnh hiện trạng'} className="w-full h-full object-cover" />
                        <div className={PHOTO_SCRIM_CLASS}>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={e => handleDeletePhoto(photo.id, e)}
                              disabled={isSaving || isDeletingPhotoId === photo.id}
                              className="p-1 rounded-md bg-rose-600/90 text-white hover:bg-rose-600 transition-colors"
                              title="Xóa ảnh này"
                              aria-label="Xóa ảnh này"
                            >
                              <Trash2 aria-hidden="true" className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div>
                            <div className="text-[11px] font-semibold text-white truncate">{photo.caption}</div>
                            <div className="text-[11px] text-slate-200 tabular-nums">{photo.timestamp}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="gis-hh-empty">
                    <ImageIcon aria-hidden="true" className="w-4 h-4 shrink-0" />
                    <span>
                      {household.inspectionPhotosError
                        ? 'Danh sách ảnh chưa tải được.'
                        : 'Chưa có ảnh kiểm tra. Dùng “Chụp ảnh” để lưu minh chứng số nhà, bảng hiệu hoặc an toàn PCCC.'}
                    </span>
                  </p>
                )}
              </section>

              <section id="household-notes" tabIndex={-1} className="gis-hh-section">
                <div className="gis-hh-section-head">
                  <div>
                    <h3 id="household-notes-title" className="gis-item-title gis-hh-section-title">
                      Ghi chú kiểm tra thực địa
                    </h3>
                    <div className="gis-hh-subtle">
                      Cập nhật lần cuối: {(roster ? roster.last_checked_date : household.lastCheckedDate) || 'chưa có'} · CSKV:{' '}
                      {(roster ? roster.officer_in_charge : household.officerInCharge) || currentUser?.fullName || 'CSKV Phụ trách'}
                    </div>
                  </div>
                  {!isEditingNotes && (
                    <button
                      type="button"
                      className="gis-hh-btn is-quiet"
                      disabled={isSaving || !canInspect}
                      onClick={handleTriggerEditNotes}
                    >
                      <Edit3 aria-hidden="true" className="w-4 h-4" />
                      <span>Sửa ghi chú</span>
                    </button>
                  )}
                </div>

                {isEditingNotes ? (
                  <div className="space-y-2">
                    <textarea
                      disabled={isSaving}
                      aria-label="Ghi chú kiểm tra thực địa"
                      value={notesText}
                      onChange={e => setNotesText(e.target.value)}
                      rows={3}
                      maxLength={2000}
                      className="w-full p-2.5 bg-white rounded-lg border border-slate-300 text-sm leading-relaxed outline-none"
                      placeholder="Nhập kết quả kiểm tra ANTT, PCCC hoặc di biến động nhân khẩu..."
                    />
                    <div className="flex justify-end gap-2">
                      <button type="button" className="gis-hh-btn" disabled={isSaving} onClick={() => requestDiscard('notes')}>
                        Hủy
                      </button>
                      <button type="button" className="gis-hh-btn is-primary" onClick={handleSaveNotes} disabled={isSaving}>
                        <Save aria-hidden="true" className="w-4 h-4" />
                        <span>Lưu ghi chú</span>
                      </button>
                    </div>
                  </div>
                ) : currentNotes ? (
                  <p className="gis-hh-notes">{currentNotes}</p>
                ) : (
                  <p className="gis-hh-empty">Chưa có ghi chú kiểm tra nào.</p>
                )}
              </section>
            </div>
          </div>
        )}

        {/* The centred dialog keeps a footer close button; the map panel closes from its header. */}
        {!drawer && (
          <div className="gis-hh-footer">
            <button type="button" className="gis-hh-btn" disabled={isSaving} onClick={() => requestDiscard('close')}>
              Đóng cửa sổ
            </button>
          </div>
        )}
      </div>

      {/* INSPECTION CAMERA MODAL */}
      <InspectionCameraModal
        isOpen={isCameraModalOpen}
        household={household}
        officerName={household.officerInCharge || currentUser?.fullName || 'CSKV Phụ trách'}
        onClose={() => setIsCameraModalOpen(false)}
        onPhotoSaved={handlePhotoSaved}
      />

      {/* OCR DOCUMENT SCANNER MODAL */}
      <OcrScanModal
        isOpen={isOcrModalOpen}
        household={household}
        officerName={household.officerInCharge || currentUser?.fullName || 'CSKV Phụ trách'}
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
                  aria-label="Đóng ảnh"
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
  return document.fullscreenElement ? createPortal(content, document.fullscreenElement) : content;
};
