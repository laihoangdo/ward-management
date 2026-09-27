import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import SecurityAlert from './security-alert';
import SecurityAlertDeleteDialog from './security-alert-delete-dialog';
import SecurityAlertDetail from './security-alert-detail';
import SecurityAlertUpdate from './security-alert-update';

const SecurityAlertRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<SecurityAlert />} />
    <Route path="new" element={<SecurityAlertUpdate />} />
    <Route path=":id">
      <Route index element={<SecurityAlertDetail />} />
      <Route path="edit" element={<SecurityAlertUpdate />} />
      <Route path="delete" element={<SecurityAlertDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default SecurityAlertRoutes;
