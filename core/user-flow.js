/**
 * @license Copyright 2021 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import {ReportGenerator} from '../report/generator/report-generator.js';
import {snapshotGather} from './gather/snapshot-runner.js';
import {startTimespanGather} from './gather/timespan-runner.js';
import {navigationGather} from './gather/navigation-runner.js';
import {Runner} from './runner.js';
import {initializeConfig} from './config/config.js';

/** @typedef {WeakMap<LH.UserFlow.GatherStep, LH.Gatherer.FRGatherResult['runnerOptions']>} GatherStepRunnerOptions */

class UserFlow {
  /**
   * @param {LH.Puppeteer.Page} page
   * @param {LH.UserFlow.Options} [options]
   */
  constructor(page, options) {
    /** @type {LH.Puppeteer.Page} */
    this._page = page;
    /** @type {LH.UserFlow.Options|undefined} */
    this._options = options;
    /** @type {LH.UserFlow.GatherStep[]} */
    this._gatherSteps = [];
    /** @type {GatherStepRunnerOptions} */
    this._gatherStepRunnerOptions = new WeakMap();
  }

  /**
   * @param {LH.UserFlow.StepFlags} [stepFlags]
   * @return {LH.UserFlow.StepFlags}
   */
  _getNextNavigationFlags(stepFlags) {
    const newStepFlags = {...stepFlags};

    if (newStepFlags.skipAboutBlank === undefined) {
      newStepFlags.skipAboutBlank = true;
    }

    // On repeat navigations, we want to disable storage reset by default (i.e. it's not a cold load).
    const isSubsequentNavigation = this._gatherSteps
      .some(step => step.artifacts.GatherContext.gatherMode === 'navigation');
    if (isSubsequentNavigation) {
      if (newStepFlags.disableStorageReset === undefined) {
        newStepFlags.disableStorageReset = true;
      }
    }

    return newStepFlags;
  }

  /**
   *
   * @param {LH.Gatherer.FRGatherResult} gatherResult
   * @param {LH.UserFlow.StepFlags} [stepFlags]
   */
  _addGatherStep(gatherResult, stepFlags) {
    const gatherStep = {
      artifacts: gatherResult.artifacts,
      stepFlags,
    };
    this._gatherSteps.push(gatherStep);
    this._gatherStepRunnerOptions.set(gatherStep, gatherResult.runnerOptions);
  }

  /**
   * @param {LH.NavigationRequestor} requestor
   * @param {LH.UserFlow.StepFlags} [stepFlags]
   */
  async navigate(requestor, stepFlags) {
    if (this.currentTimespan) throw new Error('Timespan already in progress');
    if (this.currentNavigation) throw new Error('Navigation already in progress');

    const newStepFlags = this._getNextNavigationFlags(stepFlags);
    const gatherResult = await navigationGather(this._page, requestor, {
      config: this._options?.config,
      flags: newStepFlags,
    });

    this._addGatherStep(gatherResult, newStepFlags);
  }

  /**
   * This is an alternative to `navigate()` that can be used to analyze a navigation triggered by user interaction.
   * For more on user triggered navigations, see https://github.com/GoogleChrome/lighthouse/blob/main/docs/user-flows.md#triggering-a-navigation-via-user-interactions.
   *
   * @param {LH.UserFlow.StepFlags} [stepOptions]
   */
  async startNavigation(stepOptions) {
    /** @type {(value: () => void) => void} */
    let completeSetup;
    /** @type {(value: any) => void} */
    let rejectDuringSetup;

    // This promise will resolve once the setup is done
    // and Lighthouse is waiting for a page navigation to be triggered.
    const navigationSetupPromise = new Promise((resolve, reject) => {
      completeSetup = resolve;
      rejectDuringSetup = reject;
    });

    // The promise in this callback will not resolve until `continueNavigation` is invoked,
    // because `continueNavigation` is passed along to `navigateSetupPromise`
    // and extracted into `continueAndAwaitResult` below.
    const navigationResultPromise = this.navigate(
      () => new Promise(continueNavigation => completeSetup(continueNavigation)),
      stepOptions
    ).catch(err => {
      if (this.currentNavigation) {
        // If the navigation already started, re-throw the error so it is emitted when `navigationResultPromise` is awaited.
        throw err;
      } else {
        // If the navigation has not started, reject the `navigationSetupPromise` so the error throws when it is awaited in `startNavigation`.
        rejectDuringSetup(err);
      }
    });

    const continueNavigation = await navigationSetupPromise;

    async function continueAndAwaitResult() {
      continueNavigation();
      await navigationResultPromise;
    }

    this.currentNavigation = {continueAndAwaitResult};
  }

  async endNavigation() {
    if (this.currentTimespan) throw new Error('Timespan already in progress');
    if (!this.currentNavigation) throw new Error('No navigation in progress');
    await this.currentNavigation.continueAndAwaitResult();
    this.currentNavigation = undefined;
  }

  /**
   * @param {LH.UserFlow.StepFlags} [stepFlags]
   */
  async startTimespan(stepFlags) {
    if (this.currentTimespan) throw new Error('Timespan already in progress');
    if (this.currentNavigation) throw new Error('Navigation already in progress');

    const timespan = await startTimespanGather(this._page, {
      config: this._options?.config,
      flags: stepFlags,
    });
    this.currentTimespan = {timespan, stepFlags};
  }

  async endTimespan() {
    if (!this.currentTimespan) throw new Error('No timespan in progress');
    if (this.currentNavigation) throw new Error('Navigation already in progress');

    const {timespan, stepFlags} = this.currentTimespan;
    const gatherResult = await timespan.endTimespanGather();
    this.currentTimespan = undefined;

    this._addGatherStep(gatherResult, stepFlags);
  }

  /**
   * @param {LH.UserFlow.StepFlags} [stepFlags]
   */
  async snapshot(stepFlags) {
    if (this.currentTimespan) throw new Error('Timespan already in progress');
    if (this.currentNavigation) throw new Error('Navigation already in progress');

    const gatherResult = await snapshotGather(this._page, {
      config: this._options?.config,
      flags: stepFlags,
    });

    this._addGatherStep(gatherResult, stepFlags);
  }

  /**
   * @returns {Promise<LH.FlowResult>}
   */
  async createFlowResult() {
    return auditGatherSteps(this._gatherSteps, {
      name: this._options?.name,
      config: this._options?.config,
      gatherStepRunnerOptions: this._gatherStepRunnerOptions,
    });
  }

  /**
   * @return {Promise<string>}
   */
  async generateReport() {
    const flowResult = await this.createFlowResult();
    return ReportGenerator.generateFlowReportHtml(flowResult);
  }

  /**
   * @return {Promise<LH.UserFlow.FlowArtifacts>}
   */
  async createArtifactsJson() {
    return {
      gatherSteps: this._gatherSteps,
      name: this._options?.name,
    };
  }
}

/**
 * @param {string} longUrl
 * @returns {string}
 */
function shortenUrl(longUrl) {
  const url = new URL(longUrl);
  return `${url.hostname}${url.pathname}`;
}

/**
 * @param {LH.Artifacts} artifacts
 * @return {string}
 */
function getDefaultStepName(artifacts) {
  const shortUrl = shortenUrl(artifacts.URL.finalDisplayedUrl);
  switch (artifacts.GatherContext.gatherMode) {
    case 'navigation':
      return `Navigation report (${shortUrl})`;
    case 'timespan':
      return `Timespan report (${shortUrl})`;
    case 'snapshot':
      return `Snapshot report (${shortUrl})`;
  }
}

/**
 * @param {Array<LH.UserFlow.GatherStep>} gatherSteps
 * @param {{name?: string, config?: LH.Config.Json, gatherStepRunnerOptions?: GatherStepRunnerOptions}} options
 */
async function auditGatherSteps(gatherSteps, options) {
  if (!gatherSteps.length) {
    throw new Error('Need at least one step before getting the result');
  }

  /** @type {LH.FlowResult['steps']} */
  const steps = [];
  for (const gatherStep of gatherSteps) {
    const {artifacts, stepFlags} = gatherStep;
    const name = stepFlags?.name || getDefaultStepName(artifacts);

    let runnerOptions = options.gatherStepRunnerOptions?.get(gatherStep);

    // If the gather step is not active, we must recreate the runner options.
    if (!runnerOptions) {
      // Step specific configs take precedence over a config for the entire flow.
      const configJson = options.config;
      const {gatherMode} = artifacts.GatherContext;
      const {config} = await initializeConfig(gatherMode, configJson, stepFlags);
      runnerOptions = {
        config,
        computedCache: new Map(),
      };
    }

    const result = await Runner.audit(artifacts, runnerOptions);
    if (!result) throw new Error(`Step "${name}" did not return a result`);
    steps.push({lhr: result.lhr, name});
  }

  const url = new URL(gatherSteps[0].artifacts.URL.finalDisplayedUrl);
  const flowName = options.name || `User flow (${url.hostname})`;
  return {steps, name: flowName};
}


export {
  UserFlow,
  auditGatherSteps,
};
