/**
 * @license Copyright 2019 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import {strict as assert} from 'assert';

import {LargestContentfulPaint} from '../../../computed/metrics/largest-contentful-paint.js';
import {getURLArtifactFromDevtoolsLog, readJson} from '../../test-utils.js';

const trace = readJson('../../fixtures/traces/lcp-m78.json', import.meta);
const devtoolsLog = readJson('../../fixtures/traces/lcp-m78.devtools.log.json', import.meta);
const invalidTrace = readJson('../../fixtures/traces/progressive-app-m60.json', import.meta);
const invalidDevtoolsLog = readJson('../../fixtures/traces/progressive-app-m60.devtools.log.json', import.meta);

describe('Metrics: LCP', () => {
  const gatherContext = {gatherMode: 'navigation'};

  it('should compute predicted value', async () => {
    const settings = {throttlingMethod: 'simulate'};
    const context = {settings, computedCache: new Map()};
    const URL = getURLArtifactFromDevtoolsLog(devtoolsLog);
    const result = await LargestContentfulPaint.request({trace, devtoolsLog, gatherContext,
      settings, URL}, context);

    expect({
      timing: Math.round(result.timing),
      optimistic: Math.round(result.optimisticEstimate.timeInMs),
      pessimistic: Math.round(result.pessimisticEstimate.timeInMs),
    }).toMatchInlineSnapshot(`
      Object {
        "optimistic": 2289,
        "pessimistic": 3228,
        "timing": 2758,
      }
    `);
  });

  it('should compute an observed value', async () => {
    const settings = {throttlingMethod: 'provided'};
    const context = {settings, computedCache: new Map()};
    const URL = getURLArtifactFromDevtoolsLog(devtoolsLog);
    const result = await LargestContentfulPaint.request({trace, devtoolsLog, gatherContext,
      settings, URL}, context);

    assert.equal(Math.round(result.timing), 1122);
    assert.equal(result.timestamp, 713038144775);
  });

  it('should fail to compute an observed value for old trace', async () => {
    const settings = {throttlingMethod: 'provided'};
    const context = {settings, computedCache: new Map()};
    const URL = getURLArtifactFromDevtoolsLog(invalidDevtoolsLog);
    const resultPromise = LargestContentfulPaint.request(
      {gatherContext, trace: invalidTrace, devtoolsLog: invalidDevtoolsLog, settings, URL},
      context
    );
    await expect(resultPromise).rejects.toThrow('NO_LCP');
  });
});
