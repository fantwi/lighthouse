/**
 * @license Copyright 2016 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import assert from 'assert/strict';

import GeolocationOnStartAudit from '../../../audits/dobetterweb/geolocation-on-start.js';

describe('UX: geolocation audit', () => {
  it('fails when geolocation has been automatically requested', async () => {
    const text = 'Do not request geolocation permission without a user action.';

    const context = {computedCache: new Map()};
    const auditResult = await GeolocationOnStartAudit.audit({
      ConsoleMessages: [
        {source: 'violation', url: 'https://example.com/', text},
        {source: 'violation', url: 'https://example2.com/two', text},
        {source: 'violation', url: 'http://abc.com/', text: 'No document.write'},
        {source: 'deprecation', url: 'https://example.com/two'},
      ],
      SourceMaps: [],
      Scripts: [],
    }, context);
    assert.equal(auditResult.score, 0);
    assert.equal(auditResult.details.items.length, 2);
  });

  it('passes when geolocation has not been automatically requested', async () => {
    const context = {computedCache: new Map()};
    const auditResult = await GeolocationOnStartAudit.audit({
      ConsoleMessages: [],
      SourceMaps: [],
      Scripts: [],
    }, context);
    assert.equal(auditResult.score, 1);
    assert.equal(auditResult.details.items.length, 0);
  });
});
