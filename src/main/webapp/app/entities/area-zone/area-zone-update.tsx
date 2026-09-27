import React, { useEffect } from 'react';
import { Button, Col, Row } from 'react-bootstrap';
import { ValidatedField, ValidatedForm } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';

import { createEntity, getEntity, reset, updateEntity } from './area-zone.reducer';

export const AreaZoneUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const areaZoneEntity = useAppSelector(state => state.areaZone.entity);
  const loading = useAppSelector(state => state.areaZone.loading);
  const updating = useAppSelector(state => state.areaZone.updating);
  const updateSuccess = useAppSelector(state => state.areaZone.updateSuccess);

  const handleClose = () => {
    navigate('/area-zone');
  };

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getEntity(id));
    }
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
    if (values.populationCount !== undefined && typeof values.populationCount !== 'number') {
      values.populationCount = Number(values.populationCount);
    }
    if (values.householdCount !== undefined && typeof values.householdCount !== 'number') {
      values.householdCount = Number(values.householdCount);
    }

    const entity = {
      ...areaZoneEntity,
      ...values,
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
          ...areaZoneEntity,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="monolithicApp.areaZone.home.createOrEditLabel" data-cy="AreaZoneCreateUpdateHeading">
            Thêm mới hoặc cập nhật Area Zone
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm mode="all" defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && <ValidatedField name="id" required readOnly id="area-zone-id" label="ID" validate={{ required: true }} />}
              <ValidatedField
                label="Code"
                id="area-zone-code"
                name="code"
                data-cy="code"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField
                label="Name"
                id="area-zone-name"
                name="name"
                data-cy="name"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField
                label="Hamlet Name"
                id="area-zone-hamletName"
                name="hamletName"
                data-cy="hamletName"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField
                label="Officer In Charge"
                id="area-zone-officerInCharge"
                name="officerInCharge"
                data-cy="officerInCharge"
                type="text"
              />
              <ValidatedField label="Officer Phone" id="area-zone-officerPhone" name="officerPhone" data-cy="officerPhone" type="text" />
              <ValidatedField
                label="Population Count"
                id="area-zone-populationCount"
                name="populationCount"
                data-cy="populationCount"
                type="text"
              />
              <ValidatedField
                label="Household Count"
                id="area-zone-householdCount"
                name="householdCount"
                data-cy="householdCount"
                type="text"
              />
              <ValidatedField
                label="Boundary Geo Json"
                id="area-zone-boundaryGeoJson"
                name="boundaryGeoJson"
                data-cy="boundaryGeoJson"
                type="textarea"
              />
              <Button as={Link as any} id="cancel-save" data-cy="entityCreateCancelButton" to="/area-zone" replace variant="info">
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

export default AreaZoneUpdate;
