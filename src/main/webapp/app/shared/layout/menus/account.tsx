import React from 'react';
import { DropdownItem } from 'react-bootstrap';
import { useLocation, useNavigate } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import MenuItem from 'app/shared/layout/menus/menu-item';
import { getLoginUrl } from 'app/shared/util/url-utils';

import { NavDropdown } from './menu-components';

const accountMenuItemsAuthenticated = () => (
  <>
    <MenuItem icon="sign-out-alt" to="/logout" data-cy="logout">
      Đăng xuất
    </MenuItem>
  </>
);

const accountMenuItems = () => {
  const navigate = useNavigate();
  const pageLocation = useLocation();

  return (
    <>
      <DropdownItem
        id="login-item"
        as="a"
        data-cy="login"
        onClick={() =>
          navigate(getLoginUrl(), {
            state: { from: pageLocation },
          })
        }
      >
        <FontAwesomeIcon icon="sign-in-alt" /> Đăng nhập
      </DropdownItem>
    </>
  );
};

export const AccountMenu = ({ isAuthenticated = false }) => (
  <NavDropdown icon="user" name="Tài khoản" id="account-menu" data-cy="accountMenu">
    {isAuthenticated && accountMenuItemsAuthenticated()}
    {!isAuthenticated && accountMenuItems()}
  </NavDropdown>
);
