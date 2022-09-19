/**
 * @license Copyright 2019 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import {strict as assert} from 'assert';

import {ResourceSummary} from '../../computed/resource-summary.js';
import {networkRecordsToDevtoolsLog} from '../network-records-to-devtools-log.js';

function mockArtifacts(networkRecords) {
  return {
    devtoolsLog: networkRecordsToDevtoolsLog(networkRecords),
    URL: {
      requestedUrl: networkRecords[0].url,
      mainDocumentUrl: networkRecords[0].url,
      finalUrl: networkRecords[0].url,
    },
    budgets: null,
  };
}

describe('Resource summary computed', () => {
  let artifacts;
  let context;
  beforeEach(() => {
    artifacts = mockArtifacts([
      {url: 'http://example.com/file.html', resourceType: 'Document', transferSize: 30},
      {url: 'http://example.com/app.js', resourceType: 'Script', transferSize: 10},
      {url: 'http://cdn.example.com/script.js', resourceType: 'Script', transferSize: 50},
      {url: 'http://third-party.com/file.jpg', resourceType: 'Image', transferSize: 70},
    ]);
    context = {computedCache: new Map()};
  });

  it('includes all resource types, regardless of whether page contains them', async () => {
    const result = await ResourceSummary.request(artifacts, context);
    assert.equal(Object.keys(result).length, 9);
  });

  it('sets size and count correctly', async () => {
    const result = await ResourceSummary.request(artifacts, context);
    assert.equal(result.script.count, 2);
    assert.equal(result.script.transferSize, 10 + 50);
  });

  it('sets "total" resource metrics correctly', async () => {
    const result = await ResourceSummary.request(artifacts, context);
    assert.equal(result.total.count, 4);
    assert.equal(result.total.transferSize, 30 + 10 + 50 + 70);
  });

  it('sets "other" resource metrics correctly', async () => {
    artifacts = mockArtifacts([
      {url: 'http://example.com/file.html', resourceType: 'Document', transferSize: 30},
      {url: 'http://third-party.com/another-file.html', resourceType: 'Manifest', transferSize: 50},
    ]);
    const result = await ResourceSummary.request(artifacts, context);

    assert.equal(result.other.count, 1);
    assert.equal(result.other.transferSize, 50);
  });

  it('ignores /favicon.ico', async () => {
    artifacts = mockArtifacts([
      {url: 'http://example.com/file.html', resourceType: 'Document', transferSize: 30},
      {url: 'http://example.com/favicon.ico', resourceType: 'Other', transferSize: 10},
    ]);
    const result = await ResourceSummary.request(artifacts, context);

    assert.equal(result.total.count, 1);
    assert.equal(result.total.transferSize, 30);
  });

  it('ignores records with non-network protocols', async () => {
    artifacts.budgets = [{
      path: '/',
      options: {
        firstPartyHostnames: ['example.com'],
      },
    }];

    artifacts = mockArtifacts([
      {url: 'http://example.com/file.html', resourceType: 'Document', transferSize: 30},
      {url: 'data:image/png;base64,iVBORw0KGgoAA', resourceType: 'Image', transferSize: 10,
        protocol: 'data'},
      {url: 'blob:http://www.example.com/dflskdfjlkj', resourceType: 'Other', transferSize: 99,
        protocol: 'blob'},
      {url: 'intent://example.com', resourceType: 'Other', transferSize: 1,
        protocol: 'intent'},
    ]);

    const result = await ResourceSummary.request(artifacts, context);
    assert.equal(result.total.count, 1);
    assert.equal(result.total.transferSize, 30);
  });

  describe('identifying third-party resources', () => {
    beforeEach(() => {
      artifacts = mockArtifacts([
        {url: 'http://example.com/file.html', resourceType: 'Document', transferSize: 30},
        {url: 'http://cdn.example.com/app.js', resourceType: 'Script', transferSize: 10},
        {url: 'http://my-cdn.com/styles.css', resourceType: 'Stylesheet', transferSize: 25},
        {url: 'http://third-party.com/script.js', resourceType: 'Script', transferSize: 50},
        {url: 'http://third-party.com/file.jpg', resourceType: 'Image', transferSize: 70},
      ]);
      context = {computedCache: new Map(), settings: {}};
    });

    describe('when firstPartyHostnames is not set', () => {
      it('the root domain and all subdomains are considered first-party', async () => {
        artifacts.budgets = null;
        const result = await ResourceSummary.request(artifacts, context);
        expect(result['third-party'].transferSize).toBe(25 + 50 + 70);
        expect(result['third-party'].count).toBe(3);
      });

      it('correctly identifies root domain when second-level TLDs are used,', async () => {
        artifacts = mockArtifacts([
          {url: 'http://shopping-mall.co.uk/file.html', resourceType: 'Document', transferSize: 30},
          {url: 'http://es.shopping-mall.co.uk/file.html', resourceType: 'Script', transferSize: 7},
          {url: 'http://co.uk', resourceType: 'Script', transferSize: 10},
        ]);
        artifacts.budgets = null;
        const result = await ResourceSummary.request(artifacts, context);
        expect(result['third-party'].transferSize).toBe(10);
        expect(result['third-party'].count).toBe(1);
      });
    });

    describe('when firstPartyHostnames is set', () => {
      const allResourcesSize = 30 + 10 + 25 + 50 + 70;
      const allResourcesCount = 5;
      it('handles subdomain hostnames correctly', async () => {
        artifacts.budgets = [{
          path: '/',
          options: {
            firstPartyHostnames: ['cdn.example.com'],
          },
        }];
        const result = await ResourceSummary.request(artifacts, context);
        expect(result['third-party'].transferSize).toBe(allResourcesSize - 10);
        expect(result['third-party'].count).toBe(allResourcesCount - 1);
      });

      it('handles wildcard expressions correctly', async () => {
        artifacts.budgets = [{
          path: '/',
          options: {
            // Matches example.com and cdn.example.com
            firstPartyHostnames: ['*.example.com'],
          },
        }];
        const result = await ResourceSummary.request(artifacts, context);
        expect(result['third-party'].transferSize).toBe(allResourcesSize - 30 - 10);
        expect(result['third-party'].count).toBe(allResourcesCount - 2);
      });

      it('handles root domain hostname correctly', async () => {
        artifacts.budgets = [{
          path: '/',
          options: {
            // Matches example.com; does not match cdn.example.com
            firstPartyHostnames: ['example.com'],
          },
        }];
        const result = await ResourceSummary.request(artifacts, context);
        expect(result['third-party'].transferSize).toBe(allResourcesSize - 30);
        expect(result['third-party'].count).toBe(allResourcesCount - 1);
      });

      it('handles multiple hostnames correctly', async () => {
        artifacts.budgets = [{
          path: '/',
          options: {
            firstPartyHostnames: ['example.com', 'my-cdn.com'],
          },
        }];
        const result = await ResourceSummary.request(artifacts, context);
        expect(result['third-party'].transferSize).toBe(allResourcesSize - 30 - 25);
        expect(result['third-party'].count).toBe(allResourcesCount - 2);
      });

      it('handles duplication of hostnames', async () => {
        artifacts.budgets = [{
          path: '/',
          options: {
            firstPartyHostnames: ['my-cdn.com', 'my-cdn.com', 'my-cdn.com'],
          },
        }];
        const result = await ResourceSummary.request(artifacts, context);
        expect(result['third-party'].transferSize).toBe(allResourcesSize - 25);
        expect(result['third-party'].count).toBe(allResourcesCount - 1);
      });

      it('handles logical duplication of hostnames', async () => {
        artifacts.budgets = [{
          path: '/',
          options: {
            firstPartyHostnames: ['example.com', '*.example.com', 'cdn.example.com'],
          },
        }];
        const result = await ResourceSummary.request(artifacts, context);
        expect(result['third-party'].transferSize).toBe(allResourcesSize - 30 - 10);
        expect(result['third-party'].count).toBe(allResourcesCount - 2);
      });

      it('handles using top-level domains as firstPartyHostnames correctly', async () => {
        artifacts.budgets = [{
          path: '/',
          options: {
            firstPartyHostnames: ['*.com'],
          },
        }];
        const result = await ResourceSummary.request(artifacts, context);
        expect(result['third-party'].transferSize).toBe(0);
        expect(result['third-party'].count).toBe(0);
      });
    });
  });
});
