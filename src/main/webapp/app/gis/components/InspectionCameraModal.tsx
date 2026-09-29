import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  X,
  RefreshCw,
  Upload,
  Check,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  Building,
  Store,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  FileText,
  RotateCcw,
  Zap,
  Info,
} from 'lucide-react';
import { HouseholdFacility, InspectionPhoto } from '../types';
import { addInspectionPhotoToHousehold } from '../services/firestoreService';

interface InspectionCameraModalProps {
  isOpen: boolean;
  household: HouseholdFacility | null;
  officerName?: string;
  onClose: () => void;
  onPhotoSaved?: (newPhoto: InspectionPhoto) => void;
}

export const InspectionCameraModal: React.FC<InspectionCameraModalProps> = ({
  isOpen,
  household,
  officerName = 'CSKV Phụ trách',
  onClose,
  onPhotoSaved,
}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [addWatermark, setAddWatermark] = useState<boolean>(true);
  const [category, setCategory] = useState<'facade' | 'business_sign' | 'fire_safety' | 'general'>('facade');
  const [caption, setCaption] = useState<string>('');
  const [isFlashing, setIsFlashing] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stop video tracks helper
  const stopStream = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  // Start video stream
  const startCamera = async (mode: 'environment' | 'user') => {
    stopStream();
    setErrorMessage(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setHasPermission(false);
      setErrorMessage('Trình duyệt không hỗ trợ trực tiếp Web Camera. Bạn có thể sử dụng tính năng tải ảnh từ máy.');
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
    } catch (err: unknown) {
      console.warn('Camera stream error:', err);
      // Fallback try simple video constraint
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        setStream(fallbackStream);
        setHasPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
        }
      } catch (fallbackErr: unknown) {
        setHasPermission(false);
        const errObj = fallbackErr as { name?: string; message?: string };
        if (errObj.name === 'NotAllowedError' || errObj.name === 'PermissionDeniedError') {
          setErrorMessage(
            'Quyền truy cập Camera bị từ chối. Vui lòng cho phép quyền truy cập máy ảnh hoặc sử dụng tính năng tải ảnh từ thư viện.',
          );
        } else if (errObj.name === 'NotFoundError' || errObj.name === 'DevicesNotFoundError') {
          setErrorMessage('Không tìm thấy thiết bị Camera nào trên máy. Bạn có thể tải ảnh chụp sẵn từ thiết bị.');
        } else {
          setErrorMessage('Không thể khởi động Camera. Bạn có thể sử dụng nút tải ảnh từ thiết bị bên dưới.');
        }
      }
    }
  };

  // Handle open/close lifecycle
  useEffect(() => {
    if (isOpen && !capturedImage) {
      startCamera(facingMode);
    } else if (!isOpen) {
      stopStream();
      setCapturedImage(null);
      setCaption('');
      setCategory('facade');
    }
    return () => {
      stopStream();
    };
  }, [isOpen, facingMode]);

  // Set default caption when household changes
  useEffect(() => {
    if (household) {
      if (household.type === 'business') {
        setCaption(`Kiểm tra hiện trạng cơ sở ${household.businessName || ''}`);
        setCategory('business_sign');
      } else {
        setCaption(`Kiểm tra thực địa nhà số ${household.houseNumber} ${household.street}`);
        setCategory('facade');
      }
    }
  }, [household]);

  // Handle modal close
  const handleClose = () => {
    stopStream();
    onClose();
  };

  // Switch camera facing mode
  const handleToggleCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
  };

  // Capture frame from video to canvas with optional administrative watermark
  const handleCapturePhoto = () => {
    if (!videoRef.current) return;

    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 200);

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    // Scale canvas to max 1280 width to keep Firestore doc size optimal
    const maxDimension = 1200;
    let targetWidth = width;
    let targetHeight = height;

    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        targetWidth = maxDimension;
        targetHeight = Math.round((height * maxDimension) / width);
      } else {
        targetHeight = maxDimension;
        targetWidth = Math.round((width * maxDimension) / height);
      }
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw video frame
    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

    // Apply administrative stamp / watermark
    if (addWatermark && household) {
      applyAdministrativeStamp(ctx, targetWidth, targetHeight, household, officerName);
    }

    // Convert to JPEG Base64 (0.8 quality for crisp quality yet lightweight storage)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    setCapturedImage(dataUrl);
    stopStream();
  };

  // Administrative Stamp Helper
  const applyAdministrativeStamp = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    h: HouseholdFacility,
    officer: string,
  ) => {
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    // Bottom dark banner
    const bannerHeight = Math.max(76, Math.round(height * 0.14));
    const bannerY = height - bannerHeight;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(0, bannerY, width, bannerHeight);

    // Red-Gold accent line on top of banner
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, bannerY, width, 4);

    // Text formatting
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`${h.ward ? `CÔNG AN ${h.ward.toUpperCase()}` : 'CÔNG AN ĐỊA BÀN'} • CSKV PHỤ TRÁCH [${h.hamlet}]`, 16, bannerY + 22);

    ctx.font = 'normal 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(
      `Hiện trạng: Số ${h.houseNumber} ${h.street} ${h.businessName ? `(${h.businessName})` : ''} • Chủ hộ: ${h.ownerName}`,
      16,
      bannerY + 42,
    );

    ctx.fillStyle = '#fcd34d';
    ctx.font = 'bold 11px monospace';
    const coordsStr = h.coordinates ? `GPS: [${h.coordinates[0].toFixed(5)}, ${h.coordinates[1].toFixed(5)}]` : '';
    ctx.fillText(`Thời gian chụp: ${timeStr} ${dateStr} • ${officer} • ${coordsStr}`, 16, bannerY + 62);
  };

  // Handle local file upload fallback
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDimension = 1200;
        let targetWidth = img.width;
        let targetHeight = img.height;

        if (img.width > maxDimension || img.height > maxDimension) {
          if (img.width > img.height) {
            targetWidth = maxDimension;
            targetHeight = Math.round((img.height * maxDimension) / img.width);
          } else {
            targetHeight = maxDimension;
            targetWidth = Math.round((img.width * maxDimension) / img.height);
          }
        }

        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          if (addWatermark && household) {
            applyAdministrativeStamp(ctx, targetWidth, targetHeight, household, officerName);
          }
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          setCapturedImage(dataUrl);
          stopStream();
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Retake photo
  const handleRetake = () => {
    setCapturedImage(null);
    startCamera(facingMode);
  };

  // Save to Firestore
  const handleSaveToFirestore = async () => {
    if (!household || !capturedImage) return;

    setIsSaving(true);
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newPhoto: InspectionPhoto = {
      id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      url: capturedImage,
      caption: caption.trim() || `Ảnh kiểm tra hiện trạng số ${household.houseNumber} ${household.street}`,
      timestamp: dateStr,
      takenBy: officerName,
      category,
    };

    try {
      await addInspectionPhotoToHousehold(household.id, newPhoto, household.inspectionPhotos || []);

      if (onPhotoSaved) {
        onPhotoSaved(newPhoto);
      }

      handleClose();
    } catch (err) {
      console.error('Lỗi khi lưu ảnh vào Firestore:', err);
      alert('Không thể lưu ảnh vào Firestore. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !household) return null;

  return (
    <div
      id="modal-inspection-camera-overlay"
      className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-modal-title"
    >
      <div
        id="modal-inspection-camera-container"
        className="relative w-full max-w-2xl bg-slate-900 rounded-3xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col my-auto max-h-[95vh] text-white"
        onClick={e => e.stopPropagation()}
      >
        {/* Flash Effect on capture */}
        {isFlashing && <div className="absolute inset-0 bg-white z-50 pointer-events-none animate-out fade-out duration-200" />}

        {/* Top Header */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/80">
                  {household.code}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {household.hamlet}
                  {household.ward ? ` • ${household.ward}` : ''}
                </span>
              </div>
              <h3 id="camera-modal-title" className="text-sm sm:text-base font-bold text-white mt-0.5 leading-tight">
                Chụp ảnh hiện trạng: Số {household.houseNumber} {household.street}
              </h3>
            </div>
          </div>

          <button
            id="btn-close-camera-modal"
            onClick={handleClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Đóng Camera"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport / Live Stream / Preview */}
        <div className="relative bg-black flex-1 min-h-[320px] max-h-[440px] flex items-center justify-center overflow-hidden">
          {!capturedImage ? (
            <>
              {/* Live Video Feed */}
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

              {/* Viewfinder Framing Overlay */}
              <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6">
                <div className="flex justify-between items-start">
                  <div className="w-7 h-7 border-t-2 border-l-2 border-amber-400 rounded-tl-sm" />
                  <div className="w-7 h-7 border-t-2 border-r-2 border-amber-400 rounded-tr-sm" />
                </div>
                <div className="flex justify-between items-end">
                  <div className="w-7 h-7 border-b-2 border-l-2 border-amber-400 rounded-bl-sm" />
                  <div className="w-7 h-7 border-b-2 border-r-2 border-amber-400 rounded-br-sm" />
                </div>
              </div>

              {/* Watermark Notice Tag on Live View */}
              {addWatermark && (
                <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-amber-500/50 text-[10px] font-mono text-amber-300 flex items-center gap-1.5 shadow-sm">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Đóng dấu công vụ CSKV tự động</span>
                </div>
              )}

              {/* Camera Flip Button */}
              <button
                id="btn-switch-camera"
                onClick={handleToggleCamera}
                className="absolute top-3 right-3 w-10 h-10 rounded-full bg-slate-900/80 backdrop-blur-xs border border-white/20 text-white flex items-center justify-center hover:bg-slate-800 transition-all cursor-pointer shadow-lg"
                title="Đổi camera trước/sau"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              {/* Fallback error message if camera denied/unavailable */}
              {errorMessage && (
                <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 bg-slate-900/95 p-5 rounded-2xl border border-rose-500/60 shadow-2xl text-center space-y-3 z-20">
                  <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
                  <div className="text-sm font-bold text-white">Chưa kích hoạt được Camera</div>
                  <p className="text-xs text-slate-300 leading-relaxed max-w-md mx-auto">{errorMessage}</p>
                  <div className="pt-1 flex items-center justify-center gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Chọn ảnh từ thiết bị</span>
                    </button>
                    <button
                      onClick={() => startCamera(facingMode)}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Thử lại</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Captured Photo Preview */
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              <img src={capturedImage} alt="Ảnh hiện trạng chụp được" className="w-full h-full object-contain" />
              <div className="absolute top-3 left-3 bg-emerald-600/90 text-white px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md">
                <CheckCircle2 className="w-4 h-4" />
                <span>Ảnh đã chụp thành công</span>
              </div>
            </div>
          )}
        </div>

        {/* Hidden File Input for Image Upload / Native Camera invocation */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
          id="camera-file-input"
        />

        {/* Controls & Metadata Form */}
        <div className="p-4 sm:p-5 bg-slate-950 border-t border-slate-800 space-y-3.5 shrink-0">
          {!capturedImage ? (
            /* Capture Controls */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={addWatermark}
                    onChange={e => setAddWatermark(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-slate-300 font-medium">Tự động đóng dấu GPS, Thời gian & Thẩm quyền CSKV lên ảnh</span>
                </label>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-blue-400 hover:text-blue-300 font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Tải ảnh từ máy</span>
                </button>
              </div>

              {/* Shutter Button Row */}
              <div className="flex items-center justify-center gap-6 pt-1">
                <button
                  id="btn-trigger-shutter"
                  onClick={handleCapturePhoto}
                  className="w-16 h-16 sm:w-18 sm:h-18 rounded-full border-4 border-white bg-red-600 hover:bg-red-500 active:scale-95 transition-all shadow-xl shadow-red-600/30 flex items-center justify-center cursor-pointer group"
                  title="Chụp ảnh ngay"
                >
                  <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-white group-hover:scale-90 transition-transform" />
                </button>
              </div>
            </div>
          ) : (
            /* Review & Save Form */
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Category Selection */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Phân loại ảnh kiểm tra:</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="facade">Mặt tiền / Biển số nhà</option>
                    <option value="business_sign">Biển hiệu kinh doanh / Cửa hàng</option>
                    <option value="fire_safety">Trang thiết bị PCCC / Lối thoát nạn</option>
                    <option value="general">Hiện trạng chung / Giấy tờ hồ sơ</option>
                  </select>
                </div>

                {/* Caption / Notes */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Ghi chú ảnh thực địa:</label>
                  <input
                    type="text"
                    value={caption}
                    onChange={e => setCaption(e.target.value)}
                    placeholder="Nhập ghi chú hiện trạng (tùy chọn)..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  id="btn-retake-photo"
                  onClick={handleRetake}
                  disabled={isSaving}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Chụp lại</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClose}
                    disabled={isSaving}
                    className="px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
                  >
                    Hủy
                  </button>

                  <button
                    id="btn-save-photo-firestore"
                    onClick={handleSaveToFirestore}
                    disabled={isSaving}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Đang lưu vào Firestore...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Lưu vào Firestore</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
