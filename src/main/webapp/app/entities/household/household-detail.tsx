import React, { useEffect } from 'react';
import { Button, Col, Row } from 'react-bootstrap';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './household.reducer';

export const HouseholdDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const householdEntity = useAppSelector(state => state.household.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="householdDetailsHeading">Household</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{householdEntity.id}</dd>
          <dt>
            <span id="code">Code</span>
          </dt>
          <dd>{householdEntity.code}</dd>
          <dt>
            <span id="houseNumber">House Number</span>
          </dt>
          <dd>{householdEntity.houseNumber}</dd>
          <dt>
            <span id="street">Street</span>
          </dt>
          <dd>{householdEntity.street}</dd>
          <dt>
            <span id="hamlet">Hamlet</span>
          </dt>
          <dd>{householdEntity.hamlet}</dd>
          <dt>
            <span id="neighborhoodGroup">Neighborhood Group</span>
          </dt>
          <dd>{householdEntity.neighborhoodGroup}</dd>
          <dt>
            <span id="alley">Alley</span>
          </dt>
          <dd>{householdEntity.alley}</dd>
          <dt>
            <span id="ownerName">Owner Name</span>
          </dt>
          <dd>{householdEntity.ownerName}</dd>
          <dt>
            <span id="ownerPhone">Owner Phone</span>
          </dt>
          <dd>{householdEntity.ownerPhone}</dd>
          <dt>
            <span id="type">Type</span>
          </dt>
          <dd>{householdEntity.type}</dd>
          <dt>
            <span id="businessName">Business Name</span>
          </dt>
          <dd>{householdEntity.businessName}</dd>
          <dt>
            <span id="businessCategory">Business Category</span>
          </dt>
          <dd>{householdEntity.businessCategory}</dd>
          <dt>
            <span id="residentsCount">Residents Count</span>
          </dt>
          <dd>{householdEntity.residentsCount}</dd>
          <dt>
            <span id="maleCount">Male Count</span>
          </dt>
          <dd>{householdEntity.maleCount}</dd>
          <dt>
            <span id="femaleCount">Female Count</span>
          </dt>
          <dd>{householdEntity.femaleCount}</dd>
          <dt>
            <span id="under18Count">Under 18 Count</span>
          </dt>
          <dd>{householdEntity.under18Count}</dd>
          <dt>
            <span id="above18Count">Above 18 Count</span>
          </dt>
          <dd>{householdEntity.above18Count}</dd>
          <dt>
            <span id="status">Status</span>
          </dt>
          <dd>{householdEntity.status}</dd>
          <dt>
            <span id="warningMessage">Warning Message</span>
          </dt>
          <dd>{householdEntity.warningMessage}</dd>
          <dt>
            <span id="licenseExpiry">License Expiry</span>
          </dt>
          <dd>{householdEntity.licenseExpiry}</dd>
          <dt>
            <span id="licenseType">License Type</span>
          </dt>
          <dd>{householdEntity.licenseType}</dd>
          <dt>
            <span id="latitude">Latitude</span>
          </dt>
          <dd>{householdEntity.latitude}</dd>
          <dt>
            <span id="longitude">Longitude</span>
          </dt>
          <dd>{householdEntity.longitude}</dd>
          <dt>
            <span id="notes">Notes</span>
          </dt>
          <dd>{householdEntity.notes}</dd>
          <dt>
            <span id="lastCheckedDate">Last Checked Date</span>
          </dt>
          <dd>{householdEntity.lastCheckedDate}</dd>
          <dt>
            <span id="officerInCharge">Officer In Charge</span>
          </dt>
          <dd>{householdEntity.officerInCharge}</dd>
          <dt>Area Zone</dt>
          <dd>{householdEntity.areaZone ? householdEntity.areaZone.name : ''}</dd>
        </dl>
        <Button as={Link as any} to="/household" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/household/${householdEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default HouseholdDetail;
