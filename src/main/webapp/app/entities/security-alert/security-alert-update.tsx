import React, { useEffect } from 'react';
import { Button, Col, Row } from 'react-bootstrap';
import { ValidatedField, ValidatedForm } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { AlertSeverity } from 'app/shared/model/enumerations/alert-severity.model';
import { convertDateTimeFromServer, convertDateTimeToServer, displayDefaultDateTime } from 'app/shared/util/date-utils';

import { createEntity, getEntity, reset, updateEntity } from './security-alert.reducer';

export const SecurityAlertUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const securityAlertEntity = useAppSelector(state => state.securityAlert.entity);
  const loading = useAppSelector(state => state.securityAlert.loading);
  const updating = useAppSelector(state => state.securityAlert.updating);
  const updateSuccess = useAppSelector(state => state.securityAlert.updateSuccess);
  const alertSeverityValues = Object.keys(AlertSeverity);

  const handleClose = () => {
    navigate(`/security-alert${location.search}`);
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
    values.reportedAt = convertDateTimeToServer(values.reportedAt);
    values.resolvedAt = convertDateTimeToServer(values.resolvedAt);

    const entity = {
      ...securityAlertEntity,
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
          reportedAt: displayDefaultDateTime(),
          resolvedAt: displayDefaultDateTime(),
        }
      : {
          severity: 'INFO',
          ...securityAlertEntity,
          reportedAt: convertDateTimeFromServer(securityAlertEntity.reportedAt),
          resolvedAt: convertDateTimeFromServer(securityAlertEntity.resolvedAt),
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="monolithicApp.securityAlert.home.createOrEditLabel" data-cy="SecurityAlertCreateUpdateHeading">
            Thêm mới hoặc cập nhật Security Alert
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm mode="all" defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && <ValidatedField name="id" required readOnly id="security-alert-id" label="ID" validate={{ required: true }} />}
              <ValidatedField
                label="Alert Type"
                id="security-alert-alertType"
                name="alertType"
                data-cy="alertType"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField label="Severity" id="security-alert-severity" name="severity" data-cy="severity" type="select">
                {alertSeverityValues.map(alertSeverity => (
                  <option value={alertSeverity} key={alertSeverity}>
                    {alertSeverity}
                  </option>
                ))}
              </ValidatedField>
              <ValidatedField
                label="Title"
                id="security-alert-title"
                name="title"
                data-cy="title"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField
                label="Description"
                id="security-alert-description"
                name="description"
                data-cy="description"
                type="textarea"
              />
              <ValidatedField label="Location" id="security-alert-location" name="location" data-cy="location" type="text" />
              <ValidatedField
                label="Is Resolved"
                id="security-alert-isResolved"
                name="isResolved"
                data-cy="isResolved"
                check
                type="checkbox"
              />
              <ValidatedField
                label="Reported At"
                id="security-alert-reportedAt"
                name="reportedAt"
                data-cy="reportedAt"
                type="datetime-local"
                placeholder="YYYY-MM-DD HH:mm"
              />
              <ValidatedField
                label="Resolved At"
                id="security-alert-resolvedAt"
                name="resolvedAt"
                data-cy="resolvedAt"
                type="datetime-local"
                placeholder="YYYY-MM-DD HH:mm"
              />
              <Button as={Link as any} id="cancel-save" data-cy="entityCreateCancelButton" to="/security-alert" replace variant="info">
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

export default SecurityAlertUpdate;
