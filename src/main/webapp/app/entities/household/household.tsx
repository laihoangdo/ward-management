import React, { useEffect, useState } from 'react';
import { Button, Table } from 'react-bootstrap';
import { JhiItemCount, JhiPagination, getPaginationState } from 'react-jhipster';
import { Link, useLocation, useNavigate } from 'react-router';

import { faSort, faSortDown, faSortUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { overridePaginationStateWithQueryParams } from 'app/shared/util/entity-utils';
import { ASC, DESC, ITEMS_PER_PAGE, SORT } from 'app/shared/util/pagination.constants';

import { getEntities } from './household.reducer';

export const Household = () => {
  const dispatch = useAppDispatch();

  const pageLocation = useLocation();
  const navigate = useNavigate();

  const [paginationState, setPaginationState] = useState(
    overridePaginationStateWithQueryParams(getPaginationState(pageLocation, ITEMS_PER_PAGE, 'id'), pageLocation.search),
  );

  const householdList = useAppSelector(state => state.household.entities);
  const loading = useAppSelector(state => state.household.loading);
  const totalItems = useAppSelector(state => state.household.totalItems);

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
      <h2 id="household-heading" data-cy="HouseholdHeading">
        Households
        <div className="d-flex justify-content-end">
          <Button className="me-2" variant="info" onClick={handleSyncList} disabled={loading}>
            <FontAwesomeIcon icon="sync" spin={loading} /> Refresh list
          </Button>
          <Link to="/household/new" className="btn btn-primary jh-create-entity" id="jh-create-entity" data-cy="entityCreateButton">
            <FontAwesomeIcon icon="plus" />
            &nbsp; Thêm mới một Household
          </Link>
        </div>
      </h2>
      <div className="table-responsive">
        {householdList?.length > 0 ? (
          <Table responsive>
            <thead>
              <tr>
                <th className="hand" onClick={sort('id')}>
                  ID <FontAwesomeIcon icon={getSortIconByFieldName('id')} />
                </th>
                <th className="hand" onClick={sort('code')}>
                  Code <FontAwesomeIcon icon={getSortIconByFieldName('code')} />
                </th>
                <th className="hand" onClick={sort('houseNumber')}>
                  House Number <FontAwesomeIcon icon={getSortIconByFieldName('houseNumber')} />
                </th>
                <th className="hand" onClick={sort('street')}>
                  Street <FontAwesomeIcon icon={getSortIconByFieldName('street')} />
                </th>
                <th className="hand" onClick={sort('hamlet')}>
                  Hamlet <FontAwesomeIcon icon={getSortIconByFieldName('hamlet')} />
                </th>
                <th className="hand" onClick={sort('neighborhoodGroup')}>
                  Neighborhood Group <FontAwesomeIcon icon={getSortIconByFieldName('neighborhoodGroup')} />
                </th>
                <th className="hand" onClick={sort('alley')}>
                  Alley <FontAwesomeIcon icon={getSortIconByFieldName('alley')} />
                </th>
                <th className="hand" onClick={sort('ownerName')}>
                  Owner Name <FontAwesomeIcon icon={getSortIconByFieldName('ownerName')} />
                </th>
                <th className="hand" onClick={sort('ownerPhone')}>
                  Owner Phone <FontAwesomeIcon icon={getSortIconByFieldName('ownerPhone')} />
                </th>
                <th className="hand" onClick={sort('type')}>
                  Type <FontAwesomeIcon icon={getSortIconByFieldName('type')} />
                </th>
                <th className="hand" onClick={sort('businessName')}>
                  Business Name <FontAwesomeIcon icon={getSortIconByFieldName('businessName')} />
                </th>
                <th className="hand" onClick={sort('businessCategory')}>
                  Business Category <FontAwesomeIcon icon={getSortIconByFieldName('businessCategory')} />
                </th>
                <th className="hand" onClick={sort('residentsCount')}>
                  Residents Count <FontAwesomeIcon icon={getSortIconByFieldName('residentsCount')} />
                </th>
                <th className="hand" onClick={sort('maleCount')}>
                  Male Count <FontAwesomeIcon icon={getSortIconByFieldName('maleCount')} />
                </th>
                <th className="hand" onClick={sort('femaleCount')}>
                  Female Count <FontAwesomeIcon icon={getSortIconByFieldName('femaleCount')} />
                </th>
                <th className="hand" onClick={sort('under18Count')}>
                  Under 18 Count <FontAwesomeIcon icon={getSortIconByFieldName('under18Count')} />
                </th>
                <th className="hand" onClick={sort('above18Count')}>
                  Above 18 Count <FontAwesomeIcon icon={getSortIconByFieldName('above18Count')} />
                </th>
                <th className="hand" onClick={sort('status')}>
                  Status <FontAwesomeIcon icon={getSortIconByFieldName('status')} />
                </th>
                <th className="hand" onClick={sort('warningMessage')}>
                  Warning Message <FontAwesomeIcon icon={getSortIconByFieldName('warningMessage')} />
                </th>
                <th className="hand" onClick={sort('licenseExpiry')}>
                  License Expiry <FontAwesomeIcon icon={getSortIconByFieldName('licenseExpiry')} />
                </th>
                <th className="hand" onClick={sort('licenseType')}>
                  License Type <FontAwesomeIcon icon={getSortIconByFieldName('licenseType')} />
                </th>
                <th className="hand" onClick={sort('latitude')}>
                  Latitude <FontAwesomeIcon icon={getSortIconByFieldName('latitude')} />
                </th>
                <th className="hand" onClick={sort('longitude')}>
                  Longitude <FontAwesomeIcon icon={getSortIconByFieldName('longitude')} />
                </th>
                <th className="hand" onClick={sort('notes')}>
                  Notes <FontAwesomeIcon icon={getSortIconByFieldName('notes')} />
                </th>
                <th className="hand" onClick={sort('lastCheckedDate')}>
                  Last Checked Date <FontAwesomeIcon icon={getSortIconByFieldName('lastCheckedDate')} />
                </th>
                <th className="hand" onClick={sort('officerInCharge')}>
                  Officer In Charge <FontAwesomeIcon icon={getSortIconByFieldName('officerInCharge')} />
                </th>
                <th>
                  Area Zone <FontAwesomeIcon icon="sort" />
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {householdList.map(household => (
                <tr key={`entity-${household.id}`} data-cy="entityTable">
                  <td>
                    <Button as={Link as any} to={`/household/${household.id}`} variant="link" size="sm">
                      {household.id}
                    </Button>
                  </td>
                  <td>{household.code}</td>
                  <td>{household.houseNumber}</td>
                  <td>{household.street}</td>
                  <td>{household.hamlet}</td>
                  <td>{household.neighborhoodGroup}</td>
                  <td>{household.alley}</td>
                  <td>{household.ownerName}</td>
                  <td>{household.ownerPhone}</td>
                  <td>{household.type}</td>
                  <td>{household.businessName}</td>
                  <td>{household.businessCategory}</td>
                  <td>{household.residentsCount}</td>
                  <td>{household.maleCount}</td>
                  <td>{household.femaleCount}</td>
                  <td>{household.under18Count}</td>
                  <td>{household.above18Count}</td>
                  <td>{household.status}</td>
                  <td>{household.warningMessage}</td>
                  <td>{household.licenseExpiry}</td>
                  <td>{household.licenseType}</td>
                  <td>{household.latitude}</td>
                  <td>{household.longitude}</td>
                  <td>{household.notes}</td>
                  <td>{household.lastCheckedDate}</td>
                  <td>{household.officerInCharge}</td>
                  <td>{household.areaZone ? <Link to={`/area-zone/${household.areaZone.id}`}>{household.areaZone.name}</Link> : ''}</td>
                  <td className="text-end">
                    <div className="btn-group flex-btn-group-container">
                      <Button as={Link as any} to={`/household/${household.id}`} variant="info" size="sm" data-cy="entityDetailsButton">
                        <FontAwesomeIcon icon="eye" /> <span className="d-none d-md-inline">Xem</span>
                      </Button>
                      <Button
                        as={Link as any}
                        to={`/household/${household.id}/edit?page=${paginationState.activePage}&sort=${paginationState.sort},${paginationState.order}`}
                        variant="primary"
                        size="sm"
                        data-cy="entityEditButton"
                      >
                        <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
                      </Button>
                      <Button
                        onClick={() =>
                          (globalThis.location.href = `/household/${household.id}/delete?page=${paginationState.activePage}&sort=${paginationState.sort},${paginationState.order}`)
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
          !loading && <div className="alert alert-warning">No Households found</div>
        )}
      </div>
      {totalItems ? (
        <div className={householdList && householdList.length > 0 ? '' : 'd-none'}>
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

export default Household;
