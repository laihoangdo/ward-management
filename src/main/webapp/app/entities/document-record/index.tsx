import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import DocumentRecord from './document-record';
import DocumentRecordDeleteDialog from './document-record-delete-dialog';
import DocumentRecordDetail from './document-record-detail';
import DocumentRecordUpdate from './document-record-update';

const DocumentRecordRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<DocumentRecord />} />
    <Route path="new" element={<DocumentRecordUpdate />} />
    <Route path=":id">
      <Route index element={<DocumentRecordDetail />} />
      <Route path="edit" element={<DocumentRecordUpdate />} />
      <Route path="delete" element={<DocumentRecordDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default DocumentRecordRoutes;
