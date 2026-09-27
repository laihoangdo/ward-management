import React, { useEffect } from 'react';
import { Button, Col, Row } from 'react-bootstrap';
import { ValidatedField, ValidatedForm } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getEntities as getAreaZones } from 'app/entities/area-zone/area-zone.reducer';
import { FacilityType } from 'app/shared/model/enumerations/facility-type.model';
import { SecurityStatus } from 'app/shared/model/enumerations/security-status.model';

import { createEntity, getEntity, reset, updateEntity } from './household.reducer';

export const HouseholdUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const areaZones = useAppSelector(state => state.areaZone.entities);
  const householdEntity = useAppSelector(state => state.household.entity);
  const loading = useAppSelector(state => state.household.loading);
  const updating = useAppSelector(state => state.household.updating);
  const updateSuccess = useAppSelector(state => state.household.updateSuccess);
  const facilityTypeValues = Object.keys(FacilityType);
  const securityStatusValues = Object.keys(SecurityStatus);

  const handleClose = () => {
    navigate(`/household${location.search}`);
  };

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getEntity(id));
    }

    dispatch(getAreaZones({}));
  }, []);

  useEffect(() => {
    if (updateSuccess) {
      handleClose();
    }
  }, [updateSuccess]);

  const saveEntity = values => {
    if (values.id !== undefined && typeof values.id !== 'number') {
      values.id = Number(values.id);
    }
    if (values.residentsCount !== undefined && typeof values.residentsCount !== 'number') {
      values.residentsCount = Number(values.residentsCount);
    }
    if (values.maleCount !== undefined && typeof values.maleCount !== 'number') {
      values.maleCount = Number(values.maleCount);
    }
    if (values.femaleCount !== undefined && typeof values.femaleCount !== 'number') {
      values.femaleCount = Number(values.femaleCount);
    }
    if (values.under18Count !== undefined && typeof values.under18Count !== 'number') {
      values.under18Count = Number(values.under18Count);
    }
    if (values.above18Count !== undefined && typeof values.above18Count !== 'number') {
      values.above18Count = Number(values.above18Count);
    }
    if (values.latitude !== undefined && typeof values.latitude !== 'number') {
      values.latitude = Number(values.latitude);
    }
    if (values.longitude !== undefined && typeof values.longitude !== 'number') {
      values.longitude = Number(values.longitude);
    }

    const entity = {
      ...householdEntity,
      ...values,
      areaZone: areaZones.find(it => it.id.toString() === values.areaZone?.toString()),
    };

    if (isNew) {
      dispatch(createEntity(entity));
    } else {
      dispatch(updateEntity(entity));
    }
  };

  const defaultValues = () =>
    isNew
      ? {}
      : {
          type: 'RESIDENTIAL',
          status: 'NORMAL',
          ...householdEntity,
          areaZone: householdEntity?.areaZone?.id,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="monolithicApp.household.home.createOrEditLabel" data-cy="HouseholdCreateUpdateHeading">
            Thêm mới hoặc cập nhật Household
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm mode="all" defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && <ValidatedField name="id" required readOnly id="household-id" label="ID" validate={{ required: true }} />}
              <ValidatedField
                label="Code"
                id="household-code"
                name="code"
                data-cy="code"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField
                label="House Number"
                id="household-houseNumber"
                name="houseNumber"
                data-cy="houseNumber"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField
                label="Street"
                id="household-street"
                name="street"
                data-cy="street"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField
                label="Hamlet"
                id="household-hamlet"
                name="hamlet"
                data-cy="hamlet"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField
                label="Neighborhood Group"
                id="household-neighborhoodGroup"
                name="neighborhoodGroup"
                data-cy="neighborhoodGroup"
                type="text"
              />
              <ValidatedField label="Alley" id="household-alley" name="alley" data-cy="alley" type="text" />
              <ValidatedField
                label="Owner Name"
                id="household-ownerName"
                name="ownerName"
                data-cy="ownerName"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField
                label="Owner Phone"
                id="household-ownerPhone"
                name="ownerPhone"
                data-cy="ownerPhone"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField label="Type" id="household-type" name="type" data-cy="type" type="select">
                {facilityTypeValues.map(facilityType => (
                  <option value={facilityType} key={facilityType}>
                    {facilityType}
                  </option>
                ))}
              </ValidatedField>
              <ValidatedField label="Business Name" id="household-businessName" name="businessName" data-cy="businessName" type="text" />
              <ValidatedField
                label="Business Category"
                id="household-businessCategory"
                name="businessCategory"
                data-cy="businessCategory"
                type="text"
              />
              <ValidatedField
                label="Residents Count"
                id="household-residentsCount"
                name="residentsCount"
                data-cy="residentsCount"
                type="text"
              />
              <ValidatedField label="Male Count" id="household-maleCount" name="maleCount" data-cy="maleCount" type="text" />
              <ValidatedField label="Female Count" id="household-femaleCount" name="femaleCount" data-cy="femaleCount" type="text" />
              <ValidatedField label="Under 18 Count" id="household-under18Count" name="under18Count" data-cy="under18Count" type="text" />
              <ValidatedField label="Above 18 Count" id="household-above18Count" name="above18Count" data-cy="above18Count" type="text" />
              <ValidatedField label="Status" id="household-status" name="status" data-cy="status" type="select">
                {securityStatusValues.map(securityStatus => (
                  <option value={securityStatus} key={securityStatus}>
                    {securityStatus}
                  </option>
                ))}
              </ValidatedField>
              <ValidatedField
                label="Warning Message"
                id="household-warningMessage"
                name="warningMessage"
                data-cy="warningMessage"
                type="text"
              />
              <ValidatedField
                label="License Expiry"
                id="household-licenseExpiry"
                name="licenseExpiry"
                data-cy="licenseExpiry"
                type="text"
              />
              <ValidatedField label="License Type" id="household-licenseType" name="licenseType" data-cy="licenseType" type="text" />
              <ValidatedField label="Latitude" id="household-latitude" name="latitude" data-cy="latitude" type="text" />
              <ValidatedField label="Longitude" id="household-longitude" name="longitude" data-cy="longitude" type="text" />
              <ValidatedField label="Notes" id="household-notes" name="notes" data-cy="notes" type="textarea" />
              <ValidatedField
                label="Last Checked Date"
                id="household-lastCheckedDate"
                name="lastCheckedDate"
                data-cy="lastCheckedDate"
                type="text"
              />
              <ValidatedField
                label="Officer In Charge"
                id="household-officerInCharge"
                name="officerInCharge"
                data-cy="officerInCharge"
                type="text"
              />
              <ValidatedField id="household-areaZone" name="areaZone" data-cy="areaZone" label="Area Zone" type="select">
                <option value="" key="0" />
                {areaZones
                  ? areaZones.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.name}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <Button as={Link as any} id="cancel-save" data-cy="entityCreateCancelButton" to="/household" replace variant="info">
                <FontAwesomeIcon icon="arrow-left" />
                &nbsp;
                <span className="d-none d-md-inline">Quay lại</span>
              </Button>
              &nbsp;
              <Button variant="primary" id="save-entity" data-cy="entityCreateSaveButton" type="submit" disabled={updating}>
                <FontAwesomeIcon icon="save" />
                &nbsp; Lưu
              </Button>
            </ValidatedForm>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default HouseholdUpdate;
