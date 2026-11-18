import React from 'react';
import { Route } from 'react-router';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';
import { useAppSelector } from 'app/config/store';

import Configuration from './configuration/configuration';
import Docs from './docs/docs';
import Health from './health/health';
import Logs from './logs/logs';
import Metrics from './metrics/metrics';

/**
 * The metrics, health, configuration and logs screens read /management/*, which production closes. There they show a
 * short notice instead of a stack of "Not found" errors; operators use the server-side checks and logs instead.
 */
export const MonitoringGate = ({ children }: { children: React.ReactNode }) => {
  const monitoring = useAppSelector(state => state.applicationProfile.monitoring);
  if (monitoring === 'checking') {
    return (
      <p role="status" className="text-muted">
        Đang kiểm tra…
      </p>
    );
  }
  if (monitoring === 'unavailable') {
    return (
      <div role="status" className="alert alert-info">
        <h2 className="h5">Không khả dụng trên production</h2>
        <p className="mb-0">
          Màn hình theo dõi hệ thống (số liệu, tình trạng, cấu hình, ghi logs) được tắt trên máy chủ chính thức để bảo mật. Việc theo dõi
          được thực hiện trên máy chủ.
        </p>
      </div>
    );
  }
  return <>{children}</>;
};

const AdministrationRoutes = () => (
  <div>
    <ErrorBoundaryRoutes>
      <Route
        path="health"
        element={
          <MonitoringGate>
            <Health />
          </MonitoringGate>
        }
      />
      <Route
        path="metrics"
        element={
          <MonitoringGate>
            <Metrics />
          </MonitoringGate>
        }
      />
      <Route
        path="configuration"
        element={
          <MonitoringGate>
            <Configuration />
          </MonitoringGate>
        }
      />
      <Route
        path="logs"
        element={
          <MonitoringGate>
            <Logs />
          </MonitoringGate>
        }
      />
      <Route path="docs" element={<Docs />} />
    </ErrorBoundaryRoutes>
  </div>
);

export default AdministrationRoutes;
