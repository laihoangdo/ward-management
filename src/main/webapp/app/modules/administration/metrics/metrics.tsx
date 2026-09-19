import React, { useEffect } from 'react';
import { Button, Col, Row } from 'react-bootstrap';
import {
  CacheMetrics,
  DatasourceMetrics,
  EndpointsRequestsMetrics,
  GarbageCollectorMetrics,
  HttpRequestMetrics,
  JvmMemory,
  JvmThreads,
  SystemMetrics,
} from 'react-jhipster';

import { faSync } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_TIMESTAMP_FORMAT, APP_TWO_DIGITS_AFTER_POINT_NUMBER_FORMAT, APP_WHOLE_NUMBER_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getSystemMetrics, getSystemThreadDump } from '../administration.reducer';

export const MetricsPage = () => {
  const dispatch = useAppDispatch();
  const metrics = useAppSelector(state => state.administration.metrics);
  const isFetching = useAppSelector(state => state.administration.loading);
  const threadDump = useAppSelector(state => state.administration.threadDump);

  useEffect(() => {
    dispatch(getSystemMetrics());
    dispatch(getSystemThreadDump());
  }, []);

  const getMetrics = () => {
    if (!isFetching) {
      dispatch(getSystemMetrics());
      dispatch(getSystemThreadDump());
    }
  };

  return (
    <div>
      <h2 id="metrics-page-heading" data-cy="metricsPageHeading">
        Các số liệu của chương trình
      </h2>
      <p>
        <Button onClick={getMetrics} color={`btn ${isFetching ? 'btn-danger' : 'btn-primary'}`} disabled={isFetching}>
          <FontAwesomeIcon icon={faSync} />
          &nbsp; Làm mới
        </Button>
      </p>
      <hr />

      <Row>
        <Col sm="12">
          <h3>Số liệu của máy ảo Java</h3>
          <Row>
            <Col md="4">{metrics?.jvm && <JvmMemory jvmMetrics={metrics.jvm} wholeNumberFormat={APP_WHOLE_NUMBER_FORMAT} />}</Col>
            <Col md="4">{threadDump && <JvmThreads jvmThreads={threadDump} wholeNumberFormat={APP_WHOLE_NUMBER_FORMAT} />}</Col>
            <Col md="4">
              {metrics?.processMetrics && (
                <SystemMetrics
                  systemMetrics={metrics.processMetrics}
                  wholeNumberFormat={APP_WHOLE_NUMBER_FORMAT}
                  timestampFormat={APP_TIMESTAMP_FORMAT}
                />
              )}
            </Col>
          </Row>
        </Col>
      </Row>

      {metrics?.garbageCollector && (
        <GarbageCollectorMetrics garbageCollectorMetrics={metrics.garbageCollector} wholeNumberFormat={APP_WHOLE_NUMBER_FORMAT} />
      )}
      {metrics?.['http.server.requests'] && (
        <HttpRequestMetrics
          requestMetrics={metrics['http.server.requests']}
          twoDigitAfterPointFormat={APP_TWO_DIGITS_AFTER_POINT_NUMBER_FORMAT}
          wholeNumberFormat={APP_WHOLE_NUMBER_FORMAT}
        />
      )}
      {metrics?.services && (
        <EndpointsRequestsMetrics endpointsRequestsMetrics={metrics.services} wholeNumberFormat={APP_WHOLE_NUMBER_FORMAT} />
      )}

      {metrics?.cache && (
        <Row>
          <Col sm="12">
            <CacheMetrics cacheMetrics={metrics.cache} twoDigitAfterPointFormat={APP_TWO_DIGITS_AFTER_POINT_NUMBER_FORMAT} />
          </Col>
        </Row>
      )}

      {metrics?.databases && JSON.stringify(metrics.databases) !== '{}' && (
        <Row>
          <Col sm="12">
            <DatasourceMetrics datasourceMetrics={metrics.databases} twoDigitAfterPointFormat={APP_TWO_DIGITS_AFTER_POINT_NUMBER_FORMAT} />
          </Col>
        </Row>
      )}
    </div>
  );
};

export default MetricsPage;
