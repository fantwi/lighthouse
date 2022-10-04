/**
 * @license Copyright 2016 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/** @type {LH.Config.Json} */
const config = {
  extends: 'lighthouse:default',
  settings: {
    onlyCategories: [
      'best-practices',
    ],
    onlyAudits: [
      'is-on-https',
      'service-worker',
      'viewport',
      'user-timings',
      'critical-request-chains',
      'render-blocking-resources',
      'installable-manifest',
      'splash-screen',
      'themed-omnibox',
      'aria-valid-attr',
      'aria-allowed-attr',
      'color-contrast',
      'image-alt',
      'label',
      'tabindex',
      'content-width',
    ],
  },
};

/**
 * @type {Smokehouse.ExpectedRunnerResult}
 * Expected Lighthouse results from testing the a local test page with a broken service worker.
 */
const expectations = {
  lhr: {
    requestedUrl: 'http://localhost:10503/offline-ready.html?broken',
    // This page's SW has a `fetch` handler that doesn't provide a 200 response.
    finalDisplayedUrl: 'http://localhost:10503/offline-ready.html?broken',
    audits: {
      'installable-manifest': {
        score: 0,
        details: {items: {length: 1}},
        // TODO: 'warn-not-offline-capable' was disabled in m91. Turn back on once
        // issues are addressed and check is re-enabled: https://crbug.com/1187668#c22
        // warnings: {length: 1},
      },
    },
  },
  artifacts: {
    InstallabilityErrors: {
      errors: [
        {
          errorId: /no-icon-available/,
        },
      ],
    },
  },
};

export default {
  id: 'offline-sw-broken',
  expectations,
  config,
  runSerially: true,
};
