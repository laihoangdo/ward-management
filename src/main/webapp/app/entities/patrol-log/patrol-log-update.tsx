import React, { useEffect } from 'react';
import { Button, Col, Row } from 'react-bootstrap';
import { ValidatedField, ValidatedForm } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { convertDateTimeFromServer, convertDateTimeToServer, displayDefaultDateTime } from 'app/shared/util/date-utils';

import { createEntity, getEntity, reset, updateEntity } from './patrol-log.reducer';

export const PatrolLogUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const patrolLogEntity = useAppSelector(state => state.patrolLog.entity);
  const loading = useAppSelector(state => state.patrolLog.loading);
  const updating = useAppSelector(state => state.patrolLog.updating);
  const updateSuccess = useAppSelector(state => state.patrolLog.updateSuccess);

  const handleClose = () => {
    navigate(`/patrol-log${location.search}`);
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
    values.timestamp = convertDateTimeToServer(values.timestamp);

    const entity = {
      ...patrolLogEntity,
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
      ? {
          timestamp: displayDefaultDateTime(),
        }
      : {
          ...patrolLogEntity,
          timestamp: convertDateTimeFromServer(patrolLogEntity.timestamp),
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="monolithicApp.patrolLog.home.createOrEditLabel" data-cy="PatrolLogCreateUpdateHeading">
            Thêm mới hoặc cập nhật Patrol Log
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm mode="all" defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && <ValidatedField name="id" required readOnly id="patrol-log-id" label="ID" validate={{ required: true }} />}
              <ValidatedField
                label="Action"
                id="patrol-log-action"
                name="action"
                data-cy="action"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField label="Target" id="patrol-log-target" name="target" data-cy="target" type="text" />
              <ValidatedField label="Details" id="patrol-log-details" name="details" data-cy="details" type="textarea" />
              <ValidatedField
                label="Officer Name"
                id="patrol-log-officerName"
                name="officerName"
                data-cy="officerName"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField label="Badge Number" id="patrol-log-badgeNumber" name="badgeNumber" data-cy="badgeNumber" type="text" />
              <ValidatedField label="Ip Address" id="patrol-log-ipAddress" name="ipAddress" data-cy="ipAddress" type="text" />
              <ValidatedField
                label="Timestamp"
                id="patrol-log-timestamp"
                name="timestamp"
                data-cy="timestamp"
                type="datetime-local"
                placeholder="YYYY-MM-DD HH:mm"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <Button as={Link as any} id="cancel-save" data-cy="entityCreateCancelButton" to="/patrol-log" replace variant="info">
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

export default PatrolLogUpdate;
