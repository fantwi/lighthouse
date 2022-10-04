/**
 * @license Copyright 2017 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/** @type {LH.Config.Json} */
const config = {
  extends: 'lighthouse:default',
  settings: {
    throttlingMethod: 'devtools',
    // preload-fonts isn't a performance audit, but can easily leverage the font
    // webpages present here, hence the inclusion of 'best-practices'.
    onlyCategories: ['performance', 'best-practices'],

    // A mixture of under, over, and meeting budget to exercise all paths.
    budgets: [{
      path: '/',
      resourceCounts: [
        {resourceType: 'total', budget: 8},
        {resourceType: 'stylesheet', budget: 1}, // meets budget
        {resourceType: 'image', budget: 1},
        {resourceType: 'media', budget: 0},
        {resourceType: 'font', budget: 2}, // meets budget
        {resourceType: 'script', budget: 1},
        {resourceType: 'document', budget: 0},
        {resourceType: 'other', budget: 1},
        {resourceType: 'third-party', budget: 0},
      ],
      resourceSizes: [
        {resourceType: 'total', budget: 100},
        {resourceType: 'stylesheet', budget: 0},
        {resourceType: 'image', budget: 30}, // meets budget
        {resourceType: 'media', budget: 0},
        {resourceType: 'font', budget: 75},
        {resourceType: 'script', budget: 30},
        {resourceType: 'document', budget: 1},
        {resourceType: 'other', budget: 2}, // meets budget
        {resourceType: 'third-party', budget: 0},
      ],
      timings: [
        {metric: 'first-contentful-paint', budget: 2000},
        {metric: 'interactive', budget: 2000},
        {metric: 'first-meaningful-paint', budget: 2000},
        {metric: 'max-potential-fid', budget: 2000},
      ],
    }],
  },
};

/**
 * @type {Smokehouse.ExpectedRunnerResult}
 * Expected Lighthouse audit values for preload tests.
 */
const expectations = {
  networkRequests: {
    // DevTools loads the page three times, so this request count will not be accurate.
    _excludeRunner: 'devtools',
    // 8 requests made for normal page testing.
    // 1 extra request made because stylesheets are evicted from the cache by the time DT opens.
    length: 9,
  },
  lhr: {
    requestedUrl: 'http://localhost:10200/preload.html',
    finalDisplayedUrl: 'http://localhost:10200/preload.html',
    audits: {
      'speed-index': {
        score: '>=0.80', // primarily just making sure it didn't fail/go crazy, specific value isn't that important
      },
      'first-meaningful-paint': {
        score: '>=0.90', // primarily just making sure it didn't fail/go crazy, specific value isn't that important
      },
      'interactive': {
        score: '>=0.90', // primarily just making sure it didn't fail/go crazy, specific value isn't that important
      },
      'server-response-time': {
        // Can be flaky, so test float numericValue instead of binary score
        numericValue: '<1000',
      },
      'network-requests': {
        details: {
          items: {
            _includes: [
              {url: 'http://localhost:10200/preload.html', isLinkPreload: undefined, experimentalFromMainFrame: true},
              {url: 'http://localhost:10200/perf/level-2.js?warning&delay=500', isLinkPreload: true, experimentalFromMainFrame: true},
              {url: 'http://localhost:10200/perf/preload_tester.js', isLinkPreload: undefined, experimentalFromMainFrame: true},
            ],
            length: '>5',
          },
        },
      },
      'uses-rel-preload': {
        scoreDisplayMode: 'notApplicable',
        // Disabled for now, see https://github.com/GoogleChrome/lighthouse/issues/11960
        // score: '<1',
        // numericValue: '>500',
        // warnings: {
        //   0: /level-2.*warning/,
        //   length: 1,
        // },
        // details: {
        //   items: {
        //     length: 1,
        //   },
        // },
      },
      'uses-rel-preconnect': {
        score: 1,
        warnings: [/localhost:10503/],
      },
    },
  },
};

export default {
  id: 'perf-preload',
  expectations,
  config,
  runSerially: true,
};
