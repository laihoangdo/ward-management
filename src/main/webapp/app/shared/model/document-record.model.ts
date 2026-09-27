export interface IDocumentRecord {
  id?: number;
  docName?: string;
  docType?: string;
  householdName?: string | null;
  address?: string | null;
  status?: string | null;
  expiryDate?: string | null;
  officer?: string | null;
  phone?: string | null;
  notes?: string | null;
  reminderSent?: boolean | null;
}

export const defaultValue: Readonly<IDocumentRecord> = {
  reminderSent: false,
};
