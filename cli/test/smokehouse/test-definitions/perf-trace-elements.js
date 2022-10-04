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
 * Expected Lighthouse audit values for testing key elements from the trace.
 */
const expectations = {
  networkRequests: {
    // DevTools loads the page three times, so this request count will not be accurate.
    _excludeRunner: 'devtools',
    length: 3,
  },
  artifacts: {
    TraceElements: [
      {
        traceEventType: 'largest-contentful-paint',
        node: {
          nodeLabel: 'section > img',
          snippet: '<img src="../dobetterweb/lighthouse-480x318.jpg" loading="lazy">',
          boundingRect: {
            top: 108,
            bottom: 426,
            left: 8,
            right: 488,
            width: 480,
            height: 318,
          },
        },
        type: 'image',
      },
      {
        traceEventType: 'layout-shift',
        node: {
          selector: 'body > h1',
          nodeLabel: 'Please don\'t move me',
          snippet: '<h1>',
          boundingRect: {
            top: 465,
            bottom: 502,
            left: 8,
            right: 352,
            width: 344,
            height: 37,
          },
        },
        score: '0.058 +/- 0.01',
      },
      {
        traceEventType: 'layout-shift',
        node: {
          nodeLabel: 'Sorry!',
          snippet: '<div style="height: 18px;">',
          boundingRect: {
            top: 426,
            bottom: 444,
            left: 8,
            right: 352,
            width: 344,
            height: 18,
          },
        },
        score: '0.026 +/- 0.01',
      },
      {
        traceEventType: 'animation',
        node: {
          selector: 'body > div#animate-me',
          nodeLabel: 'This is changing font size',
          snippet: '<div id="animate-me">',
          boundingRect: {
            top: 8,
            bottom: 108,
            left: 8,
            right: 108,
            width: 100,
            height: 100,
          },
        },
        animations: [
          {
            name: 'anim',
            failureReasonsMask: 8224,
            unsupportedProperties: ['font-size'],
          },
        ],
      },
    ],
  },
  lhr: {
    requestedUrl: 'http://localhost:10200/perf/trace-elements.html',
    finalDisplayedUrl: 'http://localhost:10200/perf/trace-elements.html',
    audits: {
      'largest-contentful-paint-element': {
        score: null,
        displayValue: '1 element found',
        details: {
          items: [
            {
              node: {
                type: 'node',
                nodeLabel: 'section > img',
                path: '0,HTML,1,BODY,1,DIV,a,#document-fragment,0,SECTION,0,IMG',
              },
            },
          ],
        },
      },
      'lcp-lazy-loaded': {
        score: 0,
        details: {
          items: [
            {
              node: {
                type: 'node',
                nodeLabel: 'section > img',
              },
            },
          ],
        },
      },
      'layout-shift-elements': {
        score: null,
        displayValue: '2 elements found',
        details: {
          items: {
            length: 2,
          },
        },
      },
      'long-tasks': {
        score: null,
        details: {
          items: {
            0: {
              url: 'http://localhost:10200/perf/delayed-element.js',
              duration: '>500',
              startTime: '5000 +/- 5000', // make sure it's on the right time scale, but nothing more
            },
          },
        },
      },
      'preload-lcp-image': {
        score: 1,
        numericValue: 0,
        details: {
          items: [{
            url: 'http://localhost:10200/dobetterweb/lighthouse-480x318.jpg',
          }],
          debugData: {
            initiatorPath: [{
              url: 'http://localhost:10200/dobetterweb/lighthouse-480x318.jpg',
              initiatorType: 'other',
            }, {
              url: 'http://localhost:10200/perf/trace-elements.html',
              initiatorType: 'other',
            }],
            pathLength: 2,
          },
        },
      },
    },
  },
};

export default {
  id: 'perf-trace-elements',
  expectations,
  config,
  runSerially: true,
};
