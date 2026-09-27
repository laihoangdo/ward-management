import React, { useState } from 'react';
import {
  X,
  Move,
  Camera,
  PanelRight,
  Maximize2,
  Layers,
  ShieldAlert,
  Check,
  HelpCircle,
  Sparkles,
  MapPin,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

interface MapQuickGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MapQuickGuideModal: React.FC<MapQuickGuideModalProps> = ({ isOpen, onClose }) => {
  const [dontShowAgain, setDontShowAgain] = useState<boolean>(true);
  const [activeFeatureIndex, setActiveFeatureIndex] = useState<number>(0);

  if (!isOpen) return null;

  const handleFinish = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem('map_quick_guide_seen_v1', 'true');
      } catch (e) {
        console.warn('LocalStorage not available:', e);
      }
    }
    onClose();
  };

  const guideItems = [
    {
      id: 'edit-coords',
      icon: Move,
      color: 'amber',
      badgeBg: 'bg-amber-500',
      tagColor: 'text-amber-700 bg-amber-50 border-amber-200',
      title: 'Đổi tọa độ nhà (Kéo thả thực địa)',
      buttonPreview: (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500 text-white rounded-lg text-xs font-bold shadow-xs">
          <Move className="w-3.5 h-3.5" /> Đổi tọa độ nhà
        </span>
      ),
      description:
        'Nhấp để kích hoạt chế độ chỉnh sửa. Toàn bộ ghim nhà trên bản đồ sẽ cho phép nhấp giữ và kéo thả trực tiếp đến vị trí thực tế chính xác.',
      step: 'Bước 1: Bấm nút "Đổi tọa độ nhà" → Bước 2: Kéo ghim nhà đến vị trí mới → Bước 3: Bấm nút "Hoàn thành" màu xanh để đồng bộ lên hệ thống.',
      tip: 'Ghim đã đổi vị trí sẽ hiển thị nhãn "✓ Đã dời" và viền xanh ngọc bích để bạn dễ kiểm tra trước khi lưu.',
    },
    {
      id: 'capture-map',
      icon: Camera,
      color: 'blue',
      badgeBg: 'bg-blue-600',
      tagColor: 'text-blue-700 bg-blue-50 border-blue-200',
      title: 'Chụp ảnh & Xuất báo cáo nhanh',
      buttonPreview: (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold shadow-xs">
          <Camera className="w-3.5 h-3.5" /> Chụp ảnh
        </span>
      ),
      description:
        'Chụp lại hiện trạng bản đồ số kèm các bộ lọc, vùng đệm an ninh và thông tin hộ gia đình đang hiển thị chỉ với 1 cú nhấp.',
      step: 'Sau khi chụp, hệ thống mở hộp thoại cho phép Tải ảnh PNG chất lượng cao, Sao chép ảnh vào bộ nhớ tạm hoặc In báo cáo trực tiếp.',
      tip: 'Hỗ trợ chia sẻ nhanh qua Zalo, văn bản báo cáo tuần tra chỉ huy địa bàn.',
    },
    {
      id: 'toggle-panel',
      icon: PanelRight,
      color: 'slate',
      badgeBg: 'bg-slate-700',
      tagColor: 'text-slate-700 bg-slate-100 border-slate-200',
      title: 'Ẩn / Hiện bảng chi tiết hộ gia đình',
      buttonPreview: (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold shadow-xs">
          <PanelRight className="w-3.5 h-3.5" /> Ẩn bảng / Hiện bảng
        </span>
      ),
      description:
        'Thu gọn thanh bên phải để mở rộng 100% không gian quan sát bản đồ số, hoặc mở lại để tra cứu hồ sơ nhân khẩu và số điện thoại.',
      step: 'Nhấp trực tiếp vào bất kỳ ghim nhà nào trên bản đồ để bảng chi tiết tự động hiển thị đầy đủ thông tin chủ hộ, hộ khẩu và cảnh báo hồ sơ.',
      tip: 'Bảng chi tiết bao gồm nút gửi nhắc nhở giấy tờ, cập nhật ghi chú an ninh và điều hướng qua các phân hệ.',
    },
    {
      id: 'fullscreen',
      icon: Maximize2,
      color: 'indigo',
      badgeBg: 'bg-slate-900',
      tagColor: 'text-indigo-700 bg-indigo-50 border-indigo-200',
      title: 'Chế độ toàn màn hình (Full Screen)',
      buttonPreview: (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 text-white rounded-lg text-xs font-bold shadow-xs">
          <Maximize2 className="w-3.5 h-3.5" /> Toàn màn hình
        </span>
      ),
      description:
        'Tối đa hóa khung nhìn bản đồ, ẩn các thanh tiêu đề trên trang web, thích hợp cho màn hình lớn phòng trực chỉ huy hoặc máy tính bảng tuần tra.',
      step: 'Ở chế độ toàn màn hình, thanh công cụ điều khiển chuyên dụng sẽ xuất hiện ở phía trên cùng để bạn vẫn thao tác đầy đủ các chức năng.',
      tip: 'Nhấn nút "Thu nhỏ" hoặc phím ESC bất kỳ lúc nào để quay lại giao diện thông thường.',
    },
    {
      id: 'layer-switcher',
      icon: Layers,
      color: 'emerald',
      badgeBg: 'bg-emerald-600',
      tagColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      title: 'Đổi lớp bản đồ (Vệ tinh / Giao thông)',
      buttonPreview: (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-slate-800 border border-slate-300 rounded-lg text-xs font-bold shadow-xs">
          <Layers className="w-3.5 h-3.5 text-emerald-600" /> Vệ tinh / OSM / Topo
        </span>
      ),
      description:
        'Chuyển đổi linh hoạt giữa Bản đồ không ảnh vệ tinh chi tiết (Google Satellite) và Bản đồ giao thông tiêu chuẩn (OpenStreetMap / CartoDB).',
      step: 'Bấm nút biểu tượng lớp bản đồ nổi ở góc phải màn hình để chọn lớp nền hiển thị phù hợp nhất với điều kiện địa hình.',
      tip: 'Ảnh vệ tinh giúp nhận diện chính xác hình dáng mái nhà, cây cối và ngõ hẻm thực tế.',
    },
    {
      id: 'security-zones',
      icon: ShieldAlert,
      color: 'rose',
      badgeBg: 'bg-rose-600',
      tagColor: 'text-rose-700 bg-rose-50 border-rose-200',
      title: 'Vùng cảnh báo an ninh & Bộ lọc',
      buttonPreview: (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold shadow-xs">
          <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> Vùng an ninh (45m - 70m)
        </span>
      ),
      description:
        'Bật hiển thị bán kính an ninh tự động quanh các cơ sở kinh doanh nhạy cảm hoặc hộ có tài liệu tạm trú/căn cước hết hạn.',
      step: 'Kết hợp cùng thanh bộ lọc để lọc theo Ấp 1, Ấp 2, tuyến đường hoặc tìm kiếm nhanh theo số nhà/tên chủ hộ.',
      tip: 'Bán kính đỏ (70m) biểu thị đối tượng cần lưu ý trọng điểm, bán kính vàng (45m) biểu thị trường hợp cần nhắc nhở giấy tờ.',
    },
  ];

  return (
    <div
      id="modal-map-quick-guide-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={handleFinish}
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-title"
    >
      <div
        id="modal-map-quick-guide-content"
        className="relative w-full max-w-4xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between shrink-0 border-b border-slate-700/50">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30 text-slate-950 font-black shrink-0">
              <Sparkles className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  Cán bộ chiến sĩ mới
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline">• Bản đồ số thực địa P. An Lạc</span>
              </div>
              <h2 id="guide-title" className="text-lg sm:text-xl font-black tracking-tight text-white mt-0.5">
                Hướng Dẫn Sử Dụng Nhanh Các Nút Bấm Trên Bản Đồ
              </h2>
            </div>
          </div>

          <button
            id="btn-close-map-guide-x"
            onClick={handleFinish}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-2"
            title="Đóng hướng dẫn"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs (Quick selector for items) */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 overflow-x-auto scrollbar-none flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1 hidden md:inline">Xem tính năng:</span>
          {guideItems.map((item, idx) => {
            const Icon = item.icon;
            const isActive = activeFeatureIndex === idx;
            return (
              <button
                key={item.id}
                onClick={() => setActiveFeatureIndex(idx)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                <span>{item.title.split('(')[0].trim()}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Main Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          {/* Active Highlight Banner */}
          {(() => {
            const active = guideItems[activeFeatureIndex];
            const Icon = active.icon;
            return (
              <div className="p-5 bg-white rounded-2xl border-2 border-indigo-100 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl ${active.badgeBg} text-white flex items-center justify-center shadow-md shrink-0`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${active.tagColor}`}>
                        Tính năng {activeFeatureIndex + 1}/{guideItems.length}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 mt-0.5">{active.title}</h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 hidden sm:inline">Mẫu nút bấm:</span>
                    {active.buttonPreview}
                  </div>
                </div>

                <p className="text-sm text-slate-700 leading-relaxed font-medium">{active.description}</p>

                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 text-xs text-slate-700 space-y-1.5">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <ArrowRight className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Quy trình thao tác:</span>
                  </div>
                  <p className="pl-5 text-slate-600">{active.step}</p>

                  <div className="font-bold text-emerald-800 flex items-center gap-1.5 pt-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Mẹo thực tế:</span>
                  </div>
                  <p className="pl-5 text-emerald-700">{active.tip}</p>
                </div>
              </div>
            );
          })()}

          {/* Grid Overview of all 6 Features */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <span>Danh mục toàn bộ các công cụ bản đồ</span>
              <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full font-bold">6 công cụ</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {guideItems.map((item, idx) => {
                const Icon = item.icon;
                const isSelected = activeFeatureIndex === idx;
                return (
                  <div
                    key={item.id}
                    onClick={() => setActiveFeatureIndex(idx)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer text-left relative flex flex-col justify-between ${
                      isSelected
                        ? 'bg-white border-indigo-500 ring-2 ring-indigo-200 shadow-md'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg ${item.badgeBg} text-white flex items-center justify-center shrink-0`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-bold text-slate-900">{item.title}</span>
                        </div>
                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2 mt-1 leading-relaxed">{item.description}</p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Vị trí nút:</span>
                      {item.buttonPreview}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <label className="flex items-center gap-2.5 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              id="cb-dont-show-map-guide-again"
              checked={dontShowAgain}
              onChange={e => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <span className="font-medium">Không tự động hiển thị lại khi mở bản đồ</span>
          </label>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              id="btn-close-map-guide-later"
              onClick={handleFinish}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Đóng
            </button>

            <button
              id="btn-confirm-map-guide-start"
              onClick={handleFinish}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>Bắt đầu sử dụng bản đồ</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
