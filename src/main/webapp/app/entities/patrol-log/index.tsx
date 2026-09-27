import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import PatrolLog from './patrol-log';
import PatrolLogDeleteDialog from './patrol-log-delete-dialog';
import PatrolLogDetail from './patrol-log-detail';
import PatrolLogUpdate from './patrol-log-update';

const PatrolLogRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<PatrolLog />} />
    <Route path="new" element={<PatrolLogUpdate />} />
    <Route path=":id">
      <Route index element={<PatrolLogDetail />} />
      <Route path="edit" element={<PatrolLogUpdate />} />
      <Route path="delete" element={<PatrolLogDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default PatrolLogRoutes;
