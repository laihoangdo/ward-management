import type { AppUser, NavigationTab, SubAdminFeaturePermissions } from '../types';

const MAP_VIEW_PERMISSIONS: Partial<Record<NavigationTab, keyof SubAdminFeaturePermissions>> = {
  'advanced-map': 'canViewAdvancedMap',
  'field-3d-map': 'canViewField3DMap',
};

export const canViewMapTab = (user: AppUser, tab: NavigationTab): boolean => {
  const permission = MAP_VIEW_PERMISSIONS[tab];
  return !permission || user.role === 'superadmin' || user.subAdminPermissions?.[permission] === true;
};
