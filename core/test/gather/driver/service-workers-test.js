/**
 * @license Copyright 2021 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import {createMockSession} from '../mock-driver.js';
import {makePromiseInspectable, flushAllTimersAndMicrotasks, timers} from '../../test-utils.js';
import * as serviceWorkers from '../../../gather/driver/service-workers.js';

let sessionMock = createMockSession();

beforeEach(() => {
  sessionMock = createMockSession();
});

afterEach(() => {
  timers.useRealTimers();
});

describe('.getServiceWorkerVersions', () => {
  it('returns the data from service worker events', async () => {
    sessionMock.sendCommand
      .mockResponse('ServiceWorker.enable')
      .mockResponse('ServiceWorker.disable');
    sessionMock.on.mockEvent('ServiceWorker.workerVersionUpdated', {
      versions: [{registrationId: '1', status: 'activated'}],
    });

    const results = await serviceWorkers.getServiceWorkerVersions(sessionMock.asSession());
    expect(results).toEqual({versions: [{registrationId: '1', status: 'activated'}]});
  });

  it('returns when there are no active candidates', async () => {
    sessionMock.sendCommand
      .mockResponse('ServiceWorker.enable')
      .mockResponse('ServiceWorker.disable');
    sessionMock.on.mockEvent('ServiceWorker.workerVersionUpdated', {
      versions: [{registrationId: '1', status: 'redundant'}],
    });

    const results = await serviceWorkers.getServiceWorkerVersions(sessionMock.asSession());
    expect(results).toEqual({versions: [{registrationId: '1', status: 'redundant'}]});
  });

  it('waits for currently installing workers', async () => {
    timers.useFakeTimers();
    sessionMock.sendCommand
      .mockResponse('ServiceWorker.enable')
      .mockResponse('ServiceWorker.disable');

    const resultPromise = makePromiseInspectable(
      serviceWorkers.getServiceWorkerVersions(sessionMock.asSession())
    );
    await flushAllTimersAndMicrotasks();
    expect(resultPromise.isDone()).toBe(false);

    const workerVersionUpdated = sessionMock.on.findListener('ServiceWorker.workerVersionUpdated');
    workerVersionUpdated({versions: [{status: 'installing'}]});
    await flushAllTimersAndMicrotasks();
    expect(resultPromise.isDone()).toBe(false);

    const versions = {versions: [{registrationId: '3', status: 'activated'}]};
    workerVersionUpdated(versions);
    await flushAllTimersAndMicrotasks();
    expect(resultPromise.isDone()).toBe(true);
    expect(await resultPromise).toEqual(versions);
  });
});

describe('.getServiceWorkerRegistrations', () => {
  it('returns the data from service worker events', async () => {
    sessionMock.sendCommand
      .mockResponse('ServiceWorker.enable')
      .mockResponse('ServiceWorker.disable');
    sessionMock.once.mockEvent('ServiceWorker.workerRegistrationUpdated', {
      registrations: [{registrationId: '2'}],
    });

    const results = await serviceWorkers.getServiceWorkerRegistrations(sessionMock.asSession());
    expect(results).toEqual({registrations: [{registrationId: '2'}]});
  });
});
