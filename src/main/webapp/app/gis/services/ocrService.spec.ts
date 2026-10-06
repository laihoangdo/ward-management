import { describe, expect, it } from 'vitest';
import { parseOcrText, scanDocument } from './ocrService';

describe('Vietnamese document OCR', () => {
  it('extracts bilingual citizen identity labels without fabricating missing fields', () => {
    const data = parseOcrText(
      `CĂN CƯỚC CÔNG DÂN
Số / No: 012345678901
Họ và tên / Full name:
NGUYỄN VĂN AN
Ngày sinh / Date of birth: 02/03/1990
Giới tính / Sex: Nam
Quê quán / Place of origin: Hà Nội`,
      'auto',
      87,
    );
    expect(data).toMatchObject({
      documentType: 'cccd',
      idCardNumber: '012345678901',
      fullName: 'NGUYỄN VĂN AN',
      dateOfBirth: '02/03/1990',
      birthYear: 1990,
      gender: 'Nam',
      hometown: 'Hà Nội',
      confidence: 87,
    });
    expect(data.issueDate).toBeUndefined();
  });

  it('extracts business records separately from citizen IDs', () => {
    const data = parseOcrText(`GIẤY CHỨNG NHẬN ĐĂNG KÝ HỘ KINH DOANH
Tên hộ kinh doanh: CỬA HÀNG AN
Mã số thuế: 0123456789
Địa chỉ trụ sở: 12 Đường A
Ngành nghề kinh doanh: Bán lẻ
Chủ hộ kinh doanh: NGUYỄN THỊ AN`);
    expect(data).toMatchObject({
      documentType: 'business_license',
      businessName: 'CỬA HÀNG AN',
      taxCode: '0123456789',
      legalRepresentative: 'NGUYỄN THỊ AN',
      businessAddress: '12 Đường A',
      businessLines: 'Bán lẻ',
    });
    expect(data.idCardNumber).toBeUndefined();
  });

  it('leaves unknown documents and missing demographics unset', () => {
    const data = parseOcrText('Một đoạn chữ không có thông tin cá nhân');
    expect(data.documentType).toBe('other');
    expect(data.fullName).toBeUndefined();
    expect(data.birthYear).toBeUndefined();
    expect(data.gender).toBeUndefined();
  });

  it('rejects remote URLs and oversized images before starting a worker', async () => {
    const signal = new AbortController().signal;
    await expect(scanDocument('https://example.com/id.jpg', 'auto', signal)).rejects.toThrow('PNG');
    await expect(scanDocument('data:image/png;base64,' + 'a'.repeat(15 * 1024 * 1024), 'auto', signal)).rejects.toThrow('10 MB');
  });
});
