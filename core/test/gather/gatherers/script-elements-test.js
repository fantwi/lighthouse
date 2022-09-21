/**
 * @license Copyright 2021 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import {createMockContext, mockDriverSubmodules} from '../mock-driver.js';
// import ScriptElements from '../../../gather/gatherers/script-elements.js';
import {NetworkRequest} from '../../../lib/network-request.js';

// Some imports needs to be done dynamically, so that their dependencies will be mocked.
// See: https://jestjs.io/docs/ecmascript-modules#differences-between-esm-and-commonjs
//      https://github.com/facebook/jest/issues/10025
/** @typedef {import('../../../gather/gatherers/script-elements.js').default} ScriptElements */
/** @type {typeof import('../../../gather/gatherers/script-elements.js').default} */
let ScriptElements;

before(async () => {
  ScriptElements = (await import('../../../gather/gatherers/script-elements.js')).default;
});

const mocks = await mockDriverSubmodules();

/**
 * @param {Partial<LH.Artifacts.NetworkRequest>=} partial
 * @return {LH.Artifacts.NetworkRequest}
 */
function mockRecord(partial) {
  const request = new NetworkRequest();
  request.resourceType = NetworkRequest.TYPES.Script;
  return Object.assign(request, partial);
}

/**
 * @param {Partial<LH.Artifacts.ScriptElement>=} partial
 * @return {LH.Artifacts.ScriptElement}
 */
function mockElement(partial) {
  return {
    type: null,
    src: null,
    id: null,
    async: false,
    defer: false,
    source: 'head',
    node: null,
    ...partial,
  };
}

describe('_getArtifact', () => {
  let mockContext = createMockContext();
  /** @type {ScriptElements} */
  let gatherer;
  /** @type {LH.Artifacts.ScriptElement[]} */
  let scriptElements;
  /** @type {LH.Artifacts.NetworkRequest[]} */
  let networkRecords;
  /** @type {LH.Artifacts.NetworkRequest} */
  let mainDocument;

  beforeEach(() => {
    mocks.reset();
    mockContext = createMockContext();
    gatherer = new ScriptElements();
    scriptElements = [];
    mainDocument = mockRecord({resourceType: NetworkRequest.TYPES.Document, requestId: '0'});
    networkRecords = [mainDocument];
    mockContext.driver._executionContext.evaluate.mockImplementation(() => scriptElements);
  });

  it('collects script elements', async () => {
    networkRecords = [
      mainDocument,
      mockRecord({url: 'https://example.com/script.js', requestId: '1'}),
    ];
    scriptElements = [
      mockElement({src: 'https://example.com/script.js'}),
      mockElement({src: null}),
    ];

    const artifact = await gatherer._getArtifact(mockContext.asContext(), networkRecords);

    expect(artifact).toEqual([
      mockElement({src: 'https://example.com/script.js'}),
      mockElement({src: null}),
    ]);
  });

  it('ignore OOPIF records', async () => {
    networkRecords = [
      mainDocument,
      mockRecord({url: 'https://example.com/script.js', requestId: '1'}),
      mockRecord({url: 'https://oopif.com/script.js', requestId: '2', sessionId: 'OOPIF'}),
    ];
    // OOPIF would not produce script element
    scriptElements = [
      mockElement({src: 'https://example.com/script.js'}),
      mockElement({src: null}),
    ];

    const artifact = await gatherer._getArtifact(mockContext.asContext(), networkRecords);

    expect(artifact).toEqual([
      mockElement({src: 'https://example.com/script.js'}),
      mockElement({src: null}),
    ]);
  });

  it('create element if none found', async () => {
    networkRecords = [
      mainDocument,
      mockRecord({url: 'https://example.com/script.js', requestId: '1'}),
    ];

    const artifact = await gatherer._getArtifact(mockContext.asContext(), networkRecords);

    expect(artifact).toEqual([
      mockElement({src: 'https://example.com/script.js', source: 'network'}),
    ]);
  });
});
