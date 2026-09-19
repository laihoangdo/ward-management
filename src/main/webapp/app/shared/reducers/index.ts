import { ReducersMapObject } from '@reduxjs/toolkit';

import entitiesReducers from 'app/entities/reducers';
import administration from 'app/modules/administration/administration.reducer';
import loadingBar from 'app/shared/reducers/loading-bar';

import applicationProfile from './application-profile';
import authentication from './authentication';
import userManagement from './user-management';
/* jhipster-needle-add-reducer-import - JHipster will add reducer here */

const rootReducer: ReducersMapObject = {
  authentication,
  applicationProfile,
  administration,
  userManagement,
  loadingBar,
  /* jhipster-needle-add-reducer-combine - JHipster will add reducer here */
  ...entitiesReducers,
};

export default rootReducer;
