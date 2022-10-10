/**
 * @license Copyright 2016 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import assert from 'assert/strict';

import Audit from '../../audits/is-on-https.js';
import {networkRecordsToDevtoolsLog} from '../network-records-to-devtools-log.js';

describe('Security: HTTPS audit', () => {
  function getArtifacts(networkRecords, mixedContentIssues) {
    const devtoolsLog = networkRecordsToDevtoolsLog(networkRecords);
    return {
      devtoolsLogs: {[Audit.DEFAULT_PASS]: devtoolsLog},
      InspectorIssues: {mixedContentIssue: mixedContentIssues || []},
    };
  }

  it('fails when there is more than one insecure record', () => {
    return Audit.audit(getArtifacts([
      {url: 'https://google.com/', parsedURL: {scheme: 'https', host: 'google.com'}},
      {url: 'http://insecure.com/image.jpeg', parsedURL: {scheme: 'http', host: 'insecure.com'}},
      {url: 'http://insecure.com/image.jpeg', parsedURL: {scheme: 'http', host: 'insecure.com'}}, // should be de-duped
      {url: 'http://insecure.com/image2.jpeg', parsedURL: {scheme: 'http', host: 'insecure.com'}},
      {url: 'https://google.com/', parsedURL: {scheme: 'https', host: 'google.com'}},
    ]), {computedCache: new Map()}).then(result => {
      assert.strictEqual(result.score, 0);
      expect(result.displayValue).toBeDisplayString('2 insecure requests found');
      assert.strictEqual(result.details.items.length, 2);
    });
  });

  it('fails when there is one insecure record', () => {
    return Audit.audit(getArtifacts([
      {url: 'https://google.com/', parsedURL: {scheme: 'https', host: 'google.com'}},
      {url: 'http://insecure.com/image.jpeg', parsedURL: {scheme: 'http', host: 'insecure.com'}},
      {url: 'https://google.com/', parsedURL: {scheme: 'https', host: 'google.com'}},
    ]), {computedCache: new Map()}).then(result => {
      assert.strictEqual(result.score, 0);
      expect(result.displayValue).toBeDisplayString('1 insecure request found');
      expect(result.details.items[0]).toMatchObject({url: 'http://insecure.com/image.jpeg'});
    });
  });

  it('passes when all records are secure', () => {
    return Audit.audit(getArtifacts([
      {url: 'https://google.com/', parsedURL: {scheme: 'https', host: 'google.com'}},
      {url: 'http://localhost/image.jpeg', parsedURL: {scheme: 'http', host: 'localhost'}},
      {url: 'https://google.com/', parsedURL: {scheme: 'https', host: 'google.com'}},
    ]), {computedCache: new Map()}).then(result => {
      assert.strictEqual(result.score, 1);
    });
  });

  it('augmented with mixed-content InspectorIssues', async () => {
    const networkRecords = [
      {url: 'https://google.com/', parsedURL: {scheme: 'https', host: 'google.com'}},
      {url: 'http://localhost/image.jpeg', parsedURL: {scheme: 'http', host: 'localhost'}},
      {url: 'http://google.com/', parsedURL: {scheme: 'http', host: 'google.com'}},
    ];
    const mixedContentIssues = [
      {insecureURL: 'http://localhost/image.jpeg', resolutionStatus: 'MixedContentBlocked'},
      {insecureURL: 'http://localhost/image2.jpeg', resolutionStatus: 'MixedContentBlockedLOL'},
    ];
    const artifacts = getArtifacts(networkRecords, mixedContentIssues);
    const result = await Audit.audit(artifacts, {computedCache: new Map()});

    expect(result.details.items).toHaveLength(3);

    expect(result.details.items[0]).toMatchObject({
      url: 'http://google.com/',
      resolution: expect.toBeDisplayString('Allowed'),
    });

    expect(result.details.items[1]).toMatchObject({
      url: 'http://localhost/image.jpeg',
      resolution: expect.toBeDisplayString('Blocked'),
    });

    // Unknown blocked resolution string is used as fallback.
    expect(result.details.items[2]).toMatchObject({
      url: 'http://localhost/image2.jpeg',
      resolution: 'MixedContentBlockedLOL',
    });

    expect(result.score).toBe(0);
  });
});
