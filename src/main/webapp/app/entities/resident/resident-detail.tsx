import React, { useEffect } from 'react';
import { Button, Col, Row } from 'react-bootstrap';
import { TextFormat } from 'react-jhipster';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_LOCAL_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './resident.reducer';

export const ResidentDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const residentEntity = useAppSelector(state => state.resident.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="residentDetailsHeading">Resident</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{residentEntity.id}</dd>
          <dt>
            <span id="fullName">Full Name</span>
          </dt>
          <dd>{residentEntity.fullName}</dd>
          <dt>
            <span id="idCardNumber">Id Card Number</span>
          </dt>
          <dd>{residentEntity.idCardNumber}</dd>
          <dt>
            <span id="birthYear">Birth Year</span>
          </dt>
          <dd>{residentEntity.birthYear}</dd>
          <dt>
            <span id="gender">Gender</span>
          </dt>
          <dd>{residentEntity.gender}</dd>
          <dt>
            <span id="relationship">Relationship</span>
          </dt>
          <dd>{residentEntity.relationship}</dd>
          <dt>
            <span id="residenceType">Residence Type</span>
          </dt>
          <dd>{residentEntity.residenceType}</dd>
          <dt>
            <span id="temporaryRegisteredAt">Temporary Registered At</span>
          </dt>
          <dd>
            {residentEntity.temporaryRegisteredAt ? (
              <TextFormat value={residentEntity.temporaryRegisteredAt} type="date" format={APP_LOCAL_DATE_FORMAT} />
            ) : null}
          </dd>
          <dt>
            <span id="notes">Notes</span>
          </dt>
          <dd>{residentEntity.notes}</dd>
          <dt>Household</dt>
          <dd>{residentEntity.household ? residentEntity.household.code : ''}</dd>
        </dl>
        <Button as={Link as any} to="/resident" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/resident/${residentEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default ResidentDetail;
