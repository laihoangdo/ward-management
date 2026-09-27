import React from 'react';

import MenuItem from 'app/shared/layout/menus/menu-item';

const EntitiesMenu = () => {
  return (
    <>
      {/* prettier-ignore */}
      <MenuItem icon="asterisk" to="/household">
        Household
      </MenuItem>
      <MenuItem icon="asterisk" to="/resident">
        Resident
      </MenuItem>
      <MenuItem icon="asterisk" to="/area-zone">
        Area Zone
      </MenuItem>
      <MenuItem icon="asterisk" to="/document-record">
        Document Record
      </MenuItem>
      <MenuItem icon="asterisk" to="/security-alert">
        Security Alert
      </MenuItem>
      <MenuItem icon="asterisk" to="/patrol-log">
        Patrol Log
      </MenuItem>
      {/* jhipster-needle-add-entity-to-menu - JHipster will add entities to the menu here */}
    </>
  );
};

export default EntitiesMenu;
