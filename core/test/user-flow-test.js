/**
 * @license Copyright 2021 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import jestMock from 'jest-mock';
import * as td from 'testdouble';

import {Runner} from '../runner.js';
import {createMockPage, mockRunnerModule} from './gather/mock-driver.js';
// import UserFlow from '../../user-flow.js';

// Some imports needs to be done dynamically, so that their dependencies will be mocked.
// See: https://jestjs.io/docs/ecmascript-modules#differences-between-esm-and-commonjs
//      https://github.com/facebook/jest/issues/10025
/** @type {typeof import('../user-flow.js').UserFlow} */
let UserFlow;
/** @type {typeof import('../user-flow.js')['auditGatherSteps']} */
let auditGatherSteps;

before(async () => {
  ({UserFlow, auditGatherSteps} = await import('../user-flow.js'));
});

const snapshotModule = {snapshotGather: jestMock.fn()};
await td.replaceEsm('../gather/snapshot-runner.js', snapshotModule);
const navigationModule = {navigationGather: jestMock.fn()};
await td.replaceEsm('../gather/navigation-runner.js', navigationModule);
const timespanModule = {startTimespanGather: jestMock.fn()};
await td.replaceEsm('../gather/timespan-runner.js', timespanModule);

const mockRunner = await mockRunnerModule();

describe('UserFlow', () => {
  let mockPage = createMockPage();

  beforeEach(() => {
    mockPage = createMockPage();

    mockRunner.reset();

    snapshotModule.snapshotGather.mockReset();
    snapshotModule.snapshotGather.mockResolvedValue({
      artifacts: {
        URL: {finalDisplayedUrl: 'https://www.example.com'},
        GatherContext: {gatherMode: 'snapshot'},
      },
      runnerOptions: {
        config: {},
        computedCache: new Map(),
      },
    });

    navigationModule.navigationGather.mockReset();
    navigationModule.navigationGather.mockResolvedValue({
      artifacts: {
        URL: {finalDisplayedUrl: 'https://www.example.com'},
        GatherContext: {gatherMode: 'navigation'},
      },
      runnerOptions: {
        config: {},
        computedCache: new Map(),
      },
    });

    const timespanGatherResult = {
      artifacts: {
        URL: {finalDisplayedUrl: 'https://www.example.com'},
        GatherContext: {gatherMode: 'timespan'},
      },
      runnerOptions: {
        config: {},
        computedCache: new Map(),
      },
    };
    const timespan = {endTimespanGather: jestMock.fn().mockResolvedValue(timespanGatherResult)};
    timespanModule.startTimespanGather.mockReset();
    timespanModule.startTimespanGather.mockResolvedValue(timespan);
  });

  describe('.navigate()', () => {
    it('should throw if a timespan is active', async () => {
      const flow = new UserFlow(mockPage.asPage());
      await flow.startTimespan();
      await expect(flow.navigate('https://example.com')).rejects.toBeTruthy();
    });

    it('should invoke navigation runner', async () => {
      const flow = new UserFlow(mockPage.asPage());

      await flow.navigate('https://example.com/1', {name: 'My Step'});

      const flags = {maxWaitForLoad: 1000};
      await flow.navigate('https://example.com/2', flags);

      await flow.navigate('https://example.com/3');

      expect(navigationModule.navigationGather).toHaveBeenCalledTimes(3);
      expect(flow._gatherSteps).toMatchObject([
        {stepFlags: {name: 'My Step'}},
        {stepFlags: {maxWaitForLoad: 1000, skipAboutBlank: true, disableStorageReset: true}},
        {stepFlags: {skipAboutBlank: true, disableStorageReset: true}},
      ]);
    });

    it('should disable storage reset on subsequent navigations', async () => {
      const flow = new UserFlow(mockPage.asPage());
      await flow.navigate('https://example.com/1');

      // Try once when we have some other settings.
      const flags = {maxWaitForLoad: 1000};
      await flow.navigate('https://example.com/2', flags);

      // Try once when we don't have any other settings.
      await flow.navigate('https://example.com/3');

      // Try once when we explicitly set it.
      const flagsExplicit = {disableStorageReset: false};
      await flow.navigate('https://example.com/4', flagsExplicit);

      // Check that we have the property set.
      expect(navigationModule.navigationGather).toHaveBeenCalledTimes(4);
      /** @type {any[][]} */
      const [[,, call1], [,, call2], [,, call3], [,, call4]] =
        navigationModule.navigationGather.mock.calls;
      expect(call1).not.toHaveProperty('flags.disableStorageReset');
      expect(call2).toHaveProperty('flags.disableStorageReset');
      expect(call3).toHaveProperty('flags.disableStorageReset');
      expect(call4).toHaveProperty('flags.disableStorageReset');
      expect(call2.flags.disableStorageReset).toBe(true);
      expect(call3.flags.disableStorageReset).toBe(true);
      expect(call4.flags.disableStorageReset).toBe(false);

      // Check that we didn't mutate the original objects.
      expect(flags).toEqual({maxWaitForLoad: 1000});
      expect(flagsExplicit).toEqual({disableStorageReset: false});
    });

    it('should disable about:blank jumps by default', async () => {
      const flow = new UserFlow(mockPage.asPage());
      await flow.navigate('https://example.com/1');

      // Try once when we have some other settings.
      const flags = {maxWaitForLoad: 1000};
      await flow.navigate('https://example.com/2', flags);

      // Try once when we explicitly set it.
      const flagsExplicit = {skipAboutBlank: false};
      await flow.navigate('https://example.com/3', flagsExplicit);

      // Check that we have the property set.
      expect(navigationModule.navigationGather).toHaveBeenCalledTimes(3);
      /** @type {any[][]} */
      const [[,, call1], [,, call2], [,, call3]] = navigationModule.navigationGather.mock.calls;
      expect(call1).toHaveProperty('flags.skipAboutBlank');
      expect(call2).toHaveProperty('flags.skipAboutBlank');
      expect(call3).toHaveProperty('flags.skipAboutBlank');
      expect(call1.flags.skipAboutBlank).toBe(true);
      expect(call2.flags.skipAboutBlank).toBe(true);
      expect(call3.flags.skipAboutBlank).toBe(false);

      // Check that we didn't mutate the original objects.
      expect(flags).toEqual({maxWaitForLoad: 1000});
      expect(flagsExplicit).toEqual({skipAboutBlank: false});
    });
  });

  describe('.startNavigation()', () => {
    it('should only run navigation setup', async () => {
      let setupDone = false;
      let teardownDone = false;
      navigationModule.navigationGather.mockImplementation(async (_, cb) => {
        setupDone = true;
        // @ts-expect-error
        await cb();
        teardownDone = true;
      });
      const flow = new UserFlow(mockPage.asPage());
      await flow.startNavigation();
      expect(setupDone).toBeTruthy();
      expect(teardownDone).toBeFalsy();
    });

    it('should throw errors from the setup phase', async () => {
      navigationModule.navigationGather.mockRejectedValue(new Error('Setup Error'));
      const flow = new UserFlow(mockPage.asPage());
      const startPromise = flow.startNavigation();
      await expect(startPromise).rejects.toThrowError('Setup Error');
    });
  });

  describe('.endNavigation()', () => {
    it('should throw if a timespan is active', async () => {
      const flow = new UserFlow(mockPage.asPage());
      await flow.startTimespan();
      await expect(flow.startNavigation()).rejects.toThrowError('Timespan already in progress');
    });

    it('should throw if a navigation is not active', async () => {
      const flow = new UserFlow(mockPage.asPage());
      await expect(flow.endNavigation()).rejects.toThrowError('No navigation in progress');
    });

    it('should throw errors from the teardown phase', async () => {
      navigationModule.navigationGather.mockImplementation(async (_, cb) => {
        // @ts-expect-error
        await cb();
        throw new Error('Teardown Error');
      });
      const flow = new UserFlow(mockPage.asPage());

      // Should not throw the error here.
      await flow.startNavigation();

      const teardownPromise = flow.endNavigation();
      await expect(teardownPromise).rejects.toThrowError('Teardown Error');
    });
  });

  describe('.startTimespan()', () => {
    it('should throw if a timespan is active', async () => {
      const flow = new UserFlow(mockPage.asPage());
      await flow.startTimespan();
      await expect(flow.startTimespan()).rejects.toBeTruthy();
    });

    it('should invoke timespan runner', async () => {
      const flow = new UserFlow(mockPage.asPage());

      await flow.startTimespan({name: 'My Timespan'});
      await flow.endTimespan();

      await flow.startTimespan();
      await flow.endTimespan();

      expect(timespanModule.startTimespanGather).toHaveBeenCalledTimes(2);
      expect(flow._gatherSteps).toMatchObject([
        {stepFlags: {name: 'My Timespan'}},
        {stepFlags: undefined},
      ]);
    });
  });

  describe('.endTimespan()', () => {
    it('should throw if a timespan has not started', async () => {
      const flow = new UserFlow(mockPage.asPage());
      await expect(flow.endTimespan()).rejects.toBeTruthy();
    });
  });

  describe('.snapshot()', () => {
    it('should throw if a timespan is active', async () => {
      const flow = new UserFlow(mockPage.asPage());
      await flow.startTimespan();
      await expect(flow.snapshot()).rejects.toBeTruthy();
    });

    it('should invoke snapshot runner', async () => {
      const flow = new UserFlow(mockPage.asPage());

      await flow.snapshot({name: 'My Snapshot'});
      await flow.snapshot();

      expect(snapshotModule.snapshotGather).toHaveBeenCalledTimes(2);
      expect(flow._gatherSteps).toMatchObject([
        {stepFlags: {name: 'My Snapshot'}},
        {stepFlags: undefined},
      ]);
    });
  });

  describe('.getFlowResult', () => {
    it('should throw if no flow steps have been run', async () => {
      const flow = new UserFlow(mockPage.asPage());
      const flowResultPromise = flow.createFlowResult();
      await expect(flowResultPromise).rejects.toThrow(/Need at least one step/);
    });

    it('should audit active gather steps', async () => {
      mockRunner.audit.mockImplementation(artifacts => ({
        lhr: {
          finalDisplayedUrl: artifacts.URL.finalDisplayedUrl,
          gatherMode: artifacts.GatherContext.gatherMode,
        },
      }));
      const flow = new UserFlow(mockPage.asPage());

      await flow.navigate('https://www.example.com/');
      await flow.startTimespan({name: 'My Timespan'});
      await flow.endTimespan();
      await flow.snapshot({name: 'My Snapshot'});

      const flowResult = await flow.createFlowResult();
      expect(flowResult).toMatchObject({
        steps: [
          {
            lhr: {finalDisplayedUrl: 'https://www.example.com', gatherMode: 'navigation'},
            name: 'Navigation report (www.example.com/)',
          },
          {
            lhr: {finalDisplayedUrl: 'https://www.example.com', gatherMode: 'timespan'},
            name: 'My Timespan',
          },
          {
            lhr: {finalDisplayedUrl: 'https://www.example.com', gatherMode: 'snapshot'},
            name: 'My Snapshot',
          },
        ],
        name: 'User flow (www.example.com)',
      });
    });
  });

  describe('auditGatherSteps', () => {
    it('should audit gather steps', async () => {
      mockRunner.getGathererList.mockImplementation(Runner.getGathererList);
      mockRunner.getAuditList.mockImplementation(Runner.getAuditList);
      mockRunner.audit.mockImplementation(artifacts => ({
        lhr: {
          finalDisplayedUrl: artifacts.URL.finalDisplayedUrl,
          gatherMode: artifacts.GatherContext.gatherMode,
        },
      }));

      /** @type {LH.Config.Json} */
      const flowConfig = {
        extends: 'lighthouse:default',
        settings: {
          skipAudits: ['uses-http2'],
        },
      };

      /** @type {LH.UserFlow.GatherStep[]} */
      const gatherSteps = [
        {
          stepFlags: {name: 'Navigation'},
          // @ts-expect-error Only these artifacts are used by the test.
          artifacts: {
            URL: {
              requestedUrl: 'https://www.example.com',
              mainDocumentUrl: 'https://www.example.com',
              finalDisplayedUrl: 'https://www.example.com',
            },
            GatherContext: {gatherMode: 'navigation'},
          },
        },
        {
          stepFlags: {name: 'Timespan', onlyCategories: ['performance']},
          // @ts-expect-error Only these artifacts are used by the test.
          artifacts: {
            URL: {
              finalDisplayedUrl: 'https://www.example.com',
            },
            GatherContext: {gatherMode: 'timespan'},
          },
        },
        {
          stepFlags: {name: 'Snapshot', onlyCategories: ['accessibility']},
          // @ts-expect-error Only these artifacts are used by the test.
          artifacts: {
            URL: {
              finalDisplayedUrl: 'https://www.example.com',
            },
            GatherContext: {gatherMode: 'snapshot'},
          },
        },
      ];

      const flowResult = await auditGatherSteps(gatherSteps, {config: flowConfig});

      // @ts-expect-error toMatchObject is giving a loud annoying error...
      // Not sure why.
      //     Index signature for type 'string' is missing
      //     in type '(Artifacts | { config: { settings: { skipAudits: string[]; }; }; })[]'
      expect(mockRunner.audit.mock.calls).toMatchObject([
        [
          gatherSteps[0].artifacts,
          {
            config: {
              settings: {
                skipAudits: ['uses-http2'],
              },
            },
          },
        ],
        [
          gatherSteps[1].artifacts,
          {
            config: {
              settings: {
                onlyCategories: ['performance'],
              },
            },
          },
        ],
        [
          gatherSteps[2].artifacts,
          {
            config: {
              settings: {
                onlyCategories: ['accessibility'],
              },
            },
          },
        ],
      ]);

      expect(flowResult).toMatchObject({
        steps: [
          {
            lhr: {finalDisplayedUrl: 'https://www.example.com', gatherMode: 'navigation'},
            name: 'Navigation',
          },
          {
            lhr: {finalDisplayedUrl: 'https://www.example.com', gatherMode: 'timespan'},
            name: 'Timespan',
          },
          {
            lhr: {finalDisplayedUrl: 'https://www.example.com', gatherMode: 'snapshot'},
            name: 'Snapshot',
          },
        ],
        name: 'User flow (www.example.com)',
      });
    });
  });
});

