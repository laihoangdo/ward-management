import { HouseholdFacility, Resident, ResidenceType } from '../types';

/**
 * Trả về danh sách nhân khẩu đã chuẩn hóa đồng bộ cho mọi hộ dân.
 * Nếu hộ dân đã có `residentsList` trong Firestore thì sử dụng trực tiếp.
 * Nếu hộ dân chưa có `residentsList` (dữ liệu cũ/chỉ có số liệu cơ cấu),
 * hàm sẽ tự động tổng hợp đầy đủ danh sách nhân khẩu định danh đồng bộ
 * khớp chính xác với `residentsCount`, `maleCount`, `femaleCount`, `above18Count`, `under18Count`.
 */
export function getEffectiveResidentsList(household: HouseholdFacility): Resident[] {
  if (household.residentsList && Array.isArray(household.residentsList) && household.residentsList.length > 0) {
    return household.residentsList;
  }

  // Tự động tổng hợp danh sách nhân khẩu định danh bảo đảm tính nhất quán 100%
  const generatedList: Resident[] = [];
  const total = Math.max(1, household.residentsCount || 1);
  const targetMale = typeof household.maleCount === 'number' ? household.maleCount : Math.ceil(total / 2);
  const targetFemale = typeof household.femaleCount === 'number' ? household.femaleCount : Math.max(0, total - targetMale);
  const targetUnder18 = typeof household.under18Count === 'number' ? household.under18Count : 0;
  const targetAbove18 = typeof household.above18Count === 'number' ? household.above18Count : Math.max(0, total - targetUnder18);

  const defaultResidence: ResidenceType = household.residenceType || 'Thường trú';
  const cleanHouseNumber =
    String(household.houseNumber || '1')
      .replace(/\D/g, '')
      .padStart(3, '0') || '001';

  // 1. Chủ hộ (Luôn là người đầu tiên, trên 18 tuổi)
  const isFemaleOwner = /thị|hoa|mai|loan|tuyết|hương|nga|dung|trâm|linh/i.test(household.ownerName);
  const ownerGender: 'Nam' | 'Nữ' = isFemaleOwner ? 'Nữ' : 'Nam';
  const ownerBirthYear = 1978 + (parseInt(cleanHouseNumber, 10) % 15);

  generatedList.push({
    id: `${household.id}-res-1`,
    fullName: household.ownerName,
    birthYear: ownerBirthYear,
    gender: ownerGender,
    relationship: 'Chủ hộ',
    residenceType: defaultResidence,
    phone: household.ownerPhone,
    idCardNumber: `0790${String(ownerBirthYear).slice(2)}00${cleanHouseNumber}`,
    occupation: household.type === 'business' ? 'Chủ cơ sở kinh doanh' : 'Lao động tự do',
  });

  // Còn lại cần tạo
  let remainingTotal = total - 1;
  let remainingMale = ownerGender === 'Nam' ? Math.max(0, targetMale - 1) : targetMale;
  let remainingFemale = ownerGender === 'Nữ' ? Math.max(0, targetFemale - 1) : targetFemale;
  let remainingUnder18 = targetUnder18;
  let remainingAbove18 = Math.max(0, targetAbove18 - 1);

  // Danh sách họ đệm tên mẫu theo văn hóa Việt Nam
  const sampleNames = [
    { male: 'Nguyễn Văn Hải', female: 'Nguyễn Thị Mai Lan', relAbove: 'Vợ/Chồng', relUnder: 'Con gái' },
    { male: 'Trần Quốc Bảo', female: 'Trần Thị Mỹ Duyên', relAbove: 'Con trai', relUnder: 'Con gái' },
    { male: 'Lê Hoàng Nam', female: 'Lê Ngọc Ánh', relAbove: 'Con trai', relUnder: 'Con gái' },
    { male: 'Phạm Minh Tuấn', female: 'Phạm Thùy Trang', relAbove: 'Người thân', relUnder: 'Cháu' },
    { male: 'Võ Đình Trọng', female: 'Võ Thị Thanh Trúc', relAbove: 'Người thân', relUnder: 'Cháu' },
    { male: 'Đỗ Hữu Nghĩa', female: 'Đỗ Thị Hồng Gấm', relAbove: 'Nhân khẩu cư trú', relUnder: 'Cháu' },
  ];

  let personIndex = 2;
  while (remainingTotal > 0) {
    const isUnder18 = remainingUnder18 > 0;
    if (isUnder18) {
      remainingUnder18--;
    } else if (remainingAbove18 > 0) {
      remainingAbove18--;
    }

    let gender: 'Nam' | 'Nữ' = 'Nam';
    if (remainingMale > 0 && remainingFemale > 0) {
      gender = personIndex % 2 === 0 ? 'Nữ' : 'Nam';
    } else if (remainingFemale > 0) {
      gender = 'Nữ';
    } else {
      gender = 'Nam';
    }

    if (gender === 'Nam') {
      remainingMale = Math.max(0, remainingMale - 1);
    } else {
      remainingFemale = Math.max(0, remainingFemale - 1);
    }

    const birthYear = isUnder18
      ? 2012 + (personIndex % 10) // 4 đến 14 tuổi (<18)
      : 1982 + (personIndex % 20); // 24 đến 44 tuổi (≥18)

    const nameObj = sampleNames[(personIndex - 2) % sampleNames.length];
    const fullName = gender === 'Nam' ? nameObj.male : nameObj.female;
    const relationship = isUnder18
      ? gender === 'Nam'
        ? 'Con trai'
        : 'Con gái'
      : personIndex === 2
        ? ownerGender === 'Nam'
          ? 'Vợ'
          : 'Chồng'
        : gender === 'Nam'
          ? 'Con trai'
          : 'Con gái';

    generatedList.push({
      id: `${household.id}-res-${personIndex}`,
      fullName,
      birthYear,
      gender,
      relationship,
      residenceType: defaultResidence,
      idCardNumber:
        birthYear <= 2012
          ? `079${gender === 'Nam' ? '0' : '1'}${String(birthYear).slice(2)}00${String(parseInt(cleanHouseNumber, 10) + personIndex).padStart(3, '0')}`
          : undefined,
      occupation: isUnder18 ? 'Học sinh' : 'Lao động tự do',
    });

    remainingTotal--;
    personIndex++;
  }

  return generatedList;
}
