import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Boxes,
  Building2,
  CheckCircle2,
  Crown,
  FileText,
  HelpCircle,
  History,
  LayoutDashboard,
  Map,
  Settings,
  ShieldAlert,
  UserCheck,
  Users,
  X,
  ArrowRight,
} from 'lucide-react';
import { AppUser, DynamicMenuItemConfig, NavigationTab } from '../types';

export interface MenuGuideEntry {
  id: NavigationTab;
  title: string;
  group: string;
  summary: string;
  purpose: string;
  steps: {
    heading: string;
    detail: string;
  }[];
  tips: string[];
}

export const MENU_GUIDES: MenuGuideEntry[] = [
  {
    id: 'overview',
    title: 'Tổng quan & Thống kê',
    group: 'Công việc hằng ngày',
    summary: 'Theo dõi nhanh số liệu hộ dân, nhân khẩu, hộ chú ý/cảnh báo và giấy tờ sắp hết hạn trên địa bàn phụ trách.',
    purpose: 'Giúp chỉ huy và Cảnh sát khu vực nắm bắt toàn cảnh biến động dân cư, tình hình ANTT trong ngày ngay khi đăng nhập hệ thống.',
    steps: [
      {
        heading: '1. Quan sát thẻ chỉ số trọng tâm (KPI)',
        detail:
          'Các thẻ ở hàng đầu hiển thị Tổng số hộ, Tổng nhân khẩu, Hộ cần chú ý/cảnh báo và Hồ sơ sắp hết hạn. Bấm trực tiếp vào từng thẻ để mở nhanh danh sách chi tiết tương ứng.',
      },
      {
        heading: '2. Phân tích biểu đồ & cơ cấu cư trú',
        detail: 'Theo dõi tỷ lệ Thường trú, Tạm trú, Lưu trú và phân bố hộ dân theo từng Ấp để chủ động kế hoạch kiểm tra cư trú định kỳ.',
      },
      {
        heading: '3. Tra cứu nhanh hộ dân cần lưu ý',
        detail: 'Sử dụng bảng danh sách rút gọn bên dưới hoặc ô tìm kiếm trên thanh tiêu đề để mở ngay cửa sổ chi tiết của một hộ dân.',
      },
    ],
    tips: [
      'Bấm nút "Cập nhật" trên thanh công cụ phía trên để làm mới số liệu thống kê tức thời từ máy chủ.',
      'Cán bộ phụ trách ấp nào sẽ tự động nhìn thấy số liệu được khoanh vùng đúng theo ấp được phân công.',
    ],
  },
  {
    id: 'documents',
    title: 'Quản lý giấy tờ & ANTT',
    group: 'Công việc hằng ngày',
    summary: 'Quản lý thời hạn giấy phép ANTT, PCCC, đăng ký kinh doanh, hợp đồng thuê trọ và gửi nhắc hạn.',
    purpose:
      'Ngăn ngừa tình trạng cơ sở kinh doanh hoặc hộ cho thuê trọ hoạt động khi giấy phép đã quá hạn; lưu vết toàn bộ lịch sử gia hạn.',
    steps: [
      {
        heading: '1. Lọc hồ sơ theo trạng thái hiệu lực',
        detail: 'Chọn các bộ lọc "Tất cả", "Sắp hết hạn / Quá hạn" hoặc "Còn hiệu lực" để ưu tiên xử lý các cơ sở sắp đến hạn kiểm tra.',
      },
      {
        heading: '2. Lập hồ sơ mới hoặc Gia hạn giấy tờ',
        detail: 'Bấm "+ Thêm hồ sơ" để đăng ký giấy tờ mới hoặc bấm nút "Gia hạn" trên dòng hồ sơ để cập nhật ngày cấp, ngày hết hạn mới.',
      },
      {
        heading: '3. Xem lịch sử & Gửi nhắc nhở',
        detail: 'Bấm "Lịch sử" để tra cứu các lần gia hạn trước đó; bấm "Nhắc hạn" để ghi nhận thông báo nhắc chủ cơ sở chuẩn bị hồ sơ.',
      },
    ],
    tips: ['Biểu tượng chuông cảnh báo trên thanh tiêu đề hiển thị số lượng trường hợp cần chú ý để cán bộ xử lý kịp thời.'],
  },
  {
    id: 'households',
    title: 'Danh sách hộ dân',
    group: 'Công việc hằng ngày',
    summary: 'Tra cứu, thêm mới, cập nhật hồ sơ hộ gia đình, nhà trọ, cơ sở sản xuất kinh doanh và ghi chú tuần tra.',
    purpose: 'Là phân hệ nghiệp vụ cốt lõi giúp cán bộ quản lý chặt chẽ từng nóc nhà, chủ hộ, số điện thoại liên hệ và tình trạng ANTT.',
    steps: [
      {
        heading: '1. Tìm kiếm & Lọc đa tiêu chí',
        detail:
          'Nhập tên chủ hộ, mã hộ, số nhà, tên đường hoặc SĐT vào ô tìm kiếm; kết hợp chọn Ấp và Trạng thái (Bình thường, Kinh doanh, Chú ý, Cảnh báo).',
      },
      {
        heading: '2. Đăng ký hộ dân mới',
        detail: 'Bấm nút "+ Thêm hộ dân" để mở biểu mẫu khai báo chủ hộ, địa chỉ, tọa độ và danh sách nhân khẩu thành viên trong hộ.',
      },
      {
        heading: '3. Xem chi tiết & Ghi chú kiểm tra thực địa',
        detail:
          'Bấm vào một dòng hộ để mở hồ sơ chi tiết: xem danh sách thành viên, cập nhật "Ghi chú kiểm tra thực địa", sửa thông tin hộ hoặc định vị trên bản đồ.',
      },
    ],
    tips: ['Có thể sử dụng biểu tượng Micro trên ô tìm kiếm để tìm nhanh chủ hộ hoặc địa chỉ bằng giọng nói Tiếng Việt.'],
  },
  {
    id: 'residents',
    title: 'Quản lý nhân khẩu',
    group: 'Công việc hằng ngày',
    summary: 'Tra cứu nhân khẩu toàn địa bàn, đối soát tình trạng cư trú và bảo mật thông tin định danh (CCCD/SĐT).',
    purpose: 'Phục vụ tra cứu nhanh công dân theo tên, năm sinh, nghề nghiệp, tình trạng cư trú và kiểm soát truy cập dữ liệu nhạy cảm.',
    steps: [
      {
        heading: '1. Tra cứu công dân theo thông tin cá nhân',
        detail: 'Tìm theo họ tên, năm sinh, quan hệ với chủ hộ hoặc địa chỉ thường trú/tạm trú trên thanh tìm kiếm của bảng nhân khẩu.',
      },
      {
        heading: '2. Xem thông tin định danh được bảo vệ (CCCD / SĐT)',
        detail:
          'Số CCCD và SĐT được ẩn mặc định (***) để bảo mật. Cán bộ được phân quyền bấm nút mở khóa để hiển thị khi làm việc nghiệp vụ.',
      },
      {
        heading: '3. Mở hồ sơ hộ gốc của nhân khẩu',
        detail: 'Từ dòng nhân khẩu bất kỳ, bấm vào liên kết hộ gia đình để mở toàn bộ hồ sơ hộ và cập nhật biến động nhân khẩu.',
      },
    ],
    tips: ['Nút tắt "Nhân khẩu" luôn có sẵn trên thanh tiêu đề trên cùng để chuyển nhanh sang màn hình này từ bất kỳ menu nào.'],
  },
  {
    id: 'area-map',
    title: 'Bản đồ số hóa khu vực',
    group: 'Địa bàn và bản đồ',
    summary: 'Sơ đồ trực quan phân bố các điểm hộ dân theo ấp, tuyến đường và trạng thái cảnh báo an ninh.',
    purpose: 'Giúp cán bộ hình dung nhanh mật độ dân cư theo từng khu vực/tuyến hẻm và lọc riêng các điểm hộ đang có cảnh báo.',
    steps: [
      {
        heading: '1. Lọc theo khu vực & tuyến đường',
        detail:
          'Chọn Ấp hoặc Tuyến đường trên thanh bộ lọc của sơ đồ; bật công tắc "Chỉ hiện cảnh báo" nếu cần rà soát các mục tiêu trọng điểm.',
      },
      {
        heading: '2. Tương tác với điểm hộ dân',
        detail: 'Bấm vào điểm hộ trên sơ đồ để mở ngăn thông tin bên cạnh, xem nhanh chủ hộ, số nhân khẩu và cập nhật ghi chú tuần tra.',
      },
      {
        heading: '3. Chuyển sang Bản đồ 3D hoặc Toàn màn hình',
        detail: 'Bấm "Bản đồ GIS 3D" để chuyển sang không gian 3D thực địa hoặc bấm "Toàn màn hình" để mở rộng tối đa vùng quan sát.',
      },
    ],
    tips: ['Khi đang gõ từ khóa tìm kiếm trên thanh tiêu đề, sơ đồ sẽ tự động lọc chỉ hiển thị các hộ khớp từ khóa.'],
  },
  {
    id: 'areas',
    title: 'Quản lý khu vực & Tuyến',
    group: 'Địa bàn và bản đồ',
    summary: 'Danh mục các Ấp, Tuyến đường/hẻm và thống kê chi tiết số hộ dân, cơ sở kinh doanh trên từng tuyến.',
    purpose:
      'Hỗ trợ Ban chỉ huy và Cảnh sát khu vực quản lý địa bàn theo tuyến đường, nắm rõ tuyến nào tập trung đông hộ kinh doanh hoặc nhà trọ.',
    steps: [
      {
        heading: '1. Tra cứu danh sách Ấp và Tuyến đường',
        detail: 'Xem danh sách các khu vực/ấp cùng tổng số hộ dân, số nhân khẩu và số trường hợp cần chú ý tại từng khu vực.',
      },
      {
        heading: '2. Xem danh sách hộ dọc theo tuyến',
        detail: 'Bấm chọn một khu vực hoặc tuyến đường để liệt kê toàn bộ các hộ dân thuộc tuyến đó và bấm vào hộ để xem hồ sơ chi tiết.',
      },
    ],
    tips: ['Kết hợp tìm kiếm tên đường để thống kê nhanh tất cả các hộ mặt tiền hoặc trong hẻm thuộc tuyến đó.'],
  },
  {
    id: 'field-3d-map',
    title: 'Bản Đồ Không Gian 3D Thực Địa',
    group: 'Địa bàn và bản đồ',
    summary: 'Bản đồ vệ tinh tích hợp khối nhà 3D, hiệu ứng Three.js theo phạm vi quản lý, vẽ công trình và liên kết hộ dân.',
    purpose:
      'Cung cấp góc nhìn thực địa chân thật nhất với 79.111 công trình, cho phép gắn kết chính xác hồ sơ hộ dân vào từng khối nhà thực tế.',
    steps: [
      {
        heading: '1. Điều khiển góc nhìn 3D & Tìm kiếm nhanh công trình',
        detail:
          'Kéo chuột trái để di chuyển; kéo chuột phải (hoặc giữ Ctrl + kéo chuột trái) để xoay/nghiêng 3D; lăn chuột để zoom. Nhập tên chủ hộ, mã hộ hoặc địa chỉ vào ô "Tìm nhanh chủ hộ, mã hộ, địa chỉ…" trên thanh công cụ để bay thẳng tới khối nhà.',
      },
      {
        heading: '2. Bật Hiệu ứng Three.js theo phạm vi quản lý',
        detail:
          'Bấm nút "Hiệu ứng Three.js": các khối nhà thuộc phạm vi ấp quản lý của cán bộ sẽ hiển thị kiến trúc 3D nhấp nhô (1–5 tầng, mái ngói/mái bằng chân thật), trong khi các khối nhà ngoài phạm vi giữ nguyên.',
      },
      {
        heading: '3. Bật/tắt Layer, Chú giải màu & Lọc trạng thái',
        detail:
          'Mở bảng "Layer & bộ lọc" ở góc trái để bật/tắt Ảnh vệ tinh, Bản đồ đường phố, Ranh giới xã/ấp, lọc theo Trạng thái hộ dân và tra cứu Bảng chú giải màu sắc.',
      },
      {
        heading: '4. Chọn công trình, Sửa thuộc tính, Vẽ mới & Chụp ảnh PNG',
        detail:
          'Click vào khối nhà để mở bảng "Thông tin công trình" bên phải: sửa số tầng/chiều cao (tối đa 20 tầng / 70m), liên kết/gỡ liên kết hộ dân, di chuyển vị trí, bấm "+ Vẽ khối nhà" để chấm đa giác công trình mới hoặc bấm "Chụp ảnh PNG" để xuất ảnh báo cáo có đóng dấu thông tin cán bộ.',
      },
    ],
    tips: [
      'Trên máy tính bảng và điện thoại, bảng "Layer & bộ lọc" tự động thu gọn khi mở bảng thông tin công trình để không che khuất bản đồ.',
    ],
  },
  {
    id: 'logs',
    title: 'Nhật ký thao tác',
    group: 'Lịch sử kiểm tra',
    summary: 'Lưu vết toàn bộ lịch sử cập nhật hồ sơ, chỉnh tọa độ, thêm/xóa hộ và ghi nhận ca tuần tra thực địa.',
    purpose: 'Đảm bảo tính minh bạch, trách nhiệm giải trình trong công tác quản lý cư trú và hỗ trợ tra cứu lịch sử tuần tra địa bàn.',
    steps: [
      {
        heading: '1. Tra cứu & Lọc lịch sử thao tác',
        detail:
          'Lọc theo nhóm nghiệp vụ (Cập nhật hồ sơ, Chỉnh sửa tọa độ, Đăng ký hộ mới, Hệ thống) hoặc tìm theo tên cán bộ thực hiện, mã hộ dân.',
      },
      {
        heading: '2. Ghi nhận nhật ký tuần tra thực địa',
        detail:
          'Bấm nút ghi nhật ký tuần tra để lưu nhanh thời gian, mục tiêu kiểm tra và kết quả tuần tra thực tế vào cơ sở dữ liệu PostgreSQL.',
      },
      {
        heading: '3. Đối chiếu giá trị trước và sau khi sửa',
        detail:
          'Mỗi bản ghi nhật ký hiển thị rõ thời gian, cán bộ thực hiện và nội dung chi tiết thay đổi; bấm vào mục tiêu hộ dân để mở lại hồ sơ đó.',
      },
    ],
    tips: ['Mọi thao tác sửa đổi dữ liệu hộ dân và tọa độ trên bản đồ đều được tự động ghi vào nhật ký này.'],
  },
  {
    id: 'subadmin-delegation',
    title: 'Phân quyền Cán bộ & CAV',
    group: 'Quản trị và phân quyền',
    summary: 'Phân công ấp phụ trách và cấp/thu hồi từng quyền thao tác nghiệp vụ cho Công an viên địa bàn.',
    purpose:
      'Giúp Ban chỉ huy Công an xã và Công an phụ trách ấp kiểm soát chặt chẽ phạm vi địa bàn và thẩm quyền của từng cán bộ cấp dưới.',
    steps: [
      {
        heading: '1. Chọn cán bộ cần phân công',
        detail: 'Tìm và chọn tài khoản Công an viên trong danh sách cán bộ thuộc đơn vị.',
      },
      {
        heading: '2. Gán phạm vi Ấp phụ trách',
        detail:
          'Chọn một hoặc nhiều Ấp giao cho cán bộ quản lý. Cán bộ sẽ chỉ được thao tác dữ liệu và công trình 3D nằm trong ranh giới ấp đã giao.',
      },
      {
        heading: '3. Cấp quyền tính năng hạt mịn',
        detail:
          'Bật/tắt từng quyền cụ thể: Xem bản đồ 3D, Chỉnh sửa tọa độ, Thêm hộ dân mới, Gia hạn giấy tờ, Gửi nhắc hạn, Xem thông tin định danh (CCCD) rồi bấm Lưu.',
      },
    ],
    tips: ['Khi thay đổi phân quyền, phiên làm việc của cán bộ liên quan sẽ tự động đồng bộ quyền mới ngay lập tức.'],
  },
  {
    id: 'superadmin-hub',
    title: 'Trung tâm Quản trị Tối cao',
    group: 'Quản trị và phân quyền',
    summary: 'Quản trị tài khoản toàn hệ thống, cấu hình danh mục đơn vị hành chính, phân quyền menu và giám sát bảo mật.',
    purpose: 'Dành riêng cho Quản trị viên hệ thống (Super Admin) để vận hành hạ tầng phân quyền, tài khoản và an toàn thông tin.',
    steps: [
      {
        heading: '1. Quản lý tài khoản & Danh sách Email được phép',
        detail:
          'Tạo mới, chỉnh sửa vai trò (Super Admin, Trưởng CAX, CA phụ trách Ấp, Công an viên), khóa/mở khóa tài khoản và quản lý whitelist email.',
      },
      {
        heading: '2. Cấu hình Menu điều hành động',
        detail: 'Thiết lập vai trò nào được phép nhìn thấy từng mục menu trên thanh điều hướng bên trái.',
      },
      {
        heading: '3. Giám sát cảnh báo an ninh hệ thống',
        detail: 'Theo dõi các hành vi truy cập trái phép hoặc thao tác vượt thẩm quyền để xử lý hoặc chặn IP kịp thời.',
      },
    ],
    tips: ['Chỉ tài khoản có vai trò Quản trị hệ thống (Super Admin) mới truy cập được phân hệ này.'],
  },
  {
    id: 'settings',
    title: 'Cài đặt & Tài khoản',
    group: 'Tài khoản của tôi',
    summary: 'Cập nhật thông tin cá nhân của cán bộ, chuyển đổi giao diện Sáng/Tối và kiểm tra kết nối máy chủ.',
    purpose:
      'Giúp cán bộ duy trì thông tin hồ sơ cá nhân chính xác (dùng khi trích xuất báo cáo/ảnh chụp bản đồ) và tùy chỉnh chế độ hiển thị phù hợp.',
    steps: [
      {
        heading: '1. Cập nhật thông tin cán bộ',
        detail: 'Chỉnh sửa Họ và tên, Cấp bậc, Số điện thoại liên hệ và bấm Lưu để cập nhật vào cơ sở dữ liệu.',
      },
      {
        heading: '2. Tùy chỉnh giao diện Sáng / Tối',
        detail: 'Chọn Chế độ Sáng (ban ngày) hoặc Chế độ Tối (dịu mắt khi tuần tra ban đêm); cài đặt được tự động ghi nhớ trên thiết bị.',
      },
      {
        heading: '3. Kiểm tra trạng thái máy chủ & phạm vi được giao',
        detail: 'Xem tình trạng kết nối cơ sở dữ liệu PostgreSQL và danh sách các Ấp hiện đang được phân công phụ trách.',
      },
    ],
    tips: [
      'Thông tin Họ tên, Cấp bậc và Đơn vị tại đây sẽ được in tự động lên khung thông tin khi cán bộ chụp ảnh trích xuất PNG trên Bản đồ 3D.',
    ],
  },
];

const GUIDE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  'area-map': Map,
  'field-3d-map': Boxes,
  'bando-3d': Boxes,
  households: Users,
  residents: UserCheck,
  documents: FileText,
  areas: Building2,
  logs: History,
  'subadmin-delegation': ShieldAlert,
  'superadmin-hub': Crown,
  settings: Settings,
};

interface FeatureGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: NavigationTab;
  visibleMenus: DynamicMenuItemConfig[];
  currentUser?: AppUser;
  onNavigateTab?: (tab: NavigationTab) => void;
}

export const FeatureGuideModal: React.FC<FeatureGuideModalProps> = ({ isOpen, onClose, activeTab, visibleMenus, onNavigateTab }) => {
  const availableGuides = useMemo(() => {
    const visibleIds = new Set<NavigationTab>(visibleMenus.map(m => (m.id === 'bando-3d' ? 'field-3d-map' : m.id)));
    const filtered = MENU_GUIDES.filter(g => visibleIds.has(g.id));
    return filtered.length > 0 ? filtered : MENU_GUIDES;
  }, [visibleMenus]);

  const normalizedActiveTab: NavigationTab = activeTab === 'bando-3d' ? 'field-3d-map' : activeTab;
  const [selectedId, setSelectedId] = useState<NavigationTab>(normalizedActiveTab);

  useEffect(() => {
    if (isOpen) {
      const match = availableGuides.find(g => g.id === normalizedActiveTab);
      setSelectedId(match ? match.id : availableGuides[0].id);
    }
  }, [isOpen, normalizedActiveTab, availableGuides]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentGuide = availableGuides.find(g => g.id === selectedId) ?? availableGuides[0];
  const CurrentIcon = GUIDE_ICON_MAP[currentGuide.id] || BookOpen;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feature-guide-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-2.5 sm:p-4 md:p-6"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden text-slate-900 dark:text-slate-100"
        style={{ boxShadow: '0 12px 32px rgb(15 23 42 / 24%)' }} /* taste-skill-ignore: modal dialog thật */
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#1c4e3a] text-white flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id="feature-guide-modal-title" className="text-sm sm:text-base font-bold text-slate-900 dark:text-white m-0 truncate">
                Cẩm Nang Hướng Dẫn Sử Dụng Các Menu Chức Năng
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 m-0 truncate">
                Chọn từng mục menu bên dưới để xem quy trình thao tác chuẩn dành cho Cán bộ quản lý địa bàn ({availableGuides.length} phân
                hệ hiện có)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hướng dẫn sử dụng"
            className="h-9 w-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Left menu list + Right detailed instructions */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {/* Left / Top Navigation List of all available menus */}
          <aside
            aria-label="Danh sách các menu hướng dẫn"
            className="w-full md:w-72 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-2 sm:p-3 overflow-x-auto md:overflow-y-auto shrink-0 flex md:flex-col gap-1.5"
          >
            {availableGuides.map(guide => {
              const Icon = GUIDE_ICON_MAP[guide.id] || HelpCircle;
              const isSelected = guide.id === currentGuide.id;
              const isCurrentScreen = guide.id === normalizedActiveTab;
              return (
                <button
                  key={guide.id}
                  type="button"
                  onClick={() => setSelectedId(guide.id)}
                  className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-left text-xs font-semibold shrink-0 md:w-full cursor-pointer border ${
                    isSelected
                      ? 'bg-[#1c4e3a] text-white border-[#1c4e3a]'
                      : 'bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-700 hover:bg-emerald-50/60 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-[#1c4e3a] dark:text-emerald-400'}`} />
                    <span className="truncate">{guide.title}</span>
                  </div>
                  {isCurrentScreen && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-emerald-100 dark:bg-emerald-950 text-[#1c4e3a] dark:text-emerald-300'
                      }`}
                    >
                      Đang mở
                    </span>
                  )}
                </button>
              );
            })}
          </aside>

          {/* Right Content Area */}
          <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* Guide Banner */}
            <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#1c4e3a] text-white">
                    {currentGuide.group}
                  </span>
                  {currentGuide.id === normalizedActiveTab && (
                    <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">• Phân hệ bạn đang làm việc</span>
                  )}
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white m-0 flex items-center gap-2">
                  <CurrentIcon className="w-5 h-5 text-[#1c4e3a] dark:text-emerald-400 shrink-0" />
                  <span>{currentGuide.title}</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 m-0 leading-relaxed">{currentGuide.summary}</p>
              </div>
              {onNavigateTab && currentGuide.id !== normalizedActiveTab && (
                <button
                  type="button"
                  onClick={() => {
                    onNavigateTab(currentGuide.id);
                    onClose();
                  }}
                  className="px-3.5 py-2 rounded-lg bg-[#1c4e3a] hover:bg-[#153c2c] text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer self-start sm:self-center"
                >
                  <span>Mở phân hệ này</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Purpose */}
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">Mục đích nghiệp vụ</div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 m-0 leading-relaxed">{currentGuide.purpose}</p>
            </div>

            {/* Step-by-step instructions */}
            <div className="space-y-2.5">
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white m-0">Các bước thao tác & tính năng chính</h4>
              <div className="grid grid-cols-1 gap-2.5">
                {currentGuide.steps.map(step => (
                  <div
                    key={step.heading}
                    className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40"
                  >
                    <div className="text-xs sm:text-sm font-bold text-[#1c4e3a] dark:text-emerald-300 mb-1">{step.heading}</div>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 m-0 leading-relaxed">{step.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Practical Tips */}
            {currentGuide.tips.length > 0 && (
              <div className="p-3.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-1.5">
                <div className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-amber-700 dark:text-amber-400" />
                  <span>Mẹo thao tác nhanh cho cán bộ</span>
                </div>
                <ul className="m-0 pl-5 space-y-1 text-xs text-amber-950 dark:text-amber-200">
                  {currentGuide.tips.map(tip => (
                    <li key={tip} className="leading-relaxed">
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Nhấn phím{' '}
            <kbd className="px-1.5 py-0.5 text-[11px] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800">
              Esc
            </kbd>{' '}
            hoặc bấm nút Đóng để quay lại màn hình làm việc
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#1c4e3a] hover:bg-[#153c2c] text-white text-xs font-semibold cursor-pointer"
          >
            Đã hiểu, đóng hướng dẫn
          </button>
        </div>
      </div>
    </div>
  );
};

interface ActiveMenuGuideBannerProps {
  activeTab: NavigationTab;
  onOpenFullGuide: () => void;
}

export const ActiveMenuGuideBanner: React.FC<ActiveMenuGuideBannerProps> = ({ activeTab, onOpenFullGuide }) => {
  const [expanded, setExpanded] = useState(false);
  const normalizedTab: NavigationTab = activeTab === 'bando-3d' ? 'field-3d-map' : activeTab;
  const guide = MENU_GUIDES.find(g => g.id === normalizedTab) ?? MENU_GUIDES[0];

  useEffect(() => {
    setExpanded(false);
  }, [normalizedTab]);

  return (
    <section
      aria-label={`Hướng dẫn sử dụng ${guide.title}`}
      className="mb-3 rounded-xl border border-emerald-200/90 dark:border-emerald-800/70 bg-emerald-50/50 dark:bg-emerald-950/25 px-3.5 py-2.5 text-slate-800 dark:text-slate-100"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#1c4e3a] text-white text-[11px] font-bold shrink-0">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Hướng dẫn</span>
          </span>
          <strong className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white shrink-0">{guide.title}:</strong>
          <span className="text-xs text-slate-600 dark:text-slate-300 truncate">{guide.summary}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded(prev => !prev)}
            className="px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 text-[#1c4e3a] dark:text-emerald-300 text-xs font-semibold cursor-pointer"
          >
            {expanded ? 'Thu gọn các bước' : `Xem ${guide.steps.length} bước thao tác`}
          </button>
          <button
            type="button"
            onClick={onOpenFullGuide}
            className="px-2.5 py-1 rounded-lg bg-[#1c4e3a] hover:bg-[#153c2c] text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Tất cả menu</span>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-emerald-200/80 dark:border-emerald-800/60 space-y-2.5">
          <p className="text-xs text-slate-700 dark:text-slate-300 m-0">
            <strong>Mục đích:</strong> {guide.purpose}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {guide.steps.map(step => (
              <div
                key={step.heading}
                className="p-2.5 rounded-lg bg-white dark:bg-slate-900/80 border border-emerald-200/70 dark:border-slate-700"
              >
                <div className="text-xs font-bold text-[#1c4e3a] dark:text-emerald-300 mb-1">{step.heading}</div>
                <p className="text-xs text-slate-600 dark:text-slate-300 m-0 leading-relaxed">{step.detail}</p>
              </div>
            ))}
          </div>
          {guide.tips.length > 0 && (
            <div className="text-xs text-amber-900 dark:text-amber-300 bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 rounded-lg px-3 py-1.5">
              <strong>Mẹo nhanh:</strong> {guide.tips.join(' • ')}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
