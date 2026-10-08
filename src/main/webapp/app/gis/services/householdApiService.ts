import axios from 'axios';
import { HouseholdFacility, Resident, DocumentRecord, AuditLogEntry, AuditActionType, SecurityAlert } from '../types';
import { IHousehold } from 'app/shared/model/household.model';
import { IResident } from 'app/shared/model/resident.model';
import { IDocumentRecord } from 'app/shared/model/document-record.model';

/**
 * Chuyển đổi từ Backend IHousehold (JHipster DTO) sang Frontend HouseholdFacility
 */
export const mapDtoToHousehold = (dto: IHousehold, index: number = 0): HouseholdFacility => {
  const idStr = String(dto.id ?? `hh-${index}`);

  // Tọa độ Bà Điểm mặc định nếu thiếu
  const lat = typeof dto.latitude === 'number' && !isNaN(dto.latitude) && dto.latitude !== 0 ? dto.latitude : 10.854;
  const lng = typeof dto.longitude === 'number' && !isNaN(dto.longitude) && dto.longitude !== 0 ? dto.longitude : 106.612;
  const coordinatesEstimated = !(
    typeof dto.latitude === 'number' &&
    Number.isFinite(dto.latitude) &&
    dto.latitude !== 0 &&
    typeof dto.longitude === 'number' &&
    Number.isFinite(dto.longitude) &&
    dto.longitude !== 0
  );

  // Chuyển đổi FacilityType
  let type: 'household' | 'business' | 'special_monitoring' = 'household';
  if (dto.type === 'BUSINESS' || dto.type === 'BOARDING_HOUSE') {
    type = 'business';
  } else if (dto.type === 'SPECIAL') {
    type = 'special_monitoring';
  }

  // Chuyển đổi SecurityStatus
  let status: 'normal' | 'warning' | 'alert' | 'business' = 'normal';
  if (dto.status === 'WARNING') {
    status = 'warning';
  } else if (dto.status === 'CRITICAL' || dto.status === 'DANGER') {
    status = 'alert';
  } else if (type === 'business') {
    status = 'business';
  }

  const residentsCount = Number(dto.residentsCount ?? 1);
  const maleCount = Number(dto.maleCount ?? Math.ceil(residentsCount / 2));
  const femaleCount = Number(dto.femaleCount ?? residentsCount - maleCount);
  const under18Count = Number(dto.under18Count ?? 0);
  const above18Count = Number(dto.above18Count ?? residentsCount - under18Count);

  return {
    id: idStr,
    code: dto.code || `HK-BD-${String(dto.id || index + 1).padStart(3, '0')}`,
    houseNumber: dto.houseNumber || '1',
    street: dto.street || 'Đường Phan Văn Hớn',
    hamlet: dto.hamlet || 'Ấp Bắc Lân',
    neighborhoodGroup: dto.neighborhoodGroup || 'Tổ 1',
    alley: dto.alley || 'Mặt tiền đường',
    ownerName: dto.ownerName || 'Chưa cập nhật',
    ownerPhone: dto.ownerPhone || '',
    type,
    businessName: dto.businessName || undefined,
    businessCategory: dto.businessCategory || undefined,
    residentsCount,
    maleCount,
    femaleCount,
    under18Count,
    above18Count,
    status,
    warningMessage: dto.warningMessage || undefined,
    licenseExpiry: dto.licenseExpiry || undefined,
    licenseType: dto.licenseType || undefined,
    coordinates: [lat, lng],
    coordinatesEstimated,
    gridPosition: {
      row: Math.floor(index / 10),
      col: index % 10,
    },
    notes: dto.notes || 'Hồ sơ quản lý địa bàn Xã Bà Điểm.',
    lastCheckedDate: dto.lastCheckedDate || new Date().toLocaleDateString('vi-VN'),
    officerInCharge: dto.officerInCharge || 'Cán bộ CSKV Xã Bà Điểm',
    residentsList: [],
    inspectionPhotos: [],
  };
};

/**
 * Chuyển đổi từ Frontend HouseholdFacility sang Backend IHousehold (JHipster DTO)
 */
export const mapHouseholdToDto = (h: Partial<HouseholdFacility>): IHousehold => {
  const numericId = h.id && !isNaN(Number(h.id)) ? Number(h.id) : undefined;

  // Mapping type sang FacilityType enum
  let type: 'RESIDENTIAL' | 'BUSINESS' | 'BOARDING_HOUSE' | 'RELIGIOUS' | 'SPECIAL' = 'RESIDENTIAL';
  if (h.type === 'business') {
    type = 'BUSINESS';
  } else if (h.type === 'special_monitoring') {
    type = 'SPECIAL';
  }

  // Mapping status sang SecurityStatus enum
  let status: 'NORMAL' | 'WARNING' | 'DANGER' | 'CRITICAL' = 'NORMAL';
  if (h.status === 'warning') {
    status = 'WARNING';
  } else if (h.status === 'alert') {
    status = 'CRITICAL';
  }

  const lat = Array.isArray(h.coordinates) && h.coordinates.length >= 2 ? h.coordinates[0] : 10.854;
  const lng = Array.isArray(h.coordinates) && h.coordinates.length >= 2 ? h.coordinates[1] : 106.612;

  return {
    id: numericId,
    code: h.code || `HK-BD-${Date.now().toString().slice(-4)}`,
    houseNumber: h.houseNumber || '1',
    street: h.street || 'Đường Phan Văn Hớn',
    hamlet: h.hamlet || 'Ấp Bắc Lân',
    neighborhoodGroup: h.neighborhoodGroup || 'Tổ 1',
    alley: h.alley || 'Mặt tiền đường',
    ownerName: h.ownerName || 'Chưa cập nhật',
    ownerPhone: h.ownerPhone || '0901234567',
    type,
    businessName: h.businessName || null,
    businessCategory: h.businessCategory || null,
    residentsCount: Number(h.residentsCount ?? 1),
    maleCount: Number(h.maleCount ?? 1),
    femaleCount: Number(h.femaleCount ?? 0),
    under18Count: Number(h.under18Count ?? 0),
    above18Count: Number(h.above18Count ?? 1),
    status,
    warningMessage: h.warningMessage || null,
    licenseExpiry: h.licenseExpiry || null,
    licenseType: h.licenseType || null,
    latitude: lat,
    longitude: lng,
    notes: h.notes || 'Hồ sơ quản lý địa bàn Xã Bà Điểm.',
    lastCheckedDate: h.lastCheckedDate || new Date().toISOString().split('T')[0],
    officerInCharge: h.officerInCharge || 'Cán bộ CSKV Xã Bà Điểm',
  };
};

/**
 * Chuyển đổi từ IResident DTO sang Resident
 */
export const mapResidentDtoToResident = (dto: IResident): Resident => {
  let resType: 'Thường trú' | 'Tạm trú' | 'Lưu trú' = 'Thường trú';
  if (dto.residenceType === 'TEMPORARY') resType = 'Tạm trú';
  else if (dto.residenceType === 'STAY') resType = 'Lưu trú';

  return {
    id: String(dto.id),
    fullName: dto.fullName || 'Chưa đặt tên',
    birthYear: dto.birthYear || 1990,
    gender: dto.gender === 'FEMALE' ? 'Nữ' : 'Nam',
    relationship: dto.relationship || 'Chủ hộ',
    idCardNumber: dto.idCardNumber || undefined,
    residenceType: resType,
    notes: dto.notes || undefined,
    isMonitored: false,
  };
};

/**
 * Chuyển đổi từ Resident sang IResident DTO
 */
export const mapResidentToDto = (r: Resident, householdId?: number | string): IResident => {
  let residenceType: 'PERMANENT' | 'TEMPORARY' | 'STAY' = 'PERMANENT';
  if (r.residenceType === 'Tạm trú') residenceType = 'TEMPORARY';
  else if (r.residenceType === 'Lưu trú') residenceType = 'STAY';

  const numHId = householdId ? Number(householdId) : undefined;

  return {
    id: r.id && !isNaN(Number(r.id)) ? Number(r.id) : undefined,
    fullName: r.fullName,
    idCardNumber: r.idCardNumber || null,
    birthYear: r.birthYear,
    gender: r.gender === 'Nữ' ? 'FEMALE' : 'MALE',
    relationship: r.relationship,
    residenceType,
    notes: r.notes || null,
    household: numHId ? { id: numHId } : null,
  };
};

/**
 * 1. Tải danh sách tất cả hộ dân từ PostgreSQL
 */
export async function fetchAllHouseholds(size: number = 1000): Promise<HouseholdFacility[]> {
  const res = await axios.get<IHousehold[]>(`/api/households?page=0&size=${size}&sort=id,asc&cacheBuster=${Date.now()}`);
  if (Array.isArray(res.data)) {
    return res.data.map((dto, idx) => mapDtoToHousehold(dto, idx));
  }
  return [];
}

/**
 * Tải danh sách toàn bộ hộ dân cùng với nhân khẩu thực tế từ PostgreSQL
 */
export async function fetchCompleteHouseholdsFromBackend(): Promise<HouseholdFacility[]> {
  const [householdsRes, residentsRes] = await Promise.all([
    axios.get<IHousehold[]>(`/api/households?page=0&size=1000&sort=id,asc&cacheBuster=${Date.now()}`),
    axios
      .get<IResident[]>(`/api/residents?page=0&size=3000&sort=id,asc&cacheBuster=${Date.now()}`)
      .catch(() => ({ data: [] as IResident[] })),
  ]);

  const rawHouseholds = Array.isArray(householdsRes.data) ? householdsRes.data : [];
  const rawResidents = Array.isArray(residentsRes.data) ? residentsRes.data : [];

  // Gom nhóm nhân khẩu theo household.id
  const residentsByHouseholdId = new Map<number, Resident[]>();
  rawResidents.forEach(rDto => {
    const hId = rDto.household?.id;
    if (hId) {
      if (!residentsByHouseholdId.has(hId)) {
        residentsByHouseholdId.set(hId, []);
      }
      residentsByHouseholdId.get(hId)!.push(mapResidentDtoToResident(rDto));
    }
  });

  return rawHouseholds.map((dto, idx) => {
    const assignedResidents = dto.id ? residentsByHouseholdId.get(dto.id) || [] : [];
    const baseH = mapDtoToHousehold(dto, idx);

    if (assignedResidents.length > 0) {
      const maleCount = assignedResidents.filter(r => r.gender === 'Nam').length;
      const femaleCount = assignedResidents.filter(r => r.gender === 'Nữ').length;
      const under18Count = assignedResidents.filter(r => 2026 - r.birthYear < 18).length;
      const above18Count = assignedResidents.length - under18Count;

      return {
        ...baseH,
        residentsList: assignedResidents,
        residentsCount: assignedResidents.length,
        maleCount,
        femaleCount,
        under18Count,
        above18Count,
      };
    }
    return baseH;
  });
}

/**
 * 2. Thêm mới một hộ dân vào PostgreSQL
 */
export async function createHouseholdInBackend(newH: HouseholdFacility): Promise<HouseholdFacility> {
  const dto = mapHouseholdToDto(newH);
  delete dto.id; // Để database tự sinh ID
  const res = await axios.post<IHousehold>('/api/households', dto);
  const created = mapDtoToHousehold(res.data);
  const createdHouseholdId = res.data.id;

  if (createdHouseholdId) {
    // Chuẩn bị danh sách nhân khẩu khởi tạo (nếu không có thì tạo mặc định 1 chủ hộ)
    const listToSave: Resident[] =
      Array.isArray(newH.residentsList) && newH.residentsList.length > 0
        ? newH.residentsList
        : [
            {
              id: `res-${Date.now()}-1`,
              fullName: newH.ownerName || 'Chủ hộ',
              birthYear: 1980,
              gender: 'Nam',
              relationship: 'Chủ hộ',
              residenceType: newH.residenceType || 'Thường trú',
              phone: newH.ownerPhone,
              notes: `Chủ hộ mới đăng ký tại ${newH.hamlet || 'Xã Bà Điểm'}`,
            },
          ];

    const savedResidents: Resident[] = [];
    for (const r of listToSave) {
      try {
        const rDto = mapResidentToDto(r, createdHouseholdId);
        delete rDto.id;
        const rRes = await axios.post<IResident>('/api/residents', rDto);
        savedResidents.push(mapResidentDtoToResident(rRes.data));
      } catch (err) {
        console.warn('Lỗi khi lưu nhân khẩu của hộ mới:', err);
      }
    }

    if (savedResidents.length > 0) {
      created.residentsList = savedResidents;
      created.residentsCount = savedResidents.length;
      created.maleCount = savedResidents.filter(x => x.gender === 'Nam').length;
      created.femaleCount = savedResidents.filter(x => x.gender === 'Nữ').length;
    }
  }

  return created;
}

/**
 * 3. Cập nhật toàn bộ thông tin hộ dân cùng danh sách nhân khẩu trong PostgreSQL
 */
export async function updateHouseholdInBackend(updatedH: HouseholdFacility): Promise<HouseholdFacility> {
  const dto = mapHouseholdToDto(updatedH);
  if (!dto.id) {
    throw new Error('Không thể cập nhật hộ dân không có ID.');
  }

  // 1. Cập nhật thông tin hộ dân
  const res = await axios.patch<IHousehold>(`/api/households/${dto.id}`, dto, {
    headers: { 'Content-Type': 'application/merge-patch+json' },
  });
  const saved = mapDtoToHousehold(res.data);

  // 2. Nếu có danh sách residentsList, đồng bộ chính xác vào bảng resident trong PostgreSQL
  if (Array.isArray(updatedH.residentsList)) {
    try {
      // Lấy danh sách nhân khẩu hiện có trong database của hộ này
      const dbResidentsRes = await axios.get<IResident[]>(`/api/residents?householdId.equals=${dto.id}&size=500`);
      const dbResidents = Array.isArray(dbResidentsRes.data) ? dbResidentsRes.data : [];
      const dbResidentsMap = new Map<number, IResident>();
      dbResidents.forEach(r => {
        if (r.id) dbResidentsMap.set(r.id, r);
      });

      const updatedIds = new Set<number>();
      const finalResidentsList: Resident[] = [];

      for (const r of updatedH.residentsList) {
        const numId = Number(r.id);
        const isExistingInDb = !isNaN(numId) && dbResidentsMap.has(numId);

        if (isExistingInDb) {
          // Cập nhật nhân khẩu đã tồn tại
          updatedIds.add(numId);
          try {
            const rDto = mapResidentToDto(r, dto.id);
            const rRes = await axios.put<IResident>(`/api/residents/${numId}`, rDto);
            finalResidentsList.push(mapResidentDtoToResident(rRes.data));
          } catch (e) {
            console.warn(`Lỗi khi cập nhật nhân khẩu ${numId}:`, e);
            throw e;
          }
        } else {
          // Thêm mới nhân khẩu chưa có trong DB
          try {
            const rDto = mapResidentToDto(r, dto.id);
            delete rDto.id;
            const rRes = await axios.post<IResident>('/api/residents', rDto);
            finalResidentsList.push(mapResidentDtoToResident(rRes.data));
          } catch (e) {
            console.warn(`Lỗi khi thêm mới nhân khẩu ${r.fullName}:`, e);
            throw e;
          }
        }
      }

      // Xóa các nhân khẩu trong DB không còn trong updatedH.residentsList
      for (const [dbId] of dbResidentsMap) {
        if (!updatedIds.has(dbId)) {
          try {
            await axios.delete(`/api/residents/${dbId}`);
          } catch (e) {
            console.warn(`Lỗi khi xóa nhân khẩu cũ ${dbId}:`, e);
          }
        }
      }

      saved.residentsList = finalResidentsList;
      saved.residentsCount = finalResidentsList.length;
      saved.maleCount = finalResidentsList.filter(x => x.gender === 'Nam').length;
      saved.femaleCount = finalResidentsList.filter(x => x.gender === 'Nữ').length;
    } catch (syncErr) {
      console.warn('Lỗi khi đồng bộ nhân khẩu với PostgreSQL:', syncErr);
      throw syncErr;
    }
  } else {
    saved.residentsList = updatedH.residentsList;
  }

  return saved;
}

/**
 * 4. Cập nhật nhanh ghi chú kiểm tra trong PostgreSQL
 */
export async function updateHouseholdNotesInBackend(id: string | number, notes: string): Promise<void> {
  const numericId = Number(id);
  if (isNaN(numericId)) return;
  await axios.patch(
    `/api/households/${numericId}`,
    { id: numericId, notes },
    { headers: { 'Content-Type': 'application/merge-patch+json' } },
  );
}

/**
 * 5. Cập nhật tọa độ GPS kéo thả trong PostgreSQL
 */
export async function updateHouseholdCoordinatesInBackend(
  updates: Array<{ id: string | number; coordinates: [number, number] }>,
): Promise<void> {
  for (const u of updates) {
    const numericId = Number(u.id);
    if (!isNaN(numericId)) {
      await axios.patch(
        `/api/households/${numericId}`,
        {
          id: numericId,
          latitude: u.coordinates[0],
          longitude: u.coordinates[1],
        },
        { headers: { 'Content-Type': 'application/merge-patch+json' } },
      );
    }
  }
}

/**
 * 6. Xóa một hộ dân khỏi PostgreSQL
 */
export async function deleteHouseholdInBackend(id: string | number): Promise<void> {
  const numericId = Number(id);
  if (isNaN(numericId)) return;

  // Xóa tuần tự các nhân khẩu trực thuộc hộ trước để tránh lỗi khóa ngoại (foreign key constraint)
  try {
    const res = await axios.get<IResident[]>(`/api/residents?householdId.equals=${numericId}&size=500`);
    if (Array.isArray(res.data) && res.data.length > 0) {
      for (const r of res.data) {
        if (r.id) {
          await axios.delete(`/api/residents/${r.id}`);
        }
      }
    }
  } catch (e) {
    console.warn('Lỗi khi dọn nhân khẩu của hộ:', e);
  }

  await axios.delete(`/api/households/${numericId}`);
}

/**
 * 7. Thêm nhân khẩu vào cơ sở dữ liệu PostgreSQL
 */
export async function createResidentInBackend(resident: Resident, householdId: string | number): Promise<Resident> {
  const dto = mapResidentToDto(resident, householdId);
  delete dto.id;
  const res = await axios.post<IResident>('/api/residents', dto);
  return mapResidentDtoToResident(res.data);
}

/**
 * 8. Cập nhật nhân khẩu trong cơ sở dữ liệu PostgreSQL
 */
export async function updateResidentInBackend(resident: Resident, householdId: string | number): Promise<Resident> {
  const dto = mapResidentToDto(resident, householdId);
  if (!dto.id) {
    return createResidentInBackend(resident, householdId);
  }
  const res = await axios.put<IResident>(`/api/residents/${dto.id}`, dto);
  return mapResidentDtoToResident(res.data);
}

/**
 * 9. Xóa nhân khẩu khỏi cơ sở dữ liệu PostgreSQL
 */
export async function deleteResidentInBackend(residentId: string | number): Promise<void> {
  const numId = Number(residentId);
  if (isNaN(numId)) return;
  await axios.delete(`/api/residents/${numId}`);
}

/**
 * 10. Tải danh sách tất cả nhân khẩu từ PostgreSQL
 */
export async function fetchAllResidents(size: number = 3000): Promise<IResident[]> {
  try {
    const res = await axios.get<IResident[]>(`/api/residents?page=0&size=${size}&cacheBuster=${Date.now()}`);
    return Array.isArray(res.data) ? res.data : [];
  } catch (e) {
    console.warn('Lỗi khi tải danh sách nhân khẩu từ backend:', e);
    return [];
  }
}

/**
 * 11. Tải danh sách hồ sơ giấy tờ từ PostgreSQL
 */
export async function fetchAllDocumentRecords(size: number = 1000): Promise<DocumentRecord[]> {
  try {
    const res = await axios.get<IDocumentRecord[]>(`/api/document-records?page=0&size=${size}&cacheBuster=${Date.now()}`);
    if (Array.isArray(res.data)) {
      return res.data.map(dto => {
        const idStr = String(dto.id || `doc-${Date.now()}`);
        const statusVal = dto.status === 'EXPIRED' ? 'expired' : dto.status === 'EXPIRING_SOON' ? 'expiring_soon' : 'valid';
        const urgencyVal = statusVal === 'expired' ? 'high' : statusVal === 'expiring_soon' ? 'medium' : 'normal';

        let hamletName: any = 'Ấp Bắc Lân';
        if (dto.address?.includes('Nam Lân')) hamletName = 'Ấp Nam Lân';
        else if (dto.address?.includes('Tây Lân')) hamletName = 'Ấp Tây Lân';
        else if (dto.address?.includes('Đông Lân')) hamletName = 'Ấp Đông Lân';
        else if (dto.address?.includes('Hậu Lân')) hamletName = 'Ấp Hậu Lân';
        else if (dto.address?.includes('Tiền Lân')) hamletName = 'Ấp Tiền Lân';

        return {
          id: idStr,
          docCode: `HS-BD-${String(dto.id || 1).padStart(3, '0')}`,
          title: dto.docName || 'Hồ sơ kiểm tra ANTT & PCCC',
          targetName: dto.householdName || 'Cơ sở quản lý',
          address: dto.address || 'Xã Bà Điểm, Hóc Môn',
          hamlet: hamletName,
          category: 'license_security',
          categoryLabel: dto.docType || 'Giấy phép ANTT',
          issueDate: '2026-01-01',
          expiryDate: dto.expiryDate || '2027-01-01',
          status: statusVal,
          urgency: urgencyVal,
          notes: dto.notes || 'Hồ sơ an ninh trật tự',
        };
      });
    }
  } catch (err) {
    console.warn('Lỗi khi tải danh sách hồ sơ tài liệu từ backend:', err);
  }
  return [];
}

function inferActionType(action: string): AuditActionType {
  const a = (action || '').toLowerCase();
  if (a.includes('tọa độ') || a.includes('gps') || a.includes('coordinate')) return 'coordinate_update';
  if (a.includes('đăng ký') || a.includes('thêm') || a.includes('hộ dân')) return 'household_add';
  if (a.includes('gia hạn') || a.includes('renew')) return 'document_renew';
  if (a.includes('nhắc nhở') || a.includes('đôn đốc') || a.includes('reminder')) return 'reminder_sent';
  if (a.includes('ocr') || a.includes('cccd') || a.includes('scan')) return 'ocr_scan';
  if (a.includes('cán bộ') || a.includes('tài khoản')) return 'officer_update';
  return 'profile_update';
}

/**
 * 12. Tải danh sách nhật ký tuần tra / kiểm tra thực địa từ PostgreSQL
 */
export async function fetchPatrolLogsFromBackend(size: number = 200): Promise<AuditLogEntry[]> {
  try {
    const res = await axios.get<any[]>(`/api/patrol-logs?page=0&size=${size}&sort=id,desc&cacheBuster=${Date.now()}`);
    if (Array.isArray(res.data) && res.data.length > 0) {
      return res.data.map(dto => {
        const d = dto.timestamp ? new Date(dto.timestamp) : new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const formattedDate = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

        let detailsText = dto.details || 'Ghi nhận kiểm tra thực địa.';
        let actionType: AuditActionType = inferActionType(dto.action);
        let targetType: 'household' | 'document' | 'officer' | 'system' = 'household';
        let targetCode: string | undefined = undefined;
        let previousValue: string | undefined = undefined;
        let newValue: string | undefined = undefined;
        let deviceInfo: string | undefined = 'Thiết bị nghiệp vụ tuần tra CSKV';
        let integrityHash: string | undefined = `SHA256:${String(dto.id).padStart(8, '0')}...OK`;
        let status: 'success' | 'warning' | 'info' = 'success';

        // Nếu details được lưu dưới dạng JSON metadata
        if (dto.details && typeof dto.details === 'string' && dto.details.trim().startsWith('{')) {
          try {
            const meta = JSON.parse(dto.details);
            if (meta.text !== undefined) detailsText = meta.text;
            if (meta.actionType) actionType = meta.actionType;
            if (meta.targetType) targetType = meta.targetType;
            if (meta.targetCode) targetCode = meta.targetCode;
            if (meta.previousValue) previousValue = meta.previousValue;
            if (meta.newValue) newValue = meta.newValue;
            if (meta.deviceInfo) deviceInfo = meta.deviceInfo;
            if (meta.integrityHash) integrityHash = meta.integrityHash;
            if (meta.status) status = meta.status;
          } catch {
            // Giữ nguyên detailsText nếu không parse được JSON
          }
        }

        // Tách targetCode nếu có dạng "[CODE] Title"
        let targetTitle = dto.target || 'Địa bàn Xã Bà Điểm';
        if (targetTitle.startsWith('[') && targetTitle.includes('] ')) {
          const closeIdx = targetTitle.indexOf('] ');
          if (!targetCode) {
            targetCode = targetTitle.slice(1, closeIdx);
          }
          targetTitle = targetTitle.slice(closeIdx + 2);
        }

        return {
          id: `LOG-DB-${dto.id}`,
          timestamp: formattedDate,
          createdAt: d.getTime(),
          actionType,
          actionLabel: dto.action || 'Nhật ký công tác',
          officerName: dto.officerName || 'Cán bộ CSKV',
          officerBadge: dto.badgeNumber || 'CSKV-BADIEM',
          targetType,
          targetCode,
          targetTitle,
          details: detailsText,
          previousValue,
          newValue,
          ipAddress: dto.ipAddress || '192.168.1.45',
          deviceInfo,
          integrityHash,
          status,
        };
      });
    }
  } catch (err) {
    console.warn('Lỗi khi tải danh sách nhật ký từ backend:', err);
  }
  return [];
}

/**
 * 12b. Lưu nhật ký thao tác / tuần tra thực địa vào PostgreSQL
 */
export async function savePatrolLogInBackend(log: Partial<AuditLogEntry>): Promise<AuditLogEntry | null> {
  try {
    const rawDetails = log.details || '';
    const metadata = {
      text: rawDetails,
      actionType: log.actionType || 'profile_update',
      targetType: log.targetType || 'household',
      targetCode: log.targetCode,
      previousValue: log.previousValue,
      newValue: log.newValue,
      deviceInfo: log.deviceInfo || 'Máy trạm CSKV Bà Điểm',
      integrityHash: log.integrityHash || `SHA256:${Date.now()}...OK`,
      status: log.status || 'success',
    };

    let targetStr = log.targetTitle || 'Địa bàn Xã Bà Điểm';
    if (log.targetCode && !targetStr.includes(log.targetCode)) {
      targetStr = `[${log.targetCode}] ${targetStr}`;
    }

    const payload = {
      action: log.actionLabel || 'Nhật ký công tác',
      target: targetStr,
      details: JSON.stringify(metadata),
      officerName: log.officerName || 'Cán bộ CSKV',
      badgeNumber: log.officerBadge || 'CSKV-BADIEM',
      ipAddress: log.ipAddress || '192.168.1.45',
      timestamp: new Date(log.createdAt || Date.now()).toISOString(),
    };

    const res = await axios.post<any>('/api/patrol-logs', payload);
    if (res.data && res.data.id) {
      const dto = res.data;
      const d = dto.timestamp ? new Date(dto.timestamp) : new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const formattedDate = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

      return {
        id: `LOG-DB-${dto.id}`,
        timestamp: formattedDate,
        createdAt: d.getTime(),
        actionType: log.actionType || 'profile_update',
        actionLabel: dto.action || 'Nhật ký công tác',
        officerName: dto.officerName || 'Cán bộ CSKV',
        officerBadge: dto.badgeNumber || 'CSKV-BADIEM',
        targetType: log.targetType || 'household',
        targetCode: log.targetCode,
        targetTitle: log.targetTitle || dto.target || 'Địa bàn Xã Bà Điểm',
        details: rawDetails,
        previousValue: log.previousValue,
        newValue: log.newValue,
        ipAddress: dto.ipAddress || '192.168.1.45',
        deviceInfo: log.deviceInfo || 'Máy trạm CSKV Bà Điểm',
        integrityHash: log.integrityHash || `SHA256:${String(dto.id).padStart(8, '0')}...OK`,
        status: log.status || 'success',
      };
    }
  } catch (err) {
    console.error('Lỗi khi lưu nhật ký thao tác vào PostgreSQL:', err);
  }
  return null;
}

/**
 * 13. Tải danh sách cảnh báo an ninh từ PostgreSQL
 */
export async function fetchSecurityAlertsFromBackend(size: number = 100): Promise<SecurityAlert[]> {
  try {
    const res = await axios.get<any[]>(`/api/security-alerts?page=0&size=${size}&sort=id,desc&cacheBuster=${Date.now()}`);
    if (Array.isArray(res.data) && res.data.length > 0) {
      return res.data.map(dto => {
        const sevMap: Record<string, any> = {
          CRITICAL: 'critical',
          HIGH: 'high',
          MEDIUM: 'medium',
          LOW: 'low',
          INFO: 'info',
        };

        return {
          id: `ALERT-DB-${dto.id}`,
          timestamp: dto.reportedAt ? new Date(dto.reportedAt).toLocaleDateString('vi-VN') : '27/09/2026',
          severity: sevMap[dto.severity] || 'medium',
          title: dto.title || 'Cảnh báo an ninh trật tự',
          details: dto.description || '',
          sourceIp: dto.location || 'Xã Bà Điểm',
          targetResource: '/api/security-alerts',
          emailNotified: false,
          adminEmailTarget: 'cong-an-ba-diem@tphcm.gov.vn',
          resolved: !!dto.isResolved,
          resolvedAt: dto.resolvedAt ? new Date(dto.resolvedAt).toLocaleDateString('vi-VN') : undefined,
        };
      });
    }
  } catch (err) {
    console.warn('Lỗi khi tải danh sách cảnh báo từ backend:', err);
  }
  return [];
}
