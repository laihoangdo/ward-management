import { collection, doc, getDocs, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db, FIREBASE_PROJECT_ID } from '../firebase';
import { HouseholdFacility, DocumentRecord, OfficerProfile, DEFAULT_OFFICER, InspectionPhoto, AuditLogEntry } from '../types';
import { INITIAL_AUDIT_LOGS } from '../data/initialAuditLogs';
import { encryptCccd } from '../utils/cryptoUtils';
import { getEffectiveResidentsList } from '../utils/residentRosterUtils';

const HOUSEHOLDS_COLLECTION = 'households';
const DOCUMENTS_COLLECTION = 'documents';
const AUDIT_LOGS_COLLECTION = 'auditLogs';
const OFFICER_DOC = 'officerProfile/current';

/**
 * Checks backend and Firestore connection status.
 */
export async function seedInitialFirestoreData(): Promise<boolean> {
  try {
    const res = await fetch('/api/health');
    return res.ok;
  } catch (error) {
    console.warn('Backend service status notice:', error);
    return false;
  }
}

/**
 * Real-time listener for Households
 */
export function subscribeHouseholds(onData: (data: HouseholdFacility[]) => void, onError?: (err: Error) => void) {
  return onSnapshot(
    collection(db, HOUSEHOLDS_COLLECTION),
    snapshot => {
      if (snapshot.empty) {
        onData([]);
      } else {
        const items = snapshot.docs.map(d => {
          const raw = d.data() as HouseholdFacility;
          // Ensure residentsList is consistently populated across all households
          const residents = getEffectiveResidentsList(raw);
          return {
            ...raw,
            residentsList: residents,
          };
        });
        // Keep order consistent by id
        items.sort((a, b) => a.id.localeCompare(b.id));
        onData(items);
      }
    },
    err => {
      console.error('Firestore households subscription error:', err);
      if (onError) onError(err);
    },
  );
}

/**
 * Real-time listener for Documents
 */
export function subscribeDocuments(onData: (data: DocumentRecord[]) => void, onError?: (err: Error) => void) {
  return onSnapshot(
    collection(db, DOCUMENTS_COLLECTION),
    snapshot => {
      if (snapshot.empty) {
        onData([]);
      } else {
        const items = snapshot.docs.map(d => d.data() as DocumentRecord);
        items.sort((a, b) => a.id.localeCompare(b.id));
        onData(items);
      }
    },
    err => {
      console.error('Firestore documents subscription error:', err);
      if (onError) onError(err);
    },
  );
}

/**
 * Real-time listener for Officer Profile
 */
export function subscribeOfficerProfile(onData: (profile: OfficerProfile) => void) {
  return onSnapshot(
    doc(db, 'officerProfile', 'current'),
    snapshot => {
      if (snapshot.exists()) {
        onData(snapshot.data() as OfficerProfile);
      } else {
        onData(DEFAULT_OFFICER);
      }
    },
    err => {
      console.error('Firestore officer profile subscription error:', err);
    },
  );
}

/**
 * Real-time listener for Audit Logs (Nhật ký thao tác)
 */
export function subscribeAuditLogs(onData: (logs: AuditLogEntry[]) => void, onError?: (err: Error) => void) {
  return onSnapshot(
    collection(db, AUDIT_LOGS_COLLECTION),
    snapshot => {
      if (snapshot.empty) {
        // If firestore has no logs yet, fallback to rich initial audit logs
        onData(INITIAL_AUDIT_LOGS);
        // Seed initial audit logs in background if needed
        INITIAL_AUDIT_LOGS.slice(0, 5).forEach(item => {
          setDoc(doc(db, AUDIT_LOGS_COLLECTION, item.id), item).catch(() => {});
        });
      } else {
        const items = snapshot.docs.map(d => d.data() as AuditLogEntry);
        // Sort descending by createdAt (newest logs first)
        items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        onData(items);
      }
    },
    err => {
      console.warn('Firestore audit logs subscription fallback:', err);
      // Fallback to initial seed logs
      onData(INITIAL_AUDIT_LOGS);
      if (onError) onError(err);
    },
  );
}

/**
 * Record an audit log entry in Firestore & sync to backend
 */
export async function addAuditLogInFirestore(log: AuditLogEntry): Promise<void> {
  try {
    const ref = doc(db, AUDIT_LOGS_COLLECTION, log.id);
    await setDoc(ref, log);
  } catch (err) {
    console.warn('Could not write audit log directly to Firestore:', err);
  }

  // Also sync to backend Express API in background
  try {
    fetch('/api/audit-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: log.actionLabel,
        entityType: log.targetType,
        entityId: log.targetId || log.targetCode || 'N/A',
        details: log.details,
        officer: log.officerName,
        logEntry: log,
      }),
    }).catch(() => {});
  } catch {
    // ignore
  }
}

/**
 * Add a new Household to Firestore (with AES encryption for citizen ID / CCCD)
 */
export async function addHouseholdToFirestore(household: HouseholdFacility): Promise<void> {
  const preparedHousehold: HouseholdFacility = { ...household };

  if (preparedHousehold.residentsList && preparedHousehold.residentsList.length > 0) {
    const encryptedResidents = await Promise.all(
      preparedHousehold.residentsList.map(async r => {
        if (r.idCardNumber) {
          const encId = await encryptCccd(r.idCardNumber);
          return { ...r, idCardNumber: encId };
        }
        return r;
      }),
    );
    preparedHousehold.residentsList = encryptedResidents;
  }

  const ref = doc(db, HOUSEHOLDS_COLLECTION, preparedHousehold.id);
  await setDoc(ref, preparedHousehold);
}

/**
 * Update inspection notes for a Household
 */
export async function updateHouseholdNotesInFirestore(id: string, notes: string): Promise<void> {
  const ref = doc(db, HOUSEHOLDS_COLLECTION, id);
  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  await updateDoc(ref, {
    notes,
    lastCheckedDate: dateStr,
  });
}

/**
 * Add an inspection photo to a household in Firestore
 */
export async function addInspectionPhotoToHousehold(
  householdId: string,
  photo: InspectionPhoto,
  currentPhotos: InspectionPhoto[] = [],
): Promise<void> {
  const ref = doc(db, HOUSEHOLDS_COLLECTION, householdId);
  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  const updatedPhotos = [photo, ...(currentPhotos || [])];

  await updateDoc(ref, {
    inspectionPhotos: updatedPhotos,
    lastCheckedDate: dateStr,
  });
}

/**
 * Update arbitrary household data in Firestore (e.g. from OCR extraction)
 */
export async function updateHouseholdDataInFirestore(householdId: string, updates: Partial<HouseholdFacility>): Promise<void> {
  const ref = doc(db, HOUSEHOLDS_COLLECTION, householdId);
  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  const preparedUpdates: Partial<HouseholdFacility> = { ...updates };
  if (preparedUpdates.residentsList && preparedUpdates.residentsList.length > 0) {
    const encryptedResidents = await Promise.all(
      preparedUpdates.residentsList.map(async r => {
        if (r.idCardNumber) {
          const encId = await encryptCccd(r.idCardNumber);
          return { ...r, idCardNumber: encId };
        }
        return r;
      }),
    );
    preparedUpdates.residentsList = encryptedResidents;
  }

  await updateDoc(ref, {
    ...preparedUpdates,
    lastCheckedDate: dateStr,
  });
}

/**
 * Delete an inspection photo from a household in Firestore
 */
export async function deleteInspectionPhotoFromHousehold(
  householdId: string,
  photoId: string,
  currentPhotos: InspectionPhoto[] = [],
): Promise<void> {
  const ref = doc(db, HOUSEHOLDS_COLLECTION, householdId);
  const updatedPhotos = (currentPhotos || []).filter(p => p.id !== photoId);

  await updateDoc(ref, {
    inspectionPhotos: updatedPhotos,
  });
}

/**
 * Batch update coordinates for households in Firestore
 */
export async function updateHouseholdCoordinatesInFirestore(updates: Array<{ id: string; coordinates: [number, number] }>): Promise<void> {
  for (const item of updates) {
    const ref = doc(db, HOUSEHOLDS_COLLECTION, item.id);
    await updateDoc(ref, {
      coordinates: item.coordinates,
    });
  }
}

/**
 * Send inspection reminder / update document in Firestore
 */
export async function sendDocReminderInFirestore(docId: string): Promise<void> {
  const ref = doc(db, DOCUMENTS_COLLECTION, docId);
  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  await updateDoc(ref, {
    notes: `Đã gửi thông báo đôn đốc trực tiếp vào ngày ${dateStr} qua hệ thống CSKV.`,
  });
}

/**
 * Update Officer Profile in Firestore
 */
export async function updateOfficerProfileInFirestore(profile: Partial<OfficerProfile>): Promise<void> {
  const ref = doc(db, 'officerProfile', 'current');
  await setDoc(ref, profile, { merge: true });
}

/**
 * Check Express Backend health
 */
export async function checkBackendHealth(): Promise<{ status: string; projectId: string; service: string }> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend health check error:', err);
    return {
      status: 'offline',
      projectId: FIREBASE_PROJECT_ID,
      service: 'An Ninh Dia Ban Express Backend',
    };
  }
}
