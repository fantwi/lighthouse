/**
 * @license Copyright 2016 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import assert from 'assert/strict';

import PassiveEventsAudit from '../../../audits/dobetterweb/uses-passive-event-listeners.js';

describe('Page uses passive events listeners where applicable', () => {
  it('fails when scroll blocking listeners should be passive', async () => {
    const text = 'Use passive event listeners when you do not use preventDefault';

    const context = {computedCache: new Map()};
    const auditResult = await PassiveEventsAudit.audit({
      ConsoleMessages: [
        {source: 'violation', url: 'https://example.com/', text},
        {source: 'violation', url: 'https://example2.com/two', text},
        {source: 'violation', url: 'https://example2.com/two', text}, // duplicate
        {source: 'violation', url: 'http://abc.com/', text: 'No document.write'},
        {source: 'deprecation', url: 'https://example.com/two'},
      ],
      SourceMaps: [],
      Scripts: [],
    }, context);

    assert.equal(auditResult.score, 0);
    assert.equal(auditResult.details.items.length, 2);
  });

  it('passes scroll blocking listeners should be passive', async () => {
    const context = {computedCache: new Map()};
    const auditResult = await PassiveEventsAudit.audit({
      ConsoleMessages: [],
      SourceMaps: [],
      Scripts: [],
    }, context);
    assert.equal(auditResult.score, 1);
    assert.equal(auditResult.details.items.length, 0);
  });
});
