import './header.scss';

import React, { useEffect, useRef } from 'react';
import { Nav, Navbar } from 'react-bootstrap';

import LoadingBar, { LoadingBarRef } from 'react-top-loading-bar';

import { useAppSelector } from 'app/config/store';
import { AccountMenu, AdminMenu, EntitiesMenu } from '../menus';

import { Brand, Home } from './header-components';

export interface IHeaderProps {
  isAuthenticated: boolean;
  isAdmin: boolean;
  ribbonEnv: string;
  isInProduction: boolean;
  isOpenAPIEnabled: boolean;
}

const Header = (props: IHeaderProps) => {
  const loadingBarRef = useRef<LoadingBarRef>(null);
  const loadingCount = useAppSelector(state => state.loadingBar.count);

  useEffect(() => {
    if (loadingCount > 0) {
      loadingBarRef.current?.continuousStart();
    } else {
      loadingBarRef.current?.complete();
    }
  }, [loadingCount]);

  const renderDevRibbon = () =>
    !props.isInProduction && (
      <div className="ribbon dev">
        <a href="">Development</a>
      </div>
    );

  /* jhipster-needle-add-element-to-menu - JHipster will add new menu items here */

  return (
    <div id="app-header">
      {renderDevRibbon()}
      <LoadingBar ref={loadingBarRef} className="loading-bar" color="#009cd8" />
      <Navbar data-cy="navbar" data-bs-theme="dark" expand="md" fixed="top" className="bg-primary" collapseOnSelect>
        <Navbar.Toggle aria-controls="header-tabs" aria-label="Menu" />
        <Brand />
        <Navbar.Collapse id="header-tabs">
          <Nav className="ms-auto">
            <Home />
            {props.isAuthenticated && <EntitiesMenu />}
            {props.isAuthenticated && props.isAdmin && <AdminMenu showOpenAPI={props.isOpenAPIEnabled} />}
            <AccountMenu isAuthenticated={props.isAuthenticated} />
          </Nav>
        </Navbar.Collapse>
      </Navbar>
    </div>
  );
};

export default Header;
