/**
 * @license Copyright 2018 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import NetworkRequests from '../../audits/network-requests.js';
import {networkRecordsToDevtoolsLog} from '../network-records-to-devtools-log.js';
import {readJson} from '../test-utils.js';

const cutoffLoadDevtoolsLog = readJson('../fixtures/traces/cutoff-load-m83.devtoolslog.json', import.meta);

const GatherContext = {
  gatherMode: 'navigation',
};

describe('Network requests audit', () => {
  it('should report finished and unfinished network requests', async () => {
    const artifacts = {
      devtoolsLogs: {
        [NetworkRequests.DEFAULT_PASS]: cutoffLoadDevtoolsLog,
      },
      URL: {mainDocumentUrl: 'https://googlechrome.github.io/lighthouse/viewer/'},
      GatherContext,
    };

    const output = await NetworkRequests.audit(artifacts, {computedCache: new Map()});

    expect(output.details.items[0]).toMatchObject({
      startTime: 0,
      endTime: expect.toBeApproximately(701, 0),
      finished: true,
      transferSize: 11358,
      resourceSize: 39471,
      statusCode: 200,
      mimeType: 'text/html',
      resourceType: 'Document',
      priority: 'VeryHigh',
    });
    expect(output.details.items[2]).toMatchObject({
      startTime: expect.toBeApproximately(711, 0),
      endTime: expect.toBeApproximately(1289, 0),
      finished: false,
      transferSize: 26441,
      resourceSize: 0,
      statusCode: 200,
      mimeType: 'image/png',
      resourceType: 'Image',
      priority: 'Low',
    });
    expect(output.details.items[5]).toMatchObject({
      startTime: expect.toBeApproximately(717, 0),
      endTime: expect.toBeApproximately(1296, 0),
      finished: false,
      transferSize: 58571,
      resourceSize: 0,
      statusCode: 200,
      mimeType: 'application/javascript',
      resourceType: 'Script',
      priority: 'Medium',
    });

    expect(output.details.debugData).toStrictEqual({
      type: 'debugdata',
      networkStartTimeTs: 360725781425,
    });
  });

  it('should handle times correctly', async () => {
    const records = [
      {url: 'https://example.com/0', startTime: 15.0, endTime: 15.5},
      {url: 'https://example.com/1', startTime: 15.5, endTime: -1},
    ];

    const artifacts = {
      devtoolsLogs: {
        [NetworkRequests.DEFAULT_PASS]: networkRecordsToDevtoolsLog(records),
      },
      URL: {mainDocumentUrl: 'https://example.com/0'},
      GatherContext,
    };
    const output = await NetworkRequests.audit(artifacts, {computedCache: new Map()});

    expect(output.details.items).toMatchObject([{
      startTime: 0,
      endTime: 500,
      finished: true,
    }, {
      startTime: 500,
      endTime: undefined,
      finished: true,
    }]);
  });

  it('should report if records are from the main frame', async () => {
    const records = [
      {url: 'https://example.com/'},
      {url: 'https://iframed.local/', frameId: '71D866EC199B90A2E0B2D9CF88DCBC4E'},
    ];

    const artifacts = {
      devtoolsLogs: {
        [NetworkRequests.DEFAULT_PASS]: networkRecordsToDevtoolsLog(records),
      },
      URL: {mainDocumentUrl: 'https://example.com/'},
      GatherContext,
    };
    const output = await NetworkRequests.audit(artifacts, {computedCache: new Map()});

    expect(output.details.items).toMatchObject([{
      url: 'https://example.com/',
      experimentalFromMainFrame: true,
    }, {
      url: 'https://iframed.local/',
      experimentalFromMainFrame: undefined,
    }]);
  });

  it('should not include main frame information outside of navigations', async () => {
    const records = [
      {url: 'https://example.com/'},
      {url: 'https://iframed.local/', frameId: '71D866EC199B90A2E0B2D9CF88DCBC4E'},
    ];

    const artifacts = {
      devtoolsLogs: {
        [NetworkRequests.DEFAULT_PASS]: networkRecordsToDevtoolsLog(records),
      },
      URL: {mainDocumentUrl: 'https://example.com/'},
      GatherContext: {gatherMode: 'timespan'},
    };
    const output = await NetworkRequests.audit(artifacts, {computedCache: new Map()});

    expect(output.details.items).toMatchObject([{
      url: 'https://example.com/',
      experimentalFromMainFrame: undefined,
    }, {
      url: 'https://iframed.local/',
      experimentalFromMainFrame: undefined,
    }]);
  });

  it('should include if network request was preloaded', async () => {
    const records = [
      {url: 'https://example.com/'},
      {url: 'https://example.com/img.jpg', isLinkPreload: true},
    ];

    const artifacts = {
      devtoolsLogs: {
        [NetworkRequests.DEFAULT_PASS]: networkRecordsToDevtoolsLog(records),
      },
      URL: {mainDocumentUrl: 'https://example.com/'},
      GatherContext,
    };
    const output = await NetworkRequests.audit(artifacts, {computedCache: new Map()});

    expect(output.details.items).toMatchObject([{
      url: 'https://example.com/',
      isLinkPreload: undefined,
    }, {
      url: 'https://example.com/img.jpg',
      isLinkPreload: true,
    }]);
  });
});
