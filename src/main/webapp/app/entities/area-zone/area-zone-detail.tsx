import React, { useEffect } from 'react';
import { Button, Col, Row } from 'react-bootstrap';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './area-zone.reducer';

export const AreaZoneDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const areaZoneEntity = useAppSelector(state => state.areaZone.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="areaZoneDetailsHeading">Area Zone</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{areaZoneEntity.id}</dd>
          <dt>
            <span id="code">Code</span>
          </dt>
          <dd>{areaZoneEntity.code}</dd>
          <dt>
            <span id="name">Name</span>
          </dt>
          <dd>{areaZoneEntity.name}</dd>
          <dt>
            <span id="hamletName">Hamlet Name</span>
          </dt>
          <dd>{areaZoneEntity.hamletName}</dd>
          <dt>
            <span id="officerInCharge">Officer In Charge</span>
          </dt>
          <dd>{areaZoneEntity.officerInCharge}</dd>
          <dt>
            <span id="officerPhone">Officer Phone</span>
          </dt>
          <dd>{areaZoneEntity.officerPhone}</dd>
          <dt>
            <span id="populationCount">Population Count</span>
          </dt>
          <dd>{areaZoneEntity.populationCount}</dd>
          <dt>
            <span id="householdCount">Household Count</span>
          </dt>
          <dd>{areaZoneEntity.householdCount}</dd>
          <dt>
            <span id="boundaryGeoJson">Boundary Geo Json</span>
          </dt>
          <dd>{areaZoneEntity.boundaryGeoJson}</dd>
        </dl>
        <Button as={Link as any} to="/area-zone" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/area-zone/${areaZoneEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default AreaZoneDetail;
