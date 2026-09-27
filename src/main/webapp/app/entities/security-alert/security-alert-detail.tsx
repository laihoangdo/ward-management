import React, { useEffect } from 'react';
import { Button, Col, Row } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './security-alert.reducer';

export const SecurityAlertDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const securityAlertEntity = useAppSelector(state => state.securityAlert.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="securityAlertDetailsHeading">Security Alert</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{securityAlertEntity.id}</dd>
          <dt>
            <span id="alertType">Alert Type</span>
          </dt>
          <dd>{securityAlertEntity.alertType}</dd>
          <dt>
            <span id="severity">Severity</span>
          </dt>
          <dd>{securityAlertEntity.severity}</dd>
          <dt>
            <span id="title">Title</span>
          </dt>
          <dd>{securityAlertEntity.title}</dd>
          <dt>
            <span id="description">Description</span>
          </dt>
          <dd>{securityAlertEntity.description}</dd>
          <dt>
            <span id="location">Location</span>
          </dt>
          <dd>{securityAlertEntity.location}</dd>
          <dt>
            <span id="isResolved">Is Resolved</span>
          </dt>
          <dd>{securityAlertEntity.isResolved ? 'true' : 'false'}</dd>
          <dt>
            <span id="reportedAt">Reported At</span>
          </dt>
          <dd>
            {securityAlertEntity.reportedAt ? (
              <TextFormat value={securityAlertEntity.reportedAt} type="date" format={APP_DATE_FORMAT} />
            ) : null}
          </dd>
          <dt>
            <span id="resolvedAt">Resolved At</span>
          </dt>
          <dd>
            {securityAlertEntity.resolvedAt ? (
              <TextFormat value={securityAlertEntity.resolvedAt} type="date" format={APP_DATE_FORMAT} />
            ) : null}
          </dd>
        </dl>
        <Button as={Link as any} to="/security-alert" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/security-alert/${securityAlertEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default SecurityAlertDetail;
