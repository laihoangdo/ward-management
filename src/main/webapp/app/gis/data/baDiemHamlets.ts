export interface BaDiemHamlet {
  id: number;
  code: string;
  name: string;
  fullName: string;
  group: 'Lân' | 'Trung Chánh' | 'Xuân Thới Thượng';
}

export const BADIEM_51_HAMLETS: BaDiemHamlet[] = [
  // Nhóm các ấp Lân (gốc Bà Điểm cũ) - 25 ấp
  { id: 1, code: '27592-BACLAN', name: 'Bắc Lân', fullName: 'Ấp Bắc Lân', group: 'Lân' },
  { id: 2, code: '27592-BACLAN-1', name: 'Bắc Lân 1', fullName: 'Ấp Bắc Lân 1', group: 'Lân' },
  { id: 3, code: '27592-BACLAN-2', name: 'Bắc Lân 2', fullName: 'Ấp Bắc Lân 2', group: 'Lân' },
  { id: 4, code: '27592-DONGLAN', name: 'Đông Lân', fullName: 'Ấp Đông Lân', group: 'Lân' },
  { id: 5, code: '27592-DONGLAN-1', name: 'Đông Lân 1', fullName: 'Ấp Đông Lân 1', group: 'Lân' },
  { id: 6, code: '27592-DONGLAN-2', name: 'Đông Lân 2', fullName: 'Ấp Đông Lân 2', group: 'Lân' },
  { id: 7, code: '27592-DONGLAN-3', name: 'Đông Lân 3', fullName: 'Ấp Đông Lân 3', group: 'Lân' },
  { id: 8, code: '27592-HAULAN', name: 'Hậu Lân', fullName: 'Ấp Hậu Lân', group: 'Lân' },
  { id: 9, code: '27592-HAULAN-1', name: 'Hậu Lân 1', fullName: 'Ấp Hậu Lân 1', group: 'Lân' },
  { id: 10, code: '27592-HUNGLAN', name: 'Hưng Lân', fullName: 'Ấp Hưng Lân', group: 'Lân' },
  { id: 11, code: '27592-HUNGLAN-1', name: 'Hưng Lân 1', fullName: 'Ấp Hưng Lân 1', group: 'Lân' },
  { id: 12, code: '27592-HUNGLAN-2', name: 'Hưng Lân 2', fullName: 'Ấp Hưng Lân 2', group: 'Lân' },
  { id: 13, code: '27592-NAMLAN', name: 'Nam Lân', fullName: 'Ấp Nam Lân', group: 'Lân' },
  { id: 14, code: '27592-NAMLAN-1', name: 'Nam Lân 1', fullName: 'Ấp Nam Lân 1', group: 'Lân' },
  { id: 15, code: '27592-NAMLAN-2', name: 'Nam Lân 2', fullName: 'Ấp Nam Lân 2', group: 'Lân' },
  { id: 16, code: '27592-TAYLAN', name: 'Tây Lân', fullName: 'Ấp Tây Lân', group: 'Lân' },
  { id: 17, code: '27592-TAYLAN-1', name: 'Tây Lân 1', fullName: 'Ấp Tây Lân 1', group: 'Lân' },
  { id: 18, code: '27592-TAYLAN-2', name: 'Tây Lân 2', fullName: 'Ấp Tây Lân 2', group: 'Lân' },
  { id: 19, code: '27592-TIENLAN', name: 'Tiền Lân', fullName: 'Ấp Tiền Lân', group: 'Lân' },
  { id: 20, code: '27592-TIENLAN-1', name: 'Tiền Lân 1', fullName: 'Ấp Tiền Lân 1', group: 'Lân' },
  { id: 21, code: '27592-TIENLAN-2', name: 'Tiền Lân 2', fullName: 'Ấp Tiền Lân 2', group: 'Lân' },
  { id: 22, code: '27592-TIENLAN-3', name: 'Tiền Lân 3', fullName: 'Ấp Tiền Lân 3', group: 'Lân' },
  { id: 23, code: '27592-TIENLAN-4', name: 'Tiền Lân 4', fullName: 'Ấp Tiền Lân 4', group: 'Lân' },
  { id: 24, code: '27592-TRUNGLAN', name: 'Trung Lân', fullName: 'Ấp Trung Lân', group: 'Lân' },
  { id: 25, code: '27592-TRUNGLAN-1', name: 'Trung Lân 1', fullName: 'Ấp Trung Lân 1', group: 'Lân' },

  // Nhóm các ấp gốc Trung Chánh - 8 ấp
  { id: 26, code: '27592-TRUNGCHANH', name: 'Trung Chánh', fullName: 'Ấp Trung Chánh', group: 'Trung Chánh' },
  { id: 27, code: '27592-TRUNGCHANH-1', name: 'Trung Chánh 1', fullName: 'Ấp Trung Chánh 1', group: 'Trung Chánh' },
  { id: 28, code: '27592-TRUNGCHANH-2', name: 'Trung Chánh 2', fullName: 'Ấp Trung Chánh 2', group: 'Trung Chánh' },
  { id: 29, code: '27592-MOI', name: 'Mới', fullName: 'Ấp Mới', group: 'Trung Chánh' },
  { id: 30, code: '27592-MYHOA', name: 'Mỹ Hòa', fullName: 'Ấp Mỹ Hòa', group: 'Trung Chánh' },
  { id: 31, code: '27592-MYHOA-1', name: 'Mỹ Hòa 1', fullName: 'Ấp Mỹ Hòa 1', group: 'Trung Chánh' },
  { id: 32, code: '27592-MYHUE', name: 'Mỹ Huề', fullName: 'Ấp Mỹ Huề', group: 'Trung Chánh' },
  { id: 33, code: '27592-VANHANH', name: 'Vạn Hạnh', fullName: 'Ấp Vạn Hạnh', group: 'Trung Chánh' },

  // Nhóm các ấp gốc Xuân Thới Thượng - 18 ấp
  { id: 34, code: '27592-XUANTHOITAY', name: 'Xuân Thới Tây', fullName: 'Ấp Xuân Thới Tây', group: 'Xuân Thới Thượng' },
  { id: 35, code: '27592-TANTHOITHUONG', name: 'Tân Thới Thượng', fullName: 'Ấp Tân Thới Thượng', group: 'Xuân Thới Thượng' },
  { id: 36, code: '27592-NGABAGIONG', name: 'Ngã Ba Giồng', fullName: 'Ấp Ngã Ba Giồng', group: 'Xuân Thới Thượng' },
  { id: 37, code: '27592-XTT', name: 'Xuân Thới Thượng', fullName: 'Ấp Xuân Thới Thượng', group: 'Xuân Thới Thượng' },
  { id: 38, code: '27592-XTT-1', name: 'Xuân Thới Thượng 1', fullName: 'Ấp Xuân Thới Thượng 1', group: 'Xuân Thới Thượng' },
  { id: 39, code: '27592-XTT-2', name: 'Xuân Thới Thượng 2', fullName: 'Ấp Xuân Thới Thượng 2', group: 'Xuân Thới Thượng' },
  { id: 40, code: '27592-XTT-3', name: 'Xuân Thới Thượng 3', fullName: 'Ấp Xuân Thới Thượng 3', group: 'Xuân Thới Thượng' },
  { id: 41, code: '27592-XTT-4', name: 'Xuân Thới Thượng 4', fullName: 'Ấp Xuân Thới Thượng 4', group: 'Xuân Thới Thượng' },
  { id: 42, code: '27592-XTT-5', name: 'Xuân Thới Thượng 5', fullName: 'Ấp Xuân Thới Thượng 5', group: 'Xuân Thới Thượng' },
  { id: 43, code: '27592-XTT-6', name: 'Xuân Thới Thượng 6', fullName: 'Ấp Xuân Thới Thượng 6', group: 'Xuân Thới Thượng' },
  { id: 44, code: '27592-XTT-7', name: 'Xuân Thới Thượng 7', fullName: 'Ấp Xuân Thới Thượng 7', group: 'Xuân Thới Thượng' },
  { id: 45, code: '27592-XTT-8', name: 'Xuân Thới Thượng 8', fullName: 'Ấp Xuân Thới Thượng 8', group: 'Xuân Thới Thượng' },
  { id: 46, code: '27592-XTT-9', name: 'Xuân Thới Thượng 9', fullName: 'Ấp Xuân Thới Thượng 9', group: 'Xuân Thới Thượng' },
  { id: 47, code: '27592-XTT-10', name: 'Xuân Thới Thượng 10', fullName: 'Ấp Xuân Thới Thượng 10', group: 'Xuân Thới Thượng' },
  { id: 48, code: '27592-XTT-11', name: 'Xuân Thới Thượng 11', fullName: 'Ấp Xuân Thới Thượng 11', group: 'Xuân Thới Thượng' },
  { id: 49, code: '27592-XTT-12', name: 'Xuân Thới Thượng 12', fullName: 'Ấp Xuân Thới Thượng 12', group: 'Xuân Thới Thượng' },
  { id: 50, code: '27592-XTT-13', name: 'Xuân Thới Thượng 13', fullName: 'Ấp Xuân Thới Thượng 13', group: 'Xuân Thới Thượng' },
  { id: 51, code: '27592-XTT-14', name: 'Xuân Thới Thượng 14', fullName: 'Ấp Xuân Thới Thượng 14', group: 'Xuân Thới Thượng' },
];
