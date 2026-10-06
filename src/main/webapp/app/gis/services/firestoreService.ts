import { HouseholdFacility, DocumentRecord, OfficerProfile, DEFAULT_OFFICER, InspectionPhoto, AuditLogEntry } from '../types';
import { INITIAL_AUDIT_LOGS } from '../data/initialAuditLogs';
import { encryptCccd } from '../utils/cryptoUtils';
import { getEffectiveResidentsList } from '../utils/residentRosterUtils';
import {
  createHouseholdInBackend,
  updateHouseholdInBackend,
  updateHouseholdNotesInBackend,
  updateHouseholdCoordinatesInBackend,
  savePatrolLogInBackend,
} from './householdApiService';

// Event emitter for local reactive subscriptions
const serviceEmitter = new EventTarget();

// Storage keys
const OFFICER_PROFILE_KEY = 'cskv_officer_profile';
const HOUSEHOLDS_KEY = 'cskv_households_cache';
const DOCUMENTS_KEY = 'cskv_documents_cache';
const INSPECTION_PHOTOS_PREFIX = 'cskv_inspection_photos_';

/**
 * Checks backend connection status using Spring Boot Actuator /management/health
 */
export async function seedInitialFirestoreData(): Promise<boolean> {
  try {
    const res = await fetch('/management/health', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    return res.ok;
  } catch (error) {
    console.warn('Backend service status notice:', error);
    return false;
  }
}

/**
 * Real-time listener for Households
 */
export function subscribeHouseholds(onData: (data: HouseholdFacility[]) => void, _onError?: (err: Error) => void) {
  const load = () => {
    try {
      const raw = localStorage.getItem(HOUSEHOLDS_KEY);
      if (raw) {
        const items = JSON.parse(raw) as HouseholdFacility[];
        const enriched = items.map(h => ({
          ...h,
          residentsList: getEffectiveResidentsList(h),
        }));
        onData(enriched);
        return;
      }
    } catch {
      // ignore
    }
  };

  load();
  const handler = () => load();
  serviceEmitter.addEventListener('households-updated', handler);
  return () => {
    serviceEmitter.removeEventListener('households-updated', handler);
  };
}

/**
 * Real-time listener for Documents
 */
export function subscribeDocuments(onData: (data: DocumentRecord[]) => void, _onError?: (err: Error) => void) {
  const load = () => {
    try {
      const raw = localStorage.getItem(DOCUMENTS_KEY);
      if (raw) {
        onData(JSON.parse(raw));
        return;
      }
    } catch {
      // ignore
    }
  };

  load();
  const handler = () => load();
  serviceEmitter.addEventListener('documents-updated', handler);
  return () => {
    serviceEmitter.removeEventListener('documents-updated', handler);
  };
}

/**
 * Real-time listener for Officer Profile (Backed by LocalStorage + EventTarget)
 */
export function subscribeOfficerProfile(onData: (profile: OfficerProfile) => void) {
  const load = () => {
    try {
      const raw = localStorage.getItem(OFFICER_PROFILE_KEY);
      if (raw) {
        onData(JSON.parse(raw) as OfficerProfile);
        return;
      }
    } catch {
      // ignore
    }
    onData(DEFAULT_OFFICER);
  };

  load();
  const handler = () => load();
  serviceEmitter.addEventListener('officer-profile-updated', handler);
  return () => {
    serviceEmitter.removeEventListener('officer-profile-updated', handler);
  };
}

/**
 * Real-time listener for Audit Logs (Nhật ký thao tác)
 */
export function subscribeAuditLogs(onData: (logs: AuditLogEntry[]) => void, _onError?: (err: Error) => void) {
  onData(INITIAL_AUDIT_LOGS);
  const handler = () => {
    // Can be invoked if logs change locally
  };
  serviceEmitter.addEventListener('audit-logs-updated', handler);
  return () => {
    serviceEmitter.removeEventListener('audit-logs-updated', handler);
  };
}

/**
 * Record an audit log entry in Spring Boot PostgreSQL backend
 */
export async function addAuditLogInFirestore(log: AuditLogEntry): Promise<void> {
  try {
    await savePatrolLogInBackend(log);
  } catch (err) {
    console.warn('Could not persist patrol log to PostgreSQL:', err);
  }
}

/**
 * Add a new Household to PostgreSQL (with AES encryption for citizen ID / CCCD)
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

  try {
    await createHouseholdInBackend(preparedHousehold);
    serviceEmitter.dispatchEvent(new CustomEvent('households-updated'));
  } catch (err) {
    console.warn('Could not add household to backend:', err);
  }
}

/**
 * Update inspection notes for a Household in PostgreSQL
 */
export async function updateHouseholdNotesInFirestore(id: string, notes: string): Promise<void> {
  try {
    await updateHouseholdNotesInBackend(id, notes);
  } catch (err) {
    console.warn('Could not update household notes in backend:', err);
  }
}

/**
 * Helper to get local inspection photos for a household
 */
export function getLocalInspectionPhotos(householdId: string): InspectionPhoto[] {
  try {
    const raw = localStorage.getItem(`${INSPECTION_PHOTOS_PREFIX}${householdId}`);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

/**
 * Add an inspection photo to a household (Saved to LocalStorage and local state)
 */
export async function addInspectionPhotoToHousehold(
  householdId: string,
  photo: InspectionPhoto,
  currentPhotos: InspectionPhoto[] = [],
): Promise<void> {
  const updatedPhotos = [photo, ...(currentPhotos || [])];
  try {
    localStorage.setItem(`${INSPECTION_PHOTOS_PREFIX}${householdId}`, JSON.stringify(updatedPhotos));
    serviceEmitter.dispatchEvent(new CustomEvent('inspection-photos-updated', { detail: { householdId, photos: updatedPhotos } }));
  } catch (err) {
    console.warn('Could not save inspection photo locally:', err);
  }
}

/**
 * Update arbitrary household data in PostgreSQL (e.g. from OCR extraction)
 */
export async function updateHouseholdDataInFirestore(
  householdId: string,
  updates: Partial<HouseholdFacility>,
  currentHousehold: HouseholdFacility,
): Promise<HouseholdFacility> {
  if (currentHousehold.id !== householdId) throw new Error('Hộ dân không khớp với hồ sơ đang cập nhật.');
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

  const fullHousehold = { ...currentHousehold, ...preparedUpdates, id: householdId };
  // Updating an owner/business must not synchronize (or delete) the resident roster.
  if (!preparedUpdates.residentsList) delete fullHousehold.residentsList;
  const saved = await updateHouseholdInBackend(fullHousehold);
  serviceEmitter.dispatchEvent(new CustomEvent('households-updated'));
  return { ...currentHousehold, ...fullHousehold, ...saved, residentsList: saved.residentsList ?? currentHousehold.residentsList };
}

/**
 * Delete an inspection photo from a household
 */
export async function deleteInspectionPhotoFromHousehold(
  householdId: string,
  photoId: string,
  currentPhotos: InspectionPhoto[] = [],
): Promise<void> {
  const updatedPhotos = (currentPhotos || []).filter(p => p.id !== photoId);
  try {
    localStorage.setItem(`${INSPECTION_PHOTOS_PREFIX}${householdId}`, JSON.stringify(updatedPhotos));
    serviceEmitter.dispatchEvent(new CustomEvent('inspection-photos-updated', { detail: { householdId, photos: updatedPhotos } }));
  } catch (err) {
    console.warn('Could not delete inspection photo locally:', err);
  }
}

/**
 * Batch update coordinates for households in PostgreSQL
 */
export async function updateHouseholdCoordinatesInFirestore(updates: Array<{ id: string; coordinates: [number, number] }>): Promise<void> {
  try {
    await updateHouseholdCoordinatesInBackend(updates);
    serviceEmitter.dispatchEvent(new CustomEvent('households-updated'));
  } catch (err) {
    console.warn('Could not update household coordinates in backend:', err);
  }
}

/**
 * Send inspection reminder / update document
 */
export async function sendDocReminderInFirestore(docId: string): Promise<void> {
  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  try {
    const raw = localStorage.getItem(DOCUMENTS_KEY);
    const docs: DocumentRecord[] = raw ? JSON.parse(raw) : [];
    const idx = docs.findIndex(d => d.id === docId);
    if (idx >= 0) {
      docs[idx].notes = `Đã gửi thông báo đôn đốc trực tiếp vào ngày ${dateStr} qua hệ thống CSKV.`;
      localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(docs));
      serviceEmitter.dispatchEvent(new CustomEvent('documents-updated'));
    }
  } catch (err) {
    console.warn('Could not update doc reminder locally:', err);
  }
}

/**
 * Update Officer Profile in LocalStorage
 */
export async function updateOfficerProfileInFirestore(profile: Partial<OfficerProfile>): Promise<void> {
  try {
    const raw = localStorage.getItem(OFFICER_PROFILE_KEY);
    const current: OfficerProfile = raw ? JSON.parse(raw) : { ...DEFAULT_OFFICER };
    const merged: OfficerProfile = { ...current, ...profile };
    localStorage.setItem(OFFICER_PROFILE_KEY, JSON.stringify(merged));
    serviceEmitter.dispatchEvent(new CustomEvent('officer-profile-updated'));
  } catch (e) {
    console.warn('Could not update officer profile locally:', e);
  }
}

/**
 * Check Spring Boot Backend health via /management/health
 */
export async function checkBackendHealth(): Promise<{ status: string; projectId: string; service: string }> {
  try {
    const res = await fetch('/management/health', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (res.ok && (await res.json()).status === 'UP') {
      return {
        status: 'ok',
        projectId: 'police-jhip-postgresql',
        service: 'Hệ thống Quản lý Dân cư - Công an Xã Bà Điểm (Spring Boot + PostgreSQL)',
      };
    }
  } catch (err) {
    console.warn('Backend health check error:', err);
  }
  return {
    status: 'offline',
    projectId: 'police-jhip-postgresql',
    service: 'Hệ thống Quản lý Dân cư - Công an Xã Bà Điểm',
  };
}
