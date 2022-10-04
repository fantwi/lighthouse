/**
 * @license Copyright 2021 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import * as td from 'testdouble';

// import {startTimespanGather} from '../../../gather/timespan-runner.js';
import {
  createMockDriver,
  createMockPage,
  createMockGathererInstance,
  mockDriverSubmodules,
  mockDriverModule,
  mockRunnerModule,
} from './mock-driver.js';

// Some imports needs to be done dynamically, so that their dependencies will be mocked.
// See: https://jestjs.io/docs/ecmascript-modules#differences-between-esm-and-commonjs
//      https://github.com/facebook/jest/issues/10025
/** @type {import('../../gather/timespan-runner.js')['startTimespanGather']} */
let startTimespanGather;

before(async () => {
  startTimespanGather =
    (await import('../../gather/timespan-runner.js')).startTimespanGather;
});

const mockSubmodules = await mockDriverSubmodules();
const mockRunner = await mockRunnerModule();

// Establish the mocks before we import the file under test.
/** @type {ReturnType<typeof createMockDriver>} */
let mockDriver;
await td.replaceEsm('../../gather/driver.js',
  mockDriverModule(() => mockDriver.asDriver()));

describe('Timespan Runner', () => {
  /** @type {ReturnType<typeof createMockPage>} */
  let mockPage;
  /** @type {LH.Puppeteer.Page} */
  let page;
  /** @type {ReturnType<typeof createMockGathererInstance>} */
  let gathererA;
  /** @type {ReturnType<typeof createMockGathererInstance>} */
  let gathererB;
  /** @type {LH.Config.Json} */
  let config;

  beforeEach(() => {
    mockSubmodules.reset();
    mockPage = createMockPage();
    mockDriver = createMockDriver();
    mockRunner.reset();
    page = mockPage.asPage();

    mockDriver._session.sendCommand.mockResponse('Browser.getVersion', {
      product: 'Chrome/88.0',
      userAgent: 'Chrome',
    });

    gathererA = createMockGathererInstance({supportedModes: ['timespan']});
    gathererA.getArtifact.mockResolvedValue('Artifact A');

    gathererB = createMockGathererInstance({supportedModes: ['timespan']});
    gathererB.getArtifact.mockResolvedValue('Artifact B');

    config = {
      artifacts: [
        {id: 'A', gatherer: {instance: gathererA.asGatherer()}},
        {id: 'B', gatherer: {instance: gathererB.asGatherer()}},
      ],
    };
  });

  it('should connect to the page and run', async () => {
    const timespan = await startTimespanGather(page, {config});
    await timespan.endTimespanGather();
    expect(mockDriver.connect).toHaveBeenCalled();
    expect(mockRunner.gather).toHaveBeenCalled();
    expect(mockRunner.audit).not.toHaveBeenCalled();
  });

  it('should prepare the target', async () => {
    const timespan = await startTimespanGather(page, {config});
    expect(mockSubmodules.prepareMock.prepareTargetForTimespanMode).toHaveBeenCalled();
    await timespan.endTimespanGather();
  });

  it('should invoke startInstrumentation', async () => {
    const timespan = await startTimespanGather(page, {config});
    expect(gathererA.startInstrumentation).toHaveBeenCalled();
    expect(gathererB.startInstrumentation).toHaveBeenCalled();
    expect(gathererA.startSensitiveInstrumentation).toHaveBeenCalled();
    expect(gathererB.startSensitiveInstrumentation).toHaveBeenCalled();
    await timespan.endTimespanGather();
  });

  it('should collect base artifacts', async () => {
    mockDriver.url.mockResolvedValue('https://start.example.com/');

    const timespan = await startTimespanGather(page, {config});

    mockDriver.url.mockResolvedValue('https://end.example.com/');

    await timespan.endTimespanGather();
    const artifacts = await mockRunner.gather.mock.calls[0][0]();
    expect(artifacts).toMatchObject({
      fetchTime: expect.any(String),
      URL: {
        finalDisplayedUrl: 'https://end.example.com/',
      },
    });
  });

  it('should use flags', async () => {
    const flags = {
      formFactor: /** @type {const} */ ('desktop'),
      maxWaitForLoad: 1234,
      screenEmulation: {mobile: false},
    };

    const timespan = await startTimespanGather(page, {config, flags});
    await timespan.endTimespanGather();

    expect(mockRunner.gather.mock.calls[0][1]).toMatchObject({
      config: {
        settings: flags,
      },
    });
  });

  it('should invoke stop instrumentation', async () => {
    const timespan = await startTimespanGather(page, {config});
    await timespan.endTimespanGather();
    await mockRunner.gather.mock.calls[0][0]();
    expect(gathererA.stopSensitiveInstrumentation).toHaveBeenCalled();
    expect(gathererB.stopSensitiveInstrumentation).toHaveBeenCalled();
    expect(gathererA.stopInstrumentation).toHaveBeenCalled();
    expect(gathererB.stopInstrumentation).toHaveBeenCalled();
  });

  it('should collect timespan artifacts', async () => {
    const timespan = await startTimespanGather(page, {config});
    await timespan.endTimespanGather();
    const artifacts = await mockRunner.gather.mock.calls[0][0]();
    expect(artifacts).toMatchObject({A: 'Artifact A', B: 'Artifact B'});
  });

  it('should carryover failures from startInstrumentation', async () => {
    const artifactError = new Error('BEFORE_TIMESPAN_ERROR');
    gathererA.startInstrumentation.mockRejectedValue(artifactError);

    const timespan = await startTimespanGather(page, {config});
    await timespan.endTimespanGather();
    const artifacts = await mockRunner.gather.mock.calls[0][0]();
    expect(artifacts).toMatchObject({A: artifactError, B: 'Artifact B'});
    expect(gathererA.stopInstrumentation).not.toHaveBeenCalled();
    expect(gathererB.stopInstrumentation).toHaveBeenCalled();
  });

  it('should skip snapshot artifacts', async () => {
    gathererB.meta.supportedModes = ['snapshot'];

    const timespan = await startTimespanGather(page, {config});
    await timespan.endTimespanGather();
    const artifacts = await mockRunner.gather.mock.calls[0][0]();
    expect(artifacts).toMatchObject({A: 'Artifact A'});
    expect(artifacts).not.toHaveProperty('B');
    expect(gathererB.startInstrumentation).not.toHaveBeenCalled();
    expect(gathererB.getArtifact).not.toHaveBeenCalled();
  });

  it('should support artifact dependencies', async () => {
    const dependencySymbol = Symbol('dep');
    gathererA.meta.symbol = dependencySymbol;
    // @ts-expect-error - the default fixture was defined as one without dependencies.
    gathererB.meta.dependencies = {ImageElements: dependencySymbol};

    const timespan = await startTimespanGather(page, {config});
    await timespan.endTimespanGather();
    const artifacts = await mockRunner.gather.mock.calls[0][0]();
    expect(artifacts).toMatchObject({A: 'Artifact A', B: 'Artifact B'});
    expect(gathererB.getArtifact.mock.calls[0][0]).toMatchObject({
      dependencies: {
        ImageElements: 'Artifact A',
      },
    });
  });
});
