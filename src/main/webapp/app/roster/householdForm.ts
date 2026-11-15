/**
 * Household edit form shared by the roster household screen and the map record panel, so both send the same fields to
 * PUT /api/roster/households/{id} (the server re-validates every value).
 */
export type HouseholdRow = Record<string, any>;
export type HouseholdField = {
  key: string;
  label: string;
  type?: string;
  options?: string[][];
  required?: boolean;
  /** Shown (and validated) only while this returns true for the current form values. */
  showWhen?: (data: HouseholdRow) => boolean;
};

const text = (v: unknown): string =>
  v == null ? '' : typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? `${v}` : JSON.stringify(v);

// Same codes as the server's FacilityType; establishments carry a name, trade and licence.
export const facilityTypes: string[][] = [
  ['RESIDENTIAL', 'Hộ gia đình'],
  ['BUSINESS', 'Cơ sở kinh doanh'],
  ['BOARDING_HOUSE', 'Nhà trọ / cơ sở lưu trú'],
  ['RELIGIOUS', 'Cơ sở tôn giáo, tín ngưỡng'],
  ['SPECIAL', 'Hộ cần giám sát đặc biệt'],
  ['ENTERPRISE', 'Doanh nghiệp'],
];
export const licenseTypes: string[][] = [
  ['', 'Chưa có / chưa rõ'],
  ['BUSINESS_REGISTRATION', 'Giấy chứng nhận đăng ký kinh doanh'],
  ['SECURITY_CONDITION', 'Giấy chứng nhận đủ điều kiện về ANTT'],
  ['FIRE_SAFETY', 'Giấy chứng nhận / thẩm duyệt PCCC'],
  ['OTHER', 'Giấy phép khác'],
];
export const isEstablishment = (d: HouseholdRow) =>
  ['BUSINESS', 'BOARDING_HOUSE', 'RELIGIOUS', 'ENTERPRISE'].includes(text(d.facilityType));
export const householdFields: HouseholdField[] = [
  { key: 'rawAddress', label: 'Địa chỉ nguyên bản', required: true },
  { key: 'representative', label: 'Tên chủ hộ / người đại diện theo nguồn' },
  { key: 'phone', label: 'Số điện thoại' },
  { key: 'facilityType', label: 'Loại hình cơ sở', options: facilityTypes },
  { key: 'businessName', label: 'Tên cơ sở (biển hiệu)', required: true, showWhen: isEstablishment },
  { key: 'businessCategory', label: 'Ngành nghề kinh doanh / hoạt động', showWhen: isEstablishment },
  {
    // Boarding houses are always conditional (server rule), so the box is only asked for the other establishments.
    key: 'conditional',
    label: 'Ngành nghề kinh doanh có điều kiện về ANTT',
    type: 'checkbox',
    showWhen: d => isEstablishment(d) && text(d.facilityType) !== 'BOARDING_HOUSE',
  },
  { key: 'licenseType', label: 'Loại giấy phép', options: licenseTypes, showWhen: isEstablishment },
  { key: 'licenseNumber', label: 'Số giấy phép', showWhen: d => isEstablishment(d) && Boolean(text(d.licenseType)) },
  {
    key: 'licenseExpiry',
    label: 'Ngày hết hạn giấy phép',
    type: 'date',
    showWhen: d => isEstablishment(d) && Boolean(text(d.licenseType)),
  },
];
export const reasonField: HouseholdField = { key: 'reason', label: 'Lý do / nguồn kiểm chứng', required: true };
/** Fields of "Sửa thông tin hộ": the household fields, case number, verification result and the reason. */
export const householdEditFields: HouseholdField[] = [
  ...householdFields,
  { key: 'caseNumber', label: 'Số hồ sơ cư trú (HSCT)' },
  {
    key: 'verificationStatus',
    label: 'Kết quả đối chiếu hộ',
    options: [
      ['UNVERIFIED', 'Chưa xác minh'],
      ['VERIFIED', 'Đã xác minh hộ'],
      ['HEAD_CONFLICT', 'Cần đối soát chủ hộ'],
    ],
  },
  reasonField,
];
/** Form values for editing a household returned by GET /api/roster/households/{id}. */
export const householdEditInitial = (household: HouseholdRow): HouseholdRow => ({
  rawAddress: household.raw_address,
  verificationStatus: household.verification_status,
  caseNumber: household.source_case_number,
  representative: household.representative_name,
  phone: household.phone,
  facilityType: household.type ?? 'RESIDENTIAL',
  businessName: household.business_name,
  businessCategory: household.business_category,
  licenseType: household.license_type ?? '',
  licenseNumber: household.license_number,
  licenseExpiry: household.license_expiry,
  conditional: household.is_conditional === true,
  version: household.version,
});
