/**
 * @license Copyright 2016 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import {Driver} from '../../../legacy/gather/driver.js';
import {Connection} from '../../../legacy/gather/connections/connection.js';
import {fakeDriver} from './fake-driver.js';
import {
  mockCommands,
  makePromiseInspectable,
  flushAllTimersAndMicrotasks,
  fnAny,
  timers,
} from '../../test-utils.js';

const {createMockSendCommandFn} = mockCommands;

timers.useFakeTimers();

/**
 * @typedef DriverMockMethods
 * @property {Driver['evaluate']} evaluate redefined to remove "private" designation
 * @property {Driver['evaluateAsync']} evaluateAsync redefined to remove "private" designation
*/

/** @typedef {Omit<Driver, keyof DriverMockMethods> & DriverMockMethods} TestDriver */

/** @type {TestDriver} */
let driver;
/** @type {Connection & {sendCommand: ReturnType<typeof createMockSendCommandFn>}} */
let connectionStub;

beforeEach(() => {
  // @ts-expect-error - connectionStub has a mocked version of sendCommand implemented in each test
  connectionStub = new Connection();
  // @ts-expect-error
  connectionStub.sendCommand = cmd => {
    throw new Error(`${cmd} not implemented`);
  };
  // @ts-expect-error - driver has a mocked version of on/once implemented in each test
  driver = new Driver(connectionStub);
});

describe('.getRequestContent', () => {
  it('throws if getRequestContent takes too long', async () => {
    const mockTimeout = 5000;
    const driverTimeout = 1000;
    // @ts-expect-error
    connectionStub.sendCommand = fnAny()
      .mockImplementation(() => new Promise(r => setTimeout(r, mockTimeout)));

    // Fail if we don't reach our two assertions in the catch block
    expect.assertions(2);

    try {
      const responsePromise = driver.getRequestContent('', driverTimeout);
      await flushAllTimersAndMicrotasks(Math.max(driverTimeout, mockTimeout) + 1);
      await responsePromise;
    } catch (err) {
      expect(err.code).toEqual('PROTOCOL_TIMEOUT');
      expect(err.friendlyMessage).toBeDisplayString(
        /^Waiting for DevTools.*Method: Network.getResponseBody/
      );
    }
  });
});

describe('.evaluateAsync', () => {
  // The logic here is tested by core/test/gather/driver/execution-context-test.js
  // Just exercise a bit of the plumbing here to ensure we delegate correctly for plugin backcompat.
  it('evaluates an expression', async () => {
    connectionStub.sendCommand = createMockSendCommandFn()
      .mockResponse('Runtime.evaluate', {result: {value: 2}});

    const value = await driver.evaluateAsync('1 + 1');
    expect(value).toEqual(2);
    connectionStub.sendCommand.findInvocation('Runtime.evaluate');
  });

  it('uses the specific timeout given', async () => {
    connectionStub.sendCommand = createMockSendCommandFn()
      .mockResponse('Runtime.evaluate', {result: {value: 2}}, 10000);

    driver.setNextProtocolTimeout(5000);
    const evaluatePromise = makePromiseInspectable(driver.evaluateAsync('1 + 1'));

    timers.advanceTimersByTime(5001);
    await flushAllTimersAndMicrotasks();
    expect(evaluatePromise).toBeDone();
    await expect(evaluatePromise).rejects.toBeTruthy();
  });
});

describe('.sendCommand', () => {
  it('.sendCommand timesout when commands take too long', async () => {
    const mockTimeout = 5000;
    // @ts-expect-error
    connectionStub.sendCommand = fnAny()
      .mockImplementation(() => new Promise(r => setTimeout(r, mockTimeout)));

    driver.setNextProtocolTimeout(10000);
    const pageEnablePromise = driver.sendCommand('Page.enable');
    timers.advanceTimersByTime(mockTimeout + 1);
    await pageEnablePromise;

    const driverTimeout = 5;
    driver.setNextProtocolTimeout(driverTimeout);
    const pageDisablePromise = driver.sendCommand('Page.disable');

    await flushAllTimersAndMicrotasks(driverTimeout + 1);
    await expect(pageDisablePromise).rejects.toMatchObject({
      code: 'PROTOCOL_TIMEOUT',
    });
  });
});

describe('.beginTrace', () => {
  beforeEach(() => {
    connectionStub.sendCommand = createMockSendCommandFn()
      .mockResponse('Browser.getVersion', fakeDriver.protocolGetVersionResponse)
      .mockResponse('Page.enable')
      .mockResponse('Tracing.start');
  });

  it('will request default traceCategories', async () => {
    await driver.beginTrace();

    const tracingStartArgs = connectionStub.sendCommand.findInvocation('Tracing.start');
    expect(tracingStartArgs.categories).toContain('devtools.timeline');
    expect(tracingStartArgs.categories).not.toContain('toplevel');
    expect(tracingStartArgs.categories).toContain('disabled-by-default-lighthouse');
  });

  it('will use requested additionalTraceCategories', async () => {
    await driver.beginTrace({additionalTraceCategories: 'loading,xtra_cat'});

    const tracingStartArgs = connectionStub.sendCommand.findInvocation('Tracing.start');
    expect(tracingStartArgs.categories).toContain('blink.user_timing');
    expect(tracingStartArgs.categories).toContain('xtra_cat');
    // Make sure it deduplicates categories too
    expect(tracingStartArgs.categories).not.toMatch(/loading.*loading/);
  });
});

describe('Domain.enable/disable State', () => {
  it('dedupes (simple)', async () => {
    connectionStub.sendCommand = createMockSendCommandFn()
      .mockResponse('Network.enable')
      .mockResponse('Network.disable')
      .mockResponse('Fetch.enable')
      .mockResponse('Fetch.disable');

    await driver.sendCommand('Network.enable');
    await driver.sendCommand('Network.enable');
    expect(connectionStub.sendCommand).toHaveBeenCalledTimes(1);

    await driver.sendCommand('Network.disable');
    expect(connectionStub.sendCommand).toHaveBeenCalledTimes(1);
    // Network still has one enable.

    await driver.sendCommand('Fetch.enable');
    expect(connectionStub.sendCommand).toHaveBeenCalledTimes(2);

    await driver.sendCommand('Network.disable');
    expect(connectionStub.sendCommand).toHaveBeenCalledTimes(3);
    // Network is now disabled.

    await driver.sendCommand('Fetch.disable');
    expect(connectionStub.sendCommand).toHaveBeenCalledTimes(4);
  });

  it('dedupes (sessions)', async () => {
    connectionStub.sendCommand = createMockSendCommandFn()
      .mockResponse('Network.enable')
      .mockResponseToSession('Network.enable', '123')
      .mockResponse('Network.disable')
      .mockResponseToSession('Network.disable', '123');

    await driver.sendCommand('Network.enable');
    await driver.sendCommandToSession('Network.enable', '123');
    expect(connectionStub.sendCommand).toHaveBeenCalledTimes(2);

    await driver.sendCommand('Network.enable');
    await driver.sendCommandToSession('Network.enable', '123');
    expect(connectionStub.sendCommand).toHaveBeenCalledTimes(2);

    await driver.sendCommandToSession('Network.disable', '123');
    expect(connectionStub.sendCommand).toHaveBeenCalledTimes(2);

    await driver.sendCommand('Network.disable');
    expect(connectionStub.sendCommand).toHaveBeenCalledTimes(2);

    await driver.sendCommandToSession('Network.disable', '123');
    expect(connectionStub.sendCommand).toHaveBeenCalledTimes(3);

    await driver.sendCommand('Network.disable');
    expect(connectionStub.sendCommand).toHaveBeenCalledTimes(4);
  });
});

describe('Multi-target management', () => {
  it('enables the Network domain for iframes', async () => {
    connectionStub.sendCommand = createMockSendCommandFn()
      .mockResponseToSession('Network.enable', '123')
      .mockResponseToSession('Target.setAutoAttach', '123')
      .mockResponseToSession('Runtime.runIfWaitingForDebugger', '123');

    driver._eventEmitter.emit('Target.attachedToTarget', {
      sessionId: '123',
      // @ts-expect-error: Ignore partial targetInfo.
      targetInfo: {type: 'iframe'},
    });
    await flushAllTimersAndMicrotasks();

    expect(connectionStub.sendCommand).toHaveBeenNthCalledWith(1, 'Network.enable', '123');
    expect(connectionStub.sendCommand)
      .toHaveBeenNthCalledWith(2, 'Target.setAutoAttach', '123', expect.anything());
    expect(connectionStub.sendCommand)
      .toHaveBeenNthCalledWith(3, 'Runtime.runIfWaitingForDebugger', '123');
  });

  it('ignores other target types, but still resumes them', async () => {
    connectionStub.sendCommand = createMockSendCommandFn()
      .mockResponse('Target.sendMessageToTarget');

    driver._eventEmitter.emit('Target.attachedToTarget', {
      sessionId: 'SW1',
      // @ts-expect-error: Ignore partial targetInfo.
      targetInfo: {type: 'service_worker'},
    });
    await flushAllTimersAndMicrotasks();

    expect(connectionStub.sendCommand)
      .toHaveBeenNthCalledWith(1, 'Runtime.runIfWaitingForDebugger', 'SW1');
  });
});
