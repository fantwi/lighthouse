/**
 * @license Copyright 2021 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import {getBaseArtifacts, finalizeArtifacts} from '../../gather/base-artifacts.js';
import {initializeConfig} from '../../config/config.js';
import {createMockDriver} from './mock-driver.js';
import {LighthouseError} from '../../lib/lh-error.js';

function getMockDriverForArtifacts() {
  const driverMock = createMockDriver();
  driverMock._executionContext.evaluate.mockResolvedValue(500);
  driverMock._session.sendCommand.mockResponse('Browser.getVersion', {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36', // eslint-disable-line max-len
    product: 'Chrome/92.0.4515.159',
  });
  return driverMock;
}

/** @type {LH.Gatherer.GatherMode} */
const gatherMode = 'navigation';

describe('getBaseArtifacts', () => {
  let driverMock = getMockDriverForArtifacts();

  beforeEach(() => {
    driverMock = getMockDriverForArtifacts();
  });

  it('should fetch benchmark index', async () => {
    const {config} = await initializeConfig('navigation');
    const artifacts = await getBaseArtifacts(config, driverMock.asDriver(), {gatherMode});
    expect(artifacts.BenchmarkIndex).toEqual(500);
  });

  it('should fetch host user agent', async () => {
    const {config} = await initializeConfig('navigation');
    const artifacts = await getBaseArtifacts(config, driverMock.asDriver(), {gatherMode});
    expect(artifacts.HostUserAgent).toContain('Macintosh');
    expect(artifacts.HostFormFactor).toEqual('desktop');
  });

  it('should return settings', async () => {
    const {config} = await initializeConfig('navigation');
    const artifacts = await getBaseArtifacts(config, driverMock.asDriver(), {gatherMode});
    expect(artifacts.settings).toEqual(config.settings);
  });
});

describe('finalizeArtifacts', () => {
  /** @type {LH.FRBaseArtifacts} */
  let baseArtifacts;
  /** @type {Partial<LH.Artifacts>} */
  let gathererArtifacts = {};

  beforeEach(async () => {
    const {config} = await initializeConfig(gatherMode);
    const driver = getMockDriverForArtifacts().asDriver();
    baseArtifacts = await getBaseArtifacts(config, driver, {gatherMode});
    baseArtifacts.URL = {finalDisplayedUrl: 'https://example.com'};
    gathererArtifacts = {};
  });

  it('should merge the two objects', () => {
    baseArtifacts.LighthouseRunWarnings = [{i18nId: '1', formattedDefault: 'Yes'}];
    gathererArtifacts.LighthouseRunWarnings = [{i18nId: '2', formattedDefault: 'No'}];
    gathererArtifacts.HostUserAgent = 'Desktop Chrome';

    const winningError = new LighthouseError(LighthouseError.errors.NO_LCP);
    baseArtifacts.PageLoadError = new LighthouseError(LighthouseError.errors.NO_FCP);
    gathererArtifacts.PageLoadError = winningError;

    gathererArtifacts.MainDocumentContent = '<html>';
    gathererArtifacts.RobotsTxt = {status: 404, content: null};

    const artifacts = finalizeArtifacts(baseArtifacts, gathererArtifacts);
    expect(artifacts).toMatchObject({
      GatherContext: {gatherMode: 'navigation'},
      PageLoadError: winningError,
      HostUserAgent: 'Desktop Chrome',
      BenchmarkIndex: 500,
      MainDocumentContent: '<html>',
      RobotsTxt: {status: 404, content: null},
      LighthouseRunWarnings: [
        {i18nId: '1', formattedDefault: 'Yes'},
        {i18nId: '2', formattedDefault: 'No'},
      ],
    });
  });

  it('should add timing entries', () => {
    const artifacts = finalizeArtifacts(baseArtifacts, gathererArtifacts);
    expect(artifacts.Timing.length).toBeGreaterThan(0);
  });

  it('should add environment warnings', () => {
    baseArtifacts.settings.channel = 'cli';
    baseArtifacts.settings.throttlingMethod = 'simulate';
    baseArtifacts.BenchmarkIndex = 200;
    const artifacts = finalizeArtifacts(baseArtifacts, gathererArtifacts);
    expect(artifacts.LighthouseRunWarnings).toHaveLength(1);
    expect(artifacts.LighthouseRunWarnings[0]).toBeDisplayString(/slower CPU/);
  });

  it('should dedupe warnings', () => {
    baseArtifacts.LighthouseRunWarnings = [
      {i18nId: '1', formattedDefault: 'Yes', values: {test: 1}},
      {i18nId: '1', formattedDefault: 'Yes', values: {test: 2}},
    ];
    gathererArtifacts.LighthouseRunWarnings = [
      {i18nId: '1', formattedDefault: 'Yes', values: {test: 1}},
      {i18nId: '1', formattedDefault: 'Yes', values: {test: 3}},
      {i18nId: '2', formattedDefault: 'No'},
    ];

    const artifacts = finalizeArtifacts(baseArtifacts, gathererArtifacts);
    expect(artifacts.LighthouseRunWarnings).toEqual([
      {i18nId: '1', formattedDefault: 'Yes', values: {test: 1}},
      {i18nId: '1', formattedDefault: 'Yes', values: {test: 2}},
      {i18nId: '1', formattedDefault: 'Yes', values: {test: 3}},
      {i18nId: '2', formattedDefault: 'No'},
    ]);
  });

  it('should throw if URL was not set', () => {
    const run = () => finalizeArtifacts(baseArtifacts, gathererArtifacts);

    baseArtifacts.URL = {finalDisplayedUrl: 'https://example.com'};
    expect(run).not.toThrow();

    baseArtifacts.URL = {finalDisplayedUrl: ''};
    expect(run).toThrowError(/finalDisplayedUrl/);
  });

  it('should not throw if URL was not set for an error reason', () => {
    const run = () => finalizeArtifacts(baseArtifacts, gathererArtifacts);

    baseArtifacts.URL = {requestedUrl: 'https://example.com', finalDisplayedUrl: ''};
    baseArtifacts.PageLoadError = new LighthouseError(LighthouseError.errors.PAGE_HUNG);
    expect(run).not.toThrow();
  });
});
