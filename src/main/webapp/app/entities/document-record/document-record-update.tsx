import React, { useEffect } from 'react';
import { Button, Col, Row } from 'react-bootstrap';
import { ValidatedField, ValidatedForm } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';

import { createEntity, getEntity, reset, updateEntity } from './document-record.reducer';

export const DocumentRecordUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const documentRecordEntity = useAppSelector(state => state.documentRecord.entity);
  const loading = useAppSelector(state => state.documentRecord.loading);
  const updating = useAppSelector(state => state.documentRecord.updating);
  const updateSuccess = useAppSelector(state => state.documentRecord.updateSuccess);

  const handleClose = () => {
    navigate(`/document-record${location.search}`);
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

    const entity = {
      ...documentRecordEntity,
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
          ...documentRecordEntity,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="monolithicApp.documentRecord.home.createOrEditLabel" data-cy="DocumentRecordCreateUpdateHeading">
            Thêm mới hoặc cập nhật Document Record
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm mode="all" defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && <ValidatedField name="id" required readOnly id="document-record-id" label="ID" validate={{ required: true }} />}
              <ValidatedField
                label="Doc Name"
                id="document-record-docName"
                name="docName"
                data-cy="docName"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField
                label="Doc Type"
                id="document-record-docType"
                name="docType"
                data-cy="docType"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField
                label="Household Name"
                id="document-record-householdName"
                name="householdName"
                data-cy="householdName"
                type="text"
              />
              <ValidatedField label="Address" id="document-record-address" name="address" data-cy="address" type="text" />
              <ValidatedField label="Status" id="document-record-status" name="status" data-cy="status" type="text" />
              <ValidatedField label="Expiry Date" id="document-record-expiryDate" name="expiryDate" data-cy="expiryDate" type="text" />
              <ValidatedField label="Officer" id="document-record-officer" name="officer" data-cy="officer" type="text" />
              <ValidatedField label="Phone" id="document-record-phone" name="phone" data-cy="phone" type="text" />
              <ValidatedField label="Notes" id="document-record-notes" name="notes" data-cy="notes" type="textarea" />
              <ValidatedField
                label="Reminder Sent"
                id="document-record-reminderSent"
                name="reminderSent"
                data-cy="reminderSent"
                check
                type="checkbox"
              />
              <Button as={Link as any} id="cancel-save" data-cy="entityCreateCancelButton" to="/document-record" replace variant="info">
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

export default DocumentRecordUpdate;
