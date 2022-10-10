/**
 * @license Copyright 2016 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import assert from 'assert/strict';

import RedirectsAudit from '../../audits/redirects.js';
import {networkRecordsToDevtoolsLog} from '../network-records-to-devtools-log.js';
import {createTestTrace} from '../create-test-trace.js';

const FAILING_THREE_REDIRECTS = [{
  requestId: '1',
  startTime: 0,
  priority: 'VeryHigh',
  url: 'http://example.com/',
  timing: {receiveHeadersEnd: 11},
}, {
  requestId: '1:redirect',
  startTime: 1,
  priority: 'VeryHigh',
  url: 'https://example.com/',
  timing: {receiveHeadersEnd: 12},
}, {
  requestId: '1:redirect:redirect',
  startTime: 2,
  priority: 'VeryHigh',
  url: 'https://m.example.com/',
  timing: {receiveHeadersEnd: 17},
}, {
  requestId: '1:redirect:redirect:redirect',
  startTime: 3,
  priority: 'VeryHigh',
  url: 'https://m.example.com/final',
  timing: {receiveHeadersEnd: 19},
}];

const FAILING_TWO_REDIRECTS = [{
  requestId: '1',
  startTime: 445,
  priority: 'VeryHigh',
  url: 'http://lisairish.com/',
  timing: {receiveHeadersEnd: 446},
}, {
  requestId: '1:redirect',
  startTime: 446,
  priority: 'VeryHigh',
  url: 'https://lisairish.com/',
  timing: {receiveHeadersEnd: 447},
}, {
  requestId: '1:redirect:redirect',
  startTime: 447,
  priority: 'VeryHigh',
  url: 'https://www.lisairish.com/',
  timing: {receiveHeadersEnd: 448},
}];

const SUCCESS_ONE_REDIRECT = [{
  requestId: '1',
  startTime: 135,
  priority: 'VeryHigh',
  url: 'https://lisairish.com/',
  timing: {receiveHeadersEnd: 136},
}, {
  requestId: '1:redirect',
  startTime: 136,
  priority: 'VeryHigh',
  url: 'https://www.lisairish.com/',
  timing: {receiveHeadersEnd: 139},
}];

const SUCCESS_NOREDIRECT = [{
  requestId: '1',
  startTime: 135.873,
  priority: 'VeryHigh',
  url: 'https://www.google.com/',
  timing: {receiveHeadersEnd: 140},
}];

const FAILING_CLIENTSIDE = [
  {
    requestId: '1',
    startTime: 445,
    priority: 'VeryHigh',
    url: 'http://lisairish.com/',
    timing: {receiveHeadersEnd: 446},
  },
  {
    requestId: '1:redirect',
    startTime: 446,
    priority: 'VeryHigh',
    url: 'https://lisairish.com/',
    timing: {receiveHeadersEnd: 447},
  },
  {
    requestId: '2',
    startTime: 447,
    priority: 'VeryHigh',
    url: 'https://www.lisairish.com/',
    timing: {receiveHeadersEnd: 448},
  },
];

describe('Performance: Redirects audit', () => {
  const mockArtifacts = (networkRecords, finalDisplayedUrl) => {
    const devtoolsLog = networkRecordsToDevtoolsLog(networkRecords);
    const frameUrl = networkRecords[0].url;

    return {
      GatherContext: {gatherMode: 'navigation'},
      traces: {defaultPass: createTestTrace({frameUrl, traceEnd: 5000})},
      devtoolsLogs: {defaultPass: devtoolsLog},
      URL: {
        requestedUrl: networkRecords[0].url,
        mainDocumentUrl: finalDisplayedUrl,
        finalDisplayedUrl,
      },
    };
  };

  it('fails when client-side redirects detected', async () => {
    const context = {settings: {}, computedCache: new Map()};
    const artifacts = mockArtifacts(FAILING_CLIENTSIDE, 'https://www.lisairish.com/');

    const traceEvents = artifacts.traces.defaultPass.traceEvents;
    const navStart = traceEvents.find(e => e.name === 'navigationStart');
    const secondNavStart = JSON.parse(JSON.stringify(navStart));
    traceEvents.push(secondNavStart);
    navStart.args.data.isLoadingMainFrame = true;
    navStart.args.data.documentLoaderURL = 'http://lisairish.com/';
    secondNavStart.ts++;
    secondNavStart.args.data.isLoadingMainFrame = true;
    secondNavStart.args.data.documentLoaderURL = 'https://www.lisairish.com/';

    const output = await RedirectsAudit.audit(artifacts, context);
    expect(output.details.items).toHaveLength(3);
    expect(Math.round(output.score * 100) / 100).toMatchInlineSnapshot(`0.35`);
    expect(output.numericValue).toMatchInlineSnapshot(`2000`);
  });

  it('uses lantern timings when throttlingMethod is simulate', async () => {
    const artifacts = mockArtifacts(FAILING_THREE_REDIRECTS, 'https://m.example.com/final');
    const context = {settings: {throttlingMethod: 'simulate'}, computedCache: new Map()};
    const output = await RedirectsAudit.audit(artifacts, context);
    expect(output.details.items).toHaveLength(4);
    expect(output.details.items.map(item => [item.url, item.wastedMs])).toMatchInlineSnapshot(`
      Array [
        Array [
          "http://example.com/",
          630,
        ],
        Array [
          "https://example.com/",
          480,
        ],
        Array [
          "https://m.example.com/",
          780,
        ],
        Array [
          "https://m.example.com/final",
          0,
        ],
      ]
    `);
    expect(output.numericValue).toMatchInlineSnapshot(`1890`);
  });

  it('fails when 3 redirects detected', () => {
    const artifacts = mockArtifacts(FAILING_THREE_REDIRECTS, 'https://m.example.com/final');
    const context = {settings: {}, computedCache: new Map()};
    return RedirectsAudit.audit(artifacts, context).then(output => {
      expect(output.details.items).toHaveLength(4);
      expect(Math.round(output.score * 100) / 100).toMatchInlineSnapshot(`0.24`);
      expect(output.numericValue).toMatchInlineSnapshot(`3000`);
    });
  });

  it('fails when 2 redirects detected', () => {
    const artifacts = mockArtifacts(FAILING_TWO_REDIRECTS, 'https://www.lisairish.com/');
    const context = {settings: {}, computedCache: new Map()};
    return RedirectsAudit.audit(artifacts, context).then(output => {
      expect(output.details.items).toHaveLength(3);
      expect(Math.round(output.score * 100) / 100).toMatchInlineSnapshot(`0.35`);
      expect(output.numericValue).toMatchInlineSnapshot(`2000`);
    });
  });

  it('passes when one redirect detected', () => {
    const artifacts = mockArtifacts(SUCCESS_ONE_REDIRECT, 'https://www.lisairish.com/');
    const context = {settings: {}, computedCache: new Map()};
    return RedirectsAudit.audit(artifacts, context).then(output => {
      // If === 1 redirect, perfect score is expected, regardless of latency
      // We will still generate a table and show wasted time
      expect(output.details.items).toHaveLength(2);
      expect(output.score).toEqual(1);
      expect(output.numericValue).toMatchInlineSnapshot(`1000`);
    });
  });

  it('passes when no redirect detected', () => {
    const artifacts = mockArtifacts(SUCCESS_NOREDIRECT, 'https://www.google.com/');
    const context = {settings: {}, computedCache: new Map()};
    return RedirectsAudit.audit(artifacts, context).then(output => {
      assert.equal(output.score, 1);
      assert.equal(output.details.items.length, 0);
      assert.equal(output.numericValue, 0);
    });
  });
});
