import areaZone from 'app/entities/area-zone/area-zone.reducer';
import documentRecord from 'app/entities/document-record/document-record.reducer';
import household from 'app/entities/household/household.reducer';
import patrolLog from 'app/entities/patrol-log/patrol-log.reducer';
import resident from 'app/entities/resident/resident.reducer';
import securityAlert from 'app/entities/security-alert/security-alert.reducer';
/* jhipster-needle-add-reducer-import - JHipster will add reducer here */

const entitiesReducers = {
  household,
  resident,
  areaZone,
  documentRecord,
  securityAlert,
  patrolLog,
  // jhipster-needle-add-reducer-combine - JHipster will add reducer here
};

export default entitiesReducers;
