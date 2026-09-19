import React from 'react';

import MenuItem from 'app/shared/layout/menus/menu-item';

import { NavDropdown } from './menu-components';

const adminMenuItems = () => (
  <>
    <MenuItem icon="tachometer-alt" to="/admin/metrics">
      Số liệu
    </MenuItem>
    <MenuItem icon="heart" to="/admin/health">
      Tình trạng
    </MenuItem>
    <MenuItem icon="cogs" to="/admin/configuration">
      Cấu hình
    </MenuItem>
    <MenuItem icon="tasks" to="/admin/logs">
      Ghi logs
    </MenuItem>
    {/* jhipster-needle-add-element-to-admin-menu - JHipster will add entities to the admin menu here */}
  </>
);

const openAPIItem = () => (
  <MenuItem icon="book" to="/admin/docs">
    API
  </MenuItem>
);

export const AdminMenu = ({ showOpenAPI }) => (
  <NavDropdown icon="users-cog" name="Quản trị" id="admin-menu" data-cy="adminMenu">
    {adminMenuItems()}
    {showOpenAPI && openAPIItem()}
  </NavDropdown>
);
