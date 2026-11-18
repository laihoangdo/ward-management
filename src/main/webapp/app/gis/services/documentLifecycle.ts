import axios from 'axios';
import { IDocumentRecord } from 'app/shared/model/document-record.model';
import { DocumentRecord } from '../types';

export interface DocumentCommand {
  requestId: string;
  version?: number;
  householdId: number;
  expiryOn: string;
  issuedOn: string | null;
  documentNumber: string;
  issuingAuthority: string;
  reason: string;
  docName: string;
  docType: string;
}

export function hcmToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dateNumber(value: string | null | undefined): number | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return undefined;
  return date.getTime();
}

export function documentExpiry(expiry: string | null | undefined, today = hcmToday()): Pick<DocumentRecord, 'status' | 'daysRemaining'> {
  const end = dateNumber(expiry),
    start = dateNumber(today);
  if (end === undefined || start === undefined) return { status: 'unverified' };
  const daysRemaining = Math.round((end - start) / 86400000);
  return { status: daysRemaining < 0 ? 'expired' : daysRemaining <= 30 ? 'expiring_soon' : 'valid', daysRemaining };
}

export function mapDocumentDto(dto: IDocumentRecord, today = hcmToday()): DocumentRecord {
  const expiry = dto.householdId ? documentExpiry(dto.expiryOn, today) : { status: 'unverified' as const };
  return {
    id: String(dto.id),
    docCode: dto.documentNumber || `HS-${dto.id}`,
    title: dto.docName || '',
    targetName: dto.householdName || (dto.householdId ? `Hộ #${dto.householdId}` : 'Chưa đối chiếu hộ'),
    address: dto.address || '',
    hamlet: 'Theo hồ sơ hộ đã chọn',
    category: 'license_security',
    categoryLabel: dto.docType || '',
    issueDate: dto.issuedOn || '',
    expiryDate: dto.expiryOn || '',
    expiryOn: dto.expiryOn || undefined,
    legacyExpiryDate: dto.expiryDate || undefined,
    householdId: dto.householdId ?? undefined,
    documentNumber: dto.documentNumber || '',
    issuingAuthority: dto.issuingAuthority || '',
    version: dto.version ?? undefined,
    ...expiry,
    urgency: expiry.status === 'expired' ? 'high' : expiry.status === 'expiring_soon' ? 'medium' : 'normal',
    notes: dto.notes || '',
  };
}

export async function saveLegalDocument(id: string | null, command: DocumentCommand) {
  if (id !== null && !/^\d+$/.test(id)) throw Error('Mã hồ sơ không hợp lệ');
  const { data } = await axios.post<{ id: number }>(
    id === null ? '/api/legal-documents' : `/api/legal-documents/${id}/confirm-or-renew`,
    command,
  );
  if (!Number.isSafeInteger(data.id) || data.id <= 0) throw Error('Máy chủ chưa xác nhận mã hồ sơ hợp lệ.');
  return data.id;
}

export interface DocumentHistoryEntry {
  id: number;
  operation: 'REGISTER' | 'CONFIRM' | 'RENEW';
  actor: string;
  reason: string;
  recorded_at: string;
  previous_expiry: string | null;
  expiry_on: string;
  document_number: string;
  issuing_authority: string;
}

export async function documentHistory(id: string, page: number, signal: AbortSignal) {
  if (!/^\d+$/.test(id)) throw Error('Mã hồ sơ không hợp lệ');
  const { data } = await axios.get<DocumentHistoryEntry[]>(`/api/legal-documents/${id}/history`, { params: { page }, signal });
  return data;
}
