/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import TraceElementsGatherer from '../../../gather/gatherers/trace-elements.js';
import {Driver} from '../../../legacy/gather/driver.js';
import {Connection} from '../../../legacy/gather/connections/connection.js';
import {createTestTrace} from '../../create-test-trace.js';
import {createMockSendCommandFn, createMockOnFn} from '../mock-commands.js';
import {flushAllTimersAndMicrotasks, fnAny, readJson, timers} from '../../test-utils.js';

const animationTrace = readJson('../../fixtures/traces/animation.json', import.meta);

timers.useFakeTimers();

function makeLayoutShiftTraceEvent(score, impactedNodes, had_recent_input = false) { // eslint-disable-line camelcase
  return {
    name: 'LayoutShift',
    cat: 'loading',
    ph: 'I',
    pid: 1111,
    tid: 222,
    ts: 1200,
    args: {
      data: {
        had_recent_input, // eslint-disable-line camelcase
        impacted_nodes: impactedNodes,
        score: score,
      },
      frame: '3C4CBF06AF1ED5B9EAA59BECA70111F4',
    },
  };
}

function makeAnimationTraceEvent(local, ph, data) {
  return {
    args: {
      data,
    },
    cat: 'blink.animations,devtools.timeline,benchmark,rail',
    id2: {
      local,
    },
    name: 'Animation',
    ph,
    pid: 1111,
    scope: 'blink.animations,devtools.timeline,benchmark,rail',
    tid: 222,
    ts: 1300,
  };
}

function makeLCPTraceEvent(nodeId) {
  return {
    args: {
      data: {
        candidateIndex: 1,
        isMainFrame: true,
        navigationId: 'AB3DB6ED51813821034CE7325C0BAC6B',
        nodeId,
        size: 1212,
        type: 'text',
      },
      frame: '3EFC2700D7BC3F4734CAF2F726EFB78C',
    },
    cat: 'loading,rail,devtools.timeline',
    name: 'largestContentfulPaint::Candidate',
    ph: 'R',
    pid: 1111,
    tid: 222,
    ts: 1400,
  };
}

describe('Trace Elements gatherer - GetTopLayoutShiftElements', () => {
  /**
   * @param {Array<{nodeId: number, score: number}>} shiftScores
   */
  function sumScores(shiftScores) {
    let sum = 0;
    shiftScores.forEach(shift => sum += shift.score);
    return sum;
  }

  function expectEqualFloat(actual, expected) {
    const diff = Math.abs(actual - expected);
    expect(diff).toBeLessThanOrEqual(Number.EPSILON);
  }

  it('returns layout shift data sorted by impact area', () => {
    const traceEvents = [
      makeLayoutShiftTraceEvent(1, [
        {
          new_rect: [0, 0, 200, 200],
          node_id: 60,
          old_rect: [0, 0, 200, 100],
        },
        {
          new_rect: [0, 300, 200, 200],
          node_id: 25,
          old_rect: [0, 100, 200, 100],
        },
      ]),
    ];

    const result = TraceElementsGatherer.getTopLayoutShiftElements(traceEvents);
    expect(result).toEqual([
      {nodeId: 25, score: 0.6},
      {nodeId: 60, score: 0.4},
    ]);
    const total = sumScores(result);
    expectEqualFloat(total, 1.0);
  });

  it('does not ignore initial trace events with input', () => {
    const traceEvents = [
      makeLayoutShiftTraceEvent(1, [
        {
          new_rect: [0, 0, 200, 200],
          node_id: 1,
          old_rect: [0, 0, 200, 100],
        },
      ], true),
      makeLayoutShiftTraceEvent(1, [
        {
          new_rect: [0, 0, 200, 200],
          node_id: 2,
          old_rect: [0, 0, 200, 100],
        },
      ], true),
    ];

    const result = TraceElementsGatherer.getTopLayoutShiftElements(traceEvents);
    expect(result).toEqual([
      {nodeId: 1, score: 1},
      {nodeId: 2, score: 1},
    ]);
  });

  it('does ignore later trace events with input', () => {
    const traceEvents = [
      makeLayoutShiftTraceEvent(1, [
        {
          new_rect: [0, 0, 200, 200],
          node_id: 1,
          old_rect: [0, 0, 200, 100],
        },
      ]),
      makeLayoutShiftTraceEvent(1, [
        {
          new_rect: [0, 0, 200, 200],
          node_id: 2,
          old_rect: [0, 0, 200, 100],
        },
      ], true),
    ];

    const result = TraceElementsGatherer.getTopLayoutShiftElements(traceEvents);
    expect(result).toEqual([
      {nodeId: 1, score: 1},
    ]);
  });

  it('correctly ignores trace events with input (complex)', () => {
    const traceEvents = [
      makeLayoutShiftTraceEvent(1, [
        {
          new_rect: [0, 0, 200, 200],
          node_id: 1,
          old_rect: [0, 0, 200, 100],
        },
      ], true),
      makeLayoutShiftTraceEvent(1, [
        {
          new_rect: [0, 0, 200, 200],
          node_id: 2,
          old_rect: [0, 0, 200, 100],
        },
      ], true),
      makeLayoutShiftTraceEvent(1, [
        {
          new_rect: [0, 0, 200, 200],
          node_id: 3,
          old_rect: [0, 0, 200, 100],
        },
      ]),
      makeLayoutShiftTraceEvent(1, [
        {
          new_rect: [0, 0, 200, 200],
          node_id: 4,
          old_rect: [0, 0, 200, 100],
        },
      ]),
      makeLayoutShiftTraceEvent(1, [
        {
          new_rect: [0, 0, 200, 200],
          node_id: 5,
          old_rect: [0, 0, 200, 100],
        },
      ], true),
      makeLayoutShiftTraceEvent(1, [
        {
          new_rect: [0, 0, 200, 200],
          node_id: 6,
          old_rect: [0, 0, 200, 100],
        },
      ], true),
      makeLayoutShiftTraceEvent(1, [
        {
          new_rect: [0, 0, 200, 200],
          node_id: 7,
          old_rect: [0, 0, 200, 100],
        },
      ]),
    ];

    const result = TraceElementsGatherer.getTopLayoutShiftElements(traceEvents);
    expect(result).toEqual([
      {nodeId: 1, score: 1},
      {nodeId: 2, score: 1},
      {nodeId: 3, score: 1},
      {nodeId: 4, score: 1},
      {nodeId: 7, score: 1},
    ]);
  });

  it('combines scores for the same nodeId accross multiple shift events', () => {
    const traceEvents = [
      makeLayoutShiftTraceEvent(1, [
        {
          new_rect: [0, 0, 200, 200],
          node_id: 60,
          old_rect: [0, 0, 200, 100],
        },
        {
          new_rect: [0, 300, 200, 200],
          node_id: 25,
          old_rect: [0, 100, 200, 100],
        },
      ]),
      makeLayoutShiftTraceEvent(0.3, [
        {
          new_rect: [0, 100, 200, 200],
          node_id: 60,
          old_rect: [0, 0, 200, 200],
        },
      ]),
    ];

    const result = TraceElementsGatherer.getTopLayoutShiftElements(traceEvents);
    expect(result).toEqual([
      {nodeId: 60, score: 0.7},
      {nodeId: 25, score: 0.6},
    ]);
    const total = sumScores(result);
    expectEqualFloat(total, 1.3);
  });

  it('returns only the top five values', () => {
    const traceEvents = [
      makeLayoutShiftTraceEvent(1, [
        {
          new_rect: [0, 100, 100, 100],
          node_id: 1,
          old_rect: [0, 0, 100, 100],
        },
        {
          new_rect: [0, 200, 100, 100],
          node_id: 2,
          old_rect: [0, 100, 100, 100],
        },
      ]),
      makeLayoutShiftTraceEvent(1, [
        {
          new_rect: [0, 100, 200, 200],
          node_id: 3,
          old_rect: [0, 100, 200, 200],
        },
      ]),
      makeLayoutShiftTraceEvent(0.75, [
        {
          new_rect: [0, 0, 100, 50],
          node_id: 4,
          old_rect: [0, 0, 100, 100],
        },
        {
          new_rect: [0, 0, 100, 50],
          node_id: 5,
          old_rect: [0, 0, 100, 100],
        },
        {
          new_rect: [0, 0, 100, 200],
          node_id: 6,
          old_rect: [0, 0, 100, 100],
        },
        {
          new_rect: [0, 0, 100, 200],
          node_id: 7,
          old_rect: [0, 0, 100, 100],
        },
      ]),
    ];

    const result = TraceElementsGatherer.getTopLayoutShiftElements(traceEvents);
    expect(result).toEqual([
      {nodeId: 3, score: 1.0},
      {nodeId: 1, score: 0.5},
      {nodeId: 2, score: 0.5},
      {nodeId: 6, score: 0.25},
      {nodeId: 7, score: 0.25},
    ]);
    const total = sumScores(result);
    expectEqualFloat(total, 2.5);
  });
});

describe('Trace Elements gatherer - Animated Elements', () => {
  it('gets animated node ids with non-composited animations', async () => {
    const traceEvents = [
      makeAnimationTraceEvent('0x363db876c1', 'b', {id: '1', nodeId: 5}),
      makeAnimationTraceEvent('0x363db876c1', 'n', {
        compositeFailed: 8192,
        unsupportedProperties: ['height'],
      }),
      makeAnimationTraceEvent('0x363db876c2', 'b', {id: '2', nodeId: 5}),
      makeAnimationTraceEvent('0x363db876c2', 'n', {
        compositeFailed: 8192,
        unsupportedProperties: ['color'],
      }),
      makeAnimationTraceEvent('0x363db876c3', 'b', {id: '3', nodeId: 6}),
      makeAnimationTraceEvent('0x363db876c3', 'n', {
        compositeFailed: 8192,
        unsupportedProperties: ['width'],
      }),
    ];

    const gatherer = new TraceElementsGatherer();
    gatherer.animationIdToName.set('1', 'alpha');
    gatherer.animationIdToName.set('3', 'beta');

    const result = await gatherer.getAnimatedElements(traceEvents);
    expect(result).toEqual([
      {nodeId: 5, animations: [
        {name: 'alpha', failureReasonsMask: 8192, unsupportedProperties: ['height']},
        {failureReasonsMask: 8192, unsupportedProperties: ['color']},
      ]},
      {nodeId: 6, animations: [
        {name: 'beta', failureReasonsMask: 8192, unsupportedProperties: ['width']},
      ]},
    ]);
  });

  it('get non-composited animations with no unsupported properties', async () => {
    const traceEvents = [
      makeAnimationTraceEvent('0x363db876c1', 'b', {id: '1', nodeId: 5}),
      makeAnimationTraceEvent('0x363db876c1', 'n', {
        compositeFailed: 2048,
        unsupportedProperties: [],
      }),
      makeAnimationTraceEvent('0x363db876c2', 'b', {id: '2', nodeId: 5}),
      makeAnimationTraceEvent('0x363db876c2', 'n', {
        compositeFailed: 2048,
        unsupportedProperties: [],
      }),
    ];

    const gatherer = new TraceElementsGatherer();
    gatherer.animationIdToName.set('1', 'alpha');

    const result = await gatherer.getAnimatedElements(traceEvents);
    expect(result).toEqual([
      {nodeId: 5, animations: [
        {name: 'alpha', failureReasonsMask: 2048, unsupportedProperties: []},
        {failureReasonsMask: 2048, unsupportedProperties: []},
      ]},
    ]);
  });

  it('gets animated node ids with composited animations', async () => {
    const traceEvents = [
      makeAnimationTraceEvent('0x363db876c1', 'b', {id: '1', nodeId: 5}),
      makeAnimationTraceEvent('0x363db876c1', 'n', {compositeFailed: 0, unsupportedProperties: []}),
      makeAnimationTraceEvent('0x363db876c2', 'b', {id: '2', nodeId: 5}),
      makeAnimationTraceEvent('0x363db876c2', 'n', {compositeFailed: 0, unsupportedProperties: []}),
      makeAnimationTraceEvent('0x363db876c3', 'b', {id: '3', nodeId: 6}),
      makeAnimationTraceEvent('0x363db876c3', 'n', {compositeFailed: 0, unsupportedProperties: []}),
    ];

    const gatherer = new TraceElementsGatherer();
    gatherer.animationIdToName.set('1', 'alpha');
    gatherer.animationIdToName.set('3', 'beta');

    const result = await gatherer.getAnimatedElements(traceEvents);
    expect(result).toEqual([
      {nodeId: 5, animations: [
        {name: 'alpha', failureReasonsMask: 0, unsupportedProperties: []},
        {failureReasonsMask: 0, unsupportedProperties: []},
      ]},
      {nodeId: 6, animations: [
        {name: 'beta', failureReasonsMask: 0, unsupportedProperties: []},
      ]},
    ]);
  });

  it('properly resolves all node id types', async () => {
    const layoutShiftNodeData = {
      traceEventType: 'layout-shift',
      devtoolsNodePath: '1,HTML,1,BODY,1,DIV',
      selector: 'body > div#shift',
      nodeLabel: 'div',
      snippet: '<div id="shift">',
      boundingRect: {
        top: 50,
        bottom: 200,
        left: 50,
        right: 100,
        width: 50,
        height: 150,
      },
    };
    const animationNodeData = {
      traceEventType: 'animation',
      devtoolsNodePath: '1,HTML,1,BODY,1,DIV',
      selector: 'body > div#animated',
      nodeLabel: 'div',
      snippet: '<div id="animated">',
      boundingRect: {
        top: 60,
        bottom: 200,
        left: 60,
        right: 100,
        width: 40,
        height: 140,
      },
    };
    const LCPNodeData = {
      traceEventType: 'largest-contentful-paint',
      devtoolsNodePath: '1,HTML,1,BODY,1,DIV',
      selector: 'body > div#lcp',
      nodeLabel: 'div',
      snippet: '<div id="lcp">',
      boundingRect: {
        top: 70,
        bottom: 200,
        left: 70,
        right: 100,
        width: 30,
        height: 130,
      },
      type: 'text',
    };
    const connectionStub = new Connection();
    connectionStub.sendCommand = createMockSendCommandFn()
      .mockResponse('DOM.resolveNode', {object: {objectId: 1}})
      .mockResponse('Runtime.callFunctionOn', {result: {value: LCPNodeData}})
      .mockResponse('DOM.resolveNode', {object: {objectId: 2}})
      .mockResponse('Runtime.callFunctionOn', {result: {value: layoutShiftNodeData}})
      .mockResponse('DOM.resolveNode', () => { // 2nd CLS node
        throw Error('No node found');
      })
      .mockResponse('DOM.resolveNode', {object: {objectId: 3}})
      .mockResponse('Runtime.callFunctionOn', {result: {value: animationNodeData}});
    const driver = new Driver(connectionStub);

    const trace = createTestTrace({timeOrigin: 0, traceEnd: 2000});
    trace.traceEvents.push(
      makeLayoutShiftTraceEvent(1, [
        {
          node_id: 4,
          old_rect: [0, 100, 200, 200],
          new_rect: [0, 300, 200, 200], // shift down 200px
        },
        { // 2nd LS node that will be 'no node found'
          node_id: 7,
          old_rect: [400, 100, 200, 200],
          new_rect: [400, 300, 200, 200], // shift down 200px
        },
      ])
    );
    trace.traceEvents.push(makeAnimationTraceEvent('0x363db876c8', 'b', {id: '1', nodeId: 5}));
    trace.traceEvents.push(makeAnimationTraceEvent('0x363db876c8', 'n', {
      compositeFailed: 8192,
      unsupportedProperties: ['height'],
    }));
    trace.traceEvents.push(makeLCPTraceEvent(6));

    const gatherer = new TraceElementsGatherer();
    gatherer.animationIdToName.set('1', 'example');

    const result = await gatherer._getArtifact({driver, computedCache: new Map()}, trace);

    expect(result).toEqual([
      {
        ...LCPNodeData,
        nodeId: 6,
      },
      {
        ...layoutShiftNodeData,
        score: 0.5, // the other CLS node contributed an additional 0.5, but it was 'no node found'
        nodeId: 4,
      },
      {
        ...animationNodeData,
        animations: [
          {name: 'example', failureReasonsMask: 8192, unsupportedProperties: ['height']},
        ],
        nodeId: 5,
      },
    ]);
  });

  it('properly resolves all animated elements in real trace', async () => {
    const LCPNodeData = {
      traceEventType: 'largest-contentful-paint',
      devtoolsNodePath: '1,HTML,1,BODY,2,DIV',
      selector: 'body > div',
      nodeLabel: 'AAAAAAAAAAAAAAAAAAAAAAA',
      snippet: '<div>',
      boundingRect: {
        top: 269,
        bottom: 287,
        left: 8,
        right: 972,
        width: 964,
        height: 18,
      },
      type: 'text',
    };
    const animationNodeData = {
      traceEventType: 'animation',
      devtoolsNodePath: '1,HTML,1,BODY,0,DIV',
      selector: 'body > div#animated-boi',
      nodeLabel: 'div',
      snippet: '<div id="animated-boi">',
      boundingRect: {
        top: 8,
        bottom: 169,
        left: 8,
        right: 155,
        width: 147,
        height: 161,
      },
    };
    const compositedNodeData = {
      traceEventType: 'animation',
      devtoolsNodePath: '1,HTML,1,BODY,1,DIV',
      selector: 'body > div#composited-boi',
      nodeLabel: 'div',
      snippet: '<div id="composited-boi">',
      boundingRect: {
        top: 169,
        bottom: 269,
        left: 8,
        right: 108,
        width: 100,
        height: 100,
      },
    };
    const connectionStub = new Connection();
    connectionStub.sendCommand = createMockSendCommandFn()
      // LCP node
      .mockResponse('DOM.resolveNode', {object: {objectId: 1}})
      .mockResponse('Runtime.callFunctionOn', {result: {value: LCPNodeData}})
      // Animated node
      .mockResponse('DOM.resolveNode', {object: {objectId: 5}})
      .mockResponse('Runtime.callFunctionOn', {result: {value: animationNodeData}})
      // Composited node
      .mockResponse('DOM.resolveNode', {object: {objectId: 7}})
      .mockResponse('Runtime.callFunctionOn', {result: {value: compositedNodeData}});

    const driver = new Driver(connectionStub);
    const gatherer = new TraceElementsGatherer();
    gatherer.animationIdToName.set('2', 'alpha');
    gatherer.animationIdToName.set('3', 'beta');
    gatherer.animationIdToName.set('4', 'gamma');

    const result = await gatherer._getArtifact({driver, computedCache: new Map()}, animationTrace);

    expect(result).toEqual([
      {
        ...LCPNodeData,
        nodeId: 7,
      },
      {
        ...animationNodeData,
        animations: [
          {failureReasonsMask: 8224, unsupportedProperties: ['width']},
          {name: 'alpha', failureReasonsMask: 8224, unsupportedProperties: ['height']},
          {name: 'beta', failureReasonsMask: 8224, unsupportedProperties: ['background-color']},
        ],
        nodeId: 4,
      },
      {
        ...compositedNodeData,
        animations: [
          {name: 'gamma', failureReasonsMask: 0},
        ],
        nodeId: 5,
      },
    ]);
  });

  it('properly handles exceptions', async () => {
    const animationNodeData = {
      traceEventType: 'animation',
      devtoolsNodePath: '1,HTML,1,BODY,1,DIV',
      selector: 'body > div#animated',
      nodeLabel: 'div',
      snippet: '<div id="animated">',
      boundingRect: {
        top: 60,
        bottom: 200,
        left: 60,
        right: 100,
        width: 40,
        height: 140,
      },
    };
    const LCPNodeData = {
      traceEventType: 'largest-contentful-paint',
      devtoolsNodePath: '1,HTML,1,BODY,1,DIV',
      selector: 'body > div#lcp',
      nodeLabel: 'div',
      snippet: '<div id="lcp">',
      boundingRect: {
        top: 70,
        bottom: 200,
        left: 70,
        right: 100,
        width: 30,
        height: 130,
      },
      type: 'text',
    };
    const connectionStub = new Connection();
    connectionStub.sendCommand = createMockSendCommandFn()
      .mockResponse('DOM.resolveNode', {object: {objectId: 1}})
      .mockResponse('Runtime.callFunctionOn', {result: {value: LCPNodeData}})
      // Animation 1
      .mockResponse('DOM.resolveNode', () => {
        throw Error();
      })
      // Animation 2
      .mockResponse('DOM.resolveNode', {object: {objectId: 5}})
      .mockResponse('Runtime.callFunctionOn', {result: {value: animationNodeData}});
    const driver = new Driver(connectionStub);

    const trace = createTestTrace({timeOrigin: 0, traceEnd: 2000});
    trace.traceEvents.push(makeAnimationTraceEvent('0x363db876c8', 'b', {id: '1', nodeId: 5}));
    trace.traceEvents.push(makeAnimationTraceEvent('0x363db876c8', 'n', {
      compositeFailed: 8192,
      unsupportedProperties: ['height'],
    }));
    trace.traceEvents.push(makeAnimationTraceEvent('0x363db876c9', 'b', {id: '2', nodeId: 6}));
    trace.traceEvents.push(makeAnimationTraceEvent('0x363db876c9', 'n', {
      compositeFailed: 8192,
      unsupportedProperties: ['color'],
    }));
    trace.traceEvents.push(makeLCPTraceEvent(7));

    const gatherer = new TraceElementsGatherer();
    gatherer.animationIdToName.set('1', 'notgunnamatter');
    gatherer.animationIdToName.set('2', 'example');

    const result = await gatherer._getArtifact({driver, computedCache: new Map()}, trace);

    expect(result).toEqual([
      {
        ...LCPNodeData,
        nodeId: 7,
      },
      {
        ...animationNodeData,
        animations: [
          {name: 'example', failureReasonsMask: 8192, unsupportedProperties: ['color']},
        ],
        nodeId: 6,
      },
    ]);
  });


  it('properly handles timespans without FCP', async () => {
    const animationNodeData = {
      traceEventType: 'animation',
      devtoolsNodePath: '1,HTML,1,BODY,1,DIV',
      selector: 'body > div#animated',
      nodeLabel: 'div',
      snippet: '<div id="animated">',
      boundingRect: {
        top: 60,
        bottom: 200,
        left: 60,
        right: 100,
        width: 40,
        height: 140,
      },
    };
    const connectionStub = new Connection();
    connectionStub.sendCommand = createMockSendCommandFn()
      // Animation 1
      .mockResponse('DOM.resolveNode', {object: {objectId: 5}})
      .mockResponse('Runtime.callFunctionOn', {result: {value: animationNodeData}});
    const driver = new Driver(connectionStub);

    const trace = createTestTrace({timeOrigin: 0, traceEnd: 2000});
    trace.traceEvents = trace.traceEvents.filter(event => event.name !== 'firstContentfulPaint');
    trace.traceEvents.push(makeAnimationTraceEvent('0x363db876c8', 'b', {id: '1', nodeId: 5}));
    trace.traceEvents.push(makeAnimationTraceEvent('0x363db876c8', 'n', {
      compositeFailed: 8192,
      unsupportedProperties: ['height'],
    }));

    const gatherer = new TraceElementsGatherer();
    gatherer.animationIdToName.set('1', 'example');

    const result = await gatherer._getArtifact({
      driver,
      gatherMode: 'timespan',
      computedCache: new Map(),
    }, trace);

    expect(result).toEqual([
      {
        ...animationNodeData,
        animations: [
          {name: 'example', failureReasonsMask: 8192, unsupportedProperties: ['height']},
        ],
        nodeId: 5,
      },
    ]);
  });
});

describe('instrumentation', () => {
  it('resolves animation name', async () => {
    const connectionStub = new Connection();
    connectionStub.on = createMockOnFn()
      .mockEvent('protocolevent', {
        method: 'Animation.animationStarted',
        params: {animation: {id: '1', name: 'example'}},
      });
    connectionStub.sendCommand = createMockSendCommandFn()
      .mockResponse('Animation.enable')
      .mockResponse('Animation.disable');
    const driver = new Driver(connectionStub);
    const gatherer = new TraceElementsGatherer();
    await gatherer.startInstrumentation({driver, computedCache: new Map()});

    await flushAllTimersAndMicrotasks();

    await gatherer.stopInstrumentation({driver, computedCache: new Map()});

    expect(gatherer.animationIdToName.size).toEqual(1);
    expect(gatherer.animationIdToName.get('1')).toEqual('example');
  });

  it('ignores empty name', async () => {
    const connectionStub = new Connection();
    connectionStub.on = createMockOnFn()
      .mockEvent('protocolevent', {
        method: 'Animation.animationStarted',
        params: {animation: {id: '1', name: ''}},
      });
    connectionStub.sendCommand = createMockSendCommandFn()
      .mockResponse('Animation.enable')
      .mockResponse('Animation.disable');
    const driver = new Driver(connectionStub);
    const gatherer = new TraceElementsGatherer();
    await gatherer.startInstrumentation({driver, computedCache: new Map()});

    await flushAllTimersAndMicrotasks();

    await gatherer.stopInstrumentation({driver, computedCache: new Map()});

    expect(gatherer.animationIdToName.size).toEqual(0);
  });
});

describe('FR compat', () => {
  it('uses loadData in legacy mode', async () => {
    const trace = ['1', '2'];
    const gatherer = new TraceElementsGatherer();
    gatherer._getArtifact = fnAny();
    gatherer.stopInstrumentation = fnAny();

    await gatherer.afterPass({}, {trace});

    expect(gatherer._getArtifact).toHaveBeenCalledWith({dependencies: {}}, trace);
    expect(gatherer.stopInstrumentation).toHaveBeenCalledWith({dependencies: {}});
  });

  it('uses dependency in legacy mode', async () => {
    const trace = ['1', '2'];
    const gatherer = new TraceElementsGatherer();
    gatherer._getArtifact = fnAny();
    gatherer.stopInstrumentation = fnAny();

    const context = {dependencies: {Trace: trace}};
    await gatherer.getArtifact(context);

    expect(gatherer._getArtifact).toHaveBeenCalledWith(context, trace);
    expect(gatherer.stopInstrumentation).not.toHaveBeenCalled();
  });
});
