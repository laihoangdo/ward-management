export interface IDocumentRecord {
  id?: number;
  docName?: string;
  docType?: string;
  householdName?: string | null;
  address?: string | null;
  status?: string | null;
  expiryDate?: string | null;
  householdId?: number | null;
  expiryOn?: string | null;
  issuedOn?: string | null;
  documentNumber?: string | null;
  issuingAuthority?: string | null;
  version?: number | null;
  officer?: string | null;
  phone?: string | null;
  notes?: string | null;
  reminderSent?: boolean | null;
}

export const defaultValue: Readonly<IDocumentRecord> = {
  reminderSent: false,
};
