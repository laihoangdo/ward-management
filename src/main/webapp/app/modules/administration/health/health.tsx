import React, { useEffect, useState } from 'react';
import { Badge, Button, Col, Row, Table } from 'react-bootstrap';

import { faEye, faSync } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getSystemHealth } from '../administration.reducer';

import HealthModal from './health-modal';

export const HealthPage = () => {
  const [healthObject, setHealthObject] = useState({});
  const [showModal, setShowModal] = useState(false);
  const dispatch = useAppDispatch();

  const health = useAppSelector(state => state.administration.health);
  const isFetching = useAppSelector(state => state.administration.loading);

  useEffect(() => {
    dispatch(getSystemHealth());
  }, []);

  const fetchSystemHealth = () => {
    if (!isFetching) {
      dispatch(getSystemHealth());
    }
  };

  const getSystemHealthInfo = (name, healthObj) => () => {
    setShowModal(true);
    setHealthObject({ ...healthObj, name });
  };

  const getBadgeType = (status: string) => (status === 'UP' ? 'success' : 'danger');

  const handleClose = () => setShowModal(false);

  const renderModal = () => <HealthModal healthObject={healthObject} handleClose={handleClose} showModal={showModal} />;

  const data = health?.components || {};

  return (
    <div>
      <h2 id="health-page-heading" data-cy="healthPageHeading">
        Tình trạng hệ thống
      </h2>
      <p>
        <Button onClick={fetchSystemHealth} color={`btn ${isFetching ? 'btn-danger' : 'btn-primary'}`} disabled={isFetching}>
          <FontAwesomeIcon icon={faSync} />
          &nbsp; Làm mới
        </Button>
      </p>
      <Row>
        <Col md="12">
          <Table bordered aria-describedby="health-page-heading">
            <thead>
              <tr>
                <th>Tên dịch vụ</th>
                <th>Trạng thái</th>
                <th>Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(data).map(
                (configPropKey, configPropIndex) =>
                  configPropKey !== 'status' && (
                    <tr key={configPropIndex}>
                      <td>{configPropKey}</td>
                      <td>
                        <Badge bg={getBadgeType(data[configPropKey].status)}>{data[configPropKey].status}</Badge>
                      </td>
                      <td>
                        {data[configPropKey].details && (
                          <a onClick={getSystemHealthInfo(configPropKey, data[configPropKey])}>
                            <FontAwesomeIcon icon={faEye} />
                          </a>
                        )}
                      </td>
                    </tr>
                  ),
              )}
            </tbody>
          </Table>
        </Col>
      </Row>
      {renderModal()}
    </div>
  );
};

export default HealthPage;
