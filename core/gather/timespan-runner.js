/**
 * @license Copyright 2021 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import log from 'lighthouse-logger';

import {Driver} from './driver.js';
import {Runner} from '../runner.js';
import {getEmptyArtifactState, collectPhaseArtifacts, awaitArtifacts} from './runner-helpers.js';
import {prepareTargetForTimespanMode} from './driver/prepare.js';
import {initializeConfig} from '../config/config.js';
import {getBaseArtifacts, finalizeArtifacts} from './base-artifacts.js';

/**
 * @param {LH.Puppeteer.Page} page
 * @param {{config?: LH.Config.Json, flags?: LH.Flags}} [options]
 * @return {Promise<{endTimespanGather(): Promise<LH.Gatherer.FRGatherResult>}>}
 */
async function startTimespanGather(page, options = {}) {
  const {flags = {}} = options;
  log.setLevel(flags.logLevel || 'error');

  const {config} = await initializeConfig('timespan', options.config, flags);
  const driver = new Driver(page);
  await driver.connect();

  /** @type {Map<string, LH.ArbitraryEqualityMap>} */
  const computedCache = new Map();
  const artifactDefinitions = config.artifacts || [];
  const baseArtifacts = await getBaseArtifacts(config, driver, {gatherMode: 'timespan'});
  const artifactState = getEmptyArtifactState();
  /** @type {Omit<import('./runner-helpers.js').CollectPhaseArtifactOptions, 'phase'>} */
  const phaseOptions = {
    driver,
    page,
    artifactDefinitions,
    artifactState,
    baseArtifacts,
    computedCache,
    gatherMode: 'timespan',
    settings: config.settings,
  };

  await prepareTargetForTimespanMode(driver, config.settings);
  await collectPhaseArtifacts({phase: 'startInstrumentation', ...phaseOptions});
  await collectPhaseArtifacts({phase: 'startSensitiveInstrumentation', ...phaseOptions});

  return {
    async endTimespanGather() {
      const finalDisplayedUrl = await driver.url();

      const runnerOptions = {config, computedCache};
      const artifacts = await Runner.gather(
        async () => {
          baseArtifacts.URL = {finalDisplayedUrl};

          await collectPhaseArtifacts({phase: 'stopSensitiveInstrumentation', ...phaseOptions});
          await collectPhaseArtifacts({phase: 'stopInstrumentation', ...phaseOptions});
          await collectPhaseArtifacts({phase: 'getArtifact', ...phaseOptions});
          await driver.disconnect();

          const artifacts = await awaitArtifacts(artifactState);
          return finalizeArtifacts(baseArtifacts, artifacts);
        },
        runnerOptions
      );
      return {artifacts, runnerOptions};
    },
  };
}

export {
  startTimespanGather,
};
