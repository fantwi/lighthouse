/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import LongTasks from '../../audits/long-tasks.js';
import {createTestTrace} from '../create-test-trace.js';
import {networkRecordsToDevtoolsLog} from '../network-records-to-devtools-log.js';

const BASE_TS = 12345e3;
const TASK_URL = 'https://pwa.rocks';

/**
 * @param {Number} count
 * @param {Number} duration
 * @param {Boolean} withChildTasks
 */
function generateTraceWithLongTasks({count, duration = 200, withChildTasks = false}) {
  const traceTasks = [{ts: BASE_TS, duration: 0}];
  for (let i = 1; i <= count; i++) {
    /* Generates a top-level task w/ the following breakdown:
    task -> {
      ts,
      duration,
      children -> [{ts, duration, url}, ...],
    }
    Child tasks should start after the parent task and end before it.
    Top-level tasks will take on the attributable URL from it's children.
    */
    const ts = BASE_TS + i * 1000;
    const task = {ts, duration};
    task.children = [];
    if (withChildTasks) {
      task.children.push({
        ts: ts + duration / 10,
        duration: duration / 3,
        url: TASK_URL,
      });
      task.children.push({
        ts: ts + duration / 2,
        duration: duration / 3,
        url: TASK_URL,
      });
    }
    traceTasks.push(task);
  }
  return createTestTrace({
    topLevelTasks: traceTasks,
    timeOrigin: BASE_TS,
  });
}

describe('Long tasks audit', () => {
  const devtoolsLog = networkRecordsToDevtoolsLog([{url: TASK_URL}]);
  const URL = {
    requestedUrl: TASK_URL,
    mainDocumentUrl: TASK_URL,
    finalDisplayedUrl: TASK_URL,
  };

  it('should pass and be non-applicable if there are no long tasks', async () => {
    const artifacts = {
      URL,
      traces: {defaultPass: generateTraceWithLongTasks({count: 0})},
      devtoolsLogs: {defaultPass: devtoolsLog},
    };
    const result = await LongTasks.audit(artifacts, {computedCache: new Map()});
    expect(result.details.items).toHaveLength(0);
    expect(result.score).toBe(1);
    expect(result.displayValue).toBeUndefined();
    expect(result.notApplicable).toBeTruthy();
  });

  it('should return a list of long tasks with duration >= 50 ms', async () => {
    const artifacts = {
      URL,
      traces: {defaultPass: generateTraceWithLongTasks({count: 4})},
      devtoolsLogs: {defaultPass: devtoolsLog},
    };
    const result = await LongTasks.audit(artifacts, {computedCache: new Map()});
    expect(result.details.items).toMatchObject([
      {url: 'Unattributable', duration: 200, startTime: 1000},
      {url: 'Unattributable', duration: 200, startTime: 2000},
      {url: 'Unattributable', duration: 200, startTime: 3000},
      {url: 'Unattributable', duration: 200, startTime: 4000},
    ]);
    expect(result.score).toBe(0);
    expect(result.displayValue).toBeDisplayString('4 long tasks found');
    expect(result.notApplicable).toBeFalsy();
  });

  it('should filter out tasks with duration less than 50 ms', async () => {
    const trace = createTestTrace({
      timeOrigin: BASE_TS,
      topLevelTasks: [
        {ts: BASE_TS, duration: 1},
        {ts: BASE_TS + 1000, duration: 30},
        {ts: BASE_TS + 2000, duration: 100},
        {ts: BASE_TS + 3000, duration: 25},
        {ts: BASE_TS + 4000, duration: 50},
      ],
    });
    const artifacts = {
      URL,
      traces: {defaultPass: trace},
      devtoolsLogs: {defaultPass: devtoolsLog},
    };

    const result = await LongTasks.audit(artifacts, {computedCache: new Map()});
    expect(result.details.items).toMatchObject([
      {url: 'Unattributable', duration: 100, startTime: 2000},
      {url: 'Unattributable', duration: 50, startTime: 4000},
    ]);
    expect(result.score).toBe(0);
    expect(result.displayValue).toBeDisplayString('2 long tasks found');
  });

  it('should not filter out tasks with duration >= 50 ms only after throttling', async () => {
    const artifacts = {
      URL,
      traces: {defaultPass: generateTraceWithLongTasks({count: 4, duration: 25})},
      devtoolsLogs: {defaultPass: networkRecordsToDevtoolsLog([
        {url: TASK_URL, timing: {connectEnd: 50, connectStart: 0.01, sslStart: 25, sslEnd: 40}},
      ])},
    };
    const context = {
      computedCache: new Map(),
      settings: {
        precomputedLanternData: {
          additionalRttByOrigin: {[TASK_URL]: 0},
          serverResponseTimeByOrigin: {[TASK_URL]: 100},
        },
        throttlingMethod: 'simulate',
        throttling: {
          rttMs: 100,
          throughputKbps: 10000,
          cpuSlowdownMultiplier: 4,
        },
      },
    };
    const result = await LongTasks.audit(artifacts, context);
    expect(result.details.items).toMatchObject([
      {duration: 100, startTime: 600},
      {duration: 100, startTime: 700},
      {duration: 100, startTime: 800},
      {duration: 100, startTime: 900},
    ]);
    expect(result.score).toBe(0);
    expect(result.details.items).toHaveLength(4);
    expect(result.displayValue).toBeDisplayString('4 long tasks found');
  });

  it('should populate url when tasks have an attributable url', async () => {
    const trace = generateTraceWithLongTasks({count: 1, duration: 300, withChildTasks: true});
    const artifacts = {
      URL,
      traces: {defaultPass: trace},
      devtoolsLogs: {defaultPass: devtoolsLog},
    };
    const result = await LongTasks.audit(artifacts, {computedCache: new Map()});
    expect(result.details.items).toMatchObject([
      {url: TASK_URL, duration: 300, startTime: 1000},
    ]);
    expect(result.score).toBe(0);
    expect(result.displayValue).toBeDisplayString('1 long task found');
  });
});
