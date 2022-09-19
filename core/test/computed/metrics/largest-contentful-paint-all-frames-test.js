/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import {strict as assert} from 'assert';

import {LargestContentfulPaintAllFrames} from '../../../computed/metrics/largest-contentful-paint-all-frames.js';
import {readJson} from '../../test-utils.js';

const traceAllFrames = readJson('../../fixtures/traces/frame-metrics-m89.json', import.meta);
const devtoolsLogAllFrames = readJson('../../fixtures/traces/frame-metrics-m89.devtools.log.json', import.meta);
const traceMainFrame = readJson('../../fixtures/traces/lcp-m78.json', import.meta);
const devtoolsLogMainFrame = readJson('../../fixtures/traces/lcp-m78.devtools.log.json', import.meta);
const invalidTrace = readJson('../../fixtures/traces/progressive-app-m60.json', import.meta);
const invalidDevtoolsLog = readJson('../../fixtures/traces/progressive-app-m60.devtools.log.json', import.meta);

describe('Metrics: LCP from all frames', () => {
  const gatherContext = {gatherMode: 'navigation'};

  it('should throw for predicted value', async () => {
    const settings = {throttlingMethod: 'simulate'};
    const context = {settings, computedCache: new Map()};
    const resultPromise = LargestContentfulPaintAllFrames.request({gatherContext, trace: traceAllFrames, devtoolsLog: devtoolsLogAllFrames, settings}, context); // eslint-disable-line max-len

    // TODO: Implement lantern solution for LCP all frames.
    expect(resultPromise).rejects.toThrow();
  });

  it('should compute an observed value', async () => {
    const settings = {throttlingMethod: 'provided'};
    const context = {settings, computedCache: new Map()};
    const result = await LargestContentfulPaintAllFrames.request({gatherContext, trace: traceAllFrames, devtoolsLog: devtoolsLogAllFrames, settings}, context); // eslint-disable-line max-len

    assert.equal(Math.round(result.timing), 683);
    assert.equal(result.timestamp, 23466705983);
  });

  it('should fail to compute an observed value for old trace', async () => {
    const settings = {throttlingMethod: 'provided'};
    const context = {settings, computedCache: new Map()};
    const resultPromise = LargestContentfulPaintAllFrames.request(
      {gatherContext, trace: invalidTrace, devtoolsLog: invalidDevtoolsLog, settings},
      context
    );
    await expect(resultPromise).rejects.toThrow('NO_LCP_ALL_FRAMES');
  });

  it('should use main frame LCP if no other frames', async () => {
    const settings = {throttlingMethod: 'provided'};
    const context = {settings, computedCache: new Map()};
    const result = await LargestContentfulPaintAllFrames.request(
      {gatherContext, trace: traceMainFrame, devtoolsLog: devtoolsLogMainFrame, settings},
      context
    );
    await expect(result).toEqual({
      timestamp: 713038144775,
      timing: 1121.711,
    });
  });
});
