/**
 * @license Copyright 2016 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import pwaDetailsExpectations from './pwa-expectations-details.js';

const jakeExpectations = {...pwaDetailsExpectations, hasShortName: false};

/** @type {LH.Config.Json} */
const config = {
  extends: 'lighthouse:default',
  settings: {
    onlyCategories: ['pwa'],
  },
};

/**
 * @type {Smokehouse.ExpectedRunnerResult}
 * Expected Lighthouse results for svgomg.
 */
const expectations = {
  lhr: {
    runWarnings: {
      // In DevTools the IndexedDB storage from the initial load will persist into the Lighthouse run, emitting a warning.
      // For non-DevTools runners, this will revert to the default expectation of 0 run warnings.
      _runner: 'devtools',
      length: 1,
    },
    requestedUrl: 'https://jakearchibald.github.io/svgomg/',
    finalDisplayedUrl: 'https://jakearchibald.github.io/svgomg/',
    audits: {
      'service-worker': {
        score: 1,
      },
      'viewport': {
        score: 1,
      },
      'installable-manifest': {
        score: 1,
        details: {items: [], debugData: {manifestUrl: 'https://jakearchibald.github.io/svgomg/manifest.json'}},
      },
      'splash-screen': {
        score: 1,
        details: {items: [jakeExpectations]},
      },
      'themed-omnibox': {
        score: 1,
        details: {items: [jakeExpectations]},
      },
      'content-width': {
        score: 1,
      },

      // "manual" audits. Just verify in the results.
      'pwa-cross-browser': {
        score: null,
        scoreDisplayMode: 'manual',
      },
      'pwa-page-transitions': {
        score: null,
        scoreDisplayMode: 'manual',
      },
      'pwa-each-page-has-url': {
        score: null,
        scoreDisplayMode: 'manual',
      },
    },
  },
};

export default {
  id: 'pwa-svgomg',
  expectations,
  config,
};
