/**
 * @license Copyright 2021 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import {Fetcher} from '../../gather/fetcher.js';
import {Driver} from '../../legacy/gather/driver.js';
import {Connection} from '../../legacy/gather/connections/connection.js';
import {fnAny, mockCommands} from '../test-utils.js';

const {createMockSendCommandFn} = mockCommands;

/** @type {Connection} */
let connectionStub;
/** @type {Driver} */
let driver;
/** @type {Fetcher} */
let fetcher;

beforeEach(() => {
  connectionStub = new Connection();
  driver = new Driver(connectionStub);
  fetcher = new Fetcher(driver.defaultSession);
});

describe('._readIOStream', () => {
  it('reads contents of stream', async () => {
    connectionStub.sendCommand = createMockSendCommandFn()
      .mockResponse('IO.read', {data: 'Hello World!', eof: true, base64Encoded: false});

    const data = await fetcher._readIOStream('1');
    expect(data).toEqual('Hello World!');
  });

  it('combines multiple reads', async () => {
    connectionStub.sendCommand = createMockSendCommandFn()
      .mockResponse('IO.read', {data: 'Hello ', eof: false, base64Encoded: false})
      .mockResponse('IO.read', {data: 'World', eof: false, base64Encoded: false})
      .mockResponse('IO.read', {data: '!', eof: true, base64Encoded: false});

    const data = await fetcher._readIOStream('1');
    expect(data).toEqual('Hello World!');
  });

  it('decodes if base64', async () => {
    const buffer = Buffer.from('Hello World!').toString('base64');
    connectionStub.sendCommand = createMockSendCommandFn()
      .mockResponse('IO.read', {data: buffer, eof: true, base64Encoded: true});

    const data = await fetcher._readIOStream('1');
    expect(data).toEqual('Hello World!');
  });

  it('decodes multiple base64 reads', async () => {
    const buffer1 = Buffer.from('Hello ').toString('base64');
    const buffer2 = Buffer.from('World!').toString('base64');
    connectionStub.sendCommand = createMockSendCommandFn()
      .mockResponse('IO.read', {data: buffer1, eof: false, base64Encoded: true})
      .mockResponse('IO.read', {data: buffer2, eof: true, base64Encoded: true});

    const data = await fetcher._readIOStream('1');
    expect(data).toEqual('Hello World!');
  });

  it('throws on timeout', async () => {
    connectionStub.sendCommand = fnAny()
      .mockReturnValue(Promise.resolve({data: 'No stop', eof: false, base64Encoded: false}));

    const dataPromise = fetcher._readIOStream('1', {timeout: 50});
    await expect(dataPromise).rejects.toThrowError(/Waiting for the end of the IO stream/);
  });
});

describe('._fetchResourceOverProtocol', () => {
  /** @type {string} */
  let streamContents;

  beforeEach(() => {
    streamContents = 'STREAM CONTENTS';
    fetcher._readIOStream = fnAny().mockImplementation(() => {
      return Promise.resolve(streamContents);
    });
  });

  it('fetches a file', async () => {
    connectionStub.sendCommand = createMockSendCommandFn()
      .mockResponse('Page.getFrameTree', {frameTree: {frame: {id: 'FRAME'}}})
      .mockResponse('Network.loadNetworkResource', {
        resource: {success: true, httpStatusCode: 200, stream: '1'},
      });

    const data = await fetcher._fetchResourceOverProtocol('https://example.com', {timeout: 500});
    expect(data).toEqual({content: streamContents, status: 200});
  });

  it('returns null when resource could not be fetched', async () => {
    connectionStub.sendCommand = createMockSendCommandFn()
      .mockResponse('Page.getFrameTree', {frameTree: {frame: {id: 'FRAME'}}})
      .mockResponse('Network.loadNetworkResource', {
        resource: {success: false, httpStatusCode: 404},
      });

    const data = await fetcher._fetchResourceOverProtocol('https://example.com', {timeout: 500});
    expect(data).toEqual({content: null, status: 404});
  });

  it('throws on timeout', async () => {
    connectionStub.sendCommand = createMockSendCommandFn()
      .mockResponse('Page.getFrameTree', {frameTree: {frame: {id: 'FRAME'}}})
      .mockResponse('Network.loadNetworkResource', {
        resource: {success: false, httpStatusCode: 404},
      }, 100);

    const dataPromise = fetcher._fetchResourceOverProtocol('https://example.com', {timeout: 50});
    await expect(dataPromise).rejects.toThrowError(/Timed out fetching resource/);
  });

  it('uses remaining time on _readIOStream', async () => {
    connectionStub.sendCommand = createMockSendCommandFn()
      .mockResponse('Page.getFrameTree', {frameTree: {frame: {id: 'FRAME'}}})
      .mockResponse('Network.loadNetworkResource', {
        resource: {success: true, httpStatusCode: 200, stream: '1'},
      }, 500);

    let timeout;
    fetcher._readIOStream = fnAny().mockImplementation((_, options) => {
      timeout = options.timeout;
    });

    await fetcher._fetchResourceOverProtocol('https://example.com', {timeout: 1000});
    expect(timeout).toBeCloseTo(500, -2);
  });
});
