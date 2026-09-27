import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import AreaZone from './area-zone';
import AreaZoneDeleteDialog from './area-zone-delete-dialog';
import AreaZoneDetail from './area-zone-detail';
import AreaZoneUpdate from './area-zone-update';

const AreaZoneRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<AreaZone />} />
    <Route path="new" element={<AreaZoneUpdate />} />
    <Route path=":id">
      <Route index element={<AreaZoneDetail />} />
      <Route path="edit" element={<AreaZoneUpdate />} />
      <Route path="delete" element={<AreaZoneDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default AreaZoneRoutes;
