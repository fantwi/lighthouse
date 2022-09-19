/**
 * @license Copyright 2021 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import {ProcessedTrace} from '../../computed/processed-trace.js';
import {readJson} from '../test-utils.js';

const pwaTrace = readJson('../fixtures/traces/progressive-app-m60.json', import.meta);

describe('ProcessedTrace', () => {
  it('computes the artifact', async () => {
    const context = {computedCache: new Map()};
    const processedTrace = await ProcessedTrace.request(pwaTrace, context);

    expect(processedTrace.processEvents.length).toEqual(12865);
    expect(processedTrace.mainThreadEvents.length).toEqual(7629);

    delete processedTrace.processEvents;
    delete processedTrace.mainThreadEvents;
    delete processedTrace.frameTreeEvents;
    delete processedTrace.frameEvents;

    expect(processedTrace).toEqual({
      mainFrameIds: {
        frameId: '0x25a638821e30',
        pid: 44277,
        tid: 775,
      },
      timeOriginEvt: {
        args: {
          frame: '0x25a638821e30',
        },
        cat: 'blink.user_timing',
        name: 'navigationStart',
        ph: 'R',
        pid: 44277,
        tid: 775,
        ts: 225414172015,
        tts: 455539,
      },
      frames: [],
      timestamps: {
        timeOrigin: 225414172015,
        traceEnd: 225426711887,
      },
      timings: {
        timeOrigin: 0,
        traceEnd: 12539.872,
      },
    });
  });

  it('fails with NO_TRACING_STARTED', async () => {
    const context = {computedCache: new Map()};
    const noTracingStartedTrace = {
      traceEvents: pwaTrace.traceEvents.filter(event => {
        if (event.name === 'TracingStartedInBrowser' ||
            event.name === 'TracingStartedInPage' ||
            event.name === 'ResourceSendRequest') {
          return false;
        }

        return true;
      }),
    };

    await expect(ProcessedTrace.request(noTracingStartedTrace, context))
      .rejects.toMatchObject({code: 'NO_TRACING_STARTED'});
  });
});
