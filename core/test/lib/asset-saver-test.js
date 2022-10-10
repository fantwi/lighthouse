/**
 * @license Copyright 2016 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import assert from 'assert/strict';
import fs from 'fs';

import * as assetSaver from '../../lib/asset-saver.js';
import {MetricTraceEvents} from '../../lib/traces/metric-trace-events.js';
import {LighthouseError} from '../../lib/lh-error.js';
import {Audit} from '../../audits/audit.js';
import {LH_ROOT} from '../../../root.js';
import {getModuleDirectory} from '../../../esm-utils.js';
import {readJson} from '../test-utils.js';

const traceEvents = readJson('../fixtures/traces/progressive-app.json', import.meta);
const dbwTrace = readJson('../results/artifacts/defaultPass.trace.json', import.meta);
const dbwResults = readJson('../results/sample_v2.json', import.meta);
const fullTraceObj = readJson('../fixtures/traces/progressive-app-m60.json', import.meta);
const devtoolsLog = readJson('../fixtures/traces/progressive-app-m60.devtools.log.json', import.meta);

const moduleDir = getModuleDirectory(import.meta);

// deepStrictEqual can hang on a full trace, we assert trace same-ness like so
function assertTraceEventsEqual(traceEventsA, traceEventsB) {
  assert.equal(traceEventsA.length, traceEventsB.length);
  traceEventsA.forEach((evt, i) => {
    assert.deepStrictEqual(evt, traceEventsB[i]);
  });
}
describe('asset-saver helper', () => {
  describe('saves files', function() {
    const tmpDir = `${LH_ROOT}/.tmp/asset-saver-test`;

    before(() => {
      fs.mkdirSync(tmpDir, {recursive: true});
      const artifacts = {
        devtoolsLogs: {
          [Audit.DEFAULT_PASS]: [{message: 'first'}, {message: 'second'}],
        },
        traces: {
          [Audit.DEFAULT_PASS]: {
            traceEvents,
          },
        },
      };

      return assetSaver.saveAssets(artifacts, dbwResults.audits, `${tmpDir}/the_file`);
    });

    it('trace file saved to disk with trace events and extra fakeEvents', () => {
      const traceFilename = tmpDir + '/the_file-0.trace.json';
      const traceFileContents = fs.readFileSync(traceFilename, 'utf8');
      const traceEventsOnDisk = JSON.parse(traceFileContents).traceEvents;
      const traceEventsWithoutExtrasOnDisk = traceEventsOnDisk.slice(0, traceEvents.length);
      const traceEventsFake = traceEventsOnDisk.slice(traceEvents.length);
      assertTraceEventsEqual(traceEventsWithoutExtrasOnDisk, traceEvents);
      assert.equal(traceEventsFake.length, 18);
      fs.unlinkSync(traceFilename);
    });

    it('devtools log file saved to disk with data', () => {
      const filename = tmpDir + '/the_file-0.devtoolslog.json';
      const fileContents = fs.readFileSync(filename, 'utf8');
      assert.ok(fileContents.includes('"message": "first"'));
      fs.unlinkSync(filename);
    });
  });

  describe('prepareAssets', () => {
    it('adds fake events to trace', () => {
      const countEvents = trace => trace.traceEvents.length;
      const mockArtifacts = {
        devtoolsLogs: {},
        traces: {
          defaultPass: dbwTrace,
        },
      };
      const beforeCount = countEvents(dbwTrace);
      return assetSaver.prepareAssets(mockArtifacts, dbwResults.audits).then(preparedAssets => {
        const afterCount = countEvents(preparedAssets[0].traceData);
        const metricsMinusTimeOrigin = MetricTraceEvents.metricsDefinitions.length - 1;
        assert.equal(afterCount, beforeCount + (2 * metricsMinusTimeOrigin));
      });
    });
  });

  describe('saveTrace', () => {
    const traceFilename = `${LH_ROOT}/.tmp/test-trace-0.json`;

    before(() => {
      fs.mkdirSync(`${LH_ROOT}/.tmp`, {recursive: true});
    });

    afterEach(() => {
      fs.unlinkSync(traceFilename);
    });

    it('prints traces with an event per line', async () => {
      const trace = {
        traceEvents: [
          {args: {}, cat: 'devtools.timeline', pid: 1, ts: 2},
          {args: {}, cat: 'v8', pid: 1, ts: 3},
          {args: {IsMainFrame: true}, cat: 'v8', pid: 1, ts: 5},
          {args: {data: {encodedDataLength: 20, requestId: '1.22'}}, pid: 1, ts: 6},
        ],
        metadata: {'cpu-model': 9001, 'network-type': 'Unknown'},
      };
      await assetSaver.saveTrace(trace, traceFilename);

      const traceFileContents = fs.readFileSync(traceFilename, 'utf8');
      expect(traceFileContents).toEqual(
`{
"traceEvents": [
  {"args":{},"cat":"devtools.timeline","pid":1,"ts":2},
  {"args":{},"cat":"v8","pid":1,"ts":3},
  {"args":{"IsMainFrame":true},"cat":"v8","pid":1,"ts":5},
  {"args":{"data":{"encodedDataLength":20,"requestId":"1.22"}},"pid":1,"ts":6}
],
"metadata": {
  "cpu-model": 9001,
  "network-type": "Unknown"
}}
`);
    });

    it('correctly saves a trace with metadata to disk', () => {
      return assetSaver.saveTrace(fullTraceObj, traceFilename)
        .then(_ => {
          const traceFileContents = fs.readFileSync(traceFilename, 'utf8');
          const traceEventsFromDisk = JSON.parse(traceFileContents).traceEvents;
          assertTraceEventsEqual(traceEventsFromDisk, fullTraceObj.traceEvents);
        });
    });

    it('correctly saves a trace with no trace events to disk', () => {
      const trace = {
        traceEvents: [],
        metadata: {
          'clock-domain': 'MAC_MACH_ABSOLUTE_TIME',
          'cpu-family': 6,
          'cpu-model': 70,
          'cpu-stepping': 1,
          'field-trials': [],
        },
      };

      return assetSaver.saveTrace(trace, traceFilename)
        .then(_ => {
          const traceFileContents = fs.readFileSync(traceFilename, 'utf8');
          assert.deepStrictEqual(JSON.parse(traceFileContents), trace);
        });
    });

    it('correctly saves a trace with multiple extra properties to disk', () => {
      const trace = {
        traceEvents,
        metadata: fullTraceObj.metadata,
        someProp: 555,
        anotherProp: {
          unlikely: {
            nested: [
              'value',
            ],
          },
        },
      };

      return assetSaver.saveTrace(trace, traceFilename)
        .then(_ => {
          const traceFileContents = fs.readFileSync(traceFilename, 'utf8');
          const traceEventsFromDisk = JSON.parse(traceFileContents).traceEvents;
          assertTraceEventsEqual(traceEventsFromDisk, trace.traceEvents);
        });
    });

    it('can save traces over 256MB (slow)', () => {
      // Create a trace that wil be longer than 256MB when stringified, the hard
      // limit of a string in v8.
      // https://mobile.twitter.com/bmeurer/status/879276976523157505
      const baseEventsLength = JSON.stringify(traceEvents).length;
      const countNeeded = Math.ceil(Math.pow(2, 28) / baseEventsLength);
      let longTraceEvents = [];
      for (let i = 0; i < countNeeded; i++) {
        longTraceEvents = longTraceEvents.concat(traceEvents);
      }
      const trace = {
        traceEvents: longTraceEvents,
      };

      return assetSaver.saveTrace(trace, traceFilename)
        .then(_ => {
          const fileStats = fs.lstatSync(traceFilename);
          assert.ok(fileStats.size > Math.pow(2, 28));
        });
    }, 40 * 1000);
  });

  describe('saveDevtoolsLog', () => {
    const devtoolsLogFilename = 'test-devtoolslog-0.json';

    afterEach(() => {
      fs.unlinkSync(devtoolsLogFilename);
    });

    it('prints devtoolsLogs with an event per line', async () => {
      const devtoolsLog = [
        {method: 'Network.requestServedFromCache', params: {requestId: '1.22'}},
        {method: 'Network.responseReceived', params: {status: 301, headers: {':method': 'POST'}}},
      ];
      await assetSaver.saveDevtoolsLog(devtoolsLog, devtoolsLogFilename);

      const devtoolsLogFileContents = fs.readFileSync(devtoolsLogFilename, 'utf8');
      expect(devtoolsLogFileContents).toEqual(
`[
  {"method":"Network.requestServedFromCache","params":{"requestId":"1.22"}},
  {"method":"Network.responseReceived","params":{"status":301,"headers":{":method":"POST"}}}
]
`);
    });
  });

  describe('loadArtifacts', () => {
    it('loads artifacts from disk', async () => {
      const artifactsPath = moduleDir + '/../fixtures/artifacts/perflog/';
      const artifacts = await assetSaver.loadArtifacts(artifactsPath);
      assert.strictEqual(artifacts.LighthouseRunWarnings.length, 2);
      assert.strictEqual(artifacts.URL.requestedUrl, 'https://www.reddit.com/r/nba');
      assert.strictEqual(artifacts.devtoolsLogs.defaultPass.length, 555);
      assert.strictEqual(artifacts.traces.defaultPass.traceEvents.length, 13);
    });
  });

  describe('JSON serialization', () => {
    const outputPath = moduleDir + '/json-serialization-test-data/';

    afterEach(() => {
      fs.rmSync(outputPath, {recursive: true, force: true});
    });

    it('round trips saved artifacts', async () => {
      const artifactsPath = moduleDir + '/../results/artifacts/';
      const originalArtifacts = await assetSaver.loadArtifacts(artifactsPath);

      await assetSaver.saveArtifacts(originalArtifacts, outputPath);
      const roundTripArtifacts = await assetSaver.loadArtifacts(outputPath);
      expect(roundTripArtifacts).toStrictEqual(originalArtifacts);
    });

    it('deletes existing artifact files before saving', async () => {
      // Write some fake artifact files to start with.
      fs.mkdirSync(outputPath, {recursive: true});
      fs.writeFileSync(`${outputPath}/artifacts.json`, '{"BenchmarkIndex": 1731.5}');
      const existingTracePath = `${outputPath}/bestPass.trace.json`;
      fs.writeFileSync(existingTracePath, '{"traceEvents": []}');
      const existingDevtoolslogPath = `${outputPath}/bestPass.devtoolslog.json`;
      fs.writeFileSync(existingDevtoolslogPath, '[]');

      const artifactsPath = moduleDir + '/../results/artifacts/';
      const originalArtifacts = await assetSaver.loadArtifacts(artifactsPath);

      await assetSaver.saveArtifacts(originalArtifacts, outputPath);

      expect(fs.existsSync(existingDevtoolslogPath)).toBe(false);
      expect(fs.existsSync(existingTracePath)).toBe(false);

      const roundTripArtifacts = await assetSaver.loadArtifacts(outputPath);
      expect(roundTripArtifacts).toStrictEqual(originalArtifacts);
    });

    it('round trips artifacts with an Error member', async () => {
      const error = new Error('Connection refused by server');
      // test code to make sure e.g. Node errors get serialized well.
      error.code = 'ECONNREFUSED';

      const artifacts = {
        traces: {},
        devtoolsLogs: {},
        ViewportDimensions: error,
      };

      await assetSaver.saveArtifacts(artifacts, outputPath);
      const roundTripArtifacts = await assetSaver.loadArtifacts(outputPath);
      expect(roundTripArtifacts).toStrictEqual(artifacts);

      expect(roundTripArtifacts.ViewportDimensions).toBeInstanceOf(Error);
      expect(roundTripArtifacts.ViewportDimensions.code).toEqual('ECONNREFUSED');
      expect(roundTripArtifacts.ViewportDimensions.stack).toMatch(
        /^Error: Connection refused by server.*test[\\/]lib[\\/]asset-saver-test\.js/s);
    });

    it('round trips artifacts with an LighthouseError member', async () => {
      // Use an LighthouseError that has an ICU replacement.
      const protocolMethod = 'Page.getFastness';
      const lhError = new LighthouseError(
        LighthouseError.errors.PROTOCOL_TIMEOUT, {protocolMethod});

      const artifacts = {
        traces: {},
        devtoolsLogs: {},
        ScriptElements: lhError,
      };

      await assetSaver.saveArtifacts(artifacts, outputPath);
      const roundTripArtifacts = await assetSaver.loadArtifacts(outputPath);
      expect(roundTripArtifacts).toStrictEqual(artifacts);

      expect(roundTripArtifacts.ScriptElements).toBeInstanceOf(LighthouseError);
      expect(roundTripArtifacts.ScriptElements.code).toEqual('PROTOCOL_TIMEOUT');
      expect(roundTripArtifacts.ScriptElements.protocolMethod).toEqual(protocolMethod);
      expect(roundTripArtifacts.ScriptElements.stack).toMatch(
          /^LighthouseError: PROTOCOL_TIMEOUT.*test[\\/]lib[\\/]asset-saver-test\.js/s);
      expect(roundTripArtifacts.ScriptElements.friendlyMessage)
        .toBeDisplayString(/\(Method: Page\.getFastness\)/);
    });

    it('saves artifacts in files concluding with a newline', async () => {
      const artifacts = {
        devtoolsLogs: {
          [Audit.DEFAULT_PASS]: [{method: 'first'}, {method: 'second'}],
        },
        traces: {
          [Audit.DEFAULT_PASS]: {traceEvents: traceEvents.slice(0, 100)},
        },
        RobotsTxt: {status: 404, content: null},
      };
      await assetSaver.saveArtifacts(artifacts, outputPath);

      const artifactFilenames = fs.readdirSync(outputPath);
      expect(artifactFilenames.length).toBeGreaterThanOrEqual(3);
      for (const artifactFilename of artifactFilenames) {
        expect(artifactFilename).toMatch(/\.json$/);
        const contents = fs.readFileSync(`${outputPath}/${artifactFilename}`, 'utf8');
        expect(contents).toMatch(/\n$/);
      }
    });
  });

  describe('saveLanternNetworkData', () => {
    const outputFilename = 'test-lantern-network-data.json';

    afterEach(() => {
      fs.unlinkSync(outputFilename);
    });

    it('saves the network analysis to disk', async () => {
      await assetSaver.saveLanternNetworkData(devtoolsLog, outputFilename);

      const results = JSON.parse(fs.readFileSync(outputFilename, 'utf8'));

      expect(results).toEqual({
        additionalRttByOrigin: {
          'https://pwa.rocks': expect.any(Number),
          'https://www.google-analytics.com': expect.any(Number),
          'https://www.googletagmanager.com': expect.any(Number),
        },
        serverResponseTimeByOrigin: {
          'https://pwa.rocks': expect.any(Number),
          'https://www.google-analytics.com': expect.any(Number),
          'https://www.googletagmanager.com': expect.any(Number),
        },
      });
    });
  });
});
