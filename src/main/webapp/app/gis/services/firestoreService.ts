// Compatibility import path only. Business data is persisted by the server.
import axios from 'axios';
import type { HouseholdFacility, InspectionPhoto } from '../types';
import { encryptCccd } from '../utils/cryptoUtils';
import { updateHouseholdInBackend } from './householdApiService';
import { saveInspectionPhoto, deleteInspectionPhoto } from './inspectionPhotos';

export async function addInspectionPhotoToHousehold(
  householdId: string,
  photo: InspectionPhoto,
  _currentPhotos: InspectionPhoto[] = [],
): Promise<InspectionPhoto> {
  return saveInspectionPhoto(householdId, photo);
}

export async function deleteInspectionPhotoFromHousehold(
  householdId: string,
  photoId: string,
  _currentPhotos: InspectionPhoto[] = [],
): Promise<void> {
  await deleteInspectionPhoto(householdId, photoId);
}

export async function updateHouseholdDataInFirestore(
  householdId: string,
  updates: Partial<HouseholdFacility>,
  currentHousehold: HouseholdFacility,
): Promise<HouseholdFacility> {
  if (currentHousehold.id !== householdId) throw new Error('Hộ dân không khớp với hồ sơ đang cập nhật.');
  const preparedUpdates = { ...updates };
  if (preparedUpdates.residentsList?.length) {
    preparedUpdates.residentsList = await Promise.all(
      preparedUpdates.residentsList.map(async resident =>
        resident.idCardNumber ? { ...resident, idCardNumber: await encryptCccd(resident.idCardNumber) } : resident,
      ),
    );
  }
  const fullHousehold = { ...currentHousehold, ...preparedUpdates, id: householdId };
  if (!preparedUpdates.residentsList) delete fullHousehold.residentsList;
  const saved = await updateHouseholdInBackend(fullHousehold);
  return { ...currentHousehold, ...fullHousehold, ...saved, residentsList: saved.residentsList ?? currentHousehold.residentsList };
}

export async function sendDocReminderInFirestore(id: string): Promise<void> {
  if (!/^\d+$/.test(id)) throw new Error('Invalid server document ID');
  await axios.post(`/api/rbac/documents/${id}/reminder`);
}

export async function checkBackendHealth(): Promise<{ status: string; projectId: string; service: string }> {
  try {
    const res = await fetch('/management/health', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (res.ok && (await res.json()).status === 'UP')
      return {
        status: 'ok',
        projectId: 'police-jhip-postgresql',
        service: 'Hệ thống Quản lý Dân cư - Công an Xã Bà Điểm (Spring Boot + PostgreSQL)',
      };
  } catch (err) {
    console.warn('Backend health check error:', err);
  }
  return { status: 'offline', projectId: 'police-jhip-postgresql', service: 'Hệ thống Quản lý Dân cư - Công an Xã Bà Điểm' };
}
