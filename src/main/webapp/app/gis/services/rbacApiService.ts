import axios from 'axios';
import { invalidateRbac } from './rbacEvents';
import { subscribeRbacResource } from './rbacSubscription';
export { resetRbacEventSession } from './rbacEvents';
import type {
  AppUser,
  AllowedEmailEntry,
  DynamicMenuItemConfig,
  HcmAdminUnit,
  SecurityAlert,
  SecurityAlertSeverity,
  SubAdminFeaturePermissions,
  BlacklistedIpEntry,
} from '../types';

// Compatibility names retained; the server is the sole source of RBAC data.
const changed = (topics: string[]) => invalidateRbac(topics);
export const retryCurrentRbac = () => invalidateRbac(['me']);
export const fetchRbacMe = async (signal?: AbortSignal) =>
  (signal ? await axios.get<AppUser>('/api/rbac/me', { signal }) : await axios.get<AppUser>('/api/rbac/me')).data;
export const subscribeCurrentRbac = (onData: (user: AppUser) => void, onError: (error: unknown) => void, onInvalidate: () => void) =>
  subscribeRbacResource('me', signal => fetchRbacMe(signal), onData, onError, onInvalidate);
export async function updateOwnAccount(fullName: string, rank: string) {
  const { data } = await axios.put<AppUser>('/api/rbac/me/account', { fullName, rank });
  changed(['me', 'users']);
  return data;
}
export const fetchAccessPolicy = async () => (await axios.get<{ emailWhitelistEnabled: boolean }>('/api/rbac/policy')).data;
export async function saveAccessPolicy(emailWhitelistEnabled: boolean) {
  await axios.put('/api/rbac/policy', { emailWhitelistEnabled });
  changed(['policy', 'me']);
}
export const fetchRbacAreas = async () =>
  (await axios.get<{ id: number; hamletId: number; communeId: number; name: string; hamletName: string }[]>('/api/rbac/delegation-areas'))
    .data;
export const fetchDelegationRoads = async () => (await axios.get<{ hamletId: number; name: string }[]>('/api/rbac/delegation-roads')).data;
export async function exportRbacCsv(kind: 'households' | 'residents') {
  const { data } = await axios.get(`/api/rbac/export/${kind}`, { responseType: 'blob' });
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
export const seedAuthAndRbacData = async () => {};
export const seedAuthCollectionsIfEmpty = seedAuthAndRbacData;
function subscribe<T>(path: string, onData: (data: T[]) => void) {
  const topic = path.split('/').at(-1)!;
  return subscribeRbacResource(
    topic,
    async signal => {
      const { data } = await axios.get<T[]>(path, { signal });
      if (!Array.isArray(data)) throw Error('Invalid RBAC list');
      return data;
    },
    onData,
    error => {
      onData([]);
      if (!(axios.isAxiosError(error) && error.response?.status === 403))
        window.dispatchEvent(new CustomEvent('rbac-error', { detail: 'Không thể tải dữ liệu phân quyền từ máy chủ.' }));
    },
  );
}
export const subscribeUsers = (cb: (v: AppUser[]) => void) => subscribe('/api/rbac/users', cb);
export const subscribeAllowedEmails = (cb: (v: AllowedEmailEntry[]) => void) => subscribe('/api/rbac/settings/whitelist', cb);
export const subscribeDynamicMenus = (cb: (v: DynamicMenuItemConfig[]) => void) =>
  subscribe<DynamicMenuItemConfig>('/api/rbac/settings/menus', menus =>
    cb(menus.filter(menu => !['spatial-3d-map', 'vietmap-compare'].includes(String(menu.id)))),
  );
export const subscribeHcmAdminUnits = (cb: (v: HcmAdminUnit[]) => void) => subscribe('/api/rbac/settings/units', cb);
export const subscribeSecurityAlerts = (cb: (v: SecurityAlert[]) => void) => subscribe('/api/rbac/settings/alerts', cb);
export const subscribeBlacklistedIps = (cb: (v: BlacklistedIpEntry[]) => void) => subscribe('/api/rbac/settings/blacklist', cb);
async function saveSetting(kind: string, data: unknown) {
  await axios.post(`/api/rbac/settings/${kind}`, data);
  changed([kind, ...(['policy', 'whitelist', 'blacklist', 'units'].includes(kind) ? ['me'] : [])]);
}
async function deleteSetting(kind: string, id: string) {
  await axios.delete(`/api/rbac/settings/${kind}/${encodeURIComponent(id)}`);
  changed([kind, ...(['policy', 'whitelist', 'blacklist', 'units'].includes(kind) ? ['me'] : [])]);
}
export async function updateDynamicMenusInFirestore(menus: DynamicMenuItemConfig[]) {
  await axios.put('/api/rbac/settings/menus', menus);
  changed(['menus']);
}
export const saveAllowedEmailInFirestore = (data: AllowedEmailEntry) => saveSetting('whitelist', data);
export const deleteAllowedEmailInFirestore = (id: string) => deleteSetting('whitelist', id);
export const saveHcmAdminUnitInFirestore = (data: HcmAdminUnit) => saveSetting('units', data);
export const deleteHcmAdminUnitInFirestore = (id: string) => deleteSetting('units', id);
export async function saveUserInFirestore(user: AppUser) {
  await axios.post('/api/rbac/users', user);
  changed(['users']);
}
export async function deleteUserInFirestore(id: string) {
  await axios.delete(`/api/rbac/users/${encodeURIComponent(id)}`);
  changed(['users']);
}
export async function saveDelegation(user: AppUser) {
  const { data } = await axios.put<AppUser>(`/api/rbac/users/${encodeURIComponent(user.id)}/delegation`, user);
  changed(['users']);
  return data;
}
export async function updateOfficerPermissions(id: string, permissions: SubAdminFeaturePermissions) {
  const { data } = await axios.get<AppUser[]>('/api/rbac/users');
  const user = data.find(u => u.id === id);
  if (!user) throw new Error('Không tìm thấy cán bộ được phép quản lý.');
  await saveDelegation({ ...user, subAdminPermissions: permissions });
}
export async function addIpToBlacklist(
  ipAddress: string,
  reason: string,
  _officer: AppUser,
  sourceAlertId?: string,
  notes?: string,
): Promise<BlacklistedIpEntry> {
  const { data } = await axios.post<BlacklistedIpEntry>('/api/rbac/settings/blacklist', {
    id: crypto.randomUUID(),
    ipAddress: ipAddress.trim(),
    reason,
    sourceAlertId,
    notes,
    status: 'blocked',
    hitCount: 0,
  });
  changed(['blacklist', 'me']);
  return data;
}
export const removeIpFromBlacklist = (id: string, _officer: AppUser, _ip?: string) => {
  // Legacy caller metadata is retained in the signature; authorization uses the server session.
  void _officer;
  void _ip;
  return deleteSetting('blacklist', id);
};
export async function resolveSecurityAlert(id: string, _officer: AppUser, notes?: string) {
  const { data } = await axios.get<SecurityAlert[]>('/api/rbac/settings/alerts');
  const alert = data.find(a => a.id === id);
  if (!alert) throw new Error('Không tìm thấy cảnh báo.');
  await saveSetting('alerts', { ...alert, resolved: true, resolvedNotes: notes, resolvedAt: new Date().toISOString() });
}
export async function createSecurityAlert(
  alert: Omit<SecurityAlert, 'id' | 'timestamp' | 'resolved' | 'emailNotified'>,
): Promise<SecurityAlert> {
  const { data } = await axios.post<SecurityAlert>('/api/rbac/settings/alerts', { ...alert, id: crypto.randomUUID(), resolved: false });
  changed(['alerts']);
  return data;
}
export const logSecurityAlert = (alert: {
  level?: 'warning' | 'critical' | 'info';
  severity?: SecurityAlertSeverity;
  title: string;
  description?: string;
  details?: string;
  sourceIp?: string;
  actorId?: string;
  actorName?: string;
  attemptedEmailOrUser?: string;
  adminEmailTarget?: string;
}) =>
  createSecurityAlert({
    severity: alert.severity || alert.level || 'warning',
    title: alert.title,
    details: alert.details || alert.description || '',
    sourceIp: alert.sourceIp || '',
    attemptedEmailOrUser: alert.attemptedEmailOrUser,
    targetResource: 'API',
    adminEmailTarget: alert.adminEmailTarget || '',
  });
