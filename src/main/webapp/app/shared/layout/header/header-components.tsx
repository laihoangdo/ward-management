import React from 'react';
import { NavItem, NavLink, NavbarBrand } from 'react-bootstrap';
import { NavLink as Link } from 'react-router';

import { faHome, faMapLocationDot } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import logo from '/content/images/logo-jhipster.png';

export const BrandIcon = props => (
  <div {...props} className="brand-icon">
    <img src={logo} alt="Logo" />
  </div>
);

export const Brand = () => (
  <NavbarBrand as={Link} to="/" className="brand-logo">
    <BrandIcon />
    <span className="brand-title">Monolithic</span>
    <span className="navbar-version">{VERSION.toLowerCase().startsWith('v') ? VERSION : `v${VERSION}`}</span>
  </NavbarBrand>
);

export const Home = () => (
  <NavItem>
    <NavLink as={Link} to="/" className="d-flex align-items-center">
      <FontAwesomeIcon icon={faHome} />
      <span>Trang chủ</span>
    </NavLink>
  </NavItem>
);

export const GisDashboardNav = () => (
  <NavItem>
    <NavLink as={Link} to="/dashboard" className="d-flex align-items-center text-warning fw-bold">
      <FontAwesomeIcon icon={faMapLocationDot} />
      <span className="ms-1">Bản đồ GIS & Điều hành</span>
    </NavLink>
  </NavItem>
);
