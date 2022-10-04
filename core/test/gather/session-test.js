/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import {EventEmitter} from 'events';

import {CDPSessionImpl} from 'puppeteer-core/lib/cjs/puppeteer/common/Connection.js';

import {ProtocolSession} from '../../gather/session.js';
import {
  flushAllTimersAndMicrotasks,
  makePromiseInspectable,
  createDecomposedPromise,
  fnAny,
  timers,
} from '../test-utils.js';

timers.useFakeTimers();

describe('ProtocolSession', () => {
  const DEFAULT_TIMEOUT = 30_000;

  /** @type {LH.Puppeteer.CDPSession} */
  let puppeteerSession;
  /** @type {ProtocolSession} */
  let session;

  beforeEach(() => {
    // @ts-expect-error - Individual mock functions are applied as necessary.
    puppeteerSession = new CDPSessionImpl({_rawSend: fnAny(), send: fnAny()}, '', 'root');
    session = new ProtocolSession(puppeteerSession);
  });

  describe('responds to events from the underlying CDPSession', () => {
    it('once', async () => {
      const callback = fnAny();

      session.once('Page.frameNavigated', callback);
      puppeteerSession.emit('Page.frameNavigated', {id: 1});
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({id: 1});

      puppeteerSession.emit('Page.frameNavigated', {id: 2});
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('on', async () => {
      const callback = fnAny();

      session.on('Page.frameNavigated', callback);
      puppeteerSession.emit('Page.frameNavigated', {id: 1});
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({id: 1});

      puppeteerSession.emit('Page.frameNavigated', {id: 2});
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledWith({id: 2});
    });

    it('off', async () => {
      const callback = fnAny();

      session.on('Page.frameNavigated', callback);
      puppeteerSession.emit('Page.frameNavigated', {id: 1});
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({id: 1});

      session.off('Page.frameNavigated', callback);
      puppeteerSession.emit('Page.frameNavigated', {id: 2});
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('.dispose', () => {
    it('should detach from the session', async () => {
      const detach = fnAny();
      class MockCdpSession extends EventEmitter {
        constructor() {
          super();

          this.detach = detach;
        }
      }

      // @ts-expect-error - we want to use a more limited test.
      puppeteerSession = new MockCdpSession();
      session = new ProtocolSession(puppeteerSession);

      expect(puppeteerSession.listenerCount('*')).toBe(1);

      await session.dispose();
      expect(detach).toHaveBeenCalled();
      expect(puppeteerSession.listenerCount('*')).toBe(0);
    });
  });

  describe('.sendCommand', () => {
    it('delegates to puppeteer', async () => {
      const send = puppeteerSession.send = fnAny().mockResolvedValue(123);

      const result = await session.sendCommand('Page.navigate', {url: 'foo'});
      expect(result).toEqual(123);
      expect(send).toHaveBeenCalledWith('Page.navigate', {url: 'foo'});
    });

    it('times out a request by default', async () => {
      const sendPromise = createDecomposedPromise();
      puppeteerSession.send = fnAny().mockReturnValue(sendPromise.promise);

      const resultPromise = makePromiseInspectable(session.sendCommand('Page.navigate', {url: ''}));

      await timers.advanceTimersByTime(DEFAULT_TIMEOUT + 1);
      await flushAllTimersAndMicrotasks();

      expect(resultPromise).toBeDone();
      await expect(resultPromise).rejects.toMatchObject({
        code: 'PROTOCOL_TIMEOUT',
        protocolMethod: 'Page.navigate',
      });
    });

    it('times out a request with explicit timeout', async () => {
      const sendPromise = createDecomposedPromise();
      puppeteerSession.send = fnAny().mockReturnValue(sendPromise.promise);

      session.setNextProtocolTimeout(60_000);
      const resultPromise = makePromiseInspectable(session.sendCommand('Page.navigate', {url: ''}));

      await timers.advanceTimersByTime(DEFAULT_TIMEOUT + 1);
      await flushAllTimersAndMicrotasks();

      expect(resultPromise).not.toBeDone();

      await timers.advanceTimersByTime(DEFAULT_TIMEOUT + 1);
      await flushAllTimersAndMicrotasks();

      expect(resultPromise).toBeDone();
      await expect(resultPromise).rejects.toMatchObject({
        code: 'PROTOCOL_TIMEOUT',
        protocolMethod: 'Page.navigate',
      });
    });

    it('respects a timeout of infinity', async () => {
      const sendPromise = createDecomposedPromise();
      puppeteerSession.send = fnAny().mockReturnValue(sendPromise.promise);

      session.setNextProtocolTimeout(Infinity);
      const resultPromise = makePromiseInspectable(session.sendCommand('Page.navigate', {url: ''}));

      await timers.advanceTimersByTime(100_000);
      await flushAllTimersAndMicrotasks();

      expect(resultPromise).not.toBeDone();

      sendPromise.resolve('result');
      await flushAllTimersAndMicrotasks();

      expect(resultPromise).toBeDone();
      expect(await resultPromise).toBe('result');
    });
  });

  describe('.has/get/setNextProtocolTimeout', () => {
    it('should handle when none has been set', () => {
      expect(session.hasNextProtocolTimeout()).toBe(false);
      expect(session.getNextProtocolTimeout()).toBe(DEFAULT_TIMEOUT);
    });

    it('should handle when one has been set', () => {
      session.setNextProtocolTimeout(5_000);
      expect(session.hasNextProtocolTimeout()).toBe(true);
      expect(session.getNextProtocolTimeout()).toBe(5_000);
    });

    it('should handle when default has been explicitly set', () => {
      session.setNextProtocolTimeout(DEFAULT_TIMEOUT);
      expect(session.hasNextProtocolTimeout()).toBe(true);
      expect(session.getNextProtocolTimeout()).toBe(DEFAULT_TIMEOUT);
    });

    it('should handle result after a command', () => {
      session.setNextProtocolTimeout(10_000);
      expect(session.hasNextProtocolTimeout()).toBe(true);
      expect(session.getNextProtocolTimeout()).toBe(10_000);

      session.sendCommand('Page.navigate', {url: ''});

      expect(session.hasNextProtocolTimeout()).toBe(false);
      expect(session.getNextProtocolTimeout()).toBe(DEFAULT_TIMEOUT);
    });
  });
});
