import React, { useEffect, useState } from 'react';
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';

import { deleteEntity, getEntity } from './area-zone.reducer';

export const AreaZoneDeleteDialog = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { id } = useParams<'id'>();

  const [loadModal, setLoadModal] = useState(false);

  useEffect(() => {
    dispatch(getEntity(id!));
    setLoadModal(true);
  }, []);

  const areaZoneEntity = useAppSelector(state => state.areaZone.entity);
  const updateSuccess = useAppSelector(state => state.areaZone.updateSuccess);

  const handleClose = () => {
    navigate('/area-zone');
  };

  useEffect(() => {
    if (updateSuccess && loadModal) {
      handleClose();
      setLoadModal(false);
    }
  }, [updateSuccess]);

  const confirmDelete = () => {
    dispatch(deleteEntity(areaZoneEntity.id));
  };

  return (
    <Modal show onHide={handleClose}>
      <ModalHeader data-cy="areaZoneDeleteDialogHeading" closeButton>
        Xác nhận hành động xóa
      </ModalHeader>
      <ModalBody id="monolithicApp.areaZone.delete.question">Bạn có chắc là muốn xóa Area Zone {areaZoneEntity.id}?</ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={handleClose}>
          <FontAwesomeIcon icon="ban" />
          &nbsp; Hủy
        </Button>
        <Button id="jhi-confirm-delete-areaZone" data-cy="entityConfirmDeleteButton" variant="danger" onClick={confirmDelete}>
          <FontAwesomeIcon icon="trash" />
          &nbsp; Xóa
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default AreaZoneDeleteDialog;
