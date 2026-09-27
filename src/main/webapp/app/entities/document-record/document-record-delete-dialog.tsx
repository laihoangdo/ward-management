import React, { useEffect, useState } from 'react';
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from 'react-bootstrap';
import { useLocation, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';

import { deleteEntity, getEntity } from './document-record.reducer';

export const DocumentRecordDeleteDialog = () => {
  const dispatch = useAppDispatch();
  const pageLocation = useLocation();
  const navigate = useNavigate();
  const { id } = useParams<'id'>();

  const [loadModal, setLoadModal] = useState(false);

  useEffect(() => {
    dispatch(getEntity(id!));
    setLoadModal(true);
  }, []);

  const documentRecordEntity = useAppSelector(state => state.documentRecord.entity);
  const updateSuccess = useAppSelector(state => state.documentRecord.updateSuccess);

  const handleClose = () => {
    navigate(`/document-record${pageLocation.search}`);
  };

  useEffect(() => {
    if (updateSuccess && loadModal) {
      handleClose();
      setLoadModal(false);
    }
  }, [updateSuccess]);

  const confirmDelete = () => {
    dispatch(deleteEntity(documentRecordEntity.id));
  };

  return (
    <Modal show onHide={handleClose}>
      <ModalHeader data-cy="documentRecordDeleteDialogHeading" closeButton>
        Xác nhận hành động xóa
      </ModalHeader>
      <ModalBody id="monolithicApp.documentRecord.delete.question">
        Bạn có chắc là muốn xóa Document Record {documentRecordEntity.id}?
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={handleClose}>
          <FontAwesomeIcon icon="ban" />
          &nbsp; Hủy
        </Button>
        <Button id="jhi-confirm-delete-documentRecord" data-cy="entityConfirmDeleteButton" variant="danger" onClick={confirmDelete}>
          <FontAwesomeIcon icon="trash" />
          &nbsp; Xóa
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default DocumentRecordDeleteDialog;
