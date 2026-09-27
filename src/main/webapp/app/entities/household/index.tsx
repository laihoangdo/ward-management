import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import Household from './household';
import HouseholdDeleteDialog from './household-delete-dialog';
import HouseholdDetail from './household-detail';
import HouseholdUpdate from './household-update';

const HouseholdRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<Household />} />
    <Route path="new" element={<HouseholdUpdate />} />
    <Route path=":id">
      <Route index element={<HouseholdDetail />} />
      <Route path="edit" element={<HouseholdUpdate />} />
      <Route path="delete" element={<HouseholdDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default HouseholdRoutes;
