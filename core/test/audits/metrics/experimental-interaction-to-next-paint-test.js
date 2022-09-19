/**
 * @license Copyright 2022 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import ExperimentalInteractionToNextPaint from '../../../audits/metrics/experimental-interaction-to-next-paint.js';
import {readJson} from '../../test-utils.js';

const interactionTrace = readJson('../../fixtures/traces/timespan-responsiveness-m103.trace.json', import.meta);
const noInteractionTrace = readJson('../../fixtures/traces/jumpy-cls-m90.json', import.meta);

describe('Interaction to Next Paint', () => {
  function getTestData() {
    const artifacts = {
      traces: {
        [ExperimentalInteractionToNextPaint.DEFAULT_PASS]: interactionTrace,
      },
    };

    const context = {
      settings: {throttlingMethod: 'devtools'},
      computedCache: new Map(),
      options: ExperimentalInteractionToNextPaint.defaultOptions,
    };

    return {artifacts, context};
  }

  it('evaluates INP correctly', async () => {
    const {artifacts, context} = getTestData();
    const result = await ExperimentalInteractionToNextPaint.audit(artifacts, context);
    expect(result).toEqual({
      score: 0.66,
      numericValue: 368,
      numericUnit: 'millisecond',
      displayValue: expect.toBeDisplayString('370 ms'),
    });
  });

  it('falls back Responsiveness timing if no m103 EventTiming events', async () => {
    const {artifacts, context} = getTestData();
    const clonedTrace = JSON.parse(JSON.stringify(artifacts.traces.defaultPass));
    for (let i = 0; i < clonedTrace.traceEvents.length; i++) {
      if (clonedTrace.traceEvents[i].name !== 'EventTiming') continue;
      clonedTrace.traceEvents[i].args = {};
    }
    artifacts.traces.defaultPass = clonedTrace;

    const result = await ExperimentalInteractionToNextPaint.audit(artifacts, context);
    // Conveniently, the matching responsiveness event has slightly different
    // duration than the matching interaction event so can be tested against.
    expect(result).toEqual({
      score: 0.67,
      numericValue: 364,
      numericUnit: 'millisecond',
      displayValue: expect.toBeDisplayString('360 ms'),
    });
  });

  it('is not applicable if using simulated throttling', async () => {
    const {artifacts, context} = getTestData();
    context.settings.throttlingMethod = 'simulate';
    const result = await ExperimentalInteractionToNextPaint.audit(artifacts, context);
    expect(result).toMatchObject({
      score: null,
      notApplicable: true,
    });
  });

  it('is not applicable if no interactions occurred in trace', async () => {
    const {artifacts, context} = getTestData();
    artifacts.traces[ExperimentalInteractionToNextPaint.DEFAULT_PASS] = noInteractionTrace;
    const result = await ExperimentalInteractionToNextPaint.audit(artifacts, context);
    expect(result).toMatchObject({
      score: null,
      notApplicable: true,
    });
  });
});
