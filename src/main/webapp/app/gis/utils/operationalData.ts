import {
  fetchCompleteHouseholdsFromBackend,
  fetchAllDocumentRecords,
  fetchPatrolLogsFromBackend,
  fetchSecurityAlertsFromBackend,
} from '../services/householdApiService';

/** Each dataset succeeds or fails independently; an empty successful response is valid. */
export function loadOperationalData() {
  return Promise.allSettled([
    fetchCompleteHouseholdsFromBackend(),
    fetchAllDocumentRecords(1000),
    fetchPatrolLogsFromBackend(200),
    fetchSecurityAlertsFromBackend(100),
  ] as const);
}

export const OPERATIONAL_DATA_LABELS = ['Hộ dân và nhân khẩu', 'Hồ sơ giấy tờ', 'Nhật ký tuần tra', 'Cảnh báo an ninh'];
