/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import {UserFlow, auditGatherSteps} from './user-flow.js';
import {snapshotGather} from './gather/snapshot-runner.js';
import {startTimespanGather} from './gather/timespan-runner.js';
import {navigationGather} from './gather/navigation-runner.js';
import {ReportGenerator} from '../report/generator/report-generator.js';
import {Runner} from './runner.js';

/**
 * @param {LH.Puppeteer.Page} page
 * @param {LH.UserFlow.Options} [options]
 */
async function startFlow(page, options) {
  return new UserFlow(page, options);
}

/**
 * @param {LH.Puppeteer.Page|undefined} page
 * @param {LH.NavigationRequestor|undefined} requestor
 * @param {{config?: LH.Config.Json, flags?: LH.Flags}} [options]
 * @return {Promise<LH.RunnerResult|undefined>}
 */
async function navigation(page, requestor, options) {
  const gatherResult = await navigationGather(page, requestor, options);
  return Runner.audit(gatherResult.artifacts, gatherResult.runnerOptions);
}

/**
 * @param {LH.Puppeteer.Page} page
 * @param {{config?: LH.Config.Json, flags?: LH.Flags}} [options]
 * @return {Promise<LH.RunnerResult|undefined>}
 */
async function snapshot(page, options) {
  const gatherResult = await snapshotGather(page, options);
  return Runner.audit(gatherResult.artifacts, gatherResult.runnerOptions);
}

/**
 * @param {LH.Puppeteer.Page} page
 * @param {{config?: LH.Config.Json, flags?: LH.Flags}} [options]
 * @return {Promise<{endTimespan: () => Promise<LH.RunnerResult|undefined>}>}
 */
async function startTimespan(page, options) {
  const {endTimespanGather} = await startTimespanGather(page, options);
  const endTimespan = async () => {
    const gatherResult = await endTimespanGather();
    return Runner.audit(gatherResult.artifacts, gatherResult.runnerOptions);
  };
  return {endTimespan};
}

/**
 * @param {LH.FlowResult} flowResult
 */
async function generateFlowReport(flowResult) {
  return ReportGenerator.generateFlowReportHtml(flowResult);
}

/**
 * @param {LH.UserFlow.FlowArtifacts} flowArtifacts
 * @param {LH.Config.Json} [config]
 */
async function auditFlowArtifacts(flowArtifacts, config) {
  const {gatherSteps, name} = flowArtifacts;
  return await auditGatherSteps(gatherSteps, {name, config});
}

export {
  snapshot,
  startTimespan,
  navigation,
  startFlow,
  generateFlowReport,
  auditFlowArtifacts,
};
