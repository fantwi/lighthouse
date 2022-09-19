/**
 * @license Copyright 2021 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import {ProcessedTrace} from '../../computed/processed-trace.js';
import {ProcessedNavigation} from '../../computed/processed-navigation.js';
import {readJson} from '../test-utils.js';

const pwaTrace = readJson('../fixtures/traces/progressive-app-m60.json', import.meta);
const noFCPtrace = readJson('../fixtures/traces/airhorner_no_fcp.json', import.meta);
const noNavStartTrace = readJson('../fixtures/traces/no_navstart_event.json', import.meta);

describe('ProcessedTrace', () => {
  it('computes the artifact', async () => {
    const context = {computedCache: new Map()};
    const processedTrace = await ProcessedTrace.request(pwaTrace, context);
    const processedNavigation = await ProcessedNavigation.request(processedTrace, context);

    expect(processedNavigation).toEqual({
      domContentLoadedEvt: {
        args: {
          frame: '0x25a638821e30',
        },
        cat: 'blink.user_timing,rail',
        name: 'domContentLoadedEventEnd',
        ph: 'R',
        pid: 44277,
        tid: 775,
        ts: 225414732309,
        tts: 924831,
      },
      firstContentfulPaintEvt: {
        args: {
          frame: '0x25a638821e30',
        },
        cat: 'loading,rail,devtools.timeline',
        name: 'firstContentfulPaint',
        ph: 'I',
        pid: 44277,
        s: 'p',
        tid: 775,
        ts: 225414670885,
        tts: 866570,
      },
      firstContentfulPaintAllFramesEvt: {
        args: {
          frame: '0x25a638821e30',
        },
        cat: 'loading,rail,devtools.timeline',
        name: 'firstContentfulPaint',
        ph: 'I',
        pid: 44277,
        s: 'p',
        tid: 775,
        ts: 225414670885,
        tts: 866570,
      },
      firstMeaningfulPaintEvt: {
        args: {
          frame: '0x25a638821e30',
        },
        cat: 'loading,rail,devtools.timeline',
        name: 'firstMeaningfulPaint',
        ph: 'R',
        pid: 44277,
        tid: 775,
        ts: 225414955343,
        tts: 2676979,
      },
      firstPaintEvt: {
        args: {
          frame: '0x25a638821e30',
        },
        cat: 'loading,rail,devtools.timeline',
        name: 'firstPaint',
        ph: 'I',
        pid: 44277,
        s: 'p',
        tid: 775,
        ts: 225414670868,
        tts: 866553,
      },
      fmpFellBack: false,
      lcpInvalidated: false,
      loadEvt: {
        args: {
          frame: '0x25a638821e30',
        },
        cat: 'blink.user_timing',
        name: 'loadEventEnd',
        ph: 'R',
        pid: 44277,
        tid: 775,
        ts: 225416370913,
        tts: 2369379,
      },
      timestamps: {
        domContentLoaded: 225414732309,
        firstContentfulPaint: 225414670885,
        firstContentfulPaintAllFrames: 225414670885,
        firstMeaningfulPaint: 225414955343,
        firstPaint: 225414670868,
        load: 225416370913,
        timeOrigin: 225414172015,
        traceEnd: 225426711887,
      },
      timings: {
        domContentLoaded: 560.294,
        firstContentfulPaint: 498.87,
        firstContentfulPaintAllFrames: 498.87,
        firstMeaningfulPaint: 783.328,
        firstPaint: 498.853,
        load: 2198.898,
        timeOrigin: 0,
        traceEnd: 12539.872,
      },
    });
  });

  it('fails with NO_NAVSTART', async () => {
    const context = {computedCache: new Map()};
    const compute = async () => {
      const processedTrace = await ProcessedTrace.request(noNavStartTrace, context);
      await ProcessedNavigation.request(processedTrace, context);
    };
    await expect(compute()).rejects.toMatchObject({code: 'NO_NAVSTART'});
  });

  it('fails with NO_FCP', async () => {
    const context = {computedCache: new Map()};

    const compute = async () => {
      const processedTrace = await ProcessedTrace.request(noFCPtrace, context);
      await ProcessedNavigation.request(processedTrace, context);
    };

    await expect(compute()).rejects.toMatchObject({code: 'NO_FCP'});
  });
});
