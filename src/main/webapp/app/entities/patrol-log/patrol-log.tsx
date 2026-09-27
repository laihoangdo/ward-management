import React, { useEffect, useState } from 'react';
import { Button, Table } from 'react-bootstrap';
import { JhiItemCount, JhiPagination, TextFormat, getPaginationState } from 'react-jhipster';
import { Link, useLocation, useNavigate } from 'react-router';

import { faSort, faSortDown, faSortUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';
import { overridePaginationStateWithQueryParams } from 'app/shared/util/entity-utils';
import { ASC, DESC, ITEMS_PER_PAGE, SORT } from 'app/shared/util/pagination.constants';

import { getEntities } from './patrol-log.reducer';

export const PatrolLog = () => {
  const dispatch = useAppDispatch();

  const pageLocation = useLocation();
  const navigate = useNavigate();

  const [paginationState, setPaginationState] = useState(
    overridePaginationStateWithQueryParams(getPaginationState(pageLocation, ITEMS_PER_PAGE, 'id'), pageLocation.search),
  );

  const patrolLogList = useAppSelector(state => state.patrolLog.entities);
  const loading = useAppSelector(state => state.patrolLog.loading);
  const totalItems = useAppSelector(state => state.patrolLog.totalItems);

  const getAllEntities = () => {
    dispatch(
      getEntities({
        page: paginationState.activePage - 1,
        size: paginationState.itemsPerPage,
        sort: `${paginationState.sort},${paginationState.order}`,
      }),
    );
  };

  const sortEntities = () => {
    getAllEntities();
    const endURL = `?page=${paginationState.activePage}&sort=${paginationState.sort},${paginationState.order}`;
    if (pageLocation.search !== endURL) {
      navigate(`${pageLocation.pathname}${endURL}`);
    }
  };

  useEffect(() => {
    sortEntities();
  }, [paginationState.activePage, paginationState.order, paginationState.sort]);

  useEffect(() => {
    const params = new URLSearchParams(pageLocation.search);
    const page = params.get('page');
    const sort = params.get(SORT);
    if (page && sort) {
      const sortSplit = sort.split(',');
      setPaginationState({
        ...paginationState,
        activePage: +page,
        sort: sortSplit[0],
        order: sortSplit[1],
      });
    }
  }, [pageLocation.search]);

  const sort = p => () => {
    setPaginationState({
      ...paginationState,
      order: paginationState.order === ASC ? DESC : ASC,
      sort: p,
    });
  };

  const handlePagination = currentPage =>
    setPaginationState({
      ...paginationState,
      activePage: currentPage,
    });

  const handleSyncList = () => {
    sortEntities();
  };

  const getSortIconByFieldName = (fieldName: string) => {
    const sortFieldName = paginationState.sort;
    const { order } = paginationState;
    if (sortFieldName !== fieldName) {
      return faSort;
    }
    return order === ASC ? faSortUp : faSortDown;
  };

  return (
    <div>
      <h2 id="patrol-log-heading" data-cy="PatrolLogHeading">
        Patrol Logs
        <div className="d-flex justify-content-end">
          <Button className="me-2" variant="info" onClick={handleSyncList} disabled={loading}>
            <FontAwesomeIcon icon="sync" spin={loading} /> Refresh list
          </Button>
          <Link to="/patrol-log/new" className="btn btn-primary jh-create-entity" id="jh-create-entity" data-cy="entityCreateButton">
            <FontAwesomeIcon icon="plus" />
            &nbsp; Thêm mới một Patrol Log
          </Link>
        </div>
      </h2>
      <div className="table-responsive">
        {patrolLogList?.length > 0 ? (
          <Table responsive>
            <thead>
              <tr>
                <th className="hand" onClick={sort('id')}>
                  ID <FontAwesomeIcon icon={getSortIconByFieldName('id')} />
                </th>
                <th className="hand" onClick={sort('action')}>
                  Action <FontAwesomeIcon icon={getSortIconByFieldName('action')} />
                </th>
                <th className="hand" onClick={sort('target')}>
                  Target <FontAwesomeIcon icon={getSortIconByFieldName('target')} />
                </th>
                <th className="hand" onClick={sort('details')}>
                  Details <FontAwesomeIcon icon={getSortIconByFieldName('details')} />
                </th>
                <th className="hand" onClick={sort('officerName')}>
                  Officer Name <FontAwesomeIcon icon={getSortIconByFieldName('officerName')} />
                </th>
                <th className="hand" onClick={sort('badgeNumber')}>
                  Badge Number <FontAwesomeIcon icon={getSortIconByFieldName('badgeNumber')} />
                </th>
                <th className="hand" onClick={sort('ipAddress')}>
                  Ip Address <FontAwesomeIcon icon={getSortIconByFieldName('ipAddress')} />
                </th>
                <th className="hand" onClick={sort('timestamp')}>
                  Timestamp <FontAwesomeIcon icon={getSortIconByFieldName('timestamp')} />
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {patrolLogList.map(patrolLog => (
                <tr key={`entity-${patrolLog.id}`} data-cy="entityTable">
                  <td>
                    <Button as={Link as any} to={`/patrol-log/${patrolLog.id}`} variant="link" size="sm">
                      {patrolLog.id}
                    </Button>
                  </td>
                  <td>{patrolLog.action}</td>
                  <td>{patrolLog.target}</td>
                  <td>{patrolLog.details}</td>
                  <td>{patrolLog.officerName}</td>
                  <td>{patrolLog.badgeNumber}</td>
                  <td>{patrolLog.ipAddress}</td>
                  <td>{patrolLog.timestamp ? <TextFormat type="date" value={patrolLog.timestamp} format={APP_DATE_FORMAT} /> : null}</td>
                  <td className="text-end">
                    <div className="btn-group flex-btn-group-container">
                      <Button as={Link as any} to={`/patrol-log/${patrolLog.id}`} variant="info" size="sm" data-cy="entityDetailsButton">
                        <FontAwesomeIcon icon="eye" /> <span className="d-none d-md-inline">Xem</span>
                      </Button>
                      <Button
                        as={Link as any}
                        to={`/patrol-log/${patrolLog.id}/edit?page=${paginationState.activePage}&sort=${paginationState.sort},${paginationState.order}`}
                        variant="primary"
                        size="sm"
                        data-cy="entityEditButton"
                      >
                        <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
                      </Button>
                      <Button
                        onClick={() =>
                          (globalThis.location.href = `/patrol-log/${patrolLog.id}/delete?page=${paginationState.activePage}&sort=${paginationState.sort},${paginationState.order}`)
                        }
                        variant="danger"
                        size="sm"
                        data-cy="entityDeleteButton"
                      >
                        <FontAwesomeIcon icon="trash" /> <span className="d-none d-md-inline">Xóa</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          !loading && <div className="alert alert-warning">No Patrol Logs found</div>
        )}
      </div>
      {totalItems ? (
        <div className={patrolLogList && patrolLogList.length > 0 ? '' : 'd-none'}>
          <div className="justify-content-center d-flex">
            <JhiItemCount page={paginationState.activePage} total={totalItems} itemsPerPage={paginationState.itemsPerPage} />
          </div>
          <div className="justify-content-center d-flex">
            <JhiPagination
              activePage={paginationState.activePage}
              onSelect={handlePagination}
              maxButtons={5}
              itemsPerPage={paginationState.itemsPerPage}
              totalItems={totalItems}
            />
          </div>
        </div>
      ) : (
        ''
      )}
    </div>
  );
};

export default PatrolLog;
