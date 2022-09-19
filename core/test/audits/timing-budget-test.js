/**
 * @license Copyright 2019 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import TimingBudgetAudit from '../../audits/timing-budget.js';
import {getURLArtifactFromDevtoolsLog, readJson} from '../test-utils.js';

const trace = readJson('../fixtures/traces/progressive-app-m60.json', import.meta);
const devtoolsLog = readJson('../fixtures/traces/progressive-app-m60.devtools.log.json', import.meta);
const lcpTrace = readJson('../fixtures/traces/lcp-m78.json', import.meta);
const lcpDevtoolsLog = readJson('../fixtures/traces/lcp-m78.devtools.log.json', import.meta);

describe('Performance: Timing budget audit', () => {
  let artifacts;
  let context;
  beforeEach(() => {
    artifacts = {
      GatherContext: {gatherMode: 'navigation'},
      devtoolsLogs: {
        defaultPass: devtoolsLog,
      },
      traces: {defaultPass: trace},
      URL: getURLArtifactFromDevtoolsLog(devtoolsLog),
    };

    context = {
      computedCache: new Map(),
      settings: {
        throttlingMethod: 'devtools',
      },
    };
  });

  describe('with a budget.json', () => {
    beforeEach(() => {
      context.settings.budgets = [{
        path: '/',
        timings: [
          {
            metric: 'first-contentful-paint',
            budget: 9999,
          },
          {
            metric: 'speed-index',
            budget: 1,
          },
          {
            metric: 'cumulative-layout-shift',
            budget: 0.1,
          },
        ],
      }];
    });

    it('table headers are correct', async () => {
      const result = await TimingBudgetAudit.audit(artifacts, context);
      const headers = result.details.headings;
      expect(headers[0].label).toBeDisplayString('Metric');
      expect(headers[1].label).toBeDisplayString('Measurement');
      expect(headers[2].label).toBeDisplayString('Over Budget');
    });

    it('table item info is correct', async () => {
      const result = await TimingBudgetAudit.audit(artifacts, context);
      const items = result.details.items;
      // Failing Budget
      expect(items[0].label).toBeDisplayString('Speed Index');
      expect(items[0].measurement).toBeCloseTo(605);
      expect(items[0].overBudget).toBeCloseTo(604);
    });

    it('calculates the "overBudget" column correctly', async () => {
      const result = await TimingBudgetAudit.audit(artifacts, context);

      // Failing Budget
      expect(result.details.items[0].overBudget).toBeCloseTo(604);

      // Passing Budget
      expect(result.details.items[1].overBudget).toBeUndefined();
      expect(result.details.items[2].overBudget).toBeUndefined();
    });

    it('only includes rows for timing metrics with budgets', async () => {
      const result = await TimingBudgetAudit.audit(artifacts, context);
      expect(result.details.items).toHaveLength(3);
    });

    describe('timings metrics', () => {
      it('work for all supported timing metrics', async () => {
        const metrics = [
          'first-contentful-paint',
          'interactive',
          'first-meaningful-paint',
          'max-potential-fid',
          'total-blocking-time',
          'speed-index',
          'largest-contentful-paint',
          'cumulative-layout-shift',
        ];
        for (const metric of metrics) {
          context.settings.budgets = [{
            path: '/',
            timings: [
              {
                metric: metric,
                budget: 100,
              },
            ],
          }];
          const result = await TimingBudgetAudit.audit(artifacts, context);
          expect(result.details.items[0].label).toBeDefined();
          if (metric === 'largest-contentful-paint') {
            expect(result.details.items[0].measurement).toEqual(undefined);
          } else if (metric === 'cumulative-layout-shift') {
            expect(result.details.items[0].measurement.value).toEqual(0);
          } else {
            expect(result.details.items[0].measurement).toBeGreaterThanOrEqual(1);
          }
        }
      });

      // Supplements test above. Uses a trace with a defined LCP for better test coverage.
      it('supports Largest Contentful Paint', async () => {
        artifacts.devtoolsLogs.defaultPass = lcpDevtoolsLog;
        artifacts.traces.defaultPass = lcpTrace;
        artifacts.URL = getURLArtifactFromDevtoolsLog(lcpDevtoolsLog);

        // Use an observed throttlingMethod so we don't have to worry about the value changing in the future.
        context.settings.throttlingMethod = 'provided';
        context.settings.budgets = [{
          path: '/',
          timings: [
            {
              metric: 'largest-contentful-paint',
              budget: 100,
            },
          ],
        }];
        const result = await TimingBudgetAudit.audit(artifacts, context);
        expect(result.details.items).toHaveLength(1);
        expect(result.details.items[0].measurement).toEqual(1121.711);
      });
    });

    it('sorts rows by descending budget overage', async () => {
      context.settings.budgets = [{
        path: '/',
        timings: [
          {
            metric: 'first-contentful-paint',
            budget: 0,
          },
          {
            metric: 'interactive',
            budget: 0,
          },
          {
            metric: 'speed-index',
            budget: 0,
          },
        ],
      }];
      const result = await TimingBudgetAudit.audit(artifacts, context);
      const items = result.details.items;
      items.slice(0, -1).forEach((item, index) => {
        expect(item.overBudget).toBeGreaterThanOrEqual(items[index + 1].overBudget);
      });
    });
  });

  describe('budget selection', () => {
    describe('with a matching budget', () => {
      it('applies the correct budget', async () => {
        context.settings.budgets = [{
          path: '/',
          timings: [
            {
              metric: 'interactive',
              budget: 0,
            },
          ],
        },
        {
          path: '/',
          timings: [
            {
              metric: 'first-contentful-paint',
              budget: 0,
            },
          ],
        },
        {
          path: '/not-a-match',
          timings: [
            {
              resourceType: 'cumulative-layout-shift',
              budget: 0,
            },
          ],
        },
        ];
        const result = await TimingBudgetAudit.audit(artifacts, context);
        expect(result.details.items[0].metric).toBe('first-contentful-paint');
      });
    });

    describe('without a matching budget', () => {
      it('returns "audit does not apply"', async () => {
        context.settings.budgets = [{
          path: '/not-a-match',
          timings: [
            {
              metric: 'speed-index',
              budget: 1000,
            },
          ],
        },
        ];
        const result = await TimingBudgetAudit.audit(artifacts, context);
        expect(result.details).toBeUndefined();
        expect(result.notApplicable).toBe(true);
      });
    });

    describe('without a budget.json', () => {
      beforeEach(() => {
        context.settings.budgets = null;
      });

      it('returns "audit does not apply"', async () => {
        const result = await TimingBudgetAudit.audit(artifacts, context);
        expect(result.details).toBeUndefined();
        expect(result.notApplicable).toBe(true);
      });
    });
  });
});
