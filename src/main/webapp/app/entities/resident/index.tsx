import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import Resident from './resident';
import ResidentDeleteDialog from './resident-delete-dialog';
import ResidentDetail from './resident-detail';
import ResidentUpdate from './resident-update';

const ResidentRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<Resident />} />
    <Route path="new" element={<ResidentUpdate />} />
    <Route path=":id">
      <Route index element={<ResidentDetail />} />
      <Route path="edit" element={<ResidentUpdate />} />
      <Route path="delete" element={<ResidentDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default ResidentRoutes;
