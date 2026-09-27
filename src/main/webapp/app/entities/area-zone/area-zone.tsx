import React, { useEffect, useState } from 'react';
import { Button, Table } from 'react-bootstrap';
import { getSortState } from 'react-jhipster';
import { Link, useLocation, useNavigate } from 'react-router';

import { faSort, faSortDown, faSortUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { overrideSortStateWithQueryParams } from 'app/shared/util/entity-utils';
import { ASC, DESC } from 'app/shared/util/pagination.constants';

import { getEntities } from './area-zone.reducer';

export const AreaZone = () => {
  const dispatch = useAppDispatch();

  const pageLocation = useLocation();
  const navigate = useNavigate();

  const [sortState, setSortState] = useState(overrideSortStateWithQueryParams(getSortState(pageLocation, 'id'), pageLocation.search));

  const areaZoneList = useAppSelector(state => state.areaZone.entities);
  const loading = useAppSelector(state => state.areaZone.loading);

  const getAllEntities = () => {
    dispatch(
      getEntities({
        sort: `${sortState.sort},${sortState.order}`,
      }),
    );
  };

  const sortEntities = () => {
    getAllEntities();
    const endURL = `?sort=${sortState.sort},${sortState.order}`;
    if (pageLocation.search !== endURL) {
      navigate(`${pageLocation.pathname}${endURL}`);
    }
  };

  useEffect(() => {
    sortEntities();
  }, [sortState.order, sortState.sort]);

  const sort = p => () => {
    setSortState({
      ...sortState,
      order: sortState.order === ASC ? DESC : ASC,
      sort: p,
    });
  };

  const handleSyncList = () => {
    sortEntities();
  };

  const getSortIconByFieldName = (fieldName: string) => {
    const sortFieldName = sortState.sort;
    const { order } = sortState;
    if (sortFieldName !== fieldName) {
      return faSort;
    }
    return order === ASC ? faSortUp : faSortDown;
  };

  return (
    <div>
      <h2 id="area-zone-heading" data-cy="AreaZoneHeading">
        Area Zones
        <div className="d-flex justify-content-end">
          <Button className="me-2" variant="info" onClick={handleSyncList} disabled={loading}>
            <FontAwesomeIcon icon="sync" spin={loading} /> Refresh list
          </Button>
          <Link to="/area-zone/new" className="btn btn-primary jh-create-entity" id="jh-create-entity" data-cy="entityCreateButton">
            <FontAwesomeIcon icon="plus" />
            &nbsp; Thêm mới một Area Zone
          </Link>
        </div>
      </h2>
      <div className="table-responsive">
        {areaZoneList?.length > 0 ? (
          <Table responsive>
            <thead>
              <tr>
                <th className="hand" onClick={sort('id')}>
                  ID <FontAwesomeIcon icon={getSortIconByFieldName('id')} />
                </th>
                <th className="hand" onClick={sort('code')}>
                  Code <FontAwesomeIcon icon={getSortIconByFieldName('code')} />
                </th>
                <th className="hand" onClick={sort('name')}>
                  Name <FontAwesomeIcon icon={getSortIconByFieldName('name')} />
                </th>
                <th className="hand" onClick={sort('hamletName')}>
                  Hamlet Name <FontAwesomeIcon icon={getSortIconByFieldName('hamletName')} />
                </th>
                <th className="hand" onClick={sort('officerInCharge')}>
                  Officer In Charge <FontAwesomeIcon icon={getSortIconByFieldName('officerInCharge')} />
                </th>
                <th className="hand" onClick={sort('officerPhone')}>
                  Officer Phone <FontAwesomeIcon icon={getSortIconByFieldName('officerPhone')} />
                </th>
                <th className="hand" onClick={sort('populationCount')}>
                  Population Count <FontAwesomeIcon icon={getSortIconByFieldName('populationCount')} />
                </th>
                <th className="hand" onClick={sort('householdCount')}>
                  Household Count <FontAwesomeIcon icon={getSortIconByFieldName('householdCount')} />
                </th>
                <th className="hand" onClick={sort('boundaryGeoJson')}>
                  Boundary Geo Json <FontAwesomeIcon icon={getSortIconByFieldName('boundaryGeoJson')} />
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {areaZoneList.map(areaZone => (
                <tr key={`entity-${areaZone.id}`} data-cy="entityTable">
                  <td>
                    <Button as={Link as any} to={`/area-zone/${areaZone.id}`} variant="link" size="sm">
                      {areaZone.id}
                    </Button>
                  </td>
                  <td>{areaZone.code}</td>
                  <td>{areaZone.name}</td>
                  <td>{areaZone.hamletName}</td>
                  <td>{areaZone.officerInCharge}</td>
                  <td>{areaZone.officerPhone}</td>
                  <td>{areaZone.populationCount}</td>
                  <td>{areaZone.householdCount}</td>
                  <td>{areaZone.boundaryGeoJson}</td>
                  <td className="text-end">
                    <div className="btn-group flex-btn-group-container">
                      <Button as={Link as any} to={`/area-zone/${areaZone.id}`} variant="info" size="sm" data-cy="entityDetailsButton">
                        <FontAwesomeIcon icon="eye" /> <span className="d-none d-md-inline">Xem</span>
                      </Button>
                      <Button as={Link as any} to={`/area-zone/${areaZone.id}/edit`} variant="primary" size="sm" data-cy="entityEditButton">
                        <FontAwesomeIcon icon="pencil-alt" /> <span className="d-none d-md-inline">Sửa</span>
                      </Button>
                      <Button
                        onClick={() => (globalThis.location.href = `/area-zone/${areaZone.id}/delete`)}
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
          !loading && <div className="alert alert-warning">No Area Zones found</div>
        )}
      </div>
    </div>
  );
};

export default AreaZone;
