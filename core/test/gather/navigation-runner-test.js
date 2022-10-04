/**
 * @license Copyright 2021 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import jestMock from 'jest-mock';

import {
  createMockDriver,
  createMockBaseArtifacts,
  mockDriverSubmodules,
  mockRunnerModule,
} from './mock-driver.js';
import {initializeConfig} from '../../config/config.js';
import {defaultNavigationConfig} from '../../config/constants.js';
import {LighthouseError} from '../../lib/lh-error.js';
import DevtoolsLogGatherer from '../../gather/gatherers/devtools-log.js';
import TraceGatherer from '../../gather/gatherers/trace.js';
import {fnAny} from '../test-utils.js';
import {networkRecordsToDevtoolsLog} from '../network-records-to-devtools-log.js';
import {Runner as runnerActual} from '../../runner.js';

// Some imports needs to be done dynamically, so that their dependencies will be mocked.
// See: https://jestjs.io/docs/ecmascript-modules#differences-between-esm-and-commonjs
//      https://github.com/facebook/jest/issues/10025
/** @type {import('../../gather/navigation-runner.js')} */
let runner;

const mocks = await mockDriverSubmodules();
const mockRunner = await mockRunnerModule();
beforeEach(async () => {
  mockRunner.reset();
  mockRunner.getGathererList.mockImplementation(runnerActual.getGathererList);
  mockRunner.getAuditList.mockImplementation(runnerActual.getAuditList);
  runner = (await import('../../gather/navigation-runner.js'));
});

/** @typedef {{meta: LH.Gatherer.GathererMeta<'Accessibility'>, getArtifact: Mock<any, any>, startInstrumentation: Mock<any, any>, stopInstrumentation: Mock<any, any>, startSensitiveInstrumentation: Mock<any, any>, stopSensitiveInstrumentation:  Mock<any, any>}} MockGatherer */

describe('NavigationRunner', () => {
  let requestedUrl = '';
  /** @type {LH.NavigationRequestor} */
  let requestor;
  /** @type {ReturnType<typeof createMockDriver>} */
  let mockDriver;
  /** @type {import('../../gather/driver.js').Driver} */
  let driver;
  /** @type {LH.Puppeteer.Page} */
  let page;
  /** @type {LH.Config.FRConfig} */
  let config;
  /** @type {LH.Config.NavigationDefn} */
  let navigation;
  /** @type {Map<string, LH.ArbitraryEqualityMap>} */
  let computedCache;
  /** @type {LH.FRBaseArtifacts} */
  let baseArtifacts;

  /** @return {LH.Config.AnyFRGathererDefn} */
  function createGathererDefn() {
    return {
      instance: {
        name: 'Accessibility',
        meta: {supportedModes: []},
        startInstrumentation: fnAny(),
        stopInstrumentation: fnAny(),
        startSensitiveInstrumentation: fnAny(),
        stopSensitiveInstrumentation: fnAny(),
        getArtifact: fnAny(),
      },
    };
  }

  /** @return {{navigation: LH.Config.NavigationDefn, gatherers: {timespan: MockGatherer, snapshot: MockGatherer, navigation: MockGatherer}}} */
  function createNavigation() {
    const timespanGatherer = createGathererDefn();
    timespanGatherer.instance.meta.supportedModes = ['timespan', 'navigation'];
    timespanGatherer.instance.getArtifact = fnAny().mockResolvedValue({type: 'timespan'});
    const snapshotGatherer = createGathererDefn();
    snapshotGatherer.instance.meta.supportedModes = ['snapshot', 'navigation'];
    snapshotGatherer.instance.getArtifact = fnAny().mockResolvedValue({type: 'snapshot'});
    const navigationGatherer = createGathererDefn();
    navigationGatherer.instance.meta.supportedModes = ['navigation'];
    navigationGatherer.instance.getArtifact = fnAny().mockResolvedValue({type: 'navigation'});

    const navigation = {
      ...defaultNavigationConfig,
      artifacts: [
        {id: 'Timespan', gatherer: timespanGatherer},
        {id: 'Snapshot', gatherer: snapshotGatherer},
        {id: 'Navigation', gatherer: navigationGatherer},
      ],
    };

    return {
      navigation,
      gatherers: {
        timespan: /** @type {any} */ (timespanGatherer.instance),
        snapshot: /** @type {any} */ (snapshotGatherer.instance),
        navigation: /** @type {any} */ (navigationGatherer.instance),
      },
    };
  }

  beforeEach(async () => {
    requestedUrl = 'http://example.com';
    requestor = requestedUrl;
    config = (await initializeConfig('navigation')).config;
    navigation = createNavigation().navigation;
    computedCache = new Map();
    baseArtifacts = createMockBaseArtifacts();
    baseArtifacts.URL = {finalDisplayedUrl: ''};

    mockDriver = createMockDriver();
    mockDriver.url
      .mockReturnValueOnce('about:blank')
      .mockImplementationOnce(() => requestedUrl);
    driver = mockDriver.asDriver();
    page = mockDriver._page.asPage();

    mocks.reset();
  });

  describe('_setup', () => {
    beforeEach(() => {
      mockDriver._session.sendCommand.mockResponse('Browser.getVersion', {
        product: 'Chrome/88.0',
        userAgent: 'Chrome',
      });
    });

    it('should connect the driver', async () => {
      await runner._setup({driver, config, requestor: requestedUrl});
      expect(mockDriver.connect).toHaveBeenCalled();
    });

    it('should navigate to the blank page if requestor is a string', async () => {
      await runner._setup({driver, config, requestor: requestedUrl});
      expect(mocks.navigationMock.gotoURL).toHaveBeenCalledTimes(1);
      expect(mocks.navigationMock.gotoURL).toHaveBeenCalledWith(
        expect.anything(),
        'about:blank',
        expect.anything()
      );
    });

    it('skip about:blank if using callback requestor', async () => {
      await runner._setup({
        driver,
        config,
        requestor: () => {},
      });
      expect(mocks.navigationMock.gotoURL).not.toHaveBeenCalled();
    });

    it('skip about:blank if config option is set to true', async () => {
      config.settings.skipAboutBlank = true;

      await runner._setup({
        driver,
        config,
        requestor: requestedUrl,
      });
      expect(mocks.navigationMock.gotoURL).not.toHaveBeenCalled();
    });

    it('should collect base artifacts', async () => {
      const {baseArtifacts} = await runner._setup({driver, config, requestor: requestedUrl});
      expect(baseArtifacts).toMatchObject({
        URL: {
          finalDisplayedUrl: '',
        },
      });
    });

    it('should prepare the target for navigation', async () => {
      await runner._setup({driver, config, requestor: requestedUrl});
      expect(mocks.prepareMock.prepareTargetForNavigationMode).toHaveBeenCalledTimes(1);
    });

    it('should prepare the target for navigation *after* base artifact collection', async () => {
      mockDriver._executionContext.evaluate.mockReset();
      mockDriver._executionContext.evaluate.mockRejectedValue(new Error('Not available'));
      const setupPromise = runner._setup({driver, config, requestor: requestedUrl});
      await expect(setupPromise).rejects.toThrowError(/Not available/);
      expect(mocks.prepareMock.prepareTargetForNavigationMode).not.toHaveBeenCalled();
    });
  });

  describe('_navigations', () => {
    const run = () =>
      runner._navigations({driver, page, config, requestor, computedCache, baseArtifacts});

    it('should throw if no navigations available', async () => {
      config = {...config, navigations: null};
      await expect(run()).rejects.toBeTruthy();
    });

    it('should navigate as many times as there are navigations', async () => {
      // initializeConfig always produces a single config navigation.
      // Artificially construct multiple navigations to test on the navigation runner.
      const originalNavigation = config.navigations?.[0];
      if (!originalNavigation) throw new Error('Should always have navigations');
      const artifactDefns = originalNavigation.artifacts.filter(a =>
        ['FontSize', 'ConsoleMessages', 'ViewportDimensions', 'AnchorElements'].includes(a.id)
      );
      const newNavigations = [];
      for (let i = 0; i < artifactDefns.length; ++i) {
        const artifactDefn = artifactDefns[i];
        newNavigations.push({
          ...originalNavigation,
          id: i ? String(i) : 'default',
          artifacts: [artifactDefn],
        });
      }

      config.navigations = newNavigations;

      await run();
      const navigations = mocks.navigationMock.gotoURL.mock.calls;
      const pageNavigations = navigations.filter(call => call[1] === requestedUrl);
      expect(pageNavigations).toHaveLength(4);
    });

    it('should backfill requested URL using a callback requestor', async () => {
      requestedUrl = 'https://backfill.example.com';
      requestor = () => {};
      config = (await initializeConfig(
        'navigation',
        {
          ...config,
          artifacts: [
            {id: 'FontSize', gatherer: 'seo/font-size'},
            {id: 'MetaElements', gatherer: 'meta-elements'},
          ],
        }
      )).config;
      mocks.navigationMock.gotoURL.mockReturnValue({
        requestedUrl,
        mainDocumentUrl: requestedUrl,
        warnings: [],
      });

      const {artifacts} = await run();
      expect(artifacts.URL).toBeUndefined();
      expect(baseArtifacts.URL).toEqual({
        requestedUrl,
        mainDocumentUrl: requestedUrl,
        finalDisplayedUrl: requestedUrl,
      });
    });

    it('should merge artifacts between navigations', async () => {
      // initializeConfig always produces a single config navigation.
      // Artificially construct multiple navigations to test on the navigation runner.
      if (!config.navigations) throw new Error('Should always have navigations');
      const firstNavigation = config.navigations[0];
      const secondNavigation = {...firstNavigation, id: 'second'};
      const fontSizeDef = firstNavigation.artifacts.find(a => a.id === 'FontSize');
      const consoleMsgDef = firstNavigation.artifacts.find(a => a.id === 'ConsoleMessages');
      if (!fontSizeDef || !consoleMsgDef) throw new Error('Artifact definitions not found');
      secondNavigation.artifacts = [fontSizeDef];
      firstNavigation.artifacts = [consoleMsgDef];
      config.navigations.push(secondNavigation);

      // Both gatherers will error in these test conditions, but artifact errors
      // will be merged into single `artifacts` object.
      const {artifacts} = await run();
      const artifactIds = Object.keys(artifacts);
      expect(artifactIds).toContain('FontSize');
      expect(artifactIds).toContain('ConsoleMessages');
    });

    it('should retain PageLoadError and associated warnings', async () => {
      config = (await initializeConfig(
        'navigation',
        {
          ...config,
          artifacts: [
            {id: 'FontSize', gatherer: 'seo/font-size'},
            {id: 'MetaElements', gatherer: 'meta-elements'},
          ],
        }
      )).config;

      // Ensure the first real page load fails.
      mocks.navigationMock.gotoURL.mockImplementation((driver, url) => {
        if (url === 'about:blank') return {finalDisplayedUrl: 'about:blank', warnings: []};
        throw new LighthouseError(LighthouseError.errors.PAGE_HUNG);
      });

      const {artifacts} = await run();

      // Validate that we stopped repeating navigations.
      const urls = mocks.navigationMock.gotoURL.mock.calls.map(call => call[1]);
      expect(urls).toEqual(['about:blank', 'http://example.com']);

      // Validate that the toplevel warning is added, finalURL is set, and error is kept.
      const artifactIds = Object.keys(artifacts).sort();
      expect(artifactIds).toEqual(['LighthouseRunWarnings', 'PageLoadError']);

      expect(artifacts.LighthouseRunWarnings).toHaveLength(1);

      expect(baseArtifacts.URL).toEqual({
        requestedUrl,
        mainDocumentUrl: requestedUrl,
        finalDisplayedUrl: requestedUrl,
      });
    });
  });

  describe('_navigation', () => {
    /** @param {LH.Config.NavigationDefn} navigation */
    const run = navigation => runner._navigation({
      driver,
      page,
      config,
      navigation,
      requestor,
      computedCache,
      baseArtifacts,
    });

    it('completes an end-to-end navigation', async () => {
      const {artifacts} = await run(navigation);
      const artifactIds = Object.keys(artifacts);
      expect(artifactIds).toContain('Timespan');
      expect(artifactIds).toContain('Snapshot');

      // Once for about:blank, once for the requested URL.
      expect(mocks.navigationMock.gotoURL).toHaveBeenCalledTimes(2);
    });

    it('skips about:blank if config option is set to true', async () => {
      config.settings.skipAboutBlank = true;

      const {artifacts} = await runner._navigation({
        driver,
        page,
        config,
        navigation,
        requestor: requestedUrl,
        computedCache,
        baseArtifacts,
      });
      const artifactIds = Object.keys(artifacts);
      expect(artifactIds).toContain('Timespan');
      expect(artifactIds).toContain('Snapshot');

      // Only once for the requested URL.
      expect(mocks.navigationMock.gotoURL).toHaveBeenCalledTimes(1);
    });

    it('skips about:blank if using a callback requestor', async () => {
      const {artifacts} = await runner._navigation({
        driver,
        page,
        config,
        navigation,
        requestor: () => {},
        computedCache,
        baseArtifacts,
      });
      const artifactIds = Object.keys(artifacts);
      expect(artifactIds).toContain('Timespan');
      expect(artifactIds).toContain('Snapshot');

      // Only once for the requested URL.
      expect(mocks.navigationMock.gotoURL).toHaveBeenCalledTimes(1);
    });

    it('collects timespan, snapshot, and navigation artifacts', async () => {
      const {artifacts} = await run(navigation);
      expect(artifacts).toEqual({
        Navigation: {type: 'navigation'},
        Timespan: {type: 'timespan'},
        Snapshot: {type: 'snapshot'},
      });
    });

    it('supports dependencies between phases', async () => {
      const {navigation, gatherers} = createNavigation();
      navigation.artifacts[1].dependencies = {Accessibility: {id: 'Timespan'}};
      navigation.artifacts[2].dependencies = {Accessibility: {id: 'Timespan'}};

      const {artifacts} = await run(navigation);
      expect(artifacts).toEqual({
        Navigation: {type: 'navigation'},
        Timespan: {type: 'timespan'},
        Snapshot: {type: 'snapshot'},
      });

      expect(gatherers.navigation.getArtifact).toHaveBeenCalled();
      const navigationArgs = gatherers.navigation.getArtifact.mock.calls[0];
      expect(navigationArgs[0].dependencies).toEqual({Accessibility: {type: 'timespan'}});

      expect(gatherers.snapshot.getArtifact).toHaveBeenCalled();
      const snapshotArgs = gatherers.snapshot.getArtifact.mock.calls[0];
      expect(snapshotArgs[0].dependencies).toEqual({Accessibility: {type: 'timespan'}});
    });

    it('passes through an error in dependencies', async () => {
      const {navigation} = createNavigation();
      const err = new Error('Error in dependency chain');
      navigation.artifacts[0].gatherer.instance.startInstrumentation = jestMock
        .fn()
        .mockRejectedValue(err);
      navigation.artifacts[1].dependencies = {Accessibility: {id: 'Timespan'}};
      navigation.artifacts[2].dependencies = {Accessibility: {id: 'Timespan'}};

      const {artifacts} = await run(navigation);

      expect(artifacts).toEqual({
        Navigation: expect.any(Error),
        Timespan: err,
        Snapshot: expect.any(Error),
      });
    });

    it('passes through an error in startSensitiveInstrumentation', async () => {
      const {navigation, gatherers} = createNavigation();
      const err = new Error('Error in startSensitiveInstrumentation');
      gatherers.navigation.startSensitiveInstrumentation.mockRejectedValue(err);

      const {artifacts} = await run(navigation);

      expect(artifacts).toEqual({
        Navigation: err,
        Timespan: {type: 'timespan'},
        Snapshot: {type: 'snapshot'},
      });
    });

    it('passes through an error in startInstrumentation', async () => {
      const {navigation, gatherers} = createNavigation();
      const err = new Error('Error in startInstrumentation');
      gatherers.timespan.startInstrumentation.mockRejectedValue(err);

      const {artifacts} = await run(navigation);

      expect(artifacts).toEqual({
        Navigation: {type: 'navigation'},
        Timespan: err,
        Snapshot: {type: 'snapshot'},
      });
    });

    it('returns navigate errors', async () => {
      const {navigation} = createNavigation();
      const noFcp = new LighthouseError(LighthouseError.errors.NO_FCP);

      mocks.navigationMock.gotoURL.mockImplementation(
        /** @param {*} context @param {string} url */
        (context, url) => {
          if (url.includes('blank')) return {finalDisplayedUrl: 'about:blank', warnings: []};
          throw noFcp;
        }
      );

      const {artifacts, pageLoadError} = await run(navigation);
      expect(pageLoadError).toBe(noFcp);
      expect(artifacts).toEqual({});
    });

    it('finds page load errors in network records when available', async () => {
      const {navigation, gatherers} = createNavigation();
      mocks.navigationMock.gotoURL.mockResolvedValue({mainDocumentUrl: requestedUrl, warnings: []});
      const devtoolsLog = networkRecordsToDevtoolsLog([{url: requestedUrl, failed: true}]);
      gatherers.timespan.meta.symbol = DevtoolsLogGatherer.symbol;
      gatherers.timespan.getArtifact = fnAny().mockResolvedValue(devtoolsLog);
      gatherers.navigation.meta.symbol = TraceGatherer.symbol;
      gatherers.navigation.getArtifact = fnAny().mockResolvedValue({traceEvents: []});

      const {artifacts, pageLoadError} = await run(navigation);
      expect(pageLoadError).toBeInstanceOf(LighthouseError);
      expect(artifacts).toEqual({
        devtoolsLogs: {'pageLoadError-default': expect.any(Array)},
        traces: {'pageLoadError-default': {traceEvents: []}},
      });
    });

    it('cleans up throttling before getArtifact', async () => {
      const {navigation, gatherers} = createNavigation();
      gatherers.navigation.getArtifact = fnAny().mockImplementation(() => {
        expect(mocks.emulationMock.clearThrottling).toHaveBeenCalled();
      });

      await run(navigation);
      expect(mocks.emulationMock.clearThrottling).toHaveBeenCalledTimes(1);
    });
  });

  describe('_setupNavigation', () => {
    it('should setup the page on the blankPage', async () => {
      navigation.blankPage = 'data:text/html;...';
      await runner._setupNavigation({
        driver,
        page,
        navigation,
        requestor: requestedUrl,
        config,
        computedCache,
        baseArtifacts,
      });
      expect(mocks.navigationMock.gotoURL).toHaveBeenCalledWith(
        expect.anything(),
        'data:text/html;...',
        expect.anything()
      );
    });

    it('should prepare target for navigation', async () => {
      await runner._setupNavigation({
        driver,
        page,
        navigation,
        requestor: requestedUrl,
        config,
        computedCache,
        baseArtifacts,
      });
      expect(mocks.prepareMock.prepareTargetForIndividualNavigation).toHaveBeenCalled();
    });

    it('should return the warnings from preparation', async () => {
      const warnings = ['Warning A', 'Warning B'];
      mocks.prepareMock.prepareTargetForIndividualNavigation.mockResolvedValue({warnings});
      const result = await runner._setupNavigation({
        driver,
        page,
        navigation,
        requestor: requestedUrl,
        config,
        computedCache,
        baseArtifacts,
      });
      expect(result).toEqual({warnings});
    });
  });

  describe('_navigate', () => {
    const run = () =>
      runner._navigate({
        driver,
        page,
        navigation,
        requestor,
        config,
        computedCache,
        baseArtifacts,
      });

    it('should navigate the page', async () => {
      await run();
      expect(mocks.navigationMock.gotoURL).toHaveBeenCalledWith(
        expect.anything(),
        requestedUrl,
        expect.anything()
      );
    });

    it('should return navigate results', async () => {
      const mainDocumentUrl = 'https://lighthouse.example.com/nested/page';
      const warnings = ['Warning A', 'Warning B'];
      mocks.navigationMock.gotoURL.mockResolvedValue({requestedUrl, mainDocumentUrl, warnings});
      const result = await run();
      expect(result).toEqual({requestedUrl, mainDocumentUrl, warnings, navigationError: undefined});
    });

    it('should catch navigation errors', async () => {
      const navigationError = new LighthouseError(LighthouseError.errors.PAGE_HUNG);
      mocks.navigationMock.gotoURL.mockRejectedValue(navigationError);
      const result = await run();
      expect(result).toEqual({
        requestedUrl,
        mainDocumentUrl: requestedUrl,
        navigationError,
        warnings: [],
      });
    });

    it('should throw regular errors', async () => {
      mocks.navigationMock.gotoURL.mockRejectedValue(new Error('Other fatal error'));
      await expect(run()).rejects.toThrowError('Other fatal error');
    });
  });

  describe('_cleanup', () => {
    it('should clear storage when storage was reset', async () => {
      config.settings.disableStorageReset = false;
      await runner._cleanup({requestedUrl, driver, config});
      expect(mocks.storageMock.clearDataForOrigin).toHaveBeenCalled();
    });

    it('should not clear storage when storage reset was disabled', async () => {
      config.settings.disableStorageReset = true;
      await runner._cleanup({requestedUrl, driver, config});
      expect(mocks.storageMock.clearDataForOrigin).not.toHaveBeenCalled();
    });
  });

  describe('navigation', () => {
    it('should throw on invalid URL', async () => {
      mockRunner.gather.mockImplementation(runnerActual.gather);

      const navigatePromise = runner.navigationGather(mockDriver._page.asPage(), '');

      await expect(navigatePromise).rejects.toThrow('INVALID_URL');
    });

    it('should initialize config', async () => {
      const flags = {
        formFactor: /** @type {const} */ ('desktop'),
        maxWaitForLoad: 1234,
        screenEmulation: {mobile: false},
      };

      await runner.navigationGather(
        mockDriver._page.asPage(),
        'http://example.com',
        {flags}
      );

      expect(mockRunner.gather.mock.calls[0][1]).toMatchObject({
        config: {
          settings: flags,
        },
      });
    });
  });
});
