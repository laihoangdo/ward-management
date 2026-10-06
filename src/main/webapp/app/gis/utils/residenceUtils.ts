import { HouseholdFacility, ResidenceType } from '../types';

/**
 * Determines the residence type of a household: 'Thường trú' | 'Tạm trú' | 'Lưu trú'
 * Prioritizes explicit residenceType field, then analyzes resident roster and notes.
 */
export function getHouseholdResidenceType(household: HouseholdFacility): ResidenceType {
  if (household.residenceType) {
    return household.residenceType;
  }

  // Check resident roster if available
  if (household.residentsList && household.residentsList.length > 0) {
    const hasLuuTru = household.residentsList.some(r => r.residenceType === 'Lưu trú');
    if (hasLuuTru) return 'Lưu trú';

    const hasTamTru = household.residentsList.some(r => r.residenceType === 'Tạm trú');
    if (hasTamTru) return 'Tạm trú';

    return 'Thường trú';
  }

  // Check notes or business characteristics
  const notes = (household.notes || '').toLowerCase();
  if (notes.includes('lưu trú') || notes.includes('khách sạn') || notes.includes('nhà nghỉ')) {
    return 'Lưu trú';
  }
  if (notes.includes('tạm trú') || notes.includes('thuê trọ') || notes.includes('phòng trọ') || notes.includes('công nhân')) {
    return 'Tạm trú';
  }

  return 'Thường trú';
}

/**
 * Visual styling tokens for residence badges and chips
 */
export const RESIDENCE_TYPE_CONFIG: Record<
  ResidenceType,
  {
    label: string;
    description: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    dotBg: string;
    activeChipBg: string;
    activeChipText: string;
    activeChipBorder: string;
    activeChipRing: string;
    inactiveChipBg: string;
    inactiveChipText: string;
    inactiveChipBorder: string;
    inactiveChipHover: string;
  }
> = {
  'Thường trú': {
    label: 'Thường trú',
    description: 'Hộ dân đăng ký thường trú ổn định lâu dài',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    badgeBorder: 'border-emerald-200/80 dark:border-emerald-800',
    dotBg: 'bg-emerald-500',
    activeChipBg: 'bg-emerald-600 dark:bg-emerald-600',
    activeChipText: 'text-white',
    activeChipBorder: 'border-emerald-600 dark:border-emerald-500',
    activeChipRing: 'ring-2 ring-emerald-500/25',
    inactiveChipBg: 'bg-emerald-50/70 dark:bg-emerald-950/50',
    inactiveChipText: 'text-emerald-800 dark:text-emerald-300',
    inactiveChipBorder: 'border-emerald-200 dark:border-emerald-800/80',
    inactiveChipHover: 'hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60',
  },
  'Tạm trú': {
    label: 'Tạm trú',
    description: 'Hộ/Nhân khẩu đăng ký tạm trú có thời hạn',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/60',
    badgeText: 'text-amber-800 dark:text-amber-300',
    badgeBorder: 'border-amber-200/80 dark:border-amber-800',
    dotBg: 'bg-amber-500',
    activeChipBg: 'bg-amber-600 dark:bg-amber-600',
    activeChipText: 'text-white',
    activeChipBorder: 'border-amber-600 dark:border-amber-500',
    activeChipRing: 'ring-2 ring-amber-500/25',
    inactiveChipBg: 'bg-amber-50/70 dark:bg-amber-950/50',
    inactiveChipText: 'text-amber-900 dark:text-amber-300',
    inactiveChipBorder: 'border-amber-200 dark:border-amber-800/80',
    inactiveChipHover: 'hover:bg-amber-100/80 dark:hover:bg-amber-900/60',
  },
  'Lưu trú': {
    label: 'Lưu trú',
    description: 'Cơ sở/Người lưu trú ngắn hạn, nhà trọ, công nhân KCN',
    badgeBg: 'bg-purple-50 dark:bg-purple-950/60',
    badgeText: 'text-purple-700 dark:text-purple-300',
    badgeBorder: 'border-purple-200/80 dark:border-purple-800',
    dotBg: 'bg-purple-500',
    activeChipBg: 'bg-purple-600 dark:bg-purple-600',
    activeChipText: 'text-white',
    activeChipBorder: 'border-purple-600 dark:border-purple-500',
    activeChipRing: 'ring-2 ring-purple-500/25',
    inactiveChipBg: 'bg-purple-50/70 dark:bg-purple-950/50',
    inactiveChipText: 'text-purple-900 dark:text-purple-300',
    inactiveChipBorder: 'border-purple-200 dark:border-purple-800/80',
    inactiveChipHover: 'hover:bg-purple-100/80 dark:hover:bg-purple-900/60',
  },
};
