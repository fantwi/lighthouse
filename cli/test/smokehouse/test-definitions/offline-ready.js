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
 * Expected Lighthouse results from testing the a local test page that works
 * offline with a service worker.
 */
const expectations = {
  artifacts: {
    WebAppManifest: {
      value: {
        icons: {
          value: [
            {value: {src: {value: 'http://localhost:10503/launcher-icon-0-75x.png'}}},
            {value: {src: {value: 'http://localhost:10503/launcher-icon-1x.png'}}},
            {value: {src: {value: 'http://localhost:10503/launcher-icon-1-5x.png'}}},
            {value: {src: {value: 'http://localhost:10503/launcher-icon-2x.png'}}},
            {value: {src: {value: 'http://localhost:10503/launcher-icon-3x.png'}}},
          ],
        },
      },
    },
    InstallabilityErrors: {
      errors: {
        length: 1,
        0: {
          // For a few days in m89, the warn-not-offline-capable error also showed up here.
          // https://github.com/GoogleChrome/lighthouse/issues/11800
          errorId: /no-icon-available/,
        },
      },
    },
  },
  lhr: {
    requestedUrl: 'http://localhost:10503/offline-ready.html',
    finalDisplayedUrl: 'http://localhost:10503/offline-ready.html',
    audits: {
      'is-on-https': {
        score: 1,
      },
      'service-worker': {
        score: 1,
        details: {
          scriptUrl: 'http://localhost:10503/offline-ready-sw.js',
          scopeUrl: 'http://localhost:10503/',
        },
      },
      'viewport': {
        score: 1,
      },
      'user-timings': {
        scoreDisplayMode: 'notApplicable',
      },
      'critical-request-chains': {
        scoreDisplayMode: 'notApplicable',
      },
      'installable-manifest': {
        score: 0,
        details: {items: [{reason: 'Downloaded icon was empty or corrupted'}]},
      },
      'splash-screen': {
        score: 0,
      },
      'themed-omnibox': {
        score: 0,
      },
      'aria-valid-attr': {
        scoreDisplayMode: 'notApplicable',
      },
      'aria-allowed-attr': {
        scoreDisplayMode: 'notApplicable',
      },
      'color-contrast': {
        score: 1,
      },
      'image-alt': {
        score: 0,
      },
      'label': {
        scoreDisplayMode: 'notApplicable',
      },
      'tabindex': {
        scoreDisplayMode: 'notApplicable',
      },
      'content-width': {
        score: 1,
      },
    },
  },
};

export default {
  id: 'offline-ready',
  expectations,
  config,
  runSerially: true,
};
