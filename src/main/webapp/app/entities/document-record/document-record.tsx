import React, { useEffect, useState } from 'react';
import { Button, Table } from 'react-bootstrap';
import { JhiItemCount, JhiPagination, getPaginationState } from 'react-jhipster';
import { Link, useLocation, useNavigate } from 'react-router';

import { faSort, faSortDown, faSortUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { overridePaginationStateWithQueryParams } from 'app/shared/util/entity-utils';
import { ASC, DESC, ITEMS_PER_PAGE, SORT } from 'app/shared/util/pagination.constants';

import { getEntities } from './document-record.reducer';

export const DocumentRecord = () => {
  const dispatch = useAppDispatch();

  const pageLocation = useLocation();
  const navigate = useNavigate();

  const [paginationState, setPaginationState] = useState(
    overridePaginationStateWithQueryParams(getPaginationState(pageLocation, ITEMS_PER_PAGE, 'id'), pageLocation.search),
  );

  const documentRecordList = useAppSelector(state => state.documentRecord.entities);
  const loading = useAppSelector(state => state.documentRecord.loading);
  const totalItems = useAppSelector(state => state.documentRecord.totalItems);

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
      <h2 id="document-record-heading" data-cy="DocumentRecordHeading">
        Document Records
        <div className="d-flex justify-content-end">
          <Button className="me-2" variant="info" onClick={handleSyncList} disabled={loading}>
            <FontAwesomeIcon icon="sync" spin={loading} /> Refresh list
          </Button>
          <Link to="/document-record/new" className="btn btn-primary jh-create-entity" id="jh-create-entity" data-cy="entityCreateButton">
            <FontAwesomeIcon icon="plus" />
            &nbsp; Thêm mới một Document Record
          </Link>
        </div>
      </h2>
      <div className="table-responsive">
        {documentRecordList?.length > 0 ? (
          <Table responsive>
            <thead>
              <tr>
                <th className="hand" onClick={sort('id')}>
                  ID <FontAwesomeIcon icon={getSortIconByFieldName('id')} />
                </th>
                <th className="hand" onClick={sort('docName')}>
                  Doc Name <FontAwesomeIcon icon={getSortIconByFieldName('docName')} />
                </th>
                <th className="hand" onClick={sort('docType')}>
                  Doc Type <FontAwesomeIcon icon={getSortIconByFieldName('docType')} />
                </th>
                <th className="hand" onClick={sort('householdName')}>
                  Household Name <FontAwesomeIcon icon={getSortIconByFieldName('householdName')} />
                </th>
                <th className="hand" onClick={sort('address')}>
                  Address <FontAwesomeIcon icon={getSortIconByFieldName('address')} />
                </th>
                <th className="hand" onClick={sort('status')}>
                  Status <FontAwesomeIcon icon={getSortIconByFieldName('status')} />
                </th>
                <th className="hand" onClick={sort('expiryDate')}>
                  Expiry Date <FontAwesomeIcon icon={getSortIconByFieldName('expiryDate')} />
                </th>
                <th className="hand" onClick={sort('officer')}>
                  Officer <FontAwesomeIcon icon={getSortIconByFieldName('officer')} />
                </th>
                <th className="hand" onClick={sort('phone')}>
                  Phone <FontAwesomeIcon icon={getSortIconByFieldName('phone')} />
                </th>
                <th className="hand" onClick={sort('notes')}>
                  Notes <FontAwesomeIcon icon={getSortIconByFieldName('notes')} />
                </th>
                <th className="hand" onClick={sort('reminderSent')}>
                  Reminder Sent <FontAwesomeIcon icon={getSortIconByFieldName('reminderSent')} />
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {documentRecordList.map(documentRecord => (
                <tr key={`entity-${documentRecord.id}`} data-cy="entityTable">
                  <td>
                    <Button as={Link as any} to={`/document-record/${documentRecord.id}`} variant="link" size="sm">
                      {documentRecord.id}
                    </Button>
                  </td>
                  <td>{documentRecord.docName}</td>
                  <td>{documentRecord.docType}</td>
                  <td>{documentRecord.householdName}</td>
                  <td>{documentRecord.address}</td>
                  <td>{documentRecord.status}</td>
                  <td>{documentRecord.expiryDate}</td>
                  <td>{documentRecord.officer}</td>
                  <td>{documentRecord.phone}</td>
                  <td>{documentRecord.notes}</td>
                  <td>{documentRecord.reminderSent ? 'true' : 'false'}</td>
                  <td className="text-end">
                    <div className="btn-group flex-btn-group-container">
                      <Button
                        as={Link as any}
                        to={`/document-record/${documentRecord.id}`}
                        variant="info"
                        size="sm"
                        data-cy="entityDetailsButton"
                      >
                        <FontAwesomeIcon icon="eye" /> <span className="d-none d-md-inline">Xem</span>
                      </Button>
                      <Button
                        as={Link as any}
                        to={`/document-record/${documentRecord.id}/edit?page=${paginationState.activePage}&sort=${paginationState.sort},${paginationState.order}`}
                        variant="primary"
                        size="sm"
                        data-cy="entityEditButton"
                      >
                        <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
                      </Button>
                      <Button
                        onClick={() =>
                          (globalThis.location.href = `/document-record/${documentRecord.id}/delete?page=${paginationState.activePage}&sort=${paginationState.sort},${paginationState.order}`)
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
          !loading && <div className="alert alert-warning">No Document Records found</div>
        )}
      </div>
      {totalItems ? (
        <div className={documentRecordList && documentRecordList.length > 0 ? '' : 'd-none'}>
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

export default DocumentRecord;
