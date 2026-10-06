import type { OcrExtractedData } from '../types';

export type OcrDocumentMode = 'auto' | 'cccd' | 'business_license';

const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

/** Extract labelled fields only; missing fields must be entered during review. */
export function parseOcrText(text: string, mode: OcrDocumentMode = 'auto', confidence = 0): OcrExtractedData {
  const lines = text
    .normalize('NFC')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  const field = (label: RegExp): string | undefined => {
    for (let index = 0; index < lines.length; index++) {
      const match = fold(lines[index]).match(label);
      if (!match) continue;
      const value = lines[index]
        .slice(match[0].length)
        .replace(/^[\s:/：-]+/, '')
        .trim();
      if (value) return value;
      const next = lines[index + 1];
      if (next && !next.includes(':') && !/^(date of|full name|sex|nationality|place of)/i.test(next)) return next;
    }
    return undefined;
  };
  const date = (value?: string) =>
    value
      ?.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/)
      ?.slice(1)
      .map((part, index) => (index < 2 ? part.padStart(2, '0') : part))
      .join('/');
  const business = /dang ky (doanh nghiep|ho kinh doanh)|giay (chung nhan|phep).*kinh doanh|ma so (thue|doanh nghiep)/.test(fold(text));
  const documentType =
    mode === 'auto' ? (business ? 'business_license' : /can cuoc|chung minh|identity|citizen/.test(fold(text)) ? 'cccd' : 'other') : mode;
  const result: OcrExtractedData = { documentType, rawText: text, confidence };
  if (documentType === 'business_license') {
    result.businessName = field(/^(?:\d+\.\s*)?ten (?:ho kinh doanh|doanh nghiep|cong ty)(?:\s*\([^)]*\))?/);
    result.taxCode = field(/^(?:ma so (?:thue|doanh nghiep|ho kinh doanh)|tax code)/)?.match(/\d{10}(?:-?\d{3})?/)?.[0];
    result.legalRepresentative = field(/^(?:nguoi dai dien(?: theo phap luat)?|chu ho kinh doanh)(?:\s*\/\s*legal representative)?/);
    result.businessAddress = field(/^(?:\d+\.\s*)?dia chi(?: tru so chinh| tru so| kinh doanh)?/);
    result.businessLines = field(/^(?:\d+\.\s*)?nganh(?:,)? nghe(?: kinh doanh)?/);
    result.registeredDate = date(field(/^(?:dang ky lan dau|ngay dang ky)/));
  } else {
    result.idCardNumber = text.match(/(?<!\d)(?:\d{12}|\d{9})(?!\d)/)?.[0];
    result.fullName = field(/^(?:ho va ten|ho,? chu dem va ten|full name)(?:\s*\/\s*full name)?/);
    result.dateOfBirth = date(field(/^(?:ngay(?:,)? thang(?:,)? nam sinh|ngay sinh|date of birth)(?:\s*\/\s*date of birth)?/));
    result.birthYear = result.dateOfBirth ? Number(result.dateOfBirth.split('/')[2]) : undefined;
    const gender = fold(field(/^(?:gioi tinh|sex)(?:\s*\/\s*sex)?/) || '');
    result.gender = /\b(nu|female)\b/.test(gender) ? 'Nữ' : /\b(nam|male)\b/.test(gender) ? 'Nam' : undefined;
    result.hometown = field(/^(?:que quan|place of origin)(?:\s*\/\s*place of origin)?/);
    result.permanentAddress = field(/^(?:noi thuong tru|noi cu tru|place of residence)(?:\s*\/\s*place of residence)?/);
    result.issueDate = date(field(/^(?:ngay cap|date of issue)(?:\s*\/\s*date of issue)?/));
    result.expiryDate = date(field(/^(?:co gia tri den|date of expiry)(?:\s*\/\s*date of expiry)?/));
  }
  return result;
}

/** All engine and language assets are served by this app. Images never leave the browser. */
export async function scanDocument(
  image: string,
  mode: OcrDocumentMode,
  signal: AbortSignal,
  onProgress: (percent: number) => void = () => {},
): Promise<OcrExtractedData> {
  if (!/^data:image\/(png|jpeg|webp);base64,/i.test(image))
    throw new Error('Chỉ hỗ trợ ảnh PNG, JPEG hoặc WebP được tải lên hoặc chụp trên thiết bị.');
  if (image.length > 14 * 1024 * 1024) throw new Error('Ảnh quá lớn. Vui lòng chọn ảnh dưới 10 MB.');
  signal.throwIfAborted();
  const { createWorker, OEM, PSM } = await import('tesseract.js');
  const assetBase = new URL('ocr/', document.baseURI).href;
  const pendingWorker = createWorker(['vie', 'eng'], OEM.LSTM_ONLY, {
    workerPath: `${assetBase}worker.min.js`,
    corePath: `${assetBase}core`,
    langPath: `${assetBase}lang`,
    workerBlobURL: false,
    logger(message) {
      if (!signal.aborted) onProgress(message.status === 'recognizing text' ? Math.round(message.progress * 100) : 0);
    },
  });
  let abortHandler: () => void;
  const aborted = new Promise<never>((_, reject) => {
    abortHandler = () => {
      void pendingWorker.then(
        worker => worker.terminate(),
        () => {},
      );
      reject(new DOMException('Đã hủy nhận dạng.', 'AbortError'));
    };
    signal.addEventListener('abort', abortHandler, { once: true });
    if (signal.aborted) abortHandler();
  });
  try {
    return await Promise.race([
      (async () => {
        const worker = await pendingWorker;
        signal.throwIfAborted();
        try {
          await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
          const { data } = await worker.recognize(image);
          signal.throwIfAborted();
          if (!data.text.trim()) throw new Error('Không đọc được chữ. Hãy chụp lại ảnh rõ nét, đủ sáng.');
          return parseOcrText(data.text, mode, data.confidence);
        } finally {
          await worker.terminate();
        }
      })(),
      aborted,
    ]);
  } finally {
    signal.removeEventListener('abort', abortHandler!);
  }
}
