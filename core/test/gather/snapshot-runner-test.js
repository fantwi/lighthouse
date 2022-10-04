/**
 * @license Copyright 2021 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

// import {snapshotGather} from '../../../gather/snapshot-runner.js';
import * as td from 'testdouble';

import {
  createMockDriver,
  createMockPage,
  createMockGathererInstance,
  mockDriverModule,
  mockRunnerModule,
} from './mock-driver.js';

// Some imports needs to be done dynamically, so that their dependencies will be mocked.
// See: https://jestjs.io/docs/ecmascript-modules#differences-between-esm-and-commonjs
//      https://github.com/facebook/jest/issues/10025
/** @type {import('../../gather/snapshot-runner.js')['snapshotGather']} */
let snapshotGather;

before(async () => {
  snapshotGather = (await import('../../gather/snapshot-runner.js')).snapshotGather;
});

const mockRunner = await mockRunnerModule();

// Establish the mocks before we import the file under test.
/** @type {ReturnType<typeof createMockDriver>} */
let mockDriver;

await td.replaceEsm('../../gather/driver.js',
  mockDriverModule(() => mockDriver.asDriver()));

describe('Snapshot Runner', () => {
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
    mockPage = createMockPage();
    mockDriver = createMockDriver();
    mockRunner.reset();
    page = mockPage.asPage();

    mockDriver._session.sendCommand.mockResponse('Browser.getVersion', {
      product: 'Chrome/88.0',
      userAgent: 'Chrome',
    });

    gathererA = createMockGathererInstance({supportedModes: ['snapshot']});
    gathererA.getArtifact.mockResolvedValue('Artifact A');

    gathererB = createMockGathererInstance({supportedModes: ['snapshot']});
    gathererB.getArtifact.mockResolvedValue('Artifact B');

    config = {
      artifacts: [
        {id: 'A', gatherer: {instance: gathererA.asGatherer()}},
        {id: 'B', gatherer: {instance: gathererB.asGatherer()}},
      ],
    };
  });

  it('should connect to the page and run', async () => {
    await snapshotGather(page, {config});
    expect(mockDriver.connect).toHaveBeenCalled();
    expect(mockRunner.gather).toHaveBeenCalled();
    expect(mockRunner.audit).not.toHaveBeenCalled();
  });

  it('should collect base artifacts', async () => {
    mockDriver.url.mockResolvedValue('https://lighthouse.example.com/');

    await snapshotGather(page, {config});
    const artifacts = await mockRunner.gather.mock.calls[0][0]();
    expect(artifacts).toMatchObject({
      fetchTime: expect.any(String),
      URL: {
        finalDisplayedUrl: 'https://lighthouse.example.com/',
      },
    });
  });

  it('should collect snapshot artifacts', async () => {
    await snapshotGather(page, {config});
    const artifacts = await mockRunner.gather.mock.calls[0][0]();
    expect(artifacts).toMatchObject({A: 'Artifact A', B: 'Artifact B'});
    expect(gathererA.getArtifact).toHaveBeenCalled();
    expect(gathererB.getArtifact).toHaveBeenCalled();
  });


  it('should use flags', async () => {
    const flags = {
      formFactor: /** @type {const} */ ('desktop'),
      maxWaitForLoad: 1234,
      screenEmulation: {mobile: false},
    };

    await snapshotGather(page, {config, flags});

    expect(mockRunner.gather.mock.calls[0][1]).toMatchObject({
      config: {
        settings: flags,
      },
    });
  });

  it('should not invoke instrumentation methods', async () => {
    await snapshotGather(page, {config});
    await mockRunner.gather.mock.calls[0][0]();
    expect(gathererA.startInstrumentation).not.toHaveBeenCalled();
    expect(gathererA.startSensitiveInstrumentation).not.toHaveBeenCalled();
    expect(gathererA.stopSensitiveInstrumentation).not.toHaveBeenCalled();
    expect(gathererA.stopInstrumentation).not.toHaveBeenCalled();
  });

  it('should skip timespan artifacts', async () => {
    gathererB.meta.supportedModes = ['timespan'];

    await snapshotGather(page, {config});
    const artifacts = await mockRunner.gather.mock.calls[0][0]();
    expect(artifacts).toMatchObject({A: 'Artifact A'});
    expect(artifacts).not.toHaveProperty('B');
    expect(gathererB.getArtifact).not.toHaveBeenCalled();
  });

  it('should support artifact dependencies', async () => {
    const dependencySymbol = Symbol('dep');
    gathererA.meta.symbol = dependencySymbol;
    // @ts-expect-error - the default fixture was defined as one without dependencies.
    gathererB.meta.dependencies = {ImageElements: dependencySymbol};

    await snapshotGather(page, {config});
    const artifacts = await mockRunner.gather.mock.calls[0][0]();
    expect(artifacts).toMatchObject({A: 'Artifact A', B: 'Artifact B'});
    expect(gathererB.getArtifact.mock.calls[0][0]).toMatchObject({
      dependencies: {
        ImageElements: 'Artifact A',
      },
    });
  });
});
