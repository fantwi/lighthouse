/**
 * @license Copyright 2016 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import UsesHTTP2Audit from '../../../audits/dobetterweb/uses-http2.js';
import {NetworkRecords} from '../../../computed/network-records.js';
import {networkRecordsToDevtoolsLog} from '../../network-records-to-devtools-log.js';
import {getURLArtifactFromDevtoolsLog, readJson} from '../../test-utils.js';

const trace = readJson('../../fixtures/traces/progressive-app-m60.json', import.meta);
const devtoolsLog = readJson('../../fixtures/traces/progressive-app-m60.devtools.log.json', import.meta);

describe('Resources are fetched over http/2', () => {
  let artifacts = {};
  let context = {};

  beforeEach(() => {
    context = {settings: {throttlingMethod: 'simulate'}, computedCache: new Map()};

    artifacts = {
      traces: {defaultPass: trace},
      devtoolsLogs: {defaultPass: devtoolsLog},
      GatherContext: {gatherMode: 'navigation'},
      URL: getURLArtifactFromDevtoolsLog(devtoolsLog),
    };
  });

  it('should pass when resources are requested via http/2', async () => {
    const results = await UsesHTTP2Audit.audit(artifacts, context);
    expect(results).toHaveProperty('score', 1);
    expect(results.details.items).toHaveLength(0);
  });

  it('should fail when resources are requested via http/1.x', async () => {
    const records = await NetworkRecords.compute_(artifacts.devtoolsLogs.defaultPass);
    records.forEach(record => (record.protocol = 'HTTP/1.1'));
    artifacts.devtoolsLogs.defaultPass = networkRecordsToDevtoolsLog(records);
    const result = await UsesHTTP2Audit.audit(artifacts, context);
    const hosts = new Set(result.details.items.map(item => new URL(item.url).host));

    // make sure we don't pull in domains with only a few requests (GTM, GA)
    expect(hosts).toEqual(new Set(['pwa.rocks']));
    // make sure we flag all the rest
    expect(result.details.items).toHaveLength(60);
    // make sure we report savings
    expect(result.numericValue).toMatchInlineSnapshot(`1340`);
    expect(result.details.overallSavingsMs).toMatchInlineSnapshot(`1340`);
    // make sure we have a failing score
    expect(result.score).toBeLessThan(0.5);
  });

  it('should ignore service worker requests', async () => {
    const records = await NetworkRecords.compute_(artifacts.devtoolsLogs.defaultPass);
    records.forEach(record => (record.protocol = 'HTTP/1.1'));
    records.slice(30).forEach(record => {
      // Force the records we're making service worker to another origin.
      // Because it doesn't make sense to have half H2 half not to the same origin.
      const url = record.url;
      if (url.includes('pwa.rocks')) record.url = url.replace('pwa.rocks', 'pwa2.rocks');
      record.fetchedViaServiceWorker = true;
      delete record.parsedURL;
    });

    artifacts.devtoolsLogs.defaultPass = networkRecordsToDevtoolsLog(records);
    const result = await UsesHTTP2Audit.audit(artifacts, context);
    const urls = new Set(result.details.items.map(item => item.url));

    // make sure we flag only the non-sw ones
    expect(urls).not.toContain(records[30].url);
    expect(result.details.items).toHaveLength(30);
    // make sure we report less savings
    expect(result.numericValue).toMatchInlineSnapshot(`500`);
    expect(result.details.overallSavingsMs).toMatchInlineSnapshot(`500`);
  });

  it('should return table items for timespan mode', async () => {
    const records = await NetworkRecords.compute_(artifacts.devtoolsLogs.defaultPass);
    records.forEach(record => (record.protocol = 'HTTP/1.1'));
    artifacts.devtoolsLogs.defaultPass = networkRecordsToDevtoolsLog(records);
    artifacts.GatherContext.gatherMode = 'timespan';
    const result = await UsesHTTP2Audit.audit(artifacts, context);
    const hosts = new Set(result.details.items.map(item => new URL(item.url).host));

    // make sure we don't pull in domains with only a few requests (GTM, GA)
    expect(hosts).toEqual(new Set(['pwa.rocks']));
    // make sure we flag all the rest
    expect(result.details.items).toHaveLength(60);
    // no savings calculated
    expect(result.numericValue).toBeUndefined();
    expect(result.details.overallSavingsMs).toBeUndefined();
    // make sure we have a failing score
    expect(result.score).toEqual(0);
  });
});
