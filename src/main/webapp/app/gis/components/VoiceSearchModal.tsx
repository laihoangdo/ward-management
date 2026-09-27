import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Search,
  X,
  Volume2,
  Sparkles,
  Check,
  RotateCcw,
  AlertCircle,
  Radio,
  MapPin,
  Building,
  AlertTriangle,
  UserCheck,
  ExternalLink,
  Edit3,
} from 'lucide-react';

interface VoiceSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplySearch: (query: string) => void;
  currentQuery?: string;
  onAutoNavigateHouseholds?: () => void;
}

// Tactical suggested voice keywords for field officers in P. An Lạc
const QUICK_TACTICAL_KEYWORDS = [
  { label: 'Kinh Dương Vương', icon: MapPin, type: 'street' },
  { label: 'Hồ Học Lãm', icon: MapPin, type: 'street' },
  { label: 'Nguyễn Văn Bình', icon: UserCheck, type: 'resident' },
  { label: 'Karaoke', icon: Building, type: 'business' },
  { label: 'Nhà trọ', icon: Building, type: 'business' },
  { label: 'Khách sạn', icon: Building, type: 'business' },
  { label: 'Cảnh báo', icon: AlertTriangle, type: 'warning' },
  { label: 'Hộ 079', icon: Search, type: 'code' },
];

export const VoiceSearchModal: React.FC<VoiceSearchModalProps> = ({
  isOpen,
  onClose,
  onApplySearch,
  currentQuery = '',
  onAutoNavigateHouseholds,
}) => {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [interimText, setInterimText] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [isPermissionDenied, setIsPermissionDenied] = useState<boolean>(false);

  const recognitionRef = useRef<any>(null);
  const isStartedRef = useRef<boolean>(false);

  // Helper to clean common voice prefixes
  const cleanSpokenQuery = (raw: string): string => {
    let text = raw.trim();
    // Remove punctuation at the end like . , ?
    text = text.replace(/[.,?!]+$/g, '');

    // List of common Vietnamese voice search prefixes
    const prefixes = [
      /^(tìm kiếm hộ dân|tìm kiếm hộ|tìm kiếm cơ sở|tìm kiếm nhà|tìm kiếm)\s+/i,
      /^(tìm hộ dân|tìm hộ|tìm nhà|tìm cơ sở|tìm)\s+/i,
      /^(kiểm tra hộ|kiểm tra nhà|kiểm tra cơ sở|kiểm tra)\s+/i,
      /^(tra cứu hộ|tra cứu cơ sở|tra cứu)\s+/i,
      /^(xem hộ|xem nhà|xem)\s+/i,
      /^(cho tôi xem hộ|cho tôi xem)\s+/i,
      /^(số nhà)\s+/i,
    ];

    for (const prefix of prefixes) {
      if (prefix.test(text)) {
        text = text.replace(prefix, '');
        break;
      }
    }

    return text.trim();
  };

  // Stop listening safely
  const stopListening = () => {
    isStartedRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  // Start Speech Recognition
  const startListening = () => {
    // Prevent double start
    stopListening();

    setErrorMessage(null);
    setIsPermissionDenied(false);

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition ||
      (window as any).mozSpeechRecognition ||
      (window as any).msSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      setErrorMessage(
        'Trình duyệt chưa hỗ trợ Web Speech API trực tiếp hoặc đang chạy trong chế độ bảo mật nghiêm ngặt. Cán bộ có thể gõ nội dung hoặc bấm từ khóa nhanh bên dưới.',
      );
      return;
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(40);
      }

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      recognition.lang = 'vi-VN';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        isStartedRef.current = true;
        setIsListening(true);
        setErrorMessage(null);
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        let finalPhrase = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          if (item.isFinal) {
            finalPhrase += item[0].transcript;
          } else {
            currentInterim += item[0].transcript;
          }
        }

        if (finalPhrase) {
          const cleaned = cleanSpokenQuery(finalPhrase);
          setTranscript(cleaned || finalPhrase);
          setInterimText('');
        } else {
          setInterimText(currentInterim);
        }
      };

      recognition.onerror = (event: any) => {
        const err = event.error;
        console.warn('Speech recognition error event:', err);
        isStartedRef.current = false;
        setIsListening(false);

        if (err === 'not-allowed' || err === 'permission-denied') {
          setIsPermissionDenied(true);
          setErrorMessage(
            'Quyền truy cập Microphone chưa được cấp hoặc bị chặn bởi trình duyệt/iframe. Cán bộ có thể mở ứng dụng trong Tab mới (New Tab) hoặc cấp quyền Micro trên thanh địa chỉ.',
          );
        } else if (err === 'no-speech') {
          setErrorMessage('Chưa nhận diện được âm thanh. Cán bộ vui lòng bấm "Nói lại" và nói rõ ràng vào micro.');
        } else if (err === 'network') {
          setErrorMessage('Lỗi mạng khi kết nối máy chủ nhận diện giọng nói. Vui lòng kiểm tra kết nối.');
        } else if (err === 'aborted') {
          // Normal abort when switching
        } else {
          setErrorMessage(`Lỗi nhận diện (${err}). Vui lòng thử lại hoặc chọn từ khóa nhanh.`);
        }
      };

      recognition.onend = () => {
        isStartedRef.current = false;
        setIsListening(false);
      };

      recognition.start();
    } catch (err: any) {
      console.error('Failed to initialize speech recognition:', err);
      isStartedRef.current = false;
      setIsListening(false);
      setErrorMessage('Không thể khởi động micro: ' + (err?.message || 'Thiết bị hoặc trình duyệt không cho phép.'));
    }
  };

  // Lifecycle when modal opens
  useEffect(() => {
    if (isOpen) {
      setTranscript(currentQuery);
      setInterimText('');
      setErrorMessage(null);
      setIsPermissionDenied(false);

      // Give browser a short tick before starting recognition
      const timer = setTimeout(() => {
        startListening();
      }, 100);

      return () => {
        clearTimeout(timer);
        stopListening();
      };
    } else {
      stopListening();
    }
  }, [isOpen]);

  const handleApply = (finalText: string) => {
    const textToSearch = finalText.trim();
    if (textToSearch) {
      onApplySearch(textToSearch);
      if (onAutoNavigateHouseholds) {
        onAutoNavigateHouseholds();
      }
    }
    stopListening();
    onClose();
  };

  const handleOpenInNewTab = () => {
    try {
      window.open(window.location.href, '_blank');
    } catch (e) {
      console.warn('Cannot open new tab:', e);
    }
  };

  if (!isOpen) return null;

  const activeDisplayQuery = transcript || interimText;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-3.5 sm:p-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-md transition-colors ${
                isListening ? 'bg-rose-500 animate-pulse text-white' : 'bg-blue-600 text-white'
              }`}
            >
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Radio className={`w-2.5 h-2.5 ${isListening ? 'animate-spin' : ''}`} />
                  {isListening ? 'ĐANG LẮNG NGHE (TIẾNG VIỆT)' : 'TÌM KIẾM GIỌNG NÓI'}
                </span>
              </div>
              <h3 className="text-sm font-bold text-white mt-0.5">Trợ lý giọng nói An ninh Địa bàn</h3>
            </div>
          </div>

          <button
            onClick={() => {
              stopListening();
              onClose();
            }}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4">
          {/* Main Visualizer & Mic Pulse */}
          <div className="flex flex-col items-center justify-center py-2 text-center">
            <div className="relative mb-3">
              {/* Animated pulsating circles when listening */}
              {isListening && (
                <>
                  <div className="absolute -inset-4 rounded-full bg-rose-500/20 animate-ping" />
                  <div className="absolute -inset-2 rounded-full bg-rose-500/30 animate-pulse" />
                </>
              )}

              <button
                type="button"
                id="btn-voice-toggle-listening"
                onClick={isListening ? stopListening : startListening}
                className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all cursor-pointer ${
                  isListening
                    ? 'bg-gradient-to-tr from-rose-600 to-red-500 text-white ring-4 ring-rose-300 dark:ring-rose-900 scale-105'
                    : 'bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white'
                }`}
                title={isListening ? 'Nhấn để dừng nhận diện' : 'Nhấn vào để bắt đầu nói'}
              >
                {isListening ? <Mic className="w-9 h-9 animate-bounce" /> : <MicOff className="w-9 h-9" />}
              </button>
            </div>

            {/* Voice Status Text */}
            <div className="space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5">
                <Volume2 className={`w-3.5 h-3.5 ${isListening ? 'text-rose-500' : 'text-slate-400'}`} />
                <span>
                  {isListening
                    ? 'Đang lắng nghe... Nói tên chủ hộ, số nhà, hoặc cơ sở'
                    : transcript
                      ? 'Đã ghi nhận nội dung tìm kiếm'
                      : 'Bấm vào Micro tròn ở trên để bắt đầu nói'}
                </span>
              </h4>

              {/* Dynamic Sound Wave Bars */}
              {isListening && (
                <div className="flex items-center justify-center gap-1 py-1">
                  <span className="w-1 h-3 bg-rose-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-6 bg-rose-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-4 bg-rose-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                  <span className="w-1 h-7 bg-rose-500 rounded-full animate-pulse" style={{ animationDelay: '450ms' }} />
                  <span className="w-1 h-5 bg-rose-500 rounded-full animate-pulse" style={{ animationDelay: '200ms' }} />
                  <span className="w-1 h-8 bg-rose-500 rounded-full animate-pulse" style={{ animationDelay: '350ms' }} />
                  <span className="w-1 h-3 bg-rose-500 rounded-full animate-pulse" style={{ animationDelay: '100ms' }} />
                </div>
              )}
            </div>

            {/* Editable Query Box with Realtime Voice Feedback */}
            <div className="w-full mt-3">
              <div className="relative">
                <input
                  type="text"
                  value={transcript || interimText}
                  onChange={e => {
                    setTranscript(e.target.value);
                    setInterimText('');
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApply(transcript || interimText);
                    }
                  }}
                  placeholder="Nói vào micro hoặc gõ từ khóa tìm kiếm..."
                  className="w-full pl-9 pr-10 py-2.5 text-sm sm:text-base font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white text-slate-900 dark:text-white placeholder-slate-400 text-center shadow-inner transition-colors"
                />
                <Edit3 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                {(transcript || interimText) && (
                  <button
                    type="button"
                    onClick={() => {
                      setTranscript('');
                      setInterimText('');
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                    title="Xóa nhanh"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {interimText && !transcript && (
                <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium mt-1">
                  Đang nhận dạng thời gian thực: "{interimText}"
                </div>
              )}
            </div>
          </div>

          {/* Error Message & Permission guidance */}
          {errorMessage && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl text-amber-800 dark:text-amber-200 text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <div className="flex-1 leading-relaxed">{errorMessage}</div>
              </div>
              {isPermissionDenied && (
                <div className="pt-1 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenInNewTab}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Mở app ở Tab mới để cấp quyền Micro</span>
                  </button>
                  <button
                    type="button"
                    onClick={startListening}
                    className="px-2.5 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 rounded-md text-[11px] font-bold cursor-pointer transition-colors"
                  >
                    Thử lại
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Quick Tactical Keywords for 1-Tap on the Field */}
          <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Từ khóa thực địa mẫu (nhấn để áp dụng ngay):
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {QUICK_TACTICAL_KEYWORDS.map(item => {
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setTranscript(item.label);
                      handleApply(item.label);
                    }}
                    className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <IconComponent className="w-3 h-3 text-slate-400 group-hover:text-blue-500" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={startListening}
              className="px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer min-h-[38px]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Nói lại</span>
            </button>

            {transcript && (
              <button
                type="button"
                onClick={() => {
                  setTranscript('');
                  setInterimText('');
                }}
                className="px-2.5 py-2 text-slate-500 hover:text-rose-600 text-xs font-medium cursor-pointer"
              >
                Xóa chữ
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                stopListening();
                onClose();
              }}
              className="px-3.5 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-bold cursor-pointer"
            >
              Đóng
            </button>

            <button
              id="btn-voice-confirm-search"
              type="button"
              onClick={() => handleApply(transcript || interimText)}
              disabled={!transcript && !interimText}
              className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer min-h-[38px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              <span>Áp dụng tìm kiếm</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
