import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axios from 'axios';

import { serializeAxiosError } from './reducer.utils';

/**
 * Whether the server answers /management/info. Production closes /management/* (only an internal health check
 * remains), so the metrics, health, configuration and logs screens have nothing to read there.
 */
export type MonitoringStatus = 'checking' | 'available' | 'unavailable';

const initialState = {
  ribbonEnv: '',
  inProduction: true,
  isOpenAPIEnabled: false,
  monitoring: 'checking' as MonitoringStatus,
};

export type ApplicationProfileState = Readonly<typeof initialState>;

export const getProfile = createAsyncThunk('applicationProfile/get_profile', async () => axios.get<any>('management/info'), {
  serializeError: serializeAxiosError,
});

export const ApplicationProfileSlice = createSlice({
  name: 'applicationProfile',
  initialState,
  reducers: {},
  extraReducers(builder) {
    builder.addCase(getProfile.fulfilled, (state, action) => {
      const { data } = action.payload;
      state.ribbonEnv = data['display-ribbon-on-profiles'];
      state.inProduction = data.activeProfiles.includes('prod');
      state.isOpenAPIEnabled = data.activeProfiles.includes('api-docs');
      state.monitoring = 'available';
    });
    builder.addCase(getProfile.rejected, state => {
      state.monitoring = 'unavailable';
    });
  },
});

// Reducer
export default ApplicationProfileSlice.reducer;
