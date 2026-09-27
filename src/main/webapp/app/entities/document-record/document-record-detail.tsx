import React, { useEffect } from 'react';
import { Button, Col, Row } from 'react-bootstrap';
import { Link, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './document-record.reducer';

export const DocumentRecordDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id!));
  }, []);

  const documentRecordEntity = useAppSelector(state => state.documentRecord.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="documentRecordDetailsHeading">Document Record</h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">ID</span>
          </dt>
          <dd>{documentRecordEntity.id}</dd>
          <dt>
            <span id="docName">Doc Name</span>
          </dt>
          <dd>{documentRecordEntity.docName}</dd>
          <dt>
            <span id="docType">Doc Type</span>
          </dt>
          <dd>{documentRecordEntity.docType}</dd>
          <dt>
            <span id="householdName">Household Name</span>
          </dt>
          <dd>{documentRecordEntity.householdName}</dd>
          <dt>
            <span id="address">Address</span>
          </dt>
          <dd>{documentRecordEntity.address}</dd>
          <dt>
            <span id="status">Status</span>
          </dt>
          <dd>{documentRecordEntity.status}</dd>
          <dt>
            <span id="expiryDate">Expiry Date</span>
          </dt>
          <dd>{documentRecordEntity.expiryDate}</dd>
          <dt>
            <span id="officer">Officer</span>
          </dt>
          <dd>{documentRecordEntity.officer}</dd>
          <dt>
            <span id="phone">Phone</span>
          </dt>
          <dd>{documentRecordEntity.phone}</dd>
          <dt>
            <span id="notes">Notes</span>
          </dt>
          <dd>{documentRecordEntity.notes}</dd>
          <dt>
            <span id="reminderSent">Reminder Sent</span>
          </dt>
          <dd>{documentRecordEntity.reminderSent ? 'true' : 'false'}</dd>
        </dl>
        <Button as={Link as any} to="/document-record" replace variant="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" /> <span className="d-none d-md-inline">Quay lại</span>
        </Button>
        &nbsp;
        <Button as={Link as any} to={`/document-record/${documentRecordEntity.id}/edit`} replace variant="primary">
          <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
        </Button>
      </Col>
    </Row>
  );
};

export default DocumentRecordDetail;
