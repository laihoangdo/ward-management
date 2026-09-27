import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  ScanLine,
  FileText,
  CheckCircle,
  AlertTriangle,
  X,
  RefreshCw,
  Sparkles,
  User,
  UserPlus,
  Building,
  Upload,
  ArrowRight,
  ShieldCheck,
  Check,
  RotateCcw,
  Images,
  Info,
  Lock,
} from 'lucide-react';
import { HouseholdFacility, InspectionPhoto, OcrExtractedData, Resident } from '../types';
import { updateHouseholdDataInFirestore, addInspectionPhotoToHousehold } from '../services/firestoreService';
import { encryptCccd, maskCccd } from '../utils/cryptoUtils';

interface OcrScanModalProps {
  isOpen: boolean;
  household: HouseholdFacility;
  officerName: string;
  onClose: () => void;
  onHouseholdUpdated: (updatedHousehold: HouseholdFacility) => void;
}

export const OcrScanModal: React.FC<OcrScanModalProps> = ({ isOpen, household, officerName, onClose, onHouseholdUpdated }) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Selected or captured image
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [docTypeMode, setDocTypeMode] = useState<'auto' | 'cccd' | 'business_license'>('auto');

  // OCR Processing state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [extractedData, setExtractedData] = useState<OcrExtractedData | null>(null);
  const [saveAsInspectionPhoto, setSaveAsInspectionPhoto] = useState<boolean>(true);
  const [applyMode, setApplyMode] = useState<'add_resident' | 'update_owner' | 'update_business'>('add_resident');
  const [relationshipWithHead, setRelationshipWithHead] = useState<string>('Thành viên cư trú');
  const [residenceType, setResidenceType] = useState<'Thường trú' | 'Tạm trú' | 'Lưu trú'>('Thường trú');

  // Saving state
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Helper to stop camera stream
  const stopStream = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  // Start camera
  const startCamera = async (mode: 'environment' | 'user') => {
    stopStream();
    setErrorMessage(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setHasPermission(false);
      setErrorMessage('Thiết bị không hỗ trợ hoặc chặn quyền truy cập Camera trực tiếp. Bạn có thể tải ảnh chụp giấy tờ lên.');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setHasPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.warn('Camera access issue:', err);
      setHasPermission(false);
      setErrorMessage('Không thể mở Camera. Vui lòng cấp quyền máy ảnh trên trình duyệt hoặc tải ảnh từ thư viện.');
    }
  };

  // Lifecycle
  useEffect(() => {
    if (isOpen) {
      setSelectedImage(null);
      setExtractedData(null);
      setSaveSuccess(false);
      setErrorMessage(null);
      startCamera(facingMode);
    } else {
      stopStream();
    }
    return () => {
      stopStream();
    };
  }, [isOpen]);

  // Handle camera switch
  const handleToggleFacing = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Capture image from video
  const handleCaptureFromVideo = () => {
    if (!videoRef.current) return;

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');

      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setSelectedImage(dataUrl);
      stopStream();

      // Trigger OCR automatically
      runOcrExtraction(dataUrl);
    } catch (e: any) {
      console.error('Error capturing from video:', e);
      setErrorMessage('Lỗi khi chụp hình từ Camera: ' + e?.message);
    }
  };

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setSelectedImage(dataUrl);
        stopStream();
        runOcrExtraction(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  // Pick existing photo from household gallery
  const handleSelectExistingPhoto = (photoUrl: string) => {
    setSelectedImage(photoUrl);
    stopStream();
    runOcrExtraction(photoUrl);
  };

  // Call OCR API backend
  const runOcrExtraction = async (imageData: string) => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/ocr/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: imageData,
          documentType: docTypeMode,
          hint: `Hộ ${household.code}, chủ hộ hiện tại: ${household.ownerName}, cơ sở: ${household.businessName || 'Hộ gia đình'}`,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Không thể trích xuất dữ liệu từ ảnh.');
      }

      const data: OcrExtractedData = json.data;
      setExtractedData(data);

      // Auto set suggested apply mode
      if (data.documentType === 'business_license' || household.type === 'business') {
        setApplyMode('update_business');
      } else {
        setApplyMode('add_resident');
      }
    } catch (err: any) {
      console.error('OCR Extraction error:', err);
      setErrorMessage('Không thể hoàn tất quét OCR: ' + (err?.message || 'Lỗi kết nối'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Retake or reset
  const handleRetake = () => {
    setSelectedImage(null);
    setExtractedData(null);
    setSaveSuccess(false);
    setErrorMessage(null);
    startCamera(facingMode);
  };

  // Save to Firestore and update household
  const handleConfirmAndSave = async () => {
    if (!extractedData) return;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const now = new Date();
      const timestamp = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      let updatedHousehold: HouseholdFacility = { ...household };

      if (applyMode === 'add_resident') {
        // Add new resident to household
        const birthYear =
          extractedData.birthYear || (extractedData.dateOfBirth ? parseInt(extractedData.dateOfBirth.split('/').pop() || '1995') : 1995);
        const isMale = extractedData.gender !== 'Nữ';
        const age = now.getFullYear() - birthYear;

        const rawCccd = extractedData.idCardNumber ? extractedData.idCardNumber.trim() : '';
        const encryptedCccd = rawCccd ? await encryptCccd(rawCccd) : '';

        const newResident: Resident = {
          id: 'res_' + Date.now(),
          fullName: extractedData.fullName || 'Chưa rõ tên',
          birthYear,
          gender: extractedData.gender || 'Nam',
          relationship: relationshipWithHead,
          idCardNumber: encryptedCccd,
          residenceType,
          isMonitored: false,
        };

        const updatedResidents = [...(household.residentsList || []), newResident];
        const newTotal = updatedResidents.length;
        const maleCount = updatedResidents.filter(r => r.gender === 'Nam').length;
        const femaleCount = updatedResidents.filter(r => r.gender === 'Nữ').length;
        const above18 = updatedResidents.filter(r => now.getFullYear() - r.birthYear >= 18).length;
        const under18 = updatedResidents.filter(r => now.getFullYear() - r.birthYear < 18).length;

        const partialUpdate: Partial<HouseholdFacility> = {
          residentsList: updatedResidents,
          residentsCount: newTotal,
          maleCount,
          femaleCount,
          above18Count: above18,
          under18Count: under18,
          notes:
            `${household.notes || ''}\n[${timestamp}] Quét OCR thêm nhân khẩu: ${newResident.fullName} (CCCD mã hóa AES-256: ${maskCccd(rawCccd)}).`.trim(),
        };

        await updateHouseholdDataInFirestore(household.id, partialUpdate);
        updatedHousehold = { ...updatedHousehold, ...partialUpdate };
      } else if (applyMode === 'update_owner') {
        // Update Household Owner Info
        const partialUpdate: Partial<HouseholdFacility> = {
          ownerName: extractedData.fullName || household.ownerName,
          notes:
            `${household.notes || ''}\n[${timestamp}] Cập nhật chủ hộ qua quét OCR CCCD: ${extractedData.fullName} (CCCD: ${extractedData.idCardNumber || 'N/A'}).`.trim(),
        };

        await updateHouseholdDataInFirestore(household.id, partialUpdate);
        updatedHousehold = { ...updatedHousehold, ...partialUpdate };
      } else if (applyMode === 'update_business') {
        // Update Business info
        const partialUpdate: Partial<HouseholdFacility> = {
          businessName: extractedData.businessName || household.businessName || 'Hộ kinh doanh',
          businessCategory: extractedData.businessLines || household.businessCategory || 'Kinh doanh dịch vụ',
          ownerName: extractedData.legalRepresentative || extractedData.fullName || household.ownerName,
          type: 'business',
          notes:
            `${household.notes || ''}\n[${timestamp}] Cập nhật giấy phép kinh doanh qua OCR: ${extractedData.businessName || ''} (MST: ${extractedData.taxCode || 'N/A'}).`.trim(),
        };

        await updateHouseholdDataInFirestore(household.id, partialUpdate);
        updatedHousehold = { ...updatedHousehold, ...partialUpdate };
      }

      // If user selected to also save the document image to inspection photos
      if (saveAsInspectionPhoto && selectedImage) {
        const photoTitle =
          extractedData.documentType === 'business_license'
            ? `Giấy phép kinh doanh: ${extractedData.businessName || household.code}`
            : `CCCD: ${extractedData.fullName || household.ownerName}`;

        const newPhoto: InspectionPhoto = {
          id: 'photo_ocr_' + Date.now(),
          url: selectedImage,
          caption: photoTitle,
          timestamp,
          takenBy: officerName,
          category: extractedData.documentType === 'business_license' ? 'business_sign' : 'general',
        };

        await addInspectionPhotoToHousehold(household.id, newPhoto, updatedHousehold.inspectionPhotos || []);
        updatedHousehold.inspectionPhotos = [newPhoto, ...(updatedHousehold.inspectionPhotos || [])];
      }

      onHouseholdUpdated(updatedHousehold);
      setSaveSuccess(true);
    } catch (err: any) {
      console.error('Error saving OCR result:', err);
      setErrorMessage('Lỗi khi lưu dữ liệu vào Firestore: ' + (err?.message || 'Thử lại sau.'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const existingPhotos = household.inspectionPhotos || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-md font-bold shrink-0">
              <ScanLine className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 px-2 py-0.5 rounded">
                  AI OCR QUÉT TỰ ĐỘNG
                </span>
                <span className="text-slate-300 text-xs font-semibold">Hộ {household.code}</span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white mt-0.5">
                Trích xuất thông tin Căn cước công dân / Giấy phép kinh doanh
              </h3>
            </div>
          </div>

          <button
            onClick={() => {
              stopStream();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {/* SUCCESS SCREEN */}
          {saveSuccess ? (
            <div className="py-8 px-4 text-center space-y-3 animate-in zoom-in-95 duration-200">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">Cập nhật thông tin thành công vào Firestore!</h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
                {applyMode === 'add_resident'
                  ? `Đã trích xuất và bổ sung nhân khẩu ${extractedData?.fullName || ''} (CCCD: ${extractedData?.idCardNumber || 'N/A'}) vào danh sách cư trú của hộ ${household.code}.`
                  : applyMode === 'update_owner'
                    ? `Đã cập nhật thông tin chủ hộ sang ${extractedData?.fullName || ''} theo ảnh quét CCCD.`
                    : `Đã cập nhật thông tin pháp lý cơ sở kinh doanh ${extractedData?.businessName || ''} (MST: ${extractedData?.taxCode || 'N/A'}).`}
              </p>
              <div className="pt-3">
                <button
                  id="btn-ocr-success-finish"
                  onClick={() => {
                    stopStream();
                    onClose();
                  }}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer inline-flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Hoàn tất & Đóng cửa sổ</span>
                </button>
              </div>
            </div>
          ) : !selectedImage ? (
            /* STEP 1: CAMERA VIEWFINDER & CAPTURE */
            <div className="space-y-4">
              {/* Document Type Filter */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Loại tài liệu cần quét:</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDocTypeMode('auto')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      docTypeMode === 'auto'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Tự động nhận diện
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocTypeMode('cccd')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      docTypeMode === 'cccd'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    CCCD / CMND
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocTypeMode('business_license')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      docTypeMode === 'business_license'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Giấy phép KD
                  </button>
                </div>
              </div>

              {/* Live Video Camera Viewfinder with Document Frame Overlay */}
              <div className="relative aspect-video sm:aspect-[16/10] w-full bg-black rounded-2xl overflow-hidden shadow-inner border border-slate-700 flex items-center justify-center">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

                {/* Document Bounding Box Overlay with Glowing Corners */}
                <div className="absolute inset-4 sm:inset-6 pointer-events-none border-2 border-dashed border-emerald-400/70 rounded-xl flex flex-col justify-between p-2 sm:p-3">
                  {/* Top corners */}
                  <div className="flex justify-between items-start">
                    <div className="w-4 h-4 border-t-2 border-l-2 border-emerald-400" />
                    <div className="text-[10px] sm:text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-slate-950/70 text-emerald-300 backdrop-blur-xs border border-emerald-500/40">
                      CĂN GIẤY TỜ VÀO KHUNG
                    </div>
                    <div className="w-4 h-4 border-t-2 border-r-2 border-emerald-400" />
                  </div>

                  {/* Animated Laser Scanning Line */}
                  <div className="relative w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-pulse my-auto" />

                  {/* Bottom corners */}
                  <div className="flex justify-between items-end">
                    <div className="w-4 h-4 border-b-2 border-l-2 border-emerald-400" />
                    <div className="text-[9px] text-slate-300 bg-slate-900/60 px-2 py-0.5 rounded backdrop-blur-xs">
                      Đảm bảo đủ sáng, rõ chữ, không bị chói lóa
                    </div>
                    <div className="w-4 h-4 border-b-2 border-r-2 border-emerald-400" />
                  </div>
                </div>

                {/* Flip camera control button */}
                <button
                  type="button"
                  onClick={handleToggleFacing}
                  className="absolute top-3 right-3 p-2 bg-slate-900/80 hover:bg-slate-800 text-white rounded-xl border border-slate-700 backdrop-blur-sm transition-all shadow-md cursor-pointer"
                  title="Đổi camera trước/sau"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {/* Action Buttons: Capture / Upload / Pick Existing */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileUpload}
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 cursor-pointer min-h-[42px]"
                  >
                    <Upload className="w-4 h-4 text-slate-500" />
                    <span>Tải ảnh từ máy</span>
                  </button>
                </div>

                {/* Main Capture & Scan Button */}
                <button
                  id="btn-capture-ocr-shot"
                  type="button"
                  onClick={handleCaptureFromVideo}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[42px]"
                >
                  <Camera className="w-4 h-4" />
                  <span>Chụp & Phân Tích OCR Ngay</span>
                </button>
              </div>

              {/* Gallery of already captured inspection photos to pick from */}
              {existingPhotos.length > 0 && (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                    <Images className="w-3.5 h-3.5 text-blue-600" />
                    <span>Hoặc chọn từ ảnh hiện trường đã chụp của hộ này:</span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {existingPhotos.map(p => (
                      <div
                        key={p.id}
                        onClick={() => handleSelectExistingPhoto(p.url)}
                        className="relative w-20 h-14 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 hover:border-emerald-500 cursor-pointer shrink-0 group transition-all"
                        title={p.caption || 'Chọn ảnh này để quét OCR'}
                      >
                        <img src={p.url} alt="Ảnh kiểm tra" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-slate-900/30 group-hover:bg-emerald-950/40 flex items-center justify-center transition-colors">
                          <ScanLine className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : isProcessing ? (
            /* STEP 2: PROCESSING ANIMATION */
            <div className="py-12 px-4 text-center space-y-4">
              <div className="relative w-16 h-16 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-emerald-200 dark:border-emerald-900 animate-ping opacity-25" />
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg">
                  <Sparkles className="w-8 h-8 animate-spin" />
                </div>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-white">Đang phân tích hình ảnh qua AI OCR...</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  Hệ thống đang trích xuất họ tên, số định danh, ngày cấp, địa chỉ cư trú hoặc thông tin giấy phép kinh doanh.
                </p>
              </div>
            </div>
          ) : extractedData ? (
            /* STEP 3: REVIEW & EDIT EXTRACTED DATA */
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Image Preview & Document Type Detected Badge */}
              <div className="flex flex-col sm:flex-row gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="relative w-full sm:w-36 h-28 bg-slate-900 rounded-lg overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">
                  <img src={selectedImage} alt="Ảnh quét" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={handleRetake}
                    className="absolute bottom-1.5 right-1.5 px-2 py-1 bg-slate-900/80 hover:bg-slate-900 text-white rounded text-[10px] font-bold flex items-center gap-1 backdrop-blur-xs"
                  >
                    <RotateCcw className="w-3 h-3" /> Chụp lại
                  </button>
                </div>

                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      {extractedData.documentType === 'business_license'
                        ? '📄 Giấy phép / Đăng ký kinh doanh'
                        : '🪪 Căn cước công dân (CCCD / CMND)'}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">Phát hiện chính xác</span>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Cán bộ vui lòng kiểm tra và chỉnh sửa đối chiếu các trường thông tin bên dưới trước khi đồng bộ vào hồ sơ địa bàn.
                  </div>

                  {/* Apply Mode Selector */}
                  <div className="pt-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Tác vụ:</span>
                    <button
                      type="button"
                      onClick={() => setApplyMode('add_resident')}
                      className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        applyMode === 'add_resident'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600'
                      }`}
                    >
                      + Thêm nhân khẩu cư trú
                    </button>
                    <button
                      type="button"
                      onClick={() => setApplyMode('update_owner')}
                      className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        applyMode === 'update_owner'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600'
                      }`}
                    >
                      Cập nhật Chủ hộ
                    </button>
                    <button
                      type="button"
                      onClick={() => setApplyMode('update_business')}
                      className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        applyMode === 'update_business'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600'
                      }`}
                    >
                      Cập nhật Cơ sở KD
                    </button>
                  </div>
                </div>
              </div>

              {/* Editable Fields Form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Full name or Business name */}
                {applyMode === 'update_business' ? (
                  <>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Tên cơ sở kinh doanh / Doanh nghiệp:
                      </label>
                      <input
                        type="text"
                        value={extractedData.businessName || ''}
                        onChange={e => setExtractedData({ ...extractedData, businessName: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Mã số thuế / Mã số doanh nghiệp:
                      </label>
                      <input
                        type="text"
                        value={extractedData.taxCode || ''}
                        onChange={e => setExtractedData({ ...extractedData, taxCode: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Người đại diện theo pháp luật:
                      </label>
                      <input
                        type="text"
                        value={extractedData.legalRepresentative || ''}
                        onChange={e => setExtractedData({ ...extractedData, legalRepresentative: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Ngành nghề kinh doanh:</label>
                      <input
                        type="text"
                        value={extractedData.businessLines || ''}
                        onChange={e => setExtractedData({ ...extractedData, businessLines: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Họ và tên (viết hoa):</label>
                      <input
                        type="text"
                        value={extractedData.fullName || ''}
                        onChange={e => setExtractedData({ ...extractedData, fullName: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Số CCCD / CMND (12 số):</label>
                      <input
                        type="text"
                        value={extractedData.idCardNumber || ''}
                        onChange={e => setExtractedData({ ...extractedData, idCardNumber: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Ngày sinh (DD/MM/YYYY):</label>
                      <input
                        type="text"
                        value={extractedData.dateOfBirth || ''}
                        onChange={e => {
                          const val = e.target.value;
                          const year = parseInt(val.split('/').pop() || '1995') || 1995;
                          setExtractedData({ ...extractedData, dateOfBirth: val, birthYear: year });
                        }}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Giới tính:</label>
                      <select
                        value={extractedData.gender || 'Nam'}
                        onChange={e => setExtractedData({ ...extractedData, gender: e.target.value as 'Nam' | 'Nữ' })}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white"
                      >
                        <option value="Nam">Nam</option>
                        <option value="Nữ">Nữ</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Nơi thường trú:</label>
                      <input
                        type="text"
                        value={extractedData.permanentAddress || ''}
                        onChange={e => setExtractedData({ ...extractedData, permanentAddress: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                  </>
                )}

                {/* Additional metadata when adding resident */}
                {applyMode === 'add_resident' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Quan hệ với chủ hộ ({household.ownerName}):
                      </label>
                      <select
                        value={relationshipWithHead}
                        onChange={e => setRelationshipWithHead(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white"
                      >
                        <option value="Vợ">Vợ</option>
                        <option value="Chồng">Chồng</option>
                        <option value="Con">Con</option>
                        <option value="Bố/Mẹ">Bố / Mẹ</option>
                        <option value="Anh/Chị/Em">Anh / Chị / Em</option>
                        <option value="Người thuê trọ">Người thuê trọ</option>
                        <option value="Thành viên cư trú">Thành viên cư trú</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Hình thức cư trú:</label>
                      <select
                        value={residenceType}
                        onChange={e => setResidenceType(e.target.value as any)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white"
                      >
                        <option value="Thường trú">Thường trú (HK)</option>
                        <option value="Tạm trú">Tạm trú (KT3 / Đăng ký tạm trú)</option>
                        <option value="Lưu trú">Lưu trú ngắn hạn</option>
                      </select>
                    </div>
                  </>
                )}
              </div>

              {/* Save image checkbox */}
              <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-900 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={saveAsInspectionPhoto}
                    onChange={e => setSaveAsInspectionPhoto(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span>Đồng thời lưu ảnh chụp giấy tờ này vào mục Ảnh kiểm tra của hộ</span>
                </label>
                <span className="text-[10px] text-blue-700 dark:text-blue-300 font-bold bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded">
                  Minh chứng Firestore
                </span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              stopStream();
              onClose();
            }}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs transition-colors cursor-pointer min-h-[38px]"
          >
            Đóng
          </button>

          {extractedData && !saveSuccess && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRetake}
                className="px-3.5 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer min-h-[38px]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Quét lại</span>
              </button>

              <button
                id="btn-save-ocr-to-firestore"
                type="button"
                onClick={handleConfirmAndSave}
                disabled={isSaving}
                className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer min-h-[38px] disabled:opacity-60"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang lưu vào Firestore...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Xác nhận & Cập nhật Hồ Sơ</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
