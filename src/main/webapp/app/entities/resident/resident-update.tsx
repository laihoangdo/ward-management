import React, { useEffect } from 'react';
import { Button, Col, Row } from 'react-bootstrap';
import { ValidatedField, ValidatedForm } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getEntities as getHouseholds } from 'app/entities/household/household.reducer';
import { Gender } from 'app/shared/model/enumerations/gender.model';
import { ResidenceType } from 'app/shared/model/enumerations/residence-type.model';

import { createEntity, getEntity, reset, updateEntity } from './resident.reducer';

export const ResidentUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const households = useAppSelector(state => state.household.entities);
  const residentEntity = useAppSelector(state => state.resident.entity);
  const loading = useAppSelector(state => state.resident.loading);
  const updating = useAppSelector(state => state.resident.updating);
  const updateSuccess = useAppSelector(state => state.resident.updateSuccess);
  const genderValues = Object.keys(Gender);
  const residenceTypeValues = Object.keys(ResidenceType);

  const handleClose = () => {
    navigate(`/resident${location.search}`);
  };

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getEntity(id));
    }

    dispatch(getHouseholds({}));
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
    if (values.birthYear !== undefined && typeof values.birthYear !== 'number') {
      values.birthYear = Number(values.birthYear);
    }

    const entity = {
      ...residentEntity,
      ...values,
      household: households.find(it => it.id.toString() === values.household?.toString()),
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
          gender: 'MALE',
          residenceType: 'PERMANENT',
          ...residentEntity,
          household: residentEntity?.household?.id,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="monolithicApp.resident.home.createOrEditLabel" data-cy="ResidentCreateUpdateHeading">
            Thêm mới hoặc cập nhật Resident
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm mode="all" defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && <ValidatedField name="id" required readOnly id="resident-id" label="ID" validate={{ required: true }} />}
              <ValidatedField
                label="Full Name"
                id="resident-fullName"
                name="fullName"
                data-cy="fullName"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField
                label="Id Card Number"
                id="resident-idCardNumber"
                name="idCardNumber"
                data-cy="idCardNumber"
                type="text"
                validate={{}}
              />
              <ValidatedField label="Birth Year" id="resident-birthYear" name="birthYear" data-cy="birthYear" type="text" />
              <ValidatedField label="Gender" id="resident-gender" name="gender" data-cy="gender" type="select">
                {genderValues.map(gender => (
                  <option value={gender} key={gender}>
                    {gender}
                  </option>
                ))}
              </ValidatedField>
              <ValidatedField label="Relationship" id="resident-relationship" name="relationship" data-cy="relationship" type="text" />
              <ValidatedField label="Residence Type" id="resident-residenceType" name="residenceType" data-cy="residenceType" type="select">
                {residenceTypeValues.map(residenceType => (
                  <option value={residenceType} key={residenceType}>
                    {residenceType}
                  </option>
                ))}
              </ValidatedField>
              <ValidatedField
                label="Temporary Registered At"
                id="resident-temporaryRegisteredAt"
                name="temporaryRegisteredAt"
                data-cy="temporaryRegisteredAt"
                type="date"
              />
              <ValidatedField label="Notes" id="resident-notes" name="notes" data-cy="notes" type="textarea" />
              <ValidatedField id="resident-household" name="household" data-cy="household" label="Household" type="select">
                <option value="" key="0" />
                {households
                  ? households.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.code}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <Button as={Link as any} id="cancel-save" data-cy="entityCreateCancelButton" to="/resident" replace variant="info">
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

export default ResidentUpdate;
