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
 * Expected Lighthouse results for a site with a JS infinite loop.
 */
const expectations = {
  lhr: {
    requestedUrl: 'http://localhost:10200/infinite-loop.html',
    finalDisplayedUrl: 'http://localhost:10200/infinite-loop.html',
    runtimeError: {code: 'PAGE_HUNG'},
    runWarnings: ['Lighthouse was unable to reliably load the URL you requested because the page stopped responding.'],
    audits: {
      'first-contentful-paint': {
        scoreDisplayMode: 'error',
        errorMessage: 'Required traces gatherer did not run.',
      },
    },
  },
  artifacts: {
    PageLoadError: {code: 'PAGE_HUNG'},
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
  id: 'errors-infinite-loop',
  expectations,
  config,
  runSerially: true,
};
