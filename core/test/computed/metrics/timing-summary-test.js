/**
 * @license Copyright 2019 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import {TimingSummary} from '../../../computed/metrics/timing-summary.js';
import {readJson} from '../../test-utils.js';

const trace = readJson('../../fixtures/traces/frame-metrics-m90.json', import.meta);
const devtoolsLog = readJson('../../fixtures/traces/frame-metrics-m90.devtools.log.json', import.meta);

describe('Timing summary', () => {
  it('contains the correct data', async () => {
    const gatherContext = {gatherMode: 'navigation'};
    const artifacts = {settings: {throttlingMethod: 'devtools'}, trace, devtoolsLog, gatherContext};
    const context = {computedCache: new Map()};
    const result = await TimingSummary.request(artifacts, context);

    expect(result.metrics).toMatchInlineSnapshot(`
      Object {
        "cumulativeLayoutShift": 0.026463014612806653,
        "cumulativeLayoutShiftMainFrame": 0.0011656245471340055,
        "firstContentfulPaint": 5668.275,
        "firstContentfulPaintAllFrames": 697.751,
        "firstContentfulPaintAllFramesTs": 10327885660,
        "firstContentfulPaintTs": 10332856184,
        "firstMeaningfulPaint": 669.212,
        "firstMeaningfulPaintTs": 10327857121,
        "interactive": 8654.264,
        "interactiveTs": 10335842173,
        "largestContentfulPaint": 5668.275,
        "largestContentfulPaintAllFrames": 697.751,
        "largestContentfulPaintAllFramesTs": 10327885660,
        "largestContentfulPaintTs": 10332856184,
        "maxPotentialFID": 51.056,
        "observedCumulativeLayoutShift": 0.026463014612806653,
        "observedCumulativeLayoutShiftMainFrame": 0.0011656245471340055,
        "observedDomContentLoaded": 604.135,
        "observedDomContentLoadedTs": 10327792044,
        "observedFirstContentfulPaint": 5668.275,
        "observedFirstContentfulPaintAllFrames": 697.751,
        "observedFirstContentfulPaintAllFramesTs": 10327885660,
        "observedFirstContentfulPaintTs": 10332856184,
        "observedFirstMeaningfulPaint": 669.212,
        "observedFirstMeaningfulPaintTs": 10327857121,
        "observedFirstPaint": 669.212,
        "observedFirstPaintTs": 10327857121,
        "observedFirstVisualChange": 673,
        "observedFirstVisualChangeTs": 10327860909,
        "observedLargestContentfulPaint": 5668.275,
        "observedLargestContentfulPaintAllFrames": 697.751,
        "observedLargestContentfulPaintAllFramesTs": 10327885660,
        "observedLargestContentfulPaintTs": 10332856184,
        "observedLastVisualChange": 5711,
        "observedLastVisualChangeTs": 10332898909,
        "observedLoad": 688.184,
        "observedLoadTs": 10327876093,
        "observedNavigationStart": 0,
        "observedNavigationStartTs": 10327187909,
        "observedSpeedIndex": 1334.5801200005412,
        "observedSpeedIndexTs": 10328522489.12,
        "observedTimeOrigin": 0,
        "observedTimeOriginTs": 10327187909,
        "observedTotalCumulativeLayoutShift": 0.0011656245471340055,
        "observedTraceEnd": 14214.313,
        "observedTraceEndTs": 10341402222,
        "speedIndex": 1335,
        "speedIndexTs": 10328522909,
        "totalBlockingTime": 2.7429999999994834,
        "totalCumulativeLayoutShift": 0.0011656245471340055,
      }
    `);
    // Includes performance metrics
    expect(result.metrics.firstContentfulPaint).toBeDefined();
    // Includes timestamps from trace of tab
    expect(result.metrics.observedFirstContentfulPaint).toBeDefined();
    // Includs visual metrics from Speedline
    expect(result.metrics.observedFirstVisualChange).toBeDefined();

    expect(result.debugInfo).toEqual({lcpInvalidated: false});
  });
});
