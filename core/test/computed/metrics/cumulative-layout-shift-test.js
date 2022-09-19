/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import {CumulativeLayoutShift} from '../../../computed/metrics/cumulative-layout-shift.js';
import {createTestTrace} from '../../create-test-trace.js';
import {readJson} from '../../test-utils.js';

const jumpyClsTrace = readJson('../../fixtures/traces/jumpy-cls-m90.json', import.meta);
const oldMetricsTrace = readJson('../../fixtures/traces/frame-metrics-m89.json', import.meta);
const allFramesMetricsTrace = readJson('../../fixtures/traces/frame-metrics-m90.json', import.meta);
const preClsTrace = readJson('../../fixtures/traces/progressive-app-m60.json', import.meta);

const childFrameId = 'CAF4634127666E186C9C8B35627DBF0B';

describe('Metrics: CLS', () => {
  const context = {
    computedCache: new Map(),
  };

  describe('real traces', () => {
    it('calculates (all main frame) CLS for a trace', async () => {
      const result = await CumulativeLayoutShift.request(jumpyClsTrace, context);
      expect(result).toEqual({
        cumulativeLayoutShift: expect.toBeApproximately(2.268816, 6),
        cumulativeLayoutShiftMainFrame: expect.toBeApproximately(2.268816, 6),
        totalCumulativeLayoutShift: expect.toBeApproximately(4.809794, 6),
      });
    });

    it('throws if layout shift events are found without weighted_score_delta', async () => {
      expect(_ => CumulativeLayoutShift.request(oldMetricsTrace, context)).rejects
          .toThrow('CLS missing weighted_score_delta');
    });

    it('calculates CLS values for a trace with CLS events over more than one frame', async () => {
      const result = await CumulativeLayoutShift.request(allFramesMetricsTrace, context);
      expect(result).toEqual({
        cumulativeLayoutShift: 0.026463014612806653,
        cumulativeLayoutShiftMainFrame: 0.0011656245471340055,
        totalCumulativeLayoutShift: 0.0011656245471340055,
      });
    });

    it('returns 0 for a trace with no CLS events', async () => {
      const result = await CumulativeLayoutShift.request(preClsTrace, context);
      expect(result).toEqual({
        cumulativeLayoutShift: 0,
        cumulativeLayoutShiftMainFrame: 0,
        totalCumulativeLayoutShift: 0,
      });
    });
  });

  describe('constructed traces', () => {
    /**
     * @param {Array<{score: number, ts: number, had_recent_input?: boolean, is_main_frame?: boolean, weighted_score_delta?: number}>} shiftEventsData
     */
    function makeTrace(shiftEventsData) {
      // If there are non-is_main_frame events, create a child frame in trace to add those events to.
      const needsChildFrame = shiftEventsData.some(e => e.is_main_frame === false);
      const childFrames = needsChildFrame ? [{frame: childFrameId}] : [];

      const trace = createTestTrace({traceEnd: 30_000, childFrames});
      const navigationStartEvt = trace.traceEvents.find(e => e.name === 'navigationStart');
      const mainFrameId = navigationStartEvt.args.frame;

      let mainCumulativeScore = 0;
      let childCumulativeScore = 0;

      /* eslint-disable camelcase */
      const shiftEvents = shiftEventsData.map(data => {
        const {
          score,
          ts,
          had_recent_input = false,
          is_main_frame = true,
          weighted_score_delta = score,
        } = data;

        if (!had_recent_input) {
          if (is_main_frame) mainCumulativeScore += score;
          else childCumulativeScore += score;
        }

        return {
          name: 'LayoutShift',
          cat: 'loading',
          ph: 'I',
          pid: 1111,
          tid: 222,
          ts: ts,
          args: {
            frame: is_main_frame ? mainFrameId : childFrameId,
            data: {
              is_main_frame,
              had_recent_input,
              score,
              cumulative_score: is_main_frame ? mainCumulativeScore : childCumulativeScore,
              weighted_score_delta,
            },
          },
        };
      });
      /* eslint-enable camelcase */

      trace.traceEvents.push(...shiftEvents);
      return trace;
    }

    describe('single frame traces', () => {
      it('should count initial shift events even if input is true', async () => {
        const context = {computedCache: new Map()};
        const trace = makeTrace([
          {score: 1, ts: 1, had_recent_input: true},
          {score: 1, ts: 2, had_recent_input: true},
          {score: 1, ts: 3, had_recent_input: false},
          {score: 1, ts: 4, had_recent_input: false},
        ]);
        const result = await CumulativeLayoutShift.request(trace, context);
        expect(result).toEqual({
          cumulativeLayoutShift: 4,
          cumulativeLayoutShiftMainFrame: 4,
          totalCumulativeLayoutShift: 4,
        });
      });

      it('should not count later shift events if input it true', async () => {
        const context = {computedCache: new Map()};
        const trace = makeTrace([
          {score: 1, ts: 1, had_recent_input: true},
          {score: 1, ts: 2, had_recent_input: false},
          {score: 1, ts: 3, had_recent_input: false},
          {score: 1, ts: 4, had_recent_input: true},
          {score: 1, ts: 5, had_recent_input: true},
        ]);
        const result = await CumulativeLayoutShift.request(trace, context);
        expect(result).toEqual({
          cumulativeLayoutShift: 3,
          cumulativeLayoutShiftMainFrame: 3,
          totalCumulativeLayoutShift: 3,
        });
      });

      it('calculates from a uniform distribution of layout shift events', async () => {
        const shiftEvents = [];
        for (let i = 0; i < 30; i++) {
          shiftEvents.push({
            score: 0.125,
            ts: (i + 0.5) * 1_000_000,
          });
        }
        const trace = makeTrace(shiftEvents);

        const result = await CumulativeLayoutShift.request(trace, context);
        expect(result).toEqual({
          cumulativeLayoutShift: 0.75,
          cumulativeLayoutShiftMainFrame: 0.75,
          totalCumulativeLayoutShift: 3.75, // 30 * 0.125
        });
      });

      it('calculates from three clusters of layout shift events', async () => {
        const shiftEvents = [
          {score: 0.0625, ts: 1_000_000},
          {score: 0.2500, ts: 1_200_000},
          {score: 0.0625, ts: 1_250_000}, // Still in 300ms sliding window.
          {score: 0.1250, ts: 2_200_000}, // Sliding windows excluding most of cluster.

          {score: 0.0625, ts: 3_000_000}, // 1.8s gap > 1s but < 5s.
          {score: 0.2500, ts: 3_400_000},
          {score: 0.2500, ts: 4_000_000},

          {score: 0.1250, ts: 10_000_000}, // > 5s gap
          {score: 0.1250, ts: 10_400_000},
          {score: 0.0625, ts: 10_680_000},
        ];
        const trace = makeTrace(shiftEvents);

        const result = await CumulativeLayoutShift.request(trace, context);
        expect(result).toEqual({
          cumulativeLayoutShift: 1.0625,
          cumulativeLayoutShiftMainFrame: 1.0625,
          totalCumulativeLayoutShift: 1.375,
        });
      });

      it('calculates the same LS score from a tiny extra small cluster of events', async () => {
        const shiftEvents = [];
        for (let i = 0; i < 30; i++) {
          shiftEvents.push({
            score: 0.125,
            ts: 1_000_000 + i * 10_000,
          });
        }
        const trace = makeTrace(shiftEvents);

        const result = await CumulativeLayoutShift.request(trace, context);
        expect(result).toEqual({
          cumulativeLayoutShift: 3.75, // 30 * 0.125
          cumulativeLayoutShiftMainFrame: 3.75,
          totalCumulativeLayoutShift: 3.75,
        });
      });

      it('includes events with recent input at start of trace, but ignores others', async () => {
        const shiftEvents = [
          {score: 1, ts: 250_000, had_recent_input: true},
          {score: 1, ts: 500_000, had_recent_input: true},
          {score: 1, ts: 750_000, had_recent_input: true},
          {score: 1, ts: 1_000_000, had_recent_input: true}, // These first four events will still be counted.

          {score: 1, ts: 1_250_000, had_recent_input: false},

          {score: 1, ts: 1_500_000, had_recent_input: true}, // The last four will not.
          {score: 1, ts: 1_750_000, had_recent_input: true},
          {score: 1, ts: 2_000_000, had_recent_input: true},
          {score: 1, ts: 2_250_000, had_recent_input: true},
        ];
        const trace = makeTrace(shiftEvents);

        const result = await CumulativeLayoutShift.request(trace, context);
        expect(result).toEqual({
          cumulativeLayoutShift: 5,
          cumulativeLayoutShiftMainFrame: 5,
          totalCumulativeLayoutShift: 5,
        });
      });
    });

    describe('multi-frame traces', () => {
      it('calculates layout shift events uniformly distributed across two frames', async () => {
        const shiftEvents = [];
        for (let i = 0; i < 30; i++) {
          shiftEvents.push({
            score: 0.125,
            ts: (i + 0.5) * 1_000_000,
            is_main_frame: Boolean(i % 2),
          });
        }
        const trace = makeTrace(shiftEvents);

        const result = await CumulativeLayoutShift.request(trace, context);
        expect(result).toEqual({
          cumulativeLayoutShift: 0.75, // Same value as single-frame uniformly distributed.
          cumulativeLayoutShiftMainFrame: 0.125, // All 1s gaps, so only one event per cluster.
          totalCumulativeLayoutShift: 1.875, // 0.125 * 15
        });
      });

      it('includes events with recent input at start of trace, but ignores others', async () => {
        const shiftEvents = [
          {score: 1, ts: 250_000, had_recent_input: true},
          {score: 1, ts: 750_000, had_recent_input: true}, // These first two events will still be counted.

          {score: 1, ts: 1_250_000, had_recent_input: false},

          {score: 1, ts: 1_750_000, had_recent_input: true}, // The last two will not.
          {score: 1, ts: 2_000_000, had_recent_input: true},

          // Child frame
          {score: 1, ts: 500_000, had_recent_input: true, is_main_frame: false},
          {score: 1, ts: 1_000_000, had_recent_input: true, is_main_frame: false}, // These first two events will still be counted.

          {score: 1, ts: 1_250_000, had_recent_input: false, is_main_frame: false},

          {score: 1, ts: 1_500_000, had_recent_input: true, is_main_frame: false}, // The last two will not.
          {score: 1, ts: 2_250_000, had_recent_input: true, is_main_frame: false},
        ];
        const trace = makeTrace(shiftEvents);

        const result = await CumulativeLayoutShift.request(trace, context);
        expect(result).toMatchObject({
          cumulativeLayoutShift: 6,
          cumulativeLayoutShiftMainFrame: 3,
          totalCumulativeLayoutShift: 3,
        });
      });

      it('uses layout shift score weighted by frame size', async () => {
        const shiftEvents = [
          {score: 2, weighted_score_delta: 2, ts: 250_000, is_main_frame: true},
          {score: 2, weighted_score_delta: 1, ts: 500_000, is_main_frame: false},
          {score: 2, weighted_score_delta: 1, ts: 750_000, is_main_frame: false},
        ];
        const trace = makeTrace(shiftEvents);

        const result = await CumulativeLayoutShift.request(trace, context);
        expect(result).toMatchObject({
          cumulativeLayoutShift: 4,
          cumulativeLayoutShiftMainFrame: 2,
          totalCumulativeLayoutShift: 2,
        });
      });

      it('ignores layout shift data from other tabs', async () => {
        const trace = createTestTrace({timeOrigin: 0, traceEnd: 2000});
        const mainFrame = trace.traceEvents.find(e => e.name === 'navigationStart').args.frame;
        const childFrame = 'CHILDFRAME';
        const otherMainFrame = 'ANOTHERTABOPEN';
        const cat = 'loading,rail,devtools.timeline';
        trace.traceEvents.push(
          /* eslint-disable max-len */
          {name: 'FrameCommittedInBrowser', cat, args: {data: {frame: childFrame, parent: mainFrame, url: 'https://frame.com'}}},
          {name: 'FrameCommittedInBrowser', cat, args: {data: {frame: otherMainFrame, url: 'https://example.com'}}},
          {name: 'LayoutShift', cat, args: {frame: mainFrame, data: {had_recent_input: false, score: 1, weighted_score_delta: 1, is_main_frame: true}}},
          {name: 'LayoutShift', cat, args: {frame: childFrame, data: {had_recent_input: false, score: 1, weighted_score_delta: 1, is_main_frame: false}}},
          {name: 'LayoutShift', cat, args: {frame: childFrame, data: {had_recent_input: false, score: 1, weighted_score_delta: 1, is_main_frame: false}}},
          // Following two not used because of `had_recent_input: true`.
          {name: 'LayoutShift', cat, args: {frame: mainFrame, data: {had_recent_input: true, score: 1, weighted_score_delta: 1, is_main_frame: true}}},
          {name: 'LayoutShift', cat, args: {frame: childFrame, data: {had_recent_input: true, score: 1, weighted_score_delta: 1, is_main_frame: false}}},
          // Following two not used because part of another frame tree.
          {name: 'LayoutShift', cat, args: {frame: otherMainFrame, data: {had_recent_input: false, score: 1, weighted_score_delta: 1, is_main_frame: true}}},
          {name: 'LayoutShift', cat, args: {frame: otherMainFrame, data: {had_recent_input: false, score: 1, weighted_score_delta: 1, is_main_frame: true}}}
          /* eslint-enable max-len */
        );
        const result = await CumulativeLayoutShift.request(trace, context);
        expect(result).toMatchObject({
          cumulativeLayoutShift: 3,
          cumulativeLayoutShiftMainFrame: 1,
          totalCumulativeLayoutShift: 1,
        });
      });
    });

    describe('layout shift session/cluster bounds', () => {
      it('counts gaps > 1s and limits cluster length to <= 5s (only main frame)', async () => {
        const shiftEvents = [
          {score: 1, ts: 1_000_000},
          {score: 1, ts: 2_000_000}, // All of these included since exactly 1s after the last.
          {score: 1, ts: 3_000_000},
          {score: 1, ts: 4_000_000},
          {score: 1, ts: 5_000_000},
          {score: 1, ts: 6_000_000}, // Included since exactly 5s after beginning of cluster.
        ];
        const trace = makeTrace(shiftEvents);
        const result = await CumulativeLayoutShift.request(trace, context);
        expect(result).toMatchObject({
          cumulativeLayoutShift: 6,
          cumulativeLayoutShiftMainFrame: 6,
          totalCumulativeLayoutShift: 6,
        });
      });

      it('counts gaps > 1s and limits cluster length to <= 5s (multiple frames)', async () => {
        const shiftEvents = [
          {score: 1, ts: 1_000_000},
          {score: 1, ts: 2_000_000, is_main_frame: false}, // All of these included since exactly 1s after the last.
          {score: 1, ts: 3_000_000},
          {score: 1, ts: 4_000_000, is_main_frame: false},
          {score: 1, ts: 5_000_000},
          {score: 1, ts: 6_000_000, is_main_frame: false}, // Included since exactly 5s after beginning of cluster.
          {score: 1, ts: 6_000_001}, // Not included since >5s after beginning of cluster.
        ];
        const trace = makeTrace(shiftEvents);
        const result = await CumulativeLayoutShift.request(trace, context);
        expect(result).toMatchObject({
          cumulativeLayoutShift: 6,
          cumulativeLayoutShiftMainFrame: 1,
          totalCumulativeLayoutShift: 4,
        });
      });

      it('only counts gaps > 1s', async () => {
        const shiftEvents = [
          {score: 1, ts: 1_000_000},
          {score: 1, ts: 2_000_000}, // Included since exactly 1s later.
        ];
        const trace = makeTrace(shiftEvents);
        const result = await CumulativeLayoutShift.request(trace, context);
        expect(result).toMatchObject({
          cumulativeLayoutShift: 2,
          cumulativeLayoutShiftMainFrame: 2,
          totalCumulativeLayoutShift: 2,
        });
      });

      it('only counts gaps > 1s (multiple frames)', async () => {
        const shiftEvents = [
          {score: 1, ts: 1_000_000},
          {score: 1, ts: 2_000_000, is_main_frame: false}, // Included since exactly 1s later.
        ];
        const trace = makeTrace(shiftEvents);
        const result = await CumulativeLayoutShift.request(trace, context);
        expect(result).toMatchObject({
          cumulativeLayoutShift: 2,
          cumulativeLayoutShiftMainFrame: 1,
          totalCumulativeLayoutShift: 1,
        });
      });
    });
  });
});
