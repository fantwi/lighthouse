/**
 * @license Copyright 2017 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import assert from 'assert/strict';

import HTTPStatusCodeAudit from '../../../audits/seo/http-status-code.js';
import {networkRecordsToDevtoolsLog} from '../../network-records-to-devtools-log.js';

describe('SEO: HTTP code audit', () => {
  it('fails when status code is unsuccesfull', () => {
    const statusCodes = [403, 404, 500];

    const allRuns = statusCodes.map(statusCode => {
      const mainDocumentUrl = 'https://example.com';
      const mainResource = {
        url: mainDocumentUrl,
        statusCode,
      };
      const devtoolsLog = networkRecordsToDevtoolsLog([mainResource]);

      const artifacts = {
        GatherContext: {gatherMode: 'timespan'},
        devtoolsLogs: {[HTTPStatusCodeAudit.DEFAULT_PASS]: devtoolsLog},
        URL: {mainDocumentUrl},
      };

      return HTTPStatusCodeAudit.audit(artifacts, {computedCache: new Map()}).then(auditResult => {
        assert.equal(auditResult.score, 0);
        assert.ok(auditResult.displayValue.includes(statusCode), false);
      });
    });

    return Promise.all(allRuns);
  });

  it('passes when status code is successful', () => {
    const mainDocumentUrl = 'https://example.com';
    const mainResource = {
      url: mainDocumentUrl,
      statusCode: 200,
    };
    const devtoolsLog = networkRecordsToDevtoolsLog([mainResource]);

    const artifacts = {
      GatherContext: {gatherMode: 'navigation'},
      devtoolsLogs: {[HTTPStatusCodeAudit.DEFAULT_PASS]: devtoolsLog},
      URL: {mainDocumentUrl},
    };

    return HTTPStatusCodeAudit.audit(artifacts, {computedCache: new Map()}).then(auditResult => {
      assert.equal(auditResult.score, 1);
    });
  });

  it('throws when main resource cannot be found in navigation', async () => {
    const mainDocumentUrl = 'https://example.com';

    const artifacts = {
      GatherContext: {gatherMode: 'navigation'},
      devtoolsLogs: {[HTTPStatusCodeAudit.DEFAULT_PASS]: []},
      URL: {mainDocumentUrl},
    };

    const resultPromise = HTTPStatusCodeAudit.audit(artifacts, {computedCache: new Map()});
    await expect(resultPromise).rejects.toThrow();
  });
});
