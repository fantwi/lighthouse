/**
 * @license Copyright 2021 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import * as td from 'testdouble';

import {createMockSession, createMockDriver} from '../mock-driver.js';
import {flushAllTimersAndMicrotasks, fnAny, timers} from '../../test-utils.js';
// import prepare from '../../../gather/driver/prepare.js';
import * as constants from '../../../config/constants.js';

// Some imports needs to be done dynamically, so that their dependencies will be mocked.
// See: https://jestjs.io/docs/ecmascript-modules#differences-between-esm-and-commonjs
//      https://github.com/facebook/jest/issues/10025
/** @type {import('../../../gather/driver/prepare.js')} */
let prepare;

before(async () => {
  prepare = (await import('../../../gather/driver/prepare.js'));
});

const storageMock = {
  clearDataForOrigin: fnAny(),
  clearBrowserCaches: fnAny(),
  getImportantStorageWarning: fnAny(),
};
await td.replaceEsm('../../../gather/driver/storage.js', storageMock);

const url = 'https://example.com';
let sessionMock = createMockSession();

beforeEach(() => {
  sessionMock = createMockSession();
  sessionMock.sendCommand
    .mockResponse('Network.emulateNetworkConditions')
    .mockResponse('Emulation.setCPUThrottlingRate')
    .mockResponse('Network.setBlockedURLs')
    .mockResponse('Network.setExtraHTTPHeaders');
  storageMock.clearDataForOrigin.mockReset();
  storageMock.clearBrowserCaches.mockReset();
  storageMock.getImportantStorageWarning.mockReset();
});

afterEach(() => {
  timers.useRealTimers();
});

describe('.prepareThrottlingAndNetwork()', () => {
  it('sets throttling appropriately', async () => {
    await prepare.prepareThrottlingAndNetwork(
      sessionMock.asSession(),
      {
        ...constants.defaultSettings,
        throttlingMethod: 'devtools',
        throttling: {
          ...constants.defaultSettings.throttling,
          requestLatencyMs: 100,
          downloadThroughputKbps: 8,
          uploadThroughputKbps: 8,
          cpuSlowdownMultiplier: 2,
        },
      },
      constants.defaultNavigationConfig
    );

    expect(sessionMock.sendCommand.findInvocation('Network.emulateNetworkConditions')).toEqual({
      latency: 100,
      downloadThroughput: 1024,
      uploadThroughput: 1024,
      offline: false,
    });
    expect(sessionMock.sendCommand.findInvocation('Emulation.setCPUThrottlingRate')).toEqual({
      rate: 2,
    });
  });

  it('disables throttling', async () => {
    await prepare.prepareThrottlingAndNetwork(
      sessionMock.asSession(),
      {
        ...constants.defaultSettings,
        throttlingMethod: 'devtools',
        throttling: {
          ...constants.defaultSettings.throttling,
          requestLatencyMs: 100,
          downloadThroughputKbps: 8,
          uploadThroughputKbps: 8,
          cpuSlowdownMultiplier: 2,
        },
      },
      {
        ...constants.defaultNavigationConfig,
        disableThrottling: true,
      }
    );

    expect(sessionMock.sendCommand.findInvocation('Network.emulateNetworkConditions')).toEqual({
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
      offline: false,
    });
    expect(sessionMock.sendCommand.findInvocation('Emulation.setCPUThrottlingRate')).toEqual({
      rate: 1,
    });
  });

  it('unsets url patterns when empty', async () => {
    await prepare.prepareThrottlingAndNetwork(
      sessionMock.asSession(),
      {
        ...constants.defaultSettings,
        blockedUrlPatterns: null,
      },
      {
        ...constants.defaultNavigationConfig,
        blockedUrlPatterns: [],
      }
    );

    expect(sessionMock.sendCommand.findInvocation('Network.setBlockedURLs')).toEqual({
      urls: [],
    });
  });

  it('blocks url patterns', async () => {
    await prepare.prepareThrottlingAndNetwork(
      sessionMock.asSession(),
      {
        ...constants.defaultSettings,
        blockedUrlPatterns: ['https://a.example.com'],
      },
      {
        ...constants.defaultNavigationConfig,
        blockedUrlPatterns: ['https://b.example.com'],
      }
    );

    expect(sessionMock.sendCommand.findInvocation('Network.setBlockedURLs')).toEqual({
      urls: ['https://b.example.com', 'https://a.example.com'],
    });
  });

  it('sets extraHeaders', async () => {
    await prepare.prepareThrottlingAndNetwork(
      sessionMock.asSession(),
      {...constants.defaultSettings, extraHeaders: {'Cookie': 'monster', 'x-men': 'wolverine'}},
      {...constants.defaultNavigationConfig}
    );

    expect(sessionMock.sendCommand.findInvocation('Network.setExtraHTTPHeaders')).toEqual({
      headers: {
        'Cookie': 'monster',
        'x-men': 'wolverine',
      },
    });
  });
});

describe('.prepareTargetForIndividualNavigation()', () => {
  it('clears storage when not disabled', async () => {
    await prepare.prepareTargetForIndividualNavigation(
      sessionMock.asSession(),
      {...constants.defaultSettings, disableStorageReset: false},
      {...constants.defaultNavigationConfig, disableStorageReset: false, requestor: url}
    );

    expect(storageMock.clearDataForOrigin).toHaveBeenCalled();
    expect(storageMock.clearBrowserCaches).toHaveBeenCalled();
  });

  it('does not clear storage when globally disabled', async () => {
    await prepare.prepareTargetForIndividualNavigation(
      sessionMock.asSession(),
      {...constants.defaultSettings, disableStorageReset: true},
      {...constants.defaultNavigationConfig, disableStorageReset: false, requestor: url}
    );

    expect(storageMock.clearDataForOrigin).not.toHaveBeenCalled();
    expect(storageMock.clearBrowserCaches).not.toHaveBeenCalled();
  });

  it('does not clear storage when disabled per navigation', async () => {
    await prepare.prepareTargetForIndividualNavigation(
      sessionMock.asSession(),
      {...constants.defaultSettings, disableStorageReset: false},
      {...constants.defaultNavigationConfig, disableStorageReset: true, requestor: url}
    );

    expect(storageMock.clearDataForOrigin).not.toHaveBeenCalled();
    expect(storageMock.clearBrowserCaches).not.toHaveBeenCalled();
  });

  it('does not clear storage when given a callback requestor', async () => {
    await prepare.prepareTargetForIndividualNavigation(
      sessionMock.asSession(),
      {...constants.defaultSettings, disableStorageReset: false},
      {...constants.defaultNavigationConfig, disableStorageReset: false, requestor: () => {}}
    );

    expect(storageMock.clearDataForOrigin).not.toHaveBeenCalled();
    expect(storageMock.clearBrowserCaches).not.toHaveBeenCalled();
  });

  it('collects storage warnings', async () => {
    storageMock.getImportantStorageWarning.mockResolvedValue({message: 'This is a warning'});
    const {warnings} = await prepare.prepareTargetForIndividualNavigation(
      sessionMock.asSession(),
      {...constants.defaultSettings, disableStorageReset: false},
      {...constants.defaultNavigationConfig, disableStorageReset: false, requestor: url}
    );

    expect(warnings).toEqual([{message: 'This is a warning'}]);
  });
});

describe('.prepareTargetForNavigationMode()', () => {
  let driverMock = createMockDriver();

  beforeEach(() => {
    driverMock = createMockDriver();
    sessionMock = driverMock._session;

    sessionMock.sendCommand
      .mockResponse('Network.enable')
      .mockResponse('Network.setUserAgentOverride')
      .mockResponse('Emulation.setDeviceMetricsOverride')
      .mockResponse('Emulation.setTouchEmulationEnabled')
      .mockResponse('Debugger.enable')
      .mockResponse('Debugger.setSkipAllPauses')
      .mockResponse('Debugger.setAsyncCallStackDepth')
      .mockResponse('Page.enable');
  });

  it('emulates the target device', async () => {
    await prepare.prepareTargetForNavigationMode(driverMock.asDriver(), {
      ...constants.defaultSettings,
      screenEmulation: {
        disabled: false,
        mobile: true,
        deviceScaleFactor: 2,
        width: 200,
        height: 300,
      },
    });

    expect(sessionMock.sendCommand.findInvocation('Emulation.setDeviceMetricsOverride')).toEqual({
      mobile: true,
      deviceScaleFactor: 2,
      width: 200,
      height: 300,
    });
  });

  it('enables async stacks', async () => {
    await prepare.prepareTargetForNavigationMode(driverMock.asDriver(), {
      ...constants.defaultSettings,
    });

    const invocations = sessionMock.sendCommand.mock.calls;
    const debuggerInvocations = invocations.filter(call => call[0].startsWith('Debugger.'));
    expect(debuggerInvocations.map(argList => argList[0])).toEqual([
      'Debugger.enable',
      'Debugger.setSkipAllPauses',
      'Debugger.setAsyncCallStackDepth',
    ]);
  });

  it('enables async stacks on every main frame navigation', async () => {
    timers.useFakeTimers();

    sessionMock.sendCommand
      .mockResponse('Debugger.enable')
      .mockResponse('Debugger.setSkipAllPauses')
      .mockResponse('Debugger.setAsyncCallStackDepth');

    sessionMock.on.mockEvent('Page.frameNavigated', {frame: {}});
    sessionMock.on.mockEvent('Page.frameNavigated', {frame: {parentId: '1'}});
    sessionMock.on.mockEvent('Page.frameNavigated', {frame: {parentId: '2'}});
    sessionMock.on.mockEvent('Page.frameNavigated', {frame: {parentId: '3'}});

    await prepare.prepareTargetForNavigationMode(driverMock.asDriver(), {
      ...constants.defaultSettings,
    });

    await flushAllTimersAndMicrotasks();

    const invocations = sessionMock.sendCommand.mock.calls;
    const debuggerInvocations = invocations.filter(call => call[0].startsWith('Debugger.'));
    expect(debuggerInvocations.map(argList => argList[0])).toEqual([
      'Debugger.enable',
      'Debugger.setSkipAllPauses',
      'Debugger.setAsyncCallStackDepth',
      'Debugger.enable',
      'Debugger.setSkipAllPauses',
      'Debugger.setAsyncCallStackDepth',
    ]);
  });

  it('cache natives on new document', async () => {
    await prepare.prepareTargetForNavigationMode(driverMock.asDriver(), {
      ...constants.defaultSettings,
    });

    expect(driverMock._executionContext.cacheNativesOnNewDocument).toHaveBeenCalled();
  });

  it('install rIC shim on simulated throttling', async () => {
    await prepare.prepareTargetForNavigationMode(driverMock.asDriver(), {
      ...constants.defaultSettings,
      throttlingMethod: 'simulate',
    });

    const invocations = driverMock._executionContext.evaluateOnNewDocument.mock.calls;
    if (!invocations.length) expect(invocations).toHaveLength(1);
    const matchingInvocations = invocations.filter(argList =>
      argList[0].toString().includes('requestIdleCallback')
    );
    if (!matchingInvocations.length) expect(invocations).toContain('An item shimming rIC');
  });

  it('not install rIC shim on devtools throttling', async () => {
    await prepare.prepareTargetForNavigationMode(driverMock.asDriver(), {
      ...constants.defaultSettings,
      throttlingMethod: 'devtools',
    });

    const invocations = driverMock._executionContext.evaluateOnNewDocument.mock.calls;
    const matchingInvocations = invocations.filter(argList =>
      argList[0].toString().includes('requestIdleCallback')
    );
    expect(matchingInvocations).toHaveLength(0);
  });

  it('handle javascript dialogs automatically', async () => {
    timers.useFakeTimers();

    sessionMock.sendCommand.mockResponse('Page.handleJavaScriptDialog');
    sessionMock.on.mockEvent('Page.javascriptDialogOpening', {type: 'confirm'});

    await prepare.prepareTargetForNavigationMode(driverMock.asDriver(), {
      ...constants.defaultSettings,
    });

    await flushAllTimersAndMicrotasks();

    expect(sessionMock.sendCommand).toHaveBeenCalledWith('Page.handleJavaScriptDialog', {
      accept: true,
      promptText: 'Lighthouse prompt response',
    });
  });
});

describe('.prepareTargetForTimespanMode()', () => {
  let driverMock = createMockDriver();

  beforeEach(() => {
    driverMock = createMockDriver();
    sessionMock = driverMock._session;

    sessionMock.sendCommand
      .mockResponse('Network.enable')
      .mockResponse('Network.setUserAgentOverride')
      .mockResponse('Emulation.setDeviceMetricsOverride')
      .mockResponse('Emulation.setTouchEmulationEnabled')
      .mockResponse('Debugger.enable')
      .mockResponse('Debugger.setSkipAllPauses')
      .mockResponse('Debugger.setAsyncCallStackDepth')
      .mockResponse('Network.emulateNetworkConditions')
      .mockResponse('Emulation.setCPUThrottlingRate')
      .mockResponse('Network.setBlockedURLs')
      .mockResponse('Network.setExtraHTTPHeaders');
  });

  it('emulates the target device', async () => {
    await prepare.prepareTargetForTimespanMode(driverMock.asDriver(), {
      ...constants.defaultSettings,
      screenEmulation: {
        disabled: false,
        mobile: true,
        deviceScaleFactor: 2,
        width: 200,
        height: 300,
      },
    });

    expect(sessionMock.sendCommand.findInvocation('Emulation.setDeviceMetricsOverride')).toEqual({
      mobile: true,
      deviceScaleFactor: 2,
      width: 200,
      height: 300,
    });
  });

  it('enables async stacks', async () => {
    await prepare.prepareTargetForTimespanMode(driverMock.asDriver(), {
      ...constants.defaultSettings,
    });

    const invocations = sessionMock.sendCommand.mock.calls;
    const debuggerInvocations = invocations.filter(call => call[0].startsWith('Debugger.'));
    expect(debuggerInvocations.map(argList => argList[0])).toEqual([
      'Debugger.enable',
      'Debugger.setSkipAllPauses',
      'Debugger.setAsyncCallStackDepth',
    ]);
  });

  it('sets throttling', async () => {
    await prepare.prepareTargetForTimespanMode(driverMock.asDriver(), {
      ...constants.defaultSettings,
      throttlingMethod: 'devtools',
    });

    sessionMock.sendCommand.findInvocation('Network.emulateNetworkConditions');
    sessionMock.sendCommand.findInvocation('Emulation.setCPUThrottlingRate');
  });

  it('sets network environment', async () => {
    await prepare.prepareTargetForTimespanMode(driverMock.asDriver(), {
      ...constants.defaultSettings,
      blockedUrlPatterns: ['.jpg'],
      extraHeaders: {Cookie: 'name=wolverine'},
    });

    const blockedInvocation = sessionMock.sendCommand.findInvocation('Network.setBlockedURLs');
    expect(blockedInvocation).toEqual({urls: ['.jpg']});

    const headersInvocation = sessionMock.sendCommand.findInvocation('Network.setExtraHTTPHeaders');
    expect(headersInvocation).toEqual({headers: {Cookie: 'name=wolverine'}});
  });
});
