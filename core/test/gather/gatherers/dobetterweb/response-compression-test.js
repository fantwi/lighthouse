/**
 * @license Copyright 2017 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import {createMockContext, mockDriverSubmodules} from '../../../gather/mock-driver.js';
// import ResponseCompression from '../../../../gather/gatherers/dobetterweb/response-compression.js';

// Some imports needs to be done dynamically, so that their dependencies will be mocked.
// See: https://jestjs.io/docs/ecmascript-modules#differences-between-esm-and-commonjs
//      https://github.com/facebook/jest/issues/10025
/** @typedef {import('../../../../gather/gatherers/dobetterweb/response-compression.js')} ResponseCompression */
/** @type {typeof import('../../../../gather/gatherers/dobetterweb/response-compression.js')} */
let ResponseCompression;

before(async () => {
  ResponseCompression =
    (await import('../../../../gather/gatherers/dobetterweb/response-compression.js')).default;
});

const mocks = await mockDriverSubmodules();

const networkRecords = [
  {
    url: 'http://google.com/index.js',
    statusCode: 200,
    mimeType: 'text/javascript',
    requestId: 0,
    resourceSize: 9,
    transferSize: 10,
    resourceType: 'Script',
    responseHeaders: [{
      name: 'Content-Encoding',
      value: 'gzip',
    }],
    content: 'aaabbbccc',
    finished: true,
  },
  {
    url: 'http://google.com/index.css',
    statusCode: 200,
    mimeType: 'text/css',
    requestId: 1,
    resourceSize: 6,
    transferSize: 7,
    resourceType: 'Stylesheet',
    responseHeaders: [],
    content: 'abcabc',
    finished: true,
  },
  {
    url: 'http://google.com/index.json',
    statusCode: 200,
    mimeType: 'application/json',
    requestId: 2,
    resourceSize: 7,
    transferSize: 8,
    resourceType: 'XHR',
    responseHeaders: [],
    content: '1234567',
    finished: true,
  },
  {
    url: 'http://google.com/index.json',
    statusCode: 200,
    mimeType: 'application/json',
    requestId: 27,
    resourceSize: 7,
    transferSize: 8,
    resourceType: 'XHR',
    responseHeaders: [],
    content: '1234567',
    finished: true,
    sessionId: 'oopif', // ignore for being from oopif
  },
  {
    url: 'http://google.com/index.json',
    statusCode: 304, // ignore for being a cache not modified response
    mimeType: 'application/json',
    requestId: 22,
    resourceSize: 7,
    transferSize: 7,
    resourceType: 'XHR',
    responseHeaders: [],
    content: '1234567',
    finished: true,
  },
  {
    url: 'http://google.com/other.json',
    statusCode: 200,
    mimeType: 'application/json',
    requestId: 23,
    resourceSize: 7,
    transferSize: 8,
    resourceType: 'XHR',
    responseHeaders: [],
    content: '1234567',
    finished: false, // ignore for not finishing
  },
  {
    url: 'http://google.com/index.jpg',
    statusCode: 200,
    mimeType: 'image/jpg',
    requestId: 3,
    resourceSize: 10,
    transferSize: 10,
    resourceType: 'Image',
    responseHeaders: [],
    content: 'aaaaaaaaaa',
    finished: true,
  },
  {
    url: 'http://google.com/helloworld.mp4',
    statusCode: 200,
    mimeType: 'video/mp4',
    requestId: 4,
    resourceSize: 100,
    transferSize: 100,
    resourceType: 'Media',
    responseHeaders: [],
    content: 'bbbbbbbb',
    finished: true,
  },
];

describe('Optimized responses', () => {
  let context;
  /** @type {ResponseCompression} */
  let gatherer;
  beforeEach(() => {
    gatherer = new ResponseCompression();
    context = createMockContext();
    mocks.reset();
    mocks.networkMock.fetchResponseBodyFromCache.mockImplementation((_, id) => {
      return Promise.resolve(networkRecords[id].content);
    });
  });

  it('returns only text and non encoded responses', async () => {
    const artifact = await gatherer._getArtifact(context, networkRecords);
    expect(artifact).toHaveLength(2);
    expect(artifact[0].url).toMatch(/index\.css$/);
    expect(artifact[1].url).toMatch(/index\.json$/);
  });

  it('computes sizes', async () => {
    const artifact = await gatherer._getArtifact(context, networkRecords);
    expect(artifact).toHaveLength(2);
    expect(artifact[0].resourceSize).toEqual(6);
    expect(artifact[0].gzipSize).toEqual(26);
  });

  it('recovers from driver errors', async () => {
    mocks.networkMock.fetchResponseBodyFromCache.mockRejectedValue(new Error('Failed'));
    const artifact = await gatherer._getArtifact(context, networkRecords);
    expect(artifact).toHaveLength(2);
    expect(artifact[0].resourceSize).toEqual(6);
    expect(artifact[0].gzipSize).toBeUndefined();
  });

  it('ignores responses from installed Chrome extensions', async () => {
    const networkRecords = [
      {
        url: 'chrome-extension://index.css',
        mimeType: 'text/css',
        requestId: 1,
        resourceSize: 10,
        transferSize: 10,
        resourceType: 'Stylesheet',
        responseHeaders: [],
        content: 'aaaaaaaaaa',
        finished: true,
      },
      {
        url: 'http://google.com/chrome-extension.css',
        mimeType: 'text/css',
        requestId: 1,
        resourceSize: 123,
        transferSize: 123,
        resourceType: 'Stylesheet',
        responseHeaders: [],
        content: 'aaaaaaaaaa',
        finished: true,
      },
    ];

    const artifact = await gatherer._getArtifact(context, networkRecords);
    expect(artifact).toHaveLength(1);
    expect(artifact[0].resourceSize).toEqual(123);
  });
});
