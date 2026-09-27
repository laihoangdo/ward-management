import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';
import PageNotFound from 'app/shared/error/page-not-found';

import AreaZone from './area-zone';
import DocumentRecord from './document-record';
import Household from './household';
import PatrolLog from './patrol-log';
import Resident from './resident';
import SecurityAlert from './security-alert';
/* jhipster-needle-add-route-import - JHipster will add routes here */

export default () => {
  return (
    <div>
      <ErrorBoundaryRoutes>
        {/* prettier-ignore */}
        <Route path="/household/*" element={<Household />} />
        <Route path="/resident/*" element={<Resident />} />
        <Route path="/area-zone/*" element={<AreaZone />} />
        <Route path="/document-record/*" element={<DocumentRecord />} />
        <Route path="/security-alert/*" element={<SecurityAlert />} />
        <Route path="/patrol-log/*" element={<PatrolLog />} />
        {/* jhipster-needle-add-route-path - JHipster will add routes here */}
        <Route path="*" element={<PageNotFound />} />
      </ErrorBoundaryRoutes>
    </div>
  );
};
