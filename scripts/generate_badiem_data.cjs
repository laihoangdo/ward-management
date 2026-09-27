const fs = require('fs');
const path = require('path');

const hamlets = [
  {
    name: 'Ấp Bắc Lân',
    centerLat: 10.8605,
    centerLng: 106.6115,
    streets: ['Đường Phan Văn Hớn', 'Đường Bà Điểm 4', 'Đường Bà Điểm 6', 'Đường Nguyễn Ảnh Thủ'],
    prefix: 'BL'
  },
  {
    name: 'Ấp Nam Lân',
    centerLat: 10.8490,
    centerLng: 106.6120,
    streets: ['Đường Phan Văn Hớn', 'Đường Quốc Lộ 1A', 'Đường Bà Điểm 12', 'Đường Hưng Lân'],
    prefix: 'NL'
  },
  {
    name: 'Ấp Tây Lân',
    centerLat: 10.8550,
    centerLng: 106.6040,
    streets: ['Đường Phan Văn Hớn', 'Đường Bà Điểm 5', 'Đường Bà Điểm 7', 'Đường Quốc Lộ 22'],
    prefix: 'TL'
  },
  {
    name: 'Ấp Đông Lân',
    centerLat: 10.8560,
    centerLng: 106.6200,
    streets: ['Đường Đông Lân - Hưng Lân', 'Đường Quốc Lộ 1A', 'Đường Phan Văn Hớn', 'Đường Bà Điểm 8'],
    prefix: 'DL'
  },
  {
    name: 'Ấp Hậu Lân',
    centerLat: 10.8470,
    centerLng: 106.6190,
    streets: ['Đường Hưng Lân', 'Đường Phan Văn Hớn', 'Đường Quốc Lộ 1A'],
    prefix: 'HL'
  },
  {
    name: 'Ấp Tiền Lân',
    centerLat: 10.8520,
    centerLng: 106.6080,
    streets: ['Đường Phan Văn Hớn', 'Đường Bà Điểm 4', 'Đường Quốc Lộ 22'],
    prefix: 'TLN'
  }
];

const officers = [
  'Đại úy Nguyễn Văn Bình',
  'Thượng úy Lê Hoàng Nam',
  'Trung úy Trần Quốc Tuấn',
  'Đại úy Phạm Minh Đức',
  'Thượng úy Vũ Đình Trọng',
  'Trung úy Đặng Hữu Thắng'
];

const lastNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
const maleMiddleNames = ['Văn', 'Minh', 'Hữu', 'Đức', 'Quốc', 'Thanh', 'Đình', 'Xuân', 'Hoàng', 'Trọng'];
const femaleMiddleNames = ['Thị', 'Thanh', 'Ngọc', 'Thị Mai', 'Hồng', 'Như', 'Phương', 'Bích', 'Kim', 'Thùy'];
const maleFirstNames = ['An', 'Bình', 'Cường', 'Dũng', 'Đức', 'Hải', 'Hiếu', 'Huy', 'Hùng', 'Khoa', 'Long', 'Minh', 'Nam', 'Nghĩa', 'Phúc', 'Quân', 'Sơn', 'Tài', 'Thành', 'Thắng', 'Thịnh', 'Trung', 'Tuấn', 'Tùng', 'Vinh'];
const femaleFirstNames = ['Anh', 'Bích', 'Chi', 'Dung', 'Hà', 'Hạnh', 'Hoa', 'Hương', 'Huyền', 'Lan', 'Linh', 'Mai', 'My', 'Nga', 'Ngân', 'Nhung', 'Oanh', 'Phương', 'Quỳnh', 'Thảo', 'Thu', 'Trang', 'Trâm', 'Tuyết', 'Yến'];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomFullName(gender) {
  const last = getRandomItem(lastNames);
  if (gender === 'Nam' || gender === 'MALE') {
    return `${last} ${getRandomItem(maleMiddleNames)} ${getRandomItem(maleFirstNames)}`;
  } else {
    return `${last} ${getRandomItem(femaleMiddleNames)} ${getRandomItem(femaleFirstNames)}`;
  }
}

function getRandomPhone() {
  const prefixes = ['090', '091', '093', '097', '098', '086', '088', '089'];
  const prefix = getRandomItem(prefixes);
  const rest = Math.floor(1000000 + Math.random() * 9000000);
  return `${prefix}${rest}`.substring(0, 10);
}

function getRandomCccd() {
  const province = '079'; // TP.HCM
  const genderCentury = Math.random() > 0.5 ? '0' : '1';
  const year = String(Math.floor(60 + Math.random() * 45)).padStart(2, '0');
  const seq = String(Math.floor(100000 + Math.random() * 900000));
  return `${province}${genderCentury}${year}${seq}`;
}

const businessTypes = [
  { name: 'Tạp hóa', category: 'Tạp hóa gia đình', prefix: 'Tạp hóa' },
  { name: 'Quán cơm bình dân', category: 'Dịch vụ ăn uống', prefix: 'Quán cơm' },
  { name: 'Tiệm sửa xe máy', category: 'Sửa chữa cơ khí', prefix: 'Sửa xe' },
  { name: 'Quán Cà phê', category: 'Giải khát', prefix: 'Cà phê' },
  { name: 'Tiệm cắt tóc nam nữ', category: 'Dịch vụ cá nhân', prefix: 'Salon tóc' },
  { name: 'Cửa hàng VLXD', category: 'Kinh doanh VLXD', prefix: 'VLXD' },
  { name: 'Tiệm thuốc tây', category: 'Y tế tư nhân', prefix: 'Nhà thuốc' },
  { name: 'Cơ sở may gia công', category: 'Dệt may tiểu thủ công', prefix: 'Cơ sở may' }
];

const boardingHouses = [
  'Nhà trọ Thanh Bình (12 phòng)',
  'Nhà trọ Hưng Phát (8 phòng)',
  'Dãy phòng trọ Cô Sáu (15 phòng)',
  'Nhà trọ Minh Tâm (10 phòng)',
  'Nhà trọ An Phú (6 phòng)',
  'Dãy trọ Hai Lúa (14 phòng)'
];

const religiousPlaces = [
  'Tịnh thất Bửu Quang',
  'Chùa Giác Hoằng',
  'Miếu Bà Ngũ Hành Bà Điểm',
  'Điểm sinh hoạt Tôn giáo Tin Lành'
];

let householdId = 1;
let residentId = 1;

const householdRows = [];
const residentRows = [];

// Header for household.csv
householdRows.push('id;code;house_number;street;hamlet;neighborhood_group;alley;owner_name;owner_phone;type;business_name;business_category;residents_count;male_count;female_count;under_18_count;above_18_count;status;warning_message;license_expiry;license_type;latitude;longitude;notes;last_checked_date;officer_in_charge');

// Header for resident.csv
residentRows.push('id;full_name;id_card_number;birth_year;gender;relationship;residence_type;temporary_registered_at;notes;household_id');

hamlets.forEach((h, hIndex) => {
  const officer = officers[hIndex % officers.length];
  const hamletName = h.name;
  
  // Exactly 60 households per hamlet (Total 6 * 60 = 360 households)
  for (let i = 1; i <= 60; i++) {
    const curHId = householdId++;
    const code = `HK-${h.prefix}-${String(i).padStart(3, '0')}`;
    
    // House number
    const isSub = Math.random() < 0.4;
    const houseNumber = isSub ? `${Math.floor(1 + Math.random() * 200)}/${Math.floor(1 + Math.random() * 25)}` : `${Math.floor(1 + Math.random() * 250)}`;
    const street = getRandomItem(h.streets);
    const groupNum = ((i - 1) % 8) + 1;
    const neighborhoodGroup = `Tổ ${groupNum}`;
    const alley = isSub ? `Hẻm ${houseNumber.split('/')[0]}` : 'Mặt tiền đường';
    
    // Head of household
    const ownerGender = Math.random() > 0.35 ? 'MALE' : 'FEMALE';
    const ownerName = getRandomFullName(ownerGender);
    const ownerPhone = getRandomPhone();
    
    // Type of facility
    let type = 'RESIDENTIAL';
    let businessName = '';
    let businessCategory = '';
    let status = 'NORMAL';
    let warningMessage = '';
    let licenseExpiry = '';
    let licenseType = '';
    
    const randType = Math.random();
    if (randType < 0.15) {
      type = 'BUSINESS';
      const bz = getRandomItem(businessTypes);
      businessName = `${bz.prefix} ${ownerName.split(' ').slice(-1)[0]}`;
      businessCategory = bz.category;
      licenseExpiry = '2027-12-31';
      licenseType = 'Đăng ký kinh doanh cá thể';
      if (Math.random() < 0.2) {
        status = 'WARNING';
        warningMessage = 'Cần gia hạn chứng nhận thẩm duyệt PCCC cơ sở';
      }
    } else if (randType < 0.25) {
      type = 'BOARDING_HOUSE';
      businessName = getRandomItem(boardingHouses);
      businessCategory = 'Cho thuê lưu trú / Nhà trọ';
      licenseExpiry = '2026-12-31';
      licenseType = 'Cam kết đảm bảo ANTT lưu trú';
      if (Math.random() < 0.3) {
        status = 'WARNING';
        warningMessage = 'Có nhân khẩu tạm trú mới chưa nộp tờ khai định danh';
      }
    } else if (randType < 0.27) {
      type = 'RELIGIOUS';
      businessName = getRandomItem(religiousPlaces);
      businessCategory = 'Tôn giáo / Tín ngưỡng';
    } else if (randType < 0.30) {
      type = 'SPECIAL';
      businessName = `Điểm dịch vụ Internet & Game ${i}`;
      businessCategory = 'Dịch vụ Internet công cộng';
      status = 'WARNING';
      warningMessage = 'Cơ sở kinh doanh có điều kiện - kiểm tra định kỳ';
      licenseExpiry = '2026-10-30';
      licenseType = 'Giấy phép cung cấp dịch vụ Internet';
    } else {
      type = 'RESIDENTIAL';
      if (Math.random() < 0.08) {
        status = 'WARNING';
        warningMessage = 'Nhân khẩu vắng mặt tại nơi cư trú quá 12 tháng';
      }
    }
    
    // Residents count: reasonable between 2 and 6
    const residentsCount = Math.floor(2 + Math.random() * 5); // 2, 3, 4, 5, 6
    
    // Distribute male & female
    let maleCount = 1;
    let femaleCount = 1;
    for (let r = 2; r < residentsCount; r++) {
      if (Math.random() > 0.5) maleCount++;
      else femaleCount++;
    }
    
    // Distribute under/above 18 (at least 1 above 18 for head)
    let above18Count = 1;
    let under18Count = 0;
    for (let r = 1; r < residentsCount; r++) {
      if (Math.random() < 0.35) under18Count++;
      else above18Count++;
    }
    
    // Coordinates within Bà Điểm hamlet boundary
    const latOffset = (Math.random() - 0.5) * 0.007;
    const lngOffset = (Math.random() - 0.5) * 0.008;
    const lat = (h.centerLat + latOffset).toFixed(6);
    const lng = (h.centerLng + lngOffset).toFixed(6);
    
    // Notes
    let notes = 'Hộ dân cư trú ổn định, chấp hành nghiêm quy định pháp luật và an ninh trật tự.';
    if (type === 'BUSINESS') {
      notes = 'Cơ sở kinh doanh mặt tiền đường, đã ký cam kết đảm bảo an toàn PCCC và ANTT.';
    } else if (type === 'BOARDING_HOUSE') {
      notes = 'Nhà trọ người lao động, định kỳ kiểm tra sổ khai báo lưu trú qua Cổng VNeID.';
    } else if (status === 'WARNING') {
      notes = `CSKV đã lập biên bản nhắc nhở: ${warningMessage}.`;
    }
    
    const lastCheckedDate = `2026-09-${String(Math.floor(1 + Math.random() * 26)).padStart(2, '0')}`;
    
    householdRows.push(
      [
        curHId,
        code,
        houseNumber,
        street,
        hamletName,
        neighborhoodGroup,
        alley,
        ownerName,
        ownerPhone,
        type,
        businessName,
        businessCategory,
        residentsCount,
        maleCount,
        femaleCount,
        under18Count,
        above18Count,
        status,
        warningMessage,
        licenseExpiry,
        licenseType,
        lat,
        lng,
        notes,
        lastCheckedDate,
        officer
      ].join(';')
    );
    
    // Now generate residents for this household
    // 1. Head of household
    const ownerBirthYear = Math.floor(1960 + Math.random() * 30); // 1960-1990
    residentRows.push([
      residentId++,
      ownerName,
      getRandomCccd(),
      ownerBirthYear,
      ownerGender,
      'Chủ hộ',
      'PERMANENT',
      '',
      `Chủ hộ ${code}, thường trú tại ${hamletName}, Xã Bà Điểm`,
      curHId
    ].join(';'));
    
    // 2. Spouse (if residentsCount >= 2)
    if (residentsCount >= 2) {
      const spouseGender = ownerGender === 'MALE' ? 'FEMALE' : 'MALE';
      const spouseName = getRandomFullName(spouseGender);
      const spouseBirthYear = ownerBirthYear + Math.floor(-3 + Math.random() * 6);
      residentRows.push([
        residentId++,
        spouseName,
        getRandomCccd(),
        spouseBirthYear,
        spouseGender,
        ownerGender === 'MALE' ? 'Vợ' : 'Chồng',
        'PERMANENT',
        '',
        `Vợ/Chồng cùng hộ gia đình ${code}`,
        curHId
      ].join(';'));
    }
    
    // 3. Children / other relatives
    for (let c = 2; c < residentsCount; c++) {
      const isChild = c < 4;
      const childGender = Math.random() > 0.5 ? 'MALE' : 'FEMALE';
      const childName = getRandomFullName(childGender);
      let childBirthYear = 2005 + Math.floor(Math.random() * 18); // 2005 - 2023
      let rel = childGender === 'MALE' ? 'Con trai' : 'Con gái';
      let resType = 'PERMANENT';
      
      if (!isChild) {
        if (Math.random() > 0.5) {
          rel = childGender === 'MALE' ? 'Bố đẻ' : 'Mẹ đẻ';
          childBirthYear = ownerBirthYear - Math.floor(22 + Math.random() * 8);
        } else {
          rel = 'Người thuê trọ';
          resType = 'TEMPORARY';
          childBirthYear = 1995 + Math.floor(Math.random() * 15);
        }
      }
      
      residentRows.push([
        residentId++,
        childName,
        childBirthYear <= 2012 ? getRandomCccd() : '',
        childBirthYear,
        childGender,
        rel,
        resType,
        resType === 'TEMPORARY' ? '2026-08-15' : '',
        `Nhân khẩu thành viên thuộc hộ ${code}`,
        curHId
      ].join(';'));
    }
  }
});

const outHouseholdPath = path.join(__dirname, '../src/main/resources/config/liquibase/fake-data/household.csv');
const outResidentPath = path.join(__dirname, '../src/main/resources/config/liquibase/fake-data/resident.csv');

fs.writeFileSync(outHouseholdPath, householdRows.join('\n'), 'utf8');
fs.writeFileSync(outResidentPath, residentRows.join('\n'), 'utf8');

console.log(`Successfully generated ${householdRows.length - 1} households and ${residentRows.length - 1} residents for Xã Bà Điểm, Hóc Môn!`);
