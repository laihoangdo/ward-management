import React, { useEffect } from 'react';
import { Button, Col, Row } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './patrol-log.reducer';

export const PatrolLogDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const patrolLogEntity = useAppSelector(state => state.patrolLog.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="patrolLogDetailsHeading">Patrol Log</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{patrolLogEntity.id}</dd>
          <dt>
            <span id="action">Action</span>
          </dt>
          <dd>{patrolLogEntity.action}</dd>
          <dt>
            <span id="target">Target</span>
          </dt>
          <dd>{patrolLogEntity.target}</dd>
          <dt>
            <span id="details">Details</span>
          </dt>
          <dd>{patrolLogEntity.details}</dd>
          <dt>
            <span id="officerName">Officer Name</span>
          </dt>
          <dd>{patrolLogEntity.officerName}</dd>
          <dt>
            <span id="badgeNumber">Badge Number</span>
          </dt>
          <dd>{patrolLogEntity.badgeNumber}</dd>
          <dt>
            <span id="ipAddress">Ip Address</span>
          </dt>
          <dd>{patrolLogEntity.ipAddress}</dd>
          <dt>
            <span id="timestamp">Timestamp</span>
          </dt>
          <dd>
            {patrolLogEntity.timestamp ? <TextFormat value={patrolLogEntity.timestamp} type="date" format={APP_DATE_FORMAT} /> : null}
          </dd>
        </dl>
        <Button as={Link as any} to="/patrol-log" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/patrol-log/${patrolLogEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default PatrolLogDetail;
