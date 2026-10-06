import axios from 'axios';
import type { IUser } from 'app/shared/model/user.model';
import { REDIRECT_URL } from 'app/shared/util/url-utils';
import type { AppUser, UserRole } from '../types';

/** Only the authenticated /api/account response may supply identity and roles. */
export function mapAccountToGisUser(account: IUser): AppUser | null {
  if (!account?.activated || !account.login) return null;
  const authorities = account.authorities || [];
  let role: UserRole;
  if (authorities.includes('ROLE_SUPERADMIN')) role = 'superadmin';
  else if (authorities.includes('ROLE_ADMIN')) role = 'admin';
  else if (authorities.includes('ROLE_SUB_ADMIN')) role = 'sub-admin';
  else if (authorities.includes('ROLE_USER')) role = 'officer';
  else return null;

  return {
    id: String(account.id ?? account.login),
    username: account.login,
    email: account.email,
    fullName: [account.firstName, account.lastName].filter(Boolean).join(' ') || account.login,
    role,
    rank: '',
    position: role,
    unit: '',
    badgeNumber: '',
    phone: '',
    assignedWard: '',
    assignedHamlets: [],
    assignedStreets: [],
    status: 'active',
    createdAt: account.createdDate ? String(account.createdDate) : '',
    isOnline: true,
  };
}

export function beginBackendLogin(): void {
  localStorage.removeItem('cskv_auth_session_user');
  localStorage.setItem(REDIRECT_URL, '/dashboard');
  window.location.assign('/oauth2/authorization/oidc');
}

export async function logoutBackendSession(): Promise<void> {
  const { data } = await axios.post<{ logoutUrl?: string }>('/api/logout', {});
  localStorage.removeItem('cskv_auth_session_user');
  window.location.assign(data.logoutUrl || '/');
}
