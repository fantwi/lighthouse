/**
 * @license Copyright 2021 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/** @type {LH.Config.Json} */
const config = {
  extends: 'lighthouse:default',
  settings: {
    onlyCategories: ['performance'],
  },
};

/**
 * @type {Smokehouse.ExpectedRunnerResult}
 */
const expectations = {
  lhr: {
    requestedUrl: 'http://localhost:10200/perf/animations.html',
    finalDisplayedUrl: 'http://localhost:10200/perf/animations.html',
    audits: {
      'non-composited-animations': {
        score: null,
        displayValue: '1 animated element found',
        details: {
          items: [
            {
              node: {
                type: 'node',
                path: '2,HTML,1,BODY,1,DIV',
                selector: 'body > div#animated-boi',
                nodeLabel: 'This is changing font size',
                snippet: '<div id="animated-boi">',
              },
              subItems: {
                items: [
                  {
                    // From JavaScript `.animate` which has no animation display name
                    failureReason: 'Unsupported CSS Property: width',
                  },
                  {
                    failureReason: 'Unsupported CSS Property: height',
                    animation: 'alpha',
                  },
                  {
                    failureReason: 'Unsupported CSS Property: font-size',
                    animation: 'beta',
                  },
                ],
              },
            },
          ],
        },
      },
    },
  },
};

export default {
  id: 'perf-diagnostics-animations',
  expectations,
  config,
};
