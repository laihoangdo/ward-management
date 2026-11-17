import { describe, expect, it } from 'vitest';
import React from 'react';
import { MemoryRouter } from 'react-router';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';

import initStore from 'app/config/store';
import Header from 'app/shared/layout/header/header';
import { getProfile } from 'app/shared/reducers/application-profile';

import { MonitoringGate } from './index';

const adminProps = { isAuthenticated: true, isAdmin: true, ribbonEnv: '', isInProduction: true, isOpenAPIEnabled: false };

const mount = (ui: React.ReactNode, status: 'available' | 'unavailable') => {
  const store = initStore();
  if (status === 'unavailable') store.dispatch({ type: getProfile.rejected.type, error: { message: 'Not Found' } });
  else store.dispatch({ type: getProfile.fulfilled.type, payload: { data: { activeProfiles: ['dev'] } } });
  return render(
    <Provider store={store}>
      <MemoryRouter>{ui}</MemoryRouter>
    </Provider>,
  );
};

describe('Monitoring screens where /management is closed (production)', () => {
  it('shows a notice instead of the screen, so it never calls the closed endpoints', () => {
    mount(
      <MonitoringGate>
        <p>metrics screen</p>
      </MonitoringGate>,
      'unavailable',
    );
    expect(screen.getByText('Không khả dụng trên production')).toBeDefined();
    expect(screen.queryByText('metrics screen')).toBeNull();
  });

  it('shows the screen where the server answers /management/info', () => {
    mount(
      <MonitoringGate>
        <p>metrics screen</p>
      </MonitoringGate>,
      'available',
    );
    expect(screen.getByText('metrics screen')).toBeDefined();
  });

  it('leaves the empty "Quản trị" menu out of the header', () => {
    const { container } = mount(<Header {...adminProps} />, 'unavailable');
    expect(container.innerHTML).not.toContain('admin-menu');
  });

  it('keeps the menu where monitoring is available', () => {
    const { container } = mount(<Header {...adminProps} />, 'available');
    expect(container.innerHTML).toContain('admin-menu');
  });
});
