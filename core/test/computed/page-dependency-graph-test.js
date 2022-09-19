/**
 * @license Copyright 2017 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import {strict as assert} from 'assert';

import {PageDependencyGraph} from '../../computed/page-dependency-graph.js';
import {BaseNode} from '../../lib/dependency-graph/base-node.js';
import {NetworkRequest} from '../../lib/network-request.js';
import {getURLArtifactFromDevtoolsLog, readJson} from '../test-utils.js';
import {NetworkRecorder} from '../../lib/network-recorder.js';
import {networkRecordsToDevtoolsLog} from '../network-records-to-devtools-log.js';

const sampleTrace = readJson('../fixtures/traces/iframe-m79.trace.json', import.meta);
const sampleDevtoolsLog = readJson('../fixtures/traces/iframe-m79.devtoolslog.json', import.meta);

function createRequest(
  requestId,
  url,
  startTime = 0,
  initiator = null,
  resourceType = NetworkRequest.TYPES.Document
) {
  startTime = startTime / 1000;
  const endTime = startTime + 0.05;
  return {requestId, url, startTime, endTime, initiator, resourceType};
}

const TOPLEVEL_TASK_NAME = 'TaskQueueManager::ProcessTaskFromWorkQueue';
describe('PageDependencyGraph computed artifact:', () => {
  let processedTrace;
  let URL;

  function addTaskEvents(startTs, duration, evts) {
    const mainEvent = {
      name: TOPLEVEL_TASK_NAME,
      tid: 1,
      ts: startTs * 1000,
      dur: duration * 1000,
      args: {},
    };

    processedTrace.mainThreadEvents.push(mainEvent);

    let i = 0;
    for (const evt of evts) {
      i++;
      processedTrace.mainThreadEvents.push({
        name: evt.name,
        ts: (evt.ts * 1000) || (startTs * 1000 + i),
        args: {data: evt.data},
      });
    }
  }

  beforeEach(() => {
    processedTrace = {mainThreadEvents: []};
    URL = {requestedUrl: 'https://example.com/', mainDocumentUrl: 'https://example.com/'};
  });

  describe('#compute_', () => {
    it('should compute the dependency graph', () => {
      const context = {computedCache: new Map()};
      return PageDependencyGraph.request({
        trace: sampleTrace,
        devtoolsLog: sampleDevtoolsLog,
        URL: getURLArtifactFromDevtoolsLog(sampleDevtoolsLog),
      }, context).then(output => {
        assert.ok(output instanceof BaseNode, 'did not return a graph');

        const dependents = output.getDependents();
        const nodeWithNestedDependents = dependents.find(node => node.getDependents().length);
        assert.ok(nodeWithNestedDependents, 'did not link initiators');
      });
    });

    it('should compute the dependency graph with URL backport', () => {
      const context = {computedCache: new Map()};
      return PageDependencyGraph.request({
        trace: sampleTrace,
        devtoolsLog: sampleDevtoolsLog,
      }, context).then(output => {
        assert.ok(output instanceof BaseNode, 'did not return a graph');

        const dependents = output.getDependents();
        const nodeWithNestedDependents = dependents.find(node => node.getDependents().length);
        assert.ok(nodeWithNestedDependents, 'did not link initiators');
      });
    });
  });

  describe('#getDocumentUrls', () => {
    it('should resolve redirects', () => {
      const processedTrace = {
        mainFrameIds: {
          frameId: 'FRAMEID',
        },
      };
      const devtoolsLog = networkRecordsToDevtoolsLog([
        {requestId: '0', url: 'http://example.com/'},
        {requestId: '0:redirect', url: 'https://example.com/'},
        {requestId: '0:redirect:redirect', url: 'https://www.example.com/'},
        {requestId: '1', url: 'https://page.example.com/'},
      ]);
      devtoolsLog.push({
        method: 'Page.frameNavigated',
        params: {
          frame: {
            id: 'FRAMEID',
            url: 'https://www.example.com/',
          },
        },
      });
      devtoolsLog.push({
        method: 'Page.frameNavigated',
        params: {
          frame: {
            id: 'FRAMEID',
            url: 'https://page.example.com/',
          },
        },
      });

      // Round trip the network records to fill in redirect info.
      const networkRecords = NetworkRecorder.recordsFromLogs(devtoolsLog);

      const URL = PageDependencyGraph.getDocumentUrls(devtoolsLog, networkRecords, processedTrace);
      expect(URL).toEqual({
        requestedUrl: 'http://example.com/',
        mainDocumentUrl: 'https://page.example.com/',
      });
    });
  });

  describe('#getNetworkNodeOutput', () => {
    const request1 = createRequest(1, 'https://example.com/');
    const request2 = createRequest(2, 'https://example.com/page');
    const request3 = createRequest(3, 'https://example.com/page');
    const networkRecords = [request1, request2, request3];

    it('should create network nodes', () => {
      const networkNodeOutput = PageDependencyGraph.getNetworkNodeOutput(networkRecords);
      for (let i = 0; i < networkRecords.length; i++) {
        const node = networkNodeOutput.nodes[i];
        assert.ok(node, `did not create node at index ${i}`);
        assert.equal(node.id, i + 1);
        assert.equal(node.type, 'network');
        assert.equal(node.record, networkRecords[i]);
      }
    });

    it('should index nodes by ID', () => {
      const networkNodeOutput = PageDependencyGraph.getNetworkNodeOutput(networkRecords);
      const indexedById = networkNodeOutput.idToNodeMap;
      for (const record of networkRecords) {
        assert.equal(indexedById.get(record.requestId).record, record);
      }
    });

    it('should index nodes by URL', () => {
      const networkNodeOutput = PageDependencyGraph.getNetworkNodeOutput(networkRecords);
      const nodes = networkNodeOutput.nodes;
      const indexedByUrl = networkNodeOutput.urlToNodeMap;
      assert.deepEqual(indexedByUrl.get('https://example.com/'), [nodes[0]]);
      assert.deepEqual(indexedByUrl.get('https://example.com/page'), [nodes[1], nodes[2]]);
    });

    it('should index nodes by frame', () => {
      const networkNodeOutput = PageDependencyGraph.getNetworkNodeOutput([
        {...createRequest(1, 'https://example.com/'), documentURL: 'https://example.com/', frameId: 'A'},
        {...createRequest(2, 'https://example.com/page'), documentURL: 'https://example.com/', frameId: 'A'},
        {...createRequest(3, 'https://example.com/page2'), documentURL: 'https://example.com/page2', frameId: 'C',
          resourceType: NetworkRequest.TYPES.XHR},
        {...createRequest(4, 'https://example.com/page3'), documentURL: 'https://example.com/page3', frameId: 'D'},
        {...createRequest(4, 'https://example.com/page4'), documentURL: 'https://example.com/page4', frameId: undefined},
        {...createRequest(4, 'https://example.com/page5'), documentURL: 'https://example.com/page5', frameId: 'collision'},
        {...createRequest(4, 'https://example.com/page6'), documentURL: 'https://example.com/page6', frameId: 'collision'},
      ]);

      const nodes = networkNodeOutput.nodes;
      const indexedByFrame = networkNodeOutput.frameIdToNodeMap;
      expect([...indexedByFrame.entries()]).toEqual([
        ['A', nodes[0]],
        ['D', nodes[3]],
        ['collision', null],
      ]);
    });
  });

  describe('#getCPUNodes', () => {
    it('should create CPU nodes', () => {
      addTaskEvents(0, 100, [
        {name: 'MyCustomEvent'},
        {name: 'OtherEvent'},
        {name: 'OutsideTheWindow', ts: 200},
        {name: 'OrphanedEvent'}, // should be ignored since we stopped at OutsideTheWindow
      ]);

      addTaskEvents(250, 50, [
        {name: 'LaterEvent'},
      ]);

      assert.equal(processedTrace.mainThreadEvents.length, 7);
      const nodes = PageDependencyGraph.getCPUNodes(processedTrace);
      assert.equal(nodes.length, 2);

      const node1 = nodes[0];
      assert.equal(node1.id, '1.0');
      assert.equal(node1.type, 'cpu');
      assert.equal(node1.event, processedTrace.mainThreadEvents[0]);
      assert.equal(node1.childEvents.length, 2);
      assert.equal(node1.childEvents[1].name, 'OtherEvent');

      const node2 = nodes[1];
      assert.equal(node2.id, '1.250000');
      assert.equal(node2.type, 'cpu');
      assert.equal(node2.event, processedTrace.mainThreadEvents[5]);
      assert.equal(node2.childEvents.length, 1);
      assert.equal(node2.childEvents[0].name, 'LaterEvent');
    });
  });

  describe('#createGraph', () => {
    it('should compute a simple network graph', () => {
      const request1 = createRequest(1, 'https://example.com/', 0);
      const request2 = createRequest(2, 'https://example.com/page', 5);
      const request3 = createRequest(3, 'https://example.com/page2', 5);
      const request4 = createRequest(4, 'https://example.com/page3', 10, {url: 'https://example.com/page'});
      const networkRecords = [request1, request2, request3, request4];

      addTaskEvents(0, 0, []);

      const graph = PageDependencyGraph.createGraph(processedTrace, networkRecords, URL);
      const nodes = [];
      graph.traverse(node => nodes.push(node));

      assert.equal(nodes.length, 4);
      assert.deepEqual(nodes.map(node => node.id), [1, 2, 3, 4]);
      assert.deepEqual(nodes[0].getDependencies(), []);
      assert.deepEqual(nodes[1].getDependencies(), [nodes[0]]);
      assert.deepEqual(nodes[2].getDependencies(), [nodes[0]]);
      assert.deepEqual(nodes[3].getDependencies(), [nodes[1]]);
    });

    it('should compute a simple network and CPU graph', () => {
      const request1 = createRequest(1, 'https://example.com/', 0);
      const request2 = createRequest(2, 'https://example.com/page', 50);
      const request3 = createRequest(3, 'https://example.com/page2', 50);
      const request4 = createRequest(4, 'https://example.com/page3', 300, null, NetworkRequest.TYPES.XHR);
      const networkRecords = [request1, request2, request3, request4];

      addTaskEvents(200, 200, [
        {name: 'EvaluateScript', data: {url: 'https://example.com/page'}},
        {name: 'ResourceSendRequest', data: {requestId: 4}},
      ]);

      addTaskEvents(700, 50, [
        {name: 'InvalidateLayout', data: {stackTrace: [{url: 'https://example.com/page2'}]}},
        {name: 'XHRReadyStateChange', data: {readyState: 4, url: 'https://example.com/page3'}},
      ]);

      const graph = PageDependencyGraph.createGraph(processedTrace, networkRecords, URL);
      const nodes = [];
      graph.traverse(node => nodes.push(node));

      const getIds = nodes => nodes.map(node => node.id);
      const getDependencyIds = node => getIds(node.getDependencies());

      assert.equal(nodes.length, 6);
      assert.deepEqual(getIds(nodes), [1, 2, 3, 4, '1.200000', '1.700000']);
      assert.deepEqual(getDependencyIds(nodes[0]), []);
      assert.deepEqual(getDependencyIds(nodes[1]), [1]);
      assert.deepEqual(getDependencyIds(nodes[2]), [1]);
      assert.deepEqual(getDependencyIds(nodes[3]), [1, '1.200000']);
      assert.deepEqual(getDependencyIds(nodes[4]), [2]);
      assert.deepEqual(getDependencyIds(nodes[5]), [3, 4]);
    });

    it('should compute a network graph with duplicate URLs', () => {
      const request1 = createRequest(1, 'https://example.com/', 0);
      const request2 = createRequest(2, 'https://example.com/page', 5);
      const request3 = createRequest(3, 'https://example.com/page', 5); // duplicate URL
      const request4 = createRequest(4, 'https://example.com/page3', 10, {url: 'https://example.com/page'});
      const networkRecords = [request1, request2, request3, request4];

      addTaskEvents(0, 0, []);

      const graph = PageDependencyGraph.createGraph(processedTrace, networkRecords, URL);
      const nodes = [];
      graph.traverse(node => nodes.push(node));

      assert.equal(nodes.length, 4);
      assert.deepEqual(nodes.map(node => node.id), [1, 2, 3, 4]);
      assert.deepEqual(nodes[0].getDependencies(), []);
      assert.deepEqual(nodes[1].getDependencies(), [nodes[0]]);
      assert.deepEqual(nodes[2].getDependencies(), [nodes[0]]);
      assert.deepEqual(nodes[3].getDependencies(), [nodes[0]]); // should depend on rootNode instead
    });

    it('should be forgiving without cyclic dependencies', () => {
      const request1 = createRequest(1, 'https://example.com/', 0);
      const request2 = createRequest(2, 'https://example.com/page', 250, null, NetworkRequest.TYPES.XHR);
      const request3 = createRequest(3, 'https://example.com/page2', 210);
      const request4 = createRequest(4, 'https://example.com/page3', 590);
      const request5 = createRequest(5, 'https://example.com/page4', 595, null, NetworkRequest.TYPES.XHR);
      const networkRecords = [request1, request2, request3, request4, request5];

      addTaskEvents(200, 200, [
        // CPU 1.2 should depend on Network 1
        {name: 'EvaluateScript', data: {url: 'https://example.com/'}},

        // Network 2 should depend on CPU 1.2, but 1.2 should not depend on Network 1
        {name: 'ResourceSendRequest', data: {requestId: 2}},
        {name: 'XHRReadyStateChange', data: {readyState: 4, url: 'https://example.com/page'}},

        // CPU 1.2 should not depend on Network 3 because it starts after CPU 1.2
        {name: 'EvaluateScript', data: {url: 'https://example.com/page2'}},
      ]);

      addTaskEvents(600, 150, [
        // CPU 1.6 should depend on Network 4 even though it ends at 410ms
        {name: 'InvalidateLayout', data: {stackTrace: [{url: 'https://example.com/page3'}]}},
        // Network 5 should not depend on CPU 1.6 because it started before CPU 1.6
        {name: 'ResourceSendRequest', data: {requestId: 5}},
      ]);

      const graph = PageDependencyGraph.createGraph(processedTrace, networkRecords, URL);
      const nodes = [];
      graph.traverse(node => nodes.push(node));

      const getDependencyIds = node => node.getDependencies().map(node => node.id);

      assert.equal(nodes.length, 7);
      assert.deepEqual(getDependencyIds(nodes[0]), []);
      assert.deepEqual(getDependencyIds(nodes[1]), [1, '1.200000']);
      assert.deepEqual(getDependencyIds(nodes[2]), [1]);
      assert.deepEqual(getDependencyIds(nodes[3]), [1]);
      assert.deepEqual(getDependencyIds(nodes[4]), [1]);
      assert.deepEqual(getDependencyIds(nodes[5]), [1]);
      assert.deepEqual(getDependencyIds(nodes[6]), [4]);
    });

    it('should not install timer dependency on itself', () => {
      const request1 = createRequest(1, 'https://example.com/', 0);
      const networkRecords = [request1];

      addTaskEvents(200, 200, [
        // CPU 1.2 should depend on Network 1
        {name: 'EvaluateScript', data: {url: 'https://example.com/'}},
        // CPU 1.2 will install and fire it's own timer, but should not depend on itself
        {name: 'TimerInstall', data: {timerId: 'timer1'}},
        {name: 'TimerFire', data: {timerId: 'timer1'}},
      ]);

      const graph = PageDependencyGraph.createGraph(processedTrace, networkRecords, URL);
      const nodes = [];
      graph.traverse(node => nodes.push(node));

      const getDependencyIds = node => node.getDependencies().map(node => node.id);

      assert.equal(nodes.length, 2);
      assert.deepEqual(getDependencyIds(nodes[0]), []);
      assert.deepEqual(getDependencyIds(nodes[1]), [1]);
    });

    it('should prune short tasks', () => {
      const request0 = createRequest(0, 'https://example.com/page0', 0);
      const request1 = createRequest(1, 'https://example.com/', 100, null, NetworkRequest.TYPES.Script);
      const request2 = createRequest(2, 'https://example.com/page', 200, null, NetworkRequest.TYPES.XHR);
      const request3 = createRequest(3, 'https://example.com/page2', 300, null, NetworkRequest.TYPES.Script);
      const request4 = createRequest(4, 'https://example.com/page3', 400, null, NetworkRequest.TYPES.XHR);
      const networkRecords = [request0, request1, request2, request3, request4];
      URL = {requestedUrl: 'https://example.com/page0', mainDocumentUrl: 'https://example.com/page0'};

      // Long task, should be kept in the output.
      addTaskEvents(120, 50, [
        {name: 'EvaluateScript', data: {url: 'https://example.com/'}},
        {name: 'ResourceSendRequest', data: {requestId: 2}},
        {name: 'XHRReadyStateChange', data: {readyState: 4, url: 'https://example.com/page'}},
      ]);

      // Short task, should be pruned, but the 3->4 relationship should be retained
      addTaskEvents(350, 5, [
        {name: 'EvaluateScript', data: {url: 'https://example.com/page2'}},
        {name: 'ResourceSendRequest', data: {requestId: 4}},
        {name: 'XHRReadyStateChange', data: {readyState: 4, url: 'https://example.com/page3'}},
      ]);

      const graph = PageDependencyGraph.createGraph(processedTrace, networkRecords, URL);
      const nodes = [];
      graph.traverse(node => nodes.push(node));

      const getDependencyIds = node => node.getDependencies().map(node => node.id);

      assert.equal(nodes.length, 6);

      assert.deepEqual(getDependencyIds(nodes[0]), []);
      assert.deepEqual(getDependencyIds(nodes[1]), [0]);
      assert.deepEqual(getDependencyIds(nodes[2]), [0, '1.120000']);
      assert.deepEqual(getDependencyIds(nodes[3]), [0]);
      assert.deepEqual(getDependencyIds(nodes[4]), [0, 3]);

      assert.equal('1.120000', nodes[5].id);
      assert.deepEqual(getDependencyIds(nodes[5]), [1]);
    });

    it('should not prune highly-connected short tasks', () => {
      const request0 = createRequest(0, 'https://example.com/page0', 0);
      const request1 = {
        ...createRequest(1, 'https://example.com/', 100, null, NetworkRequest.TYPES.Document),
        documentURL: 'https://example.com/',
        frameId: 'frame1',
      };
      const request2 = {
        ...createRequest(2, 'https://example.com/page', 200, null, NetworkRequest.TYPES.Script),
        documentURL: 'https://example.com/',
        frameId: 'frame1',
      };
      const request3 = createRequest(3, 'https://example.com/page2', 300, null, NetworkRequest.TYPES.XHR);
      const request4 = createRequest(4, 'https://example.com/page3', 400, null, NetworkRequest.TYPES.XHR);
      const networkRecords = [request0, request1, request2, request3, request4];
      URL = {requestedUrl: 'https://example.com/page0', mainDocumentUrl: 'https://example.com/page0'};

      // Short task, evaluates script (2) and sends two XHRs.
      addTaskEvents(220, 5, [
        {name: 'EvaluateScript', data: {url: 'https://example.com/page', frame: 'frame1'}},

        {name: 'ResourceSendRequest', data: {requestId: 3}},
        {name: 'XHRReadyStateChange', data: {readyState: 4, url: 'https://example.com/page2'}},

        {name: 'ResourceSendRequest', data: {requestId: 4}},
        {name: 'XHRReadyStateChange', data: {readyState: 4, url: 'https://example.com/page3'}},
      ]);

      const graph = PageDependencyGraph.createGraph(processedTrace, networkRecords, URL);
      const nodes = [];
      graph.traverse(node => nodes.push(node));

      const getDependencyIds = node => node.getDependencies().map(node => node.id);

      assert.equal(nodes.length, 6);

      assert.deepEqual(getDependencyIds(nodes[0]), []);
      assert.deepEqual(getDependencyIds(nodes[1]), [0]);
      assert.deepEqual(getDependencyIds(nodes[2]), [0]);
      assert.deepEqual(getDependencyIds(nodes[3]), [0, '1.220000']);
      assert.deepEqual(getDependencyIds(nodes[4]), [0, '1.220000']);

      assert.equal('1.220000', nodes[5].id);
      assert.deepEqual(getDependencyIds(nodes[5]), [1, 2]);
    });

    it('should not prune short, first tasks of critical events', () => {
      const request0 = createRequest(0, 'https://example.com/page0', 0);
      const networkRecords = [request0];
      URL = {requestedUrl: 'https://example.com/page0', mainDocumentUrl: 'https://example.com/page0'};

      const makeShortEvent = firstEventName => {
        const startTs = processedTrace.mainThreadEvents.length * 100;
        addTaskEvents(startTs, 5, [
          {name: firstEventName, data: {url: 'https://example.com/page0'}},
        ]);
      };

      const criticalEventNames = [
        'Paint',
        'Layout',
        'ParseHTML',
      ];
      for (const eventName of criticalEventNames) {
        makeShortEvent(eventName);
        makeShortEvent(eventName);
      }

      const graph = PageDependencyGraph.createGraph(processedTrace, networkRecords, URL);
      const cpuNodes = [];
      graph.traverse(node => node.type === 'cpu' && cpuNodes.push(node));

      expect(cpuNodes.map(node => {
        return {
          id: node.id,
          name: node.childEvents[0].name,
        };
      })).toEqual([
        {
          id: '1.0',
          name: 'Paint',
        },
        {
          // ID jumps by 4 between each because each node has 2 CPU tasks and we skip the 2nd of each event type
          id: '1.400000',
          name: 'Layout',
        },
        {
          id: '1.800000',
          name: 'ParseHTML',
        },
      ]);
    });

    it('should set isMainDocument on request with mainDocumentUrl', () => {
      const request1 = createRequest(1, 'https://example.com/', 0, null, NetworkRequest.TYPES.Other);
      const request2 = createRequest(2, 'https://example.com/page', 5, null, NetworkRequest.TYPES.Document);
      // Add in another unrelated + early request to make sure we pick the correct chain
      const request3 = createRequest(3, 'https://example.com/page2', 0, null, NetworkRequest.TYPES.Other);
      request2.redirects = [request1];
      const networkRecords = [request1, request2, request3];
      URL = {requestedUrl: 'https://example.com/', mainDocumentUrl: 'https://example.com/page'};

      addTaskEvents(0, 0, []);

      const graph = PageDependencyGraph.createGraph(processedTrace, networkRecords, URL);
      const nodes = [];
      graph.traverse(node => nodes.push(node));

      assert.equal(nodes.length, 3);
      assert.equal(nodes[0].id, 1);
      assert.equal(nodes[0].isMainDocument(), false);
      assert.equal(nodes[1].isMainDocument(), true);
      assert.equal(nodes[2].isMainDocument(), false);
    });

    it('should link up script initiators', () => {
      const request1 = createRequest(1, 'https://example.com/', 0);
      const request2 = createRequest(2, 'https://example.com/page', 5);
      const request3 = createRequest(3, 'https://example.com/page2', 5);
      const request4 = createRequest(4, 'https://example.com/page3', 20);
      // Set multiple initiator requests through script stack.
      request4.initiator = {
        type: 'script',
        stack: {callFrames: [{url: 'https://example.com/page'}], parent: {parent: {callFrames: [{url: 'https://example.com/page2'}]}}},
      };
      // Also set the initiatorRequest that Lighthouse's network-recorder.js creates.
      // This should be ignored and only used as a fallback.
      request4.initiatorRequest = request1;
      const networkRecords = [request1, request2, request3, request4];

      addTaskEvents(0, 0, []);

      const graph = PageDependencyGraph.createGraph(processedTrace, networkRecords, URL);
      const nodes = [];
      graph.traverse(node => nodes.push(node));

      assert.equal(nodes.length, 4);
      assert.deepEqual(nodes.map(node => node.id), [1, 2, 3, 4]);
      assert.deepEqual(nodes[0].getDependencies(), []);
      assert.deepEqual(nodes[1].getDependencies(), [nodes[0]]);
      assert.deepEqual(nodes[2].getDependencies(), [nodes[0]]);
      assert.deepEqual(nodes[3].getDependencies(), [nodes[1], nodes[2]]);
    });

    it('should link up script initiators only when timing is valid', () => {
      const request1 = createRequest(1, 'https://example.com/', 0);
      const request2 = createRequest(2, 'https://example.com/page', 500);
      const request3 = createRequest(3, 'https://example.com/page2', 500);
      const request4 = createRequest(4, 'https://example.com/page3', 20);
      request4.initiator = {
        type: 'script',
        stack: {callFrames: [{url: 'https://example.com/page'}], parent: {parent: {callFrames: [{url: 'https://example.com/page2'}]}}},
      };
      const networkRecords = [request1, request2, request3, request4];

      addTaskEvents(0, 0, []);

      const graph = PageDependencyGraph.createGraph(processedTrace, networkRecords, URL);
      const nodes = [];
      graph.traverse(node => nodes.push(node));

      assert.equal(nodes.length, 4);
      assert.deepEqual(nodes.map(node => node.id), [1, 2, 3, 4]);
      assert.deepEqual(nodes[0].getDependencies(), []);
      assert.deepEqual(nodes[1].getDependencies(), [nodes[0]]);
      assert.deepEqual(nodes[2].getDependencies(), [nodes[0]]);
      assert.deepEqual(nodes[3].getDependencies(), [nodes[0]]);
    });

    it('should link up script initiators with prefetch requests', () => {
      const request1 = createRequest(1, 'https://a.com/1', 0);
      const request2Prefetch = createRequest(2, 'https://a.com/js', 5);
      const request2Fetch = createRequest(3, 'https://a.com/js', 10);
      const request3 = createRequest(4, 'https://a.com/4', 20);
      // Set the initiator to an ambiguous URL (there are 2 requests for https://a.com/js)
      request3.initiator = {
        type: 'script',
        stack: {callFrames: [{url: 'https://a.com/js'}], parent: {parent: {callFrames: [{url: 'js'}]}}},
      };
      // Set the initiatorRequest that it should fallback to.
      request3.initiatorRequest = request2Fetch;
      const networkRecords = [request1, request2Prefetch, request2Fetch, request3];
      URL = {requestedUrl: 'https://a.com/1', mainDocumentUrl: 'https://a.com/1'};

      addTaskEvents(0, 0, []);

      const graph = PageDependencyGraph.createGraph(processedTrace, networkRecords, URL);
      const nodes = [];
      graph.traverse(node => nodes.push(node));

      assert.equal(nodes.length, 4);
      assert.deepEqual(nodes.map(node => node.id), [1, 2, 3, 4]);
      assert.deepEqual(nodes[0].getDependencies(), []);
      assert.deepEqual(nodes[1].getDependencies(), [nodes[0]]);
      assert.deepEqual(nodes[2].getDependencies(), [nodes[0]]);
      assert.deepEqual(nodes[3].getDependencies(), [nodes[2]]);
    });

    it('should not link up initiators with circular dependencies', () => {
      const rootRequest = createRequest(1, 'https://a.com', 0);
      // jsRequest1 initiated by jsRequest2
      //              *AND*
      // jsRequest2 initiated by jsRequest1
      const jsRequest1 = createRequest(2, 'https://a.com/js1', 1, {url: 'https://a.com/js2'});
      const jsRequest2 = createRequest(3, 'https://a.com/js2', 1, {url: 'https://a.com/js1'});
      const networkRecords = [rootRequest, jsRequest1, jsRequest2];
      URL = {requestedUrl: 'https://a.com', mainDocumentUrl: 'https://a.com'};

      addTaskEvents(0, 0, []);

      const graph = PageDependencyGraph.createGraph(processedTrace, networkRecords, URL);
      const nodes = [];
      graph.traverse(node => nodes.push(node));
      nodes.sort((a, b) => a.id - b.id);

      assert.equal(nodes.length, 3);
      assert.deepEqual(nodes.map(node => node.id), [1, 2, 3]);
      assert.deepEqual(nodes[0].getDependencies(), []);
      // We don't know which of the initiators to trust in a cycle, so for now we
      // trust the earliest one (mostly because it's simplest).
      // In the wild so far we've only seen this for self-referential relationships.
      // If the evidence changes, then feel free to change these expectations :)
      assert.deepEqual(nodes[1].getDependencies(), [nodes[2]]);
      assert.deepEqual(nodes[2].getDependencies(), [nodes[0]]);
    });

    it('should not link up initiatorRequests with circular dependencies', () => {
      const rootRequest = createRequest(1, 'https://a.com', 0);
      // jsRequest1 initiated by jsRequest2
      //              *AND*
      // jsRequest2 initiated by jsRequest1
      const jsRequest1 = createRequest(2, 'https://a.com/js1', 1);
      const jsRequest2 = createRequest(3, 'https://a.com/js2', 1);
      jsRequest1.initiatorRequest = jsRequest2;
      jsRequest2.initiatorRequest = jsRequest1;
      const networkRecords = [rootRequest, jsRequest1, jsRequest2];
      URL = {requestedUrl: 'https://a.com', mainDocumentUrl: 'https://a.com'};

      addTaskEvents(0, 0, []);

      const graph = PageDependencyGraph.createGraph(processedTrace, networkRecords, URL);
      const nodes = [];
      graph.traverse(node => nodes.push(node));
      nodes.sort((a, b) => a.id - b.id);

      assert.equal(nodes.length, 3);
      assert.deepEqual(nodes.map(node => node.id), [1, 2, 3]);
      assert.deepEqual(nodes[0].getDependencies(), []);
      assert.deepEqual(nodes[1].getDependencies(), [nodes[2]]);
      assert.deepEqual(nodes[2].getDependencies(), [nodes[0]]);
    });

    it('should find root if it is not the first node', () => {
      const request1 = createRequest(1, 'https://example.com/', 0, null, NetworkRequest.TYPES.Other);
      const request2 = createRequest(2, 'https://example.com/page', 5, null, NetworkRequest.TYPES.Document);
      const networkRecords = [request1, request2];
      URL = {requestedUrl: 'https://example.com/page', mainDocumentUrl: 'https://example.com/page'};

      // Evaluated before root request.
      addTaskEvents(0.1, 50, [
        {name: 'EvaluateScript'},
      ]);

      const graph = PageDependencyGraph.createGraph(processedTrace, networkRecords, URL);
      const nodes = [];
      graph.traverse(node => nodes.push(node));

      assert.equal(nodes.length, 1);
      assert.deepEqual(nodes.map(node => node.id), [2]);
      assert.deepEqual(nodes[0].getDependencies(), []);
      assert.deepEqual(nodes[0].getDependents(), []);
    });
  });
});
