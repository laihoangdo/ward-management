import React, { useEffect, useState } from 'react';
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from 'react-bootstrap';
import { useLocation, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';

import { deleteEntity, getEntity } from './security-alert.reducer';

export const SecurityAlertDeleteDialog = () => {
  const dispatch = useAppDispatch();
  const pageLocation = useLocation();
  const navigate = useNavigate();
  const { id } = useParams<'id'>();

  const [loadModal, setLoadModal] = useState(false);

  useEffect(() => {
    dispatch(getEntity(id!));
    setLoadModal(true);
  }, []);

  const securityAlertEntity = useAppSelector(state => state.securityAlert.entity);
  const updateSuccess = useAppSelector(state => state.securityAlert.updateSuccess);

  const handleClose = () => {
    navigate(`/security-alert${pageLocation.search}`);
  };

  useEffect(() => {
    if (updateSuccess && loadModal) {
      handleClose();
      setLoadModal(false);
    }
  }, [updateSuccess]);

  const confirmDelete = () => {
    dispatch(deleteEntity(securityAlertEntity.id));
  };

  return (
    <Modal show onHide={handleClose}>
      <ModalHeader data-cy="securityAlertDeleteDialogHeading" closeButton>
        Xác nhận hành động xóa
      </ModalHeader>
      <ModalBody id="monolithicApp.securityAlert.delete.question">
        Bạn có chắc là muốn xóa Security Alert {securityAlertEntity.id}?
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={handleClose}>
          <FontAwesomeIcon icon="ban" />
          &nbsp; Hủy
        </Button>
        <Button id="jhi-confirm-delete-securityAlert" data-cy="entityConfirmDeleteButton" variant="danger" onClick={confirmDelete}>
          <FontAwesomeIcon icon="trash" />
          &nbsp; Xóa
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default SecurityAlertDeleteDialog;
