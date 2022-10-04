/**
 * @license Copyright 2018 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/**
 * Config file for sites with various errors, just fail out quickly.
 * @type {LH.Config.Json}
 */
const config = {
  extends: 'lighthouse:default',
  settings: {
    maxWaitForLoad: 5000,
    onlyAudits: [
      'first-contentful-paint',
    ],
  },
};

// Just using `[]` actually asserts for an empty array.
// Use this expectation object to assert an array with at least one element.
const NONEMPTY_ARRAY = {
  length: '>0',
};

/**
 * @type {Smokehouse.ExpectedRunnerResult}
 * Expected Lighthouse results for a site with an expired certificate.
 */
const expectations = {
  lhr: {
    requestedUrl: 'https://expired.badssl.com',
    finalDisplayedUrl: /(expired.badssl.com|chrome-error)/,
    runtimeError: {code: 'INSECURE_DOCUMENT_REQUEST'},
    runWarnings: Object.defineProperty([
      /expired.badssl.*redirected to chrome-error:/, // This warning was not provided in legacy reports.
      'The URL you have provided does not have a valid security certificate. net::ERR_CERT_DATE_INVALID',
    ], '_fraggleRockOnly', {value: true, enumerable: true}),
    audits: {
      'first-contentful-paint': {
        scoreDisplayMode: 'error',
        errorMessage: 'Required traces gatherer did not run.',
      },
    },
  },
  artifacts: {
    PageLoadError: {code: 'INSECURE_DOCUMENT_REQUEST'},
    devtoolsLogs: {
      'pageLoadError-defaultPass': {...NONEMPTY_ARRAY, _legacyOnly: true},
      'pageLoadError-default': {...NONEMPTY_ARRAY, _fraggleRockOnly: true},
    },
    traces: {
      'pageLoadError-defaultPass': {traceEvents: NONEMPTY_ARRAY, _legacyOnly: true},
      'pageLoadError-default': {traceEvents: NONEMPTY_ARRAY, _fraggleRockOnly: true},
    },
  },
};

export default {
  id: 'errors-expired-ssl',
  expectations,
  config,
  runSerially: true,
};
