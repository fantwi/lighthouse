/**
 * @license Copyright 2016 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/** @type {LH.Config.Json} */
const config = {
  extends: 'lighthouse:default',
  audits: [
    // Test the `ignoredPatterns` audit option.
    {path: 'errors-in-console', options: {ignoredPatterns: ['An ignored error']}},
  ],
};

const imgA = {
  top: '650±50',
  bottom: '650±50',
  left: '10±10',
  right: '120±20',
  width: '120±20',
  height: '20±20',
};

const imgB = {
  top: '575±50',
  bottom: '650±50',
  left: '130±10',
  right: '250±20',
  width: '120±20',
  height: '80±20',
};

/**
 * @type {Smokehouse.ExpectedRunnerResult}
 * Expected Lighthouse audit values for Do Better Web tests.
 */
const expectations = {
  networkRequests: {
    // Number of network requests differs between Fraggle Rock and legacy modes because
    // FR has fewer passes, preserve this check moving forward.
    _fraggleRockOnly: true,

    // 22 requests made for a single navigation.
    // 6 extra requests made because stylesheets are evicted from the cache by the time DT opens.
    length: 28,
  },
  artifacts: {
    BenchmarkIndex: '<10000',
    HostFormFactor: 'desktop',
    Stacks: [{
      id: 'jquery',
    }, {
      id: 'jquery-fast',
      name: 'jQuery (Fast path)',
    }, {
      id: 'wordpress',
    }],
    MainDocumentContent: /^<!doctype html>.*DoBetterWeb Mega Tester.*aggressive-promise-polyfill.*<\/html>[\r\n]*$/s,
    LinkElements: [
      {
        rel: 'stylesheet',
        href: 'http://localhost:10200/dobetterweb/dbw_tester.css?delay=100',
        hrefRaw: './dbw_tester.css?delay=100',
        hreflang: '',
        as: '',
        crossOrigin: null,
        source: 'head',
      },
      {
        rel: 'stylesheet',
        href: 'http://localhost:10200/dobetterweb/unknown404.css?delay=200',
        hrefRaw: './unknown404.css?delay=200',
        hreflang: '',
        as: '',
        crossOrigin: null,
        source: 'head',
      },
      {
        rel: 'stylesheet',
        href: 'http://localhost:10200/dobetterweb/dbw_tester.css?delay=2200',
        hrefRaw: './dbw_tester.css?delay=2200',
        hreflang: '',
        as: '',
        crossOrigin: null,
        source: 'head',
      },
      {
        rel: 'stylesheet',
        href: 'http://localhost:10200/dobetterweb/dbw_disabled.css?delay=200&isdisabled',
        hrefRaw: './dbw_disabled.css?delay=200&isdisabled',
        hreflang: '',
        as: '',
        crossOrigin: null,
        source: 'head',
      },
      {
        rel: 'stylesheet',
        href: 'http://localhost:10200/dobetterweb/dbw_tester.css?delay=3000&capped',
        hrefRaw: './dbw_tester.css?delay=3000&capped',
        hreflang: '',
        as: '',
        crossOrigin: null,
        source: 'head',
      },
      {
        rel: 'stylesheet',
        href: 'http://localhost:10200/dobetterweb/dbw_tester.css?delay=2000&async=true',
        hrefRaw: './dbw_tester.css?delay=2000&async=true',
        hreflang: '',
        as: 'style',
        crossOrigin: null,
        source: 'head',
      },
      {
        rel: 'stylesheet',
        href: 'http://localhost:10200/dobetterweb/dbw_tester.css?delay=3000&async=true',
        hrefRaw: './dbw_tester.css?delay=3000&async=true',
        hreflang: '',
        as: '',
        crossOrigin: null,
        source: 'head',
      },
      {
        rel: 'alternate stylesheet',
        href: 'http://localhost:10200/dobetterweb/empty.css',
        hrefRaw: './empty.css',
        hreflang: '',
        as: '',
        crossOrigin: null,
        source: 'head',
      },
      {
        rel: 'stylesheet',
        href: 'http://localhost:10200/dobetterweb/dbw_tester.css?scriptActivated&delay=200',
        hrefRaw: './dbw_tester.css?scriptActivated&delay=200',
        hreflang: '',
        as: '',
        crossOrigin: null,
        source: 'head',
      },
    ],
    MetaElements: [
      {
        name: '',
        content: '',
        charset: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, minimum-scale=1',
      },
      {
        name: '',
        content: 'Open Graph smoke test description',
        property: 'og:description',
      },
    ],
    TagsBlockingFirstPaint: [
      {
        tag: {
          tagName: 'LINK',
          url: 'http://localhost:10200/dobetterweb/dbw_tester.css?delay=100',
        },
      },
      {
        tag: {
          tagName: 'LINK',
          url: 'http://localhost:10200/dobetterweb/unknown404.css?delay=200',
        },
      },
      {
        tag: {
          tagName: 'LINK',
          url: 'http://localhost:10200/dobetterweb/dbw_tester.css?delay=2200',
        },

      },
      {
        tag: {
          tagName: 'LINK',
          url: 'http://localhost:10200/dobetterweb/dbw_tester.css?delay=3000&capped',
          mediaChanges: [
            {
              href: 'http://localhost:10200/dobetterweb/dbw_tester.css?delay=3000&capped',
              media: 'not-matching',
              matches: false,
            },
            {
              href: 'http://localhost:10200/dobetterweb/dbw_tester.css?delay=3000&capped',
              media: 'screen',
              matches: true,
            },
          ],
        },
      },
      {
        tag: {
          tagName: 'SCRIPT',
          url: 'http://localhost:10200/dobetterweb/dbw_tester.js',
        },
      },
      {
        tag: {
          tagName: 'SCRIPT',
          url: 'http://localhost:10200/dobetterweb/fcp-delayer.js?delay=5000',
        },
      },
    ],
    GlobalListeners: [{
      type: 'unload',
      scriptId: /^\d+$/,
      lineNumber: '>300',
      columnNumber: '>30',
    }],
  },
  lhr: {
    requestedUrl: 'http://localhost:10200/dobetterweb/dbw_tester.html',
    finalDisplayedUrl: 'http://localhost:10200/dobetterweb/dbw_tester.html',
    audits: {
      'errors-in-console': {
        score: 0,
        details: {
          items: {
            0: {
              source: 'exception',
              description: /^Error: A distinctive error\s+at http:\/\/localhost:10200\/dobetterweb\/dbw_tester.html:\d+:\d+$/,
              sourceLocation: {url: 'http://localhost:10200/dobetterweb/dbw_tester.html'},
            },
            1: {
              source: 'console.error',
              description: 'Error! Error!',
              sourceLocation: {url: 'http://localhost:10200/dobetterweb/dbw_tester.html'},
            },
            2: {
              source: 'network',
              description: 'Failed to load resource: the server responded with a status of 404 (Not Found)',
              sourceLocation: {url: 'http://localhost:10200/dobetterweb/unknown404.css?delay=200'},
            },
            3: {
              source: 'network',
              description: 'Failed to load resource: the server responded with a status of 404 (Not Found)',
              sourceLocation: {url: 'http://localhost:10200/dobetterweb/fcp-delayer.js?delay=5000'},
            },
            4: {
              source: 'network',
              description: 'Failed to load resource: the server responded with a status of 404 (Not Found)',
              sourceLocation: {url: 'http://localhost:10200/favicon.ico'},
            },
            // In legacy Lighthouse this audit will have additional duplicate failures which are a mistake.
            // Fraggle Rock ordering of gatherer `stopInstrumentation` and `getArtifact` fixes the re-request issue.
          },
        },
      },
      'is-on-https': {
        score: 0,
        details: {
          items: [
            {
              url: 'http://ajax.googleapis.com/ajax/libs/jquery/2.1.1/jquery.min.js',
              resolution: 'Allowed',
            },
          ],
        },
      },
      'geolocation-on-start': {
        score: 0,
      },
      'no-document-write': {
        score: 0,
        details: {
          items: {
            length: 3,
          },
        },
      },
      'notification-on-start': {
        score: 0,
      },
      'render-blocking-resources': {
        score: '<1',
        numericValue: '>100',
        details: {
          items: [
            {
              url: 'http://localhost:10200/dobetterweb/dbw_tester.css?delay=100',
            },
            {
              url: 'http://localhost:10200/dobetterweb/unknown404.css?delay=200',
            },
            {
              url: 'http://localhost:10200/dobetterweb/dbw_tester.css?delay=2200',
            },
            {
              url: 'http://localhost:10200/dobetterweb/dbw_tester.css?delay=3000&capped',
            },
            {
              url: 'http://localhost:10200/dobetterweb/dbw_tester.js',
            },
            {
              url: 'http://localhost:10200/dobetterweb/fcp-delayer.js?delay=5000',
            },
          ],
        },
      },
      'uses-passive-event-listeners': {
        score: 0,
        details: {
          items: {
          // Note: Originally this was 7 but M56 defaults document-level
          // listeners to passive. See https://chromestatus.com/features/5093566007214080
          // Note: It was 4, but {passive:false} doesn't get a warning as of M63: https://crbug.com/770208
          // Note: It was 3, but wheel events are now also passive as of field trial in M71 https://crbug.com/626196
            length: '>=1',
          },
        },
      },
      'deprecations': {
        // see https://github.com/GoogleChrome/lighthouse/issues/13895
        score: 0,
        details: {
          items: [
            {
              value: /`window.webkitStorageInfo` is deprecated/,
              source: {
                type: 'source-location',
                url: 'http://localhost:10200/dobetterweb/dbw_tester.js',
                urlProvider: 'network',
                line: '>0',
                column: 9,
              },
              subItems: undefined,
            },
            {
              value: /Synchronous `XMLHttpRequest` on the main thread is deprecated/,
              source: {
                type: 'source-location',
                url: 'http://localhost:10200/dobetterweb/dbw_tester.html',
                urlProvider: 'network',
                line: '>0',
                column: 6,
              },
              subItems: undefined,
            },
          ],
        },
      },
      'password-inputs-can-be-pasted-into': {
        score: 0,
        details: {
          items: {
            length: 2,
          },
        },
      },
      'image-aspect-ratio': {
        score: 0,
        details: {
          items: {
            0: {
              displayedAspectRatio: /^120 x 15/,
              url: 'http://localhost:10200/dobetterweb/lighthouse-480x318.jpg?iar1',
            },
            length: 1,
          },
        },
      },
      'image-size-responsive': {
        score: 0,
        details: {
          items: {
            0: {
              url: 'http://localhost:10200/dobetterweb/lighthouse-480x318.jpg?isr1',
            },
            length: 1,
          },
        },
      },
      'efficient-animated-content': {
        score: '<0.5',
        details: {
          overallSavingsMs: '>2000',
          items: [
            {
              url: 'http://localhost:10200/dobetterweb/lighthouse-rotating.gif',
              totalBytes: 934285,
              wastedBytes: 682028,
            },
          ],
        },
      },
      'js-libraries': {
        scoreDisplayMode: 'informative',
        details: {
          items: [{
            name: 'jQuery',
          },
          {
            name: 'WordPress',
          }],
        },
      },
      'dom-size': {
        score: 1,
        numericValue: 153,
        details: {
          items: [
            {statistic: 'Total DOM Elements', value: 153},
            {statistic: 'Maximum DOM Depth', value: 4},
            {
              statistic: 'Maximum Child Elements',
              value: 100,
              node: {snippet: '<div id="shadow-root-container">'},
            },
          ],
        },
      },
      'no-unload-listeners': {
        score: 0,
        details: {
          items: [{
            source: {
              type: 'source-location',
              url: 'http://localhost:10200/dobetterweb/dbw_tester.html',
              urlProvider: 'network',
              line: '>300',
              column: '>30',
            },
          }],
        },
      },
      'full-page-screenshot': {
        score: null,
        details: {
          type: 'full-page-screenshot',
          screenshot: {
            width: 360,
            // Allow for differences in platforms.
            height: '1350±100',
            data: /^data:image\/webp;.{500,}/,
          },
          nodes: {
            _includes: [
              // Test that the numbers for individual elements are in the ballpark.
              [/[0-9]-[0-9]+-IMG/, imgA],
              [/[0-9]-[0-9]+-IMG/, imgB],
              // And then many more nodes...
            ],
            _excludes: [
              // Ensure that the nodes we found above are unique.
              [/[0-9]-[0-9]+-IMG/, imgA],
              [/[0-9]-[0-9]+-IMG/, imgB],
            ],
          },
        },
      },
    },
  },
};

export default {
  id: 'dbw',
  expectations,
  config,
  runSerially: true, // Need access to network request assertions.
};
