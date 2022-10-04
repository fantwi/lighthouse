/**
 * @license Copyright 2016 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import pwaDetailsExpectations from './pwa-expectations-details.js';

const pwaRocksExpectations = {...pwaDetailsExpectations, hasIconsAtLeast512px: false};

/** @type {LH.Config.Json} */
const config = {
  extends: 'lighthouse:default',
  settings: {
    onlyCategories: ['pwa'],
  },
};

/**
 * @type {Smokehouse.ExpectedRunnerResult}
 * Expected Lighthouse results for (the archived) pwa.rocks.
 */
const expectations = {
  lhr: {
    // Archived version of https://github.com/pwarocks/pwa.rocks
    // Fork is here: https://github.com/connorjclark/pwa.rocks
    requestedUrl: 'https://connorjclark.github.io/pwa.rocks/',
    finalDisplayedUrl: 'https://connorjclark.github.io/pwa.rocks/',
    audits: {
      'service-worker': {
        score: 1,
      },
      'viewport': {
        score: 1,
      },
      'installable-manifest': {
        score: 1,
        details: {items: [], debugData: {manifestUrl: 'https://connorjclark.github.io/pwa.rocks/pwa.webmanifest'}},
      },
      'splash-screen': {
        score: 0,
        details: {items: [pwaRocksExpectations]},
      },
      'themed-omnibox': {
        score: 0,
        details: {items: [pwaRocksExpectations]},
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
  id: 'pwa-rocks',
  expectations,
  config,
};
