/**
 * @license Copyright 2017 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

const BASE_URL = 'http://localhost:10200/seo/';

/** @type {LH.Config.Json} */
const config = {
  extends: 'lighthouse:default',
  settings: {
    onlyCategories: ['seo'],
  },
};

const expectedGatheredTapTargets = [
  {
    node: {
      snippet: /large-link-at-bottom-of-page/,
    },
  },
  {
    node: {
      snippet: /visible-target/,
    },
  },
  {
    node: {
      snippet: /target-with-client-rect-outside-scroll-container/,
    },
  },
  {
    node: {
      snippet: /link-containing-large-inline-block-element/,
    },
  },
  {
    node: {
      snippet: /link-next-to-link-containing-large-inline-block-element/,
    },
  },
  {
    node: {
      snippet: /tap-target-containing-other-tap-targets/,
    },
  },
  {
    node: {
      snippet: /child-client-rect-hidden-by-overflow-hidden/,
    },
  },
  {
    node: {
      snippet: /tap-target-next-to-child-client-rect-hidden-by-overflow-hidden/,
    },
  },
  {
    node: {
      snippet: /child-client-rect-overlapping-other-target/,
    },
    shouldFail: true,
  },
  {
    node: {
      snippet: /tap-target-overlapped-by-other-targets-position-absolute-child-rect/,
    },
    shouldFail: true,
  },
  {
    node: {
      snippet: /position-absolute-tap-target-fully-contained-in-other-target/,
    },
  },
  {
    node: {
      snippet: /tap-target-fully-containing-position-absolute-target/,
    },
  },
  {
    node: {
      snippet: /too-small-failing-tap-target/,
    },
    shouldFail: true,
  },
  {
    node: {
      snippet: /large-enough-tap-target-next-to-too-small-tap-target/,
    },
  },
  {
    node: {
      snippet: /zero-width-tap-target-with-overflowing-child-content/,
    },
    shouldFail: true,
  },
  {
    node: {
      snippet: /passing-tap-target-next-to-zero-width-target/,
    },
  },
  {
    node: {
      snippet: /links-with-same-link-target-1/,
    },
  },
  {
    node: {
      snippet: /links-with-same-link-target-2/,
    },
  },
];

/**
 * @type {Smokehouse.ExpectedRunnerResult}
 * Expected Lighthouse audit values for a site exercising tap targets.
 */
const expectations = {
  lhr: {
    finalDisplayedUrl: BASE_URL + 'seo-tap-targets.html',
    requestedUrl: BASE_URL + 'seo-tap-targets.html',
    audits: {
      'tap-targets': {
        score: (() => {
          const totalTapTargets = expectedGatheredTapTargets.length;
          const passingTapTargets = expectedGatheredTapTargets.filter(t => !t.shouldFail).length;
          const SCORE_FACTOR = 0.89;
          return Math.round(passingTapTargets / totalTapTargets * SCORE_FACTOR * 100) / 100;
        })(),
        details: {
          items: [
            {
              'tapTarget': {
                'type': 'node',
                /* eslint-disable max-len */
                'snippet': '<a data-gathered-target="zero-width-tap-target-with-overflowing-child-content" style="display: block; width: 0; white-space: nowrap">',
                'path': '2,HTML,1,BODY,14,DIV,0,A',
                'selector': 'body > div > a',
                'nodeLabel': 'zero width target',
              },
              'overlappingTarget': {
                'type': 'node',
                /* eslint-disable max-len */
                'snippet': '<a data-gathered-target="passing-tap-target-next-to-zero-width-target" style="display: block; width: 110px; height: 100px;background: #aaa;">',
                'path': '2,HTML,1,BODY,14,DIV,1,A',
                'selector': 'body > div > a',
                'nodeLabel': 'passing target',
              },
              'tapTargetScore': 864,
              'overlappingTargetScore': 720,
              'overlapScoreRatio': 0.8333333333333334,
              'size': '110x18',
              'width': 110,
              'height': 18,
            },
            {
              'tapTarget': {
                'type': 'node',
                'path': '2,HTML,1,BODY,10,DIV,0,DIV,1,A',
                'selector': 'body > div > div > a',
                'nodeLabel': 'too small target',
              },
              'overlappingTarget': {
                'type': 'node',
                'path': '2,HTML,1,BODY,10,DIV,0,DIV,2,A',
                'selector': 'body > div > div > a',
                'nodeLabel': 'big enough target',
              },
              'tapTargetScore': 1440,
              'overlappingTargetScore': 432,
              'overlapScoreRatio': 0.3,
              'size': '100x30',
              'width': 100,
              'height': 30,
            },
            {
              'tapTarget': {
                'type': 'node',
                'path': '2,HTML,1,BODY,3,DIV,24,A',
                'selector': 'body > div > a',
                'nodeLabel': 'left',
              },
              'overlappingTarget': {
                'type': 'node',
                'path': '2,HTML,1,BODY,3,DIV,25,A',
                'selector': 'body > div > a',
                'nodeLabel': 'right',
              },
              'tapTargetScore': 1920,
              'overlappingTargetScore': 560,
              'overlapScoreRatio': 0.2916666666666667,
              'size': '40x40',
              'width': 40,
              'height': 40,
            },
          ],
        },
      },
    },
  },
  artifacts: {
    TapTargets: expectedGatheredTapTargets.map(({node}) => ({node})),
  },
};

export default {
  id: 'seo-tap-targets',
  expectations,
  config,
};
